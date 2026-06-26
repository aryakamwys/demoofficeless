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
              <div className="bg-white border rounded-md shadow-sm">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between p-5 border-b border-slate-100">
                  <div className="flex-1">
                    <h3 className="text-xl font-medium text-slate-800 mb-2">
                      {ticketData.title || ticketData.subject || "No Subject"}
                    </h3>
                    <div className="text-[13px] text-slate-500 flex flex-wrap items-center gap-2">
                      <span>{ticketData.category_details?.name || "Uncategorized"}</span>
                      <span>&raquo;</span>
                      <span>{ticketData.assigned_group_details?.name || "Unassigned"}</span>
                      <span>&raquo;</span>
                      <span>Others</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-4 md:mt-0">
                    <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
                      <span className="text-slate-400">📍</span>
                      {ticketData.location?.name || ticketData.custom_fields?.location || "Unknown Location"}
                    </div>
                    <div className="bg-[#6281c0] text-white px-4 py-2 rounded-md font-medium shadow-sm">
                      #{ticketData.id}
                    </div>
                  </div>
                </div>

                {/* Grid Section 1 */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-5 border-b border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Priority</p>
                    <p className="text-sm font-semibold text-slate-800">{ticketData.priority?.name || "Medium"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Type</p>
                    <p className="text-sm font-semibold text-slate-800">{ticketData.type?.name || "Service Request"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Source</p>
                    <p className="text-sm font-semibold text-slate-800">{ticketData.source?.name || "Email"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">First Response</p>
                    <p className="text-sm font-semibold text-emerald-500">Correct</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Resolution</p>
                    <p className="text-sm font-semibold text-slate-800">Paused (0%)</p>
                  </div>
                </div>

                {/* Grid Section 2 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 border-b border-slate-100 bg-slate-50/50">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Incident Location</p>
                    <p className="text-sm font-medium text-slate-800">{ticketData.location?.name || "Jabodetabek"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Details Location</p>
                    <p className="text-sm font-medium text-slate-800">-</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">SLA Type</p>
                    <p className="text-sm font-medium text-slate-800">Managed Service</p>
                  </div>
                </div>

                {/* Timeline / Description Section */}
                <div className="p-5 bg-slate-50/30">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 mt-2">
                      <div className="h-10 w-10 rounded-full bg-slate-400 flex items-center justify-center text-white font-medium shadow-sm">
                        SY
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="bg-white border border-slate-200 rounded-lg rounded-tl-none p-4 shadow-sm relative">
                        {/* Little triangle for chat bubble */}
                        <div className="absolute top-0 -left-[9px] w-0 h-0 border-t-[0px] border-t-transparent border-r-[10px] border-r-slate-200 border-b-[15px] border-b-transparent"></div>
                        <div className="absolute top-[1px] -left-[7px] w-0 h-0 border-t-[0px] border-t-transparent border-r-[8px] border-r-white border-b-[12px] border-b-transparent z-10"></div>
                        
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-medium text-slate-800">System / Requestor</h4>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">A Day Ago</span>
                            <span className="text-[10px] font-semibold text-white uppercase tracking-wider bg-[#6281c0] px-2 py-0.5 rounded">Description</span>
                          </div>
                        </div>
                        <div 
                          className="prose prose-sm max-w-none text-slate-600 prose-p:my-1 prose-headings:my-2 prose-a:text-blue-600 font-sans"
                          dangerouslySetInnerHTML={{ __html: ticketData.description || "<p>No description provided.</p>" }}
                        />
                      </div>
                    </div>
                  </div>
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
