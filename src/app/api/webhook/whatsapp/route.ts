import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import {
  sendTextMessage,
  buildDetailMessage,
  buildConfirmationMessage,
  buildCorrectionPrompt,
  buildManagerApprovalMessage,
  buildHrApprovalMessage,
  buildEmployeeStatusUpdateMessage
} from "@/lib/whatsapp";

function normalizePhone(phone: string | undefined | null) {
  if (!phone) return null;
  return phone.replace(/^\+/, "").replace(/^0/, "62").replace("@lid", "");
}

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
      if (reply === "1") {
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
        if (claim.status === "NEED_REVIEW" || reply.length > 5) {
          await supabase.from("comments").insert({ claim_id: claim.id, message: reply });
          if (claim.status !== "NEED_REVIEW") {
            await supabase.from("claims").update({ status: "NEED_REVIEW" }).eq("id", claim.id);
          }
        }
      }
    }

    // ==========================================
    // ROLE: MANAGER
    // ==========================================
    else if (role === 'MANAGER') {
      if (reply === "1") {
        await supabase.from("claims").update({ manager_status: "APPROVED" }).eq("id", claim.id);
        await sendAndLog(supabase, claim.id, phoneNumber, "Terima kasih, klaim telah Anda setujui.", "MANAGER_CONFIRMED");

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

      } else if (reply === "2") {
        await supabase.from("claims").update({ manager_status: "REJECTED", status: "NEED_REVIEW" }).eq("id", claim.id);
        await sendAndLog(supabase, claim.id, phoneNumber, "Klaim telah ditolak.", "MANAGER_REJECTED");
        if (employeePhone) {
          await sendAndLog(
            supabase, claim.id, employeePhone,
            buildEmployeeStatusUpdateMessage("REJECTED", claim.manager?.employee_name || "Manager", "MANAGER"),
            "EMPLOYEE_STATUS_UPDATE"
          );
        }
      } else {
        await sendAndLog(supabase, claim.id, phoneNumber, "Balasan tidak valid. Silakan balas 1 untuk Approve atau 2 untuk Reject.", "INVALID_REPLY");
      }
    }

    // ==========================================
    // ROLE: HR
    // ==========================================
    else if (role === 'HR') {
      if (reply === "1") {
        await supabase.from("claims").update({ hr_status: "APPROVED", status: "APPROVED" }).eq("id", claim.id);
        await sendAndLog(supabase, claim.id, phoneNumber, "Terima kasih, klaim telah selesai Anda setujui.", "HR_CONFIRMED");
        if (employeePhone) {
          await sendAndLog(
            supabase, claim.id, employeePhone,
            buildEmployeeStatusUpdateMessage("FINALIZED", claim.hr?.employee_name || "HR", "HR"),
            "EMPLOYEE_STATUS_UPDATE"
          );
        }
      } else if (reply === "2") {
        await supabase.from("claims").update({ hr_status: "REJECTED", status: "NEED_REVIEW" }).eq("id", claim.id);
        await sendAndLog(supabase, claim.id, phoneNumber, "Klaim telah ditolak.", "HR_REJECTED");
        if (employeePhone) {
          await sendAndLog(
            supabase, claim.id, employeePhone,
            buildEmployeeStatusUpdateMessage("REJECTED", claim.hr?.employee_name || "HR", "HR"),
            "EMPLOYEE_STATUS_UPDATE"
          );
        }
      } else {
        await sendAndLog(supabase, claim.id, phoneNumber, "Balasan tidak valid. Silakan balas 1 untuk Approve atau 2 untuk Reject.", "INVALID_REPLY");
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
      if (empPhone === phoneNumber && !c.approved_at) {
        claim = c; role = 'EMPLOYEE'; break;
      }
    }

    if (!claim || !role) {
      return NextResponse.json({ success: true, reason: "No matching claim/role" });
    }

    const reply = messageText.trim();

    // Process directly. We await it so Vercel doesn't kill the process.
    // With maxRetries=1, 2 messages * 2s delay = ~4-5s total, well within Vercel's 10s limit.
    await processWebhookReply(claim, role!, reply, phoneNumber);

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
