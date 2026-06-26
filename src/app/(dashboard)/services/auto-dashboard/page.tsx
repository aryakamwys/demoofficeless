"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, Upload, FileSpreadsheet, Table2, PieChart, 
  TrendingUp, Hash, Loader2, X, Download
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type ChartType = "kpi" | "bar" | "pie" | "line" | "table";

interface DetectedColumn {
  name: string;
  type: "number" | "date" | "category" | "text";
  sample: any[];
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

function detectColumnType(values: any[]): "number" | "date" | "category" | "text" {
  const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== "");
  if (nonEmpty.length === 0) return "text";

  const numCount = nonEmpty.filter(v => !isNaN(Number(v))).length;
  if (numCount / nonEmpty.length > 0.8) return "number";

  const dateCount = nonEmpty.filter(v => {
    if (typeof v === "number") return false;
    const d = new Date(v);
    return !isNaN(d.getTime());
  }).length;
  if (dateCount / nonEmpty.length > 0.7) return "date";

  const unique = new Set(nonEmpty.map(String));
  if (unique.size <= Math.max(20, nonEmpty.length * 0.3)) return "category";

  return "text";
}

function autoDetectChart(columns: DetectedColumn[]): ChartType {
  const numCols = columns.filter(c => c.type === "number");
  const catCols = columns.filter(c => c.type === "category");
  const dateCols = columns.filter(c => c.type === "date");

  if (dateCols.length >= 1 && numCols.length >= 1) return "line";
  if (catCols.length >= 1 && numCols.length >= 1) return "bar";
  if (catCols.length >= 1 && numCols.length === 0) return "pie";
  if (numCols.length === 1 && columns.length <= 2) return "kpi";
  return "table";
}

// Simple chart components using pure CSS/SVG
function KPICard({ widget }: { widget: Widget }) {
  const values = widget.data.map(d => Number(d[widget.valueColumn || widget.columns[0]])).filter(n => !isNaN(n));
  const total = values.reduce((a, b) => a + b, 0);
  const avg = values.length ? total / values.length : 0;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-2">
      <div className="text-4xl font-bold text-blue-600">{total.toLocaleString()}</div>
      <div className="text-sm text-slate-500">Total</div>
      <div className="flex gap-6 mt-2 text-xs text-slate-400">
        <span>Avg: {avg.toFixed(1)}</span>
        <span>Count: {values.length}</span>
        <span>Min: {Math.min(...values).toLocaleString()}</span>
        <span>Max: {Math.max(...values).toLocaleString()}</span>
      </div>
    </div>
  );
}

