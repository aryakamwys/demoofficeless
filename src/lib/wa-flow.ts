// Logika alur persetujuan klaim — dipakai bersama oleh:
//  - webhook Kirimi (balasan chat: "1"/"2"/command)
//  - API aksi tombol web (/api/wa/action → halaman /approve)
// Satu sumber kebenaran: tombol web dan balasan chat menjalankan
// logika yang sama, tidak ada jalur approve yang terpisah.
import { createServiceClient } from "@/lib/supabase-server";
import {
  sendTextMessage,
  normalizePhone,
  buildDetailMessage,
  buildConfirmationMessage,
  buildCorrectionPrompt,
  buildEmployeeHelpMessage,
  buildNoteSavedMessage,
  buildManagerApprovalMessage,
  buildHrApprovalMessage,
  buildEmployeeStatusUpdateMessage,
  buildRevisionRequestMessage,
  buildRevisionTripListMessage,
  buildResubmittedMessage,
  buildRefundInfoMessage,
  buildEngineerTicketListMessage,
  buildRefundClaimedMessage,
  buildRefundClaimedHrMessage,
  buildRefundUnclaimedMessage,
  buildClaimInfoMessage,
  type CompanyBank,
} from "@/lib/whatsapp";
import { parseWaCommand } from "@/lib/wa-commands";
import { getTicket, getRecentTickets, ticketTitle } from "@/lib/envgate";
import { approveLink, portalLink } from "@/lib/wa-link";

// Helper: fetch a fresh claim with all relations
export async function fetchClaimFresh(supabase: ReturnType<typeof createServiceClient>, claimId: string) {
  const { data } = await supabase
    .from("claims")
    .select(`
      *,
      employee:employees!claims_employee_id_fkey(*),
      manager:employees!claims_manager_id_fkey(*),
      hr:employees!claims_hr_id_fkey(*),
      trips(*)
    `)
    .eq("id", claimId)
    // Urutan sama dengan LIST — nomor trip konsisten di semua pesan
    .order("trip_date", { referencedTable: "trips", ascending: true })
    .single();
  return data;
}

// Helper: send WA and log result
export async function sendAndLog(
  supabase: ReturnType<typeof createServiceClient>,
  claimId: string,
  phone: string,
  message: string,
  messageType: string
): Promise<boolean> {
  const result = await sendTextMessage(phone, message);

  await supabase.from("whatsapp_logs").insert({
    claim_id: claimId,
    phone_number: phone,
    message_type: messageType,
    status: result.success ? "SENT" : "FAILED",
    response: result.success ? message.slice(0, 200) : (result.error || "Unknown error"),
  });

  if (!result.success) {
    console.error(`[WA] FAILED to send ${messageType} to ${phone} for claim ${claimId}: ${result.error}`);
  }

  return result.success;
}

/** Update klaim yang wajib berhasil — error dilempar supaya pengirim dibalas
 *  "gagal" alih-alih diberi kabar bohong "tersimpan" (update DB bisa gagal
 *  karena blip jaringan/koneksi DB, dan selama ini error-nya ditelan diam). */
async function mustUpdateClaim(
  supabase: ReturnType<typeof createServiceClient>,
  claimId: string,
  patch: Record<string, unknown>
) {
  const { error } = await supabase.from("claims").update(patch).eq("id", claimId);
  if (error) throw new Error(`Gagal update klaim: ${error.message}`);
}

/** Catat masalah alur sebagai komentar klaim — HR melihatnya di timeline
 *  dan bisa ambil tindakan (mis. kirim ulang pesan dari halaman klaim). */
export async function flowAlert(
  supabase: ReturnType<typeof createServiceClient>,
  claimId: string,
  message: string
) {
  try {
    await supabase.from("comments").insert({
      claim_id: claimId,
      message: `[PERINGATAN SISTEM] ${message}`,
      author_name: "Sistem",
      author_role: "SYSTEM",
    });
  } catch (e) {
    console.error("[FLOW] flowAlert gagal ditulis:", e);
  }
}

// ==========================================
// Penggantian trip "tidak sesuai" — karyawan transfer biaya trip ke
// rekening kantor; trip keluar dari klaim setelah HR konfirmasi uang masuk.
// ==========================================

export type RefundRow = {
  id: string;
  trip_id: string | null;
  trip_no: number;
  trip_date: string | null;
  pickup: string | null;
  dropoff: string | null;
  amount: number;
  reason: string;
  status: string; // REQUESTED | CLAIMED | CONFIRMED | CANCELLED
  /** PENDING = karyawan membela perjalanan, menunggu keputusan manager */
  manager_status?: string | null;
  employee_note: string | null;
  claimed_at: string | null;
  /** Bukti transfer otomatis dari WhatsApp (bucket private) */
  proof_path?: string | null;
};

function rupiah(n: number | string): string {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

/** Penggantian yang masih berjalan (belum dikonfirmasi / dibatalkan HR). */
export async function activeRefunds(
  supabase: ReturnType<typeof createServiceClient>,
  claimId: string
): Promise<RefundRow[]> {
  const { data, error } = await supabase
    .from("trip_refunds")
    .select("*")
    .eq("claim_id", claimId)
    .in("status", ["REQUESTED", "CLAIMED"]);
  if (error) throw new Error(`Gagal membaca data penggantian: ${error.message}`);
  return (data || []) as RefundRow[];
}

/** Rekening kantor dari app_settings — null kalau HR belum mengisinya. */
export async function getCompanyBank(
  supabase: ReturnType<typeof createServiceClient>
): Promise<CompanyBank | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["company_bank_name", "company_account_number", "company_account_name"]);
  const m = Object.fromEntries(
    (data || []).map((r: { key: string; value: string }) => [r.key, r.value])
  );
  const bank: CompanyBank = {
    bank_name: m.company_bank_name || "",
    account_number: m.company_account_number || "",
    account_name: m.company_account_name || "",
  };
  return bank.account_number ? bank : null;
}

/** Pesan penahan: klaim tidak boleh maju selama penggantian belum selesai.
 *  Penerima bisa karyawan (yang harus transfer) atau approver (yang diminta
 *  menunggu) — teksnya dibedakan supaya manager tidak disuruh transfer. */
function refundHoldMessage(refunds: RefundRow[], viewer: "EMPLOYEE" | "APPROVER"): string {
  const total = refunds.reduce((a, r) => a + Number(r.amount), 0);
  const statusText = (r: RefundRow) => {
    if (r.status === "CLAIMED") {
      return viewer === "EMPLOYEE" ? "lagi dicek HR." : "sedang dicek HR.";
    }
    if (r.manager_status === "PENDING") {
      return viewer === "EMPLOYEE"
        ? "menunggu keputusan manager atas alasan Anda."
        : "menunggu keputusan manager (karyawan membela perjalanan).";
    }
    return viewer === "EMPLOYEE"
      ? "masih menunggu transfer Anda."
      : "menunggu transfer karyawan.";
  };
  const lines = refunds.map(
    (r) => `Perjalanan nomor ${r.trip_no} sebesar ${rupiah(r.amount)}, ${statusText(r)}`
  );
  if (viewer === "APPROVER") {
    return [
      `*Klaim Belum Bisa Disetujui*`,
      ``,
      `Masih ada penggantian ke rekening kantor yang belum selesai:`,
      ``,
      ...lines,
      ``,
      `Totalnya *${rupiah(total)}*.`,
      ``,
      `Setelah karyawan menyelesaikan transfer dan HR memvalidasi buktinya, klaim ini bisa Anda setujui lagi dari antrean. Tidak perlu membalas pesan ini.`,
    ].join("\n");
  }
  return [
    `*Klaim Ditahan*`,
    ``,
    `Sepertinya masih ada penggantian yang belum selesai, jadi klaimnya belum bisa lanjut dulu ya.`,
    ``,
    ...lines,
    ``,
    `Totalnya *${rupiah(total)}*.`,
    ``,
    `Buka link klaim Anda untuk melihat rekening kantor, unggah bukti transfer, lalu tekan tombol "Saya sudah transfer".`,
  ].join("\n");
}

