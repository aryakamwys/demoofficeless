"use client";

// Halaman aksi klaim lewat link di pesan WhatsApp — TANPA login:
// token di link (?t=...) adalah kuncinya. Penerima tinggal tekan tombol.
// Untuk karyawan yang diminta revisi, halaman ini jadi daftar kerja:
// hapus trip, ubah nominal, pasang ticket — logikanya sama dengan
// perintah chat (HAPUS/UBAH/TICKET/SELESAI).
import { useEffect, useRef, useState } from "react";
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

type QueueItem = {
  token: string;
  employee_name: string;
  period: string;
  total_amount: number;
  trip_count: number;
};

type Data = {
  role: string;
  in_revision: boolean;
  revision_reason: string | null;
  queue?: QueueItem[];
  refunds: { no: number; amount: number; reason: string; status: string }[];
  claim: ClaimInfo;
};

type Phase =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "stale"; queue: QueueItem[] }
  | { phase: "done"; title: string }
  | { phase: "ready"; data: Data; busy: string | null };

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: "Karyawan",
  MANAGER: "Manager",
  HR: "HR",
};

// Alasan yang sering dipakai — tinggal pilih, masih bisa diedit.
const REVISE_REASONS = [
  "Ada trip pulang ke rumah di jam kantor",
  "Ada trip yang bukan perjalanan tugas",
  "Nominal ada yang kurang pas",
  "Ticket EnvGate belum lengkap",
];

const DROP_REASONS = [
  "Pulang ke rumah di jam kantor",
  "Bukan perjalanan tugas",
  "Trip ini bukan milik saya",
];

/** Badge penggantian untuk trip yang ditandai HR "tidak sesuai". */
function RefundBadge({ status, amount }: { status: string; amount: number }) {
  if (status === "CLAIMED") {
    return (
      <span className="mt-1 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
        ✓ sudah TF {rupiah(amount)} — menunggu cek HR
      </span>
    );
  }
  return (
    <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
      ⚠ ganti {rupiah(amount)} ke rekening kantor
    </span>
  );
}

function rupiah(n: number | string): string {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** "02 Jul" atau "02 Jul · 17:05" (jam disembunyikan kalau datanya tanpa jam). */
function dateTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const t = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return (
    d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) +
    (t === "00:00" ? "" : ` · ${t}`)
  );
}

function shortPlace(s: string): string {
  const t = (s || "").trim();
  return t.length > 28 ? t.slice(0, 28).replace(/\s+\S*$/, "") + "…" : t;
}

