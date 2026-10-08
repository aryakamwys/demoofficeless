import { createServerClient, createServiceClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import { ClaimDetail } from "@/types";
import { ClaimDetailView } from "@/components/claims/claim-detail";
import { AutoRefresh } from "@/components/auto-refresh";

interface ClaimDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ClaimDetailPage({ params }: ClaimDetailPageProps) {
  const { id } = await params;
  const supabase = await createServerClient();
  const serviceClient = createServiceClient();

  // Gelombang 1 — empat query independen berjalan paralel (dulu berurutan:
  // 8 round trip database per render, dan halaman ini di-refresh otomatis
  // tiap 10 detik oleh AutoRefresh).
  const [claimRes, tripsRes, commentsRes, refundsRes] = await Promise.all([
    supabase
      .from("claims")
      .select("*, employee:employees!claims_employee_id_fkey(*)")
      .eq("id", id)
      .single(),
    supabase
      .from("trips")
      .select("*")
      .eq("claim_id", id)
      .order("trip_date", { ascending: true }),
    supabase
      .from("comments")
      .select("*")
      .eq("claim_id", id)
      .order("created_at", { ascending: true }),
    // Penggantian trip "tidak sesuai" — aktif + riwayat audit. Yang dibatalkan
    // TAPI diparaf manager (perjalanan sah) tetap diambil: ttd-nya tampil di
    // kolom Paraf Manager pada tabel Bookings.
    serviceClient
      .from("trip_refunds")
      .select("*")
      .eq("claim_id", id)
      .or("status.neq.CANCELLED,manager_status.eq.APPROVED")
      .order("requested_at", { ascending: true }),
  ]);

  const claim = claimRes.data;
  if (claimRes.error || !claim) {
    notFound();
  }
  const trips = tripsRes.data;
  const comments = commentsRes.data;
  const refunds = refundsRes.data;

  const employeeIdToUse = claim.employee_id;
  const managerIdToUse = claim.manager_id || claim.employee?.manager_id;
  const hrIdToUse = claim.hr_id || claim.employee?.hr_id;

  // Gelombang 2 — dua query yang butuh data klaim (nama employee, id approver)
  const sigIds = [employeeIdToUse, managerIdToUse, hrIdToUse].filter(Boolean) as string[];
  const [ticketRes, sigsRes] = await Promise.all([
    claim.employee?.employee_name
      ? supabase
          .from("managed_service_claims")
          .select("ticket_id, ticket_title, customer_name, location, storage_path")
          .ilike("customer_name", claim.employee.employee_name)
          .order("created_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: null }),
    // Tiga query tanda tangan (employee/manager/HR) digabung satu `.in()`
    sigIds.length
      ? serviceClient
          .from("signatures")
          .select("employee_id, signature")
          .in("employee_id", sigIds)
      : Promise.resolve({ data: null }),
  ]);

  const ticket = ticketRes.data?.[0] ?? null;
  const sigOf = (empId: string | null | undefined) =>
    (sigsRes.data || []).find((s: { employee_id: string }) => s.employee_id === empId)?.signature ?? null;

  // Signed URL bukti transfer dari WA (bucket private) — satu panggilan batch
  const proofPaths = (refunds || [])
    .map((r: { proof_path?: string | null }) => r.proof_path)
    .filter(Boolean) as string[];
  const proofUrlByPath = new Map<string, string>();
  if (proofPaths.length > 0) {
    const { data: proofSigned } = await serviceClient.storage
      .from("dataperkom")
      .createSignedUrls(proofPaths, 3600);
    (proofSigned || []).forEach((s: { path?: string | null; signedUrl?: string | null }) => {
      if (s.path && s.signedUrl) proofUrlByPath.set(s.path, s.signedUrl);
    });
  }
  const refundsWithProof = (refunds || []).map((r: { proof_path?: string | null }) => ({
    ...r,
    proof_url: r.proof_path ? proofUrlByPath.get(r.proof_path) ?? null : null,
  }));

  const claimDetail: ClaimDetail = {
    ...claim,
    trips: trips || [],
    comments: comments || [],
    ticket,
    manager_signature: sigOf(managerIdToUse),
    hr_signature: sigOf(hrIdToUse),
    employee_signature: sigOf(employeeIdToUse),
    refunds: refundsWithProof
  };

  return (
    <>
      {/* Klaim final tidak di-poll lagi — 6 query + payload base64 ttd tiap 10s
          tidak ada gunanya setelah APPROVED. */}
      <AutoRefresh enabled={claim.status !== "APPROVED"} />
      <ClaimDetailView claim={claimDetail} />
    </>
  );
}
