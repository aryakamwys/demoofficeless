// Jalankan: npx tsx --test src/lib/validations/employee.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { employeeSchema } from "./employee.ts";
import { normalizePhone } from "../phone.ts";

const base = {
  employee_name: "Test Refund",
  department: "IT",
  role: "EMPLOYEE" as const,
};

test("nomor diterima dalam berbagai format ketikan dan disimpan 62…", () => {
  for (const p of ["085110543115", "+62 851-1054-3115", "6285110543115", "62085110543115", "0085110543115"]) {
    const r = employeeSchema.safeParse({ ...base, phone_number: p });
    assert.ok(r.success, `gagal pada: ${p}`);
    assert.equal(r.success && r.data.phone_number, "6285110543115", `salah normalisasi: ${p}`);
  }
});

test("nomor lama format 08xx di data tetap bisa disimpan lewat form Edit", () => {
  const r = employeeSchema.safeParse({ ...base, phone_number: " 0812-3456 7890 " });
  assert.ok(r.success);
  assert.equal(r.success && r.data.phone_number, "6281234567890");
});

test("nomor sampah ditolak dengan pesan jelas", () => {
  for (const p of ["", "abc", "12345", "0215551234"]) {
    assert.equal(employeeSchema.safeParse({ ...base, phone_number: p }).success, false, `harus ditolak: ${p}`);
  }
});

test("normalizePhone murni: strip @lid dan tanda baca", () => {
  assert.equal(normalizePhone("6285110543115@s.whatsapp.net".replace("@s.whatsapp.net", "@lid")), "6285110543115");
  assert.equal(normalizePhone("(0812) 345-6789"), "628123456789");
  assert.equal(normalizePhone(undefined), null);
});
