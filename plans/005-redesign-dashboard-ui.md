# Plan 005: Make the dashboard an attention-first operational workspace

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. A reviewer maintains `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f002d2a..HEAD -- src/pages/Dashboard.tsx src/components/AssignmentCard.tsx src/components/Navbar.tsx src/styles/globals.css src/lib/dashboard-view.ts src/lib/dashboard-view.test.ts src/hooks/useMediaQuery.ts src/components/DashboardFilters.tsx src/components/DashboardSummary.tsx`
> This plan was written against commit `f002d2a` plus the primary worktree's
> existing uncommitted changes on 2026-07-17. The dispatcher must snapshot
> those changes into the isolated execution worktree before implementation.
> Compare the excerpts below against that snapshot. Material mismatch is a
> STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: `plans/001-establish-test-baseline.md`
- **Category**: direction
- **Planned at**: commit `f002d2a`, 2026-07-17, including the primary worktree's existing uncommitted changes

## Why this matters

The signed-in dashboard is responsive and functional, but completed work
currently dominates the grid while the only overdue assignment is visually and
spatially subordinate. Team context is hidden in the avatar menu, card metadata
requires decoding, and opening filters on a 390px viewport adds a 394px block
that pushes the first result below the fold. The interface also uses the
Fraunces display face at weight 300 for every control and metadata label, which
reduces legibility in a dense productivity surface. This plan implements all
approved audit recommendations as one cohesive redesign without changing the
assignment data model or authorization rules.

## Current state

- `src/pages/Dashboard.tsx` owns team loading, assignment loading, search,
  filtering, sorting, dialog state, and every dashboard visual state in one
  component.
  - Lines 134-140 initialize filters, sorting, search, filter visibility, the
    assignment dialog, and `activeTeamId`.
  - Lines 185-190 filter and sort every assignment into one flat array.
  - Lines 225-380 render the page header, search bar, and an expandable five-
    control filter panel.
  - Lines 382-440 render generic errors, four fixed-height skeletons, one flat
    card grid, and a single empty state for both an empty team and no matches.
- `src/components/AssignmentCard.tsx:170-225` makes a `div` card behave as
  `role="button"` while nesting the real More actions button inside it. The
  accessibility tree consequently contains a button inside a button-like
  control.
- `src/components/AssignmentCard.tsx:47-64` colors the title by status and
  reduces priority to an initial. Lines 237-259 render progress as a percentage
  without the existing `Progress` primitive.
- `src/components/Navbar.tsx:40-43` forces the wide `img/logo.png` wordmark into
  a 32x32 square and then renders "Absolute Revision" a second time.
- `src/components/Navbar.tsx:74-86` exposes current-team context only inside
  the avatar menu. The dashboard already receives the user's team list and the
  user API already provides `updateActiveTeamSelection(userId, teamId)`.
- `src/styles/globals.css:62-65` assigns Fraunces to both `--font-sans` and
  `--font-serif`; lines 125-133 assign weight 300 to body text and every form
  control.
- Existing primitives to reuse:
  - `src/components/ui/progress.tsx` for progress visualization.
  - `src/components/ui/dialog.tsx` for an accessible mobile filter sheet.
  - `src/components/ui/badge.tsx`, `select.tsx`, `button.tsx`, and `card.tsx`.
- Existing conventions:
  - TypeScript aliases use `@/` imports.
  - Components use named exports and Tailwind utility classes.
  - Domain helpers and their Vitest tests live under `src/lib/`; model new
    tests after `src/lib/dashboard-preferences.test.ts`.
  - User-facing async failures use `toast.error(...)` and preserve the previous
    state, as demonstrated by `changeActiveTeam` in `src/pages/Settings.tsx`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Tests | `npm test` | exit 0, all tests pass |
| Lint | `npm run lint` | exit 0, no lint errors |
| Build/typecheck | `npm run build` | exit 0, TypeScript and Vite build succeed |

## Suggested executor toolkit

- Use the browser-control skill if available for the final responsive check at
  desktop and 390px widths. Do not request or expose credentials; use an
  existing signed-in local session only when available.
- Apply the repository's existing Tailwind and shadcn-style primitives. Do not
  add a component library or a new runtime dependency.

## Scope

**In scope** (the only source files that may be modified or created by the UI implementation):

- `src/pages/Dashboard.tsx`
- `src/components/AssignmentCard.tsx`
- `src/components/Navbar.tsx`
- `src/styles/globals.css`
- `src/lib/dashboard-view.ts` (create if useful)
- `src/lib/dashboard-view.test.ts` (create)
- `src/hooks/useMediaQuery.ts` (create if needed for the responsive dialog)
- `src/components/DashboardFilters.tsx` (create if needed to keep the route component maintainable)
- `src/components/DashboardSummary.tsx` (create if needed to keep the route component maintainable)

