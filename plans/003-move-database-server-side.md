# Plan 003: Move application database access behind authenticated API routes

> **Executor instructions**: Execute every step and gate in order. Do not expose
> a temporary unauthenticated API. Stop on any STOP condition. Update the index
> status when finished unless a reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat d274e39..HEAD -- src/api src/hooks src/pages src/lib/db.ts src/lib/date-values.ts src/types.ts server/api/db.ts api .env.example SETUP.md`
> Plans 001 and 002 are expected drift; verify they are complete. Any unrelated
> material mismatch must be reconciled or reported before implementation.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `plans/001-establish-test-baseline.md`, `plans/002-verify-api-identity.md`
- **Category**: security
- **Planned at**: commit `d274e39`, 2026-07-11

## Why this matters

`VITE_NEON_DATABASE_URL` is embedded in browser JavaScript and used to execute
arbitrary SQL. Therefore, UI checks and SQL predicates in client modules are not
security boundaries: anyone with the bundled credential can bypass admin-only
status rules and tenant scoping. This plan moves all profile, team, and
assignment queries to authenticated Vercel functions and removes the database
credential and DDL capability from the client bundle.

## Current state

- `src/lib/db.ts:3-24` constructs a Neon SQL client from
  `import.meta.env.VITE_NEON_DATABASE_URL` and exports unrestricted `query`.
- `src/lib/db.ts:29-230` runs schema creation, ALTER statements, backfills, and
  indexes from the browser.
- `src/api/users.ts`, `src/api/teams.ts`, and `src/api/assignments.ts` import the
  client query helper and contain SQL plus mapping/domain logic.
- `server/api/db.ts` already demonstrates the server-only pattern using
  `NEON_DATABASE_URL`, parameterized queries, and Vercel functions for files.
- Plan 002 supplies verified server identity. Every new route must call it
  before any query.
- Existing client-facing exported API functions and hooks are the compatibility
  seam. Preserve their returned TypeScript shapes and user-visible errors while
  replacing their internals with `fetch`.
- `SETUP.md:71` already documents this browser credential as a hardening gap.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `npm test` | all tests pass |
| Lint | `npm run lint` | exit 0 |
| Build/typecheck | `npm run build` | exit 0 |
| Secret scan | `rg -n "VITE_NEON_DATABASE_URL" src api server .env.example SETUP.md` | no matches after migration |

## Scope

**In scope**:

- `src/lib/db.ts` (delete)
- `src/vite-env.d.ts`
- `.env.example`, `SETUP.md`
- `src/api/users.ts`, `src/api/teams.ts`, `src/api/assignments.ts`
- `src/hooks/useAssignments.ts`, `src/hooks/useTeams.ts`
- `src/pages/Dashboard.tsx`, `src/pages/Settings.tsx`, `src/pages/AssignmentView.tsx`
- `server/api/db.ts`
- `server/api/users.ts`, `server/api/teams.ts`, `server/api/assignments.ts` (create)
- `server/api/validation.ts` (create)
- Authenticated route files under `api/app/` for profile, teams/members, and
  assignments/activities/status/progress.
- Tests colocated with changed client, server, and route modules.

**Out of scope**:

- Dropbox provider behavior and public document uploads.
- UI redesign or response-shape changes.
- Changing team/admin semantics.
- RLS/Data API migration; this plan deliberately uses the established Vercel
  serverless boundary.
- Transactions beyond what is necessary to preserve behavior (Plan 004).

## Git workflow

- Branch: `codex/003-server-data-boundary`
- Use logical commits so reviewers can follow: server services/routes, client
  migration, then credential/config removal.
- Final commit title: `refactor(data): move application queries behind authenticated APIs`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Define authenticated HTTP contracts

Create route contracts that preserve existing `UserProfile`, `Team`,
`TeamMember`, `Assignment`, and `AssignmentActivity` JSON shapes:

- `GET/POST /api/app/profile`; `PATCH /api/app/profile` for display name and
  dashboard preferences (or equivalent clearly documented methods).
- `GET/POST /api/app/teams`.
- `PATCH /api/app/teams/:teamId`.
- `GET/POST/DELETE /api/app/teams/:teamId/members`.
- `GET/POST/DELETE /api/app/assignments`.
- `GET/PUT/DELETE /api/app/assignments/:assignmentId`.
- `GET /api/app/assignments/:assignmentId/activities`.
- `PATCH /api/app/assignments/:assignmentId/status`.
- `PATCH /api/app/assignments/:assignmentId/progress`.

Every route must validate method, integer IDs, string lengths, enums, dates,
times, and nullable fields before calling a service. Ignore no unknown mutation
fields silently. Identity comes exclusively from Plan 002; do not accept
`userId`, role, or actor identity in request bodies or query strings.

**Verify**: route contract tests show malformed inputs return 400, missing auth
returns 401, members cannot perform admin writes (403 or existing not-found
semantics), and valid calls preserve JSON shapes.

### Step 2: Move SQL and ACLs into server services

Expand `server/api/db.ts` into the single lazy server-only database entry point.
Move schema initialization from `src/lib/db.ts` there, including the dashboard
preference columns added at commit `d274e39`. Rename `initFilesDb` to a general
name and update file callers.

Move SQL from the three browser API modules into new server service modules.
Keep parameterized placeholders. Services must accept verified user ID from the
route, enforce:

- users may only read/update their own profile;
- team members may read all assignments/files in their teams;
- only team admins may create/edit/delete assignments and change status or
  progress stage;
- only admins manage team names and membership;
- assignees retain existing final-file upload behavior.

Separate row mappers/domain helpers from raw HTTP handling so they remain unit
testable. Do not return raw database column names or credential fields.

**Verify**: service tests mock/query a test adapter and cover cross-team denial,
team-wide reads, admin-only writes, and preference ownership.

### Step 3: Implement authenticated routes

Wire route handlers to Plan 002's verified identity, validation, services, and
the existing `HttpError`/`handleApiError` response convention. Keep API errors
generic in production; log contextual operation names without SQL parameters or
PII. Ensure the local Vite route resolver supports every chosen dynamic path;
add resolver tests if nested dynamic directories expose a gap.

**Verify**: `npm test -- --run api/app server/api` → all route/service tests pass.

### Step 4: Convert browser APIs to fetch clients

Replace SQL in `src/api/users.ts`, `teams.ts`, and `assignments.ts` with typed
fetch wrappers using Plan 002's bearer helper. Preserve exported return shapes
so hooks/pages need only remove caller-supplied identity parameters. Centralize
JSON/error handling instead of duplicating `readApiResponse` again.

Update hooks and pages so no request supplies `user.id` as authorization data.
It is acceptable for UI code to compare the authenticated user's ID for display
or affordances, but the server remains authoritative.

**Verify**: `rg -n "query\(|@/lib/db|VITE_NEON_DATABASE_URL" src` → no matches.

### Step 5: Remove the client database credential and module

Delete `src/lib/db.ts`. Remove `VITE_NEON_DATABASE_URL` from Vite types,
`.env.example`, and setup/deployment instructions. Retain `NEON_DATABASE_URL`
server-side. Confirm no server secret uses a `VITE_` prefix. Build and inspect
generated assets for the old environment variable name and known database URL
host markers; do not print credential values during the check.

**Verify**:

- `rg -n "VITE_NEON_DATABASE_URL|@/lib/db" src api server .env.example SETUP.md` → no matches.
- `npm run build` → exit 0.
- A credential-name scan of `dist/` finds no `VITE_NEON_DATABASE_URL`.

### Step 6: Run the full regression suite

**Verify**:

- `npm test` → exit 0.
- `npm run lint` → exit 0.
- `npm run build` → exit 0.
- `git diff --check` → no output.

## Test plan

Add unit tests for validation and ACL services plus handler tests for every
method family. At minimum test: own profile only; saved filters round-trip;
member sees assigned and unassigned team work; outsider sees nothing; member
status/progress write denied; admin write allowed; member management denied to
members; malformed IDs/enums rejected; database failures become generic 500s.
Client tests should mock `fetch` and verify bearer usage and response mapping.
No test may connect to production Neon.

## Done criteria

- [ ] Client bundles contain no PostgreSQL connection string or SQL executor.
- [ ] `src/lib/db.ts` and `VITE_NEON_DATABASE_URL` are gone.
- [ ] All profile/team/assignment operations use verified API identity.
- [ ] Existing user-visible functionality and JSON shapes remain intact.
- [ ] Authorization regression tests cover cross-team and member/admin cases.
- [ ] `npm test`, `npm run lint`, and `npm run build` pass.
- [ ] `plans/README.md` marks Plan 003 `DONE`.

## STOP conditions

- Plan 002 is not complete or new routes cannot obtain verified identity.
- Existing production data requires a destructive migration.
- The local Vite route resolver cannot represent the contracts without a broad
  unrelated rewrite; report options before proceeding.
- Preserving a public function shape would require keeping a browser database
  credential.
- Any generated client asset contains the server database URL.
- A verification gate fails twice.

## Maintenance notes

Future data features must enter through authenticated services/routes, never a
Vite environment variable. Reviewers should search every client diff for SQL,
identity fields in request payloads, and duplicated authorization. Plan 004
will replace multi-query server mutations with transactions; keep service
boundaries narrow enough to support that change.

