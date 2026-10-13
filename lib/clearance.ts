import type { RowDataPacket } from "mysql2"
import { getAppMysqlDb } from "@/lib/db-mysql"
import { getBillingDb, sql } from "@/lib/db-billing"
import { getDb } from "@/lib/db"
import type {
  AttendingDoctorRow,
  ClearanceBillingInfo,
  ClearanceCase,
  ClearanceStageKey,
  ClearanceStageTargets,
  ClearanceSummary,
  DoctorApprovalDoctor,
  DoctorApprovalPatient,
  DoctorApprovalsResponse,
} from "@/lib/clearance-types"

interface StageDef {
  key: ClearanceStageKey
  tagColumn: string
  userColumn: string
  label: string
  pendingLabel: string
  targetField: keyof ClearanceStageTargets | null
}

export const CLEARANCE_STAGES: StageDef[] = [
  { key: "mgh", tagColumn: "tagmgh", userColumn: "usermgh", label: "MGH · Notified", pendingLabel: "Nursing · Endorse", targetField: "mghToEndorsed" },
  { key: "endorsed", tagColumn: "tagendorsed", userColumn: "userendorsed", label: "Endorsed", pendingLabel: "Billing · Charges", targetField: "endorsedToCharged" },
  { key: "charged", tagColumn: "tagcharged", userColumn: "usercharged", label: "Charges Closed", pendingLabel: "Clinical Coder", targetField: "chargedToCompleted" },
  { key: "completed", tagColumn: "tagcompleted", userColumn: "usercompleted", label: "Completed", pendingLabel: "Billing · Guarantee", targetField: "completedToGuaranteed" },
  { key: "guaranteed", tagColumn: "tagamountguaranteed", userColumn: "useramountguaranteed", label: "Amount Guaranteed", pendingLabel: "Cashier · Payment", targetField: "guaranteedToPaid" },
  { key: "paid", tagColumn: "tagpaid", userColumn: "userpaid", label: "Paid", pendingLabel: "Done", targetField: null },
]

const FALLBACK_TARGETS: ClearanceStageTargets = {
  mghToEndorsed: 30,
  endorsedToCharged: 15,
  chargedToCompleted: 30,
  completedToGuaranteed: 180,
  guaranteedToPaid: 180,
}

function round(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.max(1, Math.round(n))
}

export async function fetchStageTargets(): Promise<ClearanceStageTargets> {
  try {
    const pool = await getBillingDb()
    const result = await pool.request().query(`
      SELECT TOP 1
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY DATEDIFF(MINUTE, tagmgh, tagendorsed)) OVER () as mghToEndorsed,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY DATEDIFF(MINUTE, tagendorsed, tagcharged)) OVER () as endorsedToCharged,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY DATEDIFF(MINUTE, tagcharged, tagcompleted)) OVER () as chargedToCompleted,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY DATEDIFF(MINUTE, tagcompleted, tagamountguaranteed)) OVER () as completedToGuaranteed,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY DATEDIFF(MINUTE, tagamountguaranteed, tagpaid)) OVER () as guaranteedToPaid
      FROM TATMain
      WHERE tagmgh IS NOT NULL AND admitteddate >= DATEADD(DAY,-90,GETDATE())`)
    const row = result.recordset[0] ?? {}
    return {
      mghToEndorsed: round(row.mghToEndorsed, FALLBACK_TARGETS.mghToEndorsed),
      endorsedToCharged: round(row.endorsedToCharged, FALLBACK_TARGETS.endorsedToCharged),
      chargedToCompleted: round(row.chargedToCompleted, FALLBACK_TARGETS.chargedToCompleted),
      completedToGuaranteed: round(row.completedToGuaranteed, FALLBACK_TARGETS.completedToGuaranteed),
      guaranteedToPaid: round(row.guaranteedToPaid, FALLBACK_TARGETS.guaranteedToPaid),
    }
  } catch (err) {
    console.error("[clearance] target fetch failed, using fallbacks:", err instanceof Error ? err.message : err)
    return { ...FALLBACK_TARGETS }
  }
}

function toIso(value: unknown): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function minutesBetween(fromIso: string, nowMs: number): number {
  return Math.max(0, Math.round((nowMs - new Date(fromIso).getTime()) / 60000))
}

