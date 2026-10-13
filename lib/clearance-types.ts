export type ClearanceStageKey = "mgh" | "endorsed" | "charged" | "completed" | "guaranteed" | "paid"

export interface ClearanceStageTargets {
  mghToEndorsed: number
  endorsedToCharged: number
  chargedToCompleted: number
  completedToGuaranteed: number
  guaranteedToPaid: number
}

export interface ClearanceRemarks {
  nurse: string | null
  clinicalCoder: string | null
  billing: string | null
  cashier: string | null
}

export interface ClearanceBillingInfo {
  mghTaggedAt: string | null
  finalBillAt: string | null
  tatMinutes: number | null
  runningBill: number
  paid: boolean
}

export interface ClearanceCase {
  id: number
  patient: string
  station: string
  roomno: string | null
  bedno: string | null
  admissionId: number | null
  registryPk: number | null
  admittedDate: string | null
  milestones: Record<ClearanceStageKey, string | null>
  users: Record<ClearanceStageKey, string | null>
  remarks: ClearanceRemarks
  currentStage: ClearanceStageKey
  pendingLabel: string
  stageElapsedMinutes: number
  totalElapsedMinutes: number
  stageTargetMinutes: number
  percent: number
  overdue: boolean
  done: boolean
  billing: ClearanceBillingInfo | null
}

export interface ClearanceSummary {
  inProgress: number
  paidToday: number
  paidLast7d: number
  avgClearanceMinutes7d: number | null
  overdue: number
}

export interface ClearanceListResponse {
  targets: ClearanceStageTargets
  summary: ClearanceSummary
  stations: string[]
  rows: ClearanceCase[]
}

export interface AttendingDoctorRow {
  doctorId: number
  doctorName: string | null
  role: string | null
  pfAmount: number | null
  notifiedAt: string | null
  repliedAt: string | null
  approved: boolean | null
  fee: number | null
  remark: string | null
  status: "not-notified" | "pending" | "approved" | "declined"
}

export interface ClearanceNotification {
  id: number
  message: string
  date: string | null
}

export interface ClearanceDetailResponse {
  case: ClearanceCase
  notifications: ClearanceNotification[]
  doctors: AttendingDoctorRow[]
}

export interface DoctorApprovalDoctor {
  doctorId: number
  doctorName: string | null
  role: string | null
  notifiedAt: string | null
  repliedAt: string | null
  approved: boolean | null
  fee: number | null
  remark: string | null
  status: "not-notified" | "pending" | "approved" | "declined"
}

export interface DoctorApprovalPatient {
  registryNo: number
  patientName: string | null
  doctors: DoctorApprovalDoctor[]
  pendingCount: number
  repliedCount: number
  lastNotifiedAt: string | null
}

export interface DoctorApprovalsResponse {
  tab: "pending" | "replied"
  page: number
  pageSize: number
  totalPatients: number
  totals: { pending: number; replied: number }
  patients: DoctorApprovalPatient[]
}
