"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Update data otomatis tanpa refresh browser — status klaim berubah via
 *  WhatsApp langsung kelihatan (pemakai aplikasi ini tidak perlu tekan F5).
 *  Hanya jalan saat tab terlihat supaya tab di background tidak membebani server. */
export function AutoRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
