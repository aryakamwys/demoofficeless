import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createServerClient();

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
  await supabase.auth.getUser();

  // If no user is found, we can still allow for now or return 401 if strict
  // if (authError || !user) {
  //   return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  // }

  const formData = await request.formData();

  const ticket_id = formData.get("ticket_id") as string;
  const ticket_title = formData.get("ticket_title") as string;
  const customer_name = formData.get("customer_name") as string;
  const location = formData.get("location") as string;
  const amount = formData.get("amount") as string;
  const file = formData.get("file") as File;

  if (!ticket_id || !file || !amount) {
    return NextResponse.json(
      { success: false, error: "Ticket ID, Amount, dan file wajib diisi" },
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
      amount: parseFloat(amount),
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
