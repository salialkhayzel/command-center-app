import { successResponse, errorResponse } from "@/lib/api-response"
import { getDb, sql } from "@/lib/db"
import { RVS_77_EXCLUSION } from "@/lib/his"

export const dynamic = "force-dynamic"

interface ClearanceItem {
  department: string | null
  notifiedAt: string | null
  clearedAt: string | null
  minutes: number | null
  pending: boolean
}

function buildMainFactor(clearances: ClearanceItem[]): string {
  if (clearances.length === 0) return "No clearance tags"
  const pending = clearances.filter((item) => item.pending)
  if (pending.length > 0) {
    return `Waiting on ${pending.map((item) => item.department ?? "department").join(", ")}`
  }
  const longest = clearances.reduce((max, item) =>
    (item.minutes ?? 0) > (max.minutes ?? 0) ? item : max
  )
  if (longest.minutes === null) return "No clearance tags"
  return `${longest.department ?? "Clearance"} took ${longest.minutes}m`
}

export async function GET() {
  try {
    const { pool } = await getDb()

    const result = await pool.request().query(`
      SELECT a.PK_psPatRegisters,
        dbo.udf_GetFullName(a.FK_emdPatients) as PatientName,
        room.RoomNo,
        CONVERT(varchar(19), a.mghdatetime, 120) as MghTaggedAt,
        CONVERT(varchar(19), a.tagFinalBillDate, 120) as FinalBillAt,
        CONVERT(varchar(19), a.billingdischdatetime, 120) as BillingDischargeAt,
        CONVERT(varchar(19), a.dischdate, 120) as ExitAt,
        DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) as TatMinutes
      FROM pspatregisters a
      OUTER APPLY (
        SELECT TOP 1 ar.bedno as RoomNo FROM psAdmRooms ar
        WHERE ar.FK_psPatRegisters = a.PK_psPatRegisters
        ORDER BY ar.occupystartdate DESC, ar.PK_psAdmRooms DESC) room
      WHERE a.pattrantype = 'I'
        AND a.mghdatetime IS NOT NULL
        AND (a.untagmghdatetime IS NULL OR a.untagmghdatetime < a.mghdatetime)
        AND a.tagFinalBillDate IS NOT NULL
        AND a.tagFinalBillDate >= a.mghdatetime
        AND CONVERT(date, a.tagFinalBillDate) = CONVERT(date, GETDATE())
        AND ${RVS_77_EXCLUSION}
      ORDER BY a.tagFinalBillDate DESC`)

    const registryPks = result.recordset.map((row) => Number(row.PK_psPatRegisters))

    const clearancesByRegistry = new Map<number, ClearanceItem[]>()
    if (registryPks.length > 0) {
      const request = pool.request()
      const placeholders = registryPks.map((id, index) => {
        request.input(`r${index}`, sql.Int, id)
        return `@r${index}`
      })
      const clearanceResult = await request.query(`
        SELECT n.FK_psPatRegisters, wh.description as Department,
          CONVERT(varchar(19), n.notifydate, 120) as NotifiedAt,
          CONVERT(varchar(19), n.clearFPDDate, 120) as ClearedAt,
          CASE WHEN n.isClearFPD = 1 AND n.clearFPDDate IS NOT NULL AND n.clearFPDDate >= n.notifydate
               THEN DATEDIFF(MINUTE, n.notifydate, n.clearFPDDate) ELSE NULL END as DurationMinutes,
          CASE WHEN n.isClearFPD = 0 OR n.clearFPDDate IS NULL THEN 1 ELSE 0 END as IsPending
        FROM psNotifyDeptFPD n
        LEFT JOIN mscWarehouse wh ON wh.PK_mscWarehouse = n.FK_mscWarehouse
        WHERE n.FK_psPatRegisters IN (${placeholders.join(",")})
          AND n.isNotify = 1
        ORDER BY n.notifydate ASC`)

      for (const row of clearanceResult.recordset) {
        const registryNo = Number(row.FK_psPatRegisters)
        if (!clearancesByRegistry.has(registryNo)) clearancesByRegistry.set(registryNo, [])
        clearancesByRegistry.get(registryNo)!.push({
          department: row.Department ? String(row.Department).trim() : null,
          notifiedAt: row.NotifiedAt ? String(row.NotifiedAt) : null,
          clearedAt: row.ClearedAt ? String(row.ClearedAt) : null,
          minutes:
            row.DurationMinutes === null || row.DurationMinutes === undefined
              ? null
              : Number(row.DurationMinutes),
          pending: Number(row.IsPending) === 1,
        })
      }
    }

    const rows = result.recordset.map((row) => {
      const registryNo = Number(row.PK_psPatRegisters)
      const tat = Number(row.TatMinutes ?? 0)
      const status = tat <= 20 ? "on-track" : tat <= 60 ? "delayed" : "critical"
      const clearances = clearancesByRegistry.get(registryNo) ?? []

      return {
        registryNo,
        patientName: row.PatientName ? String(row.PatientName).trim() : null,
        roomNo: row.RoomNo ? String(row.RoomNo).trim() : null,
        mghTaggedAt: row.MghTaggedAt ? String(row.MghTaggedAt) : null,
        finalBillAt: row.FinalBillAt ? String(row.FinalBillAt) : null,
        billingDischargeAt: row.BillingDischargeAt ? String(row.BillingDischargeAt) : null,
        exitAt: row.ExitAt ? String(row.ExitAt) : null,
        tatMinutes: tat,
        status,
        mainFactor: buildMainFactor(clearances),
        clearances,
      }
    })

    const counts = {
      onTrack: rows.filter((row) => row.status === "on-track").length,
      delayed: rows.filter((row) => row.status === "delayed").length,
      critical: rows.filter((row) => row.status === "critical").length,
    }

    return successResponse({ count: rows.length, counts, rows })
  } catch (err) {
    console.error("On track queue error:", err)
    return errorResponse("Failed to load on track queue")
  }
}
