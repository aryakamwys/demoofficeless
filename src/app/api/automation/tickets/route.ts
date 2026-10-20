import { NextResponse } from "next/server";
import {
  getPriorityMap,
  getRecentTickets,
  getStatusMap,
  resolveEntityName,
  ticketTitle,
} from "@/lib/envgate";
import { errorMessage } from "@/lib/utils";

/**
 * GET /api/automation/tickets
 * Daftar tiket nyata InvGate untuk workspace Ticket Operations — sama dengan
 * sumber /api/services, plus nama status/prioritas ter-resolve supaya bisa
 * difilter dan ditampilkan tanpa roundtrip tambahan.
 */
export async function GET() {
  try {
    const [tickets, statuses, priorities] = await Promise.all([
      getRecentTickets(null, null),
      getStatusMap(),
      getPriorityMap(),
    ]);
    return NextResponse.json({
      success: true,
      data: tickets.map((t) => ({
        id: t.id,
        pretty_id: t.pretty_id || `PIM-${t.id}`,
        title: ticketTitle(t),
        status:
          (t.status_id != null && resolveEntityName(statuses, t.status_id)) ||
          `Status ${t.status_id ?? "?"}`,
        status_id: t.status_id ?? null,
        priority:
          (t.priority_id != null && resolveEntityName(priorities, t.priority_id)) ||
          (t.priority_id != null ? `Prioritas ${t.priority_id}` : "—"),
        customer: t.requester_user?.name || t.requester_user?.email || "—",
        assigned: t.assigned_user?.name || null,
        group: t.assigned_group_details?.name || null,
        category: t.category_breadcrumb || t.category_details?.name || "",
        created_at: t.created_at ? String(t.created_at) : null,
        sla_first_reply: t.sla_incident_first_reply || null,
        sla_resolution: t.sla_incident_resolution || null,
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Gagal mengambil tiket InvGate") },
      { status: 502 }
    );
  }
}
