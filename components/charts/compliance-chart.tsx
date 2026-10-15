"use client"

import { useCallback, useEffect, useState } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartTooltipContent } from "@/components/charts/chart-tooltip"
import { cn, formatNumber } from "@/lib/utils"

const REFRESH_MS = 60_000

interface ComplianceData {
  compliance: { cleared: number; notified: number; percent: number | null }
  missingTags: { tagged: number; withClearance: number; missing: number; percent: number | null }
}

export function ComplianceChart() {
  const [data, setData] = useState<ComplianceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch("/api/compliance", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || "Request failed")
      setData({
        compliance: json.compliance,
        missingTags: json.missingTags,
      })
      setError(null)
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load compliance data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const cleared = data?.compliance.cleared ?? 0
  const notified = data?.compliance.notified ?? 0
  const pending = Math.max(0, notified - cleared)
  const percent = data?.compliance.percent ?? null

  const slices = [
    { name: "Completed", value: cleared, color: "hsl(var(--success))" },
    { name: "Pending", value: pending, color: "hsl(var(--warning))" },
  ]
  const hasData = notified > 0

  const missingPercent = data?.missingTags.percent ?? null
  const loadingFirst = loading && !updatedAt && !error

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Compliance Monitoring (Today)</CardTitle>
            <CardDescription>Clearance tag completion for today&apos;s clearances</CardDescription>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => load()} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : loadingFirst ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading compliance data...</p>
        ) : !hasData ? (
          <p className="flex h-[210px] items-center justify-center text-sm text-muted-foreground">
            No clearance tags raised yet today.
          </p>
        ) : (
          <>
            <div className="relative mx-auto h-[190px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="88%"
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {slices.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => `${formatNumber(value)} tags`}
                      />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold tabular-nums text-success">
                  {percent === null ? "—" : `${percent}%`}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  compliant
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "hsl(var(--success))" }} />
                  Completed tags
                </span>
                <span className="font-mono tabular-nums">
                  {formatNumber(cleared)} of {formatNumber(notified)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "hsl(var(--warning))" }} />
                  Pending tags
                </span>
                <span className="font-mono tabular-nums">{formatNumber(pending)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-1.5 text-xs">
                <span className="text-muted-foreground">Missing clearance tags</span>
                <span
                  className={cn(
                    "font-mono font-medium tabular-nums",
                    (missingPercent ?? 0) > 0 ? "text-destructive" : "text-success"
                  )}
                >
                  {missingPercent === null
                    ? "—"
                    : `${missingPercent}% (${formatNumber(data?.missingTags.missing ?? 0)} of ${formatNumber(
                        data?.missingTags.tagged ?? 0
                      )} patients)`}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
