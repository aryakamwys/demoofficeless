"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileInput,
  Loader2,
  Mail,
  Megaphone,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DemoBadge,
  EventTimeline,
  SectionCard,
  Stepper,
  parseCustomersCsv,
  parseEngineersCsv,
  useEventLog,
  type EventKind,
  type FlowEvent,
  type Stage,
} from "@/components/openclaw/parts";
import type { AssignmentResult, CustomerRow, EngineerRow } from "@/lib/assignment";
import {
  SAMPLE_CUSTOMERS_CSV,
  SAMPLE_ENGINEERS_CSV,
  buildCustomerNotification,
  demoTicketId,
} from "@/lib/openclaw-demo";

/**
 * Ayana CCTV Campaign — alur kampanye tiket massal:
 * template → customer CSV → opsi → preview & dry run → konfirmasi → eksekusi
 * (concurrency terbatas) → laporan. Eksekusi memakai endpoint create-ticket
 * yang SAMA dengan Console (satu sumber kebenaran); duplikat ditolak server,
 * tidak pernah dipaksa. Notifikasi = draft (Outlook belum terhubung).
 */

interface CatalogItem {
  id: number;
  name: string;
}

interface ItemResult {
  customer: CustomerRow;
  title: string;
  status: "pending" | "created" | "duplicate" | "error" | "demo";
  ticketId?: string;
  info?: string;
  engineer?: string | null;
  notification?: { subject: string; body: string };
}

const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const labelCls = "mb-1 block text-xs font-semibold text-slate-600";

const CONCURRENCY = 2;

