import jwt from 'jsonwebtoken';
import { HttpError } from './http.js';

function secret() {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('JWT_SECRET is not set. Add it to your environment variables.');
  }
  return 'orbit-dev-secret-do-not-use-in-production';
}

export const signToken = (user) => jwt.sign({ sub: user.id }, secret(), { expiresIn: '7d' });

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Sign in to continue'));
  const key = secret();
  try {
    const payload = jwt.verify(token, key);
    req.userId = Number(payload.sub);
    next();
  } catch {
    next(new HttpError(401, 'Your session has expired. Sign in again.'));
  }
}
