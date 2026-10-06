import type { Metadata } from "next";
import { EnvGateReport } from "@/components/services/envgate-report";
import {
  getRecentTickets,
  getStatusMap,
  getPriorityMap,
  resolveEntityName,
  ticketTitle,
} from "@/lib/envgate";
import { PRIORITY_NAMES } from "@/components/services/invgate-ui";
import type { EnvGateTicketRow } from "@/components/services/envgate-test";

export const metadata: Metadata = { title: "Report EnvGate — Officeless Perkom" };

export default async function EnvGateReportPage() {
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
      <div className="print:hidden">
        <h1 className="text-lg font-semibold">Report EnvGate</h1>
        <p className="text-sm text-slate-500">
          Data ticket live dari EnvGate Service Desk — bisa diunduh sebagai PPT,
          Excel, atau PDF (cetak). File PPT bisa diimpor langsung ke Canva
          (Canva → Buat desain → Impor file) untuk diedit lebih lanjut.
        </p>
      </div>
      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Gagal mengambil data EnvGate: {error}
        </div>
      ) : (
        <EnvGateReport tickets={tickets} />
      )}
    </div>
  );
}
