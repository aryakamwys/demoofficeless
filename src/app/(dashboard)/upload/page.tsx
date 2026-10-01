"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload as UploadIcon, Loader2, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Upload } from "@/types";
import dayjs from "dayjs";

const months = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export default function UploadPage() {
  // Default: bulan berjalan (index month dayjs = 0-11)
  const [period, setPeriod] = useState(
    () => `${months[dayjs().month()]} ${dayjs().year()}`
  );
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Tahun terbaru dulu, bulan terbaru dulu dalam tiap tahun
  const years = [dayjs().year() + 1, dayjs().year(), dayjs().year() - 1];

  const fetchUploads = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/upload");
      const result = await res.json();
      if (result.success) {
        setUploads(result.data);
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount memang butuh setState di dalam effect (arsitektur client-side fetching).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUploads();
  }, [fetchUploads]);

  // Hard delete: file di storage + baris upload (claims/trips ikut cascade)
  const handleDeleteUpload = async (id: string, filename: string) => {
    if (
      !confirm(
        `Hapus "${filename}"?\n\nFile di server storage dan SEMUA claim dari statement ini ikut terhapus permanen.`
      )
    )
      return;

    const res = await fetch(`/api/upload/${id}`, { method: "DELETE" });
    const result = await res.json();
    if (result.success) {
      toast.success("Upload dihapus beserta file dan claims-nya");
      fetchUploads();
    } else {
      toast.error(result.error || "Gagal menghapus upload");
    }
  };

  const handleUpload = async () => {
    if (!period || !file) {
      toast.error("Pilih periode dan file terlebih dahulu");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("period", period);
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!result.success) {
        toast.error(result.error || "Gagal upload");
        return;
      }

      toast.success("File berhasil diupload. Memproses...");
      setFile(null);

      // Process the uploaded file
      const processRes = await fetch("/api/upload/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: result.data.id }),
      });

      const processResult = await processRes.json();

      if (processResult.success) {
        const skipped: string[] = processResult.data?.skipped_duplicate || [];
        const skippedNote = skipped.length
          ? ` (${skipped.length} dilewati — sudah ada klaim periode ini: ${skipped.slice(0, 5).join(", ")}${skipped.length > 5 ? ", dst." : ""})`
          : "";
        toast.success(
          `${processResult.data.claims_created} claims berhasil dibuat${skippedNote}`
        );
      } else {
        toast.error(processResult.error || "Gagal memproses file");
      }

      fetchUploads();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Grab Statement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Periode</label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih periode" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectGroup key={year}>
                      <SelectLabel className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {year}
                      </SelectLabel>
                      {months
                        .map((month, idx) => ({ month, idx }))
                        .reverse()
                        .map(({ month, idx }) => (
                          <SelectItem
                            key={`${year}-${idx}`}
                            value={`${month} ${year}`}
                          >
                            {month}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">File</label>
              <Input
                type="file"
                accept=".csv,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
            </div>
          </div>

          <Button onClick={handleUpload} disabled={loading || !period || !file}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadIcon className="mr-2 h-4 w-4" />
            )}
            {loading ? "Uploading & Processing..." : "Upload & Process"}
          </Button>
        </CardContent>
      </Card>

      {/* Upload History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload History</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((row) => (
                <div key={row} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-10" />
                </div>
              ))}
            </div>
          ) : uploads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Belum ada riwayat upload.
            </p>
          ) : (
            <div className="space-y-2">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{upload.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {upload.period} — {dayjs(upload.created_at).format("DD MMM YYYY HH:mm")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline text-xs text-muted-foreground uppercase">
                      {upload.file_type}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/claims?upload_id=${upload.id}`}>
                        <FileText className="mr-2 h-4 w-4" />
                        Claims
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:text-red-600"
                      title="Hapus upload (hard delete: file + claims)"
                      onClick={() => handleDeleteUpload(upload.id, upload.filename)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
