"use client";

// Halaman keputusan approver (Manager/HR) lewat link di pesan WhatsApp —
// tanpa login: token di link adalah kuncinya. Gaya disamakan dengan portal
// karyawan: putih bersih, satu CTA hijau solid, ikon lucide, konfirmasi modal.
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Circle, Square, Ticket } from "lucide-react";
import { ConfirmModal, InfoModal } from "@/components/ui/confirm-modal";

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

function rupiah(n: number | string) {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

/** "02 Jul 2026" atau "02 Jul 2026 · 17:05" (jam disembunyikan kalau datanya tanpa jam). */
function dateTimeLabel(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const t = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return (
    d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    (t === "00:00" ? "" : ` · ${t}`)
  );
}

/** Badge penggantian untuk trip yang ditandai HR "tidak sesuai". */
function RefundBadge({ status, amount }: { status: string; amount: number }) {
  if (status === "CLAIMED") {
    return (
      <span className="mt-1.5 inline-block rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
        Sudah transfer {rupiah(amount)} — dicek HR
      </span>
    );
  }
  return (
    <span className="mt-1.5 inline-block rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
      Ganti {rupiah(amount)} ke rekening kantor
    </span>
  );
}

export default function ApprovePage() {
  const [state, setState] = useState<Phase>({ phase: "loading" });
  // Token dibaca sekali dari URL — ref, bukan state, supaya tidak memicu
  // render berantai dari dalam effect (react-hooks/set-state-in-effect).
  const tokenRef = useRef("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
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
  // Modal info setelah keputusan tersimpan (WA jalan di background)
  const [doneInfo, setDoneInfo] = useState(false);

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

  /** Aksi keputusan (SETUJU / revisi / catatan) — respons instan, WA menyusul. */
  const submit = async (action: "APPROVE" | "REVISE" | "NOTE", text?: string) => {
    if (state.phase !== "ready") return;
    setError("");
    setState({ ...state, busy: "Menyimpan…" });
    try {
      await post({ action, reason: text || "" });
      setState({
        phase: "done",
        title:
          action === "APPROVE"
            ? "Klaim disetujui."
            : action === "REVISE"
              ? "Permintaan revisi terkirim ke karyawan."
              : "Catatan tersimpan untuk HR.",
      });
      setDoneInfo(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses. Coba lagi.");
      setState({ ...state, busy: null });
      setShowReject(false);
    }
  };

  /** Perintah revisi dari tombol (HAPUS/UBAH/TICKET/SELESAI) — jalur yang
   *  sama dengan tombol web lama, lalu data dimuat ulang. */
  const runCommand = async (texts: string[], busyLabel: string, after?: () => void) => {
    if (state.phase !== "ready") return;
    setError("");
    setState({ ...state, busy: busyLabel });
    try {
      for (const t of texts) await post({ action: "COMMAND", text: t });
      if (after) {
        after();
      } else {
        // Beri jeda singkat supaya pembaruan status (background) sudah masuk DB
        await new Promise((r) => setTimeout(r, 1500));
        await load(tokenRef.current);
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
          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 active:bg-slate-50"
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
        [q.token]: action === "APPROVE" ? "Disetujui" : "Revisi diminta",
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses. Coba lagi.");
    } finally {
      setQueueBusy(null);
    }
  };

  /** Setujui semua klaim satu karyawan secara berurutan. */
  const approveAll = async (name: string, group: QueueItem[]) => {
    setQueueBusy(`group:${name}`);
    setError("");
    for (const q of group) {
      if (queueDone[q.token]) continue;
      try {
        await postWith(q.token, { action: "APPROVE" });
        setQueueDone((d) => ({ ...d, [q.token]: "Disetujui" }));
      } catch (e) {
        setError(`${name} (${q.period}): ${e instanceof Error ? e.message : "gagal"}`);
        break; // berhenti di kegagalan — sisanya belum diproses
      }
    }
    setQueueBusy(null);
  };

  const queueBlock = (items: QueueItem[]) => {
    if (items.length === 0) return false;
    // Kelompokkan per karyawan — manager/HR menangani banyak klaim sekaligus
    const groups: Array<{ name: string; claims: QueueItem[]; total: number }> = [];
    for (const q of items) {
      const g = groups.find((x) => x.name === q.employee_name);
      if (g) {
        g.claims.push(q);
        g.total += q.total_amount;
      } else {
        groups.push({ name: q.employee_name, claims: [q], total: q.total_amount });
      }
    }
    return (
      <div className="mt-3 rounded-2xl bg-white p-4">
        <p className="text-[14px] font-bold text-slate-900">
          Klaim lain menunggu Anda ({items.length})
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
          Dikelompokkan per karyawan — bisa disetujui sekaligus.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {groups.map((g) => {
            const remaining = g.claims.filter((q) => !queueDone[q.token]);
            const groupBusy = queueBusy === `group:${g.name}`;
            return (
              <div key={g.name} className="rounded-xl bg-[#F5F6F7] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-slate-900">{g.name}</p>
                    <p className="text-[12px] text-slate-500">
                      {g.claims.length} klaim · {rupiah(g.total)}
                    </p>
                  </div>
                  {remaining.length > 0 ? (
                    <button
                      type="button"
                      disabled={!!queueBusy}
                      onClick={() => approveAll(g.name, g.claims)}
                      className="shrink-0 rounded-xl bg-[#00B14F] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#009040] disabled:opacity-50"
                    >
                      {groupBusy ? <span className="loading loading-spinner loading-xs" /> : `Setujui semua (${remaining.length})`}
                    </button>
                  ) : (
                    <span className="shrink-0 text-[12px] font-semibold text-emerald-700">Selesai</span>
                  )}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {g.claims.map((q) => {
                    const done = queueDone[q.token];
                    return (
                      <li key={q.token} className="flex items-center justify-between gap-2 border-t border-white pt-1.5">
                        <p className="min-w-0 truncate text-[12px] text-slate-600">
                          {q.period} · {rupiah(q.total_amount)}
                        </p>
                        {done ? (
                          <span className="shrink-0 text-[12px] font-semibold text-emerald-700">{done}</span>
                        ) : (
                          <div className="flex shrink-0 gap-1.5">
                            <button
                              type="button"
                              disabled={!!queueBusy}
                              onClick={() => queueAction(q, "APPROVE")}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-50"
                            >
                              {queueBusy === q.token ? "…" : "Setujui"}
                            </button>
                            <button
                              type="button"
                              disabled={!!queueBusy}
                              onClick={() => {
                                const r = window.prompt(`Alasan revisi untuk ${q.employee_name} (${q.period}):`);
                                if (r && r.trim().length >= 5) queueAction(q, "REVISE", r.trim());
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-50"
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
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F6F7] pb-16">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2.5 px-4 md:max-w-2xl lg:max-w-5xl">
          <Image src="/ogoperkom.png" alt="Perkom" width={28} height={28} className="h-7 w-7 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight text-slate-900">Klaim Grab Perkom</p>
            <p className="text-[11px] leading-tight text-slate-500">Keputusan persetujuan klaim</p>
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
          <>
            <div className="rounded-2xl bg-white p-6 text-center">
              <p className="text-[15px] font-semibold text-slate-900">Link tidak bisa dibuka</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{state.message}</p>
            </div>
          </>
        )}

        {state.phase === "stale" && (
          <>
            <div className="rounded-2xl bg-white p-6 text-center">
              <p className="text-[15px] font-semibold text-slate-900">Klaim ini sudah diproses</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                Keputusannya sudah tercatat. Tidak ada yang perlu dilakukan lagi di sini.
              </p>
            </div>
            {queueBlock(state.queue)}
            {error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</p>
            )}
          </>
        )}

        {state.phase === "done" && (
          <>
            <div className="rounded-2xl bg-white p-8 text-center">
              <p className="text-[16px] font-bold text-emerald-700">{state.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                Konfirmasinya juga dikirim ke WhatsApp Anda. Tidak perlu membalas pesan klaim lagi.
              </p>
            </div>
            <InfoModal
              open={doneInfo}
              title={state.title}
              desc="Keputusan sudah tersimpan. Notifikasi WhatsApp sedang dikirim otomatis ke pihak yang bersangkutan — berjalan di latar belakang, tidak perlu menunggu di halaman ini."
              onClose={() => setDoneInfo(false)}
            />
          </>
        )}

        {state.phase === "ready" && (
          <>
            {state.busy && (
              <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-slate-600">
                <span className="loading loading-spinner loading-sm text-slate-400" />
                {state.busy}
              </div>
            )}

            {/* Banner alasan revisi (karyawan dalam fase revisi) */}
            {state.data.in_revision && (
              <div className="mb-3 rounded-2xl bg-amber-50 p-4">
                <p className="text-[13px] font-bold text-amber-800">Klaim diminta revisi</p>
                <p className="mt-1 text-[13px] leading-relaxed text-amber-900">
                  {state.data.revision_reason || "-"}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-amber-800">
                  Bereskan di bawah — hapus trip yang salah, ubah nominal, atau pasang ticket. Kalau sudah,
                  tekan tombol kirim ulang.
                </p>
              </div>
            )}

            {/* Kartu klaim */}
            <div className="rounded-2xl bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-bold text-slate-900">
                  {state.data.role === "EMPLOYEE"
                    ? `Periode ${state.data.claim.period}`
                    : `${state.data.claim.employee_name} — ${state.data.claim.period}`}
                </p>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  Anda: {ROLE_LABEL[state.data.role] || state.data.role}
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                {state.data.role === "EMPLOYEE"
                  ? state.data.in_revision
                    ? "Klaim Grab Anda — menunggu dibereskan."
                    : "Klaim Grab Anda. Cek dulu, baru setujui."
                  : `Mengajukan klaim Grab. Karyawan sudah mengecek datanya.`}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div>
                  <p className="text-[11px] font-medium text-slate-400">Total</p>
                  <p className="text-[17px] font-bold text-slate-900">{rupiah(state.data.claim.total_amount)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-400">Perjalanan</p>
                  <p className="text-[17px] font-bold text-slate-900">{state.data.claim.trips.length}</p>
                </div>
              </div>
            </div>

            {/* Daftar perjalanan */}
            <div className="mt-2.5 rounded-2xl bg-white p-4">
              <p className="text-[14px] font-bold text-slate-900">
                Daftar perjalanan ({state.data.claim.trips.length})
              </p>
              <ul className="mt-2 divide-y divide-slate-100">
                {state.data.claim.trips.map((t) => {
                  const rf = state.data.refunds?.find((x) => x.no === t.no);
                  return (
                    <li key={t.no} className="py-3.5 first:pt-2.5 last:pb-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[13px] font-semibold text-slate-900">
                          <span className="mr-1.5 text-slate-300">{t.no}.</span>
                          {dateTimeLabel(t.date)}
                        </p>
                        <p className="text-[13px] font-bold text-slate-900">{rupiah(t.fare)}</p>
                      </div>
                      <div className="mt-2 flex gap-2.5">
                        <div className="flex flex-col items-center pt-1">
                          <Circle className="h-2.5 w-2.5 fill-current text-slate-400" />
                          <span className="my-0.5 w-px flex-1 bg-slate-200" />
                          <Square className="h-2.5 w-2.5 text-slate-400" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="text-[12px] leading-relaxed text-slate-600">{t.pickup}</p>
                          <p className="text-[12px] leading-relaxed text-slate-600">{t.dropoff}</p>
                        </div>
                      </div>
                      {t.ticket_id && (
                        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-[12px] font-semibold text-emerald-700">
                          <Ticket className="h-3.5 w-3.5" />
                          Ticket #{t.ticket_id}
                        </p>
                      )}
                      {rf && <RefundBadge status={rf.status} amount={rf.amount} />}
                      {state.data.role === "EMPLOYEE" && rf && rf.status === "REQUESTED" && (
                        <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                          Transfer ke rekening kantor, lalu tekan tombol Sudah Transfer.
                        </p>
                      )}

                      {/* Aksi revisi per-trip (karyawan) */}
                      {state.data.in_revision && !state.busy && (
                        <div className="mt-2 flex gap-1.5">
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
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-red-600 active:bg-slate-50 disabled:opacity-40"
                          >
                            Hapus
                          </button>
                          <button
                            type="button"
                            disabled={!!rf}
                            title={rf ? "Nominal terkunci sampai penggantian selesai" : ""}
                            onClick={() => setDialog({ kind: "fare", no: t.no, fare: String(t.fare) })}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-40"
                          >
                            Ubah Rp
                          </button>
                          <button
                            type="button"
                            onClick={() => setDialog({ kind: "ticket", no: t.no, ticket: "" })}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 active:bg-slate-50"
                          >
                            Ticket
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {state.data.role === "EMPLOYEE" &&
                state.data.refunds?.some((x) => x.status === "REQUESTED") &&
                !state.busy && (
                  <button
                    type="button"
                    onClick={() => runCommand(["SUDAH TF"], "Mencatat penggantian…")}
                    className="mt-3 w-full rounded-xl bg-[#00B14F] px-4 py-3.5 text-[14px] font-semibold text-white hover:bg-[#009040]"
                  >
                    Saya sudah transfer semua
                  </button>
                )}
            </div>

            {/* Dialog per-trip (revisi) */}
            {dialog && (
              <div className="mt-3 rounded-2xl bg-white p-4">
                {dialog.kind === "drop" && (
                  <>
                    <p className="text-[14px] font-bold text-slate-900">Hapus trip no {dialog.no}?</p>
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
                      className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-[13px] focus:border-slate-500 focus:outline-none"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={dialog.reason.trim().length < 4}
                        onClick={() => runCommand([`HAPUS ${dialog.no} ${dialog.reason.trim()}`, "YA"], "Menghapus trip…")}
                        className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-[14px] font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                      >
                        Ya, hapus trip ini
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog(null)}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700"
                      >
                        Batal
                      </button>
                    </div>
                  </>
                )}

                {dialog.kind === "fare" && (
                  <>
                    <p className="text-[14px] font-bold text-slate-900">Ubah nominal trip no {dialog.no}</p>
                    <p className="mt-1 text-[12px] text-slate-600">
                      Sekarang: {rupiah(state.data.claim.trips[dialog.no - 1]?.fare || 0)}
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={dialog.fare}
                      onChange={(e) => setDialog({ ...dialog, fare: e.target.value.replace(/[^\d.]/g, "") })}
                      placeholder="Contoh: 75000"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[15px] font-semibold focus:border-slate-500 focus:outline-none"
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
                        className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-40"
                      >
                        Simpan nominal
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog(null)}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700"
                      >
                        Batal
                      </button>
                    </div>
                  </>
                )}

                {dialog.kind === "ticket" && (
                  <>
                    <p className="text-[14px] font-bold text-slate-900">Pasang ticket untuk trip no {dialog.no}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                      Tulis nomor ticket EnvGate (contoh: <b>PIM-34285</b>). Nomornya dicek dulu ke EnvGate —
                      kalau tidak ada, gagal tersimpan.
                    </p>
                    <input
                      type="text"
                      value={dialog.ticket}
                      onChange={(e) => setDialog({ ...dialog, ticket: e.target.value })}
                      placeholder="PIM-34285"
                      className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[15px] font-semibold focus:border-slate-500 focus:outline-none"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={!/^\s*#?\s*pim\s*[-:]?\s*\d{2,10}\s*$/i.test(dialog.ticket)}
                        onClick={() => runCommand([`TICKET ${dialog.no} ${dialog.ticket.trim()}`], "Memeriksa ticket ke EnvGate…")}
                        className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-40"
                      >
                        Pasang ticket
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialog(null)}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700"
                      >
                        Batal
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Tombol utama */}
            {!state.data.in_revision && !showReject && (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  disabled={!!state.busy}
                  onClick={() => setConfirmOpen(true)}
                  className="w-full rounded-xl bg-[#00B14F] px-4 py-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#009040] disabled:opacity-50"
                >
                  {state.data.role === "EMPLOYEE" ? "Setujui Klaim" : "Setujui Klaim"}
                </button>
                <button
                  type="button"
                  disabled={!!state.busy}
                  onClick={() => {
                    setShowReject(true);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-[14px] font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-50"
                >
                  {state.data.role === "EMPLOYEE" ? "Ada yang salah" : "Minta revisi"}
                </button>
              </div>
            )}

            {/* Form alasan (revisi / catatan) */}
            {!state.data.in_revision && showReject && (
              <div className="mt-3 rounded-2xl bg-white p-4">
                <p className="text-[14px] font-bold text-slate-900">
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
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[14px] focus:border-slate-500 focus:outline-none"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={!!state.busy || reason.trim().length < 5}
                    onClick={() => submit(state.data.role === "EMPLOYEE" ? "NOTE" : "REVISE", reason.trim())}
                    className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-[14px] font-semibold text-white disabled:opacity-40"
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
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {/* Selesai revisi */}
            {state.data.in_revision && (
              <button
                type="button"
                disabled={!!state.busy}
                onClick={() =>
                  runCommand(["SELESAI"], "Mengirim ulang ke approver…", () =>
                    setState({ phase: "done", title: "Revisi sudah dikirim ulang ke approver." })
                  )
                }
                className="mt-4 w-full rounded-xl bg-[#00B14F] px-4 py-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#009040] disabled:opacity-50"
              >
                Kirim Ulang Klaim
              </button>
            )}

            {/* Antrean klaim lain */}
            {queueBlock(state.data.queue || [])}

            {error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</p>
            )}

            <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
              Link ini khusus untuk Anda — jangan diteruskan ke orang lain.
            </p>

            <ConfirmModal
              open={confirmOpen}
              title={`Setujui klaim ${state.data.claim.employee_name} — ${state.data.claim.period}?`}
              desc={`${state.data.claim.trips.length} perjalanan · ${rupiah(state.data.claim.total_amount)}.`}
              confirmLabel="Ya, Setujui"
              busy={!!state.busy}
              onCancel={() => setConfirmOpen(false)}
              onConfirm={() => {
                setConfirmOpen(false);
                submit("APPROVE");
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
