import { createServerClient } from "@/lib/supabase-server";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { RecentClaimsTable } from "@/components/dashboard/recent-claims-table";
import { DashboardSummary, ClaimWithEmployee } from "@/types";

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

  // Fetch recent claims with employee info
  const { data: recentClaims } = await supabase
    .from("claims")
    .select("*, employee:employees(*)")
    .order("updated_at", { ascending: false })
    .limit(10);

  return {
    summary,
    recentClaims: (recentClaims || []) as ClaimWithEmployee[],
  };
}

export default async function DashboardPage() {
  const { summary, recentClaims } = await getDashboardData();

  return (
    <div className="space-y-6">
      <SummaryCards summary={summary} />
      <RecentClaimsTable claims={recentClaims} />
    </div>
  );
}
