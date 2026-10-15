import { createSnapshot, nextSnapshot, type MetricSnapshot } from "@/lib/metrics"
import { fetchRealtimeBilling, fetchRealtimeDischargeTat } from "@/lib/billing-live"
import { fetchRealtimeDoctorApproval } from "@/lib/clearance"
import { fetchRealtimeAncillaryClearance, fetchRealtimeNursingClearance, fetchRealtimePharmacyClearance } from "@/lib/dept-clearance-live"

const encoder = new TextEncoder()
const REFRESH_MS = Number(process.env.LIVE_REFRESH_MS) || 10_000

export type LiveClient = (chunk: Uint8Array) => void

interface LiveState {
  clients: Set<LiveClient>
  timer: ReturnType<typeof setInterval> | null
  snapshot: MetricSnapshot | null
  refreshing: boolean
  warned: boolean
}

declare global {
  var __commandCenterLive: LiveState | undefined
}

function state(): LiveState {
  if (!globalThis.__commandCenterLive) {
    globalThis.__commandCenterLive = {
      clients: new Set(),
      timer: null,
      snapshot: null,
      refreshing: false,
      warned: false,
    }
  }
  return globalThis.__commandCenterLive
}

function encodeEvent(snapshot: MetricSnapshot): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`)
}

async function buildSnapshot(previous: MetricSnapshot | null): Promise<MetricSnapshot> {
  const snapshot = nextSnapshot(previous)
  try {
    const [real, discharge] = await Promise.all([fetchRealtimeBilling(), fetchRealtimeDischargeTat()])
    state().warned = false

    const billing = snapshot.stages.find((stage) => stage.key === "billing")
    if (billing) {
      if (real.avgCompletedToday !== null) billing.avgMinutes = Math.round(real.avgCompletedToday)
      if (real.prevAvgCompleted !== null) billing.prevAvgMinutes = Math.round(real.prevAvgCompleted)
      billing.pending = real.activeAwaiting
      billing.samples = Math.max(1, real.completedToday)
    }
    snapshot.activeDischarges = real.activeAwaiting
    snapshot.completedToday = real.completedToday
    snapshot.avgTotalMinutes =
      discharge.avgTatMinutes === null ? 0 : Math.round(discharge.avgTatMinutes)
    snapshot.prevAvgTotalMinutes =
      discharge.prevAvgTatMinutes === null
        ? snapshot.avgTotalMinutes
        : Math.round(discharge.prevAvgTatMinutes)
    snapshot.onTrack = real.withinTargetToday
    snapshot.delayed = real.delayedToday
    snapshot.critical = real.criticalToday
  } catch (err) {
    const live = state()
    if (!live.warned) {
      live.warned = true
      console.error(
        "[live-store] real billing data unavailable, using simulated billing values:",
        err instanceof Error ? err.message : err
      )
    }
  }

  try {
    const approvals = await fetchRealtimeDoctorApproval()
    const doctor = snapshot.stages.find((stage) => stage.key === "doctor_approval")
    if (doctor) {
      if (approvals.avgTatMinutes !== null) doctor.avgMinutes = Math.round(approvals.avgTatMinutes)
      doctor.prevAvgMinutes =
        approvals.prevAvgTatMinutes !== null ? Math.round(approvals.prevAvgTatMinutes) : doctor.avgMinutes
      doctor.pending = approvals.pending
      doctor.samples = approvals.repliedToday
    }
  } catch (err) {
    console.error(
      "[live-store] real doctor approval data unavailable, using simulated values:",
      err instanceof Error ? err.message : err
    )
  }

  try {
    const nursing = await fetchRealtimeNursingClearance()
    const nursingStage = snapshot.stages.find((stage) => stage.key === "nursing")
    if (nursingStage) {
      if (nursing.avgTatMinutes !== null) nursingStage.avgMinutes = Math.round(nursing.avgTatMinutes)
      nursingStage.prevAvgMinutes =
        nursing.prevAvgTatMinutes !== null ? Math.round(nursing.prevAvgTatMinutes) : nursingStage.avgMinutes
      nursingStage.pending = nursing.pending
      nursingStage.samples = nursing.clearedToday
    }
  } catch (err) {
    console.error(
      "[live-store] real nursing clearance data unavailable, using simulated values:",
      err instanceof Error ? err.message : err
    )
  }

  try {
    const ancillary = await fetchRealtimeAncillaryClearance()
    const ancillaryStage = snapshot.stages.find((stage) => stage.key === "ancillary")
    if (ancillaryStage) {
      if (ancillary.avgTatMinutes !== null) ancillaryStage.avgMinutes = Math.round(ancillary.avgTatMinutes)
      ancillaryStage.prevAvgMinutes =
        ancillary.prevAvgTatMinutes !== null ? Math.round(ancillary.prevAvgTatMinutes) : ancillaryStage.avgMinutes
      ancillaryStage.pending = ancillary.pending
      ancillaryStage.samples = ancillary.clearedToday
    }
  } catch (err) {
    console.error(
      "[live-store] real ancillary clearance data unavailable, using simulated values:",
      err instanceof Error ? err.message : err
    )
  }

  try {
    const pharmacy = await fetchRealtimePharmacyClearance()
    const pharmacyStage = snapshot.stages.find((stage) => stage.key === "pharmacy")
    if (pharmacyStage) {
      if (pharmacy.avgTatMinutes !== null) pharmacyStage.avgMinutes = Math.round(pharmacy.avgTatMinutes)
      pharmacyStage.prevAvgMinutes =
        pharmacy.prevAvgTatMinutes !== null ? Math.round(pharmacy.prevAvgTatMinutes) : pharmacyStage.avgMinutes
      pharmacyStage.pending = pharmacy.pending
      pharmacyStage.samples = pharmacy.clearedToday
    }
  } catch (err) {
    console.error(
      "[live-store] real pharmacy clearance data unavailable, using simulated values:",
      err instanceof Error ? err.message : err
    )
  }

  return snapshot
}

export async function getCurrentSnapshot(): Promise<MetricSnapshot> {
  const live = state()
  if (!live.snapshot) {
    live.snapshot = await buildSnapshot(null)
  }
  return live.snapshot
}

function broadcast(): void {
  const live = state()
  if (!live.snapshot) return
  const chunk = encodeEvent(live.snapshot)
  for (const client of live.clients) {
    try {
      client(chunk)
    } catch {
      live.clients.delete(client)
    }
  }
}

export function subscribe(client: LiveClient): () => void {
  const live = state()
  live.clients.add(client)
  void getCurrentSnapshot()
    .then((snapshot) => client(encodeEvent(snapshot)))
    .catch(() => {})

  if (!live.timer) {
    live.timer = setInterval(async () => {
      if (live.refreshing) return
      live.refreshing = true
      try {
        live.snapshot = await buildSnapshot(live.snapshot)
        broadcast()
      } finally {
        live.refreshing = false
      }
    }, REFRESH_MS)
  }

  return () => {
    live.clients.delete(client)
    if (live.clients.size === 0 && live.timer) {
      clearInterval(live.timer)
      live.timer = null
    }
  }
}

export { REFRESH_MS }