export default function AyanaCampaignPage() {
  const [campaignId] = useState(
    () => `camp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  );
  const { log } = useEventLog(campaignId);
  const [events, setEvents] = useState<FlowEvent[]>([]);
  const push = async (kind: EventKind, label: string, detail?: string) => {
    const e = await log(kind, label, detail);
    setEvents((prev) => [e, ...prev]);
  };

  // Langkah 1 — template (variabel bisa diedit)
  const [titleTpl, setTitleTpl] = useState(
    "CCTV Ayana — {issue} ({site})"
  );
  const [descTpl, setDescTpl] = useState(
    `Pemeriksaan berkala CCTV area {site}.\n\nPelanggan: {customer}\nJenis issue: {issue}\n\nDibuat oleh kampanye Ayana CCTV (Openclaw).`
  );
  const [issue, setIssue] = useState("Maintenance rutin kamera");
  const [priorityId, setPriorityId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  // Langkah 2 — data
  const [custCsv, setCustCsv] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [engCsv, setEngCsv] = useState("");
  const [engineers, setEngineers] = useState<EngineerRow[]>([]);
  const [catalogs, setCatalogs] = useState<{
    categories: CatalogItem[];
    priorities: CatalogItem[];
  }>({ categories: [], priorities: [] });
  const [demoMode, setDemoMode] = useState(false);

  // Langkah 4–6 — preview & eksekusi
  const [, setAssignments] = useState<Record<string, AssignmentResult>>({});
  const [dryRun, setDryRun] = useState<ItemResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [results, setResults] = useState<ItemResult[] | null>(null);
  const [openNotif, setOpenNotif] = useState<ItemResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selCustomers = customers.filter((c) => selected.has(c.email));

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/automation/catalogs");
        const j = await r.json();
        if (r.ok && j.success) {
          setCatalogs({
            categories: j.data.categories,
            priorities: j.data.priorities,
          });
        }
      } catch {
        /* katalog opsional — campaign tetap bisa dry run */
      }
    })();
  }, []);

  function render(tpl: string, c: CustomerRow) {
    return tpl
      .replaceAll("{customer}", c.name)
      .replaceAll("{site}", c.site)
      .replaceAll("{issue}", issue)
      .replaceAll("{service}", c.service);
  }

  async function buildPreview() {
    setError(null);
    setDryRun(null);
    setResults(null);
    await push("info", `Preview ${selCustomers.length} tiket kampanye dimulai`);

    // Assignment per customer — aturan deterministik sama dengan Console
    const map: Record<string, AssignmentResult> = {};
    if (engineers.length > 0) {
      for (const c of selCustomers) {
        try {
          const r = await fetch("/api/automation/assign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              engineers,
              site: c.site,
              required_skills: ["cctv", c.service.toLowerCase()],
              customer: c.name,
            }),
          });
          const j = await r.json();
          if (r.ok && j.success) map[c.email] = j.data;
        } catch {
          /* assignment per-item gagal → Needs Assignment di laporan */
        }
      }
      await push(
        "success",
        `Assignment dihitung untuk ${Object.keys(map).length} customer`,
        Object.entries(map)
          .map(([email, a]) => `${email}: ${a.needs_assignment ? "Needs Assignment" : a.engineer!.name}`)
          .join("; ")
      );
    }
    setAssignments(map);

    // Dry run: validasi payload tanpa menulis apa pun
    const items: ItemResult[] = selCustomers.map((c) => {
      const title = render(titleTpl, c);
      const problems: string[] = [];
      if (title.trim().length < 3) problems.push("judul terlalu pendek");
      if (!demoMode && !categoryId) problems.push("kategori belum dipilih");
      if (!demoMode && !priorityId) problems.push("prioritas belum dipilih");
      return {
        customer: c,
        title,
        status: "pending",
        info: problems.join(", ") || undefined,
        engineer: map[c.email]?.needs_assignment
          ? "Needs Assignment"
          : (map[c.email]?.engineer?.name ?? null),
      };
    });
    setDryRun(items);
    const invalid = items.filter((i) => i.info).length;
    await push(
      invalid ? "warning" : "success",
      `Dry run selesai: ${items.length - invalid} siap, ${invalid} bermasalah`,
      invalid ? items.filter((i) => i.info).map((i) => `${i.customer.name}: ${i.info}`).join("; ") : undefined
    );
  }

  async function executeCampaign() {
    setConfirmOpen(false);
    setRunning(true);
    setError(null);
    await push(
      demoMode ? "demo" : "info",
      demoMode
        ? "Eksekusi DEMO — tidak ada tiket nyata yang dibuat"
        : `Eksekusi live dimulai (concurrency ${CONCURRENCY}, duplikat ditolak otomatis)`
    );

    const items: ItemResult[] = (dryRun ?? []).map((i) => ({ ...i }));
    setResults(items.map((i) => ({ ...i })));

    // ponytail: pool sederhana — cukup untuk kampanye demo berukuran kecil
    let cursor = 0;
    async function worker() {
      while (cursor < items.length) {
        const idx = cursor++;
        const item = items[idx];
        try {
          if (item.info) {
            item.status = "error";
            item.info = `Validasi gagal: ${item.info}`;
          } else if (demoMode) {
            const id = demoTicketId();
            item.status = "demo";
            item.ticketId = id;
            item.notification = buildCustomerNotification({
              ticket_pretty_id: id,
              customer_name: item.customer.name,
              title: item.title,
              priority: "—",
              engineer_name: item.engineer || null,
            });
            await push("demo", `${item.customer.name}: tiket lokal ${id} (ilustratif)`);
          } else {
            const res = await fetch("/api/automation/create-ticket", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: item.title,
                description: render(descTpl, item.customer),
                category_id: parseInt(categoryId, 10),
                priority_id: parseInt(priorityId, 10),
                sender: item.customer.email,
                force: false,
              }),
            });
            const json = await res.json();
            if (res.status === 409) {
              item.status = "duplicate";
              item.info = `Duplikat: ${json.existing?.[0]?.pretty_id || "judul sama sudah ada"}`;
              await push("warning", `${item.customer.name}: duplikat — dilewati`, item.info);
            } else if (res.status === 422) {
              item.status = "error";
              item.info = json.error;
              await push("error", `${item.customer.name}: ditolak`, json.error);
            } else if (!res.ok || !json.success) {
              item.status = "error";
              item.info = json.error || `Gagal (${res.status})`;
              await push("error", `${item.customer.name}: gagal`, item.info);
            } else {
              item.status = "created";
              item.ticketId = json.data.pretty_id;
              item.info = json.data.info || undefined;
              item.notification = buildCustomerNotification({
                ticket_pretty_id: json.data.pretty_id,
                customer_name: item.customer.name,
                title: item.title,
                priority:
                  catalogs.priorities.find((p) => p.id.toString() === priorityId)
                    ?.name || "—",
                engineer_name: item.engineer || null,
              });
              await push(
                "success",
                `${item.customer.name}: tiket #${json.data.pretty_id} dikonfirmasi InvGate`,
                json.data.verified ? "Terverifikasi via pembacaan ulang" : "Belum terverifikasi ulang"
              );
            }
          }
        } catch (e) {
          item.status = "error";
          item.info = e instanceof Error ? e.message : "Gagal";
          await push("error", `${item.customer.name}: exception`, item.info);
        }
        setResults(items.map((x) => ({ ...x })));
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const created = items.filter((i) => i.status === "created").length;
    const demoCount = items.filter((i) => i.status === "demo").length;
    const dup = items.filter((i) => i.status === "duplicate").length;
    const failed = items.filter((i) => i.status === "error").length;
    await push(
      "info",
      `Kampanye selesai — ${created} dibuat${demoCount ? `, ${demoCount} demo` : ""}, ${dup} duplikat, ${failed} gagal`
    );
    setRunning(false);
  }

  // ------------------------------------------------------------------- tahap

  const stages: Stage[] = [
    { label: "Template", state: "done" },
    {
      label: "Customer CSV",
      state: customers.length > 0 ? "done" : "active",
    },
    {
      label: "Opsi",
      state: demoMode || (categoryId && priorityId) ? "done" : "pending",
    },
    { label: "Preview & dry run", state: dryRun ? "done" : "pending" },
    {
      label: "Eksekusi",
      state: results ? "done" : running ? "active" : "pending",
    },
    { label: "Laporan", state: results ? "done" : "pending" },
  ];

  const canPreview =
    selCustomers.length > 0 && (demoMode || (categoryId && priorityId)) && titleTpl.includes("{");

  const report = useMemo(() => {
    if (!results) return null;
    return {
      total: results.length,
      created: results.filter((r) => r.status === "created").length,
      demo: results.filter((r) => r.status === "demo").length,
      duplicate: results.filter((r) => r.status === "duplicate").length,
      error: results.filter((r) => r.status === "error").length,
      needs: results.filter((r) => r.engineer === "Needs Assignment").length,
    };
  }, [results]);

  const statusBadge = (s: ItemResult["status"]) => {
    switch (s) {
      case "created":
        return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">DIBUAT</span>;
      case "demo":
        return <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-600">DEMO</span>;
      case "duplicate":
        return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">DUPLIKAT</span>;
      case "error":
        return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">GAGAL</span>;
      default:
        return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">MENUNGGU</span>;
    }
  };

  // ------------------------------------------------------------------- render

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Ayana CCTV Campaign
            </h2>
            <p className="text-xs text-slate-500">
              Template tiket CCTV untuk banyak customer sekaligus — memakai alur
              create-ticket yang sama dengan Automation Console. Kampanye:{" "}
              <span className="font-mono">{campaignId}</span>
            </p>
          </div>
          {demoMode && <DemoBadge label="DEMO MODE" />}
        </div>
        <div className="mt-4">
          <Stepper steps={stages} />
        </div>
      </div>

      {/* Langkah 1 — template */}
      <SectionCard title="1 · Template Tiket (variabel bisa diedit)" icon={<Megaphone className="h-4 w-4 text-blue-600" />}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className={labelCls} htmlFor="t-title">Judul — variabel {"{customer} {site} {issue}"}</label>
              <input id="t-title" className={inputCls} value={titleTpl} onChange={(e) => setTitleTpl(e.target.value)} />
            </div>
            <div>
              <label className={labelCls} htmlFor="t-issue">Jenis issue</label>
              <input id="t-issue" className={inputCls} value={issue} onChange={(e) => setIssue(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="t-cat">Kategori {demoMode ? "(demo)" : "(katalog InvGate)"}</label>
                {demoMode ? (
                  <input className={inputCls} value="Technical Support > CCTV (demo)" disabled />
                ) : (
                  <select id="t-cat" className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    <option value="">— pilih —</option>
                    {catalogs.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className={labelCls} htmlFor="t-pri">Prioritas {demoMode ? "(demo)" : "(katalog InvGate)"}</label>
                {demoMode ? (
                  <input className={inputCls} value="Medium (demo)" disabled />
                ) : (
                  <select id="t-pri" className={inputCls} value={priorityId} onChange={(e) => setPriorityId(e.target.value)}>
                    <option value="">— pilih —</option>
                    {catalogs.priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="t-desc">Deskripsi — variabel sama dengan judul</label>
            <textarea id="t-desc" rows={9} className={`${inputCls} font-mono text-xs leading-relaxed`} value={descTpl} onChange={(e) => setDescTpl(e.target.value)} />
          </div>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          Template ini ilustratif untuk contoh — request customer sesungguhnya tetap
          lewat Console/email nyata.
        </p>
      </SectionCard>

      {/* Langkah 2 — data CSV */}
      <SectionCard title="2 · Data Customer & Engineer (CSV)" icon={<FileInput className="h-4 w-4 text-blue-600" />}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="c-csv">CSV customer</label>
            <textarea id="c-csv" rows={5} className={`${inputCls} font-mono text-[11px]`} placeholder="name,email,site,service" value={custCsv} onChange={(e) => setCustCsv(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={btnGhost} onClick={() => setCustCsv(SAMPLE_CUSTOMERS_CSV)}>Isi contoh</button>
              <button className={btnPrimary} disabled={!custCsv.trim()} onClick={() => {
                const { rows, invalid } = parseCustomersCsv(custCsv);
                setCustomers(rows);
                setSelected(new Set(rows.map((r) => r.email)));
                push(
                  rows.length ? "success" : "warning",
                  `CSV customer: ${rows.length} valid${invalid.length ? `, ${invalid.length} ditolak` : ""}`
                );
              }}>Muat & pilih semua</button>
            </div>
            <div className="mt-3 max-h-44 space-y-1.5 overflow-y-auto">
              {customers.map((c) => (
                <label key={c.email} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-blue-600"
                    checked={selected.has(c.email)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(c.email);
                      else next.delete(c.email);
                      setSelected(next);
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{c.name}</span>
                  <span className="shrink-0 text-slate-400">{c.site}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="e-csv">CSV engineer (aturan assignment sama dengan Console)</label>
            <textarea id="e-csv" rows={5} className={`${inputCls} font-mono text-[11px]`} placeholder="name,email,skills,sites,available,active_tickets" value={engCsv} onChange={(e) => setEngCsv(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={btnGhost} onClick={() => setEngCsv(SAMPLE_ENGINEERS_CSV)}>Isi contoh</button>
              <button className={btnPrimary} disabled={!engCsv.trim()} onClick={() => {
                const { rows } = parseEngineersCsv(engCsv);
                setEngineers(rows);
                push("success", `CSV engineer: ${rows.length} kandidat dimuat`);
              }}>Muat</button>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              {engineers.length > 0
                ? `${engineers.length} engineer dimuat — assignment dihitung per customer.`
                : "Tanpa engineer, semua item akan berstatus Needs Assignment."}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={btnPrimary} disabled={!canPreview} onClick={buildPreview}>
            <PlayCircle className="h-4 w-4" /> Preview & Dry Run
          </button>
          <button
            className={btnGhost}
            onClick={() => {
              setDemoMode((d) => !d);
              push("info", demoMode ? "Demo Mode dimatikan" : "Demo Mode diaktifkan — eksekusi tidak menulis ke InvGate");
            }}
          >
            <ShieldCheck className="h-4 w-4" /> {demoMode ? "Matikan" : "Aktifkan"} Demo Mode
          </button>
        </div>
      </SectionCard>

      {/* Langkah 4 — preview & dry run */}
      {dryRun && (
        <SectionCard
          title={`4 · Preview Payload & Assignment (${dryRun.length} tiket)`}
          icon={<ShieldCheck className="h-4 w-4 text-blue-600" />}
          right={
            <button className={btnPrimary} disabled={running} onClick={() => setConfirmOpen(true)}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              {demoMode ? "Jalankan (DEMO)" : "Jalankan Kampanye Live…"}
            </button>
          }
        >
          <div className="overflow-x-auto border border-slate-300">
            <table className="w-full min-w-[860px] border-collapse bg-white text-[11px]">
              <thead>
                <tr>
                  {["Customer", "Site", "Judul tiket", "Assignment", "Validasi", "Status"].map((h) => (
                    <th key={h} className="whitespace-nowrap border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-700">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dryRun.map((i) => (
                  <tr key={i.customer.email} className="hover:bg-blue-50/30">
                    <td className="border border-slate-200 px-2 py-2">
                      <span className="font-medium text-slate-800">{i.customer.name}</span>
                      <span className="block text-[10px] text-slate-400">{i.customer.email}</span>
                    </td>
                    <td className="border border-slate-200 px-2 py-2 text-slate-600">{i.customer.site}</td>
                    <td className="border border-slate-200 px-2 py-2 font-medium text-blue-500">{i.title}</td>
                    <td className="border border-slate-200 px-2 py-2 text-slate-700">{i.engineer || "Needs Assignment"}</td>
                    <td className="border border-slate-200 px-2 py-2">
                      {i.info ? <span className="text-amber-700">{i.info}</span> : <span className="text-emerald-600">OK</span>}
                    </td>
                    <td className="border border-slate-200 px-2 py-2">
                      {results ? statusBadge(results.find((r) => r.customer.email === i.customer.email)?.status ?? "pending") : <span className="text-slate-400">belum dieksekusi</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Laporan */}
      {report && (
        <SectionCard
          title="6 · Laporan Kampanye"
          icon={<CheckCircle2 className="h-4 w-4 text-blue-600" />}
          tone={report.demo > 0 && report.created === 0 ? "demo" : "default"}
        >
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Total", report.total, "text-slate-800"],
              ["Dibuat (nyata)", report.created, "text-emerald-600"],
              ["Demo (ilustratif)", report.demo, "text-purple-600"],
              ["Duplikat", report.duplicate, "text-amber-600"],
              ["Gagal", report.error, "text-red-600"],
            ].map(([k, v, cls]) => (
              <div key={String(k)} className="rounded-lg border border-slate-200 p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k}</dt>
                <dd className={`mt-1 text-xl font-bold ${cls}`}>{v}</dd>
              </div>
            ))}
          </dl>
          {results && results.some((r) => r.ticketId) && (
            <div className="mt-4 space-y-1.5">
              {results.filter((r) => r.ticketId).map((r) => (
                <button
                  key={r.customer.email}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-xs hover:bg-slate-50"
                  onClick={() => setOpenNotif(r)}
                >
                  <Mail className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                  <span className="font-medium text-slate-700">#{r.ticketId}</span>
                  <span className="truncate text-slate-500">— {r.customer.name}</span>
                  <span className="ml-auto shrink-0 text-slate-400">draft notifikasi {r.notification ? "tersiapkan" : "—"}</span>
                </button>
              ))}
              <p className="pt-1 text-[11px] text-slate-400">
                Notifikasi berstatus draft — Outlook belum terhubung; kirim manual
                lewat email client (mailto) dari dialog detail.
              </p>
            </div>
          )}
        </SectionCard>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4" /> Error
          </h2>
          <p className="mt-2 text-sm text-red-800">{error}</p>
        </div>
      )}

      <SectionCard title={`Timeline Kampanye (${events.length} event)`} icon={<Megaphone className="h-4 w-4 text-blue-600" />}>
        <EventTimeline events={events} />
      </SectionCard>

      {/* Konfirmasi eksekusi live */}
      <ConfirmModal
        open={confirmOpen}
        title={demoMode ? "Jalankan kampanye DEMO?" : "Jalankan kampanye LIVE?"}
        desc={
          demoMode
            ? "Demo Mode aktif — tidak ada tiket yang ditulis ke InvGate. Hasil berlabel DEMO."
            : `${selCustomers.length} tiket akan dibuat di InvGate produksi (concurrency ${CONCURRENCY}, duplikat otolak otomatis). Pastikan preview sudah diperiksa.`
        }
        confirmLabel={running ? "Menjalankan…" : demoMode ? "Ya, jalankan demo" : "Ya, jalankan live"}
        busy={running}
        danger={!demoMode}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={executeCampaign}
      />

      {/* Detail notifikasi per item */}
      <Dialog open={openNotif != null} onOpenChange={(v) => !v && setOpenNotif(null)}>
        <DialogContent className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6">
          {openNotif && openNotif.notification && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  #{openNotif.ticketId} — {openNotif.customer.name}
                  {openNotif.status === "demo" && <DemoBadge />}
                </DialogTitle>
              </DialogHeader>
              <p className="mt-2 text-xs font-semibold text-slate-600">{openNotif.notification.subject}</p>
              <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700">
                {openNotif.notification.body}
              </pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  className={btnPrimary}
                  href={`mailto:${encodeURIComponent(openNotif.customer.email)}?subject=${encodeURIComponent(openNotif.notification.subject)}&body=${encodeURIComponent(openNotif.notification.body)}`}
                >
                  <Mail className="h-4 w-4" /> Buka di email client
                </a>
                <button
                  className={btnGhost}
                  onClick={() => navigator.clipboard?.writeText(`${openNotif.notification!.subject}\n\n${openNotif.notification!.body}`)}
                >
                  Salin draft
                </button>
              </div>
              <p className="mt-2 text-[11px] text-amber-600">
                Status: draft disiapkan — belum terkirim (Outlook tidak terhubung).
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
