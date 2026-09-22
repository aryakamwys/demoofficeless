import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

interface AssetInput {
  barcode?: string;
  name?: string;
  location?: string;
  notes?: string;
}

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const body = await request.json();
  const items: AssetInput[] = Array.isArray(body) ? body : body?.items;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { success: false, error: "Tidak ada data asset" },
      { status: 400 }
    );
  }

  const rows = items
    .filter((i) => i?.barcode)
    .map((i) => ({
      barcode: String(i.barcode).trim(),
      name: (i.name || "").trim(),
      location: (i.location || "").trim(),
      notes: (i.notes || "").trim(),
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Barcode wajib diisi" },
      { status: 400 }
    );
  }

  // Upsert by barcode — scan ulang asset sama = update, bukan duplikat.
  const { data, error } = await supabase
    .from("assets")
    .upsert(rows, { onConflict: "barcode" })
    .select();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}
