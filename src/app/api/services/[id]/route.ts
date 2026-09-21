import { NextResponse } from "next/server";
import { getTicket } from "@/lib/envgate";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getTicket(id);

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Ticket not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Service Desk API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch data from API" },
      { status: 502 }
    );
  }
}
