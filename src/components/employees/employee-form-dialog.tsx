"use client";

import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  const isEdit = !!employee;

  const form = useForm<EmployeeSchemaType>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      employee_number: employee?.employee_number || "",
      employee_name: employee?.employee_name || "",
      department: employee?.department || "",
      phone_number: employee?.phone_number || "",
    },
  });

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

      toast.success(isEdit ? "Data berhasil diubah" : "Employee berhasil ditambahkan");
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
      <DialogContent className="sm:max-w-md">
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

          <DialogFooter>
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
    </Dialog>
  );
}
