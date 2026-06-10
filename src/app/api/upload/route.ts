import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("uploads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const formData = await request.formData();

  const period = formData.get("period") as string;
  const file = formData.get("file") as File;

  if (!period || !file) {
    return NextResponse.json(
      { success: false, error: "Period dan file wajib diisi" },
      { status: 400 }
    );
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase();
  if (!["csv", "pdf"].includes(fileExt || "")) {
    return NextResponse.json(
      { success: false, error: "File harus CSV atau PDF" },
      { status: 400 }
    );
  }

  // Upload to Supabase Storage
  const fileName = `${Date.now()}_${file.name}`;
  const storagePath = `statements/${fileName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("dataperkom")
    .upload(storagePath, buffer, {
      contentType: file.type,
    });

  if (uploadError) {
    return NextResponse.json(
      { success: false, error: uploadError.message },
      { status: 500 }
    );
  }

  // Save metadata
  const { data, error } = await supabase
    .from("uploads")
    .insert({
      period,
      filename: file.name,
      file_type: fileExt,
      storage_path: storagePath,
      status: "UPLOADED",
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}
