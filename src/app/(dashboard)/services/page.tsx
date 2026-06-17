"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, RefreshCw, Download, Calendar as CalendarIcon, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ServicesPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [hasFetched, setHasFetched] = useState(false);
  const [dateFilter, setDateFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

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
      setCurrentPage(1);
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

    if (search) {
      const lowerSearch = search.toLowerCase();
      filtered = filtered.filter(item => 
        (item.title && item.title.toLowerCase().includes(lowerSearch)) ||
        (item.id && String(item.id).includes(lowerSearch))
      );
    }

    return filtered;
  }, [data, search, dateFilter]);

  // Pagination Logic
  const totalEntries = filteredData.length;
  const totalPages = Math.ceil(totalEntries / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const downloadCSV = () => {
    if (filteredData.length === 0) {
      toast.error("Tidak ada data untuk di-download");
      return;
    }

    const headers = ["ID", "Subject", "Category ID", "Assigned Help desk ID", "Agent First Name", "Agent Last Name", "Creation date"];
    const rows = filteredData.map(item => {
      const d = parseDate(item.created_at);
      const dateStr = d ? d.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : "";
      
      return [
        item.id || "",
        `"${(item.title || "").replace(/"/g, '""')}"`,
        item.category_id || "",
        item.assigned_group_id || "",
        item.assigned_id || "",
        "", // Last name (We only have Agent ID for now)
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

  const TableHeader = ({ title }: { title: string }) => (
    <th className="px-3 py-3 text-left font-semibold text-slate-700 whitespace-nowrap border border-slate-300 bg-slate-100">
      <div className="flex items-center justify-between gap-2">
        <span>{title}</span>
        <ChevronsUpDown className="h-3 w-3 text-slate-400" />
      </div>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Top Filter Bar - Matches screenshot top area */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-md border border-slate-200 shadow-sm">
        <div className="flex gap-2">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px] h-9 bg-slate-50 border-slate-300">
              <SelectValue placeholder="Date filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Date: All</SelectItem>
              <SelectItem value="today">Date: Today</SelectItem>
              <SelectItem value="week">Date: This week</SelectItem>
              <SelectItem value="month">Date: This month</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={downloadCSV} className="h-9 border-slate-300 bg-slate-50">
            Export
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-600 flex items-center gap-2">
            From <div className="border border-slate-300 bg-slate-50 rounded px-2 py-1 h-9 flex items-center min-w-[120px] text-muted-foreground"><CalendarIcon className="mr-2 h-4 w-4" /> 2026-06-14</div>
            To <div className="border border-slate-300 bg-slate-50 rounded px-2 py-1 h-9 flex items-center min-w-[120px] text-muted-foreground"><CalendarIcon className="mr-2 h-4 w-4" /> 2026-06-20</div>
          </div>
          <Button onClick={fetchServiceData} disabled={loading} variant="outline" size="sm" className="h-9 border-slate-300">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border-slate-200 border rounded-sm">
        <div className="p-4 flex flex-col">
          {/* Table Controls */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center text-xs text-slate-700">
              <span>Show</span>
              <select 
                className="mx-2 border border-slate-300 rounded-sm p-1 text-xs"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>entries</span>
            </div>
            <div className="flex items-center text-xs text-slate-700">
              <span className="mr-2">Search:</span>
              <Input
                className="w-[180px] h-7 rounded-sm border-slate-300 focus-visible:ring-0 text-xs"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto w-full border border-slate-300">
            <table className="w-full text-[11px] min-w-[1200px] border-collapse bg-white">
              <thead>
                <tr>
                  <TableHeader title="ID" />
                  <TableHeader title="Subject" />
                  <TableHeader title="Category" />
                  <TableHeader title="Assigned Help desk" />
                  <TableHeader title="Agent First Name" />
                  <TableHeader title="Agent Last Name" />
                  <TableHeader title="Creation date" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-500 border border-slate-200">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading...
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500 border border-slate-200">
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((item: any, index: number) => {
                    const d = parseDate(item.created_at);
                    const dateStr = d ? d.toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(',', '') : "—";
                    
                    return (
                      <tr key={item.id || index} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-2 py-2 align-middle text-blue-600 font-medium bg-blue-100/50 border border-slate-200 w-[60px]">
                          {item.id || "—"}
                        </td>
                        <td className="px-2 py-2 align-middle text-blue-500 font-medium cursor-pointer border border-slate-200">
                          {item.title || "—"}
                        </td>
                        <td className="px-2 py-2 align-middle text-slate-700 border border-slate-200">
                          {item.category_id ? `Category > ${item.category_id}` : "—"}
                        </td>
                        <td className="px-2 py-2 align-middle text-slate-700 border border-slate-200">
                          {item.assigned_group_id ? `Helpdesk Level ${item.assigned_group_id}` : "—"}
                        </td>
                        <td className="px-2 py-2 align-middle text-slate-700 border border-slate-200">
                          {item.assigned_user?.first_name || item.assigned_id || "—"}
                        </td>
                        <td className="px-2 py-2 align-middle text-slate-700 border border-slate-200">
                          {item.assigned_user?.last_name || ""}
                        </td>
                        <td className="px-2 py-2 align-middle text-slate-700 border border-slate-200 w-[140px]">
                          {dateStr}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {!loading && (
            <div className="flex justify-between items-center mt-3 text-[11px] text-slate-600">
              <div>
                Showing {totalEntries === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalEntries)} of {totalEntries} entries
              </div>
              <div className="flex items-center gap-0">
                <button 
                  onClick={() => setCurrentPage(1)} 
                  disabled={currentPage === 1}
                  className="px-2 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-slate-500"
                >
                  First
                </button>
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                  disabled={currentPage === 1}
                  className="px-2 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-slate-500"
                >
                  Previous
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = currentPage;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 font-medium ${currentPage === pageNum ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                  disabled={currentPage === totalPages}
                  className="px-2 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-slate-500"
                >
                  Next
                </button>
                <button 
                  onClick={() => setCurrentPage(totalPages)} 
                  disabled={currentPage === totalPages}
                  className="px-2 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-slate-500"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
