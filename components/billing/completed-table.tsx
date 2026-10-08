"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn, formatCurrency, formatMinutes, formatNumber, fullDateTime } from "@/lib/utils"
import type { BillingTatCounts, CompletedBillRow } from "@/lib/billing-tat-types"

export function CompletedTable({ rows, counts }: { rows: CompletedBillRow[]; counts: BillingTatCounts }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Latest Completed Bills</CardTitle>
        <CardDescription>
          {formatNumber(counts.completedTotal)} completed · {formatNumber(counts.paid)} paid ·{" "}
          {formatNumber(counts.unpaid)} unpaid · top 200 by final bill time
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <div className="scrollbar-thin overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Patient</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>MGH Tagged</TableHead>
                <TableHead>Final Bill</TableHead>
                <TableHead className="text-right">Running Bill</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>TAT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No completed bills in this range.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const over = row.TatMinutes !== null && row.TatMinutes > 20
                  return (
                    <TableRow key={row.PK_psPatRegisters}>
                      <TableCell>
                        <p className="font-medium text-foreground">{row.PatientName || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.PatientType || "—"}
                          {row.ReTagged === 1 ? " · re-tagged" : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.RoomNo || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {fullDateTime(row.MghDateTagged)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {fullDateTime(row.FinalBillTagged)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatCurrency(row.RunningBill)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            row.Paid === 1
                              ? "border-success/20 bg-success/10 text-success"
                              : "border-warning/20 bg-warning/10 text-warning"
                          )}
                        >
                          {row.Paid === 1 ? "Paid" : "Unpaid"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-medium tabular-nums",
                            over
                              ? "border-destructive/20 bg-destructive/10 text-destructive"
                              : "border-success/20 bg-success/10 text-success"
                          )}
                        >
                          {row.TatMinutes === null ? "—" : formatMinutes(row.TatMinutes)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
