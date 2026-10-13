"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Timer,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ClearanceDetail } from "@/components/clearance/clearance-detail"
import type { ClearanceListResponse } from "@/lib/clearance-types"
import { cn, formatCurrency, formatDateTime, formatMinutes, formatNumber, formatTimeOnly } from "@/lib/utils"

const REFRESH_MS = 60_000

function progressColor(percent: number, overdue: boolean): string {
  if (overdue) return "bg-destructive"
  if (percent >= 80) return "bg-warning"
  return "bg-success"
}

function ClearanceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="space-y-3 p-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export function ClearanceMonitor() {
  const [data, setData] = useState<ClearanceListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [station, setStation] = useState("all")
  const [query, setQuery] = useState("")
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch("/api/clearance", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || "Request failed")
      setData(json as ClearanceListResponse)
      setError(null)
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clearance queue")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const rows = useMemo(() => {
    if (!data) return []
    const search = query.trim().toLowerCase()
    return data.rows.filter((row) => {
      if (station !== "all" && row.station !== station) return false
      if (!search) return true
      return (
        row.patient.toLowerCase().includes(search) ||
        (row.roomno ?? "").toLowerCase().includes(search) ||
        (row.bedno ?? "").toLowerCase().includes(search) ||
        (row.admissionId !== null && String(row.admissionId).includes(search))
      )
    })
  }, [data, station, query])

  if (loading && !data) {
    return <ClearanceSkeleton />
  }

  const summary = data?.summary

  const kpis = [
    {
      label: "In Progress",
      value: formatNumber(summary?.inProgress ?? 0),
      hint: "active clearances",
      icon: Activity,
      accent: "text-info",
    },
    {
      label: "Over Target",
      value: formatNumber(summary?.overdue ?? 0),
      hint: "stage time exceeded",
      icon: AlertTriangle,
      accent: (summary?.overdue ?? 0) > 0 ? "text-destructive" : "text-muted-foreground",
    },
    {
      label: "Paid Today",
      value: formatNumber(summary?.paidToday ?? 0),
      hint: "clearance completed",
      icon: CheckCircle2,
      accent: "text-success",
    },
    {
      label: "Avg Clearance",
      value:
        summary?.avgClearanceMinutes7d === null || summary?.avgClearanceMinutes7d === undefined
          ? "—"
          : formatMinutes(summary.avgClearanceMinutes7d),
      hint: "MGH to paid · last 7 days",
      icon: Timer,
      accent: "text-primary",
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-start justify-between p-5">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {kpi.label}
                </p>
                <p className="text-2xl font-bold tabular-nums tracking-tight">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.hint}</p>
              </div>
              <div className="rounded-lg bg-muted p-2.5">
                <kpi.icon className={cn("h-5 w-5", kpi.accent)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patient, room, or admission #"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 w-[260px] pl-8"
          />
        </div>
        <select
          value={station}
          onChange={(event) => setStation(event.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All stations</option>
          {(data?.stations ?? []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <Button variant="secondary" size="sm" onClick={() => load()} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
        {updatedAt ? (
          <span className="text-xs text-muted-foreground">
            Updated{" "}
            {updatedAt.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        ) : null}
      </div>

      <Card>
        <CardContent className="px-0 pb-2">
          <div className="scrollbar-thin overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8" />
                  <TableHead>Patient</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Notified</TableHead>
                  <TableHead>Pending Stage</TableHead>
                  <TableHead>MGH → Final Bill</TableHead>
                  <TableHead className="text-right">Running Bill</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Total Elapsed</TableHead>
                  <TableHead className="w-[160px]">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                      No clearances match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const expanded = expandedId === row.id
                    return (
                      <ClearanceRowGroup
                        key={row.id}
                        row={row}
                        expanded={expanded}
                        onToggle={() => setExpandedId(expanded ? null : row.id)}
                      />
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ClearanceRowGroup({
  row,
  expanded,
  onToggle,
}: {
  row: ClearanceListResponse["rows"][number]
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell className="pr-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell>
          <p className="font-medium text-foreground">{row.patient}</p>
          <p className="text-xs text-muted-foreground">
            {row.admissionId !== null ? `Admission #${row.admissionId}` : "—"}
          </p>
        </TableCell>
        <TableCell className="text-muted-foreground">{row.station || "—"}</TableCell>
        <TableCell className="text-muted-foreground">{row.bedno || row.roomno || "—"}</TableCell>
        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(row.milestones.mgh)}
        </TableCell>
        <TableCell>
          <div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                row.overdue
                  ? "border-destructive/20 bg-destructive/10 text-destructive"
                  : "border-info/20 bg-info/10 text-info"
              )}
            >
              {row.overdue ? <AlertTriangle className="h-3 w-3" /> : null}
              {row.pendingLabel}
              {row.overdue ? " · Overdue" : ""}
            </span>
            {!row.done ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                since {formatTimeOnly(row.milestones[row.currentStage])} ·{" "}
                {formatMinutes(row.stageElapsedMinutes)} waiting
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                cleared {formatTimeOnly(row.milestones.paid)}
              </p>
            )}
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {row.billing?.finalBillAt ? (
            <div>
              <p className="font-mono text-xs tabular-nums">
                {formatTimeOnly(row.billing.mghTaggedAt)} → {formatTimeOnly(row.billing.finalBillAt)}
              </p>
              {row.billing.tatMinutes !== null ? (
                <p
                  className={cn(
                    "text-xs font-medium",
                    row.billing.tatMinutes <= 20 ? "text-success" : "text-destructive"
                  )}
                >
                  {formatMinutes(row.billing.tatMinutes)} TAT
                </p>
              ) : null}
            </div>
          ) : row.billing?.mghTaggedAt ? (
            <span className="text-xs text-muted-foreground">
              MGH {formatTimeOnly(row.billing.mghTaggedAt)} · awaiting bill
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {row.billing ? formatCurrency(row.billing.runningBill) : "—"}
        </TableCell>
        <TableCell>
          {row.billing ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                row.billing.paid
                  ? "border-success/20 bg-success/10 text-success"
                  : "border-warning/20 bg-warning/10 text-warning"
              )}
            >
              {row.billing.paid ? "Paid" : "Unpaid"}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          <span
            className={cn(
              "font-mono text-sm font-medium tabular-nums",
              row.overdue ? "text-destructive" : "text-foreground"
            )}
          >
            {formatMinutes(row.totalElapsedMinutes)}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", progressColor(row.percent, row.overdue))}
                style={{ width: `${Math.min(100, row.percent)}%` }}
              />
            </div>
            <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
              {row.percent}%
            </span>
          </div>
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={11} className="bg-muted/30 px-6">
            <ClearanceDetail id={row.id} />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}
