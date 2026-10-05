"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Update data otomatis tanpa refresh browser — status klaim berubah via
 *  WhatsApp langsung kelihatan (pemakai aplikasi ini tidak perlu tekan F5).
 *  Hanya jalan saat tab terlihat supaya tab di background tidak membebani server.
 *  enabled=false menghentikan polling (mis. klaim sudah final/APPROVED —
 *  tidak ada lagi yang berubah, query + payload base64 ttd tidak perlu diulang). */
export function AutoRefresh({
  intervalMs = 10000,
  enabled = true,
}: {
  intervalMs?: number;
  enabled?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs, enabled]);

  return null;
}
