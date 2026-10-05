import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone output — dibutuhkan Docker image (lihat Dockerfile)
  output: "standalone",
  serverExternalPackages: ["pdf-parse", "pdf-parse-new"],
  // Kompresi ditangani Caddy (encode zstd gzip) — kompresi di Node hanya
  // memakan CPU event loop yang sama dengan serving request, dan Caddy
  // menghasilkan zstd yang ~15-20% lebih kecil dari gzip Node.
  compress: false,
  // Halaman yang sudah dikunjungi tetap segar 30 detik di router cache
  // client — navigasi balik/antar menu instan tanpa loading ulang
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  // Aset publik yang tidak pernah berubah (screenshot docs, logo) — tanpa ini
  // Next mengirim max-age=0 must-revalidate dan Cloudflare tidak menyimpannya
  // di edge: ±580KB PNG docs diunduh ulang oleh tiap pengunjung.
  async headers() {
    const cache = [
      { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
    ];
    return [
      { source: "/docs/:path*", headers: cache },
      { source: "/ogoperkom.png", headers: cache },
      { source: "/openclaw-dark.webp", headers: cache },
    ];
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
