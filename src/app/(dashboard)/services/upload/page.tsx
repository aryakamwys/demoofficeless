"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, Upload as UploadIcon, FileImage } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function UploadClaimPage() {
  const router = useRouter();
  const [ticketId, setTicketId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);
  
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const searchTicket = async () => {
    if (!ticketId) {
      toast.error("Masukkan ID Tiket terlebih dahulu");
      return;
    }

    setIsSearching(true);
    setTicketData(null);
    try {
      const res = await fetch(`/api/services/${ticketId.replace('#', '').trim()}`);
      const result = await res.json();

      if (result.success && result.data) {
        setTicketData(result.data);
        toast.success("Data tiket ditemukan");
      } else {
        toast.error(result.error || "Tiket tidak ditemukan");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan saat mencari tiket");
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpload = async () => {
    if (!ticketData || !file || !amount) {
      toast.error("Mohon lengkapi semua data dan file");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("ticket_id", String(ticketData.id));
      formData.append("ticket_title", ticketData.title || "");
      // Kita coba ambil customer_name dari title atau field lain yang relevan di InvGate
      // InvGate tidak selalu punya 'customer_name' di root object, kadang ada di custom fields
      formData.append("customer_name", ticketData.customer_name || ""); 
      formData.append("location", ticketData.location || ""); 
      formData.append("amount", amount);
      formData.append("file", file);

      const res = await fetch("/api/claims/managed-service", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!result.success) {
        toast.error(result.error || "Gagal mengunggah klaim");
        return;
      }

      toast.success("Klaim berhasil diunggah!");
      router.push("/services"); // Redirect back to services list
    } catch (error) {
      toast.error("Terjadi kesalahan saat mengunggah file");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Upload Bukti Transport (Grab/Gojek)</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Cari Tiket InvGate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input 
              placeholder="Masukkan ID Tiket (contoh: 32409)" 
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchTicket()}
            />
            <Button onClick={searchTicket} disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Cari</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {ticketData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Detail Klaim Transport</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-md border border-slate-100">
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase">Ticket ID</p>
                <p className="font-semibold text-slate-900">#{ticketData.id}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase">Category</p>
                <p className="font-semibold text-slate-900 line-clamp-1" title={ticketData.category_details?.name || ticketData.category_id}>
                  {ticketData.category_details?.name || ticketData.category_details?.full_name || ticketData.category_id || "N/A"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-slate-500 font-medium uppercase">Subject / Title</p>
                <p className="font-semibold text-slate-900">{ticketData.title}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium">Nominal Klaim (Rp)</label>
              <Input 
                type="number" 
                placeholder="Contoh: 150000" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">File Bukti / Receipt (JPG, PNG, PDF)</label>
              <div className="flex items-center gap-3">
                <Input 
                  type="file" 
                  accept=".jpg,.jpeg,.png,.pdf" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
              </div>
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <FileImage className="h-4 w-4" />
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            <Button onClick={handleUpload} disabled={isUploading || !file || !amount} className="w-full mt-4">
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadIcon className="mr-2 h-4 w-4" />
              )}
              {isUploading ? "Mengunggah..." : "Submit Klaim"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
