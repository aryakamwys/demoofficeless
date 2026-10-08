"use client";

// Halaman paraf manager untuk penggantian trip "tidak sesuai" — tanpa login:
// token di link pesan WA adalah kuncinya (skema sama dengan /approve).
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

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
  const [confirming, setConfirming] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
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
                ? "Anda sudah menyetujui penggantian ini sebelumnya."
                : body.refund.decision === "REJECTED"
                  ? "Penggantian ini sudah ditolak sebelumnya."
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
            ? `Terima kasih — penggantian disetujui${state.data.has_signature ? " dengan paraf Anda" : ""}. Karyawan sudah diminta transfer.`
            : "Penggantian ditolak — perjalanan tetap di klaim.",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses. Coba lagi.");
      if (state.phase === "ready") setState({ ...state, busy: false });
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2.5 px-4">
          <Image src="/ogoperkom.png" alt="Perkom" width={32} height={32} className="h-8 w-8 object-contain" />
          <div>
            <p className="text-[15px] font-bold leading-tight text-slate-800">Klaim Grab Perkom</p>
            <p className="text-[11px] leading-tight text-slate-500">Paraf penggantian perjalanan</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5">
        {state.phase === "loading" && (
          <p className="py-16 text-center text-[14px] text-slate-500">Memuat…</p>
        )}

        {state.phase === "error" && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-3xl">🔗</p>
            <p className="mt-3 text-[15px] font-semibold text-slate-800">Link ini tidak bisa dipakai</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{state.message}</p>
          </div>
        )}

        {state.phase === "stale" && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-3xl">✅</p>
            <p className="mt-3 text-[15px] font-semibold text-slate-800">Sudah diproses</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{state.message}</p>
          </div>
        )}

        {state.phase === "done" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="text-4xl">✅</p>
            <p className="mt-3 text-[15px] font-bold leading-relaxed text-emerald-800">{state.title}</p>
          </div>
        )}

        {state.phase === "ready" && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h1 className="text-lg font-bold leading-snug text-slate-900">
                {state.data.employee_name} — perjalanan nomor{" "}
                <span className="text-blue-700">{state.data.trip_no}</span>
              </h1>
              <p className="mt-0.5 text-[13px] text-slate-600">Klaim periode {state.data.period}.</p>

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Ditandai tidak sesuai oleh HR</p>
                <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-amber-900">“{state.data.reason}”</p>
              </div>

              <div className="mt-3 space-y-1.5 text-[13px]">
                <p className="text-slate-600">
                  <span className="text-slate-400">Rute:</span> {state.data.pickup} → {state.data.dropoff}
                </p>
                <p className="text-slate-600">
                  <span className="text-slate-400">Ditagihkan ke karyawan:</span>{" "}
                  <b className="text-slate-900">{rupiah(state.data.amount)}</b> — transfer ke rekening kantor
                </p>
              </div>

              <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
                Menyetujui = paraf Anda{state.data.has_signature ? " (tanda tangan tersimpan Anda)" : ""} tercatat
                pada penggantian ini, lalu karyawan diminta transfer. Menolak = perjalanan tetap di klaim, karyawan
                tidak perlu membayar.
              </p>
            </div>

            {state.busy && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-[13px] font-medium text-blue-800">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                Memproses (± 7 detik, tunggu ya)
              </div>
            )}

            {!showReject ? (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  disabled={state.busy}
                  onClick={() => {
                    if (!confirming) {
                      setConfirming(true);
                      return;
                    }
                    submit("approve");
                  }}
                  className={`w-full rounded-xl px-4 py-4 text-[16px] font-bold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60 ${
                    confirming ? "bg-emerald-700 hover:bg-emerald-800" : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {confirming ? "Yakin? tekan sekali lagi ✓" : "SETUJUI PENGGANTIAN ✓"}
                </button>
                <button
                  type="button"
                  disabled={state.busy}
                  onClick={() => {
                    setShowReject(true);
                    setConfirming(false);
                  }}
                  className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-[14px] font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60"
                >
                  Tolak — perjalanan tetap di klaim
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4">
                <p className="text-[14px] font-bold text-slate-800">Alasan penolakan</p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="Contoh: perjalanan ini sesuai tugas, bukan salah karyawan"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[14px] focus:border-blue-600 focus:outline-none"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={state.busy || reason.trim().length < 5}
                    onClick={() => submit("reject", reason.trim())}
                    className="flex-1 rounded-lg bg-amber-600 px-4 py-3 text-[14px] font-bold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                  >
                    Kirim penolakan
                  </button>
                  <button
                    type="button"
                    disabled={state.busy}
                    onClick={() => {
                      setShowReject(false);
                      setReason("");
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-3 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
            )}

            <p className="mt-4 px-1 text-center text-[11px] leading-relaxed text-slate-400">
              Link ini khusus untuk Anda — jangan diteruskan ke orang lain.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
