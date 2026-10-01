// Token tautan aksi klaim ("teken tombol") — dipakai di halaman /approve.
//
// Tautan dikirim lewat pesan WA dan menggantikan proses login: siapa pun
// yang memegang tautan yang valid bisa bertindak sebagai role tersebut di
// klaim tersebut (mirip magic link). Keamanannya:
//  - HMAC-SHA256 dengan WEBHOOK_SECRET (ada di env produksi) — tidak bisa
//    dipalsukan dari luar
//  - kedaluwarsa 7 hari
//  - saat dipakai, role/telepon dicek ulang ke kondisi klaim terkini
//    (matchRole) — tautan lama tidak bisa meng-approve klaim yang tahapnya
//    sudah lewat
import { createHmac, timingSafeEqual } from "crypto";
import type { WaRole } from "./wa-match";

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret(): string {
  return process.env.WEBHOOK_SECRET || "dev-only-insecure-secret";
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
}

/** Buat tautan tombol untuk satu klaim + nomor + role. Kosong jika APP_URL belum diset. */
export function approveLink(claimId: string, phone: string, role: WaRole): string {
  const base = appUrl();
  if (!base) return "";
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${claimId}.${phone}.${role}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  const token = Buffer.from(`${payload}.${sig}`).toString("base64url");
  return `${base}/approve?t=${token}`;
}

/** Verifikasi tautan — null jika rusak/kedaluwarsa/dimanipulasi. */
export function verifyApproveToken(
  token: string
): { claimId: string; phone: string; role: WaRole } | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parts = raw.split(".");
    if (parts.length !== 5) return null;
    const [claimId, phone, role, exp, sig] = parts;
    if (!claimId || !phone || !role || !exp || !sig) return null;
    if (!Number(exp) || Number(exp) < Date.now()) return null;
    const expected = createHmac("sha256", secret())
      .update(`${claimId}.${phone}.${role}.${exp}`)
      .digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (role !== "HR" && role !== "MANAGER" && role !== "EMPLOYEE") return null;
    return { claimId, phone, role };
  } catch {
    return null;
  }
}
