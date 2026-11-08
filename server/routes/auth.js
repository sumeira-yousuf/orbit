import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db.js';
import { signToken, requireAuth } from '../auth.js';
import { HttpError } from '../http.js';

const router = Router();

const COLORS = ['#0B8F7E', '#3D86C6', '#8A63D2', '#E57A2B', '#C2478F', '#2F9E5F', '#D1403F', '#B8860B'];
const pickColor = (s) => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

export const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, title: u.title, color: u.color, created_at: u.created_at,
});

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #0B8F7E');
const email = z.string().trim().toLowerCase().max(200).pipe(z.email('Enter a valid email address'));

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
  email,
  password: z.string().min(8, 'Use at least 8 characters').max(100),
});
const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password').max(100) });
const profileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().max(80).nullable().optional(),
  color: hex.optional(),
});
const passwordSchema = z.object({ current: z.string().min(1), next: z.string().min(8, 'Use at least 8 characters').max(100) });

// Light brute-force protection (per server instance).
const attempts = new Map();
function throttle(key) {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (recent.length >= 10) throw new HttpError(429, 'Too many sign-in attempts. Try again in a few minutes.');
  recent.push(now);
  attempts.set(key, recent);
}

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post('/register', async (req, res) => {
  const b = registerSchema.parse(req.body);
  const hash = await bcrypt.hash(b.password, 10);
  let user;
  try {
    ({ rows: [user] } = await query(
      'INSERT INTO users (name, email, password_hash, color) VALUES ($1, $2, $3, $4) RETURNING *',
      [b.name, b.email, hash, pickColor(b.email)]
    ));
  } catch (err) {
    if (err.code === '23505') throw new HttpError(409, 'An account with that email already exists. Sign in instead.');
    throw err;
  }
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const b = loginSchema.parse(req.body);
  const key = `${req.ip}:${b.email}`;
  throttle(key);
  const { rows: [user] } = await query('SELECT * FROM users WHERE email = $1', [b.email]);
  const ok = await bcrypt.compare(b.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'That email and password do not match');
  attempts.delete(key);
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows: [user] } = await query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!user) throw new HttpError(401, 'Your account no longer exists');
  res.json({ user: publicUser(user) });
});

router.patch('/me', requireAuth, async (req, res) => {
  const b = profileSchema.parse(req.body);
  const { rows: [user] } = await query(
    `UPDATE users SET name = COALESCE($2, name), title = CASE WHEN $3::boolean THEN $4 ELSE title END,
            color = COALESCE($5, color)
     WHERE id = $1 RETURNING *`,
    [req.userId, b.name ?? null, b.title !== undefined, b.title ?? null, b.color ?? null]
  );
  res.json({ user: publicUser(user) });
});

router.post('/me/password', requireAuth, async (req, res) => {
  const b = passwordSchema.parse(req.body);
  const { rows: [user] } = await query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!(await bcrypt.compare(b.current, user.password_hash))) throw new HttpError(400, 'Your current password is incorrect');
  await query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.userId, await bcrypt.hash(b.next, 10)]);
  res.json({ ok: true });
});

export default router;
