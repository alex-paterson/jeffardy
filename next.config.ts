import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: [
    "macs-mac-mini.tailcdc84b.ts.net",
    "alexanders-macbook-pro.local",
    "alexanders-macbook-pro.local:3000",
    "alexanders-macbook-pro.local:3001",
    "192.168.87.29:3001",
    "192.168.87.29:3000",
    "192.168.15.16:3001",
    "192.168.15.16:3000",
    "192.168.15.16",
    "localhost:3001",
    "localhost:3000",
  ],
};

export default nextConfig;
