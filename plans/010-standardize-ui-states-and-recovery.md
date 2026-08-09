# Plan 010: Standardize loading, empty, error, and recovery states

> **Executor instructions**: Execute each step and its verification gate in
> order. Stop rather than improvising if a STOP condition occurs. Update the
> Plan 010 row in `plans/README.md` on completion unless a reviewer owns it.
>
> **Drift check (run first)**: `git diff --stat b26563a..HEAD -- src/App.tsx src/pages/Login.tsx src/pages/AssignmentView.tsx src/pages/Dashboard.tsx src/pages/AssignmentTracking.tsx src/pages/Settings.tsx src/components/AssignmentFiles.tsx src/hooks/useTeams.ts src/hooks/useAssignments.ts`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: `plans/007-establish-ui-test-baseline.md`, `plans/008-strengthen-visual-foundations.md`, `plans/009-centralize-semantic-ui-tones.md`
- **Category**: bug
- **Planned at**: commit `b26563a`, 2026-08-08

## Why this matters

Similar asynchronous outcomes currently render as blank screens, passive text,
generic skeletons, or misleading empty states. AssignmentView converts network
failures into “not found,” Settings can convert a team-load failure into “create
a team,” and several error cards say “Try again” without a retry control. This
plan gives every route/section a mutually exclusive state model and a visible
recovery path while retaining known-good data during refreshes.

## Current state

- `src/App.tsx:49-50` returns `null` while auth is pending.
- `src/pages/AssignmentView.tsx:175-189` catches any assignment/activity load
  failure only with a toast; lines 524-529 render any null assignment as not
  found.
- `src/pages/Dashboard.tsx:450-508` can render error cards followed by loading,
  results, or the generic zero-results state; error copy has no button despite
  `reloadTeams` and `useAssignments.reload` existing.
- `src/hooks/useTeams.ts:11-28` exposes team errors, while its member request
  lacks an independent error state.
- `src/pages/Settings.tsx` does not render the hook's team error and can show an
  empty-workspace message after a request failure.
- `src/components/AssignmentFiles.tsx:239-257` retains an error string but its
  rendered error panel has no retry action.
- `src/pages/AssignmentTracking.tsx:103-107` implements four near-identical
  one-line state cards.

Current excerpt to confirm before starting:

