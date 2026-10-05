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
  // salah ketik umum: "2" nempel langsung dengan alasannya
  assert.deepEqual(parseWaCommand("2banyak yg ga bener"), {
    type: "REVISE",
    reason: "banyak yg ga bener",
  });
  // angka murni selain 2 bukan revisi
  assert.notEqual(parseWaCommand("23").type, "REVISE");
});

test("hapus: dengan dan tanpa alasan", () => {
  assert.deepEqual(parseWaCommand("hapus 3 pulang ke rumah di jam kantor"), {
    type: "DROP",
    tripNo: 3,
    reason: "pulang ke rumah di jam kantor",
  });
  assert.deepEqual(parseWaCommand("HAPUS 3"), {
    type: "DROP",
    tripNo: 3,
    reason: "",
  });
  // alias bahasa Inggris + huruf kecil
  assert.deepEqual(parseWaCommand("drop 2 lembur di rumah"), {
    type: "DROP",
    tripNo: 2,
    reason: "lembur di rumah",
  });
  // tanpa nomor trip → bantuan, bukan note
  assert.equal(parseWaCommand("hapus").type, "BAD_DROP");
  assert.equal(parseWaCommand("hapus pulang").type, "BAD_DROP");
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

// ===== Penggantian trip "tidak sesuai" (SUDAH TF / BELUM TF / NOREK) =====
// Fokus jalur uang: varian "sudah transfer" harus dikenali semua, dan
// kalimat biasa tidak boleh ikut terserap jadi perintah.

test("refund: varian SUDAH TF dikenali sebagai REFUND_CLAIM", () => {
  for (const s of ["SUDAH TF", "sudah tf", "UDAH TF", "UDAH TRANSFER", "TF", "SUDAH BAYAR", "tf bca jam 14.30"]) {
    assert.equal(parseWaCommand(s).type, "REFUND_CLAIM", `gagal pada: ${s}`);
  }
});

test("refund: keterangan setelah SUDAH TF ikut tersimpan sebagai note", () => {
  assert.deepEqual(parseWaCommand("SUDAH TF bca jam 14.30"), {
    type: "REFUND_CLAIM",
    note: "bca jam 14.30",
  });
});

test("refund: BELUM TF membatalkan klaim penggantian", () => {
  assert.equal(parseWaCommand("belum tf salah kirim").type, "REFUND_UNCLAIM");
  assert.equal(parseWaCommand("BLM TRANSFER").type, "REFUND_UNCLAIM");
});

test("refund: NOREK minta info rekening", () => {
  assert.equal(parseWaCommand("NOREK").type, "REFUND_INFO");
  assert.equal(parseWaCommand("norek dong").type, "REFUND_INFO");
});

test("refund: kalimat biasa tidak terserap jadi perintah penggantian", () => {
  assert.equal(parseWaCommand("sudah saya cek semua benar").type, "NOTE");
  assert.equal(parseWaCommand("nanti dibayarin").type, "NOTE");
  assert.equal(parseWaCommand("1").type, "APPROVE");
  assert.equal(parseWaCommand("SELESAI").type, "DONE");
});

test("info: INFO/STATUS dikenali, kalimat lain tidak", () => {
  assert.equal(parseWaCommand("INFO").type, "INFO");
  assert.equal(parseWaCommand("info").type, "INFO");
  assert.equal(parseWaCommand("STATUS").type, "INFO");
  assert.equal(parseWaCommand("info dong bulan apa").type, "NOTE");
});
