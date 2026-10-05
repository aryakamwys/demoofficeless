// ============================================================
// Kirimi WhatsApp API Integration
// https://api.kirimi.id
// ============================================================

const KIRIMI_BASE_URL = "https://api.kirimi.id";

interface KirimiConfig {
  user_code: string;
  secret: string;
  device_id: string;
}

function getConfig(): KirimiConfig {
  return {
    user_code: process.env.KIRIMI_USER_CODE || "",
    secret: process.env.KIRIMI_SECRET || "",
    device_id: process.env.KIRIMI_DEVICE_ID || "",
  };
}

interface SendTextResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Normalisasi nomor ke format Kirimi (6281234567890) — implementasi pindah
 * ke lib/phone.ts supaya bisa dipakai form/validation tanpa menyeret modul
 * integrasi WA. Re-export menjaga import lama tetap jalan.
 */
export { normalizePhone } from "./phone";
import { normalizePhone } from "./phone";

/**
 * Send a text message via Kirimi API.
 */
export async function sendTextMessage(
  receiver: string,
  message: string,
  options?: { delayMs?: number; maxRetries?: number; clientMsgId?: string }
): Promise<SendTextResponse> {
  const config = getConfig();
  const maxRetries = options?.maxRetries ?? 3;

  // Idempotency (docs Kirimi): retry dengan clientMsgId yang sama tidak akan
  // pernah dobel-kirim (diingat 24 jam per device di sisi Kirimi)
  const clientMsgId = options?.clientMsgId || crypto.randomUUID();

  // Kirimi requires receiver format 628xxx — normalize at the root so that all callers are safe
  const normalized = normalizePhone(receiver) || receiver;

  // Jeda acak 2-5 detik antar pesan — jeda tetap & pendek dari device QR
  // adalah pemicu pembatasan paling sering (docs Kirimi: catatan praktis);
  // tetap acak dan tidak rapat, tapi respons terasa lebih cepat
  const delayMs = options?.delayMs ?? 2000 + Math.floor(Math.random() * 3000);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${KIRIMI_BASE_URL}/v1/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_code: config.user_code,
          secret: config.secret,
          device_id: config.device_id,
          receiver: normalized,
          message,
          clientMsgId,
        }),
      });

      const data = await res.json();
      const success = res.ok && data.success !== false;

      if (success) {
        return { success: true, message: data.message };
      }

      lastError = data.error || data.message || `HTTP ${res.status}`;

      // Device terputus — retry tidak akan menolong, gagal cepat
      // (docs: hentikan bila pengiriman gagal karena perangkat terputus)
      if (/disconnect/i.test(String(lastError))) {
        console.error(`[WA] Device disconnected — stop retry for ${normalized}`);
        break;
      }

      console.warn(`[WA] Send attempt ${attempt}/${maxRetries} failed for ${normalized}: ${lastError}`);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
      console.warn(`[WA] Send attempt ${attempt}/${maxRetries} error for ${normalized}: ${lastError}`);
    }

    // Backoff sebelum retry. WA_RATE_LIMITED butuh jeda panjang (throttle
    // device bisa bertahan menit) — 15s lalu 30s, total masih < maxDuration 60.
    if (attempt < maxRetries) {
      const isRateLimited = lastError?.toUpperCase().includes("RATE_LIMIT");
      const backoffMs = isRateLimited
        ? 15000 * attempt
        : 1000 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  console.error(`[WA] All ${maxRetries} attempts failed for ${normalized}: ${lastError}`);
  return { success: false, error: lastError };
}

/**
 * Pesan-pesan WA ditulis untuk pembaca awam: bahasa simpel, setiap opsi
 * dijelaskan apa yang terjadi + contoh, dan selalu ada umpan balik jelas.
 * (Hasil test user pertama: menu 1/2/3 tanpa penjelasan bikin bingung.)
 */

type WaTripLine = {
  trip_date: string;
  pickup: string;
  dropoff: string;
  fare: number;
  cost_code?: string;
  ticket_id?: string | null;
};

/** Ringkas alamat supaya pesan ringkasan mudah dibaca (alamat lengkap ada di DETAIL). */
function shortAddr(s: string, max = 32): string {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max).replace(/\s+\S*$/, "") + "...";
}

