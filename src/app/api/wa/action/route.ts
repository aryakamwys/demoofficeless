import { NextRequest, NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyApproveToken, approveToken } from "@/lib/wa-link";
import { matchRole } from "@/lib/wa-match";
import { fetchClaimFresh, processWebhookReply, activeRefunds } from "@/lib/wa-flow";
import { errorMessage } from "@/lib/utils";

// Aksi tombol web (halaman /approve) — tanpa login: token di link pesan WA
// adalah kredensialnya (HMAC claim+nomor+role, 7 hari). Logika aksinya
// sama persis dengan balasan chat "1"/"2 <alasan>" — satu jalur lewat
// processWebhookReply.
export const maxDuration = 60;

function tokenFrom(request: NextRequest, body?: Record<string, unknown>): string {
  const fromQuery = new URL(request.url).searchParams.get("t");
  return String(fromQuery || (body && body.token) || "");
}

/** Antrean klaim LAIN yang sedang menunggu approver ini — manager/HR cuma
 *  beberapa orang menangani puluhan klaim; dari satu link mereka bisa
 *  memproses semuanya tanpa balas chat satu per satu. Pemegang link yang
 *  valid bertindak sebagai orangnya (trust model sama dengan wa-link). */
async function approverQueue(
  supabase: ReturnType<typeof createServiceClient>,
  claimId: string,
  phone: string,
  role: "MANAGER" | "HR"
) {
  const { data } = await supabase
    .from("claims")
    .select(`
      *,
      employee:employees!claims_employee_id_fkey(*),
      manager:employees!claims_manager_id_fkey(*),
      hr:employees!claims_hr_id_fkey(*)
    `)
    .in("status", ["SENT", "NEED_REVIEW"]);
  return (data || [])
    .filter((c) => c.id !== claimId && matchRole(c, phone) === role)
    .slice(0, 50)
    .map((c) => ({
      token: approveToken(c.id, phone, role),
      employee_name: c.employee?.employee_name || "Karyawan",
      period: c.period,
      total_amount: c.total_amount,
      trip_count: c.trip_count ?? 0,
    }));
}