```tsx
// src/pages/AssignmentView.tsx:175-189, 524-529
setIsLoading(true)
void getOrCreateUser(user)
  .then(() => Promise.all([
    assignmentApi.getById(user.id, id),
    assignmentApi.getActivities(user.id, id),
  ]))
  .catch(() => toast.error("Something went wrong. Try again."))
  .finally(() => setIsLoading(false))

// Later, every null value becomes the same state:
<p className="text-sm text-muted-foreground">Assignment not found.</p>
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Focused UI | `npm run test:ui -- src/components/StatePanel.test.tsx src/pages/AssignmentView.test.tsx src/App.test.tsx` | all pass |
| Full tests | `npm test` | all pass |
| Browser | `npm run test:e2e` | all pass |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `src/components/StatePanel.tsx` (create)
- `src/components/StatePanel.test.tsx` (create)
- `src/components/RoutePending.tsx` (create)
- `src/App.tsx`
- `src/App.test.tsx` (create)
- `src/pages/Login.tsx`
- `src/pages/AssignmentView.tsx`
- `src/pages/AssignmentView.test.tsx` (create)
- `src/pages/Dashboard.tsx`
- `src/pages/Dashboard.test.tsx` (create if needed)
- `src/pages/AssignmentTracking.tsx`
- `src/pages/AssignmentTracking.test.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Settings.test.tsx` (create if needed)
- `src/components/AssignmentFiles.tsx`
- `src/components/AssignmentFiles.test.tsx` (create if needed)
- `src/hooks/useTeams.ts`
- `src/hooks/useAssignments.ts`

**Out of scope**:

- Page geometry, status/priority colors, destructive confirmation behavior, or
  assignment mutation serialization; later plans own those concerns.
- API/database contract changes or authentication weakening.
- Global state libraries or data-fetching dependencies.
- Exposing raw server/credential/configuration details to end users.

## Git workflow

- Branch: `codex/010-ui-states-recovery`
- Suggested commit:
  `fix(ui): distinguish async states and add recovery actions`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add reusable page/section state primitives

Create `StatePanel` with explicit props for:

- context/size: `page`, `section`, or `inline`;
- tone: `neutral`, `info`, `warning`, `error`, or `success`;
- icon, title, description, primary action, and optional secondary action;
- live-region behavior supplied deliberately by the caller.

Create `RoutePending` as a branded full-page loading state with one concise
status announcement and skeleton structure matching the authenticated shell.
Do not announce every skeleton. StatePanel must use semantic tokens from Plan
009 and remain readable at 320px.

Test every tone, action invocation, accessible title/description, and live
region opt-in.

**Verify**: `npm run test:ui -- src/components/StatePanel.test.tsx` -> all pass.

### Step 2: Make authentication transitions continuous

Replace `return null` during session resolution with `RoutePending`. Preserve
the requested authenticated path in router location state when redirecting to
login, and have Login return there after successful authentication; default to
`/dashboard` only when no safe internal destination exists. Reject absolute or
protocol-relative destinations.

Login must wait for its own session resolution before showing the form so the
user does not see a form flash before redirect.

**Verify**: `npm run test:ui -- src/App.test.tsx` -> covers pending, unauthenticated redirect with `from`, authenticated render, and unsafe-destination fallback.

### Step 3: Give AssignmentView a discriminated load state

Model `loading`, `success`, `not-found`, and `error` explicitly. A successful
`getById` result of null is the only path to not-found. Network, authorization,
or server rejection produces an error StatePanel with Retry and Back to
dashboard actions.

Treat activities as secondary data: once the assignment loads, an activity
request failure must not hide the assignment. Store a separate activity error
and show a retryable inline state in the Activity section while the rest of the
page remains usable. During refresh, retain known-good assignment data and use
`aria-busy` rather than replacing the whole page.

Guard against stale responses after route ID/user changes with cancellation or
request identity. Do not surface arbitrary server text.

**Verify**: `npm run test:ui -- src/pages/AssignmentView.test.tsx` -> loading, null, error, retry-success, activity-only failure, and stale response cases pass.

### Step 4: Make Dashboard states mutually exclusive and actionable

Destructure `reload` from `useAssignments`. Establish precedence:

1. team loading/error/no-team;
2. assignment loading/error;
3. populated results;
4. active search/filter with zero matches;
5. active team with zero assignments.

Use StatePanel with actual retry handlers. Never show the generic empty state
under an error. Preserve assignment data during a refresh if the hook already
has known-good data; expose `isRefreshing` separately if needed without changing
the hook's public mutation contracts.

**Verify**: focused Dashboard UI tests assert only one state is visible and Retry calls the correct loader.

### Step 5: Expose team/member failures in Settings

Extend `useTeams` with a separate `membersError` while preserving `error` for
team loading. Clear each error only when its corresponding request starts;
retain known-good lists during refresh failures. Return `reloadMembers` and
render team/member StatePanels with retry actions in Settings.

Do not turn a failed request into “Create a team” or “No members yet.” Keep
permission-based empty states distinct from failures.

**Verify**: Settings/hook tests cover team failure, member failure, retained data, and retry recovery.

### Step 6: Migrate section-level file and public tracking states

In AssignmentFiles, reuse StatePanel for loading/configuration/connection/error
outcomes where appropriate and wire error Retry to `loadFiles`. Preserve the
specific owner/member guidance and do not expose secret values.

In AssignmentTracking, replace the four ad hoc cards with consistent state
surfaces. Not-found should point users back to the fields; rate-limited should
say when to retry; temporary error should provide a retry action using the last
validated input without retaining the private access code longer than needed.
Preserve the existing polite live region and focus-on-success behavior.

**Verify**: `npm run test:ui -- src/pages/AssignmentTracking.test.tsx src/components/AssignmentFiles.test.tsx` -> all pass.

### Step 7: Run state-matrix browser verification

Use intercepted public API responses to inspect loading, not-found, rate-limit,
error, and success at desktop/390px. If a safe authenticated session exists,
inspect auth pending and assignment retry states; otherwise rely on component
tests and document the skipped manual check.

**Verify**: `npm test && npm run test:ui && npm run test:e2e && npm run lint && npm run build` -> all exit 0.

## Test plan

- StatePanel: every tone, context, action, and live-region mode.
- App/Login: pending session, deep-link preservation, safe redirect validation.
- AssignmentView: critical vs secondary request failures and retries.
- Dashboard/Settings/Files: state precedence and retained-data refresh.
- Tracking: all six existing view states with focus and live-region assertions.

## Done criteria

- [ ] No protected-route pending path returns `null`.
- [ ] AssignmentView never maps a rejected request to not-found.
- [ ] Every visible “Try again” has a functioning action.
- [ ] Error and empty states are mutually exclusive on Dashboard and Settings.
- [ ] Known-good data is retained during refresh failure where available.
- [ ] All focused/full test, browser, lint, and build commands pass.
- [ ] Only in-scope files changed, plus the plan status row if required.

## STOP conditions

- Safe redirect preservation requires changing Neon Auth's external contract.
- Distinguishing not-found from forbidden is impossible with the current API;
  preserve the existing privacy-safe message and report the limitation.
- A shared state primitive requires a new component library.
- Request cancellation would require changing API response shapes.
- Verification fails twice after a scoped correction.

## Maintenance notes

- Future data hooks should expose `data`, `initialLoading`, `refreshing`,
  `error`, and `retry` distinctly rather than overloading null/empty arrays.
- Keep state copy domain-specific even though layout/tone is shared.
- Review live regions for duplicate announcements when nested state panels are
  present.
