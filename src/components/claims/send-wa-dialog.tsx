"use client";

import { useState, useEffect } from "react";
import { Employee, ClaimWithEmployee } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SendWADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim: ClaimWithEmployee | null;
  onSuccess: () => void;
}

export function SendWADialog({
  open,
  onOpenChange,
  claim,
  onSuccess,
}: SendWADialogProps) {
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [hrs, setHrs] = useState<Employee[]>([]);

  const [selectedManagerId, setSelectedManagerId] = useState<string>("none");
  const [selectedHrId, setSelectedHrId] = useState<string>("none");

  useEffect(() => {
    if (open) {
      fetch("/api/employees?role=MANAGER")
        .then((res) => res.json())
        .then((res) => {
          if (res.success) setManagers(res.data);
        });
      fetch("/api/employees?role=HR")
        .then((res) => res.json())
        .then((res) => {
          if (res.success) setHrs(res.data);
        });
    }
  }, [open]);

  useEffect(() => {
    if (open && claim) {
      setSelectedManagerId(claim.employee?.manager_id || "none");
      setSelectedHrId(claim.employee?.hr_id || "none");
    }
  }, [open, claim]);

  const handleSend = async () => {
    if (!claim) return;
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim_id: claim.id,
          manager_id: selectedManagerId === "none" ? null : selectedManagerId,
          hr_id: selectedHrId === "none" ? null : selectedHrId,
        }),
      });

      const result = await res.json();
      if (result.success) {
        toast.success("WhatsApp berhasil dikirim", {
          style: {
            padding: "24px",
            fontSize: "18px",
            fontWeight: "bold",
            backgroundColor: "#00B14F",
            color: "white",
            border: "none",
          },
        });
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(result.error || "Gagal mengirim WhatsApp");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setLoading(false);
    }
  };

  if (!claim) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kirim Pesan WhatsApp</DialogTitle>
          <DialogDescription>
            Pesan konfirmasi akan dikirimkan ke <b>{claim.employee?.employee_name}</b>.
            Anda dapat memastikan kembali Manager dan HR yang akan memproses klaim ini.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Kirim Ke (Employee)</Label>
            <div className="p-3 bg-slate-50 border rounded-md text-sm text-slate-700">
              {claim.employee?.phone_number || "Tidak ada nomor"}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Pilih Manager (Approver 1)</Label>
            <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Auto Bypass (Tanpa Manager) --</SelectItem>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.employee_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pilih HR (Approver 2)</Label>
            <Select value={selectedHrId} onValueChange={setSelectedHrId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih HR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Auto Finalize (Tanpa HR) --</SelectItem>
                {hrs.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.employee_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={handleSend}
            disabled={loading || !claim.employee?.phone_number}
            className="bg-[#00B14F] hover:bg-[#009040] text-white"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Kirim WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
