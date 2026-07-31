"use client";

import { useState, useEffect, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Trash2, CheckCircle2, AlertCircle } from "lucide-react";

interface Employee {
  id: string;
  employee_number: string;
  employee_name: string;
  department: string;
  has_signature: boolean;
}

export default function SignaturesPublicPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const selectedEmployee = employees.find(e => e.id === selectedEmpId) || null;

  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [savedSignaturePreview, setSavedSignaturePreview] = useState<string | null>(null);

  const sigRef = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/signatures/public")
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setEmployees(json.data || []);
        }
      })
      .finally(() => {
        setLoadingEmployees(false);
      });
  }, []);

  useEffect(() => {
    if (!containerRef.current || !sigRef.current) return;
    const container = containerRef.current;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && sigRef.current) {
          const canvas = sigRef.current.getCanvas();
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
            canvas.width = width * ratio;
            canvas.height = height * ratio;
            canvas.getContext("2d")?.scale(ratio, ratio);
            sigRef.current.clear();
          }
        }
      }
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const handleSaveSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!selectedEmployee) {
      setErrorMessage("Silakan pilih karyawan terlebih dahulu.");
      return;
    }
    if (!phoneNumber.trim()) {
      setErrorMessage("Nomor telepon wajib diisi.");
      return;
    }
    if (sigRef.current?.isEmpty()) {
      setErrorMessage("Silakan gambar tanda tangan Anda di kotak yang tersedia.");
      return;
    }

    setIsSaving(true);
    try {
      const signatureData = sigRef.current?.getTrimmedCanvas().toDataURL("image/png");
      
      const res = await fetch("/api/signatures/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: selectedEmployee.id,
          phone_number: phoneNumber.trim(),
          signature: signatureData,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan tanda tangan.");
      }

      setSavedSignaturePreview(signatureData || null);
      setSuccessModalOpen(true);
      
      setEmployees(prev => prev.map(emp => emp.id === selectedEmployee.id ? { ...emp, has_signature: true } : emp));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan sistem.";
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseSuccessModal = () => {
    setSuccessModalOpen(false);
    setSavedSignaturePreview(null);
    setSelectedEmpId("");
    setPhoneNumber("");
    sigRef.current?.clear();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 flex justify-center items-start">
      <div className="w-full max-w-xl bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-slate-100 bg-white">
          <h1 className="text-xl font-bold text-slate-900">Pendaftaran Tanda Tangan</h1>
          <p className="text-sm text-slate-500 mt-1">Lengkapi data untuk mendaftarkan tanda tangan digital Anda.</p>
        </div>

        <form onSubmit={handleSaveSignature} className="p-6 space-y-6">
          <div className="space-y-4">
            
            <div className="space-y-2">
              <Label htmlFor="employee_name">Nama</Label>
              <div className="relative">
                <select
                  value={selectedEmpId}
                  onChange={(e) => {
                    setSelectedEmpId(e.target.value);
                    setErrorMessage("");
                    if (sigRef.current) sigRef.current.clear();
                  }}
                  disabled={loadingEmployees}
                  className="w-full flex h-10 items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" disabled>
                    {loadingEmployees ? "Memuat data..." : "Pilih Nama"}
                  </option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_name} {emp.has_signature ? "(Sudah ada)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee_number">Employee Number</Label>
              <Input 
                id="employee_number" 
                value={selectedEmployee?.employee_number || ""} 
                disabled 
                placeholder="EMP001" 
                className="bg-slate-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input 
                id="department" 
                value={selectedEmployee?.department || ""} 
                disabled 
                placeholder="Finance" 
                className="bg-slate-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input 
                id="phone_number" 
                value={phoneNumber} 
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="628xxxxxxxxxx" 
                disabled={!selectedEmpId || isSaving}
              />
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label>Tanda Tangan (Opsional)</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => sigRef.current?.clear()}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Hapus
                </Button>
              </div>
              
              <div 
                ref={containerRef}
                className="w-full h-56 border border-dashed border-slate-300 rounded-md relative overflow-hidden bg-white"
              >
                <SignatureCanvas
                  ref={sigRef}
                  penColor="#0f172a"
                  canvasProps={{
                    className: "w-full h-full cursor-crosshair touch-none",
                  }}
                />
                {!selectedEmpId && (
                  <div className="absolute inset-0 bg-slate-50/50 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                    <span className="text-sm text-slate-500 font-medium bg-white px-4 py-1.5 rounded-full shadow-sm border border-slate-100">
                      Pilih karyawan terlebih dahulu
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setSelectedEmpId("");
                setPhoneNumber("");
                sigRef.current?.clear();
              }}
            >
              Batal
            </Button>
            <Button 
              type="submit" 
              disabled={isSaving || !selectedEmpId || !phoneNumber.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isSaving ? "Loading..." : "Tambah"}
            </Button>
          </div>
        </form>
      </div>

      <Dialog open={successModalOpen} onOpenChange={handleCloseSuccessModal}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader className="text-center pt-2">
            <div className="mx-auto w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl">Berhasil Disimpan!</DialogTitle>
            <DialogDescription className="pt-2 text-slate-500">
              Tanda tangan digital Anda telah berhasil didaftarkan.
            </DialogDescription>
          </DialogHeader>
          
          {savedSignaturePreview && (
            <div className="flex justify-center p-4 bg-slate-50 rounded-lg border border-slate-100 my-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={savedSignaturePreview} alt="Signature" className="max-h-24 object-contain mix-blend-multiply" />
            </div>
          )}

          <DialogFooter className="sm:justify-center">
            <Button onClick={handleCloseSuccessModal} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
              Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