/** "PIM-34285"/"#34285"/"34285" → "#PIM-34285" untuk ditampilkan di pesan. */
function ticketChip(ticketId?: string | null): string {
  if (!ticketId) return "";
  const digits = String(ticketId).replace(/^#?\s*(?:pim\s*[-:]?\s*)?/i, "");
  return digits ? ` [#PIM-${digits}]` : "";
}

function tripLine(t: WaTripLine, full: boolean, no?: number): string {
  const addr = (s: string) => (full ? (s || "").trim() : shortAddr(s));
  const costCode = t.cost_code ? ` [Code: ${t.cost_code}]` : "";
  // Bernomor (1., 2., …) supaya sama dengan daftar LIST — angka trip di
  // perintah UBAH/HAPUS/TICKET langsung nyambung dengan pesan ini.
  const prefix = no != null ? `${no}. ` : "- ";
  return `${prefix}${formatTripDate(t.trip_date)}: ${addr(t.pickup)} -> ${addr(t.dropoff)} (${formatAmount(t.fare)})${costCode}${ticketChip(t.ticket_id)}`;
}

/** Menu karyawan — selalu dengan penjelasan + contoh. */
function employeeMenuLines(): string[] {
  return [
    "CARA MEMBALAS (ketik nomornya saja):",
    "1 = SETUJU - semua data benar, langsung diteruskan ke Manager",
    "2 = ADA YANG SALAH - ceritakan apa yang salah",
    "3 = LIHAT DETAIL - alamat lengkap tiap perjalanan",
    "",
    "Contoh: ketik 1 lalu kirim.",
  ];
}

/** Menu approver (Manager/HR) — `next` = kalimat lanjutan setelah SETUJU. */
function approverMenuLines(next: string): string[] {
  return [
    "KEPUTUSAN ANDA (ketik nomornya):",
    `1 = SETUJU - ${next}`,
    "2 = MINTA REVISI - ketik 2 lalu tulis alasannya",
    "   Contoh: 2 nominal trip 3 masih kurang tepat",
  ];
}

/** Baris tautan tombol — hanya muncul jika NEXT_PUBLIC_APP_URL diset. */
function tapLines(actionUrl: string, label = "untuk setuju / koreksi"): string[] {
  return [
    `Tanpa mengetik juga bisa — ketuk link ini ${label}, tinggal tekan tombolnya:`,
    actionUrl,
    ``,
  ];
}

/**
 * Build the claim notification message.
 */
export function buildClaimMessage(params: {
  employee_name: string;
  period: string;
  trip_count: number;
  total_amount: number;
  trips: WaTripLine[];
  action_url?: string;
}): string {
  const { employee_name, period, trip_count, total_amount, trips } = params;
  return [
    `Halo ${employee_name},`,
    ``,
    `Ini rangkuman klaim Grab Business Anda periode ${period}.`,
    `Mohon dicek dulu sebelum disetujui:`,
    ``,
    ...trips.map((t, i) => tripLine(t, false, i + 1)),
    ``,
    `Jumlah perjalanan: ${trip_count}`,
    `Total biaya: ${formatAmount(total_amount)}`,
    ``,
    `Punya ticket EnvGate untuk pekerjaan di trip ini? Lampirkan dengan:`,
    `TICKET <no trip> <id ticket> - contoh: TICKET 3 PIM-34285`,
    `(atau TICKET SEMUA - diarahkan isi satu per satu untuk semua trip)`,
    ``,
    ...(params.action_url ? tapLines(params.action_url) : []),
    ...employeeMenuLines(),
  ].join("\n");
}

/**
 * Build the trip detail message (alamat lengkap).
 */
export function buildDetailMessage(
  trips: WaTripLine[],
  total_amount: number
): string {
  return [
    `DETAIL PERJALANAN (alamat lengkap):`,
    ``,
    ...trips.map((t, i) => tripLine(t, true, i + 1)),
    ``,
    `Total biaya: ${formatAmount(total_amount)}`,
    ``,
    ...employeeMenuLines(),
  ].join("\n");
}

/**
 * Build the confirmation message (after employee replies "1").
 */
export function buildConfirmationMessage(managerName?: string, period?: string): string {
  const p = period ? ` periode ${period}` : "";
  return [
    `TERIMA KASIH. Data klaim Anda${p} sudah SETUJU.`,
    ``,
    managerName
      ? `Sekarang menunggu persetujuan Manager Anda (${managerName}).`
      : `Klaim sedang diproses lebih lanjut.`,
    ``,
    `Anda tidak perlu membalas pesan ini lagi.`,
  ].join("\n");
}

export function buildCorrectionPrompt(): string {
  return [
    `Baik, ada yang salah. Tolong tulis masalahnya dalam SATU pesan saja.`,
    ``,
    `Contoh balasan:`,
    `- trip 10 Juli bukan perjalanan saya`,
    `- nominal trip no 2 seharusnya Rp50.000`,
    ``,
    `Tulisan Anda akan menjadi catatan untuk HR.`,
    ``,
    `Kalau ternyata semua sudah benar, ketik: 1`,
    `Ingin lihat detail dulu, ketik: 3`,
  ].join("\n");
}

/** Balasan untuk teks yang tidak dikenali — ulangi menu dengan santun. */
export function buildEmployeeHelpMessage(): string {
  return [
    `Maaf, pesan Anda belum saya mengerti.`,
    ``,
    ...employeeMenuLines(),
  ].join("\n");
}

/**
 * Build the manager approval message.
 */
export function buildManagerApprovalMessage(params: {
  employee_name: string;
  period: string;
  total_amount: number;
  revised?: boolean;
  trips: WaTripLine[];
  action_url?: string;
}): string {
  const { employee_name, period, total_amount, trips } = params;
  return [
    `Halo Manager,`,
    ``,
    `${employee_name} mengajukan klaim Grab periode ${period}.`,
    `Karyawan tersebut SUDAH mengecek dan menyetujui datanya sendiri.`,
    ``,
    ...trips.map((t, i) => tripLine(t, false, i + 1)),
    ``,
    `Jumlah perjalanan: ${trips.length}`,
    `Total biaya: ${formatAmount(total_amount)}`,
    ``,
    ...(params.revised
      ? [`Catatan: klaim ini pernah direvisi oleh karyawan.`, ``]
      : []),
    ...(params.action_url ? tapLines(params.action_url, "untuk memutuskan") : []),
    ...approverMenuLines("klaim diteruskan ke HR"),
  ].join("\n");
}

/**
 * Build the HR approval message.
 */
export function buildHrApprovalMessage(params: {
  employee_name: string;
  manager_name: string;
  period: string;
  total_amount: number;
  revised?: boolean;
  trips: WaTripLine[];
  action_url?: string;
}): string {
  const { employee_name, manager_name, period, total_amount, trips } = params;
  return [
    `Halo HR,`,
    ``,
    `${employee_name} mengajukan klaim Grab periode ${period}.`,
    `Managernya (${manager_name}) SUDAH menyetujui — Anda pemberi persetujuan terakhir.`,
    ``,
    ...trips.map((t, i) => tripLine(t, false, i + 1)),
    ``,
    `Jumlah perjalanan: ${trips.length}`,
    `Total biaya: ${formatAmount(total_amount)}`,
    ``,
    ...(params.revised
      ? [`Catatan: klaim ini pernah direvisi oleh karyawan.`, ``]
      : []),
    ...(params.action_url ? tapLines(params.action_url, "untuk memutuskan") : []),
    ...approverMenuLines("klaim selesai disetujui"),
  ].join("\n");
}

/**
 * Build the Employee Notification message (Status Update).
 */
export function buildEmployeeStatusUpdateMessage(status: string, actorName: string, role: 'MANAGER' | 'HR', period?: string): string {
  const p = period ? ` periode ${period}` : "";
  let msg = `Status klaim Anda${p}: ${status}`;
  if (status === 'APPROVED') {
    msg = `KABAR BAIK: klaim Anda${p} sudah disetujui Manager (${actorName}). Sekarang menunggu persetujuan HR.`;
  } else if (status === 'REJECTED') {
    msg = `Mohon maaf, klaim Anda${p} ditolak oleh ${role} (${actorName}). Hubungi HR untuk info lebih lanjut.`;
  } else if (status === 'FINALIZED') {
    msg = `SELESAI: klaim Anda${p} sudah disetujui penuh oleh Manager dan HR (${actorName}). Terima kasih.`;
  }

  return [
    msg
  ].join("\n");
}

/** Umpan balik setelah catatan karyawan/notes tersimpan — tester harus LIHAT kalau catatannya masuk. */
export function buildNoteSavedMessage(text: string, nextHint: string): string {
  return [
    `SUDAH TERSIMPAN. Catatan Anda:`,
    `"${text.slice(0, 300)}"`,
    ``,
    nextHint,
  ].join("\n");
}

// ============================================================
// Revision flow — klaim dikembalikan ke engineer via chat
// ============================================================

function formatAmount(n: number | string): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  return `Rp${num.toLocaleString("id-ID")}`;
}