/** Perintah chat penggantian (SUDAH TF / BELUM TF / NOREK). Status dibaca
 *  dari data sebenarnya — jalan baik di fase awal maupun fase revisi. */
async function handleRefundChat(
  supabase: ReturnType<typeof createServiceClient>,
  claim: ClaimWithRelations,
  cmd:
    | { type: "REFUND_CLAIM"; note: string }
    | { type: "REFUND_UNCLAIM" }
    | { type: "REFUND_INFO" },
  employeePhone: string | null
) {
  if (!employeePhone) return;
  const refunds = await activeRefunds(supabase, claim.id);
  const hrPhone = normalizePhone(claim.hr?.phone_number);

  if (cmd.type === "REFUND_INFO") {
    if (refunds.length === 0) {
      await sendAndLog(
        supabase, claim.id, employeePhone,
        [`*Tidak Ada Penggantian*`, ``, `Belum ada penggantian yang menunggu untuk klaim ini.`, ``, `Ketik LIST kalau mau melihat daftar perjalanan.`].join("\n"),
        "REFUND_NONE"
      );
      return;
    }
    const bank = await getCompanyBank(supabase);
    await sendAndLog(
      supabase, claim.id, employeePhone,
      buildRefundInfoMessage({ period: claim.period, refunds, bank }),
      "REFUND_INFO"
    );
    return;
  }

  if (cmd.type === "REFUND_CLAIM") {
    const claimed = refunds.filter((r) => r.status === "CLAIMED");
    // Yang menunggu keputusan manager (karyawan membela perjalanan) tidak
    // ikut dicatat transfer — keputusannya belum keluar.
    const requested = refunds.filter(
      (r) => r.status === "REQUESTED" && r.manager_status !== "PENDING"
    );
    const waitingManager = refunds.filter(
      (r) => r.status === "REQUESTED" && r.manager_status === "PENDING"
    );
    if (claimed.length > 0 && requested.length === 0) {
      const at = claimed[0]!.claimed_at
        ? new Date(claimed[0]!.claimed_at!).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })
        : "-";
      await sendAndLog(
        supabase, claim.id, employeePhone,
        [
          `*Sudah Tercatat*`,
          ``,
          `Sudah kami catat ya, pada ${at}. HR sedang mencocokkannya dengan mutasi rekening.`,
          ``,
          `Kalau itu keliru, balas *BELUM TF*.`,
        ].join("\n"),
        "REFUND_ALREADY_CLAIMED"
      );
      return;
    }
    if (requested.length === 0) {
      await sendAndLog(
        supabase, claim.id, employeePhone,
        waitingManager.length > 0
          ? [
              `*Masih Menunggu Keputusan Manager*`,
              ``,
              `Alasan Anda untuk trip no ${waitingManager.map((r) => r.trip_no).join(", ")} sedang diputuskan manager. Kalau ditolak, barulah transfer ${rupiah(waitingManager.reduce((a, r) => a + Number(r.amount), 0))} ke rekening kantor.`,
            ].join("\n")
          : [`*Tidak Ada Penggantian*`, ``, `Belum ada penggantian yang menunggu untuk klaim ini.`, ``, `Ketik LIST kalau mau melihat daftar perjalanan.`].join("\n"),
        waitingManager.length > 0 ? "REFUND_WAIT_MANAGER" : "REFUND_NONE"
      );
      return;
    }
    const total = requested.reduce((a, r) => a + Number(r.amount), 0);
    const { error } = await supabase
      .from("trip_refunds")
      .update({ status: "CLAIMED", claimed_at: new Date().toISOString(), employee_note: cmd.note || null })
      .in("id", requested.map((r) => r.id));
    if (error) throw new Error(`Gagal mencatat penggantian: ${error.message}`);

    await supabase.from("comments").insert({
      claim_id: claim.id,
      message: `Karyawan menyatakan SUDAH TRANSFER penggantian ${rupiah(total)} untuk trip no ${requested
        .map((r) => r.trip_no)
        .join(", ")}${cmd.note ? ` (${cmd.note})` : ""}. Menunggu pengecekan HR.`,
      author_name: claim.employee?.employee_name || "Karyawan",
      author_role: "EMPLOYEE",
    });
    await sendAndLog(
      supabase, claim.id, employeePhone,
      buildRefundClaimedMessage(total, requested.length),
      "REFUND_CLAIMED"
    );
    if (hrPhone) {
      const sent = await sendAndLog(
        supabase, claim.id, hrPhone,
        buildRefundClaimedHrMessage({
          employee_name: claim.employee?.employee_name || "Karyawan",
          period: claim.period,
          total,
          trip_nos: requested.map((r) => r.trip_no),
          note: cmd.note,
        }),
        "REFUND_CLAIMED_HR"
      );
      if (!sent) {
        await flowAlert(supabase, claim.id, `Notifikasi "sudah transfer" gagal terkirim ke HR — cek penggantian klaim ini secara manual.`);
      }
    }
    return;
  }

  // REFUND_UNCLAIM — karyawan salah kirim / ternyata belum transfer
  const claimed = refunds.filter((r) => r.status === "CLAIMED");
  if (claimed.length === 0) {
    await sendAndLog(
      supabase, claim.id, employeePhone,
      `*Tidak Ada Pencatatan*\n\nTidak ada status sudah transfer yang perlu dibatalkan.`,
      "REFUND_NONE"
    );
    return;
  }
  const { error } = await supabase
    .from("trip_refunds")
    .update({ status: "REQUESTED", claimed_at: null })
    .in("id", claimed.map((r) => r.id));
  if (error) throw new Error(`Gagal membatalkan penggantian: ${error.message}`);
  await supabase.from("comments").insert({
    claim_id: claim.id,
    message: `Karyawan MEMBATALKAN pernyataan sudah transfer (trip no ${claimed
      .map((r) => r.trip_no)
      .join(", ")}) — kembali menunggu transfer.`,
    author_name: claim.employee?.employee_name || "Karyawan",
    author_role: "EMPLOYEE",
  });
  await sendAndLog(supabase, claim.id, employeePhone, buildRefundUnclaimedMessage(), "REFUND_UNCLAIMED");
  if (hrPhone) {
    await sendAndLog(
      supabase, claim.id, hrPhone,
      `*Pembayaran Dibatalkan*\n\n${claim.employee?.employee_name || "Karyawan"} membatalkan pernyataan sudah transfer untuk perjalanan nomor ${claimed
        .map((r) => r.trip_no)
        .join(", ")}. Penggantiannya kembali menunggu transfer.`,
      "REFUND_UNCLAIMED_HR"
    );
  }
}

/** INFO — ringkasan status klaim dalam satu balasan (tanpa scroll chat):
 *  periode, progres ticket, penggantian, dan perintah yang relevan. */
