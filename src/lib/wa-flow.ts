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
  buildChangeConfirmMessage,
  buildChangeAppliedMessage,
  buildDropConfirmMessage,
  buildDropAppliedMessage,
  buildResubmittedMessage
} from "@/lib/whatsapp";
import { parseWaCommand } from "@/lib/wa-commands";
import { getTicket, ticketTitle } from "@/lib/envgate";
import { approveLink } from "@/lib/wa-link";

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
async function sendAndLog(
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
async function flowAlert(
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
          action_url: approveLink(claim.id, hrPhone, "HR"),
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
      `TERIMA KASIH. Permintaan revisi sudah dicatat`,
      `dan diteruskan ke ${claim.employee?.employee_name || "karyawan"} lewat WhatsApp.`,
      ``,
      `Alasan revisi: ${reason || "-"}`,
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

/** "3 dari 8 trip sudah punya ticket — sisa 5 belum." */
function ticketProgress(trips: WaTripRow[]): string {
  const missing = trips.filter((t) => !t.ticket_id).length;
  if (missing === 0) return `Semua ${trips.length} trip sudah punya ticket.`;
  return `${trips.length - missing} dari ${trips.length} trip sudah punya ticket — sisa ${missing} belum.`;
}

/** Validasi ticket ke EnvGate. apiDown=true → API tidak terjangkau (jangan tolak). */
async function verifyInvTicket(ticketId: string) {
  try {
    return { inv: await getTicket(ticketId), apiDown: false };
  } catch {
    return { inv: null, apiDown: true };
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
          `Klaim ini punya ${trips.length} trip — ticket-nya untuk trip yang mana?`,
          ``,
          `Ketik: TICKET <no trip> PIM-${ticketId}`,
          `Contoh: TICKET 3 PIM-${ticketId}`,
          `Atau ketik TICKET SEMUA untuk diarahkan satu per satu.`,
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
      `Nomor trip ${no} tidak ditemukan (ada ${trips.length} trip). Balas LIST untuk melihat daftarnya.`,
      "TICKET_INVALID"
    );
    return;
  }

  const { inv, apiDown } = await verifyInvTicket(ticketId);
  if (!apiDown && !inv) {
    await sendAndLog(
      supabase, claim.id, employeePhone,
      [
        `Ticket #PIM-${ticketId} TIDAK DITEMUKAN di EnvGate.`,
        `Cek lagi nomornya, lalu kirim: TICKET ${no} PIM-<nomor yang benar>`,
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
      `SUDAH TERSIMPAN. Trip no ${no} kini punya bukti ticket #PIM-${ticketId}.`,
      inv
        ? `Judul ticket: ${ticketTitle(inv)}`
        : `(Koneksi EnvGate bermasalah — ticket belum terverifikasi, HR akan cek manual.)`,
      ``,
      ticketProgress(fresh),
      ...(stillMissing > 1
        ? [`Lanjut isi sisanya satu per satu? Ketik: TICKET SEMUA`]
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
    `MODE NGISI TICKET — sisa ${remaining} trip lagi.`,
    `Kita isi SATU PER SATU supaya tidak tertukar.`,
    ``,
    `Trip ${no} (${d}: ${shortPlace(t.pickup)} -> ${shortPlace(t.dropoff)})`,
    `Kirim nomor ticket untuk trip ini. Contoh: PIM-34285`,
    ``,
    `Ketik LEWATI kalau trip ini tidak punya ticket.`,
    `Ketik BATAL kalau mau berhenti dulu.`,
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
      `Semua ${trips.length} trip sudah punya ticket. Tidak ada yang perlu diisi.`,
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
    ? "Balas SELESAI untuk mengajukan ulang klaim."
    : "Balas 1 = SETUJU kalau semua data sudah benar.";

  const advance = async (prefix: string[] = []) => {
    const nextI = wiz.i + 1;
    if (nextI >= wiz.queue.length) {
      await supabase.from("claims").update({ ticket_wizard: null }).eq("id", claim.id);
      const fresh = await fetchTrips(supabase, claim.id);
      await sendWizard(
        [
          ...prefix,
          `SELESAI. Semua trip sudah diproses ticket-nya.`,
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
        `Mode ticket ditutup. ${ticketProgress(trips)}`,
        `Kapan saja bisa dilanjutkan: ketik TICKET SEMUA`,
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
        [`Nomor trip ${no} tidak ditemukan (ada ${trips.length} trip).`],
        "TICKET_INVALID"
      );
      return;
    }
    const { inv, apiDown } = await verifyInvTicket(cmd.ticketId);
    if (!apiDown && !inv) {
      await sendWizard(
        [
          `Ticket #PIM-${cmd.ticketId} TIDAK DITEMUKAN di EnvGate.`,
          `Kirim nomor yang benar untuk Trip ${no} (contoh: PIM-34285), atau LEWATI.`,
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
        `SUDAH TERSIMPAN. Trip no ${no} → #PIM-${cmd.ticketId}.`,
        inv ? `Judul: ${ticketTitle(inv)}` : "",
      ].filter(Boolean));
    } else {
      // Ticket untuk trip lain — simpan, wizard tetap di trip saat ini
      await sendWizard(
        [
          `SUDAH TERSIMPAN. Trip no ${no} → #PIM-${cmd.ticketId}.`,
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
// LIST / UBAH <no> <nominal> / TICKET <no> <id> / YA / BATAL / SELESAI / teks bebas → note
// ==========================================
async function handleRevisionCommands(
  supabase: ReturnType<typeof createServiceClient>,
  claim: ClaimWithRelations,
  reply: string,
  employeePhone: string | null
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
        `Klaim ini lagi menunggu revisi Anda.`,
        `Kalau sudah beres, ketik SELESAI — klaim dikirim ulang ke approver.`,
      ].join("\n"),
      "REVISION_INVALID"
    );
    return;
  }

  if (cmd.type === "LIST" || cmd.type === "DETAIL") {
    const { data: trips } = await supabase.from("trips").select("*").eq("claim_id", claim.id).order("trip_date", { ascending: true });
    await sendAndLog(supabase, claim.id, employeePhone, buildRevisionTripListMessage(trips || [], claim.total_amount, claim.period), "REVISION_LIST");
    return;
  }

  if (cmd.type === "CHANGE") {
    const { data: trips } = await supabase.from("trips").select("*").eq("claim_id", claim.id).order("trip_date", { ascending: true });
    const trip = (trips || [])[cmd.tripNo - 1];
    if (!trip) {
      await sendAndLog(supabase, claim.id, employeePhone, `Nomor trip ${cmd.tripNo} tidak ditemukan. Balas LIST untuk melihat daftar trip.`, "REVISION_INVALID");
      return;
    }
    const oldFare = Number(trip.fare);
    if (cmd.newFare === oldFare) {
      await sendAndLog(supabase, claim.id, employeePhone, `Nominal baru sama dengan nominal lama — tidak ada perubahan.`, "REVISION_INVALID");
      return;
    }
    await supabase.from("claims").update({
      pending_wa_change: { trip_id: trip.id, trip_no: cmd.tripNo, old_fare: oldFare, new_fare: cmd.newFare },
    }).eq("id", claim.id);
    await sendAndLog(supabase, claim.id, employeePhone, buildChangeConfirmMessage(trip, cmd.tripNo, oldFare, cmd.newFare), "REVISION_CHANGE_PROMPT");
    return;
  }

  if (cmd.type === "CONFIRM") {
    const pending = claim.pending_wa_change as
      | { kind?: string; trip_id: string; trip_no: number; old_fare: number; new_fare: number; reason?: string }
      | null;
    if (!pending) {
      await sendAndLog(supabase, claim.id, employeePhone, "Tidak ada perubahan yang menunggu konfirmasi.\n\nBalas:\nLIST - daftar trip\nUBAH <no> <nominal> - ubah nominal\nHAPUS <no> <alasan> - hapus trip\nSELESAI - ajukan ulang", "REVISION_INVALID");
      return;
    }

    // HAPUS trip — misal rute pulang ke rumah di jam kerja yang tidak boleh
    // diklaim. Trip keluar dari klaim, total dihitung ulang, alasan tercatat.
    if (pending.kind === "DROP_TRIP") {
      const { error: delErr } = await supabase.from("trips").delete().eq("id", pending.trip_id);
      if (delErr) {
        await sendAndLog(supabase, claim.id, employeePhone, `Gagal menghapus trip: ${delErr.message}`, "REVISION_DROP_FAILED");
        return;
      }
      const { data: fares } = await supabase.from("trips").select("fare").eq("claim_id", claim.id);
      const total = (fares || []).reduce((acc, t) => acc + Number(t.fare), 0);
      await mustUpdateClaim(supabase, claim.id, {
        total_amount: total,
        trip_count: (fares || []).length,
        pending_wa_change: null,
      });

      await supabase.from("comments").insert({
        claim_id: claim.id,
        message: `Trip ${pending.trip_no} DIHAPUS dari klaim (Rp${Number(pending.old_fare).toLocaleString("id-ID")}). Alasan: ${pending.reason || "-"}`,
        author_name: empName,
        author_role: "EMPLOYEE",
      });
      await sendAndLog(supabase, claim.id, employeePhone, buildDropAppliedMessage(pending.trip_no, Number(pending.old_fare), total), "REVISION_DROP_APPLIED");
      return;
    }
    const { error: updErr } = await supabase.from("trips").update({ fare: pending.new_fare }).eq("id", pending.trip_id);
    if (updErr) {
      await sendAndLog(supabase, claim.id, employeePhone, `Gagal menyimpan perubahan: ${updErr.message}`, "REVISION_CHANGE_FAILED");
      return;
    }
    const { data: fares } = await supabase.from("trips").select("fare").eq("claim_id", claim.id);
    const total = (fares || []).reduce((acc, t) => acc + Number(t.fare), 0);
    await mustUpdateClaim(supabase, claim.id, { total_amount: total, pending_wa_change: null });

    await supabase.from("comments").insert({
      claim_id: claim.id,
      message: `Trip ${pending.trip_no} nominal diubah Rp${pending.old_fare.toLocaleString("id-ID")} -> Rp${pending.new_fare.toLocaleString("id-ID")}.`,
      author_name: empName,
      author_role: "EMPLOYEE",
    });
    await sendAndLog(supabase, claim.id, employeePhone, buildChangeAppliedMessage(pending.trip_no, pending.old_fare, pending.new_fare, total), "REVISION_CHANGE_APPLIED");
    return;
  }

  if (cmd.type === "CANCEL") {
    if (claim.pending_wa_change) {
      await supabase.from("claims").update({ pending_wa_change: null }).eq("id", claim.id);
    }
    await sendAndLog(supabase, claim.id, employeePhone, "Perubahan dibatalkan.", "REVISION_CANCELLED");
    return;
  }

  if (cmd.type === "DONE") {
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
              action_url: approveLink(claim.id, mgrPhone, "MANAGER"),
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

  if (cmd.type === "BAD_CHANGE") {
    await sendAndLog(supabase, claim.id, employeePhone, "Format salah. Contoh yang benar: UBAH 3 75000", "REVISION_INVALID");
    return;
  }

  if (cmd.type === "DROP") {
    const { data: trips } = await supabase.from("trips").select("*").eq("claim_id", claim.id).order("trip_date", { ascending: true });
    const trip = (trips || [])[cmd.tripNo - 1];
    if (!trip) {
      await sendAndLog(supabase, claim.id, employeePhone, `Nomor trip ${cmd.tripNo} tidak ditemukan. Balas LIST untuk melihat daftar trip.`, "REVISION_INVALID");
      return;
    }
    // Klaim tanpa trip sama sekali tidak masuk akal — arahkan ke HR/catatan.
    if ((trips || []).length === 1) {
      await sendAndLog(
        supabase, claim.id, employeePhone,
        [
          `Trip no ${cmd.tripNo} adalah SATU-SATUNYA trip di klaim ini.`,
          `Menghapusnya mengosongkan klaim — hubungi HR, atau tulis catatan saja.`,
        ].join("\n"),
        "REVISION_INVALID"
      );
      return;
    }
    if (!cmd.reason) {
      await sendAndLog(
        supabase, claim.id, employeePhone,
        [
          `Hapus trip no ${cmd.tripNo} dengan alasan apa?`,
          `(mis. pulang ke rumah di jam kantor)`,
          ``,
          `Ketik: HAPUS ${cmd.tripNo} <alasan singkat>`,
        ].join("\n"),
        "REVISION_INVALID"
      );
      return;
    }
    await supabase.from("claims").update({
      pending_wa_change: { kind: "DROP_TRIP", trip_id: trip.id, trip_no: cmd.tripNo, old_fare: Number(trip.fare), reason: cmd.reason },
    }).eq("id", claim.id);
    await sendAndLog(supabase, claim.id, employeePhone, buildDropConfirmMessage(trip, cmd.tripNo, cmd.reason), "REVISION_DROP_PROMPT");
    return;
  }

  if (cmd.type === "BAD_DROP") {
    await sendAndLog(supabase, claim.id, employeePhone, "Format salah. Contoh yang benar: HAPUS 3 pulang ke rumah di jam kantor", "REVISION_INVALID");
    return;
  }

  if (cmd.type === "TICKET" || cmd.type === "TICKET_ID") {
    await handleTicketCommand(
      supabase, claim,
      cmd.type === "TICKET" ? cmd.tripNo : null,
      cmd.ticketId,
      employeePhone,
      "Balas UBAH <no> <nominal> untuk ubah nominal,\natau SELESAI untuk mengajukan ulang."
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
      "Format ticket salah. Contoh yang benar: TICKET 3 PIM-34285",
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
      "Balas UBAH <no> <nominal> untuk ubah nominal,\natau SELESAI untuk mengajukan ulang."
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

  try {
    // ==========================================
    // ROLE: EMPLOYEE
    // ==========================================
    if (role === 'EMPLOYEE') {
      // Mode isi ticket satu-per-satu aktif → tangani duluan
      const wiz = claim.ticket_wizard as TicketWizard | null;
      if (wiz && Array.isArray(wiz.queue) && wiz.i != null && wiz.i < wiz.queue.length) {
        await handleWizardTurn(supabase, claim, wiz, reply, employeePhone);
      }
      // Fase revisi: klaim sudah dikonfirmasi engineer tapi diminta revisi
      else if (claim.status === 'NEED_REVIEW' && claim.approved_at) {
        await handleRevisionCommands(supabase, claim, reply, employeePhone);
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
                action_url: approveLink(claim.id, mgrPhone, "MANAGER"),
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
          await sendAndLog(supabase, claim.id, employeePhone, buildDetailMessage(trips, claim.total_amount), "DETAIL_MESSAGE");
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
            "Balas 1 = SETUJU kalau semua data sudah benar."
          );
        } else if (cmd.type === "TICKET_WIZARD") {
          await startTicketWizard(supabase, claim, employeePhone);
        } else if (cmd.type === "LIST" && employeePhone) {
          await sendAndLog(
            supabase, claim.id, employeePhone,
            buildRevisionTripListMessage(claim.trips || [], claim.total_amount, claim.period),
            "REVISION_LIST"
          );
        } else if (cmd.type === "BAD_TICKET") {
          if (employeePhone) {
            await sendAndLog(
              supabase, claim.id, employeePhone,
              "Format ticket salah. Contoh yang benar: TICKET 3 PIM-34285",
              "TICKET_INVALID"
            );
          }
        } else if (cmd.type === "DROP" || cmd.type === "BAD_DROP") {
          if (employeePhone) {
            await sendAndLog(
              supabase, claim.id, employeePhone,
              [
                `Menghapus trip hanya bisa saat REVISI — setelah Manager/HR meminta revisi.`,
                `Sekarang Anda cukup: 1 = SETUJU, 3 = lihat detail, atau tulis catatan.`,
              ].join("\n"),
              "INVALID_REPLY"
            );
          }
        } else if (employeePhone && reply.replace(/\s/g, "").length < 3) {
          // "eh", "?", "y" — bukan catatan, arahkan ke menu
          await sendAndLog(supabase, claim.id, employeePhone, buildEmployeeHelpMessage(), "INVALID_REPLY");
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
              "Balas 1 = SETUJU, 3 = lihat detail,\natau tulis catatan lain."
            ),
            "EMPLOYEE_NOTE"
          );
        }
      }
    }

    // ==========================================
    // ROLE: MANAGER
    // ==========================================
    else if (role === 'MANAGER') {
      if (reply === "1") {
        await mustUpdateClaim(supabase, claim.id, { manager_status: "APPROVED" });
        await sendAndLog(
          supabase, claim.id, phoneNumber,
          [
            `TERIMA KASIH. Klaim atas nama ${claim.employee?.employee_name || "karyawan"} periode ${claim.period} sudah Anda SETUJUI.`,
            `Klaim diteruskan ke HR untuk persetujuan terakhir.`,
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
        if (cmd.type === "REVISE") {
          await handleRevisionRequest(supabase, claim, "MANAGER", cmd.reason, phoneNumber, employeePhone);
        } else {
          await sendAndLog(
            supabase, claim.id, phoneNumber,
            [
              `Maaf, pesan itu belum saya mengerti.`,
              ``,
              `Ketik:`,
              `1 = SETUJU`,
              `2 = MINTA REVISI — contoh: 2 nominal trip 3 masih salah`,
              ``,
              `Pertanyaan lain soal klaim ini? Tanya langsung HR Perkom.`,
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
      if (reply === "1") {
        await mustUpdateClaim(supabase, claim.id, { hr_status: "APPROVED", status: "APPROVED" });
        await sendAndLog(
          supabase, claim.id, phoneNumber,
          [
            `TERIMA KASIH. Klaim atas nama ${claim.employee?.employee_name || "karyawan"} periode ${claim.period} SELESAI —`,
            `disetujui Manager dan HR. Karyawan sudah dinotifikasi.`,
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
        if (cmd.type === "REVISE") {
          await handleRevisionRequest(supabase, claim, "HR", cmd.reason, phoneNumber, employeePhone);
        } else {
          await sendAndLog(
            supabase, claim.id, phoneNumber,
            [
              `Maaf, pesan itu belum saya mengerti.`,
              ``,
              `Ketik:`,
              `1 = SETUJU (klaim selesai)`,
              `2 = MINTA REVISI — contoh: 2 nominal trip 3 masih salah`,
              ``,
              `Pertanyaan lain soal klaim ini? Tanya langsung HR Perkom.`,
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
          `Maaf, ada kendala sistem — pesan Anda BELUM tercatat.`,
          `Coba kirim ulang sebentar lagi. Kalau tetap gagal, hubungi HR Perkom.`,
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
