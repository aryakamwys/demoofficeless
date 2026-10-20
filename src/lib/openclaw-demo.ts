/**
 * Data & heuristik Demo Mode Openclaw — SEMUA bertanda ilustratif.
 * Dipakai hanya bila integrasi asli (GLM / InvGate) tidak tersedia supaya
 * alur demo tetap bisa direkam; hasil TIDAK pernah dicampur dengan data
 * produksi tanpa label.
 */

export const SAMPLE_ENGINEERS_CSV = `name,email,skills,sites,available,active_tickets
Budi Santoso,budi.santoso@perkom.co.id,cctv;network;huawei,Jakarta;Ayana;*,true,4
Sari Wulandari,sari.wulandari@perkom.co.id,cctv;maintenance;hikvision,Ayana;Bali,true,2
Rizky Pratama,rizky.pratama@perkom.co.id,desktop;printer;hardware,Jakarta,true,7
Dewi Lestari,dewi.lestari@perkom.co.id,network;wifi;firewall,Ayana;Jakarta;Surabaya,false,3
Agus Firmansyah,agus.firmansyah@perkom.co.id,cctv;access-control;security,Bali;Lombok,true,5`;

export const SAMPLE_CUSTOMERS_CSV = `name,email,site,service
Ayana Resort & Spa Bali,front.desk@ayana-resort.example,CCTV Ayana,CCTV Maintenance
Ayana Rimba Jimbaran,engineering@ayana-rimba.example,CCTV Ayana,CCTV Repair
PT Perkom HQ,it@perkom.co.id,Jakarta,Managed Service`;

/** Analisis heuristik lokal (keyword) — pengganti GLM saat Demo Mode. */
export function heuristicAnalysis(input: {
  sender: string;
  subject: string;
  body: string;
}) {
  const text = `${input.subject} ${input.body}`.toLowerCase();
  const rules: Array<{ re: RegExp; cat: string; pri: "high" | "medium" | "low"; kw: string }> = [
    { re: /cctv|kamera|camera|nvr|dvr/, cat: "Technical Support > CCTV", pri: "high", kw: "cctv" },
    { re: /printer|scan|print/, cat: "Technical Support > Hardware", pri: "medium", kw: "printer" },
    { re: /wifi|network|jaringan|internet|switch/, cat: "Network", pri: "high", kw: "network" },
    { re: /password|akun|email|account|login/, cat: "Account & Access", pri: "low", kw: "akun" },
    { re: /laptop|desktop|komputer|pc|blue ?screen/, cat: "Technical Support > Hardware", pri: "medium", kw: "perangkat" },
  ];
  const hit = rules.find((r) => r.re.test(text));
  return {
    title: input.subject.slice(0, 120),
    summary: `[DEMO] Isu ${hit?.kw || "umum"} dari email pelanggan — analisis heuristik lokal, bukan GLM.`,
    description: `[DEMO MODE — ILUSTRATIF]\n\n${input.body}`,
    category_id: null, // katalog InvGate tidak tersedia saat demo → user pilih manual
    priority_id: null,
    assigned_group_id: null,
    impact: "Belum dinilai (Demo Mode — tanpa akses katalog InvGate).",
    urgency: "Diperkirakan dari kata kunci email saja.",
    missing_info: ["Lokasi tepat perangkat", "Nomor aset / seri perangkat"],
    next_action: "Verifikasi manual oleh engineer sebelum eskalasi.",
    confidence: "low" as const,
    confidence_explanation:
      "Demo Mode: analisis berbasis kata kunci lokal karena GLM tidak terkonfigurasi.",
    references: [] as number[],
  };
}

export function demoTicketId() {
  return `DEMO-${Date.now().toString().slice(-6)}`;
}

/** Template notifikasi customer — variabel bisa diedit di UI Campaign/Console. */
export function buildCustomerNotification(vars: {
  ticket_pretty_id: string;
  customer_name: string;
  title: string;
  priority: string;
  engineer_name: string | null;
  company?: string;
}) {
  const engineer = vars.engineer_name || "tim kami (Needs Assignment)";
  return {
    subject: `[${vars.ticket_pretty_id}] ${vars.title} — ${vars.priority}`,
    body: [
      `Kepada Yth. ${vars.customer_name}${vars.company ? ` — ${vars.company}` : ""},`,
      "",
      `Terima kasih atas laporan Anda. Permintaan berikut telah kami terima dan didaftarkan:`,
      "",
      `  Nomor tiket : ${vars.ticket_pretty_id}`,
      `  Judul       : ${vars.title}`,
      `  Prioritas   : ${vars.priority}`,
      `  Ditangani   : ${engineer}`,
      "",
      `Kami akan memberikan kabar perkembangan melalui email ini. Balas email ini bila ada tambahan informasi.`,
      "",
      `Hormat kami,`,
      `${vars.company || "PT Perkom"} — Service Desk`,
    ].join("\n"),
  };
}
