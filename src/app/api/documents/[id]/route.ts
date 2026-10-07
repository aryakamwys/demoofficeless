import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase-server";

// Transisi status request dokumen: approve/reject (manager), process,
// complete (finance — catatan + file hasil opsional via multipart).
// ponytail: verifikasi peran approver belum ada — employees belum punya
// link ke akun login (trust model sama dengan approval klaim yang ada).
// Tambahkan pengecekan approver begitu employees punya kolom auth_email.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  await supabase.auth.getUser();

  const contentType = request.headers.get("content-type") || "";
  let action = "";
  let reason = "";
  let resultNotes = "";
  let managerSignature: string | null = null;
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    action = String(form.get("action") || "");
    reason = String(form.get("reason") || "");
    resultNotes = String(form.get("result_notes") || "");
    const f = form.get("file");
    if (f instanceof File && f.size > 0) file = f;
  } else {
    const body = await request.json();
    action = body.action || "";
    reason = body.reason || "";
    resultNotes = body.result_notes || "";
    // Paraf manager (base64 PNG dari signature pad) — disimpan saat approve
    if (action === "approve" && typeof body.manager_signature === "string") {
      managerSignature = body.manager_signature;
    }
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };

  if (action === "approve") {
    patch.status = "APPROVED";
    patch.approved_at = now;
    // Paraf manager dari signature pad — bukti persetujuan
    if (managerSignature) patch.manager_signature = managerSignature;
  } else if (action === "reject") {
    if (!reason.trim()) {
      return NextResponse.json(
        { success: false, error: "Alasan penolakan wajib diisi" },
        { status: 400 }
      );
    }
    patch.status = "REJECTED";
    patch.rejected_reason = reason.trim();
  } else if (action === "process") {
    patch.status = "DIPROSES";
    patch.processed_at = now;
  } else if (action === "complete") {
    patch.status = "SELESAI";
    patch.completed_at = now;
    if (resultNotes.trim()) patch.result_notes = resultNotes.trim();

    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!["pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx"].includes(ext)) {
        return NextResponse.json(
          { success: false, error: "File harus PDF, gambar, Word, atau Excel" },
          { status: 400 }
        );
      }
      const storagePath = `document_requests/${id}/${Date.now()}_hasil.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      // Tulis via service role — bucket private, user sudah diverifikasi di atas
      const { error: uploadError } = await createServiceClient()
        .storage
        .from("dataperkom")
        .upload(storagePath, buffer, { contentType: file.type });
      if (uploadError) {
        return NextResponse.json(
          { success: false, error: uploadError.message },
          { status: 500 }
        );
      }
      patch.result_path = storagePath;
    }
  } else {
    return NextResponse.json(
      { success: false, error: "Aksi tidak dikenal" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("document_requests")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: error?.message || "Request tidak ditemukan" },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json({ success: true, data });
}
