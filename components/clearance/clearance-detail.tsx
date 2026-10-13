"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatCurrency, formatDateTime, formatMinutes } from "@/lib/utils"
import type { AttendingDoctorRow, ClearanceDetailResponse } from "@/lib/clearance-types"

const STAGE_ORDER = ["mgh", "endorsed", "charged", "completed", "guaranteed", "paid"] as const
const STAGE_LABELS: Record<string, string> = {
  mgh: "MGH · Notified",
  endorsed: "Endorsed",
  charged: "Charges Closed",
  completed: "Completed",
  guaranteed: "Amount Guaranteed",
  paid: "Paid",
}

const DOCTOR_STATUS_STYLES: Record<AttendingDoctorRow["status"], { label: string; className: string }> = {
  pending: { label: "Pending reply", className: "border-warning/20 bg-warning/10 text-warning" },
  "not-notified": { label: "Not notified", className: "border-border bg-muted text-muted-foreground" },
  approved: { label: "Approved", className: "border-success/20 bg-success/10 text-success" },
  declined: { label: "Replied", className: "border-info/20 bg-info/10 text-info" },
}

export function ClearanceDetail({ id }: { id: number }) {
  const [data, setData] = useState<ClearanceDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/clearance/${id}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json.error || "Failed to load details")
        if (!cancelled) setData(json as ClearanceDetailResponse)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load details")
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading clearance details...
      </div>
    )
  }

  const clearanceCase = data.case
  const remarks = [
    { label: "Nursing", value: clearanceCase.remarks.nurse },
    { label: "Clinical Coder", value: clearanceCase.remarks.clinicalCoder },
    { label: "Billing", value: clearanceCase.remarks.billing },
    { label: "Cashier", value: clearanceCase.remarks.cashier },
  ]

  return (
    <div className="space-y-5 py-2">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Clearance Timeline
        </p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {STAGE_ORDER.map((stage, index) => {
            const at = clearanceCase.milestones[stage]
            const prev = index > 0 ? clearanceCase.milestones[STAGE_ORDER[index - 1]] : null
            const user = clearanceCase.users[stage]
            const isCurrent = !clearanceCase.done && clearanceCase.currentStage === stage
            const duration =
              at && prev
                ? Math.max(0, Math.round((new Date(at).getTime() - new Date(prev).getTime()) / 60000))
                : null
            return (
              <div
                key={stage}
                className={cn(
                  "rounded-lg border p-3",
                  at ? "bg-muted/40" : isCurrent ? "border-warning/40 bg-warning/5" : "opacity-60"
                )}
              >
                <p className="text-xs font-medium">{STAGE_LABELS[stage]}</p>
                <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDateTime(at)}
                </p>
                {duration !== null ? (
                  <p className="text-[11px] text-muted-foreground">cleared in {formatMinutes(duration)}</p>
                ) : null}
                {user ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{user}</p> : null}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Billing TAT
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {clearanceCase.billing ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">MGH Tagged</span>
                  <span className="text-right">{formatDateTime(clearanceCase.billing.mghTaggedAt)}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Final Bill</span>
                  <span className="text-right">{formatDateTime(clearanceCase.billing.finalBillAt)}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">TAT</span>
                  <span
                    className={cn(
                      "text-right font-medium",
                      clearanceCase.billing.tatMinutes === null
                        ? "text-muted-foreground"
                        : clearanceCase.billing.tatMinutes <= 20
                          ? "text-success"
                          : "text-destructive"
                    )}
                  >
                    {clearanceCase.billing.tatMinutes === null
                      ? "—"
                      : formatMinutes(clearanceCase.billing.tatMinutes)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Running Bill</span>
                  <span className="text-right font-mono tabular-nums">
                    {formatCurrency(clearanceCase.billing.runningBill)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Payment</span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      clearanceCase.billing.paid
                        ? "border-success/20 bg-success/10 text-success"
                        : "border-warning/20 bg-warning/10 text-warning"
                    )}
                  >
                    {clearanceCase.billing.paid ? "Paid" : "Unpaid"}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No billing data available.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Department Remarks
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {remarks.map((remark) => (
              <div key={remark.label} className="flex items-start justify-between gap-4 text-sm">
                <span className="shrink-0 text-muted-foreground">{remark.label}</span>
                <span className="text-right">{remark.value || "—"}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Attending Doctors &amp; Approvals
            </p>
          </CardHeader>
          <CardContent className="px-0">
            {data.doctors.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">No attending doctors found for this patient.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Doctor</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Notified</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.doctors.map((doctor) => {
                    const status = DOCTOR_STATUS_STYLES[doctor.status]
                    return (
                      <TableRow key={doctor.doctorId}>
                        <TableCell>
                          <p className="font-medium">{doctor.doctorName || `Doctor #${doctor.doctorId}`}</p>
                          {doctor.remark ? (
                            <p className="text-xs text-muted-foreground">{doctor.remark}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{doctor.role || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(doctor.notifiedAt)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                              status.className
                            )}
                          >
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {doctor.fee !== null ? doctor.fee : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Notifications
        </p>
        {data.notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications logged.</p>
        ) : (
          <div className="max-h-52 space-y-1.5 overflow-y-auto pr-2 scrollbar-thin">
            {data.notifications.map((notification) => (
              <div key={notification.id} className="flex items-start justify-between gap-4 text-xs">
                <span>{notification.message}</span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {formatDateTime(notification.date)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
