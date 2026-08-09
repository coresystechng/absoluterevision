# Plan 011: Fix interaction semantics, pending actions, and accessibility

> **Executor instructions**: Follow every step and gate. Do not broaden the
> scope when a STOP condition occurs. Update Plan 011 in `plans/README.md` when
> complete unless a reviewer maintains the index.
>
> **Drift check (run first)**: `git diff --stat b26563a..HEAD -- src/components/AssignmentCard.tsx src/components/ConfirmDialog.tsx src/components/ui/alert-dialog.tsx src/components/AssignmentDialog.tsx src/pages/AssignmentView.tsx src/pages/Dashboard.tsx src/pages/Settings.tsx src/components/Navbar.tsx src/components/ThemeToggle.tsx`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: `plans/007-establish-ui-test-baseline.md`, `plans/009-centralize-semantic-ui-tones.md`, `plans/010-standardize-ui-states-and-recovery.md`
- **Category**: bug
- **Planned at**: commit `b26563a`, 2026-08-08

## Why this matters

The dashboard card is a button-like container with a real dropdown inside it,
several Selects have no programmatic label, and async destructive actions can
dismiss before success or run twice. Status/progress requests can also resolve
out of order. These are functional interaction defects, not cosmetic details;
this plan gives mouse, keyboard, touch, and assistive-technology users one
predictable contract.

## Current state

- `src/components/AssignmentCard.tsx:172-232` applies `role="button"`, custom
  Enter/Space navigation, and event propagation guards around a nested menu.
- `src/components/ConfirmDialog.tsx:28-39` fires an async callback without
  tracking pending/error state; Radix action dismissal is immediate.
- `src/components/AssignmentDialog.tsx:263-336` displays Assignee, Priority,
  Status, and Progress labels without connecting them to Select triggers.
- `src/pages/AssignmentView.tsx:223-246` allows concurrent status and progress
  requests; triggers at lines 381-425 remain enabled and unlabeled.
- Successful assignment deletions use `toast.error` in AssignmentView,
  Dashboard, and Settings.
- `src/components/ThemeToggle.tsx:13-31` already supports a compact shell mode,
  but Navbar does not render it.
- Client tracking credentials are rendered in full by default in
  `src/pages/AssignmentView.tsx:460-473`.

Current excerpts to confirm before starting:

