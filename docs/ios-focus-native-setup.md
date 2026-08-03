# Anasta Focus - iOS Native Setup and Test Runbook

This runbook is the operational companion to `anasta-focus-plan-v4.md`. It
describes how to build and verify the real Family Controls implementation. A
browser preview or Expo Go can validate most React Native layout, but neither
can compile Anasta's local Swift module or its four iOS app extensions.

## Recommended Development Loop

Use two loops instead of uploading every small visual edit to TestFlight.

1. Use Expo web or Expo Go for ordinary React Native layout and copy where the
   screen does not depend on the native Focus bridge.
2. Install one EAS **development build** on the physical iPhone for Focus.
3. Run `npx expo start --dev-client` and open that development build. JavaScript,
   styling, and bundled asset changes then refresh from Metro every few minutes
   without rebuilding the IPA.
4. Create a new EAS development build only when Swift, entitlements, the config
   plugin, an extension target, a native dependency, or another native setting
   changes.
5. Use TestFlight after the native behavior and main screens are stable, for
   release-like distribution and final background/closed-app validation.

This preserves the fast 10-15 minute UI iteration loop while still testing the
Family Controls behavior that Expo Go cannot contain.

## Required Identifiers

Default local configuration:

| Target | Bundle identifier |
| --- | --- |
| Host app | `com.anasta.app` |
| Device Activity Monitor | `com.anasta.app.focus-monitor` |
| Shield Configuration | `com.anasta.app.focus-shield-configuration` |
| Shield Action | `com.anasta.app.focus-shield-action` |
| Device Activity Report | `com.anasta.app.focus-activity-report` |
| Shared App Group | `group.com.anasta.app.focus` |

Production identifiers can be supplied without editing source:

```powershell
$env:ANASTA_IOS_BUNDLE_IDENTIFIER='com.example.anasta'
$env:ANASTA_FOCUS_APP_GROUP='group.com.example.anasta.focus'
```

The config plugin derives all four extension identifiers from the host bundle
identifier and declares them under
`extra.eas.build.experimental.ios.appExtensions` for EAS credential handling.

## Apple Developer Configuration

Before the first signed build, verify all five App IDs in Certificates,
Identifiers & Profiles.

- The host and all four extension App IDs need the Family Controls capability
  and the distribution entitlement approved for their intended distribution.
- The host and all four extensions need membership in the same App Group.
- Provisioning profiles created before those capabilities changed must be
  regenerated.
- The Family Controls approval for the host does not remove the user's runtime
  consent. The app still requests individual Screen Time authorization on the
  iPhone before applying protection.

Do not add the App and Website Usage data-access entitlement to the universal
build merely to discover installed apps. That enhanced API has a separate Apple
approval and customer-availability boundary. The standard product uses opaque
Family Activity picker tokens.

## Build Commands

From the repository root:

```powershell
npm install
npx expo config --type public
npx eas-cli whoami
npx eas-cli build --platform ios --profile development
```

Install the resulting internal-development build on the registered iPhone,
then start Metro with:

```powershell
npx expo start --dev-client
```

The development profile in `eas.json` is a physical-device build
(`simulator: false`) and includes `expo-dev-client`. Native changes require a
new build; JavaScript and style changes do not.

## Native Targets

The config plugin creates and embeds four extensions:

- `AnastaDeviceActivityMonitor`: Session boundaries, Daily Target and hard-wall
  thresholds, check-ins, Quiet Hour expiry, and temporary-access expiry.
- `AnastaShieldConfiguration`: the Apple-owned blocked screen presentation.
- `AnastaShieldAction`: strict close behavior and loose/check-in handoff to
  Anasta. Direct app opening uses Apple's iOS 26 API; older iOS versions retain
  the pending intervention for the next manual Anasta launch.
- `AnastaActivityReport`: private SwiftUI activity analytics. Raw per-app usage
  stays in Apple's report sandbox and is not exported to React Native or a
  server.

## Apple Limits Reflected in the Product

- Device Activity schedule minimum: 15 minutes.
- Maximum concurrently monitored activities: 20 for the app and extensions.
- Explicit web-domain filter capacity: 50 domains.
- Family Activity selections are opaque tokens; the standard API cannot
  enumerate and auto-match every installed app.
- Clean Sight covers Safari and browsers that participate in Apple's Screen
  Time web controls. Device-wide DNS/VPN filtering is a future Network
  Extension project with a separate entitlement.

## Physical iPhone Acceptance Matrix

Run every item on a real iPhone, once with Reduce Motion off and once on where
motion is involved.

1. Grant, deny, and revoke Screen Time access; confirm the UI never calls an
   unprotected plan active and that Settings recovery works.
2. Select Global Essentials, add-only designated Core, Strict and Loose Always
   Blocked apps, plan groups, and individual app rules. Verify conflicts are
   rejected or moved exactly as the picker notice says.
3. Exercise a Daily Plan group limit, an app-level stricter limit, 15-minute
   check-ins, final Loose continuation, and final Strict closure.
4. Exercise a Session Plan through a back-to-back boundary and an overnight
   Session split. Confirm there is no visible unprotected gap.
5. Reach the Daily Target and verify only trophy eligibility changes; then reach
   the ordinary plan's Essentials-only threshold and verify the hard wall
   remains for the local day.
6. Activate an Essentials-only Plan with a non-zero Goal and Tolerance. Verify
   its Global Essentials plus plan-only app allowlist applies from minute one,
   dormant Daily/Session rules never apply, the Goal can still earn or lose the
   trophy, and no redundant hard-wall event fires at the Tolerance endpoint.
7. Switch that same plan back to its prior planning style. Verify its dormant
   rules return, while plan-only Essentials do not leak into Global Essentials
   or another plan. Confirm Always Blocked still wins in both modes.
