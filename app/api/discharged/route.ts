import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api-response"
import {
  RVS_77_EXCLUSION,
  daysAgoUtc,
  getDb,
  isoDate,
  parseDateParam,
  parsePositiveInt,
  todayUtc,
} from "@/lib/his"

export const dynamic = "force-dynamic"

const PHIC_APPLY = `OUTER APPLY (
  SELECT TOP 1 PK_TRXNO, transmitno, transmitflag, fileflag
  FROM vwPHICRemittanceMstrList
  WHERE FK_psPatregisters = a.PK_psPatRegisters
  ORDER BY COALESCE(fileddate, processdate, transmitdate) DESC) b`

const PHIC_STATUS_CASE = `CASE
  WHEN b.PK_TRXNO IS NULL THEN 'None'
  WHEN b.transmitflag = 1 THEN 'Transmitted'
  WHEN b.fileflag = 1 THEN 'Filed'
  ELSE 'Pending' END`

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

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const fallbackTo = todayUtc()
    const fallbackFrom = daysAgoUtc(30)
    const from = parseDateParam(params.get("from"), fallbackFrom)
    const to = parseDateParam(params.get("to"), fallbackTo)
    if (from.getTime() > to.getTime()) {
      return errorResponse("Invalid range: from date is after to date", 400)
    }

    const admitFromRaw = params.get("admitFrom")
    const admitToRaw = params.get("admitTo")
    const admitFrom = admitFromRaw ? parseDateParam(admitFromRaw, from) : null
    const admitTo = admitToRaw ? parseDateParam(admitToRaw, to) : null
    const name = params.get("name")?.trim() || null
    const phicStatus = params.get("phicStatus")?.trim() || null
    const isExport = params.get("export") === "1"
    const page = parsePositiveInt(params.get("page"), 1, 100000)
    const pageSize = parsePositiveInt(params.get("pageSize"), 50, 200)

    const { sql, pool } = await getDb()

    const bind = (withStatus = true, withPaging = true) => {
      const req = pool.request()
      req.input("fromDate", sql.Date, from)
      req.input("toDate", sql.Date, to)
      req.input("admitFrom", sql.Date, admitFrom)
      req.input("admitTo", sql.Date, admitTo)
      req.input("name", sql.NVarChar(200), name)
      if (withStatus) req.input("phicStatus", sql.NVarChar(20), phicStatus)
      if (withPaging) {
        req.input("offset", sql.Int, (page - 1) * pageSize)
        req.input("pageSize", sql.Int, pageSize)
      }
      return req
    }

    const baseFilters = `
      WHERE a.pattrantype = 'I'
        AND a.dischdate IS NOT NULL
        AND CONVERT(date, a.dischdate) >= CONVERT(date, @fromDate)
        AND CONVERT(date, a.dischdate) <= CONVERT(date, @toDate)
        AND (@admitFrom IS NULL OR CONVERT(date, a.registrydate) >= CONVERT(date, @admitFrom))
        AND (@admitTo IS NULL OR CONVERT(date, a.registrydate) <= CONVERT(date, @admitTo))
        AND (@name IS NULL OR dbo.udf_GetFullName(a.FK_emdPatients) LIKE '%' + @name + '%')
        AND (@phicStatus IS NULL OR ${PHIC_STATUS_CASE} = @phicStatus)
        AND ${RVS_77_EXCLUSION}`

    const totalQuery = bind().query(`
      SELECT COUNT(*) as total
      FROM pspatregisters a
      ${PHIC_APPLY}
      ${baseFilters}`)

    const statusQuery = bind(false).query(`
      SELECT ${PHIC_STATUS_CASE} as PhicStatus, COUNT(*) as count
      FROM pspatregisters a
      ${PHIC_APPLY}
      WHERE a.pattrantype = 'I'
        AND a.dischdate IS NOT NULL
        AND CONVERT(date, a.dischdate) >= CONVERT(date, @fromDate)
        AND CONVERT(date, a.dischdate) <= CONVERT(date, @toDate)
        AND (@admitFrom IS NULL OR CONVERT(date, a.registrydate) >= CONVERT(date, @admitFrom))
        AND (@admitTo IS NULL OR CONVERT(date, a.registrydate) <= CONVERT(date, @admitTo))
        AND (@name IS NULL OR dbo.udf_GetFullName(a.FK_emdPatients) LIKE '%' + @name + '%')
        AND ${RVS_77_EXCLUSION}
      GROUP BY ${PHIC_STATUS_CASE}`)

    const windowQuery = bind(false).query(`
      SELECT
        AVG(CASE WHEN 30 - DATEDIFF(DAY, a.dischdate, GETDATE()) >= 0
                 THEN 30 - DATEDIFF(DAY, a.dischdate, GETDATE()) ELSE NULL END) as avgDaysToFile,
        SUM(CASE WHEN 30 - DATEDIFF(DAY, a.dischdate, GETDATE()) >= 0 THEN 1 ELSE 0 END) as withinWindowCount,
        SUM(CASE WHEN 30 - DATEDIFF(DAY, a.dischdate, GETDATE()) < 0 THEN 1 ELSE 0 END) as overdueCount
      FROM pspatregisters a
      ${PHIC_APPLY}
      WHERE a.pattrantype = 'I'
        AND a.dischdate IS NOT NULL
        AND CONVERT(date, a.dischdate) >= CONVERT(date, @fromDate)
        AND CONVERT(date, a.dischdate) <= CONVERT(date, @toDate)
        AND (@admitFrom IS NULL OR CONVERT(date, a.registrydate) >= CONVERT(date, @admitFrom))
        AND (@admitTo IS NULL OR CONVERT(date, a.registrydate) <= CONVERT(date, @admitTo))
        AND (@name IS NULL OR dbo.udf_GetFullName(a.FK_emdPatients) LIKE '%' + @name + '%')
        AND ${RVS_77_EXCLUSION}
        AND (b.PK_TRXNO IS NULL OR ((b.transmitflag IS NULL OR b.transmitflag <> 1)
             AND (b.fileflag IS NULL OR b.fileflag <> 1)))`)

    const tatQuery = bind(false).query(`
      SELECT
        AVG(CASE WHEN a.tagFinalBillDate IS NOT NULL AND a.tagFinalBillDate >= a.mghdatetime
                 THEN DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) ELSE NULL END) as avgTatMinutes,
        SUM(CASE WHEN a.tagFinalBillDate IS NOT NULL AND a.tagFinalBillDate >= a.mghdatetime
                 THEN 1 ELSE 0 END) as completedCount,
        MAX(CASE WHEN a.tagFinalBillDate IS NOT NULL AND a.tagFinalBillDate >= a.mghdatetime
                 THEN DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) ELSE NULL END) as maxTatMinutes
      FROM pspatregisters a
      WHERE a.pattrantype = 'I'
        AND a.dischdate IS NOT NULL
        AND CONVERT(date, a.dischdate) >= CONVERT(date, @fromDate)
        AND CONVERT(date, a.dischdate) <= CONVERT(date, @toDate)
        AND (@admitFrom IS NULL OR CONVERT(date, a.registrydate) >= CONVERT(date, @admitFrom))
        AND (@admitTo IS NULL OR CONVERT(date, a.registrydate) <= CONVERT(date, @admitTo))
        AND (@name IS NULL OR dbo.udf_GetFullName(a.FK_emdPatients) LIKE '%' + @name + '%')
        AND ${RVS_77_EXCLUSION}`)

    const paginationClause = isExport ? "" : `OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`

    const listQuery = bind(true, !isExport).query(`
      SELECT ${isExport ? "TOP 10000 " : ""}a.PK_psPatRegisters,
        dbo.udf_GetFullName(a.FK_emdPatients) as PatientName,
        ${PATIENT_TYPE_CASE} as PatientType,
        a.registrydate as AdmitDate,
        a.dischdate as DischargeDate,
        a.mghno as MGHNo,
        CONVERT(varchar(19), a.mghdatetime, 120) as MghDateTagged,
        CONVERT(varchar(19), a.tagFinalBillDate, 120) as FinalBillTagged,
        CASE WHEN a.tagFinalBillDate >= a.mghdatetime
             THEN DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) ELSE NULL END as TatMinutes,
        room.RoomNo,
        b.transmitno as TransmitNo,
        ${PHIC_STATUS_CASE} as PhicStatus
      FROM pspatregisters a
      ${PHIC_APPLY}
      ${ROOM_APPLY}
      ${baseFilters}
      ORDER BY a.dischdate DESC, a.PK_psPatRegisters DESC
      ${paginationClause}`)

    const [total, statuses, window, tat, list] = await Promise.all([
      totalQuery,
      statusQuery,
      windowQuery,
      tatQuery,
      listQuery,
    ])

    const statusSummary = statuses.recordset.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.PhicStatus)] = Number(row.count)
      return acc
    }, {})

    return successResponse({
      from: isoDate(from),
      to: isoDate(to),
      total: total.recordset[0]?.total ?? 0,
      phicStatusSummary: statusSummary,
      filingWindow: window.recordset[0] ?? null,
      billingTat: tat.recordset[0] ?? null,
      page: isExport ? 1 : page,
      pageSize: isExport ? list.recordset.length : pageSize,
      rows: list.recordset,
    })
  } catch (err) {
    console.error("Discharged monitor error:", err)
    return errorResponse("Failed to load discharged patient data")
  }
}
