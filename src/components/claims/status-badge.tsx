import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pending", variant: "secondary" },
  SENT: { label: "Sent", variant: "default" },
  APPROVED: { label: "Approved", variant: "default" },
  NEED_REVIEW: { label: "Need Review", variant: "destructive" },
  UNMATCHED: { label: "Unmatched", variant: "outline" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  MERGED: { label: "Merged", variant: "secondary" },
};

const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700 border-gray-200",
  SENT: "bg-blue-100 text-blue-700 border-blue-200",
  APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  NEED_REVIEW: "bg-orange-100 text-orange-700 border-orange-200",
  UNMATCHED: "bg-red-100 text-red-700 border-red-200",
  REJECTED: "bg-red-100 text-red-700 border-red-200",
  MERGED: "bg-slate-100 text-slate-700 border-slate-200",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: "secondary" as const };
  const colorClass = statusColors[status] || "";

  return (
    <Badge variant="outline" className={colorClass}>
      {config.label}
    </Badge>
  );
}
