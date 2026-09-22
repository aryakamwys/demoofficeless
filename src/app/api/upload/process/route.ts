import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { parseGrabCSV, parseGrabPDF, groupTripsByEmployee } from "@/lib/parser";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { upload_id } = await request.json();

  if (!upload_id) {
    return NextResponse.json(
      { success: false, error: "upload_id wajib diisi" },
      { status: 400 }
    );
  }

  // Get upload record
  const { data: upload, error: uploadError } = await supabase
    .from("uploads")
    .select("*")
    .eq("id", upload_id)
    .single();

  if (uploadError || !upload) {
    return NextResponse.json(
      { success: false, error: "Upload tidak ditemukan" },
      { status: 404 }
    );
  }

  // Download file from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("dataperkom")
    .download(upload.storage_path);

  if (downloadError || !fileData) {
    return NextResponse.json(
      { success: false, error: "Gagal mengunduh file" },
      { status: 500 }
    );
  }

  try {
    // Get all employees for matching
    const { data: employees } = await supabase
      .from("employees")
      .select("*")
      .eq("is_active", true);

    // Parse the file
    let trips;
    if (upload.file_type === "csv") {
      const text = await fileData.text();
      trips = parseGrabCSV(text);
    } else {
      const buffer = Buffer.from(await fileData.arrayBuffer());
      trips = await parseGrabPDF(buffer, employees || []);
    }

    if (trips.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada data trip yang ditemukan" },
        { status: 400 }
      );
    }

    // Group trips by employee
    const grouped = groupTripsByEmployee(trips);

    // Batch: satu insert untuk semua claim + satu insert untuk semua trip.
    // (Sebelumnya 2 round-trip per employee berurutan — sumber lambatnya proses upload.)
    const claimRows = grouped.map((group) => {
      const matchedEmployee = employees?.find(
        (emp) =>
          emp.employee_name.toLowerCase() ===
          group.employee_name.toLowerCase()
      );
      return {
        employee_id: matchedEmployee?.id || null,
        upload_id: upload.id,
        period: upload.period,
        trip_count: group.trip_count,
        total_amount: group.total_amount,
        status: matchedEmployee ? "PENDING" : "UNMATCHED",
        manager_id: matchedEmployee?.manager_id || null,
        hr_id: matchedEmployee?.hr_id || null,
      };
    });

    const { data: claims, error: claimsError } = await supabase
      .from("claims")
      .insert(claimRows)
      .select("id");

    if (claimsError || !claims) {
      return NextResponse.json(
        { success: false, error: "Gagal membuat claim: " + claimsError?.message },
        { status: 500 }
      );
    }

    // ponytail: cocokkan trip ke claim via urutan hasil insert (perilaku
    // Postgres multi-VALUES) — employee_id bisa null/duplikat, tak bisa jadi kunci.
    const tripRecords = grouped.flatMap((group, i) =>
      group.trips.map((t) => ({
        claim_id: claims[i].id,
        trip_date: t.trip_date
          ? new Date(t.trip_date).toISOString()
          : new Date().toISOString(),
        booking_id: t.booking_id,
        service_type: t.service_type,
        payment_method: t.payment_method,
        employee_group: t.employee_group,
        cost_code: t.cost_code,
        pickup: t.pickup,
        dropoff: t.dropoff,
        fare: t.fare,
      }))
    );

    if (tripRecords.length > 0) {
      const { error: tripsError } = await supabase.from("trips").insert(tripRecords);
      if (tripsError) {
        console.error("Failed to insert trips:", tripsError);
      }
    }

    // Update upload status
    await supabase
      .from("uploads")
      .update({ status: "PROCESSED" })
      .eq("id", upload_id);

    return NextResponse.json({
      success: true,
      data: { claims_created: claims.length },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memproses file";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
