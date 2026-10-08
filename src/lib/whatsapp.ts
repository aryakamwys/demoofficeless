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
 * Gaya pesan: seperti customer service manusia — paragraf pendek, bahasa
 * santai tapi sopan, tanpa header kapital/ikon teknis. Angka perjalanan
 * tetap dipakai (dipakai command TICKET & catatan), ditulis "nomor 3".
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

/** "34285" → "PIM-34285" untuk ditampilkan di pesan. */
function ticketChip(ticketId?: string | null): string {
  if (!ticketId) return "";
  const digits = String(ticketId).replace(/^#?\s*(?:pim\s*[-:]?\s*)?/i, "");
  return digits ? `, ticket ${digits}` : "";
}

function tripLine(t: WaTripLine, full: boolean, no?: number): string {
  const addr = (s: string) => (full ? (s || "").trim() : shortAddr(s));
  const costCode = t.cost_code ? ` · code ${t.cost_code}` : "";
  // Bernomor (1. 2. …) supaya nyambung dengan command TICKET dan catatan.
  // Dua baris per trip: tanggal+nominal di atas, rute di bawah — di layar HP
  // jauh lebih mudah dibaca daripada satu baris panjang yang terlipat lipat.
  const prefix = no != null ? `${no}. ` : "";
  return [
    `${prefix}${formatTripDate(t.trip_date)} — *${formatAmount(t.fare)}*${costCode}`,
    `${addr(t.pickup)} → ${addr(t.dropoff)}${ticketChip(t.ticket_id)}`,
  ].join("\n");
}

/** Menu karyawan — gaya percakapan, tiap opsi dijelaskan singkat.
 *  Sales tidak dibebani command ticket (tidak punya ticket EnvGate) supaya
 *  chat-nya sederhana dan tidak memancing pertanyaan. */
function employeeMenuLines(category?: string | null): string[] {
  return [
    "Kalau semua data sudah benar, ketik *1*. Nanti klaimnya diteruskan ke Manager.",
    "",
    "Kalau ada yang salah, ketik *2* lalu ceritakan masalahnya.",
    "",
    "Mau lihat alamat lengkap tiap perjalanan? Ketik *3*.",
    "",
    ...(category === "SALES"
      ? []
      : ["Mau melampirkan ticket EnvGate ke perjalanan? Contoh: TICKET 3 PIM-34285.", ""]),
    "Mau tahu posisi klaim sekarang? Ketik *INFO*.",
  ];
}

/** Menu approver (Manager/HR) — `next` = kalimat lanjutan kalau setuju. */
function approverMenuLines(next: string): string[] {
  return [
    "Silakan pilih keputusan untuk klaim ini.",
    "",
    `Ketik *1* jika klaim disetujui dan ${next}.`,
    "",
    "Ketik *2* jika ingin meminta revisi. Tuliskan juga alasannya ya.",
    "Contoh:",
    "2 nominal perjalanan nomor 3 masih kurang tepat",
    "",
    "Mau lihat daftar perjalanan bernomor? Ketik *LIST*.",
    "",
    "Mau tahu posisi klaim sekarang? Ketik *INFO*.",
  ];
}

/**
 * Pesan blast klaim — RINGAN: ringkasan + link portal. Semua proses
 * (cek rincian, setuju, catatan, ticket, bukti transfer) ada di web;
 * WA tidak lagi memuat daftar perjalanan penuh.
 */
export function buildClaimMessage(params: {
  employee_name: string;
  period: string;
  trip_count: number;
  total_amount: number;
  link?: string;
}): string {
  return [
    `*Klaim Grab Siap Dicek*`,
    ``,
    `Halo ${params.employee_name},`,
    ``,
    `Klaim Grab Anda periode ${params.period} sudah masuk: ${params.trip_count} perjalanan, total *${formatAmount(params.total_amount)}*.`,
    ``,
    ...(params.link
      ? [
          `Cek rinciannya dan proses (setuju / catatan / ticket / bukti transfer) lewat link ini:`,
          params.link,
          ``,
          `Simpan linknya — semua klaim Anda, yang berjalan maupun yang selesai, ada di sana. Tidak perlu membalas chat ini ya.`,
        ]
      : [`Silakan hubungi HR Perkom untuk memproses klaim ini.`]),
  ].join("\n");
}

/**
 * Build the trip detail message (alamat lengkap).
 */
export function buildDetailMessage(
  trips: WaTripLine[],
  total_amount: number,
  category?: string | null
): string {
  return [
    `*Detail Perjalanan*`,
    ``,
    `Ini detail alamat lengkapnya.`,
    ``,
    trips.map((t, i) => tripLine(t, true, i + 1)).join("\n\n"),
    ``,
    `Total biayanya *${formatAmount(total_amount)}*.`,
    ``,
    ...employeeMenuLines(category),
  ].join("\n");
}

/**
 * Build the confirmation message (after employee replies "1").
 */
export function buildConfirmationMessage(managerName?: string, period?: string): string {
  const p = period ? ` periode ${period}` : "";
  return [
    `*Konfirmasi Diterima*`,
    ``,
    `Terima kasih, data klaim${p === "" ? " Anda" : ` Anda${p}`} sudah dikonfirmasi.`,
    ``,
    managerName
      ? `Sekarang menunggu persetujuan Manager Anda, ${managerName}.`
      : `Sekarang klaimnya diproses lebih lanjut.`,
    ``,
    `Nanti kami kabari lagi kalau ada hasilnya. Pesan ini tidak perlu dibalas ya.`,
  ].join("\n");
}

export function buildCorrectionPrompt(): string {
  return [
    `*Koreksi Klaim*`,
    ``,
    `Baik, silakan ceritakan apa yang salah dalam satu pesan ya. Tulisan Anda akan menjadi catatan untuk HR.`,
    ``,
    `Contoh:`,
    `perjalanan 10 Juli bukan perjalanan saya`,
    `nominal perjalanan nomor 2 seharusnya Rp50.000`,
    ``,
    `Kalau ternyata semua sudah benar, ketik *1*.`,
    ``,
    `Mau lihat detail alamatnya dulu? Ketik *3*.`,
  ].join("\n");
}

/** Balasan untuk teks yang tidak dikenali — ulangi menu dengan santun.
 *  (Kalau chat terasa gantung, menu ini mengingatkan command yang tersedia.) */
export function buildEmployeeHelpMessage(category?: string | null): string {
  return [
    `*Bantuan*`,
    ``,
    `Maaf, pesannya belum saya paham.`,
    ``,
    ...employeeMenuLines(category),
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
  /** Link halaman /approve — antrean semua klaim menunggu bisa diproses dari sana. */
  link?: string;
}): string {
  const { employee_name, period, total_amount, trips } = params;
  return [
    `*Klaim Perlu Diperiksa*`,
    ``,
    `Halo Manager,`,
    ``,
    `${employee_name} mengajukan klaim Grab periode ${period}: ${trips.length} perjalanan, total *${formatAmount(total_amount)}*. Datanya sudah dikonfirmasi karyawan.`,
    ...(params.revised ? [`Klaim ini pernah direvisi oleh karyawannya.`] : []),
    ``,
    ...(params.link
      ? [
          `Periksa rinciannya dan putuskan lewat link ini:`,
          params.link,
          ``,
          `Semua klaim yang menunggu Anda juga ada di halaman yang sama. Tidak perlu membalas chat ini.`,
        ]
      : approverMenuLines("diteruskan ke HR")),
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
  /** Link halaman /approve — antrean semua klaim menunggu bisa diproses dari sana. */
  link?: string;
}): string {
  const { employee_name, manager_name, period, total_amount, trips } = params;
  return [
    `*Klaim Perlu Diperiksa*`,
    ``,
    `Halo HR,`,
    ``,
    `${employee_name} mengajukan klaim Grab periode ${period}: ${trips.length} perjalanan, total *${formatAmount(total_amount)}*. Manager (${manager_name}) sudah menyetujui — tinggal persetujuan terakhir dari Anda.`,
    ...(params.revised ? [`Klaim ini pernah direvisi oleh karyawannya.`] : []),
    ``,
    ...(params.link
      ? [
          `Periksa rinciannya dan putuskan lewat link ini:`,
          params.link,
          ``,
          `Semua klaim yang menunggu Anda juga ada di halaman yang sama. Tidak perlu membalas chat ini.`,
        ]
      : approverMenuLines("klaimnya selesai")),
  ].join("\n");
}

/**
 * Build the Employee Notification message (Status Update).
 */
export function buildEmployeeStatusUpdateMessage(status: string, actorName: string, role: 'MANAGER' | 'HR', period?: string): string {
  const p = period ? ` periode ${period}` : "";
  let title = `*Info Klaim*`;
  let msg = `Status klaim Anda${p}: ${status}`;
  if (status === 'APPROVED') {
    title = `*Klaim Disetujui*`;
    msg = `Kabar baik, klaim Anda${p} sudah disetujui Manager (${actorName}). Sekarang menunggu persetujuan HR terakhir.`;
  } else if (status === 'REJECTED') {
    title = `*Klaim Ditolak*`;
    msg = `Mohon maaf, klaim Anda${p} ditolak oleh ${role} (${actorName}). Silakan hubungi HR untuk info lebih lanjut ya.`;
  } else if (status === 'FINALIZED') {
    title = `*Klaim Selesai*`;
    msg = `Klaim Anda${p} sudah disetujui penuh oleh Manager dan HR (${actorName}). Terima kasih.`;
  }

  return [
    title,
    ``,
    msg
  ].join("\n");
}

/** Umpan balik setelah catatan karyawan tersimpan — supaya jelas catatannya masuk. */
export function buildNoteSavedMessage(text: string, nextHint: string): string {
  return [
    `*Catatan Tersimpan*`,
    ``,
    `Sudah tersimpan ya. Catatan Anda:`,
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

function bankLines(bank: CompanyBank | null): string[] {
  if (!bank) return [`Rekening kantor belum diisi HR — hubungi HR Perkom.`];
  return [
    `Bank ${bank.bank_name}`,
    `Nomor rekening ${bank.account_number}`,
    ...(bank.account_name ? [`Atas nama ${bank.account_name}`] : []),
  ];
}

/** HR menandai trip tidak sesuai → karyawan diminta mengganti uangnya.
 *  Prosesnya (unggah bukti + konfirmasi transfer) lewat portal web. */
export function buildRefundRequestMessage(params: {
  employee_name: string;
  period: string;
  trip_no: number;
  trip: WaTripLine;
  amount: number;
  reason: string;
  bank: CompanyBank | null;
  link?: string;
}): string {
  const t = params.trip;
  return [
    `*Penggantian Perjalanan*`,
    ``,
    `Halo ${params.employee_name},`,
    ``,
    `Ada kabar dari HR soal klaim periode ${params.period}.`,
    ``,
    `Perjalanan nomor ${params.trip_no} dinilai tidak sesuai.`,
    `${formatTripDate(t.trip_date)}, dari ${t.pickup} ke ${t.dropoff}, tarif ${formatAmount(t.fare)}.`,
    `Alasannya: ${params.reason}`,
    ``,
    `Jadi biaya perjalanan ini perlu Anda ganti sebesar *${formatAmount(params.amount)}*, ditransfer ke rekening kantor:`,
    ...bankLines(params.bank),
    ``,
    ...(params.link
      ? [
          `Setelah transfer, unggah bukti transfernya (foto/screenshot) dan konfirmasi lewat link ini:`,
          params.link,
        ]
      : [`Setelah transfer, hubungi HR Perkom untuk konfirmasi.`]),
    ``,
    `Setelah pembayarannya dicek HR, perjalanan ini otomatis keluar dari klaim Anda.`,
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
    `*Informasi Penggantian*`,
    ``,
    `Berikut info penggantian untuk klaim periode ${params.period}.`,
    ``,
    ...params.refunds.map(
      (r) =>
        `Perjalanan nomor ${r.trip_no} sebesar ${formatAmount(r.amount)}, ${
          r.status === "CLAIMED"
            ? "sudah Anda transfer, lagi dicek HR."
            : "masih menunggu transfer Anda."
        }`
    ),
    ``,
    `Total yang perlu diganti *${formatAmount(total)}*.`,
    ``,
    ...(params.bank
      ? [`Transfer ke rekening kantor:`, ...bankLines(params.bank)]
      : [`Rekening kantor belum diisi HR. Mohon hubungi HR Perkom ya.`]),
    ``,
    `Kalau sudah transfer, balas *SUDAH TF* ya.`,
  ].join("\n");
}

/** Karyawan menyatakan sudah transfer → menunggu pencocokan HR. */
export function buildRefundClaimedMessage(total: number, count: number): string {
  return [
    `*Pembayaran Dicatat*`,
    ``,
    `Baik, sudah kami catat ya.`,
    ``,
    `Pembayaran *${formatAmount(total)}* untuk ${count} perjalanan akan dicek HR dengan mutasi rekening kantor.`,
    ``,
    `Kalau cocok, perjalanan tersebut keluar dari klaim dan Anda kami kabari lagi.`,
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
    `*Informasi Pembayaran*`,
    ``,
    `Ada pembaruan untuk perjalanan nomor ${params.trip_nos.join(", ")}.`,
    ``,
    `${params.employee_name} menginformasikan bahwa pembayaran sebesar *${formatAmount(params.total)}* sudah ditransfer. Klaim periode ${params.period}.`,
    ...(params.note ? [`Keterangan dari karyawan: ${params.note}`] : []),
    ``,
    `Mohon cek mutasi rekening kantor terlebih dahulu. Kalau sudah masuk, silakan buka detail klaim lalu pilih *Pembayaran Diterima*.`,
    ``,
    `Setelah itu perjalanan tersebut akan keluar dari daftar klaim.`,
  ].join("\n");
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
    `*Pembayaran Dikonfirmasi*`,
    ``,
    `Terima kasih ${params.employee_name}, penggantian *${formatAmount(params.amount)}* sudah diterima HR.`,
    ``,
    `Perjalanan nomor ${params.trip_no} sudah keluar dari klaim periode ${params.period}.`,
    ``,
    `Total klaim sekarang *${formatAmount(params.new_total)}*.`,
  ].join("\n");
}

/** Uang belum ditemukan di mutasi → minta karyawan cek/ulang transfer. */
export function buildRefundAskAgainMessage(amount: number): string {
  return [
    `*Pembayaran Belum Ditemukan*`,
    ``,
    `HR belum menemukan transferan *${formatAmount(amount)}* di mutasi rekening kantor.`,
    ``,
    `Boleh dicek lagi nominal, bank, dan rekening tujuannya? Kalau perlu, ulangi transfernya, lalu balas lagi *SUDAH TF*.`,
  ].join("\n");
}

/** Karyawan membatalkan pernyataan sudah transfer (salah kirim). */
export function buildRefundUnclaimedMessage(): string {
  return [
    `*Pembayaran Dibatalkan*`,
    ``,
    `Baik, status penggantiannya dikembalikan jadi menunggu transfer.`,
    ``,
    `Kalau nanti sudah transfer, balas lagi *SUDAH TF* ya.`,
  ].join("\n");
}

/** HR membatalkan tanda "tidak sesuai" — tidak perlu penggantian lagi. */
export function buildRefundCancelledMessage(trip_no: number, period: string): string {
  return [
    `*Penggantian Dibatalkan*`,
    ``,
    `Kabar baik, tanda tidak sesuai pada perjalanan nomor ${trip_no} sudah dihapus HR.`,
    ``,
    `Perjalanan tersebut tetap di klaim periode ${period}, tidak perlu penggantian apa pun.`,
  ].join("\n");
}

/**
 * INFO — ringkasan status klaim dalam satu pesan: periode (bulan apa),
 * progres ticket, penggantian, dan langkah selanjutnya. Jawaban untuk
 * "harus scroll chat untuk cari pengajuan bulan apa".
 */
export function buildClaimInfoMessage(params: {
  viewer_role: "EMPLOYEE" | "MANAGER" | "HR";
  employee_name: string;
  period: string;
  trip_count: number;
  total_amount: number;
  stage: string;
  ticket_count: number;
  tickets_missing: number[];
  refunds: Array<{ no: number; amount: number; status: string }>;
  hints: string[];
  /** Kategori pengaju — sales tidak menampilkan baris/hint ticket. */
  category?: string | null;
}): string {
  const p = params;
  const ownerLine =
    p.viewer_role === "EMPLOYEE" ? `Klaim atas nama Anda` : `Klaim atas nama ${p.employee_name}`;
  // Sales tidak punya ticket EnvGate — hint terkait ticket disaring.
  const hints =
    p.category === "SALES" ? p.hints.filter((h) => !/TICKET/i.test(h)) : p.hints;
  return [
    `*Info Klaim*`,
    ``,
    `Periode ${p.period}.`,
    `${ownerLine}, ${p.trip_count} perjalanan, total *${formatAmount(p.total_amount)}*.`,
    ``,
    `Statusnya: ${p.stage}`,
    ``,
    ...(p.category === "SALES"
      ? []
      : [
          `Ticket EnvGate: ${p.ticket_count} dari ${p.trip_count} perjalanan sudah ada${
            p.tickets_missing.length > 0 ? `. Yang belum: nomor ${p.tickets_missing.join(", ")}` : `.`
          }`,
        ]),
    ...(p.refunds.length > 0
      ? [
          ``,
          `Penggantian: ${p.refunds
            .map(
              (r) =>
                `perjalanan nomor ${r.no} ${formatAmount(r.amount)}${
                  r.status === "CLAIMED" ? " (lagi dicek HR)" : " (menunggu transfer)"
                }`
            )
            .join(", ")}.`,
        ]
      : []),
    ``,
    `Langkah selanjutnya:`,
    ...hints.map((h) => h),
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
 * Notifikasi revisi — semua pengerjaan lewat portal web (catatan, ticket,
 * kirim ulang); WA hanya menyampaikan alasannya + link.
 */
export function buildRevisionRequestMessage(params: {
  employee_name: string;
  period: string;
  requester_name: string;
  requester_role: "MANAGER" | "HR";
  reason: string;
  link?: string;
}): string {
  const roleLabel = params.requester_role === "MANAGER" ? "Manager" : "HR";
  return [
    `*Permintaan Revisi*`,
    ``,
    `Halo ${params.employee_name},`,
    ``,
    `Klaim periode ${params.period} diminta direvisi oleh ${roleLabel} (${params.requester_name}).`,
    `Alasannya: ${params.reason || "tidak disertakan"}`,
    ``,
    ...(params.link
      ? [
          `Buka link klaim Anda untuk menulis catatan untuk HR, melengkapi ticket, lalu mengirim ulang:`,
          params.link,
        ]
      : [`Silakan hubungi HR Perkom untuk memproses revisinya.`]),
  ].join("\n");
}

/**
 * Minta paraf manager untuk penggantian trip "tidak sesuai" yang ditandai HR.
 * Karyawan belum diminta transfer — menunggu keputusan manager dari link ini.
 */
export function buildRefundManagerApprovalMessage(params: {
  employee_name: string;
  period: string;
  trip_no: number;
  pickup: string;
  dropoff: string;
  amount: number;
  reason: string;
  link?: string;
}): string {
  return [
    `*Perlu Paraf: Penggantian Perjalanan*`,
    ``,
    `Halo Manager,`,
    ``,
    `${params.employee_name} (klaim periode ${params.period}) ada perjalanan yang ditandai TIDAK SESUAI oleh HR.`,
    ``,
    `Perjalanan nomor ${params.trip_no}: ${shortAddr(params.pickup, 40)} → ${shortAddr(params.dropoff, 40)}`,
    `Alasan: ${params.reason}`,
    `Penggantian: *${formatAmount(params.amount)}* ke rekening kantor.`,
    ``,
    ...(params.link
      ? [
          `Setujui di sini (paraf otomatis dari tanda tangan Anda yang tersimpan):`,
          params.link,
          ``,
          `Menolak juga bisa dari halaman yang sama — perjalanan tetap di klaim.`,
        ]
      : [`Balas chat ini ke HR Perkom untuk menyampaikan keputusan Anda.`]),
  ].join("\n");
}

/**
 * Daftar trip bernomor — acuan menulis catatan & command TICKET.
 */
export function buildRevisionTripListMessage(
  trips: WaTripLine[],
  total_amount: number,
  period: string,
  category?: string | null,
  /** Approver (Manager/HR) melihat hint keputusan, bukan hint revisi karyawan. */
  viewer?: "EMPLOYEE" | "APPROVER"
): string {
  const lines = trips.map((t, i) => tripLine(t, false, i + 1)).join("\n\n");
  const closing =
    viewer === "APPROVER"
      ? [
          `Ketik *1* untuk menyetujui klaim ini.`,
          ``,
          `Ketik *2* diikuti alasan untuk meminta revisi.`,
          ``,
          `Mau tahu posisi klaim sekarang? Ketik *INFO*.`,
        ]
      : [
          `Ada yang perlu diluruskan? Balas dengan catatan untuk HR, sebutkan nomor perjalanannya.`,
          `Contoh: perjalanan nomor 3 bukan perjalanan saya`,
          ``,
          ...(category === "SALES"
            ? []
            : [
                `Ketik TICKET lalu nomor perjalanan dan nomor ticketnya. Contoh: TICKET 3 PIM-34285`,
                ``,
                `Ketik TICKET SEMUA kalau mau mengisi ticket banyak perjalanan sekaligus, dipandu satu per satu.`,
                ``,
              ]),
          `Kalau sudah beres, ketik *SELESAI* ya, nanti klaimnya dikirim ulang ke approver.`,
          ``,
          `Ketik INFO untuk melihat posisi klaim.`,
        ];
  return [
    `*Daftar Perjalanan*`,
    ``,
    `Klaim periode ${period}:`,
    lines,
    ``,
    `Totalnya *${formatAmount(total_amount)}*.`,
    ``,
    ...closing,
  ].join("\n");
}

/**
 * Daftar ticket EnvGate milik engineer untuk satu periode — dipakai command
 * TICKET LIST supaya engineer tahu ID ticket apa yang perlu didaftarkan.
 */
export function buildEngineerTicketListMessage(
  tickets: Array<{ id: string; title: string; date: string | null }>,
  employee_name: string,
  period: string
): string {
  if (tickets.length === 0) {
    return [
      `*Daftar Ticket EnvGate*`,
      ``,
      `Halo ${employee_name}, belum ada ticket EnvGate atas nama Anda untuk periode ${period}.`,
      ``,
      `Kalau merasa seharusnya ada, cek lagi nama Anda di ticket EnvGate atau hubungi HR.`,
    ].join("\n");
  }
  const lines = tickets.map(
    (t, i) => `${i + 1}. *${t.id}* — ${t.title}${t.date ? ` (${t.date})` : ""}`
  );
  return [
    `*Daftar Ticket EnvGate*`,
    ``,
    `Ticket atas nama ${employee_name} periode ${period}:`,
    ``,
    ...lines,
    ``,
    `Untuk melampirkan ke perjalanan klaim: ketik TICKET lalu nomor perjalanan dan ID ticketnya.`,
    `Contoh: TICKET 3 ${tickets[0].id}`,
  ].join("\n");
}

/**
 * Notifikasi ke engineer: klaim diajukan ulang setelah revisi.
 */
export function buildResubmittedMessage(targetRole: "MANAGER" | "HR"): string {
  const roleLabel = targetRole === "MANAGER" ? "Manager" : "HR";
  return [
    `*Revisi Selesai*`,
    ``,
    `Revisi Anda sudah dikirim ulang ke ${roleLabel}.`,
    ``,
    `Nanti Anda kami kabari lagi kalau ada hasilnya.`,
  ].join("\n");
}
