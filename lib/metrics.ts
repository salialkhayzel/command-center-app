export type StageKey = "doctor_approval" | "nursing" | "ancillary" | "pharmacy" | "billing"

export interface StageMetric {
  key: StageKey
  label: string
  avgMinutes: number
  prevAvgMinutes: number
  pending: number
  samples: number
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
}

const STAGE_DEFS: { key: StageKey; label: string }[] = [
  { key: "doctor_approval", label: "Doctor Approval" },
  { key: "nursing", label: "Nursing Clearance" },
  { key: "ancillary", label: "Ancillary Clearance" },
  { key: "pharmacy", label: "Pharmacy Clearance" },
  { key: "billing", label: "Billing & Cashier" },
]

function buildStages(previous?: StageMetric[]): StageMetric[] {
  return STAGE_DEFS.map((def) => {
    const prior = previous?.find((stage) => stage.key === def.key)
    if (prior) {
      return { ...prior }
    }
    return {
      key: def.key,
      label: def.label,
      avgMinutes: 0,
      prevAvgMinutes: 0,
      pending: 0,
      samples: 0,
    }
  })
}

function buildSnapshot(previous?: MetricSnapshot): MetricSnapshot {
  const stages = buildStages(previous?.stages)

  return {
    generatedAt: new Date().toISOString(),
    activeDischarges: previous?.activeDischarges ?? 0,
    completedToday: previous?.completedToday ?? 0,
    avgTotalMinutes: previous?.avgTotalMinutes ?? 0,
    prevAvgTotalMinutes: previous?.prevAvgTotalMinutes ?? 0,
    onTrack: previous?.onTrack ?? 0,
    delayed: previous?.delayed ?? 0,
    critical: previous?.critical ?? 0,
    stages,
  }
}

export function createSnapshot(): MetricSnapshot {
  return buildSnapshot()
}

export function nextSnapshot(previous: MetricSnapshot | null): MetricSnapshot {
  return buildSnapshot(previous ?? undefined)
}
