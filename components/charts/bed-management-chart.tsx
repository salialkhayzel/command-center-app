"use client"

import { useCallback, useEffect, useState } from "react"
import {
  BedDouble,
  Building2,
  CheckCircle2,
  DoorClosed,
  Hammer,
  Hash,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, formatNumber } from "@/lib/utils"

const REFRESH_MS = 60_000

interface BedManagementData {
  rooms: {
    total: number
    available: number
    renovation: number
    fullyOccupied: number
    notAvailable: number
  }
  beds: {
    total: number
    available: number
    occupied: number
    cleaning: number
    forRepair: number
    inactive: number
  }
}

interface Tile {
  label: string
  value: number | null
  hint: string
  icon: LucideIcon
  accent: string
}

function StatTile({ tile }: { tile: Tile }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {tile.label}
        </p>
        <p className="text-2xl font-bold tabular-nums tracking-tight">
          {tile.value === null ? "—" : formatNumber(tile.value)}
        </p>
        <p className="text-[11px] leading-tight text-muted-foreground">{tile.hint}</p>
      </div>
      <div className="rounded-lg bg-muted p-2">
        <tile.icon className={cn("h-4 w-4", tile.accent)} />
      </div>
    </div>
  )
}

export function BedManagementChart() {
  const [data, setData] = useState<BedManagementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch("/api/beds", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || "Request failed")
      setData({ rooms: json.rooms, beds: json.beds })
      setError(null)
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bed management data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const roomTiles: Tile[] = [
    {
      label: "Total Rooms",
      value: data?.rooms.total ?? null,
      hint: data ? `${formatNumber(data.rooms.notAvailable)} not available` : "",
      icon: Building2,
      accent: "text-muted-foreground",
    },
    {
      label: "Available Rooms",
      value: data?.rooms.available ?? null,
      hint: "ready for admission",
      icon: CheckCircle2,
      accent: "text-success",
    },
    {
      label: "For Renovation",
      value: data?.rooms.renovation ?? null,
      hint: "under renovation",
      icon: Hammer,
      accent: (data?.rooms.renovation ?? 0) > 0 ? "text-warning" : "text-muted-foreground",
    },
    {
      label: "Fully Occupied",
      value: data?.rooms.fullyOccupied ?? null,
      hint: "all beds in use",
      icon: DoorClosed,
      accent: "text-primary",
    },
  ]

  const bedTiles: Tile[] = [
    {
      label: "Total Beds",
      value: data?.beds.total ?? null,
      hint: data ? `${formatNumber(data.beds.inactive)} inactive` : "",
      icon: Hash,
      accent: "text-muted-foreground",
    },
    {
      label: "Available Beds",
      value: data?.beds.available ?? null,
      hint: "ready for admission",
      icon: CheckCircle2,
      accent: "text-success",
    },
    {
      label: "Occupied Beds",
      value: data?.beds.occupied ?? null,
      hint: "patients currently admitted",
      icon: BedDouble,
      accent: "text-primary",
    },
    {
      label: "For Cleaning",
      value: data?.beds.cleaning ?? null,
      hint: "housekeeping in progress",
      icon: Sparkles,
      accent: (data?.beds.cleaning ?? 0) > 0 ? "text-warning" : "text-muted-foreground",
    },
    {
      label: "For Repair",
      value: data?.beds.forRepair ?? null,
      hint: "under maintenance",
      icon: Wrench,
      accent: (data?.beds.forRepair ?? 0) > 0 ? "text-destructive" : "text-muted-foreground",
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Bed Management · Live</CardTitle>
            <CardDescription>
              Real-time room and bed status across all nursing stations · source: HIS
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {updatedAt ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Updated{" "}
                {updatedAt.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => load()} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Rooms
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {roomTiles.map((tile) => (
              <StatTile key={tile.label} tile={tile} />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Beds
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {bedTiles.map((tile) => (
              <StatTile key={tile.label} tile={tile} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
