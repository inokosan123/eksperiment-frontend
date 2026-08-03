# Anasta Focus v4 - Implementation Audit

Status date: 2026-07-12

This file records what is implemented, why it is implemented that way, and
what still requires an external Apple build or a physical iPhone. The product
source of truth remains `docs/anasta-focus-plan-v4.md`; this audit is the
engineering handoff for continuing the implementation without reconstructing
the conversation.

## 1. Implemented Product Surfaces

- Focus landing is rebuilt around four direct sections: Protection, Today's
  Progress, Screen Time, and Web Protection.
- The old Watch/Pomodoro model is not reused. Pomodoro remains a separate tool.
- Protection has an honest native state: inactive, permission required,
  applying, applied, preview, or failed. A saved plan is never called active
  when native protection did not apply.
- Activating a protective plan for today and saving protection into today's
  active plan both pass through the same permission gate. Future weekly planning
  remains interruption-free.
- Quiet Hour is a strict temporary allowlist with a 15-minute minimum, an exact
  duration control, a snapshot of permanent Essentials, and a private Apple
  picker for local exceptions. Once started, its app snapshot and original end
  cannot be weakened; the active sheet can only extend it up to 12 total hours.
- Screen Time includes Daily Plans and Session Plans, a weekly assignment
  planner, required names, a maximum of four connected Sessions, exact time
  editing, add/remove confirmations, and compatible Session-rule copying.
- A new plan starts with every group in `Limit` and no duration. `No limit` is
  the natural value inside Limit, not a third mode; finite limits are deliberate
  choices rather than hidden defaults.
- Daily Target includes target, tolerable, and Essentials-only thresholds; the
  80 percent planning marker; grouped planned time; a warning after 90 percent;
  and the requested 365-dot year perspective.
- Daily Target, group, and app duration controls use 15-minute resolution,
  including values such as 5h 45m, while keeping `No limit` explicit.
- App Groups have globally unique custom names, reusable saved groups, one app
  per group in a plan, and deletion protection while any plan references them.
- Essential Apps are separated into conceptual system-critical access,
  user-designated locked Core apps, and editable Optional Essentials.
- Always Blocked has independent Strict and Loose native selections. It cannot
  silently overlap Essentials or Quiet Hour Essentials.
- Intentional Use Check-ins interrupt bounded use at the configured cadence
  without being the final limit. Loose final limits offer a deliberate
  15-minute continuation after the selected return practice; Strict limits do
  not offer an override.
- Clean Sight has built-in packs, named custom packs, individual domains,
  Never Allowed modes, a visible 50-domain native capacity, deterministic
  priority, an automatic adult-filter state, and MVP Hard Lock delays.
- Custom-pack domains can be removed individually; active-pack removals pass
  through Hard Lock, while the last domain remains until the user adds a
  replacement or confirms removal of the complete pack.
- Domain input is normalized through one shared validator before it reaches
  persistence or the 50-slot resolver. Schemes, `www`, paths, query strings,
  fragments, numeric ports, and trailing dots are removed; malformed labels,
  consecutive dots, and oversized hostnames are rejected instead of silently
  consuming a native slot.
- Hard Lock deduplicates delayed weakening requests by logical target. Its
  pending sheet shows every request, effective time, and a Cancel action that
  keeps the stronger rule.
- Hard Lock offers 45 minutes through 3 days, can irreversibly remove its own
  off switch, and enforces that invariant in the store rather than only in UI.
- Shortening Hard Lock's delay is treated as a weakening and waits under the
  previously active delay; lengthening it applies immediately.
- App-install and app-removal restrictions are not part of the first-release
  Hard Lock and are no longer sent to Managed Settings.
- Focus Analytics has one privacy-preserving native Device Activity Report at a
  time. It switches between navigable 30-day windows and a selected Daily
  Review. Actual totals, hourly/daily bars, Anasta groups, Apple categories,
  apps, and websites stay inside the report sandbox; React owns only plan,
  target, Session-outline, threshold, and trophy context.

## 2. Effective Protection Resolver

