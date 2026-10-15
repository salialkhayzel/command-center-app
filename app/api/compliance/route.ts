import { successResponse, errorResponse } from "@/lib/api-response"
import { getDb } from "@/lib/db"
import {
  ANCILLARY_WAREHOUSE_IDS,
  NURSING_WAREHOUSE_IDS,
  PHARMACY_WAREHOUSE_IDS,
} from "@/lib/dept-clearance-live"
import { RVS_77_EXCLUSION } from "@/lib/his"

export const dynamic = "force-dynamic"

const ALL_CLEARANCE_WAREHOUSES = [
  ...NURSING_WAREHOUSE_IDS,
  ...ANCILLARY_WAREHOUSE_IDS,
  ...PHARMACY_WAREHOUSE_IDS,
]

function percent(part: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((part / total) * 100)
}

export async function GET() {
  try {
    const { pool } = await getDb()

    const [complianceResult, taggedResult, withClearanceResult] = await Promise.all([
      pool.request().query(`
        SELECT COUNT(*) as notified,
          SUM(CASE WHEN n.isClearFPD = 1 AND n.clearFPDDate IS NOT NULL THEN 1 ELSE 0 END) as cleared
        FROM psNotifyDeptFPD n
        INNER JOIN pspatregisters a ON a.PK_psPatRegisters = n.FK_psPatRegisters
        WHERE n.FK_mscWarehouse IN (${ALL_CLEARANCE_WAREHOUSES.join(", ")})
          AND n.isNotify = 1
          AND CONVERT(date, n.notifydate) = CONVERT(date, GETDATE())
          AND a.pattrantype = 'I'`),
      pool.request().query(`
        SELECT COUNT(*) as tagged
        FROM pspatregisters a
        WHERE a.pattrantype = 'I'
          AND a.mghdatetime IS NOT NULL
          AND (a.untagmghdatetime IS NULL OR a.untagmghdatetime < a.mghdatetime)
          AND CONVERT(date, a.mghdatetime) = CONVERT(date, GETDATE())
          AND ${RVS_77_EXCLUSION}`),
      pool.request().query(`
        SELECT COUNT(DISTINCT a.PK_psPatRegisters) as n
        FROM pspatregisters a
        WHERE a.pattrantype = 'I'
          AND a.mghdatetime IS NOT NULL
          AND (a.untagmghdatetime IS NULL OR a.untagmghdatetime < a.mghdatetime)
          AND CONVERT(date, a.mghdatetime) = CONVERT(date, GETDATE())
          AND EXISTS (
            SELECT 1 FROM psNotifyDeptFPD n
            WHERE n.FK_psPatRegisters = a.PK_psPatRegisters AND n.isNotify = 1)
          AND ${RVS_77_EXCLUSION}`),
    ])

    const notified = Number(complianceResult.recordset[0]?.notified ?? 0)
    const cleared = Number(complianceResult.recordset[0]?.cleared ?? 0)
    const tagged = Number(taggedResult.recordset[0]?.tagged ?? 0)
    const withClearance = Number(withClearanceResult.recordset[0]?.n ?? 0)
    const missing = Math.max(0, tagged - withClearance)

    return successResponse({
      compliance: {
        cleared,
        notified,
        percent: percent(cleared, notified),
      },
      missingTags: {
        tagged,
        withClearance,
        missing,
        percent: percent(missing, tagged),
      },
    })
  } catch (err) {
    console.error("Compliance monitoring error:", err)
    return errorResponse("Failed to load compliance monitoring data")
  }
}
