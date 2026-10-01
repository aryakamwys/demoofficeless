// Validasi periode upload statement Grab — dipakai /api/upload/process.
// HR keliru pilih bulan di form = perjalanan Juli nyasar ke klaim Agustus;
// itu sumber klaim dobel dan kebingungan. Pure function, bisa dites.
const MONTHS = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];

/** "Juli 2026" → { month: 7, year: 2026 }. null kalau formatnya tak dikenal. */
export function periodMonth(period: string): { month: number; year: number } | null {
  const m = (period || "").toLowerCase().match(/^([a-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1]);
  return idx === -1 ? null : { month: idx + 1, year: Number(m[2]) };
}

/**
 * Kalau mayoritas (≥50%) trip di file ada di bulan yang dipilih → null
 * (cocok). Kalau mayoritas malah di bulan lain → balikan bulan dominan
 * itu supaya dibalas pesan yang jelas. Data <5 trip tidak dinilai.
 */
export function mismatchedDominantMonth(
  trips: Array<{ trip_date?: string }>,
  period: string
): { actualMonth: string; expected: string } | null {
  const pm = periodMonth(period);
  if (!pm) return null;
  const counts = new Map<string, number>();
  let dated = 0;
  for (const t of trips) {
    const d = new Date(t.trip_date || "");
    if (isNaN(d.getTime())) continue;
    dated++;
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  if (dated < 5) return null;
  const expected = `${pm.year}-${pm.month}`;
  if ((counts.get(expected) || 0) / dated >= 0.5) return null;
  let topKey = expected;
  let topCount = -1;
  for (const [k, c] of counts) {
    if (c > topCount) { topCount = c; topKey = k; }
  }
  const [y, m] = topKey.split("-").map(Number);
  return { actualMonth: `${MONTHS[m - 1]} ${y}`, expected: period };
}
