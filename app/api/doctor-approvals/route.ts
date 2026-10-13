import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api-response"
import { getDoctorApprovals } from "@/lib/clearance"
import { parsePositiveInt } from "@/lib/his"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const tab = params.get("tab") === "replied" ? "replied" : "pending"
    const page = parsePositiveInt(params.get("page"), 1, 10000)
    const data = await getDoctorApprovals(tab, page, 10)
    return successResponse(data)
  } catch (err) {
    console.error("Doctor approvals error:", err)
    return errorResponse("Failed to load doctor approvals")
  }
}
