import { getDb } from "@/lib/db"
import { RVS_77_EXCLUSION } from "@/lib/his"

export interface RealtimeBilling {
  activeAwaiting: number
  completedToday: number
  avgCompletedToday: number | null
  withinTargetToday: number
  delayedToday: number
  criticalToday: number
  prevAvgCompleted: number | null
}

const BASE_FILTER = `
  FROM pspatregisters a
  WHERE a.pattrantype = 'I'
    AND a.mghdatetime IS NOT NULL
    AND (a.untagmghdatetime IS NULL OR a.untagmghdatetime < a.mghdatetime)
    AND ${RVS_77_EXCLUSION}`

export async function fetchRealtimeBilling(): Promise<RealtimeBilling> {
  const { pool } = await getDb()

  const dailySelect = `
    SELECT
      COUNT(*) as completedCount,
      SUM(CASE WHEN a.tagFinalBillDate >= a.mghdatetime
               AND DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) <= 20 THEN 1 ELSE 0 END) as withinTarget,
      SUM(CASE WHEN a.tagFinalBillDate >= a.mghdatetime
               AND DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) > 20
               AND DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) <= 60 THEN 1 ELSE 0 END) as delayed,
      SUM(CASE WHEN a.tagFinalBillDate >= a.mghdatetime
               AND DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) > 60 THEN 1 ELSE 0 END) as critical,
      AVG(CASE WHEN a.tagFinalBillDate >= a.mghdatetime
               THEN DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) ELSE NULL END) as avgTat`

  const [today, previous, active] = await Promise.all([
    pool.request().query(`
      ${dailySelect}
      ${BASE_FILTER}
        AND a.tagFinalBillDate IS NOT NULL
        AND CONVERT(date, a.tagFinalBillDate) = CONVERT(date, GETDATE())`),
    pool.request().query(`
      ${dailySelect}
      ${BASE_FILTER}
        AND a.tagFinalBillDate IS NOT NULL
        AND CONVERT(date, a.tagFinalBillDate) = CONVERT(date, DATEADD(DAY, -1, GETDATE()))`),
    pool.request().query(`
      SELECT COUNT(*) as activeAwaiting
      ${BASE_FILTER}
        AND a.tagFinalBillDate IS NULL
        AND a.mghdatetime >= DATEADD(DAY, -30, GETDATE())
        AND a.mghdatetime <= GETDATE()`),
  ])

  const todayRow = today.recordset[0] ?? {}
  const previousRow = previous.recordset[0] ?? {}
  const activeRow = active.recordset[0] ?? {}

  const toNumber = (value: unknown): number => Number(value ?? 0)
  const toNullable = (value: unknown): number | null =>
    value === null || value === undefined ? null : Number(value)

  return {
    activeAwaiting: toNumber(activeRow.activeAwaiting),
    completedToday: toNumber(todayRow.completedCount),
    avgCompletedToday: toNullable(todayRow.avgTat),
    withinTargetToday: toNumber(todayRow.withinTarget),
    delayedToday: toNumber(todayRow.delayed),
    criticalToday: toNumber(todayRow.critical),
    prevAvgCompleted: toNullable(previousRow.avgTat),
  }
}
