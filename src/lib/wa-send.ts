import { createServerClient } from "@/lib/supabase-server";
import { sendTextMessage, buildClaimMessage, normalizePhone } from "@/lib/whatsapp";
import { portalLink } from "@/lib/wa-link";

/** Kirim pesan klaim ke karyawan — dipakai kirim satuan (dialog Send) dan
 *  blast massal (antrean server). Tidak throw: return {ok, error, status}
 *  supaya loop blast bisa lanjut ke item berikutnya. */
export async function sendClaimToEmployee(
  claimId: string,
  opts?: { manager_id?: string | null; hr_id?: string | null }
): Promise<{ ok: boolean; error?: string; status?: number }> {
  const supabase = await createServerClient();
  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .select(`
      *,
      employee:employees!claims_employee_id_fkey(*),
      trips(*)
    `)
    .eq("id", claimId)
    // Urutan sama dengan LIST/detail — nomor trip di pesan konsisten
    .order("trip_date", { referencedTable: "trips", ascending: true })
    .single();

  if (claimError || !claim) return { ok: false, error: "Claim tidak ditemukan", status: 404 };
  if (!claim.employee) {
    return { ok: false, error: "Employee belum terhubung dengan claim ini", status: 400 };
  }
  if (!claim.employee.phone_number) {
    return { ok: false, error: "Karyawan tidak punya nomor WhatsApp", status: 400 };
  }

  const message = buildClaimMessage({
    employee_name: claim.employee.employee_name,
    period: claim.period,
    trip_count: claim.trip_count,
    total_amount: claim.total_amount,
    link: portalLink(claim.employee.id, normalizePhone(claim.employee.phone_number) || ""),
  });

  const result = await sendTextMessage(claim.employee.phone_number, message);

  await supabase.from("whatsapp_logs").insert({
    claim_id: claimId,
    phone_number: claim.employee.phone_number,
    message_type: "CLAIM_NOTIFICATION",
    status: result.success ? "SENT" : "FAILED",
    response: result.success ? message.slice(0, 200) : result.error || "Unknown error",
  });

  if (!result.success) {
    return { ok: false, error: result.error || "Gagal mengirim WhatsApp", status: 500 };
  }

  await supabase
    .from("claims")
    .update({
      status: "SENT",
      manager_id: opts?.manager_id !== undefined ? opts.manager_id : claim.employee.manager_id,
      hr_id: opts?.hr_id !== undefined ? opts.hr_id : claim.employee.hr_id,
      wa_sent: true,
      wa_sent_at: new Date().toISOString(),
    })
    .eq("id", claimId);

  return { ok: true };
}
