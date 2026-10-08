"use client"

import {
  BedDouble,
  FlaskConical,
  Pill,
  Receipt,
  Stethoscope,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn, formatMinutes } from "@/lib/utils"
import type { MetricSnapshot, StageKey } from "@/lib/metrics"

const STAGE_META: Record<StageKey, { icon: LucideIcon; target: number }> = {
  doctor_approval: { icon: Stethoscope, target: 60 },
  nursing: { icon: BedDouble, target: 90 },
  ancillary: { icon: FlaskConical, target: 90 },
  pharmacy: { icon: Pill, target: 60 },
  billing: { icon: Receipt, target: 60 },
}

export function StageCards({ snapshot }: { snapshot: MetricSnapshot }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {snapshot.stages.map((stage) => {
        const meta = STAGE_META[stage.key]
        const Icon = meta.icon
        const diff = stage.avgMinutes - stage.prevAvgMinutes
        const improving = diff <= 0
        const load = Math.min(100, Math.round((stage.avgMinutes / meta.target) * 100))
        const overTarget = stage.avgMinutes > meta.target

        return (
          <Card key={stage.key} className="relative overflow-hidden">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{stage.label}</p>
                </div>
                <span
                  className={cn(
                    "flex items-center gap-1 text-xs font-semibold tabular-nums",
                    improving ? "text-success" : "text-destructive"
                  )}
                >
                  {improving ? (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingUp className="h-3.5 w-3.5" />
                  )}
                  {Math.abs(diff)}m
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold tabular-nums tracking-tight">
                  {formatMinutes(stage.avgMinutes)}
                </p>
                <p className="text-xs text-muted-foreground">avg · target {meta.target}m</p>
              </div>

              <div className="space-y-1.5">
                <Progress
                  value={load}
                  className={cn(
                    "h-1.5",
                    overTarget
                      ? "[&>div]:bg-destructive"
                      : load > 80
                        ? "[&>div]:bg-warning"
                        : "[&>div]:bg-success"
                  )}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{stage.pending} waiting</span>
                  <span>{stage.samples} today</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