// ============================================================
// Penggantian trip "tidak sesuai" — karyawan transfer biaya trip
// ke rekening kantor, HR konfirmasi uang masuk, trip keluar klaim.
// ============================================================

export interface CompanyBank {
  bank_name: string;
  account_number: string;
  account_name?: string;
}

function bankLines(bank: CompanyBank): string[] {
  return [
    `Transfer ke rekening kantor:`,
    `Bank: ${bank.bank_name}`,
    `No. rekening: ${bank.account_number}`,
    ...(bank.account_name ? [`Atas nama: ${bank.account_name}`] : []),
  ];
}

/** HR menandai trip tidak sesuai → karyawan diminta mengganti uangnya. */
export function buildRefundRequestMessage(params: {
  employee_name: string;
  period: string;
  trip_no: number;
  trip: WaTripLine;
  amount: number;
  reason: string;
  bank: CompanyBank;
}): string {
  const t = params.trip;
  return [
    `Halo ${params.employee_name},`,
    ``,
    `Trip no ${params.trip_no} di klaim periode ${params.period} ditandai TIDAK SESUAI oleh HR.`,
    `- ${formatTripDate(t.trip_date)}: ${t.pickup} -> ${t.dropoff} (${formatAmount(t.fare)})`,
    `Alasan: ${params.reason}`,
    ``,
    `Biaya trip ini perlu Anda GANTI sebesar ${formatAmount(params.amount)}.`,
    ``,
    ...bankLines(params.bank),
    ``,
    `Setelah transfer, balas pesan ini: SUDAH TF`,
    `(boleh ditambah keterangan — contoh: SUDAH TF bca jam 14.30)`,
    ``,
    `Setelah uangnya dicek HR, trip ini otomatis keluar dari klaim Anda.`,
    `Mau tanya-tanya dulu? Balas saja — pesan Anda jadi catatan untuk HR.`,
  ].join("\n");
}

