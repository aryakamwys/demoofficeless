import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase-server";
import { getSuperadminUser } from "@/lib/superadmin";
import { FinanceTabs } from "@/components/finance/finance-tabs";
import type { FinanceClaimRow } from "@/components/services/finance-report";

export const metadata: Metadata = { title: "Finance — Officeless Perkom" };

export default async function FinancePage() {
  const supabase = await createServerClient();
  const admin = await getSuperadminUser();

  const { data } = await supabase
    .from("claims")
    .select("id, period, trip_count, total_amount, approved_at, employee:employees(employee_name)")
    .eq("status", "APPROVED")
    .order("approved_at", { ascending: false });

  const claims: FinanceClaimRow[] = (data || []).map((c) => {
    // Join Supabase bisa balikin object atau array — terima keduanya.
    const emp = c.employee as { employee_name?: string } | { employee_name?: string }[] | null;
    return {
      id: c.id,
      period: c.period,
      employee_name: (Array.isArray(emp) ? emp[0]?.employee_name : emp?.employee_name) || "—",
      trip_count: c.trip_count ?? 0,
      total_amount: c.total_amount ?? 0,
      approved_at: c.approved_at,
    };
  });

  return <FinanceTabs claims={claims} isSuperadmin={!!admin} />;
}
