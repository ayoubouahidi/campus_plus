import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // required for the small Docker image
  // Dev server is reached through nginx: the hostname, or this machine's IP on any private network (phones on the same
  // Wi-Fi). Wildcards (one `*` per label) so a new network IP keeps working without editing this file.
  allowedDevOrigins: ["campushub.ma", "10.*.*.*", "172.*.*.*", "192.168.*.*"],
  // /me is an alias of /profile (lib/navigation.ts PROFILE_NAV_ITEM). Temporary (307): the alias may become a
  // page of its own later.
  async redirects() {
    return [{ source: "/me", destination: "/profile", permanent: false }];
  },
};

export default nextConfig;