"use client";

import { Employee } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeftRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/confirm-dialog";

interface EmployeeTableProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onRefresh: () => void;
}

export function EmployeeTable({
  employees,
  onEdit,
  onRefresh,
}: EmployeeTableProps) {
  const handleDelete = async (id: string) => {
    if (
      !(await confirmAction({
        title: "Hapus karyawan ini?",
        description: "Data karyawan yang dihapus tidak bisa dikembalikan.",
        confirmText: "Hapus",
        danger: true,
      }))
    )
      return;

    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
    const result = await res.json();

    if (result.success) {
      toast.success("Employee berhasil dihapus");
      onRefresh();
    } else {
      toast.error(result.error || "Gagal menghapus");
    }
  };

  // Ganti kategori (template chat WA) — aksi cepat, tanpa buka form
  const handleToggleCategory = async (emp: Employee) => {
    const next = emp.category === "SALES" ? "ENGINEER" : "SALES";
    const label = next === "SALES"
      ? "Sales — chat sederhana (tanpa command ticket)"
      : "Engineer — chat lengkap (ada command ticket)";
    if (
      !(await confirmAction({
        title: `Jadikan ${next === "SALES" ? "Sales" : "Engineer"}?`,
        description: `${emp.employee_name} → ${label}`,
        confirmText: "Ubah",
      }))
    )
      return;

    const res = await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: next }),
    });
    const result = await res.json();

    if (result.success) {
      toast.success(`Kategori ${emp.employee_name} kini ${next === "SALES" ? "Sales" : "Engineer"}`);
      onRefresh();
    } else {
      toast.error(result.error || "Gagal mengubah kategori");
    }
  };

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Belum ada data karyawan.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nama</TableHead>
          <TableHead className="hidden md:table-cell">Department</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="hidden md:table-cell">Phone</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((emp) => (
          <TableRow key={emp.id}>
            <TableCell>{emp.employee_name}</TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground">
              {emp.department || "—"}
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {emp.role}
              </Badge>
            </TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground">
              {emp.phone_number}
            </TableCell>
            <TableCell>
              <Badge
                variant={emp.is_active ? "default" : "secondary"}
                className={
                  emp.is_active
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-gray-100 text-gray-500"
                }
              >
                {emp.is_active ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(emp)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleCategory(emp)}>
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    {emp.category === "SALES"
                      ? "Kategori: Sales → Jadikan Engineer"
                      : "Kategori: Engineer → Jadikan Sales"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDelete(emp.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
