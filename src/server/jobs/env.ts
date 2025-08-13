import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local', override: true });

// Simple environment variable access without validation
export const workerEnv = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_IMAGES_BUCKET: process.env.SUPABASE_IMAGES_BUCKET || 'images',
  SUPABASE_VIDEOS_BUCKET: process.env.SUPABASE_VIDEOS_BUCKET || 'videos',
  NODE_ENV: process.env.NODE_ENV || 'development',
  FFMPEG_PATH: process.env.FFMPEG_PATH,
  RENDER_CONCURRENCY: process.env.RENDER_CONCURRENCY || '2',
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;

// Validate required environment variables
const requiredEnvVars = [
  'SUPABASE_SERVICE_ROLE_KEY'
];

// Check if all required environment variables are set
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
