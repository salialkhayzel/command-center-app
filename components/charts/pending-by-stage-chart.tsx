"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartTooltipContent } from "@/components/charts/chart-tooltip"
import type { MetricSnapshot } from "@/lib/metrics"

export function PendingByStageChart({ snapshot }: { snapshot: MetricSnapshot }) {
  const data = snapshot.stages.map((stage) => ({
    name: stage.label,
    pending: stage.pending,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Waiting by Stage</CardTitle>
        <CardDescription>Patients currently pending at each checkpoint</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={118}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
              <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.6)" }} content={<ChartTooltipContent />} />
              <Bar
                dataKey="pending"
                name="Waiting"
                fill="hsl(var(--chart-3))"
                radius={[0, 6, 6, 0]}
                maxBarSize={18}
              >
                <LabelList
                  dataKey="pending"
                  position="right"
                  style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
