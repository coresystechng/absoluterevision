# Plan 012: Redesign assignment detail as a responsive workspace

> **Executor instructions**: Follow this plan step by step and run every gate.
> Stop on any listed condition rather than improvising. Update the Plan 012
> status row when complete unless a reviewer owns `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b26563a..HEAD -- src/pages/AssignmentView.tsx src/components/AssignmentFiles.tsx src/components/Navbar.tsx src/components/ui/card.tsx`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: `plans/007-establish-ui-test-baseline.md`, `plans/008-strengthen-visual-foundations.md`, `plans/009-centralize-semantic-ui-tones.md`, `plans/010-standardize-ui-states-and-recovery.md`, `plans/011-fix-interaction-and-accessibility-states.md`
- **Category**: direction
- **Planned at**: commit `b26563a`, 2026-08-08

## Why this matters

At a 1920px viewport, the authenticated header spans `max-w-6xl` while the
assignment page contracts to `max-w-4xl` and stacks every section vertically.
Most horizontal space is unused, important workflow controls disappear down the
page, and priority/status/progress/type are repeated in both header badges and
the detail card. This plan turns the route into an operational workspace while
preserving mobile reading order, permissions, data, and actions.

## Current state

- `src/components/Navbar.tsx:38-40` establishes the authenticated `max-w-6xl`
  alignment rail.
- `src/pages/AssignmentView.tsx:305` uses `max-w-4xl` for the body.
- `src/pages/AssignmentView.tsx:320-348` renders a badge-heavy title header and
  admin actions.
- `src/pages/AssignmentView.tsx:350-458` places metadata, editable workflow,
  notes, and timestamps in one equal-weight card.
- `src/pages/AssignmentView.tsx:460-512` stacks tracking, files, and activity as
  further full-width cards.
- `AssignmentFiles` is already a self-contained Card and must remain reusable.
- Plans 008-011 are expected to provide readable tokens, semantic badges,
  recoverable state surfaces, labeled controls, safe mutations, and masked
  credentials. Reuse them; do not reimplement their responsibilities.

Current excerpt to confirm before starting:

```tsx
// src/pages/AssignmentView.tsx:305, 350, 460, 489
<main className="mx-auto grid max-w-4xl gap-6 px-4 py-6">
  {/* title */}
  <Card>{/* Assignment details */}</Card>
  <Card>{/* Client tracking */}</Card>
  <AssignmentFiles ... />
  <Card>{/* Activity */}</Card>
</main>
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Focused UI | `npm run test:ui -- src/pages/AssignmentView.test.tsx src/components/DetailPageLayout.test.tsx` | all pass |
| Full tests | `npm test` | all pass |
| Browser | `npm run test:e2e` | public suite passes; authenticated fixture if available passes |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `src/pages/AssignmentView.tsx`
- `src/pages/AssignmentView.test.tsx`
- `src/components/DetailPageLayout.tsx` (create)
- `src/components/DetailPageLayout.test.tsx` (create)
- `src/components/assignment-detail/AssignmentPageHeader.tsx` (create)
- `src/components/assignment-detail/AssignmentOverview.tsx` (create)
- `src/components/assignment-detail/AssignmentWorkflowPanel.tsx` (create)
- `src/components/assignment-detail/AssignmentTrackingPanel.tsx` (create)
- `src/components/assignment-detail/AssignmentActivity.tsx` (create)
- `src/components/AssignmentFiles.tsx` (composition/className support only)
- `e2e/assignment-detail.spec.ts` (create only if safe mocked auth infrastructure exists)

**Out of scope**:

- API/database/auth/permission changes.
- Assignment edit-dialog redesign or file-management behavior changes.
- Dashboard and Settings layouts.
- New status, progress, tracking, or activity features.
- Fabricating an authentication bypass for screenshots or tests.

## Git workflow

- Branch: `codex/012-assignment-detail-workspace`
- Suggested commit:
  `feat(assignments): redesign detail page as responsive workspace`
- Do not push or open a PR unless instructed.

## Target layout contract

Desktop (`lg` and above):

```text
Breadcrumb
Page header: title/context + deadline/progress + admin actions
12-column workspace
├── Primary column (about 8 columns)
│   ├── Overview and notes
│   ├── Files
│   └── Activity
└── Context rail (about 4 columns)
    ├── Workflow controls and assignment facts
    ├── Client tracking
    └── Created/updated metadata
