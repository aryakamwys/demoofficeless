import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: claim, error } = await supabase
    .from("claims")
    .select("*, employee:employees!claims_employee_id_fkey(*)")
    .eq("id", id)
    .single();

  if (error || !claim) {
    return NextResponse.json(
      { success: false, error: "Claim tidak ditemukan" },
      { status: 404 }
    );
  }

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .eq("claim_id", id)
    .order("trip_date", { ascending: true });

  const { data: comments } = await supabase
    .from("comments")
    .select("*")
    .eq("claim_id", id)
    .order("created_at", { ascending: true });

  let ticket = null;
  if (claim.employee?.employee_name) {
    const { data: tickets } = await supabase
      .from("managed_service_claims")
      .select("*")
      .ilike("customer_name", claim.employee.employee_name)
      .order("created_at", { ascending: false })
      .limit(1);
    
    if (tickets && tickets.length > 0) {
      ticket = tickets[0];
    }
  }

  return NextResponse.json({
    success: true,
    data: { ...claim, trips: trips || [], comments: comments || [], ticket },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const body = await request.json();

  const { error } = await supabase
    .from("claims")
    .update(body)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
