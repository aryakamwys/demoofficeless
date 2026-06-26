import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { managedClaimId, grabClaimId } = await request.json();

    if (!managedClaimId || !grabClaimId) {
      return NextResponse.json(
        { success: false, error: "Missing required IDs" },
        { status: 400 }
      );
    }

    // 1. Fetch managed_service_claim
    const { data: managedClaim, error: mError } = await supabase
      .from("managed_service_claims")
      .select("id, amount")
      .eq("id", managedClaimId)
      .single();

    if (mError || !managedClaim) {
      return NextResponse.json({ success: false, error: "Managed Claim not found" }, { status: 404 });
    }

    // 2. Fetch Grab claim
    const { data: grabClaim, error: gError } = await supabase
      .from("claims")
      .select("id, total_amount, status")
      .eq("id", grabClaimId)
      .single();

    if (gError || !grabClaim) {
      return NextResponse.json({ success: false, error: "Grab Claim not found" }, { status: 404 });
    }

    if (grabClaim.status === "MERGED") {
      return NextResponse.json({ success: false, error: "Grab Claim is already merged" }, { status: 400 });
    }

    // 3. Update managed_service_claim amount
    const newAmount = Number(managedClaim.amount) + Number(grabClaim.total_amount);
    const { error: updateError } = await supabase
      .from("managed_service_claims")
      .update({ amount: newAmount })
      .eq("id", managedClaimId);

    if (updateError) {
      throw new Error("Failed to update managed claim amount");
    }

    // 4. Update grab claim status
    const { error: grabUpdateError } = await supabase
      .from("claims")
      .update({ status: "MERGED" })
      .eq("id", grabClaimId);

    if (grabUpdateError) {
      throw new Error("Failed to update grab claim status");
    }

    return NextResponse.json({ success: true, message: "Successfully merged claims" });
  } catch (error: any) {
    console.error("Merge error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
