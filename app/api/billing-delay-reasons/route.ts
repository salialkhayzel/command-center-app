import { NextRequest } from "next/server"
import sql from "mssql"
import { authenticateRequest } from "@/lib/auth"
import { errorResponse, successResponse, validationErrorResponse } from "@/lib/api-response"

export const dynamic = "force-dynamic"

let billingPool: sql.ConnectionPool | null = null

async function getBillingPool() {
  if (!billingPool) {
    billingPool = await new sql.ConnectionPool({
      server: process.env.DB_SERVER || "",
      database: process.env.BILLING_DB_DATABASE || process.env.DB_DATABASE || "",
      user: process.env.DB_USER || "",
      password: process.env.DB_PASSWORD || "",
      options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 },
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    }).connect()
  }
  return billingPool
}

function parseIds(raw: string | null): number[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
    .slice(0, 2000)
}

export async function GET(request: NextRequest) {
  try {
    const ids = parseIds(request.nextUrl.searchParams.get("ids"))
    if (ids.length === 0) {
      return successResponse({ reasons: [] })
    }

    const pool = await getBillingPool()
    const req = pool.request()
    const placeholders = ids.map((id, index) => {
      req.input(`id${index}`, sql.Int, id)
      return `@id${index}`
    })

    const result = await req.query(`
      SELECT FK_psPatRegisters, Reason, CreatedBy, DateCreated
      FROM BillingDelayReasons
      WHERE FK_psPatRegisters IN (${placeholders.join(",")})`)

    return successResponse({ reasons: result.recordset })
  } catch (err) {
    console.error("Delay reasons fetch error:", err)
    return errorResponse("Failed to load delay reasons")
  }
}

async function upsertReason(request: NextRequest) {
  const payload = authenticateRequest(request)
  let body: { registryId?: number; reason?: string }
  try {
    body = await request.json()
  } catch {
    return validationErrorResponse([{ path: "body", message: "Invalid JSON body" }])
  }

  const registryId = Number(body.registryId)
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""

  if (!Number.isInteger(registryId) || registryId <= 0) {
    return validationErrorResponse([{ path: "registryId", message: "registryId must be a positive integer" }])
  }
  if (reason.length === 0 || reason.length > 500) {
    return validationErrorResponse([{ path: "reason", message: "reason must be 1-500 characters" }])
  }

  try {
    const pool = await getBillingPool()
    const createdBy = payload?.empno || "unknown"

    const existing = await pool
      .request()
      .input("registryId", sql.Int, registryId)
      .query(`SELECT PK_BillingDelayReason FROM BillingDelayReasons WHERE FK_psPatRegisters = @registryId`)

    if (existing.recordset.length > 0) {
      await pool
        .request()
        .input("registryId", sql.Int, registryId)
        .input("reason", sql.NVarChar(500), reason)
        .input("createdBy", sql.NVarChar(50), createdBy)
        .query(`
          UPDATE BillingDelayReasons
          SET Reason = @reason, CreatedBy = @createdBy, DateCreated = GETDATE()
          WHERE FK_psPatRegisters = @registryId`)
      return successResponse({ action: "updated", registryId })
    }

    await pool
      .request()
      .input("registryId", sql.Int, registryId)
      .input("reason", sql.NVarChar(500), reason)
      .input("createdBy", sql.NVarChar(50), createdBy)
      .query(`
        INSERT INTO BillingDelayReasons (FK_psPatRegisters, Reason, CreatedBy, DateCreated)
        VALUES (@registryId, @reason, @createdBy, GETDATE())`)
    return successResponse({ action: "inserted", registryId })
  } catch (err) {
    console.error("Delay reason save error:", err)
    return errorResponse("Failed to save delay reason")
  }
}

export async function POST(request: NextRequest) {
  return upsertReason(request)
}

export async function PUT(request: NextRequest) {
  return upsertReason(request)
}
