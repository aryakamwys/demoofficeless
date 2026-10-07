"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { ClaimWithEmployee, Upload } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { SendWADialog } from "@/components/claims/send-wa-dialog";
import { BulkSendDialog } from "@/components/claims/bulk-send-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/claims/status-badge";
import {
  Search,
  Send,
  Download,
  Loader2,
} from "lucide-react";

export default function ClaimsPage() {
  const [claims, setClaims] = useState<ClaimWithEmployee[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [periods, setPeriods] = useState<string[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  // Preselect dari ?upload_id= (tombol Claims di halaman Upload) via lazy init — bukan effect
  const [uploadFilter, setUploadFilter] = useState(() =>
    typeof window === "undefined"
      ? "ALL"
      : new URLSearchParams(window.location.search).get("upload_id") || "ALL"
  );
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce 300ms supaya tidak fetch tiap ketikan
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const [sendWADialogOpen, setSendWADialogOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ClaimWithEmployee | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Klaim siap blast massal: PENDING + ter-map karyawan + ada nomor WA.
  // Kirim ulang klaim lama (SENT) tetap manual per baris — blast tidak
  // boleh mengirim ulang ke karyawan yang sudah dapat pesannya.
  const bulkClaims = claims.filter(
    (c) => c.employee?.phone_number && c.status === "PENDING"
  );

  const fetchClaims = useCallback(async (opts?: { silent?: boolean }) => {
    // Batalkan request lama supaya respons stale tidak menimpa hasil baru
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    // Polling periodik memakai silent — tanpa skeleton/loading supaya tabel
    // tidak kedip dan tidak di-remount tiap 10 detik.
    if (!opts?.silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (periodFilter !== "ALL") params.set("period", periodFilter);
      if (uploadFilter !== "ALL") params.set("upload_id", uploadFilter);

      const res = await fetch(`/api/claims?${params}`, { signal: ctrl.signal });
      const result = await res.json();
      if (result.success) {
        // Identitas array dipertahankan saat data tidak berubah — React bails
        // out dan tabel 500 baris tidak re-render hanya karena polling.
        setClaims((prev) =>
          JSON.stringify(prev) === JSON.stringify(result.data) ? prev : result.data
        );
      }
    } catch {
      // AbortError diabaikan — request terbaru sudah berjalan
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [debouncedSearch, statusFilter, periodFilter, uploadFilter]);

  const fetchPeriods = useCallback(async () => {
    const res = await fetch("/api/claims?distinct_periods=true");
    const result = await res.json();
    if (result.success && result.data) {
      setPeriods(result.data);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount memang butuh setState di dalam effect (arsitektur client-side fetching).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchClaims();
  }, [fetchClaims]);

  // Update otomatis tiap 10 detik saat tab terlihat — status klaim berubah via
  // WhatsApp langsung kelihatan tanpa refresh browser. Silent: tanpa loading.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchClaims({ silent: true });
    }, 10000);
    return () => clearInterval(id);
  }, [fetchClaims]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPeriods();
  }, [fetchPeriods]);

  // Daftar statement untuk filter per-upload
  useEffect(() => {
    fetch("/api/upload")
      .then((r) => r.json())
      .then((result) => {
        if (result.success) setUploads(result.data);
      })
      .catch(() => {});
  }, []);

  const handleSendWA = (claim: ClaimWithEmployee) => {
    setSelectedClaim(claim);
    setSendWADialogOpen(true);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (periodFilter !== "ALL") params.set("period", periodFilter);
      if (uploadFilter !== "ALL") params.set("upload_id", uploadFilter);
      window.open(`/api/claims/export?${params}`, "_blank");
    } finally {
      setTimeout(() => setExporting(false), 1500);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari claim..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="NEED_REVIEW">Need Review</SelectItem>
              <SelectItem value="UNMATCHED">Unmatched</SelectItem>
            </SelectContent>
          </Select>

          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Period</SelectItem>
              {periods.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={uploadFilter} onValueChange={setUploadFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Statement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statement</SelectItem>
              {uploads.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.period} — {u.filename}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            className="bg-[#00B14F] text-white hover:bg-[#009040]"
            disabled={bulkClaims.length === 0}
            onClick={() => setBulkOpen(true)}
            title="Kirim WhatsApp ke semua klaim ter-map sekaligus"
          >
            <Send className="mr-2 h-4 w-4" />
            Kirim Semua ({bulkClaims.length})
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {/* Skeleton hanya saat load pertama — polling silent tidak mencabut tabel */}
          {loading && claims.length === 0 ? (
            <div className="p-0">
              {/* Skeleton table header */}
              <div className="border-b px-4 py-3 flex gap-6">
                {[100, 140, 100, 60, 80, 80, 60].map((w, i) => (
                  <Skeleton key={i} className="h-4" style={{ width: w }} />
                ))}
              </div>
              {/* Skeleton table rows */}
              {[1, 2, 3, 4, 5, 6].map((row) => (
                <div key={row} className="border-b px-4 py-4 flex gap-6 items-center">
                  {[100, 140, 100, 60, 80, 80, 60].map((w, i) => (
                    <Skeleton key={i} className="h-4" style={{ width: w }} />
                  ))}
                </div>
              ))}
            </div>
          ) : claims.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Belum ada data claims.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px] border-collapse">
                <thead>
                  <tr className="bg-white border-b-2 border-slate-200">
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">Date & Time (GMT+7)</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">Employee Name</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">Phone</th>
                    <th className="px-4 py-4 text-center font-semibold text-slate-600 whitespace-nowrap">Trips</th>
                    <th className="px-4 py-4 text-right font-semibold text-slate-600 whitespace-nowrap">Total Fare</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">Mgr Status</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">HR Status</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap">System Status</th>
                    <th className="px-4 py-4 text-left font-semibold text-slate-600 whitespace-nowrap w-24">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                      <td className="px-4 py-4 align-middle text-slate-500 text-xs">
                        {dayjs(claim.updated_at).format("DD MMM YYYY,")}
                        <br />
                        {dayjs(claim.updated_at).format("hh:mm:ss A")}
                      </td>
                      <td className="px-4 py-4 font-medium align-middle text-slate-800">
                        {claim.employee?.employee_name || "—"}
                      </td>
                      <td className="px-4 py-4 text-slate-500 align-middle">
                        {claim.employee?.phone_number || "—"}
                      </td>
                      <td className="px-4 py-4 text-center align-middle text-slate-600">
                        {claim.trip_count}
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-slate-800 align-middle">
                        IDR {claim.total_amount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <StatusBadge status={claim.manager_status as string} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <StatusBadge status={claim.hr_status as string} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <StatusBadge status={claim.status} />
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            asChild
                          >
                            <Link href={`/claims/${claim.id}`}>
                              Detail
                            </Link>
                          </Button>
                          {claim.employee &&
                            (claim.status === "PENDING" ||
                              claim.status === "SENT") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => handleSendWA(claim)}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Send
                              </Button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <SendWADialog
        open={sendWADialogOpen}
        onOpenChange={setSendWADialogOpen}
        claim={selectedClaim}
        onSuccess={fetchClaims}
      />

      <BulkSendDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        claims={bulkClaims}
        onDone={() => fetchClaims({ silent: true })}
      />
    </div>
  );
}
