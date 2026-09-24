import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone output — dibutuhkan Docker image (lihat Dockerfile)
  output: "standalone",
  serverExternalPackages: ["pdf-parse", "pdf-parse-new"],
};

export default nextConfig;
