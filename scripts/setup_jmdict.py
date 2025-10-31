#!/usr/bin/env python3
"""
Setup script to load JMDict_e (Japanese-English dictionary) into the database
"""

import xml.etree.ElementTree as ET
import psycopg2
from psycopg2.extras import execute_values
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
load_dotenv()


def parse_jmdict(xml_path):
    """Parse JMdict_e XML and extract dictionary data"""
    print(f"Parsing {xml_path}...")
    
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    entries = []
    
    for idx, entry in enumerate(root.findall('entry')):
        if idx % 10000 == 0:
            print(f"Parsed {idx} entries...")
        
        # Get entry sequence number
        ent_seq = entry.find('ent_seq')
        entry_id = int(ent_seq.text) if ent_seq is not None else None
        
        if entry_id is None:
            continue
        
        # Parse kanji elements
        kanji_elements = []
        for k_idx, k_ele in enumerate(entry.findall('k_ele')):
            keb = k_ele.find('keb')
            if keb is not None:
                ke_pri = [pri.text for pri in k_ele.findall('ke_pri')]
                ke_inf = [inf.text for inf in k_ele.findall('ke_inf')]
                
                # Common words have news1/2, ichi1/2, spec1/2, gai1/2, or nf* tags
                is_common = any(
                    tag in ke_pri 
                    for tag in ['news1', 'news2', 'ichi1', 'ichi2', 'spec1', 'spec2', 'gai1', 'gai2']
                ) or any(tag.startswith('nf') for tag in ke_pri)
                
                kanji_elements.append({
                    'kanji': keb.text,
                    'priority_tags': ke_pri if ke_pri else None,
                    'info': ke_inf if ke_inf else None,
                    'is_common': is_common,
                    'order': k_idx
                })
        
        # Parse reading elements
        reading_elements = []
        for r_idx, r_ele in enumerate(entry.findall('r_ele')):
            reb = r_ele.find('reb')
            if reb is not None:
                re_pri = [pri.text for pri in r_ele.findall('re_pri')]
                re_inf = [inf.text for inf in r_ele.findall('re_inf')]
                
                is_common = any(
                    tag in re_pri 
                    for tag in ['news1', 'news2', 'ichi1', 'ichi2', 'spec1', 'spec2', 'gai1', 'gai2']
                ) or any(tag.startswith('nf') for tag in re_pri)
                
                reading_elements.append({
                    'reading': reb.text,
                    'priority_tags': re_pri if re_pri else None,
                    'info': re_inf if re_inf else None,
                    'is_common': is_common,
                    'order': r_idx
                })
        
        # Parse senses
        senses = []
        for s_idx, sense in enumerate(entry.findall('sense')):
            # Parts of speech
            pos_list = [pos.text for pos in sense.findall('pos')]
            
            # Fields
            field_list = [field.text for field in sense.findall('field')]
            
            # Misc info
            misc_list = [misc.text for misc in sense.findall('misc')]
            
            # Dialects
            dial_list = [dial.text for dial in sense.findall('dial')]
            
            # Cross references
            xrefs = []
            for xref in sense.findall('xref'):
                if xref.text:
                    xrefs.append({
                        'xref_text': xref.text,
                        'xref_type': 'see_also'
                    })
            
            for ant in sense.findall('ant'):
                if ant.text:
                    xrefs.append({
                        'xref_text': ant.text,
                        'xref_type': 'antonym'
                    })
            
            # Glosses
            glosses = []
            for g_idx, gloss in enumerate(sense.findall('gloss')):
                if gloss.text:
                    # Only include English glosses (xml:lang="eng" or no lang specified)
                    lang = gloss.get('{http://www.w3.org/XML/1998/namespace}lang')
                    if lang is None or lang == 'eng':
                        glosses.append({
                            'gloss': gloss.text,
                            'gloss_type': gloss.get('g_type'),
                            'order': g_idx
                        })
            
            if glosses:  # Only include senses with English glosses
                senses.append({
                    'order': s_idx,
                    'parts_of_speech': pos_list if pos_list else None,
                    'fields': field_list if field_list else None,
                    'misc': misc_list if misc_list else None,
                    'dialects': dial_list if dial_list else None,
                    'glosses': glosses,
                    'xrefs': xrefs
                })
        
        if senses:  # Only include entries with senses
            entries.append({
                'entry_id': entry_id,
                'kanji': kanji_elements,
                'readings': reading_elements,
                'senses': senses
            })
    
    print(f"Parsed {len(entries)} dictionary entries")
    return entries


