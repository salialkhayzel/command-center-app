"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartTooltipContent } from "@/components/charts/chart-tooltip"
import type { MetricSnapshot } from "@/lib/metrics"

const TARGET_MINUTES = 240

export function TatTrendChart({ snapshot }: { snapshot: MetricSnapshot }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">Total TAT Trend</CardTitle>
            <CardDescription>Rolling average across all stages (15-min intervals)</CardDescription>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-0.5 w-4 rounded bg-warning" />
            Target 4h
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={snapshot.trend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="tatFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[120, 400]}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickFormatter={(value: number) => `${Math.round(value / 60)}h`}
              />
              <Tooltip
                content={
                  <ChartTooltipContent formatter={(value) => `${Math.round(value / 60)}h ${value % 60}m`} />
                }
              />
              <ReferenceLine
                y={TARGET_MINUTES}
                stroke="hsl(var(--warning))"
                strokeDasharray="4 4"
                strokeOpacity={0.7}
              />
              <Area
                type="monotone"
                dataKey="avgMinutes"
                name="Avg TAT"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2.5}
                fill="url(#tatFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
