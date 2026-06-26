"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart3, Upload, FileSpreadsheet, Table2, PieChart,
  TrendingUp, Hash, Loader2, X, Presentation, ArrowUpRight,
  ArrowDownRight, Minus, FileUp, Columns3,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// ── Types ──────────────────────────────────────────────────

type ChartType = "kpi" | "bar" | "pie" | "line" | "table";

interface DetectedColumn {
  name: string;
  type: "number" | "date" | "category" | "text";
}

interface Widget {
  id: string;
  title: string;
  chartType: ChartType;
  data: any[];
  columns: string[];
  valueColumn?: string;
  labelColumn?: string;
}

interface Summary {
  totalRows: number;
  totalColumns: number;
  numericColumns: string[];
  categoryColumns: string[];
  dateColumns: string[];
  insights: string[];
}

// ── Helpers ────────────────────────────────────────────────

function detectColumnType(values: any[]): "number" | "date" | "category" | "text" {
  const nonEmpty = values.filter(v => v != null && v !== "");
  if (nonEmpty.length === 0) return "text";
  if (nonEmpty.filter(v => !isNaN(Number(v))).length / nonEmpty.length > 0.8) return "number";
  if (nonEmpty.filter(v => typeof v !== "number" && !isNaN(new Date(v).getTime())).length / nonEmpty.length > 0.7) return "date";
  if (new Set(nonEmpty.map(String)).size <= Math.max(20, nonEmpty.length * 0.3)) return "category";
  return "text";
}

