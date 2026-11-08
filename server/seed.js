// Demo data: 6 people, 5 projects, ~60 tasks. Dates are relative to today so charts and "overdue" look real.
//   npm run db:seed      -> seeds only if the database is empty
//   npm run db:reseed    -> wipes everything first
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { migrate, tx, query, closePool } from './db.js';

const force = process.argv.includes('--force');
const DAY = 86400000;
const now = new Date();
const base = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
const dstr = (off) => new Date(base + off * DAY).toISOString().slice(0, 10);
const ago = (days, hour = 10) => new Date(base - days * DAY + hour * 3600000);

let seedN = 7;
const rnd = (n) => { seedN = (seedN * 9301 + 49297) % 233280; return Math.floor((seedN / 233280) * n); };

const PEOPLE = {
  priya: ['Priya Nair', 'demo@orbit.app', 'Product manager', '#0B8F7E'],
  aarav: ['Aarav Mehta', 'aarav@orbit.app', 'Engineering lead', '#3D86C6'],
  sana: ['Sana Qureshi', 'sana@orbit.app', 'Product designer', '#C2478F'],
  rohan: ['Rohan Iyer', 'rohan@orbit.app', 'Frontend developer', '#E57A2B'],
  leila: ['Leila Haddad', 'leila@orbit.app', 'Marketing lead', '#8A63D2'],
  tom: ['Tom Becker', 'tom@orbit.app', 'Backend developer', '#2F9E5F'],
};

// T(title, status, priority, assignee, startOffset, dueOffset, extras)
const T = (title, status, priority, assignee, start, due, x = {}) => ({ title, status, priority, assignee, start, due, ...x });