async function sendClaimInfo(
  supabase: ReturnType<typeof createServiceClient>,
  claim: ClaimWithRelations,
  role: "EMPLOYEE" | "MANAGER" | "HR",
  phone: string | null,
  refunds: RefundRow[]
) {
  if (!phone) return;
  const trips = await fetchTrips(supabase, claim.id);
  const missingNos = trips.map((t, i) => (t.ticket_id ? null : i + 1)).filter((n) => n != null) as number[];
  const empName = claim.employee?.employee_name || "Karyawan";

  let stage = "";
  let hints: string[] = [];
  if (claim.status === "APPROVED") {
    stage = "selesai, sudah disetujui Manager dan HR.";
    hints = ["Tidak ada yang perlu dilakukan lagi."];
  } else if (refunds.length > 0) {
    stage = "ditahan, masih ada penggantian yang belum selesai.";
    hints = ["Ketik SUDAH TF kalau sudah transfer.", "Ketik NOREK untuk melihat nominal dan rekening kantor."];
  } else if (claim.status === "NEED_REVIEW" && claim.approved_at) {
    if (role === "EMPLOYEE") {
      stage = "menunggu revisi dari Anda (diminta oleh approver).";
      hints = [
        "Ketik LIST untuk melihat daftar perjalanan bernomor.",
        "Ketik TICKET 3 PIM-34285 untuk melampirkan ticket.",
        "Ada yang perlu diluruskan? Balas dengan catatan untuk HR, sebutkan nomor perjalanannya.",
        "Kalau sudah beres, ketik SELESAI. Klaim dikirim ulang ke approver.",
      ];
    } else {
      stage = `menunggu revisi dari karyawan (${empName}).`;
      hints = [`Anda akan menerima pesan klaimnya lagi setelah karyawan mengetik SELESAI.`];
    }
  } else if (role === "MANAGER") {
    stage = "menunggu keputusan Anda sebagai Manager.";
    hints = [
      "Ketik 1 untuk menyetujui dan meneruskan ke HR.",
      "Ketik 2 diikuti alasan untuk meminta revisi. Contoh: 2 nominal perjalanan nomor 3 kurang tepat.",
    ];
  } else if (role === "HR") {
    stage = "menunggu keputusan Anda sebagai HR, persetujuan terakhir.";
    hints = [
      "Ketik 1 untuk menyetujui, klaimnya selesai.",
      "Ketik 2 diikuti alasan untuk meminta revisi. Contoh: 2 nominal perjalanan nomor 3 kurang tepat.",
    ];
  } else {
    stage =
      claim.status === "NEED_REVIEW"
        ? "menunggu pemeriksaan Anda, ada catatan dari Anda sebelumnya."
        : "menunggu konfirmasi Anda.";
    hints = [
      "Ketik 1 kalau semua data sudah benar.",
      "Ketik 3 untuk melihat detail alamat lengkap.",
      "Ketik TICKET 3 PIM-34285 untuk melampirkan ticket EnvGate.",
      "Atau balas dengan tulisan bebas, nanti jadi catatan untuk HR.",
    ];
  }

  await sendAndLog(
    supabase, claim.id, phone,
    buildClaimInfoMessage({
      viewer_role: role,
      employee_name: empName,
      period: claim.period,
      trip_count: trips.length,
      total_amount: claim.total_amount,
      stage,
      ticket_count: trips.length - missingNos.length,
      tickets_missing: missingNos,
      refunds: refunds.map((r) => ({ no: r.trip_no, amount: Number(r.amount), status: r.status })),
      hints,
      category: claim.employee?.category ?? null,
    }),
    "CLAIM_INFO"
  );
}

/** Ttd tersimpan karyawan (dari form employee) — dipakai auto-paraf saat
 *  approve klaim lewat WA/link; null kalau belum pernah menggambar. */
async function storedSignature(
  supabase: ReturnType<typeof createServiceClient>,
  employeeId: string | null
): Promise<string | null> {
  if (!employeeId) return null;
  const { data } = await supabase
    .from("signatures")
    .select("signature")
    .eq("employee_id", employeeId)
    .maybeSingle();
  return data?.signature || null;
}

// Helper: proceed to HR approval or auto-finalize
async function proceedToHrOrFinalize(
  supabase: ReturnType<typeof createServiceClient>,
  claim: NonNullable<Awaited<ReturnType<typeof fetchClaimFresh>>>,
  employeePhone: string | null
) {
  if (claim.hr) {
    const hrPhone = normalizePhone(claim.hr.phone_number);
    if (hrPhone) {
      const sent = await sendAndLog(
        supabase, claim.id, hrPhone,
        buildHrApprovalMessage({
          employee_name: claim.employee?.employee_name || "Karyawan",
          manager_name: claim.manager?.employee_name || "Manager",
          period: claim.period,
          total_amount: claim.total_amount,
          trips: claim.trips || [],
          link: approveLink(claim.id, hrPhone, "HR"),
        }),
        "HR_APPROVAL_PROMPT"
      );
      if (!sent) {
        console.error(`[FLOW] STUCK: Failed to send HR approval to ${hrPhone} for claim ${claim.id}`);
        await flowAlert(supabase, claim.id, "Pesan approval ke HR gagal terkirim (device offline/terbatas). Kirim ulang dari halaman klaim setelah device normal.");
      }
    } else {
      console.error(`[FLOW] STUCK: HR has no phone number for claim ${claim.id}`);
      await flowAlert(supabase, claim.id, "HR klaim ini tidak punya nomor WhatsApp — approval macet. Lengkapi nomor HR di data karyawan.");
    }
  } else {
    // No HR → auto finalize
    await supabase.from("claims").update({ status: "APPROVED", hr_status: "APPROVED" }).eq("id", claim.id);
    if (employeePhone) {
      await sendAndLog(
        supabase, claim.id, employeePhone,
        buildEmployeeStatusUpdateMessage("FINALIZED", "Sistem", "HR", claim.period),
        "EMPLOYEE_STATUS_UPDATE"
      );
    }
  }
}

// ==========================================
// Revision flow — "2 <alasan>" dari Manager/HR
// (bukan reject permanen: klaim kembali ke engineer untuk direvisi,
//  bisa berulang sampai approved di stage manapun)
// ==========================================
type ClaimWithRelations = NonNullable<Awaited<ReturnType<typeof fetchClaimFresh>>>;

async function handleRevisionRequest(
  supabase: ReturnType<typeof createServiceClient>,
  claim: ClaimWithRelations,
  role: "MANAGER" | "HR",
  reason: string,
  approverPhone: string,
  employeePhone: string | null
) {
  const actor = role === "MANAGER" ? claim.manager : claim.hr;
  const actorName = actor?.employee_name || role;

  // Status stage tidak diubah ke REJECTED — tetap PENDING menunggu revisi
  await mustUpdateClaim(supabase, claim.id, {
    status: "NEED_REVIEW",
    pending_wa_change: null,
    ticket_wizard: null,
  });

  await supabase.from("comments").insert({
    claim_id: claim.id,
    message: reason ? `Minta revisi: ${reason}` : "Minta revisi (alasan tidak disertakan).",
    author_name: actorName,
    author_role: role,
  });

  await sendAndLog(
    supabase, claim.id, approverPhone,
    [
      `*Permintaan Revisi*`,
      ``,
      `Terima kasih, permintaan revisinya sudah dicatat dan diteruskan ke ${claim.employee?.employee_name || "karyawan"} lewat WhatsApp.`,
      ``,
      `Alasannya: ${reason || "tidak disertakan"}`,
    ].join("\n"),
    `${role}_REVISION_REQUESTED`
  );

  if (employeePhone) {
    const sent = await sendAndLog(
      supabase, claim.id, employeePhone,
      buildRevisionRequestMessage({
        employee_name: claim.employee?.employee_name || "Karyawan",
        period: claim.period,
        requester_name: actorName,
        requester_role: role,
        reason,
        link: claim.employee ? portalLink(claim.employee.id, employeePhone) : "",
      }),
      "REVISION_REQUEST"
    );
    if (!sent) {
      await flowAlert(supabase, claim.id, `Permintaan revisi gagal terkirim ke karyawan (${claim.employee?.employee_name || "-"}). Kirim ulang / hubungi karyawan setelah device normal.`);
    }
  }
}

// ==========================================
// TICKET — engineer melampirkan bukti ticket EnvGate per trip via chat.
// Validasi keras: ticket yang TIDAK ADA di EnvGate ditolak (tidak disimpan),
// kecuali koneksi EnvGate sedang bermasalah (disimpan + ditandai).
// ==========================================

type TicketWizard = { queue: number[]; i: number };

type WaTripRow = {
  id: string;
  trip_date: string;
  pickup: string;
  dropoff: string;
  fare: number;
  ticket_id: string | null;
};

async function fetchTrips(
  supabase: ReturnType<typeof createServiceClient>,
  claimId: string
): Promise<WaTripRow[]> {
  const { data } = await supabase
    .from("trips")
    .select("*")
    .eq("claim_id", claimId)
    .order("trip_date", { ascending: true });
  return (data || []) as WaTripRow[];
}

function shortPlace(s: string): string {
  const t = (s || "").trim();
  return t.length > 24 ? t.slice(0, 24).replace(/\s+\S*$/, "") + "..." : t;
}

