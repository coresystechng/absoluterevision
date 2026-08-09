# Plan 009: Centralize semantic status, priority, progress, and file tones

> **Executor instructions**: Follow the plan in order and stop on any listed
> escape condition. Update the Plan 009 status row when complete unless a
> reviewer maintains `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b26563a..HEAD -- src/styles/globals.css src/components/ui/badge.tsx src/lib/assignment-status.ts src/components/AssignmentCard.tsx src/pages/AssignmentView.tsx src/components/AssignmentFiles.tsx src/pages/AssignmentTracking.tsx src/pages/DocumentUpload.tsx`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: `plans/007-establish-ui-test-baseline.md`, `plans/008-strengthen-visual-foundations.md`
- **Category**: tech-debt
- **Planned at**: commit `b26563a`, 2026-08-08

## Why this matters

The same domain meaning currently changes color between screens: High priority
is green in AssignmentView but red on dashboard cards. Success, warning,
progress, urgency, and file-type styling are hard-coded in several components,
and some file badges have no dark variants. This plan gives UI code a typed,
semantic vocabulary so brand green, urgency, progress, and feedback no longer
compete or drift.

## Current state

- `src/components/ui/badge.tsx:11-16` hard-codes primary, emerald, and amber.
- `src/pages/AssignmentView.tsx:323` renders priority through the default green
  badge regardless of High/Medium/Low.
- `src/components/AssignmentCard.tsx:53-60` separately maps High to red,
  Medium to yellow, and Low to neutral.
- `src/lib/assignment-status.ts:16-21` embeds stage color class strings; lines
  86-118 embed more fallback/status color strings.
- `src/components/AssignmentFiles.tsx:103-173` embeds file visual palettes that
  lack dark-mode background/border counterparts.
- Use `class-variance-authority` and typed domain helpers, matching the current
  Badge and assignment-status conventions.

Current excerpts to confirm before starting:

