import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Fallback to individual variables for local development
  user: process.env.DATABASE_URL ? undefined : (process.env.PGUSER || 'postgres'),
  password: process.env.DATABASE_URL ? undefined : (process.env.PGPASSWORD || ''),
  host: process.env.DATABASE_URL ? undefined : (process.env.PGHOST || 'localhost'),
  port: process.env.DATABASE_URL ? undefined : parseInt(process.env.PGPORT || '5432'),
  database: process.env.DATABASE_URL ? undefined : (process.env.PGDATABASE || 'japanese_learning'),
});

export default pool;

