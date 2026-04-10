import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo root — required so Vercel/serverless output tracing includes `packages/core`. */
const monorepoRoot = path.join(__dirname, "..", "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@llm-diff/core"],
  outputFileTracingRoot: monorepoRoot,
  webpack(config, { isServer }) {
    if (!isServer) {
      // child_process / util are Node-only — used by SubprocessProvider which
      // only ever runs in API routes (server). Tell the client bundle to ignore them.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        util: false,
      };
    }
    return config;
  },
};

export default nextConfig;
