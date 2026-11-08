/* ───────────── Domain constants ───────────── */
export const STATUSES = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'in_review', label: 'In review' },
  { id: 'done', label: 'Done' },
];
export const STATUS = Object.fromEntries(STATUSES.map((s) => [s.id, s]));
// Order used for progress bars: finished work first.
export const STATUS_STACK = ['done', 'in_review', 'in_progress', 'todo', 'backlog'];

export const PRIORITIES = [
  { id: 'urgent', label: 'Urgent', rank: 0 },
  { id: 'high', label: 'High', rank: 1 },
  { id: 'medium', label: 'Medium', rank: 2 },
  { id: 'low', label: 'Low', rank: 3 },
];
export const PRIORITY = Object.fromEntries(PRIORITIES.map((p) => [p.id, p]));

export const PROJECT_STATUSES = [
  { id: 'planning', label: 'Planning' },
  { id: 'active', label: 'Active' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived', label: 'Archived' },
];
export const PROJECT_STATUS = Object.fromEntries(PROJECT_STATUSES.map((s) => [s.id, s]));

export const HEALTH = {
  on_track: { label: 'On track' },
  at_risk: { label: 'At risk' },
  off_track: { label: 'Off track' },
  complete: { label: 'Complete' },
  paused: { label: 'On hold' },
  new: { label: 'Not started' },
};

export const PROJECT_COLORS = ['#0b8f7e', '#3d86c6', '#8a63d2', '#c2478f', '#e57a2b', '#2f9e5f', '#d1403f', '#b8860b', '#4a5d6b'];

/* ───────────── Dates (all 'YYYY-MM-DD' strings, local calendar) ───────────── */
const pad = (n) => String(n).padStart(2, '0');
export const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => toStr(new Date());
export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const utc = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
/** Whole days from b to a (a - b). */
export const diffDays = (a, b) => Math.round((utc(a) - utc(b)) / 86400000);
export const addDays = (s, n) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
};
export const fmtDate = (s, { year = false, weekday = false } = {}) =>
  s
    ? parseDate(s).toLocaleDateString(undefined, {
        day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), ...(weekday ? { weekday: 'short' } : {}),
      })
    : '';

/** Short, human due-date label with a tone for colouring. */
export function dueInfo(task, today = todayStr()) {
  if (!task.due_date) return null;
  if (task.status === 'done') return { text: fmtDate(task.due_date), tone: 'muted' };
  const d = diffDays(task.due_date, today);
  if (d < 0) return { text: d === -1 ? '1 day late' : `${-d} days late`, tone: 'danger', overdue: true };
  if (d === 0) return { text: 'Due today', tone: 'warn' };
  if (d === 1) return { text: 'Due tomorrow', tone: 'warn' };
  return { text: fmtDate(task.due_date), tone: 'muted' };
}

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/* ───────────── Misc ───────────── */
export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

/** Svelte action: focus (and optionally select) an element as soon as it mounts. */
export function focusOnMount(node, select = false) {
  queueMicrotask(() => {
    node.focus();
    if (select && node.select) node.select();
  });
}

/** Turns an activity row into pieces the UI can lay out. */
export function describeActivity(a) {
  const m = a.meta || {};
  const ref = m.ref ? `${a.project_key}-${String(m.ref).replace('#', '')}` : null;
  switch (a.action) {
    case 'task_created': return { verb: 'created', target: ref, title: m.title };
    case 'status_changed':
      return m.to === 'done'
        ? { verb: 'completed', target: ref, title: m.title }
        : { verb: 'moved', target: ref, title: m.title, tail: `to ${STATUS[m.to]?.label ?? m.to}` };
    case 'assigned':
      return m.assignee
        ? { verb: 'assigned', target: ref, title: m.title, tail: `to ${m.assignee}` }
        : { verb: 'unassigned', target: ref, title: m.title };
    case 'priority_changed': return { verb: 'set', target: ref, title: m.title, tail: `to ${PRIORITY[m.to]?.label ?? m.to} priority` };
    case 'commented': return { verb: 'commented on', target: ref, title: m.title };
    case 'task_deleted': return { verb: 'deleted', target: ref, title: m.title };
    case 'project_created': return { verb: 'created the project', target: null, title: m.name };
    case 'project_status': return { verb: 'marked the project', target: null, title: '', tail: PROJECT_STATUS[m.to]?.label?.toLowerCase() ?? m.to };
    case 'member_added': return { verb: 'added', target: null, title: m.name, tail: 'to the project' };
    default: return { verb: a.action.replace(/_/g, ' '), target: ref, title: m.title };
  }
}