export function buildClearanceCase(
  raw: Record<string, unknown>,
  targets: ClearanceStageTargets,
  registryPk: number | null,
  billing: ClearanceBillingInfo | null,
  nowMs = Date.now()
): ClearanceCase {
  const milestones = {} as Record<ClearanceStageKey, string | null>
  const users = {} as Record<ClearanceStageKey, string | null>

  for (const stage of CLEARANCE_STAGES) {
    milestones[stage.key] = toIso(raw[stage.tagColumn])
    users[stage.key] = raw[stage.userColumn] ? String(raw[stage.userColumn]).trim() : null
  }

  const done = milestones.paid !== null
  let currentStage: ClearanceStageKey = "paid"
  let stageElapsedMinutes = 0
  let stageTargetMinutes = 0

  if (!done) {
    for (let index = 0; index < CLEARANCE_STAGES.length; index += 1) {
      const stage = CLEARANCE_STAGES[index]
      const enteredAt = milestones[stage.key]
      if (!enteredAt) continue
      const next = CLEARANCE_STAGES[index + 1]
      if (next && !milestones[next.key]) {
        currentStage = stage.key
        stageElapsedMinutes = minutesBetween(enteredAt, nowMs)
        stageTargetMinutes = stage.targetField ? targets[stage.targetField] : 0
        break
      }
    }
  }

  const percent = done
    ? 100
    : stageTargetMinutes > 0
      ? Math.min(100, Math.round((stageElapsedMinutes / stageTargetMinutes) * 100))
      : 0

  const mgh = milestones.mgh
  const pendingLabel = done
    ? "Done"
    : (CLEARANCE_STAGES.find((stage) => stage.key === currentStage)?.pendingLabel ?? "In Progress")

  return {
    id: Number(raw.id),
    patient: String(raw.patient ?? "").trim(),
    station: String(raw.station ?? "").trim(),
    roomno: raw.roomno ? String(raw.roomno).trim() : null,
    bedno: raw.bedno ? String(raw.bedno).trim() : null,
    admissionId: raw.admission_id ? Number(raw.admission_id) : null,
    registryPk,
    admittedDate: toIso(raw.admitteddate),
    milestones,
    users,
    remarks: {
      nurse: raw.remarknurse ? String(raw.remarknurse).trim() : null,
      clinicalCoder: raw.remarkclinicalcoder ? String(raw.remarkclinicalcoder).trim() : null,
      billing: raw.remarkbilling ? String(raw.remarkbilling).trim() : null,
      cashier: raw.remarkcashier ? String(raw.remarkcashier).trim() : null,
    },
    currentStage,
    pendingLabel,
    stageElapsedMinutes,
    totalElapsedMinutes: mgh ? minutesBetween(mgh, nowMs) : 0,
    stageTargetMinutes,
    percent,
    overdue: !done && stageTargetMinutes > 0 && stageElapsedMinutes > stageTargetMinutes,
    done,
    billing,
  }
}

export async function fetchBillingInfo(registryPks: number[]): Promise<Map<number, ClearanceBillingInfo>> {
  const result = new Map<number, ClearanceBillingInfo>()
  if (registryPks.length === 0) return result

  const his = await getDb()
  const request = his.pool.request()
  const placeholders = registryPks.map((id, index) => {
    request.input(`b${index}`, sql.Int, id)
    return `@b${index}`
  })
  const query = await request.query(`
    SELECT a.PK_psPatRegisters,
      CONVERT(varchar(19), a.mghdatetime, 120) as MghTagged,
      CONVERT(varchar(19), a.tagFinalBillDate, 120) as FinalBillTagged,
      CASE WHEN a.tagFinalBillDate IS NOT NULL AND a.tagFinalBillDate >= a.mghdatetime
           THEN DATEDIFF(MINUTE, a.mghdatetime, a.tagFinalBillDate) ELSE NULL END as TatMinutes,
      ISNULL(rb.RunningBill, 0) as RunningBill,
      ISNULL(pay.TotalDebit, 0) as TotalDebit,
      ISNULL(pay.TotalCredit, 0) as TotalCredit
    FROM pspatregisters a
    OUTER APPLY (
      SELECT ISNULL(SUM(l.debit),0) as TotalDebit, ISNULL(SUM(l.credit),0) as TotalCredit
      FROM PsPatLedgers l
      WHERE l.FK_psPatRegisters = a.PK_psPatRegisters AND ISNULL(l.cancelflag,0)=0) pay
    OUTER APPLY (
      SELECT ISNULL(SUM(l.debit - l.credit), 0) as RunningBill
      FROM PsPatLedgers l
      WHERE l.FK_psPatRegisters = a.PK_psPatRegisters AND ISNULL(l.cancelflag,0)=0) rb
    WHERE a.PK_psPatRegisters IN (${placeholders.join(",")})`)

  for (const row of query.recordset) {
    const totalDebit = Number(row.TotalDebit ?? 0)
    const totalCredit = Number(row.TotalCredit ?? 0)
    result.set(Number(row.PK_psPatRegisters), {
      mghTaggedAt: row.MghTagged ? String(row.MghTagged) : null,
      finalBillAt: row.FinalBillTagged ? String(row.FinalBillTagged) : null,
      tatMinutes: row.TatMinutes === null || row.TatMinutes === undefined ? null : Number(row.TatMinutes),
      runningBill: Number(row.RunningBill ?? 0),
      paid: totalDebit > 0 && totalCredit >= totalDebit,
    })
  }
  return result
}

