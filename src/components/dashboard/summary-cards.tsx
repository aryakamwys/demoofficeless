import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardSummary } from "@/types";
import {
  Users,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface SummaryCardsProps {
  summary: DashboardSummary;
}

const cards = [
  {
    key: "total_employees" as const,
    title: "Total Employees",
    icon: Users,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    key: "total_claims" as const,
    title: "Total Claims",
    icon: FileText,
    color: "text-slate-600",
    bg: "bg-slate-50",
  },
  {
    key: "pending_claims" as const,
    title: "Pending",
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    key: "approved_claims" as const,
    title: "Approved",
    icon: CheckCircle,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    key: "need_review_claims" as const,
    title: "Need Review",
    icon: AlertCircle,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
];

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.key}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`rounded-lg p-2 ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary[card.key]}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
