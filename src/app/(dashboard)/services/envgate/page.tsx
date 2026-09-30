import { EnvGateTest, EnvGateTicketRow } from "@/components/services/envgate-test";
import {
  getRecentTickets,
  getStatusMap,
  getPriorityMap,
  resolveEntityName,
  ticketTitle,
} from "@/lib/envgate";
import { PRIORITY_NAMES } from "@/components/services/invgate-ui";

export default async function EnvGateTestPage() {
  let tickets: EnvGateTicketRow[] = [];
  let error: string | null = null;
  let mapInfo = "";

  try {
    const [recent, statusMap, priorityMap] = await Promise.all([
      getRecentTickets(null, null),
      getStatusMap(),
      getPriorityMap(),
    ]);
    mapInfo = `${Object.keys(statusMap).length} status · ${Object.keys(priorityMap).length} priority ter-resolve`;
    tickets = recent.map((t) => ({
      id: t.id,
      pretty_id: t.pretty_id || `PIM-${t.id}`,
      title: ticketTitle(t),
      type_id: t.type_id,
      category: t.category_breadcrumb || t.category_details?.name || "",
      status: t.status_id ? resolveEntityName(statusMap, t.status_id) || `ID ${t.status_id}` : "—",
      priority:
        t.priority_id
          ? resolveEntityName(priorityMap, t.priority_id) ||
            PRIORITY_NAMES[t.priority_id] ||
            `ID ${t.priority_id}`
          : "—",
      requester: t.requester_user?.name || "",
      assigned: t.assigned_user?.name || "",
      helpdesk: t.assigned_group_details?.name || "",
      created_at: t.created_at ? String(t.created_at) : null,
    }));
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">EnvGate Test</h1>
        <p className="text-sm text-slate-500">
          Cek koneksi & data live dari EnvGate Service Desk API — dipakai report
          klaim untuk referensi ticket.
        </p>
      </div>
      <EnvGateTest tickets={tickets} error={error} mapInfo={mapInfo} />
    </div>
  );
}
