"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, ClipboardList } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatMinutes, formatNumber } from "@/lib/utils"
import type { ClearanceListResponse } from "@/lib/clearance-types"

const REFRESH_MS = 60_000

export function ClearanceTile() {
  const [summary, setSummary] = useState<ClearanceListResponse["summary"] | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/clearance?summary=1", { cache: "no-store" })
      const json = await res.json()
      if (res.ok && json.success && json.summary) {
        setSummary(json.summary as ClearanceListResponse["summary"])
      }
    } catch {
      // keep last values
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const overdue = summary?.overdue ?? 0

  return (
    <Link href="/clearance" className="block">
      <Card className="transition-colors hover:bg-accent/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Patient Clearance</p>
              <p className="text-xs text-muted-foreground">
                Discharge clearance pipeline · MGH notify to paid
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-muted-foreground">In progress</p>
              <p className="text-xl font-bold tabular-nums">
                {summary ? formatNumber(summary.inProgress) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Over target</p>
              <p className={cn("text-xl font-bold tabular-nums", overdue > 0 && "text-destructive")}>
                {summary ? formatNumber(overdue) : "—"}
              </p>
            </div>
            <div className="hidden sm:block">
              <p className="text-xs text-muted-foreground">Avg clearance (7d)</p>
              <p className="text-xl font-bold tabular-nums">
                {summary?.avgClearanceMinutes7d === null || summary?.avgClearanceMinutes7d === undefined
                  ? "—"
                  : formatMinutes(summary.avgClearanceMinutes7d)}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