The isolated-worktree baseline may contain the operator's pre-existing changes
in other files. Those files are baseline-only and must not receive additional
implementation changes.

**Out of scope**:

- Database schemas, SQL, API response shapes, authentication, or authorization.
- Assignment-detail, assignment-dialog, Settings, Login, or Landing-page redesigns.
- New dependencies, analytics, notifications, or backend aggregation.
- Changing saved dashboard preference semantics in the database.
- Editing or replacing image assets; `img/icon.png` already exists.

## Git workflow

- Branch: `codex/005-dashboard-ui`
- Work only in the isolated worktree prepared by the executor.
- First create a baseline commit containing an exact snapshot of the primary
  worktree's existing modified and untracked files. Then commit the dashboard
  implementation separately so the reviewer can inspect `baseline..HEAD`.
- Use a conventional implementation commit such as
  `feat(dashboard): prioritize active work and improve responsive controls`.
- Do not push, merge, or open a pull request.

## Steps

### Step 1: Add tested dashboard view derivation

Create `src/lib/dashboard-view.ts` and `src/lib/dashboard-view.test.ts`.
Centralize pure logic for:

- Detecting overdue and due-soon (within the next seven calendar days)
  assignments while excluding completed assignments.
- Producing counts for overdue, due soon, ongoing, and completed work.
- Ordering incomplete work before completed work while respecting the selected
  deadline/name sort inside each group.
- Separating completed work so it can be collapsed without deleting it from
  search/filter results.

Use explicit local-date parsing consistent with the existing `dueDate` and
`dueTime` representation. Test empty input, missing deadlines, overdue,
today/due-soon boundaries, completed overdue dates, and stable ordering.

**Verify**: `npm test -- src/lib/dashboard-view.test.ts` -> all new tests pass.

### Step 2: Establish a legible brand and interface typography system

Update `src/styles/globals.css` so the UI/body stack is a readable sans serif
(system UI is acceptable and avoids a new dependency) at weight 400, while
Fraunces remains the display/brand face for headings only. Preserve the current
light/dark color tokens. Avoid global rules that silently override explicit
component font weights.

Update `src/components/Navbar.tsx` to use `img/icon.png` at 32x32 beside the
text label, or display the wide wordmark at its natural aspect ratio without a
duplicate label. The icon-plus-text option is preferred because it fits the
existing 64px header.

**Verify**: `npm run lint` -> exit 0.

### Step 3: Surface and safely switch the active team

Make the active workspace visible in or directly beneath the Dashboard heading,
including team name, role, and member count. Provide a Select-based switcher
when multiple teams exist. Persist changes through the existing
`updateActiveTeamSelection(user.id, teamId)` API, disable the control while
saving, preserve the prior selection on failure, and show success/error toast
feedback. Do not duplicate team-management actions from Settings.

The navbar avatar menu may retain a concise current-team label, but it must no
longer be the only visible context. When the active user is not an administrator,
replace the unexplained disabled New assignment control with a tooltip-equivalent
visible explanation or supporting text.

**Verify**: `npm run build` -> exit 0.

### Step 4: Reframe the dashboard around attention and progress

Add a compact summary surface using existing assignment data: Overdue, Due
soon, Ongoing, and Completed. Summary items may act as accessible filters when
that interaction is clear and reversible; otherwise keep them informational and
provide quick-view chips for All work, Needs attention, and In progress.

Render incomplete/attention work first. Render completed assignments in a
separate, collapsed-by-default section, but automatically reveal that section
when the explicit status filter or quick view requests completed work. Preserve
search and saved filter behavior. Use headings and result counts so sections
remain understandable to screen-reader and sighted users.

**Verify**: `npm test` -> all tests pass.

### Step 5: Redesign assignment cards for scanning and native semantics

Update `src/components/AssignmentCard.tsx` so the card navigation is a real
React Router `Link`, not a `role="button"` container. The More actions button
must remain a separate sibling interactive control, never nested inside the
link. Provide a visible focus treatment covering the card or link target.

Present:

- A neutral title plus explicit status badge.
- Assignment type text alongside its icon.
- Full High/Medium/Low priority text rather than an initial-only circle.
- An explicit formatted deadline plus relative urgency where useful.
- The existing assignee.
- An accessible `Progress` bar with percentage.

Completed cards should be quieter than overdue/ongoing cards. Preserve editing,
deleting, and assignment-dialog behavior.

**Verify**: `npm run lint` and `npm run build` -> both exit 0.

### Step 6: Make filtering compact, responsive, and reversible

