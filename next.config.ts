import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: [
    "macs-mac-mini.tailcdc84b.ts.net",
    "192.168.87.29:3001",
    "192.168.87.29:3000",
    "localhost:3001",
    "localhost:3000",
  ],
};

export default nextConfig;
