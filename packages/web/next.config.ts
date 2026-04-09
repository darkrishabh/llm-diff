import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@llm-diff/core"],
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
