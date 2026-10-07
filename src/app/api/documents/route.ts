import { NextRequest, NextResponse, after } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase-server";
import { sendTextMessage } from "@/lib/whatsapp";

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
    .select("id, employee_name, manager_id")
    .eq("id", requested_by)
    .single();

  if (!employee) {
    return NextResponse.json(
      { success: false, error: "Karyawan tidak ditemukan" },
      { status: 404 }
    );
  }

  const [{ data: template }, { data: manager }] = await Promise.all([
    supabase.from("document_templates").select("code, name").eq("id", template_id).single(),
    employee.manager_id
      ? supabase
          .from("employees")
          .select("employee_name, phone_number")
          .eq("id", employee.manager_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

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

  // Notifikasi WA ke manager — best-effort via after(), tidak memblokir respons
  const tplLabel = template ? `${template.code} — ${template.name}` : "dokumen";
  const requesterName = employee.employee_name || "Karyawan";
  after(async () => {
    if (!manager?.phone_number) return;
    try {
      await sendTextMessage(
        manager.phone_number,
        [
          `*Request Dokumen Baru*`,
          ``,
          `Halo ${manager.employee_name || "Manager"},`,
          ``,
          `${requesterName} mengajukan request dokumen:`,
          `${tplLabel} — ${title.trim()}`,
          ...(notes?.trim() ? [`Catatan: ${notes.trim()}`] : []),
          ``,
          `Silakan buka aplikasi (menu *Finance*) untuk menyetujui atau menolak — persetujuan memakai tanda tangan Anda.`,
        ].join("\n")
      );
    } catch (e) {
      console.error("Notif WA request dokumen gagal:", e);
    }
  });

  return NextResponse.json({ success: true, data });
}
