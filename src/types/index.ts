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
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  wa_sent: boolean;
  wa_sent_at: string | null;
  approved_at: string | null;
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
  created_at: string;
}

export interface Comment {
  id: string;
  claim_id: string;
  message: string;
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

export interface ClaimDetail extends ClaimWithEmployee {
  trips: Trip[];
  comments: Comment[];
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
