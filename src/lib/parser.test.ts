// Cek peta nama bulan parser PDF statement Grab — bug riil: bulan tak
// dikenal (mis. "May") diam-diam jadi Januari sehingga statement Mei
// ditolak validasi periode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { monthNameToNumber } from "./parser";

test("monthNameToNumber: bulan Indonesia", () => {
  assert.equal(monthNameToNumber("Mei"), "05");
  assert.equal(monthNameToNumber("Juli"), "07");
  assert.equal(monthNameToNumber("januari"), "01");
  assert.equal(monthNameToNumber("OKT"), "10");
});

test("monthNameToNumber: bulan Inggris (statement Grab kadang pakai ini)", () => {
  assert.equal(monthNameToNumber("May"), "05");
  assert.equal(monthNameToNumber("August"), "08");
  assert.equal(monthNameToNumber("december"), "12");
});

test("monthNameToNumber: tak dikenal harus null — bukan Januari", () => {
  assert.equal(monthNameToNumber("Zzz"), null);
  assert.equal(monthNameToNumber(""), null);
});
