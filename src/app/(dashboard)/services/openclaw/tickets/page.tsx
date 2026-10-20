"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  StickyNote,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DemoBadge, SectionCard } from "@/components/openclaw/parts";

/**
 * Ticket Operations — tiket NYATA InvGate (baca-only via integrasi existing).
 * Catatan internal & draf reply engineer disimpan LOKAL (localStorage) dan
 * diberi label jelas: endpoint tulis catatan/status InvGate belum terverifikasi,
 * jadi tidak ada update remote palsu. Baca gagal (kredensial belum diset) →
 * baris demo berlabel DEMO, tidak dicampur dengan data nyata.
 */

interface TicketRow {
  id: number;
  pretty_id: string;
  title: string;
  status: string;
  status_id: number | null;
  priority: string;
  customer: string;
  assigned: string | null;
  group: string | null;
  category: string;
  created_at: string | null;
  sla_first_reply: string | null;
  sla_resolution: string | null;
}

interface LocalNote {
  ts: string;
  text: string;
  kind: "note" | "reply-draft";
}

const DEMO_ROWS: TicketRow[] = [
  { id: -1, pretty_id: "DEMO-101", title: "[ILUSTRATIF] CCTV kamera lobby mati", status: "New", status_id: null, priority: "High", customer: "Ayana Resort (demo)", assigned: "Budi Santoso (demo)", group: null, category: "Technical Support > CCTV", created_at: new Date().toISOString(), sla_first_reply: null, sla_resolution: null },
  { id: -2, pretty_id: "DEMO-102", title: "[ILUSTRATIF] Printer EPSON L3210 offline", status: "In Progress", status_id: null, priority: "Medium", customer: "Front Office (demo)", assigned: null, group: null, category: "Technical Support > Hardware", created_at: new Date().toISOString(), sla_first_reply: null, sla_resolution: null },
  { id: -3, pretty_id: "DEMO-103", title: "[ILUSTRATIF] Reset password Outlook", status: "Resolved", status_id: null, priority: "Low", customer: "HR Dept (demo)", assigned: "Sari W. (demo)", group: null, category: "Account & Access", created_at: new Date().toISOString(), sla_first_reply: null, sla_resolution: null },
];

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const btnGhost =
  "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function priorityTone(p: string) {
  if (/urgent|critical|high|tinggi/i.test(p)) return "bg-red-50 text-red-700";
  if (/medium|sedang/i.test(p)) return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function statusTone(s: string) {
  if (/new|open|baru/i.test(s)) return "bg-blue-50 text-blue-700";
  if (/progress|assign|working/i.test(s)) return "bg-amber-50 text-amber-700";
  if (/solv|resolv|selesai|close|done/i.test(s)) return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

export default function TicketOperationsPage() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [notesVersion, setNotesVersion] = useState(0);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/automation/tickets");
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `Gagal (${res.status})`);
      setTickets(json.data);
      setDemo(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal memuat tiket";
      setError(msg);
      if (/belum diset|SERVICEDESK/i.test(msg)) {
        setDemo(true);
        setTickets(DEMO_ROWS);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    // Muat awal async — setState pertama terjadi setelah await, bukan sinkron
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/automation/tickets");
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.success) throw new Error(json.error || `Gagal (${res.status})`);
        setTickets(json.data);
        setDemo(false);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Gagal memuat tiket";
        setError(msg);
        if (/belum diset|SERVICEDESK/i.test(msg)) {
          setDemo(true);
          setTickets(DEMO_ROWS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const statuses = useMemo(
    () => [...new Set(tickets.map((t) => t.status))].sort(),
    [tickets]
  );
  const priorities = useMemo(
    () => [...new Set(tickets.map((t) => t.priority))].sort(),
    [tickets]
  );
  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return tickets.filter(
      (t) =>
        (!needle ||
          t.title.toLowerCase().includes(needle) ||
          t.customer.toLowerCase().includes(needle) ||
          t.pretty_id.toLowerCase().includes(needle)) &&
        (!status || t.status === status) &&
        (!priority || t.priority === priority)
    );
  }, [tickets, q, status, priority]);

  const open = tickets.find((t) => t.id === openId) || null;

  const notes: LocalNote[] = useMemo(() => {
    if (openId == null) return [];
    try {
      return JSON.parse(
        localStorage.getItem(`openclaw:notes:${openId}`) || "[]"
      ) as LocalNote[];
    } catch {
      return [];
    }
    // notesVersion memicu re-read setelah tambah catatan
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, notesVersion]);

  function addNote(kind: LocalNote["kind"]) {
    if (openId == null || !noteText.trim()) return;
    const entry: LocalNote = {
      ts: new Date().toLocaleString("id-ID"),
      text: noteText.trim(),
      kind,
    };
    const key = `openclaw:notes:${openId}`;
    const prev = JSON.parse(localStorage.getItem(key) || "[]") as LocalNote[];
    localStorage.setItem(key, JSON.stringify([entry, ...prev]));
    setNoteText("");
    setNotesVersion((v) => v + 1);
  }

  const mailto = open
    ? `mailto:${encodeURIComponent("customer@example") }?subject=${encodeURIComponent(
        `[${open.pretty_id}] ${open.title}`
      )}&body=${encodeURIComponent(
        `Kepada Yth. ${open.customer},\n\nMenindaklanjuti tiket ${open.pretty_id}...\n`
      )}`
    : "#";

  return (
    <div className="space-y-6">
      {demo && (
        <div className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-700">
          <DemoBadge label="DEMO MODE" /> Integrasi InvGate belum dikonfigurasi
          (SERVICEDESK_USERNAME/PASSWORD) — baris di bawah adalah data ilustratif
          berlabel, bukan tiket produksi.
        </div>
      )}

      <SectionCard
        title={`Tiket InvGate (${filtered.length}${filtered.length !== tickets.length ? ` dari ${tickets.length}` : ""})`}
        icon={<ClipboardList className="h-4 w-4 text-blue-600" />}
        right={
          <button className={btnGhost} onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Muat ulang
          </button>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className={`${inputCls} pl-9`}
              placeholder="Cari judul / customer / no tiket…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua status</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Semua prioritas</option>
            {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {error && !demo && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        <div className="overflow-x-auto border border-slate-300">
          <table className="w-full min-w-[860px] border-collapse bg-white text-[11px]">
            <thead>
              <tr>
                {["Tiket", "Judul", "Status", "Prioritas", "Customer", "Engineer", "Dibuat"].map((h) => (
                  <th key={h} className="whitespace-nowrap border border-slate-300 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="border border-slate-200 px-3 py-3">
                      <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="border border-slate-200 px-3 py-8 text-center text-slate-400">
                    Tidak ada tiket yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer transition-colors hover:bg-blue-50/30"
                    onClick={() => setOpenId(t.id)}
                  >
                    <td className="whitespace-nowrap border border-slate-200 px-2 py-2 font-medium text-blue-600">
                      #{t.pretty_id}
                      {demo && <DemoBadge />}
                    </td>
                    <td className="border border-slate-200 px-2 py-2 font-medium text-blue-500">{t.title}</td>
                    <td className="whitespace-nowrap border border-slate-200 px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone(t.status)}`}>{t.status}</span>
                    </td>
                    <td className="whitespace-nowrap border border-slate-200 px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityTone(t.priority)}`}>{t.priority}</span>
                    </td>
                    <td className="border border-slate-200 px-2 py-2 text-slate-700">{t.customer}</td>
                    <td className="whitespace-nowrap border border-slate-200 px-2 py-2 text-slate-700">{t.assigned || "—"}</td>
                    <td className="whitespace-nowrap border border-slate-200 px-2 py-2 text-slate-700">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString("id-ID") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Detail tiket */}
      <Dialog open={openId != null} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
                  #{open.pretty_id} {demo && <DemoBadge />}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm font-medium text-slate-800">{open.title}</p>

              <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {[
                  ["Status", open.status],
                  ["Prioritas", open.priority],
                  ["Customer", open.customer],
                  ["Engineer", open.assigned || "Belum ditugaskan"],
                  ["Grup", open.group || "—"],
                  ["Kategori", open.category || "—"],
                  ["Dibuat", open.created_at ? new Date(open.created_at).toLocaleString("id-ID") : "—"],
                  ["SLA resolusi", open.sla_resolution || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1.5">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="text-right font-medium text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>

              {/* Aksi engineer — tulis remote belum terverifikasi */}
              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-700">Aksi engineer</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={mailto} className={btnGhost}>
                    <Mail className="h-3.5 w-3.5" /> Siapkan reply customer (mailto)
                  </a>
                  <button className={btnGhost} disabled title="Endpoint update status InvGate belum terverifikasi — dinonaktifkan, tidak ada update palsu">
                    Update status (belum tersedia)
                  </button>
                  <button className={btnGhost} disabled title="Endpoint catatan internal InvGate belum terverifikasi — dinonaktifkan">
                    Resolution note (belum tersedia)
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  Tombol nonaktif = endpoint tulis belum terverifikasi. Draf reply
                  dibuka di email client Anda — tidak ada klaim terkirim palsu.
                </p>
              </div>

              {/* Catatan lokal */}
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-800">
                    Catatan internal (lokal)
                  </h3>
                  <span className="badge border-0 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    TIDAK TERSINKRON KE INVGATE
                  </span>
                </div>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    className={`${inputCls} text-xs`}
                    placeholder="Catatan internal engineer…"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button className={btnGhost} onClick={() => addNote("note")} disabled={!noteText.trim()}>
                    Tambah catatan
                  </button>
                  <button className={btnGhost} onClick={() => addNote("reply-draft")} disabled={!noteText.trim()}>
                    Simpan sebagai draf reply
                  </button>
                </div>
                <ul className="mt-3 space-y-2">
                  {notes.length === 0 && (
                    <li className="text-xs text-slate-400">
                      Belum ada catatan lokal untuk tiket ini.
                    </li>
                  )}
                  {notes.map((n, i) => (
                    <li key={i} className="rounded-lg border border-slate-200 p-2.5">
                      <p className="text-xs text-slate-700">{n.text}</p>
                      <p className="mt-1 flex items-center gap-2 font-mono text-[10px] text-slate-400">
                        {n.ts}
                        {n.kind === "reply-draft" && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 font-sans font-semibold text-blue-600">
                            draf reply
                          </span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
