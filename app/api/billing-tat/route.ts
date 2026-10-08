import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api-response"
import { RVS_77_EXCLUSION, getDb, isoDate, parseDateParam, todayUtc } from "@/lib/his"

export const dynamic = "force-dynamic"

const PATIENT_TYPE_CASE = `CASE
  WHEN a.pattrantype='I' THEN 'In-Patient'
  WHEN a.pattrantype='O' THEN 'Out-Patient'
  WHEN a.pattrantype='E' THEN 'ER'
  WHEN a.pattrantype='R' THEN 'Referred'
  ELSE a.pattrantype END`

const ROOM_APPLY = `OUTER APPLY (
  SELECT TOP 1 ar.bedno as RoomNo FROM psAdmRooms ar
  WHERE ar.FK_psPatRegisters = a.PK_psPatRegisters
  ORDER BY ar.occupystartdate DESC, ar.PK_psAdmRooms DESC) room`

const RUNNING_BILL_APPLY = `OUTER APPLY (
  SELECT ISNULL(SUM(l.debit - l.credit), 0) as RunningBill FROM PsPatLedgers l
  WHERE l.FK_psPatRegisters = a.PK_psPatRegisters AND ISNULL(l.cancelflag, 0) = 0) rb`

const MGH_WINDOW = `
  AND (a.untagmghdatetime IS NULL OR a.untagmghdatetime < a.mghdatetime)
  AND CONVERT(date, a.mghdatetime) >= CONVERT(date, @fromDate)
  AND CONVERT(date, a.mghdatetime) <= CONVERT(date, @toDate)
  AND a.mghdatetime <= GETDATE()
  AND ${RVS_77_EXCLUSION}`

