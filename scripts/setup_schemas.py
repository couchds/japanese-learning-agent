#!/usr/bin/env python3
"""
Setup script to create database schemas
"""

import psycopg2
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
load_dotenv()


def run_schema_file(db_params, schema_path, schema_name):
    """Run a schema SQL file"""
    print(f"Running {schema_name} schema...")
    
    try:
        conn = psycopg2.connect(**db_params)
        conn.autocommit = True
        cursor = conn.cursor()
        
        with open(schema_path, 'r') as f:
            schema_sql = f.read()
        
        cursor.execute(schema_sql)
        cursor.close()
        conn.close()
        
        print(f"✓ {schema_name} schema created successfully")
        return True
        
    except psycopg2.Error as e:
        print(f"✗ Error creating {schema_name} schema: {e}")
        return False


def setup_all_schemas(db_params, schemas_to_run=None):
    """Setup all database schemas in the correct order"""
    project_root = Path(__file__).parent.parent
    database_dir = project_root / 'database'
    
    # Define schemas in dependency order
    all_schemas = [
        ('users', database_dir / 'users_schema.sql'),
        ('kanji', database_dir / 'kanji_schema.sql'),
        ('jmdict', database_dir / 'jmdict_schema.sql'),
        ('resources', database_dir / 'resources_schema.sql'),
    ]
    
    # Filter schemas if specific ones requested
    if schemas_to_run:
        schemas = [(name, path) for name, path in all_schemas if name in schemas_to_run]
    else:
        schemas = all_schemas
    
    # Check if all schema files exist
    missing = []
    for name, path in schemas:
        if not path.exists():
            missing.append(f"{name} ({path})")
    
    if missing:
        print("Error: The following schema files are missing:")
        for m in missing:
            print(f"  - {m}")
        sys.exit(1)
    
    # Run schemas
    print(f"\nSetting up {len(schemas)} schema(s)...\n")
    
    success_count = 0
    for name, path in schemas:
        if run_schema_file(db_params, path, name):
            success_count += 1
        print()  # Blank line between schemas
    
    print(f"Schema setup complete: {success_count}/{len(schemas)} successful")
    
    if success_count < len(schemas):
        sys.exit(1)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Setup database schemas')
    parser.add_argument('--name', default='japanese_learning', help='Database name (default: japanese_learning)')
    parser.add_argument('--user', help='PostgreSQL user (default: $PGUSER or postgres)')
    parser.add_argument('--password', help='PostgreSQL password (default: $PGPASSWORD)')
    parser.add_argument('--host', help='PostgreSQL host (default: $PGHOST or localhost)')
    parser.add_argument('--port', help='PostgreSQL port (default: $PGPORT or 5432)')
    parser.add_argument(
        '--schemas',
        nargs='+',
        choices=['users', 'kanji', 'jmdict', 'resources'],
        help='Specific schemas to run (default: all)'
    )
    
    args = parser.parse_args()
    
    # Database connection params
    db_params = {
        'dbname': args.name,
        'user': args.user or os.getenv('PGUSER', 'postgres'),
        'password': args.password or os.getenv('PGPASSWORD', ''),
        'host': args.host or os.getenv('PGHOST', 'localhost'),
        'port': args.port or os.getenv('PGPORT', '5432')
    }
    
    # Test connection
    try:
        conn = psycopg2.connect(**db_params)
        conn.close()
    except psycopg2.Error as e:
        print(f"Error: Cannot connect to database '{args.name}'")
        print(f"Details: {e}")
        print("\nMake sure the database exists. You can create it with:")
        print(f"  python scripts/create_db.py --name {args.name}")
        sys.exit(1)
    
    # Setup schemas
    setup_all_schemas(db_params, args.schemas)


if __name__ == '__main__':
    main()

