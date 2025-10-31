#!/usr/bin/env python3
"""
Local development setup script
Creates default user and any other local-only setup
"""

import psycopg2
import sys
import os
import getpass
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
load_dotenv()


def get_user_input():
    """Get username from user"""
    # Get system username as default
    system_username = getpass.getuser()
    
    print("\n=== Local User Setup ===\n")
    print("Please enter your username for local development:")
    
    # Get username with default
    username_input = input(f"Username [{system_username}]: ").strip()
    username = username_input if username_input else system_username
    
    return username


def setup_local_user(db_params, username):
    """Create default local user"""
    print(f"\nSetting up local user '{username}'...")
    
    try:
        conn = psycopg2.connect(**db_params)
        cursor = conn.cursor()
        
        # Insert user
        cursor.execute("""
            INSERT INTO users (username) 
            VALUES (%s)
            ON CONFLICT (username) DO UPDATE 
            SET updated_at = NOW()
            RETURNING id
        """, (username,))
        
        result = cursor.fetchone()
        if result:
            user_id = result[0]
            print(f"✓ User '{username}' ready (id: {user_id})")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return user_id
        
    except psycopg2.Error as e:
        print(f"✗ Error setting up local user: {e}")
        return None


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Setup local development environment')
    parser.add_argument('--name', default='japanese_learning', help='Database name (default: japanese_learning)')
    parser.add_argument('--user', help='PostgreSQL user (default: $PGUSER or postgres)')
    parser.add_argument('--password', help='PostgreSQL password (default: $PGPASSWORD)')
    parser.add_argument('--host', help='PostgreSQL host (default: $PGHOST or localhost)')
    parser.add_argument('--port', help='PostgreSQL port (default: $PGPORT or 5432)')
    
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
        sys.exit(1)
    
    # Get user input
    username = get_user_input()
    
    # Setup local user
    user_id = setup_local_user(db_params, username)
    
    if user_id:
        print(f"\n✓ Local setup complete!")
        print(f"\nUser details:")
        print(f"  Username: {username}")
        print(f"  User ID: {user_id}")
        print("\nThis user will be used for all resources in local development.")
    else:
        print("\n✗ Local setup failed")
        sys.exit(1)


if __name__ == '__main__':
    main()

