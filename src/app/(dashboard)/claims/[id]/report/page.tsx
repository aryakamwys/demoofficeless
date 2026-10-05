import { createServerClient, createServiceClient } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import dayjs from "dayjs";
import { MapPin } from "lucide-react";
import {
  getTicket,
  getPriorityMap,
  getSourceMap,
  getLocationsMap,
  resolveEntityName,
  ticketTitle,
  type InvTicket,
} from "@/lib/envgate";
import { TYPE_NAMES, PRIORITY_NAMES, invPrettyId } from "@/components/services/invgate-ui";
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

/** Kartu bukti ticket — meniru panel header detail ticket EnvGate (data live API). */
function InvGateCard({
  caption,
  inv,
  live,
  priorityName,
  sourceName,
  locationName,
  attachmentUrl,
}: {
  caption: string;
  inv: InvTicket;
  live?: boolean;
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
  const crumb = inv.category_breadcrumb?.replace(/ > /g, " » ");

  return (
    <div className="mb-3 break-inside-avoid rounded-sm border border-slate-300 text-xs">
      {caption && (
        <p className="border-b border-slate-200 px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
          {caption}
        </p>
      )}

      {/* Judul + breadcrumb + lokasi + badge ID */}
      <div className="flex items-start justify-between gap-3 px-3 pb-2 pt-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-slate-800">
            {ticketTitle(inv) || "—"}
          </p>
          {crumb && <p className="mt-0.5 text-[10px] text-slate-400">{crumb}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {locationName && (
            <span className="flex items-center gap-1 whitespace-nowrap text-[10px] text-slate-500">
              <MapPin className="h-3 w-3" /> {locationName}
            </span>
          )}
          <span className="rounded-sm bg-blue-600 px-2 py-0.5 font-semibold text-white">
            {invPrettyId(inv)}
          </span>
        </div>
      </div>

      {/* Metadata baris 1 */}
      <div className="grid grid-cols-5 divide-x divide-slate-200 border-t border-slate-200">
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

      {/* Metadata baris 2 */}
      <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 bg-slate-50">
        <MetricCell label="Incident Location" value={locationName || "—"} />
        <MetricCell label="Details Location" value={customer} />
        <MetricCell label="Ticket Dibuat" value={created} />
      </div>

      {!live && (
        <p className="border-t border-slate-200 bg-amber-50 px-3 py-1.5 text-[9px] italic text-amber-700">
          Detail live dari EnvGate tidak tersedia untuk ticket ini — nomor tetap
          tercatat sebagai bukti.
        </p>
      )}

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

  // Normalisasi id ticket → digit murni (dipakai lookup & dedup anti-kartu-ganda)
  const digitsOf = (s: string) => s.replace(/\D/g, "");
  const tripTicketIds = [
    ...new Set(
      (trips || [])
        .map((t) => digitsOf((t.ticket_id || "").trim()))
        .filter(Boolean)
    ),
  ];

  // SEMUA lookup EnvGate dijalankan paralel dan anti-runtuh: gagal/tidak-ada
  // tidak pernah membuat report error — kartu minimal tetap tampil sebagai bukti.
  // Entity map (cache 24 jam) dilarung bersamaan dengan detail ticket supaya
  // hanya ada satu gelombang tunggu, bukan dua berurutan.
  const needIds = [...new Set([...tripTicketIds, ...(ticket ? [digitsOf(ticket.ticket_id)] : [])])];
  const mapsPromise = Promise.all([getPriorityMap(), getSourceMap(), getLocationsMap()]);
  const settled = await Promise.allSettled(needIds.map((tid) => getTicket(tid)));
  let envgateDown = false;
  const ticketById = new Map<string, InvTicket>();
  settled.forEach((r, i) => {
    const tid = needIds[i]!;
    if (r.status === "fulfilled" && r.value) {
      ticketById.set(tid, r.value);
    } else {
      if (r.status === "rejected") envgateDown = true;
      // Kartu minimal — bukti tetap tercatat walau detail live tidak tersedia
      ticketById.set(tid, { id: Number(tid) });
    }
  });

  // Detail ticket level klaim: hanya dari link managed-service yang eksplisit.
  // Tidak ada tebakan by nama requester — ticket yang tidak berhubungan dengan
  // klaim tidak boleh muncul di report (permintaan: jangan ada yang tidak sesuai).
  const invTicket: InvTicket | null = ticket
    ? ticketById.get(digitsOf(ticket.ticket_id)) ?? null
    : null;

  // Lampiran file ticket — signed URL (bucket private)
  let attachmentUrl: string | null = null;
  if (ticket?.storage_path) {
    const { data: signed } = await serviceClient.storage
      .from("dataperkom")
      .createSignedUrl(ticket.storage_path, 3600);
    attachmentUrl = signed?.signedUrl ?? null;
  }

  // Nama priority/source/lokasi dari entity EnvGate (cache 24 jam) — sudah
  // dilarung sejak awal bersama detail ticket, tinggal ditunggu di sini
  const [priorityMap, sourceMap, locationsMap] = await mapsPromise;

  // Kartu ticket bergaya panel header InvGate: level klaim + satu per trip (dedup by digit)
  const namesOf = (inv: InvTicket) => ({
    priorityName: inv.priority_id ? resolveEntityName(priorityMap, inv.priority_id) : "",
    sourceName: inv.source_id ? resolveEntityName(sourceMap, inv.source_id) : "",
    locationName:
      (inv.location_id ? resolveEntityName(locationsMap, inv.location_id) : "") ||
      ticket?.location ||
      "",
  });
  const isMinimal = (inv: InvTicket) => !inv.status_id && !inv.title && !inv.subject;
  const invCards: Array<
    { inv: InvTicket; caption: string; attachmentUrl: string | null; live: boolean } & ReturnType<typeof namesOf>
  > = [];
  if (invTicket) {
    invCards.push({
      inv: invTicket,
      caption: "Referensi klaim",
      attachmentUrl,
      live: !isMinimal(invTicket),
      ...namesOf(invTicket),
    });
  }
  for (const tid of tripTicketIds) {
    if (invCards.some((c) => digitsOf(String(c.inv.id)) === tid)) continue;
    const inv = ticketById.get(tid);
    if (!inv) continue;
    const nos = (trips || [])
      .map((t, i) => (digitsOf((t.ticket_id || "").trim()) === tid ? i + 1 : 0))
      .filter((n) => n > 0);
    invCards.push({
      inv,
      caption: nos.length ? `Bukti trip ke-${nos.join(", ")}` : "",
      attachmentUrl: null,
      live: !isMinimal(inv),
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
    <div className="report-doc mx-auto max-w-3xl bg-white p-6 lg:p-10 text-slate-800 print:p-0">
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

      {/* Peringatan koneksi EnvGate — report tetap tercetak dengan bukti minimal */}
      {envgateDown && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden">
          Koneksi EnvGate terganggu — detail ticket ditampilkan terbatas (nomor ticket
          tetap tercatat sebagai bukti). Buka ulang halaman ini setelah koneksi normal.
        </div>
      )}

      {/* Kop perusahaan — utuh satu halaman */}
      <div className="report-keep flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-3 mb-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ogoperkom.png" alt="Logo Perkom" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-lg font-bold uppercase tracking-wide">Laporan Klaim Grab</h1>
            <p className="text-xs text-slate-500 mt-0.5">PT Perkom · Dokumen Internal</p>
          </div>
        </div>
        <div className="text-right text-[10px] leading-relaxed text-slate-500">
          <p>Claim ID: {claim.id.slice(0, 8)}</p>
          <p>Dicetak: {dayjs().format("DD MMM YYYY HH:mm")}</p>
        </div>
      </div>

      {/* Ringkasan klaim — utuh satu halaman */}
      <h2 className="report-h2 text-sm font-bold uppercase mb-2">Ringkasan Klaim</h2>
      <div className="report-keep space-y-1 mb-6">
        <Row label="Karyawan" value={claim.employee?.employee_name || "—"} />
        <Row label="Department" value={claim.employee?.department || "—"} />
        <Row label="Periode" value={claim.period} />
        <Row label="Jumlah Trip" value={String(claim.trip_count)} />
        <Row label="Total Biaya" value={`IDR ${total.toLocaleString("id-ID")}`} />
        <Row label="Status" value={claim.status} />
      </div>

      {/* Timeline approval — utuh satu halaman */}
      <h2 className="report-h2 text-sm font-bold uppercase mb-2">Timeline Approval</h2>
      <div className="report-keep space-y-1 mb-6 text-sm">
        <Row
          label="Konfirmasi Engineer"
          value={claim.approved_at ? dayjs(claim.approved_at).format("DD MMM YYYY HH:mm") : "—"}
        />
        <Row label={`Manager (${managerName})`} value={claim.manager_status} />
        <Row label={`HR (${hrName})`} value={claim.hr_status} />
      </div>

      {/* Tabel trip — boleh mengalir antar halaman, header berulang otomatis */}
      <h2 className="report-h2 text-sm font-bold uppercase mb-2">Detail Perjalanan</h2>
      <table className="report-table w-full border-collapse text-xs mb-6">
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
              <td className="report-anywhere border border-slate-300 px-2 py-1">
                {t.pickup} → {t.dropoff}
              </td>
              <td className="border border-slate-300 px-2 py-1">
                {(() => {
                  const tid = digitsOf((t.ticket_id || "").trim());
                  if (!tid) return "—";
                  const inv = ticketById.get(tid);
                  const title = inv ? ticketTitle(inv) : "";
                  return (
                    <>
                      <span>#{tid}</span>
                      {title && (
                        <span className="block text-[10px] text-slate-500 leading-tight">
                          {title}
                        </span>
                      )}
                    </>
                  );
                })()}
              </td>
              <td className="border border-slate-300 px-2 py-1 text-right">
                {Number(t.fare).toLocaleString("id-ID")}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold bg-slate-50">
            <td colSpan={4} className="border border-slate-300 px-2 py-1 text-right">
              Total
            </td>
            <td className="border border-slate-300 px-2 py-1 text-right">
              {total.toLocaleString("id-ID")}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Ticket EnvGate — kartu bergaya halaman ticket InvGate */}
      <h2 className="report-h2 text-sm font-bold uppercase mb-2">Referensi Ticket EnvGate</h2>
      {invCards.length > 0 ? (
        <div className="mb-6">
          {invCards.map((c) => (
            <InvGateCard
              key={`${digitsOf(String(c.inv.id))}-${c.caption}`}
              caption={c.caption}
              inv={c.inv}
              live={c.live}
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

      {/* Tanda tangan — satu blok logis, tidak boleh terpisah antar halaman */}
      <h2 className="report-h2 text-sm font-bold uppercase mb-4">Persetujuan</h2>
      <div className="report-keep flex gap-6 mb-8">
        <SignatureBlock
          title="Engineer"
          name={claim.employee?.employee_name || "—"}
          signature={employeeSig}
        />
        <SignatureBlock title="Manager" name={managerName} signature={managerSig} />
        <SignatureBlock title="HR" name={hrName} signature={hrSig} />
      </div>
    </div>
  );
}
