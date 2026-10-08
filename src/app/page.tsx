import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, FileSpreadsheet, MessageSquareCheck, Route } from "lucide-react";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { Hero3D } from "@/components/hero-3d";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Officeless Perkom — Klaim Grab Business via WhatsApp",
  description:
    "Pengajuan, persetujuan Manager & HR, dan laporan klaim perjalanan Grab Business karyawan — cukup dari WhatsApp.",
};

// Landing publik: hero 3D ringan (three.js) + ringkasan cara kerja modul
// klaim Grab. Palet mengikuti DESIGN.md (biru + slate, kartu putih).
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNavbar />

      <main className="flex-1">
        {/* ==== Hero ==== */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-blue-50/80 via-white to-white" />
          <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Internal PT Perkom
              </span>
              <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl">
                Klaim perjalanan Grab, selesai tanpa ribet.
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-slate-600">
                Karyawan cukup buka satu link dari WhatsApp. Manager dan HR
                menyetujui dari antrean masing-masing. Semua tercatat rapi —
                dari statement sampai tanda tangan.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild className="h-11 rounded-full px-6 text-base">
                  <Link href="/login">Masuk</Link>
                </Button>
                <Link
                  href="#cara-kerja"
                  className="rounded-full px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  Lihat cara kerjanya
                </Link>
              </div>
            </div>
            <Hero3D className="h-64 w-full md:h-[380px]" />
          </div>
        </section>

        {/* ==== Demo / cara kerja ==== */}
        <section id="cara-kerja" className="border-t border-slate-200 bg-slate-50/60">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Cara kerjanya
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
              Tiga langkah di modul HR — dari statement Grab sampai klaim
              disetujui penuh.
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: FileSpreadsheet,
                  title: "Upload Grab",
                  desc: "HR mengunggah statement perjalanan Grab Business (CSV/PDF). Klaim per karyawan dibuat otomatis, lengkap dengan rute dan nominalnya.",
                },
                {
                  icon: MessageSquareCheck,
                  title: "Klaim via link",
                  desc: "Karyawan menerima link WhatsApp pribadi: cek perjalanannya, konfirmasi sekali klik, atau kirim catatan bila ada yang salah.",
                },
                {
                  icon: CheckCircle2,
                  title: "Approval Manager & HR",
                  desc: "Manager dan HR memproses antrean klaim dari satu halaman — termasuk paraf untuk perjalanan yang dibela karyawannya.",
                },
              ].map((s, i) => (
                <div
                  key={s.title}
                  className="rounded-xl border border-slate-200 bg-white p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <s.icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="text-xs font-bold text-slate-300">
                      LANGKAH {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-slate-800">
                    {s.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Ilustrasi alur ringkas */}
            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" /> Upload Grab
              </span>
              <Route className="h-4 w-4 text-slate-300" />
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                <Image
                  src="/ogoperkom.png"
                  alt=""
                  width={16}
                  height={16}
                  className="h-4 w-4 object-contain"
                />{" "}
                Claims Grab
              </span>
              <Route className="h-4 w-4 text-slate-300" />
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                <CheckCircle2 className="h-4 w-4 text-blue-600" /> Disetujui
              </span>
            </div>

            <div className="mt-8">
              <Button asChild className="h-11 rounded-full px-6">
                <Link href="/login">Masuk dan mulai</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
