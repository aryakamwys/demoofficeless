"use client";

import { useState, useEffect, useCallback } from "react";
import { Employee } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmployeeTable } from "@/components/employees/employee-table";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { ImportDialog } from "@/components/employees/import-dialog";
import { Plus, FileUp, Search } from "lucide-react";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);

  const fetchEmployees = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);

    const res = await fetch(`/api/employees?${params}`);
    const result = await res.json();
    if (result.success) {
      setEmployees(result.data);
    }
  }, [search]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleEdit = (employee: Employee) => {
    setEditEmployee(employee);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditEmployee(null);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari karyawan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
          >
            <FileUp className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Employee
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <EmployeeTable
            employees={employees}
            onEdit={handleEdit}
            onRefresh={fetchEmployees}
          />
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        employee={editEmployee}
        onSuccess={fetchEmployees}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={fetchEmployees}
      />
    </div>
  );
}
