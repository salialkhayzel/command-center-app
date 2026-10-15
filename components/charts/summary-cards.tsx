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
  const completed = snapshot.onTrack + snapshot.delayed + snapshot.critical
  const onTrackRate = Math.round((snapshot.onTrack / Math.max(1, completed)) * 100)

  const cards = [
    {
      label: "Active Discharges",
      value: formatNumber(snapshot.activeDischarges),
      hint: "currently in process",
      icon: Users,
      accent: "text-info",
      valueClassName: null as string | null,
      delta: null as string | null,
      positive: true,
      targetId: null as string | null,
    },
    {
      label: "Final Bills Today",
      value: formatNumber(snapshot.completedToday),
      hint: "final bill tagged · awaiting billing discharge",
      icon: CheckCircle2,
      accent: "text-success",
      valueClassName: null as string | null,
      delta: null as string | null,
      positive: true,
      targetId: null as string | null,
    },
    {
      label: "Current Discharge TAT",
      value: formatMinutes(snapshot.avgTotalMinutes),
      hint: "MGH tag → billing discharge · target 3h",
      icon: Timer,
      accent: snapshot.avgTotalMinutes > 180 ? "text-destructive" : "text-primary",
      valueClassName: snapshot.avgTotalMinutes > 180 ? "text-destructive" : null,
      delta: `${totalDelta > 0 ? "+" : ""}${totalDelta}% vs yesterday`,
      positive: totalDelta <= 0,
      targetId: null as string | null,
    },
    {
      label: "On Track",
      value: `${onTrackRate}%`,
      hint: `${snapshot.delayed} delayed · ${snapshot.critical} critical`,
      icon: Activity,
      accent: "text-warning",
      valueClassName: null as string | null,
      delta: null as string | null,
      positive: true,
      targetId: "ontrack" as string | null,
    },
  ]

  const handleClick = (targetId: string | null) => {
    if (!targetId) return
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const clickable = Boolean(card.targetId)
        return (
          <Card
            key={card.label}
            onClick={() => handleClick(card.targetId)}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={(event) => {
              if (clickable && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault()
                handleClick(card.targetId)
              }
            }}
            className={cn(
              "relative overflow-hidden",
              clickable &&
                "cursor-pointer transition-all hover:border-primary/40 hover:bg-accent/40 hover:shadow-md"
            )}
          >
            <CardContent className="flex items-start justify-between p-5">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {card.label}
                </p>
                <p className={cn("text-2xl font-bold tabular-nums tracking-tight", card.valueClassName)}>
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground">{card.hint}</p>
                {card.delta ? (
                  <p
                    className={cn(
                      "text-xs font-medium",
                      card.positive ? "text-success" : "text-destructive"
                    )}
                  >
                    {card.delta}
                  </p>
                ) : null}
              </div>
              <div className="rounded-lg bg-muted p-2.5">
                <card.icon className={cn("h-5 w-5", card.accent)} />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