export async function mapAdmissionToRegistry(admissionIds: number[]): Promise<Map<number, number>> {
  const mapping = new Map<number, number>()
  if (admissionIds.length === 0) return mapping
  const his = await getDb()
  const request = his.pool.request()
  const placeholders = admissionIds.map((id, index) => {
    request.input(`adm${index}`, sql.Int, id)
    return `@adm${index}`
  })
  const result = await request.query(`
    SELECT PK_psAdmissions, FK_psPatRegisters
    FROM psAdmissions
    WHERE PK_psAdmissions IN (${placeholders.join(",")})`)
  for (const row of result.recordset) {
    mapping.set(Number(row.PK_psAdmissions), Number(row.FK_psPatRegisters))
  }
  return mapping
}

let consultantTypeCache: Record<number, string> | null = null

async function getConsultantTypeLabels(): Promise<Record<number, string>> {
  if (!consultantTypeCache) {
    const his = await getDb()
    const result = await his.pool.request().query(`
      SELECT PK_emdTempConsultantTypes, description FROM emdTempConsultantTypes`)
    consultantTypeCache = result.recordset.reduce<Record<number, string>>((acc, row) => {
      acc[Number(row.PK_emdTempConsultantTypes)] = String(row.description ?? "").trim()
      return acc
    }, {})
  }
  return consultantTypeCache
}

interface DoctorLookupRow {
  DoctorId: number
  DoctorName: string | null
  ConsultType: number | null
  PfAmount: number | null
}

async function fetchDoctorLookup(registryPks: number[]): Promise<Map<string, DoctorLookupRow>> {
  const lookup = new Map<string, DoctorLookupRow>()
  if (registryPks.length === 0) return lookup

  const his = await getDb()
  const request = his.pool.request()
  const placeholders = registryPks.map((id, index) => {
    request.input(`reg${index}`, sql.Int, id)
    return `@reg${index}`
  })
  const result = await request.query(`
    SELECT FK_psPatRegisters, FK_emdDoctors, MAX(Doctors) as DoctorName,
      MAX(FK_emdConsultantTypes) as ConsultType, MAX(pfamount) as PfAmount
    FROM vwReportListofDoctor
    WHERE FK_psPatRegisters IN (${placeholders.join(",")})
    GROUP BY FK_psPatRegisters, FK_emdDoctors`)

  for (const row of result.recordset) {
    const key = `${Number(row.FK_psPatRegisters)}|${Number(row.FK_emdDoctors)}`
    lookup.set(key, {
      DoctorId: Number(row.FK_emdDoctors),
      DoctorName: row.DoctorName ? String(row.DoctorName).trim() : null,
      ConsultType: row.ConsultType === null || row.ConsultType === undefined ? null : Number(row.ConsultType),
      PfAmount: row.PfAmount === null || row.PfAmount === undefined ? null : Number(row.PfAmount),
    })
  }
  return lookup
}

interface NotifierRow {
  Registry_No: number
  Doctors_ID: number
  Approved_YN: boolean | number | null
  Remarks: string | null
  Professional_Fee: number | null
  Date_Created: Date | string | null
  Date_Replied: Date | string | null
}