export async function GET(request: NextRequest) {
  const v = verifyApproveToken(tokenFrom(request));
  if (!v) {
    return NextResponse.json({ success: false, error: "TOKEN_INVALID" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const claim = await fetchClaimFresh(supabase, v.claimId);
  if (!claim) {
    return NextResponse.json({ success: false, error: "CLAIM_NOT_FOUND" }, { status: 404 });
  }

  // Tahap sudah lewat (sudah di-approve / bukan gilirannya lagi) → halaman
  // menampilkan info, bukan tombol — tautan lama tidak bisa dipakai dua kali.
  // Antrean tetap dikirim: link dibuka setelah klaim ini diproses pun masih
  // berguna untuk klaim-klaim lain yang menunggu.
  const role = matchRole(claim, v.phone);
  if (role !== v.role) {
    const queue = v.role === "MANAGER" || v.role === "HR"
      ? await approverQueue(supabase, v.claimId, v.phone, v.role)
      : [];
    return NextResponse.json({ success: true, stale: true, role: v.role, queue });
  }

  // Mode revisi (karyawan): klaim dikembalikan oleh Manager/HR — halaman
  // berubah jadi daftar kerja revisi. Sertakan alasan revisi terakhir.
  const inRevision = v.role === "EMPLOYEE" && claim.status === "NEED_REVIEW" && claim.approved_at;
  let revision_reason: string | null = null;
  if (inRevision) {
    const { data: rev } = await supabase
      .from("comments")
      .select("message")
      .eq("claim_id", v.claimId)
      .in("author_role", ["MANAGER", "HR"])
      .ilike("message", "Minta revisi%")
      .order("created_at", { ascending: false })
      .limit(1);
    if (rev && rev[0]) {
      revision_reason = String(rev[0].message).replace(/^Minta revisi:\s*/i, "");
    }
  }

  // Penggantian trip "tidak sesuai" yang masih berjalan — halaman menampilkan
  // badge per-trip dan menonaktifkan Hapus/Ubah untuk trip bersangkutan.
  const { data: refundRows } = await supabase
    .from("trip_refunds")
    .select("trip_no, amount, reason, status")
    .eq("claim_id", v.claimId)
    .in("status", ["REQUESTED", "CLAIMED"]);

  return NextResponse.json({
    success: true,
    role: v.role,
    queue: v.role === "MANAGER" || v.role === "HR"
      ? await approverQueue(supabase, v.claimId, v.phone, v.role)
      : [],
    in_revision: inRevision,
    revision_reason,
    refunds: (refundRows || []).map((r) => ({
      no: r.trip_no,
      amount: Number(r.amount),
      reason: r.reason,
      status: r.status,
    })),
    claim: {
      period: claim.period,
      employee_name: claim.employee?.employee_name || "Karyawan",
      manager_name: claim.manager?.employee_name || null,
      hr_name: claim.hr?.employee_name || null,
      total_amount: claim.total_amount,
      trip_count: claim.trip_count ?? (claim.trips || []).length,
      trips: (claim.trips || []).map((t: Record<string, unknown>, i: number) => ({
        no: i + 1,
        date: t.trip_date,
        pickup: t.pickup,
        dropoff: t.dropoff,
        fare: t.fare,
        ticket_id: t.ticket_id || null,
      })),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const v = verifyApproveToken(tokenFrom(request, body));
    if (!v) {
      return NextResponse.json({ success: false, error: "TOKEN_INVALID" }, { status: 401 });
    }

    const action = String(body.action || "");
    const reason = String(body.reason || "").trim().slice(0, 500);
    if (!["APPROVE", "REVISE", "NOTE", "COMMAND"].includes(action)) {
      return NextResponse.json({ success: false, error: "Aksi tidak dikenal" }, { status: 400 });
    }
    if (action === "REVISE" && !reason) {
      return NextResponse.json({ success: false, error: "Alasan revisi wajib diisi" }, { status: 400 });
    }
    if (action === "NOTE" && !reason) {
      return NextResponse.json({ success: false, error: "Catatan wajib diisi" }, { status: 400 });
    }
    // NOTE hanya untuk karyawan — Manager/HR memakai REVISE (alasan wajib).
    if (action === "NOTE" && v.role !== "EMPLOYEE") {
      return NextResponse.json({ success: false, error: "Aksi tidak tersedia untuk role ini" }, { status: 400 });
    }
    // COMMAND = perintah revisi (HAPUS/UBAH/TICKET/SELESAI) dari tombol web —
    // teksnya sama persis dengan perintah chat, jalur pemrosesan pun sama.
    if (action === "COMMAND" && v.role !== "EMPLOYEE") {
      return NextResponse.json({ success: false, error: "Aksi tidak tersedia untuk role ini" }, { status: 400 });
    }
    const commandText = action === "COMMAND" ? String(body.text || "").trim().slice(0, 500) : "";
    if (action === "COMMAND" && !commandText) {
      return NextResponse.json({ success: false, error: "Perintah kosong" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const claim = await fetchClaimFresh(supabase, v.claimId);
    if (!claim) {
      return NextResponse.json({ success: false, error: "CLAIM_NOT_FOUND" }, { status: 404 });
    }

    // Cek ulang tahap pada kondisi klaim TERKINI — mencegah tombol dari
    // halaman lama meng-approve dua kali / di luar giliran.
    const role = matchRole(claim, v.phone);
    if (role !== v.role) {
      return NextResponse.json(
        { success: false, error: "STAGE_PASSED", message: "Klaim ini sudah diproses atau giliran Anda sudah lewat." },
        { status: 409 }
      );
    }

    // COMMAND berlaku saat klaim ditahan (revisi, atau menunggu penggantian
    // yang ditandai HR sebelum karyawan konfirmasi).
    if (action === "COMMAND" && claim.status !== "NEED_REVIEW") {
      return NextResponse.json(
        { success: false, error: "NOT_IN_REVISION", message: "Klaim ini tidak sedang dalam revisi." },
        { status: 409 }
      );
    }

    // Penggantian aktif menahan approval — tolak di sini supaya halaman
    // tidak menampilkan "Klaim disetujui" padahal alurnya menahan klaim.
    if (action === "APPROVE" && (v.role === "MANAGER" || v.role === "HR")) {
      const refunds = await activeRefunds(supabase, v.claimId);
      if (refunds.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "REFUND_HOLD",
            message:
              "Klaim masih ditahan: ada penggantian ke rekening kantor yang belum selesai (menunggu transfer karyawan / validasi HR). Setelah selesai, setujui lagi dari antrean.",
          },
          { status: 409 }
        );
      }
    }

    const reply = action === "APPROVE"
      ? "1"
      : action === "REVISE"
        ? `2 ${reason}`
        : action === "COMMAND"
          ? commandText
          : reason;
    // Proses di background — pengiriman WA (jeda anti-limit 2-5 detik/pesan)
    // tidak boleh menahan tombol approver. Respons < 1 detik; karyawan dan
    // tahap berikutnya dikabari setelahnya.
    after(() => processWebhookReply(claim, v.role, reply, v.phone));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unhandled error in /api/wa/action:", error);
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}
