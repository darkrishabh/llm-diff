import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  webpack(config, { isServer }) {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Same package: resolve engine via emitted JS (src uses .js specifiers).
      "@darkrishabh/bench-ai": path.resolve(__dirname, "dist/engine/index.js"),
    };
    if (!isServer) {
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
