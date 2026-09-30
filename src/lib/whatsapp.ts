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
 * Normalisasi nomor ke format Kirimi (6281234567890, tanpa +/spasi/@lid).
 */
export function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  return phone
    .replace(/[\s\-()]/g, "")
    .replace(/^\+/, "")
    .replace(/^0/, "62")
    .replace(/@lid$/, "");
}

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

  // Jeda acak 3-7 detik antar pesan — jeda tetap & pendek dari device QR
  // adalah pemicu pembatasan paling sering (docs Kirimi: catatan praktis)
  const delayMs = options?.delayMs ?? 3000 + Math.floor(Math.random() * 4000);
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
 * Build the claim notification message.
 * Professional tone, no emoji, following user's WhatsApp flow spec.
 */
export function buildClaimMessage(params: {
  employee_name: string;
  period: string;
  trip_count: number;
  total_amount: number;
  trips: Array<{ trip_date: string; pickup: string; dropoff: string; fare: number; cost_code?: string }>;
}): string {
  const { employee_name, period, trip_count, total_amount, trips } = params;
  const numAmount = typeof total_amount === 'string' ? parseFloat(total_amount) : total_amount;
  const formattedAmount = `Rp${numAmount.toLocaleString("id-ID")}`;

  const tripDetails = trips.map((t) => {
    const date = new Date(t.trip_date);
    const day = date.getDate().toString().padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const dateStr = `${day} ${monthNames[date.getMonth()]}`;
    const numFare = typeof t.fare === 'string' ? parseFloat(t.fare) : t.fare;
    const fare = `Rp${numFare.toLocaleString("id-ID")}`;
    const costCode = t.cost_code ? ` [Code: ${t.cost_code}]` : "";
    return `- ${dateStr}: ${t.pickup} -> ${t.dropoff} (${fare})${costCode}`;
  }).join("\n");

  const refId = Math.random().toString(36).substring(2, 8).toUpperCase();
  return [
    `[Ref: ${refId}]`,
    `Halo ${employee_name},`,
    ``,
    `Data perjalanan Grab Business periode ${period} telah tersedia.`,
    ``,
    `Detail Perjalanan:`,
    tripDetails,
    ``,
    `Total perjalanan: ${trip_count} Trip`,
    `Total biaya: ${formattedAmount}`,
    ``,
    `Silakan lakukan konfirmasi.`,
    ``,
    `Balas:`,
    `1 - Setuju`,
    `2 - Koreksi`,
    `3 - Detail`
  ].join("\n");
}

/**
 * Build the trip detail message.
 */
export function buildDetailMessage(
  trips: Array<{ trip_date: string; pickup: string; dropoff: string; fare: number; cost_code?: string }>,
  total_amount: number
): string {
  const lines = trips.map((t) => {
    const date = new Date(t.trip_date);
    const day = date.getDate().toString().padStart(2, "0");
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
      "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
    ];
    const month = monthNames[date.getMonth()];
    const numFare = typeof t.fare === 'string' ? parseFloat(t.fare) : t.fare;
    const fare = `Rp${numFare.toLocaleString("id-ID")}`;
    const costCode = t.cost_code ? ` [Code: ${t.cost_code}]` : "";
    return `- ${day} ${month}: ${t.pickup} -> ${t.dropoff} (${fare})${costCode}`;
  });

  const refId = Math.random().toString(36).substring(2, 8).toUpperCase();
  lines.unshift(`[Ref: ${refId}]`, "");
  lines.push("");
  const numTotal = typeof total_amount === 'string' ? parseFloat(total_amount) : total_amount;
  lines.push(`Total: Rp${numTotal.toLocaleString("id-ID")}`);
  lines.push("");
  lines.push(`Balas:`);
  lines.push(`1 - Setuju`);
  lines.push(`2 - Koreksi`);
  lines.push(`3 - Detail`);

  return lines.join("\n");
}

/**
 * Build the confirmation message (after employee replies "1").
 */
export function buildConfirmationMessage(managerName?: string): string {
  const refId = Math.random().toString(36).substring(2, 8).toUpperCase();
  if (managerName) {
    return [
      `[Ref: ${refId}]`,
      "Terima kasih.",
      "",
      `Data telah dikonfirmasi dan sedang diteruskan ke Manager Anda (${managerName}) untuk persetujuan.`
    ].join("\n");
  }
  return [
    `[Ref: ${refId}]`,
    "Terima kasih.",
    "",
    "Data telah dikonfirmasi dan sedang diproses lebih lanjut."
  ].join("\n");
}

