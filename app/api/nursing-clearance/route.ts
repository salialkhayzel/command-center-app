import { successResponse, errorResponse } from "@/lib/api-response"
import { fetchPendingDeptClearances, NURSING_WAREHOUSE_IDS } from "@/lib/dept-clearance-live"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rows = await fetchPendingDeptClearances(NURSING_WAREHOUSE_IDS)
    return successResponse({ count: rows.length, rows })
  } catch (err) {
    console.error("Nursing clearance queue error:", err)
    return errorResponse("Failed to load nursing clearance queue")
  }
}
