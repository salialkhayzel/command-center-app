import { getDb } from "@/lib/db"

export const RVS_77_EXCLUSION = `NOT EXISTS (
        SELECT 1 FROM psPHICXmlClaims x
        WHERE x.FK_ASUReg = a.FK_ASURegistry
          AND (LEFT(ISNULL(x.icdCode1,''),2)='77' OR LEFT(ISNULL(x.icdCode2,''),2)='77'
            OR LEFT(ISNULL(x.rvsCode1,''),2)='77' OR LEFT(ISNULL(x.rvsCode2,''),2)='77'))`

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function todayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

export function daysAgoUtc(days: number): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - days))
}

export function parseDateParam(value: string | null, fallback: Date): Date {
  if (!value || !DATE_RE.test(value)) return fallback
  const [y, m, d] = value.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  if (Number.isNaN(date.getTime())) return fallback
  return date
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function parsePositiveInt(value: string | null, fallback: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(Math.floor(n), max)
}

export { getDb }
