"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileInput,
  History,
  Loader2,
  Mail,
  Send,
  Sparkles,
  Ticket,
  UserSearch,
  UserCog,
  ClipboardCheck,
} from "lucide-react";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  DemoBadge,
  EventTimeline,
  SectionCard,
  Stepper,
  parseEngineersCsv,
  useEventLog,
  type EventKind,
  type FlowEvent,
  type Stage,
} from "@/components/openclaw/parts";
import type { AssignmentResult, EngineerRow } from "@/lib/assignment";
import {
  SAMPLE_ENGINEERS_CSV,
  buildCustomerNotification,
  demoTicketId,
  heuristicAnalysis,
} from "@/lib/openclaw-demo";

/**
 * Openclaw Automation Console — alur end-to-end satu tiket:
 * terima → analisis → klasifikasi → resolve customer → assignment →
 * buat tiket → verifikasi → notifikasi → ringkasan.
 * Setiap tahap mencerminkan state nyata; operasi eksternal (buat tiket)
 * hanya lewat konfirmasi eksplisit dan respon asli InvGate.
 */

interface CatalogItem {
  id: number;
  name: string;
}

interface Analysis {
  title: string;
  summary: string;
  description: string;
  category_id: number | null;
  priority_id: number | null;
  assigned_group_id: number | null;
  impact: string;
  urgency: string;
  missing_info: string[];
  next_action: string;
  confidence: "high" | "medium" | "low";
  confidence_explanation: string;
  references: number[];
}

interface Match {
  id: number;
  pretty_id: string;
  title: string;
  status: string;
  category: string;
  created_at: string | null;
  score: number;
}

interface Created {
  id: number;
  pretty_id: string;
  title: string;
  info: string;
  verified: boolean;
}

const SAMPLE_EMAIL = {
  sender: "engineering@ayana-resort.example",
  subject: "CCTV kamera lobby Ayana mati sejak malam",
  body: `Halo tim IT Perkom,

Sejak kemarin malam sekitar jam 22:00, dua kamera CCTV di area lobby (dekat front desk dan dekat pintu masuk utama) tiba-tiba mati bersamaan. Monitor NVR di ruang kontrol menampilkan "no signal" untuk kamera 3 dan 4, kamera lain normal.

Listrik di lobby normal, UPS ruang kontrol juga tidak bunyi alarm. Kami belum coba restart NVR karena takut merekam ulang konfigurasi.

Mohon bantuan pemeriksaan hari ini karena ada event besar besok pagi.

Terima kasih,
Engineering Team — Ayana Resort & Spa Bali`,
};

const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const labelCls = "mb-1 block text-xs font-semibold text-slate-600";

const isEnvError = (msg: string) =>
  /belum diset|GLM_API_KEY|SERVICEDESK/i.test(msg);

