import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// Ambil signature SATU employee on-demand (dipakai dialog edit).
// List /api/employees sengaja tidak mengirim base64 agar ringan.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("signatures")
    .select("signature")
    .eq("employee_id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: data?.signature ?? null });
}
