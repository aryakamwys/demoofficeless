"use client";

// Pengaturan aplikasi. Saat ini: rekening kantor — tujuan transfer penggantian
// trip "tidak sesuai" yang diminta dari karyawan lewat WhatsApp.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
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
    <div className="space-y-6 max-w-xl">
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50/50 border-b pb-4">
          <CardTitle className="text-base font-semibold text-slate-800">Rekening Kantor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <p className="text-sm text-slate-500">
            Tujuan transfer saat karyawan mengganti biaya trip yang ditandai
            <span className="font-medium text-slate-700"> tidak sesuai</span> (mis. arah pulang di jam kantor).
            Nominal &amp; rekening ini otomatis tercantum di pesan WhatsApp karyawan.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
            </div>
          ) : (
            <>
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
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/[^\d\s\-]/g, ""))}
                  placeholder="Contoh: 1234567890"
                  maxLength={100}
                />
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
              <Button
                onClick={save}
                disabled={saving || !bankName.trim() || !accountNumber.trim()}
                className="bg-[#00B14F] hover:bg-[#009040] text-white"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
              </Button>
              <p className="text-xs text-slate-400">
                Wajib diisi sebelum menandai trip di detail klaim — kalau kosong,
                penandaan akan ditolak dan karyawan tidak dikirimi rekening.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
