# Plan 007: Establish browser-capable UI regression coverage

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan in
> `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat b26563a..HEAD -- package.json package-lock.json vitest.config.ts .gitignore src/App.tsx src/pages/AssignmentTracking.tsx src/components/AssignmentCard.tsx src/components/ConfirmDialog.tsx`
> If any listed file changed, compare the current-state excerpts below with the
> live code. A material mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `b26563a`, 2026-08-08

## Why this matters

The existing 78 tests cover API and pure domain behavior, but no test renders a
React component or opens the app in a browser. The planned global theme,
responsive layout, loading-state, dialog, and keyboard changes can therefore
regress while `npm test` remains green. This plan adds a small, stable UI test
foundation before those changes begin; it does not redesign production UI.

## Current state

- `vitest.config.ts:13-20` uses `environment: "node"` for the entire suite.
- `package.json:32-47` has Vitest but no jsdom, Testing Library, user-event,
  jest-dom, or browser runner.
- `src/App.tsx:49-50` returns `null` while authentication is pending.
- `src/pages/AssignmentTracking.tsx:29` has six view states and moves focus to
  the result heading after success, but only its pure helpers and fetch client
  are tested.
- `src/components/AssignmentCard.tsx:172-232` combines card navigation with a
  nested dropdown. Later plans will change this behavior; tests must cover the
  intended link/menu contract rather than event-propagation implementation.
- Existing test style uses Vitest globals imported explicitly and `@/` aliases;
  use `src/lib/public-assignment-status.test.ts` as the naming/assertion model.

Current excerpts to confirm before starting:

```ts
// vitest.config.ts:13-20
test: {
  clearMocks: true,
  passWithNoTests: true,
  environment: "node",
}

// src/App.tsx:49-51
if (session.isPending) {
  return null
}
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `npm install` | exit 0 and lockfile synchronized |
| Unit/integration | `npm test` | exit 0, existing and UI tests pass |
| UI tests | `npm run test:ui` | exit 0 |
| Browser tests | `npm run test:e2e` | exit 0 in Chromium |
| Lint | `npm run lint` | exit 0 |
| Build/typecheck | `npm run build` | exit 0 |

## Suggested executor toolkit

- Use `vercel:react-best-practices` after adding test-only React utilities.
- Use `vercel:agent-browser-verify` for the final Playwright smoke pass if it
  is available, but do not use or create production credentials.

## Scope

**In scope** (the only files that may be modified or created):

- `package.json`
- `package-lock.json`
- `vitest.config.ts`
- `.gitignore`
- `playwright.config.ts` (create)
- `src/test/setup.ts` (create)
- `src/test/render.tsx` (create)
- `src/components/ThemeToggle.test.tsx` (create)
- `src/pages/AssignmentTracking.test.tsx` (create)
- `src/components/AssignmentCard.test.tsx` (create; TODO contracts are allowed)
- `src/components/ConfirmDialog.test.tsx` (create; TODO contracts are allowed)
- `e2e/public-ui.spec.ts` (create)

**Out of scope**:

- Changing production component behavior or visual styles.
- Adding test-only routes or authentication bypasses to production code.
- Connecting browser tests to Neon, Dropbox, or real client records.
- Snapshotting entire pages; assertions must target behavior and accessible
  names, not large brittle DOM dumps.

## Git workflow

- Branch: `codex/007-ui-test-baseline`
- Use a conventional commit such as
  `test(ui): establish component and browser regression baseline`.
- Do not push or open a pull request unless explicitly instructed.

## Steps

### Step 1: Add the minimum UI test dependencies and scripts

Add development dependencies compatible with React 18 and Vitest 4:

- `jsdom`
- `@testing-library/react`
- `@testing-library/user-event`
- `@testing-library/jest-dom`
- `@playwright/test`

Add scripts:

- `test:ui`: run `*.test.tsx` files through Vitest.
- `test:e2e`: run the Playwright suite in Chromium.

Do not change the existing `test`, `lint`, or `build` scripts. Add
`playwright-report/`, `test-results/`, and any Playwright auth-state directory
to `.gitignore`; no auth-state file may be committed.

**Verify**: `npm install && npm test` -> exit 0 and all original tests pass.

### Step 2: Configure DOM tests without moving server tests out of Node

Keep Node as the default Vitest environment. Use either Vitest project config
or a `// @vitest-environment jsdom` directive on UI test files; do not make API
and database tests run in jsdom. Create `src/test/setup.ts` for jest-dom
matchers, cleanup after each test, and deterministic browser API stubs. Create
`src/test/render.tsx` with a small `renderWithRouter` helper based on
`MemoryRouter`; accept initial route entries and return `userEvent.setup()`.

