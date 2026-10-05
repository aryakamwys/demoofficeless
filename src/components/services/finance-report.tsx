"use client";

// Tabel klaim APPROVED (siap dibayar finance) + ekspor Excel / PDF (print).
import { useMemo } from "react";
import dayjs from "dayjs";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export interface FinanceClaimRow {
  id: string;
  period: string;
  employee_name: string;
  trip_count: number;
  total_amount: number;
  approved_at: string | null;
}

const HEADERS = ["Karyawan", "Periode", "Jumlah Trip", "Total (Rp)", "Disetujui"];

export function FinanceReport({ claims }: { claims: FinanceClaimRow[] }) {
  const total = useMemo(() => claims.reduce((s, c) => s + Number(c.total_amount || 0), 0), [claims]);

  const matrix = () =>
    claims.map((c) => [
      c.employee_name,
      c.period,
      String(c.trip_count),
      String(c.total_amount),
      c.approved_at ? dayjs(c.approved_at).format("DD/MM/YYYY HH:mm") : "-",
    ]);

  const exportExcel = async () => {
    if (!claims.length) return toast.error("Tidak ada data untuk diekspor");
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet([
        HEADERS,
        ...matrix(),
        ["", "", "TOTAL", String(total)],
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Klaim Disetujui");
      XLSX.writeFile(wb, `finance-klaim-disetujui-${dayjs().format("YYYYMMDD-HHmm")}.xlsx`);
      toast.success("Excel berhasil diunduh");
    } catch {
      toast.error("Gagal membuat Excel");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 print:hidden">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Klaim siap dibayar</p>
            <p className="mt-1 text-2xl font-semibold text-slate-800">{claims.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total nominal</p>
            <p className="mt-1 text-2xl font-semibold text-slate-800">
              Rp {total.toLocaleString("id-ID")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={exportExcel}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <FileText className="mr-2 h-4 w-4" /> PDF
        </Button>
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
                {claims.length === 0 ? (
                  <tr>
                    <td colSpan={HEADERS.length} className="py-8 text-center text-slate-500">
                      Belum ada klaim yang disetujui.
                    </td>
                  </tr>
                ) : (
                  claims.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-medium">{c.employee_name}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{c.period}</td>
                      <td className="px-3 py-2.5">{c.trip_count}</td>
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                        Rp {Number(c.total_amount).toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                        {c.approved_at ? dayjs(c.approved_at).format("DD MMM YYYY HH:mm") : "—"}
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
