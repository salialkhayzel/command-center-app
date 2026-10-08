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

const STATUS_CASE = `CASE
  WHEN v.transmitflag = 1 THEN 'Transmitted'
  WHEN v.fileflag = 1 THEN 'Filed'
  ELSE 'Pending' END`

const DAYS_TO_FILE = `CASE
  WHEN v.dischdate IS NULL THEN NULL
  WHEN v.fileddate IS NOT NULL AND v.fileddate >= v.dischdate THEN DATEDIFF(MINUTE, v.dischdate, v.fileddate)
  WHEN v.fileddate IS NOT NULL AND v.fileddate < v.dischdate THEN DATEDIFF(MINUTE, v.fileddate, v.dischdate)
  ELSE DATEDIFF(MINUTE, v.dischdate, GETDATE()) END`

const LATEST_ACTIVITY = `COALESCE(v.fileddate, v.processdate, v.transmitdate)`

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

    const patient = params.get("patient")?.trim() || null
    const memberId = params.get("memberId")?.trim() || null
    const hospitalPlan = params.get("hospplan")?.trim() || null
    const status = params.get("status")?.trim() || null
    const transmitNoRaw = params.get("transmitno")?.trim() || null
    const transmitNo = transmitNoRaw && /^\d+$/.test(transmitNoRaw) ? Number(transmitNoRaw) : null
    const isExport = params.get("export") === "1"
    const page = parsePositiveInt(params.get("page"), 1, 100000)
    const pageSize = parsePositiveInt(params.get("pageSize"), 50, 200)

    const { sql, pool } = await getDb()

    const bind = (withStatus = true, withPaging = true) => {
      const req = pool.request()
      req.input("fromDate", sql.Date, from)
      req.input("toDate", sql.Date, to)
      req.input("patient", sql.NVarChar(200), patient)
      req.input("memberId", sql.NVarChar(100), memberId)
      req.input("hospplan", sql.NVarChar(200), hospitalPlan)
      req.input("transmitno", sql.Int, transmitNo)
      if (withStatus) req.input("status", sql.NVarChar(20), status)
      if (withPaging) {
        req.input("offset", sql.Int, (page - 1) * pageSize)
        req.input("pageSize", sql.Int, pageSize)
      }
      return req
    }

    const baseFilters = `
      WHERE a.pattrantype = 'I'
        AND CONVERT(date, ${LATEST_ACTIVITY}) >= CONVERT(date, @fromDate)
        AND CONVERT(date, ${LATEST_ACTIVITY}) <= CONVERT(date, @toDate)
        AND (@patient IS NULL OR v.patientname LIKE '%' + @patient + '%')
        AND (@memberId IS NULL OR v.memberid LIKE '%' + @memberId + '%')
        AND (@hospplan IS NULL OR v.HospPlan LIKE '%' + @hospplan + '%')
        AND (@transmitno IS NULL OR v.transmitno = @transmitno)
        AND (@status IS NULL OR ${STATUS_CASE} = @status)
        AND ${RVS_77_EXCLUSION}`

    const totalQuery = bind().query(`
      SELECT COUNT(*) as total
      FROM vwPHICRemittanceMstrList v
      INNER JOIN pspatregisters a ON a.PK_psPatRegisters = v.FK_psPatregisters
      ${baseFilters}`)

    const statusQuery = bind(false).query(`
      SELECT ${STATUS_CASE} as PhicStatus, COUNT(*) as count
      FROM vwPHICRemittanceMstrList v
      INNER JOIN pspatregisters a ON a.PK_psPatRegisters = v.FK_psPatregisters
      WHERE a.pattrantype = 'I'
        AND CONVERT(date, ${LATEST_ACTIVITY}) >= CONVERT(date, @fromDate)
        AND CONVERT(date, ${LATEST_ACTIVITY}) <= CONVERT(date, @toDate)
        AND (@patient IS NULL OR v.patientname LIKE '%' + @patient + '%')
        AND (@memberId IS NULL OR v.memberid LIKE '%' + @memberId + '%')
        AND (@hospplan IS NULL OR v.HospPlan LIKE '%' + @hospplan + '%')
        AND (@transmitno IS NULL OR v.transmitno = @transmitno)
        AND ${RVS_77_EXCLUSION}
      GROUP BY ${STATUS_CASE}`)

    const avgQuery = bind(false).query(`
      SELECT AVG(${DAYS_TO_FILE}) as avgDaysToFileMinutes
      FROM vwPHICRemittanceMstrList v
      INNER JOIN pspatregisters a ON a.PK_psPatRegisters = v.FK_psPatregisters
      WHERE a.pattrantype = 'I'
        AND CONVERT(date, ${LATEST_ACTIVITY}) >= CONVERT(date, @fromDate)
        AND CONVERT(date, ${LATEST_ACTIVITY}) <= CONVERT(date, @toDate)
        AND (@patient IS NULL OR v.patientname LIKE '%' + @patient + '%')
        AND (@memberId IS NULL OR v.memberid LIKE '%' + @memberId + '%')
        AND (@hospplan IS NULL OR v.HospPlan LIKE '%' + @hospplan + '%')
        AND (@transmitno IS NULL OR v.transmitno = @transmitno)
        AND ${RVS_77_EXCLUSION}`)

    const listQuery = bind(true, !isExport).query(`
      SELECT ${isExport ? "TOP 10000 " : ""}v.PK_TRXNO, v.transmitno as TransmitNo, v.patientname as PatientName,
        v.memberid as MemberId, v.memberfullname as MemberFullName, v.HospPlan, v.PHICEntities,
        v.registrydate as RegistryDate, v.dischdate as DischargeDate,
        v.netamount as NetAmount, v.filedamount as FiledAmount, v.appliedamount as AppliedAmount,
        v.remitamount as RemitAmount, v.amount as Amount, v.balance as Balance, v.artype as ArType,
        CONVERT(varchar(19), v.processdate, 120) as ProcessDate,
        CONVERT(varchar(19), v.fileddate, 120) as FiledDate,
        CONVERT(varchar(19), v.transmitdate, 120) as TransmitDate,
        v.transmitflag as TransmitFlag, v.fileflag as FileFlag,
        ${STATUS_CASE} as PhicStatus,
        ${DAYS_TO_FILE} as DaysToFileMinutes
      FROM vwPHICRemittanceMstrList v
      INNER JOIN pspatregisters a ON a.PK_psPatRegisters = v.FK_psPatregisters
      ${baseFilters}
      ORDER BY ${LATEST_ACTIVITY} DESC
      ${isExport ? "" : "OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY"}`)

    const [total, statuses, avg, list] = await Promise.all([totalQuery, statusQuery, avgQuery, listQuery])

    const statusSummary = statuses.recordset.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.PhicStatus)] = Number(row.count)
      return acc
    }, {})

    return successResponse({
      from: isoDate(from),
      to: isoDate(to),
      total: total.recordset[0]?.total ?? 0,
      statusSummary,
      avgDaysToFileMinutes: avg.recordset[0]?.avgDaysToFileMinutes ?? null,
      page: isExport ? 1 : page,
      pageSize: isExport ? list.recordset.length : pageSize,
      rows: list.recordset,
    })
  } catch (err) {
    console.error("PHIC claims error:", err)
    return errorResponse("Failed to load PHIC claims data")
  }
}
