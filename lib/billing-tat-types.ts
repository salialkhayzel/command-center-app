export interface BillingTatSummary {
  totalTagged: number
  withFinalBill: number
  awaitingFinalBill: number
  withinTarget: number
  overTarget: number
  avgTatMinutes: number | null
  maxTatMinutes: number | null
  waiting_0_20: number
  waiting_20_60: number
  waiting_1_4h: number
  waiting_4h: number
}

export interface BillingTatCounts {
  completedTotal: number
  paid: number
  unpaid: number
}

export interface AwaitingBillRow {
  PK_psPatRegisters: number
  PatientName: string | null
  PatientType: string | null
  AdmitDate: string | null
  DischargeDate: string | null
  WaitingMinutes: number
  MGHNo: number | null
  MghDateTagged: string | null
  ReTagged: number
  UntagMghDateTime: string | null
  RoomNo: string | null
  RunningBill: number
}

export interface CompletedBillRow {
  PK_psPatRegisters: number
  PatientName: string | null
  PatientType: string | null
  MghDateTagged: string | null
  ReTagged: number
  FinalBillTagged: string | null
  TatMinutes: number | null
  TotalDebit: number
  TotalCredit: number
  Paid: number
  RoomNo: string | null
  RunningBill: number
}

export interface BillingTatData {
  from: string
  to: string
  summary: BillingTatSummary
  counts: BillingTatCounts
  awaiting: AwaitingBillRow[]
  completed: CompletedBillRow[]
}

export type BillingTatResponse = { success: boolean; error?: string } & Partial<BillingTatData>
