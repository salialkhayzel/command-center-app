"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatCurrency, formatDateTime, formatNumber } from "@/lib/utils"
import type { DoctorApprovalPatient, DoctorApprovalsResponse } from "@/lib/clearance-types"

const REFRESH_MS = 60_000

type Tab = "pending" | "replied"

function PatientDoctorsModal({
  patient,
  onClose,
}: {
  patient: DoctorApprovalPatient
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <p className="text-base font-semibold text-foreground">
              {patient.patientName || `Registry #${patient.registryNo}`}
            </p>
            <p className="text-xs text-muted-foreground">
              #{patient.registryNo} · {patient.doctors.length} doctor
              {patient.doctors.length === 1 ? "" : "s"} · {patient.pendingCount} pending ·{" "}
              {patient.repliedCount} replied
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="scrollbar-thin overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>DoctorID</TableHead>
                <TableHead>Doctor Name</TableHead>
                <TableHead>Role Type</TableHead>
                <TableHead>Notify</TableHead>
                <TableHead className="text-right">Professional Fee</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patient.doctors.map((doctor) => (
                <TableRow key={doctor.doctorId}>
                  <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                    {doctor.doctorId}
                  </TableCell>
                  <TableCell className="font-medium">
                    {doctor.doctorName || `Doctor #${doctor.doctorId}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{doctor.role || "—"}</TableCell>
                  <TableCell>
                    {doctor.notifiedAt ? (
                      <div>
                        <span className="inline-flex items-center rounded-full border border-success/20 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                          Yes
                        </span>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatDateTime(doctor.notifiedAt)}
                        </p>
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        Not yet
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {doctor.fee !== null ? formatCurrency(doctor.fee) : "—"}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                    {doctor.remark || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

export function DoctorApprovalTable() {
  const [data, setData] = useState<DoctorApprovalsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [tab, setTab] = useState<Tab>("pending")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<DoctorApprovalPatient | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetch(`/api/doctor-approvals?tab=${tab}&page=${page}`, { cache: "no-store" })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error || "Request failed")
        setData(json as DoctorApprovalsResponse)
        setError(null)
        setUpdatedAt(new Date())
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load doctor approvals")
      } finally {
        setLoading(false)
      }
    },
    [tab, page]
  )

  useEffect(() => {
    load()
    const timer = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const changeTab = (value: Tab) => {
    setTab(value)
    setPage(1)
  }

  const patients = data?.patients ?? []
  const totalPatients = data?.totalPatients ?? 0
  const pageSize = data?.pageSize ?? 10
  const totalPages = Math.max(1, Math.ceil(totalPatients / pageSize))
  const rangeStart = totalPatients === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(totalPatients, page * pageSize)
  const loadingFirst = !data && !error

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Live Doctor Approval Queue</CardTitle>
            <CardDescription>
              SMS notify replies via command_center · click a patient to view doctors ·{" "}
              {data ? `${rangeStart}–${rangeEnd} of ${formatNumber(totalPatients)} patients` : "loading..."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {updatedAt ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Updated {updatedAt.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => load()} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
            <Tabs value={tab} onValueChange={(value) => changeTab(value as Tab)}>
              <TabsList className="h-9">
                <TabsTrigger value="pending" className="text-xs">
                  Pending ({data ? formatNumber(data.totals.pending) : "…"})
                </TabsTrigger>
                <TabsTrigger value="replied" className="text-xs">
                  Replied ({data ? formatNumber(data.totals.replied) : "…"})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-0 pb-2">
        {error ? <p className="px-6 text-sm text-destructive">{error}</p> : null}

        {loadingFirst ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading doctor approvals...</p>
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctors</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Replied</TableHead>
                  <TableHead>Last Notified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {tab === "pending" ? "No approvals awaiting reply." : "No replies yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  patients.map((patient) => (
                    <TableRow
                      key={patient.registryNo}
                      className="cursor-pointer"
                      onClick={() => setSelected(patient)}
                    >
                      <TableCell>
                        <p className="font-medium text-foreground">
                          {patient.patientName || `Registry #${patient.registryNo}`}
                        </p>
                        <p className="text-xs text-muted-foreground">#{patient.registryNo}</p>
                      </TableCell>
                      <TableCell className="font-mono text-sm tabular-nums">
                        {patient.doctors.length}
                      </TableCell>
                      <TableCell>
                        {patient.pendingCount > 0 ? (
                          <span className="inline-flex items-center rounded-full border border-warning/20 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                            {patient.pendingCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {patient.repliedCount > 0 ? (
                          <span className="inline-flex items-center rounded-full border border-success/20 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                            {patient.repliedCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {patient.lastNotifiedAt ? formatDateTime(patient.lastNotifiedAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPatients > pageSize ? (
          <div className="flex items-center justify-between border-t px-6 pt-4">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>

      {selected ? <PatientDoctorsModal patient={selected} onClose={() => setSelected(null)} /> : null}
    </Card>
  )
}
