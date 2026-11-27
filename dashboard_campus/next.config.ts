import type { NextConfig } from "next";

// Every dashboard page depends on the signed-in user's session, so pages are
// rendered per request. Cache Components (cacheComponents) is left off, like on
// the student site: with it on, Auth.js's session handling broke prerendering
// ("crypto.getRandomValues() while prerendering") on every page.
const nextConfig: NextConfig = {
  output: "standalone",
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
