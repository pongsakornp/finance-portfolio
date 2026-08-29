import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // slim self-contained server for the Docker/Dokploy runtime image
  output: "standalone",
  images: { unoptimized: true },
  compress: false, // disable Next's Gzip response middleware → no MaxListenersExceededWarning
};

export default nextConfig;
