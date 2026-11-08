// Vercel serverless entry point. vercel.json rewrites /api/* to this function,
// and Express sees the original URL, so the routes in server/ work unchanged.
import app from '../server/app.js';

export default app;
