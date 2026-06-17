import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { sendTextMessage, buildClaimMessage, buildManagerApprovalMessage, buildHrApprovalMessage } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { claim_id, manager_id, hr_id, target = "EMPLOYEE" } = await request.json();

  if (!claim_id) {
    return NextResponse.json(
      { success: false, error: "claim_id wajib diisi" },
      { status: 400 }
    );
  }

  // Get claim with employee, manager, hr, and trips
  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .select(`
      *,
      employee:employees!claims_employee_id_fkey(*),
      manager:employees!claims_manager_id_fkey(*),
      hr:employees!claims_hr_id_fkey(*),
      trips(*)
    `)
    .eq("id", claim_id)
    .single();

  if (claimError || !claim) {
    return NextResponse.json(
      { success: false, error: "Claim tidak ditemukan" },
      { status: 404 }
    );
  }

  if (!claim.employee) {
    return NextResponse.json(
      { success: false, error: "Employee belum terhubung dengan claim ini" },
      { status: 400 }
    );
  }

  let phoneNumber = claim.employee.phone_number;
  let message = "";
  let messageType = "CLAIM_NOTIFICATION";

  if (target === "EMPLOYEE") {
    message = buildClaimMessage({
      employee_name: claim.employee.employee_name,
      period: claim.period,
      trip_count: claim.trip_count,
      total_amount: claim.total_amount,
    });
  } else if (target === "MANAGER") {
    if (!claim.manager) {
      return NextResponse.json({ success: false, error: "Manager belum diatur untuk klaim ini" }, { status: 400 });
    }
    phoneNumber = claim.manager.phone_number;
    messageType = "MANAGER_APPROVAL_PROMPT";
    message = buildManagerApprovalMessage({
      employee_name: claim.employee.employee_name,
      period: claim.period,
      total_amount: claim.total_amount,
      trips: claim.trips || []
    });
  } else if (target === "HR") {
    if (!claim.hr) {
      return NextResponse.json({ success: false, error: "HR belum diatur untuk klaim ini" }, { status: 400 });
    }
    phoneNumber = claim.hr.phone_number;
    messageType = "HR_APPROVAL_PROMPT";
    message = buildHrApprovalMessage({
      employee_name: claim.employee.employee_name,
      manager_name: claim.manager?.employee_name || "Manager",
      period: claim.period,
      total_amount: claim.total_amount,
      trips: claim.trips || []
    });
  }

  // Normalize phone number (must start with country code, no + or leading 0)
  const normalizedPhone = phoneNumber.replace(/^\+/, "").replace(/^0/, "62");

  // Send via Kirimi API directly
  const result = await sendTextMessage(normalizedPhone, message);

  // Log the attempt
  await supabase.from("whatsapp_logs").insert({
    claim_id,
    phone_number: phoneNumber,
    message_type: messageType,
    status: result.success ? "SENT" : "FAILED",
    response: JSON.stringify(result),
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error || "Gagal mengirim WhatsApp" },
      { status: 500 }
    );
  }

  // Only update general claim status if sending to EMPLOYEE
  if (target === "EMPLOYEE") {
    await supabase
      .from("claims")
      .update({
        status: "SENT",
        manager_id: manager_id !== undefined ? manager_id : claim.employee.manager_id,
        hr_id: hr_id !== undefined ? hr_id : claim.employee.hr_id,
        wa_sent: true,
        wa_sent_at: new Date().toISOString(),
      })
      .eq("id", claim_id);
  }

  return NextResponse.json({ success: true });
}
