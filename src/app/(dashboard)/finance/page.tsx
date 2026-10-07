import type { Metadata } from "next";
import { getSuperadminUser } from "@/lib/superadmin";
import { DocumentRequests } from "@/components/finance/document-requests";

export const metadata: Metadata = { title: "Finance — Officeless Perkom" };

export default async function FinancePage() {
  const admin = await getSuperadminUser();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Finance</h1>
        <p className="text-sm text-slate-500">
          Request dokumen (PR/PO/dll) dengan approval manager, lalu diproses
          finance.
        </p>
      </div>
      <DocumentRequests isSuperadmin={!!admin} />
    </div>
  );
}
