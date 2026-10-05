"use client";

// Tabel ticket EnvGate + ekspor PPT (pptxgenjs) / Excel (xlsx) / PDF (print).
// pptxgenjs & xlsx di-import dinamis saat tombol diklik — tidak membebani bundle awal.
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { EnvGateTicketRow } from "@/components/services/envgate-test";

const HEADERS = ["Ticket", "Judul", "Status", "Prioritas", "Requester", "Ditugaskan", "Helpdesk", "Dibuat"];

export function EnvGateReport({ tickets }: { tickets: EnvGateTicketRow[] }) {
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState("");

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return tickets;
    return tickets.filter((t) =>
      [t.pretty_id, t.title, t.status, t.priority, t.requester, t.assigned, t.category, t.helpdesk]
        .some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [tickets, filter]);

  const matrix = () =>
    filtered.map((t) => [
      t.pretty_id,
      t.title,
      t.status,
      t.priority,
      t.requester,
      t.assigned,
      t.helpdesk,
      t.created_at ? dayjs(t.created_at).format("DD/MM/YYYY HH:mm") : "-",
    ]);

  const exportPPT = async () => {
    if (!filtered.length) return toast.error("Tidak ada data untuk diekspor");
    setBusy("ppt");
    try {
      const { default: PptxGenJS } = await import("pptxgenjs");
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";

      const slide = pptx.addSlide();
      slide.addText("Report Ticket EnvGate", { x: 0.6, y: 1.6, w: 12, fontSize: 34, bold: true });
      slide.addText(
        `PT Perkom · ${filtered.length} ticket · dibuat ${dayjs().format("DD MMM YYYY HH:mm")}`,
        { x: 0.6, y: 2.5, w: 12, fontSize: 14, color: "666666" }
      );

      const header = HEADERS.map((h) => ({ text: h, options: { bold: true, fill: { color: "E8EDF4" } } }));
      const rows = matrix();
      const CHUNK = 12;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const s = pptx.addSlide();
        s.addTable([header, ...rows.slice(i, i + CHUNK).map((r) => r.map((c) => ({ text: String(c) })))], {
          x: 0.4, y: 0.4, w: 12.3, fontSize: 10, border: { pt: 0.5, color: "CCCCCC" },
        });
      }
      await pptx.writeFile({ fileName: `report-envgate-${dayjs().format("YYYYMMDD-HHmm")}.pptx` });
      toast.success("PPT berhasil diunduh");
    } catch {
      toast.error("Gagal membuat PPT");
    } finally {
      setBusy("");
    }
  };

  const exportExcel = async () => {
    if (!filtered.length) return toast.error("Tidak ada data untuk diekspor");
    setBusy("xlsx");
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...matrix()]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "EnvGate");
      XLSX.writeFile(wb, `report-envgate-${dayjs().format("YYYYMMDD-HHmm")}.xlsx`);
      toast.success("Excel berhasil diunduh");
    } catch {
      toast.error("Gagal membuat Excel");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Cari ticket / requester / status…"
          className="h-9 w-full max-w-xs"
        />
        <span className="text-xs text-slate-500">{filtered.length} ticket</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportPPT} disabled={busy !== ""}>
            <Presentation className="mr-2 h-4 w-4" /> {busy === "ppt" ? "Menyiapkan…" : "PPT"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={busy !== ""}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> {busy === "xlsx" ? "Menyiapkan…" : "Excel"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <Card className="print:border-slate-300">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-500">
                  {HEADERS.map((h) => (
                    <th key={h} className="px-3 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={HEADERS.length} className="py-8 text-center text-slate-500">
                      Tidak ada ticket yang cocok.
                    </td>
                  </tr>
                ) : (
                  filtered.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-medium text-blue-600 whitespace-nowrap">{t.pretty_id}</td>
                      <td className="px-3 py-2.5 max-w-[280px] truncate" title={t.title}>{t.title}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{t.status}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{t.priority}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{t.requester || "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{t.assigned || "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{t.helpdesk || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                        {t.created_at ? dayjs(t.created_at).format("DD MMM YYYY HH:mm") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
