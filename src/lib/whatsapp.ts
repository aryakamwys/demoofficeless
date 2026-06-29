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
 * Send a text message via Kirimi API.
 */
export async function sendTextMessage(
  receiver: string,
  message: string,
  options?: { delayMs?: number; maxRetries?: number }
): Promise<SendTextResponse> {
  const config = getConfig();
  const maxRetries = options?.maxRetries ?? 1;

  // Jeda sebelum pesan dikirim (default 2 detik, anti-bot detection)
  const delayMs = options?.delayMs ?? 2000;
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
          phone: receiver,
          message,
        }),
      });

      const data = await res.json();
      const success = res.ok && data.success !== false;

      if (success) {
        return { success: true, message: data.message };
      }

      lastError = data.error || data.message || `HTTP ${res.status}`;
      console.warn(`[WA] Send attempt ${attempt}/${maxRetries} failed for ${receiver}: ${lastError}`);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
      console.warn(`[WA] Send attempt ${attempt}/${maxRetries} error for ${receiver}: ${lastError}`);
    }

    // Exponential backoff before retry (1s, 2s, 4s)
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }

  console.error(`[WA] All ${maxRetries} attempts failed for ${receiver}: ${lastError}`);
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
    `Balas:`,
    `1 - Approve`,
    `2 - Reject`
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
    `Balas:`,
    `1 - Approve`,
    `2 - Reject`
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
