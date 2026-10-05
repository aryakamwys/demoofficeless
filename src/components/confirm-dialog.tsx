"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** Aksi merusak (hapus/batal) — tombol konfirmasi merah. */
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

// Pengganti confirm() native (tampilannya seperti error browser).
// Satu host dipasang di layout dashboard; confirmAction() bisa dipakai
// dari komponen client mana saja: `if (!(await confirmAction({...}))) return;`
let show: ((p: Pending) => void) | null = null;

export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) return resolve(window.confirm(opts.title)); // host belum terpasang
    show({ ...opts, resolve });
  });
}

export function ConfirmDialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    show = setPending;
    return () => {
      show = null;
    };
  }, []);

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <Dialog open={!!pending} onOpenChange={(open) => !open && close(false)}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{pending?.title}</DialogTitle>
          {pending?.description && (
            <DialogDescription className="whitespace-pre-line">
              {pending.description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            {pending?.cancelText || "Batal"}
          </Button>
          <Button
            variant={pending?.danger ? "destructive" : "default"}
            onClick={() => close(true)}
          >
            {pending?.confirmText || "Ya"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
