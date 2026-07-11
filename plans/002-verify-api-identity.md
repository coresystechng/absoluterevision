# Plan 002: Authenticate serverless API requests with verified Neon Auth JWTs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command before moving on. Stop and report any STOP condition;
> do not invent an authentication protocol. Update `plans/README.md` when done
> unless a reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat 54712f7..HEAD -- src/lib/auth.ts src/api/assignment-files.ts server/api/http.ts api/assignment-files.ts api/assignment-files api/dropbox package.json package-lock.json .env.example SETUP.md`
> Material drift in these paths is a STOP condition until reconciled.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-establish-test-baseline.md`
- **Category**: security
- **Planned at**: commit `54712f7`, 2026-07-11

## Why this matters

The serverless APIs currently accept `x-absolute-revision-user-id` as proof of
identity, but clients choose that value. This enables user and Dropbox-owner
impersonation. After this plan, clients send a Neon Auth JWT, the server verifies
its signature and claims against Neon Auth's JWKS, and authorization uses the
verified `sub` claim only.

## Current state

- `src/App.tsx:45-56` uses a Neon Auth session to protect UI routes.
- `src/api/assignment-files.ts:11-15` creates identity and actor headers from
  caller-provided strings:

```ts
return {
  "x-absolute-revision-user-id": userId,
  ...(actorName ? { "x-absolute-revision-actor-name": actorName } : {}),
}
```

- `server/api/http.ts:114-120` returns that header without verification.
- All protected file and Dropbox routes call `requireUser` or `requireOwner`.
- The installed Neon Auth client exposes `getJWTToken()`; official Neon guidance
  states Neon Auth supplies a JWKS URL and JWTs must be verified before trusting
  claims. Consult the current official Neon Auth docs and the installed package
  types before implementing because the SDK is beta and changes frequently.
- Public `/api/document-upload*` routes intentionally accept unauthenticated
  customer submissions and are not part of this identity migration.
