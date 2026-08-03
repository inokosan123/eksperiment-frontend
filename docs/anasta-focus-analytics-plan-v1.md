# Anasta Focus Analytics — Product and Implementation Plan v1

**Status:** implementation-ready specification

**Prepared:** 2026-07-28

**Scope:** the full Focus Analytics screen on iOS, including its React Native
shell, Apple-private `DeviceActivityReport` content, local Focus event
summaries, accessibility, performance, physical-device validation, and
distribution readiness.

This document is intentionally more precise than a visual brief. A future
coding agent should be able to implement the feature without inventing product
behavior, metrics, formulas, labels, data ownership, loading rules, or privacy
shortcuts.

---

## 1. What this plan changes

The current screen in
`components/focus-watch/FocusAnalyticsView.tsx` is a useful technical proof:
it has a 30-day trend, a daily review, target consistency, and one native
activity report. It is not the final analytics product.

The final product replaces the `30-day trend / Daily review` model with four
calendar-aligned views:

1. **Day**
2. **Week**
3. **Month**
4. **Year**

The default view is **Week**. Week is the best compromise between useful
pattern recognition and a screen that still feels immediate and personal.

The redesigned screen answers five questions in this order:

1. How much time went to apps I deliberately chose to manage?
2. Is that moving up or down compared with my own previous period?
3. When and where did that time concentrate?
4. How did my Focus protection and my choices respond?
5. What one adjustment could I make next?

The screen must not become a competitive scorecard, a wall of charts, or an
opaque estimate of “time saved.”

---

## 2. Authority and conflict order

If implementation details disagree, use this order:

1. Current Apple API behavior observed on a physical supported iPhone.
2. Apple documentation and entitlement requirements.
3. This analytics specification.
4. `docs/anasta-focus-plan-v4.md`.
5. The current analytics proof-of-concept implementation.

The privacy contract in `docs/anasta-focus-plan-v4.md` remains authoritative:

- Apple Screen Time activity never leaves the report extension.
- React Native never receives exact activity totals, app usage, app labels,
  website history, category usage, pickups, or notifications.
- The report extension may read non-sensitive plan metadata and opaque picker
  tokens from the shared App Group.
- Only one `DeviceActivityReport` may be mounted at a time.

---

## 3. Research process completed for this plan

The plan was produced from five evidence groups.

### 3.0 Decision method

The work followed this sequence:

1. Audit the current screen, local data model, native report, privacy boundary,
   retention, and iOS build path.
2. Inventory competitor screens visually through Mobbin.
3. Collect repeated user requests and complaints from product communities,
   help centers, reviews, and independent discussions.
4. Check whether awareness, goals, or friction are supported by field
   experiments rather than relying only on marketing claims.
5. Map each desired metric to a documented Apple field or an existing Anasta
   event.
6. Reject any metric without a trustworthy source, stable denominator, or
   privacy-safe rendering path.
7. Reduce the surviving metrics to one hierarchy per period.
8. Design the implementation around the report-extension sandbox, one-report
   stability rule, physical-iPhone performance, accessibility, and
   distribution entitlements.

Traceability:

| Research signal | Product decision |
| --- | --- |
| Total Screen Time is distorted by Maps, work, audio, and necessary use | Managed activity is primary; total iPhone activity is context |
| Users want actual historical comparison | Compare the immediately preceding matched personal period |
| Pickups reveal checking behavior but can include benign checks | Show pickups as a neutral supporting signal with an explanation |
| Users want vulnerable times of day | Day includes a qualified two-hour managed-use window |
| Users want app/group trends | Day/Week/Month include a private managed-group breakdown |
| Self-monitoring alone has limited behavior-change effect | End the screen with one concrete plan/protection action |
| “Time saved” estimates create mistrust | Show observed deltas and explicitly labeled annual projections only |
| Dense analytics hides the core answer | One hero, one chart, one signal row, one breakdown, one insight |
| Apple prevents exporting report activity | Keep the whole usage report and life calculation in SwiftUI |
| Multiple simultaneous reports are unstable | Mount exactly one report and sequence period transitions |
| Narrow chart marks are poor touch targets | Scrub the entire plot and support VoiceOver/Audio Graphs |

### 3.1 Current Anasta implementation audit

Reviewed:

- `components/focus-watch/FocusAnalyticsView.tsx`
- `components/focus-watch/FocusNativeActivityReport.tsx`
- `components/focus-watch/FocusSegments.tsx`
- `components/focus-watch/TodayDetailView.tsx`
- `components/focus-watch/dayPlanStore.ts`
- `components/focus-watch/focusWatchDb.ts`
- `components/focus-watch/focusNativeBridge.ts`
- `components/focus-watch/FocusNativeCoordinator.tsx`
- `modules/anasta-focus/ios/AnastaFocusModule.swift`
- `modules/anasta-focus/ios/AnastaActivityReportView.swift`
- `modules/anasta-focus/ios/extensions/AnastaActivityReport.swift`
- `modules/anasta-focus/ios/AnastaFocusEngine.swift`
- `docs/anasta-focus-plan-v4.md`
- `docs/anasta-focus-implementation-audit.md`
- `docs/ios-focus-native-setup.md`
- `tests/focus-v4.test.ts`

Important findings:

- The current native report already renders total activity, daily/hourly
  buckets, Apple categories, apps, websites, and Anasta group activity.
- The current host artificially clamps a report to 31 days.
- The current native trend always divides its headline total by 30, even when
  the report has fewer usable days.
- Historical group reconstruction is implemented only for a single daily
  report. Range views currently return no Anasta groups.
- Past Session Plans are not reconstructed correctly in
  `effectiveRules(in:on:)`; only today’s active Session can produce rules.
- Apple pickup, notification, first-pickup, longest-activity, and
  `lastUpdatedDate` fields are not currently collected.
- `focus_watch_events` is written but has no analytics read/query API.
- `FocusEventKind.attempt` exists but is not produced. It must not be presented
  as “blocked attempts.”
- `recordUsageSnapshot` is exercised by tests but is not fed by the production
  native report. Its persisted totals must not become the source of truth for
  analytics.
- Current plan snapshots and report-selection day scopes retain 400 days. That
  is enough for one-year browsing but not a matched current-year/previous-year
  comparison.

### 3.2 Competitive visual research

Mobbin was used as a visual source, not merely as a list of app names.

Patterns reviewed include:

