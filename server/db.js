import pg from 'pg';
import schemaSql from './schema.js';

// Return plain values instead of JS Date / strings for these types.
pg.types.setTypeParser(1082, (v) => v); // DATE    -> 'YYYY-MM-DD' (no timezone shifting)
pg.types.setTypeParser(1700, (v) => parseFloat(v)); // NUMERIC -> number
pg.types.setTypeParser(20, (v) => parseInt(v, 10)); // BIGINT  -> number

let pool;

function poolConfig() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!raw) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env and point it at a PostgreSQL database.'
    );
  }

  // Decide SSL ourselves so hosted providers (Neon, Supabase, Vercel Postgres) and local Postgres both work.
  const url = new URL(raw);
  const sslmode = url.searchParams.get('sslmode');
  url.searchParams.delete('sslmode');
  const isLocal = ['localhost', '127.0.0.1', '[::1]', '::1', 'db', 'postgres'].includes(url.hostname);

  let ssl;
  if (process.env.PGSSL === 'true') ssl = { rejectUnauthorized: false };
  else if (process.env.PGSSL === 'false' || sslmode === 'disable') ssl = false;
  else ssl = isLocal ? false : { rejectUnauthorized: false };

  return {
    connectionString: url.toString(),
    ssl,
    // Serverless functions: keep the pool tiny so we don't exhaust the database's connection limit.
    max: process.env.VERCEL ? 2 : 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  };
}

export function getPool() {
  if (!pool) {
    pool = new pg.Pool(poolConfig());
    pool.on('error', (err) => console.error('Postgres pool error:', err.message));
  }
  return pool;
}

export const query = (text, params) => getPool().query(text, params);

export async function tx(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function migrate() {
  const client = await getPool().connect();
  try {
    // A transaction-scoped advisory lock stops two cold-starting instances from racing on CREATE TABLE.
    // (Unlike a session lock, it is safe behind PgBouncer / Neon / Supabase connection pooling.)
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7240001)');
    await client.query(schemaSql);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

let ready;
/** Runs the schema once per server instance. Set AUTO_MIGRATE=false to skip (then use `npm run db:migrate`). */
export function ensureSchema() {
  if (process.env.AUTO_MIGRATE === 'false') return Promise.resolve();
  ready ??= migrate().catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}

export async function closePool() {
  if (pool) await pool.end();
  pool = undefined;
}
