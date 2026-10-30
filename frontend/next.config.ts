import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // required for the small Docker image
};

export default nextConfig;