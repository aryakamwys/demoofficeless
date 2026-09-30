"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import dayjs from "dayjs";
import { Button } from "@/components/ui/button";

export interface EnvGateTicketRow {
  id: number;
  pretty_id: string;
  title: string;
  type_id?: number;
  category: string;
  status: string;
  priority: string;
  requester: string;
  assigned: string;
  helpdesk: string;
  created_at: string | null;
}

/** Warna icon per type (docs: 1=Incident, 2=Service Request, 3=Question, 4=Problem, 5=Change, 6=Major Incident) */
const TYPE_STYLES: Record<number, { bg: string; label: string }> = {
  1: { bg: "bg-orange-500", label: "!" },
  2: { bg: "bg-blue-500", label: "»" },
  3: { bg: "bg-teal-500", label: "?" },
  4: { bg: "bg-pink-500", label: "!" },
  5: { bg: "bg-purple-500", label: "↻" },
  6: { bg: "bg-red-600", label: "!!" },
};

const AVATAR_BG = [
  "bg-slate-500",
  "bg-blue-400",
  "bg-amber-600",
  "bg-teal-500",
  "bg-indigo-400",
  "bg-rose-400",
];

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

function avatarBg(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_BG[h % AVATAR_BG.length];
}

function Avatar({ name }: { name: string }) {
  if (!name) return <span className="text-slate-300">—</span>;
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${avatarBg(name)}`}
    >
      {initials(name)}
    </span>
  );
}

const PAGE_SIZE = 10;

export function EnvGateTest({
  tickets,
  error,
  mapInfo,
}: {
  tickets: EnvGateTicketRow[];
  error: string | null;
  mapInfo?: string;
}) {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const norm = (s: string) => s.toLowerCase().trim();
  const filtered = filter
    ? tickets.filter((t) =>
        [t.id, t.pretty_id, t.title, t.requester, t.assigned, t.status, t.priority, t.category, t.helpdesk]
          .map(String)
          .some((v) => norm(v).includes(norm(filter)))
      )
    : tickets;

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
            Data live dari EnvGate (cache 5 menit). Kolom Customer = perusahaan
            requester; engineer yang mengerjakan ada di kolom Assigned agent.
          </p>
          {mapInfo && (
            <p className="mt-0.5 text-xs text-emerald-600">
              Entity map: {mapInfo}
              {mapInfo.startsWith("0 status") && " — /statuses tidak terjangkau, status tampil sebagai ID."}
            </p>
          )}
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter: ID / judul / customer / agent..."
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
          className="pl-9"
        />
      </div>

      {!error && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2.5 text-left">ID</th>
                <th className="px-3 py-2.5 text-left">Request</th>
                <th className="px-3 py-2.5 text-left">Waiting for</th>
                <th className="px-3 py-2.5 text-left">Assigned agent</th>
                <th className="px-3 py-2.5 text-left">Customer</th>
                <th className="px-3 py-2.5 text-left">Help Desk</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    {tickets.length === 0
                      ? "Tidak ada ticket yang terambil."
                      : "Tidak ada yang cocok dengan filter."}
                  </td>
                </tr>
              ) : (
                rows.map((t) => {
                  const type = TYPE_STYLES[t.type_id ?? 0] ?? {
                    bg: "bg-slate-400",
                    label: "•",
                  };
                  return (
                    <tr key={t.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60">
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <div className="font-semibold text-slate-800">#{t.pretty_id}</div>
                        <div className="text-[10px] text-slate-400">
                          {t.created_at ? dayjs(t.created_at).format("DD MMM YYYY") : "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top max-w-[320px]">
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-[10px] font-bold text-white ${type.bg}`}
                          >
                            {type.label}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-800" title={t.title}>
                              {t.title || "—"}
                            </div>
                            {t.category && (
                              <div className="truncate text-[10px] text-slate-400">{t.category}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="text-slate-700">{t.status || "—"}</div>
                        {t.priority && (
                          <div className="text-[10px] text-slate-400">{t.priority}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex items-center gap-2">
                          <Avatar name={t.assigned} />
                          <span className="truncate text-slate-700">{t.assigned || "—"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="flex items-center gap-2">
                          <Avatar name={t.requester} />
                          <span className="truncate text-slate-700">{t.requester || "—"}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 align-top text-slate-600">
                        {t.helpdesk || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Footer: jumlah + pagination — mirip panel Total requests EnvGate */}
          <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {filtered.length} requests
            </span>
            {pages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-slate-500"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-slate-500">
                  <span className="font-semibold text-blue-600">{safePage}</span>/{pages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-slate-500"
                  disabled={safePage >= pages}
                  onClick={() => setPage(safePage + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
