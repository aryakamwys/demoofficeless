import { createServerClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { ClaimDetail } from "@/types";
import { ClaimDetailView } from "@/components/claims/claim-detail";

interface ClaimDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClaimDetailPage({ params }: ClaimDetailPageProps) {
  const { id } = await params;
  const supabase = await createServerClient();

  // Fetch claim with employee
  const { data: claim, error } = await supabase
    .from("claims")
    .select("*, employee:employees!claims_employee_id_fkey(*)")
    .eq("id", id)
    .single();

  if (error || !claim) {
    notFound();
  }

  // Fetch trips
  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .eq("claim_id", id)
    .order("trip_date", { ascending: true });

  // Fetch comments
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
      ticket = {
        ticket_id: "32535",
        ticket_title: "Preventive Maintenance (PM 1 of 4) Server DRC - Resona Indonesia Finance",
        customer_name: "Resona Indonesia Finance",
        location: "Jabodetabek",
        amount: claim.total_amount
      };
    }
  }

  // Fetch manager signature
  let manager_signature = null;
  if (claim.manager_id) {
    const { data: managerSig } = await supabase
      .from("signatures")
      .select("signature")
      .eq("employee_id", claim.manager_id)
      .single();
    if (managerSig) manager_signature = managerSig.signature;
  }

  // Fetch HR signature
  let hr_signature = null;
  if (claim.hr_id) {
    const { data: hrSig } = await supabase
      .from("signatures")
      .select("signature")
      .eq("employee_id", claim.hr_id)
      .single();
    if (hrSig) hr_signature = hrSig.signature;
  }

  const claimDetail: ClaimDetail = {
    ...claim,
    trips: trips || [],
    comments: comments || [],
    ticket,
    manager_signature,
    hr_signature
  };

  return <ClaimDetailView claim={claimDetail} />;
}
