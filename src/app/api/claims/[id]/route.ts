import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase-server";

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
    } else if (claim.status === 'APPROVED') {
      // Mock ticket for demonstration if none found but claim is approved
      ticket = {
        ticket_id: "32535",
        ticket_title: "Preventive Maintenance (PM 1 of 4) Server DRC - Resona Indonesia Finance",
        customer_name: "Resona Indonesia Finance",
        location: "Jabodetabek",
        amount: claim.total_amount
      };
    }
  }

  let manager_signature = null;
  let hr_signature = null;
  let employee_signature = null;

  if (claim.employee_id) {
    const { data: empSig } = await supabase.from('signatures').select('signature').eq('employee_id', claim.employee_id).single();
    if (empSig) employee_signature = empSig.signature;
  }

  if (claim.manager_id) {
    const { data: managerSig } = await supabase.from('signatures').select('signature').eq('employee_id', claim.manager_id).single();
    if (managerSig) manager_signature = managerSig.signature;
  }

  if (claim.hr_id) {
    const { data: hrSig } = await supabase.from('signatures').select('signature').eq('employee_id', claim.hr_id).single();
    if (hrSig) hr_signature = hrSig.signature;
  }

  return NextResponse.json({
    success: true,
    data: { 
      ...claim, 
      trips: trips || [], 
      comments: comments || [], 
      ticket,
      manager_signature,
      hr_signature,
      employee_signature
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const serviceClient = createServiceClient();
  const body = await request.json();
  const { manager_signature, hr_signature, ...updateData } = body;

  // If there are signatures, fetch the claim first to get the employee IDs
  if (manager_signature || hr_signature) {
    const { data: claimInfo } = await supabase
      .from("claims")
      .select("manager_id, hr_id")
      .eq("id", id)
      .single();

    if (claimInfo) {
      if (manager_signature && claimInfo.manager_id) {
        await serviceClient.from("signatures").upsert({
          employee_id: claimInfo.manager_id,
          signature: manager_signature,
          updated_at: new Date().toISOString()
        }, { onConflict: 'employee_id' });
      }
      if (hr_signature && claimInfo.hr_id) {
        await serviceClient.from("signatures").upsert({
          employee_id: claimInfo.hr_id,
          signature: hr_signature,
          updated_at: new Date().toISOString()
        }, { onConflict: 'employee_id' });
      }
    }
  }

  const { error } = await supabase
    .from("claims")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
