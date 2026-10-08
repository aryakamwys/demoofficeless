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
  const filesToRemove: string[] = [];
  if (upload.storage_path) filesToRemove.push(upload.storage_path);

  // Bukti TF penggantian ikut dibersihkan (barisnya cascade, file di storage tidak)
  const { data: claimIds } = await svc
    .from("claims")
    .select("id")
    .eq("upload_id", id);
  if (claimIds && claimIds.length > 0) {
    const { data: proofs } = await svc
      .from("trip_refunds")
      .select("proof_path")
      .in("claim_id", claimIds.map((c: { id: string }) => c.id));
    for (const p of proofs || []) {
      if (p.proof_path) filesToRemove.push(p.proof_path);
    }
  }
  if (filesToRemove.length > 0) {
    const { error: storageError } = await svc
      .storage
      .from("dataperkom")
      .remove(filesToRemove);
    if (storageError) {
      console.warn(`[UPLOAD] Gagal hapus ${filesToRemove.length} file storage: ${storageError.message}`);
    }
  }

  // Hapus baris — claims/trips/comments/whatsapp_logs ikut ON DELETE CASCADE
  const { error } = await svc.from("uploads").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
