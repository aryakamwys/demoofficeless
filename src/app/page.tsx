import type { Metadata } from "next";
import { Heart } from "lucide-react";
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
      <main className="flex flex-1 items-center justify-center px-4">
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Heart className="h-4 w-4 fill-red-500 text-red-500" aria-hidden="true" />
          I love Davina — dari Arya
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
