import { createServerClient, createServiceClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import dayjs from "dayjs";
import { getTicket, findTicketByRequesterName } from "@/lib/envgate";
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

  // Lampiran file ticket — signed URL (bucket private)
  let attachmentUrl: string | null = null;
  if (ticket?.storage_path) {
    const { data: signed } = await serviceClient.storage
      .from("dataperkom")
      .createSignedUrl(ticket.storage_path, 3600);
    attachmentUrl = signed?.signedUrl ?? null;
  }

  const managerName = claim.manager?.employee_name || "—";
  const hrName = claim.hr?.employee_name || "—";
  const total = Number(claim.total_amount);

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 lg:p-10 text-slate-800 print:p-0">
      {/* Toolbar — hilang saat print */}
      <div className="flex justify-end mb-4 print:hidden">
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
            <th className="border border-slate-300 px-2 py-2 text-right">Nominal (IDR)</th>
          </tr>
        </thead>
        <tbody>
          {(trips || []).map((t, i) => (
            <tr key={t.id}>
              <td className="border border-slate-300 px-2 py-1">{i + 1}</td>
              <td className="border border-slate-300 px-2 py-1">
                {dayjs(t.trip_date).format("DD MMM YYYY HH:mm")}
              </td>
              <td className="border border-slate-300 px-2 py-1">
                {t.pickup} → {t.dropoff}
              </td>
              <td className="border border-slate-300 px-2 py-1 text-right">
                {Number(t.fare).toLocaleString("id-ID")}
              </td>
            </tr>
          ))}
          <tr className="font-semibold bg-slate-50">
            <td colSpan={3} className="border border-slate-300 px-2 py-1 text-right">
              Total
            </td>
            <td className="border border-slate-300 px-2 py-1 text-right">
              {total.toLocaleString("id-ID")}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Ticket EnvGate */}
      <h2 className="text-sm font-bold uppercase mb-2">Referensi Ticket EnvGate</h2>
      {ticket || invTicket ? (
        <div className="space-y-1 mb-6 text-sm">
          <Row label="Ticket ID" value={ticket?.ticket_id || `#${invTicket?.id}`} />
          <Row
            label="Judul"
            value={ticket?.ticket_title || invTicket?.category_details?.name || "—"}
          />
          {ticket && <Row label="Customer" value={ticket.customer_name || "—"} />}
          {ticket && <Row label="Lokasi" value={ticket.location || "—"} />}
          {invTicket && (
            <>
              <Row label="Kategori" value={invTicket.category_details?.name || "—"} />
              <Row
                label="Assigned Group"
                value={invTicket.assigned_group_details?.name || "—"}
              />
              <Row
                label="Ditugaskan Kepada"
                value={invTicket.assigned_user?.name || "—"}
              />
              <Row label="Requester" value={invTicket.requester_user?.name || "—"} />
              <Row
                label="Ticket Dibuat"
                value={invTicket.created_at ? dayjs(String(invTicket.created_at)).format("DD MMM YYYY") : "—"}
              />
            </>
          )}
          {!invTicket && (
            <p className="text-xs text-slate-400 italic pt-1">
              Detail live dari EnvGate tidak tersedia (API tidak terjangkau).
            </p>
          )}
          {attachmentUrl && (
            <div className="flex gap-2 text-sm pt-1 print:hidden">
              <span className="w-40 shrink-0 text-slate-500">Lampiran Bukti</span>
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 underline"
              >
                : Lihat File Bukti
              </a>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500 italic mb-6">
          Tidak ada ticket EnvGate yang cocok untuk karyawan ini
          {claim.employee ? ` (${claim.employee.employee_name})` : ""} — baik di data
          klaim maupun di pencarian requester EnvGate.
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