```tsx
// src/components/ui/badge.tsx:11-16
default: "border-transparent bg-primary text-primary-foreground",
success: "border-emerald-200 bg-emerald-50 text-emerald-700 ...",
warning: "border-amber-200 bg-amber-50 text-amber-700 ...",

// src/pages/AssignmentView.tsx:322-326
<Badge>{titleCase(assignment.priority)}</Badge>
<Badge variant={statusBadgeVariant}>
  {getAssignmentStatusLabel(assignment.status)}
</Badge>
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Focused tests | `npm test -- src/lib/assignment-presentation.test.ts src/lib/file-presentation.test.ts src/lib/assignment-status.test.ts` | all pass |
| UI tests | `npm run test:ui` | all pass |
| Browser | `npm run test:e2e` | all pass |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `src/styles/globals.css`
- `src/components/ui/badge.tsx`
- `src/components/ui/progress.tsx`
- `src/lib/assignment-presentation.ts` (create)
- `src/lib/assignment-presentation.test.ts` (create)
- `src/lib/file-presentation.ts` (create)
- `src/lib/file-presentation.test.ts` (create)
- `src/lib/assignment-status.ts`
- `src/lib/assignment-status.test.ts`
- `src/components/AssignmentCard.tsx`
- `src/pages/AssignmentView.tsx`
- `src/components/AssignmentFiles.tsx`
- `src/pages/AssignmentTracking.tsx`
- `src/pages/DocumentUpload.tsx`

**Out of scope**:

- Changing assignment status/stage values, progress percentages, database
  fields, API payloads, or user-facing stage vocabulary.
- Changing file upload validation or supported extensions.
- Assignment page geometry; Plan 012 owns layout.
- Adding a third-party design system or color library.

## Git workflow

- Branch: `codex/009-semantic-ui-tones`
- Suggested commit:
  `refactor(ui): centralize semantic assignment and feedback tones`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Define theme-level semantic color triplets

Add foreground/background/border tokens for at least:

- success/completed;
- warning/ongoing;
- danger/high-priority/overdue;
- info/in-progress context;
- neutral/not-started/low-priority.

Each token must exist in light and dark themes, map through `@theme inline`, and
pass the Plan 008 text/boundary contrast tests. Brand `primary` remains for
primary actions and identity, not generic completion or High priority.

**Verify**: `npm test -- src/styles/theme-tokens.test.ts` -> all pass.

### Step 2: Create typed assignment presentation helpers

Create `src/lib/assignment-presentation.ts` with explicit types and helpers for:

- priority label and semantic badge variant/class;
- status label and semantic tone;
- deadline urgency tone (`overdue`, `due-soon`, `normal`, `none`);
- progress stage tone while retaining the existing six percentages.

Return semantic variant names or complete static class strings that Tailwind
can discover; never construct class names dynamically. Remove duplicate
priority/status color decisions from AssignmentCard and AssignmentView.

Tests must cover every priority, status, stage, completed override, overdue,
due-soon, no-deadline, and fallback case.

**Verify**: `npm test -- src/lib/assignment-presentation.test.ts src/lib/assignment-status.test.ts` -> all pass.

### Step 3: Expand Badge and Progress semantic variants

Add typed Badge variants such as `success`, `warning`, `danger`, `info`, and
`neutral` backed by the new tokens. Keep `default`, `secondary`, and `outline`
for non-semantic uses. If Progress gains a tone prop, preserve the existing
`indicatorClassName` API during migration or update all call sites in scope in
one commit.

**Verify**: `npm run lint && npm run build` -> exit 0.

### Step 4: Migrate assignment surfaces consistently

Update AssignmentCard, AssignmentView, AssignmentTracking, and
assignment-status helpers so:

- High is danger, Medium is warning, Low is neutral everywhere.
- Ongoing is warning/in-progress, Completed is success, Not started is neutral.
- Deadline urgency is expressed consistently without relying on color alone;
  retain icon/text labels such as Overdue.
- Progress stage color never changes title text color; assignment titles remain
  neutral and readable.
- Upcoming public milestone descriptions use readable muted text, not
  `text-muted-foreground/60`; hierarchy comes from icon/connector/surface.

**Verify**: `rg -n 'text-muted-foreground/60|text-muted-foreground/50' src/pages/AssignmentTracking.tsx` -> no unreadable future-step text matches; focused tests pass.

### Step 5: Centralize file visuals and feedback treatments

Move extension/MIME-to-icon-label-tone presentation from AssignmentFiles into
`src/lib/file-presentation.ts`. Keep icons in the component if necessary, but
the file type and semantic tone mapping must be centralized and dark-safe.
Migrate DocumentUpload's success treatment to the shared success tokens.

Test PDF, Word, presentation, spreadsheet, image, archive, generic text, and
unknown file mappings. Do not change acceptance or size rules.

**Verify**: `npm test -- src/lib/file-presentation.test.ts` -> all pass; `rg -n 'bg-(red|blue|orange|emerald|sky|violet)-50' src/components/AssignmentFiles.tsx` -> no matches.

### Step 6: Run visual regression checks

Inspect semantic states in light/dark at desktop and 390px. Confirm meaning is
never color-only, High no longer appears green, and file badges remain subdued
on dark cards.

**Verify**: `npm test && npm run test:ui && npm run test:e2e && npm run lint && npm run build` -> all exit 0.

## Test plan

- Pure helper tests exhaust every union member.
- Existing assignment-status tests are updated to assert semantic output rather
  than Tailwind hue names such as `green`.
- UI tests assert visible labels/roles, not exact class strings unless testing
  the presentation helper itself.
- Browser checks cover public tracking future/current/completed milestones.

## Done criteria

- [ ] High/Medium/Low use one presentation helper across list and detail views.
- [ ] Assignment status and deadline urgency use semantic tokens.
- [ ] File badges have explicit dark-safe treatments.
- [ ] Upcoming milestone normal text reaches at least 4.5:1.
- [ ] No domain values, progress percentages, or API contracts changed.
- [ ] All test, lint, build, and browser commands pass.
- [ ] Only in-scope files changed, plus the plan status row if required.

## STOP conditions

- A semantic mapping requires changing stored status/stage values.
- Tailwind cannot discover the helper's classes without a broad safelist;
  replace dynamic construction with static mappings rather than adding one.
- Contrast cannot be met within the token system established by Plan 008.
- A verification command fails twice after a scoped correction.

## Maintenance notes

- New statuses, priorities, or stages must update the typed helper and its
  exhaustive tests in the same change.
- File colors are secondary recognition aids; filename, extension label, and
  icon remain the primary identification mechanisms.
- Reviewers should reject new raw semantic palette classes in route components.
