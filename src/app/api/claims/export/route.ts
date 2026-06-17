import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import dayjs from "dayjs";

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "";
  const period = searchParams.get("period") || "";

  let query = supabase
    .from("claims")
    .select("*, employee:employees!claims_employee_id_fkey(*)")
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (period) query = query.eq("period", period);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // Build CSV
  const header = [
    "Employee Number",
    "Employee Name",
    "Department",
    "Period",
    "Trip Count",
    "Total Amount",
    "Status",
    "Approved Date",
  ].join(",");

  const rows =
    data?.map((claim) => {
      return [
        claim.employee?.employee_number || "",
        `"${claim.employee?.employee_name || ""}"`,
        `"${claim.employee?.department || ""}"`,
        claim.period,
        claim.trip_count,
        claim.total_amount,
        claim.status,
        claim.approved_at
          ? dayjs(claim.approved_at).format("YYYY-MM-DD HH:mm")
          : "",
      ].join(",");
    }) || [];

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="claims_report_${dayjs().format("YYYYMMDD")}.csv"`,
    },
  });
}