```

Mobile/tablet: one column with header, workflow, overview, files, tracking, and
activity in a logical order. Do not use CSS `order` to create a visual order
that contradicts keyboard/screen-reader order.

## Steps

### Step 1: Add a reusable detail-page geometry

Create `DetailPageLayout` with named slots for header, primary content, and
context rail. It must:

- use the authenticated `max-w-6xl` alignment rail;
- use `minmax(0, ...)` columns so long titles/file names cannot overflow;
- collapse to one column below `lg`;
- optionally make the rail sticky below the 64px Navbar without exceeding the
  viewport; individual rail content must remain scrollable through the page;
- preserve DOM order and landmarks.

Test slot rendering and class/landmark contracts without snapshotting the full
DOM.

**Verify**: `npm run test:ui -- src/components/DetailPageLayout.test.tsx` -> all pass.

### Step 2: Build a concise, non-duplicative page header

Extract AssignmentPageHeader. Present:

- Back to dashboard as a breadcrumb-style link.
- Assignment title, team, and assignee context.
- One status badge and concise deadline/progress summary.
- Edit and Delete actions for admins only.

Do not repeat every attribute as a badge. Type and priority belong in the facts
panel; status/progress should have one authoritative presentation. At narrow
widths, actions wrap to full-width or a compact row without horizontal scroll.

**Verify**: AssignmentView UI test asserts one visible status label, one page `h1`, and permission-aware actions.

### Step 3: Separate overview from workflow facts

Extract AssignmentOverview for notes and the static brief. Use readable line
length (`max-w-prose` where appropriate) and show “No notes added” as a quiet
empty value, not an error.

Extract AssignmentWorkflowPanel for editable status/progress plus type,
priority, deadline, assignee, and team facts. Reuse the serialized/labeled
controls from Plan 011. Present actual progress with the existing Progress
primitive and percentage. Static member view must use the same hierarchy
without disabled controls.

Remove the duplicate header/detail badges and duplicate fact labels from the
route after extraction.

**Verify**: focused tests cover admin/member rendering, no deadline, completed, overdue, and no notes.

### Step 4: Extract tracking and activity sections

Move tracking presentation into AssignmentTrackingPanel without changing copy,
masking, or clipboard behavior from Plan 011. Keep it in the context rail on
desktop and after Files on mobile.

Move activity rendering and its retry state from Plan 010 into
AssignmentActivity. Use a proper ordered list or timeline semantics, keep times
as `<time dateTime>`, and give the empty activity state explicit copy. Do not
invent activity filtering or pagination.

**Verify**: AssignmentView tests cover masked tracking, activity error/retry, and chronological rendering.

### Step 5: Compose the route as orchestration only

Keep data loading, mutation handlers, permissions, and dialog ownership in
AssignmentView, but reduce the returned markup to the extracted sections.
Allow AssignmentFiles to accept a `className` or presentation prop only if
needed for grid composition; do not change file behavior.

Aim for AssignmentView to read as: load state -> derived permissions -> page
composition. Do not move API calls into purely presentational components.

**Verify**: `npm run lint && npm run build` -> exit 0; all AssignmentView tests pass.

### Step 6: Verify responsive hierarchy and visual density

Inspect at 1920x1080, 1440x900, 1024x768, 390x844, and 320x568 in light/dark.
Confirm:

- desktop content aligns with Navbar and uses both columns;
- rail never covers content and sticky offset clears the Navbar;
- title, access code, file names, and buttons do not overflow;
- tab order follows the visible mobile order;
- only one representation of each status/type/priority/progress fact is shown;
- member/admin permissions remain unchanged.

If no safe authenticated fixture exists, render AssignmentView with mocked API
modules in component tests and document that live-session screenshots were
skipped. Never create real client data.

**Verify**: `npm test && npm run test:ui && npm run test:e2e && npm run lint && npm run build` -> all exit 0.

## Test plan

- Layout component slot/landmark behavior.
- Assignment header fact deduplication and permissions.
- Workflow admin/member variants and progress.
- Notes empty/present, tracking masked/reveal/copy, activity loading/error/list.
- Browser or component viewport checks at 390px and desktop.

## Done criteria

- [ ] Assignment page and Navbar share `max-w-6xl` alignment.
- [ ] Desktop uses a primary column and contextual rail; mobile is one column.
- [ ] Status, priority, type, and progress are not duplicated across header and body.
- [ ] Existing edit/delete/status/progress/file/tracking/activity behaviors remain functional.
- [ ] No horizontal overflow at 320px or 390px.
- [ ] Admin/member rendering and keyboard order tests pass.
- [ ] Full test, browser, lint, and build commands pass.
- [ ] Only in-scope files changed, plus the status row if required.

## STOP conditions

- Any dependency plan is incomplete or its expected primitive/API is absent.
- Responsive composition requires moving actions ahead of content in visual but
  not DOM order.
- A safe authenticated test cannot be built without weakening auth; use
  component mocks and report the manual limitation.
- Layout requires changing AssignmentFiles behavior or API contracts.
- Verification fails twice after a scoped correction.

## Maintenance notes

- Keep route-level orchestration separate from presentational sections.
- Future rail additions must justify sticky-space cost and preserve mobile order.
- If activity becomes unbounded, introduce pagination in a separate data plan;
  do not hide entries with a fixed-height scroll box here.
