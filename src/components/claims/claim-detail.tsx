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
                  {sendingWA
                    ? "Sending..."
                    : claim.wa_sent
                      ? "Resend WhatsApp"
                      : "Send WhatsApp"}
                </Button>
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
      <Card className="shadow-sm border-slate-200 overflow-hidden print:shadow-none print:border-none">
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
      
      {/* Signature Section for Print */}
      <div className="hidden print:block mt-12 pt-8">
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
