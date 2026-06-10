"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload as UploadIcon, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Upload } from "@/types";
import dayjs from "dayjs";

const months = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export default function UploadPage() {
  const [period, setPeriod] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);

  const currentYear = dayjs().year();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const fetchUploads = useCallback(async () => {
    const res = await fetch("/api/upload");
    const result = await res.json();
    if (result.success) {
      setUploads(result.data);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

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
        toast.success(
          `${processResult.data.claims_created} claims berhasil dibuat`
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
                  {years.map((year) =>
                    months.map((month, idx) => (
                      <SelectItem
                        key={`${year}-${idx}`}
                        value={`${month} ${year}`}
                      >
                        {month} {year}
                      </SelectItem>
                    ))
                  )}
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

          {file && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}

          <Button onClick={handleUpload} disabled={loading || !period || !file}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadIcon className="mr-2 h-4 w-4" />
            )}
            Upload & Process
          </Button>
        </CardContent>
      </Card>

      {/* Upload History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload History</CardTitle>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
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
                  <span className="text-xs text-muted-foreground uppercase">
                    {upload.file_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
