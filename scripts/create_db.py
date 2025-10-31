#!/usr/bin/env python3
"""
Create the PostgreSQL database
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
load_dotenv()


def create_database(db_name='japanese_learning', drop_existing=False, db_user=None, db_password=None, db_host=None, db_port=None):
    """Create PostgreSQL database"""
    # Get connection params from args or environment
    user = db_user or os.getenv('PGUSER', 'postgres')
    password = db_password or os.getenv('PGPASSWORD', '')
    host = db_host or os.getenv('PGHOST', 'localhost')
    port = db_port or os.getenv('PGPORT', '5432')
    
    # Connect to default postgres database
    try:
        conn = psycopg2.connect(
            dbname='postgres',
            user=user,
            password=password,
            host=host,
            port=port
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (db_name,)
        )
        exists = cursor.fetchone()
        
        if exists:
            if drop_existing:
                print(f"Dropping existing database '{db_name}'...")
                
                # Terminate all connections to the database
                print(f"Terminating active connections to '{db_name}'...")
                cursor.execute(f"""
                    SELECT pg_terminate_backend(pg_stat_activity.pid)
                    FROM pg_stat_activity
                    WHERE pg_stat_activity.datname = '{db_name}'
                    AND pid <> pg_backend_pid()
                """)
                
                cursor.execute(f'DROP DATABASE {db_name}')
                print(f"Creating database '{db_name}'...")
                cursor.execute(f'CREATE DATABASE {db_name}')
                print(f"Database '{db_name}' created successfully")
            else:
                print(f"Database '{db_name}' already exists")
        else:
            print(f"Creating database '{db_name}'...")
            cursor.execute(f'CREATE DATABASE {db_name}')
            print(f"Database '{db_name}' created successfully")
        
        cursor.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"Error: {e}")
        sys.exit(1)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Create PostgreSQL database')
    parser.add_argument(
        '--drop',
        action='store_true',
        help='Drop existing database if it exists'
    )
    parser.add_argument(
        '--name',
        default='japanese_learning',
        help='Database name (default: japanese_learning)'
    )
    parser.add_argument('--user', help='PostgreSQL user (default: $PGUSER or postgres)')
    parser.add_argument('--password', help='PostgreSQL password (default: $PGPASSWORD)')
    parser.add_argument('--host', help='PostgreSQL host (default: $PGHOST or localhost)')
    parser.add_argument('--port', help='PostgreSQL port (default: $PGPORT or 5432)')
    
    args = parser.parse_args()
    create_database(args.name, args.drop, args.user, args.password, args.host, args.port)


if __name__ == '__main__':
    main()