const FINAL_BILL_WINDOW = `
  AND (a.untagmghdatetime IS NULL OR a.untagmghdatetime < a.mghdatetime)
  AND CONVERT(date, a.tagFinalBillDate) >= CONVERT(date, @fromDate)
  AND CONVERT(date, a.tagFinalBillDate) <= CONVERT(date, @toDate)
  AND ${RVS_77_EXCLUSION}`

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const fallback = todayUtc()
    const from = parseDateParam(params.get("from"), fallback)
    const to = parseDateParam(params.get("to"), fallback)
    if (from.getTime() > to.getTime()) {
      return errorResponse("Invalid range: from date is after to date", 400)
    }

    const { sql, pool } = await getDb()

    const bind = () => {
      const req = pool.request()
      req.input("fromDate", sql.Date, from)
      req.input("toDate", sql.Date, to)
      return req
    }

    const summaryQuery = bind().query(`
      SELECT
        COUNT(*) as totalTagged,
        SUM(CASE WHEN a.tagFinalBillDate IS NOT NULL THEN 1 ELSE 0 END) as withFinalBill,
        SUM(CASE WHEN a.tagFinalBillDate IS NULL THEN 1 ELSE 0 END) as awaitingFinalBill,
        SUM(CASE WHEN a.tagFinalBillDate IS NOT NULL AND a.tagFinalBillDate >= a.mghdatetime
                 AND DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) <= 20 THEN 1 ELSE 0 END) as withinTarget,
        SUM(CASE WHEN a.tagFinalBillDate IS NOT NULL AND a.tagFinalBillDate >= a.mghdatetime
                 AND DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) > 20 THEN 1 ELSE 0 END) as overTarget,
        AVG(CASE WHEN a.tagFinalBillDate IS NOT NULL AND a.tagFinalBillDate >= a.mghdatetime
                 THEN DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) ELSE NULL END) as avgTatMinutes,
        MAX(CASE WHEN a.tagFinalBillDate IS NOT NULL AND a.tagFinalBillDate >= a.mghdatetime
                 THEN DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) ELSE NULL END) as maxTatMinutes,
        SUM(CASE WHEN a.tagFinalBillDate IS NULL AND DATEDIFF(MINUTE, a.mghdatetime, GETDATE()) <= 20 THEN 1 ELSE 0 END) as waiting_0_20,
        SUM(CASE WHEN a.tagFinalBillDate IS NULL AND DATEDIFF(MINUTE, a.mghdatetime, GETDATE()) > 20
                 AND DATEDIFF(MINUTE, a.mghdatetime, GETDATE()) <= 60 THEN 1 ELSE 0 END) as waiting_20_60,
        SUM(CASE WHEN a.tagFinalBillDate IS NULL AND DATEDIFF(MINUTE, a.mghdatetime, GETDATE()) > 60
                 AND DATEDIFF(MINUTE, a.mghdatetime, GETDATE()) <= 240 THEN 1 ELSE 0 END) as waiting_1_4h,
        SUM(CASE WHEN a.tagFinalBillDate IS NULL AND DATEDIFF(MINUTE, a.mghdatetime, GETDATE()) > 240 THEN 1 ELSE 0 END) as waiting_4h
      FROM pspatregisters a
      WHERE a.pattrantype = 'I'
        AND a.mghdatetime IS NOT NULL
        ${MGH_WINDOW}`)

    const awaitingQuery = bind().query(`
      SELECT TOP 200 a.PK_psPatRegisters, dbo.udf_GetFullName(a.FK_emdPatients) as PatientName,
        ${PATIENT_TYPE_CASE} as PatientType,
        a.registrydate as AdmitDate, a.dischdate as DischargeDate,
        DATEDIFF(MINUTE, a.mghdatetime, GETDATE()) as WaitingMinutes, a.mghno as MGHNo,
        CONVERT(varchar(19), a.mghdatetime, 120) as MghDateTagged,
        CASE WHEN a.untagmghdatetime IS NOT NULL AND a.untagmghdatetime < a.mghdatetime THEN 1 ELSE 0 END as ReTagged,
        CONVERT(varchar(19), a.untagmghdatetime, 120) as UntagMghDateTime, room.RoomNo, rb.RunningBill
      FROM pspatregisters a
      ${ROOM_APPLY}
      ${RUNNING_BILL_APPLY}
      WHERE a.pattrantype = 'I'
        AND a.mghdatetime IS NOT NULL
        ${MGH_WINDOW}
        AND a.tagFinalBillDate IS NULL
      ORDER BY a.mghdatetime ASC`)

    const completedQuery = bind().query(`
      SELECT TOP 200 a.PK_psPatRegisters, dbo.udf_GetFullName(a.FK_emdPatients) as PatientName,
        ${PATIENT_TYPE_CASE} as PatientType,
        CONVERT(varchar(19), a.mghdatetime, 120) as MghDateTagged,
        CASE WHEN a.untagmghdatetime IS NOT NULL AND a.untagmghdatetime < a.mghdatetime THEN 1 ELSE 0 END as ReTagged,
        CONVERT(varchar(19), a.tagFinalBillDate, 120) as FinalBillTagged,
        CASE WHEN a.tagFinalBillDate >= a.mghdatetime
             THEN DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) ELSE NULL END as TatMinutes,
        pay.TotalDebit, pay.TotalCredit,
        CASE WHEN pay.TotalDebit > 0 AND pay.TotalCredit >= pay.TotalDebit THEN 1 ELSE 0 END as Paid,
        room.RoomNo, rb.RunningBill
      FROM pspatregisters a
      OUTER APPLY (
        SELECT ISNULL(SUM(l.debit),0) as TotalDebit, ISNULL(SUM(l.credit),0) as TotalCredit
        FROM PsPatLedgers l
        WHERE l.FK_psPatRegisters = a.PK_psPatRegisters AND ISNULL(l.cancelflag,0)=0) pay
      ${ROOM_APPLY}
      ${RUNNING_BILL_APPLY}
      WHERE a.pattrantype='I'
        AND a.mghdatetime IS NOT NULL
        ${FINAL_BILL_WINDOW}
        AND a.tagFinalBillDate IS NOT NULL
      ORDER BY a.tagFinalBillDate DESC`)

    const countsQuery = bind().query(`
      SELECT
        COUNT(*) as completedTotal,
        ISNULL(SUM(CASE WHEN pay.TotalDebit > 0 AND pay.TotalCredit >= pay.TotalDebit THEN 1 ELSE 0 END), 0) as paid,
        ISNULL(SUM(CASE WHEN NOT (pay.TotalDebit > 0 AND pay.TotalCredit >= pay.TotalDebit) THEN 1 ELSE 0 END), 0) as unpaid
      FROM pspatregisters a
      OUTER APPLY (
        SELECT ISNULL(SUM(l.debit),0) as TotalDebit, ISNULL(SUM(l.credit),0) as TotalCredit
        FROM PsPatLedgers l
        WHERE l.FK_psPatRegisters = a.PK_psPatRegisters AND ISNULL(l.cancelflag,0)=0) pay
      WHERE a.pattrantype='I'
        AND a.mghdatetime IS NOT NULL
        ${FINAL_BILL_WINDOW}
        AND a.tagFinalBillDate IS NOT NULL`)

    const [summary, awaiting, completed, counts] = await Promise.all([
      summaryQuery,
      awaitingQuery,
      completedQuery,
      countsQuery,
    ])

    return successResponse({
      from: isoDate(from),
      to: isoDate(to),
      summary: summary.recordset[0] ?? null,
      counts: counts.recordset[0] ?? { completedTotal: 0, paid: 0, unpaid: 0 },
      awaiting: awaiting.recordset,
      completed: completed.recordset,
    })
  } catch (err) {
    console.error("Billing TAT error:", err)
    return errorResponse("Failed to load billing TAT data")
  }
}
