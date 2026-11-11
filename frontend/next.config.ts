import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // required for the small Docker image
  // Dev server is reached through nginx: the hostname, or this machine's IP on any private network (phones on the same
  // Wi-Fi). Wildcards (one `*` per label) so a new network IP keeps working without editing this file.
  allowedDevOrigins: ["campushub.ma", "10.*.*.*", "172.*.*.*", "192.168.*.*"],
};

export default nextConfig;