function buildDoctorRow(
  doctorId: number,
  registryPk: number,
  lookup: Map<string, DoctorLookupRow>,
  labels: Record<number, string>,
  notifier: Map<string, NotifierRow>
): AttendingDoctorRow {
  const info = lookup.get(`${registryPk}|${doctorId}`)
  const reply = notifier.get(`${registryPk}|${doctorId}`)
  const approved = reply ? (reply.Approved_YN === null || reply.Approved_YN === undefined ? null : Boolean(reply.Approved_YN)) : null

  return {
    doctorId,
    doctorName: info?.DoctorName ?? null,
    role: info?.ConsultType !== null && info?.ConsultType !== undefined ? (labels[info.ConsultType] ?? null) : null,
    pfAmount: info?.PfAmount ?? null,
    notifiedAt: reply ? toIso(reply.Date_Created) : null,
    repliedAt: reply ? toIso(reply.Date_Replied) : null,
    approved,
    fee: reply?.Professional_Fee ?? null,
    remark: reply?.Remarks ? String(reply.Remarks).trim() : null,
    status: !reply ? "not-notified" : reply.Date_Replied ? (approved ? "approved" : "declined") : "pending",
  }
}

export async function getAttendingDoctors(registryPk: number): Promise<AttendingDoctorRow[]> {
  const [lookup, labels] = await Promise.all([fetchDoctorLookup([registryPk]), getConsultantTypeLabels()])

  const mysql = await getAppMysqlDb()
  const [notifierRows] = await mysql.query(
    `SELECT Registry_No, Doctors_ID, Approved_YN, Remarks, Professional_Fee, Date_Created, Date_Replied
     FROM doctor_approval_notifier WHERE Registry_No = ?`,
    [registryPk]
  )

  const notifier = new Map<string, NotifierRow>()
  for (const row of notifierRows as NotifierRow[]) {
    notifier.set(`${Number(row.Registry_No)}|${Number(row.Doctors_ID)}`, row)
  }

  const doctorIds = new Set<number>()
  for (const key of lookup.keys()) {
    const [, doctorId] = key.split("|")
    if (Number(key.split("|")[0]) === registryPk) doctorIds.add(Number(doctorId))
  }
  for (const row of notifierRows as NotifierRow[]) {
    doctorIds.add(Number(row.Doctors_ID))
  }

  return Array.from(doctorIds)
    .map((doctorId) => buildDoctorRow(doctorId, registryPk, lookup, labels, notifier))
    .sort((a, b) => {
      const order = { pending: 0, "not-notified": 1, approved: 2, declined: 3 } as const
      return order[a.status] - order[b.status] || a.doctorId - b.doctorId
    })
}

async function fetchDoctorNameFallback(doctorIds: number[]): Promise<Map<number, string>> {
  const names = new Map<number, string>()
  if (doctorIds.length === 0) return names
  try {
    const pool = await getBillingDb()
    const request = pool.request()
    const placeholders = doctorIds.map((id, index) => {
      request.input(`nd${index}`, sql.Int, id)
      return `@nd${index}`
    })
    const result = await request.query(`
      SELECT FK_emdDoctor, MAX(AttendingDoctor) as DoctorName
      FROM NotifiedDoctors
      WHERE FK_emdDoctor IN (${placeholders.join(",")})
      GROUP BY FK_emdDoctor`)
    for (const row of result.recordset) {
      if (row.DoctorName) names.set(Number(row.FK_emdDoctor), String(row.DoctorName).trim())
    }
  } catch {
    // fallback is best-effort
  }
  return names
}

