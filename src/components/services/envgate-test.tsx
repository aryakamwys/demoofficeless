"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import dayjs from "dayjs";

export interface EnvGateTicketRow {
  id: number;
  subject: string;
  status: string;
  priority: string;
  requester: string;
  assigned: string;
  category: string;
  created_at: string | null;
}

export function EnvGateTest({ tickets, error }: { tickets: EnvGateTicketRow[]; error: string | null }) {
  const [filter, setFilter] = useState("");

  const norm = (s: string) => s.toLowerCase().trim();
  const filtered = filter
    ? tickets.filter((t) =>
        [t.id, t.subject, t.requester, t.assigned, t.status, t.category]
          .map(String)
          .some((v) => norm(v).includes(norm(filter)))
      )
    : tickets;

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Gagal terhubung ke EnvGate API</p>
          <p className="mt-1">{error}</p>
          <p className="mt-2 text-xs text-red-600">
            Cek SERVICEDESK_USERNAME / SERVICEDESK_PASSWORD di .env dan akses
            jaringan VPS ke servicedesk.perkom.co.id
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <p className="font-semibold">Terhubung ✓ — {tickets.length} ticket terbaru berhasil diambil</p>
          <p className="mt-1 text-xs text-emerald-600">
            Data di-cache 5 menit di server. Kolom pencocokan report = kolom
            Requester (harus sama dengan nama karyawan).
          </p>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter: nama requester / ID / judul..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-9"
        />
      </div>

      {!error && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-100 border-slate-300 font-semibold text-slate-700">
                <th className="px-2 py-2 text-left">ID</th>
                <th className="px-2 py-2 text-left">Judul</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Priority</th>
                <th className="px-2 py-2 text-left">Requester</th>
                <th className="px-2 py-2 text-left">Ditugaskan</th>
                <th className="px-2 py-2 text-left">Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    {tickets.length === 0
                      ? "Tidak ada ticket yang terambil."
                      : "Tidak ada yang cocok dengan filter."}
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-2 py-2 font-medium">{t.id}</td>
                    <td className="px-2 py-2 max-w-[280px] truncate" title={t.subject}>
                      {t.subject || "—"}
                    </td>
                    <td className="px-2 py-2">{t.status}</td>
                    <td className="px-2 py-2">{t.priority}</td>
                    <td className="px-2 py-2 font-medium text-slate-800">{t.requester || "—"}</td>
                    <td className="px-2 py-2">{t.assigned || "—"}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {t.created_at ? dayjs(t.created_at).format("DD MMM YYYY") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
