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
  | { type: "CONFIRM" }
  | { type: "CANCEL" }
  | { type: "DONE" }
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

export function parseWaCommand(raw: string): WaCommand {
  const input = raw.trim();

  if (input === "") return { type: "NOTE", text: input };
  if (input === "1") return { type: "APPROVE" };
  if (input === "3") return { type: "DETAIL" };

  // "2" atau "2 <alasan>" — alasan dipertahankan apa adanya (huruf besar/kecil)
  if (/^2(\s|$)/.test(input)) {
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

  return { type: "NOTE", text: input };
}
