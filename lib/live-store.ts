import { createSnapshot, nextSnapshot, type MetricSnapshot } from "@/lib/metrics"

const encoder = new TextEncoder()
const REFRESH_MS = Number(process.env.LIVE_REFRESH_MS) || 10_000

export type LiveClient = (chunk: Uint8Array) => void

interface LiveState {
  clients: Set<LiveClient>
  timer: ReturnType<typeof setInterval> | null
  snapshot: MetricSnapshot | null
}

declare global {
  var __commandCenterLive: LiveState | undefined
}

function state(): LiveState {
  if (!globalThis.__commandCenterLive) {
    globalThis.__commandCenterLive = { clients: new Set(), timer: null, snapshot: null }
  }
  return globalThis.__commandCenterLive
}

function encodeEvent(snapshot: MetricSnapshot): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`)
}

export function getCurrentSnapshot(): MetricSnapshot {
  const live = state()
  if (!live.snapshot) {
    live.snapshot = createSnapshot()
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
  client(encodeEvent(getCurrentSnapshot()))

  if (!live.timer) {
    live.timer = setInterval(() => {
      live.snapshot = nextSnapshot(live.snapshot)
      broadcast()
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
