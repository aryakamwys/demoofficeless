import { NextRequest, NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyRefundToken, portalLink } from "@/lib/wa-link";
import {
  normalizePhone,
  buildRefundReasonApprovedMessage,
  buildRefundReasonRejectedMessage,
} from "@/lib/whatsapp";
import { sendAndLog, flowAlert, getCompanyBank, releaseClaimIfNoRefunds } from "@/lib/wa-flow";

// Keputusan manager atas ALASAN KARYAWAN untuk trip "tidak sesuai" — dari
// link di pesan WA (token HMAC, tanpa login; trust model sama dengan
// /api/wa/action). Alur v2: karyawan dibela duluan; manager hanya memutus
// saat karyawan mengirim alasan.
//   Setujui = perjalanan SAH: paraf manager tercatat di trip, penggantian
//             batal, karyawan tidak membayar.
//   Tolak    = karyawan WAJIB mengganti ke rekening kantor (+ bukti transfer).
export const maxDuration = 60;

function rupiah(n: number | string): string {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

type RefundRow = {
  id: string;
  claim_id: string;
  trip_no: number;
  trip_date: string | null;
  pickup: string | null;
  dropoff: string | null;
  amount: number;
  reason: string;
  status: string;
  manager_status: string | null;
  employee_reason: string | null;
};

async function loadContext(token: string) {
  const v = verifyRefundToken(token);
  if (!v) return { error: "TOKEN_INVALID" as const };

  const supabase = createServiceClient();
  const { data: refund } = await supabase
    .from("trip_refunds")
    .select("*")
    .eq("id", v.refundId)
    .maybeSingle();
  if (!refund) return { error: "REFUND_NOT_FOUND" as const };

  const { data: claim } = await supabase
    .from("claims")
    .select(`
      id,
      period,
      manager_id,
      employee:employees!claims_employee_id_fkey(id, employee_name, phone_number),
      manager:employees!claims_manager_id_fkey(employee_name, phone_number)
    `)
    .eq("id", (refund as RefundRow).claim_id)
    .maybeSingle();
  if (!claim) return { error: "CLAIM_NOT_FOUND" as const };

  // Nomor pada token harus = nomor manager klaim ini (data terkini)
  const emp = Array.isArray(claim.employee) ? claim.employee[0] : claim.employee;
  const mgr = Array.isArray(claim.manager) ? claim.manager[0] : claim.manager;
  if (!mgr || normalizePhone(mgr.phone_number) !== v.phone) {
    return { error: "NOT_MANAGER" as const };
  }

  return { supabase, refund: refund as RefundRow, claim, emp, mgr, phone: v.phone };
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("t") || "";
  const ctx = await loadContext(token);
  if ("error" in ctx) {
    return NextResponse.json({ success: false, error: ctx.error }, { status: 401 });
  }

  const { refund, claim, emp, mgr, supabase } = ctx;
  // `phone` tidak dipakai di GET — validasi nomor sudah dilakukan loadContext
  const stale = refund.status !== "REQUESTED" || refund.manager_status !== "PENDING";

  // Ttd tersimpan manager (untuk info "akan diparaf otomatis")
  const { data: sig } = claim.manager_id
    ? await supabase.from("signatures").select("signature").eq("employee_id", claim.manager_id).maybeSingle()
    : { data: null };

  return NextResponse.json({
    success: true,
    stale,
    refund: {
      employee_name: emp?.employee_name || "Karyawan",
      manager_name: mgr.employee_name,
      period: claim.period,
      trip_no: refund.trip_no,
      trip_date: refund.trip_date,
      pickup: refund.pickup,
      dropoff: refund.dropoff,
      amount: Number(refund.amount),
      reason: refund.reason,
      employee_reason: refund.employee_reason || "",
      has_signature: !!sig?.signature,
      decision: refund.manager_status,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body?.token || "");
    const action = String(body?.action || "");
    const reason = String(body?.reason || "").trim().slice(0, 300);

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ success: false, error: "Aksi tidak dikenal" }, { status: 400 });
    }
    if (action === "reject" && !reason) {
      return NextResponse.json({ success: false, error: "Alasan penolakan wajib diisi" }, { status: 400 });
    }

    const ctx = await loadContext(token);
    if ("error" in ctx) {
      return NextResponse.json({ success: false, error: ctx.error }, { status: 401 });
    }
    const { supabase, refund, claim, emp, mgr } = ctx;

    if (refund.status !== "REQUESTED" || refund.manager_status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: "STALE", message: "Penggantian ini sudah diproses atau tidak lagi menunggu keputusan Anda." },
        { status: 409 }
      );
    }

    const employeePhone = normalizePhone(emp?.phone_number);
    const employeeName = emp?.employee_name || "Karyawan";

    // Kabari HR keputusannya (sama untuk setuju/tolak — HR pemilik alur)
    const notifyHr = async (decision: string, detail: string) => {
      const { data: hrRow } = await supabase
        .from("claims")
        .select("hr:employees!claims_hr_id_fkey(phone_number)")
        .eq("id", claim.id)
        .maybeSingle();
      const hrRaw = (hrRow as { hr?: unknown } | null)?.hr;
      const hrObj = (Array.isArray(hrRaw) ? hrRaw[0] : hrRaw) as { phone_number?: string } | undefined;
      const hrPhone = normalizePhone(hrObj?.phone_number);
      if (hrPhone) {
        await sendAndLog(
          supabase, claim.id, hrPhone,
          [
            `*Keputusan Manager*`,
            ``,
            `${mgr.employee_name} ${decision} alasan ${employeeName} untuk trip ${refund.trip_no} (klaim periode ${claim.period}).`,
            detail,
          ].join("\n"),
          decision.includes("MENYETUJUI")
            ? "REFUND_MANAGER_APPROVED_HR"
            : "REFUND_MANAGER_REJECTED_HR"
        );
      }
    };

    if (action === "reject") {
      // Tolak alasan → karyawan wajib mengganti (tetap REQUESTED)
      const { error } = await supabase
        .from("trip_refunds")
        .update({
          manager_status: "REJECTED",
          manager_reason: reason,
          manager_decided_at: new Date().toISOString(),
        })
        .eq("id", refund.id);
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      await supabase.from("comments").insert({
        claim_id: claim.id,
        message: `Manager (${mgr.employee_name}) MENOLAK alasan karyawan untuk trip ${refund.trip_no}. Alasan manager: ${reason}. Karyawan wajib mengganti ${rupiah(refund.amount)} ke rekening kantor.`,
        author_name: mgr.employee_name,
        author_role: "MANAGER",
      });

      const phone = employeePhone;
      after(async () => {
        await notifyHr("MENOLAK", `Alasan manager: ${reason}. Karyawan diminta mengganti ${rupiah(refund.amount)}.`);
        if (!phone) {
          await flowAlert(supabase, claim.id, "Manager menolak alasan karyawan, tapi karyawan tidak punya nomor WhatsApp — minta transfer secara manual.");
          return;
        }
        const bank = await getCompanyBank(supabase);
        const sent = await sendAndLog(
          supabase, claim.id, phone,
          buildRefundReasonRejectedMessage({
            employee_name: employeeName,
            period: claim.period,
            trip_no: refund.trip_no,
            amount: Number(refund.amount),
            manager_name: mgr.employee_name,
            manager_reason: reason,
            bank,
            link: emp ? portalLink(emp.id, phone) : "",
          }),
          "REFUND_REASON_REJECTED"
        );
        if (!sent) {
          await flowAlert(supabase, claim.id, "Pesan hasil keputusan manager gagal terkirim ke karyawan — kirim ulang dari detail klaim.");
        }
      });

      return NextResponse.json({ success: true });
    }

    // ==== Approve: perjalanan SAH — paraf tercatat, penggantian batal ====
    const { data: sig } = claim.manager_id
      ? await supabase.from("signatures").select("signature").eq("employee_id", claim.manager_id).maybeSingle()
      : { data: null };

    const { error } = await supabase
      .from("trip_refunds")
      .update({
        manager_status: "APPROVED",
        manager_signature: sig?.signature || null,
        manager_decided_at: new Date().toISOString(),
        status: "CANCELLED",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", refund.id);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await supabase.from("comments").insert({
      claim_id: claim.id,
      message: `Manager (${mgr.employee_name}) MENYETUJUI alasan karyawan untuk trip ${refund.trip_no} — perjalanan dianggap sah, paraf tercatat di trip. Tidak ada penggantian.`,
      author_name: mgr.employee_name,
      author_role: "MANAGER",
    });

    // Penggantian terakhir selesai → klaim kembali ke jalur approval
    try {
      await releaseClaimIfNoRefunds(supabase, claim.id);
    } catch (e) {
      await flowAlert(supabase, claim.id, e instanceof Error ? e.message : "Gagal mengembalikan klaim ke jalur approval setelah penggantian selesai.");
    }

    const phone = employeePhone;
    after(async () => {
      await notifyHr("MENYETUJUI", `Perjalanan dianggap sah — paraf tercatat, tidak ada penggantian.`);
      if (!phone) {
        await flowAlert(supabase, claim.id, "Manager menyetujui alasan karyawan, tapi karyawan tidak punya nomor WhatsApp — kabari secara manual.");
        return;
      }
      const sent = await sendAndLog(
        supabase, claim.id, phone,
        buildRefundReasonApprovedMessage({
          employee_name: employeeName,
          period: claim.period,
          trip_no: refund.trip_no,
          manager_name: mgr.employee_name,
        }),
        "REFUND_REASON_APPROVED"
      );
      if (!sent) {
        await flowAlert(supabase, claim.id, "Pesan hasil keputusan manager gagal terkirim ke karyawan — kabari manual bila perlu.");
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unhandled error in /api/refund/action:", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan sistem" }, { status: 500 });
  }
}
