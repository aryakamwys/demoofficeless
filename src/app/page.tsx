import type { Metadata } from "next";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Officeless Perkom — Klaim Grab Business via WhatsApp",
  description:
    "Pengajuan, persetujuan Manager & HR, dan laporan klaim perjalanan Grab Business karyawan — cukup dari WhatsApp.",
};

// Landing sengaja dikosongkan dulu — hanya navbar + footer.
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNavbar />
      <main className="flex-1" />
      <SiteFooter />
    </div>
  );
}
