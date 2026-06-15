"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, RefreshCw, Server, Download, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ServicesPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [hasFetched, setHasFetched] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");

  const fetchServiceData = async () => {
    setLoading(true);
    setHasFetched(false);
    try {
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

  const parseDate = (dateVal: any) => {
    if (!dateVal) return null;
    let val = dateVal;
    if (/^\d+$/.test(val)) {
      const num = parseInt(val);
      val = num > 9999999999 ? num : num * 1000;
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };

  const filteredData = useMemo(() => {
    let filtered = data;

    // Filter by Date
    if (dateFilter !== "all") {
      const now = new Date();
      filtered = filtered.filter(item => {
        const d = parseDate(item.created_at);
        if (!d) return false;
        
        if (dateFilter === "today") {
          return d.toDateString() === now.toDateString();
        }
        if (dateFilter === "week") {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return d >= oneWeekAgo;
        }
        if (dateFilter === "month") {
          const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return d >= oneMonthAgo;
        }
        return true;
      });
    }

    // Filter by Search
    if (search) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(item => 
        (item.title && item.title.toLowerCase().includes(lowerSearch)) ||
        (item.id && String(item.id).includes(lowerSearch))
      );
    }

    return filtered;
  }, [data, search, dateFilter]);

  const downloadCSV = () => {
    if (filteredData.length === 0) {
      toast.error("Tidak ada data untuk di-download");
      return;
    }

    const headers = ["ID", "Subject", "Category ID", "Assigned Help desk ID", "Agent ID", "Creation date"];
    const rows = filteredData.map(item => {
      const d = parseDate(item.created_at);
      const dateStr = d ? d.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "";
      
      return [
        item.id || "",
        `"${(item.title || "").replace(/"/g, '""')}"`,
        item.category_id || "",
        item.assigned_group_id || "",
        item.assigned_id || "",
        `"${dateStr}"`
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "requests.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[180px]">
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Date filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Date: All Time</SelectItem>
              <SelectItem value="today">Date: Today</SelectItem>
              <SelectItem value="week">Date: This week</SelectItem>
              <SelectItem value="month">Date: This month</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={downloadCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>

          <Button onClick={fetchServiceData} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
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
        <CardHeader className="border-b bg-slate-50/50 flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Server className="h-4 w-4 text-blue-600" />
            Requests
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            Show {filteredData.length} entries
          </div>
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
              <p>{hasFetched ? "Tidak ada tiket request saat ini." : "Belum ada data."}</p>
              <p className="text-sm">
                {hasFetched 
                  ? "API berhasil dipanggil, namun response list kosong." 
                  : "Klik \"Get Data API\" untuk mengambil data dari Service Desk Perkom."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px] border-collapse">
                <thead>
                  <tr className="bg-white border-b-2 border-slate-200">
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap w-[80px]">ID</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap min-w-[200px]">Subject</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">Category</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">Assigned Help desk</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">Agent</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">Creation date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item: any, index: number) => {
                    const d = parseDate(item.created_at);
                    const dateStr = d ? d.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "—";
                    
                    return (
                      <tr key={item.id || index} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                        <td className="px-4 py-4 align-middle text-blue-600 font-medium cursor-pointer hover:underline">
                          {item.id || "—"}
                        </td>
                        <td className="px-4 py-4 align-middle text-slate-800">
                          {item.title || "—"}
                        </td>
                        <td className="px-4 py-4 align-middle text-slate-600">
                          {item.category_id ? `Category ID: ${item.category_id}` : "—"}
                        </td>
                        <td className="px-4 py-4 align-middle text-slate-600">
                          {item.assigned_group_id ? `Helpdesk ID: ${item.assigned_group_id}` : "—"}
                        </td>
                        <td className="px-4 py-4 align-middle text-slate-600">
                          {item.assigned_id ? `Agent ID: ${item.assigned_id}` : "—"}
                        </td>
                        <td className="px-4 py-4 align-middle text-slate-500 text-xs">
                          {dateStr}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        Tidak ada data yang sesuai dengan filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
