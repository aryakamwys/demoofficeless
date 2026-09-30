import { NextRequest, NextResponse, after } from "next/server";
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
  buildResubmittedMessage
} from "@/lib/whatsapp";
import { parseWaCommand } from "@/lib/wa-commands";
import { getTicket, ticketTitle } from "@/lib/envgate";

// Helper: fetch a fresh claim with all relations
async function fetchClaimFresh(supabase: ReturnType<typeof createServiceClient>, claimId: string) {
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
        }),
        "HR_APPROVAL_PROMPT"
      );
      if (!sent) {
        console.error(`[FLOW] STUCK: Failed to send HR approval to ${hrPhone} for claim ${claim.id}`);
      }
    } else {
      console.error(`[FLOW] STUCK: HR has no phone number for claim ${claim.id}`);
    }
  } else {
    // No HR → auto finalize
    await supabase.from("claims").update({ status: "APPROVED", hr_status: "APPROVED" }).eq("id", claim.id);
    if (employeePhone) {
      await sendAndLog(
        supabase, claim.id, employeePhone,
        buildEmployeeStatusUpdateMessage("FINALIZED", "Sistem", "HR"),
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
  await supabase.from("claims").update({ status: "NEED_REVIEW", pending_wa_change: null }).eq("id", claim.id);

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
    await sendAndLog(
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
  }
}

// ==========================================
// TICKET — engineer melampirkan bukti ticket EnvGate per trip via chat.
// Dipakai di mode konfirmasi awal maupun mode revisi.
// ==========================================
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
  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .eq("claim_id", claim.id)
    .order("trip_date", { ascending: true });

  let no = tripNo;
  if (no == null) {
    // "#PIM-34285" telanjang: klaim 1 trip → langsung trip 1; kalau banyak, tanya nomor
    if ((trips || []).length === 1) {
      no = 1;
    } else {
      await sendAndLog(
        supabase, claim.id, employeePhone,
        [
          `Klaim ini punya ${(trips || []).length} trip — ticket-nya untuk trip yang mana?`,
          ``,
          `Ketik: TICKET <no trip> PIM-${ticketId}`,
          `Contoh: TICKET 3 PIM-${ticketId}`,
          `Balas LIST untuk melihat nomor trip.`,
        ].join("\n"),
        "TICKET_NEED_TRIP_NO"
      );
      return;
    }
  }

  const trip = (trips || [])[no - 1];
  if (!trip) {
    await sendAndLog(
      supabase, claim.id, employeePhone,
      `Nomor trip ${no} tidak ditemukan (ada ${(trips || []).length} trip). Balas LIST untuk melihat daftarnya.`,
      "TICKET_INVALID"
    );
    return;
  }

  await supabase.from("trips").update({ ticket_id: ticketId }).eq("id", trip.id);

  // Verifikasi live ke EnvGate — kasih judul ticket sebagai umpan balik
  let title = "";
  try {
    const inv = await getTicket(ticketId);
    title = inv ? ticketTitle(inv) : "";
  } catch {
    // API tidak terjangkau — tetap simpan, judul dikosongkan
  }

  await supabase.from("comments").insert({
    claim_id: claim.id,
    message: `Trip ${no} dilampirkan ticket EnvGate #PIM-${ticketId}${title ? ` (${title})` : ""} via WhatsApp.`,
    author_name: empName,
    author_role: "EMPLOYEE",
  });

  await sendAndLog(
    supabase, claim.id, employeePhone,
    [
      `SUDAH TERSIMPAN. Trip no ${no} kini punya bukti ticket #PIM-${ticketId}.`,
      title ? `Judul ticket: ${title}` : `(Detail ticket tidak bisa diverifikasi saat ini.)`,
      ``,
      nextHint,
    ].join("\n"),
    "TICKET_SAVED"
  );
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

  if (cmd.type === "LIST") {
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
    const pending = claim.pending_wa_change;
    if (!pending) {
      await sendAndLog(supabase, claim.id, employeePhone, "Tidak ada perubahan yang menunggu konfirmasi.\n\nBalas:\nLIST - daftar trip\nUBAH <no> <nominal> - ubah nominal\nSELESAI - ajukan ulang", "REVISION_INVALID");
      return;
    }
    const { error: updErr } = await supabase.from("trips").update({ fare: pending.new_fare }).eq("id", pending.trip_id);
    if (updErr) {
      await sendAndLog(supabase, claim.id, employeePhone, `Gagal menyimpan perubahan: ${updErr.message}`, "REVISION_CHANGE_FAILED");
      return;
    }
    const { data: fares } = await supabase.from("trips").select("fare").eq("claim_id", claim.id);
    const total = (fares || []).reduce((acc, t) => acc + Number(t.fare), 0);
    await supabase.from("claims").update({ total_amount: total, pending_wa_change: null }).eq("id", claim.id);

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
    await supabase.from("claims").update({ status: "SENT", pending_wa_change: null }).eq("id", claim.id);

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
  await supabase.from("comments").insert({
    claim_id: claim.id,
    message: noteText,
    author_name: empName,
    author_role: "EMPLOYEE",
  });
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
// Main processing logic (runs in background via after())
// ==========================================
async function processWebhookReply(
  claim: NonNullable<Awaited<ReturnType<typeof fetchClaimFresh>>>,
  role: string,
  reply: string,
  phoneNumber: string,
) {
  const supabase = createServiceClient();
  const employeePhone = normalizePhone(claim.employee?.phone_number);

  try {
    // ==========================================
    // ROLE: EMPLOYEE
    // ==========================================
    if (role === 'EMPLOYEE') {
      // Fase revisi: klaim sudah dikonfirmasi engineer tapi diminta revisi
      if (claim.status === 'NEED_REVIEW' && claim.approved_at) {
        await handleRevisionCommands(supabase, claim, reply, employeePhone);
      } else if (reply === "1") {
        const hasManager = !!claim.manager;
        await supabase.from("claims").update({
          approved_at: new Date().toISOString(),
          manager_status: hasManager ? "PENDING" : "APPROVED",
          hr_status: "PENDING",
        }).eq("id", claim.id);

        const confirmMsg = buildConfirmationMessage(hasManager ? claim.manager.employee_name : undefined);
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
              }),
              "MANAGER_APPROVAL_PROMPT"
            );
            if (!sent) {
              console.error(`[FLOW] STUCK: Failed to send manager approval to ${mgrPhone} for claim ${claim.id}`);
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
        await supabase.from("claims").update({ status: "NEED_REVIEW" }).eq("id", claim.id);
        if (employeePhone) {
          await sendAndLog(supabase, claim.id, employeePhone, buildCorrectionPrompt(), "CORRECTION_PROMPT");
        }
      } else if (reply === "3") {
        const { data: trips } = await supabase.from("trips").select("*").eq("claim_id", claim.id).order("trip_date", { ascending: true });
        if (trips && trips.length > 0 && employeePhone) {
          await sendAndLog(supabase, claim.id, employeePhone, buildDetailMessage(trips, claim.total_amount), "DETAIL_MESSAGE");
        }
      } else {
        // TICKET juga bisa dipakai sebelum konfirmasi (mode awal);
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
        } else if (cmd.type === "BAD_TICKET") {
          if (employeePhone) {
            await sendAndLog(
              supabase, claim.id, employeePhone,
              "Format ticket salah. Contoh yang benar: TICKET 3 PIM-34285",
              "TICKET_INVALID"
            );
          }
        } else if (employeePhone && reply.replace(/\s/g, "").length < 3) {
          // "eh", "?", "y" — bukan catatan, arahkan ke menu
          await sendAndLog(supabase, claim.id, employeePhone, buildEmployeeHelpMessage(), "INVALID_REPLY");
        } else if (employeePhone) {
          await supabase.from("comments").insert({ claim_id: claim.id, message: reply });
          if (claim.status !== "NEED_REVIEW") {
            await supabase.from("claims").update({ status: "NEED_REVIEW" }).eq("id", claim.id);
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
        await supabase.from("claims").update({ manager_status: "APPROVED" }).eq("id", claim.id);
        await sendAndLog(
          supabase, claim.id, phoneNumber,
          [
            `TERIMA KASIH. Klaim atas nama ${claim.employee?.employee_name || "karyawan"} sudah Anda SETUJUI.`,
            `Klaim diteruskan ke HR untuk persetujuan terakhir.`,
          ].join("\n"),
          "MANAGER_CONFIRMED"
        );

        if (employeePhone) {
          await sendAndLog(
            supabase, claim.id, employeePhone,
            buildEmployeeStatusUpdateMessage("APPROVED", claim.manager?.employee_name || "Manager", "MANAGER"),
            "EMPLOYEE_STATUS_UPDATE"
          );
        }

        const freshClaim = await fetchClaimFresh(supabase, claim.id);
        if (freshClaim) {
          await proceedToHrOrFinalize(supabase, freshClaim, employeePhone);
        }

      } else if (reply === "2" || reply.startsWith("2 ")) {
        const cmd = parseWaCommand(reply);
        const reason = cmd.type === "REVISE" ? cmd.reason : "";
        await handleRevisionRequest(supabase, claim, "MANAGER", reason, phoneNumber, employeePhone);
      } else {
        await sendAndLog(
          supabase, claim.id, phoneNumber,
          [
            `Maaf, balasan belum dikenali.`,
            ``,
            `Ketik:`,
            `1 = SETUJU`,
            `2 = MINTA REVISI — contoh: 2 nominal trip 3 masih salah`,
          ].join("\n"),
          "INVALID_REPLY"
        );
      }
    }

    // ==========================================
    // ROLE: HR
    // ==========================================
    else if (role === 'HR') {
      if (reply === "1") {
        await supabase.from("claims").update({ hr_status: "APPROVED", status: "APPROVED" }).eq("id", claim.id);
        await sendAndLog(
          supabase, claim.id, phoneNumber,
          [
            `TERIMA KASIH. Klaim atas nama ${claim.employee?.employee_name || "karyawan"} SELESAI —`,
            `disetujui Manager dan HR. Karyawan sudah dinotifikasi.`,
          ].join("\n"),
          "HR_CONFIRMED"
        );
        if (employeePhone) {
          await sendAndLog(
            supabase, claim.id, employeePhone,
            buildEmployeeStatusUpdateMessage("FINALIZED", claim.hr?.employee_name || "HR", "HR"),
            "EMPLOYEE_STATUS_UPDATE"
          );
        }
      } else if (reply === "2" || reply.startsWith("2 ")) {
        const cmd = parseWaCommand(reply);
        const reason = cmd.type === "REVISE" ? cmd.reason : "";
        await handleRevisionRequest(supabase, claim, "HR", reason, phoneNumber, employeePhone);
      } else {
        await sendAndLog(
          supabase, claim.id, phoneNumber,
          [
            `Maaf, balasan belum dikenali.`,
            ``,
            `Ketik:`,
            `1 = SETUJU (klaim selesai)`,
            `2 = MINTA REVISI — contoh: 2 nominal trip 3 masih salah`,
          ].join("\n"),
          "INVALID_REPLY"
        );
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
  }
}

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

    // Log raw payload
    try {
      await supabase.from("whatsapp_logs").insert({
        claim_id: "1aedea14-57ef-4929-8d27-f6b8b513cbe0",
        phone_number: "SYSTEM",
        message_type: "RAW_WEBHOOK",
        status: "RECEIVED",
        response: JSON.stringify(body),
      });
    } catch (e) {
      console.error("Log error", e);
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

    if (!sender || !messageText) {
      return NextResponse.json({ success: true });
    }

    const phoneNumber = normalizePhone(sender);
    if (!phoneNumber) return NextResponse.json({ success: true });

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
    let role = null;

    for (const c of claims) {
      if (!c.employee) continue;

      const empPhone = normalizePhone(c.employee.phone_number);
      const mgrPhone = c.manager ? normalizePhone(c.manager.phone_number) : null;
      const hrPhone = c.hr ? normalizePhone(c.hr.phone_number) : null;

      if (hrPhone && hrPhone === phoneNumber && c.approved_at && c.manager_status === 'APPROVED' && c.hr_status === 'PENDING') {
        claim = c; role = 'HR'; break;
      }
      if (mgrPhone && mgrPhone === phoneNumber && c.approved_at && c.manager_status === 'PENDING') {
        claim = c; role = 'MANAGER'; break;
      }
      if (empPhone === phoneNumber && (!c.approved_at || c.status === 'NEED_REVIEW')) {
        claim = c; role = 'EMPLOYEE'; break;
      }
    }

    if (!claim || !role) {
      return NextResponse.json({ success: true, reason: "No matching claim/role" });
    }

    const reply = messageText.trim();

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
