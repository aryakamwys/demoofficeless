"use client";

import { useState } from "react";
import { ClaimDetail } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/claims/status-badge";
import { Send, Info, UserCheck, ChevronRight, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { SendWADialog } from "@/components/claims/send-wa-dialog";
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

  const handleSendWA = () => {
    setSendWADialogOpen(true);
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/claims/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED", approved_at: new Date().toISOString() }),
      });
      if (res.ok) {
        toast.success("Claim berhasil di-approve");
        router.refresh();
      } else {
        toast.error("Gagal meng-approve claim");
      }
    } finally {
      setApproving(false);
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
    } catch (e) {
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

          {claim.employee &&
            (claim.status === "PENDING" || claim.status === "SENT") && (
              <>
                <Button
                  variant="outline"
                  onClick={handleApprove}
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
            <InfoRow label="Employee Number" value={claim.employee?.employee_number || "—"} />
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
              <StatusBadge status={claim.manager_status as any} />
            </div>
            <div className="flex items-center justify-between py-1 print:py-0">
              <span className="text-sm text-slate-500 print:text-xs">HR</span>
              <StatusBadge status={claim.hr_status as any} />
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      {/* EnvGate Ticket Details (Print & Screen if linked) */}
      {claim.ticket && claim.status === 'APPROVED' && (
        <div className="mt-8 border border-slate-200 rounded-md overflow-hidden bg-white print:border-none print:mt-6 print:break-inside-avoid">
          <div className="bg-slate-50 border-b border-slate-200 p-4 print:bg-white print:border-b-2 print:border-black print:pb-2">
            <h3 className="text-lg font-semibold text-slate-800 print:text-base">
              Linked Ticket: {claim.ticket.ticket_title || "No Subject"}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 print:text-xs">
              <span>Technical Support</span>
              <span>&raquo;</span>
              <span>Managed Service</span>
              <span>&raquo;</span>
              <span>Others</span>
              <span className="ml-auto font-medium text-slate-700 bg-slate-200 px-2 py-0.5 rounded print:border print:border-slate-300">#{claim.ticket.ticket_id}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 border-b border-slate-100 print:border-b print:border-slate-300 print:py-2">
            <div>
              <p className="text-xs text-slate-500 mb-1 print:text-[10px]">Priority</p>
              <p className="text-sm font-semibold text-slate-800 print:text-xs">Medium</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1 print:text-[10px]">Type</p>
              <p className="text-sm font-semibold text-slate-800 print:text-xs">Service Request</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1 print:text-[10px]">Source</p>
              <p className="text-sm font-semibold text-slate-800 print:text-xs">Email</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1 print:text-[10px]">First Response</p>
              <p className="text-sm font-semibold text-emerald-500 print:text-xs">Correct</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1 print:text-[10px]">Resolution</p>
              <p className="text-sm font-semibold text-slate-800 print:text-xs">Paused (0%)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b border-slate-100 bg-slate-50/50 print:bg-white print:border-b print:border-slate-300 print:py-2">
            <div>
              <p className="text-xs text-slate-500 mb-1 print:text-[10px]">Incident Location</p>
              <p className="text-sm font-medium text-slate-800 print:text-xs">{claim.ticket.location || "Jabodetabek"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1 print:text-[10px]">Details Location</p>
              <p className="text-sm font-medium text-slate-800 print:text-xs">-</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1 print:text-[10px]">SLA Type</p>
              <p className="text-sm font-medium text-slate-800 print:text-xs">Managed Service</p>
            </div>
          </div>

          {/* Timeline / Description Section */}
          <div className="p-5 bg-slate-50/30 print:bg-white print:py-3 print:px-0 print:border-b print:border-black">
            <div className="flex gap-4">
              <div className="flex-shrink-0 mt-2 print:hidden">
                <div className="h-10 w-10 rounded-full bg-slate-400 flex items-center justify-center text-white font-medium shadow-sm">
                  {claim.employee?.employee_name?.substring(0, 2).toUpperCase() || "SY"}
                </div>
              </div>
              <div className="flex-1">
                <div className="bg-white border border-slate-200 rounded-lg rounded-tl-none p-4 shadow-sm relative print:border-none print:shadow-none print:p-0">
                  {/* Little triangle for chat bubble */}
                  <div className="absolute top-0 -left-[9px] w-0 h-0 border-t-[0px] border-t-transparent border-r-[10px] border-r-slate-200 border-b-[15px] border-b-transparent print:hidden"></div>
                  <div className="absolute top-[1px] -left-[7px] w-0 h-0 border-t-[0px] border-t-transparent border-r-[8px] border-r-white border-b-[12px] border-b-transparent z-10 print:hidden"></div>
                  
                  <div className="flex justify-between items-start mb-3 print:mb-1">
                    <h4 className="font-medium text-slate-800 print:text-sm print:font-semibold">{claim.employee?.employee_name || "System / Requestor"}</h4>
                    <div className="flex items-center gap-2 print:hidden">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">A Day Ago</span>
                      <span className="text-[10px] font-semibold text-white uppercase tracking-wider bg-[#6281c0] px-2 py-0.5 rounded">Description</span>
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 prose-p:my-1 print:text-xs">
                    <p>Mohon dibantu support Activity : {claim.ticket.ticket_title || "Preventive Maintenance"}</p>
                    <p>Terima Kasih.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signature Section for Print */}
      <div className="hidden print:block mt-12 pt-8 print:break-inside-avoid">
        <div className="grid grid-cols-3 gap-8 text-center">
          <div className="space-y-16">
            <p className="font-semibold text-sm">Disetujui Oleh (Karyawan),</p>
            <div>
              <p className="border-b border-black w-3/4 mx-auto"></p>
              <p className="text-sm mt-1">{claim.employee?.employee_name}</p>
              <p className="text-xs text-muted-foreground">
                {claim.approved_at ? dayjs(claim.approved_at).format("DD/MM/YYYY") : "Belum Setuju"}
              </p>
            </div>
          </div>
          <div className="space-y-16">
            <p className="font-semibold text-sm">Disetujui Oleh (Manager),</p>
            <div>
              <p className="border-b border-black w-3/4 mx-auto"></p>
              <p className="text-sm mt-1">{claim.employee?.manager?.employee_name || "Manager"}</p>
              <p className="text-xs text-muted-foreground">
                {claim.manager_status === 'APPROVED' ? "Telah Disetujui (By WA)" : "Pending"}
              </p>
            </div>
          </div>
          <div className="space-y-16">
            <p className="font-semibold text-sm">Disetujui Oleh (HR),</p>
            <div>
              <p className="border-b border-black w-3/4 mx-auto"></p>
              <p className="text-sm mt-1">{claim.employee?.hr?.employee_name || "HR"}</p>
              <p className="text-xs text-muted-foreground">
                {claim.hr_status === 'APPROVED' ? "Telah Disetujui (By WA)" : "Pending"}
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
                <p className="text-sm text-slate-800">{comment.message}</p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  {dayjs(comment.created_at).format("DD MMM YYYY HH:mm")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <SendWADialog
        open={sendWADialogOpen}
        onOpenChange={setSendWADialogOpen}
        claim={claim}
        onSuccess={() => router.refresh()}
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
