export type StageKey = "doctor_approval" | "nursing" | "ancillary" | "pharmacy" | "billing"

export type DischargeStatus = "on-track" | "delayed" | "critical"

export interface StageMetric {
  key: StageKey
  label: string
  avgMinutes: number
  prevAvgMinutes: number
  pending: number
  samples: number
}

export interface HourlyPoint {
  time: string
  discharges: number
  avgMinutes: number
}

export interface TrendPoint {
  time: string
  avgMinutes: number
}

export interface QueueRow {
  id: string
  patientId: string
  patientName: string
  ward: string
  stage: StageKey
  elapsedMinutes: number
  status: DischargeStatus
}

export interface MetricSnapshot {
  generatedAt: string
  activeDischarges: number
  completedToday: number
  avgTotalMinutes: number
  prevAvgTotalMinutes: number
  onTrack: number
  delayed: number
  critical: number
  stages: StageMetric[]
  hourly: HourlyPoint[]
  trend: TrendPoint[]
  queue: QueueRow[]
}

const STAGE_DEFS: { key: StageKey; label: string; baseline: number; pending: number }[] = [
  { key: "doctor_approval", label: "Doctor Approval", baseline: 52, pending: 7 },
  { key: "nursing", label: "Nursing Clearance", baseline: 68, pending: 9 },
  { key: "ancillary", label: "Ancillary Results", baseline: 61, pending: 6 },
  { key: "pharmacy", label: "Pharmacy", baseline: 38, pending: 5 },
  { key: "billing", label: "Billing & Cashier", baseline: 44, pending: 8 },
]

const WARDS = ["Medical Ward", "Surgical Ward", "OB-GYN", "Pediatrics", "ICU", "HDU"]

const PATIENTS = [
  "Dela Cruz, Juan",
  "Santos, Maria",
  "Reyes, Antonio",
  "Garcia, Liza",
  "Mendoza, Carlo",
  "Bautista, Ana",
  "Villanueva, Ramon",
  "Aquino, Grace",
  "Domingo, Paulo",
  "Navarro, Elena",
  "Castro, Miguel",
  "Salazar, Teresa",
]

function jitter(range: number): number {
  return (Math.random() - 0.5) * 2 * range
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number): number {
  return Math.round(value)
}

function stageStatus(elapsed: number): DischargeStatus {
  if (elapsed >= 150) return "critical"
  if (elapsed >= 90) return "delayed"
  return "on-track"
}

function buildQueue(): QueueRow[] {
  return PATIENTS.map((patientName, index) => {
    const stage = STAGE_DEFS[index % STAGE_DEFS.length]
    const elapsed = round(clamp(stage.baseline + jitter(70), 12, 220))
    return {
      id: `q-${index}`,
      patientId: `MRN-${210000 + index * 37}`,
      patientName,
      ward: WARDS[index % WARDS.length],
      stage: stage.key,
      elapsedMinutes: elapsed,
      status: stageStatus(elapsed),
    }
  })
}

function buildHourly(): HourlyPoint[] {
  const now = new Date()
  const points: HourlyPoint[] = []
  const base = [42, 38, 51, 63, 58, 66, 72, 61, 55, 47, 52, 46]
  for (let i = 11; i >= 0; i -= 1) {
    const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
    const label = `${hour.getHours().toString().padStart(2, "0")}:00`
    const index = 11 - i
    points.push({
      time: label,
      discharges: Math.max(0, round(4 + jitter(3) + Math.sin(index / 2) * 1.5)),
      avgMinutes: round(base[index] + jitter(9)),
    })
  }
  return points
}

function buildTrend(): TrendPoint[] {
  const now = new Date()
  const points: TrendPoint[] = []
  let value = 258
  for (let i = 23; i >= 0; i -= 1) {
    const at = new Date(now.getTime() - i * 15 * 60 * 1000)
    value = clamp(value + jitter(14) - 0.6, 180, 360)
    points.push({
      time: `${at.getHours().toString().padStart(2, "0")}:${at.getMinutes().toString().padStart(2, "0")}`,
      avgMinutes: round(value),
    })
  }
  return points
}

function buildStages(previous?: StageMetric[]): StageMetric[] {
  return STAGE_DEFS.map((def) => {
    const prior = previous?.find((stage) => stage.key === def.key)
    const avg = prior
      ? clamp(prior.avgMinutes + jitter(7) - (prior.avgMinutes - def.baseline) * 0.12, def.baseline - 22, def.baseline + 42)
      : clamp(def.baseline + jitter(16), def.baseline - 20, def.baseline + 35)
    return {
      key: def.key,
      label: def.label,
      avgMinutes: round(avg),
      prevAvgMinutes: round(def.baseline + (def.key === "billing" ? 6 : -4)),
      pending: Math.max(0, round((prior?.pending ?? def.pending) + jitter(2))),
      samples: Math.max(3, round((prior?.samples ?? 24) + jitter(4))),
    }
  })
}

function buildSnapshot(previous?: MetricSnapshot): MetricSnapshot {
  const stages = buildStages(previous?.stages)
  const avgTotal = stages.reduce((total, stage) => total + stage.avgMinutes, 0)
  const prevTotal = stages.reduce((total, stage) => total + stage.prevAvgMinutes, 0)
  const queue = buildQueue()
  const counts = queue.reduce(
    (acc, row) => {
      if (row.status === "on-track") acc.onTrack += 1
      else if (row.status === "delayed") acc.delayed += 1
      else acc.critical += 1
      return acc
    },
    { onTrack: 0, delayed: 0, critical: 0 }
  )

  const hourly = previous?.hourly ?? buildHourly()
  const trend = previous?.trend ?? buildTrend()
  const driftedHourly = hourly.map((point, index) =>
    index === hourly.length - 1
      ? { ...point, avgMinutes: round(clamp(point.avgMinutes + jitter(5), 25, 140)) }
      : point
  )
  const driftedTrend = trend.map((point, index) =>
    index === trend.length - 1
      ? { ...point, avgMinutes: round(clamp(point.avgMinutes + jitter(10), 160, 380)) }
      : point
  )

  return {
    generatedAt: new Date().toISOString(),
    activeDischarges: Math.max(20, round((previous?.activeDischarges ?? 54) + jitter(4))),
    completedToday: Math.max(0, round((previous?.completedToday ?? 31) + Math.random() * 1.4)),
    avgTotalMinutes: avgTotal,
    prevAvgTotalMinutes: prevTotal,
    ...counts,
    stages,
    hourly: driftedHourly,
    trend: driftedTrend,
    queue,
  }
}

export function createSnapshot(): MetricSnapshot {
  return buildSnapshot()
}

export function nextSnapshot(previous: MetricSnapshot | null): MetricSnapshot {
  return buildSnapshot(previous ?? undefined)
}
