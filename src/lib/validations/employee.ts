import { z } from "zod";

export const employeeSchema = z.object({
  employee_number: z
    .string()
    .min(1, "Employee number wajib diisi")
    .max(50, "Employee number maksimal 50 karakter"),
  employee_name: z
    .string()
    .min(1, "Nama karyawan wajib diisi")
    .max(255, "Nama maksimal 255 karakter"),
  department: z
    .string()
    .max(100, "Department maksimal 100 karakter"),
  phone_number: z
    .string()
    .min(1, "Nomor telepon wajib diisi")
    .regex(/^628\d{8,13}$/, "Format nomor: 628xxxxxxxxxx"),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HR']),
  manager_id: z.string().uuid().nullable().optional(),
  hr_id: z.string().uuid().nullable().optional(),
});

export const importEmployeeSchema = z.array(employeeSchema);

export type EmployeeSchemaType = z.infer<typeof employeeSchema>;
