import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase-server";

// Settings aplikasi (key-value). Saat ini dipakai untuk rekening kantor
// tujuan penggantian trip "tidak sesuai". Hanya user yang login.
const KEYS = ["company_bank_name", "company_account_number", "company_account_name"] as const;

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data } = await service.from("app_settings").select("key, value").in("key", [...KEYS]);
  const settings = Object.fromEntries((data || []).map((r) => [r.key, r.value || ""]));
  return NextResponse.json({ success: true, data: settings });
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const rows = KEYS.map((key) => ({
    key,
    value: String(body[key] ?? "").trim().slice(0, 100),
    updated_at: new Date().toISOString(),
  })).filter((r) => r.value !== "");
  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: "Tidak ada data untuk disimpan" }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("app_settings")
    .upsert(rows, { onConflict: "key" });
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
