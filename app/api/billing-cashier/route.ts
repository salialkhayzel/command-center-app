import { successResponse, errorResponse } from "@/lib/api-response"
import { getDb } from "@/lib/db"
import { RVS_77_EXCLUSION } from "@/lib/his"

export const dynamic = "force-dynamic"

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
        CASE WHEN a.tagFinalBillDate IS NOT NULL AND a.tagFinalBillDate >= a.mghdatetime
             THEN DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) ELSE NULL END as TatMinutes,
        ISNULL(pay.TotalDebit, 0) as TotalDebit,
        ISNULL(pay.TotalCredit, 0) as TotalCredit,
        DATEDIFF(MINUTE, a.mghdatetime, GETDATE()) as WaitingMinutes
      FROM pspatregisters a
      OUTER APPLY (
        SELECT ISNULL(SUM(l.debit),0) as TotalDebit, ISNULL(SUM(l.credit),0) as TotalCredit
        FROM PsPatLedgers l
        WHERE l.FK_psPatRegisters = a.PK_psPatRegisters AND ISNULL(l.cancelflag,0)=0) pay
      OUTER APPLY (
        SELECT TOP 1 ar.bedno as RoomNo FROM psAdmRooms ar
        WHERE ar.FK_psPatRegisters = a.PK_psPatRegisters
        ORDER BY ar.occupystartdate DESC, ar.PK_psAdmRooms DESC) room
      WHERE a.pattrantype = 'I'
        AND a.mghdatetime IS NOT NULL
        AND (a.untagmghdatetime IS NULL OR a.untagmghdatetime < a.mghdatetime)
        AND a.mghdatetime >= DATEADD(DAY, -7, GETDATE())
        AND a.mghdatetime <= GETDATE()
        AND (a.dischdate IS NULL OR CONVERT(date, a.dischdate) = CONVERT(date, GETDATE()))
        AND ${RVS_77_EXCLUSION}
      ORDER BY CASE WHEN a.dischdate IS NULL THEN 0 ELSE 1 END, a.mghdatetime ASC`)

    const rows = result.recordset.map((row) => {
      const totalDebit = Number(row.TotalDebit ?? 0)
      const totalCredit = Number(row.TotalCredit ?? 0)
      return {
        registryNo: Number(row.PK_psPatRegisters),
        patientName: row.PatientName ? String(row.PatientName).trim() : null,
        roomNo: row.RoomNo ? String(row.RoomNo).trim() : null,
        mghTaggedAt: row.MghTaggedAt ? String(row.MghTaggedAt) : null,
        finalBillAt: row.FinalBillAt ? String(row.FinalBillAt) : null,
        billingDischargeAt: row.BillingDischargeAt ? String(row.BillingDischargeAt) : null,
        exitAt: row.ExitAt ? String(row.ExitAt) : null,
        tatMinutes: row.TatMinutes === null || row.TatMinutes === undefined ? null : Number(row.TatMinutes),
        paid: totalDebit > 0 && totalCredit >= totalDebit,
        waitingMinutes: Number(row.WaitingMinutes ?? 0),
      }
    })

    return successResponse({ count: rows.length, rows })
  } catch (err) {
    console.error("Billing & cashier queue error:", err)
    return errorResponse("Failed to load billing & cashier queue")
  }
}