const PROJECTS = [
  {
    key: 'WEB', name: 'Website Relaunch', color: '#0B8F7E', status: 'active', start: -30, due: 21, owner: 'priya',
    description: 'Rebuild the marketing site on a new CMS with a faster, accessible design and clean redirects from the old URLs.',
    members: { aarav: 'member', sana: 'member', rohan: 'member', tom: 'member', leila: 'member' },
    tasks: [
      T('Audit existing site content', 'done', 'medium', 'priya', -30, -24, { done: 12, est: 8 }),
      T('Define information architecture', 'done', 'high', 'sana', -26, -19, { done: 9, est: 10 }),
      T('Choose CMS and hosting', 'done', 'high', 'aarav', -26, -20, { done: 10, est: 6 }),
      T('Brand colors and type scale', 'done', 'medium', 'sana', -22, -15, { done: 7, est: 8 }),
      T('Set up CI pipeline and staging', 'done', 'medium', 'tom', -20, -14, { done: 6, est: 6 }),
      T('Homepage wireframes', 'done', 'high', 'sana', -18, -10, { done: 4, est: 12 }),
      T('Write homepage copy', 'done', 'medium', 'leila', -16, -9, { done: 3, est: 5 }),
      T('Build responsive homepage', 'in_review', 'high', 'rohan', -10, -1, {
        est: 20, labels: ['frontend'],
        desc: 'Implement the approved homepage design with the new component library. Must hit 90+ Lighthouse performance on mobile.',
        check: [['Hero and navigation', true], ['Feature grid', true], ['Footer and newsletter form', true], ['Mobile breakpoints', false], ['Lighthouse pass', false]],
        cm: [['sana', 'Spacing in the feature grid is slightly off compared to the Figma file at tablet width.', 2], ['rohan', 'Fixed. Pushed to staging, can you take another look?', 1]],
      }),
      T('Pricing page design', 'in_review', 'medium', 'sana', -8, 2, { est: 10, labels: ['design'] }),
      T('Migrate blog posts to new CMS', 'in_progress', 'high', 'tom', -9, -2, {
        est: 16, labels: ['content', 'backend'],
        desc: 'Script the import of 140 posts, preserving slugs, authors and publish dates. Images move to the new asset bucket.',
        check: [['Export old posts', true], ['Write import script', true], ['Map authors', false], ['Re-host images', false], ['Verify 20 posts by hand', false]],
        cm: [['tom', 'Import script works on a sample of 20. Author mapping is the blocker, need a list from Leila.', 3], ['leila', 'Sending the author list today.', 3]],
      }),
      T('Product page template', 'in_progress', 'high', 'rohan', -4, 5, { est: 12, labels: ['frontend'] }),
      T('SEO redirect map', 'in_progress', 'urgent', 'aarav', -3, 1, {
        est: 6, labels: ['seo'],
        desc: 'Every old URL needs a 301 to its new home. Missing one costs us ranking on launch day.',
        check: [['Crawl old site', true], ['Match to new routes', false], ['Test redirects on staging', false]],
      }),
      T('Accessibility review (WCAG AA)', 'todo', 'high', 'priya', 3, 10, { est: 8, labels: ['quality'] }),
      T('Contact form with spam protection', 'todo', 'medium', 'tom', 2, 8, { est: 6 }),
      T('Analytics and consent banner', 'todo', 'medium', 'rohan', 4, 12, { est: 5 }),
      T('Write case study pages', 'todo', 'low', 'leila', 5, 15, { est: 14, labels: ['content'] }),
      T('Customer testimonials carousel', 'backlog', 'low', null, null, null),
      T('Localization groundwork', 'backlog', 'low', null, null, null),
      T('Dark mode', 'backlog', 'low', null, null, null),
    ],
  },
  {
    key: 'APP', name: 'Mobile App 2.0', color: '#3D86C6', status: 'active', start: -14, due: 60, owner: 'aarav',
    description: 'The next major release: offline mode, a simpler onboarding flow and push notifications.',
    members: { priya: 'member', rohan: 'member', tom: 'member', sana: 'member' },
    tasks: [
      T('Synthesize user research findings', 'done', 'high', 'priya', -14, -9, { done: 8, est: 8 }),
      T('Define 2.0 scope and success metrics', 'done', 'high', 'priya', -12, -7, { done: 6, est: 6 }),
      T('Set up React Native workspace', 'done', 'medium', 'rohan', -10, -6, { done: 5, est: 8 }),
      T('Offline mode: local storage layer', 'in_progress', 'high', 'tom', -6, 12, { est: 30, labels: ['backend'] }),
      T('Onboarding flow redesign', 'in_progress', 'high', 'sana', -5, 9, {
        est: 20, labels: ['design'],
        check: [['Map current drop-off points', true], ['Sketch three alternatives', true], ['Prototype and test with 5 users', false]],
      }),
      T('Push notification service', 'in_progress', 'medium', 'aarav', -3, 14, { est: 16, labels: ['backend'] }),
      T('Sign in with biometrics', 'in_review', 'medium', 'rohan', -7, 3, { est: 10 }),
      T('Sync conflict resolution rules', 'todo', 'high', 'tom', 10, 24, { est: 14 }),
      T('Settings screen refresh', 'todo', 'low', 'sana', 8, 20, { est: 8 }),
      T('In-app feedback prompt', 'todo', 'medium', 'rohan', 12, 26, { est: 6 }),
      T('Beta rollout plan', 'todo', 'medium', 'priya', 20, 40, { est: 6 }),
      T('Tablet layouts', 'backlog', 'low', null, null, null),
      T('Widget for home screen', 'backlog', 'low', null, null, null),
      T('Crash reporting upgrade', 'backlog', 'medium', 'aarav', null, null),
    ],
  },
  {
    key: 'MKT', name: 'Spring Campaign', color: '#8A63D2', status: 'active', start: -40, due: 9, owner: 'leila',
    description: 'Launch campaign across email, social and paid search, timed with the website relaunch.',
    members: { priya: 'member', sana: 'member', rohan: 'viewer' },
    tasks: [
      T('Campaign brief and goals', 'done', 'high', 'leila', -40, -34, { done: 13, est: 6 }),
      T('Audience segments', 'done', 'medium', 'priya', -36, -30, { done: 12, est: 8 }),
      T('Landing page concepts', 'done', 'medium', 'sana', -30, -22, { done: 11, est: 12 }),
      T('Email sequence draft', 'done', 'medium', 'leila', -26, -18, { done: 9, est: 10 }),
      T('Social content calendar', 'in_review', 'medium', 'leila', -20, -6, { est: 12 }),
      T('Paid search keyword plan', 'in_progress', 'high', 'priya', -14, -4, { est: 10, labels: ['paid'] }),
      T('Campaign video storyboard', 'in_progress', 'medium', 'sana', -10, -1, { est: 14, labels: ['design'] }),
      T('Influencer outreach list', 'in_progress', 'low', 'leila', -6, 4, { est: 8 }),
      T('Set up conversion tracking', 'todo', 'urgent', 'priya', -5, -2, {
        est: 5, labels: ['analytics'],
        desc: 'We cannot judge the campaign without this. Needs to be live before the first paid impressions.',
      }),
      T('Email design and QA', 'todo', 'high', 'sana', -2, 3, { est: 10 }),
      T('Schedule launch posts', 'todo', 'medium', 'leila', 4, 8, { est: 4 }),
      T('Press release', 'todo', 'low', 'leila', 3, 9, { est: 5 }),
      T('Post-campaign report', 'backlog', 'low', 'priya', null, null),
    ],
  },
  {
    key: 'ONB', name: 'Onboarding Revamp', color: '#2F9E5F', status: 'completed', start: -80, due: -20, owner: 'priya',
    description: 'Shortened the time to first value for new customers. Shipped and measured.',
    members: { sana: 'member', aarav: 'member' },
    tasks: [
      T('Interview 12 new customers', 'done', 'high', 'priya', -80, -70, { done: 66, est: 20 }),
      T('Map the activation funnel', 'done', 'high', 'priya', -72, -65, { done: 62, est: 8 }),
      T('Welcome checklist design', 'done', 'medium', 'sana', -64, -55, { done: 52, est: 14 }),
      T('Build checklist and progress tracking', 'done', 'high', 'aarav', -55, -42, { done: 40, est: 30 }),
      T('Welcome email series', 'done', 'medium', 'priya', -50, -40, { done: 38, est: 8 }),
      T('A/B test rollout', 'done', 'medium', 'aarav', -40, -30, { done: 28, est: 10 }),
      T('Measure activation lift', 'done', 'high', 'priya', -30, -22, { done: 21, est: 6 }),
      T('Write up learnings', 'done', 'low', 'priya', -24, -20, { done: 19, est: 4 }),
    ],
  },
  {
    key: 'PRT', name: 'Partner Portal', color: '#E57A2B', status: 'planning', start: 14, due: 90, owner: 'priya',
    description: 'A self-serve portal where reseller partners can register deals and download assets. Still in scoping.',
    members: { aarav: 'member', tom: 'member' },
    tasks: [
      T('Interview five current partners', 'todo', 'high', 'priya', 3, 12, { est: 10 }),
      T('Draft requirements', 'backlog', 'medium', 'priya', null, null),
      T('Choose auth approach for external users', 'backlog', 'medium', 'aarav', null, null),
      T('Deal registration data model', 'backlog', 'low', 'tom', null, null),
      T('Asset library concept', 'backlog', 'low', null, null, null),
    ],
  },
];

