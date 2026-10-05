import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const employeeSchema = z.object({
  // Opsional — di-generate server (pendaftaran via signature tidak punya nomor)
  employee_number: z
    .string()
    .max(50, "Employee number maksimal 50 karakter")
    .optional(),
  employee_name: z
    .string()
    .min(1, "Nama karyawan wajib diisi")
    .max(255, "Nama maksimal 255 karakter"),
  department: z
    .string()
    .max(100, "Department maksimal 100 karakter"),
  // Terima format ketikan manusia (08…, +62…, 62…, spasi/strip) — dinormalisasi
  // dulu ke 62…, baru divalidasi. Dulu wajib 628… mentah: nomor lama 08xx di
  // data bikin form Edit tidak bisa disimpan sama sekali.
  phone_number: z.preprocess(
    (v) => (typeof v === "string" ? normalizePhone(v) ?? v : v),
    z
      .string()
      .min(1, "Nomor telepon wajib diisi")
      .regex(/^628\d{8,13}$/, "Nomor WhatsApp tidak valid — contoh: 0812xxxxxxx atau 62812xxxxxxx")
  ),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HR']),
  manager_id: z.string().uuid().nullable().optional(),
  hr_id: z.string().uuid().nullable().optional(),
  signature: z.string().nullable().optional(),
});

export const importEmployeeSchema = z.array(employeeSchema);

export type EmployeeSchemaType = z.infer<typeof employeeSchema>;
