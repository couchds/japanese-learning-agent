#!/usr/bin/env python3
"""
Export pronunciation recordings from the database for model training.

This script:
1. Connects to the PostgreSQL database
2. Fetches all reference pronunciations (is_reference=true)
3. Copies audio files to the data directory
4. Creates a CSV manifest with labels
"""

import os
import sys
import shutil
import pandas as pd
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from root .env
root_dir = Path(__file__).parent.parent.parent
load_dotenv(root_dir / '.env')

def connect_db():
    """Connect to the PostgreSQL database."""
    return psycopg2.connect(
        host=os.getenv('PGHOST', 'localhost'),
        port=os.getenv('PGPORT', '5432'),
        database=os.getenv('PGDATABASE', 'japanese_learning'),
        user=os.getenv('PGUSER'),
        password=os.getenv('PGPASSWORD')
    )

def export_data(output_dir='data/training', reference_only=True):
    """
    Export pronunciation recordings for training.
    
    Args:
        output_dir: Directory to save exported data
        reference_only: If True, only export is_reference=true recordings
    """
    # Setup directories
    data_dir = Path(__file__).parent.parent / output_dir
    audio_dir = data_dir / 'audio'
    audio_dir.mkdir(parents=True, exist_ok=True)
    
    # Connect to database
    print("Connecting to database...")
    conn = connect_db()
    cursor = conn.cursor()
    
    # Query to get recordings with word information
    query = """
    SELECT 
        pr.id,
        pr.audio_path,
        pr.is_reference,
        pr.duration_ms,
        pr.created_at,
        u.username,
        de.entry_id,
        ARRAY_AGG(DISTINCT ek.kanji) FILTER (WHERE ek.kanji IS NOT NULL) as kanji_forms,
        ARRAY_AGG(DISTINCT er.reading) FILTER (WHERE er.reading IS NOT NULL) as readings
    FROM pronunciation_recordings pr
    JOIN users u ON pr.user_id = u.id
    JOIN dictionary_entries de ON pr.entry_id = de.id
    LEFT JOIN entry_kanji ek ON de.id = ek.entry_id
    LEFT JOIN entry_readings er ON de.id = er.entry_id
    """
    
    if reference_only:
        query += " WHERE pr.is_reference = true"
    
    query += """
    GROUP BY pr.id, pr.audio_path, pr.is_reference, pr.duration_ms, pr.created_at, u.username, de.entry_id
    ORDER BY pr.created_at
    """
    
    print(f"Fetching {'reference' if reference_only else 'all'} recordings...")
    cursor.execute(query)
    rows = cursor.fetchall()
    
    if not rows:
        print("No recordings found!")
        cursor.close()
        conn.close()
        return
    
    print(f"Found {len(rows)} recordings")
    
    # Process recordings
    manifest = []
    backend_root = root_dir / 'backend'
    
    for idx, row in enumerate(rows, 1):
        recording_id, audio_path, is_reference, duration_ms, created_at, username, entry_id, kanji_forms, readings = row
        
        # Source audio file
        source_file = backend_root / audio_path.lstrip('/')
        
        if not source_file.exists():
            print(f"Warning: Audio file not found: {source_file}")
            continue
        
        # Destination filename
        kanji = kanji_forms[0] if kanji_forms else readings[0]
        reading = readings[0] if readings else ''
        ext = source_file.suffix
        dest_filename = f"{recording_id:05d}_{kanji}_{reading}{ext}"
        dest_file = audio_dir / dest_filename
        
        # Copy file
        shutil.copy2(source_file, dest_file)
        
        # Add to manifest
        manifest.append({
            'recording_id': recording_id,
            'filename': dest_filename,
            'kanji': kanji,
            'reading': reading,
            'label': reading,  # Primary label for training
            'duration_ms': duration_ms,
            'username': username,
            'is_reference': is_reference,
            'created_at': created_at
        })
        
        print(f"[{idx}/{len(rows)}] Exported: {kanji} ({reading})")
    
    # Save manifest
    df = pd.DataFrame(manifest)
    manifest_file = data_dir / 'manifest.csv'
    df.to_csv(manifest_file, index=False)
    
    print(f"\n✓ Exported {len(manifest)} recordings")
    print(f"✓ Audio files: {audio_dir}")
    print(f"✓ Manifest: {manifest_file}")
    
    # Print statistics
    print("\nDataset Statistics:")
    print(f"  Unique words: {df['reading'].nunique()}")
    print(f"  Total duration: {df['duration_ms'].sum() / 1000 / 60:.1f} minutes")
    print(f"  Users: {df['username'].nunique()}")
    
    print("\nTop 10 words by recording count:")
    print(df['reading'].value_counts().head(10))
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Export pronunciation training data')
    parser.add_argument('--all', action='store_true', help='Export all recordings (not just reference)')
    parser.add_argument('--output', default='data/training', help='Output directory')
    
    args = parser.parse_args()
    
    export_data(output_dir=args.output, reference_only=not args.all)

