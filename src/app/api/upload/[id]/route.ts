import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase-server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const svc = createServiceClient();

  const { data: upload } = await svc
    .from("uploads")
    .select("id, filename, storage_path")
    .eq("id", id)
    .single();
  if (!upload) {
    return NextResponse.json({ success: false, error: "Upload tidak ditemukan" }, { status: 404 });
  }

  // Hard delete: file fisik dari storage dulu.
  // File hilang/eksis error tidak menghalangi hapus baris — baris adalah sumber kebenaran.
  if (upload.storage_path) {
    const { error: storageError } = await svc
      .storage
      .from("dataperkom")
      .remove([upload.storage_path]);
    if (storageError) {
      console.warn(`[UPLOAD] Gagal hapus file ${upload.storage_path}: ${storageError.message}`);
    }
  }

  // Hapus baris — claims/trips/comments/whatsapp_logs ikut ON DELETE CASCADE
  const { error } = await svc.from("uploads").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
