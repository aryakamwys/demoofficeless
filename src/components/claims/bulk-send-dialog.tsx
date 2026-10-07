"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClaimWithEmployee } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, Circle, Loader2, Square, XCircle } from "lucide-react";

type ItemState = "waiting" | "sending" | "ok" | "fail";

/** Antrean blast di server — jalan di background VPS, tab boleh ditutup.
 *  Dialog ini hanya memulai/menghentikan + polling progress. */
type ServerJob = {
  running: boolean;
  stopped: boolean;
  total: number;
  done: number;
  items: Array<{
    claim_id: string;
    employee_name: string;
    period: string;
    total_amount: number;
    state: ItemState;
    error?: string;
  }>;
};

interface BulkSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Klaim yang layak dikirim (PENDING + ter-map karyawan). */
  claims: ClaimWithEmployee[];
  onDone: () => void;
}

export function BulkSendDialog({
  open,
  onOpenChange,
  claims,
  onDone,
}: BulkSendDialogProps) {
  const [job, setJob] = useState<ServerJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/bulk");
      const body = await res.json();
      if (body.success && body.job) {
        setJob(body.job as ServerJob);
        if (!(body.job as ServerJob).running) {
          stopPolling();
          onDone();
        }
      }
    } catch {
      // polling gagal sekali bukan masalah — tick berikutnya mencoba lagi
    }
  }, [onDone]);

  // Buka dialog → tampilkan kondisi antrean terakhir (blast masih jalan
  // walau tab sempat ditutup). Jalan → mulai polling.
  useEffect(() => {
    if (!open) {
      stopPolling();
      return;
    }
    // Reset pesan error tiap dialog dibuka — disengaja.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    poll();
  }, [open, poll]);

  // Polling selama antrean berjalan
  useEffect(() => {
    if (job?.running && !pollRef.current) {
      pollRef.current = setInterval(poll, 2500);
    }
    return () => {
      if (!job?.running) stopPolling();
    };
  }, [job?.running, poll]);

  // Bersihkan interval saat komponen dilepas
  useEffect(() => stopPolling, []);

  const start = async (claimIds: string[]) => {
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/whatsapp/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_ids: claimIds }),
      });
      const body = await res.json();
      if (body.success && body.job) {
        setJob(body.job as ServerJob);
        onDone();
      } else {
        setError(body.error || "Gagal memulai antrean");
      }
    } catch {
      setError("Koneksi gagal — coba lagi.");
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    try {
      await fetch("/api/whatsapp/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
    } catch {
      // tick polling berikutnya tetap melihat job.stopped
    }
  };

  const running = !!job?.running;
  const doneCount = job ? job.items.filter((i) => i.state === "ok" || i.state === "fail").length : 0;
  const failCount = job ? job.items.filter((i) => i.state === "fail").length : 0;
  const waitingIds = job ? job.items.filter((i) => i.state === "waiting").map((i) => i.claim_id) : [];
  const total = job?.total || 0;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const finished = !!job && !running && doneCount === total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kirim WhatsApp Massal</DialogTitle>
          <DialogDescription>
            Antrean jalan di server — tab boleh ditutup, buka dialog ini lagi
            untuk melihat progresnya. Dikirim satu per satu (± 5 detik per
            klaim) agar device tidak kena pembatasan.
          </DialogDescription>
        </DialogHeader>

        {job ? (
          <>
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                <span>
                  {running
                    ? `Mengirim ${Math.min(doneCount + 1, total)} dari ${total}…`
                    : finished
                      ? `Selesai — ${total - failCount} terkirim${failCount > 0 ? `, ${failCount} gagal` : ""}`
                      : `Terhenti di ${doneCount} dari ${total}`}
                </span>
                <span>{percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${failCount > 0 && !running ? "bg-amber-500" : "bg-[#00B14F]"}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            {/* Antrean */}
            <div className="max-h-64 space-y-1.5 overflow-y-auto">
              {job.items.map((item) => (
                <div
                  key={item.claim_id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {item.state === "waiting" && <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                    {item.state === "sending" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600" />}
                    {item.state === "ok" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                    {item.state === "fail" && <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                    <span className="truncate font-medium text-slate-700">
                      {item.employee_name}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                    {item.state === "fail" && item.error ? (
                      <span className="max-w-40 truncate text-red-600" title={item.error}>
                        {item.error}
                      </span>
                    ) : null}
                    <span>{item.period}</span>
                    <span className="font-semibold text-slate-700">
                      IDR {item.total_amount.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-sm text-slate-600">
            {claims.length} klaim ter-map siap dikirim. Manager &amp; HR otomatis
            diambil dari data karyawan masing-masing.
          </p>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </p>
        )}

        <DialogFooter>
          {running ? (
            <Button variant="outline" onClick={stop}>
              <Square className="mr-2 h-3.5 w-3.5" />
              Hentikan
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Tutup
            </Button>
          )}
          {(!job || !running) && (job ? waitingIds.length > 0 : claims.length > 0) && (
            <Button
              onClick={() => start(job ? waitingIds : claims.map((c) => c.id))}
              disabled={starting}
              className="bg-[#00B14F] text-white hover:bg-[#009040]"
            >
              {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {job && doneCount > 0
                ? `Lanjutkan ${waitingIds.length} Sisa`
                : `Kirim ${job ? waitingIds.length : claims.length} Klaim`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
