"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, RefreshCw, Server } from "lucide-react";
import { toast } from "sonner";

export default function ServicesPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchServiceData = async () => {
    setLoading(true);
    try {
      // Hit internal API Route to securely fetch from Service Desk with Basic Auth
      const response = await fetch("/api/services");
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Gagal mengambil data");
      }

      setData(Array.isArray(result.data) ? result.data : [result.data]);
      toast.success("Berhasil mengambil data service desk");
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast.error(error.message || "Gagal mengambil data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchServiceData} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {loading ? "Fetching..." : "Get Data API"}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <Card className="min-h-[400px]">
        <CardHeader className="border-b bg-slate-50/50">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Server className="h-4 w-4 text-blue-600" />
            Service Desk Data
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-blue-600" />
              <p>Menghubungi server Service Desk...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <Server className="h-12 w-12 text-slate-200 mb-4" />
              <p>Belum ada data.</p>
              <p className="text-sm">Klik "Get Data API" untuk mengambil data dari Service Desk Perkom.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px] border-collapse">
                <thead>
                  <tr className="bg-white border-b-2 border-slate-200">
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">ID</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">Title</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">Priority</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">Status</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item: any, index: number) => (
                    <tr key={item.id || index} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                      <td className="px-4 py-4 align-middle text-slate-800 font-medium">
                        #{item.id || "—"}
                      </td>
                      <td className="px-4 py-4 align-middle text-slate-800 max-w-[300px] truncate">
                        {item.title || "—"}
                      </td>
                      <td className="px-4 py-4 align-middle text-slate-600">
                        {item.priority_id ? `Priority ${item.priority_id}` : "—"}
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          Status {item.status_id || "Unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle text-slate-500 text-xs">
                        {item.created_at ? new Date(item.created_at).toLocaleString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
