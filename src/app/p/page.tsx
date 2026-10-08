"use client";

// Portal karyawan — semua proses klaim lewat sini (WA hanya pengantar link
// + notifikasi). Mobile-first, dibuka dari WhatsApp di HP.
// Gaya: sekelas aplikasi Grab — bidang putih, satu CTA hijau solid,
// tanpa gradasi/emoji; konfirmasi lewat modal (daisyUI).
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Circle, Square, Ticket } from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";

type ClaimRow = {
  id: string;
  period: string;
  trip_count: number;
  total_amount: number;
  status: string;
  manager_status: string;
  hr_status: string;
  refund_pending: number;
};

type Refund = {
  id: string;
  trip_no: number;
  amount: number;
  reason: string;
  status: string;
  proof_url: string | null;
  proof_validated: boolean;
};

type ClaimDetail = {
  id: string;
  period: string;
  status: string;
  total_amount: number;
  in_revision: boolean;
  revision_reason: string | null;
  trips: Array<{ no: number; date: string; pickup: string; dropoff: string; fare: number; service_type: string | null; ticket_id: string | null }>;
  refunds: Refund[];
  bank: { bank_name: string; account_number: string; account_name: string } | null;
  ticket_options: Array<{ id: number; title: string }>;
};

type Phase =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "list"; name: string; active: ClaimRow[]; done: ClaimRow[] }
  | { phase: "detail"; data: ClaimDetail };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu konfirmasi Anda",
  SENT: "Menunggu konfirmasi Anda",
  NEED_REVIEW: "Dalam proses",
  APPROVED: "Selesai",
};

function rupiah(n: number) {
  return `Rp${Number(n || 0).toLocaleString("id-ID")}`;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return (
    d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    (hm === "00:00" ? "" : ` · ${hm}`)
  );
}

