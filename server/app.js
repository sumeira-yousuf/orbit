import express from 'express';
import { ZodError } from 'zod';
import { ensureSchema, query } from './db.js';
import { HttpError } from './http.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import dashboardRoutes from './routes/dashboard.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Vercel / reverse proxies: use the real client IP for rate limiting
app.use(express.json({ limit: '200kb' }));
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Cache-Control': 'no-store',
  });
  next();
});

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, db: true });
  } catch (err) {
    res.status(503).json({ ok: false, db: false, error: err.message });
  }
});

// Make sure the tables exist before any data route runs (once per server instance).
app.use('/api', async (_req, _res, next) => {
  await ensureSchema();
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', taskRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: first?.message || 'Invalid request', field: first?.path?.join('.') });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request body is not valid JSON' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large' });
  console.error(err);
  const message = /DATABASE_URL|JWT_SECRET/.test(err?.message || '') ? err.message : 'Something went wrong on the server';
  res.status(500).json({ error: message });
});

export default app;
