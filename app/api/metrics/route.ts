import { NextResponse } from "next/server"
import { getCurrentSnapshot } from "@/lib/live-store"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ success: true, snapshot: getCurrentSnapshot() })
}
