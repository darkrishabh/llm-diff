import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  webpack(config, { isServer }) {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Not @darkrishabh/bench-ai — Next resolves that to src/engine. Use internal alias.
      "@bench/engine": path.resolve(__dirname, "dist/engine/index.js"),
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
