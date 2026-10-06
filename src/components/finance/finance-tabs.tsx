"use client";

import { useState } from "react";
import { FileText, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentRequests } from "@/components/finance/document-requests";
import { FinanceReport } from "@/components/services/finance-report";
import type { FinanceClaimRow } from "@/components/services/finance-report";

export function FinanceTabs({
  claims,
  isSuperadmin,
}: {
  claims: FinanceClaimRow[];
  isSuperadmin: boolean;
}) {
  const [tab, setTab] = useState<"requests" | "claims">("requests");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Finance</h1>
        <p className="text-sm text-slate-500">
          Request dokumen (PR/PO/dll) dengan approval manager, dan rekap klaim
          yang siap dibayar.
        </p>
      </div>

      <div className="flex w-fit rounded-lg bg-slate-100 p-1">
        <button
          onClick={() => setTab("requests")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "requests"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <FileText className="h-4 w-4" /> Request Dokumen
        </button>
        <button
          onClick={() => setTab("claims")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "claims"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Wallet className="h-4 w-4" /> Klaim Disetujui
        </button>
      </div>

      {tab === "requests" ? (
        <DocumentRequests isSuperadmin={isSuperadmin} />
      ) : (
        <FinanceReport claims={claims} />
      )}
    </div>
  );
}
