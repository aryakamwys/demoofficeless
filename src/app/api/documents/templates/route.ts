import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getSuperadminUser } from "@/lib/superadmin";

export async function GET() {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("document_templates")
    .select("*")
    .order("code", { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}

// Tambah/ubah template — hanya superadmin
export async function POST(request: NextRequest) {
  const admin = await getSuperadminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Hanya superadmin" }, { status: 403 });
  }

  const supabase = await createServerClient();
  const { code, name } = await request.json();
  if (!code?.trim() || !name?.trim()) {
    return NextResponse.json(
      { success: false, error: "Kode dan nama template wajib diisi" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("document_templates")
    .upsert(
      { code: code.trim().toUpperCase(), name: name.trim() },
      { onConflict: "code" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}

// Aktif/nonaktifkan template — hanya superadmin
export async function PATCH(request: NextRequest) {
  const admin = await getSuperadminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Hanya superadmin" }, { status: 403 });
  }

  const supabase = await createServerClient();
  const { id, active } = await request.json();
  if (!id) {
    return NextResponse.json({ success: false, error: "id wajib" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("document_templates")
    .update({ active: Boolean(active) })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: error?.message || "Template tidak ditemukan" },
      { status: error ? 500 : 404 }
    );
  }
  return NextResponse.json({ success: true, data });
}
