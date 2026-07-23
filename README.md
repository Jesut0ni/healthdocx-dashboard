# HealthDocX Team Dashboard

Internal dashboard for HealthDocX team to manage tasks, reminders, projects, documentation, users, and operations visibility.

## Current Prototype

- HealthDocX-branded dashboard shell using the live site logo, palette, and Sora typography
- Project onboarding pipeline
- Assignable work queue with status, priority, owner, and private-detail markers
- Owner filtering for task assignment reviews
- Dedicated reminders view with per-owner cadence, delivery channel, manual sends, and a local send log
- Project work batches, quality checks, and review items inside the Projects view
- Integration status and mapping progress
- Technical documentation register
- User and role management surface
- Audit event feed
- Create modals for tasks, projects, work batches, integrations, docs, and users
- Detail drawers for operational details
- Toast confirmations, empty states, important-action confirmations, and local audit updates
- Sorting controls for projects, work batches, integrations, and docs
- Express/TypeScript backend scaffold with PostgreSQL, Drizzle ORM, migrations, seed data, task assignment APIs, reminder APIs, and audit APIs
- Internal login using team email, shared access code, and signed backend session tokens
- Email reminder delivery through Maileroo, with SMTP still available as a fallback

The frontend now requires login, then tries the Express API first and falls back to local state if the backend or PostgreSQL is unavailable. Local seed data still lives in `src/lib/healthdocx-data.ts` so the team can demo the dashboard without a database.

## Frontend Product Rules

- New work items always start in Backlog.
- Approved status flow is Backlog -> In progress -> Review -> Done, with Blocked as a recoverable exception state.
- Done is only available from Review.
- Tasks marked as containing private details cannot move into Review or Done.
- Task due dates accept Today, Tomorrow, month-day values like `Jul 30`, or ISO dates like `2026-07-30`.
- Reminder schedules only batch-send for enabled owners with pending tasks.
- Reminder logs are session-local until the selected backend is connected.

## Brand System

- Logo asset: `public/healthdocx-logo.svg`
- Primary green: `#008943`
- Logo green: `#006D34`
- Page background: `#F7FAF7`
- Panel surface: `#FFFFFF`
- Soft surface: `#EEF7EE`
- Mint accent: `#B4F1BD`
- Divider: `#C1C9BE`
- Typeface: Sora via `@fontsource-variable/sora`

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Backend

Create a local backend env file from `backend/.env.example`, then set `DATABASE_URL` to the PostgreSQL database for this dashboard.

```bash
npm run db:migrate
npm run db:seed
npm run backend:dev
```

`npm run db:seed` and `npm run db:reset-live` intentionally reset the dashboard to a blank live workspace. They delete users, tasks, projects, work batches, integrations, docs, reminder rules, reminder logs, and audit history. Use this before the first production deploy only when the database must start fresh.

The frontend defaults to `http://localhost:4000` for API calls during local development and uses same-origin `/api` calls in production. Set `NEXT_PUBLIC_API_BASE_URL` only if the backend is deployed to a separate URL.

When the database has no users, the login screen switches to first-admin setup. Create the first owner with their real name, email, role, team, and the shared `APP_ACCESS_CODE`. After that, sign in with that email and invite the remaining team members from Access.

Email reminders use Maileroo first when `MAILEROO_API_KEY` and `MAILEROO_FROM_EMAIL` are set in `backend/.env`. Optional `MAILEROO_FROM_NAME` controls the display name. SMTP settings, if present, are used only as a fallback: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and optional `SMTP_SECURE`. If neither Maileroo nor SMTP is configured, reminder sends are still logged but no email leaves the system.

Scheduled reminders can run locally as a separate worker:

```bash
npm run reminders:worker
```

The worker checks enabled reminder rules every minute by default. Daily reminders send after 09:00, twice-a-day reminders send after 09:00 and 16:00, and weekly reminders send after Monday 09:00. Set `ENABLE_REMINDER_WORKER=true` only if you want the local API server process to run the scheduler itself.

## Vercel Deployment

This repo is ready to deploy as one Vercel project: the Next.js frontend and Express backend run under the same deployment. The root `api/index.ts` file exports the Express app as a Vercel Function, and `vercel.json` rewrites `/api/*` requests to that function.

Set these Vercel environment variables before the production deploy:

- `DATABASE_URL`
- `APP_ACCESS_CODE`
- `SESSION_SECRET`
- `CRON_SECRET`
- `MAILEROO_API_KEY`
- `MAILEROO_FROM_EMAIL`
- `MAILEROO_FROM_NAME`
- `FRONTEND_ORIGIN`
- `APP_BASE_URL`
- `REMINDER_TIMEZONE_OFFSET_MINUTES=60`

For same-project Vercel deployment, `APP_BASE_URL` and `FRONTEND_ORIGIN` should be your deployed app URL. Do not set `NEXT_PUBLIC_API_BASE_URL` unless the API is deployed separately.

The Vercel cron endpoint is `GET /api/cron/reminders`. Vercel automatically sends `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is configured. The included cron schedule runs at 08:00 and 15:00 UTC, which is 09:00 and 16:00 in Lagos. Vercel Hobby plans only allow once-daily cron schedules; keep both schedules for Vercel Pro, or remove the 15:00 schedule if deploying on Hobby.

Useful backend endpoints:

- `GET /health`
- `GET /api/auth/bootstrap-status`
- `POST /api/auth/bootstrap-admin`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard/bootstrap`
- `POST /api/tasks`
- `PATCH /api/tasks/:id/owner`
- `PATCH /api/tasks/:id/status`
- `POST /api/projects`
- `POST /api/work-batches`
- `POST /api/integrations`
- `POST /api/docs`
- `POST /api/users`
- `PATCH /api/users/:id/access`
- `PATCH /api/users/:id/status`
- `PATCH /api/reminders/:owner`
- `POST /api/reminders/send`
- `GET /api/cron/reminders`
- `GET /api/audit-events`

## Verify

```bash
npm run lint
npm test
npm run build
```

## Next Production Milestones

1. Replace the shared access code with per-user passwords or Google Workspace sign-in.
2. Deploy the Vercel project and verify the protected cron job.
3. Add Slack and WhatsApp delivery channels after email is configured.
4. Add edit/delete endpoints where the team needs them beyond the current create/status/assignment/access flows.
5. Polish production deployment settings for the frontend and backend.
6. Add automated tests for permissions, task state changes, reminders, and work batch workflows.
