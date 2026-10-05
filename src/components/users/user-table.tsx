"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KeyRound, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { confirmAction } from "@/components/confirm-dialog";
import { toast } from "sonner";
import dayjs from "dayjs";

interface LoginUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_superadmin: boolean;
}

export function UserTable() {
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState<LoginUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const result = await res.json();
      if (result.success) {
        setUsers(result.data);
      } else {
        toast.error(result.error || "Gagal mengambil data user");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // setState hanya terjadi setelah await — rule tidak bisa melintasi async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchUsers();
  }, [fetchUsers]);

  const handleAdd = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail, password: addPassword }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`User ${addEmail} berhasil dibuat`);
        setAddOpen(false);
        setAddEmail("");
        setAddPassword("");
        fetchUsers();
      } else {
        toast.error(result.error || "Gagal membuat user");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/users/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`Password ${resetTarget.email} direset`);
        setResetTarget(null);
        setResetPassword("");
      } else {
        toast.error(result.error || "Gagal reset password");
      }
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async (user: LoginUser) => {
    if (
      !(await confirmAction({
        title: "Hapus user ini?",
        description: user.email,
        confirmText: "Hapus",
        danger: true,
      }))
    )
      return;

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "DELETE",
    });
    const result = await res.json();

    if (result.success) {
      toast.success(`User ${user.email} berhasil dihapus`);
      fetchUsers();
    } else {
      toast.error(result.error || "Gagal menghapus user");
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Akun yang bisa login ke website (Supabase Auth).
          </p>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Tambah User
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Belum ada user terdaftar.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100 border-slate-300 font-semibold text-slate-700">
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Terdaftar</TableHead>
                <TableHead>Login Terakhir</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="text-[11px]">
                  <TableCell className="px-3 py-2 font-medium text-slate-800">
                    {user.email}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    {user.is_superadmin ? (
                      <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50">
                        Superadmin
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-50 text-slate-600 hover:bg-slate-50">
                        User
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    {dayjs(user.created_at).format("DD MMM YYYY")}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    {user.last_sign_in_at
                      ? dayjs(user.last_sign_in_at).format("DD MMM YYYY HH:mm")
                      : "Belum pernah"}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-blue-700"
                        title="Reset password"
                        onClick={() => setResetTarget(user)}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      {!user.is_superadmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-red-600"
                          title="Hapus user"
                          onClick={() => handleDelete(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Dialog tambah user */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah User Login</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="nama@perkom.co.id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password</Label>
              <Input
                id="new-password"
                type="password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleAdd}
              disabled={
                saving || !addEmail || addPassword.length < 8
              }
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog reset password */}
      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => !open && setResetTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reset Password — {resetTarget?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset-password">Password Baru</Label>
            <Input
              id="reset-password"
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleReset}
              disabled={resetting || resetPassword.length < 8}
            >
              {resetting && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
