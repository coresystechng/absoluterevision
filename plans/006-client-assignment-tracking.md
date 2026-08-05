# Plan 006: Deliver secure public assignment tracking

> **Executor instructions**: You are the implementation agent. Read this plan
> completely before changing code, then follow it step by step. Run every
> verification command and confirm the expected result before moving on. Keep
> the implementation production-oriented but inside the stated scope. If a
> STOP condition occurs, stop and report it; do not improvise or broaden scope.
> When finished, update this plan's status row in `plans/README.md` to `DONE`.
>
> **Drift check (run first)**:
> `git diff --stat 1624536..HEAD -- src/lib/db.ts server/api/db.ts server/api/public-assignment-status.ts server/api/public-assignment-status.test.ts api/assignment-status.ts api/assignment-status.test.ts src/types.ts src/api/assignments.ts src/api/assignments.test.ts src/api/public-assignment-status.ts src/api/public-assignment-status.test.ts src/lib/public-assignment-status.ts src/lib/public-assignment-status.test.ts src/pages/AssignmentTracking.tsx src/pages/AssignmentView.tsx src/pages/Landing.tsx src/App.tsx vercel.json plans/README.md`
> If any in-scope file changed, compare the current-state facts below with the
> live code. A material mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L (multi-file feature, approximately 2-3 development days)
- **Risk**: MED (public data boundary plus schema backfill)
- **Depends on**: `plans/001-establish-test-baseline.md` (already DONE)
- **Category**: direction
- **Planned at**: commit `1624536`, 2026-08-05

## Objective

Build a public `/track-assignment` page where a client enters a high-entropy
Assignment ID and receives a deliberately limited status view. The result must
show the service category, public status, calculated progress, client-friendly
workflow milestones, due date when present, and last-updated timestamp. It must
never expose the numeric database ID, assignment title, notes, priority, team,
assignee, email address, staff activity, or Dropbox/file data.

The Assignment ID is a bearer secret. Use a random public tracking code such as
`AR-7A91F2-88C4D0-1B6E35-902AF8`, not the existing sequential integer ID. Add a
copyable ID and link to the authenticated assignment-detail page so staff can
send it to the client through their existing communication channel.

## Why this matters

Clients currently have no self-service progress view. The signed-in assignment
screen already tracks status, six workflow stages, progress, due dates, and
updates, but its object also contains sensitive operational data. Reusing that
object or its existing `SELECT a.*` query in a public route would expose more
than the client needs. This plan creates a separate server-side read model and
keeps the public feature independent of the still-pending full browser-database
migration in Plan 003.

## Current state

- Stack: React 18, TypeScript, Vite, React Router, Tailwind CSS 4,
  shadcn-style primitives, Neon PostgreSQL, and Vercel serverless functions.
- `src/App.tsx:69-98` declares public and protected SPA routes. There is no
  assignment-tracking route.
- `vercel.json:2-35` explicitly rewrites each SPA route to `index.html`.
- `server/api/http.ts` provides `HttpError`, `sendJson`, `handleApiError`,
  `requireMethod`, and `getQueryParam`. Public lookup must use these helpers but
  must not call `requireUser`.
- `api/assignment-files.ts` is the handler-style exemplar: import server
  helpers with `.js` extensions, validate method/query values, throw
  `HttpError`, call `sendJson`, and delegate failures to `handleApiError`.
- `server/api/db.ts:65-81` and `src/lib/db.ts:66-82` both create the
  `assignments` table. Both initializers also apply idempotent `ALTER TABLE`
  statements because this repository has no standalone migration framework.
  Schema parity must be preserved in both files.
- The database uses `id SERIAL PRIMARY KEY`; never expose or accept it from the
  public page.
- `src/types.ts:37-57` defines the authenticated `Assignment` object. It
  includes `teamName`, assignee identity, title, priority, notes, and timestamps.
  Add `trackingCode` for authenticated staff, but do not reuse this type as the
  public API response.
- `src/api/assignments.ts:24-44` defines `AssignmentRow`, while
  `mapAssignment` at lines 78-102 maps it. `assignmentSelect` at lines 252-266
  uses `a.*` for authenticated team queries. It may continue doing so; only add
  `tracking_code` to the row and mapper. The new public SQL must list every
  allowed column explicitly and must not use this query.
