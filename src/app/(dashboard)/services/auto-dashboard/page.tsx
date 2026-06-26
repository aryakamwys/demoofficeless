"use client";

import { useCallback, useState } from "react";
import { FileUp, Loader2, Play } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useDashboardStore, DetectedColumn } from "@/store/dashboard-store";
import DarkFixedDashboard from '@/components/dashboard/DarkFixedDashboard';

function detectColumnType(values: any[]): "number" | "date" | "category" | "text" {
  const nonEmpty = values.filter(v => v != null && v !== "");
  if (nonEmpty.length === 0) return "text";
  if (nonEmpty.filter(v => !isNaN(Number(v))).length / nonEmpty.length > 0.8) return "number";
  if (nonEmpty.filter(v => typeof v !== "number" && !isNaN(new Date(v).getTime())).length / nonEmpty.length > 0.7) return "date";
  if (new Set(nonEmpty.map(String)).size <= Math.max(20, nonEmpty.length * 0.3)) return "category";
  return "text";
}

export default function AutoDashboardPage() {
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const store = useDashboardStore();

  const processFile = useCallback(async (f: File) => {
    setLoading(true);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const json: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      if (!json.length) { toast.error("File kosong"); setLoading(false); return; }

      const colNames = Object.keys(json[0]);
      const detected: DetectedColumn[] = colNames.map(name => ({
        name,
        type: detectColumnType(json.map(r => r[name])),
      }));

      // Calculate initial variables
      const vars: Record<string, any> = {
        TotalRows: json.length,
        TotalColumns: colNames.length,
      };
      
      detected.filter(c => c.type === 'number').forEach(c => {
        const sum = json.reduce((acc, row) => acc + (Number(row[c.name]) || 0), 0);
        vars[`Total_${c.name.replace(/\s+/g, '')}`] = sum;
      });

      store.setFileData(f, json, detected);
      store.updateVariables(vars);
      
      // Auto-generate first slide (Executive Summary)
      const slideId = "slide-1";
      const initialWidgets: Record<string, any> = {};
      const initialLayout: any[] = [];
      
      let currentY = 0;

      // 1. Executive Summary Text Widget
      const textId = "widget-text-1";
      initialWidgets[textId] = {
        id: textId, type: "text", title: "Executive Summary",
        content: `<p>Based on the dataset, we analyzed <strong>{{TotalRows}}</strong> records across <strong>{{TotalColumns}}</strong> columns.</p>`
      };
      initialLayout.push({ i: textId, x: 0, y: currentY, w: 12, h: 3 });
      currentY += 3;

      // 2. KPI Cards
      // 2. Generate Top Row (KPIs + Gauge)
      const numCols = detected.filter(c => c.type === 'number');
      let currentX = 0;
      
      // Top row KPIs
      numCols.slice(0, 3).forEach((col, idx) => {
        const kpiId = `widget-kpi-${idx}`;
        initialWidgets[kpiId] = {
          id: kpiId, type: "kpi", title: col.name, valueColumn: col.name
        };
        initialLayout.push({ i: kpiId, x: currentX, y: currentY, w: 3, h: 4 });
        currentX += 3;
      });

      // Gauge chart
      if (numCols.length > 3) {
        const gaugeId = "widget-gauge-1";
        initialWidgets[gaugeId] = {
          id: gaugeId, type: "gauge", title: numCols[3].name + ' Score', valueColumn: numCols[3].name
        };
        initialLayout.push({ i: gaugeId, x: currentX, y: currentY, w: 3, h: 4 });
      }

      currentY += 4;

      // 3. Bottom Row (Line Chart + Table)
      const catCols = detected.filter(c => c.type === 'category' || c.type === 'text');
      if (catCols.length > 0 && numCols.length > 0) {
        const chartId = "widget-line-1";
        initialWidgets[chartId] = {
          id: chartId, type: "line", title: `${numCols[0].name} Trend`,
          labelColumn: catCols[0].name, valueColumn: numCols[0].name
        };
        initialLayout.push({ i: chartId, x: 0, y: currentY, w: 8, h: 8 });

        const tableId = "widget-table-1";
        initialWidgets[tableId] = {
          id: tableId, type: "table", title: "Data Overview"
        };
        initialLayout.push({ i: tableId, x: 8, y: currentY, w: 4, h: 8 });
      }

      store.addSlide({ id: slideId, title: "Executive Summary", layout: initialLayout, widgets: initialWidgets });
      
      toast.success("Dataset berhasil diunggah!");
    } catch (e: any) {
      toast.error("Gagal membaca file: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  }, [store]);

  const onDrop = useCallback((e: React.DragEvent) => { 
    e.preventDefault(); 
    setDragging(false); 
    const f = e.dataTransfer.files[0]; 
    if (f) processFile(f); 
  }, [processFile]);
  
  const onInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { 
    const f = e.target.files?.[0]; 
    if (f) processFile(f); 
  }, [processFile]);

  if (presentationMode) {
     return <div className="fixed inset-0 z-50 bg-slate-900 text-white flex items-center justify-center">Presentation Mode (Coming soon) <button onClick={() => setPresentationMode(false)} className="absolute top-4 right-4 p-2 bg-white/10 rounded">Exit</button></div>
  }

  if (!store.file) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Studio</h1>
          <p className="text-slate-500 mt-1">Ubah dataset menjadi dashboard & presentasi profesional.</p>
        </div>
        
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById("auto-dash-file")?.click()}
          className={`w-full max-w-lg rounded-xl border-2 border-dashed p-16 text-center cursor-pointer transition-colors ${
            dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-slate-400 bg-white"
          }`}
        >
          <input id="auto-dash-file" type="file" accept=".xlsx,.xls,.csv,.xlsm" className="hidden" onChange={onInput} />
          {loading ? (
            <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto" />
          ) : (
            <>
              <FileUp className="h-12 w-12 text-blue-500 mx-auto mb-4 opacity-80" />
              <p className="text-lg font-medium text-slate-700">Drop dataset di sini</p>
              <p className="text-sm text-slate-400 mt-2">Format yang didukung: XLSX, CSV, XLS</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return <DarkFixedDashboard />;
}
