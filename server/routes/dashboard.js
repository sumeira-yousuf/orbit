import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { getToday, listProjects, portfolioStats } from '../stats.js';
import { TASK_SELECT } from './tasks.js';

const router = Router();
router.use(requireAuth);

router.get('/dashboard', async (req, res) => {
  const today = getToday(req);
  const all = await listProjects(req.userId, today);
  const projects = all.filter((p) => p.status !== 'archived');
  const ids = projects.map((p) => p.id);

  const [stats, upcoming] = await Promise.all([
    portfolioStats(ids, req.userId, today),
    ids.length
      ? query(
          `${TASK_SELECT}
           WHERE t.assignee_id = $1 AND t.status <> 'done' AND t.project_id = ANY($2)
           ORDER BY t.due_date NULLS LAST,
                    CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.id
           LIMIT 8`,
          [req.userId, ids]
        ).then((r) => r.rows)
      : [],
  ]);

  res.json({ ...stats, projects, upcoming, today });
});

export default router;
