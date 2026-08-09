# Plan 013: Reconcile the dashboard as an attention-first workspace

> **Executor instructions**: This plan supersedes stale Plan 005. Do not execute
> `plans/005-redesign-dashboard-ui.md`; its baseline and verification commit are
> not present in the current repository. Follow this file and every verification
> gate. Update Plan 013 in `plans/README.md` when complete.
>
> **Drift check (run first)**: `git diff --stat b26563a..HEAD -- src/pages/Dashboard.tsx src/components/AssignmentCard.tsx src/components/Navbar.tsx src/hooks/useAssignments.ts src/hooks/useTeams.ts src/api/users.ts src/lib/dashboard-preferences.ts`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: `plans/007-establish-ui-test-baseline.md`, `plans/008-strengthen-visual-foundations.md`, `plans/009-centralize-semantic-ui-tones.md`, `plans/010-standardize-ui-states-and-recovery.md`, `plans/011-fix-interaction-and-accessibility-states.md`
- **Category**: direction
- **Planned at**: commit `b26563a`, 2026-08-08

## Why this matters

Plan 005 is marked done, but the current dashboard still renders one flat grid,
hides team context in the avatar menu, uses an inline mobile filter block, and
does not separate completed work or expose actionable retry states. Its claimed
verification commit `e128398` is absent locally, and current code fails multiple
Plan 005 done criteria. This plan reconciles the intended attention-first
workspace against current HEAD and the new UI foundations instead of trying to
execute stale instructions.

## Current state

- `plans/README.md:16` marks Plan 005 done at `e128398`; `git cat-file` cannot
  resolve that commit in this repository.
- `src/pages/Dashboard.tsx:165-224` stores filters, sort, search, active team,
  and derives one flat `filteredAssignments` list.
- `src/pages/Dashboard.tsx:267-279` shows no active-team name, role, member
  count, or switcher near the page heading.
- `src/pages/Dashboard.tsx:345-448` expands five inline controls at all widths.
- `src/pages/Dashboard.tsx:450-508` renders generic state cards and one empty
  message for several different causes.
- `src/components/AssignmentCard.tsx` is expected to have semantic link/menu
  behavior and centralized tones after Plans 009 and 011; reuse those results.
- `src/api/users.ts:177-207` already exposes
  `updateActiveTeamSelection(userId, teamId)`.
- `src/hooks/useAssignments.ts:32-48` already exposes `reload`; do not add a new
  data-fetching abstraction.
- Persisted filters remain `type`, `priority`, and `status` only. Quick views
  and sort are transient unless product requirements later change.

Current excerpts to confirm before starting:

