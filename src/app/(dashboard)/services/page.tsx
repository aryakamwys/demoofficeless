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
      // Endpoint dari referensi user: https://servicedesk.perkom.co.id/api/v1/
      // Jika terjadi CORS, disarankan memanggilnya melalui Next.js API Route
      const response = await fetch("https://servicedesk.perkom.co.id/api/v1/", {
        method: "GET",
        headers: {
          "Accept": "application/json",
          // "Authorization": "Bearer YOUR_TOKEN" // Tambahkan jika butuh auth
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      // Asumsi API mengembalikan array di result.data atau result langsung
      setData(Array.isArray(result) ? result : result.data || []);
      toast.success("Berhasil mengambil data service desk");
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Gagal mengambil data. Pastikan jaringan terhubung ke VPN Perkom jika ini API internal.");
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
            <div className="overflow-x-auto p-4">
              <pre className="text-sm bg-slate-50 p-4 rounded-lg border overflow-auto max-h-[500px]">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
