import { createServerClient } from "@/lib/supabase-server";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { AutoRefresh } from "@/components/auto-refresh";
import { DashboardSummary } from "@/types";

async function getDashboardData() {
  const supabase = await createServerClient();

  // Fetch summary counts
  const [employeesRes, claimsRes, pendingRes, approvedRes, needReviewRes] =
    await Promise.all([
      supabase
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabase.from("claims").select("*", { count: "exact", head: true }),
      supabase
        .from("claims")
        .select("*", { count: "exact", head: true })
        .eq("status", "PENDING"),
      supabase
        .from("claims")
        .select("*", { count: "exact", head: true })
        .eq("status", "APPROVED"),
      supabase
        .from("claims")
        .select("*", { count: "exact", head: true })
        .eq("status", "NEED_REVIEW"),
    ]);

  const summary: DashboardSummary = {
    total_employees: employeesRes.count || 0,
    total_claims: claimsRes.count || 0,
    pending_claims: pendingRes.count || 0,
    approved_claims: approvedRes.count || 0,
    need_review_claims: needReviewRes.count || 0,
  };

  return { summary };
}

export default async function DashboardPage() {
  const { summary } = await getDashboardData();

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <SummaryCards summary={summary} />
    </div>
  );
}
