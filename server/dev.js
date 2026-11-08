// Local / self-hosted entry point. On Vercel the API is served by api/index.js instead.
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import app from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'web', 'dist');

// After `npm run build`, serve the built frontend from the same port (single-process deployment).
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.set('Cache-Control', 'no-cache').sendFile(path.join(dist, 'index.html'));
  });
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`Orbit API  ->  http://localhost:${port}/api/health`);
  if (fs.existsSync(dist)) console.log(`Orbit app  ->  http://localhost:${port}`);
});
