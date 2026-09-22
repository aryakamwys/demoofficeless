import { AlertTriangle, Bot, Check, ChevronRight, Mail, ShieldCheck, Ticket } from "lucide-react";

// ponytail: placeholder monitoring — semua angka statis.
// Sambungkan ke API OpenClaw (fetch + refresh) saat endpoint tersedia.

const stats = [
  { label: "Emails Processed", value: "24", sub: "Hari ini", icon: Mail, tint: "bg-blue-50 text-blue-600", bar: "bg-blue-600", pct: 80, delta: "+12% vs kemarin", deltaClass: "text-emerald-600" },
  { label: "Tickets Created", value: "8", sub: "Hari ini", icon: Ticket, tint: "bg-purple-50 text-purple-600", bar: "bg-purple-600", pct: 40, delta: "+33% vs kemarin", deltaClass: "text-emerald-600" },
  { label: "SLA Compliance", value: "96%", sub: "Minggu ini", icon: ShieldCheck, tint: "bg-amber-50 text-amber-600", bar: "bg-amber-500", pct: 96, delta: "+2.4% minggu ini", deltaClass: "text-emerald-600" },
  { label: "Errors", value: "0", sub: "Semua sehat", icon: AlertTriangle, tint: "bg-red-50 text-red-600", bar: "bg-red-500", pct: 0, delta: "—", deltaClass: "text-slate-400" },
];

const flow = [
  { name: "Email", caption: "Email diterima", icon: Mail, tint: "bg-blue-50 text-blue-600", pct: 100 },
  { name: "OpenClaw", caption: "Data diekstraksi", icon: Bot, tint: "bg-purple-50 text-purple-600", pct: 100 },
  { name: "Validation", caption: "Data tervalidasi", icon: ShieldCheck, tint: "bg-emerald-50 text-emerald-600", pct: 85 },
  { name: "InvGate", caption: "Tiket dibuat", icon: Ticket, tint: "bg-slate-100 text-slate-700", pct: 62 },
];

const tickets = [
  { id: "#OCW-0001", subject: "[Contoh] WhatsApp channel tidak merespon", status: "In Progress", priority: "High", source: "WhatsApp", updated: "Just now" },
  { id: "#OCW-0002", subject: "[Contoh] Reset sesi agent", status: "Pending", priority: "Medium", source: "Web", updated: "12m ago" },
  { id: "#OCW-0003", subject: "[Contoh] Laporan mingguan gagal terkirim", status: "Resolved", priority: "Low", source: "Telegram", updated: "32m ago" },
  { id: "#OCW-0004", subject: "[Contoh] Ekstraksi invoice error", status: "Created", priority: "High", source: "Email", updated: "1h ago" },
  { id: "#OCW-0005", subject: "[Contoh] Permintaan integrasi baru", status: "Created", priority: "Medium", source: "Portal", updated: "2h ago" },
];

const STATUS_STYLES: Record<string, string> = {
  Created: "bg-blue-50 text-blue-700",
  "In Progress": "bg-blue-50 text-blue-700",
  Pending: "bg-amber-50 text-amber-700",
  Resolved: "bg-emerald-50 text-emerald-700",
};

const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-red-50 text-red-700",
  Medium: "bg-amber-50 text-amber-700",
  Low: "bg-emerald-50 text-emerald-700",
};

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Pill({ label, styles }: { label: string; styles: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles}`}>{label}</span>;
}

export default function OpenclawTicketPage() {
  return (
    <div className="space-y-6">
      {/* Placeholder notice */}
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Placeholder — monitoring belum tersambung ke API OpenClaw. Semua angka di bawah hanya contoh.
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className={`rounded-xl p-2.5 ${s.tint}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <span className={`text-xs font-medium ${s.deltaClass}`}>{s.delta}</span>
            </div>
            <p className="mt-4 text-2xl font-bold text-slate-800">{s.value}</p>
            <p className="text-sm font-medium text-slate-600">
              {s.label} <span className="font-normal text-slate-400">· {s.sub}</span>
            </p>
            <div className="mt-3">
              <Bar pct={s.pct} className={s.bar} />
            </div>
          </div>
        ))}
      </div>

      {/* Automation Flow */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Automation Flow</h2>
            <p className="text-xs text-slate-500">Email → Ekstraksi → OpenClaw → InvGate</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">● Running</span>
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
          {flow.map((f, i) => (
            <div key={f.name} className="flex flex-1 items-center gap-3">
              <div className="flex-1 rounded-xl border border-slate-200 p-4">
                <div className="relative w-fit">
                  <div className={`rounded-xl p-2.5 ${f.tint}`}>
                    <f.icon className="h-5 w-5" />
                  </div>
                  {f.pct === 100 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-800">{f.name}</p>
                <p className="text-xs text-slate-500">{f.caption}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Bar pct={f.pct} className={f.pct === 100 ? "bg-emerald-500" : "bg-blue-600"} />
                  <span className="w-8 text-right text-[10px] font-semibold text-slate-500">{f.pct}%</span>
                </div>
              </div>
              {i < flow.length - 1 && <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-300 md:block" />}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Ticket className="h-4 w-4 text-blue-600" /> Recent Tickets
          </h2>
          <span className="text-xs text-slate-400">Data contoh</span>
        </div>
        <div className="overflow-x-auto border border-slate-300">
          <table className="w-full min-w-[900px] border-collapse bg-white text-[11px]">
            <thead>
              <tr>
                {["Ticket", "Subject", "Status", "Priority", "Source", "Last Updated"].map((h) => (
                  <th key={h} className="whitespace-nowrap border border-slate-300 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-blue-50/30">
                  <td className="border border-slate-200 px-2 py-2 font-medium text-blue-600">{t.id}</td>
                  <td className="border border-slate-200 px-2 py-2 font-medium text-blue-500">{t.subject}</td>
                  <td className="border border-slate-200 px-2 py-2"><Pill label={t.status} styles={STATUS_STYLES[t.status]} /></td>
                  <td className="border border-slate-200 px-2 py-2"><Pill label={t.priority} styles={PRIORITY_STYLES[t.priority]} /></td>
                  <td className="border border-slate-200 px-2 py-2 text-slate-700">{t.source}</td>
                  <td className="whitespace-nowrap border border-slate-200 px-2 py-2 text-slate-700">{t.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
