import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // required for the small Docker image
  allowedDevOrigins: ["campushub.ma", "10.32.137.107"], // dev server is reached through nginx: hostname + this machine's Wi-Fi IP (changes if the IP changes)
};

export default nextConfig;