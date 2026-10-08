import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, Link2, ShieldCheck } from "lucide-react";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { ProductVisual } from "@/components/product-visual";

export const metadata: Metadata = {
  title: "Officeless Perkom — Klaim Grab Business via WhatsApp",
  description:
    "Pengajuan, persetujuan Manager & HR, dan laporan klaim perjalanan Grab Business karyawan — cukup dari WhatsApp.",
};

// Landing publik: hero dengan visual produk asli (mockup portal + chip WA
// + adegan 3D ambient), lalu alur kerja 3 langkah. Komponen daisyUI dipakai
// untuk tombol/steps/kartu — warna tetap token DESIGN.md (biru + slate).
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNavbar />

      <main className="flex-1">
        {/* ==== Hero ==== */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-blue-50/70 via-white to-white" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:grid-cols-2 md:py-20">
            <div>
              <span className="badge badge-outline gap-1.5 border-blue-200 bg-blue-50 px-3 py-3 text-xs font-semibold text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                Internal PT Perkom
              </span>
              <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 md:text-[3.4rem]">
                Klaim perjalanan Grab,{" "}
                <span className="text-blue-600">selesai dari HP.</span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600">
                HR unggah statement, karyawan tinggal buka satu link WhatsApp,
                Manager dan HR menyetujui dari antrean — semua tercatat sampai
                tanda tangan.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/login" className="btn btn-primary h-12 min-h-0 rounded-full px-7 text-base font-semibold">
                  Masuk
                </Link>
                <a
                  href="#cara-kerja"
                  className="btn btn-ghost h-12 min-h-0 rounded-full px-5 text-base font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cara kerjanya ↓
                </a>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-blue-600" /> Satu link, tanpa instal aplikasi
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Approval Manager & HR + paraf
                </span>
              </div>
            </div>
            <ProductVisual />
          </div>
        </section>

        {/* ==== Cara kerja ==== */}
        <section id="cara-kerja" className="border-t border-slate-200 bg-slate-50/70">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
              Tiga langkah, selesai.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-base leading-relaxed text-slate-600">
              Dari statement Grab sampai klaim disetujui penuh — tanpa
              spreadsheet, tanpa kejar-kejaran tanda tangan.
            </p>

            {/* Steps daisyUI */}
            <ul className="steps mx-auto mt-10 w-full max-w-2xl">
              <li className="step step-primary text-sm font-semibold">Upload statement</li>
              <li className="step step-primary text-sm font-semibold">Karyawan konfirmasi</li>
              <li className="step step-primary text-sm font-semibold">Manager & HR setuju</li>
            </ul>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: FileSpreadsheet,
                  title: "Upload Grab",
                  desc: "Statement perjalanan (CSV/PDF) diunggah sekali — klaim per karyawan langsung terbentuk lengkap dengan rute dan nominalnya.",
                },
                {
                  icon: Link2,
                  title: "Link WhatsApp pribadi",
                  desc: "Karyawan menerima link berisi klaimnya: cek perjalanan, konfirmasi sekali klik, kirim catatan, atau unggah bukti transfer.",
                },
                {
                  icon: ShieldCheck,
                  title: "Approval berjenjang",
                  desc: "Manager dan HR memproses antrean dari satu halaman — termasuk paraf untuk perjalanan yang dibela karyawannya.",
                },
              ].map((s) => (
                <div key={s.title} className="card border border-slate-200 bg-white shadow-sm">
                  <div className="card-body p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <s.icon className="h-5 w-5" />
                    </span>
                    <h3 className="card-title mt-2 text-base font-semibold text-slate-800">
                      {s.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <Link href="/login" className="btn btn-primary h-12 min-h-0 rounded-full px-8 text-base font-semibold">
                Masuk dan mulai
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
