import { getHeader, HttpError, type ApiRequest } from "./http.js"

type AttemptWindow = { count: number; resetAt: number }
const attempts = new Map<string, AttemptWindow>()

function clientAddress(req: ApiRequest) {
  return (getHeader(req.headers, "x-forwarded-for")?.split(",")[0] ?? req.socket?.remoteAddress ?? "unknown").trim()
}

export function enforceRateLimit(req: ApiRequest, bucket: string, limit: number, windowMs: number) {
  const now = Date.now()
  const key = `${bucket}:${clientAddress(req)}`
  const existing = attempts.get(key)
  if (!existing || existing.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  existing.count += 1
  if (existing.count > limit) {
    throw new HttpError(429, "Too many requests. Please wait and try again.")
  }

  if (attempts.size > 5_000) {
    for (const [attemptKey, attempt] of attempts) {
      if (attempt.resetAt <= now) attempts.delete(attemptKey)
    }
  }
}