App access is resolved in this order:

1. Missing/revoked authorization prevents an active-protection claim.
2. The Daily Target Essentials-only wall allows permanent Essentials; system
   access that iOS excludes from category shielding can remain available by
   design and is named honestly in the product copy.
3. Quiet Hour intersects with that wall; it never widens it.
4. Outside an allowlist wall, permanent Essentials bypass ordinary plan rules.
5. Always Blocked remains unavailable to Quiet Hour and wins over conflicting
   legacy state.
6. Active Daily or Session group/app rules are evaluated together. The first
   reached rule controls access; Strict wins when simultaneous rules differ.
7. A native temporary Loose exception applies only to its exact opaque token,
   source selection, boundary kind, and threshold. A new check-in, final limit,
   Session, or stricter layer invalidates it immediately. Its own Device
   Activity monitor expires it and it cannot bypass either allowlist wall.
8. A final app/group threshold records the native wall but does not lose
   lower-level eligibility. Only a successfully granted Loose continuation or
   independently observed overage writes `lost`.

Clean Sight is a separate non-relaxable web axis. An Essential browser or a
Quiet Hour exception never bypasses an active blocked domain.

## 3. Native iOS Architecture

The Expo local module is in `modules/anasta-focus` and the config plugin is
`plugins/with-anasta-focus.js`. The generated iOS app has the host target plus:

- `AnastaDeviceActivityMonitor`
- `AnastaShieldConfiguration`
- `AnastaShieldAction`
- `AnastaActivityReport`

All enforcement targets share `group.com.anasta.app.focus`. The report target
does not compile the shared enforcement engine and keeps Screen Time detail in
Apple's report sandbox.

Native behavior already implemented:

- Family Controls authorization and stable product error mapping.
- Both `.approved` and iOS 26 `.approvedWithDataAccess` are accepted as blocker
  authorization, while the product continues to use opaque tokens and does not
  depend on the EU-only non-tokenized data path.
- Private Family Activity picker persistence in the App Group.
- Deduplicated, date-scoped snapshots of opaque plan-group selections keep old
  private reports historically stable when a group is edited later.
- Apps-only policy for Essentials, Always Blocked, individual rules, and plan
  groups. Saving a plan group removes those app tokens from sibling groups.
- Current and next local day scheduling, maximum-four-Session compatibility,
  overnight wall-clock parts, 15-minute minimum validation, and expired
  activity pruning.
- Current and next-day plans are rejected before replacing the last valid native
  payload when a configured group has no private app selection or an individual
  rule does not have exactly one app. The Today picker runs the same preflight
  before requesting activation.
- Separate idempotent fingerprints for plan, Quiet Hour, and temporary-access
  monitors. Foregrounding the app does not restart unchanged schedules.
- Unique plan-monitor revisions. Delayed callbacks from old revisions are
  ignored, while rebuilding the same logical active Session preserves a wall
  that already fired.
- Separate daily all-activity target/hard-wall events. Empty event selections
  intentionally use Apple's `includesAllActivity` behavior.
- Allowlist UI and shield copy explicitly distinguish Anasta Essentials from
  system access that iOS leaves outside category shielding. Removing Safari,
  Settings, or another system tool from Essentials no longer implies that
  Family Controls can guarantee that tool is closed; Clean Sight still applies
  its independent web rules in supported browsers.
- Daily Target loss fires one second beyond the target so exact equality keeps
  the trophy; app/group limits and the hard wall still fire at equality.
- Daily Target loss is mirrored into a compact native ledger as well as the
  callback queue, so queue pressure cannot turn a broken day into a trophy.
- A lightweight no-op rollover activity keeps the current/next-day scheduler
  alive across consecutive days that intentionally have no Phone Plan.
- Non-round Session starts do not include pre-Session activity. Round-hour and
  all-day intervals can include activity already accumulated in their intended
  interval.
- A temporary 15-minute exception is stored only after its expiry monitor
  starts successfully. A failed monitor immediately reapplies protection.