export default function OpenclawConsolePage() {
  const [runId] = useState(
    () => `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  );
  const { log } = useEventLog(runId);
  const [events, setEvents] = useState<FlowEvent[]>([]);
  const push = async (kind: EventKind, label: string, detail?: string) => {
    const e = await log(kind, label, detail);
    setEvents((prev) => [e, ...prev]);
  };

  // Tahap 1 — permintaan masuk
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Tahap 2–5 — hasil analisis & penyiapan
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [catalogs, setCatalogs] = useState<{
    categories: CatalogItem[];
    priorities: CatalogItem[];
  }>({ categories: [], priorities: [] });
  const [resolved, setResolved] = useState<{
    checked: boolean;
    found: boolean;
    id: number | null;
    name: string | null;
  } | null>(null);
  const [engineers, setEngineers] = useState<EngineerRow[]>([]);
  const [csvText, setCsvText] = useState("");
  const [assignment, setAssignment] = useState<AssignmentResult | null>(null);

  // Tahap 6–9 — eksekusi
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    category_id: "",
    priority_id: "",
    sender: "",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [dupes, setDupes] = useState<
    Array<{ id: number; pretty_id: string; title: string }>
  >([]);
  const [notification, setNotification] = useState<{ subject: string; body: string } | null>(
    null
  );

  const [demoMode, setDemoMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formValid =
    /.+@.+\..+/.test(sender) && subject.trim().length >= 3 && body.trim().length >= 10;

  // ---------------------------------------------------------------- analisis

  async function runPipeline() {
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setMatches([]);
    setResolved(null);
    setAssignment(null);
    setCreated(null);
    setDupes([]);
    setNotification(null);
    let demo = false;
    await push("info", "Analisis dimulai", `Email dari ${sender}`);

    try {
      const res = await fetch("/api/automation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender, subject, body }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `Gagal (${res.status})`);

      setAnalysis(json.data.analysis);
      setMatches(json.data.matches);
      setCatalogs({
        categories: json.catalogs.categories,
        priorities: json.catalogs.priorities,
      });
      setDraft({
        title: json.data.analysis.title,
        description: json.data.analysis.description,
        category_id: json.data.analysis.category_id?.toString() || "",
        priority_id: json.data.analysis.priority_id?.toString() || "",
        sender,
      });
      await push(
        "success",
        "Analisis GLM selesai",
        `Keyakinan: ${json.data.analysis.confidence}`
      );
      await push(
        json.data.matches.length ? "success" : "info",
        `${json.data.matches.length} tiket sejarah relevan diambil dari InvGate`,
        json.data.matches.map((m: Match) => m.pretty_id).join(", ") || undefined
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menganalisis";
      if (isEnvError(msg)) {
        // Demo Mode: integrasi asli tak tersedia — lanjut dengan heuristik lokal
        demo = true;
        setDemoMode(true);
        const demoAnalysis = heuristicAnalysis({ sender, subject, body });
        setAnalysis(demoAnalysis);
        setDraft({
          title: demoAnalysis.title,
          description: demoAnalysis.description,
          category_id: "",
          priority_id: "",
          sender,
        });
        await push("demo", "Demo Mode aktif — analisis heuristik lokal", msg);
        await push("demo", "Tiket sejarah & katalog InvGate tidak tersedia (demo)");
      } else {
        setError(msg);
        await push("error", "Analisis gagal", msg);
      }
    }

    // Tahap 4 — resolve customer (dilewati di demo mode)
    if (!demo) {
      try {
        const r = await fetch(
          `/api/automation/resolve-user?email=${encodeURIComponent(sender)}`
        );
        const j = await r.json();
        const found = r.ok && j.success && j.data.found;
        setResolved({ checked: true, found, id: j.data?.id ?? null, name: j.data?.name ?? null });
        await push(
          found ? "success" : "warning",
          found
            ? `Customer ter-resolve: ${j.data.name} (InvGate id ${j.data.id})`
            : "Customer tidak ditemukan di InvGate — perlu pilihan manual saat buat tiket"
        );
      } catch {
        setResolved({ checked: true, found: false, id: null, name: null });
        await push("warning", "Resolve customer gagal — endpoint tidak terjangkau");
      }
    }

    // Tahap 5 — assignment engineer dari CSV (aturan deterministik lokal +
    // resolve ID agen InvGate best-effort — tetap jalan di demo, tanpa ID)
    if (engineers.length > 0) {
      try {
        const r = await fetch("/api/automation/assign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            engineers,
            site: /ayana|bali|jimbaran|rimba/i.test(`${subject} ${body}`)
              ? "Ayana"
              : /jakarta|hq|kantor pusat/i.test(`${subject} ${body}`)
                ? "Jakarta"
                : "—",
            required_skills: skillTokens(`${subject} ${body}`),
            customer: sender,
          }),
        });
        const j = await r.json();
        if (r.ok && j.success) {
          setAssignment(j.data);
          await push(
            j.data.needs_assignment ? "warning" : "success",
            j.data.needs_assignment
              ? "Aturan assignment: tidak ada kandidat → Needs Assignment"
              : `Aturan assignment cocok: ${j.data.engineer.name} (${j.data.engineer.email})`,
            j.data.invgate_agent_id
              ? `Agen InvGate id ${j.data.invgate_agent_id}`
              : "Email engineer belum ter-resolve ke ID agen InvGate — dicatat lokal"
          );
        }
      } catch {
        await push("warning", "Assignment gagal dijalankan");
      }
    } else {
      await push("info", "Assignment dilewati — data engineer (CSV) belum diimpor");
    }
    setAnalyzing(false);
  }

  function skillTokens(text: string): string[] {
    const map: Array<[RegExp, string]> = [
      [/cctv|kamera|camera|nvr|dvr/i, "cctv"],
      [/printer|print|scan/i, "printer"],
      [/wifi|network|jaringan|switch|internet/i, "network"],
      [/password|akun|login|email account/i, "account"],
      [/laptop|desktop|pc|komputer/i, "hardware"],
      [/access[- ]?control|door|gerbang/i, "access-control"],
    ];
    return map.filter(([re]) => re.test(text)).map(([, s]) => s);
  }

  // ------------------------------------------------------------- buat tiket

  async function createTicket(force = false) {
    setCreating(true);
    setConfirmOpen(false);
    setError(null);
    await push(force ? "warning" : "info", "Pembuatan tiket dikirim ke InvGate");

    if (demoMode) {
      const id = demoTicketId();
      setCreated({
        id: 0,
        pretty_id: id,
        title: draft.title,
        info: "Demo Mode — tiket TIDAK dibuat di InvGate.",
        verified: false,
      });
      await push("demo", `Tiket lokal ${id} (ilustratif, bukan tiket InvGate)`);
      prepareNotification(id);
      setCreating(false);
      return;
    }

    try {
      const res = await fetch("/api/automation/create-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          category_id: parseInt(draft.category_id, 10),
          priority_id: parseInt(draft.priority_id, 10),
          sender: draft.sender,
          force,
        }),
      });
      const json = await res.json();
      if (res.status === 409) {
        setDupes(json.existing || []);
        setError(json.error);
        await push("warning", "Duplikat ditolak — judul sama persis sudah ada");
        setCreating(false);
        return;
      }
      if (!res.ok || !json.success) throw new Error(json.error || `Gagal (${res.status})`);

      setCreated(json.data);
      setDupes([]);
      await push(
        "success",
        `Tiket #${json.data.pretty_id} dikonfirmasi dibuat (id ${json.data.id})`,
        json.data.info || undefined
      );
      await push(
        json.data.verified ? "success" : "warning",
        json.data.verified
          ? "Verifikasi: tiket terbaca ulang dari InvGate"
          : "Verifikasi: tiket dibuat tapi gagal dibaca ulang — cek Service Desk"
      );
      prepareNotification(json.data.pretty_id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal membuat tiket";
      setError(msg);
      await push("error", "Pembuatan tiket gagal", msg);
    }
    setCreating(false);
  }

  function prepareNotification(prettyId: string) {
    const n = buildCustomerNotification({
      ticket_pretty_id: prettyId,
      customer_name: resolved?.name || draft.sender,
      title: draft.title,
      priority:
        catalogs.priorities.find((p) => p.id.toString() === draft.priority_id)?.name ||
        "—",
      engineer_name: assignment?.engineer?.name ?? null,
    });
    setNotification(n);
    push(
      "info",
      "Draft notifikasi customer disiapkan",
      "Outlook belum terhubung — kirim manual via email client"
    );
  }

  // ------------------------------------------------------------------ tahap

  const stages: Stage[] = [
    { label: "Terima request", state: formValid || analysis ? "done" : "active" },
    { label: "Analisis", state: analysis ? "done" : analyzing ? "active" : "pending" },
    {
      label: "Klasifikasi",
      state:
        draft.category_id && draft.priority_id
          ? "done"
          : analysis
            ? "active"
            : "pending",
    },
    {
      label: "Resolve customer",
      state: demoMode ? "done" : resolved ? (resolved.found ? "done" : "error") : "pending",
    },
    {
      label: "Assignment",
      state: assignment ? "done" : "pending",
    },
    {
      label: "Buat tiket",
      state: created ? "done" : confirmOpen ? "active" : "pending",
    },
    { label: "Verifikasi", state: created ? (created.verified ? "done" : "error") : "pending" },
    { label: "Notifikasi", state: notification ? "done" : "pending" },
    { label: "Ringkasan", state: created ? "done" : "pending" },
  ];

  const draftValid =
    draft.title.trim().length >= 3 &&
    draft.description.trim().length >= 1 &&
    draft.category_id !== "" &&
    draft.priority_id !== "" &&
    /.+@.+\..+/.test(draft.sender);

  const mailto = notification
    ? `mailto:${encodeURIComponent(draft.sender)}?subject=${encodeURIComponent(
        notification.subject
      )}&body=${encodeURIComponent(notification.body)}`
    : "#";

  const summary = useMemo(() => {
    if (!created) return null;
    return {
      ticket: created,
      category:
        catalogs.categories.find((c) => c.id.toString() === draft.category_id)?.name ||
        "(demo — tanpa katalog)",
      priority:
        catalogs.priorities.find((p) => p.id.toString() === draft.priority_id)?.name ||
        "(demo)",
      engineer: assignment?.engineer?.name || "Needs Assignment",
      verified: created.verified,
      demo: demoMode,
    };
  }, [created, catalogs, draft, assignment, demoMode]);

  // ------------------------------------------------------------------- render

  return (
    <div className="space-y-6">
      {/* Header alur */}
      <div className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div className="relative shrink-0 self-start sm:self-center">
          <div className="absolute inset-0 rounded-2xl bg-blue-200/50 blur-xl" />
          <Image
            src="/openclaw-dark.webp"
            alt="OpenClaw"
            width={80}
            height={80}
            priority
            className="relative h-20 w-20 rounded-2xl object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Automation Console
              </h2>
              <p className="text-xs text-slate-500">
                Alur end-to-end satu tiket: email → analisis → assignment → tiket →
                notifikasi. Run: <span className="font-mono">{runId}</span>
              </p>
            </div>
            {demoMode && <DemoBadge label="DEMO MODE" />}
          </div>
          <div className="mt-4">
            <Stepper steps={stages} />
          </div>
        </div>
      </div>

      {/* Tahap 1: input request */}
      <SectionCard title="1 · Permintaan Customer (input manual)" icon={<Mail className="h-4 w-4 text-blue-600" />}>
        <p className="mb-3 text-xs text-slate-500">
          Email diinput manual atau dari contoh — belum ada monitoring inbox Outlook.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="sender">Email pengirim</label>
            <input id="sender" type="email" className={inputCls} placeholder="customer@contoh.co.id" value={sender} onChange={(e) => setSender(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="subject">Subjek email</label>
            <input id="subject" className={inputCls} placeholder="Subjek" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelCls} htmlFor="body">Isi email</label>
          <textarea id="body" rows={7} className={`${inputCls} font-mono text-xs leading-relaxed`} placeholder="Tempel isi email pelanggan…" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={btnPrimary} disabled={!formValid || analyzing} onClick={runPipeline}>
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analyzing ? "Memproses…" : "Jalankan Analisis"}
          </button>
          <button className={btnGhost} onClick={() => { setSender(SAMPLE_EMAIL.sender); setSubject(SAMPLE_EMAIL.subject); setBody(SAMPLE_EMAIL.body); }}>
            Gunakan contoh email (ilustratif)
          </button>
        </div>
      </SectionCard>

      {/* Data engineer CSV */}
      <SectionCard
        title="Data Engineer (CSV) untuk assignment"
        icon={<FileInput className="h-4 w-4 text-blue-600" />}
        right={engineers.length > 0 ? <span className="text-xs font-semibold text-emerald-600">{engineers.length} engineer dimuat</span> : undefined}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="csv">Tempel CSV engineer</label>
            <textarea id="csv" rows={6} className={`${inputCls} font-mono text-[11px]`} placeholder="name,email,skills,sites,available,active_tickets" value={csvText} onChange={(e) => setCsvText(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={btnGhost} onClick={() => setCsvText(SAMPLE_ENGINEERS_CSV)}>Isi contoh CSV</button>
              <button className={btnPrimary} onClick={() => {
                const { rows, invalid } = parseEngineersCsv(csvText);
                setEngineers(rows);
                push(
                  rows.length ? "success" : "warning",
                  `CSV engineer diparse: ${rows.length} valid${invalid.length ? `, ${invalid.length} ditolak` : ""}`,
                  invalid.length ? `Ditolak: ${invalid.slice(0, 3).join(", ")}` : undefined
                );
              }} disabled={!csvText.trim()}>
                Muat & Validasi
              </button>
            </div>
          </div>
          <div className="overflow-x-auto border border-slate-300">
            <table className="w-full min-w-[420px] border-collapse bg-white text-[11px]">
              <thead>
                <tr>
                  {["Engineer", "Skills", "Site", "Tersedia", "Beban"].map((h) => (
                    <th key={h} className="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-700">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {engineers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="border border-slate-200 px-3 py-6 text-center text-slate-400">
                      Belum ada data — muat CSV untuk mengaktifkan tahap assignment.
                    </td>
                  </tr>
                ) : (
                  engineers.map((e) => (
                    <tr key={e.email} className="hover:bg-blue-50/30">
                      <td className="border border-slate-200 px-2 py-2">
                        <span className="font-medium text-slate-800">{e.name}</span>
                        <span className="block text-[10px] text-slate-400">{e.email}</span>
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-slate-600">{e.skills.join(", ") || "—"}</td>
                      <td className="border border-slate-200 px-2 py-2 text-slate-600">{e.sites.join(", ") || "—"}</td>
                      <td className="border border-slate-200 px-2 py-2">
                        <span className={e.available ? "font-semibold text-emerald-600" : "text-slate-400"}>
                          {e.available ? "Ya" : "Tidak"}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-2 py-2 text-slate-600">{e.active_tickets}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      {/* Tahap 2–3: analisis */}
      {analysis && (
        <SectionCard
          title="2–3 · Analisis & Klasifikasi"
          icon={<Sparkles className="h-4 w-4 text-blue-600" />}
          right={demoMode ? <DemoBadge label="HEURISTIK LOKAL" /> : (
            <span className={`badge border-0 px-2.5 py-1 text-[10px] font-semibold ${
              analysis.confidence === "high" ? "bg-emerald-50 text-emerald-700"
              : analysis.confidence === "medium" ? "bg-amber-50 text-amber-700"
              : "bg-slate-100 text-slate-600"}`}>
              Keyakinan: {analysis.confidence}
            </span>
          )}
        >
          <dl className="space-y-3 text-sm">
            <div>
              <dt className={labelCls}>Ringkasan</dt>
              <dd className="text-slate-700">{analysis.summary}</dd>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className={labelCls}>Dampak (advisory)</dt>
                <dd className="text-slate-700">{analysis.impact || "—"}</dd>
              </div>
              <div>
                <dt className={labelCls}>Urgensi (advisory)</dt>
                <dd className="text-slate-700">{analysis.urgency || "—"}</dd>
              </div>
            </div>
            <div>
              <dt className={labelCls}>Tindakan lanjutan</dt>
              <dd className="text-slate-700">{analysis.next_action}</dd>
            </div>
            <div>
              <dt className={labelCls}>Penjelasan keyakinan</dt>
              <dd className="text-slate-500">{analysis.confidence_explanation}</dd>
            </div>
            {analysis.missing_info.length > 0 && (
              <div>
                <dt className={labelCls}>Informasi kurang (perlu klarifikasi)</dt>
                <dd>
                  <ul className="list-inside list-disc text-slate-700">
                    {analysis.missing_info.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        </SectionCard>
      )}

      {/* Tiket sejarah */}
      {analysis && !demoMode && (
        <SectionCard
          title={`Tiket sejarah relevan (${matches.length}) — data nyata InvGate`}
          icon={<History className="h-4 w-4 text-blue-600" />}
        >
          {matches.length === 0 ? (
            <p className="text-sm text-slate-500">
              Tidak ada tiket sejarah yang relevan — tidak dibuat-buat.
            </p>
          ) : (
            <div className="overflow-x-auto border border-slate-300">
              <table className="w-full min-w-[720px] border-collapse bg-white text-[11px]">
                <thead>
                  <tr>
                    {["Tiket", "Judul", "Status", "Kategori", "Dibuat"].map((h) => (
                      <th key={h} className="whitespace-nowrap border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-700">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id} className="hover:bg-blue-50/30">
                      <td className="whitespace-nowrap border border-slate-200 px-2 py-2 font-medium text-blue-600">#{m.pretty_id}</td>
                      <td className="border border-slate-200 px-2 py-2 font-medium text-blue-500">{m.title}</td>
                      <td className="whitespace-nowrap border border-slate-200 px-2 py-2 text-slate-700">{m.status}</td>
                      <td className="border border-slate-200 px-2 py-2 text-slate-700">{m.category || "—"}</td>
                      <td className="whitespace-nowrap border border-slate-200 px-2 py-2 text-slate-700">
                        {m.created_at ? new Date(m.created_at).toLocaleDateString("id-ID") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* Tahap 4: resolve customer */}
      {analysis && (
        <SectionCard title="4 · Resolve Customer" icon={<UserSearch className="h-4 w-4 text-blue-600" />}>
          {demoMode ? (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <DemoBadge label="DEMO" /> Resolve ke InvGate tidak tersedia — customer tidak dicocokkan ke ID nyata.
            </p>
          ) : resolved ? (
            resolved.found ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> {resolved.name} — InvGate user id {resolved.id}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4" /> Email {sender} tidak ditemukan sebagai user InvGate —
                pembuatan tiket akan menolak dan meminta email requester yang valid.
              </p>
            )
          ) : (
            <p className="text-sm text-slate-400">Menunggu hasil resolve…</p>
          )}
        </SectionCard>
      )}

      {/* Tahap 5: assignment */}
      {analysis && (
        <SectionCard
          title="5 · Assignment Engineer"
          icon={<UserCog className="h-4 w-4 text-blue-600" />}
          right={assignment?.needs_assignment ? (
            <span className="badge border-0 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">NEEDS ASSIGNMENT</span>
          ) : undefined}
        >
          {!assignment ? (
            <p className="text-sm text-slate-500">
              {engineers.length === 0
                ? "Import CSV engineer dulu — assignment deterministik butuh data kandidat."
                : "Assignment berjalan saat analisis dijalankan."}
            </p>
          ) : assignment.needs_assignment ? (
            <p className="text-sm text-amber-700">
              Tidak ada engineer valid — tiket akan tercatat Needs Assignment.
            </p>
          ) : (
            <p className="text-sm text-emerald-700">
              Terpilih: <span className="font-semibold">{assignment.engineer!.name}</span> ({assignment.engineer!.email})
              {assignment.invgate_agent_id
                ? ` — agen InvGate id ${assignment.invgate_agent_id}`
                : " — ID agen InvGate belum ter-resolve, assignment dicatat lokal"}
            </p>
          )}
          {assignment && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Alur keputusan assignment
              </p>
              <ol className="list-inside list-decimal space-y-0.5 font-mono text-[11px] text-slate-600">
                {assignment.rationale.map((r, i) => <li key={i}>{r}</li>)}
              </ol>
            </div>
          )}
        </SectionCard>
      )}

      {/* Tahap 6: draf + konfirmasi */}
      {analysis && (
        <SectionCard title="6 · Draf Tiket — preview & konfirmasi" icon={<Ticket className="h-4 w-4 text-blue-600" />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="d-title">Judul</label>
              <input id="d-title" className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div>
              <label className={labelCls} htmlFor="d-cat">Kategori {demoMode ? "(teks bebas — demo)" : "(katalog InvGate)"}</label>
              {demoMode ? (
                <input id="d-cat" className={inputCls} placeholder="mis. Technical Support > CCTV" value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })} />
              ) : (
                <select id="d-cat" className={inputCls} value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
                  <option value="">— pilih —</option>
                  {catalogs.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className={labelCls} htmlFor="d-pri">Prioritas {demoMode ? "(teks bebas — demo)" : "(katalog InvGate)"}</label>
              {demoMode ? (
                <input id="d-pri" className={inputCls} placeholder="mis. High" value={draft.priority_id} onChange={(e) => setDraft({ ...draft, priority_id: e.target.value })} />
              ) : (
                <select id="d-pri" className={inputCls} value={draft.priority_id} onChange={(e) => setDraft({ ...draft, priority_id: e.target.value })}>
                  <option value="">— pilih —</option>
                  {catalogs.priorities.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="d-req">Email requester (customer InvGate)</label>
              <input id="d-req" type="email" className={inputCls} value={draft.sender} onChange={(e) => setDraft({ ...draft, sender: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="d-desc">Deskripsi</label>
              <textarea id="d-desc" rows={6} className={`${inputCls} font-mono text-xs leading-relaxed`} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={btnPrimary} disabled={!draftValid || creating || Boolean(created)} onClick={() => setConfirmOpen(true)}>
              <Send className="h-4 w-4" /> Buat Tiket di InvGate…
            </button>
            {dupes.length > 0 && (
              <button className={btnGhost} disabled={creating} onClick={() => createTicket(true)}>
                Tetap buat (lewati cek duplikat)
              </button>
            )}
            <p className="w-full text-[11px] text-slate-400">
              Tiket dibuat hanya setelah konfirmasi — memakai endpoint POST /incident terverifikasi.
            </p>
          </div>
        </SectionCard>
      )}

      {/* Hasil & verifikasi */}
      {created && (
        <div className={`rounded-xl border p-5 ${created.verified ? "border-emerald-200 bg-emerald-50" : "border-purple-200 bg-purple-50"}`}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            {created.verified ? (
              <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> 7 · Tiket terverifikasi di InvGate</>
            ) : (
              <><ClipboardCheck className="h-4 w-4 text-purple-500" /> 7 · Hasil pembuatan (belum terverifikasi ulang)</>
            )}
            {demoMode && <DemoBadge />}
          </h2>
          <p className="mt-2 text-sm text-slate-800">
            Tiket <span className="font-bold">#{created.pretty_id}</span>
            {created.id ? ` (id ${created.id})` : ""} — {created.title}
          </p>
          {created.info && <p className="mt-1 text-xs text-slate-600">{created.info}</p>}
        </div>
      )}

      {/* Tahap 8: notifikasi */}
      {notification && (
        <SectionCard
          title="8 · Notifikasi Customer (draft)"
          icon={<Mail className="h-4 w-4 text-blue-600" />}
          right={<span className="badge border-0 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">OUTLOOK BELUM TERHUBUNG</span>}
        >
          <p className="mb-3 text-xs text-slate-500">
            Draft disiapkan dengan ID tiket nyata. Mengirim otomatis belum tersedia —
            gunakan tombol di bawah untuk membuka email client Anda (kirim manual, hasil
            sesungguhnya dari provider email Anda).
          </p>
          <div className="space-y-3">
            <div>
              <label className={labelCls} htmlFor="n-subject">Subjek</label>
              <input id="n-subject" className={inputCls} value={notification.subject} onChange={(e) => setNotification({ ...notification, subject: e.target.value })} />
            </div>
            <div>
              <label className={labelCls} htmlFor="n-body">Isi email</label>
              <textarea id="n-body" rows={10} className={`${inputCls} font-mono text-xs leading-relaxed`} value={notification.body} onChange={(e) => setNotification({ ...notification, body: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={mailto} className={btnPrimary}>
              <Send className="h-4 w-4" /> Buka di email client (mailto)
            </a>
            <button className={btnGhost} onClick={() => navigator.clipboard?.writeText(`${notification.subject}\n\n${notification.body}`)}>
              Salin draft
            </button>
          </div>
        </SectionCard>
      )}

      {/* Tahap 9: ringkasan */}
      {summary && (
        <SectionCard title="9 · Ringkasan Eksekusi" icon={<ClipboardCheck className="h-4 w-4 text-blue-600" />} tone={summary.demo ? "demo" : "default"}>
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ["Tiket", `#${summary.ticket.pretty_id}${summary.ticket.id ? ` (id ${summary.ticket.id})` : ""}`],
              ["Judul", summary.ticket.title],
              ["Kategori", summary.category],
              ["Prioritas", summary.priority],
              ["Customer", resolved?.name || draft.sender],
              ["Engineer", summary.engineer],
              ["Verifikasi InvGate", summary.verified ? "Terkonfirmasi" : "Belum / demo"],
              ["Notifikasi", notification ? "Draft disiapkan (belum terkirim)" : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-slate-100 py-1.5">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right font-medium text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      )}

      {/* Duplikat */}
      {dupes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-700">
            <AlertTriangle className="h-4 w-4" /> Judul sama persis sudah ada
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {dupes.map((d) => <li key={d.id}>#{d.pretty_id} — {d.title}</li>)}
          </ul>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700">
            <AlertTriangle className="h-4 w-4" /> Error
          </h2>
          <p className="mt-2 text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Timeline */}
      <SectionCard title={`Timeline Eksekusi (${events.length} event)`} icon={<Bot className="h-4 w-4 text-blue-600" />}>
        <EventTimeline events={events} />
      </SectionCard>

      {/* Konfirmasi pembuatan tiket */}
      <ConfirmModal
        open={confirmOpen}
        title="Buat tiket di InvGate?"
        desc={`"${draft.title}" akan dikirim ke POST /incident dengan kategori & prioritas terpilih. Operasi ini menulis ke sistem produksi Service Desk.`}
        confirmLabel={creating ? "Mengirim…" : "Ya, buat tiket"}
        busy={creating}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => createTicket(false)}
      />
    </div>
  );
}
