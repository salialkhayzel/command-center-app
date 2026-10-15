"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, RefreshCw, Timer, TrendingDown, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, formatMinutes, formatNumber } from "@/lib/utils"

const REFRESH_MS = 60_000

interface ExecutiveOverviewData {
  targetMinutes: number
  completedToday: number
  avgTatMinutes: number | null
  withinTarget: number
  overTarget: number
  withinPercent: number | null
}

export function ExecutiveOverview() {
  const [data, setData] = useState<ExecutiveOverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch("/api/executive-overview", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || "Request failed")
      setData(json as ExecutiveOverviewData)
      setError(null)
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load executive overview")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const target = data?.targetMinutes ?? 180
  const avg = data?.avgTatMinutes ?? null
  const withinTarget = avg !== null && avg <= target
  const barPercent = avg === null ? 0 : Math.min(100, Math.round((avg / target) * 100))

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Executive Overview (Today)</CardTitle>
            <CardDescription>
              Average discharge TAT from MGH tag to billing discharge · target{" "}
              {formatMinutes(target)}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {updatedAt ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Updated{" "}
                {updatedAt.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => load()} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-4">
          <p
            className={cn(
              "text-5xl font-bold tabular-nums tracking-tight",
              avg === null ? "text-muted-foreground" : withinTarget ? "text-success" : "text-destructive"
            )}
          >
            {avg === null ? "—" : formatMinutes(avg)}
          </p>
          {avg !== null ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold",
                withinTarget
                  ? "border-success/20 bg-success/10 text-success"
                  : "border-destructive/20 bg-destructive/10 text-destructive"
              )}
            >
              {withinTarget ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5" />
              )}
              {withinTarget ? "Within target" : "Over target"}
            </span>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", withinTarget ? "bg-success" : "bg-destructive")}
              style={{ width: `${barPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>0m</span>
            <span>target {formatMinutes(target)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              Discharges Today
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {data ? formatNumber(data.completedToday) : "—"}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5 text-success" />
              Within Target
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {data && data.withinPercent !== null ? `${data.withinPercent}%` : "—"}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-destructive" />
              Over Target
            </p>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {data ? formatNumber(data.overTarget) : "—"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