- `src/pages/AssignmentView.tsx:325-433` renders authenticated assignment
  details, including notes. Add a separate client-tracking card, but do not
  change existing authorization, editing, files, or activity behavior.
- `src/lib/assignment-status.ts:9-21` defines internal stages and progress:
  `ai-draft` 15%, `humaned` 30%, `grammar-check` 45%,
  `plagiarism-check` 60%, `text-format` 75%, and `final-review` 90%.
  Terminal statuses override these values: not started is 0%, completed is
  100%.
- Internal stage labels such as “AI Draft” and “Humaned” are not the public
  vocabulary. The public labels required by this plan are:

  | Internal value | Public label |
  |---|---|
  | `ai-draft` | Initial draft |
  | `humaned` | Expert editing |
  | `grammar-check` | Language review |
  | `plagiarism-check` | Originality review |
  | `text-format` | Formatting |
  | `final-review` | Final quality check |

- Public status labels are: `not-started` -> “Received”, `ongoing` -> “In
  progress”, and `completed` -> “Completed”. These labels are presentation
  terms only; do not change the stored status values or authenticated UI.
- `src/pages/DocumentUpload.tsx` accepts public submissions but does not create
  an assignment record. Do not claim that upload submission immediately creates
  a tracking ID.
- `src/pages/Landing.tsx` provides the public brand shell and calls to action.
  Match its warm neutral theme, logo treatment, max-widths, typography, cards,
  and responsive spacing.
- Reuse existing primitives: `Button`, `Input`, `Label`, `Card`, `Badge`,
  `Progress`, `Separator`, and `Skeleton`. Do not add a UI package.
- Tests use Vitest in a Node environment. Pure helper tests live beside their
  modules. API/data tests mock dependencies with `vi.hoisted` and `vi.mock`, as
  shown in `src/api/assignments.test.ts`.
- Existing user-facing async failures use concise safe messages and Sonner
  toasts. The tracking result itself should use an inline `aria-live` state so
  a client does not need to notice a toast.

## Required public contract

The successful endpoint payload must have this exact conceptual shape. Naming
may vary only if TypeScript conventions in the live code require it:

```ts
type PublicAssignmentStatus = {
  trackingCode: string
  category: AssignmentType | null
  status: AssignmentStatus
  progressStage: AssignmentProgressStage
  progress: number
  dueDate: string | null
  updatedAt: string
}
```

Forbidden response keys include `id`, `userId`, `teamId`, `teamName`, `title`,
`priority`, `notes`, `assigneeUserId`, `assigneeName`, `assigneeEmail`,
`activities`, `files`, and all Dropbox/provider fields.

The endpoint is `GET /api/assignment-status?trackingId=<code>`:

- Valid found code: HTTP 200 with `{ assignment: PublicAssignmentStatus }`.
- Missing, malformed, or unknown code: the same HTTP 404 response,
  `{ error: "Assignment not found. Check the ID and try again." }`.
- Wrong method: HTTP 405 through `requireMethod`.
- Missing server database configuration: HTTP 503 with a safe availability
  message.
- Unexpected failures: existing generic HTTP 500 handling; never return a SQL
  error or stack trace.
- Every response must have `Cache-Control: no-store, max-age=0`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Focused server tests | `npm test -- server/api/public-assignment-status.test.ts api/assignment-status.test.ts` | all focused tests pass |
| Focused client tests | `npm test -- src/lib/public-assignment-status.test.ts src/api/public-assignment-status.test.ts src/api/assignments.test.ts` | all focused tests pass |
| Full tests | `npm test` | exit 0, all tests pass |
| Lint | `npm run lint` | exit 0, no lint errors |
| Build/typecheck | `npm run build` | exit 0, API and client TypeScript plus Vite build succeed |

## Suggested executor toolkit

- If available, use the `vercel:react-best-practices` skill after editing the
  React components and resolve applicable findings within this plan's scope.
- If available, use `vercel:agent-browser-verify` for the final local responsive
  verification after starting the Vite dev server.
- Do not browse for a new library or install a dependency; the repository
  already contains every primitive needed.

## Scope

**In scope** (the only source/config files you may modify or create):

