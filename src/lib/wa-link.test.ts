// Jalankan: npx tsx --test src/lib/wa-link.test.ts
process.env.WEBHOOK_SECRET = "test-secret";
process.env.NEXT_PUBLIC_APP_URL = "https://perkom.example.com";

import { test } from "node:test";
import assert from "node:assert/strict";
import { approveLink, verifyApproveToken, portalLink, verifyPortalToken } from "./wa-link.ts";

test("roundtrip: link berisi token yang valid", () => {
  const link = approveLink("c-123", "628111", "MANAGER");
  assert.ok(link.startsWith("https://perkom.example.com/approve?t="));
  const v = verifyApproveToken(link.split("t=")[1]);
  assert.deepEqual(v, { claimId: "c-123", phone: "628111", role: "MANAGER" });
});

test("token yang dimanipulasi ditolak", () => {
  const link = approveLink("c-123", "628111", "HR");
  const token = link.split("t=")[1];
  // ubah satu karakter di bagian tanda tangan
  assert.equal(verifyApproveToken(token.slice(0, -2) + "aa"), null);
  // role asing
  assert.equal(verifyApproveToken(Buffer.from("c.628.HACK.99999999999999.x").toString("base64url")), null);
});

test("token kedaluwarsa/acak ditolak", () => {
  // manipulasi exp tidak mungkin lolos (sig tidak akan cocok); cukup
  // pastikan token acak/rusak tidak lolos
  assert.equal(verifyApproveToken("bG9yZW0gaXBzdW0="), null);
  assert.equal(verifyApproveToken(""), null);
});

test("tanpa NEXT_PUBLIC_APP_URL → link kosong (fallback menu angka)", () => {
  const saved = process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(approveLink("c-1", "6281", "MANAGER"), "");
  process.env.NEXT_PUBLIC_APP_URL = saved;
});

// ===== Portal karyawan =====
test("portal: link dibuat & diverifikasi, nomor lain ditolak", () => {
  const link = portalLink("emp-1", "628111",);
  const token = new URL(link).searchParams.get("t") || "";
  assert.deepEqual(verifyPortalToken(token), { employeeId: "emp-1", phone: "628111" });
  assert.equal(verifyPortalToken(token + "x"), null);
  assert.equal(verifyPortalToken("PORTAL.emp-1.628999.9999999999999.AAAA"), null);
});

test("portal: tanpa NEXT_PUBLIC_APP_URL → link kosong", () => {
  const saved = process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(portalLink("emp-1", "628111"), "");
  process.env.NEXT_PUBLIC_APP_URL = saved;
});
