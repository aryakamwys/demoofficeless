import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("document_requests")
    .select(`
      *,
      template:document_templates(code, name),
      requester:employees!document_requests_requested_by_fkey(employee_name),
      approver:employees!document_requests_approver_id_fkey(employee_name)
    `)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // File hasil (bucket private) — satu panggilan batch untuk semua path
  const storage = createServiceClient().storage.from("dataperkom");
  const paths = (data || []).map((r) => r.result_path).filter(Boolean) as string[];
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await storage.createSignedUrls(paths, 3600);
    (signed || []).forEach((s) => {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    });
  }

  const rows = (data || []).map((r) => ({
    ...r,
    result_url: r.result_path ? urlByPath.get(r.result_path) ?? null : null,
  }));

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  await supabase.auth.getUser();

  const body = await request.json();
  const { template_id, title, notes, requested_by } = body as {
    template_id?: string;
    title?: string;
    notes?: string;
    requested_by?: string;
  };

  if (!template_id || !title?.trim() || !requested_by) {
    return NextResponse.json(
      { success: false, error: "Template, judul keperluan, dan karyawan wajib diisi" },
      { status: 400 }
    );
  }

  // Approver disnapshot dari manager si pengaju saat diajukan
  const { data: employee } = await supabase
    .from("employees")
    .select("id, manager_id")
    .eq("id", requested_by)
    .single();

  if (!employee) {
    return NextResponse.json(
      { success: false, error: "Karyawan tidak ditemukan" },
      { status: 404 }
    );
  }

  const { data, error } = await supabase
    .from("document_requests")
    .insert({
      template_id,
      title: title.trim(),
      notes: notes?.trim() || null,
      requested_by,
      approver_id: employee.manager_id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
