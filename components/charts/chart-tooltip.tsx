"use client"

import type { TooltipProps } from "recharts"

interface ChartTooltipContentProps extends TooltipProps<number, string> {
  formatter?: (value: number, name: string) => string
}

export function ChartTooltipContent({ active, payload, label, formatter }: ChartTooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="min-w-[10rem] rounded-lg border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      {label !== undefined ? (
        <p className="mb-1.5 font-semibold text-popover-foreground">{label}</p>
      ) : null}
      <div className="space-y-1">
        {payload.map((item, index) => (
          <div key={`${item.dataKey}-${index}`} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: item.color || "hsl(var(--chart-2))" }}
              />
              {item.name}
            </span>
            <span className="font-mono font-semibold tabular-nums text-popover-foreground">
              {formatter
                ? formatter(Number(item.value), String(item.name))
                : Number(item.value).toLocaleString("en-PH")}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
