"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, Ticket } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const steps = [
  { name: "Memantau inbox Outlook", state: "done" },
  { name: "Ekstraksi email", state: "active" },
  { name: "Pembuatan ticket", state: "pending" },
] as const;

// ponytail: waktu proses email → ticket dihardcode 3 menit,
// hitung dari timestamp email vs created_at saat datanya tersedia.
const WAKTU_JADI = "3 menit";

interface ServiceTicket {
  id: number;
  title?: string;
  created_at?: string | number;
  requester_user?: { name?: string } | null;
  category_details?: { name?: string } | null;
}

function parseDate(dateVal: string | number | undefined) {
  if (!dateVal) return null;
  let val: string | number = dateVal;
  if (/^\d+$/.test(String(val))) {
    const num = parseInt(String(val), 10);
    val = num > 9999999999 ? num : num * 1000;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export default function OpenclawTicketPage() {
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    try {
      const to = new Date();
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const res = await fetch(
        `/api/services?from=${from.toISOString().split("T")[0]}&to=${to.toISOString().split("T")[0]}`
      );
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Gagal mengambil tiket");
      setTickets(Array.isArray(result.data) ? (result.data as ServiceTicket[]) : []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Gagal mengambil tiket.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // setState hanya terjadi setelah await — rule nggak bisa melintasi async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchTickets();
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    void fetchTickets();
  };

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

      {/* Ticket — live dari service desk (InvGate) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Ticket className="h-4 w-4 text-blue-600" /> Ticket
          </h2>
          <Button variant="outline" size="sm" className="h-8 border-slate-300" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
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
              {loading ? (
                <tr>
                  <td colSpan={6} className="border border-slate-200 py-12 text-center text-slate-500">
                    <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-blue-500" />
                    Loading...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-slate-200 py-8 text-center text-slate-500">
                    No data available in table
                  </td>
                </tr>
              ) : (
                tickets.map((t) => {
                  const d = parseDate(t.created_at);
                  const dateStr = d
                    ? d.toLocaleString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).replace(",", "")
                    : "—";
                  return (
                    <tr key={t.id} className="transition-colors hover:bg-blue-50/30">
                      <td className="whitespace-nowrap border border-slate-200 px-2 py-2 font-medium text-blue-600">#PIM-{t.id}</td>
                      <td className="border border-slate-200 px-2 py-2 font-medium text-blue-500">{t.title || "—"}</td>
                      <td className="whitespace-nowrap border border-slate-200 px-2 py-2 text-slate-700">{t.requester_user?.name || "—"}</td>
                      <td className="border border-slate-200 px-2 py-2 text-slate-700">{t.category_details?.name || "—"}</td>
                      <td className="whitespace-nowrap border border-slate-200 px-2 py-2 font-medium text-emerald-700">{WAKTU_JADI}</td>
                      <td className="whitespace-nowrap border border-slate-200 px-2 py-2 text-slate-700">{dateStr}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
