import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase-server";
import { z } from "zod";

const tripEditSchema = z.object({
  fare: z.number().positive("Nominal harus lebih dari 0").max(100_000_000).optional(),
  pickup: z.string().max(500).optional(),
  dropoff: z.string().max(500).optional(),
});

async function getTripWithClaim(tripId: string) {
  const svc = createServiceClient();
  const { data: trip } = await svc
    .from("trips")
    .select("*, claim:claims(status, manager_status)")
    .eq("id", tripId)
    .single();
  return trip as
    | {
        id: string;
        claim_id: string;
        fare: number;
        pickup: string;
        dropoff: string;
        claim: { status: string; manager_status: string } | null;
      }
    | null;
}

async function recalcAndNote(
  claimId: string,
  claim: { status: string; manager_status: string },
  note: string,
  author: string
) {
  const svc = createServiceClient();
  const { data: fares } = await svc.from("trips").select("fare").eq("claim_id", claimId);
  const total = (fares || []).reduce((acc, t) => acc + Number(t.fare), 0);

  // Nominal berubah setelah manager approve → perlu approval ulang
  const patch: Record<string, unknown> = { total_amount: total };
  if (claim.manager_status === "APPROVED") {
    patch.manager_status = "PENDING";
  }
  await svc.from("claims").update(patch).eq("id", claimId);
  await svc.from("comments").insert({
    claim_id: claimId,
    message: note,
    author_name: author,
    author_role: "HR",
  });
  return total;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const result = tripEditSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  const trip = await getTripWithClaim(id);
  if (!trip) {
    return NextResponse.json({ success: false, error: "Trip tidak ditemukan" }, { status: 404 });
  }
  if (trip.claim?.status === "APPROVED") {
    return NextResponse.json(
      { success: false, error: "Klaim sudah approved — data terkunci" },
      { status: 400 }
    );
  }

  const svc = createServiceClient();
  const { error } = await svc.from("trips").update(result.data).eq("id", id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const changes: string[] = [];
  if (result.data.fare !== undefined) {
    changes.push(
      `nominal Rp${Number(trip.fare).toLocaleString("id-ID")} -> Rp${result.data.fare.toLocaleString("id-ID")}`
    );
  }
  if (result.data.pickup !== undefined || result.data.dropoff !== undefined) {
    changes.push(
      `rute "${trip.pickup} -> ${trip.dropoff}" -> "${result.data.pickup ?? trip.pickup} -> ${result.data.dropoff ?? trip.dropoff}"`
    );
  }
  const total = await recalcAndNote(
    trip.claim_id,
    trip.claim!,
    `Edit klaim oleh HR (${user.email}): ${changes.join("; ")}.`,
    user.email || "HR"
  );

  return NextResponse.json({ success: true, data: { total_amount: total } });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const trip = await getTripWithClaim(id);
  if (!trip) {
    return NextResponse.json({ success: false, error: "Trip tidak ditemukan" }, { status: 404 });
  }
  if (trip.claim?.status === "APPROVED") {
    return NextResponse.json(
      { success: false, error: "Klaim sudah approved — data terkunci" },
      { status: 400 }
    );
  }

  const svc = createServiceClient();
  const { error } = await svc.from("trips").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const total = await recalcAndNote(
    trip.claim_id,
    trip.claim!,
    `Trip dihapus oleh HR (${user.email}): "${trip.pickup} -> ${trip.dropoff}" (Rp${Number(trip.fare).toLocaleString("id-ID")}).`,
    user.email || "HR"
  );

  return NextResponse.json({ success: true, data: { total_amount: total } });
}
