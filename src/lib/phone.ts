// Normalisasi nomor telepon Indonesia → format 62xxxxxxxxxx (mis. 6285110…).
// Tahan banting untuk input manusia: "+62…", "62…", "08…", "6208…" (double
// prefix), "008…", spasi/tanda hubung/kurung, dan akhiran @lid.
export function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  return phone
    .replace(/[\s\-().]/g, "")
    .replace(/@lid$/, "")
    .replace(/^\+/, "")
    .replace(/^620+/, "62") // double prefix: 62 + 08xx
    .replace(/^00+/, "62") // double zero
    .replace(/^0/, "62"); // leading 0 lokal
}