- Temporary access is revalidated after the return practice. A stale open
  intervention cannot grant access or lose a lower-level streak.
- Managed Settings fallback preserves direct Blocked rules, reached walls,
  Always Blocked, Essentials-only, device locks, and Clean Sight even when a
  future threshold schedule fails.
- iOS 26 can open the parental-controls host app directly from a Loose shield.
  Older iOS versions use honest copy telling the person to close the shield and
  open Anasta manually.

## 4. Integrity and Edge Cases

- Reaching a Strict or Loose final limit activates its wall but does not by
  itself lose the lower-level streak. Stopping at the wall is success.
- A lower-level streak becomes lost only after a successful Loose continuation
  (or independently observed overage). The loss is written under the exact
  Session id, group, or app and cannot be erased by later editing.
- Raising a wall that already fired does not reopen it in the same Session,
  because universal Family Controls does not expose exact remaining use to the
  host. `No limit` inside Limit mode explicitly removes the local duration and
  still remains below stronger global layers.
- Changing a picker selection or editing an unrelated rule does not clear a
  reached wall.
- Rebuilding a monitor cannot let an old `intervalDidEnd` callback clear the
  new revision.
- The Daily hard wall is keyed to the local day, not its editable threshold,
  so raising the threshold after the wall fired cannot bypass the rest-of-day
  Essentials-only state.
- Plan and Quiet Hour schedules are independent. A plan edit cannot cancel a
  running Quiet Hour, and a Quiet Hour edit cannot reset plan thresholds.
- If a new Quiet Hour expiry monitor fails, its runtime payload is stripped of
  that Quiet Hour before callbacks can reapply it; unreliable strict expiry is
  treated as a visible start failure.
- Quiet Hour expiry is scheduled before plan monitoring. Runtime status reports
  whether the allowlist is both current and monitored, allowing React to roll
  back only the failed optimistic start rather than leaving a strict ghost state.
- An exact 15-minute Quiet Hour uses its original start timestamp, avoiding a
  false `intervalTooShort` caused by bridge latency.
- A new active-day Session can start only now or later. A current/completed
  Session cannot be removed; removing a future Session expands its predecessor.
- Plan deletion clears that plan's opaque picker selections while preserving
  historical day records and removing future weekday assignments.
- Time and weekday resolution use the phone's local calendar. The host checks
  for day/time-zone changes while active and the monitor extension rolls the
  native window at callbacks.
- Delayed Daily Target events are consumed before an approved native day can
  queue a trophy milestone. Events retain their original local day and plan.
- Native group/app threshold callbacks never mark lower-level eligibility lost
  merely for reaching the wall. The successful Loose continuation path records
  the irreversible loss under the exact Session/group/app key.
- Pending trophy proof is invalidated when Screen Time authorization is
  interrupted; an unverifiable day resolves conservatively rather than being
  rewarded from stale scheduling metadata.
- Revoked or not-determined authorization clears Anasta-owned native settings,
  monitors, temporary access, and pending shield intervention data.
- Switching today to a stricter finite target warns even when exact live usage
  is private; iOS then reconciles past activity against the replacement target.
- A plan with `No Daily Target` never earns a macro trophy merely for existing.
- Today's seven-day preview never renders the in-progress target as an already
  earned trophy; only a resolved prior day can show the kept checkmark.

## 5. Performance Work

- The Focus status uses one Lottie asset. Lottie and Reanimated ambient motion
  pause while the route is unfocused, the app is backgrounded, or Reduce Motion
  is enabled.
- The status animation remains visible while Focus is on screen, as requested,
  but runs at reduced speed and is not on a tap-critical path.
- The circular Session editor uses RNGH plus Reanimated shared values. Arcs and
  boundary handles now follow the finger on the UI thread; React receives only
  the final valid snapped boundary.
- Session boundaries remain at least 30 minutes and drag updates cannot create
  gaps or overlaps.
- Save, toggle, and plan state update optimistically before SQLite persistence.

## 6. Verification Completed

