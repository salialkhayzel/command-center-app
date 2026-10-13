import { getDb } from "@/lib/db"

export interface RealtimeDeptClearance {
  avgTatMinutes: number | null
  prevAvgTatMinutes: number | null
  pending: number
  clearedToday: number
}

const NURSING_WAREHOUSES = [1020, 1021, 1022, 1023, 1025, 1027, 1038, 1039, 1040, 1041, 1042, 1043, 1044, 1045, 1067]

const ANCILLARY_WAREHOUSES = [1001, 1002, 1003, 1006, 1007, 1008, 1046, 1062]

export const NURSING_WAREHOUSE_IDS = NURSING_WAREHOUSES
export const ANCILLARY_WAREHOUSE_IDS = ANCILLARY_WAREHOUSES

export interface PendingDeptClearanceRow {
  id: number
  registryNo: number
  patientName: string | null
  roomNo: string | null
  department: string | null
  notifiedAt: string | null
  waitingMinutes: number
}

export async function fetchPendingDeptClearances(warehouseIds: number[]): Promise<PendingDeptClearanceRow[]> {
  const { pool } = await getDb()
  const list = warehouseIds.join(", ")

  const result = await pool.request().query(`
    SELECT n.PK_psNotifyDeptFPD as id, n.FK_psPatRegisters as registryPk,
      dbo.udf_GetFullName(n.FK_emdPatients) as PatientName,
      room.RoomNo,
      wh.description as Department,
      CONVERT(varchar(19), n.notifydate, 120) as NotifiedAt,
      DATEDIFF(MINUTE, n.notifydate, GETDATE()) as WaitingMinutes
    FROM psNotifyDeptFPD n
    LEFT JOIN mscWarehouse wh ON wh.PK_mscWarehouse = n.FK_mscWarehouse
    OUTER APPLY (
      SELECT TOP 1 ar.bedno as RoomNo FROM psAdmRooms ar
      WHERE ar.FK_psPatRegisters = n.FK_psPatRegisters
      ORDER BY ar.occupystartdate DESC, ar.PK_psAdmRooms DESC) room
    WHERE n.FK_mscWarehouse IN (${list})
      AND n.isNotify = 1
      AND (n.isClearFPD = 0 OR n.clearFPDDate IS NULL)
      AND n.notifydate >= DATEADD(DAY, -7, GETDATE())
    ORDER BY n.notifydate ASC`)

  return result.recordset.map((row) => ({
    id: Number(row.id),
    registryNo: Number(row.registryPk),
    patientName: row.PatientName ? String(row.PatientName).trim() : null,
    roomNo: row.RoomNo ? String(row.RoomNo).trim() : null,
    department: row.Department ? String(row.Department).trim() : null,
    notifiedAt: row.NotifiedAt ? String(row.NotifiedAt) : null,
    waitingMinutes: Number(row.WaitingMinutes ?? 0),
  }))
}

async function fetchDeptClearance(warehouseIds: number[]): Promise<RealtimeDeptClearance> {
  const { pool } = await getDb()
  const list = warehouseIds.join(", ")

  const toNum = (value: unknown): number | null =>
    value === null || value === undefined ? null : Number(value)

  const baseFilter = `
    FROM psNotifyDeptFPD n
    WHERE n.FK_mscWarehouse IN (${list})
      AND n.isNotify = 1
      AND n.isClearFPD = 1
      AND n.clearFPDDate IS NOT NULL
      AND n.clearFPDDate >= n.notifydate`

  // Average time = sum of all department TATs (notifydate -> clearFPDDate) divided by the number of clearances.
  const currentResult = await pool.request().query(`
    SELECT SUM(CAST(DATEDIFF(MINUTE, n.notifydate, n.clearFPDDate) AS FLOAT)) / NULLIF(COUNT(*), 0) as avgTat
    ${baseFilter}
      AND n.clearFPDDate >= DATEADD(DAY, -7, GETDATE())`)

  const previousResult = await pool.request().query(`
    SELECT SUM(CAST(DATEDIFF(MINUTE, n.notifydate, n.clearFPDDate) AS FLOAT)) / NULLIF(COUNT(*), 0) as avgTat
    ${baseFilter}
      AND n.clearFPDDate < DATEADD(DAY, -7, GETDATE())
      AND n.clearFPDDate >= DATEADD(DAY, -14, GETDATE())`)

  let avgTatMinutes = toNum(currentResult.recordset[0]?.avgTat)
  if (avgTatMinutes === null) {
    const allResult = await pool.request().query(`
      SELECT SUM(CAST(DATEDIFF(MINUTE, n.notifydate, n.clearFPDDate) AS FLOAT)) / NULLIF(COUNT(*), 0) as avgTat
      ${baseFilter}`)
    avgTatMinutes = toNum(allResult.recordset[0]?.avgTat)
  }

  const pendingResult = await pool.request().query(`
    SELECT COUNT(*) as n
    FROM psNotifyDeptFPD n
    WHERE n.FK_mscWarehouse IN (${list})
      AND n.isNotify = 1
      AND (n.isClearFPD = 0 OR n.clearFPDDate IS NULL)
      AND n.notifydate >= DATEADD(DAY, -30, GETDATE())`)

  const todayResult = await pool.request().query(`
    SELECT COUNT(*) as n
    ${baseFilter}
      AND CONVERT(date, n.clearFPDDate) = CONVERT(date, GETDATE())`)

  return {
    avgTatMinutes,
    prevAvgTatMinutes: toNum(previousResult.recordset[0]?.avgTat),
    pending: Number(pendingResult.recordset[0]?.n ?? 0),
    clearedToday: Number(todayResult.recordset[0]?.n ?? 0),
  }
}

export async function fetchRealtimeNursingClearance(): Promise<RealtimeDeptClearance> {
  return fetchDeptClearance(NURSING_WAREHOUSES)
}

export async function fetchRealtimeAncillaryClearance(): Promise<RealtimeDeptClearance> {
  return fetchDeptClearance(ANCILLARY_WAREHOUSES)
}