Extract a reusable `DashboardFilters` component if it keeps Dashboard.tsx from
growing further. On desktop, retain a compact inline panel. On viewports below
the existing `sm` breakpoint, present the five controls in an accessible Radix
Dialog styled as a bottom sheet or full-height drawer rather than an inline
394px block. Reuse one filter-form component between desktop and mobile instead
of duplicating filter logic.

Add:

- A shorter placeholder, "Search assignments", while keeping the detailed
  accessible label.
- Visible active-filter chips beneath the toolbar.
- One-click removal per chip and a Clear all action.
- Apply and Clear actions in the mobile sheet.
- A compact ascending/descending control rather than spending a full mobile row
  on a verbose order dropdown, while preserving accessible names.

At 390px width the page must have no horizontal overflow, and the first result
must remain visible without a permanently expanded filter block.

**Verify**: `npm run build` -> exit 0.

### Step 7: Make loading, error, and empty states specific and actionable

Match skeleton height and internal shape to the redesigned assignment card and
render enough skeletons for the active grid columns. Give loading containers an
appropriate accessible status label without announcing every skeleton.

Add retry buttons wired to `reloadTeams` and the `reload` function already
returned by `useAssignments`. Render distinct messaging/actions for:

- No active team.
- Active team with no assignments.
- Search or filters producing no matches (include Clear filters).
- Team-loading failure.
- Assignment-loading failure.
- Member role without create permission.

Do not show "Create your first assignment" when assignments exist but are
hidden by search or filters.

**Verify**: `npm run lint`, `npm test`, and `npm run build` -> all exit 0.

### Step 8: Perform the responsive and interaction review

Use the local development server and an existing signed-in browser session when
available. Inspect dark theme at approximately 1280px desktop and 390x844
mobile; inspect light theme if it can be done without altering persistent user
settings. Confirm:

- Overdue/incomplete work appears before completed work.
- The active team is visible and the switcher has an unambiguous label.
- Completed work is collapsed by default and can be revealed.
- Search, quick views, detailed filters, chips, Clear all, and mobile Apply work.
- Opening mobile filters does not create horizontal overflow or permanently
  push results below an inline panel.
- Card links and More actions are separate tab stops with visible focus.
- New assignment remains available to admins and has explanatory treatment for
  members.

If no signed-in session is available, report that browser verification was
skipped; do not create credentials or weaken auth.

**Verify**: `npm run lint && npm test && npm run build` -> all exit 0.

## Test plan

- Create `src/lib/dashboard-view.test.ts`, modeled after
  `src/lib/dashboard-preferences.test.ts`.
- Cover summary counts, overdue and seven-day due-soon boundaries, completed
  exclusions, missing deadlines, empty arrays, and attention-first ordering.
- Preserve and run the entire existing Vitest suite.
- UI behavior is verified through lint/typecheck/build plus the responsive
  browser checklist because the repo does not currently include React Testing
  Library.

## Done criteria

- [ ] `npm run lint` exits 0.
- [ ] `npm test` exits 0 and the new dashboard-view tests pass.
- [ ] `npm run build` exits 0.
- [ ] `rg 'role="button"' src/components/AssignmentCard.tsx` returns no matches.
- [ ] `rg 'from "../../img/icon.png"' src/components/Navbar.tsx` returns one match, or the alternative natural-ratio wordmark implementation is documented.
- [ ] `rg 'Progress' src/components/AssignmentCard.tsx` confirms the existing progress primitive is used.
- [ ] Implementation changes relative to the isolated baseline touch only the in-scope source files.
- [ ] Browser verification passes at desktop and 390px, or lack of an authenticated session is explicitly documented.

## STOP conditions

Stop and report back instead of improvising if:

- The isolated worktree does not contain an exact snapshot of the operator's
  pre-existing modifications before UI implementation starts.
- The current Dashboard, Navbar, or user API no longer matches the current-state
  descriptions above.
- Active-team switching requires an API or database change; the existing
  `updateActiveTeamSelection` contract must be sufficient.
- A responsive filter sheet requires a new dependency rather than the existing
  Radix Dialog primitives.
- Any recommendation appears to require changing authorization or exposing
  assignment data outside the active team.
- Any verification command fails twice after a reasonable correction.

## Maintenance notes

- Future assignment statuses must update the summary derivation, card badge
  mapping, and dashboard-view tests together.
- Keep persisted detailed filters independent from transient quick views unless
  product requirements explicitly change preference semantics.
- Review the mobile dialog for focus trapping and restore-focus behavior after
  Radix upgrades.
- The summary is derived client-side because assignments are already loaded;
  if server pagination is later introduced, counts must move to a server
  aggregate rather than representing only the current page.
