"use client"

import { useMemo, useState } from "react"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn, formatMinutes } from "@/lib/utils"
import type { DischargeStatus, MetricSnapshot, QueueRow, StageKey } from "@/lib/metrics"

const STAGE_LABELS: Record<StageKey, string> = {
  doctor_approval: "Doctor Approval",
  nursing: "Nursing",
  ancillary: "Ancillary",
  pharmacy: "Pharmacy",
  billing: "Billing",
}

const STATUS_STYLES: Record<DischargeStatus, string> = {
  "on-track": "bg-success/10 text-success border-success/20",
  delayed: "bg-warning/10 text-warning border-warning/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
}

const STATUS_LABELS: Record<DischargeStatus, string> = {
  "on-track": "On Track",
  delayed: "Delayed",
  critical: "Critical",
}

type Filter = "all" | DischargeStatus

export function QueueTable({ snapshot }: { snapshot: MetricSnapshot }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "elapsedMinutes", desc: true }])
  const [filter, setFilter] = useState<Filter>("all")

  const data = useMemo(
    () => (filter === "all" ? snapshot.queue : snapshot.queue.filter((row) => row.status === filter)),
    [snapshot.queue, filter]
  )

  const columns = useMemo<ColumnDef<QueueRow>[]>(
    () => [
      {
        accessorKey: "patientName",
        header: "Patient",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.patientName}</p>
            <p className="text-xs text-muted-foreground">{row.original.patientId}</p>
          </div>
        ),
      },
      {
        accessorKey: "ward",
        header: "Ward",
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "stage",
        header: "Current Stage",
        cell: ({ getValue }) => STAGE_LABELS[getValue<StageKey>()],
      },
      {
        accessorKey: "elapsedMinutes",
        header: "Elapsed",
        cell: ({ getValue }) => (
          <span className="font-mono font-medium tabular-nums">
            {formatMinutes(getValue<number>())}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => {
          const status = getValue<DischargeStatus>()
          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                STATUS_STYLES[status]
              )}
            >
              {STATUS_LABELS[status]}
            </span>
          )
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Live Discharge Queue</CardTitle>
            <CardDescription>
              {data.length} patient{data.length === 1 ? "" : "s"} shown
            </CardDescription>
          </div>
          <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="on-track" className="text-xs">On Track</TabsTrigger>
              <TabsTrigger value="delayed" className="text-xs">Delayed</TabsTrigger>
              <TabsTrigger value="critical" className="text-xs">Critical</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1 transition-colors",
                          header.column.getCanSort() && "hover:text-foreground"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() ? (
                          header.column.getIsSorted() === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )
                        ) : null}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No patients in this status.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
