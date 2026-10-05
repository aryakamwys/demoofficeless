// ============================================================
// Parser command WhatsApp untuk flow revisi klaim
// Pure function tanpa dependency — bisa dites langsung via node:test
// ============================================================

export type WaCommand =
  | { type: "APPROVE" }
  | { type: "REVISE"; reason: string }
  | { type: "DETAIL" }
  | { type: "LIST" }
  | { type: "CHANGE"; tripNo: number; newFare: number }
  | { type: "BAD_CHANGE" }
  | { type: "DROP"; tripNo: number; reason: string }
  | { type: "BAD_DROP" }
  | { type: "CONFIRM" }
  | { type: "CANCEL" }
  | { type: "DONE" }
  | { type: "TICKET"; tripNo: number; ticketId: string }
  | { type: "TICKET_ID"; ticketId: string }
  | { type: "TICKET_WIZARD" }
  | { type: "BAD_TICKET" }
  | { type: "REFUND_CLAIM"; note: string }
  | { type: "REFUND_UNCLAIM" }
  | { type: "REFUND_INFO" }
  | { type: "NOTE"; text: string };

// Batas wajar nominal trip (Rp100 juta) — penjaga typo di jalur uang
const MAX_FARE = 100_000_000;

function parseFare(raw: string): number | null {
  // Terima "75000", "75.000", "75,000" — buang pemisah ribuan
  const cleaned = raw.replace(/[.,\s]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n > 0 && n <= MAX_FARE ? n : null;
}

/** "34285", "PIM-34285", "#PIM-34285", "# 34285" → "34285" */
function parseTicketRef(raw: string): string | null {
  const m = raw.trim().match(/^#?\s*(?:pim\s*[-:]?\s*)?(\d{2,10})$/i);
  return m ? m[1] : null;
}

export function parseWaCommand(raw: string): WaCommand {
  const input = raw.trim();

  if (input === "") return { type: "NOTE", text: input };
  if (input === "1") return { type: "APPROVE" };
  if (input === "3") return { type: "DETAIL" };

  // "2", "2 <alasan>", atau "2alasan" ( Salah ketik umum: angka nempel kata.
  // Angka murni selain 2 (mis. "23") tetap ditolak — bukan revisi.
  if (/^2(?=\D|$)/.test(input)) {
    return { type: "REVISE", reason: input.slice(1).trim() };
  }

  const upper = input.toUpperCase();
  if (upper === "LIST") return { type: "LIST" };
  if (upper === "SELESAI") return { type: "DONE" };
  if (upper === "YA") return { type: "CONFIRM" };
  if (upper === "BATAL") return { type: "CANCEL" };

  // "UBAH ..." — format salah tetap dikenali sebagai percobaan command,
  // bukan note, supaya bisa dibalas dengan pesan bantuan
  if (/^UBAH(\s|$)/.test(upper)) {
    const parts = input.split(/\s+/);
    const tripNo = Number(parts[1]);
    const fare = parts[2] ? parseFare(parts[2]) : null;
    if (Number.isInteger(tripNo) && tripNo > 0 && fare) {
      return { type: "CHANGE", tripNo, newFare: fare };
    }
    return { type: "BAD_CHANGE" };
  }

  // "HAPUS 3 pulang ke rumah di jam kantor" — hapus trip dari klaim.
  // Alasan opsional di parser; flow yang meminta alasannya jika kosong.
  if (/^(HAPUS|DROP)(\s|$)/.test(upper)) {
    const m = input.match(/^\S+\s+(\d{1,3})\b\s*(.*)$/i);
    if (m && Number(m[1]) > 0) {
      return { type: "DROP", tripNo: Number(m[1]), reason: (m[2] || "").trim() };
    }
    return { type: "BAD_DROP" };
  }

  // "TICKET 3 PIM-34285" — pasang bukti ticket EnvGate pada trip no 3
  if (/^TICKET(\s|$)/.test(upper)) {
    // "TICKET SEMUA" — mode isi satu-per-satu (wizard)
    if (/^TICKET\s+(SEMUA|ALL)$/.test(upper)) {
      return { type: "TICKET_WIZARD" };
    }
    const parts = input.split(/\s+/);
    const tripNo = Number(parts[1]);
    const ticketId = parts[2] ? parseTicketRef(parts.slice(2).join(" ")) : null;
    if (Number.isInteger(tripNo) && tripNo > 0 && ticketId) {
      return { type: "TICKET", tripNo, ticketId };
    }
    return { type: "BAD_TICKET" };
  }

  // "#PIM-34285" tanpa nomor trip — hanya kalau ada penanda #/PIM
  // (angka biasa seperti "21" tetap NOTE, bukan ticket)
  if (/^(?:#?\s*pim\s*[-:]?\s*\d{2,10}|#\s*\d{2,10})$/i.test(input)) {
    return { type: "TICKET_ID", ticketId: parseTicketRef(input)! };
  }

  // Penggantian trip "tidak sesuai" (jalur uang — wajib command tegas):
  // "SUDAH TF", "UDAH TRANSFER", "TF bca jam 14.30", "SUDAH BAYAR", "BELUM TF", "NOREK"
  if (/^(?:(?:sudah|udah|udh|dah)\s+)?(?:tf|tfr|transfer|bayar)(?:\s|$)/i.test(input)) {
    const note = input
      .replace(/^\s*(?:(?:sudah|udah|udh|dah)\s+)?(?:tf|tfr|transfer|bayar)\s*/i, "")
      .trim();
    return { type: "REFUND_CLAIM", note };
  }
  if (/^(?:belum|blm)\s+(?:tf|tfr|transfer|bayar|sudah)/i.test(input)) {
    return { type: "REFUND_UNCLAIM" };
  }
  if (/^NOREK\b/i.test(input)) {
    return { type: "REFUND_INFO" };
  }

  return { type: "NOTE", text: input };
}
