import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api-response"
import { getBillingDb, sql } from "@/lib/db-billing"
import {
  buildClearanceCase,
  fetchBillingInfo,
  fetchStageTargets,
  getAttendingDoctors,
  mapAdmissionToRegistry,
} from "@/lib/clearance"
import type { ClearanceDetailResponse, ClearanceNotification } from "@/lib/clearance-types"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const numericId = Number(id)
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return errorResponse("Invalid clearance id", 400)
    }

    const pool = await getBillingDb()
    const rowRequest = pool.request()
    rowRequest.input("id", sql.BigInt, numericId)
    const rowResult = await rowRequest.query(`
      SELECT id, patient, station, roomno, bedno, admission_id, admitteddate,
        tagmgh, tagendorsed, tagcharged, tagcompleted, tagamountguaranteed, tagpaid,
        usermgh, userendorsed, usercharged, usercompleted, useramountguaranteed, userpaid,
        remarknurse, remarkclinicalcoder, remarkbilling, remarkcashier
      FROM TATMain WHERE id = @id`)

    if (rowResult.recordset.length === 0) {
      return errorResponse("Clearance case not found", 404)
    }

    const raw = rowResult.recordset[0]
    const targets = await fetchStageTargets()
    const registryMap = await mapAdmissionToRegistry([Number(raw.admission_id)])
    const registryPk = registryMap.get(Number(raw.admission_id)) ?? null
    const billingMap = registryPk !== null ? await fetchBillingInfo([registryPk]) : new Map()
    const clearanceCase = buildClearanceCase(
      raw,
      targets,
      registryPk,
      registryPk !== null ? (billingMap.get(registryPk) ?? null) : null
    )

    const notifRequest = pool.request()
    notifRequest.input("patient", sql.NVarChar(200), String(raw.patient ?? "").trim())
    const notifResult = await notifRequest.query(`
      SELECT TOP 20 idnotif, message, datenotif
      FROM TATNotif
      WHERE message LIKE '%' + @patient + '%'
      ORDER BY idnotif DESC`)

    const notifications: ClearanceNotification[] = notifResult.recordset.map((row) => ({
      id: Number(row.idnotif),
      message: String(row.message ?? "").trim(),
      date: row.datenotif ? new Date(row.datenotif).toISOString() : null,
    }))

    const doctors = registryPk ? await getAttendingDoctors(registryPk) : []

    const payload: ClearanceDetailResponse = {
      case: clearanceCase,
      notifications,
      doctors,
    }

    return successResponse(payload)
  } catch (err) {
    console.error("Clearance detail error:", err)
    return errorResponse("Failed to load clearance details")
  }
}