function BarChartSimple({ widget }: { widget: Widget }) {
  const labelCol = widget.labelColumn || widget.columns.find(c => widget.data.length > 0 && isNaN(Number(widget.data[0][c]))) || widget.columns[0];
  const valueCol = widget.valueColumn || widget.columns.find(c => widget.data.length > 0 && !isNaN(Number(widget.data[0][c]))) || widget.columns[1];

  // Aggregate by label
  const aggregated: Record<string, number> = {};
  widget.data.forEach(row => {
    const label = String(row[labelCol] || "Unknown");
    const val = Number(row[valueCol]) || 0;
    aggregated[label] = (aggregated[label] || 0) + val;
  });

  const entries = Object.entries(aggregated).slice(0, 15);
  const maxVal = Math.max(...entries.map(([, v]) => v), 1);

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

  return (
    <div className="flex flex-col gap-2 h-full overflow-auto px-2 py-1">
      {entries.map(([label, value], i) => (
        <div key={label} className="flex items-center gap-2 text-xs">
          <div className="w-24 truncate text-right text-slate-600 shrink-0" title={label}>{label}</div>
          <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2 text-white text-[10px] font-medium"
              style={{ width: `${(value / maxVal) * 100}%`, backgroundColor: colors[i % colors.length], minWidth: "24px" }}
            >
              {value.toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PieChartSimple({ widget }: { widget: Widget }) {
  const labelCol = widget.labelColumn || widget.columns[0];
  const valueCol = widget.valueColumn || widget.columns.find(c => widget.data.length > 0 && !isNaN(Number(widget.data[0][c])));

  const aggregated: Record<string, number> = {};
  widget.data.forEach(row => {
    const label = String(row[labelCol] || "Unknown");
    if (valueCol) {
      aggregated[label] = (aggregated[label] || 0) + (Number(row[valueCol]) || 0);
    } else {
      aggregated[label] = (aggregated[label] || 0) + 1;
    }
  });

  const entries = Object.entries(aggregated).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"];

  let cumulative = 0;
  const slices = entries.map(([label, value], i) => {
    const pct = (value / total) * 100;
    const start = cumulative;
    cumulative += pct;
    return { label, value, pct, start, color: colors[i % colors.length] };
  });

  const gradientParts = slices.map(s => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(", ");

  return (
    <div className="flex items-center justify-center gap-6 h-full">
      <div 
        className="w-36 h-36 rounded-full shrink-0"
        style={{ background: `conic-gradient(${gradientParts})` }}
      />
      <div className="flex flex-col gap-1 text-xs overflow-auto max-h-full">
        {slices.map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-slate-600 truncate max-w-[120px]" title={s.label}>{s.label}</span>
            <span className="text-slate-400 ml-auto">{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChartSimple({ widget }: { widget: Widget }) {
  const valueCol = widget.valueColumn || widget.columns.find(c => widget.data.length > 0 && !isNaN(Number(widget.data[0][c]))) || widget.columns[1];
  const values = widget.data.map(d => Number(d[valueCol]) || 0).slice(0, 50);
  if (values.length === 0) return <div className="text-center text-slate-400 py-8">No data</div>;

  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;
  const w = 400;
  const h = 150;
  const step = w / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => `${i * step},${h - ((v - minVal) / range) * (h - 20) - 10}`);
  const polyline = points.join(" ");
  const areaPoints = `0,${h} ${polyline} ${(values.length - 1) * step},${h}`;

  return (
    <div className="flex items-center justify-center h-full p-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full max-h-[160px]">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill="url(#lineGrad)" />
        <polyline points={polyline} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((v, i) => (
          <circle key={i} cx={i * step} cy={h - ((v - minVal) / range) * (h - 20) - 10} r="3" fill="#3b82f6" />
        ))}
      </svg>
    </div>
  );
}

function DataTable({ widget }: { widget: Widget }) {
  const displayData = widget.data.slice(0, 50);
  const cols = widget.columns.slice(0, 8);

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            {cols.map(col => (
              <th key={col} className="px-2 py-1.5 text-left font-semibold text-slate-700 bg-slate-50 border-b border-slate-200 sticky top-0 whitespace-nowrap">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, i) => (
            <tr key={i} className="hover:bg-blue-50/30">
              {cols.map(col => (
                <td key={col} className="px-2 py-1 border-b border-slate-100 text-slate-600 whitespace-nowrap max-w-[200px] truncate">{String(row[col] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WidgetRenderer({ widget }: { widget: Widget }) {
  switch (widget.chartType) {
    case "kpi": return <KPICard widget={widget} />;
    case "bar": return <BarChartSimple widget={widget} />;
    case "pie": return <PieChartSimple widget={widget} />;
    case "line": return <LineChartSimple widget={widget} />;
    case "table": return <DataTable widget={widget} />;
    default: return <DataTable widget={widget} />;
  }
}

const chartTypeLabels: Record<ChartType, { icon: any; label: string }> = {
  kpi: { icon: Hash, label: "KPI Card" },
  bar: { icon: BarChart3, label: "Bar Chart" },
  pie: { icon: PieChart, label: "Pie Chart" },
  line: { icon: TrendingUp, label: "Line Chart" },
  table: { icon: Table2, label: "Table" },
};

export default function AutoDashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [columns, setColumns] = useState<DetectedColumn[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setLoading(true);
    try {
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: any[] = XLSX.utils.sheet_to_json(sheet);

      if (json.length === 0) {
        toast.error("File kosong atau format tidak dikenali");
        setLoading(false);
        return;
      }

      setRawData(json);

      // Detect columns
      const colNames = Object.keys(json[0]);
      const detected: DetectedColumn[] = colNames.map(name => ({
        name,
        type: detectColumnType(json.map(r => r[name])),
        sample: json.slice(0, 5).map(r => r[name]),
      }));
      setColumns(detected);

      // Auto-generate widgets
      const generatedWidgets: Widget[] = [];
      const numCols = detected.filter(c => c.type === "number");
      const catCols = detected.filter(c => c.type === "category");
      const dateCols = detected.filter(c => c.type === "date");

      // KPI for each numeric column
      numCols.slice(0, 3).forEach(nc => {
        generatedWidgets.push({
          id: `kpi-${nc.name}`,
          title: nc.name,
          chartType: "kpi",
          data: json,
          columns: [nc.name],
          valueColumn: nc.name,
        });
      });

      // Bar chart: category + number
      if (catCols.length > 0 && numCols.length > 0) {
        generatedWidgets.push({
          id: `bar-${catCols[0].name}-${numCols[0].name}`,
          title: `${numCols[0].name} by ${catCols[0].name}`,
          chartType: "bar",
          data: json,
          columns: [catCols[0].name, numCols[0].name],
          labelColumn: catCols[0].name,
          valueColumn: numCols[0].name,
        });
      }

      // Pie chart: category distribution
      if (catCols.length > 0) {
        generatedWidgets.push({
          id: `pie-${catCols[0].name}`,
          title: `${catCols[0].name} Distribution`,
          chartType: "pie",
          data: json,
          columns: [catCols[0].name, ...(numCols.length > 0 ? [numCols[0].name] : [])],
          labelColumn: catCols[0].name,
          valueColumn: numCols.length > 0 ? numCols[0].name : undefined,
        });
      }

      // Line chart: date + number
      if (dateCols.length > 0 && numCols.length > 0) {
        generatedWidgets.push({
          id: `line-${dateCols[0].name}-${numCols[0].name}`,
          title: `${numCols[0].name} over ${dateCols[0].name}`,
          chartType: "line",
          data: json,
          columns: [dateCols[0].name, numCols[0].name],
          valueColumn: numCols[0].name,
        });
      }

      // Second bar chart if more categories
      if (catCols.length > 1 && numCols.length > 0) {
        generatedWidgets.push({
          id: `bar-${catCols[1].name}-${numCols[0].name}`,
          title: `${numCols[0].name} by ${catCols[1].name}`,
          chartType: "bar",
          data: json,
          columns: [catCols[1].name, numCols[0].name],
          labelColumn: catCols[1].name,
          valueColumn: numCols[0].name,
        });
      }

      // Always add a data table
      generatedWidgets.push({
        id: "table-all",
        title: "Data Table",
        chartType: "table",
        data: json,
        columns: colNames,
      });

      setWidgets(generatedWidgets);
      toast.success(`${json.length} baris data berhasil diproses dari ${colNames.length} kolom`);
    } catch (error: any) {
      console.error("Parse error:", error);
      toast.error("Gagal membaca file: " + (error.message || "Format tidak didukung"));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const changeChartType = (widgetId: string, newType: ChartType) => {
    setWidgets(prev => prev.map(w => w.id === widgetId ? { ...w, chartType: newType } : w));
  };

  const removeWidget = (widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
  };

  const resetDashboard = () => {
    setFile(null);
    setRawData([]);
    setColumns([]);
    setWidgets([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Auto Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Upload file Excel/CSV, otomatis jadi dashboard</p>
        </div>
        {file && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetDashboard}>
              <Upload className="h-4 w-4 mr-2" /> Upload Baru
            </Button>
          </div>
        )}
      </div>

      {/* Upload Area */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer ${
            isDragging 
              ? "border-blue-500 bg-blue-50/50 scale-[1.01]" 
              : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50"
          }`}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input 
            id="file-input" 
            type="file" 
            accept=".xlsx,.xls,.csv,.xlsm"
            className="hidden" 
            onChange={handleFileInput}
          />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
              <p className="text-slate-600 font-medium">Memproses file...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <FileSpreadsheet className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-700">Drop file di sini atau klik untuk upload</p>
                <p className="text-sm text-slate-400 mt-1">XLSX, XLS, CSV, XLSM</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* File Info */}
      {file && columns.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                <div>
                  <span className="font-medium text-slate-800">{file.name}</span>
                  <span className="text-sm text-slate-500 ml-3">{rawData.length} baris · {columns.length} kolom</span>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {columns.map(col => (
                  <span key={col.name} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    col.type === "number" ? "bg-emerald-100 text-emerald-700" :
                    col.type === "date" ? "bg-amber-100 text-amber-700" :
                    col.type === "category" ? "bg-blue-100 text-blue-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {col.name}: {col.type}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Widgets Grid */}
      {widgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {widgets.map(widget => {
            const isLargeWidget = widget.chartType === "table" || widget.chartType === "line";
            return (
              <Card 
                key={widget.id} 
                className={`overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-shadow ${
                  isLargeWidget ? "md:col-span-2 xl:col-span-3" : ""
                }`}
              >
                <CardHeader className="py-2.5 px-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-slate-700">{widget.title}</CardTitle>
                    <div className="flex items-center gap-1">
                      {(Object.keys(chartTypeLabels) as ChartType[]).map(type => {
                        const { icon: Icon, label } = chartTypeLabels[type];
                        return (
                          <button
                            key={type}
                            onClick={() => changeChartType(widget.id, type)}
                            title={label}
                            className={`p-1 rounded transition-colors ${
                              widget.chartType === type 
                                ? "bg-blue-100 text-blue-600" 
                                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </button>
                        );
                      })}
                      <button onClick={() => removeWidget(widget.id)} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 ml-1">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={`p-4 ${isLargeWidget ? "h-[300px]" : "h-[220px]"}`}>
                  <WidgetRenderer widget={widget} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