export default function ApprovePage() {
  const [state, setState] = useState<Phase>({ phase: "loading" });
  // Token dibaca sekali dari URL — ref, bukan state, supaya tidak memicu
  // render berantai dari dalam effect (react-hooks/set-state-in-effect).
  const tokenRef = useRef("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [dialog, setDialog] = useState<
    | { kind: "drop"; no: number; reason: string }
    | { kind: "fare"; no: number; fare: string }
    | { kind: "ticket"; no: number; ticket: string }
    | null
  >(null);
  // Antrean klaim lain menunggu approver ini (Manager/HR)
  const [queueBusy, setQueueBusy] = useState<string | null>(null);
  const [queueDone, setQueueDone] = useState<Record<string, string>>({});

  const load = (t: string) =>
    fetch(`/api/wa/action?t=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body.success) {
          setState({
            phase: "error",
            message:
              body.error === "TOKEN_INVALID"
                ? "Link ini tidak berlaku lagi atau sudah lewat 7 hari. Minta HR kirim ulang pesannya."
                : "Klaim tidak ditemukan.",
          });
          return;
        }
        if (body.stale) {
          setState({ phase: "stale", queue: body.queue || [] });
          return;
        }
        setState({ phase: "ready", data: body as Data, busy: null });
      })
      .catch(() => setState({ phase: "error", message: "Gagal terhubung. Cek koneksi, lalu buka ulang." }));

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") || "";
    tokenRef.current = t;
    if (!t) {
      // Di luar jalur sinkron effect — hindari render berantai
      // (react-hooks/set-state-in-effect).
      queueMicrotask(() =>
        setState({ phase: "error", message: "Link-nya kurang lengkap. Buka ulang dari pesan WhatsApp." })
      );
      return;
    }
    load(t);
  }, []);

  const postWith = (token: string, payload: Record<string, unknown>) =>
    fetch("/api/wa/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...payload }),
    }).then(async (res) => {
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.message || body.error || "Gagal memproses. Coba lagi.");
      return body;
    });

  const post = (payload: Record<string, unknown>) => postWith(tokenRef.current, payload);

  /** Aksi keputusan (SETUJU / revisi / catatan). */
  const submit = async (action: "APPROVE" | "REVISE" | "NOTE", text?: string) => {
    if (state.phase !== "ready") return;
    setError("");
    setState({ ...state, busy: "Memproses…" });
    try {
      await post({ action, reason: text || "" });
      setState({
        phase: "done",
        title:
          action === "APPROVE"
            ? "Terima kasih — sudah tercatat SETUJU."
            : action === "REVISE"
              ? "Permintaan revisi sudah dikirim ke karyawan."
              : "Catatan sudah tersimpan untuk HR.",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses. Coba lagi.");
      setState({ ...state, busy: null });
      setConfirming(false);
    }
  };

  /** Perintah revisi dari tombol (HAPUS/UBAH/TICKET/SELESAI) — jalur yang
   *  sama dengan perintah chat, lalu data dimuat ulang supaya kelihatan hasilnya. */
  const runCommand = async (texts: string[], busyLabel: string, after?: () => void) => {
    if (state.phase !== "ready") return;
    setError("");
    setState({ ...state, busy: busyLabel });
    try {
      for (const t of texts) await post({ action: "COMMAND", text: t });
      if (after) {
        after();
      } else {
        await load(tokenRef.current); // tampilkan kondisi terbaru (±7 detik; sabar ya)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses. Coba lagi.");
    } finally {
      setDialog(null);
    }
  };

  const chips = (items: string[], onPick: (v: string) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {items.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onPick(r)}
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {r}
        </button>
      ))}
    </div>
  );

  /** Aksi pada klaim lain di antrean — Manager/HR memproses banyak klaim
   *  dari satu halaman tanpa balas chat satu per satu. */
  const queueAction = async (q: QueueItem, action: "APPROVE" | "REVISE", reason?: string) => {
    setQueueBusy(q.token);
    setError("");
    try {
      await postWith(q.token, { action, reason: reason || "" });
      setQueueDone((d) => ({
        ...d,
        [q.token]: action === "APPROVE" ? "Disetujui ✓" : "Revisi diminta ✓",
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses. Coba lagi.");
    } finally {
      setQueueBusy(null);
    }
  };

  const queueBlock = (items: QueueItem[]) =>
    items.length > 0 && (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[14px] font-bold text-slate-800">
          Klaim lain menunggu Anda ({items.length})
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">
          Proses dari sini saja — tidak perlu membalas chat satu per satu. Tiap tombol butuh ± 10 detik (mengirim WhatsApp).
        </p>
        <ul className="mt-3 space-y-2.5">
          {items.map((q) => {
            const done = queueDone[q.token];
            return (
              <li
                key={q.token}
                className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-800">
                    {q.employee_name}
                  </p>
                  <p className="text-[12px] text-slate-500">
                    {q.period} · {rupiah(q.total_amount)} · {q.trip_count} trip
                  </p>
                </div>
                {done ? (
                  <span className="shrink-0 text-[12px] font-bold text-emerald-700">{done}</span>
                ) : (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      disabled={!!queueBusy}
                      onClick={() => queueAction(q, "APPROVE")}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50"
                    >
                      {queueBusy === q.token ? "Memproses…" : "Setujui"}
                    </button>
                    <button
                      type="button"
                      disabled={!!queueBusy}
                      onClick={() => {
                        const r = window.prompt(`Alasan revisi untuk ${q.employee_name}:`);
                        if (r && r.trim().length >= 5) queueAction(q, "REVISE", r.trim());
                      }}
                      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-amber-700 transition-colors hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50"
                    >
                      Revisi
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2.5 px-4">
          <Image src="/ogoperkom.png" alt="Perkom" width={32} height={32} className="h-8 w-8 object-contain" />
          <div>
            <p className="text-[15px] font-bold leading-tight text-slate-800">Klaim Grab Perkom</p>
            <p className="text-[11px] leading-tight text-slate-500">Balas lewat WhatsApp — atau tekan tombol di sini</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5">
        {state.phase === "loading" && (
          <p className="py-16 text-center text-[14px] text-slate-500">Memuat klaim…</p>
        )}

        {state.phase === "error" && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-3xl">🔗</p>
            <p className="mt-3 text-[15px] font-semibold text-slate-800">Link ini tidak bisa dipakai</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{state.message}</p>
          </div>
        )}

        {state.phase === "stale" && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
              <p className="text-3xl">✅</p>
              <p className="mt-3 text-[15px] font-semibold text-slate-800">Klaim ini sudah diproses</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                Keputusannya sudah tercatat. Tidak ada yang perlu dilakukan lagi di sini.
              </p>
            </div>
            {queueBlock(state.queue)}
            {error && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
            )}
          </>
        )}

        {state.phase === "done" && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="text-4xl">✅</p>
            <p className="mt-3 text-[15px] font-bold text-emerald-800">{state.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-emerald-800">
              Konfirmasinya juga masuk ke WhatsApp Anda. Tidak perlu membalas pesan klaim lagi.
            </p>
          </div>
        )}

        {state.phase === "ready" && (
          <>
            {state.busy && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-[13px] font-medium text-blue-800">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                {state.busy} <span className="text-blue-600">(± 7 detik, tunggu ya)</span>
              </div>
            )}

            {/* ==== Banner alasan revisi (karyawan dalam fase revisi) ==== */}
            {state.data.in_revision && (
              <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-[13px] font-bold text-amber-800">Klaim ini diminta REVISI</p>
                <p className="mt-1 text-[13px] leading-relaxed text-amber-900">
                  Alasannya: “{state.data.revision_reason || "-"}”
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-amber-800">
                  Bereskan di bawah — hapus trip yang salah, ubah nominal, atau pasang ticket. Kalau sudah, tekan tombol kirim ulang.
                </p>
              </div>
            )}

            {/* ==== Kartu klaim ==== */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  Anda: {ROLE_LABEL[state.data.role] || state.data.role}
                </span>
              </div>

              <h1 className="mt-3 text-lg font-bold leading-snug text-slate-900">
                {state.data.role === "EMPLOYEE" ? "Klaim periode" : `${state.data.claim.employee_name} — periode`}{" "}
                <span className="text-blue-700">{state.data.claim.period}</span>
              </h1>
              {state.data.role === "EMPLOYEE" && (
                <p className="mt-0.5 text-[13px] text-slate-600">Atas nama Anda sendiri.</p>
              )}
              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">
                {state.data.role === "EMPLOYEE"
                  ? state.data.in_revision
                    ? `Klaim Grab Anda (${state.data.claim.trip_count} perjalanan) — menunggu dibereskan.`
                    : `Klaim Grab Anda (${state.data.claim.trip_count} perjalanan). Cek dulu, baru tekan SETUJU.`
                  : `Mengajukan klaim Grab (${state.data.claim.trip_count} perjalanan). Karyawan sudah mengecek datanya.`}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total biaya</p>
                  <p className="text-[15px] font-bold text-slate-900">{rupiah(state.data.claim.total_amount)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Perjalanan</p>
                  <p className="text-[15px] font-bold text-slate-900">{state.data.claim.trip_count} trip</p>
                </div>
              </div>

              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Daftar perjalanan
              </p>
              <ul className="mt-1.5 space-y-2.5">
                {state.data.claim.trips.map((t) => {
                  const rf = state.data.refunds?.find((x) => x.no === t.no);
                  return (
                  <li key={t.no} className="border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-snug text-slate-700">
                          <span className="text-slate-400">{t.no}.</span> {dateTimeLabel(t.date)} · {shortPlace(t.pickup)} → {shortPlace(t.dropoff)}
                        </p>
                        <p className="mt-0.5 text-[13px] font-semibold text-slate-800">{rupiah(t.fare)}</p>
                        {rf && <RefundBadge status={rf.status} amount={rf.amount} />}
                        {t.ticket_id ? (
                          <span className="mt-1 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                            ✓ Ticket #PIM-{t.ticket_id}
                          </span>
                        ) : state.data.in_revision ? (
                          <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            belum ada ticket
                          </span>
                        ) : null}
                        {state.data.role === "EMPLOYEE" && rf && rf.status === "REQUESTED" && (
                          <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                            Transfer ke rekening kantor, lalu tekan tombol Sudah TF.
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {state.data.in_revision && !state.busy && (
                          <>
                            <button
                              type="button"
                              disabled={state.data.claim.trips.length <= 1 || !!rf}
                              title={
                                rf
                                  ? "Trip ini menunggu penggantian — selesaikan lewat transfer"
                                  : state.data.claim.trips.length <= 1
                                    ? "Satu-satunya trip tidak boleh dihapus"
                                    : ""
                              }
                              onClick={() => setDialog({ kind: "drop", no: t.no, reason: "" })}
                              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-40"
                            >
                              Hapus
                            </button>
                            <button
                              type="button"
                              disabled={!!rf}
                              title={rf ? "Nominal terkunci sampai penggantian selesai" : ""}
                              onClick={() => setDialog({ kind: "fare", no: t.no, fare: String(t.fare) })}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-40"
                            >
                              Ubah Rp
                            </button>
                            <button
                              type="button"
                              onClick={() => setDialog({ kind: "ticket", no: t.no, ticket: "" })}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            >
                              Ticket
                            </button>
                          </>
                        )}
                        {state.data.role === "EMPLOYEE" && rf && rf.status === "REQUESTED" && !state.busy && (
                          <button
                            type="button"
                            onClick={() => runCommand(["SUDAH TF"], "Mencatat penggantian…")}
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            Sudah TF ✓
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                  );
                })}
              </ul>
            </div>

            {/* ==== Dialog per-trip (revisi) ==== */}
            {dialog && (
              <div className="mt-3 rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
                {dialog.kind === "drop" && (
                  <>
                    <p className="text-[14px] font-bold text-slate-800">Hapus trip no {dialog.no}?</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                      Trip ini keluar dari klaim dan tidak dihitung lagi. Pilih alasan (bisa diedit):
                    </p>
                    <div className="mt-2">{chips(DROP_REASONS, (v) => setDialog({ ...dialog, reason: v }))}</div>
                    <textarea
                      value={dialog.reason}
                      onChange={(e) => setDialog({ ...dialog, reason: e.target.value })}
                      rows={2}
                      maxLength={200}
                      placeholder="Alasan hapus…"
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13px] focus:border-blue-600 focus:outline-none"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={dialog.reason.trim().length < 4}
                        onClick={() => runCommand([`HAPUS ${dialog.no} ${dialog.reason.trim()}`, "YA"], "Menghapus trip…")}
                        className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                      >
                        Ya, hapus trip ini
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog(null)}
                        className="rounded-lg border border-slate-300 px-4 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Batal
                      </button>
                    </div>
                  </>
                )}

                {dialog.kind === "fare" && (
                  <>
                    <p className="text-[14px] font-bold text-slate-800">Ubah nominal trip no {dialog.no}</p>
                    <p className="mt-1 text-[12px] text-slate-600">Sekarang: {rupiah(state.data.claim.trips[dialog.no - 1]?.fare || 0)}</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={dialog.fare}
                      onChange={(e) => setDialog({ ...dialog, fare: e.target.value.replace(/[^\d.]/g, "") })}
                      placeholder="Contoh: 75000"
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] font-semibold focus:border-blue-600 focus:outline-none"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={!Number(dialog.fare) || Number(dialog.fare) <= 0}
                        onClick={() =>
                          runCommand(
                            [`UBAH ${dialog.no} ${Math.round(Number(dialog.fare))}`, "YA"],
                            "Menyimpan nominal baru…"
                          )
                        }
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                      >
                        Simpan nominal
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog(null)}
                        className="rounded-lg border border-slate-300 px-4 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Batal
                      </button>
                    </div>
                  </>
                )}

                {dialog.kind === "ticket" && (
                  <>
                    <p className="text-[14px] font-bold text-slate-800">Pasang ticket untuk trip no {dialog.no}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                      Tulis nomor ticket EnvGate (contoh: <b>PIM-34285</b>). Nomornya dicek dulu ke EnvGate — kalau tidak ada, gagal tersimpan.
                    </p>
                    <input
                      type="text"
                      value={dialog.ticket}
                      onChange={(e) => setDialog({ ...dialog, ticket: e.target.value })}
                      placeholder="PIM-34285"
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] font-semibold focus:border-blue-600 focus:outline-none"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={!/^\s*#?\s*pim\s*[-:]?\s*\d{2,10}\s*$/i.test(dialog.ticket)}
                        onClick={() => runCommand([`TICKET ${dialog.no} ${dialog.ticket.trim()}`], "Memeriksa ticket ke EnvGate…")}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                      >
                        Pasang ticket
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog(null)}
                        className="rounded-lg border border-slate-300 px-4 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Batal
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ==== Tombol utama ==== */}
            {!state.data.in_revision && !showReject && (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  disabled={!!state.busy}
                  onClick={() => {
                    if (!confirming) {
                      setConfirming(true);
                      return;
                    }
                    submit("APPROVE");
                  }}
                  className={cn(
                    "w-full rounded-xl px-4 py-4 text-[16px] font-bold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                    confirming ? "bg-emerald-700 text-white hover:bg-emerald-800" : "bg-emerald-600 text-white hover:bg-emerald-700",
                    state.busy && "opacity-60"
                  )}
                >
                  {confirming
                    ? "Yakin? tekan sekali lagi ✓"
                    : state.data.role === "EMPLOYEE"
                      ? "SEMUA BENAR — SETUJU ✓"
                      : "SETUJU ✓"}
                </button>
                <button
                  type="button"
                  disabled={!!state.busy}
                  onClick={() => {
                    setShowReject(true);
                    setConfirming(false);
                  }}
                  className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-[14px] font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60"
                >
                  {state.data.role === "EMPLOYEE" ? "Ada yang salah ✎" : "Minta revisi ✎"}
                </button>
              </div>
            )}

            {/* ==== Form alasan (revisi / catatan) ==== */}
            {!state.data.in_revision && showReject && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4">
                <p className="text-[14px] font-bold text-slate-800">
                  {state.data.role === "EMPLOYEE" ? "Apa yang salah?" : "Apa yang perlu direvisi karyawan?"}
                </p>
                <p className="mt-0.5 text-[12px] text-slate-600">
                  {state.data.role === "EMPLOYEE"
                    ? "Tulisan ini jadi catatan untuk HR."
                    : "Pilih di bawah atau tulis sendiri — kirimannya sampai ke karyawan."}
                </p>
                {state.data.role !== "EMPLOYEE" && (
                  <div className="mt-2">{chips(REVISE_REASONS, (v) => setReason(v))}</div>
                )}
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder={
                    state.data.role === "EMPLOYEE"
                      ? "Contoh: trip 10 Juli bukan perjalanan saya"
                      : "Contoh: trip 5 pulang ke rumah di jam kantor, cek ya"
                  }
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[14px] focus:border-blue-600 focus:outline-none"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={!!state.busy || reason.trim().length < 5}
                    onClick={() => submit(state.data.role === "EMPLOYEE" ? "NOTE" : "REVISE", reason.trim())}
                    className="flex-1 rounded-lg bg-amber-600 px-4 py-3 text-[14px] font-bold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                  >
                    {state.data.role === "EMPLOYEE" ? "Kirim catatan" : "Kirim permintaan revisi"}
                  </button>
                  <button
                    type="button"
                    disabled={!!state.busy}
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

            {/* ==== Selesai revisi ==== */}
            {state.data.in_revision && (
              <button
                type="button"
                disabled={!!state.busy}
                onClick={() =>
                  runCommand(["SELESAI"], "Mengirim ulang ke approver…", () =>
                    setState({ phase: "done", title: "Revisi sudah dikirim ulang ke approver." })
                  )
                }
                className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-4 text-[16px] font-bold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
              >
                SUDAH BERES — KIRIM ULANG ✓
              </button>
            )}

            {queueBlock(state.data.queue || [])}

            {error && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
            )}

            <p className="mt-4 px-1 text-center text-[11px] leading-relaxed text-slate-400">
              Link ini khusus untuk Anda — jangan diteruskan ke orang lain.
              Lebih nyaman lewat chat? Balas pesannya saja: 1 = setuju, 2 = minta revisi.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
