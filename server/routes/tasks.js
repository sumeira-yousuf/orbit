import { Router } from 'express';
import { z } from 'zod';
import { query, tx } from '../db.js';
import { requireAuth } from '../auth.js';
import { projectAccess, taskAccess, childAccess, assertMember } from '../access.js';
import { HttpError, buildUpdate, checkDates } from '../http.js';
import { logActivity } from '../activity.js';
import { getToday } from '../stats.js';

/** Task rows as the client sees them: project info, assignee, checklist and comment counts. */
export const TASK_SELECT = `
  SELECT t.*, p.key AS project_key, p.name AS project_name, p.color AS project_color,
         p.key || '-' || t.number AS ref,
         a.name AS assignee_name, a.color AS assignee_color,
         (SELECT COUNT(*)::int FROM checklist_items c WHERE c.task_id = t.id) AS checklist_total,
         (SELECT COUNT(*)::int FROM checklist_items c WHERE c.task_id = t.id AND c.done) AS checklist_done,
         (SELECT COUNT(*)::int FROM comments c WHERE c.task_id = t.id) AS comment_count
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  LEFT JOIN users a ON a.id = t.assignee_id`;

const PRIORITY_ORDER = `CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD').nullable().optional();
const taskCreate = z.object({
  title: z.string().trim().min(1, 'Give the task a title').max(200),
  description: z.string().max(10000).optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee_id: z.number().int().nullable().optional(),
  start_date: date,
  due_date: date,
  estimate_hours: z.number().min(0).max(9999).nullable().optional(),
  labels: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  position: z.number().finite().optional(),
});
const taskUpdate = taskCreate.partial();

const taskRow = async (id) => (await query(`${TASK_SELECT} WHERE t.id = $1`, [id])).rows[0];

const router = Router();
router.use(requireAuth);

/* ---------- project tasks ---------- */

router.get('/projects/:id/tasks', projectAccess('viewer'), async (req, res) => {
  const { rows } = await query(`${TASK_SELECT} WHERE t.project_id = $1 ORDER BY t.position, t.id`, [req.projectId]);
  res.json({ tasks: rows });
});

router.post('/projects/:id/tasks', projectAccess('member'), async (req, res) => {
  const b = taskCreate.parse(req.body);
  checkDates(b.start_date, b.due_date);
  if (b.assignee_id) await assertMember(req.projectId, b.assignee_id);
  const status = b.status ?? 'todo';

  const id = await tx(async (c) => {
    const { rows: [{ task_counter: number }] } = await c.query(
      'UPDATE projects SET task_counter = task_counter + 1, updated_at = now() WHERE id = $1 RETURNING task_counter',
      [req.projectId]
    );
    const { rows: [{ pos }] } = await c.query(
      'SELECT COALESCE(MAX(position), 0) + 1000 AS pos FROM tasks WHERE project_id = $1 AND status = $2',
      [req.projectId, status]
    );
    const { rows: [t] } = await c.query(
      `INSERT INTO tasks (project_id, number, title, description, status, priority, assignee_id, reporter_id,
                          start_date, due_date, estimate_hours, labels, position, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
      [req.projectId, number, b.title, b.description ?? '', status, b.priority ?? 'medium', b.assignee_id ?? null,
        req.userId, b.start_date ?? null, b.due_date ?? null, b.estimate_hours ?? null, b.labels ?? [],
        b.position ?? pos, status === 'done' ? new Date() : null]
    );
    await logActivity({ projectId: req.projectId, taskId: t.id, userId: req.userId, action: 'task_created', meta: { ref: `#${number}`, title: b.title } }, c);
    return t.id;
  });
  res.status(201).json({ task: await taskRow(id) });
});

/* ---------- single task ---------- */

router.get('/tasks/:id', taskAccess('viewer'), async (req, res) => {
  const id = req.task.id;
  const [task, checklist, comments, activity, members] = await Promise.all([
    taskRow(id),
    query('SELECT id, title, done FROM checklist_items WHERE task_id = $1 ORDER BY position, id', [id]),
    query(
      `SELECT c.id, c.body, c.created_at, c.user_id, u.name AS user_name, u.color AS user_color
       FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.task_id = $1 ORDER BY c.created_at, c.id`,
      [id]
    ),
    query(
      `SELECT a.id, a.action, a.meta, a.created_at, u.name AS user_name, u.color AS user_color
       FROM activity a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.task_id = $1 AND a.action <> 'commented' ORDER BY a.created_at DESC, a.id DESC LIMIT 20`,
      [id]
    ),
    query(
      `SELECT u.id, u.name, u.color, m.role FROM project_members m JOIN users u ON u.id = m.user_id
       WHERE m.project_id = $1 ORDER BY u.name`,
      [req.projectId]
    ),
  ]);
  res.json({
    task, checklist: checklist.rows, comments: comments.rows, activity: activity.rows,
    members: members.rows, my_role: req.role, my_id: req.userId,
  });
});

