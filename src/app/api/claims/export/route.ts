import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import dayjs from "dayjs";

// Semua nilai dikutip, kutip dalam di-ganda, dan nilai yang diawali = + - @
// diberi prefiks ' — supaya koma/tanda kutip di data upload tidak menggeser
// kolom dan Excel tidak mengeksekusi sel sebagai formula.
function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "";
  const period = searchParams.get("period") || "";
  const uploadId = searchParams.get("upload_id") || "";
  const search = (searchParams.get("search") || "").toLowerCase();

  let query = supabase
    .from("claims")
    .select("*, employee:employees!claims_employee_id_fkey(*)")
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (period) query = query.eq("period", period);
  if (uploadId) query = query.eq("upload_id", uploadId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // Search di-filter di server dengan semantik yang sama seperti list
  // (/api/claims): substring case-insensitive pada nama/nomor karyawan.
  const rows = (data || []).filter((claim) => {
    if (!search) return true;
    // Join Supabase bisa balikin object atau array — terima keduanya.
    const emp = claim.employee as
      | { employee_name?: string; employee_number?: string }
      | { employee_name?: string; employee_number?: string }[]
      | null;
    const e = Array.isArray(emp) ? emp[0] : emp;
    return (
      e?.employee_name?.toLowerCase().includes(search) ||
      e?.employee_number?.toLowerCase().includes(search)
    );
  });

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
  ].map(csvEscape);

  const csvRows = rows.map((claim) => {
    return [
      csvEscape(claim.employee?.employee_number || ""),
      csvEscape(claim.employee?.employee_name || ""),
      csvEscape(claim.employee?.department || ""),
      csvEscape(claim.period),
      csvEscape(claim.trip_count),
      csvEscape(claim.total_amount),
      csvEscape(claim.status),
      csvEscape(
        claim.approved_at
          ? dayjs(claim.approved_at).format("YYYY-MM-DD HH:mm")
          : ""
      ),
    ].join(",");
  });

  const csv = [header, ...csvRows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="claims_report_${dayjs().format("YYYYMMDD")}.csv"`,
    },
  });
}
