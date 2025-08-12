import dotenv from 'dotenv';

// Load environment variables immediately
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

// Export a function to ensure environment is loaded
export function ensureEnvLoaded() {
  // This function can be called to ensure environment is loaded
  return true;
}
