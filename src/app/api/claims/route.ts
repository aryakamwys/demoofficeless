import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { searchParams } = new URL(request.url);

  // If requesting distinct periods
  if (searchParams.get("distinct_periods") === "true") {
    const { data } = await supabase
      .from("claims")
      .select("period")
      .order("period", { ascending: false });

    const periods = [...new Set(data?.map((c) => c.period) || [])];
    return NextResponse.json({ success: true, data: periods });
  }

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const period = searchParams.get("period") || "";
  const uploadId = searchParams.get("upload_id") || "";

  let query = supabase
    .from("claims")
    // Kolom employee dibatasi ke yang dipakai UI (nama) + pencarian (NIP) —
    // dulu join full row: payload 500 klaim membawa semua field karyawan
    .select("*, employee:employees!claims_employee_id_fkey(id, employee_name, employee_number)")
    .order("updated_at", { ascending: false })
    // ponytail: pengaman pertumbuhan data — dataset klaim internal jauh di
    // bawah ini; ganti ke pagination server kalau sudah mendekati
    .limit(500);

  if (status) {
    query = query.eq("status", status);
  }

  if (period) {
    query = query.eq("period", period);
  }

  if (uploadId) {
    query = query.eq("upload_id", uploadId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // Client-side search filter (employee name/number)
  let filtered = data || [];
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.employee?.employee_name?.toLowerCase().includes(s) ||
        c.employee?.employee_number?.toLowerCase().includes(s)
    );
  }

  return NextResponse.json({ success: true, data: filtered });
}
