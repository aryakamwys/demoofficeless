import { createServerClient, createServiceClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import dayjs from "dayjs";
import { MapPin } from "lucide-react";
import {
  getTicket,
  findTicketByRequesterName,
  getStatusMap,
  getPriorityMap,
  getSourceMap,
  getLocationsMap,
  resolveEntityName,
  ticketTitle,
  type InvTicket,
} from "@/lib/envgate";
import { TYPE_NAMES, PRIORITY_NAMES, InvAvatar, InvTypeIcon, invPrettyId, stripInvHtml } from "@/components/services/invgate-ui";
import { formatTripDateTime } from "@/lib/format";
import { ReportPrintButton } from "@/components/claims/report-print-button";

interface ReportPageProps {
  params: Promise<{ id: string }>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-40 shrink-0 text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">: {value}</span>
    </div>
  );
}

function SignatureBlock({
  title,
  name,
  signature,
}: {
  title: string;
  name: string;
  signature: string | null;
}) {
  return (
    <div className="flex-1 text-center">
      <div className="h-16 flex items-end justify-center">
        {signature ? (
          // base64 PNG tanda tangan
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signature} alt={`TTD ${title}`} className="max-h-16" />
        ) : (
          <span className="text-xs text-slate-400 italic">belum ditandatangani</span>
        )}
      </div>
      <div className="border-t border-slate-400 mx-4 mt-1 pt-1">
        <p className="text-xs font-semibold text-slate-700">{name}</p>
        <p className="text-[10px] text-slate-500">{title}</p>
      </div>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1.5">
      <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="font-medium leading-tight text-slate-700">{value}</p>
    </div>
  );
}

function Participant({
  name,
  role,
  showClock,
}: {
  name: string;
  role: string;
  showClock?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <InvAvatar name={name} />
      <div>
        <p className="font-medium leading-tight text-slate-700">{name}</p>
        <p className="flex items-center gap-1 text-[9px] text-slate-400">
          {role}
          {showClock && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          )}
        </p>
      </div>
    </div>
  );
}

