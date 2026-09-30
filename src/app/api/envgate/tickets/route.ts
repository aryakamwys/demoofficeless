import { NextResponse } from "next/server";
import { getRecentTickets, ticketTitle } from "@/lib/envgate";

/** Daftar tiket terbaru EnvGate — saran pengisian ticket per trip (HR). */
export async function GET() {
  try {
    const tickets = await getRecentTickets(null, null);
    return NextResponse.json({
      success: true,
      data: tickets.map((t) => ({ id: t.id, title: ticketTitle(t) })),
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Gagal mengambil tiket EnvGate",
      },
      { status: 502 }
    );
  }
}
