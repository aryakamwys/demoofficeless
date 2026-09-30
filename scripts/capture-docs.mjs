// scripts/capture-docs.mjs — screenshot halaman app untuk dokumentasi /docs.
// Membuka Chrome (visible), Anda login manual sekali, lalu semua halaman
// di-screenshot otomatis ke public/docs/.
// Pakai: node scripts/capture-docs.mjs [halaman...]  (dev server harus jalan di :3000)
// Argumen opsional = nama halaman yang di-capture ulang, mis: node scripts/capture-docs.mjs claims
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.DOCS_BASE_URL || "http://localhost:3000";
// Jika DOCS_EMAIL & DOCS_PASS di-set, login otomatis (headless) — tanpa itu, login manual di jendela browser.
const AUTO = Boolean(process.env.DOCS_EMAIL && process.env.DOCS_PASS);

const pages = [
  ["dashboard", "/dashboard"],
  ["employees", "/employees"],
  ["upload", "/upload"],
  ["claims", "/claims"],
  ["openclaw", "/services/openclaw"],
  ["inventory", "/inventory"],
];

const only = process.argv.slice(2);
const targets = only.length ? pages.filter(([n]) => only.includes(n)) : pages;

mkdirSync("public/docs", { recursive: true });

const browser = await chromium.launch({ headless: AUTO });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`);
if (AUTO) {
  console.log(">> Login otomatis...");
  await page.fill("#email", process.env.DOCS_EMAIL);
  await page.fill("#password", process.env.DOCS_PASS);
  await page.click("button[type=submit]");
} else {
  console.log(">> Login di jendela browser yang terbuka (timeout 5 menit)...");
}

await page.waitForURL("**/dashboard", { timeout: 300000 });
console.log(">> Login terdeteksi, mulai screenshot...");
await page.waitForTimeout(2000);

for (const [name, path] of targets) {
  let ok = false;
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    const res = await page
      .goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 })
      .catch(() => null);
    await page.waitForTimeout(2500);
    // Cloudflare pernah menyajikan halaman 502 yang di-cache — cek status + isi halaman
    const badGateway =
      !res || res.status() >= 400 || /bad gateway|error code 5\d\d/i.test(await page.title().catch(() => "") + " " + (await page.locator("body").innerText().catch(() => "")));
    if (badGateway) {
      console.log(`retry ${attempt}/3 (${name}): status ${res ? res.status() : "ERR"}`);
      await page.waitForTimeout(5000);
      continue;
    }
    await page.screenshot({ path: `public/docs/${name}.png`, fullPage: true });
    console.log("ok:", name);
    ok = true;
  }
  if (!ok) console.log(`GAGAL: ${name} tetap error setelah 3x percobaan`);
}

await browser.close();
console.log(">> Selesai. Screenshot ada di public/docs/");