export function buildCorrectionPrompt(): string {
  const refId = Math.random().toString(36).substring(2, 8).toUpperCase();
  return [
    `[Ref: ${refId}]`,
    "Silakan tuliskan koreksi yang ingin disampaikan.",
    "",
    "Setelah Anda selesai, Anda dapat memilih:",
    `1 - Setuju`,
    `2 - Koreksi (Ulangi)`,
    `3 - Detail`
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
  trips: Array<{ trip_date: string; pickup: string; dropoff: string; fare: number; cost_code?: string }>;
}): string {
  const { employee_name, period, total_amount, trips } = params;
  const numAmount = typeof total_amount === 'string' ? parseFloat(total_amount) : total_amount;
  const formattedAmount = `Rp${numAmount.toLocaleString("id-ID")}`;

  const tripDetails = trips.map((t) => {
    const date = new Date(t.trip_date);
    const day = date.getDate().toString().padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const dateStr = `${day} ${monthNames[date.getMonth()]}`;
    const numFare = typeof t.fare === 'string' ? parseFloat(t.fare) : t.fare;
    const fare = `Rp${numFare.toLocaleString("id-ID")}`;
    const costCode = t.cost_code ? ` [Code: ${t.cost_code}]` : "";
    return `- ${dateStr}: ${t.pickup} -> ${t.dropoff} (${fare})${costCode}`;
  }).join("\n");

  const refId = Math.random().toString(36).substring(2, 8).toUpperCase();
  return [
    `[Ref: ${refId}]`,
    `Halo Manager,`,
    ``,
    `Terdapat pengajuan klaim Grab Business yang membutuhkan persetujuan Anda:`,
    ``,
    `Karyawan: ${employee_name}`,
    `Periode: ${period}`,
    ``,
    `Detail Perjalanan:`,
    tripDetails,
    ``,
    `Total Biaya: ${formattedAmount}`,
    ``,
    `Karyawan telah menyetujui data ini.`,
    ...(params.revised ? [`Klaim ini telah direvisi oleh karyawan.`] : []),
    `Balas:`,
    `1 - Approve`,
    `2 - Minta Revisi (contoh: 2 alasan revisi)`
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
  trips: Array<{ trip_date: string; pickup: string; dropoff: string; fare: number; cost_code?: string }>;
}): string {
  const { employee_name, manager_name, period, total_amount, trips } = params;
  const numAmount = typeof total_amount === 'string' ? parseFloat(total_amount) : total_amount;
  const formattedAmount = `Rp${numAmount.toLocaleString("id-ID")}`;

  const tripDetails = trips.map((t) => {
    const date = new Date(t.trip_date);
    const day = date.getDate().toString().padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const dateStr = `${day} ${monthNames[date.getMonth()]}`;
    const numFare = typeof t.fare === 'string' ? parseFloat(t.fare) : t.fare;
    const fare = `Rp${numFare.toLocaleString("id-ID")}`;
    const costCode = t.cost_code ? ` [Code: ${t.cost_code}]` : "";
    return `- ${dateStr}: ${t.pickup} -> ${t.dropoff} (${fare})${costCode}`;
  }).join("\n");

  const refId = Math.random().toString(36).substring(2, 8).toUpperCase();
  return [
    `[Ref: ${refId}]`,
    `Halo HR,`,
    ``,
    `Terdapat pengajuan klaim Grab Business yang telah disetujui oleh Manager (${manager_name}):`,
    ``,
    `Karyawan: ${employee_name}`,
    `Periode: ${period}`,
    ``,
    `Detail Perjalanan:`,
    tripDetails,
    ``,
    `Total Biaya: ${formattedAmount}`,
    ``,
    ...(params.revised ? [`Klaim ini telah direvisi oleh karyawan.`] : []),
    `Balas:`,
    `1 - Approve`,
    `2 - Minta Revisi (contoh: 2 alasan revisi)`
  ].join("\n");
}

/**
 * Build the Employee Notification message (Status Update).
 */