- [Opal daily activity dashboard](https://mobbin.com/screens/57936754-5497-4e8a-99ae-c227f307492e):
  a dominant usage number, a small number of supporting behavior metrics, an
  hourly pattern, and ranked use.
- [Opal comparative report](https://mobbin.com/screens/e263e7bf-1eca-40db-bec8-f14a550634fd):
  personal period comparison and report-card presentation.
- [Opal long-term report](https://mobbin.com/screens/684c29d7-0869-4e0a-ba36-007894f05b16):
  translating screen-time change into a long-term, emotionally legible
  perspective.
- [TikTok screen-time report](https://mobbin.com/screens/8ca8dc6f-9f9b-4bab-aa4d-da2b07206926):
  weekly total and compact temporal breakdown.
- [Instagram time-management report](https://mobbin.com/screens/1ab3d1f7-3def-4f31-bbd6-1a0bdcf43fd1):
  daily average, weekly bars, and a nearby path to time-management actions.
- [TIDE focus statistics](https://mobbin.com/screens/16231482-0993-4c69-9043-aa44dd6a9655):
  a simple Day/Week switch, comparison, total focus time, and a clear chart.
- [Forest statistics](https://mobbin.com/screens/275c3559-e666-4d63-b6f2-f55c26e19654):
  period switching, daily average, bars, ranked activity, and a direct path back
  to planning.

The useful shared pattern is not “copy Opal.” It is:

- one primary number;
- one comparison;
- one chart;
- two or three supporting signals;
- one ranked breakdown;
- one short interpretation;
- one path back to action.

The rejected pattern is stacking every possible metric above the fold.

### 3.3 User feedback research

Repeated user requests across screen-time products:

- Show time in user-designated distracting apps separately from total phone
  time.
- Show weekly and monthly app/group trends, not only an all-time score.
- Compare against the person’s actual previous period, not an onboarding guess
  or a peer benchmark.
- Show pickups because frequent checking can remain a problem even when total
  time falls.
- Show the time of day when distracting use concentrates.
- Keep core numbers immediately visible and move deep detail lower.
- Make the report actionable: lead back to a limit, schedule, Quiet Hour, or
  protection-strength decision.
- Do not present an estimated “time saved” as an exact fact.

Representative sources:

- [A more actionable Screen Time report](https://community.opalapp.com/t/completed-a-more-actionable-screen-time-report/213)
- [Weekly reports only counting distracting time](https://community.opalapp.com/t/weekly-reports-only-counting-distracting-time/3617)
- [Improve Focus Report](https://community.opalapp.com/t/improve-focus-report-focus-score-hours-spent-most-used-applications-remove-time-on-productive-apps/3676)
- [Add pickups stats](https://community.opal.so/t/add-pickups-stats-report/5573)
- [Conflicting data between report surfaces](https://community.opal.so/t/conflicting-data-between-different-sections-of-the-app/2448)
- [Opal Focus Report explanation](https://opalapp.com/help/what-is-focus-report)
- [Jomo: estimated Screen Time refresh and variance](https://help.jomo.so/en/article/estimated-screen-time-is-incorrect-how-to-fix-it-mhgq52/)
- [Jomo: why its report can differ from Apple Screen Time](https://help.jomo.so/en/article/my-screen-time-on-jomo-is-different-from-apples-screen-time-1l2oxjy/)

### 3.4 Behavior-change research

The product implication is consistent: awareness helps, but awareness alone is
not enough. Analytics should end in a small, relevant adjustment.

- A six-week field study of the one sec intervention found that a short
  intervention at app opening reduced attempted and actual target-app opens:
  [PNAS/PMC study](https://pmc.ncbi.nlm.nih.gov/articles/PMC9974409/).
- A randomized field experiment compared self-monitoring, goal setting, and
  design friction. Self-monitoring by itself was the weakest intervention:
  [Digital Strategies for Screen Time Reduction](https://journals.sagepub.com/doi/10.1089/cyber.2022.0027).
- A randomized trial of a customizable, goal-directed nudge reduced use of a
  user-selected problematic app:
  [Wellspent trial](https://pmc.ncbi.nlm.nih.gov/articles/PMC13062480/).
- Tracking can improve awareness without reliably reducing use:
  [“Your Screen-Time App Is Keeping Track”](https://www.journals.uchicago.edu/doi/abs/10.1086/714365).

Therefore this screen must connect:

`observation → personal comparison → one interpretation → one adjustment`

### 3.5 Apple API and iOS design audit

The plan uses only documented standard Screen Time behavior:

- [`DeviceActivityReport`](https://developer.apple.com/documentation/deviceactivity/deviceactivityreport)
  renders privacy-preserving activity in a sandbox that cannot export sensitive
  report data or make network requests.
- [`DeviceActivityFilter`](https://developer.apple.com/documentation/deviceactivity/deviceactivityfilter)
  supports a date interval, iPhone selection, and optional app/category/domain
  filters.
- [`SegmentInterval`](https://developer.apple.com/documentation/deviceactivity/deviceactivityfilter/segmentinterval-swift.enum)
  supports hourly, daily, and weekly aggregation.
- [`ApplicationActivity`](https://developer.apple.com/documentation/deviceactivity/deviceactivitydata/applicationactivity)
  exposes activity duration, pickups, and notifications.
- [`ActivitySegment`](https://developer.apple.com/documentation/deviceactivity/deviceactivitydata/activitysegment)
  exposes total duration, first pickup, longest activity, and pickups without
  associated application activity.
- [`FamilyActivitySelection`](https://developer.apple.com/documentation/familycontrols/familyactivityselection)
  uses opaque tokens that become invalid if authorization is revoked.
- [Apple chart guidance](https://developer.apple.com/design/human-interface-guidelines/charts)
  requires clear hierarchy, meaningful axes, accessible values, large
  interactive hit areas, and no critical information hidden behind interaction.
- [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility/)
  requires Dynamic Type, non-color state communication, VoiceOver, and a
  Reduced Motion response.
- [Configuring Family Controls](https://developer.apple.com/documentation/xcode/configuring-family-controls)
  requires distribution approval for the app and each Screen Time extension
  used in TestFlight/App Store builds.

### 3.6 Evidence confidence and technology-specific research

Not every online report is an Apple contract. Implementation decisions in this
document use this evidence hierarchy:

| Level | Meaning | How it may change the implementation |
| --- | --- | --- |
| A — official contract | Apple, Expo, React Native, or Software Mansion documentation | May define a hard architectural constraint |
| B — Apple staff guidance | A named Apple engineer response on Apple Developer Forums | Treat as a release constraint unless a newer official source or device test disproves it |
| C — reproducible community evidence | Multiple physical-device reports, a focused reproduction, or a production report with Feedback IDs | Add a defensive path and an explicit device/TestFlight test; do not describe it as guaranteed platform behavior |
| D — single report or hypothesis | One unanswered forum report | Track as a risk and test it; never redesign the product around it without reproduction |
| E — Anasta code audit | A concrete issue in the checked-in stack or configuration | Fix or gate it before the relevant phase exits |

Additional platform sources reviewed for the risk register:

- [Expo iOS App Extensions](https://docs.expo.dev/build-reference/app-extensions/)
  documents that CNG app-extension support is experimental, extensions are
  generated by config plugins during Prebuild, and EAS needs the extension
  declarations before the Xcode project exists.
- [Expo native module/config-plugin tutorial](https://docs.expo.dev/modules/config-plugin-and-native-module-tutorial/)
  documents that native configuration is applied during Prebuild and requires
  a native rebuild, not a JavaScript refresh.
- [Expo config-plugin verification](https://docs.expo.dev/config-plugins/plugins/)
  recommends inspecting the generated native project after a clean Prebuild.
- [Reanimated performance guidance](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/)
  calls out New Architecture animation regressions, high simultaneous-animation
  cost, transform/touch caveats, and different debug/release performance.
- [Reanimated troubleshooting](https://docs.swmansion.com/react-native-reanimated/docs/guides/troubleshooting/)
  requires compatible JavaScript, native, C++, Babel/worklets, React Native, and
  Reanimated versions followed by a native rebuild.
- [Apple engineer guidance on multiple reports](https://developer.apple.com/forums/thread/723118)
  encourages one report on screen for performance. Later comments still report
  unreliable multiple-report behavior. This is level B for the one-report rule
  and level C for continuing symptoms.
- [Physical-device report/host boundary findings](https://developer.apple.com/forums/thread/835517)
  report host-to-report App Group reads working while report-to-host writes,
  host scrolling that begins over a report, and report-presented full-screen
  sheets do not behave like normal in-process views. This unanswered thread is
  level D, so the plan avoids depending on those behaviors and requires local
  reproduction.
- [Production Screen Time inconsistency report](https://developer.apple.com/forums/thread/819997)
  describes corrupted web-domain durations and changing opaque tokens with
  Feedback IDs. This is level C evidence for plausibility guards and
  re-authorization recovery, not proof that every OS/device is affected.
- [Release-only weekly/monthly blank-report reports](https://developer.apple.com/forums/tags/device-activity?page=3)
  and [intermittent report service `Code=2`](https://developer.apple.com/forums/tags/family-controls/?page=4&sortBy=oldest)
  are level C/D evidence for a TestFlight gate, timeout UI, and one controlled
  retry.
- [DeviceActivityReport sizing/background reports](https://developer.apple.com/forums/thread/742471)
  are level C evidence that the remote report should receive an explicit
  container, matching first-frame background, and physical-OS visual tests.
- [Xcode 15/iOS 16 blank-report regression](https://developer.apple.com/forums/thread/735915)
  includes a reported Apple DTS response that the issue would not be fixed on
  iOS 16. It does not establish current behavior, but it makes the minimum-iOS
  matrix a hard release gate.

The risk register below intentionally separates documented guarantees from
community evidence. A community report never authorizes private API, exporting
Screen Time data, fabricating totals, or weakening privacy.

---

## 4. Locked product decisions

These are not implementation suggestions. They are the v1 product contract.

### 4.1 Primary metric

For Day, Week, and Month the primary metric is:

> **Managed activity**
>
> Time in apps, categories, and websites the person deliberately placed in
> Focus groups or Always Blocked.

Use the UI label `MANAGED ACTIVITY`.

Supporting explanation:

> Apps, categories, and websites you chose to manage with Focus.

Do not call this metric “productive time,” “bad time,” or “addiction time.”
Anasta does not infer moral value from an Apple category.

Total Apple activity is secondary and uses the label:

> **Total iPhone activity**

For Year the primary metric becomes total iPhone time translated into full
24-hour days. Managed activity remains supporting context.

### 4.2 Default period

Open Analytics in **Week**, using the current Monday-through-Sunday week.

Anasta already uses a Monday-first weekly planning model. Analytics must use the
same order everywhere, regardless of the device locale:

`Mon, Tue, Wed, Thu, Fri, Sat, Sun`

Sunday must be explicitly covered by unit and physical-device tests.

### 4.3 Personal comparison

Comparison is always with the immediately preceding equivalent calendar period:

- Day: no default delta; a partial current day is too easy to misread.
- Week: previous Monday-through-Sunday week.
- Month: previous calendar month.
- Year: previous calendar year when sufficient Apple activity is available.

For an in-progress current Week, Month, or Year, compare complete matched units
only:

- current Week through yesterday vs the same weekdays of the previous week;
- current Month through yesterday vs the same day numbers of the previous
  month;
- current Year through the last complete month vs the same complete months of
  the previous year.

The current partial day stays visible in the chart but is excluded from the
comparison average.

### 4.4 No peer comparison

Do not ship:

- global percentile;
- age-group ranking;
- friends leaderboard;
- “better than X% of users”;
- a single proprietary Focus Score.

Those elements can create interest, but they obscure the more useful personal
question: “Am I moving toward the life and plan I chose?”

### 4.5 No exact “time saved”

Do not display:

- “time saved” based on a population average;
- “years reclaimed” based on onboarding self-report;
- “life gained”;
- a lifespan/death-age estimate.

Allowed:

- `34m lower per complete day than last week`;
- `8h 12m below the previous month`;
- `23.4 full days of iPhone activity so far this year`;
- `At this pace: about 47 full days in a year`.

The last statement must visibly include `At this pace` or `Projection`.

### 4.6 One insight, self-contained report

Render at most one generated insight for the selected period. It must be a
deterministic interpretation of visible values, not an LLM response.

Do not render a persistent Quiet Hour, plan-review, or plan-edit action rail.
Analytics is a self-contained reading surface. Authorization recovery actions
appear only in the permission state where they are required.

---

## 5. Terminology and metric dictionary

### 5.1 Managed activity

**Definition**

Activity represented by the union of opaque items contained in:

- any Focus group selection associated with the plan snapshot for that local
  date; and
- the historical Always Blocked selection snapshot for that local date.

The supported item types are:

- explicit `ApplicationToken`s;
- selected `ActivityCategoryToken`s;
- explicit `WebDomainToken`s.

**Formula**

For every activity segment:

1. Resolve the segment’s local date.
2. Load that date’s historical report-selection scope.
3. Build stable ownership maps for selected category, application, and web
   domain tokens.
4. Traverse each `CategoryActivity` once.
5. If the category token is managed, add
   `category.totalActivityDuration` once and use nested apps/sites only for its
   breakdown.
6. If the category is not managed, add each explicitly managed application or
   web-domain duration once.
7. Never add an explicit child duration after its managed category total has
   already included it.
8. Never sum the same token twice if it appears in more than one group.

Conceptually:

`managedSeconds =
  Σ managed category totals
  + Σ managed explicit app durations outside managed categories
  + Σ managed explicit web-domain durations outside managed categories`

**Ownership**

Calculated and rendered only inside
`AnastaActivityReport`/`DeviceActivityReport`.

**Overlap rule**

Anasta’s normal group editor should prevent multi-group ownership, but the
report must still defend against legacy or corrupt overlap. Attribute a
category/app/domain to the first matching group in this stable priority:

1. Always Blocked
2. plan group order from the historical snapshot
3. case-insensitive group ID as the final deterministic tie-breaker

The overall managed total counts each activity hierarchy once.

**Historical plan rule**

For Session Plans, managed membership is the union of apps, categories, and
websites the person selected for that date’s Session rules. The metric does not
claim an item was actively blocked during every second of use. That is why the
label is “Managed activity,” not “Blocked activity.”

### 5.2 Total iPhone activity

**Definition**

The sum of `ActivitySegment.totalActivityDuration` for the `.iPhone` device
filter in the selected report interval.

`totalSeconds = Σ segment.totalActivityDuration`

Do not rebuild total time by adding applications. Apple’s segment total is the
source of truth.

### 5.3 Other iPhone activity

`otherSeconds = max(0, totalSeconds - managedSeconds)`

This is visual context, not a moral category. Label it `Other activity`.

### 5.4 Daily average

Past period:

`dailyAverage = periodTotal / availableCompleteDayCount`

Current period:

- exclude today from the primary average;
- include today as a separate `Today so far` value and chart bar;
- if there are no complete days yet, make `Today so far` the primary value and
  hide the comparison.

Never divide by a hard-coded 7, 30, 31, or 365.

### 5.5 Previous-period delta

For the same metric and matched complete units:

`absoluteDelta = currentAverage - previousAverage`

`percentDelta = previousAverage > 0
  ? absoluteDelta / previousAverage * 100
  : unavailable`

UI rules:

- primary comparison text uses the absolute time, for example
  `42m lower per day`;
- percent may appear in smaller supporting text;
- hide percent when the previous value is zero;
- hide the entire delta when matched coverage is below the threshold in
  section 8.

### 5.6 Pickups

Per segment:

`pickups =
  Σ application.numberOfPickups
  + segment.totalPickupsWithoutApplicationActivity`

Requirements:

- traverse each application once within the segment;
- do not sum category pickup values because the API exposes pickups at the
  application level;
- filter to `.iPhone`;
- label the metric `iPhone pickups`;
- add an info explanation:
  `Includes pickups for alarms, time checks, and other iPhone use.`

Pickups are a behavior signal, not proof of distraction.

### 5.7 Notifications

`notifications = Σ application.numberOfNotifications`

Notifications are collected for detail and accessibility summaries but are not
one of the default three headline signals. They can appear in Day detail after
physical-device validation proves the values are stable and useful.

### 5.8 First pickup

Use the earliest non-null `ActivitySegment.firstPickup` for the selected Day.

Display only in Day:

`First pickup  ·  7:42 AM`

Do not average first-pickup times across a month in v1.

### 5.9 Peak managed-use window

Day uses hourly segments. Build rolling two-hour totals:

`window(h) = managedSeconds[h] + managedSeconds[h + 1]`

Select the earliest window with the maximum value.

Only show a peak window when:

- managed time in the winning window is at least 20 minutes; and
- it represents at least 20% of the day’s managed time.

Example:

`Most managed use clustered from 9–11 PM.`

Week, Month, and Year do not claim an hourly peak in v1 because their report
filters use daily segments for performance and accuracy.

### 5.10 Goal-kept rate

This is an Anasta local-plan metric, not Apple activity:

`goalKeptRate = keptDays / (keptDays + brokenDays)`

Exclude:

- rest/off days;
- days without a Daily Target;
- current pending day;
- unresolved days after authorization loss;
- future days.

Label:

`Daily Target kept`

Example:

`5 of 7 resolved days`

Do not call it “consistency” without the denominator.

### 5.11 Returned Moments

Count local `focus_watch_events.kind = 'returned'` inside the selected local
period. A Returned Moment is recorded only after the intervention flow calls
`recordReturnedMoment`.

Do not use the all-time `returnedMoments` meta value for period analytics.

### 5.12 Extra-access choices

Separate:

- `door_opened`
- `checkin_continued`

The UI may combine them under:

`Extra access chosen`

The detail line must still expose the composition, for example:

`1 Loose door · 2 check-ins`

### 5.13 Limit events

Use:

- `limit_exceeded`
- `zone_breach`

Do not count `Daily Target` loss twice if both the day record and an event refer
to the same threshold. Day status owns the target outcome. Events explain
lower-level limit behavior.

### 5.14 Quiet Hours

Count `quiet_started`. A matching `quiet_ended` is lifecycle detail and must not
increase the session count.

If a Quiet Hour was optimistically started and rolled back because native
enforcement failed, future implementation must either:

- write a compensating `quiet_start_failed` event; or
- remove/mark the just-created start event.

Until that lifecycle is added, label this value `Quiet Hours started`, not
`completed`.

### 5.15 Full days of phone time

Observed:

`observedFullDays = totalActivitySeconds / 86_400`

Annual pace:

`annualPaceFullDays =
  completeDayAverageSeconds * 365 / 86_400`

Daily Target pace:

`targetPaceFullDays =
  dailyTargetMinutes * 365 / 1_440`

Formatting:

- under 10 days: one decimal, for example `7.4 days`;
- 10 days or more: nearest whole day in the hero, exact one-decimal value in
  VoiceOver;
- prefix projected values with `About` or show a visible `PROJECTION` label.

The 365 constant intentionally matches the existing Daily Target perspective in
`docs/anasta-focus-plan-v4.md`.

---

## 6. Final information architecture

### 6.1 Screen ownership

The screen has two layers:

#### React Native shell

Owns:

- app navigation;
- screen title;
- period control;
- selected calendar period;
- previous/next navigation;
- querying local Anasta outcomes/events;
- one-way synchronization of non-sensitive analytics context;
- mounting exactly one native report;
- permission/error recovery actions.

#### Native SwiftUI report

Owns:

- the only vertical scrolling region for analytics content;
- Apple-private activity totals;
- managed activity;
- comparison calculations that involve activity;
- charts;
- pickups, first pickup, and notifications;
- private app/category/domain labels and icons;
- the Year/life calculation;
- deterministic activity insight;
- rendering the non-sensitive Anasta summary passed by the host.

No Apple-private metric crosses from the report extension to React Native.

### 6.2 Root layout

`FocusAnalyticsView` must not wrap the native report in an outer vertical
`ScrollView`.

Use this structure:

```text
Safe-area screen
├── ScreenTitleBar("FOCUS ANALYTICS")
├── Period control: Day | Week | Month | Year
├── Calendar period navigator
└── Native report container (flex: 1, only vertical scroll owner)
```

The native report adds only normal safe-area breathing room after its final
privacy line.

### 6.3 First-screen hierarchy

Without scrolling, the user should see:

1. title;
2. period;
3. selected date/range;
4. most or all of the primary hero;
5. the beginning of the chart.

Do not place streak and all-time trophies above the period selector. Trophy
history already has its own Focus surface.

---

## 7. Exact content by period

### 7.1 Day

Default selection: today.

Header range:

- today: `Today · July 28`
- past day: `Monday · July 21`

Native content order:

1. **Managed activity hero**
   - kicker: `MANAGED ACTIVITY`
   - primary: selected-day managed duration
   - supporting: `of 4h 48m total iPhone activity`
   - selected plan name and Daily Target, when present
   - today must say `so far`
2. **Hourly rhythm**
   - 24 hourly bars;
   - managed time in muted crimson;
   - other activity in warm stone/gold-neutral;
   - no more than six visible axis labels;
   - interactive scrub across the entire plot area;
   - selection callout states hour, managed time, and total activity.
3. **Behavior signals**
   - iPhone pickups;
   - first pickup;
   - managed share of total activity.
4. **Managed groups**
   - maximum five groups;
   - duration and share of managed time;
   - within each group, maximum three app rows;
   - app rows use Apple’s token label/icon inside the extension.
5. **One insight**
   - prefer peak two-hour window;
   - otherwise top managed group;
   - otherwise a neutral no-pattern message.
6. **How protection held**
   - target state: kept, missed, in progress, no target, or unresolved;
   - Returned Moments;
   - Extra access chosen;
   - lower-level limit events;
   - Quiet Hours started.
7. **Freshness/privacy footer**

Do not show a previous-day percentage delta by default.

### 7.2 Week

Calendar: Monday 00:00 through Sunday 24:00 local time.

Header:

- current: `This week`
- past: `Jul 14–20`

Native content order:

1. **Managed activity hero**
   - primary: complete-day managed average;
   - secondary: selected-period managed total;
   - secondary: total iPhone average;
   - comparison: previous matched week.
2. **Seven-day chart**
   - fixed Monday-through-Sunday order;
   - stacked bar: managed + other activity;
   - a small horizontal target tick for each day that had a Daily Target;
   - current partial day uses diagonal/low-opacity treatment plus `SO FAR`;
   - missing data uses an outlined placeholder, never a zero-height success bar.
3. **Behavior signals**
   - pickups per complete day;
   - Daily Target kept;
   - Returned Moments.
4. **Managed groups**
   - maximum five;
   - duration, period share, and delta vs prior week when available.
5. **One insight**
   - comparison change if meaningful;
   - otherwise heaviest day;
   - otherwise top group.
6. **Protection choices**
   - extra access, limit events, Quiet Hours started.
7. **Freshness/privacy footer**

### 7.3 Month

Calendar month, not “last 30 days.”

Header:

- current: `July 2026`
- past: `June 2026`

Native content order:

1. **Managed activity hero**
   - complete-day average;
   - monthly total;
   - previous matched month comparison;
   - total iPhone average as context.
2. **Daily month chart**
   - 28–31 daily bars;
   - managed + other activity;
   - per-day target marker;
   - only weekly/date anchor labels, not 31 labels;
   - scrub target is the full plot, not each narrow bar.
3. **Behavior signals**
   - pickups per complete day;
   - Daily Target kept;
   - count of resolved plan days.
4. **Managed groups**
   - maximum five;
   - current total and delta vs previous matched month.
5. **One insight**
   - comparison first;
   - then heaviest weekday;
   - then most changed group.
6. **Protection choices**
7. **Freshness/privacy footer**

### 7.4 Year

Calendar year, not “last 365 days.”

Header:

- current: `2026`
- past: `2025`

The Year view intentionally becomes more reflective and less granular.

Native content order:

1. **Time made visible**
   - current year: `23.4 full days so far`;
   - completed year: `51 full days in 2025`;
   - support: `At this pace: about 47 full days in a year`;
   - support: managed-app portion if historical selections are available;
   - support: current Daily Target pace.
2. **365-bead perspective**
   - 365 small marks in a 7-row weekly field;
   - projected/observed phone-equivalent days use gold/crimson;
   - remaining year uses warm low-contrast neutral;
   - do not assume or visualize sleep in Analytics;
   - one grouped VoiceOver element, not 365 focusable elements.
3. **Twelve-month chart**
   - monthly daily average;
   - selected year and previous year series;
   - current incomplete month visibly partial;
   - if previous-year coverage is unavailable, show only selected year and
     explain why.
4. **Year summary**
   - selected-year total;
   - complete-day average;
   - Daily Target kept rate;
   - lightest and heaviest sufficiently covered month.
5. **One insight**
   - year-over-year change when qualified;
   - otherwise best sustained three-month direction;
   - otherwise coverage guidance.
6. **Freshness/privacy footer**

Year v1 does not render a top-app list. This keeps the report fast and prevents
the life perspective from becoming another dense ranked-app screen.

---

## 8. Coverage, partial data, and honesty rules

### 8.1 Never convert unknown into zero

An absent segment, revoked authorization, stale opaque token, or unavailable
history is not zero activity.

Every expected local day must have one of:

- `available`
- `partialToday`
- `missing`
- `notAuthorized`
- `future`

### 8.2 Comparison thresholds

Only show a directional comparison when both periods satisfy:

| Period | Minimum matched complete units | Minimum coverage |
| --- | ---: | ---: |
| Week | 4 days each | 80% |
| Month | 14 days each | 80% |
| Year | 3 complete months each | 80% of matched days |

When the threshold is not met, show:

`Not enough matched iPhone activity for a reliable comparison yet.`

Do not show `0% change`.

### 8.3 Annual projection threshold

Show annual pace after seven available complete days.

Before seven days:

`A full week of complete activity will unlock your annual pace.`

The observed year-to-date full-day total can still render when data exists.

### 8.4 Freshness

Collect the maximum `DeviceActivityData.lastUpdatedDate`.

Footer examples:

- `Updated by iPhone 8 minutes ago`
- `Updated by iPhone yesterday at 11:42 PM`
- `iPhone is still preparing this report`

If the selected interval contains today and the update is older than 30
minutes, show the last-updated line in amber. Do not call the value “wrong” or
invent a refresh promise.

### 8.5 Authorization states

#### Not determined

Title:

`See your Focus patterns`

Body:

`Allow Screen Time access so iPhone can prepare private activity reports. App
and website activity stays inside Apple’s report.`

Primary action:

`Allow Screen Time access`

#### Denied or revoked

Title:

`Screen Time access is off`

Body:

`Your existing plans stay on this iPhone, but activity analytics need Screen
Time access.`

Primary action:

`Open Settings`

Never show historical opaque app labels after token revocation as though they
were still valid.

### 8.6 Empty but authorized

Title:

`No iPhone activity in this period`

Body:

`If this period is recent, iPhone may still be preparing it.`

Keep the last-updated line visible.

### 8.7 No Focus plan

Apple total activity can still render.

Managed activity state:

`No managed activity for this period`

Do not relabel all phone activity as managed.

---

## 9. Deterministic insight engine

The insight engine runs inside the report extension for private activity
insights. It returns exactly one visible insight.

Priority order:

1. Qualified previous-period change.
2. Qualified peak window in Day.
3. Qualified concentrated day in Week/Month.
4. Qualified group change.
5. Neutral distribution statement.

### 9.1 Meaningful change threshold

A change is meaningful when both are true:

- absolute daily-average difference is at least 15 minutes; and
- absolute percentage difference is at least 10%.

Copy:

- `Managed activity was 42 minutes lower per complete day than last week.`
- `Managed activity was 28 minutes higher per complete day than June.`

Avoid:

- `Great job`
- `You failed`
- `Bad week`
- `You were addicted`

### 9.2 Concentrated day

Show when one day has at least 25% of the period’s managed time and the period
contains at least four available days.

Copy:

`Friday carried the largest share of managed activity: 2h 12m.`

### 9.3 Group change

Show when a group changed by at least 20 minutes/day and 15%.

Copy:

`Social was 31 minutes lower per complete day than last month.`

### 9.4 Neutral fallback

Examples:

- `Managed activity was spread fairly evenly across this week.`
- `There is not enough managed activity yet to identify a clear pattern.`

---

## 10. Host actions

The Analytics surface has no persistent product-action rail. The React Native
host owns only recovery actions that are necessary to display the report:

- Screen Time authorization when permission is not determined;
- Settings recovery when permission is denied or revoked;
- Retry when a private report times out or fails to prepare.

Quiet Hour and plan editing remain on their existing Focus surfaces.

---

## 11. Visual system

### 11.1 Relationship to the app

Use existing Anasta tokens and visual language:

- background: `C.bg` / warm off-white;
- surfaces: `C.surface`;
- primary text: `C.text`;
- secondary: `C.textSecondary`;
- muted: `C.textMuted`;
- border: `C.border`;
- gold: `C.gold`, `C.goldDark`, `C.goldLight`;
- negative/over-target: restrained crimson;
- positive/on-track: restrained sage.

Typography:

- editorial hero and major values: EB Garamond;
- labels, axes, controls, and supporting copy: Inter;
- durations and chart values: tabular numerals.

The SwiftUI report must define semantic equivalents once, rather than
scattering new hex values through views.

### 11.2 Cards

- continuous corner radius;
- hero radius: 24–26;
- chart radius: 18–20;
- signal cards: 16–18;
- 1-pixel warm border;
- low-opacity, short shadow only on the hero;
- no glass blur behind dense chart data;
- no heavy glow animation.

### 11.3 Color meaning

- managed activity: muted crimson/rose;
- other iPhone activity: warm stone/gold-neutral;
- Daily Target marker: dark gold;
- kept/on-track: sage;
- unavailable/missing: outline plus hatch, not gray alone;
- partial today: lower opacity plus `SO FAR`, not opacity alone.

Never encode a status only through color.

### 11.4 Period control

Create an analytics-local component:

`components/focus-watch/analytics/FocusAnalyticsPeriodControl.tsx`

Requirements:

- Day / Week / Month / Year;
- height 42;
- minimum 44-point effective hit target;
- Reanimated shared-value thumb;
- RNGH `GestureDetector` for horizontal movement;
- tap and short swipe both supported;
- selection haptic once per committed period;
- no modification of the shared `FocusSegments` component;
- labels remain readable at supported Dynamic Type sizes; if necessary, the
  control grows vertically instead of clipping.

### 11.5 Charts

Use Apple `Charts`/Swift Charts in the report extension. The extension already
targets iOS 16, so no third-party chart dependency is required.

Rules:

- bar charts start at zero;
- no misleading cropped Y-axis;
- two or three light grid lines maximum;
- chart data is visually stronger than axes;
- target markers are separate marks, not another full-color series;
- no legend when direct labels suffice;
- chart title and one-sentence summary are always visible;
- interaction reveals detail but is never required to understand the result.

### 11.6 365-bead field

Use a SwiftUI `LazyVGrid` with 53 columns and seven rows or an equivalent
orientation that preserves the existing Anasta yearly-field character.

Performance:

- static vector circles/rounded marks;
- no 365 independent looping animations;
- one short entrance reveal only;
- in Reduce Motion, render immediately.

Accessibility:

- hide individual marks from VoiceOver;
- expose one combined label, for example:
  `Annual pace projection: 47 of 365 full days in iPhone activity.`

---

## 12. Motion and interaction

### 12.1 React Native motion

Follow the repository animation standard:

- `react-native-gesture-handler`
- `react-native-reanimated`
- no new `PanResponder`
- no new React Native `Animated.Value`, `Animated.timing`, or
  `Animated.spring`

Period selection:

- thumb: spring, damping 18, stiffness approximately 260, mass approximately
  0.7;
- report shell fades out over 100–120 ms;
- old native report unmounts completely;
- analytics context sync completes;
- one new report mounts;
- shell fades in over 160–190 ms with at most 6 points of vertical movement.

There must never be an outgoing and incoming `DeviceActivityReport` mounted at
the same time.

### 12.2 Native chart interaction

Swift Charts uses one full-plot scrub gesture:

- Day: selects an hour;
- Week/Month: selects a day;
- Year: selects a month.

Selection presents a small native callout above the plot. It does not attempt
to navigate React Native because private report content must not signal usage
values to the host.

### 12.3 Reduce Motion

When Reduce Motion is enabled:

- period content uses opacity only;
- no scale or directional slide;
- chart bars update without a cascading entrance;
- 365 beads render immediately;
- chart selection still provides haptic/visual feedback without motion.

---

## 13. Privacy-safe technical architecture

### 13.1 One-way data diagram

```text
SQLite/dayPlanStore
  └─ non-sensitive summaries only
       └─ AnastaFocus.syncAnalyticsContext(json)
            └─ App Group UserDefaults
                 └─ DeviceActivityReport extension reads context

Apple DeviceActivityResults
  └─ report extension calculates and renders private activity
       └─ NEVER exported to RN, SQLite, UserDefaults, files, or network
```

### 13.2 Why the entire report body is native

If React Native owned the hero while SwiftUI owned the chart, the app would
need to export exact Apple activity out of the privacy sandbox. That is not
allowed.

If React Native scrolled around a fixed-height native report that also scrolled,
the screen would have nested-scroll and clipping problems.

Therefore:

- RN owns the fixed header and actions;
- the native report fills the remaining viewport;
- the native report owns one vertical `ScrollView`;
- local Anasta summaries travel into the extension;
- private usage never travels out.

### 13.3 New analytics context payload

Add a native async function:

`syncAnalyticsContext(payloadJson: String)`

Store under:

- request envelope:
  `anasta.focus.analytics-context.request.<requestId>.v1`
- current pointer:
  `anasta.focus.analytics-context.current.v1`

Write the complete request envelope first and the small pointer second. Keep
the current and immediately previous request envelopes, then prune older
analytics envelopes. Do not overwrite a single shared JSON value in place and
do not rely on `UserDefaults.synchronize()`.

Payload:

```ts
type FocusAnalyticsContextPayload = {
  schemaVersion: 1;
  requestId: string;
  generatedAt: number;
  timezone: string;
  locale: string;
  period: 'day' | 'week' | 'month' | 'year';
  selectedStartDate: string; // local YYYY-MM-DD
  selectedEndDateExclusive: string;
  comparisonStartDate: string | null;
  comparisonEndDateExclusive: string | null;
  selected: {
    resolvedTargetDays: number;
    keptTargetDays: number;
    brokenTargetDays: number;
    returnedMoments: number;
    doorOpened: number;
    checkinsContinued: number;
    limitExceeded: number;
    zoneBreaches: number;
    quietHoursStarted: number;
  };
  comparison: {
    resolvedTargetDays: number;
    keptTargetDays: number;
    brokenTargetDays: number;
    returnedMoments: number;
    doorOpened: number;
    checkinsContinued: number;
    limitExceeded: number;
    zoneBreaches: number;
    quietHoursStarted: number;
  } | null;
  dayOutcomes: Array<{
    date: string;
    planId: string | null;
    planName: string | null;
    targetMinutes: number | null;
    state:
      | 'kept'
      | 'broken'
      | 'pending'
      | 'off'
      | 'noTarget'
      | 'unresolved';
  }>;
};
```

Forbidden payload fields:

- Apple usage duration;
- app/category/domain label;
- app/category/domain token serialized into JSON;
- pickup or notification count;
- first pickup;
- private report insight.

Opaque selection tokens remain in their existing encoded
`FamilyActivitySelection` storage, not this JSON payload.

### 13.4 Request synchronization

Host sequence:

1. User commits a period/date change.
2. Increment a local request generation.
3. Unmount the existing report.
4. Query local event/day summaries.
5. Call `syncAnalyticsContext`, which writes the request envelope and then its
   pointer.
6. If a newer generation exists, discard this completion.
7. The extension reads pointer → envelope and validates schema/request/period.
8. Mount one native report using the same period/date contract.
9. Fade the report shell in.

The payload’s `requestId`, period, and dates must be checked by the native
wrapper/report metadata reader. A mismatch renders an internal neutral loading
state, never previous-period content under a new header.

### 13.5 Native report contexts

Add:

```swift
extension DeviceActivityReport.Context {
  static let anastaAnalyticsDay = Self("anasta.analytics.day")
  static let anastaAnalyticsWeek = Self("anasta.analytics.week")
  static let anastaAnalyticsMonth = Self("anasta.analytics.month")
  static let anastaAnalyticsYear = Self("anasta.analytics.year")
}
```

Keep existing `.anastaDaily` and `.anastaTrend` until `TodayDetailView` and any
other caller are independently migrated. Do not break today’s report to build
Analytics.

### 13.6 Native filters

All filters:

- `users: .all`
- `devices: [.iPhone]`
- no app/category/domain subset, because total iPhone activity is required.

Period filters:

| Context | Segment | Filter interval |
| --- | --- | --- |
| Day | hourly | selected local day only, ending now if today |
| Week | daily | previous week start through selected week end/now |
| Month | daily | previous month start through selected month end/now |
| Year | daily | previous year start through selected year end/now |

Apple’s hourly filter rounds sub-hour components. Day copy and freshness must
not imply minute-perfect hourly bucket boundaries.

The current `safeDays = min(days, 31)` clamp is an Anasta implementation
choice, not an Apple product contract. Remove it only in the new analytics
wrapper; preserve the existing wrapper until its callers are audited.

### 13.7 Year performance gate

A two-calendar-year daily filter can cover up to 731 days. The Year scene must
use a summary-first collector:

- iterate segment totals and dates;
- do not retain per-app rows for Year;
- only calculate managed activity when the historical selection scope exists;
- cap in-memory monthly structures to 24 buckets;
- release temporary token dictionaries after each segment;
- do not render top apps, sites, or categories.

Before shipping, benchmark on the weakest supported physical iPhone.

Release gate:

- report appears without extension termination;
- median usable-content time at or below 1.5 seconds for cached/recent data;
- no visible frame stall over 100 ms while scrolling;
- stable memory over ten period changes.

If the two-year filter fails this gate:

1. keep year navigation and selected-year total;
2. request one calendar year only;
3. remove automatic previous-year delta;
4. preserve manual year-to-year navigation;
5. do not replace exact data with a JavaScript estimate.

### 13.8 Historical selection reconstruction

Refactor the report collector from one whole-period `appDurations` dictionary
to per-segment processing.

For each segment:

1. derive local date;
2. load the date’s report-selection scope;
3. load the compact historical plan metadata;
4. collect token durations for that segment;
5. calculate managed total and group totals for that date;
6. aggregate only the resulting numeric values inside the extension;
7. discard the segment token dictionary.

This fixes the current range-report limitation where groups are only returned
for `mode == .daily`.

### 13.9 Report-selection snapshots

Extend report history support from 400 to **800 local days** for:

- plan report snapshots;
- report-selection day scopes;
- target-armed day metadata required by historical target states.

Do not duplicate opaque selections 800 times. Continue the current
fingerprinted scope model:

- identical selections share one scope;
- the day map points to a scope;
- only scopes referenced by retained days remain.

Include Always Blocked strict/loose selections in the historical scope
fingerprint and snapshot. Otherwise a later Always Blocked edit would rewrite
the meaning of old Managed activity.

The production report does not guarantee that Apple retains 800 days of
activity. Retention only ensures Anasta metadata is not the artificial blocker.

### 13.10 Session Plan history

Replace the current “only today’s current Session” report rule.

For historical metadata:

- store all Session names, start/end minutes, group rules, and target in the day
  snapshot;
- for Day hourly detail, resolve a Session using the activity bucket’s local
  midpoint;
- for managed membership in Week/Month, use the union of all groups/apps the
  historical day plan managed;
- never add different Session limits together and present the sum as one active
  daily allowance.

The Day report may annotate a selected hourly bucket with its historical
Session name. Week/Month do not show a fabricated combined Session limit.

---

## 14. Local database and model work

### 14.1 Add read APIs

In `components/focus-watch/focusWatchDb.ts`, add:

```ts
export async function getFocusEventRowsBetween(
  startMsInclusive: number,
  endMsExclusive: number
): Promise<EventRow[]>
```

SQL:

```sql
SELECT id, ts, kind, group_id, plan_id, meta_json
FROM focus_watch_events
WHERE ts >= ? AND ts < ?
ORDER BY ts ASC, id ASC
```

The existing `idx_focus_watch_events_ts` index is sufficient.

Also add a calendar-day query for daily/weekly/monthly summaries:

```ts
export async function getFocusEventRowsForLocalDays(input: {
  startDayInclusive: string; // YYYY-MM-DD
  endDayExclusive: string;
  legacyStartMsInclusive: number;
  legacyEndMsExclusive: number;
}): Promise<EventRow[]>
```

It uses the write-time day for new rows and a timestamp fallback only for
legacy rows:

```sql
SELECT
  id, ts, local_day, timezone_id, utc_offset_minutes,
  kind, group_id, plan_id, meta_json
FROM focus_watch_events
WHERE
  (local_day >= ? AND local_day < ?)
  OR (
    local_day IS NULL
    AND ts >= ?
    AND ts < ?
  )
ORDER BY ts ASC, id ASC
```

Add `idx_focus_watch_events_local_day` on `local_day`.

Add a pure TypeScript aggregation module:

`components/focus-watch/analytics/focusAnalyticsModel.ts`

Exports:

```ts
export type FocusLocalPeriodSummary = {
  resolvedTargetDays: number;
  keptTargetDays: number;
  brokenTargetDays: number;
  returnedMoments: number;
  doorOpened: number;
  checkinsContinued: number;
  limitExceeded: number;
  zoneBreaches: number;
  quietHoursStarted: number;
};

export function aggregateFocusLocalPeriod(...): FocusLocalPeriodSummary;
export function buildAnalyticsDateRange(...): FocusAnalyticsDateRange;
```

Keep aggregation pure and unit-testable. Database functions only load rows.

### 14.2 Do not use `recordUsageSnapshot`

Do not wire `DeviceActivityReport` totals into `recordUsageSnapshot`.

Do not use `state.usageByDate` for:

- hero totals;
- comparisons;
- charts;
- life-day calculations;
- app/group ranking.

The function can remain for preview/test compatibility until separately
deprecated, but the final analytics source of truth is Apple’s private report.

### 14.3 Dead `attempt` metric

Do not display “attempts blocked.”

Choose one later project:

- instrument a trustworthy native shield-attempt event with idempotency and
  lifecycle semantics; or
- remove `FocusEventKind.attempt`.

It is out of scope for analytics v1.

### 14.4 Event retention

Focus events are low-frequency and local. Preserve at least 800 days so
year-over-year local comparisons work.

If cleanup is added, use:

- raw event retention: 1,100 days;
- delete only after a successful DB open and a verified cutoff;
- never clear events as part of opening Analytics;
- cover the cutoff with tests.

A daily rollup table is unnecessary for v1 unless real-device profiling shows
the indexed range query is slow.

### 14.5 Preserve event day across time-zone changes

`focus_watch_events` currently stores only an absolute `ts`. If a person
records an event in Belgrade and later opens Analytics in New York, deriving
the historical day with the *current* time zone can move that event to a
different calendar day. The existing “do not rewrite stored local day keys”
rule is impossible to satisfy without storing the original local-day context.

Add nullable columns through idempotent migrations:

```sql
ALTER TABLE focus_watch_events ADD COLUMN local_day TEXT;
ALTER TABLE focus_watch_events ADD COLUMN timezone_id TEXT;
ALTER TABLE focus_watch_events ADD COLUMN utc_offset_minutes INTEGER;
CREATE INDEX IF NOT EXISTS idx_focus_watch_events_local_day
  ON focus_watch_events(local_day);
```

Extend `EventRow`:

```ts
type EventRow = {
  id: string;
  ts: number;
  local_day: string | null;
  timezone_id: string | null;
  utc_offset_minutes: number | null;
  kind: string;
  group_id: string | null;
  plan_id: string | null;
  meta_json: string | null;
};
```

Every new optimistic event write captures all three calendar fields at the
same instant as `ts`. Persistence remains queued after the UI update.

Legacy rows remain nullable. For them:

- bucket by the selected period’s current local boundaries;
- mark the aggregate internally as `legacyCalendarApproximation`;
- never show a scary warning for an ordinary user;
- exclude a legacy boundary row from a day-level causal claim when a time-zone
  change makes attribution ambiguous;
- keep it in broad Month/Year event counts where the ambiguity is not
  materially misleading.

Do not backfill old rows with today’s time zone and then pretend the result is
historically exact.

---

## 15. File-level implementation plan

### 15.1 Create

```text
components/focus-watch/analytics/
  FocusAnalyticsPeriodControl.tsx
  FocusAnalyticsDateNavigator.tsx
  focusAnalyticsModel.ts
  focusAnalyticsContext.ts
  focusAnalyticsDates.ts
  FocusAnalyticsFallback.tsx
  index.ts

components/focus-watch/FocusAnalyticsNativeReport.tsx
```

Native code may remain in the existing extension file initially, but split it
before the file becomes unreviewable:

```text
modules/anasta-focus/ios/extensions/analytics/
  AnastaAnalyticsModels.swift
  AnastaAnalyticsCollector.swift
  AnastaAnalyticsMetadata.swift
  AnastaAnalyticsInsight.swift
  AnastaAnalyticsReport.swift
  AnastaAnalyticsCharts.swift
  AnastaAnalyticsLifePerspective.swift
  AnastaAnalyticsStyles.swift
```

The config plugin must include these Swift sources in the Device Activity
Report extension target.

### 15.2 Modify narrowly

- `components/focus-watch/FocusAnalyticsView.tsx`
  - replace proof UI with fixed RN shell;
  - default to Week;
  - no outer vertical ScrollView;
  - one native report.
- `components/focus-watch/focusWatchDb.ts`
  - add indexed timestamp and local-day read APIs;
  - add nullable write-time day/time-zone event columns and idempotent migration.
- `components/focus-watch/focusNativeBridge.ts`
  - add analytics context sync bridge and types;
  - do not alter protection payload semantics.
- `components/focus-watch/dayPlanStore.ts`
  - only extend report metadata retention and expose non-sensitive snapshot
    helpers;
  - do not make Screen Time totals part of the store.
- `modules/anasta-focus/ios/AnastaFocusModule.swift`
  - add `syncAnalyticsContext`;
  - add analytics native-view props.
- `modules/anasta-focus/ios/AnastaActivityReportView.swift`
  - keep existing report behavior;
  - add a separate analytics render path/context/filter;
  - pass one atomic analytics request or coalesce prop updates before rendering;
  - detach the previous report before constructing/attaching the next one;
  - remove no existing context.
- `modules/anasta-focus/ios/extensions/AnastaActivityReport.swift`
  - register the new scenes;
  - gradually delegate analytics code to the new files.
- `modules/anasta-focus/ios/AnastaFocusEngine.swift`
  - extend day-scope retention;
  - snapshot Always Blocked selections for reporting.
- `plugins/with-anasta-focus.js`
  - include new analytics Swift files and `Charts` framework if Xcode does not
    autolink it for the extension;
  - replace existing-target `continue` behavior with idempotent
    create-or-reconcile target membership;
  - derive extension marketing/build versions from the host;
  - keep EAS extension declarations and generated target identifiers in one
    normalized manifest.
- `docs/ios-focus-native-setup.md`
  - expand the report acceptance matrix after implementation.
- `tests/focus-v4.test.ts`
  - add date, local summary, retention, and action-resolver tests.

### 15.3 Preserve

Do not redesign or behaviorally change:

- `TodayDetailView`
- existing guided onboarding
- shared `FocusSegments`
- Focus protection resolution
- plan editor
- app selection picker
- intervention persistence
- Home/Journal/Focus streak sheets
- Web Protection

The analytics implementation may read their existing state. It must not change
their default runtime behavior.

---

## 16. React Native state contract

```ts
type FocusAnalyticsPeriod = 'day' | 'week' | 'month' | 'year';

type FocusAnalyticsSelection = {
  period: FocusAnalyticsPeriod;
  anchorDate: string; // local YYYY-MM-DD
};

type FocusAnalyticsLoadState =
  | { kind: 'preparing'; requestId: string }
  | { kind: 'slow'; requestId: string; elapsedMs: number }
  | { kind: 'mounted'; requestId: string }
  | { kind: 'permissionRequired' }
  | { kind: 'unavailable'; reason: string };
```

Persistence:

- remember the last selected period for the session only;
- every fresh app launch defaults to Week;
- do not persist a private metric or chart selection;
- selected historical anchor may remain component state only.

Navigation bounds:

- no future period;
- previous navigation remains available while Anasta metadata exists;
- if Apple returns no older data, render the honest empty state instead of
  disabling navigation based on an invented history start;
- Year navigation may be capped to metadata retention for managed/group
  context, while total Apple activity still follows what iOS provides.

---

## 17. Native collector data structures

Suggested private extension models:

```swift
enum AnastaAnalyticsPeriod: String, Codable {
  case day, week, month, year
}

struct AnastaAnalyticsBucket: Identifiable {
  let id: Date
  let start: Date
  let totalDuration: TimeInterval
  let managedDuration: TimeInterval?
  let targetMinutes: Int?
  let availability: Availability
}

struct AnastaAnalyticsComparison {
  let currentAverage: TimeInterval
  let previousAverage: TimeInterval
  let matchedUnitCount: Int
  let coverage: Double
}

struct AnastaAnalyticsSignals {
  let pickups: Int?
  let notifications: Int?
  let firstPickup: Date?
  let lastUpdatedDate: Date?
}

struct AnastaAnalyticsConfiguration {
  let period: AnastaAnalyticsPeriod
  let selectedInterval: DateInterval
  let comparisonInterval: DateInterval?
  let selectedTotal: TimeInterval
  let selectedManaged: TimeInterval?
  let selectedBuckets: [AnastaAnalyticsBucket]
  let comparison: AnastaAnalyticsComparison?
  let signals: AnastaAnalyticsSignals
  let groups: [AnastaAnalyticsGroup]
  let localSummary: AnastaLocalAnalyticsSummary?
  let insight: AnastaAnalyticsInsight
  let coverage: AnastaAnalyticsCoverage
}
```

Use `nil` for unavailable managed data. Do not use zero as a sentinel.

---

## 18. Loading and caching behavior

### 18.1 Host loading

While local context is queried/synced:

- keep title, period, and date navigator interactive;
- show a warm skeleton in the report region;
- no spinner over old data;
- navigation taps during preparation replace the pending request.

### 18.2 Report loading

The SwiftUI report scene should use a consistent warm background from its first
frame. Avoid a white flash between host and extension.

If Apple has not produced a configuration yet, the system may leave the report
blank. The host skeleton remains behind the transparent native container so
that late report preparation does not look broken.

### 18.3 Foreground refresh

When the app returns to active:

- if Analytics is visible and the current selection includes today;
- and the last host mount was more than five minutes ago;
- remount the same single report once.

Do not poll continuously. Do not remount on every clock tick.

### 18.4 No image-loading dependency

Charts, SF Symbols, token labels, and the 365 field are native/vector content.
Do not introduce PNG chart assets or decorative remote images. This avoids the
staggered image-loading problem seen in other calendar/report surfaces.

### 18.5 Slow-report and Retry timing

Start with a six-second slow threshold. Replace it only after Release/TestFlight
measurements establish a better value; it must never be shorter than four
seconds merely to make the app appear faster.

At the threshold:

- preserve the warm skeleton;
- add `Taking longer than usual`;
- expose `Retry`;
- keep period/date navigation active;
- do not display an error icon or zero.

Retry:

1. increments the host generation/request ID;
2. invalidates pending SQL/context work;
3. detaches the current report completely;
4. atomically writes the same semantic request under the new ID;
5. mounts one report;
6. never mounts an old and new report together.

Do not auto-loop retries. The only automatic remount is the controlled
foreground refresh in 18.3.

---

## 19. Accessibility contract

### 19.1 Dynamic Type

Test every screen at:

- default;
- one large accessibility size;
- maximum supported size.

At large sizes:

- metrics wrap vertically;
- signal grids become one column;
- period control may grow;
- no number clips;
- no fixed-height text card.

### 19.2 VoiceOver

Every chart needs:

- title;
- purpose summary;
- selected-period context;
- value labels that include date and unit;
- a logical chronological navigation order.

Examples:

`Tuesday, July 21. Managed activity 1 hour 34 minutes. Total iPhone activity 3
hours 12 minutes. Daily Target 4 hours, kept.`

Do not read:

- raw hex colors;
- visual bar heights;
- every decorative grid line;
- each of 365 annual beads.

Use Swift Charts accessibility/Audio Graph support where it improves the
experience. Supply a text summary even when Audio Graph is present.

### 19.3 Color and contrast

- body text meets 4.5:1;
- large text and essential chart marks meet 3:1;
- comparison direction uses icon/text plus color;
- missing and partial states use pattern/text plus color;
- validate in Increase Contrast and grayscale.

### 19.4 Touch

- minimum 44×44 points for arrows and actions;
- period segments have a 44-point effective target;
- narrow chart bars use the whole plot scrub target;
- do not require precision tapping.

### 19.5 Localization and dates

Internal persistence remains local `YYYY-MM-DD`.

Visible dates use locale-aware formatting. Week order remains explicitly
Monday-first to match Anasta planning.

Durations must not use ambiguous abbreviations in VoiceOver. Visible compact
copy may use `2h 14m`; accessibility copy must say `2 hours 14 minutes`.

---

## 19A. Technology risk register and known platform failure modes

This section is implementation-critical. It is not a speculative list to read
after coding. Every `blocker` row must be closed by code, an explicit fallback,
and the named test before the phase or release gate can pass.

### 19A.1 Pinned Anasta stack

The plan is written for the versions currently in `package.json`:

| Layer | Current version/shape |
| --- | --- |
| Expo | SDK `54.0.36`, Continuous Native Generation |
| React Native | `0.81.5`, New Architecture |
| React | `19.1.0` |
| Reanimated | `4.1.1` |
| Worklets | `0.5.1` |
| RNGH | `2.28.0` |
| Expo SQLite | `16.0.10` |
| iOS minimum in the Focus extension plugin | `16.0` |
| Native bridge | local Expo module with Swift/SwiftUI |
| Screen Time targets | host + monitor + shield configuration + shield action + report extension |
| Private activity UI | one out-of-process `DeviceActivityReport` |
| Shared non-private context | App Group, host to extension |

Do not silently upgrade Expo, React Native, Reanimated, Worklets, Xcode target
settings, or the deployment target while implementing Analytics. A version
change needs its own compatibility pass because it changes the evidence behind
this register.

### 19A.2 Hard architecture constraints

These rules have no “try it and see” exception in v1:

1. Mount exactly one `DeviceActivityReport`.
2. The report extension owns all vertical scrolling over private content.
3. The host never reads private totals, app/site rows, chart values, or a
   report-originated callback.
4. App Group traffic for Analytics is host → report and contains only
   non-private context.
5. React Native owns the header, period/date control, permission recovery, and
   navigation actions outside the report rectangle.
6. Do not present a full-screen host action from inside the report extension.
7. Do not use Expo Go, Simulator, or web preview as proof that Screen Time
   works.
8. Do not animate the report’s height, chart rows, or hundreds of annual marks
   from JavaScript.
9. Missing, late, revoked, inconsistent, or unsupported Apple data is never
   displayed as zero.
10. Debug success is not a release result. TestFlight is a separate gate.

### 19A.3 Apple Screen Time and `DeviceActivityReport`

| ID / severity | Evidence | Failure or edge case | Required prevention | Recovery and required test |
| --- | --- | --- | --- | --- |
| DA-01 — blocker | B/C: [Apple engineer and later reports](https://developer.apple.com/forums/thread/723118) | Two reports can swap, duplicate, or show stale filter data; even one report can be slow | One report in the hierarchy; comparison lives inside the same report configuration; outgoing report fully detaches before incoming mount | Instrument report mount count; rapidly switch Day/Week/Month/Year 50 times and assert the count never exceeds one |
| DA-02 — blocker | C/D: [release-only blanks](https://developer.apple.com/forums/tags/device-activity?page=3), [`Code=2` reports](https://developer.apple.com/forums/tags/family-controls/?page=4&sortBy=oldest) | Report is blank, `makeConfiguration` is not called, or Week/Month works in debug but fails in release | Warm skeleton behind a transparent fixed report container; no infinite spinner; non-sensitive lifecycle logging; compact collectors | After a visible timeout show `Taking longer than usual` and a Retry action that performs one clean remount; test repeated Debug, local Release, and TestFlight opens for all periods |
| DA-03 — high | C: forum and existing Anasta behavior | Returning from background can leave a stale or blank remote view | Keep request generation and last mount time; only current/today selection may auto-refresh; no polling | If visible after five minutes inactive, perform one remount on active; background during load and foreground it 20 times |
| DA-04 — blocker | D: [physical-device host-scroll findings](https://developer.apple.com/forums/thread/835517) | A pan that starts over the report may never reach a host `ScrollView` | No parent/nested host vertical scroll around the report; SwiftUI report owns the entire private vertical surface | On a physical phone start vertical pans at top, middle, chart, row, and blank report space; every pan must scroll the report |
| DA-05 — high | D: [bounded report sheets](https://developer.apple.com/forums/thread/835517) | A report-presented `.sheet` can remain inside the embed frame or behind host overlays | Use in-report disclosure/callouts only; keep required permission and Retry recovery in the React Native host | Test every report interaction with host chrome present; no required recovery may depend on a report-originated full-screen sheet |
| DA-06 — blocker | A plus D: [Apple sandbox](https://developer.apple.com/documentation/deviceactivity/deviceactivityreport), [App Group observations](https://developer.apple.com/forums/thread/835517) | Attempting report → host storage/callback either violates privacy design or silently fails | One-way host → report context; private calculations and life projection remain SwiftUI-only; no network, files, defaults, notification, URL, clipboard, or bridge export from report | Static search and code review for outbound channels; physical test proves host actions work without report data |
| DA-07 — blocker | A/C: [opaque-token behavior](https://developer.apple.com/documentation/familycontrols/familyactivityselection), [production token reports](https://developer.apple.com/forums/thread/819997) | Authorization revocation voids tokens; an OS update may produce unresolvable or changed tokens | Re-check authorization on foreground; tolerate nil labels; snapshot fingerprinted historical scopes; never key product truth by display name | Revoke/regrant and reselect; simulate unknown token fixtures; report aggregate may remain while the unresolved row uses Apple fallback copy |
| DA-08 — blocker | C: [reported corrupted website duration](https://developer.apple.com/forums/thread/819997) | A site/app/detail can report impossible hours and destroy comparisons or annual projections | Apply the plausibility contract in 19A.8; never cap or silently “fix” a value | Hide only the invalid detail or segment, mark coverage partial, and log a non-private issue code; test impossible-value fixtures |
| DA-09 — high | A: `lastUpdatedDate`; no Apple retention/SLA guarantee | Apple data can arrive late, have gaps, or not retain two years | Show freshness and coverage; comparisons require matched complete units; metadata retention never claims Apple retention | Late/missing data state, manual Retry, and no zero; test no-data, one-bucket, partial-today, weak-comparison fixtures |
| DA-10 — blocker | A/E: Apple hierarchy plus current collector | Category, app, and website values can be double-counted; an app can be in two Anasta groups | Segment-first union; overall Managed counts each opaque token once; stable group attribution priority; app/site/category are alternative breakdowns, never additive totals | Hand-calculate overlapping fixtures and compare against the collector |
| DA-11 — blocker | A: Apple filter semantics | Hourly filters round sub-hour components; DST creates 23/25-hour days and duplicated formatted hours | Create intervals with `Calendar`; identify buckets by absolute start date, not the visible hour string; avoid minute-perfect copy | Physical or deterministic DST fixtures; spring/fall boundaries; overnight Session; time-zone change |
| DA-12 — blocker | E plus platform resource limits | A selected + previous Year filter can contain 731 daily segments and large token trees | Summary-first Year collector; no app/site/category rows; discard per-segment token maps; 24 monthly buckets maximum | Benchmark weakest phone; if the gate fails, use selected-year-only fallback from 13.7, never JS estimates |
| DA-13 — blocker | C: [iOS 16/Xcode blank-report history](https://developer.apple.com/forums/thread/735915) | Current build tools may produce an OS-specific blank report even when newer iOS works | Maintain an iOS × Xcode × build-type compatibility ledger; test the lowest declared OS with the exact shipping toolchain | If minimum iOS is reproducibly broken, Analytics shows an honest unsupported state there or the deployment target changes in a separate product decision |
| DA-14 — high | A/C | Authorization can be denied, revoked, restricted, or present while report data is still unavailable | Model authorization separately from report availability; do not treat “authorized” as “loaded” | Test first deny, later grant, revoke in Settings, reinstall, iCloud/account change where practical, and a fresh account/device |
| DA-15 — medium | A | `.all` users or devices can accidentally broaden totals; cross-device totals would change meaning | Filter devices explicitly to `.iPhone`; keep v1 individual authorization; no cross-device claim | Assert filters in Swift tests and compare representative totals with Apple Screen Time on the same iPhone |
| DA-16 — high | C: [remote sizing/background reports](https://developer.apple.com/forums/thread/742471) | Report stretches, reveals a black/white first frame, or ignores normal background assumptions | Explicit container size; matching warm background in host and extension; skeleton behind; avoid background-dependent compositing tricks | Visual test on every supported OS and light/dark system appearance even if Anasta uses a fixed theme |
| DA-17 — medium | A/E | Apple supplies multiple `DeviceActivityData` sequences or unexpected empty segments | Sum only the requested iPhone stream; skip empty segments; never force-unwrap `firstDate`; preserve coverage | Pure fixtures with zero, one, and multiple activity-data streams |
| DA-18 — high | A | `longestActivity`, pickups, notifications, and total duration have different semantics and availability | Keep each metric nullable; do not infer sessions from hourly buckets or derive pickups from app-row count | Fixture with missing supporting fields; unavailable signals disappear without shifting primary meaning |

### 19A.4 Expo CNG, native module, extension, and signing risks

Expo documents CNG app-extension support as experimental. The generated Xcode
project is a build artifact; the durable source of truth is
`modules/anasta-focus`, `plugins/with-anasta-focus.js`, and `app.json`.

| ID / severity | Current Anasta risk | Required handling | Verification |
| --- | --- | --- | --- |
| EX-01 — blocker | Expo Go/web cannot contain the local Swift module, Apple entitlements, App Group, or report extension | Use them only for the named preview shell with `PREVIEW DATA`; use a custom iOS dev build for live work | Open web/Expo fallback and confirm it cannot be mistaken for live iPhone data |
| EX-02 — blocker | JavaScript refresh does not rebuild Swift, entitlements, targets, Info.plists, or Reanimated native code | Every native/config/dependency change requires Prebuild/rebuild; document the tested commit and binary build | Change a native build marker and prove the installed binary changes |
| EX-03 — blocker | Clean Prebuild can overwrite manual changes in generated `ios/` | Put every durable change in module/plugin source; inspect generated output; never make the production fix only in generated Xcode files | Generate from a clean temporary worktree/output and compare target files |
| EX-04 — blocker | `with-anasta-focus.js` currently `continue`s when a target already exists, so it does not reconcile new Swift source membership or target settings on incremental Prebuild | Replace “create once” logic with idempotent create-or-reconcile logic; add missing files/build phases once and update settings without duplicates | Run Prebuild twice; second run has a zero semantic diff and contains all analytics sources exactly once |
| EX-05 — blocker | Splitting analytics into new Swift files does not automatically compile them into `AnastaActivityReport` | Plugin owns the complete report-extension file list; ensure only report-safe shared files enter that target; explicitly link `Charts` if the generated target needs it | Inspect PBXSources/PBXFrameworks phases and compile from clean generated native output |
| EX-06 — blocker | App, monitor, two shields, and report are separate App IDs/profiles; main-app approval does not imply extension approval | Verify Family Controls distribution approval, App Group, bundle ID, team, and regenerated distribution profile separately for all five targets | Inspect signed archive entitlements and run TestFlight |
| EX-07 — blocker | Plugin currently hardcodes extension `MARKETING_VERSION = 1.0` and `CURRENT_PROJECT_VERSION = 1`, which can drift from the host build | Derive extension marketing/build versions from the host/app config for every configuration | Archive validation asserts host and embedded extension version/build compatibility |
| EX-08 — high | `extra.eas.build.experimental.ios.appExtensions` can drift from plugin-generated target names, bundle IDs, or entitlements | Build one normalized extension manifest and use it for both plugin generation and EAS declaration, or add a comparison test | `expo config` output and generated project must match byte-for-byte on identifiers/entitlements |
| EX-09 — blocker | SwiftUI `DeviceActivityReportExtension` uses `@main`; adding `NSExtensionPrincipalClass` can conflict with runtime expectations, while forum posts report validator ambiguity on some toolchains | Preserve Apple’s current report-extension shape; never “fix” validation by guessing plist keys; validate with the exact Xcode/App Store toolchain | Device install plus `validate-app`/TestFlight must both pass before release |
| EX-10 — high | App Group Info.plist value, entitlements value, module fallback string, and app config can diverge | Pass one app-group identifier through the plugin; fail debug builds loudly on missing/mismatched suite instead of falling back silently | Unit/config test plus signed-entitlement inspection |
| EX-11 — high | A copied Swift source can exist on disk but not in target membership, or appear twice after repeated Prebuild | Plugin verification counts each source reference and compile-source entry | Clean and incremental Prebuild tests |
| EX-12 — medium | Native dependency/version mismatch can leave Metro working while installed native code is stale | Record Expo/RN/Reanimated/Worklets versions in the build checklist; run dependency compatibility check before any upgrade | Fresh dependency install and native rebuild in a disposable/clean environment |

Do not run a destructive `expo prebuild --clean` against a dirty user worktree.
Use a clean worktree or disposable copy for idempotency/target-generation
verification.

### 19A.5 React Native, Reanimated, and gesture risks

The RN shell is intentionally small because the private report is a remote
native surface.

| ID / severity | Failure or edge case | Required handling | Verification |
| --- | --- | --- | --- |
| RN-01 — high | Expo SDK 53+ New Architecture can regress animation/scroll performance; current Reanimated is `4.1.1`, while some official FPS mitigations require `4.2.0+` | Benchmark the pinned stack first. Do not enable experimental static flags or upgrade Reanimated inside Analytics work. Open a separate compatibility task only if measured evidence requires it | Debug and Release frame traces on the weakest phone |
| RN-02 — blocker | Hundreds of RN animated bars/beads or simultaneous entry animations drop FPS | Charts and the 365 field remain native/static; period control has one thumb/opacity transition; no cascading RN animation | Count animated nodes and profile period change/scroll |
| RN-03 — high | Fast transform updates can make visual and touch geometry diverge; official Reanimated guidance notes transform/touch caveats | Use RNGH `Pressable`/gesture primitives with stable 44-point layout hitboxes; animate opacity/transform only inside the hitbox | Repeated edge taps during and after animation |
| RN-04 — blocker | Horizontal period swipe and report vertical scroll can conflict, especially because the report consumes touches in its rectangle | Period gesture exists only in the host control above the report; do not install a screen-wide horizontal recognizer or overlay above private content | Diagonal, slow, and fast pans from each surface on phone |
| RN-05 — blocker | Current `AnastaActivityReportView` calls `render()` from four separate prop `didSet`s. React can assign `date`, `days`, `startMinutes`, and `endMinutes` separately, causing partial filters and several detach/remount cycles | New analytics wrapper receives one immutable request object or coalesces prop changes to the next main-run-loop turn; normalize and compare the complete request; render once | Native counter asserts one committed report render per RN request |
| RN-06 — blocker | An older async SQL/context preparation can finish after the newest tap and mount stale content under the new header | Monotonic generation/request ID; latest committed request wins; stale promises and native completions are ignored | Delay requests artificially and tap periods out of order |
| RN-07 — high | Animating report height/layout or scaling the remote view can stutter, flash, and break hit testing | Keep report frame/flex stable; animate only a host-owned skeleton/wrapper opacity; never crossfade two reports | Slow-motion video and view-hierarchy inspection |
| RN-08 — high | Reading Reanimated shared values on the JS thread or calling `runOnJS` continuously blocks the interaction path | Commit only the final selected period/date to React state; no shared-value reads in render/effects and no per-frame JS callback | JS profiler during drag |
| RN-09 — high | Reduce Motion can leave a hidden state or skipped completion callback | State transitions never depend on animation completion; Reduced Motion uses short opacity or immediate state | OS Reduce Motion on/off for every period/navigation action |
| RN-10 — high | Debug and release performance differ substantially | Tune with debug diagnostics, accept with release/TestFlight; neither replaces the other | Record both sets of measurements |
| RN-11 — medium | Component unmount during an active gesture/request can call into a detached native view | Cancel gesture state and invalidate request generation in cleanup; native render checks parent/lifecycle | Navigate away during drag and during report preparation |

Official Reanimated guidance prefers non-layout properties such as opacity and
transform and warns about multiple simultaneous animations. It also says
Reanimated/Worklets/native versions must be compatible and rebuilt together.
Anasta already has Worklets, but the exact pinned combination still needs a
real-phone test before any version change.

### 19A.6 Swift, SwiftUI, and extension-process risks

| ID / severity | Failure or edge case | Required handling | Verification |
| --- | --- | --- | --- |
| SW-01 — blocker | `DeviceActivityResults` and nested activity sequences are async, one-pass streams; iterating again can yield nothing or duplicate work | Collect every required scalar for a segment in one pass; pass value models to views | One-pass fixture/test helper; code review rejects a second traversal |
| SW-02 — high | Period changes cancel old work, but a partial collector result can be mistaken for complete | Check `Task.isCancelled` in long Year loops; only publish a configuration after complete collection; request ID must match context | Cancel during synthetic long collection |
| SW-03 — blocker | Two fall-back DST buckets can share a visible `1 AM` label and an array index changes across periods | Stable identity is the absolute segment start `Date`; visible text is not an ID | DST fall-back fixture has two distinct buckets |
| SW-04 — blocker | Accumulating token dictionaries across 731 days can terminate the extension | Segment-first reduction and immediate release; Year retains only numeric month/day aggregates | Memory trace for repeated Year switching |
| SW-05 — high | Host-loaded Inter/EB Garamond fonts are not automatically extension resources | Use available system typography in report v1 or explicitly add/test font resources through the report target; never assume host font availability | Fresh install and archive resource inspection |
| SW-06 — blocker | Host context JSON and extension decoder can change independently after an OTA JS update | Version payload schema; required `requestId`; defaults for additive fields; reject unsupported future major version with an honest unavailable state | Decode older, current, malformed, missing, and future-version fixtures |
| SW-07 — high | SwiftUI `@State` for a selected chart point can survive a configuration/period change | Reset transient selection when `requestId` or interval changes | Select a chart point, then rapidly navigate periods |
| SW-08 — high | Creating a new hosting controller before detaching the old one briefly violates the one-report rule | Detach old controller first, complete containment lifecycle, then attach one new controller on main actor | View hierarchy assertion at each lifecycle step |
| SW-09 — medium | SF Symbol or Charts behavior/availability differs by minimum OS | Guard symbols with tested fallbacks; keep deployment target compatible with Swift Charts; avoid symbols introduced after minimum OS without fallback | Lowest-OS visual and compile test |
| SW-10 — high | Recreating `DateFormatter`, parsing POSIX days with an autoupdating calendar, or using index math can be slow/wrong around locale/time zone changes | Central calendar/date utilities; POSIX formatter for stored day strings; locale-aware visible formatters; cache immutable formatters safely | Locale, 12/24-hour, time-zone, Sunday, DST tests |
| SW-11 — high | Logs from the report extension can leak private app/site labels or durations | Log only lifecycle stage, request hash, context, OS/build, duration-to-load, coverage class, and enumerated error code; no tokens, labels, totals, or raw payload | Static log review plus Release console capture |
| SW-12 — medium | An extension may be killed and recreated without host state in memory | Context must be fully reconstructible from versioned App Group payload; views do not depend on host-process singleton state | Kill app/report process and reopen Analytics |

### 19A.7 SQLite, App Group context, and local-event risks

| ID / severity | Failure or edge case | Required handling | Verification |
| --- | --- | --- | --- |
| DB-01 — blocker | Absolute timestamps move between historical calendar days after travel/time-zone change | Add nullable write-time `local_day`, `timezone_id`, and offset fields as specified in 14.5 | Belgrade→New York and New York→Belgrade fixtures around midnight |
| DB-02 — high | Existing rows have no local-day fields | Keep nullable legacy fallback and internal approximation flag; no dishonest backfill | Migration fixture from the current schema |
| DB-03 — blocker | `meta_json` can be malformed or from an older/newer event schema | Parse each row independently; validate shape; unknown/malformed metadata increments a local quality count but never crashes the period | Corrupt JSON and unknown-field fixtures |
| DB-04 — high | An unknown future `kind` can break an exhaustive switch or inflate a known metric | Ignore unknown kinds in v1 metrics, preserve the row, and log only the unknown kind identifier if it is not sensitive | Unknown-kind fixture |
| DB-05 — blocker | Optimistic action can be retried and insert a duplicate event | Stable action event ID; retain `INSERT OR IGNORE`; write queue remains serialized | Double-tap/retry/relaunch idempotency test |
| DB-06 — high | Current-day SQL reads can race with a queued optimistic persistence write | UI action updates immediately; analytics may refresh after persistence completes or on foreground; do not hold long DB transactions while Apple loads | Trigger action while Analytics prepares and verify next controlled refresh |
| DB-07 — high | 800/1,100-day retention cleanup can delete the comparison boundary or run with wrong local cutoff | Compute cutoff with calendar days; cleanup only after successful open; test exact inclusive/exclusive boundary | Retention boundary and leap-year tests |
| DB-08 — blocker | App Group JSON can be large, partially written, stale, or mismatched to a report request | Write a complete versioned envelope atomically under a request-specific key, then update a small current-pointer key; extension accepts only matching request ID | Kill app between payload and pointer writes; stale/malformed/current fixtures |
| DB-09 — high | Repeating full plan JSON/opaque selections for 800 days creates unnecessary decode and memory cost | Fingerprint scopes, compact metadata, garbage-collect only unreferenced scopes, and measure serialized byte count in debug tooling | Worst-case 800-day payload benchmark; no private content in size log |
| DB-10 — blocker | A later plan or Always Blocked edit can rewrite historical Managed meaning | Immutable day snapshot + fingerprinted selections; snapshot strict/loose Always Blocked ownership | Before/after plan move and Always Blocked edit fixture |
| DB-11 — blocker | It is tempting to cache Apple totals in SQLite to make reports instant | Do not persist private report values; skeleton/coverage is the fallback, not a shadow analytics database | Static search for private configuration crossing the extension boundary |
| DB-12 — medium | Migration failure can leave some columns added and others absent | Each migration is idempotent; verify schema with `PRAGMA table_info`; disable only local-event signals if migration remains invalid, not the Apple report | Partial-migration fixture and reopen |

### 19A.8 Data plausibility and trust contract

The product must be robust to inconsistent input without pretending Anasta can
correct Apple’s data.

For every Apple duration:

1. Reject non-finite and negative values.
2. Calculate the requested segment’s actual wall-clock length with `Calendar`.
3. Allow a small documented tolerance for framework rounding.
4. If one app/site/category detail exceeds the segment wall time beyond that
   tolerance, omit that detail row from ranking and mark detail coverage
   partial.
5. If the segment total itself is impossible, exclude that segment from
   comparison, average, and life projection. Do not cap it to 24 hours.
6. Keep app, website, and category breakdowns separate. Their sums are not
   added together.
7. A sum smaller than total activity is valid; Apple may omit or withhold
   detail.
8. A managed union is token-deduplicated inside each segment before addition.
9. No “correction factor,” hidden smoothing, or interpolation fills missing
   Screen Time.
10. The UI says `Some iPhone activity details were unavailable` and keeps any
    unaffected trustworthy aggregate visible.

The exact tolerance is a named tested constant, not scattered magic numbers.
Start with the smallest allowance that passes hand-checked Apple data on the
supported OS matrix; document the measured reason before changing it.

Non-private diagnostics may record:

- report context and request hash;
- OS/app/build version;
- report load duration;
- segment count;
- `complete`, `partial`, `missing`, or `inconsistent` coverage;
- enumerated reason such as `negativeDuration`, `detailExceedsInterval`,
  `totalExceedsInterval`, `tokenUnresolved`, or `decodeFailed`.

Diagnostics must not record durations, app/site/category names, opaque tokens,
selected lists, or chart values.

### 19A.9 Failure-state UX contract

These are separate states and must not collapse into an empty chart:

| State | User-facing behavior | Action |
| --- | --- | --- |
| Preparing | Warm skeleton; controls remain usable | Latest selection replaces pending request |
| Slow report | Skeleton plus `Taking longer than usual` | Retry performs one clean remount |
| No activity | `No iPhone activity was reported for this period` | Navigate period; no permission prompt |
| Partial/stale | Show trustworthy values with freshness/coverage note | Optional Retry |
| Inconsistent detail | Keep valid aggregate; omit invalid ranking/detail | Plain explanation, no alarming error |
| Authorization denied | Explain why Analytics needs Screen Time | Request authorization from host |
| Authorization revoked/restricted | No stale private labels or cached totals | Open the supported recovery flow |
| Unsupported OS/build combination | Explain that live Focus Analytics is unavailable on this device version | App remains usable; no fake preview |
| Native extension unavailable | Host fallback state, not a blank rectangle | Rebuild/support diagnostic in development; safe user copy in release |
| Local-event migration/query failure | Apple report still works; action insight is unavailable | Retry after reopen; never block the whole screen |

The timeout reveals a recovery message; it does not assert that Apple has
failed. A Retry invalidates the old generation, detaches the old report, syncs
the same non-private request again, and mounts exactly one report.

### 19A.10 Required compatibility and release matrix

Record the exact device, iOS, Xcode, app build, Expo/RN/Reanimated versions, and
result. “Works on my phone” is not a matrix.

Minimum matrix:

| Dimension | Required cases |
| --- | --- |
| OS | Lowest declared iOS; newest stable iOS; one intervening major when available |
| Device | Weakest/smallest supported physical iPhone; one current larger iPhone |
| Build | Local Debug dev client; local or internal Release; TestFlight |
| Install state | Fresh install; upgrade over previous production/dev build; app reinstall |
| Authorization | First grant; deny; later grant; revoke; reselect after token recovery |
| Lifecycle | Cold open; warm open; background/foreground; process kill; low-memory observation |
| Period | Current/past Day; Week; Month; current/previous Year |
| Calendar | Monday; Sunday; leap day; 23/25-hour DST day; time-zone travel fixture |
| Data | Normal; none; partial; stale; impossible detail; unknown token; malformed host context |
| Accessibility | Dynamic Type max; VoiceOver; Reduce Motion; Increase Contrast; RTL visual check |
| Interaction | 50 rapid period/date changes; diagonal gestures; navigate away mid-load |
| Duration | Ten-minute browse; repeated Year switching; 20 cold/warm report opens per build type |

For release-only blank-report risk, record success rate rather than one pass.
The TestFlight acceptance target is:

- 20/20 report containers leave the preparing state on each required test
  device for Day and Week;
- at least 10/10 for Month and Year;
- zero swapped period/header pairs;
- zero simultaneous report mounts;
- zero extension crashes/terminations in the measured loop.

If Apple intermittency prevents that target, do not hide it. Ship only after
the recovery state is acceptable and the product owner explicitly accepts the
measured residual rate.

### 19A.11 Hard release blockers

Release is blocked if any of these remain:

- private Screen Time data leaves the report extension;
- a second report appears in the view hierarchy;
- a pan beginning over private content cannot scroll the page;
- the current multi-`didSet` prop race is used for Analytics;
- the config plugin is not idempotent or omits analytics Swift sources;
- host and extension App Group/bundle/entitlement/version settings differ;
- any Screen Time target lacks distribution approval/profile;
- minimum supported iOS is untested with the shipping Xcode;
- TestFlight was not tested;
- a blank report can remain an infinite blank/spinner;
- invalid duration can enter a comparison or life projection;
- missing/partial data renders as zero;
- legacy event rows are silently re-dated with the current time zone;
- report logs contain tokens, labels, selections, or duration values;
- VoiceOver or Reduced Motion cannot complete the screen;
- the Year collector fails its memory/time gate without the documented
  selected-year fallback.

---

## 20. Edge-case matrix

| Case | Required behavior |
| --- | --- |
| Today has only partial data | Show `so far`; exclude from comparison average |
| Monday current week | Week chart shows Monday partial and future Tue–Sun; no week delta |
| Sunday | Render as the seventh explicit day; no omission or duplicate Friday/Saturday |
| February | Use actual 28/29 calendar days |
| Leap year | Year expected-day count is 366, while annual pace formula remains 365 for consistency |
| DST spring forward | Build local boundaries with `Calendar`, never add 86,400 seconds |
| DST fall back | Preserve Apple segment totals and local labels; do not merge distinct hours by formatted label alone |
| Time-zone change | Rebuild selected calendar interval and context; do not rewrite stored local day keys silently |
| Legacy event without stored time zone | Timestamp fallback with internal approximation; no exact day-level causal claim at an ambiguous boundary |
| Authorization revoked | Tokens invalid; show recovery state, no stale labels |
| Apple data missing | Missing state, never zero |
| Apple detail duration is impossible | Omit the invalid detail, preserve only trustworthy aggregates, and mark coverage partial |
| Apple segment total is impossible | Exclude the segment from averages, comparison, and projection; never cap it |
| Report stays blank or returns service error | Warm slow state, one clean Retry remount, never an infinite blank rectangle |
| Debug works but TestFlight is blank | Release blocker; inspect entitlements, collector size, OS/toolchain, and archive |
| Report returns after a newer request | Ignore stale generation; header and report request IDs must match |
| Report props arrive separately | Atomic/coalesced request; exactly one native render for one committed selection |
| Report process is killed | Reconstruct from versioned App Group context; no host-memory dependency |
| App Group payload is partial/stale | Reject mismatched request/schema; show preparing/recovery state |
| No plan | Total activity works; managed time unavailable/empty; create-plan action |
| Plan edited later | Historical snapshot and fingerprinted tokens preserve old meaning |
| Plan deleted | Historical compact metadata keeps the old label/rules for retained days |
| Session Plan | Day resolves bucket Session; Week/Month use historical managed union |
| App in two groups | Count once overall; stable attribution priority |
| App moved to Always Blocked | Historical daily scope preserves before/after ownership |
| App token no longer resolves | Keep duration in managed aggregate when token matches; row label uses Apple fallback |
| Token set changes after OS update | Authorization/reselection recovery; never match by display name |
| Previous period has zero activity | Show absolute current value; hide percentage |
| Previous coverage is weak | Hide delta and explain insufficient matched data |
| Huge app name | Two-line or one-line truncation with full VoiceOver label |
| RTL locale | Layout mirrors; charts remain chronological with accessible ordering |
| Reduce Motion | Opacity-only period transition; no cascading chart/bead animation |
| Offline | Report still works; extension never needs network |
| Expo Go/web | Show fixture/fallback shell; never claim live Screen Time |
| Simulator | UI fixture only; Screen Time acceptance requires a physical iPhone |
| Rapid period tapping | Latest request wins; one report mounted; no stale header/content pair |
| App background during load | Cancel/ignore stale host generation; refresh once on active |
| Host font unavailable in extension | Use tested system font or explicitly embed the resource in the report target |
| Unknown event kind or malformed `meta_json` | Ignore that metric row, preserve the screen, record a non-private quality reason |

---

## 21. Test plan

### 21.1 TypeScript unit tests

Add tests for:

- Monday-first Day/Week/Month/Year ranges;
- Sunday inclusion;
- February 28/29;
- current partial-period matching;
- no future dates;
- local timestamp → event-period assignment;
- write-time local-day assignment across time-zone changes;
- nullable legacy event calendar fallback;
- idempotent event-schema migration;
- event aggregation by kind;
- malformed `meta_json` and unknown event kind isolation;
- duplicate event insertion/idempotency;
- `returnedMoments` period count;
- target denominator exclusions;
- action resolver priority;
- zero previous value;
- missing comparison;
- 800-day retention cutoff;
- versioned App Group context encode/decode and request matching;
- latest-request-wins reducer behavior.

Do not test Apple totals through fabricated `recordUsageSnapshot`.

### 21.2 Swift pure-function tests

Extract and test:

- bucket-to-selected/comparison assignment;
- managed token de-duplication;
- group attribution priority;
- app/category/site non-additive hierarchy;
- pickups calculation;
- complete-day average;
- comparison coverage;
- annual full-day formulas;
- peak two-hour window;
- deterministic insight priority;
- non-finite, negative, and impossible-duration plausibility rejection;
- partial coverage after one invalid segment/detail;
- cancellation never publishing a partial configuration;
- one-pass collector fixtures;
- old/current/malformed/future context schema decoding;
- DST calendar boundaries;
- Year monthly aggregation.

If the repository lacks an extension unit-test target, create pure fixtures and
an Xcode test target rather than hiding all logic inside SwiftUI `body`.

### 21.3 Static verification

Run:

```powershell
npm.cmd run typegen:routes
npm.cmd run test:focus
npm.cmd run lint
npx.cmd expo config --type public
```

Lint may contain unrelated existing failures. Record the baseline and ensure no
new analytics failure is introduced.

Add a focused config-plugin verification script that:

1. generates native output in a clean disposable location;
2. runs the plugin twice;
3. compares the second generated project with the first;
4. asserts every analytics Swift file is in the report compile-sources phase
   exactly once;
5. asserts target names, bundle IDs, App Group, deployment target,
   marketing/build versions, and entitlements match the normalized manifest;
6. asserts the report extension does not gain an invented
   `NSExtensionPrincipalClass`.

### 21.4 Expo/web loop

Use only for:

- RN shell layout;
- period/date control;
- action resolver;
- Dynamic Type approximation;
- fallback states;
- latest-request sequencing.

The web fallback uses named fixture data and a visible `PREVIEW DATA` badge.
It must never appear as a live iPhone report.

### 21.5 Physical iPhone development build

Required because Expo Go cannot compile:

- local Swift module;
- Device Activity Report extension;
- Family Controls entitlement;
- App Group;
- extension report scenes.

Test at minimum:

1. grant, deny, and revoke authorization;
2. Day current and past;
3. Week on Monday, midweek, and Sunday;
4. Month with 28, 29, 30, and 31 days;
5. Year current and previous;
6. plan edit between two days;
7. group/app move between plans;
8. Always Blocked edit;
9. Session Plan with overnight Session;
10. time-zone change;
11. DST boundary if reproducible with test date/device settings;
12. no-activity period;
13. stale/late Apple update;
14. rapid period switching;
15. ten minutes of continuous report browsing;
16. smallest supported iPhone;
17. largest supported iPhone;
18. default and maximum Dynamic Type;
19. VoiceOver;
20. Reduce Motion;
21. Increase Contrast;
22. background/foreground refresh;
23. vertical pan beginning over every region of the report;
24. slow/blank report timeout and Retry;
25. process kill while preparing and after content appears;
26. fresh install and upgrade install;
27. malformed/stale App Group context;
28. unknown/unresolvable token;
29. impossible-duration private fixtures;
30. 50 rapid period/date changes with one-report instrumentation.

### 21.6 Performance measurements

Record:

- time from period commit to usable report;
- report extension termination/crash;
- main-thread stalls;
- scroll frame pacing;
- memory after ten period switches;
- temperature/battery over ten minutes;
- touch response of period/date controls.
- native report render count per committed RN request;
- successful/slow/blank report-open rate by period and build type;
- App Group context serialized byte count for worst-case retained metadata;
- extension memory high-water mark during repeated Year switching.

Target:

- RN touch feedback starts in the same frame;
- no second `DeviceActivityReport` in the view hierarchy;
- no JS-driven chart animation;
- no continuously looping analytics animation;
- exactly one native render for one committed RN analytics request;
- cached Day/Week usable within 1 second where Apple supplies data promptly;
- Month/Year median within 1.5 seconds on the weakest supported device.

### 21.7 TestFlight and distribution gate

Before TestFlight:

- host App ID has Family Controls distribution approval;
- Device Activity Monitor extension App ID has approval;
- Shield Configuration extension App ID has approval;
- Shield Action extension App ID has approval;
- Device Activity Report extension App ID has approval;
- all targets use the same App Group;
- regenerated distribution profiles contain required entitlements;
- report extension embeds and signs correctly;
- host/extension marketing and build versions are compatible;
- clean and repeated Prebuild outputs are idempotent;
- every analytics source belongs to the report target exactly once;
- no enhanced App and Website Usage entitlement is required by this v1 design.

TestFlight uses distribution provisioning. A development-only entitlement is
not sufficient.

Run the repeated-open acceptance target from 19A.10 and record the actual rate.
A single successful TestFlight open is not a pass.

---

## 22. Implementation phases

### Phase 0 — checkpoint and contract tests

1. Inspect `git status`.
2. Preserve every unrelated user modification.
3. Create a scoped branch/checkpoint only when the user asks or the working tree
   can be safely staged without mixing unrelated changes.
4. Add date/event/action pure tests first.
5. Add Swift formula fixtures.
6. Add the plausibility/context-schema fixtures from 19A.
7. Add clean/repeated config-plugin generation verification.

Exit:

- no production UI change;
- product formulas encoded in tests.

### Phase 1 — local summary read path

1. Add idempotent local-day/time-zone event migration.
2. Add timestamp and local-day event read APIs.
3. Update new event writes to capture write-time calendar context.
4. Add pure event/day aggregation and legacy-boundary handling.
5. Add action resolver.
6. Add versioned, request-matched analytics context payload builder.
7. Verify no usage snapshot dependency.

Exit:

- Day/Week/Month/Year local summaries are deterministic.

### Phase 2 — analytics-only native bridge

1. Add `syncAnalyticsContext`.
2. Add one atomic analytics request prop or a coalesced complete-prop commit.
3. Add analytics contexts.
4. Add request/schema matching.
5. Detach the old report before attaching one replacement.
6. Add period filters.
7. Keep old Daily/Trend report contexts working.

Exit:

- one private report can mount for each period in a dev build.

### Phase 3 — private collector

1. Refactor per-segment aggregation.
2. Add managed token/group reconstruction.
3. Add pickups, first pickup, notifications, and last update.
4. Add comparison coverage.
5. Add Year summary collector.
6. Add historical Always Blocked scope.
7. Add plausibility/coverage classification.
8. Add cancellation and one-pass guarantees.
9. Add privacy-safe lifecycle diagnostics.

Exit:

- values validated against Apple Screen Time and hand calculations on test
  periods;
- no private value leaves the extension.

### Phase 4 — final SwiftUI report

Implement in order:

1. hero;
2. period chart;
3. signals;
4. group/app detail;
5. insight;
6. protection summary;
7. life perspective;
8. privacy/freshness;
9. preparing, slow, retry, partial, inconsistent, and unavailable states;
10. all remaining empty/error states;
11. accessibility.

Exit:

- all four period contracts match section 7.

### Phase 5 — React Native shell

1. Replace current analytics proof UI.
2. Add analytics-local RNGH/Reanimated period control.
3. Add date navigator.
4. Add latest-request-wins loading.
5. Add permission recovery.
6. Add Expo/web preview fallback.
7. Add no-infinite-blank timeout and one-report Retry.

Exit:

- no nested vertical scroll;
- one report mounted;
- actions navigate correctly.

### Phase 6 — phone refinement

1. Measure period transition and report load.
2. Tune fixed header/action sizes.
3. Tune native scroll insets.
4. Verify chart scrub targets.
5. Verify Year performance.
6. Complete accessibility matrix.
7. Verify remote-report pan ownership and diagonal gestures.
8. Measure one-native-render-per-request and repeated-open success rate.
9. Run minimum-iOS/current-Xcode compatibility case.

Exit:

- physical-device performance gates pass.

### Phase 7 — distribution

1. Update native runbook.
2. Verify config plugin idempotency and source membership from clean output.
3. Verify host/extension version, bundle, App Group, Info.plist, and entitlement
   parity in the signed archive.
4. Build a fresh iOS development client for native changes.
5. Complete development-build acceptance.
6. Verify distribution approvals/profiles for every target.
7. Build TestFlight.
8. Run the repeated-open success-rate matrix.
9. Re-run authorization/background/closed-app/report-retry cases.

---

## 23. Definition of done

The feature is complete only when all are true:

- Analytics defaults to Week.
- Day, Week, Month, and Year use calendar-aligned ranges.
- Monday-through-Sunday order is correct and Sunday always appears.
- Managed activity is primary in Day/Week/Month.
- Total iPhone activity is visible as context.
- Year translates observed and projected activity into full 24-hour days.
- Projection is visibly labeled and never presented as exact time saved.
- Comparisons use matched complete units and honest coverage thresholds.
- Pickups are shown with a neutral explanation.
- Day can reveal a qualified peak managed-use window.
- Local target/intervention data is period-scoped from SQLite.
- `attempt` is not displayed.
- `recordUsageSnapshot` is not an analytics source.
- All app/site/category labels and exact activity remain inside the report
  extension.
- Only one `DeviceActivityReport` is mounted.
- No nested vertical scroll exists.
- The RN period control uses RNGH and Reanimated.
- Native charts are accessible and usable without precision taps.
- Reduce Motion, VoiceOver, Dynamic Type, and contrast tests pass.
- Missing or stale data never appears as zero.
- Impossible private detail/segment values follow the plausibility contract
  and cannot enter comparison or life projection.
- Authorization denial/revocation has a clear recovery path.
- A slow/blank report cannot remain an infinite empty rectangle and Retry never
  mounts a second report.
- One committed RN analytics request produces one native report render.
- App Group Analytics context is versioned, request-matched, atomic, and
  host-to-report only.
- Historical local events preserve write-time day/time-zone context; legacy
  ambiguity is not presented as exact.
- Config-plugin generation is idempotent and every analytics Swift source is
  compiled into the report target exactly once.
- Host and every extension have matching identifiers, App Group, compatible
  versions, required entitlements, and valid signed profiles.
- No private token, label, selection, or duration is written to diagnostics.
- Current Today Detail and other Focus flows remain unchanged.
- A custom iOS development build passes the physical-device matrix.
- The lowest supported iOS passes with the shipping Xcode or receives an
  explicit supported-product decision/fallback.
- Repeated TestFlight open-rate acceptance is recorded and passes the gate in
  19A.10.
- Every required app/extension distribution entitlement is ready before
  TestFlight.

---

## 24. Explicit non-goals for v1

Do not add:

- peer leaderboard;
- global percentile;
- social sharing;
- AI-generated coaching;
- server upload of Screen Time;
- raw app/domain history in SQLite;
- a universal Focus Score;
- exact “time saved”;
- lifespan/death projection;
- arbitrary 5-minute or 15-minute usage slices;
- live cross-device aggregation;
- Android parity inside this iOS implementation;
- Web Protection blocked-domain analytics;
- a second report mounted for comparison;
- a redesign of Today Detail;
- analytics-specific behavior in onboarding.

These can be evaluated only after the privacy-safe core proves useful.

---

## 25. Handoff instructions for the future coding agent

Before editing:

1. Read this document fully.
2. Read `AGENTS.md`.
3. Read the privacy and analytics sections in
   `docs/anasta-focus-plan-v4.md`.
4. Inspect current `git status`; do not stage or overwrite unrelated changes.
5. Trace the current native report from RN prop to extension scene.
6. Confirm the lowest iOS target still supports Swift Charts.
7. Read and classify every unresolved 19A blocker before implementing its
   phase.
8. Confirm the pinned Expo/RN/Reanimated/Worklets versions; do not combine a
   framework upgrade with Analytics.

During implementation:

- work phase by phase;
- keep old report contexts until their callers are verified;
- add pure tests before SwiftUI polish;
- never work around the sandbox by exporting activity;
- never mount two reports for a crossfade;
- use local preview fixtures only outside a real dev build;
- test each native milestone on a physical iPhone;
- test native milestones in Release/TestFlight as soon as the collector and
  target configuration exist, not only after visual polish;
- document any Apple-runtime behavior that differs from this plan.

If Apple runtime behavior blocks a specified metric:

1. keep the privacy boundary;
2. mark the metric unavailable;
3. use honest copy;
4. do not estimate it in JavaScript;
5. update this document and the native runbook with evidence from the tested
   iOS/build/device combination.

That fallback is a correct implementation. Fabricating precision is not.