```tsx
// src/pages/Dashboard.tsx:216-222
const filteredAssignments = useMemo(
  () => [...assignments]
    .filter((assignment) =>
      matchesFilters(filters, assignment) &&
      matchesSearch(assignment, searchQuery),
    )
    .sort((a, b) => compareAssignments(a, b, sortField, sortDirection)),
  [assignments, filters, searchQuery, sortDirection, sortField],
)

// src/pages/Dashboard.tsx:345-348
{filtersOpen ? (
  <div id="dashboard-filters"
    className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Pure tests | `npm test -- src/lib/dashboard-view.test.ts` | all pass |
| UI tests | `npm run test:ui -- src/pages/Dashboard.test.tsx src/components/DashboardFilters.test.tsx` | all pass |
| Full tests | `npm test` | all pass |
| Browser | `npm run test:e2e` | all configured tests pass |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `src/pages/Dashboard.tsx`
- `src/pages/Dashboard.test.tsx`
- `src/components/AssignmentCard.tsx` (dashboard-specific presentation only)
- `src/components/AssignmentCard.test.tsx`
- `src/components/DashboardSummary.tsx` (create)
- `src/components/DashboardFilters.tsx` (create)
- `src/components/DashboardFilters.test.tsx` (create)
- `src/lib/dashboard-view.ts` (create)
- `src/lib/dashboard-view.test.ts` (create)
- `src/hooks/useMediaQuery.ts` (create only if needed)
- `src/api/users.ts` (existing function import/use only; no contract change)
- `e2e/dashboard.spec.ts` (create only if a safe mocked/authenticated fixture exists)

**Out of scope**:

- Database/schema/API response/auth/authorization changes.
- Settings, AssignmentView, public pages, or AssignmentDialog redesign.
- Persisting quick view, sort, search, completed-section expansion, or mobile
  sheet state to the database.
- Notifications, analytics, backend aggregation, or server pagination.
- Reintroducing any global styling already owned by Plans 008-009.

## Git workflow

- Branch: `codex/013-dashboard-workspace`
- Suggested commit:
  `feat(dashboard): reconcile attention-first assignment workspace`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add tested dashboard view derivation

Create pure helpers for:

- calendar-safe deadline parsing from `dueDate`/`dueTime`;
- overdue and due-soon (next seven calendar days) detection, excluding
  completed assignments;
- counts for overdue, due soon, ongoing, and completed;
- quick views: all work, needs attention, in progress, completed;
- stable attention-first ordering that groups incomplete before completed while
  respecting selected name/deadline sort within each group;
- separating incomplete and completed results after search/filter/quick view.

Test empty data, null deadlines, today and seven-day boundaries, completed old
deadlines, stable equal-key ordering, search/filter combinations, and explicit
completed view behavior. Do not use `Date.parse("YYYY-MM-DD")` in a way that
introduces UTC/local drift.

**Verify**: `npm test -- src/lib/dashboard-view.test.ts` -> all pass.

### Step 2: Surface and safely switch the active workspace

Directly under the Dashboard heading, show active team name, current role, and
member count. When multiple teams exist, provide a labeled Select switcher.

On change:

- keep the previous active team until persistence succeeds;
- call `updateActiveTeamSelection(user.id, teamId)`;
- disable the switcher while saving;
- update active ID only from the returned profile;
- reload members/assignments through existing hook dependencies;
- show success/error feedback and restore the prior selection on failure.

If the user is a member, explain why New assignment is unavailable using the
Plan 011 visible-description pattern. Do not duplicate team management from
Settings.

**Verify**: Dashboard tests cover one team, multiple-team success, rejection rollback, and member permissions.

### Step 3: Add an attention summary and reversible quick views

Create DashboardSummary using existing assignments. Show Overdue, Due soon,
Ongoing, and Completed counts. Use buttons only if they actually filter; each
must expose selected state and a clear way back to All work. Keep summary
compact and do not represent it as global data once server pagination exists.

Render incomplete work first. Render completed work in a separate section,
collapsed by default, but reveal it automatically when the persisted status
filter or transient quick view explicitly requests completed work. Section
headings must include result counts.

**Verify**: Dashboard tests cover summary counts, quick-view toggling, completed collapse/reveal, and zero-count states.

### Step 4: Make filters compact and mobile-appropriate

Extract one filter-form body into DashboardFilters. Desktop may use a compact
inline panel. Below `sm`, open the same form in an accessible Radix Dialog
styled as a bottom sheet/full-height sheet, with Apply and Clear actions.

Requirements:

- search placeholder `Search assignments` with detailed accessible label;
- visible removable active-filter chips and Clear all;
- type, priority, status, sort field, and sort direction controls;
- compact direction control with an accessible name;
- no duplicated IDs or simultaneous focusable desktop/mobile copies;
- opening filters at 390px must not permanently push results down the page.

Use existing Dialog primitives; add no dependency.

**Verify**: DashboardFilters tests cover open/close, focus restore, Apply, Clear, chips, Escape, and desktop/mobile state sharing.

### Step 5: Finish card scanning and result presentation

Build on Plan 011's semantic card link/menu. Confirm each card presents:

- neutral title;
- explicit status badge;
- type icon plus full type text;
- full priority label, not only H/M/L;
- explicit deadline and relative urgency;
- assignee;
- accessible progress bar and percentage.

Completed cards should be quieter without lowering text below contrast targets.
Do not color the assignment title by progress stage.

**Verify**: AssignmentCard tests cover all three statuses/priorities, missing deadline/assignee, focus, link/menu separation, and progress accessible value.

### Step 6: Use the shared state vocabulary precisely

Use StatePanel and hook reload functions from Plan 010 for distinct states:

- team loading/failure/no team;
- assignment loading/failure;
- active team with no assignments;
- search/filter with no matches;
- member without create permission.

Provide Retry/Clear filters/Create assignment/Go to Settings actions only when
valid. Never show “Create your first assignment” when assignments merely fail
the current query.

**Verify**: Dashboard state-precedence tests pass and each retry invokes the correct loader.

### Step 7: Run responsive and interaction verification

Inspect desktop, 1024px, 390x844, and 320px in light/dark. Confirm summary,
team switcher, search, chips, mobile sheet, incomplete/completed sections, cards,
empty/error states, dialogs, and focus behavior. Do not create credentials; use
component mocks if no safe session exists.

**Verify**: `npm test && npm run test:ui && npm run test:e2e && npm run lint && npm run build` -> all exit 0.

## Test plan

- Pure dashboard-view boundary and ordering tests.
- Dashboard team switch, summary, quick views, grouping, state precedence.
- Filter desktop/mobile behavior and focus management.
- Assignment card semantics/content.
- Browser viewport checks where safe.

## Done criteria

- [ ] Active team name, role, member count, and switcher are visible near heading.
- [ ] Summary counts and quick views are tested and reversible.
- [ ] Incomplete work precedes a separate collapsed completed section.
- [ ] Mobile filters use a dialog/sheet and do not push results down the page.
- [ ] Cards use semantic links and full status/type/priority/deadline/progress labels.
- [ ] Error/empty states are distinct and actionable.
- [ ] No horizontal overflow at 320px/390px.
- [ ] All test, browser, lint, and build commands pass.
- [ ] Only in-scope files changed, plus the Plan 013 status row.

## STOP conditions

- Plans 007-011 are incomplete or their expected primitives are absent.
- Active-team switching requires an API/database change; the existing function
  must be sufficient.
- Mobile filters require a new dependency.
- Counts would represent only a server-paginated subset; stop and propose a
  server aggregate plan instead.
- A safe authenticated browser check would require weakening auth.
- Verification fails twice after a scoped correction.

## Maintenance notes

- If server pagination is added, summary counts must move server-side.
- New statuses update dashboard-view derivation, semantic presentation, and
  tests together.
- Keep persisted filters distinct from transient quick views unless the data
  model is deliberately expanded.
- Plan 005 remains historical/stale; future reconciliation should target this
  plan and current HEAD.
