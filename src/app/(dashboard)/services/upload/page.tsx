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
          <CardTitle className="text-base">1. Cari Tiket EnvGate</CardTitle>
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
            <div className="bg-slate-50 border rounded-lg p-5 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-medium text-slate-800">{ticketData.title || ticketData.subject || "No Subject"}</h3>
                    <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                      #{ticketData.id}
                    </span>
                  </div>
                  <div className="text-sm text-slate-500 flex items-center gap-2">
                    <span className="font-medium">{ticketData.category_details?.name || "Uncategorized"}</span>
                    <span>&bull;</span>
                    <span>{ticketData.assigned_group_details?.name || "Unassigned"}</span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1 text-slate-400">
                       📍 {ticketData.location?.name || ticketData.custom_fields?.location || "Unknown Location"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-slate-200">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1">Priority</p>
                  <p className="text-sm font-medium text-slate-700">{ticketData.priority?.name || "Medium"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1">Type</p>
                  <p className="text-sm font-medium text-slate-700">{ticketData.type?.name || "Service Request"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1">Source</p>
                  <p className="text-sm font-medium text-slate-700">{ticketData.source?.name || "Email"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1">Resolution</p>
                  <p className="text-sm font-medium text-slate-700">{ticketData.status?.name || "Pending"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1">Incident Location</p>
                  <p className="text-sm font-medium text-slate-700">{ticketData.custom_fields?.incident_location || ticketData.location?.name || "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1">Details Location</p>
                  <p className="text-sm font-medium text-slate-700">{ticketData.custom_fields?.details_location || "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase mb-1">SLA Type</p>
                  <p className="text-sm font-medium text-slate-700">{ticketData.sla?.name || ticketData.custom_fields?.sla_type || "Managed Service"}</p>
                </div>
              </div>

              {ticketData.description && (
                <div className="bg-white border rounded p-4 text-sm text-slate-600 prose prose-sm max-w-none" 
                     dangerouslySetInnerHTML={{ __html: ticketData.description }} />
              )}
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
