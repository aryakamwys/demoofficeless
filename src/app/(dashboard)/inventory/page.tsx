"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Boxes, Loader2, Plus, ScanBarcode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ScannedItem {
  barcode: string;
  name: string;
  location: string;
}

interface Asset {
  id: string;
  barcode: string;
  name?: string;
  location?: string;
  created_at?: string;
}

export default function InventoryPage() {
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory");
      const result = await res.json();
      if (result.success) setAssets(result.data);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  // Stop scanner saat komponen unmount / pindah halaman
  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  const addBarcode = useCallback((barcode: string) => {
    const code = barcode.trim();
    if (!code) return;
    setItems((prev) => {
      if (prev.some((i) => i.barcode === code)) {
        toast.info(`Barcode ${code} sudah ada di daftar`);
        return prev;
      }
      return [{ barcode: code, name: "", location: "" }, ...prev];
    });
  }, []);

  const startScan = async () => {
    try {
      const scanner = new Html5Qrcode("scanner-region");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decoded) => addBarcode(decoded),
        () => {} // error per-frame (belum terbaca) diabaikan
      );
      setScanning(true);
    } catch (e) {
      toast.error(
        "Kamera tidak bisa diakses: " +
          (e instanceof Error ? e.message : "izinkan akses kamera di browser")
      );
    }
  };

  const stopScan = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      // scanner sudah berhenti
    }
    setScanning(false);
  };

  const updateItem = (barcode: string, field: "name" | "location", value: string) => {
    setItems((prev) =>
      prev.map((i) => (i.barcode === barcode ? { ...i, [field]: value } : i))
    );
  };

  const saveAll = async () => {
    if (items.length === 0) {
      toast.error("Belum ada barcode yang discan");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || "Gagal menyimpan");
      toast.success(`${items.length} asset tersimpan`);
      setItems([]);
      void fetchAssets();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Scanner */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <ScanBarcode className="h-4 w-4 text-blue-600" /> Scan Barcode Asset
          </h2>
          {scanning ? (
            <Button variant="outline" size="sm" className="h-8 border-slate-300" onClick={stopScan}>
              Stop Scan
            </Button>
          ) : (
            <Button size="sm" className="h-8" onClick={startScan}>
              <ScanBarcode className="mr-2 h-3.5 w-3.5" /> Mulai Scan
            </Button>
          )}
        </div>

        <div
          id="scanner-region"
          className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50"
          style={{ minHeight: scanning ? undefined : 0 }}
        />

        {/* Input manual fallback */}
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addBarcode(manual);
            setManual("");
          }}
        >
          <Input
            placeholder="Atau ketik barcode manual, tekan Enter"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            className="border-slate-300"
          />
          <Button type="submit" variant="outline" className="border-slate-300">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Hasil scan */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Boxes className="h-4 w-4 text-blue-600" /> Hasil Scan ({items.length})
          </h2>
          <Button size="sm" className="h-8" onClick={saveAll} disabled={saving || items.length === 0}>
            {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Simpan Semua
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">
            Belum ada barcode. Scan dengan kamera atau masukkan manual di atas.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.barcode} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center">
                <span className="w-fit rounded bg-blue-50 px-2 py-1 font-mono text-xs font-semibold text-blue-700">
                  {item.barcode}
                </span>
                <Input
                  placeholder="Nama asset (mis. Laptop Lenovo M70q)"
                  value={item.name}
                  onChange={(e) => updateItem(item.barcode, "name", e.target.value)}
                  className="flex-1 border-slate-300"
                />
                <Input
                  placeholder="Lokasi (mis. Office Jakarta)"
                  value={item.location}
                  onChange={(e) => updateItem(item.barcode, "location", e.target.value)}
                  className="flex-1 border-slate-300"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-400 hover:text-red-600"
                  onClick={() => setItems((prev) => prev.filter((i) => i.barcode !== item.barcode))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Asset terdaftar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Asset Terdaftar</h2>
        <div className="overflow-x-auto border border-slate-300">
          <table className="w-full min-w-[700px] border-collapse bg-white text-[11px]">
            <thead>
              <tr>
                {["Barcode", "Nama Asset", "Lokasi", "Terdaftar"].map((h) => (
                  <th key={h} className="whitespace-nowrap border border-slate-300 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingList ? (
                <tr>
                  <td colSpan={4} className="border border-slate-200 py-10 text-center text-slate-500">
                    <Loader2 className="mx-auto mb-2 h-7 w-7 animate-spin text-blue-500" />
                    Loading...
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-slate-200 py-8 text-center text-slate-500">
                    Belum ada asset terdaftar
                  </td>
                </tr>
              ) : (
                assets.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-blue-50/30">
                    <td className="border border-slate-200 px-2 py-2 font-mono font-medium text-blue-600">{a.barcode}</td>
                    <td className="border border-slate-200 px-2 py-2 text-slate-700">{a.name || "—"}</td>
                    <td className="border border-slate-200 px-2 py-2 text-slate-700">{a.location || "—"}</td>
                    <td className="whitespace-nowrap border border-slate-200 px-2 py-2 text-slate-700">
                      {a.created_at
                        ? new Date(a.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
