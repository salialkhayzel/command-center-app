"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SummaryCards } from "@/components/charts/summary-cards"
import { StageCards } from "@/components/charts/stage-cards"
import { DischargeVolumeChart } from "@/components/charts/discharge-volume-chart"
import { StatusDonut } from "@/components/charts/status-donut"
import { TatTrendChart } from "@/components/charts/tat-trend-chart"
import { PendingByStageChart } from "@/components/charts/pending-by-stage-chart"
import { QueueTable } from "@/components/queue-table"
import { useLiveMetricsContext } from "@/lib/live-metrics-context"

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-1.5 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-52" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[260px] w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function OverviewPage() {
  const { snapshot } = useLiveMetricsContext()

  if (!snapshot) {
    return <OverviewSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Overview</h1>
          <p className="text-sm text-muted-foreground">
            Real-time discharge turnaround across all departments
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-xs text-muted-foreground">
          Auto-refresh every 10s
        </Badge>
      </div>

      <section id="overview" className="scroll-mt-24">
        <SummaryCards snapshot={snapshot} />
      </section>

      <section id="stages" className="scroll-mt-24 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Stage Performance
        </h2>
        <StageCards snapshot={snapshot} />
      </section>

      <section id="trends" className="scroll-mt-24 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Trends &amp; Analytics
        </h2>
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <DischargeVolumeChart snapshot={snapshot} />
          </div>
          <StatusDonut snapshot={snapshot} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <TatTrendChart snapshot={snapshot} />
          <PendingByStageChart snapshot={snapshot} />
        </div>
      </section>

      <section id="queue" className="scroll-mt-24">
        <QueueTable snapshot={snapshot} />
      </section>
    </div>
  )
}
