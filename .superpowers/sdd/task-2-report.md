# Task 2 Report

## What I Implemented
- Created `src/App.test.tsx` to verify the application stays on the `/` route path on desktop by default.
- Included `// @vitest-environment jsdom` in the test file to avoid `window is not defined` error.
- Modified `src/App.tsx` to integrate `useDeviceDetect` and apply HTML5 History API-based routing logic for mobile/desktop device branching.
- Added a conditional render to return the `MobileApp` component when `currentPath === '/mobile'`.

## What I Tested & Test Results
- Ran `npm run test src/App.test.tsx` using Vitest.
- The test suite verified that desktop simulation keeps `window.location.pathname` strictly at `'/'`.
- The tests run efficiently and pass completely.

## TDD Evidence
### RED
Command run:
```bash
npm run test src/App.test.tsx
```
Failing Output (before adding vitest environment comment):
```
 FAIL  src/App.test.tsx > App Routing Dispatcher > should stay at / path on desktop
ReferenceError: window is not defined
```
Why it was expected: The test environment lacked a DOM implementation, causing `window` references to throw. The test itself was failing due to environment configuration.

### GREEN
Command run:
```bash
npm run test src/App.test.tsx
```
Passing Output (after adding the jsdom configuration):
```
 ✓ src/App.test.tsx (1)
   ✓ App Routing Dispatcher (1)
     ✓ should stay at / path on desktop
```
Why it passed: With a correct mock DOM configuration, the test verified the route accurately and passed as expected.

## Files Changed
- `noon_dashboard/src/App.test.tsx` (created)
- `noon_dashboard/src/App.tsx` (modified)

## Self-Review Findings
- **Completeness**: I fully integrated `useDeviceDetect` to toggle rendering logic and added the dispatcher testing as specified.
- **Quality**: The use of History API makes the transitions seamless and lightweight without external dependencies.
- **Discipline**: The changes conform cleanly to existing conventions and strictly focus on the dispatcher requirement without touching unrelated parts of `App.tsx`.
- **Testing**: A routing default check handles our baseline test, and TDD steps logically flowed around environment setup errors vs actual logic.

## Concerns
- Typescript compiler (`tsc`) didn't seem to complain about the missing `MobileApp` module immediately, but that may be normal depending on the strictness flags and compiler targets. The task noted it was an expected possibility, so no blockers here.

## Fixes Implemented
- **App.tsx Debounce**: Wrapped the `pushState` and `setCurrentPath` route redirection inside a 150ms `setTimeout`, and returned `clearTimeout` from `useEffect`.
- **App.tsx Reversions**: Reverted accidental modifications to `App.tsx` (like `NAV_ITEMS` naming, string names, credentials states).
- **React Hook Order Fix**: Moved the `currentPath === '/mobile'` early return down to line 112 (after all hooks) to satisfy React's Rules of Hooks, resolving a "Rendered fewer hooks than expected" failure in testing.
- **App.test.tsx Asserts**: Rewrote the test to mock `useDeviceDetect` properly, fully rendering `<App />`, applying Vitest fake timers to wait for the 150ms debounce, and verifying correct paths for both desktop and mobile states.

### Fix Test Evidence
Command run:
```bash
npm run test src/App.test.tsx
```

Passing Output:
```
 ✓ src/App.test.tsx (2)
   ✓ App Routing Dispatcher (2)
     ✓ should stay at / path on desktop
     ✓ should redirect to /mobile on mobile
```

### Fix Files Changed
- `noon_dashboard/src/App.tsx`
- `noon_dashboard/src/App.test.tsx`

## Structural Refactors (Fixing Performance Leak & History Trap)
- **Extracted `DesktopApp.tsx`**: Moved all desktop-specific hooks, state, effect hooks, and JSX into `DesktopApp.tsx`.
- **Cleaned `App.tsx`**: Now solely acts as a lightweight router/dispatcher and conditionally renders `<MobileApp />` or `<DesktopApp />`.
- **History Trap Fixed**: Replaced `window.history.pushState` with `window.history.replaceState` in `App.tsx` (and test setup) to avoid back-button infinite loops on mobile.

### Refactor Test Evidence
Command run:
```bash
npm run test -- --run
```
Result: `Test Files  2 passed (2), Tests  6 passed (6)`

### Refactor Files Changed
- `noon_dashboard/src/App.tsx` (modified)
- `noon_dashboard/src/App.test.tsx` (modified)
- `noon_dashboard/src/DesktopApp.tsx` (created)
