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
        // Beberapa WA API unofficial mendukung typing_time / delay
        typing_time: Math.floor(delayMs / 1000),
        delay: Math.floor(delayMs / 1000),
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
  ].join("\n");
}

/**
 * Build the trip detail message.
 */
export function buildDetailMessage(
  trips: Array<{ trip_date: string; fare: number }>,
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
    return `${day} ${month} - ${fare}`;
  });

  lines.push("");
  lines.push(`Total: Rp${total_amount.toLocaleString("id-ID")}`);

  return lines.join("\n");
}

/**
 * Build the confirmation message (after employee replies "1").
 */
export function buildConfirmationMessage(): string {
  return [
    "Terima kasih.",
    "",
    "Data telah dikonfirmasi.",
  ].join("\n");
}

/**
 * Build the correction prompt message (after employee replies "2").
 */
export function buildCorrectionPrompt(): string {
  return "Silakan tuliskan koreksi yang ingin disampaikan.";
}
