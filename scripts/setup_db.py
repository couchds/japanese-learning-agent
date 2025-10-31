#!/usr/bin/env python3
"""
Setup script to create and populate the kanji database from kanjidic2.xml
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


def parse_kanjidic2(xml_path):
    """Parse kanjidic2.xml and extract kanji data"""
    print(f"Parsing {xml_path}...")
    
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    kanji_list = []
    
    for char in root.findall('character'):
        # Basic info
        literal = char.find('literal').text
        
        # Codepoint
        codepoint = char.find('.//cp_value[@cp_type="ucs"]')
        unicode_cp = codepoint.text if codepoint is not None else None
        
        # Radical
        radical = char.find('.//rad_value[@rad_type="classical"]')
        classical_radical = int(radical.text) if radical is not None else None
        
        # Misc info
        misc = char.find('misc')
        grade = misc.find('grade')
        grade_val = int(grade.text) if grade is not None else None
        
        stroke = misc.find('stroke_count')
        stroke_count = int(stroke.text) if stroke is not None else None
        
        freq = misc.find('freq')
        frequency_rank = int(freq.text) if freq is not None else None
        
        jlpt = misc.find('jlpt')
        jlpt_level = int(jlpt.text) if jlpt is not None else None
        
        # Readings and meanings
        on_readings = []
        kun_readings = []
        nanori_readings = []
        meanings = []
        
        rm = char.find('reading_meaning')
        if rm is not None:
            # Readings from rmgroup
            rmgroup = rm.find('rmgroup')
            if rmgroup is not None:
                for reading in rmgroup.findall('reading'):
                    r_type = reading.get('r_type')
                    if r_type == 'ja_on':
                        on_readings.append(reading.text)
                    elif r_type == 'ja_kun':
                        kun_readings.append(reading.text)
                
                # English meanings (no m_lang attribute or m_lang="en")
                for meaning in rmgroup.findall('meaning'):
                    m_lang = meaning.get('m_lang')
                    if m_lang is None or m_lang == 'en':
                        meanings.append(meaning.text)
            
            # Nanori readings
            for nanori in rm.findall('nanori'):
                nanori_readings.append(nanori.text)
        
        kanji_data = {
            'literal': literal,
            'unicode_codepoint': unicode_cp,
            'classical_radical': classical_radical,
            'stroke_count': stroke_count,
            'grade': grade_val,
            'frequency_rank': frequency_rank,
            'jlpt_level': jlpt_level,
            'on_readings': on_readings or None,
            'kun_readings': kun_readings or None,
            'nanori_readings': nanori_readings or None,
            'meanings': meanings
        }
        
        kanji_list.append(kanji_data)
    
    print(f"Parsed {len(kanji_list)} kanji")
    return kanji_list


def create_database(db_params, schema_path):
    """Run schema to create tables"""
    print("Creating database schema...")
    
    conn = psycopg2.connect(**db_params)
    conn.autocommit = True
    cursor = conn.cursor()
    
    with open(schema_path, 'r') as f:
        schema_sql = f.read()
    
    cursor.execute(schema_sql)
    cursor.close()
    conn.close()
    
    print("Schema created successfully")


def populate_database(db_params, kanji_list):
    """Insert kanji data into database"""
    print("Populating database...")
    
    conn = psycopg2.connect(**db_params)
    cursor = conn.cursor()
    
    try:
        # Insert kanji
        kanji_values = [
            (
                k['literal'],
                k['unicode_codepoint'],
                k['classical_radical'],
                k['stroke_count'],
                k['grade'],
                k['frequency_rank'],
                k['jlpt_level'],
                k['on_readings'],
                k['kun_readings'],
                k['nanori_readings']
            )
            for k in kanji_list
        ]
        
        results = execute_values(
            cursor,
            """
            INSERT INTO kanji 
            (literal, unicode_codepoint, classical_radical, stroke_count, 
             grade, frequency_rank, jlpt_level, on_readings, kun_readings, nanori_readings)
            VALUES %s
            RETURNING id, literal
            """,
            kanji_values,
            fetch=True
        )
        
        # Get kanji IDs
        kanji_ids = {literal: kid for kid, literal in results}
        
        # Insert meanings
        meaning_values = []
        for k in kanji_list:
            kanji_id = kanji_ids[k['literal']]
            for idx, meaning in enumerate(k['meanings'], 1):
                meaning_values.append((kanji_id, meaning, idx))
        
        if meaning_values:
            execute_values(
                cursor,
                """
                INSERT INTO kanji_meanings (kanji_id, meaning, meaning_order)
                VALUES %s
                """,
                meaning_values
            )
        
        conn.commit()
        print(f"Inserted {len(kanji_list)} kanji with {len(meaning_values)} meanings")
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Setup kanji database from kanjidic2.xml')
    parser.add_argument('--name', default='japanese_learning', help='Database name (default: japanese_learning)')
    parser.add_argument('--user', help='PostgreSQL user (default: $PGUSER or postgres)')
    parser.add_argument('--password', help='PostgreSQL password (default: $PGPASSWORD)')
    parser.add_argument('--host', help='PostgreSQL host (default: $PGHOST or localhost)')
    parser.add_argument('--port', help='PostgreSQL port (default: $PGPORT or 5432)')
    
    args = parser.parse_args()
    
    # Paths
    project_root = Path(__file__).parent.parent
    xml_path = project_root / 'kanjidic2.xml'
    schema_path = project_root / 'database' / 'kanji_schema.sql'
    
    if not xml_path.exists():
        print(f"Error: {xml_path} not found")
        print("Download from: https://www.edrdg.org/kanjidic/kanjd2index_legacy.html")
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
    
    # Parse XML
    kanji_list = parse_kanjidic2(xml_path)
    
    # NOTE: Schema creation is now handled by Prisma migrations
    # Create schema
    # create_database(db_params, schema_path)  # DISABLED - Use Prisma instead
    
    # Populate
    populate_database(db_params, kanji_list)
    
    print("Database setup complete!")


if __name__ == '__main__':
    main()

