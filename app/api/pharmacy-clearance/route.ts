import { successResponse, errorResponse } from "@/lib/api-response"
import { fetchPendingDeptClearances, PHARMACY_WAREHOUSE_IDS } from "@/lib/dept-clearance-live"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const rows = await fetchPendingDeptClearances(PHARMACY_WAREHOUSE_IDS)
    return successResponse({ count: rows.length, rows })
  } catch (err) {
    console.error("Pharmacy clearance queue error:", err)
    return errorResponse("Failed to load pharmacy clearance queue")
  }
}
