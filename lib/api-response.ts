import { NextResponse } from "next/server"

export function successResponse(data: unknown, status = 200) {
  return NextResponse.json({ success: true, ...(data as object) }, { status })
}

export function errorResponse(error: string, status = 500) {
  return NextResponse.json({ success: false, error }, { status })
}

export function unauthorizedResponse() {
  return NextResponse.json({ success: false, error: "Access denied" }, { status: 401 })
}

export function validationErrorResponse(errors: { path: string; message: string }[]) {
  return NextResponse.json(
    { success: false, error: "Validation failed", details: errors },
    { status: 400 }
  )
}
