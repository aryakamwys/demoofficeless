"use client";

// Halaman keputusan manager atas ALASAN KARYAWAN untuk trip "tidak sesuai"
// — tanpa login: token di link pesan WA adalah kuncinya (skema sama dengan
// /approve). Setujui = perjalanan sah (paraf tercatat, karyawan tidak bayar);
// Tolak = karyawan wajib mengganti ke rekening kantor.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Circle, Square } from "lucide-react";
import { ConfirmModal, InfoModal } from "@/components/ui/confirm-modal";

type RefundInfo = {
  employee_name: string;
  manager_name: string;
  period: string;
  trip_no: number;
  trip_date: string | null;
  pickup: string | null;
  dropoff: string | null;
  amount: number;
  reason: string;
  employee_reason: string;
  has_signature: boolean;
  decision: string | null;
};

type Phase =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "stale"; message: string }
  | { phase: "done"; title: string }
  | { phase: "ready"; data: RefundInfo; busy: boolean };

function rupiah(n: number) {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

export default function RefundApprovePage() {
  const [state, setState] = useState<Phase>({ phase: "loading" });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  // Modal info setelah keputusan tersimpan (WA jalan di background)
  const [doneInfo, setDoneInfo] = useState(false);
  const tokenRef = useRef("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") || "";
    tokenRef.current = t;
    if (!t) {
      // Di luar jalur sinkron effect — hindari render berantai
      queueMicrotask(() =>
        setState({ phase: "error", message: "Link-nya kurang lengkap. Buka ulang dari pesan WhatsApp." })
      );
      return;
    }
    fetch(`/api/refund/action?t=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body.success) {
          setState({
            phase: "error",
            message:
              body.error === "TOKEN_INVALID"
                ? "Link ini tidak berlaku lagi atau sudah lewat 7 hari."
                : "Penggantian ini tidak dapat dibuka.",
          });
          return;
        }
        if (body.stale) {
          setState({
            phase: "stale",
            message:
              body.refund.decision === "APPROVED"
                ? "Anda sudah menyetujui alasan ini sebelumnya — perjalanan dianggap sah."
                : body.refund.decision === "REJECTED"
                  ? "Anda sudah menolak alasan ini sebelumnya — karyawan diminta mengganti."
                  : "Penggantian ini sudah tidak menunggu keputusan lagi.",
          });
          return;
        }
        setState({ phase: "ready", data: body.refund as RefundInfo, busy: false });
      })
      .catch(() => setState({ phase: "error", message: "Gagal terhubung. Cek koneksi, lalu buka ulang." }));
  }, []);

  const submit = async (action: "approve" | "reject", text?: string) => {
    if (state.phase !== "ready") return;
    setError("");
    setState({ ...state, busy: true });
    try {
      const res = await fetch("/api/refund/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenRef.current, action, reason: text || "" }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        if (body.error === "STALE") {
          setState({ phase: "stale", message: body.message || "Penggantian ini sudah diproses." });
          return;
        }
        throw new Error(body.error || body.message || "Gagal memproses. Coba lagi.");
      }
      setState({
        phase: "done",
        title:
          action === "approve"
            ? `Alasan diterima — perjalanan dianggap sah${state.data.has_signature ? " dengan paraf Anda" : ""}. Karyawan tidak perlu membayar.`
            : "Alasan ditolak — karyawan diminta mengganti ke rekening kantor.",
      });
      setDoneInfo(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses. Coba lagi.");
      if (state.phase === "ready") setState({ ...state, busy: false });
      setShowReject(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F7] pb-16">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2.5 px-4 md:max-w-2xl lg:max-w-5xl">
          <Image src="/ogoperkom.png" alt="Perkom" width={28} height={28} className="h-7 w-7 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight text-slate-900">Klaim Grab Perkom</p>
            <p className="text-[11px] leading-tight text-slate-500">Keputusan perjalanan ditandai tidak sesuai</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4 md:max-w-2xl lg:max-w-5xl">
        {state.phase === "loading" && (
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded-2xl bg-slate-200/60" />
            <div className="h-40 animate-pulse rounded-2xl bg-slate-200/60" />
          </div>
        )}

        {state.phase === "error" && (
          <div className="rounded-2xl bg-white p-6 text-center">
            <p className="text-[15px] font-semibold text-slate-900">Link tidak bisa dibuka</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{state.message}</p>
          </div>
        )}

        {state.phase === "stale" && (
          <div className="rounded-2xl bg-white p-6 text-center">
            <p className="text-[15px] font-semibold text-slate-900">Sudah diproses</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{state.message}</p>
          </div>
        )}

        {state.phase === "done" && (
          <>
            <div className="rounded-2xl bg-white p-8 text-center">
              <p className="text-[16px] font-bold leading-relaxed text-emerald-700">{state.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                Keputusan sudah dikirim ke karyawan dan HR. Tidak perlu membalas pesan apa pun.
              </p>
            </div>
            <InfoModal
              open={doneInfo}
              title="Keputusan tersimpan"
              desc="Karyawan dan HR sedang dikabari lewat WhatsApp otomatis — berjalan di latar belakang, tidak perlu menunggu di halaman ini."
              onClose={() => setDoneInfo(false)}
            />
          </>
        )}

        {state.phase === "ready" && (
          <>
            {state.busy && (
              <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-slate-600">
                <span className="loading loading-spinner loading-sm text-slate-400" />
                Menyimpan keputusan…
              </div>
            )}

            {/* Kartu: trip yang dipertanyakan + alasan kedua pihak */}
            <div className="rounded-2xl bg-white p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[15px] font-bold text-slate-900">
                  {state.data.employee_name} — perjalanan nomor {state.data.trip_no}
                </p>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  Periode {state.data.period}
                </span>
              </div>

              <div className="mt-3 rounded-xl bg-amber-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Ditandai tidak sesuai oleh HR</p>
                <p className="mt-1 text-[13px] font-medium leading-relaxed text-amber-900">“{state.data.reason}”</p>
              </div>

              <div className="mt-2.5 rounded-xl bg-emerald-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Alasan karyawan</p>
                <p className="mt-1 text-[13px] font-medium leading-relaxed text-emerald-900">“{state.data.employee_reason || "-"}”</p>
              </div>

              <div className="mt-3 flex gap-2.5">
                <div className="flex flex-col items-center pt-1">
                  <Circle className="h-2.5 w-2.5 fill-current text-slate-400" />
                  <span className="my-0.5 w-px flex-1 bg-slate-200" />
                  <Square className="h-2.5 w-2.5 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-[12px] leading-relaxed text-slate-600">{state.data.pickup}</p>
                  <p className="text-[12px] leading-relaxed text-slate-600">{state.data.dropoff}</p>
                </div>
              </div>

              <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
                Nilai penggantian bila alasan ditolak:{" "}
                <b className="text-slate-900">{rupiah(state.data.amount)}</b> ke rekening kantor.
              </p>
            </div>

            {/* Form alasan penolakan */}
            {showReject ? (
              <div className="mt-2.5 rounded-2xl bg-white p-4">
                <p className="text-[14px] font-bold text-slate-900">Alasan penolakan</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">
                  Dikirim ke karyawan — mereka wajib mengganti {rupiah(state.data.amount)} ke rekening kantor.
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="Contoh: bukan perjalanan tugas, tidak ada izin dari saya"
                  className="mt-2.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[14px] focus:border-slate-500 focus:outline-none"
                />
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    disabled={state.busy || reason.trim().length < 5}
                    onClick={() => submit("reject", reason.trim())}
                    className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-[14px] font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                  >
                    Tolak — karyawan mengganti
                  </button>
                  <button
                    type="button"
                    disabled={state.busy}
                    onClick={() => {
                      setShowReject(false);
                      setReason("");
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  disabled={state.busy}
                  onClick={() => setConfirmOpen(true)}
                  className="w-full rounded-xl bg-[#00B14F] px-4 py-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#009040] disabled:opacity-50"
                >
                  Alasan diterima — perjalanan sah
                </button>
                <button
                  type="button"
                  disabled={state.busy}
                  onClick={() => setShowReject(true)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-[14px] font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-50"
                >
                  Tolak — karyawan mengganti
                </button>
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</p>
            )}

            <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
              Link ini khusus untuk Anda — jangan diteruskan ke orang lain.
            </p>

            <ConfirmModal
              open={confirmOpen}
              title={`Terima alasan ${state.data.employee_name}?`}
              desc={`Perjalanan nomor ${state.data.trip_no} dianggap sah${state.data.has_signature ? " dan paraf Anda tercatat di trip-nya" : ""}. Karyawan tidak perlu membayar ${rupiah(state.data.amount)}.`}
              confirmLabel="Ya, Perjalanan Sah"
              busy={state.busy}
              onCancel={() => setConfirmOpen(false)}
              onConfirm={() => {
                setConfirmOpen(false);
                submit("approve");
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
