import { NextResponse } from "next/server";
import { getRecentTickets } from "@/lib/envgate";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getRecentTickets(
      searchParams.get("from"),
      searchParams.get("to")
    );
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Service Desk API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch data from API" },
      { status: 502 }
    );
  }
}