- `src/lib/db.ts`
- `server/api/db.ts`
- `server/api/public-assignment-status.ts` (create)
- `server/api/public-assignment-status.test.ts` (create)
- `api/assignment-status.ts` (create)
- `api/assignment-status.test.ts` (create)
- `src/types.ts`
- `src/api/assignments.ts`
- `src/api/assignments.test.ts`
- `src/api/public-assignment-status.ts` (create)
- `src/api/public-assignment-status.test.ts` (create)
- `src/lib/public-assignment-status.ts` (create)
- `src/lib/public-assignment-status.test.ts` (create)
- `src/pages/AssignmentTracking.tsx` (create)
- `src/pages/AssignmentView.tsx`
- `src/pages/Landing.tsx`
- `src/App.tsx`
- `vercel.json`
- `plans/README.md` (status row only)

`plans/006-client-assignment-tracking.md` is the read-only instruction artifact
and may already appear as an advisor-created baseline change. Do not edit it.

**Out of scope**:

- Exposing assignment titles, notes, priorities, team/staff/client identities,
  activity messages, files, or download links.
- Accepting numeric assignment IDs in the public endpoint.
- Changing authentication or authorization, or completing Plan 003's broader
  server-side database migration.
- Client accounts, email verification, one-time passwords, email sending, or
  automatic notification workflows.
- Automatically converting a public document upload into an assignment.
- Client-visible file delivery. Completed status should say the team will
  deliver through the agreed channel; do not expose Dropbox URLs.
- Editing public status copy per assignment, public comments, chat, analytics,
  CAPTCHA, or payment features.
- Adding dependencies, changing global brand tokens, redesigning unrelated
  pages, or modifying the authenticated assignment workflow.
- Configuring a live Vercel Firewall rule. Record platform rate limiting as a
  production follow-up; do not pretend an in-memory serverless limiter is
  globally reliable.

## Git workflow

- Create or use branch `codex/006-client-assignment-tracking`.
- Record `git status --short` before editing. Preserve this plan file and the
  advisor's new Plan 006 index row as baseline changes if they are uncommitted.
- Preserve unrelated existing work. Never reset, revert, or reformat unrelated
  files.
- Use a conventional commit such as:
  `feat(assignments): add secure client-facing progress tracking`
- Do not push or open a pull request unless the operator explicitly requests it.

## Steps

### Step 1: Add and backfill high-entropy tracking codes

Update both assignment schema initializers in `src/lib/db.ts` and
`server/api/db.ts`.

1. Add a `tracking_code TEXT` column to the `CREATE TABLE assignments` shape.
2. Use an idempotent migration sequence for existing databases:
   - add the column if missing;
   - backfill only null/blank values;
   - set a database default for future inserts;
   - set `NOT NULL`;
   - create a unique index such as `assignments_tracking_code_uidx`.
3. Generate codes from at least 96 bits of cryptographic randomness using
   Neon/PostgreSQL `gen_random_uuid()`. Required display format:
   `AR-XXXXXX-XXXXXX-XXXXXX-XXXXXX`, with uppercase hexadecimal characters.
   The database default, not UI code, must generate the value so all current
   insert paths receive a code.
4. Do not derive the code from the serial ID, timestamp, client identity, title,
   or `random()`/MD5.
5. Keep the SQL idempotent because either initializer may run first.

If `gen_random_uuid()` is unavailable in the configured Neon version, STOP and
report it. Do not silently substitute a weaker generator or add an extension
without operator approval.

**Verify**: `npm run build` -> exit 0. Then
`rg -n "tracking_code|assignments_tracking_code_uidx|gen_random_uuid" src/lib/db.ts server/api/db.ts`
-> both schema initializers contain the column, secure generator/backfill, and
unique index.

### Step 2: Build the server-only public read model

Create `server/api/public-assignment-status.ts`.

- Define a strict row type containing only `tracking_code`, `category`,
  `status`, `progress_stage`, `due_date`, and `updated_at`.
- Export a tracking-code normalization/validation helper. Trim and uppercase
  input, but accept only the exact `AR-XXXXXX-XXXXXX-XXXXXX-XXXXXX` format.
- Export `getPublicAssignmentStatus(trackingId)` that initializes the server
  database and runs one parameterized query by `tracking_code`.
- The SQL must explicitly select the six allowed columns. Never use `*`, join
  users/teams/files/activity tables, or accept the numeric `id`.
