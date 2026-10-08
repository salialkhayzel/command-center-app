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
import { cn, formatCurrency, formatMinutes, fullDateTime } from "@/lib/utils"
import type { AwaitingBillRow } from "@/lib/billing-tat-types"

function waitingColor(minutes: number): string {
  if (minutes <= 20) return "text-success"
  if (minutes <= 60) return "text-info"
  if (minutes <= 240) return "text-warning"
  return "text-destructive"
}

export function AwaitingTable({ rows }: { rows: AwaitingBillRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Awaiting Final Bill</CardTitle>
        <CardDescription>
          {rows.length} patient{rows.length === 1 ? "" : "s"} · oldest MGH tags first · top 200
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
                <TableHead>Waiting</TableHead>
                <TableHead className="text-right">Running Bill</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No patients awaiting final bill in this range.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.PK_psPatRegisters}>
                    <TableCell>
                      <p className="font-medium text-foreground">{row.PatientName || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.PatientType || "—"}
                        {row.MGHNo ? ` · MGH #${row.MGHNo}` : ""}
                        {row.ReTagged === 1 ? " · re-tagged" : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.RoomNo || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {fullDateTime(row.MghDateTagged)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "font-mono font-medium tabular-nums",
                          waitingColor(row.WaitingMinutes)
                        )}
                      >
                        {formatMinutes(row.WaitingMinutes)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrency(row.RunningBill)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