/** "3 dari 8 perjalanan sudah punya ticket, sisa 5 belum." */
function ticketProgress(trips: WaTripRow[]): string {
  const missing = trips.filter((t) => !t.ticket_id).length;
  if (missing === 0) return `Semua ${trips.length} perjalanan sudah punya ticket.`;
  return `${trips.length - missing} dari ${trips.length} perjalanan sudah punya ticket, sisa ${missing} belum.`;
}

/** Validasi ticket ke EnvGate. apiDown=true → API tidak terjangkau (jangan tolak). */
async function verifyInvTicket(ticketId: string) {
  try {
    return { inv: await getTicket(ticketId), apiDown: false };
  } catch {
    return { inv: null, apiDown: true };
  }
}

/** TICKET LIST — daftar ticket EnvGate milik engineer pada bulan periode
 *  klaim, lengkap dengan ID-nya, supaya tahu apa yang didaftarkan. */
async function handleTicketListCommand(
  supabase: ReturnType<typeof createServiceClient>,
  claim: ClaimWithRelations,
  employeePhone: string | null
) {
  if (!employeePhone) return;
  const empName = claim.employee?.employee_name;
  if (!empName) return;
  try {
    // Bulan periode diambil dari trip pertama klaim (period bebas teks,
    // trip_date pasti ISO) — fallback bulan sekarang.
    const trips = claim.trips || [];
    const monthDate = trips.length > 0 ? new Date(trips[0].trip_date) : new Date();
    const recent = await getRecentTickets(null, null);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const mine = recent
      .filter(
        (t) => (t.requester_user?.name || "").toLowerCase() === empName.toLowerCase()
      )
      .filter((t) => {
        if (!t.created_at) return false;
        const d = new Date(String(t.created_at));
        return (
          d.getMonth() === monthDate.getMonth() &&
          d.getFullYear() === monthDate.getFullYear()
        );
      })
      .slice(0, 20)
      .map((t) => {
        const d = t.created_at ? new Date(String(t.created_at)) : null;
        return {
          id: t.pretty_id || `PIM-${t.id}`,
          title: ticketTitle(t) || "-",
          date: d ? `${d.getDate()} ${monthNames[d.getMonth()]}` : null,
        };
      });
    await sendAndLog(
      supabase, claim.id, employeePhone,
      buildEngineerTicketListMessage(mine, empName, claim.period),
      "TICKET_LIST"
    );
  } catch {
    await sendAndLog(
      supabase, claim.id, employeePhone,
      "Koneksi EnvGate sedang terganggu — daftar ticket belum bisa diambil. Coba lagi beberapa saat ya.",
      "TICKET_LIST_ERROR"
    );
  }
}

async function handleTicketCommand(
  supabase: ReturnType<typeof createServiceClient>,
  claim: ClaimWithRelations,
  tripNo: number | null,
  ticketId: string,
  employeePhone: string | null,
  nextHint: string
) {
  if (!employeePhone) return;
  const empName = claim.employee?.employee_name || "Karyawan";
  const trips = await fetchTrips(supabase, claim.id);

  let no = tripNo;
  if (no == null) {
    // "#PIM-34285" telanjang: klaim 1 trip → langsung trip 1; kalau banyak, tanya nomor
    if (trips.length === 1) {
      no = 1;
    } else {
      await sendAndLog(
        supabase, claim.id, employeePhone,
        [
          `*Perlu Nomor Perjalanan*`,
          ``,
          `Klaim ini punya ${trips.length} perjalanan. Ticket-nya untuk perjalanan nomor berapa?`,
          ``,
          `Ketik TICKET lalu nomor perjalanan dan nomor ticketnya.`,
          `Contoh: TICKET 3 PIM-${ticketId}`,
          ``,
          `Atau ketik TICKET SEMUA, nanti diarahkan satu per satu.`,
        ].join("\n"),
        "TICKET_NEED_TRIP_NO"
      );
      return;
    }
  }

  const trip = trips[no - 1];
  if (!trip) {
    await sendAndLog(
      supabase, claim.id, employeePhone,
      `*Nomor Tidak Ada*\n\nNomor perjalanan ${no} tidak ada, yang ada ${trips.length} perjalanan. Ketik LIST untuk melihat daftarnya ya.`,
      "TICKET_INVALID"
    );
    return;
  }

  const { inv, apiDown } = await verifyInvTicket(ticketId);
  if (!apiDown && !inv) {
    await sendAndLog(
      supabase, claim.id, employeePhone,
      [
        `*Ticket Tidak Ditemukan*`,
        ``,
        `Ticket PIM-${ticketId} tidak ditemukan di EnvGate.`,
        `Boleh cek lagi nomornya, lalu kirim ulang TICKET ${no} PIM-<nomor yang benar>.`,
      ].join("\n"),
      "TICKET_NOT_FOUND"
    );
    return;
  }

  await supabase.from("trips").update({ ticket_id: ticketId }).eq("id", trip.id);
  await supabase.from("comments").insert({
    claim_id: claim.id,
    message: `Trip ${no} dilampirkan ticket EnvGate #PIM-${ticketId}${inv ? ` (${ticketTitle(inv)})` : ""} via WhatsApp.`,
    author_name: empName,
    author_role: "EMPLOYEE",
  });

  const fresh = await fetchTrips(supabase, claim.id);
  const stillMissing = fresh.filter((t) => !t.ticket_id).length;
  await sendAndLog(
    supabase, claim.id, employeePhone,
    [
      `*Ticket Tersimpan*`,
      ``,
      `Sudah tersimpan. Perjalanan nomor ${no} sekarang punya ticket PIM-${ticketId}.`,
      inv
        ? `Judul ticketnya: ${ticketTitle(inv)}`
        : `Koneksi EnvGate sedang bermasalah, ticket belum terverifikasi. Nanti HR cek manual ya.`,
      ``,
      ticketProgress(fresh),
      ...(stillMissing > 1
        ? [`Mau lanjut isi sisanya satu per satu? Ketik *TICKET SEMUA*.`]
        : []),
      ``,
      nextHint,
    ].join("\n"),
    "TICKET_SAVED"
  );
}

// ==========================================
// Wizard TICKET SEMUA — isi ticket satu per satu, sulit tertukar
// ==========================================

