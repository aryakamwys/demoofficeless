import { NextRequest, NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyPortalToken, refundApproveLink } from "@/lib/wa-link";
import { normalizePhone, buildRefundManagerApprovalMessage } from "@/lib/whatsapp";
import {
  fetchClaimFresh,
  processWebhookReply,
  activeRefunds,
  getCompanyBank,
  sendAndLog,
  flowAlert,
} from "@/lib/wa-flow";
import { getRecentTickets, ticketTitle } from "@/lib/envgate";

// Portal karyawan — semua proses klaim lewat web (WA hanya pengantar link
// + notifikasi). Token portal = HMAC employee+nomor, 90 hari; setiap request
// nomornya dicek ulang ke data terkini. Aksi memakai jalur logika yang sama
// dengan tombol approver (processWebhookReply) — satu sumber kebenaran.
export const maxDuration = 60;

type PortalCtx = {
  supabase: ReturnType<typeof createServiceClient>;
  employeeId: string;
  phone: string;
};

async function loadCtx(token: string): Promise<PortalCtx | null> {
  const v = verifyPortalToken(token);
  if (!v) return null;
  const supabase = createServiceClient();
  const { data: emp } = await supabase
    .from("employees")
    .select("id, phone_number")
    .eq("id", v.employeeId)
    .maybeSingle();
  // Nomor berubah = token hangus (kunci link adalah nomor si pemilik)
  if (!emp || normalizePhone(emp.phone_number) !== v.phone) return null;
  return { supabase, employeeId: v.employeeId, phone: v.phone };
}