function buildSummary(data: any[], columns: DetectedColumn[]): Summary {
  const numCols = columns.filter(c => c.type === "number").map(c => c.name);
  const catCols = columns.filter(c => c.type === "category").map(c => c.name);
  const dateCols = columns.filter(c => c.type === "date").map(c => c.name);
  const insights: string[] = [];

  numCols.forEach(col => {
    const vals = data.map(r => Number(r[col])).filter(n => !isNaN(n));
    if (vals.length === 0) return;
    const sum = vals.reduce((a, b) => a + b, 0);
    const avg = sum / vals.length;
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    insights.push(`${col}: total ${sum.toLocaleString()}, rata-rata ${avg.toFixed(1)}, range ${min.toLocaleString()}–${max.toLocaleString()}`);
  });

  catCols.forEach(col => {
    const counts: Record<string, number> = {};
    data.forEach(r => { const v = String(r[col] || ""); counts[v] = (counts[v] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      insights.push(`${col}: ${sorted.length} kategori, terbanyak "${sorted[0][0]}" (${sorted[0][1]}x)`);
    }
  });

  return { totalRows: data.length, totalColumns: columns.length, numericColumns: numCols, categoryColumns: catCols, dateColumns: dateCols, insights };
}

// ── Chart Components (pure SVG, no library) ────────────────

function KPICard({ widget }: { widget: Widget }) {
  const vals = widget.data.map(d => Number(d[widget.valueColumn || widget.columns[0]])).filter(n => !isNaN(n));
  const total = vals.reduce((a, b) => a + b, 0);
  const avg = vals.length ? total / vals.length : 0;
  const half = Math.floor(vals.length / 2);
  const firstHalf = vals.slice(0, half).reduce((a, b) => a + b, 0) / (half || 1);
  const secondHalf = vals.slice(half).reduce((a, b) => a + b, 0) / (vals.length - half || 1);
  const trend = secondHalf - firstHalf;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <p className="text-3xl font-semibold tracking-tight text-slate-900">{total.toLocaleString()}</p>
      <p className="text-xs text-slate-500">Total · Avg {avg.toFixed(1)}</p>
      <div className={`flex items-center gap-1 text-xs mt-1 ${trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-500" : "text-slate-400"}`}>
        {trend > 0 ? <ArrowUpRight className="h-3 w-3" /> : trend < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
        {Math.abs(trend).toFixed(1)} vs paruh pertama
      </div>
    </div>
  );
}

function HorizontalBar({ widget }: { widget: Widget }) {
  const labelCol = widget.labelColumn || widget.columns[0];
  const valueCol = widget.valueColumn || widget.columns[1] || widget.columns[0];
  const agg: Record<string, number> = {};
  widget.data.forEach(r => {
    const l = String(r[labelCol] || "—");
    agg[l] = (agg[l] || 0) + (Number(r[valueCol]) || 0);
  });
  const entries = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const maxVal = Math.max(...entries.map(e => e[1]), 1);

  return (
    <div className="flex flex-col gap-1.5 h-full overflow-auto pr-1">
      {entries.map(([label, value]) => (
        <div key={label} className="flex items-center gap-2 text-xs group">
          <span className="w-20 text-right text-slate-500 truncate shrink-0" title={label}>{label}</span>
          <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
            <div
              className="h-full rounded bg-blue-500 transition-all duration-300 group-hover:bg-blue-600"
              style={{ width: `${(value / maxVal) * 100}%` }}
            />
          </div>
          <span className="w-14 text-right text-slate-600 tabular-nums shrink-0">{value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ widget }: { widget: Widget }) {
  const labelCol = widget.labelColumn || widget.columns[0];
  const valueCol = widget.valueColumn || widget.columns.find((_, i) => i > 0);
  const agg: Record<string, number> = {};
  widget.data.forEach(r => {
    const l = String(r[labelCol] || "—");
    agg[l] = (agg[l] || 0) + (valueCol ? (Number(r[valueCol]) || 0) : 1);
  });
  const entries = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const palette = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

  let cum = 0;
  const arcs = entries.map(([label, value], i) => {
    const pct = (value / total) * 100;
    const start = cum;
    cum += pct;
    return { label, value, pct, start, color: palette[i % palette.length] };
  });
  const gradient = arcs.map(a => `${a.color} ${a.start}% ${a.start + a.pct}%`).join(",");

  return (
    <div className="flex items-center gap-4 h-full">
      <div className="relative shrink-0">
        <div className="w-28 h-28 rounded-full" style={{ background: `conic-gradient(${gradient})` }} />
        <div className="absolute inset-3 bg-white rounded-full flex items-center justify-center">
          <span className="text-sm font-semibold text-slate-700">{total.toLocaleString()}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 text-xs min-w-0 overflow-auto">
        {arcs.map(a => (
          <div key={a.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
            <span className="text-slate-600 truncate">{a.label}</span>
            <span className="text-slate-400 ml-auto shrink-0">{a.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SparkLine({ widget }: { widget: Widget }) {
  const valueCol = widget.valueColumn || widget.columns.find((c, i) => i > 0 && widget.data[0] && !isNaN(Number(widget.data[0][c]))) || widget.columns[0];
  const vals = widget.data.map(d => Number(d[valueCol]) || 0).slice(0, 60);
  if (vals.length < 2) return <p className="text-center text-slate-400 text-sm py-8">Tidak cukup data</p>;

  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = max - min || 1;
  const W = 420, H = 140, pad = 12;
  const step = (W - pad * 2) / (vals.length - 1);

  const pts = vals.map((v, i) => ({
    x: pad + i * step,
    y: pad + (H - pad * 2) - ((v - min) / range) * (H - pad * 2),
  }));
  const line = pts.map(p => `${p.x},${p.y}`).join(" ");
  const area = `${pad},${H - pad} ${line} ${pts[pts.length - 1].x},${H - pad}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <polygon points={area} fill="url(#areaFill)" />
      <polyline points={line} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round" />
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function DataTable({ widget }: { widget: Widget }) {
  const rows = widget.data.slice(0, 100);
  const cols = widget.columns.slice(0, 10);
  return (
    <ScrollArea className="h-full">
      <Table>
        <TableHeader>
          <TableRow>
            {cols.map(c => <TableHead key={c} className="text-xs whitespace-nowrap">{c}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {cols.map(c => <TableCell key={c} className="text-xs py-1.5 max-w-[180px] truncate">{String(r[c] ?? "")}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

const CHART_OPTIONS: { type: ChartType; icon: any; label: string }[] = [
  { type: "kpi", icon: Hash, label: "KPI" },
  { type: "bar", icon: BarChart3, label: "Bar" },
  { type: "pie", icon: PieChart, label: "Pie" },
  { type: "line", icon: TrendingUp, label: "Line" },
  { type: "table", icon: Table2, label: "Table" },
];

// ── Main Page ──────────────────────────────────────────────

export default function AutoDashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [columns, setColumns] = useState<DetectedColumn[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  // ── File Processing ────────────────────

  const processFile = useCallback(async (f: File) => {
    setFile(f);
    setLoading(true);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const json: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      if (!json.length) { toast.error("File kosong"); setLoading(false); return; }

      setRawData(json);
      const colNames = Object.keys(json[0]);
      const detected: DetectedColumn[] = colNames.map(name => ({
        name,
        type: detectColumnType(json.map(r => r[name])),
      }));
      setColumns(detected);
      setSummary(buildSummary(json, detected));

      // Auto-generate widgets
      const ws: Widget[] = [];
      const nums = detected.filter(c => c.type === "number");
      const cats = detected.filter(c => c.type === "category");
      const dates = detected.filter(c => c.type === "date");

      // KPIs (max 3)
      nums.slice(0, 3).forEach(n => ws.push({
        id: `kpi-${n.name}`, title: n.name, chartType: "kpi",
        data: json, columns: [n.name], valueColumn: n.name,
      }));

      // Bar: first cat × first num
      if (cats.length && nums.length) ws.push({
        id: `bar-0`, title: `${nums[0].name} per ${cats[0].name}`, chartType: "bar",
        data: json, columns: [cats[0].name, nums[0].name],
        labelColumn: cats[0].name, valueColumn: nums[0].name,
      });

      // Pie: first cat
      if (cats.length) ws.push({
        id: `pie-0`, title: `Distribusi ${cats[0].name}`, chartType: "pie",
        data: json, columns: [cats[0].name, ...(nums.length ? [nums[0].name] : [])],
        labelColumn: cats[0].name, valueColumn: nums[length] ? nums[0].name : undefined,
      });

      // Line: date × num
      if (dates.length && nums.length) ws.push({
        id: `line-0`, title: `Tren ${nums[0].name}`, chartType: "line",
        data: json, columns: [dates[0].name, nums[0].name], valueColumn: nums[0].name,
      });

      // Second bar if more categories
      if (cats.length > 1 && nums.length) ws.push({
        id: `bar-1`, title: `${nums[0].name} per ${cats[1].name}`, chartType: "bar",
        data: json, columns: [cats[1].name, nums[0].name],
        labelColumn: cats[1].name, valueColumn: nums[0].name,
      });

      // Data table always
      ws.push({
        id: "tbl", title: "Data", chartType: "table",
        data: json, columns: colNames,
      });

      setWidgets(ws);
      toast.success(`${json.length} baris dari ${colNames.length} kolom berhasil diproses`);
    } catch (e: any) {
      toast.error("Gagal membaca file: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }, [processFile]);
  const onInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processFile(f); }, [processFile]);

  // ── PPT Export ─────────────────────────

  const exportPPT = async () => {
    const PptxGenJS = (await import("pptxgenjs")).default;
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";

    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.addText(file?.name || "Dashboard", { x: 0.8, y: 1.5, w: 11, fontSize: 28, bold: true, color: "1e293b" });
    titleSlide.addText(`${rawData.length} baris · ${columns.length} kolom`, { x: 0.8, y: 2.3, w: 11, fontSize: 14, color: "64748b" });
    titleSlide.addText(new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }), { x: 0.8, y: 2.8, w: 11, fontSize: 12, color: "94a3b8" });

    // Summary slide
    if (summary) {
      const sumSlide = pptx.addSlide();
      sumSlide.addText("Ringkasan Data", { x: 0.5, y: 0.3, w: 12, fontSize: 20, bold: true, color: "1e293b" });
      const sumLines = summary.insights.map((s, i) => ({ text: `• ${s}\n`, options: { fontSize: 11, color: "475569" as const, breakType: "none" as const } }));
      sumSlide.addText(sumLines as any, { x: 0.5, y: 1, w: 12, h: 5 });
    }

    // Per-widget slides (table data only — charts can't be easily serialized to PPT without a charting lib)
    widgets.filter(w => w.chartType !== "table").forEach(w => {
      const slide = pptx.addSlide();
      slide.addText(w.title, { x: 0.5, y: 0.3, w: 12, fontSize: 18, bold: true, color: "1e293b" });

      if (w.chartType === "kpi") {
        const vals = w.data.map(d => Number(d[w.valueColumn || w.columns[0]])).filter(n => !isNaN(n));
        const total = vals.reduce((a, b) => a + b, 0);
        slide.addText(total.toLocaleString(), { x: 3, y: 2, w: 7, fontSize: 48, bold: true, color: "3b82f6", align: "center" });
        slide.addText(`Rata-rata: ${(total / vals.length).toFixed(1)}`, { x: 3, y: 3.5, w: 7, fontSize: 14, color: "64748b", align: "center" });
      } else if (w.chartType === "bar" || w.chartType === "pie") {
        const labelCol = w.labelColumn || w.columns[0];
        const valueCol = w.valueColumn || w.columns[1];
        const agg: Record<string, number> = {};
        w.data.forEach(r => { agg[String(r[labelCol] || "—")] = (agg[String(r[labelCol] || "—")] || 0) + (Number(r[valueCol]) || 0); });
        const rows = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 15);
        const tableRows = rows.map(([k, v]) => [{ text: k, options: { fontSize: 10 } }, { text: v.toLocaleString(), options: { fontSize: 10, align: "right" as const } }]);
        slide.addTable([
          [{ text: labelCol, options: { bold: true, fontSize: 10, fill: { color: "f1f5f9" } } }, { text: valueCol || "Count", options: { bold: true, fontSize: 10, fill: { color: "f1f5f9" }, align: "right" as const } }],
          ...tableRows,
        ] as any, { x: 1, y: 1.2, w: 11, fontSize: 10, border: { type: "solid", pt: 0.5, color: "e2e8f0" } });
      }
    });

    // Raw data slide
    const dataSlide = pptx.addSlide();
    dataSlide.addText("Data Tabel", { x: 0.5, y: 0.3, w: 12, fontSize: 18, bold: true, color: "1e293b" });
    const showCols = columns.slice(0, 6).map(c => c.name);
    const headerRow = showCols.map(c => ({ text: c, options: { bold: true, fontSize: 8, fill: { color: "f1f5f9" } } }));
    const dataRows = rawData.slice(0, 20).map(r => showCols.map(c => ({ text: String(r[c] ?? ""), options: { fontSize: 8 } })));
    dataSlide.addTable([headerRow, ...dataRows] as any, { x: 0.3, y: 1, w: 12.5, fontSize: 8, border: { type: "solid", pt: 0.5, color: "e2e8f0" } });

    await pptx.writeFile({ fileName: `dashboard-${file?.name || "export"}.pptx` });
    toast.success("PPT berhasil diunduh");
  };

  // ── Render ─────────────────────────────

  const changeType = (id: string, t: ChartType) => setWidgets(ws => ws.map(w => w.id === id ? { ...w, chartType: t } : w));
  const removeWidget = (id: string) => setWidgets(ws => ws.filter(w => w.id !== id));

  // Upload state
  if (!file) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById("auto-dash-file")?.click()}
          className={`w-full max-w-lg rounded-lg border-2 border-dashed p-16 text-center cursor-pointer transition-colors ${
            dragging ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"
          }`}
        >
          <input id="auto-dash-file" type="file" accept=".xlsx,.xls,.csv,.xlsm" className="hidden" onChange={onInput} />
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
          ) : (
            <>
              <FileUp className="h-10 w-10 text-slate-400 mx-auto mb-4" />
              <p className="text-sm font-medium text-slate-700">Drop file atau klik untuk upload</p>
              <p className="text-xs text-slate-400 mt-1">XLSX · XLS · CSV · XLSM</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Dashboard state
  return (
    <div className="flex gap-5 h-[calc(100vh-100px)]">
      {/* ── Left: Widgets ── */}
      <div className="flex-1 min-w-0">
        {/* File bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="text-sm font-medium text-slate-800 truncate">{file.name}</span>
            <Badge variant="secondary" className="text-[10px]">{rawData.length} baris</Badge>
            <Badge variant="outline" className="text-[10px]">{columns.length} kolom</Badge>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={exportPPT}>
              <Presentation className="h-3.5 w-3.5 mr-1.5" /> Export PPT
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setFile(null); setRawData([]); setColumns([]); setWidgets([]); setSummary(null); }}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Ganti File
            </Button>
          </div>
        </div>

        {/* Widget grid */}
        <ScrollArea className="h-[calc(100%-44px)]">
          <div className="grid grid-cols-3 gap-3 pb-4">
            {widgets.map(w => {
              const span = w.chartType === "table" ? "col-span-3" : w.chartType === "line" ? "col-span-2" : "col-span-1";
              return (
                <Card key={w.id} className={`${span} overflow-hidden`}>
                  <CardHeader className="py-2 px-3 flex-row items-center justify-between space-y-0 border-b">
                    <CardTitle className="text-xs font-medium text-slate-700">{w.title}</CardTitle>
                    <div className="flex items-center gap-0.5">
                      {CHART_OPTIONS.map(o => (
                        <button key={o.type} onClick={() => changeType(w.id, o.type)} title={o.label}
                          className={`p-1 rounded ${w.chartType === o.type ? "bg-slate-200 text-slate-800" : "text-slate-400 hover:text-slate-600"}`}>
                          <o.icon className="h-3 w-3" />
                        </button>
                      ))}
                      <button onClick={() => removeWidget(w.id)} className="p-1 rounded text-slate-400 hover:text-red-500 ml-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className={`p-3 ${w.chartType === "table" ? "h-[240px]" : w.chartType === "kpi" ? "h-[130px]" : "h-[180px]"}`}>
                    {w.chartType === "kpi" && <KPICard widget={w} />}
                    {w.chartType === "bar" && <HorizontalBar widget={w} />}
                    {w.chartType === "pie" && <DonutChart widget={w} />}
                    {w.chartType === "line" && <SparkLine widget={w} />}
                    {w.chartType === "table" && <DataTable widget={w} />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* ── Right: Summary Panel ── */}
      {summary && (
        <aside className="w-72 shrink-0 border-l pl-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Ringkasan</h2>

          <div className="space-y-4 text-xs text-slate-600">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border p-2.5">
                <p className="text-lg font-semibold text-slate-800">{summary.totalRows}</p>
                <p className="text-slate-400">Baris</p>
              </div>
              <div className="rounded-md border p-2.5">
                <p className="text-lg font-semibold text-slate-800">{summary.totalColumns}</p>
                <p className="text-slate-400">Kolom</p>
              </div>
            </div>

            <Separator />

            {/* Column types */}
            <div>
              <p className="font-medium text-slate-700 mb-1.5 flex items-center gap-1"><Columns3 className="h-3 w-3" /> Tipe Kolom</p>
              <div className="space-y-1">
                {columns.map(c => (
                  <div key={c.name} className="flex items-center justify-between">
                    <span className="truncate mr-2">{c.name}</span>
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${
                      c.type === "number" ? "border-emerald-300 text-emerald-700" :
                      c.type === "date" ? "border-amber-300 text-amber-700" :
                      c.type === "category" ? "border-blue-300 text-blue-700" :
                      ""
                    }`}>{c.type}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Insights */}
            <div>
              <p className="font-medium text-slate-700 mb-1.5">Insight</p>
              <ul className="space-y-1.5">
                {summary.insights.map((s, i) => (
                  <li key={i} className="leading-relaxed">{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