router.patch('/tasks/:id', taskAccess('member'), async (req, res) => {
  const b = taskUpdate.parse(req.body);
  const cur = req.task;
  checkDates(b.start_date !== undefined ? b.start_date : cur.start_date, b.due_date !== undefined ? b.due_date : cur.due_date);
  if (b.assignee_id) await assertMember(cur.project_id, b.assignee_id);

  const { sets, vals } = buildUpdate(b, ['title', 'description', 'status', 'priority', 'assignee_id', 'start_date', 'due_date', 'estimate_hours', 'labels', 'position'], 2);
  if (!sets.length) throw new HttpError(400, 'Nothing to update');
  const statusChanged = b.status !== undefined && b.status !== cur.status;
  if (statusChanged) sets.push(b.status === 'done' ? 'completed_at = now()' : 'completed_at = NULL');

  await query(`UPDATE tasks SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`, [cur.id, ...vals]);
  await query('UPDATE projects SET updated_at = now() WHERE id = $1', [cur.project_id]);

  const ref = `#${cur.number}`;
  const base = { projectId: cur.project_id, taskId: cur.id, userId: req.userId };
  if (statusChanged) await logActivity({ ...base, action: 'status_changed', meta: { ref, title: cur.title, from: cur.status, to: b.status } });
  if (b.assignee_id !== undefined && b.assignee_id !== cur.assignee_id) {
    let name = null;
    if (b.assignee_id) name = (await query('SELECT name FROM users WHERE id = $1', [b.assignee_id])).rows[0]?.name;
    await logActivity({ ...base, action: 'assigned', meta: { ref, title: cur.title, assignee: name } });
  }
  if (b.priority !== undefined && b.priority !== cur.priority) {
    await logActivity({ ...base, action: 'priority_changed', meta: { ref, title: cur.title, from: cur.priority, to: b.priority } });
  }
  res.json({ task: await taskRow(cur.id) });
});

router.delete('/tasks/:id', taskAccess('member'), async (req, res) => {
  await query('DELETE FROM tasks WHERE id = $1', [req.task.id]);
  await logActivity({
    projectId: req.projectId, userId: req.userId, action: 'task_deleted',
    meta: { ref: `#${req.task.number}`, title: req.task.title },
  });
  res.json({ ok: true });
});

/* ---------- checklist ---------- */

router.post('/tasks/:id/checklist', taskAccess('member'), async (req, res) => {
  const { title } = z.object({ title: z.string().trim().min(1, 'Enter a checklist item').max(200) }).parse(req.body);
  const { rows: [item] } = await query(
    `INSERT INTO checklist_items (task_id, title, position)
     VALUES ($1, $2, (SELECT COALESCE(MAX(position), 0) + 1 FROM checklist_items WHERE task_id = $1))
     RETURNING id, title, done`,
    [req.task.id, title]
  );
  res.status(201).json({ item });
});

router.patch('/checklist/:id', childAccess('checklist_items', 'member'), async (req, res) => {
  const b = z.object({ done: z.boolean().optional(), title: z.string().trim().min(1).max(200).optional() }).parse(req.body);
  const { sets, vals } = buildUpdate(b, ['done', 'title'], 2);
  if (!sets.length) throw new HttpError(400, 'Nothing to update');
  const { rows: [item] } = await query(`UPDATE checklist_items SET ${sets.join(', ')} WHERE id = $1 RETURNING id, title, done`, [req.child.id, ...vals]);
  res.json({ item });
});

router.delete('/checklist/:id', childAccess('checklist_items', 'member'), async (req, res) => {
  await query('DELETE FROM checklist_items WHERE id = $1', [req.child.id]);
  res.json({ ok: true });
});

/* ---------- comments ---------- */

router.post('/tasks/:id/comments', taskAccess('member'), async (req, res) => {
  const { body } = z.object({ body: z.string().trim().min(1, 'Write a comment first').max(5000) }).parse(req.body);
  const { rows: [c] } = await query(
    'INSERT INTO comments (task_id, user_id, body) VALUES ($1, $2, $3) RETURNING id, body, created_at, user_id',
    [req.task.id, req.userId, body]
  );
  const { rows: [u] } = await query('SELECT name, color FROM users WHERE id = $1', [req.userId]);
  await logActivity({
    projectId: req.projectId, taskId: req.task.id, userId: req.userId, action: 'commented',
    meta: { ref: `#${req.task.number}`, title: req.task.title },
  });
  res.status(201).json({ comment: { ...c, user_name: u.name, user_color: u.color } });
});

router.delete('/comments/:id', childAccess('comments', 'member'), async (req, res) => {
  if (req.child.user_id !== req.userId && req.role !== 'owner') throw new HttpError(403, 'You can only delete your own comments');
  await query('DELETE FROM comments WHERE id = $1', [req.child.id]);
  res.json({ ok: true });
});

/* ---------- cross-project views ---------- */

router.get('/me/tasks', async (req, res) => {
  const today = getToday(req);
  const { rows } = await query(
    `${TASK_SELECT}
     WHERE t.assignee_id = $1 AND p.status <> 'archived'
       AND (t.status <> 'done' OR t.completed_at >= $2::date - 14)
     ORDER BY (t.status = 'done'), t.due_date NULLS LAST, ${PRIORITY_ORDER}, t.id`,
    [req.userId, today]
  );
  res.json({ tasks: rows });
});

router.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 80);
  if (q.length < 1) return res.json({ tasks: [] });
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const { rows } = await query(
    `${TASK_SELECT}
     WHERE t.project_id IN (SELECT project_id FROM project_members WHERE user_id = $1)
       AND (t.title ILIKE $2 OR (p.key || '-' || t.number) ILIKE $2)
     ORDER BY t.updated_at DESC LIMIT 8`,
    [req.userId, like]
  );
  res.json({ tasks: rows });
});

export default router;