export async function getDoctorApprovals(
  tab: "pending" | "replied",
  page: number,
  pageSize = 10
): Promise<DoctorApprovalsResponse> {
  const mysql = await getAppMysqlDb()
  const [pendingGroupsResult, repliedGroupsResult] = await Promise.all([
    mysql.query<RowDataPacket[]>(
      `SELECT Registry_No, MAX(Date_Created) as lastNotified
       FROM doctor_approval_notifier
       WHERE Date_Replied IS NULL
       GROUP BY Registry_No
       ORDER BY MIN(Date_Created) ASC`
    ),
    mysql.query<RowDataPacket[]>(
      `SELECT Registry_No, MAX(Date_Replied) as lastNotified
       FROM doctor_approval_notifier
       WHERE Date_Replied IS NOT NULL
       GROUP BY Registry_No
       ORDER BY MAX(Date_Replied) DESC`
    ),
  ])

  const pendingGroups = pendingGroupsResult[0]
  const repliedGroups = repliedGroupsResult[0]

  const allRegistryPks = Array.from(
    new Set(
      [...pendingGroups, ...repliedGroups]
        .map((row) => Number(row.Registry_No))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  )

  const patientNames = new Map<number, string>()
  const activeRegistries = new Set<number>()
  if (allRegistryPks.length > 0) {
    const his = await getDb()
    const request = his.pool.request()
    const placeholders = allRegistryPks.map((id, index) => {
      request.input(`p${index}`, sql.Int, id)
      return `@p${index}`
    })
    const result = await request.query(`
      SELECT a.PK_psPatRegisters, dbo.udf_GetFullName(a.FK_emdPatients) as PatientName,
        CASE WHEN a.dischdate IS NOT NULL OR a.registrystatus = 'D' THEN 1 ELSE 0 END as IsDischarged
      FROM pspatregisters a WHERE a.PK_psPatRegisters IN (${placeholders.join(",")})`)
    const known = new Set<number>()
    for (const row of result.recordset) {
      const pk = Number(row.PK_psPatRegisters)
      known.add(pk)
      patientNames.set(pk, String(row.PatientName ?? "").trim())
      if (Number(row.IsDischarged) === 0) activeRegistries.add(pk)
    }
    for (const pk of allRegistryPks) {
      if (!known.has(pk)) activeRegistries.add(pk)
    }
  }

  const filteredPending = pendingGroups.filter((row) => activeRegistries.has(Number(row.Registry_No)))
  const filteredReplied = repliedGroups.filter((row) => activeRegistries.has(Number(row.Registry_No)))
  const tabGroups = tab === "pending" ? filteredPending : filteredReplied
  const totalPatients = tabGroups.length
  const groups = tabGroups.slice((page - 1) * pageSize, page * pageSize)
  const registryPks = groups.map((row) => Number(row.Registry_No))

  let patients: DoctorApprovalPatient[] = []

  if (registryPks.length > 0) {
    const [notifierResult] = await mysql.query<RowDataPacket[]>(
      `SELECT Registry_No, Doctors_ID, Approved_YN, Remarks, Professional_Fee, Date_Created, Date_Replied
       FROM doctor_approval_notifier
       WHERE Registry_No IN (?)`,
      [registryPks]
    )
    const notifierRows = notifierResult as unknown as NotifierRow[]

    const [lookup, labels] = await Promise.all([fetchDoctorLookup(registryPks), getConsultantTypeLabels()])

    const allDoctorIds = new Set<number>()
    const namedIds = new Set<number>()
    for (const [key, value] of lookup) {
      const doctorId = Number(key.split("|")[1])
      allDoctorIds.add(doctorId)
      if (value.DoctorName) namedIds.add(doctorId)
    }
    for (const row of notifierRows) allDoctorIds.add(Number(row.Doctors_ID))
    const nameFallback = await fetchDoctorNameFallback(
      Array.from(allDoctorIds).filter((id) => !namedIds.has(id))
    )

    const notifierByRegistry = new Map<number, Map<number, NotifierRow>>()
    for (const row of notifierRows) {
      const registryNo = Number(row.Registry_No)
      if (!notifierByRegistry.has(registryNo)) notifierByRegistry.set(registryNo, new Map())
      notifierByRegistry.get(registryNo)!.set(Number(row.Doctors_ID), row)
    }

    const statusRank: Record<DoctorApprovalDoctor["status"], number> = {
      pending: 0,
      "not-notified": 1,
      approved: 2,
      declined: 3,
    }

    patients = groups.map((group) => {
      const registryNo = Number(group.Registry_No)
      const notifier = notifierByRegistry.get(registryNo) ?? new Map<number, NotifierRow>()
      const doctorIds = new Set<number>(notifier.keys())
      for (const key of lookup.keys()) {
        const [registry, doctorId] = key.split("|")
        if (Number(registry) === registryNo) doctorIds.add(Number(doctorId))
      }

      const doctors: DoctorApprovalDoctor[] = Array.from(doctorIds)
        .map((doctorId) => {
          const info = lookup.get(`${registryNo}|${doctorId}`)
          const reply = notifier.get(doctorId)
          const approved =
            reply === undefined
              ? null
              : reply.Approved_YN === null || reply.Approved_YN === undefined
                ? null
                : Boolean(reply.Approved_YN)
          const status: DoctorApprovalDoctor["status"] = !reply
            ? "not-notified"
            : reply.Date_Replied
              ? approved
                ? "approved"
                : "declined"
              : "pending"

          return {
            doctorId,
            doctorName: info?.DoctorName ?? nameFallback.get(doctorId) ?? null,
            role:
              info?.ConsultType !== null && info?.ConsultType !== undefined
                ? (labels[info.ConsultType] ?? null)
                : null,
            notifiedAt: reply ? toIso(reply.Date_Created) : null,
            repliedAt: reply ? toIso(reply.Date_Replied) : null,
            approved,
            fee: reply?.Professional_Fee ?? null,
            remark: reply?.Remarks ? String(reply.Remarks).trim() : null,
            status,
          }
        })
        .sort((a, b) => {
          const rank = statusRank[a.status] - statusRank[b.status]
          if (rank !== 0) return rank
          if (a.status === "pending" && b.status === "pending") {
            return (a.notifiedAt ?? "").localeCompare(b.notifiedAt ?? "")
          }
          return a.doctorId - b.doctorId
        })

      const pendingCount = doctors.filter((doctor) => doctor.status === "pending").length
      const repliedCount = doctors.filter(
        (doctor) => doctor.status === "approved" || doctor.status === "declined"
      ).length
      const notifiedTimes = doctors.map((doctor) => doctor.notifiedAt).filter((value): value is string => Boolean(value))

      return {
        registryNo,
        patientName: patientNames.get(registryNo) ?? null,
        doctors,
        pendingCount,
        repliedCount,
        lastNotifiedAt: notifiedTimes.length > 0 ? notifiedTimes.sort().at(-1)! : null,
      }
    })
  }

  return {
    tab,
    page,
    pageSize,
    totalPatients,
    totals: {
      pending: filteredPending.length,
      replied: filteredReplied.length,
    },
    patients,
  }
}

export interface RealtimeDoctorApproval {
  avgTatMinutes: number | null
  prevAvgTatMinutes: number | null
  pending: number
  repliedToday: number
}

export async function fetchRealtimeDoctorApproval(): Promise<RealtimeDoctorApproval> {
  const mysql = await getAppMysqlDb()

  const toNum = (value: unknown): number | null =>
    value === null || value === undefined ? null : Number(value)

  // Average time = sum of all doctors' TAT (Date_Created -> Date_Replied) divided by the number of doctors.
  const [currentRows] = await mysql.query<RowDataPacket[]>(`
    SELECT SUM(TIMESTAMPDIFF(MINUTE, Date_Created, Date_Replied)) / NULLIF(COUNT(*), 0) as avgTat
    FROM doctor_approval_notifier
    WHERE Date_Replied >= DATE_SUB(NOW(), INTERVAL 7 DAY)`)

  const [previousRows] = await mysql.query<RowDataPacket[]>(`
    SELECT SUM(TIMESTAMPDIFF(MINUTE, Date_Created, Date_Replied)) / NULLIF(COUNT(*), 0) as avgTat
    FROM doctor_approval_notifier
    WHERE Date_Replied < DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND Date_Replied >= DATE_SUB(NOW(), INTERVAL 14 DAY)`)

  let avgTatMinutes = toNum(currentRows[0]?.avgTat)
  if (avgTatMinutes === null) {
    const [allRows] = await mysql.query<RowDataPacket[]>(`
      SELECT SUM(TIMESTAMPDIFF(MINUTE, Date_Created, Date_Replied)) / NULLIF(COUNT(*), 0) as avgTat
      FROM doctor_approval_notifier
      WHERE Date_Replied IS NOT NULL`)
    avgTatMinutes = toNum(allRows[0]?.avgTat)
  }

  const [pendingRows] = await mysql.query<RowDataPacket[]>(`
    SELECT COUNT(*) as n FROM doctor_approval_notifier WHERE Date_Replied IS NULL`)

  const [todayRows] = await mysql.query<RowDataPacket[]>(`
    SELECT COUNT(*) as n FROM doctor_approval_notifier WHERE DATE(Date_Replied) = CURDATE()`)

  return {
    avgTatMinutes,
    prevAvgTatMinutes: toNum(previousRows[0]?.avgTat),
    pending: Number(pendingRows[0]?.n ?? 0),
    repliedToday: Number(todayRows[0]?.n ?? 0),
  }
}

export function emptySummary(): ClearanceSummary {
  return { inProgress: 0, paidToday: 0, paidLast7d: 0, avgClearanceMinutes7d: null, overdue: 0 }
}