8. Start Quiet Hour with a custom temporary allowlist. Verify it overrides
   ordinary Session limits, intersects with a reached hard wall, never opens an
   Always Blocked app, and expires while Anasta is closed.
9. Grant a Loose 15-minute temporary window. Edit or foreground Focus during
   that window and verify access still expires on time.
10. Turn Clean Sight packs and custom domains on and off. Test Safari plus at
   least one supported third-party browser and verify the capacity/omitted
   status matches the native result.
11. Open one-day and 30-day native analytics. Confirm private report data renders
   without being copied into the JavaScript history store.
12. Change time zone, cross local midnight, revoke authorization, and relaunch
    after the app was terminated. Confirm the resolver recalculates the current
    plan and shows any native scheduling error honestly.
13. Leave the Focus landing screen open for at least ten minutes on the weakest
    supported iPhone. Check touch latency, scrolling, frame pacing, temperature,
    and battery impact. The primary Lottie pauses off-screen/backgrounded and
    no second continuous animation competes with it.

## Focus Analytics Acceptance Matrix

Analytics is a separate release gate because the report is an out-of-process
Apple privacy surface. Web, Expo Go, and Simulator show only the explicitly
labeled `PREVIEW DATA` fixture.

For every physical-device run, record iPhone model, iOS version, Xcode version,
build type, commit, authorization state, period, result, load time, and any
extension termination.

1. Open Analytics from a fresh launch. It must start on the current
   Monday-through-Sunday Week and show Sunday as the seventh day.
2. Open Day, Week, Month, and Year for current and historical periods. Change
   periods rapidly 50 times. The header and report must never disagree and the
   native view hierarchy must never contain two `DeviceActivityReport` views.
3. Start vertical pans over the hero, chart, chart callout, group rows, and
   blank space. The native report must own the scroll everywhere; there is no
   parent React Native vertical `ScrollView`.
4. Leave each period open until it resolves: 20/20 runs for Day and Week and
   10/10 for Month and Year. A slow report keeps the warm skeleton and exposes
   one Retry; it never leaves an infinite white/blank spinner.
5. Background during preparation, wait more than five minutes, and return.
   Only a current period refreshes once. Historical periods do not poll or
   remount.
6. Deny, grant, revoke, and re-grant Screen Time authorization. Not-determined
   shows `Allow Screen Time access`; denied shows Settings recovery; revoked
   opaque labels are never presented as current truth.
7. Test no plan, a plan with no Daily Target, an edited/deleted historical
   plan, apps moved between groups, and apps moved to Always Blocked. Total
   iPhone context may remain, while managed data uses the retained historical
   scope or an honest unavailable state.
8. Hand-check a small Day against Apple Screen Time. Category, app, and website
   hierarchy must not double-count; Always Blocked wins attribution, followed
   by historical plan order.
9. Test a partial current day, missing intervals, no Apple activity, weak
   previous coverage, zero previous activity, and an intentionally impossible
   duration fixture. Unknown data stays missing, current data says `SO FAR`,
   and invalid data never enters a comparison or Year projection.
10. Test February 28/29, Sunday, the Europe/Belgrade spring-forward and
    fall-back days, local midnight, and a time-zone change while Analytics is
    open. Calendar intervals remain local and duplicated clock labels never
    merge absolute hourly buckets.
11. Test Year on the weakest supported phone. Capture extension peak memory and
    collection time for a selected plus previous calendar year. Year retains
    monthly summaries only and does not render private app rows.
12. Run with Dynamic Type at the largest supported size, VoiceOver, Increase
    Contrast, grayscale, RTL locale, and Reduce Motion. All host targets remain
    at least 44 points; chart summaries are understandable without color or
    precise tapping; the 365 field is one VoiceOver element.
13. Repeat the matrix in a local Release build and TestFlight. Debug success
    does not waive a release-only blank report, entitlement, signing, or
    extension-memory failure.

Before building, run:

```powershell
npm.cmd run test:focus
npm.cmd run test:focus-plugin
npm.cmd run typegen:routes
npx.cmd eslint components/focus-watch/FocusAnalyticsView.tsx components/focus-watch/FocusAnalyticsNativeReport.tsx components/focus-watch/analytics
npx.cmd expo config --type public
```

On macOS, generate from a clean disposable checkout twice. The second Prebuild
must have no semantic Xcode-project diff. Confirm every analytics Swift file is
present exactly once in `AnastaActivityReport` Sources, `Charts.framework` is
linked once, the report plist has no invented principal class, and host/
extension version, build, App Group, bundle IDs, and entitlements match.

The plugin also generates a hostless `AnastaAnalyticsTests` target and shared
scheme. It compiles the same Foundation-only formulas used by the report
collector. After Prebuild, list the generated project and run:

```bash
xcodebuild -list -project ios/Anasta.xcodeproj
xcodebuild \
  -project ios/Anasta.xcodeproj \
  -scheme AnastaAnalyticsTests \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  test
```

If the local simulator name differs, use any installed iOS 16-or-newer
simulator returned by `xcrun simctl list devices available`. The app scheme
must not depend on `AnastaAnalyticsTests`, and an Archive must not contain its
`.xctest` product.

## Release Gate

A production/TestFlight build is not ready until:

- EAS compiles every Swift target and signs all five bundle identifiers;
- the physical-device matrix passes;
- authorization-recovery and native-error states are visible;
- `npx tsc --noEmit`, Focus ESLint, Expo config inspection, and JS export pass;
- no UI copy promises DNS/VPN coverage, exhaustive domain coverage, automatic
  installed-app discovery, or protection that the native layer did not confirm.
