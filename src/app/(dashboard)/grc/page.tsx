// Modul GRC (governance, risk & compliance) — kerangka menu + halaman awal.
// Isi modul menyusul; halaman ini memastikan menu tidak menabrak 404.
import { Scale } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function GrcPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">GRC</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Governance, Risk &amp; Compliance PT Perkom.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Scale className="h-6 w-6" />
          </span>
          <p className="text-base font-semibold text-slate-800">
            Modul GRC sedang disiapkan
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-slate-500">
            Kerangka menu dan halaman sudah tersedia. Fitur kepatuhan, risiko,
            dan tata kelola akan diaktifkan bertahap.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
