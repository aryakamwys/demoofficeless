"use client";

// Portal karyawan — semua proses klaim lewat sini (WA hanya pengantar link
// + notifikasi). Mobile-first: dibuka dari WhatsApp di HP.
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

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
  trips: Array<{ no: number; date: string; pickup: string; dropoff: string; fare: number; ticket_id: string | null }>;
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
    d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) +
    (hm === "00:00" ? "" : ` · ${hm}`)
  );
}

function shortPlace(s: string) {
  const t = (s || "").trim();
  return t.length > 30 ? t.slice(0, 30).replace(/\s+\S*$/, "") + "…" : t;
}

/** Badge status klaim — satu bahasa, warna jelas. */
function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    SENT: "bg-amber-50 text-amber-700 border-amber-200",
    NEED_REVIEW: "bg-blue-50 text-blue-700 border-blue-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${map[status] || map.NEED_REVIEW}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

export default function PortalPage() {
  const [state, setState] = useState<Phase>({ phase: "loading" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
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
                ? "Link ini tidak berlaku lagi (lewat 90 hari / nomor berubah). Minta HR kirim link baru."
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

  const openClaim = async (claimId: string) => {
    setError("");
    setBusy("Memuat klaim…");
    try {
      const body = await post({ action: "detail", claim_id: claimId });
      setNote("");
      setConfirming(false);
      setShowNote(false);
      setState({ phase: "detail", data: body.claim as ClaimDetail });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat klaim.");
    } finally {
      setBusy("");
    }
  };

  const backToList = () => {
    setError("");
    // Muat ulang daftar (status bisa berubah setelah aksi)
    fetch(`/api/portal?t=${encodeURIComponent(tokenRef.current)}`)
      .then(async (res) => {
        const body = await res.json();
        if (body.success) {
          setState({ phase: "list", name: body.employee.name, active: body.active, done: body.done });
        }
      })
      .catch(() => {});
  };

  /** Aksi utama — jalur logika sama dengan tombol approver, WA kabar menyusul. */
  const act = async (label: string, payload: Record<string, unknown>, after?: () => void) => {
    setError("");
    setBusy(label);
    try {
      await post(payload);
      if (after) after();
      else if (state.phase === "detail") await openClaim(state.data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses. Coba lagi.");
      setConfirming(false);
    } finally {
      setBusy("");
    }
  };

  const uploadProof = async (claimId: string, file: File) => {
    setError("");
    setBusy("Mengunggah bukti…");
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
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center gap-2.5 px-4">
          <Image src="/ogoperkom.png" alt="Perkom" width={32} height={32} className="h-8 w-8 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold leading-tight text-slate-800">
              {state.phase === "detail" ? "Klaim Grab" : "Klaim Grab Perkom"}
            </p>
            {state.phase !== "detail" && (
              <p className="truncate text-[11px] leading-tight text-slate-500">
                {state.phase === "list" ? state.name : "Semua proses klaim Anda di sini"}
              </p>
            )}
          </div>
          {state.phase === "detail" && (
            <button
              type="button"
              onClick={backToList}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              ← Daftar
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5 pb-24">
        {busy && (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-blue-200 bg-blue-50 px-4 py-3 text-center text-[13px] font-medium text-blue-800">
            <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent align-[-2px]" />
            {busy}
            {busy.startsWith("Menyimpan") || busy.startsWith("Mengabari") ? " (± 10 detik, WA kabar menyusul)" : ""}
          </div>
        )}

        {state.phase === "loading" && (
          <p className="py-16 text-center text-[14px] text-slate-500">Memuat klaim Anda…</p>
        )}

        {state.phase === "error" && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-3xl">🔗</p>
            <p className="mt-3 text-[15px] font-semibold text-slate-800">Link tidak bisa dibuka</p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{state.message}</p>
          </div>
        )}

        {state.phase === "list" && (
          <>
            {state.active.length === 0 && state.done.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="text-3xl">🎉</p>
                <p className="mt-3 text-[14px] font-semibold text-slate-800">Belum ada klaim</p>
                <p className="mt-1 text-[13px] text-slate-600">
                  Kalau ada klaim baru, linknya dikirim ke WhatsApp Anda.
                </p>
              </div>
            )}

            {state.active.length > 0 && (
              <>
                <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Sedang berjalan
                </p>
                <div className="space-y-2.5">
                  {state.active.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openClaim(c.id)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-emerald-300 active:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[15px] font-bold text-slate-900">Periode {c.period}</p>
                        <StatusChip status={c.status} />
                      </div>
                      <p className="mt-1 text-[13px] text-slate-600">
                        {c.trip_count} perjalanan · <b className="text-slate-900">{rupiah(c.total_amount)}</b>
                      </p>
                      {c.refund_pending > 0 && (
                        <p className="mt-1.5 inline-block rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          ⚠ {c.refund_pending} penggantian menunggu
                        </p>
                      )}
                      <p className="mt-2 text-[12px] font-semibold text-emerald-700">Buka →</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {state.done.length > 0 && (
              <details className="mt-5 rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer select-none px-4 py-3.5 text-[13px] font-bold text-slate-700">
                  Riwayat selesai ({state.done.length})
                </summary>
                <div className="space-y-1 border-t border-slate-100 p-3">
                  {state.done.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openClaim(c.id)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="text-[13px] font-medium text-slate-700">
                        Periode {c.period} · {c.trip_count} trip
                      </span>
                      <span className="text-[13px] font-semibold text-slate-900">{rupiah(c.total_amount)}</span>
                    </button>
                  ))}
                </div>
              </details>
            )}

            <p className="mt-6 px-1 text-center text-[11px] leading-relaxed text-slate-400">
              Simpan link ini — berlaku 90 hari dan khusus untuk Anda. Jangan diteruskan ke orang lain.
            </p>
          </>
        )}

        {state.phase === "detail" && (
          <ClaimWork
            data={state.data}
            busy={busy}
            note={note}
            setNote={setNote}
            confirming={confirming}
            setConfirming={setConfirming}
            showNote={showNote}
            setShowNote={setShowNote}
            act={act}
            uploadProof={uploadProof}
          />
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>
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
  confirming,
  setConfirming,
  showNote,
  setShowNote,
  act,
  uploadProof,
}: {
  data: ClaimDetail;
  busy: string;
  note: string;
  setNote: (v: string) => void;
  confirming: boolean;
  setConfirming: (v: boolean) => void;
  showNote: boolean;
  setShowNote: (v: boolean) => void;
  act: (label: string, payload: Record<string, unknown>, after?: () => void) => Promise<void>;
  uploadProof: (claimId: string, file: File) => Promise<void>;
}) {
  const [ticketPick, setTicketPick] = useState<Record<number, string>>({});
  const unconfirmed = data.status === "PENDING" || data.status === "SENT";
  const activeRefunds = data.refunds.filter((r) => r.status === "REQUESTED" || r.status === "CLAIMED");
  const hasEngineerTickets = data.ticket_options.length > 0;

  return (
    <>
      {/* Ringkasan */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-bold text-slate-900">Periode {data.period}</p>
          <StatusChip status={data.status} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total</p>
            <p className="text-[16px] font-bold text-slate-900">{rupiah(data.total_amount)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Perjalanan</p>
            <p className="text-[16px] font-bold text-slate-900">{data.trips.length} trip</p>
          </div>
        </div>
      </div>

      {/* Banner revisi */}
      {data.in_revision && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-[13px] font-bold text-amber-800">Klaim ini diminta REVISI</p>
          <p className="mt-1 text-[13px] leading-relaxed text-amber-900">
            Alasannya: “{data.revision_reason || "-"}”
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-amber-800">
            Tulis catatan untuk HR di bawah kalau ada yang perlu diluruskan. Kalau sudah beres, tekan
            tombol <b>KIRIM ULANG</b>.
          </p>
        </div>
      )}

      {/* Penggantian (reimburse ke rekening kantor) */}
      {activeRefunds.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-white p-4">
          <p className="text-[13px] font-bold text-slate-800">
            Penggantian ke rekening kantor ({activeRefunds.length})
          </p>
          {data.bank ? (
            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
              Transfer ke: <b>{data.bank.bank_name}</b> · <b>{data.bank.account_number}</b>
              <br />a.n. {data.bank.account_name}
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-slate-500">Rekening kantor belum diatur HR.</p>
          )}
          <div className="mt-3 space-y-3">
            {activeRefunds.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">
                      Trip {r.trip_no} — {rupiah(r.amount)}
                    </p>
                    <p className="mt-0.5 text-[12px] text-slate-500">{r.reason}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      r.status === "CLAIMED"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {r.status === "CLAIMED" ? "Dicek HR" : "Menunggu transfer"}
                  </span>
                </div>
                {r.proof_url ? (
                  <div className="mt-2 flex items-center gap-2">
                    <a href={r.proof_url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.proof_url}
                        alt={`Bukti transfer trip ${r.trip_no}`}
                        className="h-16 rounded border border-slate-200 object-cover"
                      />
                    </a>
                    <p className="text-[11px] text-slate-500">
                      {r.proof_validated ? "Bukti tervalidasi ✓" : "Bukti menunggu cek HR"}
                    </p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {!activeRefunds.every((r) => r.proof_url) && (
            <label className="mt-3 block">
              <span className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-400 bg-emerald-50 px-4 py-3 text-[13px] font-bold text-emerald-700 active:bg-emerald-100">
                📷 Unggah bukti transfer (foto/screenshot)
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
              onClick={() => act("Menyimpan konfirmasi transfer…", { action: "refund_claimed", claim_id: data.id })}
              className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              SUDAH TRANSFER SEMUA ✓
            </button>
          )}
        </div>
      )}

      {/* Daftar perjalanan */}
      <details className="mt-3 rounded-xl border border-slate-200 bg-white" open={data.in_revision || hasEngineerTickets}>
        <summary className="cursor-pointer select-none px-4 py-3.5 text-[13px] font-bold text-slate-700">
          Daftar perjalanan ({data.trips.length})
        </summary>
        <ul className="space-y-3 border-t border-slate-100 p-4">
          {data.trips.map((t) => {
            const missing = !t.ticket_id;
            return (
              <li key={t.no} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <p className="text-[13px] font-medium text-slate-800">
                  <span className="text-slate-400">{t.no}.</span> {dateLabel(t.date)} —{" "}
                  <b>{rupiah(t.fare)}</b>
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
                  {shortPlace(t.pickup)} → {shortPlace(t.dropoff)}
                </p>
                {t.ticket_id ? (
                  <span className="mt-1 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                    ✓ Ticket #PIM-{t.ticket_id}
                  </span>
                ) : hasEngineerTickets ? (
                  <div className="mt-1.5 flex gap-1.5">
                    <select
                      value={ticketPick[t.no] || ""}
                      onChange={(e) => setTicketPick((p) => ({ ...p, [t.no]: e.target.value }))}
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-[12px] text-slate-700"
                      disabled={!!busy}
                    >
                      <option value="">Pilih ticket…</option>
                      {data.ticket_options.map((o) => (
                        <option key={o.id} value={o.id}>
                          #{o.id} {o.title.slice(0, 34)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!!busy || !ticketPick[t.no]}
                      onClick={() =>
                        act("Memasang ticket…", {
                          action: "ticket",
                          claim_id: data.id,
                          trip_no: t.no,
                          ticket_id: ticketPick[t.no],
                        })
                      }
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Pasang
                    </button>
                  </div>
                ) : null}
                {missing && !hasEngineerTickets ? null : null}
              </li>
            );
          })}
        </ul>
        {hasEngineerTickets && (
          <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] leading-relaxed text-slate-400">
            Pilihan ticket diambil dari daftar ticket EnvGate Anda bulan ini.
          </p>
        )}
      </details>

      {/* Catatan untuk HR */}
      {showNote ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-white p-4">
          <p className="text-[14px] font-bold text-slate-800">Catatan untuk HR</p>
          <p className="mt-0.5 text-[12px] text-slate-600">Tulisan bebas — sebutkan nomor perjalanannya.</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Contoh: perjalanan nomor 3 bukan perjalanan saya"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[14px] focus:border-blue-600 focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={!!busy || note.trim().length < 3}
              onClick={() =>
                act("Menyimpan catatan…", { action: "note", claim_id: data.id, text: note.trim() })
              }
              className="flex-1 rounded-lg bg-amber-600 px-4 py-3 text-[14px] font-bold text-white hover:bg-amber-700 disabled:opacity-50"
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
              className="rounded-lg border border-slate-300 px-4 py-3 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
          </div>
        </div>
      ) : null}

      {/* CTA utama */}
      {unconfirmed && !showNote && (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              act("Menyimpan persetujuan…", { action: "confirm", claim_id: data.id });
            }}
            className={`w-full rounded-xl px-4 py-4 text-[16px] font-bold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60 ${
              confirming ? "bg-emerald-700 hover:bg-emerald-800" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {confirming ? "Yakin? tekan sekali lagi ✓" : "SEMUA BENAR — SETUJU ✓"}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => {
              setShowNote(true);
              setConfirming(false);
            }}
            className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-[14px] font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60"
          >
            Ada yang salah ✎
          </button>
        </div>
      )}

      {data.in_revision && !showNote && (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => act("Mengirim ulang ke approver…", { action: "done", claim_id: data.id })}
          className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-4 text-[16px] font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          SUDAH BERES — KIRIM ULANG ✓
        </button>
      )}

      <p className="mt-4 px-1 text-center text-[11px] leading-relaxed text-slate-400">
        Kabar perkembangan tetap dikirim ke WhatsApp Anda — tidak perlu membalas chat.
      </p>
    </>
  );
}
