// End-to-end API check that needs no seed data. Works against local or deployed Orbit:
//   npm run smoke                                   (http://localhost:3001)
//   API_URL=https://your-app.vercel.app npm run smoke
const ROOT = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '').replace(/\/api$/, '');
const API = `${ROOT}/api`;
const stamp = Date.now();
let pass = 0;
let fail = 0;

const check = (name, cond, detail = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${cond ? '' : `  ->  ${detail}`}`);
};
async function call(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
}
const today = new Date().toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

console.log(`Smoke testing ${API}\n`);

let r = await call('GET', '/health');
check('health: API reaches the database', r.status === 200 && r.json?.db === true, JSON.stringify(r));
if (r.status !== 200) { console.log('\nCannot continue without a database connection.'); process.exit(1); }

// accounts
const owner = await call('POST', '/auth/register', { name: 'Smoke Owner', email: `owner+${stamp}@smoke.test`, password: 'smoke-pass-123' });
check('register owner', owner.status === 201 && owner.json.token, JSON.stringify(owner));
const viewer = await call('POST', '/auth/register', { name: 'Smoke Viewer', email: `viewer+${stamp}@smoke.test`, password: 'smoke-pass-123' });
const O = owner.json.token;
const V = viewer.json.token;
r = await call('POST', '/auth/login', { email: `owner+${stamp}@smoke.test`, password: 'wrong-password' });
check('login rejects a wrong password', r.status === 401);
r = await call('GET', '/auth/me', null, O);
check('token authenticates /auth/me', r.status === 200 && r.json.user.name === 'Smoke Owner');
r = await call('GET', '/projects');
check('API rejects requests without a token', r.status === 401);

// project + members
r = await call('POST', '/projects', { name: 'Smoke Test Project', start_date: today, due_date: plusDays(30) }, O);
check('create project', r.status === 201, JSON.stringify(r));
const pid = r.json.project.id;
r = await call('GET', `/projects/${pid}`, null, V);
check('non-members cannot see the project', r.status === 404);
r = await call('POST', `/projects/${pid}/members`, { email: `viewer+${stamp}@smoke.test`, role: 'viewer' }, O);
check('add a view-only member', r.status === 201, JSON.stringify(r));

// tasks
const t1 = await call('POST', `/projects/${pid}/tasks`, { title: 'Write spec', priority: 'high', due_date: plusDays(-2), start_date: plusDays(-5) }, O);
check('create task (gets a project reference)', t1.status === 201 && /-1$/.test(t1.json.task.ref), JSON.stringify(t1));
const t2 = await call('POST', `/projects/${pid}/tasks`, { title: 'Build it', status: 'in_progress', due_date: plusDays(7) }, O);
const tid = t1.json.task.id;
r = await call('POST', `/projects/${pid}/tasks`, { title: 'x', start_date: '2030-02-01', due_date: '2030-01-01' }, O);
check('rejects a start date after the due date', r.status === 400);
r = await call('PATCH', `/tasks/${tid}`, { status: 'done' }, O);
check('completing a task stamps completed_at', r.status === 200 && r.json.task.completed_at);
r = await call('PATCH', `/tasks/${tid}`, { status: 'todo' }, O);
check('reopening clears completed_at', r.json.task.completed_at === null);
r = await call('POST', `/projects/${pid}/tasks`, { title: 'viewer write' }, V);
check('view-only members cannot create tasks', r.status === 403);
r = await call('GET', `/projects/${pid}/tasks`, null, V);
check('view-only members can read tasks', r.status === 200 && r.json.tasks.length === 2);

// checklist + comments
r = await call('POST', `/tasks/${tid}/checklist`, { title: 'Draft' }, O);
check('add checklist item', r.status === 201);
r = await call('PATCH', `/checklist/${r.json.item.id}`, { done: true }, O);
check('tick checklist item', r.json.item.done === true);
r = await call('POST', `/tasks/${tid}/comments`, { body: 'Ready for review' }, O);
check('add comment', r.status === 201);
r = await call('GET', `/tasks/${tid}`, null, O);
check('task detail bundles checklist, comments and members', r.json.checklist.length === 1 && r.json.comments.length === 1 && r.json.members.length === 2);

// dashboard + project overview + search
r = await call('GET', `/dashboard?today=${today}`, null, O);
check('dashboard aggregates', r.status === 200 && r.json.totals.total === 2 && r.json.totals.overdue === 1 && r.json.projects.length === 1, JSON.stringify(r.json.totals));
r = await call('GET', `/projects/${pid}/overview?today=${today}`, null, O);
check('project overview', r.status === 200 && r.json.throughput.length === 14);
r = await call('GET', `/search?q=${encodeURIComponent('Write sp')}`, null, O);
check('search finds tasks', r.json.tasks.some((t) => t.id === tid));
r = await call('GET', `/search?q=${encodeURIComponent('Write sp')}`, null, V);
check('search is limited to your projects (viewer sees it, outsiders would not)', r.json.tasks.length === 1);

// cleanup
r = await call('DELETE', `/projects/${pid}`, null, V);
check('only the owner can delete a project', r.status === 403);
r = await call('DELETE', `/projects/${pid}`, null, O);
check('owner deletes the project', r.status === 200);
void t2;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
