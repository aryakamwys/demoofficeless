import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase-server";
import { fetchClaimFresh, sendAndLog, flowAlert, activeRefunds, getCompanyBank, releaseClaimIfNoRefunds } from "@/lib/wa-flow";
import {
  normalizePhone,
  buildRefundFlaggedMessage,
  buildRefundInfoMessage,
  buildRefundConfirmedMessage,
  buildRefundAskAgainMessage,
  buildRefundCancelledMessage,
} from "@/lib/whatsapp";
import { portalLink } from "@/lib/wa-link";

// Aksi HR untuk penggantian trip "tidak sesuai" (karyawan transfer biaya
// trip ke rekening kantor). Semua aksi hanya untuk HR yang login —
// konfirmasi uang adalah keputusan keuangan, tidak lewat chat.
export const maxDuration = 60;

function rupiah(n: number | string): string {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const actor = user.email || "HR";

  const service = createServiceClient();
  const claim = await fetchClaimFresh(service, id);
  if (!claim) {
    return NextResponse.json({ success: false, error: "Klaim tidak ditemukan" }, { status: 404 });
  }
  const employeePhone = normalizePhone(claim.employee?.phone_number);

  const body = await request.json();
  const action = String(body.action || "");

  // ==== Tandai trip tidak sesuai → minta penggantian ke rekening kantor ====
  if (action === "mark") {
    const tripId = String(body.trip_id || "");
    const reason = String(body.reason || "").trim().slice(0, 300);
    const amount = Math.round(Number(body.amount));
    if (!tripId || !reason || !amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Trip, alasan, dan nominal wajib diisi" },
        { status: 400 }
      );
    }
    if (claim.status === "APPROVED") {
      return NextResponse.json(
        { success: false, error: "Klaim sudah disetujui penuh — batalkan approval dulu jika perlu" },
        { status: 409 }
      );
    }

    const trips = claim.trips || [];
    const idx = trips.findIndex((t: { id: string }) => t.id === tripId);
    if (idx < 0) {
      return NextResponse.json({ success: false, error: "Trip tidak ditemukan di klaim ini" }, { status: 400 });
    }
    const existing = await activeRefunds(service, id);
    if (existing.some((r) => r.trip_id === tripId)) {
      return NextResponse.json({ success: false, error: "Trip ini sudah ditandai" }, { status: 409 });
    }
    const bank = await getCompanyBank(service);
    if (!bank) {
      return NextResponse.json(
        {
          success: false,
          error: "REKENING_KANTOR_KOSONG",
          message: "Isi rekening kantor dulu di halaman Settings sebelum menandai trip.",
        },
        { status: 400 }
      );
    }

    const trip = trips[idx] as {
      id: string; trip_date: string; pickup: string; dropoff: string; fare: number;
    };

    // Alur v2: KARYAWAN dulu yang diminta alasan — manager hanya dilibatkan
    // kalau karyawan membela perjalanannya (paraf = perjalanan sah).
    const { data: refund, error: insErr } = await service
      .from("trip_refunds")
      .insert({
        claim_id: id,
        trip_id: tripId,
        trip_no: idx + 1,
        trip_date: trip.trip_date,
        pickup: trip.pickup,
        dropoff: trip.dropoff,
        amount,
        reason,
        status: "REQUESTED",
        requested_by: actor,
      })
      .select()
      .single();
    if (insErr || !refund) {
      return NextResponse.json({ success: false, error: insErr?.message || "Gagal menyimpan" }, { status: 500 });
    }

    // Tahan klaim di mode perbaikan — tidak bisa maju selama penggantian jalan
    if (claim.status !== "NEED_REVIEW") {
      const { error } = await service.from("claims").update({ status: "NEED_REVIEW" }).eq("id", id);
      if (error) {
        return NextResponse.json({ success: false, error: `Gagal menahan klaim: ${error.message}` }, { status: 500 });
      }
    }

    await service.from("comments").insert({
      claim_id: id,
      message: `Trip ${idx + 1} ditandai TIDAK SESUAI oleh HR — alasan: ${reason}. Karyawan diminta memberi alasan (diteruskan ke manager bila membela perjalanan) atau mengganti ${rupiah(amount)} ke rekening kantor.`,
      author_name: actor,
      author_role: "HR",
    });

    if (employeePhone) {
      const sent = await sendAndLog(
        service, id, employeePhone,
        buildRefundFlaggedMessage({
          employee_name: claim.employee?.employee_name || "Karyawan",
          period: claim.period,
          trip_no: idx + 1,
          trip,
          amount,
          reason,
          link: claim.employee ? portalLink(claim.employee.id, employeePhone) : "",
        }),
        "REFUND_FLAGGED"
      );
      if (!sent) {
        await flowAlert(service, id, "Tanda tidak sesuai gagal terkirim ke karyawan — kirim ulang dari detail klaim setelah device normal.");
      }
    } else {
      await flowAlert(service, id, "Karyawan tidak punya nomor WhatsApp — penggantian tidak bisa diminta via chat. Hubungi manual.");
    }

    return NextResponse.json({ success: true, data: refund });
  }

  // Semua aksi lain beroperasi pada satu baris penggantian
  const refundId = String(body.refund_id || "");
  if (!refundId) {
    return NextResponse.json({ success: false, error: "refund_id wajib" }, { status: 400 });
  }
  const { data: refundRow } = await service
    .from("trip_refunds")
    .select("*")
    .eq("id", refundId)
    .eq("claim_id", id)
    .single();
  if (!refundRow) {
    return NextResponse.json({ success: false, error: "Penggantian tidak ditemukan" }, { status: 404 });
  }
  const isActive = refundRow.status === "REQUESTED" || refundRow.status === "CLAIMED";

  // ==== Validasi bukti transfer (gambar dari WA) oleh HR ====
  if (action === "validate_proof") {
    if (!refundRow.proof_path) {
      return NextResponse.json({ success: false, error: "Belum ada bukti transfer untuk penggantian ini" }, { status: 400 });
    }
    const ok = Boolean(body.ok);
    const reason = String(body.reason || "").trim().slice(0, 300);
    if (!ok && !reason) {
      return NextResponse.json({ success: false, error: "Alasan penolakan wajib diisi" }, { status: 400 });
    }
    const { error: vErr } = await service
      .from("trip_refunds")
      .update({
        proof_validated: ok,
        proof_reject_reason: ok ? null : reason,
      })
      .eq("id", refundId);
    if (vErr) {
      return NextResponse.json({ success: false, error: vErr.message }, { status: 500 });
    }

    // Kabari karyawan hasil validasinya
    if (employeePhone) {
      await sendAndLog(
        service, id, employeePhone,
        ok
          ? [
              `*Bukti Transfer Diterima*`,
              ``,
              `Bukti transfer perjalanan nomor ${refundRow.trip_no} sudah diperiksa HR dan lolos validasi. Terima kasih!`,
            ].join("\n")
          : [
              `*Bukti Transfer Ditolak*`,
              ``,
              `Bukti transfer perjalanan nomor ${refundRow.trip_no} belum lolos pemeriksaan HR.`,
              `Alasannya: ${reason}`,
              ``,
              `Mohon kirim ulang gambar bukti transfer yang benar (transfer ke rekening kantor, nominal ${rupiah(refundRow.amount)}, nama dan nomor rekening terlihat jelas).`,
            ].join("\n"),
        ok ? "PROOF_VALIDATED" : "PROOF_REJECTED"
      );
    }
    return NextResponse.json({ success: true });
  }

  // ==== Kirim ulang info nominal + rekening kantor ====
  if (action === "send_norek") {
    if (!isActive) {
      return NextResponse.json({ success: false, error: "Penggantian ini sudah tidak aktif" }, { status: 409 });
    }
    if (!employeePhone) {
      return NextResponse.json({ success: false, error: "Karyawan tidak punya nomor WhatsApp" }, { status: 400 });
    }
    const bank = await getCompanyBank(service);
    const active = await activeRefunds(service, id);
    const sent = await sendAndLog(
      service, id, employeePhone,
      buildRefundInfoMessage({ period: claim.period, refunds: active, bank }),
      "REFUND_INFO"
    );
    if (!sent) {
      return NextResponse.json({ success: false, error: "Gagal mengirim pesan WhatsApp" }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  }

  // ==== Konfirmasi uang masuk → trip keluar dari klaim otomatis ====
  if (action === "confirm") {
    if (refundRow.status === "CONFIRMED") {
      return NextResponse.json({ success: true, message: "Sudah dikonfirmasi sebelumnya" });
    }
    if (!isActive) {
      return NextResponse.json({ success: false, error: "Penggantian ini sudah dibatalkan" }, { status: 409 });
    }

    // Hapus trip (idempoten — trip bisa saja sudah terhapus lewat jalur lain)
    if (refundRow.trip_id) {
      const { error: delErr } = await service.from("trips").delete().eq("id", refundRow.trip_id);
      if (delErr) {
        return NextResponse.json({ success: false, error: `Gagal menghapus trip: ${delErr.message}` }, { status: 500 });
      }
    }
    // Hitung ulang total klaim dari trip tersisa
    const { data: fares, error: fareErr } = await service
      .from("trips")
      .select("fare")
      .eq("claim_id", id);
    if (fareErr) {
      return NextResponse.json({ success: false, error: `Gagal membaca trip: ${fareErr.message}` }, { status: 500 });
    }
    const total = (fares || []).reduce((acc, t) => acc + Number(t.fare), 0);
    const { error: claimErr } = await service
      .from("claims")
      .update({ total_amount: total, trip_count: (fares || []).length })
      .eq("id", id);
    if (claimErr) {
      return NextResponse.json({ success: false, error: `Gagal memperbarui klaim: ${claimErr.message}` }, { status: 500 });
    }

    const { error: updErr } = await service
      .from("trip_refunds")
      .update({ status: "CONFIRMED", confirmed_by: actor, confirmed_at: new Date().toISOString() })
      .eq("id", refundId);
    if (updErr) {
      return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });
    }

    await service.from("comments").insert({
      claim_id: id,
      message: `Penggantian ${rupiah(refundRow.amount)} untuk trip ${refundRow.trip_no} DITERIMA oleh ${actor}. Trip dikeluarkan dari klaim — total sekarang ${rupiah(total)}.`,
      author_name: actor,
      author_role: "HR",
    });

    // Semua penggantian selesai → klaim kembali ke jalur approval
    try {
      await releaseClaimIfNoRefunds(service, id);
    } catch (e) {
      await flowAlert(service, id, e instanceof Error ? e.message : "Gagal mengembalikan klaim ke jalur approval setelah penggantian selesai.");
    }

    if (employeePhone) {
      const sent = await sendAndLog(
        service, id, employeePhone,
        buildRefundConfirmedMessage({
          employee_name: claim.employee?.employee_name || "Karyawan",
          period: claim.period,
          trip_no: refundRow.trip_no,
          amount: Number(refundRow.amount),
          new_total: total,
          link: claim.employee ? portalLink(claim.employee.id, employeePhone) : "",
        }),
        "REFUND_CONFIRMED"
      );
      if (!sent) {
        await flowAlert(service, id, "Konfirmasi penggantian gagal terkirim ke karyawan — kirim ulang setelah device normal.");
      }
    }

    return NextResponse.json({ success: true, data: { total_amount: total } });
  }

  // ==== Uang belum masuk → kembali menunggu transfer ====
  if (action === "ask_again") {
    if (refundRow.status !== "CLAIMED") {
      return NextResponse.json(
        { success: false, error: "Hanya berlaku untuk penggantian berstatus 'sudah transfer'" },
        { status: 409 }
      );
    }
    const { error } = await service
      .from("trip_refunds")
      .update({ status: "REQUESTED", claimed_at: null })
      .eq("id", refundId);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    await service.from("comments").insert({
      claim_id: id,
      message: `HR belum menemukan transferan ${rupiah(refundRow.amount)} (trip ${refundRow.trip_no}) di mutasi — karyawan diminta cek/ulangi transfer.`,
      author_name: actor,
      author_role: "HR",
    });
    if (employeePhone) {
      await sendAndLog(
        service, id, employeePhone,
        buildRefundAskAgainMessage(Number(refundRow.amount)),
        "REFUND_ASK_AGAIN"
      );
    }
    return NextResponse.json({ success: true });
  }

  // ==== Batalkan tanda (mis. salah tandai) — trip tetap di klaim ====
  if (action === "cancel") {
    if (!isActive) {
      return NextResponse.json({ success: false, error: "Penggantian ini sudah tidak aktif" }, { status: 409 });
    }
    const { error } = await service
      .from("trip_refunds")
      .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
      .eq("id", refundId);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    await service.from("comments").insert({
      claim_id: id,
      message: `Tanda "tidak sesuai" pada trip ${refundRow.trip_no} DIBATALKAN oleh ${actor} — trip tetap di klaim, tidak perlu penggantian.`,
      author_name: actor,
      author_role: "HR",
    });

    // Semua penggantian selesai → klaim kembali ke jalur approval
    try {
      await releaseClaimIfNoRefunds(service, id);
    } catch (e) {
      await flowAlert(service, id, e instanceof Error ? e.message : "Gagal mengembalikan klaim ke jalur approval setelah penggantian dibatalkan.");
    }
    if (employeePhone) {
      await sendAndLog(
        service, id, employeePhone,
        buildRefundCancelledMessage(refundRow.trip_no, claim.period),
        "REFUND_CANCELLED"
      );
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Aksi tidak dikenal" }, { status: 400 });
}
