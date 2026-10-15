"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { SummaryCards } from "@/components/charts/summary-cards"
import { StageCards } from "@/components/charts/stage-cards"
import { BottleneckChart } from "@/components/charts/bottleneck-chart"
import { ComplianceChart } from "@/components/charts/compliance-chart"
import { BedManagementChart } from "@/components/charts/bed-management-chart"
import { PendingByStageChart } from "@/components/charts/pending-by-stage-chart"
import { ExecutiveOverview } from "@/components/charts/executive-overview"
import { DoctorApprovalTable } from "@/components/doctor-approval-table"
import { DeptClearanceTable } from "@/components/dept-clearance-table"
import { BillingCashierTable } from "@/components/billing-cashier-table"
import { OnTrackTable } from "@/components/on-track-table"
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
          <ComplianceChart />
          <BottleneckChart />
          <ExecutiveOverview />
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <PendingByStageChart snapshot={snapshot} />
          <div className="xl:col-span-2">
            <BedManagementChart />
          </div>
        </div>
      </section>

      <section id="doctor-approval" className="scroll-mt-24">
        <DoctorApprovalTable />
      </section>

      <section id="nursing-clearance" className="scroll-mt-24">
        <DeptClearanceTable
          title="Live Nursing Clearance Queue"
          description="Patients not yet cleared for MGH clearance by nursing departments"
          endpoint="/api/nursing-clearance"
          emptyLabel="All nursing clearances completed — no pending patients."
        />
      </section>

      <section id="ancillary-clearance" className="scroll-mt-24">
        <DeptClearanceTable
          title="Live Ancillary Clearance Queue"
          description="Patients not yet cleared by ancillary departments (lab, imaging, chemo, dialysis)"
          endpoint="/api/ancillary-clearance"
          emptyLabel="All ancillary clearances completed — no pending patients."
        />
      </section>

      <section id="pharmacy-clearance" className="scroll-mt-24">
        <DeptClearanceTable
          title="Live Pharmacy Clearance Queue"
          description="Patients not yet cleared by Pharmacy — Main"
          endpoint="/api/pharmacy-clearance"
          emptyLabel="All pharmacy clearances completed — no pending patients."
        />
      </section>

      <section id="billing-cashier" className="scroll-mt-24">
        <BillingCashierTable />
      </section>

      <section id="ontrack" className="scroll-mt-24">
        <OnTrackTable />
      </section>
    </div>
  )
}
