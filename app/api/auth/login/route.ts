import { NextRequest } from "next/server"
import crypto from "crypto"
import { z } from "zod"
import type { RowDataPacket } from "mysql2"
import { signToken } from "@/lib/auth"
import { checkLoginRateLimit, resetLoginRateLimit } from "@/lib/rate-limit"
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api-response"

const loginSchema = z.object({
  empno: z.string().min(1, "Employee number is required").max(100),
  password: z.string().min(1, "Password is required").max(200),
})

const DEV_MOCK_USERS = [
  { empno: "admin", password: "admin", full_name: "Admin User", department: "Information Technology", section: "IT", position: "System Administrator" },
]

function passwordHash(value: string): string {
  const keycode = process.env.PASSWORD_HASH_KEY || "w3s+m3+r0_h45h1ng_c0d3"
  const len = value.length
  const low = value.toLowerCase()
  const up = value.toUpperCase()
  const salted =
    keycode + up + keycode + low + keycode + len + keycode + value + keycode + len + keycode + low + keycode + up + keycode
  return crypto.createHash("md5").update(salted).digest("hex")
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

interface LoginRow extends RowDataPacket {
  empno: string
  emppass: string | null
  full_name: string | null
  department: string | null
  section: string | null
  position: string | null
}

function clientKey(request: NextRequest, empno: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const ip = forwarded || request.headers.get("x-real-ip") || "direct"
  return `${empno.toLowerCase()}|${ip}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(
        parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      )
    }

    const { empno, password } = parsed.data

    const rateKey = clientKey(request, empno)
    const limit = checkLoginRateLimit(rateKey)
    if (!limit.allowed) {
      return errorResponse(
        `Too many failed attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
        429
      )
    }

    let dbUser: {
      empno: string
      full_name: string | null
      department: string | null
      section: string | null
      position: string | null
    } | null = null

    let failureReason = "user not found"
    let dbUnreachable = false

    try {
      const { getMysqlDb } = await import("@/lib/db-mysql")
      const mysqlPool = await getMysqlDb()
      const [rows] = await mysqlPool.query<LoginRow[]>(
        `SELECT u.empno, u.emppass, CONCAT(e.gname, ' ', e.lname) as full_name, e.department, e.section, e.position
         FROM user u
         LEFT JOIN employees e ON u.empno = e.empno
         WHERE u.empno = ?`,
        [empno]
      )

      if (rows.length > 0) {
        const user = rows[0]
        const hashedPassword = passwordHash(password)
        if (safeEqual(String(user.emppass || ""), hashedPassword)) {
          dbUser = user
        } else {
          failureReason = "password mismatch"
        }
      }
    } catch (dbErr) {
      console.error("Login DB error:", dbErr)
      dbUnreachable = true
      if (process.env.NODE_ENV !== "production") {
        const mockUser = DEV_MOCK_USERS.find(
          (user) => user.empno === empno && user.password === password
        )
        if (mockUser) {
          dbUser = mockUser
        }
      }
    }

    if (!dbUser) {
      console.error(
        `Login failed for empno=${empno}: ${dbUnreachable ? "database unreachable (check .env and network)" : failureReason}`
      )
      return errorResponse("Invalid employee number or password", 401)
    }

    resetLoginRateLimit(rateKey)

    const token = signToken({
      empno: dbUser.empno,
      displayName: dbUser.full_name || dbUser.empno,
      department: dbUser.department || "",
      section: dbUser.section || "",
      jobTitle: dbUser.position || "",
    })

    return successResponse({
      authenticated: true,
      token,
      user: {
        empno: dbUser.empno,
        displayName: dbUser.full_name || dbUser.empno,
        department: dbUser.department || "",
        section: dbUser.section || "",
        jobTitle: dbUser.position || "",
      },
    })
  } catch (err) {
    console.error("Login error:", err)
    return errorResponse("Authentication failed")
  }
}
