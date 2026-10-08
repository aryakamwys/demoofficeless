// Visual produk untuk hero landing & panel login: mockup HP berisi UI
// portal karyawan yang sebenarnya (mini), chip notifikasi mengambang, dan
// adegan 3D ambient di belakangnya (Hero3D). Murni presentasional.
import { Circle, CheckCheck, Square } from "lucide-react";
import { Hero3D } from "@/components/hero-3d";

/** Mini-stepper 3 titik — sama konsep dengan portal, ukuran mainan. */
function MiniStepper() {
  return (
    <div className="mt-2.5 grid grid-cols-3">
      {["Kamu", "Manager", "HR"].map((label, i) => (
        <div key={label} className="flex flex-col items-center">
          <span
            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold ${
              i === 0
                ? "bg-emerald-600 text-white"
                : i === 1
                  ? "border-2 border-blue-500 bg-white text-blue-600"
                  : "border-2 border-slate-200 bg-white text-slate-300"
            }`}
          >
            {i === 0 ? "✓" : i + 1}
          </span>
          <span
            className={`mt-1 text-[7px] font-medium ${
              i === 0 ? "text-emerald-700" : i === 1 ? "text-slate-700" : "text-slate-300"
            }`}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function MiniTrip({ time, from, to, fare }: { time: string; from: string; to: string; fare: string }) {
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between">
        <p className="text-[8px] font-semibold text-slate-800">{time}</p>
        <p className="text-[8px] font-bold text-slate-900">{fare}</p>
      </div>
      <div className="mt-1 flex gap-1.5">
        <div className="flex flex-col items-center pt-0.5">
          <Circle className="h-1.5 w-1.5 fill-current text-slate-400" />
          <span className="my-px w-px flex-1 bg-slate-200" />
          <Square className="h-1.5 w-1.5 text-slate-400" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-[7px] leading-tight text-slate-500">{from}</p>
          <p className="truncate text-[7px] leading-tight text-slate-500">{to}</p>
        </div>
      </div>
    </div>
  );
}

/** Layar HP: UI portal karyawan dalam miniatur — menampilkan produk asli. */
function PhoneMockup() {
  return (
    <div className="relative w-[228px] rounded-[2.2rem] border-[9px] border-slate-800 bg-white shadow-2xl shadow-slate-900/20 sm:w-[248px]">
      {/* Notch */}
      <div className="absolute left-1/2 top-0 z-10 h-4 w-20 -translate-x-1/2 rounded-b-2xl bg-slate-800" />
      <div className="overflow-hidden rounded-[1.6rem] bg-[#F5F6F7] px-3 pb-3.5 pt-5">
        {/* Header */}
        <div className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full bg-blue-600" />
          <p className="text-[9px] font-bold text-slate-900">Klaim Grab</p>
          <span className="ml-auto text-[7px] text-slate-400">Dede H.</span>
        </div>

        {/* Kartu klaim */}
        <div className="mt-2 rounded-xl bg-white p-2.5 shadow-sm">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[9px] font-bold text-slate-900">Juli 2026</p>
            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[6.5px] font-semibold text-blue-700">
              Menunggu Manager
            </span>
          </div>
          <p className="mt-1 text-[8px] text-slate-500">
            8 perjalanan · <b className="text-slate-800">Rp943.000</b>
          </p>
          <MiniStepper />
        </div>

        {/* Daftar trip */}
        <div className="mt-2 rounded-xl bg-white p-2.5 shadow-sm">
          <MiniTrip
            time="02 Jul · 07:00"
            from="Jl. Jend. Sudirman Kav. 10–11"
            to="MID Plaza 2, Karet Tengsin"
            fare="Rp40.500"
          />
          <div className="border-t border-slate-100" />
          <MiniTrip
            time="02 Jul · 16:30"
            from="MID Plaza 2, Karet Tengsin"
            to="Jl. Nasional 12, Palmerah"
            fare="Rp36.000"
          />
        </div>

        {/* CTA */}
        <div className="mt-2.5 rounded-lg bg-[#00B14F] py-2 text-center text-[9px] font-semibold text-white">
          Setujui Klaim
        </div>
      </div>
    </div>
  );
}

export function ProductVisual({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative w-full ${compact ? "h-80" : "h-[400px] sm:h-[440px]"}`}>
      {/* Adegan 3D ambient — kartu berwarna + rute pin */}
      <Hero3D className="absolute inset-0" />

      {/* HP di tengah */}
      <div className="absolute inset-0 flex items-center justify-center">
        <PhoneMockup />
      </div>

      {/* Chip notifikasi mengambang */}
      <div className="absolute left-0 top-8 hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg shadow-slate-900/5 sm:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCheck className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[11px] font-semibold leading-tight text-slate-800">Manager menyetujui</p>
          <p className="text-[10px] leading-tight text-slate-400">lewat WhatsApp · barusan</p>
        </div>
      </div>

      <div className="absolute bottom-10 right-0 hidden rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg shadow-slate-900/5 sm:block">
        <p className="text-[10px] font-medium text-slate-400">Klaim Juli</p>
        <p className="text-[14px] font-bold leading-tight text-slate-900">Rp943.000</p>
        <p className="text-[10px] leading-tight text-emerald-600">8 perjalanan sah ✓</p>
      </div>

      <div className="absolute bottom-2 left-2 hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-md shadow-slate-900/5 md:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
        <p className="text-[10px] font-semibold text-slate-600">Paraf manager tercatat</p>
      </div>
    </div>
  );
}
