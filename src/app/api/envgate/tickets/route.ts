import { NextRequest, NextResponse } from "next/server";
import { getRecentTickets, ticketTitle } from "@/lib/envgate";

/** Daftar tiket terbaru EnvGate — saran pengisian ticket per trip (HR).
 *  ?requester=<nama>&month=<YYYY-MM> memfilter tiket milik karyawan pada
 *  bulan klaimnya, supaya pilihannya relevan (dulu 50 tiket acak). */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requester = (searchParams.get("requester") || "").trim().toLowerCase();
    const month = (searchParams.get("month") || "").trim(); // YYYY-MM

    let tickets = await getRecentTickets(null, null);

    if (requester) {
      tickets = tickets.filter(
        (t) => (t.requester_user?.name || "").toLowerCase() === requester
      );
    }
    if (/^\d{4}-\d{2}$/.test(month)) {
      tickets = tickets.filter((t) => {
        if (!t.created_at) return false;
        const d = new Date(String(t.created_at));
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === month;
      });
    }

    return NextResponse.json({
      success: true,
      data: tickets.slice(0, 100).map((t) => ({
        id: t.id,
        title: ticketTitle(t),
        pretty_id: t.pretty_id || `PIM-${t.id}`,
      })),
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
