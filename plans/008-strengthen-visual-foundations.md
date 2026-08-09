# Plan 008: Strengthen surface hierarchy and interface typography

> **Executor instructions**: Follow every step and verification gate. Stop on
> any condition listed below rather than broadening scope. Update the Plan 008
> row in `plans/README.md` when complete unless a reviewer owns the index.
>
> **Drift check (run first)**: `git diff --stat b26563a..HEAD -- src/styles/globals.css src/components/ui/card.tsx src/components/ui/input.tsx src/components/ui/select.tsx src/components/ui/textarea.tsx src/components/ui/dialog.tsx src/components/ui/alert-dialog.tsx src/components/ui/skeleton.tsx`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/007-establish-ui-test-baseline.md`
- **Category**: tech-debt
- **Planned at**: commit `b26563a`, 2026-08-08

## Why this matters

The current dark card and page backgrounds have only about 1.10:1 contrast,
while global 300-weight body/control text makes otherwise compliant copy look
washed out. Light-theme input borders are also too close to their fill. This
plan creates a clear canvas/raised/inset hierarchy and restores readable UI
typography without changing the product's warm green identity.

## Current state

- `src/styles/globals.css:10-34` defines light canvas, card, muted, border, and
  input colors; input against its background is about 1.61:1.
- `src/styles/globals.css:45-69` defines dark background `#141a17`, card
  `#1b231f`, border `#59695f`, and input `#607166`.
- `src/styles/globals.css:150-158` globally sets body, paragraphs, buttons,
  inputs, textareas, and selects to weight 300.
- `src/components/ui/card.tsx:9` relies on one border, `bg-card`, and `shadow-sm`.
- Inputs/selects/textareas use `bg-background` and `border-input`; dialogs use
  `bg-background`, so raised and interactive layers do not form one hierarchy.
- Preserve Geist for interface copy and Bricolage Grotesque for headings.

Current excerpts to confirm before starting:

```css
/* src/styles/globals.css:43-49 */
.dark {
  --background: #141a17;
  --foreground: #f3f0e4;
  --card: #1b231f;
  --card-foreground: #f3f0e4;
}

/* src/styles/globals.css:150-158 */
body,
p,
button,
input,
textarea,
select {
  font-weight: 300;
}
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm ci` | exit 0 |
| Focused tests | `npm test -- src/styles/theme-tokens.test.ts` | all pass |
| UI tests | `npm run test:ui` | all pass |
| Browser | `npm run test:e2e` | all pass |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 |

## Scope

**In scope**:

- `src/styles/globals.css`
- `src/styles/theme-tokens.test.ts` (create)
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/skeleton.tsx`
- `e2e/public-ui.spec.ts` (visual assertions only)

**Out of scope**:

- Page layouts, navigation, assignment semantics, status colors, or copy.
- Replacing the font families or adding another font dependency.
- Pure-black backgrounds, pure-white borders, glow effects, or gradients used
  solely to hide insufficient surface separation.
- Light/dark preference logic; this plan changes presentation tokens only.

## Git workflow

- Branch: `codex/008-visual-foundations`
- Suggested commit:
  `style(theme): strengthen surface hierarchy and text legibility`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add machine-checkable token contrast tests

Create `src/styles/theme-tokens.test.ts`. Read `globals.css`, extract the light
and dark hex token values, and calculate WCAG relative luminance/contrast in a
small test-only helper. Assert both themes meet:

- foreground on background/card: at least 4.5:1;
- muted foreground on background/card: at least 4.5:1;
- input boundary against input fill: at least 3:1;
- focus ring against background and card: at least 3:1;
- card against page background: at least 1.18:1 as a project-specific visual
  hierarchy guard (not presented as a WCAG text requirement).

Also assert the light and dark definitions expose the same token names. The
test should initially fail only the known weak relationships.

**Verify**: `npm test -- src/styles/theme-tokens.test.ts` -> expected failures identify current weak token pairs only.

### Step 2: Define three consistent surface levels

Adjust existing tokens or add explicit `surface`, `surface-raised`, and
`surface-inset` aliases so components can express:

1. app canvas/background;
2. cards, dialogs, menus, and other raised containers;
3. nested/inset panels and subdued groups.

Keep the warm off-white light theme and deep green-black dark theme. Tune by
luminance rather than increasing saturation. Essential input/control borders
must reach 3:1 against their fill; decorative card boundaries may be softer if
the fill/elevation already makes grouping clear.

Map any new variables through Tailwind's `@theme inline` block. Do not leave
raw new color literals in primitives.

**Verify**: `npm test -- src/styles/theme-tokens.test.ts` -> all assertions pass.

### Step 3: Restore readable default typography

Change interface/body/control defaults to weight 400. Remove the broad global
rule that silently makes every paragraph and control weight 300. Keep explicit
component utilities such as `font-medium` and `font-semibold` authoritative.
Headings remain Bricolage Grotesque and body/controls remain Geist.

Inspect button, badge, form-field, metadata, and long paragraph wrapping at
320px after the weight change; adjust only primitive spacing where text clips.

**Verify**: `rg -n 'font-weight: 300' src/styles/globals.css` -> no broad body/control match; `npm run build` -> exit 0.

### Step 4: Apply the hierarchy to core primitives

Update Card, Input, Select, Textarea, Dialog, AlertDialog, and Skeleton so:

- Cards and modal surfaces use the raised surface.
- Inputs and textareas remain visually interactive in both themes.
- Dialogs/popovers are visibly above cards without a heavy border.
- Skeletons are visible on both canvas and raised cards.
- Focus rings remain the strongest non-destructive outline.

Avoid per-page overrides in this plan. The primitives should be sufficient for
existing pages to benefit automatically.

**Verify**: `npm run test:ui && npm run lint && npm run build` -> all exit 0.

### Step 5: Perform light/dark responsive visual checks

Use the Playwright public routes and, only if an existing safe authenticated
session is available, the dashboard and assignment detail screenshot. Check
light and dark themes at 1440px, 390x844, and 320px. Confirm cards, inputs,
nested muted panels, menus, dialogs, disabled controls, and focus rings remain
distinguishable. Do not create credentials or alter auth.

**Verify**: `npm run test:e2e` -> exit 0; document any authenticated check skipped because no safe session existed.

## Test plan

- Token tests enforce contrast relationships in both themes.
- UI tests protect field roles/names and theme toggle behavior.
- Playwright checks public routes for overflow and console errors in both
  themes.
- Manual authenticated inspection is supplementary, never the only gate.

## Done criteria

- [ ] Default body/control text is weight 400.
- [ ] Token contrast tests pass in light and dark themes.
- [ ] Card/background contrast is at least the project guard of 1.18:1.
- [ ] Essential control boundaries and focus rings reach 3:1.
- [ ] `npm test`, `npm run test:ui`, `npm run test:e2e`, `npm run lint`, and `npm run build` pass.
- [ ] No page-specific source files were modified.
- [ ] Only in-scope files changed, plus the plan status row if required.

## STOP conditions

- The desired relationships cannot be met without abandoning the current warm
  green/cream identity.
- The token parser cannot reliably distinguish light and dark declarations;
  stop and propose a typed token source rather than writing fragile tests.
- Core primitives have materially changed since `b26563a`.
- Verification fails twice after a reasonable scoped correction.

## Maintenance notes

- Treat `theme-tokens.test.ts` as a contract when adding a new theme.
- Semantic status colors intentionally remain for Plan 009.
- Review screenshots on Windows as well as high-density displays because the
  original thin-text problem was most visible with Windows font rendering.
