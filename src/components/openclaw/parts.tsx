"use client";

/**
 * Bagian bersama workspace Openclaw: stepper alur, timeline event,
 * badge demo, panel seksi, parse CSV (papaparse), pencatat event.
 * Styling mengikuti token DESIGN.md (slate/blue) + badge daisyUI struktural
 * dengan warna token — pola yang sudah dipakai halaman changelog.
 */

import { Bot, CircleCheck, CircleDashed, CircleAlert } from "lucide-react";
import Papa from "papaparse";
import type { EngineerRow, CustomerRow } from "@/lib/assignment";
import { cn } from "@/lib/utils";

// --- Alur tahap -------------------------------------------------------------

export type StageState = "pending" | "active" | "done" | "error";

export interface Stage {
  label: string;
  state: StageState;
}

export function Stepper({ steps }: { steps: Stage[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          {s.state === "done" ? (
            <CircleCheck className="h-5 w-5 text-emerald-500" />
          ) : s.state === "error" ? (
            <CircleAlert className="h-5 w-5 text-red-500" />
          ) : s.state === "active" ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white ring-2 ring-blue-200">
              {i + 1}
            </span>
          ) : (
            <CircleDashed className="h-5 w-5 text-slate-300" />
          )}
          <span
            className={cn(
              "text-xs",
              s.state === "pending" ? "text-slate-400" : "font-medium text-slate-700"
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="h-px w-5 bg-slate-200" />}
        </div>
      ))}
    </div>
  );
}

// --- Timeline event ---------------------------------------------------------

export type EventKind = "info" | "success" | "warning" | "error" | "demo";

export interface FlowEvent {
  ts: string;
  kind: EventKind;
  label: string;
  detail?: string;
}

const KIND_DOT: Record<EventKind, string> = {
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  demo: "bg-purple-400",
};

export function EventTimeline({ events }: { events: FlowEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-400">
        <Bot className="h-4 w-4" /> Belum ada event — mulai dari input email di atas.
      </p>
    );
  }
  return (
    <ol className="space-y-2.5">
      {events.map((e, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-1.5 flex h-2 w-2 shrink-0 rounded-full">
            <span className={cn("h-2 w-2 rounded-full", KIND_DOT[e.kind])} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-700">
              {e.label}
              {e.kind === "demo" && (
                <span className="badge ml-2 border-0 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-600">
                  DEMO
                </span>
              )}
            </p>
            {e.detail && (
              <p className="mt-0.5 break-words font-mono text-[11px] text-slate-400">
                {e.detail}
              </p>
            )}
            <p className="mt-0.5 font-mono text-[10px] text-slate-400">{e.ts}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// --- Badge & panel ----------------------------------------------------------

export function DemoBadge({ label = "DEMO" }: { label?: string }) {
  return (
    <span className="badge border-0 bg-purple-50 px-2.5 py-1 text-[10px] font-semibold text-purple-600">
      {label}
    </span>
  );
}

export function SectionCard({
  title,
  icon,
  right,
  children,
  tone = "default",
}: {
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  tone?: "default" | "demo";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-5",
        tone === "demo" ? "border-purple-200" : "border-slate-200"
      )}
    >
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        <div className="ml-auto">{right}</div>
      </div>
      {children}
    </div>
  );
}

// --- CSV parsing (client, papaparse) ----------------------------------------

const splitList = (s: string) =>
  s
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function parseEngineersCsv(text: string): {
  rows: EngineerRow[];
  invalid: string[];
} {
  const { data } = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });
  const rows: EngineerRow[] = [];
  const invalid: string[] = [];
  for (const r of data) {
    const get = (...keys: string[]) => {
      const hit = Object.entries(r).find(
        ([k]) => keys.includes(k.toLowerCase().trim())
      );
      return (hit?.[1] ?? "").trim();
    };
    const name = get("name", "nama");
    const email = get("email");
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      invalid.push(name || email || "(baris kosong)");
      continue;
    }
    rows.push({
      name,
      email,
      skills: splitList(get("skills", "skill")),
      sites: splitList(get("sites", "site")),
      available: !/^(false|0|tidak|no)$/i.test(get("available", "tersedia")),
      active_tickets: parseInt(get("active_tickets", "beban"), 10) || 0,
    });
  }
  return { rows, invalid };
}

export function parseCustomersCsv(text: string): {
  rows: CustomerRow[];
  invalid: string[];
} {
  const { data } = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });
  const rows: CustomerRow[] = [];
  const invalid: string[] = [];
  for (const r of data) {
    const get = (...keys: string[]) => {
      const hit = Object.entries(r).find(([k]) =>
        keys.includes(k.toLowerCase().trim())
      );
      return (hit?.[1] ?? "").trim();
    };
    const name = get("name", "nama", "customer");
    const email = get("email");
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      invalid.push(name || email || "(baris kosong)");
      continue;
    }
    rows.push({
      name,
      email,
      site: get("site", "lokasi") || "—",
      service: get("service", "layanan") || "—",
    });
  }
  return { rows, invalid };
}

// --- Pencatat event: localStorage + best-effort ke Supabase -----------------

export function useEventLog(runId: string) {
  const log = async (kind: EventKind, label: string, detail?: string) => {
    const event: FlowEvent = {
      ts: new Date().toLocaleTimeString("id-ID"),
      kind,
      label,
      detail,
    };
    try {
      const key = `openclaw:events:${runId}`;
      const prev = JSON.parse(localStorage.getItem(key) || "[]") as FlowEvent[];
      localStorage.setItem(key, JSON.stringify([event, ...prev].slice(0, 200)));
    } catch {
      /* storage penuh/di-disable — timeline in-memory tetap jalan */
    }
    // Best-effort persist ke DB (tabel openclaw_events, migration 026)
    fetch("/api/automation/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: runId, kind, label, detail }),
    }).catch(() => undefined);
    return event;
  };
  return { log };
}
