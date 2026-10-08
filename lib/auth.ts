import crypto from "crypto"
import jwt from "jsonwebtoken"

const isProduction = process.env.NODE_ENV === "production"
const envSecret = process.env.JWT_SECRET

if (isProduction && !envSecret) {
  console.error("[auth] JWT_SECRET is not set in production; using an ephemeral secret.")
}

const JWT_SECRET =
  envSecret || (isProduction ? crypto.randomBytes(32).toString("hex") : "fallback-dev-secret")

export interface JwtPayload {
  empno: string
  displayName: string
  department: string
  section: string
  jobTitle: string
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as JwtPayload
  } catch {
    return null
  }
}

export function getTokenFromHeader(request: Request): string | null {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null
  return authHeader.split(" ")[1]
}

export function authenticateRequest(request: Request): JwtPayload | null {
  const token = getTokenFromHeader(request)
  if (!token) return null
  return verifyToken(token)
}
