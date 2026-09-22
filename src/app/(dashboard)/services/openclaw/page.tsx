// ponytail: placeholder monitoring — data statis.
// Sambungkan ke API OpenClaw (fetch + refresh) saat endpoint tersedia.
const SAMPLE_TICKETS = [
  { id: "OCW-0001", subject: "[Contoh] WhatsApp channel tidak merespon", status: "Open", channel: "WhatsApp", updatedAt: "22/09/2026 08:15" },
  { id: "OCW-0002", subject: "[Contoh] Permintaan reset sesi agent", status: "Pending", channel: "Web", updatedAt: "21/09/2026 16:40" },
  { id: "OCW-0003", subject: "[Contoh] Laporan mingguan gagal terkirim", status: "Closed", channel: "Telegram", updatedAt: "20/09/2026 11:02" },
];

const STATUS_STYLES: Record<string, string> = {
  Open: "bg-emerald-50 text-emerald-700",
  Pending: "bg-amber-50 text-amber-700",
  Closed: "bg-slate-100 text-slate-500",
};

export default function OpenclawTicketPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <span>Placeholder — monitoring belum tersambung ke API OpenClaw. Data di bawah hanya contoh.</span>
      </div>

      <div className="rounded-sm border border-slate-200 bg-white">
        <div className="overflow-x-auto border border-slate-300">
          <table className="w-full min-w-[900px] border-collapse bg-white text-[11px]">
            <thead>
              <tr>
                {["ID", "Subject", "Status", "Channel", "Last Update"].map((h) => (
                  <th key={h} className="whitespace-nowrap border border-slate-300 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SAMPLE_TICKETS.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-blue-50/30">
                  <td className="w-[80px] border border-slate-200 bg-blue-100/50 px-2 py-2 font-medium text-blue-600">{t.id}</td>
                  <td className="border border-slate-200 px-2 py-2 font-medium text-blue-500">{t.subject}</td>
                  <td className="border border-slate-200 px-2 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-slate-700">{t.channel}</td>
                  <td className="w-[140px] border border-slate-200 px-2 py-2 text-slate-700">{t.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
