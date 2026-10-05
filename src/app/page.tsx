import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Officeless Perkom — Klaim Grab Business via WhatsApp",
  description:
    "Pengajuan, persetujuan Manager & HR, dan laporan klaim perjalanan Grab Business karyawan — cukup dari WhatsApp.",
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNavbar />

      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:py-24">
        {/* Pembuka: satu kartu terpusat, gaya docs.bagibagi.co */}
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
          <div className="mx-auto w-fit rounded-2xl bg-blue-50 p-3">
            <Image
              src="/ogoperkom.png"
              alt="Logo Perkom"
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              priority
            />
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">
            Selamat datang di Officeless Perkom
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
            Pengelolaan klaim perjalanan Grab Business — unggah statement,
            persetujuan Manager &amp; HR, laporan PDF, dan penggantian trip —
            semuanya cukup dari WhatsApp.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">Masuk</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/docs">Dokumentasi</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Akun internal Perkom · hubungi HR bila belum punya akses
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
