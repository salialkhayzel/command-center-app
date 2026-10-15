import { successResponse, errorResponse } from "@/lib/api-response"
import { getDb } from "@/lib/db"
import { RVS_77_EXCLUSION } from "@/lib/his"

export const dynamic = "force-dynamic"

const TARGET_MINUTES = 180

export async function GET() {
  try {
    const { pool } = await getDb()

    const result = await pool.request().query(`
      SELECT
        COUNT(*) as completedToday,
        SUM(CAST(DATEDIFF(MINUTE, a.mghdatetime, a.billingdischdatetime) AS FLOAT)) / NULLIF(COUNT(*), 0) as avgTat,
        SUM(CASE WHEN DATEDIFF(MINUTE, a.mghdatetime, a.billingdischdatetime) <= ${TARGET_MINUTES} THEN 1 ELSE 0 END) as withinTarget,
        SUM(CASE WHEN DATEDIFF(MINUTE, a.mghdatetime, a.billingdischdatetime) > ${TARGET_MINUTES} THEN 1 ELSE 0 END) as overTarget
      FROM pspatregisters a
      WHERE a.pattrantype = 'I'
        AND a.mghdatetime IS NOT NULL
        AND (a.untagmghdatetime IS NULL OR a.untagmghdatetime < a.mghdatetime)
        AND a.billingdischdatetime IS NOT NULL
        AND a.billingdischdatetime >= a.mghdatetime
        AND CONVERT(date, a.billingdischdatetime) = CONVERT(date, GETDATE())
        AND ${RVS_77_EXCLUSION}`)

    const row = result.recordset[0] ?? {}
    const completedToday = Number(row.completedToday ?? 0)
    const avgTat = row.avgTat === null || row.avgTat === undefined ? null : Math.round(Number(row.avgTat))
    const withinTarget = Number(row.withinTarget ?? 0)
    const overTarget = Number(row.overTarget ?? 0)

    return successResponse({
      targetMinutes: TARGET_MINUTES,
      completedToday,
      avgTatMinutes: avgTat,
      withinTarget,
      overTarget,
      withinPercent: completedToday > 0 ? Math.round((withinTarget / completedToday) * 100) : null,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error("Executive overview error:", err)
    return errorResponse("Failed to load executive overview data")
  }
}
