import { Badge } from "@/components/ui/badge"
import { ClearanceMonitor } from "@/components/clearance/clearance-monitor"

export default function ClearancePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patient Clearance Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Discharge clearance pipeline · MGH notify to paid · source: WMMCHIS
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 text-xs text-muted-foreground">
          Auto-refresh every 60s
        </Badge>
      </div>
      <ClearanceMonitor />
    </div>
  )
}
