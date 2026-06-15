"use client";

import { useState } from "react";
import { ClaimDetail } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/claims/status-badge";
import { Send, Info, UserCheck, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

interface ClaimDetailViewProps {
  claim: ClaimDetail;
}

export function ClaimDetailView({ claim }: ClaimDetailViewProps) {
  const router = useRouter();
  const [sendingWA, setSendingWA] = useState(false);
  const [approving, setApproving] = useState(false);

  const handleSendWA = async () => {
    setSendingWA(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: claim.id }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("WhatsApp berhasil dikirim");
        router.refresh();
      } else {
        toast.error(result.error || "Gagal mengirim WhatsApp");
      }
    } finally {
      setSendingWA(false);
    }
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

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      {/* Header matching Grab Style */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
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
        <div className="flex gap-3">
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-4 items-start shadow-sm">
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">
              Employee Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <InfoRow label="Employee Number" value={claim.employee?.employee_number || "—"} />
            <InfoRow label="Full Name" value={claim.employee?.employee_name || "—"} />
            <InfoRow label="Phone" value={claim.employee?.phone_number || "—"} />
            <InfoRow label="Department" value={claim.employee?.department || "—"} />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">
              Claim Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <InfoRow label="Total Trips" value={claim.trip_count.toString()} />
            <InfoRow label="Total Amount" value={`IDR ${claim.total_amount.toLocaleString("id-ID")}`} />
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-500">Status</span>
              <StatusBadge status={claim.status} />
            </div>
            {claim.approved_at && (
              <InfoRow label="Approved At" value={dayjs(claim.approved_at).format("DD MMM YYYY HH:mm")} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trip Details - Grab Style Table with borders */}
      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <CardHeader className="bg-white border-b pb-4">
          <CardTitle className="text-base font-semibold text-slate-800">Bookings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px] border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">
                    Date & Time<br/><span className="font-normal text-xs text-slate-400">(GMT+7)</span>
                  </th>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">Employee Name</th>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">Service Type</th>
                  <th className="border border-slate-200 px-3 py-3 text-right font-semibold text-slate-600 whitespace-nowrap">Total Fare</th>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">Payment Method</th>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">Employee Group</th>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">Trip / Cost Code Description</th>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">Pick-Up Address</th>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap">Drop-Off Address</th>
                </tr>
              </thead>
              <tbody>
                {claim.trips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="border border-slate-200 px-3 py-3 whitespace-nowrap align-top">
                      {dayjs(trip.trip_date).format("DD MMM YYYY,")}<br/>
                      <span className="text-slate-500">{dayjs(trip.trip_date).format("hh:mm:ss A")}</span>
                    </td>
                    <td className="border border-slate-200 px-3 py-3 align-top font-medium">
                      {claim.employee?.employee_name || "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 align-top text-slate-600">
                      {trip.service_type || "Car Standard"}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 text-right align-top font-medium text-slate-800 whitespace-nowrap">
                      IDR {trip.fare.toLocaleString("id-ID")}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 align-top text-slate-600">
                      {trip.payment_method || "Corporate Billing"}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 align-top text-slate-600">
                      {trip.employee_group || "General"}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 align-top text-slate-600 max-w-[200px]">
                      {trip.cost_code || "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 align-top text-slate-600 max-w-[250px] leading-relaxed">
                      {trip.pickup || "—"}
                    </td>
                    <td className="border border-slate-200 px-3 py-3 align-top text-slate-600 max-w-[250px] leading-relaxed">
                      {trip.dropoff || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Comments */}
      {claim.comments.length > 0 && (
        <Card className="shadow-sm border-slate-200">
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
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}
