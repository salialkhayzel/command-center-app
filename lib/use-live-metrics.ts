"use client"

import { useEffect, useState } from "react"
import type { MetricSnapshot } from "@/lib/metrics"

export function useLiveMetrics() {
  const [snapshot, setSnapshot] = useState<MetricSnapshot | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const source = new EventSource("/api/stream")

    source.onopen = () => setConnected(true)

    source.onmessage = (event) => {
      try {
        setSnapshot(JSON.parse(event.data) as MetricSnapshot)
        setConnected(true)
      } catch {
        setConnected(false)
      }
    }

    source.onerror = () => setConnected(false)

    return () => source.close()
  }, [])

  return { snapshot, connected }
}
