/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

// Allow Next/Image to load images from the Supabase project's storage domain
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
/** @type {import('next/dist/shared/lib/image-config').RemotePattern[]} */
let imageRemotePatterns = [];
if (supabaseUrl) {
  try {
    const { hostname } = new URL(supabaseUrl);
    imageRemotePatterns.push({
      protocol: "https",
      hostname,
      pathname: "/storage/v1/object/**",
    });
  } catch {}
}

/** @type {import("next").NextConfig} */
const config = {
  images: {
    remotePatterns: imageRemotePatterns,
  },
  async redirects() {
    return [
      {
        source: "/editor",
        has: [
          {
            type: "query",
            key: "workspace",
          },
        ],
        destination: "/workspace",
        permanent: false,
      },
      {
        source: "/editor",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/editor/timeline/:nodeId",
        destination: "/workspace/timeline/:nodeId",
        permanent: false,
      },
    ];
  },
};

export default config;
