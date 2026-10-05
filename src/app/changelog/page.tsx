import type { Metadata } from "next";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { ScrollProgress } from "@/components/scroll-progress";

export const metadata: Metadata = {
  title: "Changelog — Officeless Perkom",
  description: "Semua pembaruan dan fitur terbaru dari Officeless Perkom.",
};

// Tipe entri → kelas warna badge (daisyUI badge + token warna sendiri;
// tema daisy dimatikan di globals.css).
const TYPE_STYLES: Record<string, string> = {
  Baru: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Fitur: "border-blue-200 bg-blue-50 text-blue-700",
  Peningkatan: "border-amber-200 bg-amber-50 text-amber-700",
  Perbaikan: "border-slate-200 bg-slate-100 text-slate-700",
};

const ENTRIES: {
  date: string;
  type: keyof typeof TYPE_STYLES;
  title: string;
  desc: string;
  items: string[];
}[] = [
  {
    date: "5 Okt 2026",
    type: "Peningkatan",
    title: "Tampilan area publik baru",
    desc: "Landing, login, dan halaman changelog didesain ulang agar lebih ringkas dan modern.",
    items: [
      "Navbar glass (blur) di landing dan changelog.",
      "Landing diringkas + footer baru.",
      "Halaman Changelog untuk memantau setiap pembaruan aplikasi.",
      "Halaman login menjadi satu halaman penuh tanpa kartu.",
    ],
  },
  {
    date: "29 Sep 2026",
    type: "Fitur",
    title: "Revisi klaim jadi catatan saja",
    desc: "Data perjalanan langsung dari statement Grab Business, jadi tidak diubah lewat chat — karyawan cukup menulis catatan untuk HR.",
    items: [
      "Perintah UBAH dan HAPUS dipensiunkan dari alur WhatsApp.",
      "Balasan teks bebas saat klaim direvisi otomatis menjadi catatan untuk HR.",
      "Daftar perjalanan (LIST/TICKET), SELESAI, dan INFO tetap tersedia.",
    ],
  },
  {
    date: "Sep 2026",
    type: "Fitur",
    title: "Penggantian trip tidak sesuai",
    desc: "Trip yang ditandai tidak sesuai diganti lewat alur transfer yang tuntas sampai konfirmasi.",
    items: [
      "HR menandai trip tidak sesuai dari detail klaim di web.",
      "Bot meminta nomor rekening karyawan lewat WhatsApp (NOREK).",
      "Konfirmasi transfer dengan SUDAH TF / BELUM TF.",
      "Rekening kantor diatur di halaman Pengaturan.",
    ],
  },
  {
    date: "Sep 2026",
    type: "Fitur",
    title: "Ticket EnvGate dari WhatsApp",
    desc: "Bukti kerja kini bisa ditempel langsung dari chat.",
    items: [
      "Wizard TICKET di WhatsApp untuk menautkan ticket EnvGate ke perjalanan.",
      "Kartu ticket otomatis tercetak di Report PDF.",
    ],
  },
  {
    date: "Sep 2026",
    type: "Peningkatan",
    title: "Report PDF rapi format A4",
    desc: "Laporan klaim lebih mudah dicetak dan diarsipkan.",
    items: [
      "Paginasi A4 agar baris tidak terpotong antar halaman.",
      "Kartu ticket EnvGate hadir di bagian bukti kerja.",
    ],
  },
  {
    date: "Sep 2026",
    type: "Baru",
    title: "Inventory barcode",
    desc: "Pendataan aset Perkom lebih cepat dan bebas salah ketik.",
    items: [
      "Pemindaian barcode langsung dari halaman Inventory.",
      "Pencarian dan pembaruan aset dalam satu alur.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <ScrollProgress />
      <SiteNavbar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-14 sm:py-20">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Changelog
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Semua pembaruan dan fitur terbaru dari Officeless Perkom.
        </p>

        <div className="mt-10 space-y-6">
          {ENTRIES.map((entry) => (
            <article
              key={entry.title}
              className="card border border-slate-200 bg-white shadow-sm"
            >
              <div className="card-body gap-2 p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-slate-500">
                    {entry.date}
                  </span>
                  <span className={`badge badge-sm border font-semibold ${TYPE_STYLES[entry.type]}`}>
                    {entry.type}
                  </span>
                </div>
                <h2 className="card-title text-lg font-semibold text-slate-900">
                  {entry.title}
                </h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  {entry.desc}
                </p>
                <ol className="mt-1 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600 marker:text-slate-400">
                  {entry.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>
            </article>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
