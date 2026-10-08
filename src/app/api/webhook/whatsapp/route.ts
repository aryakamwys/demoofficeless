import { NextRequest, NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { sendTextMessage, normalizePhone } from "@/lib/whatsapp";
import { portalLink } from "@/lib/wa-link";

// ============================================================
// Webhook Kirimi — mode NOTIFIKASI.
// Semua proses klaim kini lewat portal web (/p) dan halaman
// approver (/approve): cek rincian, setuju, catatan, ticket,
// bukti transfer, approval manager/HR. Balasan chat (teks
// maupun gambar) TIDAK lagi diproses sebagai perintah —
// dikembalikan satu pesan penunjuk link portal karyawan.
//
// Yang tetap dijaga dari webhook lama:
//  - verifikasi token (?token=WEBHOOK_SECRET)
//  - dedupe event Kirimi (event id sama diproses sekali)
//  - log RAW_WEBHOOK (payload mentah, untuk debug integrasi)
//  - pesan dari nomor gateway sendiri diabaikan (anti loop)
//  - balasan otomatis dibatasi 1x/10 menit per nomor (anti loop)
// ============================================================

const autoReplyAt = new Map<string, number>();
const AUTO_REPLY_COOLDOWN_MS = 10 * 60 * 1000;

function autoReplyAllowed(phone: string): boolean {
  const now = Date.now();
  if (now - (autoReplyAt.get(phone) || 0) < AUTO_REPLY_COOLDOWN_MS) return false;
  autoReplyAt.set(phone, now);
  if (autoReplyAt.size > 500) {
    for (const [k, v] of autoReplyAt) {
      if (now - v > AUTO_REPLY_COOLDOWN_MS) autoReplyAt.delete(k);
    }
  }
  return true;
}

const seenEventAt = new Map<string, number>();
const SEEN_EVENT_TTL_MS = 60 * 60 * 1000;

function eventAlreadyProcessed(id: string): boolean {
  const now = Date.now();
  if (now - (seenEventAt.get(id) || 0) < SEEN_EVENT_TTL_MS) return true;
  seenEventAt.set(id, now);
  if (seenEventAt.size > 2000) {
    for (const [k, v] of seenEventAt) {
      if (now - v > SEEN_EVENT_TTL_MS) seenEventAt.delete(k);
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Verifikasi token webhook — endpoint ini bisa mengirim balasan WA,
    // jadi set WEBHOOK_SECRET di env produksi (URL: /api/webhook/whatsapp?token=xxx)
    const secret = process.env.WEBHOOK_SECRET;
    if (secret && request.nextUrl.searchParams.get("token") !== secret) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const supabase = createServiceClient();

    // Kirimi bisa mengirim ulang event yang sama — proses sekali saja
    const eventId =
      (typeof body.id === "string" && body.id) ||
      (body.message && typeof body.message === "object" && typeof body.message.id === "string"
        ? body.message.id
        : "") ||
      (typeof body.event_id === "string" ? body.event_id : "");
    if (eventId && eventAlreadyProcessed(eventId)) {
      return NextResponse.json({ success: true, reason: "Duplicate event" });
    }

    const sender = body.sender || body.from || body.phone || "";
    const phoneNumber = normalizePhone(sender);
    if (!phoneNumber) return NextResponse.json({ success: true });

    // Pesan dari nomor gateway sendiri — jangan diproses apalagi dibalas
    // (balasan bot ke nomornya sendiri masuk webhook lagi = loop pesan)
    if (process.env.KIRIMI_BOT_PHONE && phoneNumber === normalizePhone(process.env.KIRIMI_BOT_PHONE)) {
      return NextResponse.json({ success: true, reason: "Self message ignored" });
    }

    // Log raw payload (claim_id null — event sistem) untuk debug integrasi
    const { error: rawLogErr } = await supabase.from("whatsapp_logs").insert({
      phone_number: phoneNumber,
      message_type: "RAW_WEBHOOK",
      status: "RECEIVED",
      response: JSON.stringify(body),
    });
    if (rawLogErr) console.error("[WA] RAW_WEBHOOK log gagal:", rawLogErr.message);

    // Balas searah: penunjuk link portal. Dibatasi 1x/10 menit per nomor.
    if (!autoReplyAllowed(phoneNumber)) {
      return NextResponse.json({ success: true, reason: "Auto-reply cooldown (anti-loop)" });
    }

    after(async () => {
      // Nomor karyawan dikenal → kirim link portal pribadinya
      const { data: emp } = await supabase
        .from("employees")
        .select("id, employee_name")
        .eq("phone_number", phoneNumber)
        .maybeSingle();

      const lines = emp
        ? [
            `*Semua Proses Klaim Pindah ke Web*`,
            ``,
            `Balasan chat tidak lagi diproses ya, ${emp.employee_name}.`,
            ``,
            `Semua klaim Anda — yang sedang berjalan maupun yang sudah selesai — ada di link ini:`,
            portalLink(emp.id, phoneNumber),
            ``,
            `Cek rincian, setuju, catatan untuk HR, ticket, dan unggah bukti transfer: semuanya lewat link itu.`,
            ``,
            `Simpan linknya ya (berlaku 30 hari). Kalau hilang/expired, kirim pesan apa saja ke nomor ini — link baru otomatis dikirim.`,
          ]
        : [
            `*Semua Proses Klaim Pindah ke Web*`,
            ``,
            `Balasan chat tidak lagi diproses.`,
            `Nomor ini belum terdaftar sebagai karyawan — kalau ini keliru, hubungi HR Perkom ya.`,
          ];

      const result = await sendTextMessage(phoneNumber, lines.join("\n"));
      const { error: logErr } = await supabase.from("whatsapp_logs").insert({
        phone_number: phoneNumber,
        message_type: "PORTAL_REDIRECT",
        status: result.success ? "SENT" : "FAILED",
        response: result.success ? "penunjuk link portal" : result.error || "Unknown error",
      });
      if (logErr) console.error("[WA] PORTAL_REDIRECT log gagal:", logErr.message);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ success: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
