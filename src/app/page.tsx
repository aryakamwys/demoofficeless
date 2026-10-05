import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { MessageCircle, Ticket, QrCode } from "lucide-react";

export const metadata: Metadata = {
  title: "Officeless Perkom — Klaim Grab Business via WhatsApp",
  description:
    "Pengajuan, persetujuan Manager & HR, dan laporan klaim perjalanan Grab Business karyawan — cukup dari WhatsApp.",
};

const FEATURES = [
  {
    icon: MessageCircle,
    title: "Approval lewat WhatsApp",
    text: "Karyawan dan approver cukup balas chat — tanpa buka laptop, tanpa form.",
  },
  {
    icon: Ticket,
    title: "Bukti kerja EnvGate",
    text: "Ticket EnvGate tertaut per perjalanan dan otomatis tercetak di Report PDF.",
  },
  {
    icon: QrCode,
    title: "Inventory barcode",
    text: "Pendataan aset Perkom dengan scan barcode — cepat dan tanpa salah ketik.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Navbar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Image
            src="/ogoperkom.png"
            alt="Logo Perkom"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            priority
          />
          <span className="text-sm font-bold text-slate-800">Officeless Perkom</span>
          <nav className="ml-auto flex items-center gap-2">
            <Link
              href="/docs"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Dokumentasi
            </Link>
            <Button asChild>
              <Link href="/login">Masuk</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — teks kiri, kartu akses kanan (pola landing LMS) */}
        <section className="bg-slate-50">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
            <div>
              <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
                Klaim Grab Business, selesai dari WhatsApp.
              </h1>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-600">
                Officeless Perkom mengelola pengajuan klaim perjalanan karyawan —
                dari unggah statement Grab, persetujuan Manager &amp; HR, sampai
                laporan PDF — semuanya cukup dari HP.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/login">Masuk ke Aplikasi</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/docs">Baca Dokumentasi</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-base font-semibold text-slate-800">
                Masuk ke Officeless
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                Persetujuan klaim dikirim lewat chat — masuk di sini untuk mengelola
                data karyawan, statement, dan laporan.
              </p>
              <Button asChild className="mt-5 w-full" size="lg">
                <Link href="/login">Masuk</Link>
              </Button>
              <p className="mt-3 text-center text-xs text-slate-400">
                Akun internal Perkom · hubungi HR bila belum punya akses
              </p>
            </div>
          </div>
        </section>

        {/* Fitur */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-6 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-5">
                <span className="inline-flex rounded-xl bg-blue-50 p-2.5 text-blue-600">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-slate-800">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <Image
                src="/ogoperkom.png"
                alt="Logo Perkom"
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
              />
              <span className="text-sm font-bold text-slate-800">PT Perkom</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Officeless — aplikasi internal untuk klaim Grab Business dan layanan
              operasional Perkom.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Kontak</h3>
            <p className="mt-2 text-sm text-slate-500">admin@perkom.co.id</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Tautan</h3>
            <div className="mt-2 flex flex-col items-start gap-1.5">
              <Link href="/docs" className="text-sm text-slate-500 transition-colors hover:text-blue-700">
                Dokumentasi
              </Link>
              <Link href="/login" className="text-sm text-slate-500 transition-colors hover:text-blue-700">
                Masuk
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 py-4">
          <p className="mx-auto max-w-6xl px-4 text-xs text-slate-400">
            © 2026 PT Perkom. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