/** Badge status — pill kecil, satu bahasa. */
function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700",
    SENT: "bg-amber-50 text-amber-700",
    NEED_REVIEW: "bg-blue-50 text-blue-700",
    APPROVED: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${map[status] || map.NEED_REVIEW}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function PortalPage() {
  const [state, setState] = useState<Phase>({ phase: "loading" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const tokenRef = useRef("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") || "";
    tokenRef.current = t;
    if (!t) {
      queueMicrotask(() =>
        setState({ phase: "error", message: "Link tidak lengkap. Buka ulang dari pesan WhatsApp." })
      );
      return;
    }
    fetch(`/api/portal?t=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body.success) {
          setState({
            phase: "error",
            message:
              body.error === "TOKEN_INVALID"
                ? "Link ini tidak berlaku lagi (lewat 30 hari / nomor berubah). Kirim pesan apa saja ke nomor WhatsApp Perkom — link baru otomatis dikirim."
                : "Gagal memuat data.",
          });
          return;
        }
        setState({ phase: "list", name: body.employee.name, active: body.active, done: body.done });
      })
      .catch(() => setState({ phase: "error", message: "Gagal terhubung. Cek koneksi, lalu buka ulang." }));
  }, []);

  const post = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenRef.current, ...payload }),
    });
    const body = await res.json();
    if (!res.ok || !body.success) throw new Error(body.error || "Gagal memproses. Coba lagi.");
    return body;
  }, []);

  const openClaim = useCallback(
    async (claimId: string) => {
      setError("");
      setBusy("Memuat…");
      try {
        const body = await post({ action: "detail", claim_id: claimId });
        setNote("");
        setShowNote(false);
        setState({ phase: "detail", data: body.claim as ClaimDetail });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat klaim.");
      } finally {
        setBusy("");
      }
    },
    [post]
  );

  const backToList = () => {
    setError("");
    fetch(`/api/portal?t=${encodeURIComponent(tokenRef.current)}`)
      .then(async (res) => {
        const body = await res.json();
        if (body.success) {
          setState({ phase: "list", name: body.employee.name, active: body.active, done: body.done });
        }
      })
      .catch(() => {});
  };

  /** Aksi utama — respons instan; kabar WA menyusul dari background. */
  const act = useCallback(
    async (payload: Record<string, unknown>) => {
      setError("");
      setBusy("Menyimpan…");
      try {
        await post(payload);
        // Beri jeda singkat supaya pembaruan status (background) sudah masuk DB
        await new Promise((r) => setTimeout(r, 1500));
        if (state.phase === "detail") await openClaim(state.data.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memproses. Coba lagi.");
      } finally {
        setBusy("");
      }
    },
    [post, state, openClaim]
  );

  const uploadProof = async (claimId: string, file: File) => {
    setError("");
    setBusy("Mengunggah…");
    try {
      const fd = new FormData();
      fd.set("token", tokenRef.current);
      fd.set("claim_id", claimId);
      fd.set("file", file);
      const res = await fetch("/api/portal", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error || "Gagal mengunggah.");
      await openClaim(claimId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunggah.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F7] pb-16">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2.5 px-4">
          {state.phase === "detail" ? (
            <button
              type="button"
              onClick={backToList}
              className="-ml-1 p-1 text-[13px] font-semibold text-slate-600 hover:text-slate-900"
            >
              ← Daftar
            </button>
          ) : (
            <Image src="/ogoperkom.png" alt="Perkom" width={28} height={28} className="h-7 w-7 object-contain" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight text-slate-900">
              {state.phase === "list" ? state.name : "Klaim Grab"}
            </p>
            {state.phase === "list" && (
              <p className="text-[11px] leading-tight text-slate-500">Klaim perjalanan Anda</p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        {busy && (
          <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-slate-600">
            <span className="loading loading-spinner loading-sm text-slate-400" />
            {busy}
          </div>
        )}

        {state.phase === "loading" && (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200/60" />
            ))}
          </div>
        )}

        {state.phase === "error" && (
          <div className="rounded-2xl bg-white p-6 text-center">
            <p className="text-[15px] font-semibold text-slate-900">Link tidak bisa dibuka</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{state.message}</p>
          </div>
        )}

        {state.phase === "list" && (
          <>
            {state.active.length === 0 && state.done.length === 0 && (
              <div className="rounded-2xl bg-white p-8 text-center">
                <p className="text-[14px] font-semibold text-slate-900">Belum ada klaim</p>
                <p className="mt-1 text-[13px] text-slate-600">
                  Kalau ada klaim baru, linknya dikirim ke WhatsApp Anda.
                </p>
              </div>
            )}

            {state.active.length > 0 && (
              <div className="space-y-2.5">
                {state.active.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openClaim(c.id)}
                    className="w-full rounded-2xl bg-white p-4 text-left transition-colors active:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] font-bold text-slate-900">Periode {c.period}</p>
                      <StatusChip status={c.status} />
                    </div>
                    <p className="mt-1.5 text-[13px] text-slate-600">
                      {c.trip_count} perjalanan · <span className="font-bold text-slate-900">{rupiah(c.total_amount)}</span>
                    </p>
                    {c.refund_pending > 0 && (
                      <p className="mt-1.5 text-[12px] font-medium text-amber-700">
                        {c.refund_pending} penggantian menunggu
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {state.done.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 px-1 text-[12px] font-semibold text-slate-500">Sudah selesai</p>
                <div className="rounded-2xl bg-white p-2">
                  {state.done.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openClaim(c.id)}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2.5 text-left active:bg-slate-50"
                    >
                      <span className="text-[13px] text-slate-700">Periode {c.period}</span>
                      <span className="text-[13px] font-bold text-slate-900">{rupiah(c.total_amount)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
              Link ini khusus untuk Anda (berlaku 30 hari). Kalau hilang, kirim pesan apa saja ke
              nomor WhatsApp Perkom untuk mendapat link baru.
            </p>
          </>
        )}

        {state.phase === "detail" && (
          <ClaimWork
            data={state.data}
            busy={busy}
            note={note}
            setNote={setNote}
            showNote={showNote}
            setShowNote={setShowNote}
            act={act}
            uploadProof={uploadProof}
          />
        )}

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</p>
        )}
      </main>
    </div>
  );
}

/** Halaman kerja satu klaim. */
function ClaimWork({
  data,
  busy,
  note,
  setNote,
  showNote,
  setShowNote,
  act,
  uploadProof,
}: {
  data: ClaimDetail;
  busy: string;
  note: string;
  setNote: (v: string) => void;
  showNote: boolean;
  setShowNote: (v: boolean) => void;
  act: (payload: Record<string, unknown>) => Promise<void>;
  uploadProof: (claimId: string, file: File) => Promise<void>;
}) {
  const [ticketPick, setTicketPick] = useState<Record<number, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const unconfirmed = data.status === "PENDING" || data.status === "SENT";
  const activeRefunds = data.refunds.filter((r) => r.status === "REQUESTED" || r.status === "CLAIMED");
  const hasEngineerTickets = data.ticket_options.length > 0;

  return (
    <>
      {/* Ringkasan */}
      <div className="rounded-2xl bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-bold text-slate-900">Periode {data.period}</p>
          <StatusChip status={data.status} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div>
            <p className="text-[11px] font-medium text-slate-400">Total</p>
            <p className="text-[17px] font-bold text-slate-900">{rupiah(data.total_amount)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400">Perjalanan</p>
            <p className="text-[17px] font-bold text-slate-900">{data.trips.length}</p>
          </div>
        </div>
      </div>

      {/* Banner revisi */}
      {data.in_revision && (
        <div className="mt-2.5 rounded-2xl bg-amber-50 p-4">
          <p className="text-[13px] font-bold text-amber-800">Diminta revisi</p>
          <p className="mt-1 text-[13px] leading-relaxed text-amber-900">{data.revision_reason || "-"}</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-amber-800">
            Tulis catatan untuk HR di bawah kalau ada yang perlu diluruskan, lalu kirim ulang.
          </p>
        </div>
      )}

      {/* Penggantian ke rekening kantor */}
      {activeRefunds.length > 0 && (
        <div className="mt-2.5 rounded-2xl bg-white p-4">
          <p className="text-[14px] font-bold text-slate-900">Penggantian ke rekening kantor</p>
          {data.bank ? (
            <div className="mt-2.5 rounded-xl bg-[#F5F6F7] px-3.5 py-3 text-[13px] leading-relaxed text-slate-700">
              <span className="font-bold text-slate-900">{data.bank.bank_name}</span> · {data.bank.account_number}
              <br />
              a.n. {data.bank.account_name}
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-slate-500">Rekening kantor belum diatur HR.</p>
          )}
          <div className="mt-3 space-y-2.5">
            {activeRefunds.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-bold text-slate-900">
                      Trip {r.trip_no} — {rupiah(r.amount)}
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-500">{r.reason}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      r.status === "CLAIMED" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {r.status === "CLAIMED" ? "Dicek HR" : "Belum transfer"}
                  </span>
                </div>
                {r.proof_url ? (
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <a href={r.proof_url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.proof_url}
                        alt={`Bukti transfer trip ${r.trip_no}`}
                        className="h-16 rounded-lg object-cover"
                      />
                    </a>
                    <p className="text-[12px] text-slate-500">
                      {r.proof_validated ? "Bukti tervalidasi" : "Bukti menunggu cek HR"}
                    </p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {!activeRefunds.every((r) => r.proof_url) && (
            <label className="mt-3 block">
              <span className="flex w-full cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 active:bg-slate-50">
                Unggah bukti transfer
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={!!busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) uploadProof(data.id, f);
                }}
              />
            </label>
          )}
          {activeRefunds.some((r) => r.status === "REQUESTED") && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act({ action: "refund_claimed", claim_id: data.id })}
              className="mt-2 w-full rounded-xl bg-[#00B14F] px-4 py-3.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#009040] disabled:opacity-50"
            >
              Saya sudah transfer semua
            </button>
          )}
        </div>
      )}

      {/* Daftar perjalanan */}
      <div className="mt-2.5 rounded-2xl bg-white p-4">
        <p className="text-[14px] font-bold text-slate-900">Daftar perjalanan ({data.trips.length})</p>
        <ul className="mt-2 divide-y divide-slate-100">
          {data.trips.map((t) => (
            <li key={t.no} className="py-3.5 first:pt-2.5 last:pb-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-semibold text-slate-900">
                  <span className="mr-1.5 text-slate-300">{t.no}.</span>
                  {dateLabel(t.date)}
                </p>
                <p className="text-[13px] font-bold text-slate-900">{rupiah(t.fare)}</p>
              </div>
              {t.service_type && (
                <p className="mt-0.5 text-[11px] font-medium text-slate-400">{t.service_type}</p>
              )}
              {/* Rute ala aplikasi transportasi: titik awal → kotak tujuan,
                  alamat utuh (tidak dipotong) */}
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
              {t.ticket_id ? (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 text-[12px] font-semibold text-emerald-700">
                  <Ticket className="h-3.5 w-3.5" />
                  Ticket #{t.ticket_id}
                </p>
              ) : hasEngineerTickets ? (
                <div className="mt-1.5 flex gap-2">
                  <select
                    value={ticketPick[t.no] || ""}
                    onChange={(e) => setTicketPick((p) => ({ ...p, [t.no]: e.target.value }))}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[12px] text-slate-700"
                    disabled={!!busy}
                  >
                    <option value="">Pilih ticket…</option>
                    {data.ticket_options.map((o) => (
                      <option key={o.id} value={o.id}>
                        #{o.id} — {o.title.slice(0, 40)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!!busy || !ticketPick[t.no]}
                    onClick={() =>
                      act({
                        action: "ticket",
                        claim_id: data.id,
                        trip_no: t.no,
                        ticket_id: ticketPick[t.no],
                      })
                    }
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-50"
                  >
                    Pasang
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {hasEngineerTickets && (
          <p className="mt-2 text-[11px] text-slate-400">
            Pilihan ticket diambil dari daftar ticket EnvGate Anda bulan ini.
          </p>
        )}
      </div>

      {/* Catatan untuk HR */}
      {showNote ? (
        <div className="mt-2.5 rounded-2xl bg-white p-4">
          <p className="text-[14px] font-bold text-slate-900">Catatan untuk HR</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Contoh: perjalanan nomor 3 bukan perjalanan saya"
            className="mt-2.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[14px] text-slate-800 focus:border-slate-500 focus:outline-none"
          />
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={!!busy || note.trim().length < 3}
              onClick={() => act({ action: "note", claim_id: data.id, text: note.trim() })}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              Kirim catatan
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => {
                setShowNote(false);
                setNote("");
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700"
            >
              Batal
            </button>
          </div>
        </div>
      ) : null}

      {/* Aksi utama */}
      <div className="mt-4 space-y-2">
        {unconfirmed && !showNote && (
          <>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => setConfirmOpen(true)}
              className="w-full rounded-xl bg-[#00B14F] px-4 py-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#009040] disabled:opacity-50"
            >
              Setujui Klaim
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => setShowNote(true)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-[14px] font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-50"
            >
              Ada yang salah
            </button>
          </>
        )}
        {data.in_revision && !showNote && (
          <button
            type="button"
            disabled={!!busy}
            onClick={() => act({ action: "done", claim_id: data.id })}
            className="w-full rounded-xl bg-[#00B14F] px-4 py-4 text-[15px] font-semibold text-white transition-colors hover:bg-[#009040] disabled:opacity-50"
          >
            Kirim Ulang Klaim
          </button>
        )}
      </div>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
        Kabar perkembangan dikirim ke WhatsApp Anda — tidak perlu membalas chat.
      </p>

      <ConfirmModal
        open={confirmOpen}
        title={`Setujui klaim periode ${data.period}?`}
        desc={`${data.trips.length} perjalanan · ${rupiah(data.total_amount)}. Dengan menyetujui, Anda menyatakan semua data perjalanan sudah benar.`}
        confirmLabel="Ya, Setujui"
        busy={!!busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          act({ action: "confirm", claim_id: data.id });
        }}
      />
    </>
  );
}