- Normalize legacy/unknown stored status and stage values to the existing safe
  fallbacks (`not-started` and `ai-draft`).
- Calculate progress from status/stage instead of trusting the stored progress:
  0 for not started, 100 for completed, otherwise 15/30/45/60/75/90 by stage.
- Convert `due_date` to a date-only `YYYY-MM-DD` string without timezone drift.
  Convert `updated_at` to an ISO timestamp.
- Normalize category to the existing AssignmentType values or null.
- Return null for malformed or unknown codes.

Write `server/api/public-assignment-status.test.ts` with mocked database calls.
Cover normalization, malformed/numeric IDs, exact query parameters, found and
not-found values, terminal progress, legacy fallbacks, date serialization, and
an exact-key assertion proving the mapper excludes every forbidden field.
Also assert that the public SQL contains no `SELECT *`/`a.*` and no forbidden
table joins.

**Verify**:
`npm test -- server/api/public-assignment-status.test.ts` -> all new tests pass.

### Step 3: Expose the narrow serverless endpoint

Create `api/assignment-status.ts`, following `api/assignment-files.ts` and
`api/document-upload.ts` conventions.

- Require GET, read `trackingId`, and do not call `requireUser`.
- Check `isFilesDatabaseConfigured()` before querying and return a safe 503
  through `HttpError` when unavailable.
- Set `Cache-Control: no-store, max-age=0` before every response path.
- Treat missing, malformed, and unknown IDs identically with the required 404
  message.
- Return only `{ assignment }` on success.
- Use `handleApiError` for safe error serialization.
- Never log the supplied tracking code.

Create `api/assignment-status.test.ts`. Mock the server read-model module and
use a minimal `ApiRequest`/`ApiResponse` stub. Cover GET success and its exact
payload keys, missing/malformed/unknown ID parity, 405, 503, and the no-store
header. Tests must not contact Neon.

**Verify**:
`npm test -- api/assignment-status.test.ts server/api/public-assignment-status.test.ts`
-> all focused tests pass.

### Step 4: Add the browser client and public presentation helpers

Create `src/api/public-assignment-status.ts` with a separate public response
type and `getPublicAssignmentStatus(trackingId)` fetch client. Do not import or
return the authenticated `Assignment` type. Encode query parameters with
`URLSearchParams`. Map HTTP 404, 429, and other failures to distinguishable,
safe client errors without surfacing arbitrary server text.

Create `src/lib/public-assignment-status.ts` with pure helpers for:

- exact tracking-code formatting/validation shared by the form;
- the required public status labels;
- the six required public milestone labels and concise client-safe
  descriptions;
- milestone state derivation (`complete`, `current`, `upcoming`);
- progress behavior consistent with the server;
- category fallback text and date-only display formatting.

For `not-started`, progress is 0 and no workflow milestone is complete; the
first milestone may be visually current. For `ongoing`, stages before the
current stage are complete and the matching stage is current. For `completed`,
all milestones are complete and progress is 100.

Create tests for both files. Mock `fetch` in the API-client tests. Cover
lowercase/pasted input normalization, invalid codes, all three status labels,
each stage label, milestone state boundaries, terminal progress, null due date,
404, 429, 500, and malformed success payload handling.

**Verify**:
`npm test -- src/lib/public-assignment-status.test.ts src/api/public-assignment-status.test.ts`
-> all focused tests pass.

### Step 5: Build the accessible public tracking page

Create `src/pages/AssignmentTracking.tsx` and add an unprotected
`/track-assignment` route in `src/App.tsx` before the wildcard route.

Required page behavior:

- Use a public header consistent with `DocumentUpload`: logo links home; Home
  and Submit a manuscript actions remain available.
- Heading: “Check your assignment progress”.
- Label the input “Assignment ID”; placeholder example
  `AR-7A91F2-88C4D0-1B6E35-902AF8`; helper text says the ID is supplied by the
  Absolute Revision team.
- Use a real form so Enter submits. Disable the button while loading. Set
  `autoComplete="off"`, disable spellcheck, and preserve pasted input.
- Read an optional `trackingId` query parameter on first render, populate the
  field, and automatically submit only when it passes local validation.
- On a manual valid submission, update the URL query parameter so the result
  link is shareable without a second request.
