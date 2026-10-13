import { enforceVerificationLimit, verificationDigest } from "./submission-verification.js"
import { randomBytes, randomInt, randomUUID, timingSafeEqual, createHash } from "node:crypto"
import nodemailer from "nodemailer"
import { initClientSubmissionsDb } from "./client-submissions.js"
import { query } from "./db.js"
import { getHeader, HttpError, type ApiRequest } from "./http.js"

function emailConfiguration() {
  const password = process.env.GMAIL_SMTP_APP_PASSWORD?.replace(/\s/g, "")
  const email = "coresystechng@gmail.com"
  if (!password || password === "[SENSITIVE]") throw new HttpError(503, "Email verification is temporarily unavailable. Please contact support.")
  return { password, email, from: `Absolute Revision <${email}>` }
}

function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid Email Address.")
  return email
}

export async function sendSubmissionEmailCode(req: ApiRequest, value: unknown) {
  const email = normalizeEmail(value)
  const { password, email: sender, from } = emailConfiguration()
  await initClientSubmissionsDb()
  const ip = process.env.VERCEL
    ? getHeader(req.headers, "x-vercel-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    : req.socket?.remoteAddress ?? "unknown"
  await enforceVerificationLimit(`send-ip:${ip}`, 5, 3_600_000)
  await enforceVerificationLimit(`send-email-cooldown:${email}`, 1, 60_000)
  await enforceVerificationLimit(`send-email:${email}`, 3, 3_600_000)
  await enforceVerificationLimit("send-global", 90, 86_400_000)
  const id = randomUUID()
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
  await query(`INSERT INTO submission_email_verifications (id, email, code_hash, expires_at)
    VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`, [id, email, verificationDigest(`code:${id}:${code}`)])
  try {
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true,
      auth: { user: sender, pass: password },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    })
    const result = await transport.sendMail({
      from, to: [email], replyTo: "coresystechng@gmail.com",
      subject: "Verify your email for Absolute Revision",
      text: `Your verification code is ${code}.\n\nEnter this code on the Absolute Revision upload page. It expires in 10 minutes. You do not need to create an account.\n\nIf you did not request this code, ignore this email. Never share it with anyone.`,
      html: `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;max-width:560px;margin:auto;padding:24px"><h1 style="font-size:24px">Verify your email</h1><p>Enter this code on the Absolute Revision upload page:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. No account or password is required.</p><p>If you did not request this code, ignore this email. Never share it with anyone.</p></div>`,
      messageId: `<submission-verification-${id}@gmail.com>`,
    })
    if (!result.accepted?.length) throw new Error("verification_email_delivery_failed")
  } catch {
    await query("DELETE FROM submission_email_verifications WHERE id = $1", [id])
    throw new HttpError(503, "We could not send your verification code. Please try again later or contact support.")
  }
  return { challengeId: id, expiresIn: 600 }
}

export async function verifySubmissionEmailCode(body: Record<string, unknown>) {
  const email = normalizeEmail(body.email)
  const id = typeof body.challengeId === "string" ? body.challengeId : ""
  const code = typeof body.code === "string" ? body.code : ""
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !/^\d{6}$/.test(code)) throw new HttpError(400, "Enter the six-digit code from your email.")
  await initClientSubmissionsDb()
  const rows = await query<{ code_hash: string }>(`
    UPDATE submission_email_verifications SET attempts = attempts + 1
    WHERE id = $1 AND email = $2 AND expires_at > NOW() AND verified_at IS NULL AND attempts < 5
    RETURNING code_hash`, [id, email])
  const actual = Buffer.from(verificationDigest(`code:${id}:${code}`), "hex")
  const expected = rows[0] ? Buffer.from(rows[0].code_hash, "hex") : Buffer.alloc(32)
  if (!rows.length || !timingSafeEqual(actual, expected)) throw new HttpError(400, "The code is invalid or expired. Request a new code if needed.")
  const token = randomBytes(32).toString("hex")
  const verified = await query(`UPDATE submission_email_verifications
    SET verified_at = NOW(), proof_hash = $3, expires_at = NOW() + INTERVAL '30 minutes'
    WHERE id = $1 AND email = $2 AND verified_at IS NULL AND expires_at > NOW()
    RETURNING id`, [id, email, createHash("sha256").update(token).digest("hex")])
  if (!verified.length) throw new HttpError(400, "This code has already been used. Request a new code.")
  return { verificationToken: token, expiresIn: 1800 }
}
