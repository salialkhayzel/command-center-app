import { Badge } from "@/components/ui/badge"
import { BillingTatMonitor } from "@/components/billing/billing-tat-monitor"

export default function BillingTatPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing TAT Monitor</h1>
          <p className="text-sm text-muted-foreground">
            MGH tag to final bill turnaround · 20-minute target · source: HIS LiveDB
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-xs text-muted-foreground">
          Auto-refresh every 60s
        </Badge>
      </div>

      <BillingTatMonitor />
    </div>
  )
}
