"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, formatNumber } from "@/lib/utils"
import type { BillingTatSummary } from "@/lib/billing-tat-types"

export function WaitingBuckets({ summary }: { summary: BillingTatSummary }) {
  const buckets = [
    { label: "0–20 min", value: summary.waiting_0_20, accent: "text-success", bar: "bg-success" },
    { label: "20–60 min", value: summary.waiting_20_60, accent: "text-info", bar: "bg-info" },
    { label: "1–4 hours", value: summary.waiting_1_4h, accent: "text-warning", bar: "bg-warning" },
    { label: "Over 4 hours", value: summary.waiting_4h, accent: "text-destructive", bar: "bg-destructive" },
  ]

  const max = Math.max(1, ...buckets.map((bucket) => bucket.value))

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Waiting Time Buckets</CardTitle>
        <CardDescription>Patients tagged but awaiting final bill, by time since MGH tag</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {buckets.map((bucket) => (
            <div key={bucket.label} className="space-y-2 rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {bucket.label}
              </p>
              <p className={cn("text-2xl font-bold tabular-nums", bucket.accent)}>
                {formatNumber(bucket.value)}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", bucket.bar)}
                  style={{ width: `${Math.round((bucket.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
