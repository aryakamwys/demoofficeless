import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyRefundToken, portalLink } from "@/lib/wa-link";
import { normalizePhone, buildRefundRequestMessage } from "@/lib/whatsapp";
import { sendAndLog, flowAlert, getCompanyBank } from "@/lib/wa-flow";

// Keputusan manager atas penggantian trip "tidak sesuai" — dari link di
// pesan WA (token HMAC, tanpa login; trust model sama dengan /api/wa/action).
// Approve → paraf otomatis dari ttd manager yang tersimpan, LALU karyawan
// diminta transfer. Reject → tanda dibatalkan, trip tetap di klaim.
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

    if (action === "reject") {
      const { error } = await supabase
        .from("trip_refunds")
        .update({
          manager_status: "REJECTED",
          manager_reason: reason,
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
        message: `Manager (${mgr.employee_name}) MENOLAK tanda tidak sesuai trip ${refund.trip_no}. Alasan: ${reason}. Trip tetap di klaim — karyawan tidak perlu mengganti.`,
        author_name: mgr.employee_name,
        author_role: "MANAGER",
      });

      // HR perlu tahu keputusannya (karyawan belum pernah diminta — aman)
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
            `${mgr.employee_name} MENOLAK tanda tidak sesuai pada klaim ${emp?.employee_name || "karyawan"} periode ${claim.period} (trip ${refund.trip_no}).`,
            `Alasannya: ${reason}`,
            ``,
            `Trip tetap di klaim — silakan cek detailnya di aplikasi.`,
          ].join("\n"),
          "REFUND_MANAGER_REJECTED_HR"
        );
      }
      return NextResponse.json({ success: true });
    }

    // ==== Approve: tempel paraf tersimpan, lalu minta transfer ke karyawan ====
    const { data: sig } = claim.manager_id
      ? await supabase.from("signatures").select("signature").eq("employee_id", claim.manager_id).maybeSingle()
      : { data: null };

    const { error } = await supabase
      .from("trip_refunds")
      .update({
        manager_status: "APPROVED",
        manager_signature: sig?.signature || null,
        manager_decided_at: new Date().toISOString(),
      })
      .eq("id", refund.id);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    await supabase.from("comments").insert({
      claim_id: claim.id,
      message: `Manager (${mgr.employee_name}) MENYETUJUI penggantian ${rupiah(refund.amount)} untuk trip ${refund.trip_no}. Alasan: ${refund.reason}. Karyawan diminta transfer ke rekening kantor.`,
      author_name: mgr.employee_name,
      author_role: "MANAGER",
    });

    if (!employeePhone) {
      await flowAlert(supabase, claim.id, "Manager sudah menyetujui penggantian, tapi karyawan tidak punya nomor WhatsApp — minta transfer secara manual.");
      return NextResponse.json({ success: true });
    }

    const bank = await getCompanyBank(supabase);
    if (!bank) {
      // Mark sudah mewajibkan rekening kantor terisi — ini pengaman saja
      await flowAlert(supabase, claim.id, "Rekening kantor belum terisi — pesan penggantian ke karyawan belum bisa dikirim. Isi di Settings lalu kirim ulang dari detail klaim.");
      return NextResponse.json({ success: true });
    }
    const sent = await sendAndLog(
      supabase, claim.id, employeePhone,
      buildRefundRequestMessage({
        employee_name: emp?.employee_name || "Karyawan",
        period: claim.period,
        trip_no: refund.trip_no,
        trip: {
          trip_date: refund.trip_date || new Date().toISOString(),
          pickup: refund.pickup || "",
          dropoff: refund.dropoff || "",
          fare: Number(refund.amount),
        },
        amount: Number(refund.amount),
        reason: refund.reason,
        bank,
        link: emp ? portalLink(emp.id, employeePhone || "") : "",
      }),
      "REFUND_REQUEST"
    );
    if (!sent) {
      await flowAlert(supabase, claim.id, "Pesan penggantian ke karyawan gagal terkirim setelah paraf manager — kirim ulang dari detail klaim.");
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unhandled error in /api/refund/action:", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan sistem" }, { status: 500 });
  }
}
