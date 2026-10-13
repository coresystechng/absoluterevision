import { createHmac } from "node:crypto"
import { query } from "./db.js"
import { HttpError } from "./http.js"

export function verificationDigest(value: string) {
  const secret = process.env.SUBMISSION_EMAIL_SECRET
  if (!secret) throw new HttpError(503, "Email verification is temporarily unavailable. Please contact support.")
  return createHmac("sha256", secret).update(value).digest("hex")
}

/** Atomic database counters are shared across serverless instances. */
export async function enforceVerificationLimit(key: string, limit: number, windowMs: number) {
  const rows = await query<{ attempts: number }>(`
    INSERT INTO submission_verification_limits (key, attempts, started_at) VALUES ($1, 1, NOW())
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN submission_verification_limits.started_at <= NOW() - $2 * INTERVAL '1 millisecond'
        THEN 1 ELSE submission_verification_limits.attempts + 1 END,
      started_at = CASE WHEN submission_verification_limits.started_at <= NOW() - $2 * INTERVAL '1 millisecond'
        THEN NOW() ELSE submission_verification_limits.started_at END
    RETURNING attempts`, [verificationDigest(key), windowMs])
  if (rows[0].attempts > limit) throw new HttpError(429, "Too many verification requests. Please wait before trying again.")
}
