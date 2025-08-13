import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    // Supabase server-only keys
    SUPABASE_SERVICE_ROLE_KEY: z.string(),
    SUPABASE_IMAGES_BUCKET: z.string().default('images'),
    SUPABASE_VIDEOS_BUCKET: z.string().default('videos'),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    FFMPEG_PATH: z.string().optional(),
    RENDER_CONCURRENCY: z.coerce.number().int().positive().default(2),
    DATABASE_URL: z.string().min(1),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so you need to destruct manually.
   */
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_IMAGES_BUCKET: process.env.SUPABASE_IMAGES_BUCKET,
    SUPABASE_VIDEOS_BUCKET: process.env.SUPABASE_VIDEOS_BUCKET,
    NODE_ENV: process.env.NODE_ENV,
    FFMPEG_PATH: process.env.FFMPEG_PATH,
    RENDER_CONCURRENCY: process.env.RENDER_CONCURRENCY,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
