"use client"

import { useCallback, useEffect, useState } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartTooltipContent } from "@/components/charts/chart-tooltip"
import { cn, formatMinutes } from "@/lib/utils"

const REFRESH_MS = 60_000

const SLICE_COLORS = [
  "hsl(var(--destructive))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-1))",
]

interface BottleneckRow {
  key: string
  label: string
  target: number
  totalMinutes: number
  count: number
  avgMinutes: number | null
}

export function BottleneckChart() {
  const [rows, setRows] = useState<BottleneckRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch("/api/bottleneck", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || "Request failed")
      setRows(json.rows as BottleneckRow[])
      setError(null)
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bottleneck analysis")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const slices = rows
    .filter((row) => row.totalMinutes > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes)

  const total = slices.reduce((sum, row) => sum + row.totalMinutes, 0)
  const bottleneck = slices[0] ?? null
  const bottleneckShare = bottleneck && total > 0 ? Math.round((bottleneck.totalMinutes / total) * 100) : null

  const data = slices.map((row) => ({
    name: row.label,
    value: row.totalMinutes,
    avg: row.avgMinutes,
    count: row.count,
    share: total > 0 ? Math.round((row.totalMinutes / total) * 100) : 0,
  }))

  const loadingFirst = loading && !updatedAt && !error

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Bottleneck Analysis (Today)</CardTitle>
            <CardDescription>
              Share of total clearance time per stage today
            </CardDescription>
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
          <p className="py-10 text-center text-sm text-muted-foreground">Loading bottleneck analysis...</p>
        ) : data.length === 0 ? (
          <p className="flex h-[210px] items-center justify-center text-sm text-muted-foreground">
            No completed clearances yet today.
          </p>
        ) : (
          <>
            <div className="relative mx-auto h-[190px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="88%"
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {data.map((entry, index) => (
                      <Cell key={entry.name} fill={SLICE_COLORS[index % SLICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => `${formatMinutes(value)} total`}
                      />
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="max-w-[130px] truncate text-xs font-medium text-muted-foreground">
                  {bottleneck?.label ?? "—"}
                </p>
                <p className="text-2xl font-bold tabular-nums text-destructive">
                  {bottleneckShare === null ? "—" : `${bottleneckShare}%`}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  of clearance time
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {data.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: SLICE_COLORS[index % SLICE_COLORS.length] }}
                    />
                    {entry.name}
                  </span>
                  <span className="font-mono tabular-nums">
                    {entry.avg !== null ? formatMinutes(entry.avg) : "—"} avg · {entry.share}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
