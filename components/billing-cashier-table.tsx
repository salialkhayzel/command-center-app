"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatDateTime, formatMinutes, formatNumber } from "@/lib/utils"

const REFRESH_MS = 60_000
const PAGE_SIZE = 10

interface BillingCashierRow {
  registryNo: number
  patientName: string | null
  roomNo: string | null
  mghTaggedAt: string | null
  finalBillAt: string | null
  billingDischargeAt: string | null
  exitAt: string | null
  tatMinutes: number | null
  paid: boolean
  waitingMinutes: number
}

function statusFor(row: BillingCashierRow): { label: string; className: string } {
  if (row.exitAt) {
    return { label: "Exited", className: "border-success/20 bg-success/10 text-success" }
  }
  if (!row.finalBillAt) {
    return row.waitingMinutes > 20
      ? { label: "Awaiting bill · Overdue", className: "border-destructive/20 bg-destructive/10 text-destructive" }
      : { label: "Awaiting bill", className: "border-warning/20 bg-warning/10 text-warning" }
  }
  if (!row.paid) {
    return { label: "Awaiting payment", className: "border-warning/20 bg-warning/10 text-warning" }
  }
  return { label: "Ready to exit", className: "border-info/20 bg-info/10 text-info" }
}

export function BillingCashierTable() {
  const [rows, setRows] = useState<BillingCashierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [page, setPage] = useState(1)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch("/api/billing-cashier", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || "Request failed")
      setRows(json.rows as BillingCashierRow[])
      setError(null)
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing & cashier queue")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const rangeStart = rows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(rows.length, currentPage * PAGE_SIZE)
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const loadingFirst = loading && !updatedAt && !error

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Live Billing &amp; Cashier Queue</CardTitle>
            <CardDescription>
              Patients from MGH tag to final bill, payment and exit ·{" "}
              {updatedAt ? `${formatNumber(rows.length)} in queue` : "loading..."}
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
                <TableHead>Paid</TableHead>
                <TableHead>Exit</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingFirst ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    Loading billing &amp; cashier queue...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No patients in the billing &amp; cashier queue.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => {
                  const status = statusFor(row)
                  return (
                    <TableRow key={row.registryNo}>
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
                        {row.tatMinutes === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={cn(
                              "font-mono text-sm font-medium tabular-nums",
                              row.tatMinutes <= 20 ? "text-success" : "text-destructive"
                            )}
                          >
                            {formatMinutes(row.tatMinutes)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            row.paid
                              ? "border-success/20 bg-success/10 text-success"
                              : "border-warning/20 bg-warning/10 text-warning"
                          )}
                        >
                          {row.paid ? "Paid" : "Unpaid"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatDateTime(row.exitAt)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            status.className
                          )}
                        >
                          {status.label}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {rows.length > PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 pt-4">
            <p className="text-xs text-muted-foreground">
              Showing {rangeStart}–{rangeEnd} of {formatNumber(rows.length)} · Page {currentPage} of{" "}
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
    </Card>
  )
}
