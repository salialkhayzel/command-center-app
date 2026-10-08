"use client"

import { useEffect, useState } from "react"
import { cn, formatTime } from "@/lib/utils"

export function LiveStatus({ connected, updatedAt }: { connected: boolean; updatedAt?: string }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeLabel = now
    ? now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--"

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
          connected
            ? "border-success/30 bg-success/10 text-success"
            : "border-border bg-muted text-muted-foreground"
        )}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              connected ? "bg-success" : "bg-muted-foreground"
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-1.5 w-1.5 rounded-full",
              connected ? "bg-success" : "bg-muted-foreground"
            )}
          />
        </span>
        {connected ? "Live" : "Reconnecting"}
      </div>

      <div className="hidden text-right sm:block">
        <p className="font-mono text-sm font-semibold tabular-nums text-foreground">{timeLabel}</p>
        {updatedAt ? (
          <p className="text-[11px] text-muted-foreground">Updated {formatTime(updatedAt)}</p>
        ) : null}
      </div>
    </div>
  )
}
