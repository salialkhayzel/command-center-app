import { successResponse, errorResponse } from "@/lib/api-response"
import { ANCILLARY_WAREHOUSE_IDS, fetchPendingDeptClearances } from "@/lib/dept-clearance-live"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rows = await fetchPendingDeptClearances(ANCILLARY_WAREHOUSE_IDS)
    return successResponse({ count: rows.length, rows })
  } catch (err) {
    console.error("Ancillary clearance queue error:", err)
    return errorResponse("Failed to load ancillary clearance queue")
  }
}
