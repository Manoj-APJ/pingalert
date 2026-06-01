import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

// Set up connection pool
export const pool = new Pool({
  connectionString: config.databaseUrl,
});

export const query = (text, params) => pool.query(text, params);

// Connection retry utility for slow Docker startup
export const connectWithRetry = async (retries = 5, delay = 3000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log('Successfully connected to PostgreSQL');
      client.release();
      return;
    } catch (err) {
      console.error(`PostgreSQL connection attempt ${i + 1} failed: ${err.message}. Retrying in ${delay / 1000}s...`);
      if (i === retries - 1) throw err;
      await new Promise(res => setTimeout(res, delay));
    }
  }
};

// Migration runner
export const runMigrations = async () => {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await query(sql);
    console.log('PostgreSQL schema migrations applied successfully');
  } catch (err) {
    console.error('Error running database migrations:', err);
    throw err;
  }
};
