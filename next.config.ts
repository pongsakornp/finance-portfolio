import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // slim self-contained server for the Docker/Dokploy runtime image
  output: "standalone",
  images: { unoptimized: true },
};

export default nextConfig;
