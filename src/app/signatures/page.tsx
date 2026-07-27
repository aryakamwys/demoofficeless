"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  Undo,
  Trash2,
  Loader2,
  PenTool,
  ShieldCheck,
  Building2,
  Check,
  RefreshCw,
} from "lucide-react";

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
  const [errorEmployees, setErrorEmployees] = useState("");

  // Search and selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Form state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Success Dialog state
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [savedSignaturePreview, setSavedSignaturePreview] = useState<string | null>(null);

  // Refs
  const sigRef = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch employees on mount
  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    setErrorEmployees("");
    try {
      const res = await fetch("/api/signatures/public");
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal memuat daftar karyawan.");
      }
      setEmployees(json.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal terhubung ke server.";
      setErrorEmployees(msg);
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Filtered employees for autocomplete
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return employees
      .filter(
        (emp) =>
          emp.employee_name.toLowerCase().includes(query) ||
          emp.employee_number.toLowerCase().includes(query) ||
          emp.department.toLowerCase().includes(query)
      )
      .slice(0, 8); // Limit to 8 suggestions
  }, [employees, searchQuery]);

  // Handle canvas DPI scaling
  useEffect(() => {
    if (!selectedEmployee || !containerRef.current) return;

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
    return () => {
      resizeObserver.disconnect();
    };
  }, [selectedEmployee]);

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setSearchQuery("");
    setPhoneNumber("");
    setErrorMessage("");
    setTimeout(() => {
      sigRef.current?.clear();
    }, 50);
  };

  const handleResetSelection = () => {
    setSelectedEmployee(null);
    setPhoneNumber("");
    setErrorMessage("");
    sigRef.current?.clear();
  };

  const clearSignature = () => {
    sigRef.current?.clear();
  };

  const undoSignature = () => {
    const data = sigRef.current?.toData();
    if (data && data.length > 0) {
      data.pop();
      sigRef.current?.fromData(data);
    }
  };

  const handleSaveSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!selectedEmployee) {
      setErrorMessage("Silakan pilih karyawan terlebih dahulu.");
      return;
    }

    if (!phoneNumber.trim()) {
      setErrorMessage("Nomor telepon wajib diisi untuk verifikasi.");
      return;
    }

    if (sigRef.current?.isEmpty()) {
      setErrorMessage("Silakan gambar tanda tangan Anda di papan yang tersedia.");
      return;
    }

    setIsSaving(true);
    try {
      const signatureData = sigRef.current?.getTrimmedCanvas().toDataURL("image/png");
      if (!signatureData) {
        throw new Error("Gagal mengambil gambar tanda tangan.");
      }

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

      // Success!
      setSavedSignaturePreview(signatureData);
      setSuccessModalOpen(true);

      // Update local employees list state to reflect they now have a signature
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === selectedEmployee.id ? { ...emp, has_signature: true } : emp
        )
      );
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
    handleResetSelection();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-slate-100 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
      {/* Top Banner / Brand */}
      <div className="max-w-2xl mx-auto w-full text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl mb-4 text-blue-400 shadow-inner">
          <PenTool className="w-8 h-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
          Pendaftaran Tanda Tangan Digital
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto">
          Portal mandiri karyawan Perkom untuk mendaftarkan tanda tangan digital yang digunakan pada persetujuan dokumen klaim.
        </p>
      </div>

      {/* Main Content Area */}
      <div className="max-w-2xl mx-auto w-full flex-1">
        <Card className="border border-slate-700/60 bg-slate-800/80 backdrop-blur-xl shadow-2xl text-slate-100 overflow-hidden">
          <CardHeader className="border-b border-slate-700/60 bg-slate-800/50 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Form Verifikasi & Tanda Tangan
                </CardTitle>
                <CardDescription className="text-slate-400 mt-1">
                  Tanpa perlu login. Data diamankan dengan verifikasi nomor telepon.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 px-6 sm:px-8 space-y-6">
            {/* Step 1: Employee Selection */}
            {!selectedEmployee ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="search-employee" className="text-sm font-semibold text-slate-200 block mb-2">
                    1. Cari Nama atau NIP Karyawan
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="search-employee"
                      type="text"
                      placeholder="Ketik nama Anda (misal: Dede, Sigit) atau NIP..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      disabled={loadingEmployees}
                      className="pl-10 h-12 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    />
                  </div>
                </div>

                {loadingEmployees ? (
                  <div className="flex items-center justify-center py-12 text-slate-400 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <span>Memuat daftar karyawan...</span>
                  </div>
                ) : errorEmployees ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span>{errorEmployees}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fetchEmployees}
                      className="border-red-500/30 text-red-300 hover:bg-red-500/20"
                    >
                      <RefreshCw className="w-4 h-4 mr-1.5" /> Coba Lagi
                    </Button>
                  </div>
                ) : searchQuery.trim() && filteredEmployees.length === 0 ? (
                  <div className="p-6 text-center bg-slate-900/40 rounded-xl border border-slate-700/50 text-slate-400 text-sm">
                    Karyawan dengan kata kunci &quot;<span className="text-white font-medium">{searchQuery}</span>&quot; tidak ditemukan.
                  </div>
                ) : searchQuery.trim() && filteredEmployees.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Hasil Pencarian ({filteredEmployees.length})
                    </p>
                    <div className="grid gap-2 max-h-60 overflow-y-auto pr-1">
                      {filteredEmployees.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => handleSelectEmployee(emp)}
                          className="w-full text-left p-3.5 bg-slate-900/60 hover:bg-slate-700/60 border border-slate-700/60 hover:border-blue-500/50 rounded-xl transition-all flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-white text-sm group-hover:text-blue-300 transition-colors flex items-center gap-2">
                                {emp.employee_name}
                                {emp.has_signature && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Sudah Ada
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>{emp.employee_number}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {emp.department || "General"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-xs font-medium text-blue-400 group-hover:translate-x-0.5 transition-transform">
                            Pilih &rarr;
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-900/30 rounded-xl border border-dashed border-slate-700/60 text-slate-400 text-sm">
                    <User className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-60" />
                    Silakan ketik nama atau NIP pada kolom di atas untuk memilih identitas Anda.
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSaveSignature} className="space-y-6">
                {/* Selected Employee Badge Card */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold text-slate-200">
                      1. Karyawan Terpilih
                    </Label>
                    <button
                      type="button"
                      onClick={handleResetSelection}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium hover:underline flex items-center gap-1"
                    >
                      Ganti Karyawan
                    </button>
                  </div>
                  <div className="p-4 bg-slate-900/80 border border-blue-500/30 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-white text-base">
                          {selectedEmployee.employee_name}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{selectedEmployee.employee_number}</span>
                          <span>•</span>
                          <span>{selectedEmployee.department || "General"}</span>
                        </div>
                      </div>
                    </div>
                    {selectedEmployee.has_signature && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Check className="w-3.5 h-3.5" /> Tersimpan
                      </span>
                    )}
                  </div>
                </div>

                {/* Overwrite Alert Notice if signature exists */}
                {selectedEmployee.has_signature && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-sm flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-amber-200 mb-0.5">
                        Tanda Tangan Sudah Ada
                      </div>
                      <p className="text-slate-300 text-xs leading-relaxed">
                        Anda sudah memiliki tanda tangan yang tersimpan sebelumnya. Anda tetap bisa menggambarnya ulang di bawah ini, dan tanda tangan lama akan otomatis digantikan (*tertimpa*).
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 2: Phone Verification */}
                <div>
                  <Label htmlFor="phone-number" className="text-sm font-semibold text-slate-200 block mb-1.5">
                    2. Verifikasi Nomor Telepon
                  </Label>
                  <p className="text-xs text-slate-400 mb-2.5">
                    Masukkan nomor telepon terdaftar Anda untuk autentikasi keamanan.
                  </p>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="phone-number"
                      type="tel"
                      placeholder="Contoh: 081234567890"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={isSaving}
                      required
                      className="pl-10 h-11 bg-slate-900/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    />
                  </div>
                </div>

                {/* Step 3: Signature Board */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold text-slate-200">
                      3. Papan Tanda Tangan
                    </Label>
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={undoSignature}
                        disabled={isSaving}
                        className="h-8 text-xs bg-slate-900/60 border-slate-700 hover:bg-slate-700 text-slate-300"
                      >
                        <Undo className="w-3.5 h-3.5 mr-1" /> Undo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearSignature}
                        disabled={isSaving}
                        className="h-8 text-xs bg-slate-900/60 border-slate-700 hover:bg-slate-700 text-slate-300"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
                      </Button>
                    </div>
                  </div>

                  <div
                    ref={containerRef}
                    className="relative border-2 border-dashed border-slate-600 hover:border-blue-500/50 rounded-xl bg-slate-900/90 overflow-hidden w-full h-[220px] touch-none transition-colors"
                    style={{
                      backgroundImage: "radial-gradient(#334155 1px, transparent 1px)",
                      backgroundSize: "20px 20px",
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerMove={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                  >
                    <SignatureCanvas
                      ref={sigRef}
                      penColor="#ffffff"
                      canvasProps={{
                        className: "w-full h-full cursor-crosshair touch-none",
                        style: { touchAction: "none" },
                      }}
                    />
                    <div className="absolute bottom-2.5 right-3 text-[11px] text-slate-500 pointer-events-none select-none">
                      Gambar tanda tangan di dalam area ini
                    </div>
                  </div>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Submit Button */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSaving || !phoneNumber.trim()}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all text-base disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Menyimpan ke Database...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5 mr-2" />
                        Simpan Tanda Tangan
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto w-full text-center mt-12 text-slate-500 text-xs">
        <p>&copy; {new Date().getFullYear()} PT Perkom Indah Murni. All rights reserved.</p>
      </footer>

      {/* Success Modal Popup */}
      <Dialog open={successModalOpen} onOpenChange={handleCloseSuccessModal}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white shadow-2xl">
          <DialogHeader className="text-center pt-4">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <DialogTitle className="text-2xl font-bold text-white">
              Berhasil Disimpan!
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-sm mt-1">
              Tanda tangan digital untuk <span className="text-white font-semibold">{selectedEmployee?.employee_name}</span> telah berhasil disimpan di database sistem.
            </DialogDescription>
          </DialogHeader>

          {savedSignaturePreview && (
            <div className="my-4 p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
              <span className="text-[11px] text-slate-500 mb-2 uppercase tracking-wider font-semibold">
                Preview Tanda Tangan
              </span>
              <div className="h-28 w-full flex items-center justify-center bg-slate-900/60 rounded-lg p-2 border border-slate-800/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={savedSignaturePreview}
                  alt="Saved Signature"
                  className="max-h-full max-w-full object-contain filter drop-shadow"
                />
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-center pb-2">
            <Button
              type="button"
              onClick={handleCloseSuccessModal}
              className="w-full sm:w-auto min-w-[140px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl h-11"
            >
              Selesai & Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
