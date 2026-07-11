# Plan 001: Establish the automated test baseline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report—do not improvise. When done, update this plan's row in
> `plans/README.md` unless a reviewer says they maintain the index.
>
> **Drift check (run first)**: `git diff --stat d274e39..HEAD -- package.json package-lock.json vite.config.ts src/lib src/api server/api`
> If an in-scope file changed, compare the current-state excerpts below with
> live code. Any material mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `d274e39`, 2026-07-11

## Why this matters

The repository has build and lint checks but no automated tests. Authorization,
team visibility, assignment state normalization, and dashboard preferences are
high-risk behavior that can regress while TypeScript still compiles. This plan
adds a fast Vitest baseline without changing production behavior, providing the
safety net required by Plans 002–004.

## Current state

- `package.json:6-10` defines `dev`, `build`, `lint`, and `preview`; there is no
  `test` script.
- No `*.test.*` or `*.spec.*` files exist outside dependencies.
- `src/lib/dashboard-preferences.ts` contains pure preference normalization.
- `src/lib/assignment-status.ts` contains pure status/progress normalization.
- `src/api/assignments.ts:332-370` contains team visibility checks, while
  `src/api/assignments.ts:539-620` requires an admin row for status/progress
  changes.
- Existing code uses strict TypeScript, named exports, path alias `@/*`, and
  colocated domain helpers. Tests should be colocated as `*.test.ts`.

Current script block (`package.json:6`):

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint .",
  "preview": "vite preview"
}
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` | exit 0 and lockfile updated |
| Focused tests | `npm test -- --run src/lib` | all selected tests pass |
| Full tests | `npm test` | exit 0, all tests pass |
| Lint | `npm run lint` | exit 0, no errors |
| Build/typecheck | `npm run build` | exit 0; the existing chunk-size warning is acceptable |

## Scope

**In scope** (the only files to modify):

- `package.json`
- `package-lock.json`
- `vitest.config.ts` (create)
- `src/lib/dashboard-preferences.test.ts` (create)
- `src/lib/assignment-status.test.ts` (create)
- `src/api/assignments.test.ts` (create)
- `server/api/http.test.ts` (create)
- `server/api/files.test.ts` (create)

**Out of scope**:

- Production source files.
- Browser component tests and end-to-end browser infrastructure.
- Real Neon, Dropbox, or network calls.
- Dependency upgrades unrelated to adding Vitest.

## Git workflow

- Branch: `codex/001-test-baseline`
- Use Conventional Commits, matching history such as
  `feat(dashboard): persist user filter defaults and tighten assignment ACL`.
- Suggested commit: `test(core): establish authorization and domain regression baseline`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add Vitest as the test runner

Install a current Vitest version compatible with Vite 8 using
`npm install --save-dev vitest`. Add scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts` with Node as the default environment, the same `@`
alias as `vite.config.ts`, `clearMocks: true`, and coverage disabled for this
baseline. Import `defineConfig` from `vitest/config`; do not modify the
production Vite configuration.

**Verify**: `npm test -- --passWithNoTests` → exit 0.

### Step 2: Characterize pure domain behavior

Create colocated tests using explicit imports from `vitest` (do not enable
globals):

- `dashboard-preferences.test.ts`: missing/invalid values become `all`; every
  supported type, priority, and status survives normalization; defaults are all.
- `assignment-status.test.ts`: legacy values normalize correctly; completed is
  100%; not-started is 0%; each progress-stage label and percentage remains
  stable.
- `server/api/files.test.ts`: reserved/control filename characters are removed,
  folder segments are bounded and normalized, and invalid categories become
  `other`.

**Verify**: `npm test -- --run src/lib server/api/files.test.ts` → all new tests pass.

### Step 3: Characterize request and assignment authorization helpers

In `server/api/http.test.ts`, create minimal request doubles and verify method
validation, missing identity rejection, query parsing, and malformed JSON
handling. This test records current behavior only; Plan 002 intentionally
changes the identity assertions.

In `src/api/assignments.test.ts`, use `vi.mock("@/lib/db")` before importing the
module. Mock `initDb` and `query`—never connect to Neon. Cover at least:

1. `getAll` issues a membership-scoped query without filtering on assignee.
2. `getById` returns an assignment to a non-assigned team member when the query
   returns that membership row.
3. `updateStatus` returns `null` when the admin lookup returns no row and does
   not issue an `UPDATE`.
4. `updateProgressStage` has the same admin-only behavior.
5. Admin status mutation maps the resulting status/progress consistently.

Use fixture factories inside the test file; do not export private production
types merely for tests.

**Verify**: `npm test -- --run src/api/assignments.test.ts server/api/http.test.ts` → all tests pass and make no network calls.

### Step 4: Run the repository quality gates

**Verify**:

- `npm test` → exit 0, all tests pass.
- `npm run lint` → exit 0.
- `npm run build` → exit 0.
- `git diff --check` → no output.

## Test plan

This plan is itself the test baseline. It must add at least 15 assertions across
the five test files, including the four assignment ACL cases listed above. Do
not chase an arbitrary coverage percentage; prioritize stable domain contracts
and authorization behavior.

## Done criteria

- [ ] `npm test`, `npm run lint`, and `npm run build` exit 0.
- [ ] No test opens a network connection or requires `.env`.
- [ ] `package.json` exposes `test` and `test:watch`.
- [ ] All five specified test files exist and pass.
- [ ] No production source file changed.
- [ ] `git diff --check` returns no output.
- [ ] `plans/README.md` marks Plan 001 `DONE`.

## STOP conditions

- Vitest's compatible release requires changing Vite or React versions.
- An assignment test cannot isolate database calls without a production export
  or source refactor; report the exact blocker rather than changing production.
- The current ACL/status behavior differs materially from the excerpts.
- A verification gate fails twice after a reasonable correction.

## Maintenance notes

Plan 002 must update `server/api/http.test.ts` from header trust to JWT
verification. Plan 003 should retain the assignment ACL cases at the new HTTP
boundary rather than deleting them. Reviewers should reject tests that merely
assert SQL strings without also asserting returned behavior or blocked writes.

