"use client"

import { AlertTriangle, BadgeCheck, Banknote, CheckCircle2, Clock3, Hourglass, ListChecks, Timer } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatMinutes, formatNumber } from "@/lib/utils"
import type { BillingTatCounts, BillingTatSummary } from "@/lib/billing-tat-types"

interface BillingSummaryCardsProps {
  summary: BillingTatSummary
  counts: BillingTatCounts
}

export function BillingSummaryCards({ summary, counts }: BillingSummaryCardsProps) {
  const withinRate =
    summary.withFinalBill > 0 ? Math.round((summary.withinTarget / summary.withFinalBill) * 100) : 0

  const cards = [
    {
      label: "Total Tagged",
      value: formatNumber(summary.totalTagged),
      hint: `${formatNumber(counts.completedTotal)} completed bills`,
      icon: ListChecks,
      accent: "text-info",
    },
    {
      label: "Awaiting Final Bill",
      value: formatNumber(summary.awaitingFinalBill),
      hint: "currently waiting for final bill",
      icon: Hourglass,
      accent: summary.awaitingFinalBill > 0 ? "text-warning" : "text-success",
    },
    {
      label: "Within Target",
      value: formatNumber(summary.withinTarget),
      hint: `${withinRate}% of completed · ≤ 20 min`,
      icon: CheckCircle2,
      accent: "text-success",
    },
    {
      label: "Over Target",
      value: formatNumber(summary.overTarget),
      hint: "completed beyond 20 min",
      icon: AlertTriangle,
      accent: summary.overTarget > 0 ? "text-destructive" : "text-muted-foreground",
    },
    {
      label: "Avg TAT",
      value: summary.avgTatMinutes === null ? "—" : formatMinutes(summary.avgTatMinutes),
      hint: "MGH tag → final bill",
      icon: Timer,
      accent: "text-primary",
    },
    {
      label: "Max TAT",
      value: summary.maxTatMinutes === null ? "—" : formatMinutes(summary.maxTatMinutes),
      hint: "longest completed TAT",
      icon: Clock3,
      accent: "text-chart-4",
    },
    {
      label: "Paid",
      value: formatNumber(counts.paid),
      hint: "completed bills fully paid",
      icon: BadgeCheck,
      accent: "text-success",
    },
    {
      label: "Unpaid",
      value: formatNumber(counts.unpaid),
      hint: "completed bills with balance",
      icon: Banknote,
      accent: counts.unpaid > 0 ? "text-warning" : "text-muted-foreground",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="relative overflow-hidden">
          <CardContent className="flex items-start justify-between p-5">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {card.label}
              </p>
              <p className="text-2xl font-bold tabular-nums tracking-tight">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.hint}</p>
            </div>
            <div className="rounded-lg bg-muted p-2.5">
              <card.icon className={cn("h-5 w-5", card.accent)} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
