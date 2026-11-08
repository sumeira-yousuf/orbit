import { query } from './db.js';
import { HttpError } from './http.js';

const RANK = { viewer: 1, member: 2, owner: 3 };

function check(role, min, notFoundMsg) {
  // Non-members get a 404 so project ids can't be probed.
  if (!role) throw new HttpError(404, notFoundMsg);
  if (RANK[role] < RANK[min]) {
    throw new HttpError(403, min === 'owner' ? 'Only the project owner can do that' : 'You have view-only access to this project');
  }
}

/** Route middleware for /projects/:id/... Sets req.projectId and req.role. */
export function projectAccess(min = 'viewer') {
  return async (req, _res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Project not found');
    const { rows } = await query('SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2', [id, req.userId]);
    check(rows[0]?.role, min, 'Project not found');
    req.projectId = id;
    req.role = rows[0].role;
    next();
  };
}

/** Route middleware for /tasks/:id. Sets req.task (raw row), req.projectId and req.role. */
export function taskAccess(min = 'viewer') {
  return async (req, _res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Task not found');
    const { rows } = await query(
      `SELECT t.*, m.role AS my_role FROM tasks t
       JOIN project_members m ON m.project_id = t.project_id AND m.user_id = $2
       WHERE t.id = $1`,
      [id, req.userId]
    );
    check(rows[0]?.my_role, min, 'Task not found');
    req.task = rows[0];
    req.projectId = rows[0].project_id;
    req.role = rows[0].my_role;
    next();
  };
}

/** For /checklist/:id and /comments/:id: loads the child row plus the caller's role in its project. */
export function childAccess(table, min = 'member') {
  if (!['checklist_items', 'comments'].includes(table)) throw new Error('bad table');
  return async (req, _res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(404, 'Not found');
    const { rows } = await query(
      `SELECT c.*, t.project_id, m.role AS my_role FROM ${table} c
       JOIN tasks t ON t.id = c.task_id
       JOIN project_members m ON m.project_id = t.project_id AND m.user_id = $2
       WHERE c.id = $1`,
      [id, req.userId]
    );
    check(rows[0]?.my_role, min, 'Not found');
    req.child = rows[0];
    req.projectId = rows[0].project_id;
    req.role = rows[0].my_role;
    next();
  };
}

export async function assertMember(projectId, userId) {
  const { rowCount } = await query('SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, userId]);
  if (!rowCount) throw new HttpError(400, 'The assignee must be a member of this project');
}
