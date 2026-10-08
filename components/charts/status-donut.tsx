"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartTooltipContent } from "@/components/charts/chart-tooltip"
import type { MetricSnapshot } from "@/lib/metrics"

export function StatusDonut({ snapshot }: { snapshot: MetricSnapshot }) {
  const data = [
    { name: "On Track", value: snapshot.onTrack, color: "hsl(var(--success))" },
    { name: "Delayed", value: snapshot.delayed, color: "hsl(var(--warning))" },
    { name: "Critical", value: snapshot.critical, color: "hsl(var(--destructive))" },
  ]

  const total = snapshot.queue.length

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Queue Health</CardTitle>
        <CardDescription>Status of active discharge patients</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <div className="relative mx-auto h-[210px] w-full max-w-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<ChartTooltipContent />} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="68%"
                outerRadius="92%"
                paddingAngle={4}
                cornerRadius={6}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-bold tabular-nums">{total}</p>
            <p className="text-xs text-muted-foreground">in queue</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {data.map((entry) => (
            <div key={entry.name} className="rounded-lg border bg-muted/40 px-3 py-2 text-center">
              <p className="text-lg font-semibold tabular-nums">{entry.value}</p>
              <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: entry.color }} />
                {entry.name}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