/** Kartu bukti ticket — meniru layout halaman ticket EnvGate (semua data live API). */
function InvGateCard({
  caption,
  inv,
  statusName,
  priorityName,
  sourceName,
  locationName,
  attachmentUrl,
}: {
  caption: string;
  inv: InvTicket;
  statusName: string;
  priorityName: string;
  sourceName: string;
  locationName: string;
  attachmentUrl: string | null;
}) {
  const typeName = TYPE_NAMES[inv.type_id ?? 0] ?? (inv.type_id ? `ID ${inv.type_id}` : "—");
  const created = inv.created_at
    ? dayjs(String(inv.created_at)).format("DD MMM YYYY HH:mm")
    : "—";
  const customer = inv.requester_user?.name || "—";
  const agent = inv.assigned_user?.name || "—";
  const helpdesk = inv.assigned_group_details?.name || "—";
  const creator = inv.creator_user?.name || inv.requester_user?.name || "—";
  const crumb = inv.category_breadcrumb?.replace(/ > /g, " » ");

  return (
    <div className="mb-3 break-inside-avoid rounded-sm border border-slate-300 text-xs">
      {/* Bar atas: status + badge ID */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-600">
            {statusName || (inv.status_id ? `ID ${inv.status_id}` : "—")}
          </span>
          {caption && (
            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              {caption}
            </span>
          )}
        </div>
        <span className="rounded-sm bg-blue-600 px-2 py-0.5 font-semibold text-white">
          {invPrettyId(inv)}
        </span>
      </div>

      {/* Judul + breadcrumb + lokasi */}
      <div className="flex items-start gap-2 border-b border-slate-200 px-3 py-2">
        <InvTypeIcon typeId={inv.type_id} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug text-slate-800">
            {ticketTitle(inv) || "—"}
          </p>
          {crumb && <p className="mt-0.5 text-[10px] text-slate-400">{crumb}</p>}
        </div>
        {locationName && (
          <span className="flex items-center gap-0.5 whitespace-nowrap text-[10px] text-slate-500">
            <MapPin className="h-3 w-3" /> {locationName}
          </span>
        )}
      </div>

      {/* Metrics baris 1 */}
      <div className="grid grid-cols-5 divide-x divide-slate-200 border-b border-slate-200">
        <MetricCell
          label="Priority"
          value={
            priorityName ||
            (inv.priority_id ? PRIORITY_NAMES[inv.priority_id] || `ID ${inv.priority_id}` : "—")
          }
        />
        <MetricCell label="Type" value={typeName} />
        <MetricCell label="Source" value={sourceName || "—"} />
        <MetricCell label="First Response" value={inv.sla_incident_first_reply || "—"} />
        <MetricCell label="Resolution" value={inv.sla_incident_resolution || "—"} />
      </div>

      {/* Metrics baris 2 */}
      <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50/50">
        <MetricCell label="Incident Location" value={locationName || "—"} />
        <MetricCell label="Details Location" value={customer} />
        <MetricCell label="Ticket Dibuat" value={created} />
      </div>

      {/* Kartu DESCRIPTION */}
      <div className="flex gap-2 border-b border-slate-200 px-3 py-2">
        <InvAvatar name={creator} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-medium text-slate-700">{creator}</span>
            <span className="rounded-sm bg-blue-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
              Description
            </span>
          </div>
          <div className="whitespace-pre-line rounded-sm border border-slate-200 bg-slate-50 p-2 leading-relaxed text-slate-700">
            {(inv.description && stripInvHtml(inv.description)) || ticketTitle(inv) || "—"}
          </div>
        </div>
      </div>

      {/* Participants */}
      <div className="flex flex-wrap gap-x-8 gap-y-2 px-3 py-2">
        <Participant name={customer} role="Customer" />
        <Participant
          name={agent}
          role={helpdesk !== "—" ? `Agent — ${helpdesk}` : "Agent"}
          showClock
        />
      </div>

      {attachmentUrl && (
        <div className="border-t border-slate-200 px-3 py-2 print:hidden">
          <a
            href={attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-700 underline"
          >
            Lihat File Bukti (lampiran ticket)
          </a>
        </div>
      )}
    </div>
  );
}

export default async function ClaimReportPage({ params }: ReportPageProps) {
  const { id } = await params;
  const supabase = await createServerClient();
  const serviceClient = createServiceClient();

  const { data: claim } = await supabase
    .from("claims")
    .select(`
      *,
      employee:employees!claims_employee_id_fkey(*),
      manager:employees!claims_manager_id_fkey(*),
      hr:employees!claims_hr_id_fkey(*)
    `)
    .eq("id", id)
    .single();
  if (!claim) notFound();

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .eq("claim_id", id)
    .order("trip_date", { ascending: true });

  // Bukti ticket per trip (kebutuhan HR): resolve detail live via cache 5 menit
  const tripTicketIds = [
    ...new Set((trips || []).map((t) => (t.ticket_id || "").trim()).filter(Boolean)),
  ];
  const tripTickets = await Promise.all(tripTicketIds.map((tid) => getTicket(tid)));
  const ticketById = new Map(
    tripTickets.filter(Boolean).map((t) => [String(t!.id), t!])
  );

  // Ticket managed-service yang ter-link via customer_name (pola sama dengan detail klaim)
  let ticket: { ticket_id: string; ticket_title?: string | null; customer_name?: string | null; location?: string | null; storage_path?: string | null } | null = null;
  if (claim.employee?.employee_name) {
    const { data: tickets } = await supabase
      .from("managed_service_claims")
      .select("ticket_id, ticket_title, customer_name, location, storage_path")
      .ilike("customer_name", claim.employee.employee_name)
      .order("created_at", { ascending: false })
      .limit(1);
    if (tickets && tickets.length > 0) ticket = tickets[0];
  }

  // Detail ticket dari API EnvGate (cache 5 menit di lib)
  let invTicket = ticket ? await getTicket(ticket.ticket_id) : null;

  // Fallback: tidak ada link lokal → cari langsung di EnvGate by nama requester
  if (!ticket && !invTicket && claim.employee?.employee_name) {
    invTicket = await findTicketByRequesterName(claim.employee.employee_name);
  }

  // Lampiran file ticket — signed URL (bucket private)
  let attachmentUrl: string | null = null;
  if (ticket?.storage_path) {
    const { data: signed } = await serviceClient.storage
      .from("dataperkom")
      .createSignedUrl(ticket.storage_path, 3600);
    attachmentUrl = signed?.signedUrl ?? null;
  }

  // Nama status/priority/source/lokasi dari entity EnvGate (cache 24 jam)
  const [statusMap, priorityMap, sourceMap, locationsMap] = await Promise.all([
    getStatusMap(),
    getPriorityMap(),
    getSourceMap(),
    getLocationsMap(),
  ]);

  // Kartu ticket bergaya halaman InvGate: level klaim + satu per trip
  const namesOf = (inv: InvTicket) => ({
    statusName: inv.status_id ? resolveEntityName(statusMap, inv.status_id) : "",
    priorityName: inv.priority_id ? resolveEntityName(priorityMap, inv.priority_id) : "",
    sourceName: inv.source_id ? resolveEntityName(sourceMap, inv.source_id) : "",
    locationName:
      (inv.location_id ? resolveEntityName(locationsMap, inv.location_id) : "") ||
      ticket?.location ||
      "",
  });
  const invCards: Array<{ inv: InvTicket; caption: string; attachmentUrl: string | null } & ReturnType<typeof namesOf>> = [];
  if (invTicket) {
    invCards.push({
      inv: invTicket,
      caption: "Referensi klaim",
      attachmentUrl,
      ...namesOf(invTicket),
    });
  }
  for (const [tid, inv] of ticketById) {
    if (invCards.some((c) => String(c.inv.id) === tid)) continue;
    const nos = (trips || [])
      .map((t, i) => ((t.ticket_id || "").trim() === tid ? i + 1 : 0))
      .filter((n) => n > 0);
    invCards.push({
      inv,
      caption: nos.length ? `Bukti trip ke-${nos.join(", ")}` : "",
      attachmentUrl: null,
      ...namesOf(inv),
    });
  }

  // Tanda tangan employee / manager / HR
  const sigOf = async (empId: string | null | undefined) => {
    if (!empId) return null;
    const { data } = await serviceClient
      .from("signatures")
      .select("signature")
      .eq("employee_id", empId)
      .single();
    return data?.signature ?? null;
  };
  const [employeeSig, managerSig, hrSig] = await Promise.all([
    sigOf(claim.employee_id),
    sigOf(claim.manager_id || claim.employee?.manager_id),
    sigOf(claim.hr_id || claim.employee?.hr_id),
  ]);

  const managerName = claim.manager?.employee_name || "—";
  const hrName = claim.hr?.employee_name || "—";
  const total = Number(claim.total_amount);

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 lg:p-10 text-slate-800 print:p-0">
      {/* Toolbar — hilang saat print */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link
          href={`/claims/${id}`}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700"
        >
          ← Kembali ke Claim
        </Link>
        <ReportPrintButton />
      </div>

      {/* Kop */}
      <div className="border-b-2 border-slate-800 pb-3 mb-6">
        <h1 className="text-lg font-bold uppercase tracking-wide">Perkom — Report Klaim Perjalanan</h1>
        <p className="text-xs text-slate-500 mt-1">
          Dicetak {dayjs().format("DD MMM YYYY HH:mm")} · Claim ID {claim.id.slice(0, 8)}
        </p>
      </div>

      {/* Ringkasan */}
      <div className="space-y-1 mb-6">
        <Row label="Karyawan" value={claim.employee?.employee_name || "—"} />
        <Row label="Department" value={claim.employee?.department || "—"} />
        <Row label="Periode" value={claim.period} />
        <Row label="Jumlah Trip" value={String(claim.trip_count)} />
        <Row label="Total Biaya" value={`IDR ${total.toLocaleString("id-ID")}`} />
        <Row label="Status" value={claim.status} />
      </div>

      {/* Timeline approval */}
      <h2 className="text-sm font-bold uppercase mb-2">Timeline Approval</h2>
      <div className="space-y-1 mb-6 text-sm">
        <Row
          label="Konfirmasi Engineer"
          value={claim.approved_at ? dayjs(claim.approved_at).format("DD MMM YYYY HH:mm") : "—"}
        />
        <Row label={`Manager (${managerName})`} value={claim.manager_status} />
        <Row label={`HR (${hrName})`} value={claim.hr_status} />
      </div>

      {/* Tabel trip */}
      <h2 className="text-sm font-bold uppercase mb-2">Detail Perjalanan</h2>
      <table className="w-full border-collapse text-xs mb-6">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-2 py-2 text-left">No</th>
            <th className="border border-slate-300 px-2 py-2 text-left">Tanggal</th>
            <th className="border border-slate-300 px-2 py-2 text-left">Rute</th>
            <th className="border border-slate-300 px-2 py-2 text-left">Ticket</th>
            <th className="border border-slate-300 px-2 py-2 text-right">Nominal (IDR)</th>
          </tr>
        </thead>
        <tbody>
          {(trips || []).map((t, i) => (
            <tr key={t.id}>
              <td className="border border-slate-300 px-2 py-1">{i + 1}</td>
              <td className="border border-slate-300 px-2 py-1 whitespace-nowrap">
                {formatTripDateTime(t.trip_date)}
              </td>
              <td className="border border-slate-300 px-2 py-1">
                {t.pickup} → {t.dropoff}
              </td>
              <td className="border border-slate-300 px-2 py-1">
                {t.ticket_id ? (
                  <>
                    <span>#{t.ticket_id}</span>
                    {ticketById.get(t.ticket_id) && (
                      <span className="block text-[10px] text-slate-500 leading-tight">
                        {ticketTitle(ticketById.get(t.ticket_id))}
                      </span>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="border border-slate-300 px-2 py-1 text-right">
                {Number(t.fare).toLocaleString("id-ID")}
              </td>
            </tr>
          ))}
          <tr className="font-semibold bg-slate-50">
            <td colSpan={4} className="border border-slate-300 px-2 py-1 text-right">
              Total
            </td>
            <td className="border border-slate-300 px-2 py-1 text-right">
              {total.toLocaleString("id-ID")}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Ticket EnvGate — kartu bergaya halaman ticket InvGate */}
      <h2 className="text-sm font-bold uppercase mb-2">Referensi Ticket EnvGate</h2>
      {invCards.length > 0 ? (
        <div className="mb-6">
          {invCards.map((c) => (
            <InvGateCard
              key={`${c.inv.id}-${c.caption}`}
              caption={c.caption}
              inv={c.inv}
              statusName={c.statusName}
              priorityName={c.priorityName}
              sourceName={c.sourceName}
              locationName={c.locationName}
              attachmentUrl={c.attachmentUrl}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 italic mb-6">
          Tidak ada ticket EnvGate yang cocok untuk karyawan ini
          {claim.employee ? ` (${claim.employee.employee_name})` : ""} — baik di data
          klaim maupun di pencarian requester EnvGate. Isi kolom Ticket pada tiap
          trip di halaman detail klaim untuk melampirkan bukti.
        </p>
      )}

      {/* Tanda tangan */}
      <h2 className="text-sm font-bold uppercase mb-4">Persetujuan</h2>
      <div className="flex gap-6 mb-8">
        <SignatureBlock
          title="Engineer"
          name={claim.employee?.employee_name || "—"}
          signature={employeeSig}
        />
        <SignatureBlock title="Manager" name={managerName} signature={managerSig} />
        <SignatureBlock title="HR" name={hrName} signature={hrSig} />
      </div>

      <p className="text-[10px] text-slate-400 text-center">
        Report ini dihasilkan otomatis oleh Perkom Dashboard — data ticket live dari EnvGate Service Desk.
      </p>
    </div>
  );
}
