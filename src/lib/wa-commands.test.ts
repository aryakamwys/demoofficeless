// Jalankan: node --test src/lib/wa-commands.test.ts
// (Node 22.6+: node --test --experimental-strip-types src/lib/wa-commands.test.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWaCommand } from "./wa-commands.ts";

test("menu approver", () => {
  assert.deepEqual(parseWaCommand("1"), { type: "APPROVE" });
  assert.deepEqual(parseWaCommand("3"), { type: "DETAIL" });
});

test("revise: dengan dan tanpa alasan", () => {
  assert.deepEqual(parseWaCommand("2"), { type: "REVISE", reason: "" });
  assert.deepEqual(parseWaCommand("2 tiket hilang"), {
    type: "REVISE",
    reason: "tiket hilang",
  });
  // huruf besar/kecil alasan dipertahankan
  assert.deepEqual(parseWaCommand("2 Tiket HILANG"), {
    type: "REVISE",
    reason: "Tiket HILANG",
  });
});

test("ubah: format nominal", () => {
  assert.deepEqual(parseWaCommand("ubah 3 75000"), {
    type: "CHANGE",
    tripNo: 3,
    newFare: 75000,
  });
  assert.deepEqual(parseWaCommand("UBAH 3 75.000"), {
    type: "CHANGE",
    tripNo: 3,
    newFare: 75000,
  });
  assert.deepEqual(parseWaCommand("UBAH 3 75,000"), {
    type: "CHANGE",
    tripNo: 3,
    newFare: 75000,
  });
});

test("ubah: format salah jadi BAD_CHANGE, bukan note", () => {
  assert.equal(parseWaCommand("UBAH 3").type, "BAD_CHANGE");
  assert.equal(parseWaCommand("UBAH 3 abc").type, "BAD_CHANGE");
  assert.equal(parseWaCommand("UBAH 0 5000").type, "BAD_CHANGE");
  assert.equal(parseWaCommand("UBAH 3 -5000").type, "BAD_CHANGE");
  // typo nominal gila (120 juta) ditolak penjaga jalur uang
  assert.equal(parseWaCommand("UBAH 3 120000000").type, "BAD_CHANGE");
});

test("keyword revisi (case-insensitive)", () => {
  assert.equal(parseWaCommand("LIST").type, "LIST");
  assert.equal(parseWaCommand("selesai").type, "DONE");
  assert.equal(parseWaCommand("Ya").type, "CONFIRM");
  assert.equal(parseWaCommand("BATAL").type, "CANCEL");
});

test("teks bebas jadi note", () => {
  assert.deepEqual(parseWaCommand("tolong cek trip ke bandung"), {
    type: "NOTE",
    text: "tolong cek trip ke bandung",
  });
  // "21" bukan REVISE — harus jatuh ke NOTE
  assert.deepEqual(parseWaCommand("21"), { type: "NOTE", text: "21" });
});

test("ticket: variasi format id diterima", () => {
  assert.deepEqual(parseWaCommand("TICKET 3 34285"), {
    type: "TICKET",
    tripNo: 3,
    ticketId: "34285",
  });
  assert.deepEqual(parseWaCommand("ticket 3 PIM-34285"), {
    type: "TICKET",
    tripNo: 3,
    ticketId: "34285",
  });
  assert.deepEqual(parseWaCommand("TICKET 3 #PIM-34285"), {
    type: "TICKET",
    tripNo: 3,
    ticketId: "34285",
  });
});

test("ticket: format salah jadi BAD_TICKET, bukan note", () => {
  assert.equal(parseWaCommand("TICKET 3").type, "BAD_TICKET");
  assert.equal(parseWaCommand("TICKET abc 34285").type, "BAD_TICKET");
  assert.equal(parseWaCommand("TICKET 3 abc").type, "BAD_TICKET");
});

test("ticket: TICKET SEMUA memulai mode wizard", () => {
  assert.deepEqual(parseWaCommand("TICKET SEMUA"), { type: "TICKET_WIZARD" });
  assert.deepEqual(parseWaCommand("ticket semua"), { type: "TICKET_WIZARD" });
  assert.deepEqual(parseWaCommand("TICKET ALL"), { type: "TICKET_WIZARD" });
});

test("ticket: id telanjang dengan penanda #/PIM dikenali, angka biasa tetap note", () => {
  assert.deepEqual(parseWaCommand("#PIM-34285"), {
    type: "TICKET_ID",
    ticketId: "34285",
  });
  assert.deepEqual(parseWaCommand("PIM-34285"), {
    type: "TICKET_ID",
    ticketId: "34285",
  });
  assert.deepEqual(parseWaCommand("#34285"), {
    type: "TICKET_ID",
    ticketId: "34285",
  });
  // angka tanpa penanda tetap note
  assert.equal(parseWaCommand("34285").type, "NOTE");
});
