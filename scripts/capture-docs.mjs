// scripts/capture-docs.mjs — screenshot halaman app untuk dokumentasi /docs.
// Membuka Chrome (visible), Anda login manual sekali, lalu semua halaman
// di-screenshot otomatis ke public/docs/.
// Pakai: node scripts/capture-docs.mjs  (dev server harus jalan di :3000)
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.DOCS_BASE_URL || "http://localhost:3000";

const pages = [
  ["dashboard", "/dashboard"],
  ["employees", "/employees"],
  ["upload", "/upload"],
  ["claims", "/claims"],
  ["openclaw", "/services/openclaw"],
  ["inventory", "/inventory"],
];

mkdirSync("public/docs", { recursive: true });

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`);
console.log(">> Login di jendela browser yang terbuka (timeout 5 menit)...");

await page.waitForURL("**/dashboard", { timeout: 300000 });
console.log(">> Login terdeteksi, mulai screenshot...");
await page.waitForTimeout(2000);

for (const [name, path] of pages) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `public/docs/${name}.png`, fullPage: true });
  console.log("ok:", name);
}

await browser.close();
console.log(">> Selesai. Screenshot ada di public/docs/");
