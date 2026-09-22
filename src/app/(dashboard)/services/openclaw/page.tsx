import { Check, Ticket } from "lucide-react";
import Image from "next/image";

// ponytail: dummy — ticket & id dihardcode untuk demo monitoring.
// Kalau mau live lagi, fetch /api/services seperti sebelumnya.
const tickets = [
  { id: "PIM-34214", subject: "M70q Gen 5 - Desktop - Hidup namun tidak menampilkan apapun pada layar", from: "Muhammad Arya Kamal", category: "Technical Support » Software", updated: "Just now" },
  { id: "PIM-34213", subject: "Printer EPSON L3210 tidak bisa print dari jaringan", from: "Villa Lobby", category: "Technical Support » Hardware", updated: "12m ago" },
  { id: "PIM-34212", subject: "Permintaan reset password Outlook", from: "Front Office", category: "Account & Access", updated: "32m ago" },
  { id: "PIM-34211", subject: "WiFi hotspot area lobby sering putus", from: "Aldani Hardiyan", category: "Network", updated: "1h ago" },
  { id: "PIM-34210", subject: "Update driver mesin absen fingerprint", from: "HR Department", category: "Technical Support » Software", updated: "2h ago" },
];

// ponytail: waktu proses email → ticket dihardcode 3 menit.
const WAKTU_JADI = "3 menit";

const steps = [
  { name: "Memantau inbox Outlook", state: "done" },
  { name: "Ekstraksi email", state: "active" },
  { name: "Pembuatan ticket", state: "pending" },
] as const;

export default function OpenclawTicketPage() {
  return (
    <div className="space-y-6">
      {/* Monitoring banner — OpenClaw memantau Outlook Perkom */}
      <div className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        {/* Karakter OpenClaw — animasi bob */}
        <div className="relative shrink-0 self-start sm:self-center">
          <div className="absolute inset-0 rounded-2xl bg-blue-200/50 blur-xl" />
          <Image
            src="/openclaw-dark.webp"
            alt="OpenClaw"
            width={80}
            height={80}
            priority
            className="animate-bob relative h-20 w-20 rounded-2xl object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Outlook Perkom</h2>
              <p className="text-xs text-slate-500">Sedang memantau inbox Outlook Perkom — email masuk diproses jadi ticket otomatis.</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
              <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Monitoring
            </span>
          </div>

          {/* Flow proses: inbox → ekstraksi → ticket */}
          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
            {steps.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2">
                {s.state === "done" ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                ) : s.state === "active" ? (
                  <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
                    {i + 1}
                    <span className="animate-pulse-dot absolute inset-0 rounded-full ring-2 ring-blue-300" />
                  </span>
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-400">
                    {i + 1}
                  </span>
                )}
                <span className={s.state === "pending" ? "text-xs text-slate-400" : "text-xs font-medium text-slate-700"}>{s.name}</span>
                {i < steps.length - 1 && <span className="h-px w-6 bg-slate-200" />}
              </div>
            ))}
          </div>

          {/* Progress bar shimmer */}
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="animate-shimmer h-full w-1/3 rounded-full bg-gradient-to-r from-blue-300 via-blue-600 to-blue-300" />
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">Memproses email → ticket</p>
        </div>
      </div>

      {/* Ticket */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Ticket className="h-4 w-4 text-blue-600" /> Ticket
          </h2>
        </div>
        <div className="overflow-x-auto border border-slate-300">
          <table className="w-full min-w-[960px] border-collapse bg-white text-[11px]">
            <thead>
              <tr>
                {["Ticket", "Subject", "From", "Category", "Waktu Jadi", "Last Updated"].map((h) => (
                  <th key={h} className="whitespace-nowrap border border-slate-300 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-blue-50/30">
                  <td className="whitespace-nowrap border border-slate-200 px-2 py-2 font-medium text-blue-600">#{t.id}</td>
                  <td className="border border-slate-200 px-2 py-2 font-medium text-blue-500">{t.subject}</td>
                  <td className="whitespace-nowrap border border-slate-200 px-2 py-2 text-slate-700">{t.from}</td>
                  <td className="border border-slate-200 px-2 py-2 text-slate-700">{t.category}</td>
                  <td className="whitespace-nowrap border border-slate-200 px-2 py-2 font-medium text-emerald-700">{WAKTU_JADI}</td>
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