- `npm run test:focus`: 17/17 tests pass across legacy Watch-to-v4 hydration,
  connected and overnight Sessions, add/remove boundaries, permission honesty,
  Quiet Hour exceptions, Always Blocked priority, Daily hard-wall intersection,
  Essentials, strict-vs-loose resolution, Session-local allowance reset, streak
  rules, Clean Sight normalization/capacity, and the serialized SQLite write
  queue. The runner uses the real `dayPlanStore.ts` with only Expo SQLite
  replaced by an in-memory adapter.
- `npx tsc --noEmit`: pass.
- Focus routes/components, the new test suite, and root-layout ESLint: pass.
- `expo-doctor`: 18/18 checks passed after moving the iOS deployment target to
  `expo-build-properties`, adding required native peers, and aligning every
  package to Expo SDK 54. A later Windows child-process invocation crashed, but
  its isolated authoritative check returned `dependencies: []` and
  `upToDate: true`.
- `npx expo config --type public`: pass, including four app extensions and the
  App Group/Family Controls entitlements.
- `git diff --check`: pass (only repository line-ending warnings).
- `npx expo export --platform web`: pass after final dependency alignment; 47
  static routes and the Expo SQLite worker bundled successfully.
- The earlier `npx expo export --platform ios` Hermes run passed with 2,101
  modules and a 12.4 MB bytecode bundle. The current sandbox denied execution
  of the bundled Windows `hermesc.exe`; the matching `--no-bytecode` export
  passed again with all 2,101 modules and 144 assets. EAS will repeat Hermes on
  its macOS builder during the deferred development-build phase.
- `npm start` deliberately remains `expo start --go` for rapid UI iteration.
  `expo-dev-client` is not installed in this phase and will be restored only
  immediately before the first native development build.
- The local web server starts, but the current Windows sandbox closed both
  Playwright and headless-Chrome capture before a current v4 screenshot could
  be produced. The checked-in `focus-page-mobile.png` belongs to the retired
  Watch design and is not accepted as visual evidence for v4.
- Final visual acceptance therefore remains a human Expo Go pass on the current
  v4 screen: smallest supported iPhone, a modern large iPhone, long names,
  keyboard-open sheets, Reduce Motion, and a ten-minute idle animation check.
  This is a visual acceptance gate, not missing product or enforcement logic.

## 7. External Gates Still Required

These are not replaceable by a Windows static check and are deliberately
deferred until the remaining app pages are complete. They are not part of the
current rapid Expo UI iteration loop:

1. Run `eas build --platform ios --profile development` so Xcode compiles the
   Swift host module, all four extensions, entitlements, and embedding phases.
2. Install that development build on a physical iPhone and execute the matrix
   in `docs/ios-focus-native-setup.md`.
3. Verify Screen Time authorization, picker privacy, Daily and Session limits,
   Strict and Loose shields, 15-minute continuation expiry, Quiet Hour expiry
   while Anasta is closed, hard-wall/Quiet intersection, Clean Sight in Safari
   and at least one supported third-party browser, time-zone changes, monitor
   rebuilds, and animation temperature after an idle period.

Expo Go cannot test this native system. After one development build is
installed, ordinary TypeScript/style iterations should use
`npx expo start --dev-client`; rebuild only after Swift, entitlements, config
plugin, or native dependency changes.

## 8. Known Tooling Notes

- Expo SQLite web support is alpha. The dev browser later hit an Expo SQLite
  worker buffer/OPFS error despite the required COOP/COEP headers. Native iOS
  SQLite is a separate backend and the iOS production bundle passes.
- A later `expo install --check` attempt was prevented from opening Expo's
  user-level native-module cache by Windows `EPERM`. The earlier dependency
  alignment check remains green; this cache failure is not a package mismatch.
- The final dependency install reports 20 transitive findings (1 low, 17
  moderate, 1 high, 1 critical), primarily in Expo/Metro CLI tooling. A dry run
  shows safe patch updates are available, but eliminating all findings asks for
  a major Expo 57 upgrade. No `--force` upgrade was applied inside this Focus
  change. Treat the SDK upgrade as a separately tested dependency task.
