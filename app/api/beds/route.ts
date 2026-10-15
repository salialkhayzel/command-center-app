import { successResponse, errorResponse } from "@/lib/api-response"
import { getDb } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { pool } = await getDb()

    const roomsResult = await pool.request().query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN r.FK_mscRoomStatus = 1001 THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN r.FK_mscRoomStatus = 1002 THEN 1 ELSE 0 END) as renovation,
        SUM(CASE WHEN r.FK_mscRoomStatus = 1003 THEN 1 ELSE 0 END) as fullyOccupied,
        SUM(CASE WHEN r.FK_mscRoomStatus = 1005 THEN 1 ELSE 0 END) as notAvailable
      FROM psRooms r`)

    const bedsResult = await pool.request().query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN b.FK_mscBedStatus = 1001 THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN b.FK_mscBedStatus = 1002 THEN 1 ELSE 0 END) as occupied,
        SUM(CASE WHEN b.FK_mscBedStatus = 1003 THEN 1 ELSE 0 END) as cleaning,
        SUM(CASE WHEN b.FK_mscBedStatus = 1004 THEN 1 ELSE 0 END) as forRepair,
        SUM(CASE WHEN b.FK_mscBedStatus = 1005 OR b.FK_mscBedStatus = 1000 THEN 1 ELSE 0 END) as inactive
      FROM psBeds b`)

    const roomRow = roomsResult.recordset[0] ?? {}
    const bedRow = bedsResult.recordset[0] ?? {}

    return successResponse({
      rooms: {
        total: Number(roomRow.total ?? 0),
        available: Number(roomRow.available ?? 0),
        renovation: Number(roomRow.renovation ?? 0),
        fullyOccupied: Number(roomRow.fullyOccupied ?? 0),
        notAvailable: Number(roomRow.notAvailable ?? 0),
      },
      beds: {
        total: Number(bedRow.total ?? 0),
        available: Number(bedRow.available ?? 0),
        occupied: Number(bedRow.occupied ?? 0),
        cleaning: Number(bedRow.cleaning ?? 0),
        forRepair: Number(bedRow.forRepair ?? 0),
        inactive: Number(bedRow.inactive ?? 0),
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error("Bed management error:", err)
    return errorResponse("Failed to load bed management data")
  }
}
