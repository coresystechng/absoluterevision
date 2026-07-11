# Plan 004: Make related database mutations atomic

> **Executor instructions**: Follow all steps and verification gates. Do not
> attempt to include Dropbox network operations inside a PostgreSQL transaction.
> Stop and report any STOP condition. Update `plans/README.md` when done unless
> a reviewer maintains it.
>
> **Drift check (run first)**: `git diff --stat d274e39..HEAD -- server/api/db.ts server/api/users.ts server/api/teams.ts server/api/assignments.ts api/app`
> Plans 002 and 003 are expected drift and must already be complete. Compare
> their live service boundaries to this plan before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/003-move-database-server-side.md`
- **Category**: bug
- **Planned at**: commit `d274e39`, 2026-07-11

## Why this matters

Current mutations perform related writes sequentially without transactions. An
assignment can save but fail to record activity, a team can exist without its
admin membership, and member removal can reassign work without removing the
membership. Callers then receive an error despite partially committed state.
This plan makes database state transitions all-or-nothing at the server service
boundary created by Plan 003.

## Current state

At the planned commit, examples are:

- `src/api/assignments.ts:492-531`: update assignment, reload it, then insert
  activity records as separate committed queries.
- `src/api/teams.ts:137-150`: insert team, then insert admin membership.
- `src/api/teams.ts:214-228`: reassign assignments, then delete membership.
- `src/api/users.ts:40-116`: create user/default team/membership and seed starter
  assignments across multiple calls.
- Plan 003 moves these operations to `server/api/users.ts`, `teams.ts`, and
  `assignments.ts`; use the live server paths, not the obsolete client paths.
- `@neondatabase/serverless` is already installed. Its Node serverless
  transaction mechanism must be confirmed against the installed version and
  current Neon docs before choosing `Pool`/`Client` or HTTP batch transaction.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `npm test` | all tests pass |
| Lint | `npm run lint` | exit 0 |
| Build/typecheck | `npm run build` | exit 0 |

## Scope

**In scope**:

- `server/api/db.ts`
- `server/api/users.ts`
- `server/api/teams.ts`
- `server/api/assignments.ts`
- Server service/database test files created by Plan 003.
- `server/api/files.ts` or the Plan 003 file-metadata service only if needed to
  make metadata-plus-activity writes atomic after Dropbox succeeds.

**Out of scope**:

- Client components, pages, and response shapes.
- Authentication and ACL semantics.
- Dropbox network calls, compensating deletion, queues, or retry systems.
- Schema redesign and ORM adoption.
- Wrapping read-only operations in transactions.

## Git workflow

- Branch: `codex/004-atomic-mutations`
- Suggested commit: `fix(database): make multi-write workflows transactional`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add a transaction primitive

Confirm the installed Neon driver's supported interactive transaction API for
the Vercel Node runtime. Add a typed `withTransaction` helper in
`server/api/db.ts` that:

- acquires a transaction-capable connection lazily;
- executes `BEGIN`, invokes a callback with a transaction-scoped query adapter,
  then `COMMIT`;
- executes `ROLLBACK` on any callback error and rethrows the original error;
- always releases/closes the checked-out connection in `finally`;
- never initializes a client at module import when environment variables may be
  absent during build.

If the installed HTTP driver cannot support interactive callbacks, use the
driver's documented transaction API only where the complete statement list is
known. Do not fake atomicity with `Promise.all`.

**Verify**: unit tests with a fake connection assert exact BEGIN/COMMIT and
BEGIN/ROLLBACK/release sequences, including a callback that throws.

### Step 2: Thread the transaction query adapter through services

Allow internal query helpers, ACL lookups, row reloads, and activity insertion
to accept a transaction-scoped query adapter. They must not fall back to the
global query client while inside a transaction. Avoid broad dependency
injection abstractions: a small `QueryExecutor` interface used by server
services is sufficient.

**Verify**: a test transaction uses one executor for every query in a mutation;
assert the global query mock is untouched.

### Step 3: Make user and team workflows atomic

Wrap each logical state transition:

- create user + default team + admin membership + starter assignments;
- create team + admin membership;
- remove team member + reassign their assignments + delete membership.

Keep idempotency behavior (`ON CONFLICT`) intact. Concurrent first-login calls
must not seed duplicate starter assignments; add a database constraint or
transaction-safe sentinel if the existing user insertion is insufficient.

**Verify**: inject a failure at each second/subsequent write and assert no prior
write remains committed in the transaction test adapter. Add a concurrency
characterization test for first-login seeding.

### Step 4: Make assignment and activity workflows atomic

Wrap assignment create/update/status/progress mutations with their activity
rows. Build activity messages from pre/post rows inside the same transaction.
Delete operations that rely only on `ON DELETE CASCADE` can remain a single
statement. Preserve team-member reads and admin-only write ACLs from Plan 003.

For file operations, Dropbox upload/download/delete remains outside Postgres.
After a successful provider operation, metadata and its activity row may share
one DB transaction. Do not claim the provider plus database operation is fully
atomic; document this remaining distributed-systems limitation.

**Verify**: assignment tests simulate activity insertion failure and assert the
assignment mutation rolls back. Existing authorization tests must still pass.

### Step 5: Run all gates

**Verify**:

- `npm test` → exit 0.
- `npm run lint` → exit 0.
- `npm run build` → exit 0.
- `git diff --check` → no output.

## Test plan

Use transaction-aware fakes or an isolated disposable Neon test branch—never
production. Cover commit success, rollback at every write boundary, connection
release on success/failure, nested/global query misuse, concurrent onboarding,
team creation, member removal, assignment creation/update/status/progress, and
metadata-plus-activity writes. Retain all authorization assertions from Plans
001–003.

## Done criteria

- [ ] Every listed multi-write database transition is atomic.
- [ ] Failures rethrow after rollback and connections always release.
- [ ] No transaction mixes global and transaction-scoped query executors.
- [ ] Dropbox network operations are explicitly outside DB transactions.
- [ ] First-login concurrency cannot duplicate seeded assignments.
- [ ] `npm test`, `npm run lint`, and `npm run build` pass.
- [ ] `plans/README.md` marks Plan 004 `DONE`.

## STOP conditions

- Plan 003 has not centralized writes on the server.
- The installed driver has no transaction mechanism compatible with the Vercel
  runtime; report supported alternatives before adding dependencies.
- Atomicity requires holding a transaction open across a Dropbox/network call.
- Production schema lacks a safe idempotency constraint and adding one could
  reject existing duplicate data; report required data cleanup first.
- A verification gate fails twice.

## Maintenance notes

Transactions protect PostgreSQL state, not Dropbox side effects. A future plan
may add an outbox/reconciliation job if provider/database divergence becomes an
operational issue. Reviewers should specifically inspect connection release,
transaction-scoped executor propagation, isolation/idempotency under concurrent
onboarding, and serverless connection behavior.

