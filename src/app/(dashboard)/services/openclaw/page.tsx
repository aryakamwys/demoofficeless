import { Ticket } from "lucide-react";

// ponytail: placeholder monitoring — data statis.
// Sambungkan ke API OpenClaw (fetch + refresh) saat endpoint tersedia.
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

function Pill({ label, styles }: { label: string; styles: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles}`}>{label}</span>;
}

export default function OpenclawTicketPage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Ticket className="h-4 w-4 text-blue-600" /> Recent Tickets
        </h2>
        <span className="text-xs text-slate-400">Data contoh — belum tersambung ke API OpenClaw</span>
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
  );
}
