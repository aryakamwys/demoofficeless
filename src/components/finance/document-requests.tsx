"use client";

// Modul Finance: request dokumen (PR/PO/dll) — ajukan (semua karyawan),
// approve/reject (manager), proses & selesai + upload file hasil (finance).
import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import { Check, Eye, FileUp, Loader2, Plus, X } from "lucide-react";
import { SignaturePadDialog } from "@/components/claims/signature-pad-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { DocumentRequest, DocumentTemplate, Employee } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-blue-50 text-blue-700",
  REJECTED: "bg-red-50 text-red-700",
  DIPROSES: "bg-violet-50 text-violet-700",
  SELESAI: "bg-emerald-50 text-emerald-700",
};

const STATUS_FILTERS = ["ALL", "PENDING", "APPROVED", "DIPROSES", "SELESAI", "REJECTED"];

// Join Supabase bisa balikin object atau array — terima keduanya.
function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export function DocumentRequests({ isSuperadmin }: { isSuperadmin: boolean }) {
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Dialog ajukan
  const [newOpen, setNewOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState("");
  const [newEmployee, setNewEmployee] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Dialog selesaikan (finance)
  const [completeReq, setCompleteReq] = useState<DocumentRequest | null>(null);
  const [resultNotes, setResultNotes] = useState("");
  const [resultFile, setResultFile] = useState<File | null>(null);

  // Dialog tolak (manager)
  const [rejectReq, setRejectReq] = useState<DocumentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Paraf manager — approve lewat signature pad (bukti persetujuan)
  const [approveReq, setApproveReq] = useState<DocumentRequest | null>(null);

  // Dialog detail (semua info + paraf + file hasil)
  const [detailReq, setDetailReq] = useState<DocumentRequest | null>(null);

  // Dialog template baru (superadmin)
  const [tplOpen, setTplOpen] = useState(false);
  const [tplCode, setTplCode] = useState("");
  const [tplName, setTplName] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [reqRes, tplRes, empRes] = await Promise.all([
        fetch("/api/documents"),
        fetch("/api/documents/templates"),
        fetch("/api/employees"),
      ]);
      const reqJson = await reqRes.json();
      const tplJson = await tplRes.json();
      const empJson = await empRes.json();
      if (reqJson.success) setRequests(reqJson.data);
      if (tplJson.success) setTemplates(tplJson.data);
      if (empJson.success && Array.isArray(empJson.data)) {
        // employees API bisa balikin {data} atau {data:{data}} — seragamkan
        setEmployees(Array.isArray(empJson.data) ? empJson.data : empJson.data?.data || []);
      }
    } catch {
      toast.error("Gagal memuat data request dokumen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [fetchAll]);

  const submitNew = async () => {
    if (!newTemplate || !newEmployee || !newTitle.trim()) {
      toast.error("Template, karyawan, dan keperluan wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: newTemplate,
          requested_by: newEmployee,
          title: newTitle,
          notes: newNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Request dokumen diajukan — menunggu approval manager");
        setNewOpen(false);
        setNewTemplate("");
        setNewEmployee("");
        setNewTitle("");
        setNewNotes("");
        fetchAll();
      } else {
        toast.error(json.error || "Gagal mengajukan");
      }
    } finally {
      setSaving(false);
    }
  };

  const act = async (
    req: DocumentRequest,
    body: Record<string, unknown>,
    label: string
  ) => {
    setBusyId(req.id);
    try {
      const res = await fetch(`/api/documents/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(label);
        fetchAll();
      } else {
        toast.error(json.error || "Gagal");
      }
    } finally {
      setBusyId(null);
    }
  };

  const submitComplete = async () => {
    if (!completeReq) return;
    setBusyId(completeReq.id);
    try {
      const form = new FormData();
      form.set("action", "complete");
      form.set("result_notes", resultNotes);
      if (resultFile) form.set("file", resultFile);
      const res = await fetch(`/api/documents/${completeReq.id}`, {
        method: "PATCH",
        body: form,
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Request dokumen selesai");
        setCompleteReq(null);
        setResultNotes("");
        setResultFile(null);
        fetchAll();
      } else {
        toast.error(json.error || "Gagal menyelesaikan");
      }
    } finally {
      setBusyId(null);
    }
  };

  const submitTemplate = async () => {
    if (!tplCode.trim() || !tplName.trim()) {
      toast.error("Kode dan nama template wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/documents/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: tplCode, name: tplName }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Template tersimpan");
        setTplOpen(false);
        setTplCode("");
        setTplName("");
        fetchAll();
      } else {
        toast.error(json.error || "Gagal menyimpan template");
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered =
    statusFilter === "ALL"
      ? requests
      : requests.filter((r) => r.status === statusFilter);
  const activeTpl = templates.filter((t) => t.active);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "ALL" ? "Semua status" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-500">{filtered.length} request</span>
        <div className="ml-auto flex gap-2">
          {isSuperadmin && (
            <Button variant="outline" size="sm" onClick={() => setTplOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Template
            </Button>
          )}
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Ajukan Dokumen
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Jenis</th>
                  <th className="px-4 py-3 font-medium">Keperluan</th>
                  <th className="px-4 py-3 font-medium">Pengaju</th>
                  <th className="px-4 py-3 font-medium">Approver</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Dibuat</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-500" />
                      Memuat data…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      Belum ada request dokumen.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const tpl = one(r.template);
                    const requester = one(r.requester)?.employee_name || "—";
                    const approver = one(r.approver)?.employee_name || "—";
                    return (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="rounded-sm bg-blue-600 px-2 py-0.5 font-semibold text-white">
                            {tpl?.code || "?"}
                          </span>
                          <span className="ml-2 text-xs text-slate-500">{tpl?.name}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[260px]">
                          <p className="truncate font-medium" title={r.title}>
                            {r.title}
                          </p>
                          {r.notes && (
                            <p className="truncate text-xs text-slate-400" title={r.notes}>
                              {r.notes}
                            </p>
                          )}
                          {r.status === "REJECTED" && r.rejected_reason && (
                            <p className="truncate text-xs text-red-600" title={r.rejected_reason}>
                                  Ditolak: {r.rejected_reason}
                            </p>
                          )}
                          {r.status === "SELESAI" && r.result_notes && (
                            <p className="truncate text-xs text-emerald-700" title={r.result_notes}>
                              {r.result_notes}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{requester}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{approver}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${STATUS_STYLES[r.status] || "bg-slate-100 text-slate-700"}`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                          {dayjs(r.created_at).format("DD MMM YYYY, HH:mm")}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => setDetailReq(r)}
                          >
                            <Eye className="mr-1 h-3.5 w-3.5" /> Detail
                          </Button>
                          {r.status === "PENDING" && (
                            <div className="flex justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                disabled={busyId === r.id}
                                onClick={() => setApproveReq(r)}
                              >
                                <Check className="mr-1 h-3.5 w-3.5" /> Setujui
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-red-200 text-red-700 hover:bg-red-50"
                                disabled={busyId === r.id}
                                onClick={() => {
                                  setRejectReq(r);
                                  setRejectReason("");
                                }}
                              >
                                <X className="mr-1 h-3.5 w-3.5" /> Tolak
                              </Button>
                            </div>
                          )}
                          {r.status === "APPROVED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={busyId === r.id}
                              onClick={() => act(r, { action: "process" }, "Request diproses finance")}
                            >
                              Proses
                            </Button>
                          )}
                          {r.status === "DIPROSES" && (
                            <Button
                              size="sm"
                              className="h-8"
                              disabled={busyId === r.id}
                              onClick={() => {
                                setCompleteReq(r);
                                setResultNotes("");
                                setResultFile(null);
                              }}
                            >
                              Selesaikan
                            </Button>
                          )}
                          {r.status === "SELESAI" && r.result_url && (
                            <Button variant="ghost" size="sm" className="h-8" asChild>
                              <a href={r.result_url} target="_blank" rel="noopener noreferrer">
                                <FileUp className="mr-1.5 h-3.5 w-3.5" /> Unduh hasil
                              </a>
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog ajukan */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajukan Request Dokumen</DialogTitle>
            <DialogDescription>
              Request akan minta approval manager karyawan yang bersangkutan,
              lalu diproses finance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template dokumen</Label>
              <Select value={newTemplate} onValueChange={setNewTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis dokumen" />
                </SelectTrigger>
                <SelectContent>
                  {activeTpl.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.code} — {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Untuk karyawan</Label>
              <Select value={newEmployee} onValueChange={setNewEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih karyawan" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.employee_name} ({e.employee_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-title">Keperluan</Label>
              <Input
                id="doc-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Contoh: PO sparepart AC kantor"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-notes">Catatan (opsional)</Label>
              <Input
                id="doc-notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Detail kebutuhan, vendor, nominal, dsb."
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Batal
            </Button>
            <Button onClick={submitNew} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Ajukan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog tolak */}
      <Dialog open={!!rejectReq} onOpenChange={(o) => !o && setRejectReq(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Request</DialogTitle>
            <DialogDescription>
              {rejectReq?.title} — alasan penolakan wajib diisi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Alasan</Label>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Contoh: kebutuhan belum jelas, anggaran belum ada"
              maxLength={300}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectReq(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || busyId === rejectReq?.id}
              onClick={() => {
                if (rejectReq)
                  act(rejectReq, { action: "reject", reason: rejectReason }, "Request ditolak");
                setRejectReq(null);
              }}
            >
              Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog selesaikan (finance) */}
      <Dialog open={!!completeReq} onOpenChange={(o) => !o && setCompleteReq(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selesaikan Request</DialogTitle>
            <DialogDescription>
              {completeReq?.title} — isi nomor dokumen/hasil, lampirkan file bila ada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="result-notes">Catatan hasil</Label>
              <Input
                id="result-notes"
                value={resultNotes}
                onChange={(e) => setResultNotes(e.target.value)}
                placeholder="Contoh: PO-2026-014 sudah diterbitkan"
                maxLength={300}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="result-file">File dokumen (opsional)</Label>
              <Input
                id="result-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setResultFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteReq(null)}>
              Batal
            </Button>
            <Button onClick={submitComplete} disabled={busyId === completeReq?.id}>
              {busyId === completeReq?.id && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}{" "}
              Selesaikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paraf manager — persetujuan request dokumen */}
      <SignaturePadDialog
        open={!!approveReq}
        onOpenChange={(o) => !o && setApproveReq(null)}
        roleTitle="Manager"
        onSave={async (signatureData) => {
          if (!approveReq) return;
          await act(
            approveReq,
            { action: "approve", manager_signature: signatureData },
            "Request disetujui — paraf tersimpan"
          );
          setApproveReq(null);
        }}
      />

      {/* Dialog detail — semua info + paraf manager + file hasil */}
      <Dialog open={!!detailReq} onOpenChange={(o) => !o && setDetailReq(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Detail Request Dokumen</DialogTitle>
            <DialogDescription>
              {(() => {
                const tpl = detailReq ? one(detailReq.template) : null;
                return tpl ? `${tpl.code} — ${tpl.name}` : "";
              })()}
            </DialogDescription>
          </DialogHeader>
          {detailReq && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Keperluan</p>
                <p className="font-medium text-slate-800">{detailReq.title}</p>
                {detailReq.notes && (
                  <p className="mt-1 text-slate-600">{detailReq.notes}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Pengaju</p>
                  <p>{one(detailReq.requester)?.employee_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Approver</p>
                  <p>{one(detailReq.approver)?.employee_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</p>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${STATUS_STYLES[detailReq.status] || "bg-slate-100 text-slate-700"}`}
                  >
                    {detailReq.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Diajukan</p>
                  <p>{dayjs(detailReq.created_at).format("DD MMM YYYY, HH:mm")}</p>
                </div>
              </div>
              {detailReq.rejected_reason && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-red-400">Alasan ditolak</p>
                  <p className="text-red-600">{detailReq.rejected_reason}</p>
                </div>
              )}
              {detailReq.result_notes && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-500">Hasil (finance)</p>
                  <p className="text-emerald-700">{detailReq.result_notes}</p>
                </div>
              )}
              {detailReq.result_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={detailReq.result_url} target="_blank" rel="noopener noreferrer">
                    <FileUp className="mr-2 h-4 w-4" /> Unduh file hasil
                  </a>
                </Button>
              )}
              {detailReq.manager_signature ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Paraf Manager (persetujuan)
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={detailReq.manager_signature}
                    alt="Paraf Manager"
                    className="mt-1 max-h-24 rounded border border-slate-200 bg-white p-2"
                  />
                </div>
              ) : (
                <p className="text-xs italic text-slate-400">Belum ada paraf manager.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailReq(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog template (superadmin) */}
      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Template Dokumen</DialogTitle>
            <DialogDescription>
              Kode singkat (mis. PR) dan nama lengkap. Template aktif langsung
              bisa dipilih saat mengajukan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-code">Kode</Label>
              <Input
                id="tpl-code"
                value={tplCode}
                onChange={(e) => setTplCode(e.target.value.toUpperCase())}
                placeholder="PR"
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Nama</Label>
              <Input
                id="tpl-name"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="Purchase Request"
                maxLength={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTplOpen(false)}>
              Batal
            </Button>
            <Button onClick={submitTemplate} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
