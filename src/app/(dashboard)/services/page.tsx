"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, RefreshCw, Server, PieChart } from "lucide-react";
import { toast } from "sonner";

export default function ServicesPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [hasFetched, setHasFetched] = useState(false);

  const fetchServiceData = async () => {
    setLoading(true);
    setHasFetched(false);
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
      setHasFetched(true);
      toast.success("Berhasil mengambil data service desk");
    } catch (error: any) {
      console.error("Fetch error:", error);
      toast.error(error.message || "Gagal mengambil data.");
    } finally {
      setLoading(false);
    }
  };

  const mapping = useMemo(() => {
    if (!data || data.length === 0) return null;

    const grouped: Record<string, Record<string, number>> = {};
    
    data.forEach(item => {
      let month = "Unknown Date";
      if (item.created_at) {
        let dateVal = item.created_at;
        if (/^\d+$/.test(dateVal)) {
          const num = parseInt(dateVal);
          dateVal = num > 9999999999 ? num : num * 1000;
        }
        
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          month = d.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
        }
      }
      
      const cat = item.category_id ? `Category ID: ${item.category_id}` : "Uncategorized";
      
      if (!grouped[month]) grouped[month] = {};
      if (!grouped[month][cat]) grouped[month][cat] = 0;
      grouped[month][cat]++;
    });

    return grouped;
  }, [data]);

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

      {mapping && Object.keys(mapping).length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b bg-slate-50/50 pb-4 py-4">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base font-semibold text-slate-800">Mapping Kategori per Bulan</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(mapping).map(([month, categories]) => (
                <div key={month} className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
                  <h3 className="font-semibold text-slate-800 mb-3 border-b border-slate-100 pb-2">{month}</h3>
                  <div className="space-y-2">
                    {Object.entries(categories).map(([cat, count]) => (
                      <div key={cat} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">{cat}</span>
                        <span className="bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded-full text-xs">
                          {count} tiket
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
              <p>{hasFetched ? "Tidak ada tiket (incident) yang Open saat ini." : "Belum ada data."}</p>
              <p className="text-sm">
                {hasFetched 
                  ? "API berhasil dipanggil, namun response list kosong." 
                  : "Klik \"Get Data API\" untuk mengambil data dari Service Desk Perkom."}
              </p>
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
