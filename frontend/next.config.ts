import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // required for the small Docker image
  allowedDevOrigins: ["campushub.ma"], // dev server is reached through nginx
};

export default nextConfig;