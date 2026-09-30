// Jalankan: npx tsx --test src/lib/wa-match.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRole, type ClaimRow } from "./wa-match.ts";

const P = { emp: "628111", mgr: "628222", hr: "628333" };

function claim(over: Partial<ClaimRow> = {}): ClaimRow {
  return {
    id: "c1",
    period: "Agu 2026",
    status: "SENT",
    approved_at: "2026-08-05T00:00:00Z",
    manager_status: "PENDING",
    hr_status: "PENDING",
    employee: { employee_name: "Mario", phone_number: P.emp },
    manager: { phone_number: P.mgr },
    hr: { phone_number: P.hr },
    ...over,
  };
}

test("manager terdeteksi saat gilirannya", () => {
  assert.equal(matchRole(claim(), P.mgr), "MANAGER");
});

test("manager sebelum karyawan konfirmasi → belum gilirannya", () => {
  assert.equal(matchRole(claim({ approved_at: null }), P.mgr), null);
});

test("manager yang sudah approve → giliran HR", () => {
  const c = claim({ manager_status: "APPROVED" });
  assert.equal(matchRole(c, P.mgr), null);
  assert.equal(matchRole(c, P.hr), "HR");
});

test("HR sebelum manager approve → belum gilirannya", () => {
  assert.equal(matchRole(claim(), P.hr), null);
});

test("karyawan sebelum konfirmasi / saat revisi", () => {
  assert.equal(matchRole(claim({ approved_at: null }), P.emp), "EMPLOYEE");
  assert.equal(matchRole(claim({ status: "NEED_REVIEW" }), P.emp), "EMPLOYEE");
  // sudah konfirmasi & menunggu approver → tidak lagi match sebagai employee
  assert.equal(matchRole(claim(), P.emp), null);
});

test("manager yang kebetulan juga karyawan: role manager menang", () => {
  // Klaim A: nomor ini terdaftar sebagai manager, karyawannya orang lain.
  const claimA = claim({ manager: { phone_number: P.emp } });
  // Klaim B: nomor yang sama punya klaim sendiri sebagai karyawan (sudah konfirmasi).
  const claimB = claim({
    employee: { employee_name: "Kenneth", phone_number: P.emp },
  });
  assert.equal(matchRole(claimA, P.emp), "MANAGER");
  assert.equal(matchRole(claimB, P.emp), null);
  // Webhook menjalankan pas-2 (approver di semua klaim dulu) sebelum pas
  // karyawan, jadi klaim A menang meskipun klaim B lebih baru — inilah
  // perbaikan untuk "balasan manager tidak terdeteksi".
});

test("nomor asing → null", () => {
  assert.equal(matchRole(claim(), "628999"), null);
  assert.equal(matchRole(claim({ employee: null, manager: null, hr: null }), P.emp), null);
});
