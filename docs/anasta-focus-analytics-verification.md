# Anasta Focus Analytics Verification Ledger

This ledger separates checks executable in the current Windows workspace from
the Apple-only release gates. It does not treat a web preview or static code
review as proof that Screen Time works.

## Completed locally

- Focus unit suite passes with 60 tests, including Monday-first week/Sunday,
  28/29/30/31-day calendar boundaries, leap year, no future navigation, Day
  comparison exclusion, current partial-day exclusion from complete-day
  averages, Europe/Belgrade 23/25-hour DST boundaries, event
  isolation/deduplication, exact 800-day retention, the SQLite event migration
  and schema audit, Belgrade/New York write-time-day travel fixtures,
  local-day/legacy query boundary and queued-write boundary, ambiguous
  legacy-Day exclusion, malformed rows, action priority, and
  latest-request-wins behavior.
- The config-plugin manifest test passes. It verifies four unique extension
  declarations, nine report analytics Swift sources, host-derived version and
  build values, one App Group, explicit extension plist/`SKIP_INSTALL`
  settings, idempotent source membership, and one Charts framework membership.
  It also verifies the generated hostless `AnastaAnalyticsTests` target,
  two pure-test sources, generated plist settings, XCTest linkage contract,
  shared test scheme, explicit `.xctest` product normalization (including the
  node-xcode `.mdimporter` regression), and removal of the node-xcode
  app-to-test dependency so the test bundle cannot enter the app archive graph.
- The Foundation-only production core has 19 XCTest fixtures covering interval
  assignment, token de-duplication/group priority, non-additive hierarchy,
  pickups, averages, matched coverage, zero-previous behavior, annual formulas,
  peak-window ties, insight priority, plausibility rejection, partial
  coverage, cancellation, one-pass traversal, additive/current/malformed/
  stale/future schema handling, DST 23/25-hour boundaries and duplicate-hour
  identities, and Year monthly aggregation. These sources are generated and
  wired on Windows; running them still requires the macOS/Xcode gate below.
- Year collection now retains no historical token-scope cache or per-app
  ranking. It keeps at most 24 monthly summary structures with small numeric
  day slots for exact matched-day coverage and discards token dictionaries
  after each segment.
- Partial SQLite event-calendar migration is verified with
  `PRAGMA table_info`. A failed partial migration disables only local event
  signals; Apple-private analytics and other Focus data continue to load.
- Resolved Expo public config contains the host Family Controls entitlement,
  shared App Group, normalized bundle identifiers, and all four EAS extension
  declarations.
- Focus Analytics targeted ESLint runs without an error or warning.
- Static UI-contract review confirms a 42-point period track with a 44-point
  effective RNGH touch target, one-column native metric grids at accessibility
  Dynamic Type sizes, an explicit no-plan managed state, and request-calendar
  matching for native target outcomes and visible time labels.
- Full `npm run lint` completes with zero errors. Its 109 warnings are existing
  warnings outside Focus Analytics.
- `npx tsc --noEmit --pretty false` completes successfully.
- Verified Expo Router type generation completes successfully.
- An iOS Expo export completes successfully (2,202 modules and a 14 MB Hermes
  bundle), proving the JavaScript bundle and route graph include the new shell.
- Static privacy search finds no report-extension network, clipboard,
  notification, URL-opening, file-writing, or App Group write path. The report
  reads versioned non-private context; private Apple results remain in SwiftUI.
- The RN shell exposes one controlled manual Retry for every period. It
  invalidates the current generation and follows the same detach → atomic
  context sync → single mount sequence; Apple report-content readiness still
  requires the physical-device blank-report matrix below.
- A Windows disposable `expo prebuild --platform ios --no-install` attempt was
  correctly rejected by Expo because iOS native generation requires macOS or
  Linux. The real worktree was not prebuilt or cleaned.
- A browser visual run reached an existing global Expo SQLite web-worker
  failure (`xFileControl`/sync access-handle collision) before the Analytics
  route could become usable. This is recorded as a web-preview limitation, not
  as proof for or against the native report.

## Required on macOS before a native build

- Run clean Prebuild twice in a disposable checkout and compare the generated
  Xcode project semantically.
- Inspect `AnastaActivityReport` compile sources, Charts linkage, plist shape,
  build versions, bundle identifiers, App Group, deployment target, and
  entitlements.
- Compile all Swift sources with the exact shipping Xcode toolchain.
- Run the generated `AnastaAnalyticsTests` shared scheme and record all 19
  XCTest fixtures as passed.
- Archive and inspect signed host plus all four embedded extensions.

## Required on physical iPhone

- Complete every item in the Focus Analytics acceptance matrix in
  `docs/ios-focus-native-setup.md`.
- Record Debug and local Release reliability, scroll ownership, one-report
  mount count, period/header matching, authorization recovery, DST/time-zone
  behavior, Dynamic Type, VoiceOver, Reduce Motion, and Year memory/time.

## Required in TestFlight

- Repeat Day/Week 20 times each and Month/Year 10 times each on every required
  OS/device class.
- Accept only zero simultaneous reports, zero period/header swaps, zero
  extension crashes, and no unrecoverable blank report.
- Confirm distribution Family Controls approval and provisioning independently
  for the host, monitor, both shield extensions, and activity report.

Until the macOS, physical-device, and TestFlight sections are recorded as
passed, Focus Analytics is implemented but not release-approved.
