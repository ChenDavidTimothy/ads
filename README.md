# Create T3 App

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.

# Jobs: Graphile Worker

This project now uses Graphile Worker (Postgres-only) for background jobs.

## Environment

Add to `.env.local`:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
RENDER_CONCURRENCY=2
RENDER_JOB_RETRY_LIMIT=5
PG_EVENTS_DEBUG=0
JOB_HEALTH_DEBUG=0
```

Also ensure existing Supabase env vars are set:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=videos
```

## Database schema (Supabase)

Run Graphile Worker migrations in your database (safe to run on Supabase):

- Option A (automatic on worker start, dev only): the worker runner starts with `skipMigrations: false`.
- Option B (recommended for production): run Graphile Worker’s SQL migrations once via a migration tool or psql.

Additionally, for client notifications, ensure the custom channel exists (no schema changes required):
- We publish job completion events to `render_job_events` using `pg_notify`.

## Commands

- Start worker: `pnpm run worker`
- Start app: `pnpm run dev`

## Notes

- Enqueue via `renderQueue.enqueueOnly({ scene, config, userId, jobId })`.
- Clients can wait for completion with the existing `waitForRenderJobEvent` helper.
