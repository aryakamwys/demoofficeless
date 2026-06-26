"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";

export default function ManagedServiceClaimsHRPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/claims/managed-service");
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        toast.error(result.error || "Gagal memuat data klaim");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  const downloadCSV = () => {
    if (data.length === 0) {
      toast.error("Tidak ada data untuk di-download");
      return;
    }

    const headers = ["Ticket ID", "Subject", "Customer Name", "Location", "Amount (Rp)", "File URL", "Status", "Date"];
    const rows = data.map(item => [
      item.ticket_id,
      `"${(item.ticket_title || "").replace(/"/g, '""')}"`,
      `"${(item.customer_name || "").replace(/"/g, '""')}"`,
      `"${(item.location || "").replace(/"/g, '""')}"`,
      item.amount,
      item.file_url,
      item.status,
      dayjs(item.created_at).format("YYYY-MM-DD HH:mm:ss")
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "managed_service_claims.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Klaim Transport Managed Service (HR)</h1>
        <Button variant="outline" onClick={downloadCSV}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Ticket ID</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Amount (Rp)</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Tanggal Upload</th>
                  <th className="px-4 py-3 font-medium">Bukti File</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-500">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                      Memuat data...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500">
                      Belum ada klaim yang diunggah.
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-blue-600">#{item.ticket_id}</td>
                      <td className="px-4 py-3 max-w-[300px] truncate" title={item.ticket_title}>{item.ticket_title || "—"}</td>
                      <td className="px-4 py-3 font-medium">Rp {Number(item.amount).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 uppercase">
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {dayjs(item.created_at).format("DD MMM YYYY, HH:mm")}
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={item.file_url} target="_blank" rel="noopener noreferrer">
                            <FileText className="h-4 w-4 mr-2" />
                            Lihat File
                          </a>
                        </Button>
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
