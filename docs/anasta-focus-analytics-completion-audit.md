# Anasta Focus Analytics — Completion Audit

**Audit date:** 2026-07-28  
**Specification:** `docs/anasta-focus-analytics-plan-v1.md`  
**Release status:** implemented and locally verified; not yet Apple-release
approved.

This audit deliberately separates executable Windows evidence from checks that
require Xcode, a physical iPhone, or TestFlight. A web preview is not accepted
as proof of Screen Time behavior.

## Product and visual contract

| Requirement | Status | Evidence |
| --- | --- | --- |
| Fresh launch defaults to current Week | Pass locally | `FocusAnalyticsView.tsx`; date-range unit test |
| Day/Week/Month/Year are calendar aligned | Pass locally | `focusAnalyticsDates.ts`; leap/DST/month fixtures |
| Monday-first Week includes Sunday | Pass locally | Fixed seven-key fixture ending on Sunday |
| Managed activity leads Day/Week/Month | Implemented | Native hero/report ordering |
| Total iPhone activity is supporting context | Implemented | Native hero, chart, and accessibility copy |
| Year uses observed/projected full days | Pass formula fixtures | Shared Swift pure core and life card |
| Projection is visibly qualified | Implemented | `AT THIS PACE`, `About`, and projection disclaimer |
| One comparison and one qualified insight | Implemented | Deterministic native report hierarchy; no persistent product-action rail |
| No-plan state is distinct from unavailable managed history | Pass static audit | Total iPhone activity stays available while the managed hero says no plan covered the period |
| No peer score or invented time-saved claim | Pass static audit | No peer/score/time-saved data path |
| Premium Anasta-native hierarchy | Implemented | Warm paper surface, serif hero, gold/crimson/stone palette, native cards/charts, restrained motion |
| Dynamic Type changes metric grids to one column | Pass static audit | Native signal/year grids remove fixed row height and clipping at accessibility sizes |
| Final visual quality on supported iPhones | Device required | Dynamic Type, contrast, RTL, and smallest-device matrix |

## Architecture and privacy

| Requirement | Status | Evidence |
| --- | --- | --- |
| Exact Apple activity never reaches RN | Pass static audit | Native configuration contains private values; RN request contains identity only |
| Report extension has no network/export/write path | Pass static audit | No network, clipboard, notification, URL, file, diagnostic, or App Group write API in analytics sources |
| Host-to-report context is non-sensitive | Pass locally | Typed payload and recursive forbidden-private-key guard |
| Context is versioned and request matched | Pass locally | Schema/request/period/date identity checks in host, wrapper, and extension |
| Envelope precedes pointer and retains current/previous | Implemented | Request-specific UserDefaults envelope, pointer-last update, exact suffix pruning |
| Exactly one `DeviceActivityReport` | Implemented | One RN mount site, detach-before-attach wrapper, debug mount assertion |
| Exactly one vertical scroll owner | Implemented | No RN root `ScrollView`; SwiftUI report owns the native scroll |
| Existing daily/trend report remains | Preserved | Legacy contexts and 31-day clamp stay in their original path |
| Existing Focus/onboarding/shared behavior stays scoped | Pass regression | Focus suite passes; no analytics-specific behavior injected into onboarding or shared UI |

## Data correctness and resilience

| Requirement | Status | Evidence |
| --- | --- | --- |
| Historical scope and Always Blocked ownership | Implemented | 800-day fingerprinted scope/day retention and stable priority |
| Session Day midpoint and Week/Month union | Implemented | Historical metadata resolver |
| Category/app/site hierarchy is non-additive | Pass Swift fixture contract | Production uses the shared family-selection/bounding rules |
| Impossible values never look exact | Implemented | Segment/detail plausibility gates and inconsistent coverage |
| Missing/stale/revoked data is not zero | Implemented | Optional managed values, outlined missing states, permission recovery |
| Complete-day averages have real denominators | Pass Swift fixture contract | Shared pure average and comparison coverage |
| Year uses summary-first memory shape | Implemented | 24 month accumulators; no Year token cache or app ranking |
| Pickups are neutral and counted once | Pass Swift fixture contract | App pickups plus unassociated pickups; explanatory copy |
| Local events preserve write-time calendar day | Pass locally | Belgrade/New York fixture and stored time-zone/offset |
| Partial DB migration does not break Apple report | Pass locally | `PRAGMA table_info` gate disables only local event signals |
| Unknown/malformed/duplicate local events are isolated | Pass locally | Aggregation fixtures |
| `attempt` and usage snapshots are not analytics sources | Pass static audit | Neither appears in analytics metrics |
| Latest request wins | Pass locally | Reducer/gate fixture and production generation checks |
| Native day labels use the accepted request calendar | Pass static audit | Collector carries the request locale/calendar into labels, target-day matching, and first-pickup formatting |
| Cancellation cannot publish a partial Swift configuration | Pass Swift fixture contract | Loop checks plus final shared publish gate |

## Generation, build, and release

| Requirement | Status | Evidence |
| --- | --- | --- |
| Four EAS app extensions are declared | Pass locally | Public Expo config and plugin test |
| Every report Swift source is added once | Pass synthetic plugin test | Nine production analytics sources |
| Charts links once | Pass synthetic plugin test | Idempotent framework membership |
| Pure Swift logic has an XCTest target | Pass generator test | Hostless target, two sources, XCTest framework, shared scheme, normalized `.xctest` product |
| XCTest target is absent from app archive graph | Pass synthetic plugin test | node-xcode’s automatic app dependency is removed |
| Host/extension plist, versions, IDs, App Group align | Pass config test; Xcode inspection required | Host-derived manifest and explicit target settings |
| TypeScript and targeted lint | Pass | `tsc` and zero-warning targeted ESLint |
| Full lint | Pass with baseline | Zero errors; 109 unrelated existing warnings |
| Focus tests | Pass | 60/60 |
| Plugin tests | Pass | Four extensions, nine report sources, two test sources |
| Router type generation | Pass | Verified generated route types |
| iOS JS export | Pass | 2,202 modules; 14 MB Hermes bundle |
| Clean Prebuild twice | macOS required | Windows cannot generate an iOS Xcode project |
| Compile/run 19 Swift tests | macOS required | Generated target/scheme are ready but unexecutable on Windows |
| Archive/sign all five product targets | Apple credentials required | Must inspect signed archive |
| Physical iPhone acceptance/performance | Device required | Full matrix in `docs/ios-focus-native-setup.md` |
| TestFlight reliability and entitlement gate | TestFlight required | 20/20 Day+Week, 10/10 Month+Year per required class |

## Current terminal condition

All requirements executable in this workspace are implemented and passing.
The feature must not be called release-approved until the macOS/Xcode,
physical-iPhone, and TestFlight rows above are recorded as passed.
