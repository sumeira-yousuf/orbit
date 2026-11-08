import 'dotenv/config';
import { migrate, closePool } from './db.js';

try {
  await migrate();
  console.log('Database schema is up to date.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
