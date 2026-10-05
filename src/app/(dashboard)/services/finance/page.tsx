import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase-server";
import { FinanceReport, type FinanceClaimRow } from "@/components/services/finance-report";

export const metadata: Metadata = { title: "Finance — Officeless Perkom" };

export default async function FinancePage() {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("claims")
    .select("id, period, trip_count, total_amount, approved_at, employee:employees(name)")
    .eq("status", "APPROVED")
    .order("approved_at", { ascending: false });

  const claims: FinanceClaimRow[] = (data || []).map((c) => {
    // Join Supabase bisa balikin object atau array — terima keduanya.
    const emp = c.employee as { name?: string } | { name?: string }[] | null;
    return {
      id: c.id,
      period: c.period,
      employee_name: (Array.isArray(emp) ? emp[0]?.name : emp?.name) || "—",
      trip_count: c.trip_count ?? 0,
      total_amount: c.total_amount ?? 0,
      approved_at: c.approved_at,
    };
  });

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h1 className="text-lg font-semibold">Finance</h1>
        <p className="text-sm text-slate-500">
          Klaim Grab yang sudah disetujui Manager &amp; HR — siap diproses
          pembayarannya. Bisa diunduh sebagai Excel atau PDF (cetak).
        </p>
      </div>
      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Gagal memuat data klaim: {error.message}
        </div>
      ) : (
        <FinanceReport claims={claims} />
      )}
    </div>
  );
}
