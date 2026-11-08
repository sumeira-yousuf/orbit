import { query } from './db.js';

/** Appends an entry to a project's activity feed. Never throws: logging must not break the request. */
export async function logActivity({ projectId, taskId = null, userId, action, meta = {} }, client) {
  try {
    await (client || { query }).query(
      'INSERT INTO activity (project_id, task_id, user_id, action, meta) VALUES ($1, $2, $3, $4, $5)',
      [projectId, taskId, userId, action, meta]
    );
  } catch (err) {
    console.error('activity log failed:', err.message);
  }
}
