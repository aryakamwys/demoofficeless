// ============================================================
// Perkom Expense Approval Bot — Type Definitions
// ============================================================

// ------- Enums -------

export const CLAIM_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  APPROVED: "APPROVED",
  NEED_REVIEW: "NEED_REVIEW",
  UNMATCHED: "UNMATCHED",
} as const;

export type ClaimStatus = (typeof CLAIM_STATUS)[keyof typeof CLAIM_STATUS];

// ------- Database Row Types -------

export interface Employee {
  id: string;
  employee_number: string;
  employee_name: string;
  department: string;
  phone_number: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'HR';
  category?: 'ENGINEER' | 'SALES';
  manager_id: string | null;
  hr_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  manager?: Employee;
  hr?: Employee;
  signature?: string | null;
}

export interface Upload {
  id: string;
  period: string;
  filename: string;
  file_type: string;
  storage_path: string;
  status: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface Claim {
  id: string;
  employee_id: string | null;
  upload_id: string;
  period: string;
  trip_count: number;
  total_amount: number;
  status: ClaimStatus;
  manager_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  hr_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  manager_id: string | null;
  hr_id: string | null;
  wa_sent: boolean;
  wa_sent_at: string | null;
  approved_at: string | null;
  pending_wa_change?: {
    trip_id: string;
    trip_no: number;
    old_fare: number;
    new_fare: number;
  } | null;
  /** Mode isi ticket satu-per-satu via WA (aktif = sedang berjalan). */
  ticket_wizard?: { queue: number[]; i: number } | null;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  claim_id: string;
  trip_date: string;
  booking_id: string;
  service_type: string;
  payment_method: string;
  employee_group: string;
  cost_code: string;
  pickup: string;
  dropoff: string;
  fare: number;
  /** Bukti ticket EnvGate per trip (diisi HR, opsional) */
  ticket_id?: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  claim_id: string;
  message: string;
  author_name?: string | null;
  author_role?: string | null;
  created_at: string;
}

export interface WhatsappLog {
  id: string;
  claim_id: string;
  phone_number: string;
  message_type: string;
  status: string;
  response: string | null;
  created_at: string;
}

// ------- Joined / Extended Types -------

export interface ClaimWithEmployee extends Claim {
  employee: Employee | null;
}

// ------- External Data -------

/** Baris tabel managed_service_claims (tiket Service Desk yang diklaim). */
export interface ManagedServiceClaim {
  id: string;
  ticket_id: string;
  ticket_title?: string;
  customer_name?: string;
  location?: string;
  amount: number | string;
  storage_path?: string | null;
  /** Dihitung API saat dibaca: signed URL bucket private (1 jam). */
  file_url?: string | null;
  status: string;
  created_at: string;
  /** Ditempel API managed-service: klaim Grab yang cocok dengan customer_name. */
  grab_match?: { id: string; total_amount: number | string } | null;
}

export interface ClaimDetail extends ClaimWithEmployee {
  trips: Trip[];
  comments: Comment[];
  ticket?: ManagedServiceClaim | null;
  manager_signature?: string | null;
  hr_signature?: string | null;
  employee_signature?: string | null;
  /** Penggantian trip "tidak sesuai" (aktif + riwayat yang sudah selesai) */
  refunds?: TripRefund[];
}

/** Baris trip_refunds — karyawan transfer biaya trip ke rekening kantor. */
export interface TripRefund {
  id: string;
  claim_id: string;
  trip_id: string | null;
  trip_no: number;
  trip_date: string | null;
  pickup: string | null;
  dropoff: string | null;
  amount: number;
  reason: string;
  /** REQUESTED | CLAIMED | CONFIRMED | CANCELLED */
  status: string;
  /** Bukti transfer otomatis dari WhatsApp (bucket private) + validasi HR */
  proof_path?: string | null;
  proof_validated?: boolean;
  proof_reject_reason?: string | null;
  proof_received_at?: string | null;
  /** Signed URL proof_path (dibuat server untuk web) */
  proof_url?: string | null;
  employee_note?: string | null;
  requested_by?: string | null;
  requested_at: string;
  claimed_at?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  cancelled_at?: string | null;
}

// ------- Modul Finance: Request Dokumen -------

export interface DocumentTemplate {
  id: string;
  code: string;
  name: string;
  active: boolean;
  created_at: string;
}

export type DocumentRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "DIPROSES"
  | "SELESAI";

export interface DocumentRequest {
  id: string;
  template_id: string;
  title: string;
  notes: string | null;
  requested_by: string | null;
  approver_id: string | null;
  status: DocumentRequestStatus;
  rejected_reason: string | null;
  approved_at: string | null;
  processed_at: string | null;
  completed_at: string | null;
  result_notes: string | null;
  result_url: string | null; // signed URL dari result_path (dibuat server)
  /** Paraf manager (base64 PNG) — bukti persetujuan request dokumen */
  manager_signature?: string | null;
  created_at: string;
  updated_at: string;
  template?: { code: string; name: string } | { code: string; name: string }[];
  requester?: { employee_name: string } | { employee_name: string }[] | null;
  approver?: { employee_name: string } | { employee_name: string }[] | null;
}

// ------- Form / Input Types -------

export interface EmployeeFormData {
  employee_number: string;
  employee_name: string;
  department: string;
  phone_number: string;
}

export interface UploadFormData {
  period: string;
  file: File;
}

// ------- Parser Types -------

export interface ParsedTrip {
  employee_name: string;
  booking_id: string;
  trip_date: string;
  service_type: string;
  payment_method: string;
  employee_group: string;
  cost_code: string;
  pickup: string;
  dropoff: string;
  fare: number;
}

export interface GroupedTrips {
  employee_name: string;
  trips: ParsedTrip[];
  trip_count: number;
  total_amount: number;
}

// ------- Dashboard Types -------

export interface DashboardSummary {
  total_employees: number;
  total_claims: number;
  pending_claims: number;
  approved_claims: number;
  need_review_claims: number;
}

// ------- API Response Types -------

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