Do not place production API mocks in the shared setup. Tests should mock their
own module boundaries explicitly with `vi.mock`.

**Verify**: `npm run test:ui` -> exit 0, even before all test files are added.

### Step 3: Add component characterizations and future contracts

Add passing tests for:

- `ThemeToggle`: visible Light/Dark/System controls have pressed state and a
  click changes the stored preference without relying on CSS screenshots.
- `AssignmentTracking`: initial form labels, invalid input, loading disabled
  state, not-found response, successful result, and focus movement. Mock
  `getPublicAssignmentStatus`; never call the network or include real codes.

Add `it.todo` contracts for the behaviors later plans will implement:

- Assignment cards expose one semantic assignment link and a separate More
  actions button; activating the menu never navigates.
- ConfirmDialog remains open and disables actions while an async confirmation
  is pending, then closes on success and remains recoverable on rejection.

The TODO names must describe the target behavior precisely so Plans 010 and
011 can convert them into passing tests instead of adding parallel coverage.

**Verify**: `npm run test:ui` -> passing tests green; TODOs reported but not failed.

### Step 4: Add a public, network-isolated Playwright smoke suite

Create `playwright.config.ts` with:

- Chromium only.
- A `webServer` that starts the Vite dev server on a fixed localhost port and
  reuses it outside CI.
- Desktop and 390x844 projects or parameterized viewports.
- Trace/screenshot capture only on failure.

In `e2e/public-ui.spec.ts`, cover:

- Landing and tracking routes render without console errors.
- The tracking form remains within the viewport at 390px and has no horizontal
  document overflow.
- Intercept `/api/assignment-status` for not-found and success responses; use
  fabricated values and assert the corresponding state and focus behavior.
- Keyboard tab order reaches both tracking fields and submit button.

Do not test authenticated routes until a later plan provides a safe mockable
fixture. Do not weaken auth to make E2E easier.

**Verify**: `npx playwright install chromium` once, then `npm run test:e2e` -> exit 0.

### Step 5: Run the complete baseline

Run the full suite after the new layers coexist. Confirm Node tests still run
in Node and browser tests do not contact external services.

**Verify**: `npm test && npm run test:ui && npm run test:e2e && npm run lint && npm run build` -> all exit 0.

## Test plan

- Component tests use role/name queries and `userEvent`, never implementation
  selectors where an accessible query exists.
- Public browser tests intercept every API call and fail on unexpected external
  requests.
- Cover both desktop and 390px tracking layouts.
- Preserve the existing 78-test baseline.

## Done criteria

- [ ] `npm test`, `npm run test:ui`, `npm run test:e2e`, `npm run lint`, and `npm run build` all exit 0.
- [ ] `rg 'environment: "node"' vitest.config.ts` still finds the Node default or an equivalent Node project.
- [ ] At least one `.test.tsx` renders a component in jsdom.
- [ ] Playwright runs only fabricated public tracking data.
- [ ] No committed Playwright auth state, trace, screenshot, or report exists.
- [ ] Production source behavior is unchanged.
- [ ] Only in-scope files are modified, plus `plans/README.md` status if required.

## STOP conditions

Stop and report instead of improvising if:

- Vitest 4 cannot isolate DOM tests without moving server/API tests into jsdom.
- Browser coverage appears to require a production authentication bypass.
- Playwright attempts to contact Neon, Dropbox, or a live deployment.
- Dependency installation requires upgrading React, Vite, or Vitest.
- Any verification command fails twice after a scoped correction.

## Maintenance notes

- Every subsequent UI plan should convert relevant TODO contracts to passing
  tests and add state coverage before changing the component.
- Keep browser coverage small and journey-focused; use component tests for
  combinatorial state matrices.
- Review dependency upgrades for test-runner/jsdom compatibility before broad
  automated updates.
