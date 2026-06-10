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
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
    if (!confirm("Yakin ingin menghapus karyawan ini?")) return;

    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
    const result = await res.json();

    if (result.success) {
      toast.success("Employee berhasil dihapus");
      onRefresh();
    } else {
      toast.error(result.error || "Gagal menghapus");
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
          <TableHead>Employee No.</TableHead>
          <TableHead>Nama</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((emp) => (
          <TableRow key={emp.id}>
            <TableCell className="font-medium">
              {emp.employee_number}
            </TableCell>
            <TableCell>{emp.employee_name}</TableCell>
            <TableCell className="text-muted-foreground">
              {emp.department || "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
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
