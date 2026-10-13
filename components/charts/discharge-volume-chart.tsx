"use client"

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChartTooltipContent } from "@/components/charts/chart-tooltip"
import type { MetricSnapshot } from "@/lib/metrics"

export function DischargeVolumeChart({ snapshot }: { snapshot: MetricSnapshot }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Discharge Volume vs Turnaround</CardTitle>
            <CardDescription>Hourly completed discharges and average TAT</CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "hsl(var(--chart-2))" }} />
              Discharges
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(var(--chart-1))" }} />
              Avg TAT
            </span>
            <Badge variant="secondary" className="text-[10px]">Last 12h</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={snapshot.hourly} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="count"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="minutes"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(value: number) => `${value}m`}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.6)" }}
                content={
                  <ChartTooltipContent
                    formatter={(value, name) =>
                      name === "Discharges" ? String(value) : `${value}m`
                    }
                  />
                }
              />
              <Bar
                yAxisId="count"
                dataKey="discharges"
                name="Discharges"
                fill="hsl(var(--chart-2))"
                radius={[6, 6, 0, 0]}
                maxBarSize={26}
              />
              <Line
                yAxisId="minutes"
                type="monotone"
                dataKey="avgMinutes"
                name="Avg TAT"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
