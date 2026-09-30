import dayjs from "dayjs";

/** Tanggal trip dari statement sering 00:00 (tanpa jam) — jangan tampilkan jam 00:00. */
export function formatTripDateTime(dateStr: string): string {
  const d = dayjs(dateStr);
  const hasTime = d.hour() !== 0 || d.minute() !== 0 || d.second() !== 0;
  return d.format(hasTime ? "DD MMM YYYY HH:mm" : "DD MMM YYYY");
}
