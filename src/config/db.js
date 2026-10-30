import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  // Fail fast and loud rather than silently connecting to nothing.
  console.warn(
    '[db] DATABASE_URL is not set. Copy .env.example to .env and configure it.'
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // Unexpected errors on idle clients — log, don't crash the process.
  console.error('[db] Unexpected error on idle client', err);
});

/**
 * Run a query with automatic connection handling.
 * @param {string} text
 * @param {any[]} params
 */
export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const durationMs = Date.now() - start;
  if (process.env.NODE_ENV !== 'production' && durationMs > 200) {
    console.warn(`[db] slow query (${durationMs}ms): ${text}`);
  }
  return result;
}

/**
 * Run a set of queries inside a single transaction.
 * @param {(client: pg.PoolClient) => Promise<any>} fn
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