/** Info nominal + rekening kantor (perintah NOREK / kirim ulang dari web). */
export function buildRefundInfoMessage(params: {
  period: string;
  refunds: { trip_no: number; amount: number; status: string }[];
  bank: CompanyBank | null;
}): string {
  const total = params.refunds.reduce((a, r) => a + Number(r.amount), 0);
  return [
    `INFO PENGGANTIAN — klaim periode ${params.period}:`,
    ...params.refunds.map(
      (r) =>
        `- Trip no ${r.trip_no}: ${formatAmount(r.amount)} ${
          r.status === "CLAIMED" ? "(sudah Anda transfer — menunggu cek HR)" : "(belum transfer)"
        }`
    ),
    ``,
    `Total yang harus diganti: ${formatAmount(total)}`,
    ``,
    ...(params.bank ? bankLines(params.bank) : [`Rekening kantor belum diisi HR — hubungi HR Perkom.`]),
    ``,
    `Sudah transfer? Balas: SUDAH TF`,
  ].join("\n");
}

/** Karyawan menyatakan sudah transfer → menunggu pencocokan HR. */
export function buildRefundClaimedMessage(total: number, count: number): string {
  return [
    `TERCATAT. Anda menyatakan sudah transfer ${formatAmount(total)} untuk ${count} trip penggantian.`,
    `HR akan mencocokkannya dengan mutasi rekening kantor.`,
    `Setelah cocok, trip-nya keluar dari klaim dan Anda dikabari lagi.`,
  ].join("\n");
}

