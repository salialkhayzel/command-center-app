"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatDateTime, formatMinutes, formatNumber, formatTimeOnly } from "@/lib/utils"

const REFRESH_MS = 60_000
const PAGE_SIZE = 10

type TatStatus = "on-track" | "delayed" | "critical"
type Filter = "all" | TatStatus

const STATUS_STYLES: Record<TatStatus, string> = {
  "on-track": "border-success/20 bg-success/10 text-success",
  delayed: "border-warning/20 bg-warning/10 text-warning",
  critical: "border-destructive/20 bg-destructive/10 text-destructive",
}

const STATUS_LABELS: Record<TatStatus, string> = {
  "on-track": "On Track",
  delayed: "Delayed",
  critical: "Critical",
}

interface ClearanceItem {
  department: string | null
  notifiedAt: string | null
  clearedAt: string | null
  minutes: number | null
  pending: boolean
}

interface OnTrackRow {
  registryNo: number
  patientName: string | null
  roomNo: string | null
  mghTaggedAt: string | null
  finalBillAt: string | null
  billingDischargeAt: string | null
  exitAt: string | null
  tatMinutes: number
  status: TatStatus
  mainFactor: string
  clearances: ClearanceItem[]
}

function RowDetailModal({ row, onClose }: { row: OnTrackRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const longestMinutes = row.clearances.reduce(
    (max, item) => Math.max(max, item.minutes ?? 0),
    0
  )

  const timeline = [
    { label: "MGH Tagged", at: row.mghTaggedAt, extra: null as string | null, highlight: false },
    ...row.clearances.map((item) => ({
      label: item.department ?? "Department",
      at: item.clearedAt ?? item.notifiedAt,
      extra: item.pending
        ? `notified ${formatTimeOnly(item.notifiedAt)} · awaiting clearance`
        : item.minutes !== null
          ? `notified ${formatTimeOnly(item.notifiedAt)} · cleared in ${formatMinutes(item.minutes)}`
          : null,
      highlight: !item.pending && item.minutes !== null && item.minutes === longestMinutes && longestMinutes > 0,
    })),
    { label: "Final Bill", at: row.finalBillAt, extra: `TAT ${formatMinutes(row.tatMinutes)}`, highlight: false },
    { label: "Billing Discharge", at: row.billingDischargeAt, extra: null, highlight: false },
    { label: "Exit", at: row.exitAt, extra: null, highlight: false },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <p className="text-base font-semibold text-foreground">
              {row.patientName || `Registry #${row.registryNo}`}
            </p>
            <p className="text-xs text-muted-foreground">
              #{row.registryNo} · {row.roomNo ? `Room ${row.roomNo} · ` : ""}
              TAT {formatMinutes(row.tatMinutes)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                STATUS_STYLES[row.status]
              )}
            >
              {STATUS_LABELS[row.status]}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="scrollbar-thin overflow-y-auto px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Process Timeline
          </p>
          <div className="space-y-2">
            {timeline.map((step, index) => (
              <div
                key={`${step.label}-${index}`}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-lg border px-4 py-2.5",
                  !step.at && "opacity-50",
                  step.highlight && "border-warning/40 bg-warning/5"
                )}
              >
                <div>
                  <p className="text-sm font-medium">{step.label}</p>
                  {step.extra ? (
                    <p
                      className={cn(
                        "text-xs",
                        step.highlight ? "font-medium text-warning" : "text-muted-foreground"
                      )}
                    >
                      {step.extra}
                    </p>
                  ) : null}
                </div>
                <p className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDateTime(step.at)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            Main factor: <span className="font-medium text-foreground">{row.mainFactor}</span>
            {longestMinutes > 0 ? " · longest clearance stage is highlighted" : ""}
          </p>
        </div>
      </div>
    </div>
  )
}

export function OnTrackTable() {
  const [rows, setRows] = useState<OnTrackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<OnTrackRow | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch("/api/on-track", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || "Request failed")
      setRows(json.rows as OnTrackRow[])
      setError(null)
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load on track queue")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const counts = useMemo(
    () => ({
      all: rows.length,
      "on-track": rows.filter((row) => row.status === "on-track").length,
      delayed: rows.filter((row) => row.status === "delayed").length,
      critical: rows.filter((row) => row.status === "critical").length,
    }),
    [rows]
  )

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((row) => row.status === filter)),
    [rows, filter]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(filtered.length, currentPage * PAGE_SIZE)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const changeFilter = (value: Filter) => {
    setFilter(value)
    setPage(1)
  }

  const loadingFirst = loading && !updatedAt && !error

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Live On Track Queue (Today)</CardTitle>
            <CardDescription>
              Discharge TAT classification · click a patient to see the process breakdown
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
            <Tabs value={filter} onValueChange={(value) => changeFilter(value as Filter)}>
              <TabsList className="h-9">
                <TabsTrigger value="all" className="text-xs">
                  All ({formatNumber(counts.all)})
                </TabsTrigger>
                <TabsTrigger value="on-track" className="text-xs">
                  On Track ({formatNumber(counts["on-track"])})
                </TabsTrigger>
                <TabsTrigger value="delayed" className="text-xs">
                  Delayed ({formatNumber(counts.delayed)})
                </TabsTrigger>
                <TabsTrigger value="critical" className="text-xs">
                  Critical ({formatNumber(counts.critical)})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {error ? <p className="px-6 text-sm text-destructive">{error}</p> : null}
        <div className="scrollbar-thin overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Patient</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>MGH Tagged</TableHead>
                <TableHead>Final Bill</TableHead>
                <TableHead>TAT</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Main Factor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingFirst ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Loading on track queue...
                  </TableCell>
                </TableRow>
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No discharges in this classification today.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => (
                  <TableRow
                    key={row.registryNo}
                    className="cursor-pointer"
                    onClick={() => setSelected(row)}
                  >
                    <TableCell>
                      <p className="font-medium text-foreground">
                        {row.patientName || `Registry #${row.registryNo}`}
                      </p>
                      <p className="text-xs text-muted-foreground">#{row.registryNo}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.roomNo || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {formatDateTime(row.mghTaggedAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {formatDateTime(row.finalBillAt)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "font-mono text-sm font-medium tabular-nums",
                          row.status === "on-track"
                            ? "text-success"
                            : row.status === "delayed"
                              ? "text-warning"
                              : "text-destructive"
                        )}
                      >
                        {formatMinutes(row.tatMinutes)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          STATUS_STYLES[row.status]
                        )}
                      >
                        {STATUS_LABELS[row.status]}
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "max-w-[260px] truncate text-xs",
                        row.mainFactor.startsWith("Waiting on")
                          ? "text-warning"
                          : row.mainFactor === "No clearance tags"
                            ? "text-muted-foreground"
                            : "text-foreground"
                      )}
                    >
                      {row.mainFactor}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {filtered.length > PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 pt-4">
            <p className="text-xs text-muted-foreground">
              Showing {rangeStart}–{rangeEnd} of {formatNumber(filtered.length)} · Page {currentPage} of{" "}
              {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>

      {selected ? <RowDetailModal row={selected} onClose={() => setSelected(null)} /> : null}
    </Card>
  )
}