def create_jmdict_schema(db_params, schema_path):
    """Run schema to create JMDict tables"""
    print("Creating JMDict schema...")
    
    conn = psycopg2.connect(**db_params)
    conn.autocommit = True
    cursor = conn.cursor()
    
    with open(schema_path, 'r') as f:
        schema_sql = f.read()
    
    cursor.execute(schema_sql)
    cursor.close()
    conn.close()
    
    print("JMDict schema created successfully")


def populate_jmdict(db_params, entries, kanji_map):
    """Insert JMDict data into database"""
    print("Populating JMDict database...")
    
    conn = psycopg2.connect(**db_params)
    cursor = conn.cursor()
    
    try:
        batch_size = 1000
        total_entries = len(entries)
        
        for batch_start in range(0, total_entries, batch_size):
            batch_end = min(batch_start + batch_size, total_entries)
            batch = entries[batch_start:batch_end]
            
            print(f"Processing entries {batch_start + 1} to {batch_end} of {total_entries}...")
            
            # Insert dictionary entries
            entry_values = [(e['entry_id'],) for e in batch]
            results = execute_values(
                cursor,
                "INSERT INTO dictionary_entries (entry_id) VALUES %s RETURNING id, entry_id",
                entry_values,
                fetch=True
            )
            entry_id_map = {entry_id: db_id for db_id, entry_id in results}
            
            # Insert kanji elements
            kanji_values = []
            for entry in batch:
                db_id = entry_id_map[entry['entry_id']]
                for k in entry['kanji']:
                    kanji_values.append((
                        db_id,
                        k['kanji'],
                        k['is_common'],
                        k['priority_tags'],
                        k['info'],
                        k['order']
                    ))
            
            if kanji_values:
                kanji_results = execute_values(
                    cursor,
                    """
                    INSERT INTO entry_kanji 
                    (entry_id, kanji, is_common, priority_tags, info, kanji_order)
                    VALUES %s
                    RETURNING id, entry_id, kanji_order
                    """,
                    kanji_values,
                    fetch=True
                )
                
                # Map entry_id + order to kanji_id for linking to individual kanji
                kanji_id_map = {}
                for kanji_id, entry_id, order in kanji_results:
                    kanji_id_map[(entry_id, order)] = kanji_id
            
            # Insert reading elements
            reading_values = []
            for entry in batch:
                db_id = entry_id_map[entry['entry_id']]
                for r in entry['readings']:
                    reading_values.append((
                        db_id,
                        r['reading'],
                        r['is_common'],
                        r['priority_tags'],
                        r['info'],
                        r['order']
                    ))
            
            if reading_values:
                execute_values(
                    cursor,
                    """
                    INSERT INTO entry_readings 
                    (entry_id, reading, is_common, priority_tags, info, reading_order)
                    VALUES %s
                    """,
                    reading_values
                )
            
            # Insert senses and glosses
            sense_values = []
            gloss_values = []
            xref_values = []
            
            for entry in batch:
                db_id = entry_id_map[entry['entry_id']]
                for sense in entry['senses']:
                    sense_values.append((
                        db_id,
                        sense['order'],
                        sense['parts_of_speech'],
                        sense['fields'],
                        sense['misc'],
                        sense['dialects']
                    ))
            
            if sense_values:
                sense_results = execute_values(
                    cursor,
                    """
                    INSERT INTO entry_senses 
                    (entry_id, sense_order, parts_of_speech, fields, misc, dialects)
                    VALUES %s
                    RETURNING id, entry_id, sense_order
                    """,
                    sense_values,
                    fetch=True
                )
                
                sense_id_map = {}
                for sense_id, entry_id, order in sense_results:
                    sense_id_map[(entry_id, order)] = sense_id
                
                # Collect glosses and xrefs for all senses in batch
                for entry in batch:
                    db_id = entry_id_map[entry['entry_id']]
                    for sense in entry['senses']:
                        sense_id = sense_id_map[(db_id, sense['order'])]
                        
                        for gloss in sense['glosses']:
                            gloss_values.append((
                                sense_id,
                                gloss['gloss'],
                                gloss['gloss_type'],
                                gloss['order']
                            ))
                        
                        for xref in sense['xrefs']:
                            xref_values.append((
                                sense_id,
                                xref['xref_text'],
                                xref['xref_type']
                            ))
                
                if gloss_values:
                    execute_values(
                        cursor,
                        """
                        INSERT INTO sense_glosses 
                        (sense_id, gloss, gloss_type, gloss_order)
                        VALUES %s
                        """,
                        gloss_values
                    )
                
                if xref_values:
                    execute_values(
                        cursor,
                        """
                        INSERT INTO entry_cross_references 
                        (sense_id, xref_text, xref_type)
                        VALUES %s
                        """,
                        xref_values
                    )
            
            # Link kanji characters to individual kanji from kanji table
            if kanji_values and kanji_map:
                kanji_char_values = []
                for entry in batch:
                    db_id = entry_id_map[entry['entry_id']]
                    for k in entry['kanji']:
                        entry_kanji_id = kanji_id_map.get((db_id, k['order']))
                        if entry_kanji_id:
                            # Extract individual kanji from the word
                            for pos, char in enumerate(k['kanji']):
                                if char in kanji_map:
                                    kanji_char_values.append((
                                        entry_kanji_id,
                                        kanji_map[char],
                                        pos
                                    ))
                
                if kanji_char_values:
                    execute_values(
                        cursor,
                        """
                        INSERT INTO entry_kanji_characters 
                        (entry_kanji_id, kanji_id, position)
                        VALUES %s
                        ON CONFLICT DO NOTHING
                        """,
                        kanji_char_values
                    )
            
            conn.commit()
        
        print(f"Successfully inserted {total_entries} dictionary entries")
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def load_kanji_map(db_params):
    """Load a map of kanji literals to their IDs"""
    print("Loading kanji map...")
    conn = psycopg2.connect(**db_params)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, literal FROM kanji")
    kanji_map = {literal: kid for kid, literal in cursor.fetchall()}
    
    cursor.close()
    conn.close()
    
    print(f"Loaded {len(kanji_map)} kanji")
    return kanji_map


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Setup JMDict database from JMdict_e file')
    parser.add_argument('--name', default='japanese_learning', help='Database name (default: japanese_learning)')
    parser.add_argument('--user', help='PostgreSQL user (default: $PGUSER or postgres)')
    parser.add_argument('--password', help='PostgreSQL password (default: $PGPASSWORD)')
    parser.add_argument('--host', help='PostgreSQL host (default: $PGHOST or localhost)')
    parser.add_argument('--port', help='PostgreSQL port (default: $PGPORT or 5432)')
    
    args = parser.parse_args()
    
    # Paths
    project_root = Path(__file__).parent.parent
    xml_path = project_root / 'JMdict_e'
    schema_path = project_root / 'database' / 'jmdict_schema.sql'
    
    if not xml_path.exists():
        print(f"Error: {xml_path} not found")
        print("Download from: http://www.edrdg.org/jmdict/edict_doc.html")
        sys.exit(1)
    
    if not schema_path.exists():
        print(f"Error: {schema_path} not found")
        sys.exit(1)
    
    # Database connection params
    db_params = {
        'dbname': args.name,
        'user': args.user or os.getenv('PGUSER', 'postgres'),
        'password': args.password or os.getenv('PGPASSWORD', ''),
        'host': args.host or os.getenv('PGHOST', 'localhost'),
        'port': args.port or os.getenv('PGPORT', '5432')
    }
    
    # Create schema
    create_jmdict_schema(db_params, schema_path)
    
    # Load kanji map for linking
    kanji_map = load_kanji_map(db_params)
    
    # Parse XML
    entries = parse_jmdict(xml_path)
    
    # Populate database
    populate_jmdict(db_params, entries, kanji_map)
    
    print("JMDict database setup complete!")


if __name__ == '__main__':
    main()

