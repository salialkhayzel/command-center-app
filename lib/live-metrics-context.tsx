"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useLiveMetrics } from "@/lib/use-live-metrics"
import type { MetricSnapshot } from "@/lib/metrics"

interface LiveMetricsContextValue {
  snapshot: MetricSnapshot | null
  connected: boolean
}

const LiveMetricsContext = createContext<LiveMetricsContextValue | undefined>(undefined)

export function LiveMetricsProvider({ children }: { children: ReactNode }) {
  const value = useLiveMetrics()
  return <LiveMetricsContext.Provider value={value}>{children}</LiveMetricsContext.Provider>
}

export function useLiveMetricsContext() {
  const context = useContext(LiveMetricsContext)
  if (!context) {
    throw new Error("useLiveMetricsContext must be used within a LiveMetricsProvider")
  }
  return context
}