/** Daftar klaim karyawan — aktif di atas, selesai di bawah. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("t") || "";
  const ctx = await loadCtx(token);
  if (!ctx) {
    return NextResponse.json({ success: false, error: "TOKEN_INVALID" }, { status: 401 });
  }
  const { supabase, employeeId } = ctx;

  // Paralel: profil + daftar klaim (refund menyusul batch — butuh id klaim)
  const [empRes, claimsRes] = await Promise.all([
    supabase
      .from("employees")
      .select("employee_name, department, category")
      .eq("id", employeeId)
      .single(),
    supabase
      .from("claims")
      .select("id, period, trip_count, total_amount, status, manager_status, hr_status, approved_at, updated_at")
      .eq("employee_id", employeeId)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);
  const { data: emp } = empRes;
  const { data: claims } = claimsRes;

  // Penggantian aktif per klaim (satu query batch)
  const ids = (claims || []).map((c: { id: string }) => c.id);
  const refundsByClaim = new Map<string, number>();
  if (ids.length > 0) {
    const { data: refunds } = await supabase
      .from("trip_refunds")
      .select("claim_id")
      .in("claim_id", ids)
      .in("status", ["REQUESTED", "CLAIMED"]);
    for (const r of refunds || []) {
      refundsByClaim.set(r.claim_id, (refundsByClaim.get(r.claim_id) || 0) + 1);
    }
  }

  const rows = (claims || []).map((c: Record<string, unknown>) => ({
    id: c.id,
    period: c.period,
    trip_count: c.trip_count,
    total_amount: Number(c.total_amount || 0),
    status: c.status,
    manager_status: c.manager_status,
    hr_status: c.hr_status,
    approved_at: c.approved_at,
    refund_pending: refundsByClaim.get(c.id as string) || 0,
    updated_at: c.updated_at,
  }));

  const active = rows.filter((r) => r.status !== "APPROVED");
  const done = rows.filter((r) => r.status === "APPROVED").slice(0, 10);

  return NextResponse.json({
    success: true,
    employee: {
      name: emp?.employee_name || "Karyawan",
      department: emp?.department || "",
      category: emp?.category || "ENGINEER",
    },
    active,
    done,
  });
}

/** Detail satu klaim untuk halaman kerja portal. */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      return await handleProofUpload(request);
    }

    const body = await request.json();
    const ctx = await loadCtx(String(body?.token || ""));
    if (!ctx) {
      return NextResponse.json({ success: false, error: "TOKEN_INVALID" }, { status: 401 });
    }
    const { supabase, employeeId, phone } = ctx;

    // ==== Detail klaim (dipakai halaman kerja) ====
    if (body?.action === "detail") {
      const claim = await fetchClaimFresh(supabase, String(body.claim_id || ""));
      if (!claim || claim.employee_id !== employeeId) {
        return NextResponse.json({ success: false, error: "CLAIM_NOT_FOUND" }, { status: 404 });
      }
      const refunds = await activeRefunds(supabase, claim.id);

      // Bukti transfer: signed URL untuk gambar yang sudah diunggah
      const proofPaths = refunds.filter((r) => r.proof_path).map((r) => r.proof_path!);
      const proofUrlByPath = new Map<string, string>();
      if (proofPaths.length > 0) {
        const { data: urls } = await supabase.storage
          .from("dataperkom")
          .createSignedUrls(proofPaths, 3600);
        for (const u of urls || []) {
          if (u.error || !u.path) continue;
          proofUrlByPath.set(String(u.path), String(u.signedUrl));
        }
      }

      // Alasan revisi terakhir (kalau sedang direvisi)
      let revision_reason: string | null = null;
      if (claim.status === "NEED_REVIEW" && claim.approved_at) {
        const { data: rev } = await supabase
          .from("comments")
          .select("message")
          .eq("claim_id", claim.id)
          .in("author_role", ["MANAGER", "HR"])
          .ilike("message", "Minta revisi%")
          .order("created_at", { ascending: false })
          .limit(1);
        if (rev && rev[0]) {
          revision_reason = String(rev[0].message).replace(/^Minta revisi:\s*/i, "");
        }
      }

      // Saran ticket EnvGate milik engineer untuk bulan klaim ini
      let ticket_options: Array<{ id: number; title: string }> = [];
      if ((claim.employee?.category || "ENGINEER") !== "SALES") {
        try {
          const trips = claim.trips || [];
          const monthDate = trips.length > 0 ? new Date(trips[0].trip_date) : new Date();
          const recent = await getRecentTickets(null, null);
          const name = claim.employee?.employee_name || "";
          ticket_options = recent
            .filter(
              (t) =>
                (t.requester_user?.name || "").toLowerCase() === name.toLowerCase() &&
                t.created_at &&
                (() => {
                  const d = new Date(String(t.created_at));
                  return d.getMonth() === monthDate.getMonth() && d.getFullYear() === monthDate.getFullYear();
                })()
            )
            .slice(0, 50)
            .map((t) => ({ id: Number(t.id), title: ticketTitle(t) || `#${t.id}` }));
        } catch {
          // EnvGate down — karyawan tetap bisa ketik manual
        }
      }

      const bank = await getCompanyBank(supabase);

      return NextResponse.json({
        success: true,
        claim: {
          id: claim.id,
          period: claim.period,
          status: claim.status,
          manager_status: claim.manager_status,
          hr_status: claim.hr_status,
          approved_at: claim.approved_at,
          total_amount: claim.total_amount,
          in_revision: claim.status === "NEED_REVIEW" && !!claim.approved_at,
          revision_reason,
          trips: (claim.trips || []).map((t: Record<string, unknown>, i: number) => ({
            no: i + 1,
            date: t.trip_date,
            pickup: t.pickup,
            dropoff: t.dropoff,
            fare: Number(t.fare || 0),
            service_type: t.service_type || null,
            ticket_id: t.ticket_id || null,
          })),
          refunds: refunds.map((r) => ({
            id: r.id,
            trip_no: r.trip_no,
            amount: Number(r.amount),
            reason: r.reason,
            status: r.status,
            manager_status: (r as Record<string, unknown>).manager_status as string | null,
            employee_reason: ((r as Record<string, unknown>).employee_reason as string | null) || null,
            manager_reason: ((r as Record<string, unknown>).manager_reason as string | null) || null,
            proof_url: r.proof_path ? proofUrlByPath.get(r.proof_path) || null : null,
            proof_validated: !!(r as Record<string, unknown>).proof_validated,
          })),
          bank,
          ticket_options,
        },
      });
    }

    // ==== Aksi — dipetakan ke jalur logika teruji (processWebhookReply) ====
    const claimId = String(body.claim_id || "");
    const claim = await fetchClaimFresh(supabase, claimId);
    if (!claim || claim.employee_id !== employeeId) {
      return NextResponse.json({ success: false, error: "CLAIM_NOT_FOUND" }, { status: 404 });
    }
    if (claim.status === "APPROVED") {
      return NextResponse.json(
        { success: false, error: "Klaim ini sudah selesai." },
        { status: 409 }
      );
    }

    // ==== Karyawan membela perjalanan: alasan diteruskan ke manager ====
    if (String(body.action) === "refund_explain") {
      const text = String(body.text || "").trim().slice(0, 300);
      if (text.length < 5) {
        return NextResponse.json(
          { success: false, error: "Alasan terlalu pendek — tulis minimal 5 karakter." },
          { status: 400 }
        );
      }
      const { data: refund } = await supabase
        .from("trip_refunds")
        .select("id, trip_no, status, manager_status, pickup, dropoff, amount, reason")
        .eq("id", String(body.refund_id || ""))
        .eq("claim_id", claim.id)
        .maybeSingle();
      if (!refund) {
        return NextResponse.json({ success: false, error: "Penggantian tidak ditemukan." }, { status: 404 });
      }
      // Satu ronde saja: sudah diputuskan manager = tidak bisa membela lagi
      if (refund.status !== "REQUESTED" || refund.manager_status) {
        return NextResponse.json(
          { success: false, error: "Penggantian ini sudah diproses — tidak bisa kirim alasan lagi." },
          { status: 409 }
        );
      }
      const mgrPhone = claim.manager ? normalizePhone(claim.manager.phone_number) : null;
      if (!claim.manager_id || !mgrPhone) {
        return NextResponse.json(
          { success: false, error: "Klaim ini tidak punya manager — silakan langsung transfer." },
          { status: 409 }
        );
      }

      const { error: updErr } = await supabase
        .from("trip_refunds")
        .update({
          employee_reason: text,
          employee_explained_at: new Date().toISOString(),
          manager_status: "PENDING",
        })
        .eq("id", refund.id);
      if (updErr) {
        return NextResponse.json({ success: false, error: "Gagal menyimpan alasan." }, { status: 500 });
      }

      await supabase.from("comments").insert({
        claim_id: claim.id,
        message: `Karyawan membela trip ${refund.trip_no}: "${text}" — menunggu keputusan manager.`,
        author_name: claim.employee?.employee_name || "Karyawan",
        author_role: "EMPLOYEE",
      });

      // Kirim ke manager di background — tombol karyawan tetap instan
      const link = refundApproveLink(refund.id, mgrPhone);
      const claimId = claim.id;
      const employeeName = claim.employee?.employee_name || "Karyawan";
      const period = claim.period;
      const trip = {
        trip_no: refund.trip_no,
        pickup: String(refund.pickup || ""),
        dropoff: String(refund.dropoff || ""),
        amount: Number(refund.amount),
        reason: String(refund.reason || ""),
      };
      after(async () => {
        const sent = await sendAndLog(
          supabase, claimId, mgrPhone,
          buildRefundManagerApprovalMessage({
            employee_name: employeeName,
            period,
            trip_no: trip.trip_no,
            pickup: trip.pickup,
            dropoff: trip.dropoff,
            amount: trip.amount,
            reason: trip.reason,
            employee_reason: text,
            link,
          }),
          "REFUND_MANAGER_APPROVAL_PROMPT"
        );
        if (!sent) {
          await flowAlert(supabase, claimId, "Alasan karyawan gagal terkirim ke manager — kirim ulang dari detail klaim setelah device normal.");
        }
      });

      return NextResponse.json({ success: true });
    }

    let reply = "";
    switch (String(body.action)) {
      case "confirm":
        reply = "1";
        break;
      case "done":
        reply = "SELESAI";
        break;
      case "note":
        reply = String(body.text || "").trim().slice(0, 500);
        if (reply.length < 3) {
          return NextResponse.json({ success: false, error: "Catatan terlalu pendek." }, { status: 400 });
        }
        break;
      case "ticket": {
        const no = Number(body.trip_no);
        const id = String(body.ticket_id || "").trim();
        if (!Number.isInteger(no) || no < 1 || !id) {
          return NextResponse.json({ success: false, error: "Trip dan ticket wajib dipilih." }, { status: 400 });
        }
        reply = `TICKET ${no} ${id}`;
        break;
      }
      case "refund_claimed":
        reply = "SUDAH TF";
        break;
      default:
        return NextResponse.json({ success: false, error: "Aksi tidak dikenal" }, { status: 400 });
    }

    // Simpan & proses klaim di background — pengiriman WA (jeda anti-limit
    // 2-5 detik/pesan) tidak boleh menahan respons web. Respon < 1 detik;
    // kabar WhatsApp menyusul setelahnya.
    after(() => processWebhookReply(claim, "EMPLOYEE", reply, phone));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unhandled error in /api/portal:", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan sistem" }, { status: 500 });
  }
}

