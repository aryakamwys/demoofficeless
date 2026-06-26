import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("managed_service_claims")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  // Fetch pending Grab claims
  const { data: grabClaims, error: grabError } = await supabase
    .from("claims")
    .select(`
      id,
      total_amount,
      status,
      period,
      employee:employees(name)
    `)
    .eq("status", "PENDING");

  // Attach grab_match if customer_name matches employee name
  const enrichedData = data.map((mClaim) => {
    let grab_match = null;
    if (grabClaims && mClaim.customer_name) {
      const match = grabClaims.find(
        (gc) => {
          const empName = Array.isArray(gc.employee) ? gc.employee[0]?.name : (gc.employee as any)?.name;
          return empName && empName.toLowerCase() === mClaim.customer_name?.toLowerCase();
        }
      );
      if (match) {
        grab_match = match;
      }
    }
    return {
      ...mClaim,
      grab_match,
    };
  });

  return NextResponse.json({ success: true, data: enrichedData });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

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
  
  const { data: publicUrlData } = supabase.storage.from("dataperkom").getPublicUrl(storagePath);
  const fileUrl = publicUrlData.publicUrl;

  // Save metadata
  const { data, error } = await supabase
    .from("managed_service_claims")
    .insert({
      ticket_id,
      ticket_title,
      customer_name,
      location,
      amount: parseFloat(amount),
      file_url: fileUrl,
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
