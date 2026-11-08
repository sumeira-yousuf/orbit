import { query } from './db.js';

/** The client sends its local date (?today=YYYY-MM-DD) so "overdue" matches the user's timezone. */
export function getToday(req) {
  const t = req.query?.today;
  return typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : new Date().toISOString().slice(0, 10);
}

const ts = (s) => Date.parse(`${s}T00:00:00Z`);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Project health, derived from schedule and overdue work.
 * complete | paused | new | on_track | at_risk | off_track
 */
export function computeHealth(p, today) {
  const total = p.total_tasks;
  const done = p.done_tasks;
  const open = total - done;
  if (p.status === 'completed' || (total > 0 && open === 0)) return { health: 'complete', reason: 'Every task is done' };
  if (p.status === 'on_hold') return { health: 'paused', reason: 'The project is on hold' };
  if (total === 0) return { health: 'new', reason: 'No tasks yet' };
  if (p.due_date && p.due_date < today) return { health: 'off_track', reason: 'Past its due date with open tasks' };

  const overdue = p.overdue_tasks;
  if (overdue >= 3 || overdue / open >= 0.25) return { health: 'off_track', reason: `${plural(overdue, 'task')} overdue` };
  if (overdue > 0) return { health: 'at_risk', reason: `${plural(overdue, 'task')} overdue` };

  if (p.start_date && p.due_date && p.due_date > p.start_date) {
    const span = ts(p.due_date) - ts(p.start_date);
    const elapsed = Math.min(1, Math.max(0, (ts(today) - ts(p.start_date)) / span));
    const progress = done / total;
    if (elapsed > 0.2 && elapsed - progress > 0.25) {
      return { health: 'at_risk', reason: `${Math.round(elapsed * 100)}% of the time is used, ${Math.round(progress * 100)}% of tasks are done` };
    }
  }
  return { health: 'on_track', reason: 'On schedule' };
}

/** Projects the user belongs to, with task counts, members and health. Pass onlyId for a single project. */
export async function listProjects(userId, today, onlyId = null) {
  const { rows } = await query(
    `SELECT p.*, pm.role AS my_role, s.total_tasks, s.done_tasks, s.overdue_tasks, s.by_status,
       (SELECT COALESCE(json_agg(json_build_object('id', u.id, 'name', u.name, 'color', u.color) ORDER BY u.name), '[]'::json)
          FROM project_members m JOIN users u ON u.id = m.user_id WHERE m.project_id = p.id) AS members
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
     CROSS JOIN LATERAL (
       SELECT COUNT(*)::int AS total_tasks,
              COUNT(*) FILTER (WHERE t.status = 'done')::int AS done_tasks,
              COUNT(*) FILTER (WHERE t.status <> 'done' AND t.due_date < $2::date)::int AS overdue_tasks,
              jsonb_build_object(
                'backlog',     COUNT(*) FILTER (WHERE t.status = 'backlog'),
                'todo',        COUNT(*) FILTER (WHERE t.status = 'todo'),
                'in_progress', COUNT(*) FILTER (WHERE t.status = 'in_progress'),
                'in_review',   COUNT(*) FILTER (WHERE t.status = 'in_review'),
                'done',        COUNT(*) FILTER (WHERE t.status = 'done')
              ) AS by_status
       FROM tasks t WHERE t.project_id = p.id
     ) s
     WHERE ($3::int IS NULL OR p.id = $3)
     ORDER BY (p.status = 'archived'), p.updated_at DESC`,
    [userId, today, onlyId]
  );
  return rows.map((r) => ({
    ...r,
    progress: r.total_tasks ? Math.round((100 * r.done_tasks) / r.total_tasks) : 0,
    ...computeHealth(r, today),
  }));
}

/** Aggregates used by the dashboard (many projects) and the project overview (one project). */
export async function portfolioStats(projectIds, userId, today) {
  const empty = {
    totals: { total: 0, done: 0, open: 0, overdue: 0, due_week: 0, mine_open: 0, mine_overdue: 0, done_week: 0, unassigned: 0 },
    by_status: {}, by_priority: {}, throughput: [], workload: [], activity: [],
  };
  if (!projectIds.length) return empty;

  const [totals, byStatus, byPriority, throughput, workload, activity] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'done')::int AS done,
              COUNT(*) FILTER (WHERE status <> 'done')::int AS open,
              COUNT(*) FILTER (WHERE status <> 'done' AND due_date < $2::date)::int AS overdue,
              COUNT(*) FILTER (WHERE status <> 'done' AND due_date BETWEEN $2::date AND $2::date + 6)::int AS due_week,
              COUNT(*) FILTER (WHERE status <> 'done' AND assignee_id = $3)::int AS mine_open,
              COUNT(*) FILTER (WHERE status <> 'done' AND assignee_id = $3 AND due_date < $2::date)::int AS mine_overdue,
              COUNT(*) FILTER (WHERE status = 'done' AND completed_at >= $2::date - 6)::int AS done_week,
              COUNT(*) FILTER (WHERE status <> 'done' AND assignee_id IS NULL)::int AS unassigned
       FROM tasks WHERE project_id = ANY($1)`,
      [projectIds, today, userId]
    ),
    query('SELECT status, COUNT(*)::int AS n FROM tasks WHERE project_id = ANY($1) GROUP BY status', [projectIds]),
    query("SELECT priority, COUNT(*)::int AS n FROM tasks WHERE project_id = ANY($1) AND status <> 'done' GROUP BY priority", [projectIds]),
    query(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day,
         (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = ANY($1) AND t.created_at::date = d::date) AS created,
         (SELECT COUNT(*)::int FROM tasks t WHERE t.project_id = ANY($1) AND t.completed_at::date = d::date) AS completed
       FROM generate_series($2::date - 13, $2::date, interval '1 day') d ORDER BY d`,
      [projectIds, today]
    ),
    query(
      `SELECT u.id, u.name, u.color,
              COUNT(t.id) FILTER (WHERE t.status <> 'done')::int AS open,
              COUNT(t.id) FILTER (WHERE t.status = 'done')::int AS done,
              COUNT(t.id) FILTER (WHERE t.status <> 'done' AND t.due_date < $2::date)::int AS overdue,
              COALESCE(SUM(t.estimate_hours) FILTER (WHERE t.status <> 'done'), 0)::float AS hours
       FROM users u
       LEFT JOIN tasks t ON t.assignee_id = u.id AND t.project_id = ANY($1)
       WHERE u.id IN (SELECT user_id FROM project_members WHERE project_id = ANY($1))
       GROUP BY u.id ORDER BY open DESC, u.name`,
      [projectIds, today]
    ),
    query(
      `SELECT a.id, a.action, a.meta, a.created_at, a.task_id, a.project_id,
              u.name AS user_name, u.color AS user_color, p.key AS project_key, p.name AS project_name
       FROM activity a
       LEFT JOIN users u ON u.id = a.user_id
       JOIN projects p ON p.id = a.project_id
       WHERE a.project_id = ANY($1)
       ORDER BY a.created_at DESC, a.id DESC LIMIT 15`,
      [projectIds]
    ),
  ]);

  return {
    totals: totals.rows[0],
    by_status: Object.fromEntries(byStatus.rows.map((r) => [r.status, r.n])),
    by_priority: Object.fromEntries(byPriority.rows.map((r) => [r.priority, r.n])),
    throughput: throughput.rows,
    workload: workload.rows,
    activity: activity.rows,
  };
}
