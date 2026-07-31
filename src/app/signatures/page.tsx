"use client";

import { useState, useEffect, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Loader2, ArrowRight } from "lucide-react";

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

  const [success, setSuccess] = useState(false);

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
  }, [selectedEmpId]); // re-trigger if selected emp changes to ensure canvas is ready

  const handleSaveSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!selectedEmployee) {
      setErrorMessage("PILIH IDENTITAS ANDA.");
      return;
    }
    if (!phoneNumber.trim()) {
      setErrorMessage("MASUKKAN NOMOR TELEPON.");
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
          employee_id: selectedEmployee.id,
          phone_number: phoneNumber.trim(),
          signature: signatureData,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "GAGAL MENYIMPAN.");
      }

      setSuccess(true);
      
      setEmployees(prev => prev.map(emp => emp.id === selectedEmployee.id ? { ...emp, has_signature: true } : emp));
    } catch (err: any) {
      setErrorMessage(err.message || "SYSTEM ERROR.");
    } finally {
      setIsSaving(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#F4F4F0] flex flex-col items-center justify-center p-8 uppercase tracking-tighter">
        <h1 className="text-6xl md:text-9xl font-black mb-8 text-[#FF4500]">AUTHORIZED.</h1>
        <p className="text-xl md:text-3xl max-w-2xl text-center font-medium leading-tight">
          Tanda tangan untuk {selectedEmployee?.employee_name} telah direkam.
        </p>
        <button 
          onClick={() => {
            setSuccess(false);
            setSelectedEmpId("");
            setPhoneNumber("");
            setTimeout(() => sigRef.current?.clear(), 100);
          }}
          className="mt-12 border-2 border-[#FF4500] text-[#FF4500] hover:bg-[#FF4500] hover:text-[#0a0a0a] px-8 py-4 text-xl font-bold transition-all duration-300"
        >
          KEMBALI
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F4F0] text-[#0a0a0a] flex flex-col md:flex-row overflow-hidden font-sans selection:bg-[#FF4500] selection:text-[#F4F4F0]">
      {/* Left Column: Typographic Brutalism & Form */}
      <div className="w-full md:w-[45%] lg:w-[35%] flex flex-col border-b-4 md:border-b-0 md:border-r-4 border-[#0a0a0a] relative z-10 bg-[#F4F4F0]">
        <div className="p-8 pb-4 border-b-4 border-[#0a0a0a] bg-[#0a0a0a] text-[#F4F4F0]">
          <h1 className="text-5xl lg:text-7xl font-black uppercase tracking-tighter leading-none mb-2">
            REGIS<br/>TER
          </h1>
          <p className="text-lg lg:text-xl font-medium tracking-tight text-[#FF4500]">
            DIGITAL SIGNATURE
          </p>
        </div>

        <form onSubmit={handleSaveSignature} className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {/* Identity Selection */}
            <div className="p-8 border-b-4 border-[#0a0a0a]">
              <label className="block text-2xl font-black uppercase tracking-tighter mb-4">
                01. IDENTITAS
              </label>
              
              <div className="relative">
                <select
                  value={selectedEmpId}
                  onChange={(e) => {
                    setSelectedEmpId(e.target.value);
                    setErrorMessage("");
                    if (sigRef.current) sigRef.current.clear();
                  }}
                  disabled={loadingEmployees}
                  className="w-full appearance-none bg-transparent border-4 border-[#0a0a0a] p-4 text-xl font-bold rounded-none focus:outline-none focus:ring-4 focus:ring-[#FF4500]/50 transition-all cursor-pointer"
                >
                  <option value="" disabled className="font-sans">
                    {loadingEmployees ? "MEMUAT DATA..." : "PILIH NAMA ANDA"}
                  </option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id} className="font-sans">
                      {emp.employee_name} {emp.has_signature ? "[UPDATE]" : ""}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-[#0a0a0a]"></div>
                </div>
              </div>

              {selectedEmployee && (
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">NIP</p>
                    <p className="text-lg font-black">{selectedEmployee.employee_number}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">DEPT</p>
                    <p className="text-lg font-black">{selectedEmployee.department || "N/A"}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Phone Verification */}
            <div className="p-8 border-b-4 border-[#0a0a0a] bg-[#e6e6e2]">
              <label className="block text-2xl font-black uppercase tracking-tighter mb-4">
                02. VERIFIKASI
              </label>
              <input
                type="tel"
                placeholder="NO. WHATSAPP (0812...)"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                disabled={!selectedEmpId || isSaving}
                className="w-full bg-[#F4F4F0] border-4 border-[#0a0a0a] p-4 text-xl font-bold rounded-none focus:outline-none focus:ring-4 focus:ring-[#FF4500]/50 placeholder:text-gray-400 disabled:opacity-50 transition-all"
              />
            </div>
            
            {/* Error Message */}
            {errorMessage && (
              <div className="p-6 bg-[#FF4500] text-[#F4F4F0] font-bold text-lg uppercase tracking-tight">
                {errorMessage}
              </div>
            )}
            
            {selectedEmployee?.has_signature && (
              <div className="p-6 bg-[#0a0a0a] text-[#F4F4F0] font-bold text-sm uppercase tracking-tight">
                DATA LAMA AKAN DITIMPA.
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSaving || !selectedEmpId || !phoneNumber.trim()}
            className="w-full bg-[#FF4500] hover:bg-[#e03d00] text-[#F4F4F0] disabled:bg-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed p-6 text-3xl font-black uppercase tracking-tighter transition-colors flex items-center justify-between group"
          >
            <span>{isSaving ? "MEMPROSES..." : "REKAM"}</span>
            {!isSaving && <ArrowRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" strokeWidth={3} />}
          </button>
        </form>
      </div>

      {/* Right Column: Massive Whiteboard */}
      <div className="w-full md:w-[55%] lg:w-[65%] h-[60vh] md:h-screen flex flex-col bg-[#F4F4F0] relative">
        <div className="p-6 md:p-8 flex items-center justify-between absolute top-0 left-0 right-0 z-10 pointer-events-none">
          <label className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-[#0a0a0a]/20">
            03. KANVAS TANDA TANGAN
          </label>
          
          <button 
            type="button"
            onClick={() => sigRef.current?.clear()}
            className="pointer-events-auto bg-[#0a0a0a] text-[#F4F4F0] px-4 py-2 font-bold uppercase text-sm hover:bg-[#FF4500] transition-colors"
          >
            HAPUS
          </button>
        </div>

        <div 
          ref={containerRef}
          className="flex-1 w-full h-full relative cursor-crosshair"
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

          {!selectedEmpId && (
            <div className="absolute inset-0 bg-[#F4F4F0]/80 backdrop-blur-sm flex items-center justify-center z-20">
              <span className="text-2xl md:text-5xl font-black uppercase tracking-tighter text-[#0a0a0a] rotate-[-5deg] border-4 border-[#0a0a0a] p-4 bg-[#FF4500] text-[#F4F4F0]">
                PILIH IDENTITAS DULU
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
