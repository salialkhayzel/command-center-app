import { successResponse, errorResponse } from "@/lib/api-response"
import { getDb } from "@/lib/db"
import { getAppMysqlDb } from "@/lib/db-mysql"
import {
  ANCILLARY_WAREHOUSE_IDS,
  NURSING_WAREHOUSE_IDS,
  PHARMACY_WAREHOUSE_IDS,
} from "@/lib/dept-clearance-live"
import { RVS_77_EXCLUSION } from "@/lib/his"

export const dynamic = "force-dynamic"

const toNum = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function deptTodayQuery(ids: number[]): string {
  return `
    SELECT
      SUM(CAST(DATEDIFF(MINUTE, n.notifydate, n.clearFPDDate) AS FLOAT)) as totalMin,
      COUNT(*) as cnt
    FROM psNotifyDeptFPD n
    WHERE n.FK_mscWarehouse IN (${ids.join(", ")})
      AND n.isNotify = 1
      AND n.isClearFPD = 1
      AND n.clearFPDDate IS NOT NULL
      AND n.clearFPDDate >= n.notifydate
      AND CONVERT(date, n.clearFPDDate) = CONVERT(date, GETDATE())`
}

export async function GET() {
  try {
    const his = await getDb()
    const mysql = await getAppMysqlDb()

    const [billingResult, doctorResult, nursingResult, ancillaryResult, pharmacyResult] =
      await Promise.all([
        his.pool.request().query(`
          SELECT
            SUM(CAST(DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) AS FLOAT)) as totalMin,
            COUNT(*) as cnt
          FROM pspatregisters a
          WHERE a.pattrantype = 'I'
            AND a.mghdatetime IS NOT NULL
            AND (a.untagmghdatetime IS NULL OR a.untagmghdatetime < a.mghdatetime)
            AND a.tagFinalBillDate IS NOT NULL
            AND a.tagFinalBillDate >= a.mghdatetime
            AND CONVERT(date, a.tagFinalBillDate) = CONVERT(date, GETDATE())
            AND ${RVS_77_EXCLUSION}`),
        mysql.query(
          `SELECT
             SUM(TIMESTAMPDIFF(MINUTE, Date_Created, Date_Replied)) as totalMin,
             COUNT(*) as cnt
           FROM doctor_approval_notifier
           WHERE DATE(Date_Replied) = CURDATE()`
        ),
        his.pool.request().query(deptTodayQuery(NURSING_WAREHOUSE_IDS)),
        his.pool.request().query(deptTodayQuery(ANCILLARY_WAREHOUSE_IDS)),
        his.pool.request().query(deptTodayQuery(PHARMACY_WAREHOUSE_IDS)),
      ])

    const doctorRows = doctorResult[0] as Array<{ totalMin: unknown; cnt: unknown }>

    const build = (key: string, label: string, target: number, row: Record<string, unknown>) => {
      const totalMinutes = Math.round(toNum(row?.totalMin))
      const count = toNum(row?.cnt)
      return {
        key,
        label,
        target,
        totalMinutes,
        count,
        avgMinutes: count > 0 ? Math.round(totalMinutes / count) : null,
      }
    }

    const rows = [
      build("billing", "Billing & Cashier", 20, billingResult.recordset[0] ?? {}),
      build("doctor_approval", "Doctor Approval", 60, doctorRows[0] ?? {}),
      build("pharmacy", "Pharmacy", 60, pharmacyResult.recordset[0] ?? {}),
      build("nursing", "Nursing", 90, nursingResult.recordset[0] ?? {}),
      build("ancillary", "Ancillary", 90, ancillaryResult.recordset[0] ?? {}),
    ]

    return successResponse({ generatedAt: new Date().toISOString(), rows })
  } catch (err) {
    console.error("Bottleneck analysis error:", err)
    return errorResponse("Failed to load bottleneck analysis")
  }
}