export function buildEmployeeStatusUpdateMessage(status: string, actorName: string, role: 'MANAGER' | 'HR'): string {
  let msg = `Status klaim Anda: ${status}`;
  if (status === 'APPROVED') {
    msg = `Klaim Anda telah disetujui oleh ${role} (${actorName}).`;
  } else if (status === 'REJECTED') {
    msg = `Mohon maaf, klaim Anda telah ditolak oleh ${role} (${actorName}).`;
  } else if (status === 'FINALIZED') {
    msg = `Klaim Anda telah selesai diproses dan disetujui oleh HR (${actorName}).`;
  }
  
  const refId = Math.random().toString(36).substring(2, 8).toUpperCase();
  return [
    `[Ref: ${refId}]`,
    msg
  ].join("\n");
}

// ============================================================
// Revision flow — klaim dikembalikan ke engineer via chat
// ============================================================

type WaTrip = { trip_date: string; pickup: string; dropoff: string; fare: number; cost_code?: string };

function formatAmount(n: number | string): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  return `Rp${num.toLocaleString("id-ID")}`;
}

function formatTripDate(dateStr: string): string {
  const date = new Date(dateStr);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${date.getDate().toString().padStart(2, "0")} ${monthNames[date.getMonth()]}`;
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
  const refId = Math.random().toString(36).substring(2, 8).toUpperCase();
  return [
    `[Ref: ${refId}]`,
    `Halo ${params.employee_name},`,
    ``,
    `Klaim periode ${params.period} diminta revisi oleh ${roleLabel} (${params.requester_name}).`,
    ``,
    `Alasan: ${params.reason || "tidak disertakan"}`,
    ``,
    `Untuk revisi via chat, balas:`,
    `LIST - lihat daftar trip bernomor`,
    `UBAH <no> <nominal> - ubah nominal, contoh: UBAH 3 75000`,
    `SELESAI - ajukan ulang ke ${roleLabel}`,
    ``,
    `Anda juga bisa menulis catatan langsung dengan membalas pesan ini.`,
  ].join("\n");
}

/**
 * Daftar trip bernomor untuk command LIST / UBAH.
 */
export function buildRevisionTripListMessage(
  trips: WaTrip[],
  total_amount: number,
  period: string
): string {
  const lines = trips.map((t, i) => {
    const costCode = t.cost_code ? ` [Code: ${t.cost_code}]` : "";
    return `${i + 1}. ${formatTripDate(t.trip_date)}: ${t.pickup} -> ${t.dropoff} (${formatAmount(t.fare)})${costCode}`;
  });
  const refId = Math.random().toString(36).substring(2, 8).toUpperCase();
  return [
    `[Ref: ${refId}]`,
    `Daftar Trip klaim periode ${period}:`,
    ...lines,
    ``,
    `Total: ${formatAmount(total_amount)}`,
    ``,
    `Balas:`,
    `UBAH <no> <nominal> - ubah nominal, contoh: UBAH 3 75000`,
    `SELESAI - ajukan ulang`,
  ].join("\n");
}

/**
 * Konfirmasi sebelum nominal diubah (jalur uang — wajib YA/BATAL).
 */
export function buildChangeConfirmMessage(
  trip: WaTrip,
  tripNo: number,
  oldFare: number,
  newFare: number
): string {
  const refId = Math.random().toString(36).substring(2, 8).toUpperCase();
  return [
    `[Ref: ${refId}]`,
    `Konfirmasi perubahan nominal Trip ${tripNo}:`,
    `${formatTripDate(trip.trip_date)}: ${trip.pickup} -> ${trip.dropoff}`,
    `${formatAmount(oldFare)} -> ${formatAmount(newFare)}`,
    ``,
    `Balas YA untuk simpan, BATAL untuk batal.`,
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
  const refId = Math.random().toString(36).substring(2, 8).toUpperCase();
  return [
    `[Ref: ${refId}]`,
    `Trip ${tripNo} berhasil diubah: ${formatAmount(oldFare)} -> ${formatAmount(newFare)}.`,
    `Total klaim sekarang: ${formatAmount(newTotal)}`,
    ``,
    `Lanjutkan revisi lainnya atau balas SELESAI untuk mengajukan ulang.`,
  ].join("\n");
}

/**
 * Notifikasi ke engineer: klaim diajukan ulang setelah revisi.
 */
export function buildResubmittedMessage(targetRole: "MANAGER" | "HR"): string {
  const roleLabel = targetRole === "MANAGER" ? "Manager" : "HR";
  const refId = Math.random().toString(36).substring(2, 8).toUpperCase();
  return [
    `[Ref: ${refId}]`,
    `Terima kasih. Klaim Anda telah diajukan ulang ke ${roleLabel} untuk persetujuan.`,
  ].join("\n");
}
