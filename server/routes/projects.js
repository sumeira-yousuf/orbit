import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { projectAccess } from '../access.js';
import { HttpError, buildUpdate, checkDates } from '../http.js';
import { getToday, listProjects, portfolioStats } from '../stats.js';
import { logActivity } from '../activity.js';
import { TASK_SELECT } from './tasks.js';

const router = Router();
router.use(requireAuth);

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD').nullable().optional();
const STATUS = ['planning', 'active', 'on_hold', 'completed', 'archived'];

const projectCreate = z.object({
  name: z.string().trim().min(1, 'Give the project a name').max(100),
  key: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,5}$/, 'Use 2 to 6 letters or digits, starting with a letter').optional(),
  description: z.string().max(2000).default(''),
  color: hex.default('#0B8F7E'),
  status: z.enum(STATUS).default('active'),
  start_date: date,
  due_date: date,
});
const projectUpdate = projectCreate.partial();

const makeKey = (name) => {
  const letters = name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
  const words = letters.split(/\s+/).filter(Boolean);
  let key = words.length > 1 ? words.slice(0, 3).map((w) => w[0]).join('') : (words[0] || 'PRJ').slice(0, 3);
  if (!/^[A-Z]/.test(key)) key = `P${key}`;
  return key.padEnd(2, 'X').slice(0, 6);
};

router.get('/', async (req, res) => {
  res.json({ projects: await listProjects(req.userId, getToday(req)) });
});

router.post('/', async (req, res) => {
  const b = projectCreate.parse(req.body);
  checkDates(b.start_date, b.due_date);
  const project = await tx(async (c) => {
    const { rows: [p] } = await c.query(
      `INSERT INTO projects (key, name, description, color, status, start_date, due_date, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [b.key || makeKey(b.name), b.name, b.description, b.color, b.status, b.start_date ?? null, b.due_date ?? null, req.userId]
    );
    await c.query('INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)', [p.id, req.userId, 'owner']);
    await logActivity({ projectId: p.id, userId: req.userId, action: 'project_created', meta: { name: p.name } }, c);
    return p;
  });
  res.status(201).json({ project });
});

router.get('/:id', projectAccess('viewer'), async (req, res) => {
  const [project] = await listProjects(req.userId, getToday(req), req.projectId);
  const { rows: members } = await query(
    `SELECT u.id, u.name, u.email, u.title, u.color, m.role
     FROM project_members m JOIN users u ON u.id = m.user_id
     WHERE m.project_id = $1 ORDER BY (m.role = 'owner') DESC, u.name`,
    [req.projectId]
  );
  res.json({ project, members, my_role: req.role });
});

router.get('/:id/overview', projectAccess('viewer'), async (req, res) => {
  const today = getToday(req);
  const stats = await portfolioStats([req.projectId], req.userId, today);
  const { rows: attention } = await query(
    `${TASK_SELECT}
     WHERE t.project_id = $1 AND t.status <> 'done' AND t.due_date IS NOT NULL AND t.due_date <= $2::date + 7
     ORDER BY t.due_date, t.id LIMIT 8`,
    [req.projectId, today]
  );
  res.json({ ...stats, attention });
});

router.patch('/:id', projectAccess('owner'), async (req, res) => {
  const b = projectUpdate.parse(req.body);
  const { rows: [cur] } = await query('SELECT start_date, due_date FROM projects WHERE id = $1', [req.projectId]);
  checkDates(b.start_date !== undefined ? b.start_date : cur.start_date, b.due_date !== undefined ? b.due_date : cur.due_date);
  const { sets, vals } = buildUpdate(b, ['name', 'key', 'description', 'color', 'status', 'start_date', 'due_date'], 2);
  if (!sets.length) throw new HttpError(400, 'Nothing to update');
  const { rows: [project] } = await query(
    `UPDATE projects SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [req.projectId, ...vals]
  );
  if (b.status && b.status !== 'active') {
    await logActivity({ projectId: req.projectId, userId: req.userId, action: 'project_status', meta: { to: b.status } });
  }
  res.json({ project });
});

router.delete('/:id', projectAccess('owner'), async (req, res) => {
  await query('DELETE FROM projects WHERE id = $1', [req.projectId]);
  res.json({ ok: true });
});

/* ---------- members ---------- */

const memberAdd = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  role: z.enum(['member', 'viewer']).default('member'),
});

router.post('/:id/members', projectAccess('owner'), async (req, res) => {
  const b = memberAdd.parse(req.body);
  const { rows: [user] } = await query('SELECT id, name, email, title, color FROM users WHERE email = $1', [b.email]);
  if (!user) throw new HttpError(404, 'No Orbit account uses that email. Ask them to sign up first, then add them.');
  const { rowCount } = await query(
    `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [req.projectId, user.id, b.role]
  );
  if (!rowCount) throw new HttpError(409, `${user.name} is already on this project`);
  await logActivity({ projectId: req.projectId, userId: req.userId, action: 'member_added', meta: { name: user.name, role: b.role } });
  res.status(201).json({ member: { ...user, role: b.role } });
});

router.patch('/:id/members/:userId', projectAccess('owner'), async (req, res) => {
  const { role } = z.object({ role: z.enum(['member', 'viewer']) }).parse(req.body);
  const { rowCount } = await query(
    `UPDATE project_members SET role = $3 WHERE project_id = $1 AND user_id = $2 AND role <> 'owner'`,
    [req.projectId, Number(req.params.userId), role]
  );
  if (!rowCount) throw new HttpError(404, 'Member not found, or they own the project');
  res.json({ ok: true });
});

router.delete('/:id/members/:userId', projectAccess('viewer'), async (req, res) => {
  const target = Number(req.params.userId);
  const self = target === req.userId;
  if (!self && req.role !== 'owner') throw new HttpError(403, 'Only the project owner can remove other people');
  await tx(async (c) => {
    const { rowCount } = await c.query(
      `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 AND role <> 'owner'`,
      [req.projectId, target]
    );
    if (!rowCount) throw new HttpError(400, 'The project owner cannot be removed');
    await c.query('UPDATE tasks SET assignee_id = NULL WHERE project_id = $1 AND assignee_id = $2', [req.projectId, target]);
  });
  res.json({ ok: true });
});

export default router;
