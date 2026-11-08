# Orbit

A project manager for small teams: kanban boards, a draggable Gantt timeline, workload view, and a dashboard with project health computed from real task data.

**Stack:** Svelte 5 + Vite (frontend) · Node.js + Express 5 (API) · PostgreSQL · deploys to Vercel as a static site plus one serverless function.

## Features

- **Dashboard**: overdue and due-soon counts, project health (on track / at risk / off track), 14-day created-vs-completed chart, status breakdown, workload per person, recent activity.
- **Projects**: board (drag and drop), list (inline edit), timeline (drag to move, drag edges to resize, click an empty row to schedule), overview, team.
- **Tasks**: priority, assignee, dates, estimates, labels, checklists, comments, activity log. Opens in a drawer (`?task=ID` is linkable).
- **My tasks**, global search, roles (owner / member / viewer), sign up and sign in.

## Project layout

```
api/index.js     Vercel serverless entry (re-exports the Express app)
server/          Express API, schema, seed data
web/             Svelte app
scripts/         smoke-test.mjs (24 API checks)
vercel.json      Build + routing for Vercel
```

## Run locally

Requirements: Node 20+, and a PostgreSQL database.

```bash
cp .env.example .env        # then edit DATABASE_URL and JWT_SECRET
npm run setup               # installs root + web dependencies
npm run db:seed             # demo data (tables are created automatically)
npm run dev                 # API on :3001, web on http://localhost:5173
```

Database options (put the connection string in `.env`):

- **Docker:** `docker compose up -d`, then `DATABASE_URL=postgres://orbit:orbit@localhost:5432/orbit`
- **Local Postgres:** create a database and use its URL.
- **Hosted free tier:** Neon or Supabase, copy the connection string.

Demo login: `demo@orbit.app` / `demo1234` (the login page has a one-click demo button in dev).

Production-like run: `npm run build && npm start`, then open http://localhost:3001.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Create a Postgres database: Vercel dashboard → Storage / Marketplace → Neon, or use Supabase. Use the **pooled** connection string.
3. In Vercel, **Add New → Project**, import the repo. Framework preset: **Other** (`vercel.json` already sets install, build and output).
4. Add environment variables:
   - `DATABASE_URL` (or `POSTGRES_URL`, which the Marketplace integration sets for you)
   - `JWT_SECRET`: a long random string (`openssl rand -hex 32`)
   - Optional: `VITE_SHOW_DEMO=true` to show the demo-login button on the live site (build-time variable).
5. Deploy. Tables are created automatically on the first request.
6. Optional demo data: `DATABASE_URL="<your url>" npm run db:seed`

CLI alternative: `npx vercel` then `npx vercel --prod`, after adding the same variables.

Tips: pick a Vercel function region close to your database (for example Neon Singapore with `sin1`). To skip automatic table creation, set `AUTO_MIGRATE=false` and run `npm run db:migrate` yourself.

## Check a running instance

```bash
npm run smoke                                  # against http://localhost:3001
API_URL=https://your-app.vercel.app npm run smoke
```

The smoke test registers its own users and deletes its own project.

## Known limitations

- Board drag and drop uses HTML5 drag events, which don't work on touch screens. On phones, change status in the task drawer or list view.
- The sign-in token is kept in `localStorage` (simple, but exposed if the page ever has an XSS bug).
- Schema changes run lazily at cold start; for larger teams, run migrations as a deploy step.
