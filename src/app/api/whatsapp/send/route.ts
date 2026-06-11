import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { sendTextMessage, buildClaimMessage } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { claim_id } = await request.json();

  if (!claim_id) {
    return NextResponse.json(
      { success: false, error: "claim_id wajib diisi" },
      { status: 400 }
    );
  }

  // Get claim with employee
  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .select("*, employee:employees(*)")
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

  const phoneNumber = claim.employee.phone_number;

  // Normalize phone number (must start with country code, no + or leading 0)
  const normalizedPhone = phoneNumber.replace(/^\+/, "").replace(/^0/, "62");

  // Build message
  const message = buildClaimMessage({
    employee_name: claim.employee.employee_name,
    period: claim.period,
    trip_count: claim.trip_count,
    total_amount: claim.total_amount,
  });

  // Send via Kirimi API directly
  const result = await sendTextMessage(normalizedPhone, message);

  // Log the attempt
  await supabase.from("whatsapp_logs").insert({
    claim_id,
    phone_number: phoneNumber,
    message_type: "CLAIM_NOTIFICATION",
    status: result.success ? "SENT" : "FAILED",
    response: JSON.stringify(result),
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error || "Gagal mengirim WhatsApp" },
      { status: 500 }
    );
  }

  // Update claim status
  await supabase
    .from("claims")
    .update({
      status: "SENT",
      wa_sent: true,
      wa_sent_at: new Date().toISOString(),
    })
    .eq("id", claim_id);

  return NextResponse.json({ success: true });
}
