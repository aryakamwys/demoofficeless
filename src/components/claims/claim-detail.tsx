"use client";

import { ClaimDetail } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/claims/status-badge";
import { Send } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

interface ClaimDetailViewProps {
  claim: ClaimDetail;
}

export function ClaimDetailView({ claim }: ClaimDetailViewProps) {
  const router = useRouter();

  const handleSendWA = async () => {
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim_id: claim.id }),
    });
    const result = await res.json();
    if (result.success && result.wa_url) {
      toast.success("Membuka WhatsApp...");
      window.open(result.wa_url, "_blank");
      router.refresh();
    } else {
      toast.error(result.error || "Gagal membuat tautan WhatsApp");
    }
  };

  const handleApprove = async () => {
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
  };

  return (
    <div className="space-y-6">
      {/* Top section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {claim.employee?.employee_name || "Unmatched Employee"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Periode: {claim.period}
          </p>
        </div>
        <div className="flex gap-2">
          {claim.employee &&
            (claim.status === "PENDING" || claim.status === "SENT") && (
              <>
                <Button variant="secondary" onClick={handleApprove}>
                  Approve Manual
                </Button>
                <Button onClick={handleSendWA}>
                  <Send className="mr-2 h-4 w-4" />
                  {claim.wa_sent ? "Resend WhatsApp" : "Send WhatsApp"}
                </Button>
              </>
            )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Employee Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Employee Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              label="Employee Number"
              value={claim.employee?.employee_number || "—"}
            />
            <InfoRow
              label="Nama"
              value={claim.employee?.employee_name || "—"}
            />
            <InfoRow
              label="Phone"
              value={claim.employee?.phone_number || "—"}
            />
            <InfoRow
              label="Department"
              value={claim.employee?.department || "—"}
            />
          </CardContent>
        </Card>

        {/* Claim Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Claim Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Period" value={claim.period} />
            <InfoRow
              label="Trip Count"
              value={claim.trip_count.toString()}
            />
            <InfoRow
              label="Total Amount"
              value={`Rp${claim.total_amount.toLocaleString("id-ID")}`}
            />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusBadge status={claim.status} />
            </div>
            {claim.approved_at && (
              <InfoRow
                label="Approved At"
                value={dayjs(claim.approved_at).format("DD MMM YYYY HH:mm")}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trip Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trip Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Booking ID</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Dropoff</TableHead>
                <TableHead className="text-right">Fare</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claim.trips.map((trip) => (
                <TableRow key={trip.id}>
                  <TableCell>
                    {dayjs(trip.trip_date).format("DD MMM YYYY")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {trip.booking_id || "—"}
                  </TableCell>
                  <TableCell className="max-w-48 truncate">
                    {trip.pickup || "—"}
                  </TableCell>
                  <TableCell className="max-w-48 truncate">
                    {trip.dropoff || "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    Rp{trip.fare.toLocaleString("id-ID")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Comments */}
      {claim.comments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comments / Koreksi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {claim.comments.map((comment, i) => (
              <div key={comment.id}>
                {i > 0 && <Separator className="mb-3" />}
                <p className="text-sm">{comment.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
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
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
