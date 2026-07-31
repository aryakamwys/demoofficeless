"use client";

import { useState, useEffect, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { ArrowRight, Trash2, CheckCircle2, User, Building, Phone } from "lucide-react";

export default function SignaturesPublicPage() {
  const [employeeName, setEmployeeName] = useState("");
  const [department, setDepartment] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const sigRef = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
            const data = !sigRef.current.isEmpty() ? sigRef.current.toDataURL() : null;
            
            canvas.width = width * ratio;
            canvas.height = height * ratio;
            canvas.getContext("2d")?.scale(ratio, ratio);
            
            if (data) {
              sigRef.current.fromDataURL(data);
            } else {
              sigRef.current.clear();
            }
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

    if (!employeeName.trim() || !phoneNumber.trim()) {
      setErrorMessage("Nama Lengkap dan No WhatsApp wajib diisi.");
      return;
    }
    if (sigRef.current?.isEmpty()) {
      setErrorMessage("Tanda tangan tidak boleh kosong. Silakan gambar pada kanvas.");
      return;
    }

    setIsSaving(true);
    try {
      const signatureData = sigRef.current?.getTrimmedCanvas().toDataURL("image/png");
      
      const res = await fetch("/api/signatures/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_name: employeeName.trim(),
          department: department.trim(),
          phone_number: phoneNumber.trim(),
          signature: signatureData,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan data.");
      }

      setSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSaving(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full">
          <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Berhasil Terdaftar!</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Data karyawan dan tanda tangan digital untuk <span className="font-semibold text-slate-700">{employeeName}</span> telah berhasil disimpan ke dalam sistem.
          </p>
          <button 
            onClick={() => {
              setSuccess(false);
              setEmployeeName("");
              setDepartment("");
              setPhoneNumber("");
              setTimeout(() => sigRef.current?.clear(), 100);
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Daftarkan Karyawan Lain
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSaveSignature} className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* Left Column: Modern Form */}
      <div className="w-full md:w-[45%] lg:w-[35%] bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] shrink-0 md:h-screen">
        
        <div className="p-6 md:p-8 pb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight mb-2">
            Registrasi Tanda Tangan
          </h1>
          <p className="text-slate-500 text-sm">
            Lengkapi profil Anda dan gambarkan tanda tangan digital yang akan digunakan untuk dokumen resmi.
          </p>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 md:overflow-y-auto px-6 md:px-8 py-4 space-y-6">
            
            {/* Identity Information */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Informasi Karyawan</h2>
              
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">NAMA LENGKAP <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Masukkan nama lengkap"
                    value={employeeName}
                    onChange={e => setEmployeeName(e.target.value)}
                    disabled={isSaving}
                    className="w-full pl-10 bg-white border border-slate-300 p-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400 disabled:opacity-50 transition-all"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">DEPARTEMEN</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Contoh: Marketing"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    disabled={isSaving}
                    className="w-full pl-10 bg-white border border-slate-300 p-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400 disabled:opacity-50 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4 pt-2">
              <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">Kontak</h2>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">NO WHATSAPP <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="tel"
                    placeholder="08123456789"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    disabled={isSaving}
                    className="w-full pl-10 bg-white border border-slate-300 p-2.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400 disabled:opacity-50 transition-all"
                  />
                </div>
              </div>
            </div>
            
            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm font-medium">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Submit Button (Desktop Only) */}
          <div className="hidden md:block p-8 bg-white border-t border-slate-100 mt-auto">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed py-3.5 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 group shadow-sm hover:shadow"
            >
              <span>{isSaving ? "Memproses..." : "Simpan Data"}</span>
              {!isSaving && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Canvas Dashboard Area */}
      <div className="flex-1 p-4 md:p-8 h-[60vh] md:h-screen flex flex-col bg-slate-50/50 relative">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden">
          {/* Header Kanvas */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
            <div>
              <h3 className="font-semibold text-slate-800">Kanvas Tanda Tangan</h3>
              <p className="text-xs text-slate-500 mt-0.5">Gambar dengan jelas di dalam area kotak</p>
            </div>
            <button 
              type="button"
              onClick={() => sigRef.current?.clear()}
              className="flex items-center gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-transparent hover:border-red-100"
            >
              <Trash2 className="w-4 h-4" />
              <span>Bersihkan</span>
            </button>
          </div>

          {/* Area Kanvas */}
          <div 
            ref={containerRef}
            className="flex-1 w-full h-full relative cursor-crosshair bg-slate-50/50 min-h-[300px]"
            style={{
              backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              backgroundPosition: "center",
            }}
          >
            <SignatureCanvas
              ref={sigRef}
              penColor="#0f172a"
              minWidth={2.5}
              maxWidth={4}
              canvasProps={{
                className: "w-full h-full touch-none",
              }}
            />
          </div>
        </div>
        
        {/* Submit Button (Mobile Only) */}
        <div className="mt-4 md:hidden">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed py-3.5 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-md"
          >
            <span>{isSaving ? "Memproses..." : "Simpan Data"}</span>
            {!isSaving && <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </form>
  );
}