/** Upload bukti transfer (multipart: token, claim_id, file ≤5MB). */
async function handleProofUpload(request: NextRequest) {
  const form = await request.formData();
  const ctx = await loadCtx(String(form.get("token") || ""));
  if (!ctx) {
    return NextResponse.json({ success: false, error: "TOKEN_INVALID" }, { status: 401 });
  }
  const { supabase } = ctx;
  const claimId = String(form.get("claim_id") || "");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ success: false, error: "File tidak terbaca." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: "Maksimal 5MB." }, { status: 400 });
  }
  const ct = file.type || "image/jpeg";
  if (!ct.startsWith("image/")) {
    return NextResponse.json({ success: false, error: "Harus berupa gambar." }, { status: 400 });
  }

  // Refund aktif milik klaim ini milik karyawan ini
  const { data: own } = await supabase
    .from("claims")
    .select("id")
    .eq("id", claimId)
    .eq("employee_id", ctx.employeeId)
    .maybeSingle();
  if (!own) {
    return NextResponse.json({ success: false, error: "CLAIM_NOT_FOUND" }, { status: 404 });
  }
  const refunds = await activeRefunds(supabase, claimId);
  const withoutProof = refunds.filter((r) => !r.proof_path);
  const target = withoutProof[withoutProof.length - 1];
  if (!target) {
    return NextResponse.json(
      { success: false, error: "Tidak ada penggantian yang menunggu bukti." },
      { status: 409 }
    );
  }

  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
  const storagePath = `refunds/${target.id}/${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("dataperkom")
    .upload(storagePath, buf, { contentType: ct });
  if (upErr) {
    return NextResponse.json({ success: false, error: "Gagal menyimpan file." }, { status: 500 });
  }
  const { error: updErr } = await supabase
    .from("trip_refunds")
    .update({ proof_path: storagePath, proof_received_at: new Date().toISOString() })
    .eq("id", target.id);
  if (updErr) {
    return NextResponse.json({ success: false, error: "Gagal menandai bukti." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    trip_no: target.trip_no,
    remaining: withoutProof.slice(0, -1).map((r) => r.trip_no),
  });
}
