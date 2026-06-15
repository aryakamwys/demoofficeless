"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ClaimWithEmployee } from "@/types";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/claims/status-badge";
import {
  Search,
  Eye,
  Send,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function ClaimsPage() {
  const [claims, setClaims] = useState<ClaimWithEmployee[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [periods, setPeriods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (periodFilter !== "ALL") params.set("period", periodFilter);

      const res = await fetch(`/api/claims?${params}`);
      const result = await res.json();
      if (result.success) {
        setClaims(result.data);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, periodFilter]);

  const fetchPeriods = useCallback(async () => {
    const res = await fetch("/api/claims?distinct_periods=true");
    const result = await res.json();
    if (result.success && result.data) {
      setPeriods(result.data);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  const handleSendWA = async (claimId: string) => {
    setSendingId(claimId);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: claimId }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("WhatsApp berhasil dikirim");
        fetchClaims();
      } else {
        toast.error(result.error || "Gagal mengirim WhatsApp");
      }
    } finally {
      setSendingId(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (periodFilter !== "ALL") params.set("period", periodFilter);
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
        </div>

        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Trips</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">
                      {claim.employee?.employee_name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {claim.employee?.phone_number || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {claim.trip_count}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      Rp{claim.total_amount.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={claim.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          asChild
                        >
                          <Link href={`/claims/${claim.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {claim.employee &&
                          (claim.status === "PENDING" ||
                            claim.status === "SENT") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={sendingId === claim.id}
                              onClick={() => handleSendWA(claim.id)}
                            >
                              {sendingId === claim.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
