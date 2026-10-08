import { NextResponse } from "next/server"
import { getDb } from "@/lib/his"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { pool } = await getDb()
    const result = await pool.request().query("SELECT 1 as test")
    return NextResponse.json({ success: true, result: result.recordset[0], at: new Date().toISOString() })
  } catch (err) {
    console.error("DB test error:", err)
    return NextResponse.json({ success: false, error: "Database connection failed" }, { status: 500 })
  }
}
