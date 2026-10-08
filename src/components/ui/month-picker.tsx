// Pemilih periode (bulan + tahun) untuk Upload Grab — popover ringan tanpa
// dependensi baru: grid 12 bulan + navigasi tahun. Menggantikan Select
// panjang yang harus discroll. Tanpa "use client": selalu diimpor dari
// halaman client (pemakai state lokal).
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
const MONTHS_FULL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function MonthPicker({
  value,
  onChange,
  disabled,
}: {
  /** Format "Oktober 2026" — sama dengan nilai yang disimpan server. */
  value: string;
  onChange: (period: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => {
    const m = value.match(/(\d{4})$/);
    return m ? Number(m[1]) : new Date().getFullYear();
  });
  const selected = (() => {
    const m = value.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (!m) return { month: -1, year: new Date().getFullYear() };
    return { month: MONTHS_FULL.findIndex((x) => x === m[1]), year: Number(m[2]) };
  })();
  const rootRef = useRef<HTMLDivElement>(null);

  // Tutup saat klik di luar
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (monthIdx: number) => {
    onChange(`${MONTHS_FULL[monthIdx]} ${year}`);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative w-full sm:w-64">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3.5 text-left text-sm font-medium text-slate-800 transition-colors hover:border-slate-400 focus:border-blue-500 focus:outline-none disabled:opacity-50"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="flex-1 truncate">{value}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Tahun sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold text-slate-800">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              aria-label="Tahun berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {MONTHS.map((m, i) => {
              const isActive = selected.month === i && selected.year === year;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => pick(i)}
                  className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
