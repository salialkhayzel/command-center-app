"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatDateTime, formatMinutes, formatNumber } from "@/lib/utils"

const REFRESH_MS = 60_000
const PAGE_SIZE = 10

interface DeptClearanceRow {
  id: number
  registryNo: number
  patientName: string | null
  roomNo: string | null
  department: string | null
  notifiedAt: string | null
  waitingMinutes: number
}

interface DeptClearanceTableProps {
  title: string
  description: string
  endpoint: string
  emptyLabel: string
}

export function DeptClearanceTable({ title, description, endpoint, emptyLabel }: DeptClearanceTableProps) {
  const [rows, setRows] = useState<DeptClearanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [page, setPage] = useState(1)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetch(endpoint, { cache: "no-store" })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error || "Request failed")
        setRows(json.rows as DeptClearanceRow[])
        setError(null)
        setUpdatedAt(new Date())
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load clearance queue")
      } finally {
        setLoading(false)
      }
    },
    [endpoint]
  )

  useEffect(() => {
    load()
    const timer = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [endpoint])

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
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>
              {description} · {updatedAt ? `${formatNumber(rows.length)} pending` : "loading..."}
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
                <TableHead>Department</TableHead>
                <TableHead>Notified</TableHead>
                <TableHead>Waiting</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingFirst ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Loading {title.toLowerCase()}...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {emptyLabel}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">
                        {row.patientName || `Registry #${row.registryNo}`}
                      </p>
                      <p className="text-xs text-muted-foreground">#{row.registryNo}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.roomNo || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.department || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(row.notifiedAt)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "font-mono text-sm font-medium tabular-nums",
                          row.waitingMinutes > 90
                            ? "text-destructive"
                            : row.waitingMinutes > 30
                              ? "text-warning"
                              : "text-foreground"
                        )}
                      >
                        {formatMinutes(row.waitingMinutes)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
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
