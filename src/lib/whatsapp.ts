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
  options?: { delayMs?: number }
): Promise<SendTextResponse> {
  const config = getConfig();

  // Simulasi jeda / "typing" sebelum pesan dikirim (default 2 detik)
  const delayMs = options?.delayMs ?? 2000;
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

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
    return {
      success: res.ok && data.success !== false,
      message: data.message,
      error: data.error || (!res.ok ? data.message : undefined),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
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
}): string {
  const { employee_name, period, trip_count, total_amount } = params;
  const formattedAmount = `Rp${total_amount.toLocaleString("id-ID")}`;

  return [
    `Halo ${employee_name},`,
    ``,
    `Data perjalanan Grab Business periode ${period} telah tersedia.`,
    ``,
    `Total perjalanan: ${trip_count} Trip`,
    `Total biaya: ${formattedAmount}`,
    ``,
    `Silakan lakukan konfirmasi.`,
    ``,
    `Balas:`,
    `1 - Setuju`,
    `2 - Koreksi`,
    `3 - Detail`,
    ``,
    `Ref: ${new Date().getTime().toString().slice(-6)}`
  ].join("\n");
}

/**
 * Build the trip detail message.
 */
export function buildDetailMessage(
  trips: Array<{ trip_date: string; pickup: string; dropoff: string; fare: number }>,
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
    const fare = `Rp${t.fare.toLocaleString("id-ID")}`;
    return `- ${day} ${month}: ${t.pickup} -> ${t.dropoff} (${fare})`;
  });

  lines.push("");
  lines.push(`Total: Rp${total_amount.toLocaleString("id-ID")}`);
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
  if (managerName) {
    return [
      "Terima kasih.",
      "",
      `Data telah dikonfirmasi dan sedang diteruskan ke Manager Anda (${managerName}) untuk persetujuan.`,
    ].join("\n");
  }
  return [
    "Terima kasih.",
    "",
    "Data telah dikonfirmasi dan sedang diproses lebih lanjut.",
  ].join("\n");
}

export function buildCorrectionPrompt(): string {
  return [
    "Silakan tuliskan koreksi yang ingin disampaikan.",
    "",
    "Setelah Anda selesai, Anda dapat memilih:",
    `1 - Setuju`,
    `2 - Koreksi (Ulangi)`,
    `3 - Detail`,
  ].join("\n");
}

/**
 * Build the manager approval message.
 */
export function buildManagerApprovalMessage(params: {
  employee_name: string;
  period: string;
  total_amount: number;
  trips: Array<{ trip_date: string; pickup: string; dropoff: string; fare: number }>;
}): string {
  const { employee_name, period, total_amount, trips } = params;
  const formattedAmount = `Rp${total_amount.toLocaleString("id-ID")}`;

  const tripDetails = trips.map((t) => {
    const date = new Date(t.trip_date);
    const day = date.getDate().toString().padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const dateStr = `${day} ${monthNames[date.getMonth()]}`;
    const fare = `Rp${t.fare.toLocaleString("id-ID")}`;
    return `- ${dateStr}: ${t.pickup} -> ${t.dropoff} (${fare})`;
  }).join("\n");

  return [
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
    `2 - Reject`,
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
  trips: Array<{ trip_date: string; pickup: string; dropoff: string; fare: number }>;
}): string {
  const { employee_name, manager_name, period, total_amount, trips } = params;
  const formattedAmount = `Rp${total_amount.toLocaleString("id-ID")}`;

  const tripDetails = trips.map((t) => {
    const date = new Date(t.trip_date);
    const day = date.getDate().toString().padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const dateStr = `${day} ${monthNames[date.getMonth()]}`;
    const fare = `Rp${t.fare.toLocaleString("id-ID")}`;
    return `- ${dateStr}: ${t.pickup} -> ${t.dropoff} (${fare})`;
  }).join("\n");

  return [
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
    `2 - Reject`,
  ].join("\n");
}

/**
 * Build the Employee Notification message (Status Update).
 */
export function buildEmployeeStatusUpdateMessage(status: string, actorName: string, role: 'MANAGER' | 'HR'): string {
  if (status === 'APPROVED') {
    return `Klaim Anda telah disetujui oleh ${role} (${actorName}).`;
  } else if (status === 'REJECTED') {
    return `Mohon maaf, klaim Anda telah ditolak oleh ${role} (${actorName}).`;
  } else if (status === 'FINALIZED') {
    return `Klaim Anda telah selesai diproses dan disetujui oleh HR (${actorName}).`;
  }
  return `Status klaim Anda: ${status}`;
}
