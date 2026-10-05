"use client";

// Pengaturan aplikasi. Saat ini: rekening kantor — tujuan transfer penggantian
// trip "tidak sesuai" yang diminta dari karyawan lewat WhatsApp.
import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type BankSettings = {
  company_bank_name?: string;
  company_account_number?: string;
  company_account_name?: string;
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then(async (res) => {
        const json = await res.json();
        if (json.success) {
          const d: BankSettings = json.data || {};
          setBankName(d.company_bank_name || "");
          setAccountNumber(d.company_account_number || "");
          setAccountName(d.company_account_name || "");
        }
      })
      .catch(() => toast.error("Gagal memuat pengaturan"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_bank_name: bankName,
          company_account_number: accountNumber,
          company_account_name: accountName,
        }),
      });
      const json = await res.json();
      if (json.success) toast.success("Rekening kantor tersimpan");
      else toast.error(json.error || "Gagal menyimpan");
    } catch {
      toast.error("Terjadi kesalahan sistem.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-lg font-semibold text-slate-800">Pengaturan</h1>
      <p className="mb-6 text-sm text-slate-500">
        Konfigurasi aplikasi untuk alur klaim Grab.
      </p>

      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center gap-2 border-b border-slate-100 py-4">
          <span className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
            <Building2 className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-base font-semibold text-slate-800">
              Rekening Kantor
            </CardTitle>
            <p className="text-xs text-slate-500">
              Tujuan transfer penggantian trip yang ditandai tidak sesuai.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bank-name">Nama bank</Label>
                  <Input
                    id="bank-name"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Contoh: BCA"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-number">Nomor rekening</Label>
                  <Input
                    id="account-number"
                    inputMode="numeric"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/[^\d\s\-]/g, ""))}
                    placeholder="Contoh: 1234567890"
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-name">Atas nama</Label>
                <Input
                  id="account-name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Contoh: PT Perkom Solusi"
                  maxLength={100}
                />
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                <p className="text-xs leading-relaxed text-slate-400">
                  Wajib diisi sebelum menandai trip di detail klaim — kalau kosong,
                  penandaan ditolak dan karyawan tidak dikirimi rekening.
                </p>
                <Button
                  onClick={save}
                  disabled={saving || !bankName.trim() || !accountNumber.trim()}
                  className="shrink-0"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
