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

## How do you deploy this?

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
SUPABASE_IMAGES_BUCKET=images
SUPABASE_VIDEOS_BUCKET=videos
```

## Rendering configuration

These environment variables tune the rendering pipeline timeouts and watchdog limits (optional; sensible defaults are applied):

- FFMPEG_PATH: Path to ffmpeg binary (default: `ffmpeg` in PATH)
- FFMPEG_STARTUP_TIMEOUT_MS: Max time to wait for ffmpeg to be ready (default: 10000)
- FFMPEG_WRITE_TIMEOUT_MS: Max time to wait for a frame write (default: 30000)
- FFMPEG_FINISH_TIMEOUT_MS: Max time to wait for encode finish (default: 60000)
- RENDER_MAX_MS: Max total render duration per job (default: 300000)
- RENDER_MAX_HEAP_BYTES: Max heap usage threshold to abort a job (default: 734003200)
- RENDER_WATCHDOG_INTERVAL_MS: Watchdog sampling interval (default: 1000)

## Storage Architecture

This project uses **separate Supabase storage buckets** for different content types with automatic routing:

### Bucket Configuration

```bash
# Separate buckets for different content types
SUPABASE_IMAGES_BUCKET=images
SUPABASE_VIDEOS_BUCKET=videos
```

### Automatic Content Routing

The storage system automatically routes files to the appropriate bucket based on file extension:

- **Images**: `png`, `jpg`, `jpeg`, `gif`, `webp`, `svg` → `images` bucket
- **Videos**: `mp4`, `avi`, `mov`, `wmv`, `flv`, `webm`, `mkv` → `videos` bucket
- **Unknown types**: Default to `images` bucket

### File Organization

Your files will now be organized like this:

```
images bucket:
  └── {userId}/scene_{timestamp}_{uuid}.png
  └── {userId}/scene_{timestamp}_{uuid}.jpeg

videos bucket:
  └── {userId}/scene_{timestamp}_{uuid}.mp4
```

**Note**: The intermediate "animations" folder has been removed for cleaner organization.

### Bucket Policies

Each bucket should have appropriate RLS policies. Run the SQL script in `scripts/setup-storage-buckets.sql` in your Supabase SQL editor.

### Benefits of Bucket Separation

- **Security**: Different access controls for different content types
- **Performance**: Optimized CDN and caching strategies per content type
- **Cost Management**: Better storage tiering and lifecycle management
- **Compliance**: Easier to implement content-specific retention policies
- **Scalability**: Independent scaling and monitoring per bucket

## Database schema (Supabase)

Run Graphile Worker migrations in your database (safe to run on Supabase):

- Option A (automatic on worker start, dev only): the worker runner starts with `skipMigrations: false`.
- Option B (recommended for production): run Graphile Worker's SQL migrations once via a migration tool or psql.

Additionally, for client notifications, ensure the custom channel exists (no schema changes required):

- We publish job completion events to `render_job_events` using `pg_notify`.

## Commands

- Start worker: `pnpm run worker`
- Start app: `pnpm run dev`

## Notes

- Enqueue via `renderQueue.enqueueOnly({ scene, config, userId, jobId })`.
- Clients can wait for completion with the existing `waitForRenderJobEvent` helper.
