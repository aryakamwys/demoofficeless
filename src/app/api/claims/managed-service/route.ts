import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase-server";

// Field opsional form-data: null / non-string (File) → undefined (kolom nullable)
const optionalText = (value: FormDataEntryValue | null): string | undefined =>
  typeof value === "string" ? value : undefined;

export async function GET() {
  const supabase = await createServerClient();

  // Endpoint ini menyerahkan signed URL dokumen — wajib login
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }


  const { data, error } = await supabase
    .from("managed_service_claims")
    .select("*")
    .order("created_at", { ascending: false })
    // ponytail: pengaman pertumbuhan data — naikkan/pagination kalau mendekati
    .limit(200);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // Fetch pending Grab claims
  const { data: grabClaims } = await supabase
    .from("claims")
    .select(`
      id,
      total_amount,
      status,
      period,
      employee:employees(employee_name)
    `)
    .eq("status", "PENDING")
    .limit(200);

  // Signed URL file (bucket private) — dulu satu request storage per baris;
  // sekarang satu panggilan batch untuk semua path.
  const storage = createServiceClient().storage.from("dataperkom");
  const paths = (data || []).map((m) => m.storage_path).filter(Boolean) as string[];
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signedBatch } = await storage.createSignedUrls(paths, 3600);
    (signedBatch || []).forEach((s) => {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    });
  }

  const enrichedData = (data || []).map((mClaim) => {
    let grab_match = null;
    if (grabClaims && mClaim.customer_name) {
      const match = grabClaims.find(
        (gc) => {
          // Join Supabase bisa balikin object atau array — terima keduanya.
          const emp = gc.employee as { employee_name?: string } | { employee_name?: string }[] | null;
          const empName = Array.isArray(emp) ? emp[0]?.employee_name : emp?.employee_name;
          return empName && empName.toLowerCase() === mClaim.customer_name?.toLowerCase();
        }
      );
      if (match) {
        grab_match = match;
      }
    }
    return {
      ...mClaim,
      file_url: mClaim.storage_path ? urlByPath.get(mClaim.storage_path) ?? null : null,
      grab_match,
    };
  });

  return NextResponse.json({ success: true, data: enrichedData });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();

  // Tulis DB & storage hanya untuk user terautentikasi
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();

  const ticket_id = formData.get("ticket_id");
  const ticket_title = optionalText(formData.get("ticket_title"));
  const customer_name = optionalText(formData.get("customer_name"));
  const location = optionalText(formData.get("location"));
  const amount = formData.get("amount");
  const file = formData.get("file");

  if (typeof ticket_id !== "string" || !ticket_id || !(file instanceof File) || !amount) {
    return NextResponse.json(
      { success: false, error: "Ticket ID, Amount, dan file wajib diisi" },
      { status: 400 }
    );
  }

  const parsedAmount = typeof amount === "string" ? Number.parseFloat(amount) : NaN;
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json(
      { success: false, error: "Amount harus berupa angka lebih dari 0" },
      { status: 400 }
    );
  }

  // Cek ukuran SEBELUM buffer di memori
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: "Ukuran file maksimal 10 MB" },
      { status: 400 }
    );
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase();
  if (!["jpg", "jpeg", "png", "pdf"].includes(fileExt || "")) {
    return NextResponse.json(
      { success: false, error: "File harus berupa Gambar (JPG/PNG) atau PDF" },
      { status: 400 }
    );
  }

  // Upload to Supabase Storage
  const fileName = `${Date.now()}_ticket_${ticket_id}.${fileExt}`;
  const storagePath = `claims/managed_service/${fileName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  // Tulis via service role — user sudah diverifikasi di atas
  const { error: uploadError } = await createServiceClient().storage
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

  // Save metadata — path saja; URL publik tidak dipakai lagi (bucket private)
  const { data, error } = await supabase
    .from("managed_service_claims")
    .insert({
      ticket_id,
      ticket_title,
      customer_name,
      location,
      amount: parsedAmount,
      storage_path: storagePath,
      status: "pending"
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