- Initial, loading, success, not-found/invalid, rate-limited, and temporary
  failure states must be visually distinct. Put result/status messaging in an
  `aria-live="polite"` region. Move focus to the result heading after a completed
  lookup without stealing focus during typing.
- The success surface shows only: tracking code, service category/fallback,
  public status badge, percentage and accessible `Progress`, current public
  stage, due date when present, last updated time, and the six-step milestone
  timeline.
- Do not show assignment title or any forbidden response field.
- Completed work says delivery happens through the agreed communication
  channel; do not provide a file button.
- Include support email and phone actions using the contact values already in
  the public pages.
- Match existing light/dark tokens and responsive layout. At 320px width there
  must be no horizontal overflow; the long ID must wrap or truncate accessibly.
- Avoid decorative animation beyond existing transition utilities. Respect
  reduced motion automatically.

Update `vercel.json` with rewrites for `/track-assignment` and
`/track-assignment/`. Add an `X-Robots-Tag: noindex, nofollow` header for the
tracking page. Preserve every existing rewrite.

**Verify**: `npm run lint` and `npm run build` -> both exit 0.

### Step 6: Make tracking discoverable and handoff-ready

Update `src/pages/Landing.tsx` without redesigning it:

- Add a visible “Track assignment” route link in the public experience. Prefer
  a desktop header action plus a secondary hero action and footer link, while
  ensuring the mobile header does not overflow.
- Keep “Get started”/“Submit manuscript” as the primary CTA.
- Use React Router `Link` for the internal route.

Update the authenticated assignment shape and detail screen:

- Add required `trackingCode: string` to `Assignment` in `src/types.ts`.
- Add `tracking_code` to `AssignmentRow` and map it in
  `src/api/assignments.ts`. Do not change its authenticated access query or
  mutation authorization.
- Update the fixture and assertions in `src/api/assignments.test.ts` so mapping
  regression coverage includes `trackingCode`.
- In `src/pages/AssignmentView.tsx`, add a “Client tracking” card visible to
  signed-in team members who can already view the assignment. Display the ID
  and provide separate “Copy ID” and “Copy tracking link” buttons. The link is
  `${window.location.origin}/track-assignment?trackingId=<encoded code>`.
- Use `navigator.clipboard.writeText`; show Sonner success/failure feedback.
  Do not put the numeric assignment ID in the public URL.
- Explain that the tracking link contains client-safe status information and
  should be shared only with the intended client.

Do not modify the creation dialog: the database default automatically supplies
the code.

**Verify**:
`npm test -- src/api/assignments.test.ts` -> focused tests pass, then
`npm run lint && npm run build` -> both exit 0.

### Step 7: Run the full regression and browser checks

Run the complete automated suite, then start the local app and inspect the
public page at desktop, 390x844, and 320px widths in both light and dark themes
when available.

Verify manually:

- Empty submit is rejected without a network call.
- A malformed or numeric ID never retrieves data.
- A valid unknown code shows the neutral not-found state.
- A known code shows only allowed fields and the correct progress/milestones.
- Refreshing a shareable URL restores the lookup.
- Keyboard-only form submission and focus movement work.
- Loading and errors are announced without repeated noisy announcements.
- No horizontal overflow at 320px.
- Landing links reach the page.
- Staff copy buttons produce the correct tracking code and URL.
- DevTools Network shows no-store on the endpoint response.
- Browser console has no errors.

Do not use real client data in screenshots or the final report. If no safe local
database fixture is available, verify the not-found flow and document that the
found-record browser check was skipped; do not create or expose production data.

**Verify**: `npm test && npm run lint && npm run build` -> all exit 0.

## Test plan summary

- `server/api/public-assignment-status.test.ts`: validation, normalization,
  explicit SQL projection, mapping, progress, serialization, privacy keys.
- `api/assignment-status.test.ts`: method handling, 200/404/405/503, exact
  payload, no-store header, no database network.
- `src/api/public-assignment-status.test.ts`: fetch URL/encoding, success and
  safe failure mapping.
- `src/lib/public-assignment-status.test.ts`: public vocabulary, stages,
  milestone state, progress, formatting.
- `src/api/assignments.test.ts`: authenticated assignment maps tracking code.
- Full existing Vitest suite remains green.
- Browser checks cover responsiveness, accessibility, URL restoration, privacy,
  copy actions, theme support, and console/network behavior.

