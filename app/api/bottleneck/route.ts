import { successResponse, errorResponse } from "@/lib/api-response"
import { getDb, sql } from "@/lib/db"
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
    INNER JOIN pspatregisters a ON a.PK_psPatRegisters = n.FK_psPatRegisters
    WHERE n.FK_mscWarehouse IN (${ids.join(", ")})
      AND n.isNotify = 1
      AND n.isClearFPD = 1
      AND n.clearFPDDate IS NOT NULL
      AND n.clearFPDDate >= n.notifydate
      AND CONVERT(date, n.clearFPDDate) = CONVERT(date, GETDATE())
      AND a.pattrantype = 'I'`
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
          `SELECT Registry_No,
             TIMESTAMPDIFF(MINUTE, Date_Created, Date_Replied) as tatMin
           FROM doctor_approval_notifier
           WHERE DATE(Date_Replied) = CURDATE()`
        ),
        his.pool.request().query(deptTodayQuery(NURSING_WAREHOUSE_IDS)),
        his.pool.request().query(deptTodayQuery(ANCILLARY_WAREHOUSE_IDS)),
        his.pool.request().query(deptTodayQuery(PHARMACY_WAREHOUSE_IDS)),
      ])

    const doctorTodayRows = doctorResult[0] as Array<{ Registry_No: unknown; tatMin: unknown }>
    const doctorRegistryIds = Array.from(
      new Set(doctorTodayRows.map((row) => Number(row.Registry_No)).filter((id) => Number.isFinite(id)))
    )
    const inpatientDoctorRegistries = new Set<number>()
    if (doctorRegistryIds.length > 0) {
      const request = his.pool.request()
      const placeholders = doctorRegistryIds.map((id, index) => {
        request.input(`dr${index}`, sql.Int, id)
        return `@dr${index}`
      })
      const inpatientResult = await request.query(`
        SELECT PK_psPatRegisters FROM pspatregisters
        WHERE PK_psPatRegisters IN (${placeholders.join(",")}) AND pattrantype = 'I'`)
      for (const row of inpatientResult.recordset) {
        inpatientDoctorRegistries.add(Number(row.PK_psPatRegisters))
      }
    }
    const doctorInpatientRows = doctorTodayRows.filter((row) =>
      inpatientDoctorRegistries.has(Number(row.Registry_No))
    )
    const doctorRow = {
      totalMin: doctorInpatientRows.reduce((sum, row) => sum + Number(row.tatMin ?? 0), 0),
      cnt: doctorInpatientRows.length,
    }

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
      build("doctor_approval", "Doctor Approval", 60, doctorRow),
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
