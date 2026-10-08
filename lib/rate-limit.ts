type Entry = { count: number; resetAt: number }

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const MAX_KEYS = 5000

const attempts = new Map<string, Entry>()

function prune(now: number) {
  if (attempts.size <= MAX_KEYS) return
  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(key)
  }
}

export function checkLoginRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  prune(now)

  const entry = attempts.get(key)
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) }
  }

  entry.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}

export function resetLoginRateLimit(key: string): void {
  attempts.delete(key)
}