## Done criteria

All items must hold:

- [ ] `npm test` exits 0 and all new focused tests pass.
- [ ] `npm run lint` exits 0.
- [ ] `npm run build` exits 0.
- [ ] `rg -n "tracking_code" src/lib/db.ts server/api/db.ts src/api/assignments.ts` confirms schema and authenticated mapping coverage.
- [ ] `rg -n "gen_random_uuid" src/lib/db.ts server/api/db.ts` confirms cryptographic database-side generation in both initializers.
- [ ] `rg -n "assignments_tracking_code_uidx" src/lib/db.ts server/api/db.ts` confirms uniqueness in both initializers.
- [ ] `rg -n "requireUser" api/assignment-status.ts` returns no matches.
- [ ] `rg -n "SELECT\s+(a\.)?\*|notes|assignee|team_memberships|assignment_files|assignment_activities" server/api/public-assignment-status.ts` returns no matches in the public query/mapping implementation (test descriptions may mention forbidden fields only in test files).
- [ ] The public API success object contains only the seven contract keys.
- [ ] `/track-assignment` and `/track-assignment/` are present in `vercel.json` without removing existing rewrites.
- [ ] The tracking page is unprotected and reachable from the landing page.
- [ ] The public URL uses `trackingId`, never the numeric assignment `id`.
- [ ] Staff can copy the tracking ID and shareable link from AssignmentView.
- [ ] Browser verification passes at desktop, 390px, and 320px, or any skipped found-record check is explicitly documented because no safe fixture existed.
- [ ] Relative to the executor's recorded baseline, implementation changes
  contain only in-scope files; the read-only plan artifact and any pre-existing
  operator changes remain untouched.
- [ ] The Plan 006 row in `plans/README.md` is updated to `DONE` only after all applicable checks pass.

## STOP conditions

Stop and report back instead of improvising if:

- Any in-scope current-state excerpt has materially drifted from commit
  `1624536`.
- `gen_random_uuid()` is unavailable or the tracking-code backfill/unique index
  cannot be made idempotent without a real migration tool.
- Production contains duplicate/non-null tracking values that prevent the
  unique index from being created.
- Implementing the endpoint appears to require exposing `VITE_NEON_DATABASE_URL`
  or any database credential to the public page. Only server-side
  `NEON_DATABASE_URL` may serve the public lookup.
- A successful public response would need any forbidden field.
- The found-record experience cannot be implemented without accessing real
  client data during tests.
- The work requires changing authentication/authorization or completing Plan
  003.
- A rate limiter requires a new paid service, dependency, or external mutation.
  Leave Vercel Firewall rate limiting as a documented follow-up.
- Any step's verification fails twice after a reasonable scoped correction.
- The implementation needs a source/config file outside the in-scope list.

## Maintenance and deployment notes

- Treat tracking codes like passwords in logs, analytics, support screenshots,
  and error reporting. Do not record full codes in telemetry.
- Configure a Vercel Firewall rate-limit rule for `/api/assignment-status`
  before promoting the feature broadly. This is an external deployment task,
  not an in-memory code limiter.
- Plan 003 will later move authenticated assignment queries server-side. Its
  executor must preserve `trackingCode` in the staff response while keeping the
  public response projection separate.
- If new internal stages are added, update both server normalization/progress
  tests and client milestone mapping in the same change.
- The public page intentionally shows date only because the database stores
  separate date/time values without an explicit client timezone. Do not add a
  countdown until deadline timezone semantics are defined.
- A future secure delivery feature should use authenticated or short-lived
  signed downloads. Never place Dropbox URLs into this public status response.
- A future upload-to-assignment workflow may email the tracking ID after staff
  accepts a submission. This release relies on the staff copy-link control and
  existing communication channel.
- Reviewers should scrutinize the SQL projection, exact response keys, code
  entropy/backfill, no-store behavior, and URL handling before approval.

## Executor completion report

Return a concise report containing:

1. Files changed, grouped by database/server/client/UI/tests.
2. Exact test, lint, and build commands run with results.
3. Browser viewport/theme checks completed and any safe-fixture limitation.
4. Confirmation that the public payload contains no forbidden fields.
5. Any deployment follow-up, especially Vercel Firewall rate limiting.
6. The final commit hash if you were authorized to commit.
