"use client";

import { useState, useEffect, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { ArrowRight } from "lucide-react";

export default function SignaturesPublicPage() {
  const [employeeName, setEmployeeName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
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
    
    // Resize observer to keep canvas responsive
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && sigRef.current) {
          const canvas = sigRef.current.getCanvas();
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          // Only resize if dimensions actually changed to avoid clearing while drawing
          if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
            // Save current signature data before resizing
            const data = !sigRef.current.isEmpty() ? sigRef.current.toDataURL() : null;
            
            canvas.width = width * ratio;
            canvas.height = height * ratio;
            canvas.getContext("2d")?.scale(ratio, ratio);
            
            // Restore data if existed
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

    if (!employeeName.trim() || !employeeNumber.trim() || !phoneNumber.trim()) {
      setErrorMessage("NAMA, NIP, DAN NO TELEPON WAJIB DIISI.");
      return;
    }
    if (sigRef.current?.isEmpty()) {
      setErrorMessage("KANVAS KOSONG. GAMBAR TANDA TANGAN ANDA.");
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
          employee_number: employeeNumber.trim(),
          department: department.trim(),
          phone_number: phoneNumber.trim(),
          signature: signatureData,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "GAGAL MENYIMPAN.");
      }

      setSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || "SYSTEM ERROR.");
    } finally {
      setIsSaving(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#F4F4F0] flex flex-col items-center justify-center p-6 md:p-8 uppercase tracking-tighter text-center">
        <h1 className="text-5xl md:text-7xl lg:text-9xl font-black mb-6 md:mb-8 text-[#FF4500]">AUTHORIZED.</h1>
        <p className="text-lg md:text-2xl lg:text-3xl max-w-2xl font-medium leading-tight">
          Tanda tangan untuk {employeeName} telah berhasil direkam.
        </p>
        <button 
          onClick={() => {
            setSuccess(false);
            setEmployeeName("");
            setEmployeeNumber("");
            setDepartment("");
            setPhoneNumber("");
            setTimeout(() => sigRef.current?.clear(), 100);
          }}
          className="mt-10 md:mt-12 border-2 border-[#FF4500] text-[#FF4500] hover:bg-[#FF4500] hover:text-[#0a0a0a] px-6 py-3 md:px-8 md:py-4 text-lg md:text-xl font-bold transition-all duration-300"
        >
          DAFTARKAN YANG LAIN
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F0] text-[#0a0a0a] flex flex-col md:flex-row overflow-x-hidden font-sans selection:bg-[#FF4500] selection:text-[#F4F4F0]">
      {/* Left Column: Typographic Brutalism & Form */}
      <div className="w-full md:w-[45%] lg:w-[35%] flex flex-col border-b-4 md:border-b-0 md:border-r-4 border-[#0a0a0a] relative z-10 bg-[#F4F4F0] min-h-[50vh] md:min-h-screen">
        <div className="p-6 md:p-8 pb-4 border-b-4 border-[#0a0a0a] bg-[#0a0a0a] text-[#F4F4F0]">
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-black uppercase tracking-tighter leading-none mb-2">
            REGIS<br/>TER
          </h1>
          <p className="text-base md:text-lg lg:text-xl font-medium tracking-tight text-[#FF4500]">
            DIGITAL SIGNATURE
          </p>
        </div>

        <form onSubmit={handleSaveSignature} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {/* Identity Form */}
            <div className="p-6 md:p-8 border-b-4 border-[#0a0a0a]">
              <label className="block text-xl md:text-2xl font-black uppercase tracking-tighter mb-4 md:mb-6">
                01. IDENTITAS
              </label>
              
              <div className="space-y-4 md:space-y-6">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase mb-1">NAMA LENGKAP *</p>
                  <input
                    type="text"
                    placeholder="JOHN DOE"
                    value={employeeName}
                    onChange={e => setEmployeeName(e.target.value)}
                    disabled={isSaving}
                    className="w-full bg-transparent border-4 border-[#0a0a0a] p-3 md:p-4 text-lg md:text-xl font-bold rounded-none focus:outline-none focus:ring-4 focus:ring-[#FF4500]/50 placeholder:text-gray-400 disabled:opacity-50 transition-all uppercase"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">NIP *</p>
                    <input
                      type="text"
                      placeholder="EMP001"
                      value={employeeNumber}
                      onChange={e => setEmployeeNumber(e.target.value)}
                      disabled={isSaving}
                      className="w-full bg-transparent border-4 border-[#0a0a0a] p-3 md:p-4 text-lg md:text-xl font-bold rounded-none focus:outline-none focus:ring-4 focus:ring-[#FF4500]/50 placeholder:text-gray-400 disabled:opacity-50 transition-all uppercase"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">DEPT</p>
                    <input
                      type="text"
                      placeholder="MARKETING"
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      disabled={isSaving}
                      className="w-full bg-transparent border-4 border-[#0a0a0a] p-3 md:p-4 text-lg md:text-xl font-bold rounded-none focus:outline-none focus:ring-4 focus:ring-[#FF4500]/50 placeholder:text-gray-400 disabled:opacity-50 transition-all uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Phone Verification */}
            <div className="p-6 md:p-8 border-b-4 border-[#0a0a0a] bg-[#e6e6e2]">
              <label className="block text-xl md:text-2xl font-black uppercase tracking-tighter mb-4">
                02. KONTAK
              </label>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">NO. WHATSAPP *</p>
                <input
                  type="tel"
                  placeholder="0812..."
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  disabled={isSaving}
                  className="w-full bg-[#F4F4F0] border-4 border-[#0a0a0a] p-3 md:p-4 text-lg md:text-xl font-bold rounded-none focus:outline-none focus:ring-4 focus:ring-[#FF4500]/50 placeholder:text-gray-400 disabled:opacity-50 transition-all"
                />
              </div>
            </div>
            
            {/* Error Message */}
            {errorMessage && (
              <div className="p-4 md:p-6 bg-[#FF4500] text-[#F4F4F0] font-bold text-base md:text-lg uppercase tracking-tight">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-[#FF4500] hover:bg-[#e03d00] text-[#F4F4F0] disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed p-5 md:p-6 text-2xl md:text-3xl font-black uppercase tracking-tighter transition-colors flex items-center justify-between group mt-auto"
          >
            <span>{isSaving ? "MEMPROSES..." : "REKAM"}</span>
            {!isSaving && <ArrowRight className="w-6 h-6 md:w-8 md:h-8 group-hover:translate-x-2 transition-transform" strokeWidth={3} />}
          </button>
        </form>
      </div>

      {/* Right Column: Massive Whiteboard */}
      <div className="w-full md:w-[55%] lg:w-[65%] h-[60vh] md:h-screen flex flex-col bg-[#F4F4F0] relative overflow-hidden">
        <div className="p-4 md:p-6 lg:p-8 flex items-center justify-between absolute top-0 left-0 right-0 z-10 pointer-events-none">
          <label className="text-xl md:text-3xl lg:text-4xl font-black uppercase tracking-tighter text-[#0a0a0a]/20 whitespace-nowrap overflow-hidden text-ellipsis">
            03. KANVAS TANDA TANGAN
          </label>
          
          <button 
            type="button"
            onClick={() => sigRef.current?.clear()}
            className="pointer-events-auto bg-[#0a0a0a] text-[#F4F4F0] px-3 py-2 md:px-4 md:py-2 font-bold uppercase text-xs md:text-sm hover:bg-[#FF4500] transition-colors shrink-0 ml-2"
          >
            HAPUS
          </button>
        </div>

        <div 
          ref={containerRef}
          className="flex-1 w-full h-full relative cursor-crosshair mt-14 md:mt-0"
          style={{
            backgroundImage: "radial-gradient(#0a0a0a 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            backgroundPosition: "center",
          }}
        >
          <SignatureCanvas
            ref={sigRef}
            penColor="#0a0a0a"
            minWidth={2}
            maxWidth={5}
            canvasProps={{
              className: "w-full h-full touch-none",
            }}
          />
        </div>
      </div>
    </div>
  );
}
