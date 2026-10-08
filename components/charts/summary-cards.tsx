"use client"

import { Activity, CheckCircle2, Timer, Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatMinutes, formatNumber } from "@/lib/utils"
import type { MetricSnapshot } from "@/lib/metrics"

interface SummaryCardsProps {
  snapshot: MetricSnapshot
}

export function SummaryCards({ snapshot }: SummaryCardsProps) {
  const totalBase = snapshot.prevAvgTotalMinutes || 1
  const totalDelta = Math.round(((snapshot.avgTotalMinutes - snapshot.prevAvgTotalMinutes) / totalBase) * 100)
  const onTrackRate = Math.round((snapshot.onTrack / Math.max(1, snapshot.queue.length)) * 100)

  const cards = [
    {
      label: "Active Discharges",
      value: formatNumber(snapshot.activeDischarges),
      hint: "currently in process",
      icon: Users,
      accent: "text-info",
      delta: null as string | null,
      positive: true,
    },
    {
      label: "Completed Today",
      value: formatNumber(snapshot.completedToday),
      hint: "discharged patients",
      icon: CheckCircle2,
      accent: "text-success",
      delta: null as string | null,
      positive: true,
    },
    {
      label: "Avg Total TAT",
      value: formatMinutes(snapshot.avgTotalMinutes),
      hint: "sum of all stages",
      icon: Timer,
      accent: "text-chart-4",
      delta: `${totalDelta > 0 ? "+" : ""}${totalDelta}% vs baseline`,
      positive: totalDelta <= 0,
    },
    {
      label: "On Track",
      value: `${onTrackRate}%`,
      hint: `${snapshot.delayed} delayed · ${snapshot.critical} critical`,
      icon: Activity,
      accent: "text-warning",
      delta: null as string | null,
      positive: true,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="relative overflow-hidden">
          <CardContent className="flex items-start justify-between p-5">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {card.label}
              </p>
              <p className="text-2xl font-bold tabular-nums tracking-tight">{card.value}</p>
              {card.delta ? (
                <p
                  className={cn(
                    "text-xs font-medium",
                    card.positive ? "text-success" : "text-destructive"
                  )}
                >
                  {card.delta}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{card.hint}</p>
              )}
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
