"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Employee } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeTable } from "@/components/employees/employee-table";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { ImportDialog } from "@/components/employees/import-dialog";
import { Plus, FileUp, Search } from "lucide-react";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  // Debounce 300ms supaya tidak fetch tiap ketikan
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Pagination 10/halaman (data sudah ke-load semua — dataset internal kecil;
  // list menyusut karena search → safePage otomatis clamp, tidak perlu effect reset)
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(employees.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = employees.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const fetchEmployees = useCallback(async () => {
    // Batalkan request lama supaya respons stale tidak menimpa hasil baru
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const params = debouncedSearch
        ? `?search=${encodeURIComponent(debouncedSearch)}`
        : "";
      const res = await fetch(`/api/employees${params}`, { signal: ctrl.signal });
      if (!res.ok) return;
      const result = await res.json();
      if (result.success) {
        setEmployees(result.data);
      }
    } catch {
      // AbortError diabaikan — request terbaru sudah berjalan
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    // setState hanya terjadi setelah await — rule tidak bisa melintasi async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchEmployees();
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
        <div className="grid grid-cols-2 gap-2 sm:flex">
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

      {/* Table — skeleton hanya di load pertama, search tidak bikin tabel kedip */}
      <Card>
        <CardContent className="p-0">
          {loading && employees.length === 0 ? (
            <div className="p-0">
              <div className="border-b px-4 py-3 flex gap-6">
                {[60, 140, 100, 120, 80, 60].map((w, i) => (
                  <Skeleton key={i} className="h-4" style={{ width: w }} />
                ))}
              </div>
              {[1, 2, 3, 4, 5, 6].map((row) => (
                <div key={row} className="border-b px-4 py-4 flex gap-6 items-center">
                  {[60, 140, 100, 120, 80, 60].map((w, i) => (
                    <Skeleton key={i} className="h-4" style={{ width: w }} />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <EmployeeTable
              employees={paged}
              onEdit={handleEdit}
              onRefresh={fetchEmployees}
            />
          )}
          {employees.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Menampilkan {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, employees.length)} dari{" "}
                {employees.length} employee
              </p>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  Sebelumnya
                </Button>
                <span className="text-sm text-slate-600">
                  {safePage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          )}
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