function wizardPromptLines(trips: WaTripRow[], no: number, remaining: number): string[] {
  const t = trips[no - 1];
  const d = new Date(t.trip_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  return [
    `*Isi Ticket*`,
    ``,
    `Kita isi ticket-nya satu per satu ya, supaya tidak tertukar. Sisa ${remaining} perjalanan lagi.`,
    ``,
    `Perjalanan nomor ${no}, ${d}, dari ${shortPlace(t.pickup)} ke ${shortPlace(t.dropoff)}.`,
    `Kirim nomor ticket untuk perjalanan ini. Contoh: PIM-34285`,
    ``,
    `Ketik *LEWATI* kalau perjalanan ini tidak punya ticket.`,
    `Ketik *BATAL* kalau mau berhenti dulu.`,
  ];
}

async function startTicketWizard(
  supabase: ReturnType<typeof createServiceClient>,
  claim: ClaimWithRelations,
  employeePhone: string | null
) {
  if (!employeePhone) return;
  const trips = await fetchTrips(supabase, claim.id);
  const queue = trips.map((t, i) => (t.ticket_id ? -1 : i + 1)).filter((n) => n > 0);
  if (queue.length === 0) {
    await sendAndLog(
      supabase, claim.id, employeePhone,
      `*Semua Ticket Terisi*\n\nSemua ${trips.length} perjalanan sudah punya ticket. Tidak ada yang perlu diisi.`,
      "TICKET_WIZARD_EMPTY"
    );
    return;
  }
  await supabase.from("claims").update({ ticket_wizard: { queue, i: 0 } }).eq("id", claim.id);
  await sendAndLog(
    supabase, claim.id, employeePhone,
    wizardPromptLines(trips, queue[0]!, queue.length).join("\n"),
    "TICKET_WIZARD_START"
  );
}

async function handleWizardTurn(
  supabase: ReturnType<typeof createServiceClient>,
  claim: ClaimWithRelations,
  wiz: TicketWizard,
  reply: string,
  employeePhone: string | null
) {
  const phone = employeePhone;
  if (!phone) return;
  const empName = claim.employee?.employee_name || "Karyawan";
  const upper = reply.trim().toUpperCase();
  const trips = await fetchTrips(supabase, claim.id);
  const cur = wiz.queue[wiz.i]!;

  const sendWizard = (lines: string[], type: string) =>
    sendAndLog(supabase, claim.id, phone, lines.join("\n"), type);

  const finishHint = claim.approved_at
    ? "Kalau sudah beres semua, ketik SELESAI untuk mengajukan ulang klaimnya."
    : "Ketik 1 kalau semua data sudah benar.";

  const advance = async (prefix: string[] = []) => {
    const nextI = wiz.i + 1;
    if (nextI >= wiz.queue.length) {
      await supabase.from("claims").update({ ticket_wizard: null }).eq("id", claim.id);
      const fresh = await fetchTrips(supabase, claim.id);
      await sendWizard(
        [
          ...prefix,
          `*Ticket Selesai*`,
          ``,
          `Semua perjalanan sudah diproses ticket-nya.`,
          ticketProgress(fresh),
          ``,
          finishHint,
        ],
        "TICKET_WIZARD_DONE"
      );
    } else {
      await supabase
        .from("claims")
        .update({ ticket_wizard: { queue: wiz.queue, i: nextI } })
        .eq("id", claim.id);
      await sendWizard(
        [...prefix, ...wizardPromptLines(trips, wiz.queue[nextI]!, wiz.queue.length - nextI)],
        "TICKET_WIZARD_NEXT"
      );
    }
  };

  if (upper === "BATAL" || upper === "SELESAI") {
    await supabase.from("claims").update({ ticket_wizard: null }).eq("id", claim.id);
    await sendWizard(
      [
        `*Mode Ticket Ditutup*`,
        ``,
        `Baik, mode isi ticket-nya ditutup dulu. ${ticketProgress(trips)}`,
        `Kapan saja bisa dilanjutkan lagi dengan ketik *TICKET SEMUA*.`,
        // SELESAI di sini hanya menutup mode ticket — tanpa catatan ini
        // karyawan mengira klaimnya sudah diajukan ulang (padahal belum).
        ...(upper === "SELESAI"
          ? [
              ``,
              `Oh iya, SELESAI barusan hanya menutup mode isi ticket. Klaimnya belum diajukan ulang ya.`,
              `Kalau maksudnya mengajukan ulang, ketik *SELESAI* sekali lagi.`,
            ]
          : []),
      ],
      "TICKET_WIZARD_CANCELLED"
    );
    return;
  }

  if (upper === "LEWATI" || upper === "SKIP") {
    await advance();
    return;
  }

  const cmd = parseWaCommand(reply);
  if (cmd.type === "TICKET_ID" || cmd.type === "TICKET") {
    const no = cmd.type === "TICKET" ? cmd.tripNo : cur;
    const trip = trips[no - 1];
    if (!trip) {
      await sendWizard(
        [`*Nomor Tidak Ada*`, ``, `Nomor perjalanan ${no} tidak ada, yang ada ${trips.length} perjalanan.`],
        "TICKET_INVALID"
      );
      return;
    }
    const { inv, apiDown } = await verifyInvTicket(cmd.ticketId);
    if (!apiDown && !inv) {
      await sendWizard(
        [
          `*Ticket Tidak Ditemukan*`,
          ``,
          `Ticket PIM-${cmd.ticketId} tidak ditemukan di EnvGate.`,
          `Kirim nomor yang benar untuk perjalanan ${no}, contohnya PIM-34285. Atau ketik *LEWATI*.`,
        ],
        "TICKET_NOT_FOUND"
      );
      return;
    }

    await supabase.from("trips").update({ ticket_id: cmd.ticketId }).eq("id", trip.id);
    await supabase.from("comments").insert({
      claim_id: claim.id,
      message: `Trip ${no} dilampirkan ticket EnvGate #PIM-${cmd.ticketId}${inv ? ` (${ticketTitle(inv)})` : ""} via WhatsApp (mode isi ticket).`,
      author_name: empName,
      author_role: "EMPLOYEE",
    });

    if (no === cur) {
      await advance([
        `*Ticket Tersimpan*`,
        ``,
        `Sudah tersimpan. Perjalanan nomor ${no} sekarang punya ticket PIM-${cmd.ticketId}.`,
        inv ? `Judul ticketnya: ${ticketTitle(inv)}` : "",
      ].filter(Boolean));
    } else {
      // Ticket untuk trip lain — simpan, wizard tetap di trip saat ini
      await sendWizard(
        [
          `*Ticket Tersimpan*`,
          ``,
          `Sudah tersimpan. Perjalanan nomor ${no} sekarang punya ticket PIM-${cmd.ticketId}.`,
          ...wizardPromptLines(trips, cur, wiz.queue.length - wiz.i),
        ],
        "TICKET_SAVED"
      );
    }
    return;
  }

  // Balasan lain — ulangi instruksi trip saat ini
  await sendWizard(wizardPromptLines(trips, cur, wiz.queue.length - wiz.i), "TICKET_WIZARD_HELP");
}

// ==========================================
// Revision flow — command engineer via chat
// LIST / TICKET <no> <id> / SELESAI / teks bebas → note.
// UBAH/HAPUS dipensiunkan: data klaim langsung dari statement Grab,
// koreksi cukup lewat catatan untuk HR (HR memproses di web).
// ==========================================

/** Balasan untuk percobaan UBAH/HAPUS/YA/BATAL — arahkan ke catatan. */
function dataLockedMessage(what: string): string {
  return [
    `*Data Tidak Bisa Diubah*`,
    ``,
    `Maaf, ${what} tidak bisa lewat chat ya. Data perjalanan langsung dari statement Grab Business.`,
    ``,
    `Kalau ada yang perlu diluruskan, balas dengan catatan untuk HR — sebutkan nomor perjalanannya, nanti HR yang memproses.`,
    `Contoh: perjalanan nomor 3 bukan perjalanan saya`,
    ``,
    `Ketik LIST untuk melihat daftar perjalanan bernomor.`,
    ``,
    `Kalau sudah beres, ketik *SELESAI*.`,
  ].join("\n");
}

async function handleRevisionCommands(
  supabase: ReturnType<typeof createServiceClient>,
  claim: ClaimWithRelations,
  reply: string,
  employeePhone: string | null,
  refunds: RefundRow[]
) {
  if (!employeePhone) return;
  const empName = claim.employee?.employee_name || "Karyawan";
  const cmd = parseWaCommand(reply);

  // Saat revisi, "1" bukan setuju lagi — klaim sudah pernah dikonfirmasi.
  // Tanpa guard ini "1" malah tersimpan jadi catatan.
  if (cmd.type === "APPROVE") {
    await sendAndLog(
      supabase, claim.id, employeePhone,
      [
        `*Sedang Masa Revisi*`,
        ``,
        `Klaim ini sedang menunggu revisi dari Anda ya.`,
        `Kalau sudah beres, ketik *SELESAI* supaya klaimnya dikirim ulang ke approver.`,
      ].join("\n"),
      "REVISION_INVALID"
    );
    return;
  }

  // Perintah penggantian trip "tidak sesuai" (SUDAH TF / BELUM TF / NOREK)
  if (cmd.type === "REFUND_CLAIM" || cmd.type === "REFUND_UNCLAIM" || cmd.type === "REFUND_INFO") {
    await handleRefundChat(supabase, claim, cmd, employeePhone);
    return;
  }

  if (cmd.type === "LIST" || cmd.type === "DETAIL") {
    const { data: trips } = await supabase.from("trips").select("*").eq("claim_id", claim.id).order("trip_date", { ascending: true });
    await sendAndLog(supabase, claim.id, employeePhone, buildRevisionTripListMessage(trips || [], claim.total_amount, claim.period, claim.employee?.category ?? null), "REVISION_LIST");
    return;
  }

  // TICKET LIST — engineer minta daftar ID ticket miliknya periode ini
  if (cmd.type === "TICKET_LIST") {
    await handleTicketListCommand(supabase, claim, employeePhone);
    return;
  }

  // UBAH — dipensiunkan: data klaim langsung dari statement Grab.
  if (cmd.type === "CHANGE" || cmd.type === "BAD_CHANGE") {
    await sendAndLog(supabase, claim.id, employeePhone, dataLockedMessage("mengubah nominal"), "REVISION_INVALID");
    return;
  }

  // YA / BATAL — konfirmasi ubah/hapus sudah tidak ada; bersihkan sisa
  // pending_wa_change lama (kalau ada) supaya tidak menggantung.
  if (cmd.type === "CONFIRM" || cmd.type === "CANCEL") {
    if (claim.pending_wa_change) {
      await supabase.from("claims").update({ pending_wa_change: null }).eq("id", claim.id);
    }
    await sendAndLog(supabase, claim.id, employeePhone, dataLockedMessage("mengubah atau menghapus data"), "REVISION_INVALID");
    return;
  }

  if (cmd.type === "DONE") {
    // Penggantian belum selesai — klaim ditahan (tidak boleh diajukan ulang)
    if (refunds.length > 0) {
      await sendAndLog(supabase, claim.id, employeePhone, refundHoldMessage(refunds, "EMPLOYEE"), "REFUND_HOLD");
      return;
    }
    // Manager sudah approved → kembali ke HR; belum → kembali ke Manager
    const targetRole: "MANAGER" | "HR" = claim.manager_status === "APPROVED" ? "HR" : "MANAGER";
    await supabase.from("comments").insert({
      claim_id: claim.id,
      message: `Revisi selesai — klaim diajukan ulang ke ${targetRole === "HR" ? "HR" : "Manager"}.`,
      author_name: empName,
      author_role: "EMPLOYEE",
    });
    await mustUpdateClaim(supabase, claim.id, {
      status: "SENT",
      pending_wa_change: null,
      ticket_wizard: null,
    });

    const fresh = await fetchClaimFresh(supabase, claim.id);
    if (fresh) {
      if (targetRole === "MANAGER" && fresh.manager) {
        const mgrPhone = normalizePhone(fresh.manager.phone_number);
        if (mgrPhone) {
          await sendAndLog(
            supabase, claim.id, mgrPhone,
            buildManagerApprovalMessage({
              employee_name: fresh.employee?.employee_name || "Karyawan",
              period: fresh.period,
              total_amount: fresh.total_amount,
              trips: fresh.trips || [],
              revised: true,
              link: approveLink(fresh.id, mgrPhone, "MANAGER"),
            }),
            "MANAGER_APPROVAL_PROMPT"
          );
        }
      } else {
        // HR stage, atau klaim tanpa manager → langsung HR/finalisasi
        await proceedToHrOrFinalize(supabase, fresh, employeePhone);
      }
    }
    await sendAndLog(supabase, claim.id, employeePhone, buildResubmittedMessage(targetRole), "REVISION_RESUBMITTED");
    return;
  }

  // HAPUS — dipensiunkan; kecuali trip ditandai "tidak sesuai": itu hanya
  // bisa selesai lewat jalur penggantian (transfer + SUDAH TF).
  if (cmd.type === "DROP" || cmd.type === "BAD_DROP") {
    if (cmd.type === "DROP") {
      const { data: trips } = await supabase.from("trips").select("*").eq("claim_id", claim.id).order("trip_date", { ascending: true });
      const trip = (trips || [])[cmd.tripNo - 1];
      if (trip && refunds.some((r) => r.trip_id === trip.id)) {
        await sendAndLog(
          supabase, claim.id, employeePhone,
          [
            `*Tidak Bisa Dihapus*`,
            ``,
            `Perjalanan nomor ${cmd.tripNo} ditandai tidak sesuai oleh HR, jadi tidak bisa dihapus sendiri.`,
            `Biayanya harus diganti: transfer ke rekening kantor lalu balas *SUDAH TF*.`,
            `Setelah uangnya diterima HR, perjalanan ini otomatis keluar dari klaim.`,
            ``,
            `Mau lihat nominal dan rekeningnya? Balas *NOREK*.`,
          ].join("\n"),
          "REVISION_INVALID"
        );
        return;
      }
    }
    await sendAndLog(supabase, claim.id, employeePhone, dataLockedMessage("menghapus perjalanan"), "REVISION_INVALID");
    return;
  }

  if (cmd.type === "TICKET" || cmd.type === "TICKET_ID") {
    await handleTicketCommand(
      supabase, claim,
      cmd.type === "TICKET" ? cmd.tripNo : null,
      cmd.ticketId,
      employeePhone,
      "Ada yang perlu diluruskan? Balas dengan catatan untuk HR, sebutkan nomor perjalanannya. Kalau sudah beres, ketik SELESAI."
    );
    return;
  }

  if (cmd.type === "TICKET_WIZARD") {
    await startTicketWizard(supabase, claim, employeePhone);
    return;
  }

  if (cmd.type === "BAD_TICKET") {
    await sendAndLog(
      supabase, claim.id, employeePhone,
      "*Format Salah*\n\nFormat ticketnya belum tepat. Contoh yang benar: TICKET 3 PIM-34285",
      "TICKET_INVALID"
    );
    return;
  }

  // NOTE / lainnya → catatan pada klaim (dengan umpan balik jelas)
  const noteText = cmd.type === "NOTE" ? cmd.text : reply;
  const { error: noteErr } = await supabase.from("comments").insert({
    claim_id: claim.id,
    message: noteText,
    author_name: empName,
    author_role: "EMPLOYEE",
  });
  if (noteErr) throw new Error(`Catatan gagal tersimpan: ${noteErr.message}`);
  await sendAndLog(
    supabase, claim.id, employeePhone,
    buildNoteSavedMessage(
      noteText,
      "Ada lagi yang perlu diluruskan? Tulis catatan lain. Kalau sudah beres, ketik SELESAI."
    ),
    "REVISION_NOTE"
  );
}

// ==========================================
// Main processing logic — dipanggil webhook (via after()) dan
// API tombol web (/api/wa/action). `reply` memakai format yang sama
// dengan balasan chat: "1" = setuju, "2 <alasan>" = minta revisi,
// teks bebas = catatan.
// ==========================================
export async function processWebhookReply(
  claim: ClaimWithRelations,
  role: string,
  reply: string,
  phoneNumber: string,
) {
  const supabase = createServiceClient();
  // Kondisi TERBARU: klaim yang dibawa webhook bisa snapshot detik-detik lalu
  // (race dua balasan hampir bersamaan) — keputusan diambil dari data terkini.
  const freshClaim = await fetchClaimFresh(supabase, claim.id);
  if (freshClaim) claim = freshClaim;
  const employeePhone = normalizePhone(claim.employee?.phone_number);
  // Penggantian aktif menahan klaim — dibaca sekali, dipakai semua guard
  const refunds = await activeRefunds(supabase, claim.id);

  try {
    // ==========================================
    // ROLE: EMPLOYEE
    // ==========================================
    if (role === 'EMPLOYEE') {
      // Mode isi ticket satu-per-satu aktif → tangani duluan, KECUALI balasan
      // yang merupakan keputusan/perintah lain (1/2/HAPUS/UBAH/YA/SUDAH TF...).
      // Tanpa ini wizard menelan "1" — klaim tidak pernah disetujui padahal
      // halaman web sudah menampilkan "tercatat SETUJU" (sukses bohong).
      const wiz = claim.ticket_wizard as TicketWizard | null;
      const wizActive =
        wiz != null && Array.isArray(wiz.queue) && wiz.i != null && wiz.i < wiz.queue.length
        && claim.status !== "APPROVED"; // klaim selesai = mode ticket hangus
      const parsedCmd = parseWaCommand(reply);
      const isDecision = new Set([
        "APPROVE", "REVISE", "DROP", "CHANGE", "CONFIRM",
        "REFUND_CLAIM", "REFUND_UNCLAIM", "REFUND_INFO",
      ]).has(parsedCmd.type);
      // INFO: ringkasan status — selalu tersedia, bahkan di tengah mode ticket
      if (parsedCmd.type === "INFO") {
        await sendClaimInfo(supabase, claim, "EMPLOYEE", employeePhone, refunds);
      } else if (wizActive && wiz && !isDecision) {
        await handleWizardTurn(supabase, claim, wiz, reply, employeePhone);
      } else {
      // Keputusan menang atas mode isi ticket: tutup wizard dulu, lalu proses
      if (wizActive && isDecision) {
        await supabase.from("claims").update({ ticket_wizard: null }).eq("id", claim.id);
        if (employeePhone) {
          await sendAndLog(
            supabase, claim.id, employeePhone,
            `*Mode Ticket Ditutup*\n\nOh iya, mode isi ticket-nya kami tutup dulu karena Anda mengirim perintah lain. Nanti bisa dilanjutkan lagi dengan ketik *TICKET SEMUA*.`,
            "TICKET_WIZARD_AUTOCLOSE"
          );
        }
      }
      // Fase revisi: klaim sudah dikonfirmasi engineer tapi diminta revisi
      if (claim.status === 'NEED_REVIEW' && claim.approved_at) {
        await handleRevisionCommands(supabase, claim, reply, employeePhone, refunds);
      } else if (reply === "1" && refunds.length > 0) {
        // Ada penggantian belum selesai — konfirmasi ditahan
        if (employeePhone) {
          await sendAndLog(supabase, claim.id, employeePhone, refundHoldMessage(refunds, "EMPLOYEE"), "REFUND_HOLD");
        }
      } else if (reply === "1") {
        const hasManager = !!claim.manager;
        await mustUpdateClaim(supabase, claim.id, {
          approved_at: new Date().toISOString(),
          manager_status: hasManager ? "PENDING" : "APPROVED",
          hr_status: "PENDING",
          ticket_wizard: null,
        });

        const confirmMsg = buildConfirmationMessage(hasManager ? claim.manager.employee_name : undefined, claim.period);
        if (employeePhone) {
          await sendAndLog(supabase, claim.id, employeePhone, confirmMsg, "EMPLOYEE_CONFIRMATION");
        }

        if (hasManager) {
          const mgrPhone = normalizePhone(claim.manager.phone_number);
          if (mgrPhone) {
            const sent = await sendAndLog(
              supabase, claim.id, mgrPhone,
              buildManagerApprovalMessage({
                employee_name: claim.employee.employee_name,
                period: claim.period,
                total_amount: claim.total_amount,
                trips: claim.trips || [],
                link: approveLink(claim.id, mgrPhone, "MANAGER"),
              }),
              "MANAGER_APPROVAL_PROMPT"
            );
            if (!sent) {
              console.error(`[FLOW] STUCK: Failed to send manager approval to ${mgrPhone} for claim ${claim.id}`);
              await flowAlert(supabase, claim.id, "Pesan approval ke Manager gagal terkirim (device offline/terbatas). Kirim ulang dari halaman klaim setelah device normal.");
            }
          }
        } else {
          await supabase.from("claims").update({ manager_status: "APPROVED" }).eq("id", claim.id);
          const freshClaim = await fetchClaimFresh(supabase, claim.id);
          if (freshClaim) {
            await proceedToHrOrFinalize(supabase, freshClaim, employeePhone);
          }
        }

      } else if (reply === "2") {
        await mustUpdateClaim(supabase, claim.id, { status: "NEED_REVIEW" });
        if (employeePhone) {
          await sendAndLog(supabase, claim.id, employeePhone, buildCorrectionPrompt(), "CORRECTION_PROMPT");
        }
      } else if (reply === "3") {
        const { data: trips } = await supabase.from("trips").select("*").eq("claim_id", claim.id).order("trip_date", { ascending: true });
        if (trips && trips.length > 0 && employeePhone) {
          await sendAndLog(supabase, claim.id, employeePhone, buildDetailMessage(trips, claim.total_amount, claim.employee?.category ?? null), "DETAIL_MESSAGE");
        }
      } else {
        // TICKET/LIST juga bisa dipakai sebelum konfirmasi (mode awal);
        // selain itu teks bebas → jadi catatan (SELALU balas — test user:
        // catatan dulu tersimpan diam-diam, pengirim tidak tahu kalau berhasil).
        const cmd = parseWaCommand(reply);
        if (cmd.type === "TICKET" || cmd.type === "TICKET_ID") {
          await handleTicketCommand(
            supabase, claim,
            cmd.type === "TICKET" ? cmd.tripNo : null,
            cmd.ticketId,
            employeePhone,
            "Ketik 1 kalau semua data sudah benar."
          );
        } else if (cmd.type === "TICKET_WIZARD") {
          await startTicketWizard(supabase, claim, employeePhone);
        } else if (cmd.type === "TICKET_LIST") {
          await handleTicketListCommand(supabase, claim, employeePhone);
        } else if (cmd.type === "LIST" && employeePhone) {
          await sendAndLog(
            supabase, claim.id, employeePhone,
            buildRevisionTripListMessage(claim.trips || [], claim.total_amount, claim.period, claim.employee?.category ?? null),
            "REVISION_LIST"
          );
        } else if (cmd.type === "BAD_TICKET") {
          if (employeePhone) {
            await sendAndLog(
              supabase, claim.id, employeePhone,
              "*Format Salah*\n\nFormat ticketnya belum tepat. Contoh yang benar: TICKET 3 PIM-34285",
              "TICKET_INVALID"
            );
          }
        } else if (
          cmd.type === "DROP" || cmd.type === "BAD_DROP" ||
          cmd.type === "CHANGE" || cmd.type === "BAD_CHANGE"
        ) {
          // UBAH/HAPUS dipensiunkan — data klaim langsung dari statement Grab.
          if (employeePhone) {
            await sendAndLog(
              supabase, claim.id, employeePhone,
              [
                `*Data Tidak Bisa Diubah*`,
                ``,
                `Maaf, ubah atau hapus perjalanan tidak bisa lewat chat ya. Data klaim langsung dari statement Grab Business.`,
                ``,
                `Kalau ada yang salah, ketik *2* lalu ceritakan masalahnya — tulisan Anda jadi catatan untuk HR.`,
                `Atau ketik *1* kalau semua data sudah benar.`,
              ].join("\n"),
              "INVALID_REPLY"
            );
          }
        } else if (cmd.type === "REFUND_CLAIM" || cmd.type === "REFUND_UNCLAIM" || cmd.type === "REFUND_INFO") {
          // Penggantian bisa terjadi di fase mana pun (HR bisa menandai trip
          // sebelum karyawan konfirmasi) — status dibaca dari data sebenarnya.
          await handleRefundChat(supabase, claim, cmd, employeePhone);
        } else if (employeePhone && reply.replace(/\s/g, "").length < 3) {
          // "eh", "?", "y" — bukan catatan, arahkan ke menu
          await sendAndLog(supabase, claim.id, employeePhone, buildEmployeeHelpMessage(claim.employee?.category ?? null), "INVALID_REPLY");
        } else if (employeePhone) {
          const { error: noteErr } = await supabase.from("comments").insert({ claim_id: claim.id, message: reply });
          if (noteErr) throw new Error(`Catatan gagal tersimpan: ${noteErr.message}`);
          if (claim.status !== "NEED_REVIEW") {
            await mustUpdateClaim(supabase, claim.id, { status: "NEED_REVIEW" });
          }
          await sendAndLog(
            supabase, claim.id, employeePhone,
            buildNoteSavedMessage(
              reply,
              "Ketik 1 kalau semua data sudah benar, 3 untuk lihat detail, atau tulis catatan lain."
            ),
            "EMPLOYEE_NOTE"
          );
        }
      }
      } // akhir else (wizard tidak aktif / keputusan menang)
    }

    // ==========================================
    // ROLE: MANAGER
    // ==========================================
    else if (role === 'MANAGER') {
      if (parseWaCommand(reply).type === "INFO") {
        await sendClaimInfo(supabase, claim, "MANAGER", phoneNumber, refunds);
      } else if (reply === "1" && refunds.length > 0) {
        // Penggantian belum selesai — approval ditahan
        await sendAndLog(supabase, claim.id, phoneNumber, refundHoldMessage(refunds, "APPROVER"), "REFUND_HOLD");
      } else if (reply === "1") {
        // Paraf otomatis dari ttd tersimpan — tanpa ini approve via WA/link
        // tidak menyimpan ttd dan kotak paraf di Report PDF kosong
        let mgrSig = claim.manager_signature || null;
        if (!mgrSig) mgrSig = await storedSignature(supabase, claim.manager_id);
        await mustUpdateClaim(supabase, claim.id, {
          manager_status: "APPROVED",
          ...(mgrSig ? { manager_signature: mgrSig } : {}),
          ticket_wizard: null,
        });
        await sendAndLog(
          supabase, claim.id, phoneNumber,
          [
            `*Klaim Disetujui*`,
            ``,
            `Terima kasih. Klaim atas nama ${claim.employee?.employee_name || "karyawan"} periode ${claim.period} sudah Anda setujui.`,
            ``,
            // Tanpa HR di klaim ini alur langsung final — jangan bilang
            // "diteruskan ke HR" kalau tidak ada yang diteruskan.
            claim.hr
              ? `Sekarang diteruskan ke HR untuk persetujuan terakhir.`
              : `Klaim langsung selesai — karyawan ini tidak terdaftar punya HR.`,
          ].join("\n"),
          "MANAGER_CONFIRMED"
        );

        if (employeePhone) {
          await sendAndLog(
            supabase, claim.id, employeePhone,
            buildEmployeeStatusUpdateMessage("APPROVED", claim.manager?.employee_name || "Manager", "MANAGER", claim.period),
            "EMPLOYEE_STATUS_UPDATE"
          );
        }

        const freshClaim = await fetchClaimFresh(supabase, claim.id);
        if (freshClaim) {
          await proceedToHrOrFinalize(supabase, freshClaim, employeePhone);
        }

      } else {
        const cmd = parseWaCommand(reply);
        // LIST/DETAIL — approver bisa melihat ulang daftar perjalanan
        // bernomor kapan saja (chat gantung, lupa konteks klaim).
        if (cmd.type === "LIST" || cmd.type === "DETAIL") {
          const { data: trips } = await supabase.from("trips").select("*").eq("claim_id", claim.id).order("trip_date", { ascending: true });
          await sendAndLog(
            supabase, claim.id, phoneNumber,
            buildRevisionTripListMessage(trips || [], claim.total_amount, claim.period, claim.employee?.category ?? null, "APPROVER"),
            "APPROVER_LIST"
          );
        } else if (cmd.type === "REVISE") {
          await handleRevisionRequest(supabase, claim, "MANAGER", cmd.reason, phoneNumber, employeePhone);
        } else {
          await sendAndLog(
            supabase, claim.id, phoneNumber,
            [
              `*Bantuan*`,
              ``,
              `Maaf, pesannya belum saya paham.`,
              ``,
              `Ketik *1* untuk menyetujui klaim ini.`,
              `Ketik *2* diikuti alasan untuk meminta revisi. Contoh: 2 nominal perjalanan nomor 3 masih salah.`,
              ``,
              `Ada pertanyaan lain soal klaim ini? Tanyakan langsung ke HR Perkom ya.`,
            ].join("\n"),
            "INVALID_REPLY"
          );
        }
      }
    }

    // ==========================================
    // ROLE: HR
    // ==========================================
    else if (role === 'HR') {
      if (parseWaCommand(reply).type === "INFO") {
        await sendClaimInfo(supabase, claim, "HR", phoneNumber, refunds);
      } else if (reply === "1" && refunds.length > 0) {
        // Penggantian belum selesai — approval ditahan
        await sendAndLog(supabase, claim.id, phoneNumber, refundHoldMessage(refunds, "APPROVER"), "REFUND_HOLD");
      } else if (reply === "1") {
        // Paraf otomatis HR dari ttd tersimpan (sama seperti Manager)
        let hrSig = claim.hr_signature || null;
        if (!hrSig) hrSig = await storedSignature(supabase, claim.hr_id);
        await mustUpdateClaim(supabase, claim.id, {
          hr_status: "APPROVED",
          status: "APPROVED",
          ...(hrSig ? { hr_signature: hrSig } : {}),
          ticket_wizard: null,
        });
        await sendAndLog(
          supabase, claim.id, phoneNumber,
          [
            `*Klaim Selesai*`,
            ``,
            `Terima kasih. Klaim atas nama ${claim.employee?.employee_name || "karyawan"} periode ${claim.period} selesai, sudah disetujui Manager dan HR.`,
            ``,
            `Karyawannya sudah kami kabari.`,
          ].join("\n"),
          "HR_CONFIRMED"
        );
        if (employeePhone) {
          await sendAndLog(
            supabase, claim.id, employeePhone,
            buildEmployeeStatusUpdateMessage("FINALIZED", claim.hr?.employee_name || "HR", "HR", claim.period),
            "EMPLOYEE_STATUS_UPDATE"
          );
        }
      } else {
        const cmd = parseWaCommand(reply);
        // LIST/DETAIL — sama seperti Manager: bisa minta daftar kapan saja
        if (cmd.type === "LIST" || cmd.type === "DETAIL") {
          const { data: trips } = await supabase.from("trips").select("*").eq("claim_id", claim.id).order("trip_date", { ascending: true });
          await sendAndLog(
            supabase, claim.id, phoneNumber,
            buildRevisionTripListMessage(trips || [], claim.total_amount, claim.period, claim.employee?.category ?? null, "APPROVER"),
            "APPROVER_LIST"
          );
        } else if (cmd.type === "REVISE") {
          await handleRevisionRequest(supabase, claim, "HR", cmd.reason, phoneNumber, employeePhone);
        } else {
          await sendAndLog(
            supabase, claim.id, phoneNumber,
            [
              `*Bantuan*`,
              ``,
              `Maaf, pesannya belum saya paham.`,
              ``,
              `Ketik *1* untuk menyetujui, klaimnya selesai.`,
              `Ketik *2* diikuti alasan untuk meminta revisi. Contoh: 2 nominal perjalanan nomor 3 masih salah.`,
              ``,
              `Ada pertanyaan lain soal klaim ini? Tanyakan langsung ke HR Perkom ya.`,
            ].join("\n"),
            "INVALID_REPLY"
          );
        }
      }
    }

    // Log the interaction
    await supabase.from("whatsapp_logs").insert({
      claim_id: claim.id,
      phone_number: phoneNumber,
      message_type: `${role}_REPLY`,
      status: "RECEIVED",
      response: reply,
    });

  } catch (error) {
    console.error(`[FLOW] Error processing ${role} reply for claim ${claim.id}:`, error);
    // Jangan diam — tanpa kabar ini, pengirim mengira aksinya berhasil
    // padahal tidak tersimpan apa-apa.
    try {
      await sendTextMessage(
        phoneNumber,
        [
          `*Kendala Sistem*`,
          ``,
          `Maaf, ada kendala sistem sehingga pesan Anda belum tercatat.`,
          `Coba kirim ulang sebentar lagi ya. Kalau tetap gagal, hubungi HR Perkom.`,
        ].join("\n")
      );
      await supabase.from("whatsapp_logs").insert({
        claim_id: claim.id,
        phone_number: phoneNumber,
        message_type: "FLOW_ERROR",
        status: "SENT",
        response: String(error instanceof Error ? error.message : error).slice(0, 200),
      });
    } catch (e) {
      console.error("[FLOW] Gagal memberi kabar error ke pengirim:", e);
    }
  }
}
