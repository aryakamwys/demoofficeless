import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { sendTextMessage, buildManagerApprovalMessage, buildHrApprovalMessage } from "@/lib/whatsapp";
import { sendClaimToEmployee } from "@/lib/wa-send";
import { errorMessage } from "@/lib/utils";

// Retry rate-limit bisa total ~17 detik — kasih ruang di serverless.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { claim_id, manager_id, hr_id, target = "EMPLOYEE" } = await request.json();

    if (!claim_id) {
    return NextResponse.json(
      { success: false, error: "claim_id wajib diisi" },
      { status: 400 }
    );
  }

  // Kirim ke karyawan — logika di lib (dipakai juga blast massal)
  if (target === "EMPLOYEE") {
    const r = await sendClaimToEmployee(claim_id, { manager_id, hr_id });
    if (!r.ok) {
      return NextResponse.json(
        { success: false, error: r.error || "Gagal mengirim WhatsApp" },
        { status: r.status || 500 }
      );
    }
    return NextResponse.json({ success: true });
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
    // Urutan sama dengan LIST/detail — nomor trip di pesan konsisten dengan
    // perintah UBAH/HAPUS/TICKET
    .order("trip_date", { referencedTable: "trips", ascending: true })
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

  if (target === "MANAGER") {
    if (!claim.manager) {
      return NextResponse.json({ success: false, error: "Manager belum diatur untuk klaim ini" }, { status: 400 });
    }
    // Webhook hanya mencocokkan balasan Manager bila karyawan sudah konfirmasi
    // (approved_at terisi). Tanpa guard ini prompt tetap terkirim lalu balasan
    // Manager ditolak "tidak ada klaim aktif" — flow kelihatan macet.
    if (!claim.approved_at || claim.manager_status !== "PENDING") {
      return NextResponse.json({
        success: false,
        error: claim.manager_status === "APPROVED"
          ? "Manager sudah menyetujui klaim ini — tidak perlu kirim ulang."
          : "Karyawan belum konfirmasi klaim ini (balas 1). Kirim ulang ke Karyawan dulu — prompt ke Manager terkirim otomatis setelah karyawan setuju.",
      }, { status: 400 });
    }
    phoneNumber = claim.manager.phone_number;
    messageType = "MANAGER_APPROVAL_PROMPT";
    message = buildManagerApprovalMessage({
      employee_name: claim.employee.employee_name,
      period: claim.period,
      total_amount: claim.total_amount,
      trips: claim.trips || [],
    });
  } else if (target === "HR") {
    if (!claim.hr) {
      return NextResponse.json({ success: false, error: "HR belum diatur untuk klaim ini" }, { status: 400 });
    }
    // Sama seperti Manager: balasan HR baru dicocokkan webhook setelah Manager
    // menyetujui. Jangan kirim prompt yang balasannya pasti ditolak.
    if (!claim.approved_at || claim.manager_status !== "APPROVED" || claim.hr_status !== "PENDING") {
      return NextResponse.json({
        success: false,
        error: claim.hr_status === "APPROVED"
          ? "HR sudah menyetujui klaim ini."
          : "Manager belum menyetujui klaim ini — prompt ke HR terkirim otomatis setelah Manager membalas 1.",
      }, { status: 400 });
    }
    phoneNumber = claim.hr.phone_number;
    messageType = "HR_APPROVAL_PROMPT";
    message = buildHrApprovalMessage({
      employee_name: claim.employee.employee_name,
      manager_name: claim.manager?.employee_name || "Manager",
      period: claim.period,
      total_amount: claim.total_amount,
      trips: claim.trips || [],
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

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Unhandled error in /api/whatsapp/send:", error);
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}
