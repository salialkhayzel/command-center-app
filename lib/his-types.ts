export interface DischargedFilingWindow {
  avgDaysToFile: number | null
  withinWindowCount: number
  overdueCount: number
}

export interface DischargedBillingTat {
  avgTatMinutes: number | null
  completedCount: number
  maxTatMinutes: number | null
}

export interface DischargedResponse {
  success: boolean
  error?: string
  from: string
  to: string
  total: number
  phicStatusSummary: Record<string, number>
  filingWindow: DischargedFilingWindow | null
  billingTat: DischargedBillingTat | null
  rows: unknown[]
}

export interface PhicClaimsResponse {
  success: boolean
  error?: string
  from: string
  to: string
  total: number
  statusSummary: Record<string, number>
  avgDaysToFileMinutes: number | null
  rows: unknown[]
}
