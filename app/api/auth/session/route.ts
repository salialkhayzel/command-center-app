import { NextRequest, NextResponse } from "next/server"
import { verifyToken, getTokenFromHeader } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const token = getTokenFromHeader(request)
  if (!token) {
    return NextResponse.json({ authenticated: false })
  }

  const payload = verifyToken(token)
  if (!payload) {
    return NextResponse.json({ authenticated: false, error: "Invalid or expired session" })
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      empno: payload.empno,
      displayName: payload.displayName,
      department: payload.department,
      section: payload.section,
      jobTitle: payload.jobTitle,
    },
  })
}
