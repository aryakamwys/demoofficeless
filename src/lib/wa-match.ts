// Cocokkan nomor pengirim ke role pada sebuah klaim.
// Dipisah dari route webhook supaya murni dan bisa dites —
// salah deteksi role = approval jatuh ke orang/tahap yang salah.
import { normalizePhone } from "./whatsapp";

export type WaRole = "HR" | "MANAGER" | "EMPLOYEE";

export type ClaimRow = {
  id: string;
  period: string;
  status: string;
  approved_at: string | null;
  manager_status: string;
  hr_status: string;
  employee: { employee_name: string; phone_number: string } | null;
  manager: { phone_number: string } | null;
  hr: { phone_number: string } | null;
};

/** Role pengirim pada sebuah klaim — null = nomor bukan siapa-siapa di klaim ini. */
export function matchRole(c: ClaimRow, phoneNumber: string): WaRole | null {
  if (!c.employee) return null;
  const mgrPhone = c.manager ? normalizePhone(c.manager.phone_number) : null;
  const hrPhone = c.hr ? normalizePhone(c.hr.phone_number) : null;
  if (hrPhone && hrPhone === phoneNumber && c.approved_at && c.manager_status === "APPROVED" && c.hr_status === "PENDING") return "HR";
  if (mgrPhone && mgrPhone === phoneNumber && c.approved_at && c.manager_status === "PENDING") return "MANAGER";
  if (normalizePhone(c.employee.phone_number) === phoneNumber && (!c.approved_at || c.status === "NEED_REVIEW")) return "EMPLOYEE";
  return null;
}
