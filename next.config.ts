import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    serverActions: {
      // Settings page uploads logo, signature and payment QR (up to 2 MB each)
      bodySizeLimit: "8mb",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  // PDF fonts and default branding images are read from disk at runtime, so make sure they ship with server functions.
  outputFileTracingIncludes: {
    "/**": ["./lib/pdf/fonts/**/*", "./lib/pdf/assets/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
