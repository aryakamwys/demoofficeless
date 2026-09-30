import { EnvGateTest, EnvGateTicketRow } from "@/components/services/envgate-test";
import {
  getRecentTickets,
  getStatusMap,
  getPriorityMap,
  resolveEntityName,
  ticketTitle,
} from "@/lib/envgate";

export default async function EnvGateTestPage() {
  let tickets: EnvGateTicketRow[] = [];
  let error: string | null = null;

  try {
    const [recent, statusMap, priorityMap] = await Promise.all([
      getRecentTickets(null, null),
      getStatusMap(),
      getPriorityMap(),
    ]);
    tickets = recent.map((t) => ({
      id: t.id,
      subject: ticketTitle(t),
      status: t.status_id ? resolveEntityName(statusMap, t.status_id) || `ID ${t.status_id}` : "—",
      priority: t.priority_id ? resolveEntityName(priorityMap, t.priority_id) || `ID ${t.priority_id}` : "—",
      requester: t.requester_user?.name || "",
      assigned: t.assigned_user?.name || "",
      category: t.category_details?.name || "",
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
      <EnvGateTest tickets={tickets} error={error} />
    </div>
  );
}
