import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api-response"
import { getBillingDb, sql } from "@/lib/db-billing"
import {
  buildClearanceCase,
  fetchBillingInfo,
  fetchStageTargets,
  mapAdmissionToRegistry,
} from "@/lib/clearance"
import { parsePositiveInt } from "@/lib/his"
import type { ClearanceListResponse } from "@/lib/clearance-types"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const summaryOnly = params.get("summary") === "1"
    const days = parsePositiveInt(params.get("days"), 30, 120)

    const pool = await getBillingDb()

    const openRequest = pool.request()
    openRequest.input("days", sql.Int, days)
    const openQuery = openRequest.query(`
      SELECT id, patient, station, roomno, bedno, admission_id, admitteddate,
        tagmgh, tagendorsed, tagcharged, tagcompleted, tagamountguaranteed, tagpaid,
        usermgh, userendorsed, usercharged, usercompleted, useramountguaranteed, userpaid,
        remarknurse, remarkclinicalcoder, remarkbilling, remarkcashier
      FROM TATMain
      WHERE tagmgh IS NOT NULL AND tagpaid IS NULL
        AND admitteddate >= DATEADD(DAY, -@days, GETDATE())
      ORDER BY tagmgh ASC`)

    const paidTodayQuery = pool
      .request()
      .query(`SELECT COUNT(*) as n FROM TATMain WHERE CONVERT(date, tagpaid) = CONVERT(date, GETDATE())`)

    const last7Query = pool.request().query(`
      SELECT COUNT(*) as n, AVG(DATEDIFF(MINUTE, tagmgh, tagpaid)) as avgMinutes
      FROM TATMain
      WHERE tagpaid IS NOT NULL AND tagmgh IS NOT NULL
        AND tagpaid >= DATEADD(DAY, -7, GETDATE())`)

    const [targets, openResult, paidTodayResult, last7Result] = await Promise.all([
      fetchStageTargets(),
      openQuery,
      paidTodayQuery,
      last7Query,
    ])

    const admissionIds = openResult.recordset
      .map((row) => Number(row.admission_id))
      .filter((value) => Number.isFinite(value) && value > 0)
    const registryMap = await mapAdmissionToRegistry(admissionIds)
    const registryPks = Array.from(
      new Set(
        openResult.recordset
          .map((row) => registryMap.get(Number(row.admission_id)))
          .filter((value): value is number => typeof value === "number" && value > 0)
      )
    )
    const billingMap = await fetchBillingInfo(registryPks)

    const nowMs = Date.now()
    const rows = openResult.recordset.map((raw) => {
      const registryPk = registryMap.get(Number(raw.admission_id)) ?? null
      return buildClearanceCase(
        raw,
        targets,
        registryPk,
        registryPk !== null ? (billingMap.get(registryPk) ?? null) : null,
        nowMs
      )
    })
    const overdue = rows.filter((row) => row.overdue).length

    const paidToday = Number(paidTodayResult.recordset[0]?.n ?? 0)
    const paidLast7d = Number(last7Result.recordset[0]?.n ?? 0)
    const rawAvg = last7Result.recordset[0]?.avgMinutes
    const avgClearanceMinutes7d =
      rawAvg === null || rawAvg === undefined ? null : Math.round(Number(rawAvg))

    const stations = Array.from(new Set(rows.map((row) => row.station).filter(Boolean))).sort()

    const payload: ClearanceListResponse = {
      targets,
      summary: {
        inProgress: rows.length,
        paidToday,
        paidLast7d,
        avgClearanceMinutes7d,
        overdue,
      },
      stations,
      rows: summaryOnly ? [] : rows,
    }

    return successResponse(payload)
  } catch (err) {
    console.error("Clearance queue error:", err)
    return errorResponse("Failed to load clearance queue")
  }
}