```tsx
// src/components/AssignmentCard.tsx:172-181
<Card
  role="button"
  tabIndex={0}
  onClick={() => navigate(`/assignments/${assignment.id}`)}
  onKeyDown={(event) => {
    if (event.key === "Enter" || event.key === " ") {
      navigate(`/assignments/${assignment.id}`)
    }
  }}
>

// src/components/ConfirmDialog.tsx:37-38
<AlertDialogCancel>Cancel</AlertDialogCancel>
<AlertDialogAction onClick={() => void onConfirm()}>
  {confirmLabel}
</AlertDialogAction>
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Focused UI | `npm run test:ui -- src/components/AssignmentCard.test.tsx src/components/ConfirmDialog.test.tsx src/components/AssignmentDialog.test.tsx src/pages/AssignmentView.test.tsx` | all pass |
| Full tests | `npm test` | all pass |
| Browser | `npm run test:e2e` | all pass |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `src/components/AssignmentCard.tsx`
- `src/components/AssignmentCard.test.tsx`
- `src/components/ConfirmDialog.tsx`
- `src/components/ConfirmDialog.test.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/AssignmentDialog.tsx`
- `src/components/AssignmentDialog.test.tsx` (create)
- `src/pages/AssignmentView.tsx`
- `src/pages/AssignmentView.test.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Settings.tsx`
- `src/components/Navbar.tsx`
- `src/components/Navbar.test.tsx` (create if needed)
- `src/components/ThemeToggle.tsx`

**Out of scope**:

- Assignment-detail geometry, dashboard grouping, API/database contracts, or
  theme palette changes.
- Changing permissions or allowing members to perform admin actions.
- Storing private tracking credentials outside the current assignment object.
- Adding tooltip or form libraries.

## Git workflow

- Branch: `codex/011-accessible-interactions`
- Suggested commit:
  `fix(ui): make assignment actions accessible and race-safe`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Make assignment-card navigation semantic

Convert the navigable content to a React Router `Link`. Keep the More actions
button as a sibling target layered within the Card, never as a descendant of
the link. Remove `role="button"`, `tabIndex`, custom key handling, and
stop-propagation workarounds. Give the link/card a visible focus-within state.

Convert the Plan 007 TODO into passing tests for:

- link has the assignment name and correct href;
- menu button is a separate tab stop;
- Enter on link navigates;
- Enter/Space on menu opens it without navigation;
- Escape closes and restores focus.

**Verify**: `rg -n 'role="button"|onKeyDown.*navigate|stopPropagation' src/components/AssignmentCard.tsx` -> no navigation workaround matches; focused test passes.

### Step 2: Make confirmation dialogs await async work

Refactor ConfirmDialog into a controlled async state machine. On confirmation:

- prevent automatic dismissal;
- set pending state and disable confirm/cancel/close paths;
- await `onConfirm`;
- close on success;
- remain open on rejection and show safe inline error copy;
- prevent duplicate submissions.

Route card deletion and Settings member removal through ConfirmDialog. Preserve
existing assignment detail, file deletion, team deletion, and bulk deletion
uses. Allow caller-specific pending labels and descriptions.

Convert the Plan 007 ConfirmDialog TODO into passing tests.

**Verify**: `npm run test:ui -- src/components/ConfirmDialog.test.tsx` -> pending, success, rejection, and duplicate-click cases pass.

### Step 3: Programmatically label every Select

In AssignmentDialog and AssignmentView, give each SelectTrigger a stable `id`
and connect its visible Label with `htmlFor`, or use `aria-labelledby`. Include
Assignee, Priority, Status, Progress, assignment type, and any other Select
found in the modified forms. Do not rely on nearby text alone.

**Verify**: component tests can query every combobox by its visible label; `npm run test:ui -- src/components/AssignmentDialog.test.tsx src/pages/AssignmentView.test.tsx` passes.

### Step 4: Serialize status and progress mutations

Treat status and progress as one coupled workflow mutation. While either saves:

- disable both Select triggers;
- show concise inline “Saving” feedback with `aria-live="polite"`;
- serialize requests or ignore stale responses using request identity;
- on failure, restore the last confirmed assignment and show inline error plus
  toast;
- refresh activity only after the confirmed mutation succeeds.

Do not optimistically persist an impossible status/progress combination. Tests
must use deferred promises to prove an earlier response cannot overwrite the
last user choice.

**Verify**: focused AssignmentView tests cover pending, rejection rollback, and out-of-order completion.

### Step 5: Correct feedback and disabled-action explanations

Use success/neutral toast feedback after successful deletions; keep error toast
for rejection only. Add persistent supporting text for unavailable actions:

- New assignment disabled because user lacks admin permission or no team exists.
- Delete workspace disabled because it is the only workspace.

Do not use hover-only explanations. The text must be visible to touch and
keyboard users and referenced with `aria-describedby` where appropriate.

**Verify**: `rg -n 'toast\.error\("(Assignment|Assignments) deleted"' src` -> no matches; UI tests assert descriptions.

### Step 6: Make theme switching discoverable

Render `ThemeToggle compact` in the authenticated Navbar, either beside the
avatar or as a clearly labeled user-menu item. Preserve the expanded control in
Settings. Ensure the compact control announces current and next preference and
does not conflict with menu keyboard navigation.

**Verify**: Navbar test finds a named theme control and exercises one cycle; build passes.

### Step 7: Mask private tracking credentials by default

Keep Reference visible, but mask Access code until an explicit Reveal control
is activated. Copy tracking details must work without revealing the code.
Provide Reveal/Hide labels, announce state change, and reset to masked when the
assignment changes or component unmounts. Do not place the access code in a URL,
DOM attribute, title, or accessible name while masked.

**Verify**: AssignmentView test confirms access code text is absent initially, copy receives the full fabricated value, reveal/hide works, and no URL contains it.

### Step 8: Run keyboard and responsive checks

At desktop and 390px, verify Tab order, focus rings, menu open/close, dialog
pending state, labeled comboboxes, theme control, and tracking reveal/hide.
Use fabricated data only.

**Verify**: `npm test && npm run test:ui && npm run test:e2e && npm run lint && npm run build` -> all exit 0.

## Test plan

- AssignmentCard: semantic navigation/menu separation and keyboard focus.
- ConfirmDialog: pending, duplicate prevention, failure recovery.
- AssignmentDialog/View: accessible combobox names.
- AssignmentView: serialized mutations and masked credentials.
- Navbar: compact theme control.
- Dashboard/Settings: disabled explanations and correct toast semantics.

## Done criteria

- [ ] No button-like card contains another interactive control.
- [ ] Every modified Select is queryable by visible name.
- [ ] Async confirmations cannot dismiss early or submit twice.
- [ ] Status/progress responses cannot apply out of order.
- [ ] Successful deletions are not error toasts.
- [ ] Theme switching is reachable from the authenticated shell.
- [ ] Private access code is masked by default and absent from URLs.
- [ ] All test, browser, lint, and build commands pass.
- [ ] Only in-scope files changed, plus the status row if required.

## STOP conditions

- Radix AlertDialog cannot remain open during async confirmation without
  replacing its action semantics; report the needed primitive change.
- Status and progress are coupled server-side in a way not represented by the
  current client contract.
- Masking would require storing a second credential copy or changing APIs.
- Verification fails twice after a scoped correction.

## Maintenance notes

- New destructive actions must use the awaited confirmation contract.
- Prefer native link/button semantics over event propagation patches.
- Accessible names are part of the UI contract and must be covered in tests.
