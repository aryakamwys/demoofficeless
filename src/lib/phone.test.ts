// Jalankan: node --test src/lib/phone.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone } from "./whatsapp.ts";

test("normalisasi nomor: 0 / 62 / +62 / double-prefix / aneh-aneh", () => {
  assert.equal(normalizePhone("081234567890"), "6281234567890");
  assert.equal(normalizePhone("6281234567890"), "6281234567890");
  assert.equal(normalizePhone("+6281234567890"), "6281234567890");
  assert.equal(normalizePhone("6208123456789"), "628123456789"); // double prefix 62+08xx
  assert.equal(normalizePhone("008123456789"), "628123456789"); // double zero
  assert.equal(normalizePhone("0812-3456 (789)"), "628123456789");
  assert.equal(normalizePhone(" 6281234567890 "), "6281234567890");
  assert.equal(normalizePhone("6281234567890@lid"), "6281234567890");
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone(null), null);
});
