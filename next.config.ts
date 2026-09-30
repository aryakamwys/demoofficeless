import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone output — dibutuhkan Docker image (lihat Dockerfile)
  output: "standalone",
  serverExternalPackages: ["pdf-parse", "pdf-parse-new"],
  // Halaman yang sudah dikunjungi tetap segar 30 detik di router cache
  // client — navigasi balik/antar menu instan tanpa loading ulang
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
