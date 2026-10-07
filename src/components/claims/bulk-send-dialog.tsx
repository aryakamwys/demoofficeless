"use client";

import { useEffect, useRef, useState } from "react";
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

interface BulkSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Klaim yang layak dikirim (sudah ter-map karyawan + punya nomor WA). */
  claims: ClaimWithEmployee[];
  onDone: () => void;
}

/** Antrean kirim massal — satu per satu (anti pembatasan device), progress
 *  terlihat per baris, bisa dihentikan kapan saja. Manager & HR otomatis
 *  dari data karyawan masing-masing. */
export function BulkSendDialog({
  open,
  onOpenChange,
  claims,
  onDone,
}: BulkSendDialogProps) {
  const [states, setStates] = useState<ItemState[]>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);

  useEffect(() => {
    if (open) {
      // Reset antrean tiap dialog dibuka — setState di effect memang disengaja.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStates(claims.map(() => "waiting"));
      setErrors({});
      stopRef.current = false;
    }
  }, [open, claims]);

  const run = async () => {
    setRunning(true);
    stopRef.current = false;
    // "Lanjutkan Sisa" — baris yang sudah terproses (ok/fail) tidak dikirim ulang
    const st: ItemState[] = claims.map((_, i) =>
      states[i] === "ok" || states[i] === "fail" ? states[i]! : "waiting"
    );
    setStates([...st]);
    for (let i = 0; i < claims.length; i++) {
      if (st[i] !== "waiting") continue;
      if (stopRef.current) break;
      st[i] = "sending";
      setStates([...st]);
      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claim_id: claims[i].id }),
        });
        const result = await res.json();
        if (result.success) {
          st[i] = "ok";
        } else {
          st[i] = "fail";
          setErrors((e) => ({ ...e, [i]: result.error || "Gagal mengirim" }));
        }
      } catch {
        st[i] = "fail";
        setErrors((e) => ({ ...e, [i]: "Koneksi gagal" }));
      }
      setStates([...st]);
    }
    setRunning(false);
    onDone();
  };

  const stop = () => {
    stopRef.current = true;
  };

  const doneCount = states.filter((s) => s === "ok" || s === "fail").length;
  const failCount = states.filter((s) => s === "fail").length;
  const percent = claims.length > 0 ? Math.round((doneCount / claims.length) * 100) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (running) stop();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kirim WhatsApp Massal</DialogTitle>
          <DialogDescription>
            {claims.length} klaim ter-map akan dikirim satu per satu ke
            masing-masing karyawan (± 5 detik per klaim). Manager &amp; HR
            otomatis diambil dari data karyawan. Jangan tutup tab ini selama
            berjalan.
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        {states.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span>
                {running
                  ? `Mengirim ${Math.min(doneCount + 1, claims.length)} dari ${claims.length}…`
                  : doneCount === claims.length
                    ? `Selesai — ${claims.length - failCount} terkirim${failCount > 0 ? `, ${failCount} gagal` : ""}`
                    : doneCount > 0
                      ? `Terhenti di ${doneCount} dari ${claims.length}`
                      : `Siap mengirim ${claims.length} klaim`}
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
        )}

        {/* Antrean */}
        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {claims.map((claim, i) => {
            const st = states[i] || "waiting";
            return (
              <div
                key={claim.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {st === "waiting" && <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
                  {st === "sending" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600" />}
                  {st === "ok" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                  {st === "fail" && <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                  <span className="truncate font-medium text-slate-700">
                    {claim.employee?.employee_name || "—"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                  {st === "fail" && errors[i] ? (
                    <span className="max-w-40 truncate text-red-600" title={errors[i]}>
                      {errors[i]}
                    </span>
                  ) : null}
                  <span>{claim.period}</span>
                  <span className="font-semibold text-slate-700">
                    IDR {claim.total_amount.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          {running ? (
            <Button variant="outline" onClick={stop}>
              <Square className="mr-2 h-3.5 w-3.5" />
              Hentikan
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {doneCount === claims.length ? "Tutup" : "Batal"}
            </Button>
          )}
          <Button
            onClick={run}
            disabled={running || doneCount === claims.length}
            className="bg-[#00B14F] text-white hover:bg-[#009040]"
          >
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {doneCount > 0 && doneCount < claims.length
              ? "Lanjutkan Sisa"
              : `Kirim ${claims.length} Klaim`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