/** Notifikasi ke HR: karyawan menyatakan sudah transfer — cek mutasi. */
export function buildRefundClaimedHrMessage(params: {
  employee_name: string;
  period: string;
  total: number;
  trip_nos: number[];
  note?: string | null;
}): string {
  return [
    `INFO PENGGANTIAN: ${params.employee_name} menyatakan SUDAH TRANSFER ${formatAmount(params.total)}`,
    `(trip no ${params.trip_nos.join(", ")} — klaim periode ${params.period}).`,
    params.note ? `Keterangan karyawan: ${params.note}` : ``,
    ``,
    `Cocokkan mutasi rekening kantor, lalu buka detail klaim dan tekan`,
    `"Pembayaran diterima" agar trip keluar dari klaim.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** HR konfirmasi uang masuk → trip keluar dari klaim, total baru. */
export function buildRefundConfirmedMessage(params: {
  employee_name: string;
  period: string;
  trip_no: number;
  amount: number;
  new_total: number;
}): string {
  return [
    `TERIMA KASIH ${params.employee_name}. Penggantian ${formatAmount(params.amount)} sudah DITERIMA HR.`,
    `Trip no ${params.trip_no} keluar dari klaim periode ${params.period}.`,
    `Total klaim sekarang: ${formatAmount(params.new_total)}`,
  ].join("\n");
}

/** Uang belum ditemukan di mutasi → minta karyawan cek/ulang transfer. */
export function buildRefundAskAgainMessage(amount: number): string {
  return [
    `HR belum menemukan transferan ${formatAmount(amount)} di mutasi rekening kantor.`,
    `Mohon cek kembali (nominal/nama bank/tujuan), atau ulangi transfer,`,
    `lalu balas lagi: SUDAH TF`,
  ].join("\n");
}

/** Karyawan membatalkan pernyataan sudah transfer (salah kirim). */
export function buildRefundUnclaimedMessage(): string {
  return [
    `Baik — status penggantian dikembalikan ke MENUNGGU transfer.`,
    `Kalau nanti sudah transfer, balas lagi: SUDAH TF`,
  ].join("\n");
}

/** HR membatalkan tanda "tidak sesuai" — tidak perlu penggantian lagi. */
export function buildRefundCancelledMessage(trip_no: number, period: string): string {
  return [
    `Kabar baik: tanda "tidak sesuai" pada trip no ${trip_no} dihapus oleh HR.`,
    `Trip tetap berada di klaim periode ${period} — tidak perlu penggantian.`,
  ].join("\n");
}

function formatTripDate(dateStr: string): string {
  const date = new Date(dateStr);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const day = date.getDate().toString().padStart(2, "0");
  const base = `${day} ${monthNames[date.getMonth()]}`;
  // Jam ditampilkan kalau ada (00:00 = data tanpa jam) — penting untuk
  // menilai trip pulang/berangkat di luar jam kerja.
  const hm = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  return hm === "00:00" ? base : `${base} ${hm}`;
}

/**
 * Notifikasi ke engineer: klaim diminta revisi oleh Manager/HR.
 */
export function buildRevisionRequestMessage(params: {
  employee_name: string;
  period: string;
  requester_name: string;
  requester_role: "MANAGER" | "HR";
  reason: string;
}): string {
  const roleLabel = params.requester_role === "MANAGER" ? "Manager" : "HR";
  return [
    `Halo ${params.employee_name},`,
    ``,
    `Klaim periode ${params.period} DIMINTA REVISI oleh ${roleLabel} (${params.requester_name}).`,
    `Alasan: ${params.reason || "tidak disertakan"}`,
    ``,
    `CARA REVISI LEWAT WHATSAPP INI (langkah demi langkah):`,
    `1. Ketik LIST - untuk melihat daftar trip bernomor`,
    `2. Ketik UBAH <nomor trip> <nominal baru> - contoh: UBAH 3 75000`,
    `   (artinya: ubah trip no 3 jadi Rp75.000)`,
    `3. Ketik TICKET <nomor trip> <id ticket> - contoh: TICKET 3 PIM-34285`,
    `   (melampirkan bukti ticket EnvGate ke trip no 3)`,
    `   Banyak trip? Ketik TICKET SEMUA - diarahkan satu per satu.`,
    `4. Ketik HAPUS <nomor trip> <alasan> - hapus trip yang tidak boleh`,
    `   diklaim. Contoh: HAPUS 3 pulang ke rumah di jam kantor`,
    `5. Ketik SELESAI - klaim dikirim ulang ke ${roleLabel}`,
    ``,
    `Bisa juga tulis catatan untuk ${roleLabel} — langsung balas pesan ini.`,
  ].join("\n");
}

/**
 * Daftar trip bernomor untuk command LIST / UBAH.
 */
export function buildRevisionTripListMessage(
  trips: WaTripLine[],
  total_amount: number,
  period: string
): string {
  const lines = trips.map((t, i) => {
    const costCode = t.cost_code ? ` [Code: ${t.cost_code}]` : "";
    return `${i + 1}. ${formatTripDate(t.trip_date)}: ${t.pickup} -> ${t.dropoff} (${formatAmount(t.fare)})${costCode}${ticketChip(t.ticket_id)}`;
  });
  return [
    `Daftar Trip klaim periode ${period}:`,
    ...lines,
    ``,
    `Total: ${formatAmount(total_amount)}`,
    ``,
    `Balas:`,
    `UBAH <no> <nominal> - ubah nominal, contoh: UBAH 3 75000`,
    `HAPUS <no> <alasan> - hapus trip, contoh: HAPUS 3 pulang ke rumah di jam kantor`,
    `TICKET <no> <id> - lampirkan bukti ticket, contoh: TICKET 3 PIM-34285`,
    `TICKET SEMUA - isi ticket satu per satu untuk semua trip`,
    `SELESAI - sudah selesai, kirim ulang ke approver`,
  ].join("\n");
}

/**
 * Konfirmasi sebelum nominal diubah (jalur uang — wajib YA/BATAL).
 */
export function buildChangeConfirmMessage(
  trip: WaTripLine,
  tripNo: number,
  oldFare: number,
  newFare: number
): string {
  return [
    `KONFIRMASI UBAH NOMINAL - trip no ${tripNo}`,
    `${formatTripDate(trip.trip_date)}: ${trip.pickup} -> ${trip.dropoff}`,
    `Nominal sekarang: ${formatAmount(oldFare)}`,
    `Nominal baru: ${formatAmount(newFare)}`,
    ``,
    `Balas YA untuk SIMPAN, atau BATAL untuk membatalkan.`,
  ].join("\n");
}

/**
 * Setelah perubahan diterapkan + total dihitung ulang.
 */
export function buildChangeAppliedMessage(
  tripNo: number,
  oldFare: number,
  newFare: number,
  newTotal: number
): string {
  return [
    `SUDAH TERSIMPAN. Trip no ${tripNo} berubah dari ${formatAmount(oldFare)} jadi ${formatAmount(newFare)}.`,
    `Total klaim sekarang: ${formatAmount(newTotal)}`,
    ``,
    `Masih ada yang mau diubah? Ketik UBAH lagi (atau LIST).`,
    `Sudah selesai? Ketik SELESAI.`,
  ].join("\n");
}

/**
 * Konfirmasi sebelum trip dihapus dari klaim — jalur uang & merusak
 * (data trip hilang), wajib YA/BATAL seperti UBAH.
 */
export function buildDropConfirmMessage(
  trip: WaTripLine,
  tripNo: number,
  reason: string
): string {
  return [
    `KONFIRMASI HAPUS TRIP - trip no ${tripNo}`,
    `${formatTripDate(trip.trip_date)}: ${trip.pickup} -> ${trip.dropoff} (${formatAmount(trip.fare)})`,
    `Alasan: ${reason}`,
    ``,
    `Trip ini akan DIHAPUS dari klaim dan tidak dihitung lagi.`,
    `Balas YA untuk HAPUS, atau BATAL untuk membatalkan.`,
  ].join("\n");
}

/**
 * Setelah trip dihapus + total dihitung ulang.
 */
export function buildDropAppliedMessage(
  tripNo: number,
  fare: number,
  newTotal: number
): string {
  return [
    `SUDAH DIHAPUS. Trip no ${tripNo} (${formatAmount(fare)}) keluar dari klaim.`,
    `Total klaim sekarang: ${formatAmount(newTotal)}`,
    ``,
    `Masih ada yang mau diubah/dihapus? Ketik UBAH / HAPUS (atau LIST).`,
    `Sudah selesai? Ketik SELESAI.`,
  ].join("\n");
}

/**
 * Notifikasi ke engineer: klaim diajukan ulang setelah revisi.
 */
export function buildResubmittedMessage(targetRole: "MANAGER" | "HR"): string {
  const roleLabel = targetRole === "MANAGER" ? "Manager" : "HR";
  return [
    `SELESAI. Revisi Anda sudah dikirim ulang ke ${roleLabel} untuk disetujui.`,
    `Anda akan dikabari lagi setelah ada hasilnya.`,
  ].join("\n");
}
