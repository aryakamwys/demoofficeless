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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();

    // Log raw payload
    try {
      await supabase.from("whatsapp_logs").insert({
        claim_id: "1aedea14-57ef-4929-8d27-f6b8b513cbe0", // Dummy/System ID
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

    // Find active claims
    // We fetch claims that are SENT or NEED_REVIEW
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

    // Match sender to claim and role
    for (const c of claims) {
      if (!c.employee) continue;
      
      const empPhone = normalizePhone(c.employee.phone_number);
      const mgrPhone = normalizePhone(c.manager?.phone_number);
      const hrPhone = normalizePhone(c.hr?.phone_number);

      // Check HR (If Manager approved, but HR is pending)
      if (hrPhone === phoneNumber && c.approved_at && c.manager_status !== 'PENDING' && c.hr_status === 'PENDING') {
        claim = c;
        role = 'HR';
        break;
      }
      
      // Check Manager (If Employee approved, but Manager is pending)
      if (mgrPhone === phoneNumber && c.approved_at && c.manager_status === 'PENDING') {
        claim = c;
        role = 'MANAGER';
        break;
      }
      
      // Check Employee
      if (empPhone === phoneNumber && !c.approved_at) {
        claim = c;
        role = 'EMPLOYEE';
        break;
      }
    }

    if (!claim) {
      return NextResponse.json({ success: true, reason: "No matching claim/role found for phone" });
    }

    const reply = messageText.trim();
    const targetPhone = normalizePhone(claim.employee?.phone_number) || phoneNumber;

    // Helper to proceed to HR or Finalize
    const proceedToHrOrFinalize = async (c: any) => {
      if (c.hr) {
        // Send to HR
        await sendTextMessage(
          normalizePhone(c.hr.phone_number)!,
          buildHrApprovalMessage({
            employee_name: c.employee.employee_name,
            manager_name: c.manager ? c.manager.employee_name : "Sistem",
            period: c.period,
            total_amount: c.total_amount,
            trips: c.trips || [],
          })
        );
      } else {
        // No HR, auto finalize
        await supabase.from("claims").update({ status: "APPROVED", hr_status: "APPROVED" }).eq("id", c.id);
        await sendTextMessage(
          targetPhone,
          buildEmployeeStatusUpdateMessage("FINALIZED", "Sistem", "HR")
        );
      }
    };

    // ==========================================
    // ROLE: EMPLOYEE
    // ==========================================
    if (role === 'EMPLOYEE') {
      if (reply === "1") {
        await supabase.from("claims").update({ approved_at: new Date().toISOString() }).eq("id", claim.id);
        
        const hasManager = !!claim.manager;
        const confirmMsg = buildConfirmationMessage(hasManager ? claim.manager.employee_name : undefined);
        await sendTextMessage(targetPhone, confirmMsg);

        if (hasManager) {
          // Send to Manager
          const mgrPhone = normalizePhone(claim.manager.phone_number);
          if (mgrPhone) {
            await sendTextMessage(mgrPhone, buildManagerApprovalMessage({
              employee_name: claim.employee.employee_name,
              period: claim.period,
              total_amount: claim.total_amount,
              trips: claim.trips || [],
            }));
          }
        } else {
          // No Manager, auto-approve manager step, proceed to HR
          await supabase.from("claims").update({ manager_status: "APPROVED" }).eq("id", claim.id);
          await proceedToHrOrFinalize(claim);
        }

      } else if (reply === "2") {
        await supabase.from("claims").update({ status: "NEED_REVIEW" }).eq("id", claim.id);
        await sendTextMessage(targetPhone, buildCorrectionPrompt());
      } else if (reply === "3") {
        const { data: trips } = await supabase.from("trips").select("*").eq("claim_id", claim.id).order("trip_date", { ascending: true });
        if (trips && trips.length > 0) {
          await sendTextMessage(targetPhone, buildDetailMessage(trips, claim.total_amount));
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
        // Approve
        await supabase.from("claims").update({ manager_status: "APPROVED" }).eq("id", claim.id);
        await sendTextMessage(phoneNumber, "Terima kasih, klaim telah Anda setujui.");
        await sendTextMessage(targetPhone, buildEmployeeStatusUpdateMessage("APPROVED", claim.manager?.employee_name || "Manager", "MANAGER"));
        
        await proceedToHrOrFinalize(claim);
      } else if (reply === "2") {
        // Reject
        await supabase.from("claims").update({ manager_status: "REJECTED", status: "NEED_REVIEW" }).eq("id", claim.id);
        await sendTextMessage(phoneNumber, "Klaim telah ditolak.");
        await sendTextMessage(targetPhone, buildEmployeeStatusUpdateMessage("REJECTED", claim.manager?.employee_name || "Manager", "MANAGER"));
      } else {
        await sendTextMessage(phoneNumber, "Balasan tidak valid. Silakan balas 1 untuk Approve atau 2 untuk Reject.");
      }
    }

    // ==========================================
    // ROLE: HR
    // ==========================================
    else if (role === 'HR') {
      if (reply === "1") {
        // Approve
        await supabase.from("claims").update({ hr_status: "APPROVED", status: "APPROVED" }).eq("id", claim.id);
        await sendTextMessage(phoneNumber, "Terima kasih, klaim telah selesai Anda setujui.");
        await sendTextMessage(targetPhone, buildEmployeeStatusUpdateMessage("FINALIZED", claim.hr?.employee_name || "HR", "HR"));
      } else if (reply === "2") {
        // Reject
        await supabase.from("claims").update({ hr_status: "REJECTED", status: "NEED_REVIEW" }).eq("id", claim.id);
        await sendTextMessage(phoneNumber, "Klaim telah ditolak.");
        await sendTextMessage(targetPhone, buildEmployeeStatusUpdateMessage("REJECTED", claim.hr?.employee_name || "HR", "HR"));
      } else {
        await sendTextMessage(phoneNumber, "Balasan tidak valid. Silakan balas 1 untuk Approve atau 2 untuk Reject.");
      }
    }

    // Log the interaction
    await supabase.from("whatsapp_logs").insert({
      claim_id: claim.id,
      phone_number: phoneNumber,
      message_type: role,
      status: "RECEIVED",
      response: reply,
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
