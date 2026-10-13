"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { AwaitingTable } from "@/components/billing/awaiting-table"
import { CompletedTable } from "@/components/billing/completed-table"
import { BillingSummaryCards } from "@/components/billing/summary-cards"
import { WaitingBuckets } from "@/components/billing/waiting-buckets"
import type { BillingTatData, BillingTatResponse } from "@/lib/billing-tat-types"
import { cn, localToday, shiftDays } from "@/lib/utils"

const REFRESH_MS = 60_000

function BillingTatSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export function BillingTatMonitor() {
  const [from, setFrom] = useState(localToday)
  const [to, setTo] = useState(localToday)
  const [data, setData] = useState<BillingTatData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetch(`/api/billing-tat?from=${from}&to=${to}`, { cache: "no-store" })
        const json = (await res.json()) as BillingTatResponse
        if (!res.ok || !json.success || !json.summary) {
          throw new Error(json.error || "Request failed")
        }
        setData(json as BillingTatData)
        setError(null)
        setUpdatedAt(new Date())
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load billing TAT data")
      } finally {
        setLoading(false)
      }
    },
    [from, to]
  )

  useEffect(() => {
    load()
    const timer = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const applyPreset = (days: number) => {
    const today = localToday()
    setFrom(shiftDays(today, -days))
    setTo(today)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="billing-tat-from" className="text-xs">
            From
          </Label>
          <Input
            id="billing-tat-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-9 w-[150px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="billing-tat-to" className="text-xs">
            To
          </Label>
          <Input
            id="billing-tat-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-9 w-[150px]"
          />
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={() => applyPreset(0)}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset(6)}>
            7D
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyPreset(29)}>
            30D
          </Button>
        </div>
        <Button variant="secondary" size="sm" onClick={() => load()} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
        {updatedAt ? (
          <span className="pb-2 text-xs text-muted-foreground">
            Updated{" "}
            {updatedAt.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!data ? (
        <BillingTatSkeleton />
      ) : (
        <>
          <BillingSummaryCards summary={data.summary} counts={data.counts} />
          <WaitingBuckets summary={data.summary} />
          <AwaitingTable rows={data.awaiting} />
          <CompletedTable rows={data.completed} counts={data.counts} />
        </>
      )}
    </div>
  )
}
