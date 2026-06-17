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

  const claimDetail: ClaimDetail = {
    ...claim,
    trips: trips || [],
    comments: comments || [],
  };

  return <ClaimDetailView claim={claimDetail} />;
}
