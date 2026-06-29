"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  employeeSchema,
  EmployeeSchemaType,
} from "@/lib/validations/employee";
import { Employee } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, PenTool, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SignaturePadDialog } from "@/components/claims/signature-pad-dialog";

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  onSuccess: () => void;
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  onSuccess,
}: EmployeeFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [hrs, setHrs] = useState<Employee[]>([]);
  const [sigPadOpen, setSigPadOpen] = useState(false);
  const isEdit = !!employee;

  const form = useForm<EmployeeSchemaType>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      employee_number: employee?.employee_number || "",
      employee_name: employee?.employee_name || "",
      department: employee?.department || "",
      phone_number: employee?.phone_number || "",
      role: employee?.role || "EMPLOYEE",
      manager_id: employee?.manager_id || null,
      hr_id: employee?.hr_id || null,
      signature: employee?.signature || null,
    },
  });

  // Reset form when employee changes or dialog opens
  useEffect(() => {
    form.reset({
      employee_number: employee?.employee_number || "",
      employee_name: employee?.employee_name || "",
      department: employee?.department || "",
      phone_number: employee?.phone_number || "",
      role: employee?.role || "EMPLOYEE",
      manager_id: employee?.manager_id || null,
      hr_id: employee?.hr_id || null,
      signature: employee?.signature || null,
    });
  }, [employee, form]);

  useEffect(() => {
    if (open) {
      // Fetch managers and HRs
      fetch("/api/employees?role=MANAGER")
        .then(res => res.json())
        .then(res => { if (res.success) setManagers(res.data); });
      fetch("/api/employees?role=HR")
        .then(res => res.json())
        .then(res => { if (res.success) setHrs(res.data); });
    }
  }, [open]);

  const onSubmit = async (data: EmployeeSchemaType) => {
    setLoading(true);
    try {
      const url = isEdit
        ? `/api/employees/${employee.id}`
        : "/api/employees";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!result.success) {
        toast.error(result.error || "Gagal menyimpan data");
        return;
      }

      toast.success(isEdit ? "Data Karyawan Berhasil Diubah!" : "Karyawan Baru Berhasil Ditambahkan!", {
        style: {
          padding: '24px',
          fontSize: '18px',
          fontWeight: 'bold',
          backgroundColor: '#00B14F',
          color: 'white',
          border: 'none',
        },
        duration: 5000,
      });
      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Employee" : "Tambah Employee"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Ubah data karyawan."
              : "Masukkan data karyawan baru."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employee_number">Employee Number</Label>
            <Input
              id="employee_number"
              {...form.register("employee_number")}
              placeholder="EMP001"
              disabled={isEdit}
            />
            {form.formState.errors.employee_number && (
              <p className="text-sm text-destructive">
                {form.formState.errors.employee_number.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="employee_name">Nama</Label>
            <Input
              id="employee_name"
              {...form.register("employee_name")}
              placeholder="John Doe"
            />
            {form.formState.errors.employee_name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.employee_name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                {...form.register("department")}
                placeholder="Finance"
              />
              {form.formState.errors.department && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.department.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select 
                value={form.watch("role")} 
                onValueChange={(val: any) => form.setValue("role", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_number">Phone Number</Label>
            <Input
              id="phone_number"
              {...form.register("phone_number")}
              placeholder="628xxxxxxxxxx"
            />
            {form.formState.errors.phone_number && (
              <p className="text-sm text-destructive">
                {form.formState.errors.phone_number.message}
              </p>
            )}
          </div>

          {form.watch("role") === "EMPLOYEE" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="manager_id">Manager</Label>
                <Select 
                  value={form.watch("manager_id") || "none"} 
                  onValueChange={(val) => form.setValue("manager_id", val === "none" ? null : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Tanpa Manager --</SelectItem>
                    {managers.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.employee_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hr_id">HR</Label>
                <Select 
                  value={form.watch("hr_id") || "none"} 
                  onValueChange={(val) => form.setValue("hr_id", val === "none" ? null : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih HR" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Tanpa HR --</SelectItem>
                    {hrs.map(h => (
                      <SelectItem key={h.id} value={h.id}>{h.employee_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {form.watch("role") !== "EMPLOYEE" && (
            <div className="space-y-2">
              <Label>Tanda Tangan</Label>
              <div className="flex flex-col gap-2">
                {form.watch("signature") ? (
                  <div className="relative border rounded-md p-2 bg-slate-50 flex items-center justify-center">
                    <img src={form.watch("signature") || ""} alt="Signature" className="h-20 object-contain mix-blend-multiply" />
                    <Button 
                      type="button"
                      variant="destructive" 
                      size="icon" 
                      className="absolute top-2 right-2 h-7 w-7 rounded-full" 
                      onClick={() => form.setValue("signature", null)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-full h-24 border-dashed" onClick={() => setSigPadOpen(true)}>
                    <PenTool className="mr-2 h-5 w-5 text-slate-500" />
                    Gambar Tanda Tangan
                  </Button>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Simpan" : "Tambah"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <SignaturePadDialog
        open={sigPadOpen}
        onOpenChange={setSigPadOpen}
        onSave={async (sig) => { form.setValue("signature", sig); }}
        roleTitle={form.watch("role") === "MANAGER" ? "Manager" : "HR"}
      />
    </Dialog>
  );
}
