"use client";

import { useState } from "react";
import { ClaimDetail } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/claims/status-badge";
import { Send, Info, UserCheck, ChevronRight, Loader2, Printer, Pencil, Trash2, FileText, Undo2 } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { SendWADialog } from "@/components/claims/send-wa-dialog";
import { SignaturePadDialog } from "@/components/claims/signature-pad-dialog";
import { Trip } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ClaimDetailViewProps {
  claim: ClaimDetail;
}

export function ClaimDetailView({ claim }: ClaimDetailViewProps) {
  const router = useRouter();
  const [sendWADialogOpen, setSendWADialogOpen] = useState(false);
  const [sendingWA, setSendingWA] = useState(false);
  const [approving, setApproving] = useState(false);
  const [sigPadOpen, setSigPadOpen] = useState(false);
  const [sigRole, setSigRole] = useState<"MANAGER" | "HR">("MANAGER");
  const [editTrip, setEditTrip] = useState<Trip | null>(null);
  const [editFare, setEditFare] = useState("");
  const [editPickup, setEditPickup] = useState("");
  const [editDropoff, setEditDropoff] = useState("");
  const [editTicketId, setEditTicketId] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [ticketOptions, setTicketOptions] = useState<{ id: number; title: string }[]>([]);

  const editable = claim.status !== "APPROVED";

  // Saran tiket dari 50 terbaru EnvGate — opsional, input manual tetap jalan
  const loadTicketOptions = async () => {
    if (ticketOptions.length > 0) return;
    try {
      const res = await fetch("/api/envgate/tickets");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) setTicketOptions(json.data);
    } catch {
      // abaikan — HR bisa ketik ID manual
    }
  };

  const handleEditTrip = (trip: Trip) => {
    setEditTrip(trip);
    setEditFare(String(trip.fare));
    setEditPickup(trip.pickup || "");
    setEditDropoff(trip.dropoff || "");
    setEditTicketId(trip.ticket_id || "");
    loadTicketOptions();
  };

  const handleSaveTrip = async () => {
    if (!editTrip) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/trips/${editTrip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fare: Number(editFare),
          pickup: editPickup,
          dropoff: editDropoff,
          ticket_id: editTicketId.trim() || null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Trip berhasil diubah");
        setEditTrip(null);
        router.refresh();
      } else {
        toast.error(result.error || "Gagal mengubah trip");
      }
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteTrip = async (trip: Trip) => {
    if (!confirm(`Hapus trip "${trip.pickup} -> ${trip.dropoff}"?`)) return;
    const res = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
    const result = await res.json();
    if (result.success) {
      toast.success("Trip dihapus");
      router.refresh();
    } else {
      toast.error(result.error || "Gagal menghapus trip");
    }
  };

  // Batalkan approval (kalau ada kesalahan) — klaim kembali menunggu
  // konfirmasi karyawan via WA, approval Manager & HR direset.
  const handleCancelApproval = async () => {
    if (
      !confirm(
        "Batalkan approval klaim ini?\n\n" +
          "Klaim dikembalikan ke menunggu konfirmasi karyawan (balas 1 di WhatsApp).\n" +
          "Status approval Manager & HR direset ulang.\n" +
          "Data trip dan ticket tidak berubah."
      )
    )
      return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/claims/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_approval" }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Approval dibatalkan — klaim menunggu konfirmasi ulang");
        router.refresh();
      } else {
        toast.error(result.error || "Gagal membatalkan approval");
      }
    } finally {
      setCancelling(false);
    }
  };

  const handleSendWA = () => {
    setSendWADialogOpen(true);
  };

  const handleApprove = async (signatureData: string, overrideRole?: "MANAGER" | "HR") => {
    setApproving(true);
    const roleToUse = overrideRole || sigRole;
    try {
      const payload: {
        status: string;
        approved_at: string;
        manager_status?: string;
        manager_signature?: string;
        hr_status?: string;
        hr_signature?: string;
      } = {
        status: "APPROVED",
        approved_at: new Date().toISOString()
      };
      
      if (roleToUse === "MANAGER") {
        payload.manager_status = "APPROVED";
        payload.manager_signature = signatureData;
      } else {
        payload.hr_status = "APPROVED";
        payload.hr_signature = signatureData;
      }
      
      const res = await fetch(`/api/claims/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(`Claim berhasil di-approve sebagai ${roleToUse}`);
        router.refresh();
      } else {
        toast.error("Gagal meng-approve claim");
      }
    } finally {
      setApproving(false);
    }
  };

  const openSignaturePad = async (role: "MANAGER" | "HR") => {
    const existingSig = role === "MANAGER" ? claim.manager_signature : claim.hr_signature;
    if (existingSig) {
      await handleApprove(existingSig, role);
    } else {
      setSigRole(role);
      setSigPadOpen(true);
    }
  };

  const handleResend = async (target: "MANAGER" | "HR") => {
    setSendingWA(true);
    try {
      const res = await fetch(`/api/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: claim.id, target }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`WhatsApp berhasil di-resend ke ${target}`);
      } else {
        toast.error(result.error || `Gagal resend ke ${target}`);
      }
    } catch {
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setSendingWA(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500 print:max-w-none print:m-0 print:p-0">
      {/* Header matching Grab Style */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8 print:mb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2 print:hidden">
            <span>Activity</span>
            <ChevronRight className="h-4 w-4" />
            <span className="text-[#00B14F] font-medium">Transport</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {claim.employee?.employee_name || "Unmatched Employee"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Periode Penagihan: <span className="font-medium text-slate-700">{claim.period}</span>
          </p>
        </div>
        <div className="flex gap-3 print:hidden">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print Bukti
          </Button>

          {claim.status === "APPROVED" && (
            <>
              <Button variant="outline" asChild>
                <a href={`/claims/${claim.id}/report`}>
                  <FileText className="mr-2 h-4 w-4" />
                  Report PDF
                </a>
              </Button>
              <Button
                variant="outline"
                disabled={cancelling}
                onClick={handleCancelApproval}
                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
              >
                {cancelling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Undo2 className="mr-2 h-4 w-4" />
                )}
                {cancelling ? "Membatalkan..." : "Batalkan Approval"}
              </Button>
            </>
          )}

          {claim.employee && claim.status !== 'APPROVED' && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={approving}
                      className="border-[#00B14F] text-[#00B14F] hover:bg-[#00B14F]/10 disabled:opacity-60"
                    >
                      {approving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <UserCheck className="mr-2 h-4 w-4" />
                      )}
                      {approving ? "Processing..." : "Approve Manual"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openSignaturePad("MANAGER")}>
                      Approve as Manager
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openSignaturePad("HR")}>
                      Approve as HR
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {claim.wa_sent ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        disabled={sendingWA}
                        className="bg-[#00B14F] hover:bg-[#009040] text-white disabled:opacity-60"
                      >
                        {sendingWA ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        {sendingWA ? "Sending..." : "Resend WhatsApp"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleSendWA}>
                        Kirim Ulang ke Karyawan
                      </DropdownMenuItem>
                      {claim.manager_id && (
                        <DropdownMenuItem onClick={() => handleResend("MANAGER")}>
                          Kirim Ulang ke Manager
                        </DropdownMenuItem>
                      )}
                      {claim.hr_id && (
                        <DropdownMenuItem onClick={() => handleResend("HR")}>
                          Kirim Ulang ke HR
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    onClick={handleSendWA}
                    disabled={sendingWA}
                    className="bg-[#00B14F] hover:bg-[#009040] text-white disabled:opacity-60"
                  >
                    {sendingWA ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {sendingWA ? "Sending..." : "Send WhatsApp"}
                  </Button>
                )}
              </>
            )}
        </div>
      </div>

      {/* HR Information Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-4 items-start shadow-sm print:hidden">
        <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-1">Panduan HR: Sistem Mapping Perjalanan</p>
          <p>
            Halaman ini menampilkan data perjalanan Grab Business yang telah <span className="font-semibold">diekstrak otomatis dan dicocokkan (mapped)</span> dengan nama karyawan yang ada di database kita.
            Anda dapat meninjau rincian perjalanan di bawah, lalu klik tombol <b>Send WhatsApp</b> di pojok kanan atas untuk mengirim pesan konfirmasi penagihan kepada karyawan yang bersangkutan secara otomatis.
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3 print:grid-cols-3 print:gap-2">
        <Card className="shadow-sm border-slate-200 print:shadow-none print:border">
          <CardHeader className="bg-slate-50/50 border-b pb-4 print:pb-2 print:pt-2">
            <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider print:text-xs">
              Employee Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 print:pt-2 print:space-y-1">
            <InfoRow label="Full Name" value={claim.employee?.employee_name || "—"} />
            <InfoRow label="Department" value={claim.employee?.department || "—"} />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 print:shadow-none print:border">
          <CardHeader className="bg-slate-50/50 border-b pb-4 print:pb-2 print:pt-2">
            <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider print:text-xs">
              Claim Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 print:pt-2 print:space-y-1">
            <InfoRow label="Total Trips" value={claim.trip_count.toString()} />
            <InfoRow label="Total Amount" value={`IDR ${claim.total_amount.toLocaleString("id-ID")}`} />
            <div className="flex items-center justify-between py-1 print:py-0">
              <span className="text-sm text-slate-500 print:text-xs">Status Akhir</span>
              <StatusBadge status={claim.status} />
            </div>
            {claim.approved_at && (
              <InfoRow label="Employee Approved At" value={dayjs(claim.approved_at).format("DD MMM YYYY HH:mm")} />
            )}
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-slate-200 print:shadow-none print:border">
          <CardHeader className="bg-slate-50/50 border-b pb-4 print:pb-2 print:pt-2">
            <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider print:text-xs">
              Approval Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 print:pt-2 print:space-y-1">
            <div className="flex items-center justify-between py-1 print:py-0">
              <span className="text-sm text-slate-500 print:text-xs">Manager</span>
              <StatusBadge status={claim.manager_status as string} />
            </div>
            <div className="flex items-center justify-between py-1 print:py-0">
              <span className="text-sm text-slate-500 print:text-xs">HR</span>
              <StatusBadge status={claim.hr_status as string} />
            </div>
            {claim.manager_status === 'APPROVED' && (
              <InfoRow label="Manager Apprv Date" value={dayjs(claim.updated_at).format("DD MMM YYYY")} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trip Details - Grab Style Table with borders */}
      <Card className="shadow-sm border-slate-200 overflow-hidden print:shadow-none print:border-none print:overflow-visible">
        <CardHeader className="bg-white border-b pb-4 print:hidden">
          <CardTitle className="text-base font-semibold text-slate-800">Bookings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm min-w-[1200px] border-collapse print:min-w-full print:text-xs">
              <thead>
                <tr className="bg-slate-50 print:bg-slate-100">
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap print:py-1 print:px-1">
                    Date & Time
                  </th>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap print:py-1 print:px-1">Employee Name</th>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap print:py-1 print:px-1">Service Type</th>
                  <th className="border border-slate-200 px-3 py-3 text-right font-semibold text-slate-600 whitespace-nowrap print:py-1 print:px-1">Total Fare</th>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap print:py-1 print:px-1">Payment Method</th>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap print:hidden">Cost Code</th>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap print:py-1 print:px-1">Pick-Up</th>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap print:py-1 print:px-1">Drop-Off</th>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap print:py-1 print:px-1">Ticket</th>
                  {editable && (
                    <th className="border border-slate-200 px-3 py-3 print:hidden w-20">Aksi</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {claim.trips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="border border-slate-200 px-3 py-3 whitespace-nowrap align-top print:py-1 print:px-1">
                      {dayjs(trip.trip_date).format("DD MMM YYYY,")}<br/>
                      <span className="text-slate-500">{dayjs(trip.trip_date).format("hh:mm:ss A")}</span>
                    </td>
                    <td className="border border-slate-200 px-3 py-3 align-top font-medium print:py-1 print:px-1">
                      {claim.employee?.employee_name || "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 align-top text-slate-600 print:py-1 print:px-1">
                      {trip.service_type || "Car Standard"}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 text-right align-top font-medium text-slate-800 whitespace-nowrap print:py-1 print:px-1">
                      IDR {trip.fare.toLocaleString("id-ID")}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 align-top text-slate-600 print:py-1 print:px-1">
                      {trip.payment_method || "Corporate Billing"}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 align-top text-slate-600 max-w-[150px] print:hidden">
                      {trip.cost_code || "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 align-top text-slate-600 max-w-[200px] leading-relaxed print:py-1 print:px-1">
                      {trip.pickup || "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 align-top text-slate-600 max-w-[200px] leading-relaxed print:py-1 print:px-1">
                      {trip.dropoff || "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 align-top text-slate-600 whitespace-nowrap print:py-1 print:px-1">
                      {trip.ticket_id ? `#${trip.ticket_id}` : "—"}
                    </td>
                    {editable && (
                      <td className="border border-slate-200 px-2 py-3 print:hidden">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500 hover:text-blue-700"
                            title="Edit trip (HR)"
                            onClick={() => handleEditTrip(trip)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500 hover:text-red-600"
                            title="Hapus trip"
                            onClick={() => handleDeleteTrip(trip)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* Tiket managed-service terhubung — hanya data nyata dari DB.
          Tampilan lengkap + data live EnvGate ada di halaman Report PDF. */}
      {claim.ticket && (
        <Card className="shadow-sm border-slate-200 print:shadow-none print:border">
          <CardHeader className="bg-slate-50/50 border-b pb-3 print:pb-2 print:pt-2">
            <CardTitle className="flex items-center justify-between text-sm font-semibold text-slate-700 uppercase tracking-wider print:text-xs">
              <span>Ticket Terhubung</span>
              <span className="rounded-sm bg-blue-600 px-2 py-0.5 text-xs font-semibold normal-case tracking-normal text-white">
                #PIM-{claim.ticket.ticket_id}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 print:pt-2 print:space-y-1">
            <InfoRow label="Judul" value={claim.ticket.ticket_title || "—"} />
            <InfoRow label="Customer" value={claim.ticket.customer_name || "—"} />
            <InfoRow label="Lokasi" value={claim.ticket.location || "—"} />
            {claim.status === "APPROVED" && (
              <p className="text-xs text-slate-500 pt-1">
                Detail lengkap (status, priority, deskripsi, agent — live dari EnvGate) ada
                di <a href={`/claims/${claim.id}/report`} className="font-medium text-blue-700 underline">Report PDF</a>.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Signature Section for Print */}
      <div className="hidden print:block mt-12 pt-8 print:break-inside-avoid">
        <div className="grid grid-cols-3 gap-8 text-center">
          <div className="space-y-4">
            <p className="font-semibold text-sm">Disetujui Oleh (Karyawan),</p>
            <div className="h-16 flex items-end justify-center">
              {claim.employee_signature && claim.approved_at ? (
                // Data URL base64 — next/image tidak mengoptimalkan data URL.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={claim.employee_signature} alt="Employee Signature" className="max-h-16 object-contain mix-blend-multiply" />
              ) : (
                <div className="h-16" />
              )}
            </div>
            <div>
              <p className="border-b border-black w-3/4 mx-auto"></p>
              <p className="text-sm mt-1">{claim.employee?.employee_name}</p>
              <p className="text-xs text-muted-foreground">
                {claim.approved_at ? dayjs(claim.approved_at).format("DD/MM/YYYY") : "Belum Setuju"}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <p className="font-semibold text-sm">Disetujui Oleh (Manager),</p>
            <div className="h-16 flex items-end justify-center">
              {claim.manager_signature && claim.manager_status === 'APPROVED' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={claim.manager_signature} alt="Manager Signature" className="max-h-16 object-contain mix-blend-multiply" />
              ) : (
                <div className="h-16" />
              )}
            </div>
            <div>
              <p className="border-b border-black w-3/4 mx-auto"></p>
              <p className="text-sm mt-1">{claim.employee?.manager?.employee_name || "Manager"}</p>
              <p className="text-xs text-muted-foreground">
                {claim.manager_status === 'APPROVED' ? "Telah Disetujui" : "Pending"}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <p className="font-semibold text-sm">Disetujui Oleh (HR),</p>
            <div className="h-16 flex items-end justify-center">
              {claim.hr_signature && claim.hr_status === 'APPROVED' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={claim.hr_signature} alt="HR Signature" className="max-h-16 object-contain mix-blend-multiply" />
              ) : (
                <div className="h-16" />
              )}
            </div>
            <div>
              <p className="border-b border-black w-3/4 mx-auto"></p>
              <p className="text-sm mt-1">{claim.employee?.hr?.employee_name || "HR"}</p>
              <p className="text-xs text-muted-foreground">
                {claim.hr_status === 'APPROVED' ? "Telah Disetujui" : "Pending"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comments */}
      {claim.comments.length > 0 && (
        <Card className="shadow-sm border-slate-200 print:hidden">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <CardTitle className="text-base font-semibold text-slate-800">Comments / Koreksi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {claim.comments.map((comment) => (
              <div key={comment.id} className="bg-slate-50 p-3 rounded-md border border-slate-100">
                {(comment.author_name || comment.author_role) && (
                  <p className="text-xs font-semibold text-slate-600 mb-1">
                    {comment.author_name}
                    {comment.author_role ? ` (${comment.author_role})` : ""}
                  </p>
                )}
                <p className="text-sm text-slate-800">{comment.message}</p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  {dayjs(comment.created_at).format("DD MMM YYYY HH:mm")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Dialog edit trip (HR) */}
      <Dialog open={!!editTrip} onOpenChange={(open) => !open && setEditTrip(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Trip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trip-fare">Nominal (IDR)</Label>
              <Input
                id="trip-fare"
                type="number"
                min={0}
                value={editFare}
                onChange={(e) => setEditFare(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trip-pickup">Pick-Up</Label>
              <Input
                id="trip-pickup"
                value={editPickup}
                onChange={(e) => setEditPickup(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trip-dropoff">Drop-Off</Label>
              <Input
                id="trip-dropoff"
                value={editDropoff}
                onChange={(e) => setEditDropoff(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trip-ticket">Ticket EnvGate (bukti kerja)</Label>
              <Input
                id="trip-ticket"
                list="envgate-ticket-options"
                value={editTicketId}
                onChange={(e) => setEditTicketId(e.target.value)}
                placeholder="ID ticket, contoh: 32535"
              />
              <datalist id="envgate-ticket-options">
                {ticketOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </datalist>
              <p className="text-xs text-slate-400">
                Kosongkan untuk hapus. Saran diambil dari 50 ticket terbaru EnvGate.
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Total klaim dihitung ulang otomatis. Kalau manager sudah approve, klaim
              kembali ke approval manager. Perubahan tercatat sebagai note.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveTrip}
              disabled={editSaving || !editFare || Number(editFare) <= 0}
            >
              {editSaving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SendWADialog
        open={sendWADialogOpen}
        onOpenChange={setSendWADialogOpen}
        claim={claim}
        onSuccess={() => router.refresh()}
      />

      <SignaturePadDialog
        open={sigPadOpen}
        onOpenChange={setSigPadOpen}
        onSave={handleApprove}
        roleTitle={sigRole === "MANAGER" ? "Manager" : "HR"}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 print:py-0">
      <span className="text-sm text-slate-500 print:text-xs">{label}</span>
      <span className="text-sm font-medium text-slate-900 print:text-xs">{value}</span>
    </div>
  );
}
