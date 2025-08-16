/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  async redirects() {
    return [
      {
        source: '/editor',
        has: [
          {
            type: 'query',
            key: 'workspace',
          },
        ],
        destination: '/workspace',
        permanent: false,
      },
      {
        source: '/editor',
        destination: '/dashboard',
        permanent: false,
      },
      {
        source: '/editor/timeline/:nodeId',
        destination: '/workspace/timeline/:nodeId',
        permanent: false,
      },
    ];
  },
};

export default config;
