"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Upload as UploadIcon,
  Loader2,
  FileSpreadsheet,
  FileText,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/confirm-dialog";
import { Upload } from "@/types";
import dayjs from "dayjs";

const months = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatBytes(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default function UploadPage() {
  // Default: bulan berjalan (index month dayjs = 0-11)
  const [period, setPeriod] = useState(
    () => `${months[dayjs().month()]} ${dayjs().year()}`
  );
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!/\.(csv|pdf)$/i.test(f.name)) {
      toast.error("File harus CSV atau PDF (statement dari Grab Business)");
      return;
    }
    setFile(f);
  };

  // Hard delete: file di storage + baris upload (claims/trips ikut cascade)
  const handleDeleteUpload = async (id: string, filename: string) => {
    if (
      !(await confirmAction({
        title: `Hapus "${filename}"?`,
        description:
          "File di server storage dan SEMUA claim dari statement ini ikut terhapus permanen.",
        confirmText: "Hapus Permanen",
        danger: true,
      }))
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

      toast.success("File terunggah. Memproses…");
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
    <div className="max-w-3xl space-y-6">
      {/* ==== Unggah statement ==== */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Unggah Statement Grab
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Statement perjalanan dari Grab Business — klaim dibuat otomatis
              per karyawan.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Periode</label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-full sm:w-56">
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
                        <SelectItem key={`${year}-${idx}`} value={`${month} ${year}`}>
                          {month} {year}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dropzone / file terpilih */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">File statement</label>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.pdf"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatBytes(file.size)} · siap diproses untuk {period}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                  title="Buang file"
                  aria-label="Buang file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pickFile(e.dataTransfer.files?.[0]);
                }}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
                  dragging
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-300 bg-white hover:border-emerald-400 hover:bg-emerald-50/40"
                }`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                  <UploadIcon className="h-5 w-5 text-emerald-600" />
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  Tarik &amp; lepas file ke sini, atau klik untuk memilih
                </span>
                <span className="text-xs text-slate-400">
                  CSV atau PDF dari Grab Business
                </span>
              </button>
            )}
          </div>

          <Button
            onClick={handleUpload}
            disabled={loading || !period || !file}
            className="h-11 w-full bg-[#00B14F] text-[14px] font-semibold text-white hover:bg-[#009040] sm:w-auto sm:px-8"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadIcon className="mr-2 h-4 w-4" />
            )}
            {loading ? "Memproses…" : "Proses Statement"}
          </Button>
        </CardContent>
      </Card>

      {/* ==== Riwayat upload ==== */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-slate-900">Riwayat Upload</h2>
            {uploads.length > 0 && (
              <span className="text-xs font-medium text-slate-400">
                {uploads.length} statement
              </span>
            )}
          </div>

          {historyLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((row) => (
                <div key={row} className="flex items-center gap-3 rounded-xl border p-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-52" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : uploads.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
              <FileText className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">Belum ada statement terunggah</p>
              <p className="mt-0.5 text-xs text-slate-400">
                Statement yang diproses akan tampil di sini beserta claims-nya.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {uploads.map((upload) => (
                <div key={upload.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    <FileSpreadsheet className="h-5 w-5 text-slate-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {upload.filename}
                    </p>
                    <p className="text-xs text-slate-500">
                      <span className="font-medium text-slate-600">{upload.period}</span>
                      {" · "}
                      {dayjs(upload.created_at).format("DD MMM YYYY, HH:mm")}
                      <span className="hidden sm:inline"> · {upload.file_type.toUpperCase()}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs" asChild>
                      <Link href={`/claims?upload_id=${upload.id}`}>
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        Claims
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-600"
                      title="Hapus statement + semua claims-nya"
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
