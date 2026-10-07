import { NextRequest, NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { sendTextMessage, normalizePhone } from "@/lib/whatsapp";
import { matchRole, type WaRole, type ClaimRow } from "@/lib/wa-match";
import { processWebhookReply, activeRefunds } from "@/lib/wa-flow";

/** Deteksi URL gambar dari payload Kirimi — bentuk payload media bisa
 *  bervariasi, jadi beberapa lokasi umum dicek sekaligus. */
function extractImageUrl(body: Record<string, unknown>): string | null {
  const m = (body.message && typeof body.message === "object" ? body.message : {}) as Record<string, unknown>;
  const attachments = Array.isArray(m.attachments) ? m.attachments : [];
  const candidates: unknown[] = [
    m.image_url,
    m.media_url,
    (m.attachment as Record<string, unknown> | undefined)?.url,
    ...attachments.map((a) => (a as Record<string, unknown>)?.url),
    body.image_url,
    body.media_url,
    body.url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//i.test(c)) return c;
  }
  return null;
}

/** Bukti transfer otomatis: gambar dari karyawan disimpan ke refund aktifnya.
 *  Balikan dipakai untuk membalas WA; null = bukan bukti TF (tidak ditangani). */
async function handleProofImage(
  supabase: ReturnType<typeof createServiceClient>,
  phoneNumber: string,
  imageUrl: string
): Promise<{ trip_no: number; amount: number; remaining: number[] } | null> {
  // Employee pengirim
  const { data: employee } = await supabase
    .from("employees")
    .select("id, employee_name")
    .eq("phone_number", phoneNumber)
    .maybeSingle();
  if (!employee) return null;

  // Klaim aktif miliknya (terbaru)
  const { data: claims } = await supabase
    .from("claims")
    .select("id")
    .eq("employee_id", employee.id)
    .in("status", ["SENT", "NEED_REVIEW"])
    .order("wa_sent_at", { ascending: false })
    .limit(1);
  const claimId = claims?.[0]?.id;
  if (!claimId) return null;

  // Refund aktif yang belum punya bukti (terbaru dulu)
  const refunds = await activeRefunds(supabase, claimId);
  const withoutProof = refunds.filter((r) => !r.proof_path);
  const target = withoutProof[withoutProof.length - 1];
  if (!target) return null;

  // Unduh gambar (batas 5MB — bukti transfer cukup jauh di bawah ini)
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) return null;
  const buf = Buffer.from(await imgRes.arrayBuffer());
  if (buf.length === 0 || buf.length > 5 * 1024 * 1024) return null;
  const ct = imgRes.headers.get("content-type") || "";
  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";

  // Simpan ke bucket private, tandai refund
  const storagePath = `refunds/${target.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("dataperkom")
    .upload(storagePath, buf, { contentType: ct || "image/jpeg" });
  if (upErr) {
    console.error("[WA] upload bukti TF gagal:", upErr.message);
    return null;
  }
  const { error: updErr } = await supabase
    .from("trip_refunds")
    .update({ proof_path: storagePath, proof_received_at: new Date().toISOString() })
    .eq("id", target.id);
  if (updErr) {
    console.error("[WA] update refund bukti gagal:", updErr.message);
    return null;
  }

  return {
    trip_no: target.trip_no,
    amount: Number(target.amount),
    remaining: withoutProof.slice(0, -1).map((r) => r.trip_no),
  };
}

// ============================================================
// Anti-loop webhook (state di memori proses — cukup untuk 1 VPS)
//
// Loop yang pernah terjadi: fallback "Tidak ada klaim aktif..." dibalas
// ke nomor gateway SENDIRI → pesan itu masuk webhook lagi → dibalas
// fallback lagi → berulang puluhan kali semenit.
// Dua lapis pertahanan:
//  1. autoReplyAllowed: balasan otomatis (fallback/media) maksimal 1x
//     per nomor per 10 menit — loop putus sendiri maksimal 1 pesan.
//  2. seenEvent: event Kirimi yang sama (id identik) tidak diproses 2x.
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

// ============================================================
// Session chat — selama alur klaim berjalan, 1 nomor terikat ke
// 1 klaim. Tanpa ini balasan bisa jatuh ke klaim lain: nomor yang
// terdaftar di banyak klaim (manager beberapa karyawan, atasan
// yang kebetulan juga karyawan) dicocokkan ke klaim mana pun yang
// kebetulan lebih dulu di daftar, bukan klaim yang sedang dibalas.
// Session lepas otomatis begitu tahap pengirim selesai (kondisi
// role tidak lagi terpenuhi) — lalu dicocokkan ulang.
// ============================================================
type WaSession = { claimId: string; role: WaRole; at: number };
const waSession = new Map<string, WaSession>();
const WA_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

// ============================================================
// Anti-spam kirim-ulang. Bot memang sengaja jeda 3-7 detik; pengirim
// yang tidak sabar sering mengirim ulang balasan yang sama. Balasan
// IDENTIK untuk klaim YANG SAMA dalam 60 detik cukup diproses sekali —
// dibalas info singkat (sekali, pakai cooldown anti-loop). Balasan sama
// untuk klaim BERBEDA tetap diproses (manager approve banyak klaim
// beruntun dengan "1").
// ============================================================
const lastReplyAt = new Map<string, { claimId: string; text: string; at: number }>();
const DUP_REPLY_WINDOW_MS = 60 * 1000;

// ==========================================
// POST handler — responds immediately, processes in background
// ==========================================
export async function POST(request: NextRequest) {
  try {
    // Verifikasi token webhook — endpoint ini bisa mengubah nominal klaim,
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
    let messageText = "";

    if (body.message && typeof body.message === "object" && body.message.text) {
      messageText = body.message.text.trim();
    } else if (typeof body.message === "string") {
      messageText = body.message.trim();
    } else if (typeof body.text === "string") {
      messageText = body.text.trim();
    }

    // Log raw payload — claim_id null: event sistem, bukan milik klaim
    // (dulu claim_id hardcoded → FK violation diam-diam begitu klaim itu
    // terhapus, payload masuk tidak meninggalkan jejak sama sekali).
    const { error: rawLogErr } = await supabase.from("whatsapp_logs").insert({
      phone_number: normalizePhone(sender) || "SYSTEM",
      message_type: "RAW_WEBHOOK",
      status: "RECEIVED",
      response: JSON.stringify(body),
    });
    if (rawLogErr) console.error("[WA] RAW_WEBHOOK log gagal:", rawLogErr.message);

    // URL gambar (kalau ada) — dipakai bukti transfer penggantian
    const imageUrl = extractImageUrl(body);

    if (!sender || !messageText) {
      // Gambar dari karyawan = bukti transfer penggantian. Coba pasang ke
      // refund aktifnya dulu; kalau bukan/kagak cocok, jatuh ke balasan
      // non-teks biasa.
      const mediaPhone0 = normalizePhone(sender);
      if (sender && imageUrl && mediaPhone0) {
        let proofInfo: Awaited<ReturnType<typeof handleProofImage>> = null;
        try {
          proofInfo = await handleProofImage(supabase, mediaPhone0, imageUrl);
        } catch (e) {
          console.error("[WA] handleProofImage error:", e);
        }
        if (proofInfo) {
          const rp = `Rp${proofInfo.amount.toLocaleString("id-ID")}`;
          after(async () => {
            const lines = [
              `*Bukti Transfer Diterima*`,
              ``,
              `Bukti untuk perjalanan nomor ${proofInfo!.trip_no} (${rp}) sudah tersimpan dan menunggu pemeriksaan HR.`,
              ``,
              ...(proofInfo!.remaining.length > 0
                ? [
                    `Masih menunggu bukti untuk perjalanan nomor: ${proofInfo!.remaining.join(", ")}.`,
                    `Kirim gambarnya satu per satu ya.`,
                    ``,
                  ]
                : []),
              `Kalau sudah transfer semuanya, ketik *SUDAH TF*.`,
            ];
            const result = await sendTextMessage(mediaPhone0, lines.join("\n"));
            const { error: logErr } = await supabase.from("whatsapp_logs").insert({
              phone_number: mediaPhone0,
              message_type: "PROOF_RECEIVED",
              status: result.success ? "SENT" : "FAILED",
              response: `bukti TF trip ${proofInfo!.trip_no}`,
            });
            if (logErr) console.error("[WA] PROOF_RECEIVED log gagal:", logErr.message);
          });
          return NextResponse.json({ success: true, reason: "Proof image stored" });
        }
      }

      // Pesan non-teks lain (voice note/video) atau format tak dikenal — tetap
      // dibalas, jangan biarkan chat menggantung seolah sistem error.
      if (sender) {
        const mediaPhone = normalizePhone(sender);
        if (mediaPhone && autoReplyAllowed(mediaPhone)) {
          after(async () => {
            const result = await sendTextMessage(
              mediaPhone,
              [
                `Maaf, pesan non-teks (gambar/suara/video) belum bisa diproses.`,
                `Mohon balas dengan TEKS.`,
                ``,
                `1 = SETUJU`,
                `2 = MINTA REVISI (tulis alasannya)`,
              ].join("\n")
            );
            const { error: logErr } = await supabase.from("whatsapp_logs").insert({
              phone_number: mediaPhone,
              message_type: "MEDIA_REPLY",
              status: result.success ? "SENT" : "FAILED",
              response: result.success
                ? "non-teks dibalas panduan teks"
                : result.error || "Unknown error",
            });
            if (logErr) console.error("[WA] MEDIA_REPLY log gagal:", logErr.message);
          });
        }
      }
      return NextResponse.json({ success: true });
    }

    const phoneNumber = normalizePhone(sender);
    if (!phoneNumber) return NextResponse.json({ success: true });

    // Pesan dari nomor gateway sendiri (chat "Message yourself" / chat
    // 6285110543115 di dashboard Kirimi) — jangan diproses apalagi dibalas:
    // balasan bot ke nomornya sendiri masuk webhook lagi dan bisa berulang
    // (loop pesan). Set KIRIMI_BOT_PHONE di env produksi.
    if (process.env.KIRIMI_BOT_PHONE && phoneNumber === normalizePhone(process.env.KIRIMI_BOT_PHONE)) {
      return NextResponse.json({ success: true, reason: "Self message ignored" });
    }

    // Gambar + caption: teksnya diproses seperti biasa, gambarnya disimpan
    // sebagai bukti TF kalau cocok (diam-diam — balasannya tetap dari flow teks).
    if (imageUrl) {
      after(async () => {
        try {
          await handleProofImage(supabase, phoneNumber, imageUrl);
        } catch (e) {
          console.error("[WA] handleProofImage (caption) error:", e);
        }
      });
    }

    // Fetch active claims
    const { data: claims } = await supabase
      .from("claims")
      .select(`
        *,
        employee:employees!claims_employee_id_fkey(*),
        manager:employees!claims_manager_id_fkey(*),
        hr:employees!claims_hr_id_fkey(*),
        trips(*)
      `)
      .in("status", ["SENT", "NEED_REVIEW"])
      .order("wa_sent_at", { ascending: false });

    if (!claims || claims.length === 0) {
      return NextResponse.json({ success: true, reason: "No active claims" });
    }

    let claim = null;
    let role: WaRole | null = null;

    // 1) Session aktif → tetap di klaim yang sama sampai tahapnya selesai,
    //    supaya balasan tidak melompat ke klaim lain di tengah alur.
    const sess = waSession.get(phoneNumber);
    if (sess && Date.now() - sess.at < WA_SESSION_TTL_MS) {
      const c = claims.find((x: ClaimRow) => x.id === sess.claimId);
      const r = c ? matchRole(c, phoneNumber) : null;
      if (c && r) {
        claim = c;
        role = r;
      } else {
        waSession.delete(phoneNumber); // tahap pengirim selesai → cocokkan ulang
      }
    }

    // 2) Approver dulu, baru karyawan — manager/HR yang kebetulan juga punya
    //    klaim sendiri tidak salah terdeteksi sebagai karyawan klaimnya sendiri
    //    (ini penyebab balasan manager "tidak terdeteksi").
    if (!claim) {
      for (const c of claims as ClaimRow[]) {
        const r = matchRole(c, phoneNumber);
        if (r === "HR" || r === "MANAGER") { claim = c; role = r; break; }
      }
    }
    if (!claim) {
      for (const c of claims as ClaimRow[]) {
        if (matchRole(c, phoneNumber) === "EMPLOYEE") { claim = c; role = "EMPLOYEE"; break; }
      }
    }

    // 3) Nomor dikenal sebagai approver tapi belum/sudah lewat tahapnya —
    //    jelaskan status klaimnya, jangan biarkan "tidak ada klaim aktif"
    //    untuk orang yang jelas terdaftar sebagai Manager/HR.
    if (!claim) {
      const known = (claims as ClaimRow[]).find((c) => {
        const mgrPhone = c.manager ? normalizePhone(c.manager.phone_number) : null;
        const hrPhone = c.hr ? normalizePhone(c.hr.phone_number) : null;
        return mgrPhone === phoneNumber || hrPhone === phoneNumber;
      });
      if (known) {
        if (!autoReplyAllowed(phoneNumber)) {
          return NextResponse.json({ success: true, reason: "Auto-reply cooldown (anti-loop)" });
        }
        const asHr = known.hr ? normalizePhone(known.hr.phone_number) === phoneNumber : false;
        const stage = !known.approved_at
          ? "masih menunggu konfirmasi KARYAWAN"
          : known.manager_status !== "APPROVED"
            ? "masih menunggu persetujuan MANAGER"
            : "sudah disetujui Manager dan sedang menunggu HR";
        after(async () => {
          const result = await sendTextMessage(
            phoneNumber,
            [
              `Anda terdaftar sebagai ${asHr ? "HR" : "Manager"} pada klaim ${known.employee?.employee_name || "karyawan"} periode ${known.period}.`,
              `Klaim itu ${stage} — belum ada yang perlu Anda balas di sini.`,
              `Nanti dapat pesan lagi kalau sudah giliran Anda.`,
            ].join("\n")
          );
          const { error: logErr } = await supabase.from("whatsapp_logs").insert({
            phone_number: phoneNumber,
            message_type: "APPROVER_STAGE_INFO",
            status: result.success ? "SENT" : "FAILED",
            response: result.success
              ? "approver dikenali, tahap belum tiba"
              : result.error || "Unknown error",
          });
          if (logErr) console.error("[WA] APPROVER_STAGE_INFO log gagal:", logErr.message);
        });
        return NextResponse.json({ success: true, reason: "Approver known, stage not ready" });
      }
    }

    if (!claim || !role) {
      // Jangan diam saja — pengirim perlu tahu pesannya tidak nyambung ke klaim
      // aktif (klaim selesai/dihapus, atau nomor belum terdaftar). Diam membuat
      // balasan yang hilang (device offline, klaim terhapus) tak terbedakan.
      // Dibatasi 1x/10 menit per nomor: balasan ke nomor gateway sendiri
      // masuk webhook lagi dan tanpa cooldown menjadi loop tanpa henti.
      if (!autoReplyAllowed(phoneNumber)) {
        return NextResponse.json({ success: true, reason: "Auto-reply cooldown (anti-loop)" });
      }
      after(async () => {
        const result = await sendTextMessage(
          phoneNumber,
          [
            `Tidak ada klaim aktif yang sedang menunggu balasan dari nomor ini.`,
            ``,
            `Kemungkinan: klaim sudah diproses/selesai, dibatalkan, atau nomor ini`,
            `belum terdaftar sebagai karyawan / Manager / HR di klaim manapun.`,
            `Jika merasa ini keliru, hubungi HR Perkom.`,
          ].join("\n")
        );
        const { error: logErr } = await supabase.from("whatsapp_logs").insert({
          phone_number: phoneNumber,
          message_type: "UNMATCHED_REPLY",
          status: result.success ? "SENT" : "FAILED",
          response: result.success
            ? "nomor tidak terdaftar di klaim aktif"
            : result.error || "Unknown error",
        });
        if (logErr) console.error("[WA] UNMATCHED_REPLY log gagal:", logErr.message);
      });
      return NextResponse.json({ success: true, reason: "No matching claim/role" });
    }

    // Balasan identik untuk klaim yang sama dalam 60 detik = kirim ulang
    // (bot kelamaan di mata pengirim) — jangan diproses dua kali.
    const reply = messageText.trim();
    const lastReply = lastReplyAt.get(phoneNumber);
    if (
      lastReply &&
      lastReply.claimId === claim.id &&
      lastReply.text === reply &&
      Date.now() - lastReply.at < DUP_REPLY_WINDOW_MS
    ) {
      if (autoReplyAllowed(phoneNumber)) {
        after(async () => {
          const result = await sendTextMessage(
            phoneNumber,
            [
              `Pesan Anda yang tadi masih diproses.`,
              `Tunggu balasannya dulu (kira-kira 7 detik) — tidak perlu dikirim ulang.`,
            ].join("\n")
          );
          const { error: logErr } = await supabase.from("whatsapp_logs").insert({
            phone_number: phoneNumber,
            message_type: "DUP_REPLY_INFO",
            status: result.success ? "SENT" : "FAILED",
            response: result.success ? "kirim ulang dibalas info tunggu" : result.error || "Unknown error",
          });
          if (logErr) console.error("[WA] DUP_REPLY_INFO log gagal:", logErr.message);
        });
      }
      return NextResponse.json({ success: true, reason: "Duplicate reply (spam-guard)" });
    }
    lastReplyAt.set(phoneNumber, { claimId: claim.id, text: reply, at: Date.now() });
    if (lastReplyAt.size > 500) {
      const now = Date.now();
      for (const [k, v] of lastReplyAt) {
        if (now - v.at > DUP_REPLY_WINDOW_MS * 5) lastReplyAt.delete(k);
      }
    }

    // Kunci session: balasan berikutnya dari nomor ini tetap di klaim ini.
    waSession.set(phoneNumber, { claimId: claim.id, role: role!, at: Date.now() });
    if (waSession.size > 500) {
      const now = Date.now();
      for (const [k, v] of waSession) {
        if (now - v.at > WA_SESSION_TTL_MS) waSession.delete(k);
      }
    }

    // Balas Kirimi INSTAN supaya tidak timeout/retry-dobel; pesan WA dikirim
    // di background dengan jeda anti-bot tetap. Aman di VPS (node standalone,
    // proses tetap hidup setelah response — bukan lagi serverless Vercel).
    after(() => processWebhookReply(claim!, role!, reply, phoneNumber));

    // Respond immediately to Kirimi webhook (no timeout risk)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ success: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