- Plan 001 is merged at `54712f7`; Vitest 4 is configured and
  `server/api/http.test.ts` now characterizes the legacy header-based identity
  behavior that this plan must replace with verified-token tests.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` | exit 0 and lockfile updated |
| Tests | `npm test` | all tests pass |
| Lint | `npm run lint` | exit 0 |
| Build/typecheck | `npm run build` | exit 0 |

## Suggested executor toolkit

- Use current Neon Auth documentation for the JWT/JWKS contract; do not infer
  claim validation from unverified token contents.
- Use `jose` for remote JWKS caching and JWT verification if it remains the
  supported Node/Vercel library at execution time.

## Scope

**In scope**:

- `package.json`, `package-lock.json`
- `.env.example`, `SETUP.md`
- `src/lib/api-auth.ts` (create)
- `src/api/assignment-files.ts`
- `server/api/auth.ts` (create)
- `server/api/http.ts`
- `server/api/http.test.ts`
- `api/assignment-files.ts`
- `api/assignment-files/download.ts`
- `api/assignment-files/upload.ts`
- `api/assignment-files/upload-session/start.ts`
- `api/assignment-files/upload-session/append.ts`
- `api/assignment-files/upload-session/finish.ts`
- `api/dropbox/[action].ts`
- Focused new tests under the same `api/` and `server/api/` paths.

**Out of scope**:

- `api/document-upload*` public endpoints.
- Moving profile/team/assignment SQL out of the browser (Plan 003).
- Changing team roles or file-category permissions.
- Switching auth providers or performing a broad Neon SDK upgrade.

## Git workflow

- Branch: `codex/002-verify-api-identity`
- Suggested commit: `fix(auth): verify Neon JWTs for protected API routes`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Confirm the Neon JWT contract

Using the installed package types and current official Neon docs, confirm:

1. The browser method that returns the signed JWT (`getJWTToken` at plan time).
2. The exact JWKS URL, expected issuer, and audience behavior for this project.
3. Which stable claims contain user ID (`sub`), email, and display name.

Add server-only environment names to `.env.example`—expected names are
`NEON_AUTH_JWKS_URL`, `NEON_AUTH_ISSUER`, and optionally
`NEON_AUTH_AUDIENCE`. Do not include values. Document where operators obtain
them and that Vite-prefixed variables are public.

**Verify**: `git diff -- .env.example SETUP.md` → names and setup instructions
are present, with no secret values.

### Step 2: Add a server JWT verifier

Create `server/api/auth.ts`. Define an `AuthenticatedUser` containing `id`,
optional `email`, and optional `displayName`. Lazily initialize and cache the
remote JWKS resolver. Implement `verifyAuthorization(req)` that:

- requires a single `Authorization: Bearer <token>` value;
- verifies signature, issuer, expiration/not-before, and configured audience;
- rejects missing/empty `sub`;
- returns identity only from verified claims;
- maps verification failures to the existing generic 401 `HttpError` without
  returning token or cryptographic details.

Never decode and trust a JWT without signature verification. Never log the
token. Keep all verifier environment variables server-only.

Change `requireUser` and `requireOwner` to async functions returning the verified
identity (or its verified ID); make the choice consistent across every route.
Derive activity actor names from verified claims or the database—not headers.

**Verify**: focused tests must reject missing, malformed, expired, wrong-issuer,
wrong-audience, and invalid-signature tokens and accept a valid test key/token.
Use an in-memory test key pair, not network JWKS.

### Step 3: Send bearer tokens from the client

Create `src/lib/api-auth.ts` with an async helper that obtains the current Neon
Auth JWT and returns an Authorization header. Update every function in
`src/api/assignment-files.ts` to await this helper. Remove the identity and
actor-name headers entirely; keep existing function parameters temporarily if
needed to avoid expanding Plan 002, but mark them deprecated and never transmit
them.

**Verify**: `rg -n "x-absolute-revision-user-id|x-absolute-revision-actor-name" src api server` → no matches.

### Step 4: Update every protected route

Await verified identity in all assignment-file and Dropbox handlers. Pass only
the verified subject to database ACL functions. `requireOwner` must compare the
verified subject with `DROPBOX_OWNER_USER_ID`. Preserve method checks, team ACLs,
file-category ACLs, response shapes, and public document-upload behavior.

Add route tests proving a forged legacy identity header without a valid bearer
token receives 401 and cannot reach a mocked database/Dropbox call.

**Verify**: `npm test -- --run server/api api/assignment-files api/dropbox` → all
focused tests pass.

### Step 5: Run all gates

**Verify**:

- `npm test` → exit 0.
- `npm run lint` → exit 0.
- `npm run build` → exit 0.
- `git diff --check` → no output.

## Test plan

Tests must cover valid JWT, missing/invalid bearer scheme, bad signature,
expired token, wrong issuer/audience, missing subject, owner mismatch, and a
legacy spoofed header. Route tests mock database and Dropbox operations and
assert they are not called for rejected identities. Preserve Plan 001's public
request parser and file-normalization coverage.

## Done criteria

- [ ] No protected API trusts a user ID or actor name supplied by the caller.
- [ ] Verified JWT `sub` is the sole request identity.
- [ ] Owner authorization uses verified identity.
- [ ] Public document upload still works without authentication.
- [ ] No JWT or secret appears in logs, errors, fixtures, or committed config.
- [ ] `npm test`, `npm run lint`, and `npm run build` pass.
- [ ] `plans/README.md` marks Plan 002 `DONE`.

## STOP conditions

- Current Neon Auth cannot issue a JWT suitable for server verification.
- The JWKS/issuer/audience contract cannot be confirmed from official docs and
  the configured project.
- Implementing verification requires exposing a private signing key to Vite.
- The app relies on anonymous auth tokens for any protected route.
- Verification fails twice after a reasonable correction.

## Maintenance notes

Plan 003 must reuse this verifier for all new application data routes. Cache
remote JWKS safely so key rotation works. Reviewers should scrutinize issuer and
audience checks, error-message data leakage, and any fallback to legacy headers.
