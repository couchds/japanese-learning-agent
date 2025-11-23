#!/usr/bin/env python3
"""
Update JLPT levels for all kanji based on kanji-jlpt-levels.csv
"""

import csv
import os
import psycopg2

# Database connection parameters from environment
db_params = {
    'dbname': os.environ.get('PGDATABASE', 'japanese_learning'),
    'user': os.environ.get('PGUSER', 'postgres'),
    'password': os.environ.get('PGPASSWORD', 'testing'),
    'host': os.environ.get('PGHOST', 'localhost'),
    'port': os.environ.get('PGPORT', '5432')
}

def main():
    # Load the CSV file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, 'kanji-jlpt-levels.csv')
    
    print(f"Loading kanji data from {csv_path}...")
    kanji_data = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        kanji_data = list(reader)
    
    print(f"Loaded {len(kanji_data)} kanji entries")
    
    # Connect to PostgreSQL
    print(f"Connecting to database: {db_params['dbname']} at {db_params['host']}:{db_params['port']}")
    conn = psycopg2.connect(**db_params)
    cur = conn.cursor()
    
    # First, clear all existing JLPT levels
    print("Clearing existing JLPT levels...")
    cur.execute("UPDATE kanji SET jlpt_level = NULL")
    conn.commit()
    print("Cleared JLPT levels")
    
    # Update JLPT levels for each kanji
    updated_count = 0
    not_found_count = 0
    
    for row in kanji_data:
        literal = row['kanji']
        jlpt_level = int(row['jlpt_level'])
        
        # Update the kanji in the database
        cur.execute(
            "UPDATE kanji SET jlpt_level = %s WHERE literal = %s",
            (jlpt_level, literal)
        )
        
        if cur.rowcount > 0:
            updated_count += 1
            if updated_count % 100 == 0:
                print(f"Updated {updated_count} kanji...")
        else:
            not_found_count += 1
    
    # Commit changes
    conn.commit()
    
    # Show summary statistics
    print("\n=== Update Summary ===")
    print(f"Total kanji in CSV: {len(kanji_data)}")
    print(f"Successfully updated: {updated_count}")
    print(f"Not found in database: {not_found_count}")
    
    # Show counts by JLPT level
    print("\n=== JLPT Level Counts in Database ===")
    for level in [5, 4, 3, 2, 1]:
        cur.execute("SELECT COUNT(*) FROM kanji WHERE jlpt_level = %s", (level,))
        count = cur.fetchone()[0]
        print(f"N{level}: {count} kanji")
    
    # Close connection
    cur.close()
    conn.close()
    
    print("\n✅ JLPT levels updated successfully!")

if __name__ == '__main__':
    main()

