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
  // Dev lokal: NEXT_PUBLIC_SUPABASE_URL di .env.local diarahkan ke dev server
  // sendiri (http://localhost:<port>), lalu path /auth|rest|storage/v1 di-proxy
  // ke self-host production — request browser jadi same-origin, bebas CORS.
  // Hanya aktif saat `next dev`; build production tidak terpengaruh.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const target = process.env.SUPABASE_PROXY_TARGET || "https://perkombusiness.com";
    return ["auth", "rest", "storage"].map((svc) => ({
      source: `/${svc}/v1/:path*`,
      destination: `${target}/${svc}/v1/:path*`,
    }));
  },
};

export default nextConfig;