const run = async () => {
  await migrate();
  const { rows: [{ n }] } = await query('SELECT COUNT(*)::int AS n FROM users');
  if (n > 0 && !force) {
    console.log('The database already has data, so nothing was seeded.');
    console.log('Run "npm run db:reseed" to wipe it and load the demo data.');
    return;
  }

  const hash = await bcrypt.hash('demo1234', 10);

  await tx(async (c) => {
    if (force) {
      await c.query('TRUNCATE activity, comments, checklist_items, tasks, project_members, projects, users RESTART IDENTITY CASCADE');
    }

    const uid = {};
    for (const [k, [name, email, title, color]] of Object.entries(PEOPLE)) {
      const { rows: [u] } = await c.query(
        'INSERT INTO users (name, email, password_hash, title, color, created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        [name, email, hash, title, color, ago(90)]
      );
      uid[k] = u.id;
    }
    for (const p of PROJECTS) {
      const { rows: [proj] } = await c.query(
        `INSERT INTO projects (key, name, description, color, status, start_date, due_date, owner_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [p.key, p.name, p.description, p.color, p.status, dstr(p.start), dstr(p.due), uid[p.owner], ago(Math.max(1, -p.start + 3))]
      );
      await c.query('INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,$3)', [proj.id, uid[p.owner], 'owner']);
      for (const [k, role] of Object.entries(p.members)) {
        await c.query('INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,$3)', [proj.id, uid[k], role]);
      }
      await c.query(
        `INSERT INTO activity (project_id, user_id, action, meta, created_at) VALUES ($1,$2,'project_created',$3,$4)`,
        [proj.id, uid[p.owner], { name: p.name }, ago(Math.max(1, -p.start + 3))]
      );

      const posByStatus = {};
      let number = 0;
      for (const t of p.tasks) {
        number += 1;
        posByStatus[t.status] = (posByStatus[t.status] || 0) + 1000;
        const doneAgo = t.status === 'done' ? t.done ?? 3 : null;
        let createdAgo = Math.max(1, Math.min(60, (t.start != null && t.start < 0 ? -t.start : 3) + 2 + rnd(3)));
        if (doneAgo != null) createdAgo = Math.max(createdAgo, doneAgo + 2);
        const created = ago(createdAgo, 9 + rnd(6));
        const completed = doneAgo != null ? ago(doneAgo, 11 + rnd(6)) : null;
        const reporter = p.owner;

        const { rows: [task] } = await c.query(
          `INSERT INTO tasks (project_id, number, title, description, status, priority, assignee_id, reporter_id,
                              start_date, due_date, estimate_hours, labels, position, completed_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING id`,
          [proj.id, number, t.title, t.desc ?? '', t.status, t.priority, t.assignee ? uid[t.assignee] : null, uid[reporter],
            t.start != null ? dstr(t.start) : null, t.due != null ? dstr(t.due) : null, t.est ?? null, t.labels ?? [],
            posByStatus[t.status], completed, created]
        );

        await c.query(
          `INSERT INTO activity (project_id, task_id, user_id, action, meta, created_at) VALUES ($1,$2,$3,'task_created',$4,$5)`,
          [proj.id, task.id, uid[reporter], { ref: `#${number}`, title: t.title }, created]
        );
        if (completed) {
          await c.query(
            `INSERT INTO activity (project_id, task_id, user_id, action, meta, created_at) VALUES ($1,$2,$3,'status_changed',$4,$5)`,
            [proj.id, task.id, t.assignee ? uid[t.assignee] : uid[reporter], { ref: `#${number}`, title: t.title, from: 'in_review', to: 'done' }, completed]
          );
        }
        let i = 0;
        for (const [title, done] of t.check || []) {
          await c.query('INSERT INTO checklist_items (task_id, title, done, position) VALUES ($1,$2,$3,$4)', [task.id, title, done, ++i]);
        }
        for (const [who, body, daysAgo] of t.cm || []) {
          const at = ago(daysAgo, 13 + rnd(4));
          await c.query('INSERT INTO comments (task_id, user_id, body, created_at) VALUES ($1,$2,$3,$4)', [task.id, uid[who], body, at]);
          await c.query(
            `INSERT INTO activity (project_id, task_id, user_id, action, meta, created_at) VALUES ($1,$2,$3,'commented',$4,$5)`,
            [proj.id, task.id, uid[who], { ref: `#${number}`, title: t.title }, at]
          );
        }
      }
      await c.query('UPDATE projects SET task_counter = $2 WHERE id = $1', [proj.id, number]);
      console.log(`  ${p.key}  ${p.name}  (${number} tasks)`);
    }
  });

  console.log('\nDemo data loaded. Sign in with:  demo@orbit.app  /  demo1234');
};

try {
  await run();
} catch (err) {
  console.error('Seeding failed:', err.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
