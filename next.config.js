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

// Add Google domains for OAuth profile pictures
const googleDomains = [
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
];

googleDomains.forEach((domain) => {
  imageRemotePatterns.push({
    protocol: "https",
    hostname: domain,
    pathname: "/**",
  });
});

/** @type {import("next").NextConfig} */
const config = {
  // Mark keyv and adapters as external to prevent bundling dynamic imports
  serverExternalPackages: [
    'keyv',
    '@keyv/redis',
    '@keyv/mongo',
    '@keyv/sqlite',
    '@keyv/postgres',
    '@keyv/mysql',
    '@keyv/etcd',
    '@keyv/offline',
    '@keyv/tiered'
  ],
  images: {
    remotePatterns: imageRemotePatterns,
    // Configure image optimization for better reliability with external URLs
    minimumCacheTTL: 60, // Cache optimized images for 1 minute
    // Add custom loader for Supabase images to handle timeouts better
    loader: "default",
    // Configure image sizes and device sizes for better optimization
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Allow dangerous SVG processing
    dangerouslyAllowSVG: true,
    // Set content disposition type
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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
