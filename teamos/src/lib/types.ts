export type Permission = "owner" | "manager" | "employee";
export type WorkType = "fulltime" | "intern_paid" | "intern_unpaid" | "freelance";
export type EmploymentStatus = "not_started" | "active" | "probation" | "resigned" | "terminated";
export type LeaveType = "annual" | "sick" | "unpaid" | "special" | "izin_late" | "izin_early" | "half_day";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface Entity {
  id: string;
  name: string;
  office_lat: number;
  office_lng: number;
  geofence_radius_m: number;
  work_start_time: string;
  work_end_time: string;
  late_grace_min: number;
  working_days_per_month: number;
  manager_recap_enabled: boolean;
}

export interface Department {
  id: string;
  name: string;
  note: string | null;
}

export interface Role {
  id: string;
  entity_id: string | null;
  name: string;
  kpi_rubric: KpiMetricDef[];
}

export interface KpiMetricDef {
  metric_key: string;
  label: string;
  description: string;
  default_target: number;
  unit: string;
}

export interface Profile {
  id: string;
  user_id: string | null;
  email: string;
  entity_id: string | null; // NULL = Both
  department_id: string | null;
  role_id: string | null;
  full_name: string;
  phone: string | null;
  permission: Permission;
  work_type: WorkType;
  intern_start: string | null;
  intern_end: string | null;
  start_date: string | null;
  employment_status: EmploymentStatus;
  badge: string | null;
  notes: string | null;
  leave_balance_annual: number;
  leave_balance_carryover: number;
  manager_id: string | null;
  push_muted: boolean;
}

export interface BankAccount {
  id: string;
  profile_id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  entered_by: string | null;
  confirmed_by_employee: boolean;
  verified_by: string | null;
  verified_at: string | null;
  is_active: boolean;
}

export interface Wage {
  id: string;
  profile_id: string;
  monthly_wage: number;
  effective_from: string;
}

export interface LeaveRequest {
  id: string;
  profile_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  izin_time: string | null;
  reason: string | null;
  status: RequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  profile_id: string;
  work_date: string;
  clock_in_at: string | null;
  clock_in_distance_m: number | null;
  selfie_in_path: string | null;
  clock_out_at: string | null;
  clock_out_distance_m: number | null;
  selfie_out_path: string | null;
  spoof_score: number;
  spoof_signals: string[];
  late: boolean;
  missing_clock_out: boolean;
  flags: string[];
}

export interface KpiAssignmentMetric {
  metric_key: string;
  label: string;
  description: string;
  target: number;
  unit: string;
  weight: number;
}

export interface KpiAssignment {
  id: string;
  profile_id: string;
  assigned_by: string;
  period_start: string;
  period_end: string;
  metrics: KpiAssignmentMetric[];
  status: "active" | "revoked" | "completed";
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  created_at: string;
}

export interface KpiEntry {
  id: string;
  assignment_id: string;
  scores: { metric_key: string; score_0_100: number; note?: string }[];
  overall_note: string | null;
  entered_by: string;
  status: "draft" | "shared_with_employee";
  shared_at: string | null;
}

export interface PeerCategory {
  category_key: string;
  label: string;
  description: string;
  anchor_low: string;
  anchor_high: string;
}

export interface PeerReviewCycle {
  id: string;
  entity_id: string | null;
  name: string;
  opens_at: string;
  closes_at: string;
  status: "draft" | "open" | "closed" | "published";
  categories: PeerCategory[];
}

export interface PeerReviewRequest {
  id: string;
  cycle_id: string;
  rater_id: string;
  ratee_id: string;
  status: "pending" | "submitted" | "skipped";
}

export interface MonthlyReport {
  id: string;
  entity_id: string | null;
  period_month: string;
  version: number;
  content_md: string;
  data_snapshot: unknown;
  model: string;
  generated_at: string;
}

/** The 5 seeded peer-assessment categories (§4.8) — snapshotted into each cycle. */
export const PEER_CATEGORIES: PeerCategory[] = [
  {
    category_key: "attitude",
    label: "Sikap kerja (Attitude)",
    description: "Profesionalisme, respon terhadap feedback, energi yang dibawa ke tim",
    anchor_low: "sering membawa suasana negatif",
    anchor_high: "konsisten positif bahkan saat tekanan tinggi",
  },
  {
    category_key: "teamwork",
    label: "Kerja sama & kecocokan tim",
    description: "Mudah diajak kolaborasi, mau bantu di luar scope — \"mau kerja bareng dia lagi?\"",
    anchor_low: "sulit diajak kerja sama",
    anchor_high: "orang pertama yang kamu pilih untuk proyek berikutnya",
  },
  {
    category_key: "communication",
    label: "Komunikasi",
    description: "Jelas, responsif, kasih kabar tanpa harus dikejar",
    anchor_low: "harus selalu dikejar",
    anchor_high: "selalu jelas & proaktif kasih update",
  },
  {
    category_key: "reliability",
    label: "Keandalan (Reliability)",
    description: "Melakukan yang dijanjikan, tepat waktu, tanpa diingatkan",
    anchor_low: "sering meleset dari janji",
    anchor_high: "selalu tepat janji tanpa reminder",
  },
  {
    category_key: "initiative",
    label: "Inisiatif",
    description: "Melihat & menyelesaikan masalah sebelum diminta",
    anchor_low: "menunggu disuruh",
    anchor_high: "menyelesaikan masalah sebelum orang lain sadar",
  },
];

export const BANK_OPTIONS = [
  "BCA", "Mandiri", "BNI", "BRI", "CIMB Niaga", "Jago", "SeaBank", "Blu", "other",
];

export function maskAccount(accountNumber: string): string {
  const tail = accountNumber.slice(-4);
  return `••••${tail}`;
}
