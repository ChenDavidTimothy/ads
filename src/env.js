import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// JWT token validation helper
const jwtSchema = z
  .string()
  .min(100)
  .refine(
    (token) => {
      // Basic JWT structure validation: should have 3 parts separated by dots
      const parts = token.split(".");
      return parts.length === 3 && token.startsWith("eyJ");
    },
    { message: "Must be a valid JWT token format" },
  );

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    // Supabase server-only keys with stricter validation
    SUPABASE_SERVICE_ROLE_KEY: jwtSchema,
    SUPABASE_IMAGES_BUCKET: z.string().default("images"),
    SUPABASE_VIDEOS_BUCKET: z.string().default("videos"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    FFMPEG_PATH: z.string().optional(),
    RENDER_CONCURRENCY: z.coerce.number().int().positive().max(20).default(2),
    DATABASE_URL: z.string().min(1).url(), // Ensure it's a valid URL

    // Asset cache configuration - platform-appropriate defaults
    JOB_CACHE_DIR: z.string().default(process.platform === 'win32' ? 'C:\\render\\jobs' : '/var/cache/render/jobs'),
    SHARED_CACHE_DIR: z.string().default(process.platform === 'win32' ? 'C:\\render\\shared' : '/var/cache/render/shared'),
    SHARED_CACHE_MAX_BYTES: z.coerce.number().int().positive().default(10737418240), // 10GB
    MAX_JOB_SIZE_BYTES: z.coerce.number().int().positive().default(2147483648), // 2GB
    DOWNLOAD_CONCURRENCY_PER_JOB: z.coerce.number().int().positive().max(50).default(8),
    ENABLE_SHARED_CACHE_JANITOR: z.string().transform((val) => val === "true").default("true"),

    // Production-specific requirements
    ...(process.env.NODE_ENV === "production" && {
      // Force HTTPS in production for Supabase URL (also validated in client section)
      DATABASE_URL: z
        .string()
        .url()
        .refine((url) => !url.includes("localhost"), {
          message: "Production must not use localhost database",
        }),
    }),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NODE_ENV === "production"
        ? z
            .string()
            .url()
            .refine((url) => url.startsWith("https://"), {
              message: "Supabase URL must use HTTPS in production",
            })
        : z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: jwtSchema,
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

    // Asset cache configuration
    JOB_CACHE_DIR: process.env.JOB_CACHE_DIR,
    SHARED_CACHE_DIR: process.env.SHARED_CACHE_DIR,
    SHARED_CACHE_MAX_BYTES: process.env.SHARED_CACHE_MAX_BYTES,
    MAX_JOB_SIZE_BYTES: process.env.MAX_JOB_SIZE_BYTES,
    DOWNLOAD_CONCURRENCY_PER_JOB: process.env.DOWNLOAD_CONCURRENCY_PER_JOB,
    ENABLE_SHARED_CACHE_JANITOR: process.env.ENABLE_SHARED_CACHE_JANITOR,
  },

  // Enhanced runtime validation
  onValidationError: (error) => {
    console.error("❌ Invalid environment variables:");
    console.error("Validation errors:", error);

    if (process.env.NODE_ENV === "production") {
      // Fail fast in production
      throw new Error(
        "Invalid environment configuration for production deployment",
      );
    }

    // This function should never return normally
    process.exit(1);
  },

  onInvalidAccess: (variable) => {
    console.error(
      `❌ Attempted to access invalid environment variable: ${variable}`,
    );
    throw new Error(`Invalid environment variable access: ${variable}`);
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

// Production startup validation
if (process.env.NODE_ENV === "production") {
  // Validate critical production settings
  const criticalChecks = [
    {
      name: "Supabase URL HTTPS",
      check: () => env.NEXT_PUBLIC_SUPABASE_URL.startsWith("https://"),
      fix: "Ensure NEXT_PUBLIC_SUPABASE_URL uses HTTPS",
    },
    {
      name: "Service Role Key Format",
      check: () =>
        env.SUPABASE_SERVICE_ROLE_KEY.includes(".") &&
        env.SUPABASE_SERVICE_ROLE_KEY.split(".").length === 3,
      fix: "Verify SUPABASE_SERVICE_ROLE_KEY is a valid JWT",
    },
    {
      name: "Anon Key Format",
      check: () =>
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes(".") &&
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY.split(".").length === 3,
      fix: "Verify NEXT_PUBLIC_SUPABASE_ANON_KEY is a valid JWT",
    },
    {
      name: "Database URL Security",
      check: () =>
        !env.DATABASE_URL.includes("localhost") &&
        !env.DATABASE_URL.includes("127.0.0.1"),
      fix: "Use production database, not localhost",
    },
    {
      name: "Render Concurrency Limit",
      check: () => env.RENDER_CONCURRENCY <= 10,
      fix: "RENDER_CONCURRENCY should be reasonable for production (≤10)",
    },
  ];

  const failed = criticalChecks.filter((check) => !check.check());
  if (failed.length > 0) {
    console.error("❌ PRODUCTION DEPLOYMENT BLOCKED - Critical issues:");
    failed.forEach((f) => console.error(`  • ${f.name}: ${f.fix}`));
    process.exit(1);
  }

  console.log("✅ Production environment validation passed");
}
