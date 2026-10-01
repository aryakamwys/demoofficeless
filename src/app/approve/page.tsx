"use client";

// Halaman aksi klaim lewat tautan di pesan WhatsApp — TANPA login:
// token di link (?t=...) adalah kredensialnya. Penerima pesan tinggal
// ketuk tombol. Logika aksinya identik dengan balas "1"/"2" di chat.
import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Trip = {
  no: number;
  date: string;
  pickup: string;
  dropoff: string;
  fare: number;
  ticket_id: string | null;
};

type ClaimInfo = {
  period: string;
  employee_name: string;
  manager_name: string | null;
  hr_name: string | null;
  total_amount: number;
  trip_count: number;
  trips: Trip[];
};

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "stale"; role: string }
  | { phase: "ready"; role: string; claim: ClaimInfo }
  | { phase: "acting"; role: string; claim: ClaimInfo; busy: boolean }
  | { phase: "done" };

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: "Karyawan",
  MANAGER: "Manager",
  HR: "HR",
};

function rupiah(n: number | string): string {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

function shortPlace(s: string): string {
  const t = (s || "").trim();
  return t.length > 28 ? t.slice(0, 28).replace(/\s+\S*$/, "") + "…" : t;
}

export default function ApprovePage() {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false); // tap ke-2 untuk SETUJU
  const [error, setError] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") || "";
    setToken(t);
    if (!t) {
      setState({ phase: "error", message: "Tautan tidak lengkap. Buka ulang lewat pesan WhatsApp Anda." });
      return;
    }
    fetch(`/api/wa/action?t=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body.success) {
          setState({
            phase: "error",
            message:
              body.error === "TOKEN_INVALID"
                ? "Tautan ini tidak valid atau sudah kedaluwarsa (berlaku 7 hari). Minta HR kirim ulang pesan klaimnya."
                : "Klaim tidak ditemukan.",
          });
          return;
        }
        if (body.stale) {
          setState({ phase: "stale", role: body.role });
          return;
        }
        setState({ phase: "ready", role: body.role, claim: body.claim });
      })
      .catch(() => setState({ phase: "error", message: "Gagal terhubung. Cek koneksi internet Anda, lalu buka ulang." }));
  }, []);

  const submit = async (action: "APPROVE" | "REVISE" | "NOTE", text?: string) => {
    if (state.phase !== "ready" && state.phase !== "acting") return;
    setError("");
    setState({ phase: "acting", role: state.role, claim: state.claim, busy: true });
    try {
      const res = await fetch("/api/wa/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, reason: text || "" }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setError(body.message || body.error || "Gagal memproses. Coba lagi.");
        setState({ phase: "ready", role: state.role, claim: state.claim });
        setConfirming(false);
        return;
      }
      setState({ phase: "done" });
    } catch {
      setError("Gagal terhubung. Cek koneksi internet Anda, lalu coba lagi.");
      setState({ phase: "ready", role: state.role, claim: state.claim });
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2.5 px-4">
          <Image src="/ogoperkom.png" alt="Perkom" width={32} height={32} className="h-8 w-8 object-contain" />
          <div>
            <p className="text-sm font-bold leading-tight text-slate-800">Klaim Grab Perkom</p>
            <p className="text-[11px] leading-tight text-slate-500">Persetujuan lewat WhatsApp</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6">
        {state.phase === "loading" && (
          <p className="py-16 text-center text-sm text-slate-500">Memuat klaim…</p>
        )}

        {state.phase === "error" && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-3xl">🔗</p>
            <p className="mt-3 text-sm font-semibold text-slate-800">Tautan tidak bisa dipakai</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{state.message}</p>
          </div>
        )}

        {state.phase === "stale" && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-3xl">✅</p>
            <p className="mt-3 text-sm font-semibold text-slate-800">Klaim ini sudah diproses</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
              Keputusan untuk tahap Anda sudah tercatat atau giliran Anda sudah lewat.
              Tidak ada yang perlu dilakukan di sini lagi.
            </p>
          </div>
        )}

        {state.phase === "done" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="text-4xl">✅</p>
            <p className="mt-3 text-base font-bold text-emerald-700">Berhasil tercatat</p>
            <p className="mt-1 text-[13px] leading-relaxed text-emerald-800">
              Konfirmasi juga dikirim ke WhatsApp Anda. Tidak perlu membalas pesan klaim lagi.
            </p>
          </div>
        )}

        {(state.phase === "ready" || state.phase === "acting") && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  Anda bertindak sebagai {ROLE_LABEL[state.role] || state.role}
                </span>
                <span className="text-[11px] font-medium text-slate-500">Periode {state.claim.period}</span>
              </div>

              <h1 className="mt-3 text-lg font-bold text-slate-900">{state.claim.employee_name}</h1>
              <p className="mt-0.5 text-[13px] text-slate-600">
                {state.role === "EMPLOYEE"
                  ? "Ini rangkuman klaim Grab Anda — periksa dulu sebelum menyetujui."
                  : `Mengajukan klaim Grab (${state.claim.trip_count} perjalanan).`}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total biaya</p>
                  <p className="text-sm font-bold text-slate-900">{rupiah(state.claim.total_amount)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Perjalanan</p>
                  <p className="text-sm font-bold text-slate-900">{state.claim.trip_count} trip</p>
                </div>
              </div>

              <ul className="mt-4 space-y-2">
                {state.claim.trips.map((t) => (
                  <li key={t.no} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium leading-snug text-slate-700">
                        <span className="text-slate-400">{t.no}.</span> {shortDate(t.date)} · {shortPlace(t.pickup)} → {shortPlace(t.dropoff)}
                      </p>
                      {t.ticket_id && (
                        <span className="mt-0.5 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                          #PIM-{t.ticket_id}
                        </span>
                      )}
                    </div>
                    <p className="shrink-0 text-[12px] font-semibold text-slate-800">{rupiah(t.fare)}</p>
                  </li>
                ))}
              </ul>
            </div>

            {!showReject ? (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  disabled={state.phase === "acting"}
                  onClick={() => {
                    if (state.role === "EMPLOYEE" || state.role === "MANAGER" || state.role === "HR") {
                      if (!confirming) {
                        setConfirming(true);
                        return;
                      }
                      submit("APPROVE");
                    }
                  }}
                  className={cn(
                    "w-full rounded-xl px-4 py-4 text-base font-bold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                    confirming
                      ? "bg-emerald-700 text-white hover:bg-emerald-800"
                      : "bg-emerald-600 text-white hover:bg-emerald-700",
                    state.phase === "acting" && "opacity-60"
                  )}
                >
                  {confirming
                    ? "Yakin? Ketuk sekali lagi untuk SETUJU ✓"
                    : state.role === "EMPLOYEE"
                      ? "✓ SEMUA BENAR — SETUJU"
                      : "✓ SETUJU"}
                </button>
                <button
                  type="button"
                  disabled={state.phase === "acting"}
                  onClick={() => {
                    setShowReject(true);
                    setConfirming(false);
                  }}
                  className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60"
                >
                  {state.role === "EMPLOYEE" ? "✎ Ada yang salah" : "✎ Minta revisi"}
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4">
                <label htmlFor="reason" className="text-[13px] font-semibold text-slate-800">
                  {state.role === "EMPLOYEE"
                    ? "Apa yang salah? (jadi catatan untuk HR)"
                    : `Apa yang perlu direvisi oleh ${state.claim.employee_name}?`}
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  maxLength={500}
                  disabled={state.phase === "acting"}
                  placeholder={
                    state.role === "EMPLOYEE"
                      ? "Contoh: trip 10 Juli bukan perjalanan saya"
                      : "Contoh: nominal trip 3 masih kurang tepat"
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-600"
                />
                <p className="mt-1 text-right text-[10px] text-slate-400">{reason.length}/500</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={state.phase === "acting" || reason.trim().length < 5}
                    onClick={() => submit(state.role === "EMPLOYEE" ? "NOTE" : "REVISE", reason.trim())}
                    className="flex-1 rounded-lg bg-amber-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50"
                  >
                    {state.phase === "acting" ? "Mengirim…" : "Kirim"}
                  </button>
                  <button
                    type="button"
                    disabled={state.phase === "acting"}
                    onClick={() => {
                      setShowReject(false);
                      setReason("");
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
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
              Tautan ini khusus untuk Anda dan berlaku 7 hari — jangan diteruskan ke orang lain.
              Lebih suka lewat chat? Balas pesannya dengan 1 (setuju) atau 2 + alasan (revisi).
            </p>
          </>
        )}
      </main>
    </div>
  );
}
