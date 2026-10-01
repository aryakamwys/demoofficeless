// Jalankan: npx tsx --test src/lib/upload-period.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { periodMonth, mismatchedDominantMonth } from "./upload-period.ts";

function tripsIn(year: number, month: number, n: number) {
  // month 1-12
  return Array.from({ length: n }, (_, i) => ({
    trip_date: new Date(Date.UTC(year, month - 1, 2 + i)).toISOString(),
  }));
}

test("periodMonth: parsing nama bulan Indonesia", () => {
  assert.deepEqual(periodMonth("Juli 2026"), { month: 7, year: 2026 });
  assert.deepEqual(periodMonth("agustus 2026"), { month: 8, year: 2026 });
  assert.equal(periodMonth("Q3 2026"), null);
  assert.equal(periodMonth(""), null);
});

test("file Juli diupload sebagai Agustus → ditolak", () => {
  const r = mismatchedDominantMonth(tripsIn(2026, 7, 20), "Agustus 2026");
  assert.equal(r?.actualMonth, "juli 2026");
  assert.equal(r?.expected, "Agustus 2026");
});

test("periode cocok → lolos", () => {
  assert.equal(mismatchedDominantMonth(tripsIn(2026, 7, 20), "Juli 2026"), null);
});

test("statement nyambung 2 bulan (mayoritas benar) → lolos", () => {
  const mixed = [...tripsIn(2026, 8, 18), ...tripsIn(2026, 7, 4)];
  assert.equal(mismatchedDominantMonth(mixed, "Agustus 2026"), null);
});

test("data terlalu sedikit → tidak dinilai", () => {
  assert.equal(mismatchedDominantMonth(tripsIn(2026, 7, 3), "Agustus 2026"), null);
});
