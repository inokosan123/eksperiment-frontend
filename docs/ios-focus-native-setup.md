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
   the Essential-only threshold and verify the hard wall remains for the local
   day.
6. Start Quiet Hour with a custom temporary allowlist. Verify it overrides
   ordinary Session limits, intersects with a reached hard wall, never opens an
   Always Blocked app, and expires while Anasta is closed.
7. Grant a Loose 15-minute temporary window. Edit or foreground Focus during
   that window and verify access still expires on time.
8. Turn Clean Sight packs and custom domains on and off. Test Safari plus at
   least one supported third-party browser and verify the capacity/omitted
   status matches the native result.
9. Open one-day and 30-day native analytics. Confirm private report data renders
   without being copied into the JavaScript history store.
10. Change time zone, cross local midnight, revoke authorization, and relaunch
    after the app was terminated. Confirm the resolver recalculates the current
    plan and shows any native scheduling error honestly.
11. Leave the Focus landing screen open for at least ten minutes on the weakest
    supported iPhone. Check touch latency, scrolling, frame pacing, temperature,
    and battery impact. The primary Lottie pauses off-screen/backgrounded and
    no second continuous animation competes with it.

## Release Gate

A production/TestFlight build is not ready until:

- EAS compiles every Swift target and signs all five bundle identifiers;
- the physical-device matrix passes;
- authorization-recovery and native-error states are visible;
- `npx tsc --noEmit`, Focus ESLint, Expo config inspection, and JS export pass;
- no UI copy promises DNS/VPN coverage, exhaustive domain coverage, automatic
  installed-app discovery, or protection that the native layer did not confirm.
