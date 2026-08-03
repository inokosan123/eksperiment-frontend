# Anasta Focus - Working Plan (v4)

Status: active decision record

This document records only decisions that are agreed. It is deliberately not an
implementation checklist yet. New decisions are added here only after they are
settled in the Focus product discussion.

The purpose of this level of detail is implementation clarity. Every section
states both the decision and the reason behind it, so later UI, data, native
enforcement, and copy decisions can all be checked against the same intent.

## Product Boundary

- Focus is a Christian digital-discipline product: it helps people protect
  attention, use their phone intentionally, and keep unwanted content out of
  their day.
- It is not the Pomodoro feature. Pomodoro remains a separate Inner Life tool.
- Focus has two separate products:
  - Phone Plans: daily planning and app-use protection.
  - Clean Sight: website and unwanted-content protection.
- Phone Plans protect time and attention. Clean Sight protects a person from
  unwanted web content. Their permissions and native mechanisms may overlap,
  but their user-facing purpose and setup remain separate.
- The old Watch system is removed from the Phone Plans product. There are no
  overlapping watches to create, inspect, or resolve.
- A future "Session Plan" may refer to fixed time segments inside one day. It
  is not a separately started focus session and is not part of the v1 release.

## V1 Shipping Scope: Daily Planning Only

- Focus v1 has one planning model: one Daily Plan, one Daily Target, one
  Tolerance endpoint, one Essentials configuration, and one set of app/group
  rules that applies to the full local day.
- Session Planning is not selectable, schedulable, displayed, enforced, or
  included in native payloads in v1. The plan editor keeps Daily selected and
  shows Session Plan only as a disabled later-release option.
- The Session types, connected-clock geometry, and native schema remain in the
  codebase as dormant infrastructure. `FOCUS_SESSION_PLANNING_ENABLED` is the
  single runtime gate. While it is false, an old row that says `kind: session`
  is treated as Daily everywhere.
- Dormant Session zones may remain stored so future work does not require a new
  persistence model. They must never affect v1 rule resolution, protection
  status, analytics, editor validation, selection requirements, or iOS native
  enforcement.
- Editing an old draft during v1 saves the visible Daily rule set. Its dormant
  zones are preserved as inert data until a later release explicitly defines a
  restoration/migration flow.
- The detailed Session sections later in this document are a future product
  specification, not current acceptance criteria. No active v1 screen should
  expose their controls or terminology.

### Why this boundary matters

The Focus tab must not become a pile of independent blocker tools. A Christian
user should be able to answer one simple question: "How do I want to use my
phone today?" Phone Plans answer that question. Clean Sight answers a different
one: "What content do I not want to have available to me at all?"

Pomodoro already serves deliberate focused work inside Inner Life. It must not
be represented as a protection plan, a session, or a phone-use limit.

## Focus Experience Standard

Focus is Anasta's high-tech product surface. Home, Library, and Inner Life
remain calm, familiar tools; Focus makes the invisible state of protection,
time, and content boundaries feel immediate and alive. This difference comes
from precision, stateful feedback, and motion quality, not from visual noise or
a separate design language.

- Focus keeps Anasta's typography, tone, spacing discipline, and Christian
  calm. It is more dynamic than the other tabs, but still elegant and clearly
  part of the same application.
- The landing screen is redesigned for the Phone Plan model. It must show
  current protection, the day's Daily Plan state, and Clean Sight. It must not
  carry Session controls, legacy Watch cards, overlapping Watch
  language, or an Upcoming/Past layout built for the old system.
- High-tech character comes from meaningful native status, precise progress,
  polished state transitions, and a strong visual response to protection being
  active. It does not come from decorative gradients, blinking, dense settings
  cards, or motion added only to make a screen feel busy.
- Focus sections should be clear, full-width dashboard bands or genuinely
  functional framed tools. They must not become a stack of cards inside cards.

### Motion and Performance Contract

Every Focus animation must make a state easier to understand or make an
interaction feel more direct. Battery heat, dropped frames, or a warm phone
after the user simply leaves Focus open are product failures, not acceptable
tradeoffs for atmosphere.

- The phone Lottie asset may remain visibly animated while Focus is on screen.
  A continuously alive status animation is part of the high-tech character of
  this product, provided the asset itself is light enough for a weaker iPhone.
- At most one primary Lottie animation is mounted and playing on the Focus
  landing screen. It pauses immediately when the route loses focus, the app
  backgrounds, the relevant state disappears, or Reduce Motion is enabled.
- The landing screen uses the phone, not a second shield Lottie, as its one
  primary animated object. Protection state is expressed through the phone's
  surrounding light and the live status content: no protection is quiet and
  neutral; active protection receives a light, restrained state aura; a hard
  boundary can receive a stronger warning treatment. The exact palette is a
  visual-design decision, but red must remain meaningful rather than becoming
  the permanent color of ordinary successful protection.
- User-controlled movement, including drag handles on the Session clock,
  sheets, segmented controls, toggles, and other touch feedback, uses
  React Native Gesture Handler and Reanimated on the UI thread. Lottie never
  carries the primary interaction feedback path.
- The motion surrounding the primary Lottie must be more beautiful than the
  current implementation while remaining cheaper to render: use only light
  Reanimated transform and opacity work, no permanent blur, masks, large
  shadows, or stacked independent loops over the animation. The Lottie asset
  itself must be reduced to visual detail that survives on a phone, with no
  hidden layers or oversized raster assets.
- The final composite is checked on a physical iPhone for sustained idle
  temperature, battery impact, scrolling smoothness, and state-change
  responsiveness. If the combined composition is costly, supporting motion is
  simplified before removing the primary shield or phone animation.
- Motion honors Reduce Motion. In that mode, Focus keeps clear static state
  changes and short opacity transitions instead of looping or large movement.

The target feeling is deliberate and capable: Focus should look more advanced
than a task list because it protects real attention, but it should never ask the
phone to work harder simply to look advanced.

## Focus Landing Architecture

The Focus landing screen is not a plan editor and not a collection of unrelated
blocker cards. It is the live, useful overview of a person's protection today.
Within the first screen, a person must understand what is active, whether the
day is going well, and where to adjust the two Focus products.

The fixed top-to-bottom information order is:

1. **Protection:** the live state of the phone now.
2. **Today's Progress:** the outcome of today's protection and the entry to
   history and analytics.
3. **Screen Time:** today's Phone Plan, its Sessions when applicable, and the
   path to planning.
4. **Web Protection:** Clean Sight status and the path to packs and domains.

`Screen Time` is the direct user-facing name on the landing screen. It is more
immediately understandable than the internal planning concept "Phone Plan": a
person can see that this is where app use, Sessions, and daily time are
controlled. `Today's plan` is the contextual title inside that Screen Time
surface. `Web Protection` is the direct user-facing category for the Clean
Sight product; `Clean Sight` remains the distinct Anasta product name inside
it.

### Protection

Protection is the compact, functional live surface at the top of Focus. It
uses the one animated phone and must not become a large decorative "Now" card.

- The status has a clear state headline, such as `Protection is active!` or
  `No protection is active.` It describes attention and time, never presents
  Anasta as an antivirus.
- When protection is active, the surface names only the layers that explain
  the current state. For example: the current Session and end time, Clean
  Sight, or Quiet Hour. Each shown row is tappable and leads directly to the
  relevant Screen Time or Web Protection detail.
- Quiet Hour is the main immediate action when it is inactive. When it is
  active, its remaining duration becomes the first live row rather than
  leaving a misleading "Start" button on screen.
- The surface must distinguish a saved plan from effective protection. Missing
  or revoked Screen Time permission is a calm, visible recovery state, never
  an "active" badge.

### Today's Progress

Today's Progress sits immediately below Protection because it measures the
result of today's protection as a whole; it does not belong only to Screen Time
or only to Web Protection.

- The existing trophy interaction remains: tapping the trophies opens the
  monthly calendar that shows kept, rest, and broken days.
- A distinct, well-designed `Analytics` button opens the dedicated Focus
  Analytics screen. It is separate from the trophy calendar, just as Home has
  a direct analytics entry instead of making a small calendar carry every
  historical question.
- The compact landing summary can show Daily Target status, today's trophy
  eligibility, and a small weekly consistency view. It must not try to render
  the full analytics product on the landing screen.

### Screen Time and Web Protection Surfaces

The Screen Time surface summarizes today's selected plan rather than exposing
its whole editor. A Session Plan may show a compact 24-hour Session strip with
the current Session highlighted; a Daily Plan deliberately does not invent a
fake Session timeline. Both plan types show the Daily Target and its planning
state, then lead into the Screen Time planning area for editing, templates, and
the weekly planner.

The Web Protection surface summarizes Clean Sight: whether it is active and
the relevant count of active packs or custom domains. It does not display
Session timing, Daily Target, Strict/Loose tags, or a second planning model.
It opens the focused Clean Sight detail surface for packs and domains.

## Phone Plans

- A plan belongs to one day and governs that full 24-hour day.
- There can be only one active Phone Plan for a given day.
- A user chooses one of two planning experiences when creating a plan:
  - Daily Plan: one consistent set of rules for the whole day.
  - Session Plan: the same 24-hour day is split into distinct sessions, each
    with its own app-use rules.
- A Session Plan has no overlaps and no uncovered time. Its sessions always
  cover the complete day.

### Essentials-only plan mode

Essentials-only is a simplified access mode, not a third planning style and not
a zero-minute Daily Target. When it is enabled, the plan hides Planning Style,
Sessions, group budgets, and individual app rules. The person configures only:

1. a finite Daily Target;
2. a Tolerance buffer; and
3. the apps that remain reachable during this specific plan.

The native allowlist is active from the first minute of the local day. It is the
union of global Essentials and plan-only app exceptions; Always Blocked still
wins, and Clean Sight still governs configured web content. Plan-only exceptions
do not become global Essentials and do not leak into another plan.

All allowed-app use continues to count toward the Daily Target. Crossing the
Target loses trophy eligibility under the ordinary outcome rule. Tolerance
records the permitted overflow, but does not change app availability because
the plan is already Essentials-only. Its endpoint therefore does not schedule a
second Essential-only wall.

### Why one active plan matters

The old Watch model asked the system to reconcile multiple independently active
rules. That creates ambiguity for the user and difficult edge cases in native
enforcement. One day has one source of truth. The plan may be simple or may be
structured, but it is always possible to explain why an app is currently
available or protected by reading one plan.

Daily Plan and Session Plan are two ways of shaping the same kind of day, not
two competing protection products. A Daily Plan gives the user a low-friction
starting point. A Session Plan is for a user whose work, family, study, and
evening time need different boundaries.

## Clean Sight

Clean Sight remains deliberately simple and separate from Phone Plans. It is
persistent website and unwanted-content protection, not a Session schedule and
not a Phone Time budget.

The first native release uses Apple's web-content controls. It covers Safari
and third-party browsers that participate in Apple's Screen Time web controls;
the product must say `supported browsers` and must not claim universal DNS- or
VPN-level coverage. A later Network Extension can add device-wide DNS/VPN
filtering as a stronger layer, but that requires its own Apple entitlement and
is not implied by Family Controls authorization.

Apple permits at most 50 explicitly supplied web domains in one web-content
filter policy. Clean Sight resolves that capacity deterministically: individual
custom domains first, active custom packs second, and built-in starter packs
last. Duplicate domains are removed. The detail screen always shows the applied
capacity and any omitted count; it never silently claims that an omitted domain
is protected. Apple's automatic adult-content filter remains a separate native
signal, while the bundled domain catalog is a useful starter catalog rather
than a claim of exhaustive or permanently current coverage.

- A person turns a Protection Pack on or off.
- Focus supplies preloaded packs for common unwanted-content needs.
- A person can create a named custom pack, add domains one by one, or add a
  custom domain to an existing relevant pack.
- Domains inside a custom pack can be removed individually. Removing a domain
  from an active pack is a weakening change and therefore respects the Hard
  Lock delay. A custom pack cannot be left empty: add a replacement first,
  or remove the whole pack through its confirmed removal flow.
- The Clean Sight detail screen is for choosing packs and editing domains; it
  does not contain Phone Plan sessions, Daily Targets, or a second scheduling
  system.
- Clean Sight remains effective even when a browser is an Essential App. An
  Essential browser can open ordinary allowed websites, but not domains or
  content covered by active Clean Sight protection.

### Hard Lock for persistent web protection

The first release has one focused anti-bypass tool for Clean Sight. Hard Lock
protects the act of weakening website blocking; it is not another filter, an
app-install lock, or another Phone Plan. When it is off, web-rule changes apply
normally. When it is on, stronger changes apply immediately, while a request
that removes or weakens protection waits through the selected delay.

The available delays are `45 minutes`, `1 hour`, `6 hours`, `12 hours`, `24
hours`, and `3 days`. Forty-five minutes is the hard minimum. The delay covers
turning off or lowering a built-in/custom pack, removing a protected domain,
leaving Never Allowed, removing an active custom pack, and turning Hard Lock off
itself.

Shortening the selected delay is itself a weakening change and must wait through
the currently active longer delay; otherwise the setting becomes a direct
bypass. Lengthening the delay is strengthening and applies immediately.

An enabled Hard Lock may be permanently locked through a separate irreversible
confirmation. After that confirmation, the off switch is removed and neither
UI nor store actions can disable it. The delay can still be lengthened, while a
shorter delay must wait through the current one. `Permanent` means no recovery
inside Anasta; this MVP does not claim to prevent deleting the app or erasing the
device.

- There is only one pending request for each logical target. Repeating or
  replacing the same request updates that request instead of stacking delayed
  surprises.
- The pending surface states the requested change and exact eligible time. The
  person can cancel it at any time; canceling keeps the stronger rule.
- iOS does not provide a reliable arbitrary background timer for every delay.
  A due request applies while Anasta is active or on the next app open. Until
  then, the stronger protection remains;
  the UI must say `eligible at`, not falsely promise an exact closed-app change.
- App installation and app-removal restrictions are deliberately outside this
  first-release Hard Lock and can be designed as a separate future feature.

The Focus landing surface only needs to show whether Clean Sight protection is
on and provide one clear path to its packs. This preserves the product's major
content-protection value without turning the Focus screen into a control panel
for many overlapping browser rules.

## Weekly Plan Planner

Phone Plans use the same weekly planning model that already exists for tasks in
My Routine. A person creates reusable plan templates, then gives every day of
the week one clear phone-use plan.

- The planner shows Monday through Sunday in one weekly sequence.
- Each weekday is assigned one Phone Plan template, such as Workday, Light Day,
  Weekend, or Sabbath.
- The weekly assignment is the source for future occurrences of that weekday.
- At the start of a local calendar day, the plan assigned to that weekday
  becomes the active Phone Plan for the day.
- The current weekday cell is an explicit combined control. Its sheet says
  `Today and future [weekday]s`; confirming it changes both today's active plan
  and the reusable assignment for future occurrences of that weekday.
- The separate `Change` action on the Today card changes today only. Editing any
  other weekday changes future occurrences only.
- One day still resolves to exactly one active plan. Weekly planning does not
  reintroduce overlapping plans or independently running watches.

### Why this follows My Routine

Users already understand that Home carries today while My Routine carries the
week. Phone protection should fit that same rhythm instead of asking people to
learn a separate scheduling language inside Focus. The weekly planner turns
phone boundaries into part of a person's real routine: a workday can protect
work, a weekend can be more flexible, and a Sabbath can follow a distinct plan.

The Focus schedule owns phone-plan assignments. My Routine does not edit or
duplicate Focus state. It provides a light, read-only bridge in its final
section: it shows the selected weekday's Phone Plan and opens Focus when the
person wants to view or change it.

### History and future schedule

The weekly assignment defines future days, except when the person deliberately
uses the clearly labelled combined control for the current weekday. That action
may replace today's active plan, but it never rewrites elapsed usage, restored
eligibility, trophies, or any earlier day. A tighter replacement target that is
already below today's actual use loses eligibility immediately under Plan
Integrity. Changing a non-current Tuesday is still planning for future Tuesdays,
not an edit to historical phone use.

## Daily Target

Every Phone Plan starts with a Daily Target: the user's intended total phone
use for that day, such as under four hours.

Daily Targets, finite group allowances, and finite individual app allowances
all use 15-minute precision. The person can choose values such as `5h 45m` or
`45m`; the interface must not collapse the plan into whole-hour presets.
`No limit` remains an explicit value inside the Limit mode rather than a third
rule mode.

The target has three states:

1. Target: the intended daily amount. Reaching it is a successful day.
2. Tolerable zone: a visible buffer after the target, where the user is over
   the target but has not reached the strongest device protection yet.
3. Essential-only threshold: once this ceiling is reached, the user's
   Essential Apps remain available alongside system access that iOS leaves
   outside ordinary Family Controls shielding by design.

Crossing the Daily Target does not immediately lock the phone. The target is
the success line. The tolerable zone makes the product realistic: some days
include navigation, work messages, travel, family needs, or other legitimate
phone use. The Essential-only threshold is the final protective boundary for a
day that has moved far beyond its intended use.

### Essential System

Essential Apps are a global Focus allowlist that applies across every Phone
Plan. They remain available when the Essential-only threshold is reached and
they bypass ordinary Phone Plan app and Session restrictions. Their usage still
counts toward the Daily Target: Essential means available, not invisible.
Apple also leaves a set of system tools outside category-based shielding by
design. The exact set is controlled by iOS and can include Phone, Messages,
FaceTime, Maps, Clock, Settings, Safari, Find My, and Health. Focus therefore
describes the effective hard-wall result as `Essentials + iOS system access`
where availability is being explained; it never promises that every unselected
system app can be closed by a Family Controls allowlist.

The system has three layers. The product language and the Apple implementation
must stay honest about the difference between a system app and an opaque Screen
Time selection token.

1. **System-critical access:** Phone, Messages, FaceTime, and Maps form the
   conceptual Core. Apple intentionally leaves some critical system apps
   outside ordinary Screen Time shields, but Anasta does not receive public
   identifiers that let it enumerate or silently preselect every installed app.
   The UI may explain this safety behavior; it must not claim that an app token
   was selected when iOS did not provide one.
2. **User-designated Core:** banking and payment apps, authenticators, password
   managers, and optionally Camera or Wallet are added deliberately through
   Apple's Family Activity picker. This picker is add-only for Core: a token
   that has become designated Core cannot be removed with an ordinary Essential
   toggle. A future dedicated, strongly confirmed Core-removal flow can be
   designed separately if product policy requires it.
3. **Optional Essentials:** the setup recommends Mail or Gmail, Calendar,
   Reminders, Clock, navigation, Health, Find My, Settings, Safari, and Chrome,
   but the user confirms the actual apps through Apple's private picker. iOS
   Family Controls tokens are opaque, so these recommendations cannot be
   automatically matched or preselected by bundle identifier in the universal
   implementation. Any installed app the person selects can become Optional
   Essential, including WhatsApp, Viber, Instagram, Photos, App Store, or a
   work-specific app. No app is categorically forbidden from this optional
   allowlist unless it is currently Always Blocked.

The fast onboarding path therefore asks the person to confirm recommended
Essentials once; it never presents a visual starter list as already enforced
until the native picker summary confirms selected applications.

Optional Essential Apps can be added or removed at any time, including while a
plan is active. The native protection state updates immediately from that
moment forward. This is an access/safety choice, not a behavioral score, so it
does not rewrite usage, change streak eligibility, or require a cooldown.

The Essential picker is the permanent default configuration reached from the
top-level Screen Time / Daily Target protection settings. A change there is
saved: an Optional Essential that is removed stays removed, and one that is
added stays part of the default Essential set until the person changes it
again. Quiet Hour never writes back into this permanent configuration.

Essential is not an App Group. An Essential App keeps its existing group
membership for organization and analytics, but the Essential allowlist takes
priority over ordinary Phone Plan limits. Clean Sight remains above this
allowlist: making Safari or Chrome Essential never makes blocked websites or
unwanted content available.

The preloaded browser and Settings decision intentionally favors a functioning
phone over a pure dumb-phone mode. A browser can still reach non-blocked sites
after the daily Essential-only threshold, and Settings remains available; the
product must communicate that tradeoff plainly. Safari, Chrome, and Settings
remain Optional rather than user-designated Core, so removing them means they
are no longer explicitly allowed by Anasta. Chrome can then be shielded through
ordinary app controls, while iOS may still leave Safari, Settings, or another
system tool reachable by design. Clean Sight continues to filter configured
web content in supported browsers even when a browser itself remains available.

The exact target, tolerable-zone, and Essential-only values are configured for
the plan. The product may suggest sensible defaults, but does not assume that
every person's work and life require the same amount of phone time.

### Daily Target outcome rules

- A day earns the Daily Target trophy only when total use remains at or below
  the target. Time in the tolerable zone does not earn the trophy.
- Entering the tolerable zone is informative, not a failure state. It should
  make the remaining room visible without shaming the user.
- Reaching the Essential-only threshold changes availability: every shieldable
  app that is not in Essential Apps is protected for the rest of the active
  day. iOS-controlled system access can remain available by design.
- The target and thresholds use the phone's local day. A new day starts from
  the phone's local calendar, not from an arbitrary server time.

### Time Perspective Visualization

Daily Target must be a visual planning moment, not only a number input. While
the user changes the target hours, Focus shows a live 365-day view of one year.
The purpose is healthy perspective: a daily choice becomes visible as time over
an entire year.

- The visual is a calendar-like field of 365 dots, arranged as 52 weeks of
  seven days plus one additional day.
- The field divides the year into Sleep, the selected Phone Time target, and
  awake time away from the phone.
- Phone Time updates immediately when the user changes the Daily Target. The
  relevant dots animate into or out of the Phone Time portion instead of making
  the user infer the change from a number alone.
- The primary supporting number is the yearly result, for example: "61 days a
  year on your phone" for a four-hour daily target.

The main point is intentionally visible in the target editor; it is not hidden
inside a secondary sheet. The 365 dots give life to the screen and make the
choice tangible without using shaming or alarmist copy. The visual should be
beautiful enough to invite reflection, while its math remains literal:

`phone days per year = daily target hours * 365 / 24`

For example, four hours per day equals about 61 full days in a year; five hours
equals about 76 days; six hours equals about 91 days.

### Planning Capacity and Projection

The Daily Target is the basis for planning category budgets. The tolerable zone
and Essential-only threshold are protection layers; they are never presented as
extra time for a person to distribute across distracting apps.

Focus recommends leaving 20 percent of the Daily Target for necessary and
unplanned phone use. This is guidance, not a hard reservation. The person may
distribute anywhere from zero to 100 percent of the Daily Target among finite
top-level app groups, but may never distribute more than the Daily Target.

Example: a four-hour Daily Target recommends planning no more than three hours
and twelve minutes, leaving forty-eight minutes unassigned. The editor still
permits an exact four-hour allocation when the person deliberately chooses it.

- The editor displays one live planning rail rather than explanatory prose
  below every change.
- The rail has a visible `80%` vertical marker, a distinct Daily Target goal
  marker, and a dark terminal marker for the Essential-only hard threshold.
- Colored top-level group segments fill the rail from the left. Social, Work,
  Games, News, Shopping, and other groups retain their distinct colors so the
  person can immediately see what is consuming the plan.
- In a Daily Plan, each group segment represents its daily group budget. In a
  Session Plan, it is the sum of that group's finite allowances across all
  Sessions in the day. An individual app is part of its parent group segment
  and never double-counts time.
- `Limit` with `No limit` selected is not drawn as zero planned time. It has no
  finite segment, so the rail never pretends that unrestricted time was planned.
- The projection updates immediately whenever an allowance changes, a Session
  is added or removed, or a group is changed.

The 80 percent marker is visual guidance, not a warning on its own. Focus stays
quiet while the finite group plan is at or below 90 percent of the Daily Target.
Once the colored plan crosses 90 percent of the Daily Target, Focus shows a
small warning with a triangle and a concrete reason: the plan leaves very
little room for ordinary or unplanned phone use. An allocation exactly equal
to the Daily Target remains valid but receives the stronger leave-room warning.
An allocation above the Daily Target is invalid and cannot be saved. The
Essential-only threshold remains a safety boundary, never an amount that the
person is invited to plan into.

This is the product's projection moment. It helps a person make a realistic
plan before the day starts, rather than discovering halfway through the day
that messages, maps, and ordinary life have consumed the time they forgot to
reserve.

## Daily Plan Limits

- A Daily Plan uses all-day limits for a group and for an individual app.
- A group limit is a shared daily budget for the apps inside that group.
- An app limit is the maximum daily use of that specific app.
- The most restrictive active rule always wins.
- All finite group limits together must fit inside the Daily Target. Editing a
  group adds its current value back into the available pool, so the person is
  never penalized merely for opening an existing boundary.
- Inside a finite group, all finite individual app limits together must fit
  inside that group's allowance. A Blocked app consumes zero planned minutes.
  Apps without a specific rule continue to share whatever group time remains.
- `Limit` with no duration reserves no planned minutes. It does not bypass the Daily Target,
  Essential-only wall, Always Blocked, Quiet Hour intersections, or Clean
  Sight. A specific app cap beneath an unlimited group remains an independent
  stricter boundary; it is not presented as a reserved group allocation.
- The editor exposes exactly two rule modes: `Limit` and `Blocked`. `Limit`
  starts at `No limit` and receives a finite boundary only when the person
  chooses one. `Blocked` always means zero minutes.
- A Blocked group hides all individual app controls because no child allowance
  can weaken its zero-minute parent. Existing child rules remain dormant so
  switching the group back to Limit is non-destructive.
- Reducing a parent below already configured children never silently rewrites
  those child rules. Focus names the conflict, keeps the existing values
  visible, and disables plan saving until the person deliberately reduces the
  affected children or raises the parent.

### Limit picker

Group and individual app allowances use the same vertical duration wheel in
15-minute steps. The selected value, parent boundary, time already allocated
elsewhere, and time left after the selection remain visible together.

- A group wheel may not go above `Daily Target - all other finite groups`.
- A finite group wheel may not go below the sum of its finite app limits.
- An app wheel inside a finite group may not go above
  `group allowance - all other finite app limits`.
- An app wheel beneath an unlimited group is capped by the finite Daily Target
  when one exists; otherwise the product's 12-hour picker ceiling applies.
- Values outside those bounds stay visible but inactive. Selecting one disables
  the confirmation action and shows the exact reason, such as another group's
  existing allocation or child app limits that must be reduced first.
- `No limit` is a secondary action beneath the duration wheel. It removes the
  local duration while keeping the rule in Limit mode.
- Apple Device Activity's 15-minute minimum applies to a monitoring schedule,
  not to a `DeviceActivityEvent` usage threshold. Anasta's daily schedule spans
  the full local day, while the event threshold is expressed in minutes. Anasta
  nevertheless uses one consistent 15-minute product step for clearer planning.

Daily Plan limits are enforceable boundaries, unlike the Daily Target which
begins as a goal and only becomes a broad protective action at the
Essential-only threshold. Keeping those concepts separate makes the product
easier to trust: a user can see whether they are looking at a goal, a group
budget, or an app cap.

When an app and its group both have remaining time, the app becomes unavailable
as soon as either its individual budget or its group's shared budget is used.
The product never adds the two allowances together. This is important because a
group budget exists to prevent moving compulsive use from one social app to
another.

## Intentional Use Check-ins

An app with an active time limit can also have an Intentional Use Check-in. The
standard cadence is every 15 minutes of use. In a Daily Plan, the active limit
is the all-day app limit. In a Session Plan, it is the app limit of the current
Session.

This is a soft boundary, not the final daily limit. Its purpose is to interrupt
autopilot use before a person loses awareness of time. A person can open a
social app with a genuine intention and then slip into scrolling without
noticing that 20 or 30 minutes have passed. The check-in makes that moment
visible again and gives the person a deliberate choice.

Example: Instagram has a 45-minute active limit and a 15-minute check-in.

1. At 15 minutes of use, Focus displays a gentle shield moment.
2. The person chooses to leave the app or consciously continue for another
   15 minutes.
3. If they continue, the next check-in arrives at 30 minutes of total use.
4. At 45 minutes, the app reaches its final active boundary and follows the
   selected final protection strength.

The check-in must be explained during setup in plain language. The explanation
should make its purpose clear: it is there to help the person notice time being
spent before scrolling becomes automatic, not to punish ordinary use.

Suggested setup explanation:

> Every 15 minutes, we will pause and remind you how long you have been here.
> It is a small moment to decide whether this is how you want to use your time.

The shield copy at the moment of interruption is shorter and calm. It should
name the time spent, invite reflection, and offer only the meaningful next
actions: leave the app or continue for another 15 minutes.

### Important measurement rule

Apple reports accumulated foreground use during the active plan interval. Focus
therefore describes this setting as "Check in every 15 minutes of use", not as
"15 minutes per app opening." If a person leaves an app after eight minutes
and returns later, they have seven minutes remaining until the first check-in.
This wording is honest about the behavior and prevents a promise the native API
does not directly provide.

## Always Blocked Apps

An app can be marked Always Blocked instead of receiving an ordinary daily
budget. This is intended for apps a person does not want casually available,
such as TikTok, but may still need to access intentionally on rare occasions.

- Always Blocked + Loose: the user sees a shield every time they try to open
  the app. They can consciously choose an access window of 15 minutes. When
  that window ends, the app is protected again.
- Always Blocked + Strict: the user cannot open the app through the shield.

This is different from a 15-minute check-in. Always Blocked + Loose is a
deliberate gateway before every entry into the app. It is the correct mechanism
when the product needs a true, user-confirmed 15-minute window for each access.

Always Blocked is a permanent-intent protection, not an ordinary Session or
Daily time cap. It cannot coexist silently with an Essential status: to make an
Always Blocked app Essential, the person must first intentionally remove its
Always Blocked status; to mark an Essential App Always Blocked, the person must
first remove it from Essentials. This avoids an impossible state where the
same app is simultaneously promised as always available and always closed.

## Final Protection Strength

Every final app or group boundary has a protection strength:

- Loose: when the active limit is reached, the shield offers a deliberate
  additional 15-minute window or an exit from the app.
- Strict: when the active limit is reached, the app remains protected. In a
  Daily Plan this lasts for the rest of the day; in a Session Plan it lasts
  until the next Session starts and applies its own rules. No continuation is
  offered on the shield.

For example, a 45-minute Instagram limit can have 15-minute check-ins at 15
and 30 minutes, then become Strict at 45 minutes. The soft check-in and the
final strength solve different problems and can work together in the same rule.

## Effective Protection Resolution

"The more restrictive active rule wins" is correct inside ordinary Phone Plan
rules, but it is not sufficient on its own once Focus has global safety layers
and a manually chosen Quiet Hour. Focus therefore resolves the phone in a
fixed, explainable order instead of asking the user to infer a winner from a
stack of unrelated blockers.

### Separate web and app axes

Clean Sight is a web-protection axis. Its active domains and packs remain
blocked in every state: being an Essential browser, being allowed during Quiet
Hour, or being allowed by a Daily or Session Plan never bypasses Clean Sight.

App access is resolved in layers. The two strongest layers are allowlist walls,
so they combine by intersection rather than one ever making the phone less
strict than the other:

1. **Essential-only Daily Target wall:** after the configured hard threshold,
   the daily allowlist is the user's global Essentials. Every other shieldable
   app stays protected for the rest of the local day, while system access that
   iOS excludes from Family Controls shielding remains available.
2. **Quiet Hour Essentials wall:** while a Quiet Hour is active, its own
   Quiet Hour Essentials list is the only Anasta app allowlist for that
   duration. iOS-controlled system access can remain available independently.
   If Quiet Hour and Essential-only are both active, an app must be in **both**
   lists to remain available. This means a Quiet Hour can never reopen a
   non-global-Essential after the daily hard threshold, and the daily hard
   threshold can never reopen a global Optional Essential that the person
   deliberately unchecked for Quiet Hour.
3. **Global Essential allowlist:** outside an active allowlist wall, an
   Essential App bypasses ordinary Daily and Session app/group restrictions.
4. **Always Blocked:** an Always Blocked app is never eligible for Quiet Hour
   Essentials. Its own Loose or Strict gateway remains its only intended
   access behavior.
5. **Ordinary Daily or active Session rules:** individual app and group caps,
   Blocked states, and Strict/Loose final behavior are evaluated here. Within
   this layer, the first exhausted or blocked rule wins; an app and its group
   allowances are never added together.

A temporary Loose continuation is also source-bound. It stores the exact opaque
selection, boundary kind, and threshold that created it. It remains valid only
while that same Loose/check-in boundary is still the winning context. A later
check-in, final limit, Strict rule, Session boundary, Quiet Hour, Essential-only
wall, or Always Blocked change invalidates the old window immediately. The
window cannot survive merely because the app token is the same.

The one declared exception is deliberate: a person can explicitly select an
app as a Quiet Hour Essential. While Quiet Hour is active and the Daily Target
has not reached Essential-only, that explicit selection overrides the app's
ordinary Session or Daily Strict time boundary. It never overrides an
Always Blocked choice, Clean Sight, or the Essential-only Daily Target wall.

Every protection surface must state the actual winning reason: for example,
`Daily limit reached - essentials only`, `Quiet Hour`, `Instagram limit used`,
or `Clean Sight`. No UI may merely say "blocked" when more than one rule could
plausibly explain the state.

## Quiet Hour

Quiet Hour is a manually started, temporary strict allowlist for a person who
wants immediate calm without rebuilding today's plan. It is not a third plan
type, a Session, or a replacement for the Screen Time planning model.

- Quiet Hour is always **Strict**. Loose would duplicate the intentional
  continuations that already belong to Daily and Session Plans and would weaken
  the meaning of starting a period of quiet.
- The person chooses an exact duration with a duration picker, not from a row
  of preset buttons.
- Its setup opens a familiar **Quiet Hour Essentials** picker rather than an
  opaque list of temporary exceptions. Core Essentials are included and locked.
  The currently selected global Optional Essentials form the initial selection,
  but the person can uncheck them for this Quiet Hour and can check any other
  app on the phone instead.
- Quiet Hour captures that global Essential selection as a **start-time
  snapshot**. Changes made inside its picker are local to the running Quiet
  Hour; starting the next Quiet Hour begins again from whatever the permanent
  global Essential configuration is at that later moment.
- Once Quiet Hour starts, that allowlist snapshot and original end time cannot
  be weakened, shortened, or ended early. The active sheet may only extend the
  duration, up to a 12-hour total. This prevents a difficult moment from turning
  the strict action into an editable bypass.
- For example, a person may uncheck Chrome for this Quiet Hour and check
  WhatsApp, Instagram, a work tool, a game, or any other app they deliberately
  need during that period. The picker does not judge the app's category; the
  person is defining the phone that is useful for this particular quiet period.
- Quiet Hour Essentials do not modify the global Essential configuration, App
  Group membership, or a later Quiet Hour. They expire with this one Quiet
  Hour. The user-facing name is "Quiet Hour Essentials" because they are the
  essential set for this protected period, even though the selection is stored
  only for its duration.
- An Always Blocked app is shown as unavailable for Quiet Hour Essentials; its
  permanent intent is changed only through the Always Blocked setting itself.

Quiet Hour can permit a Quiet Hour Essential even where the active Session or
Daily Plan's ordinary Strict limit is exhausted. This is a conscious exception
that must be apparent before the person starts it: when a selected app is
currently blocked by an ordinary plan rule, the sheet explains that its use
will still count toward the Daily Target and its original App Group.

### Quiet Hour accounting and expiry

Quiet Hour changes availability, never the truth of usage.

- Use in a Quiet Hour Essential continues to count toward total Daily Target
  use, its existing App Group, and detailed analytics.
- If that use passes a lower-level app or group boundary, the corresponding
  lower-level eligibility becomes `lost` under the normal Plan Integrity rule.
  Quiet Hour does not erase or preserve an app/group streak by exception.
- The macro Daily Target trophy is affected only by the macro Daily Target
  outcome. A lower-level Quiet Hour exception does not itself lose the trophy.
- If the Essential-only threshold is reached during Quiet Hour, every Quiet
  Hour Essential that is not also a global Essential is protected immediately.
  An app must remain in both allowlists, so the hard daily boundary never
  makes the Quiet Hour less strict.
- When Quiet Hour ends, Focus immediately reevaluates the active plan. If the
  same Session still applies and an app's ordinary limit was already exhausted,
  that app is protected again; if a new Session began while Quiet Hour was
  active, that new Session's rules take over instead.

## App Groups

- Focus provides useful default groups, such as Social, Video & Entertainment,
  Games, News, and Work.
- Every new Phone Plan starts with those default groups. Their app membership
  is the starting catalog for the whole plan, even when the Sessions themselves
  begin with no configured limits.
- Users can create their own groups.
- An app belongs to exactly one group in a plan.
- When a user moves an app into a custom group, it is removed from its default
  group. Focus never leaves the same app in two active groups.
- The native plan-group picker stores individual applications, not whole Apple
  category tokens. A category token can silently contain an app that is also
  selected elsewhere, which would make one-group ownership impossible to
  guarantee. Saving a group therefore removes its selected app tokens from
  every sibling group in that Phone Plan and explains the move.
- When building a new plan, the user can choose from groups created in earlier
  plans. Selecting a past group applies that group to the new plan so the user
  does not need to rebuild it.

### Why group ownership is strict

The group system is for understandable shared budgets. If Instagram appeared
in both Social and Entertainment, the user could not tell which budget consumed
its time or why it was protected. Single membership gives every app one clear
home and one clear explanation.

Past-group reuse preserves the value of earlier setup work. It is a shortcut
for rebuilding a plan, not a reason to make people maintain the same app list
from scratch every morning.

### Group Catalog Scope

App membership belongs to the Phone Plan, not to an individual Session. All
Sessions in one plan see the same group catalog and the same one-group-per-app
ownership. Sessions only decide how each existing group or app is handled in
that particular part of the day: allowance, Blocked, Strict, or Loose.

Essential is an allowlist overlay, not a competing group membership. An app can
remain classified as Work, Social, or another single group for planning and
analytics while its active Essential status exempts it from Phone Plan limits.

This keeps the meaning of a group stable across the day. Instagram cannot be
Social in Morning and a separate Entertainment membership in Evening; that
would make planning, analytics, and a later explanation of protection
unreliable. The Session may change Instagram's rule, but not give it a second
group home.

### Create, Reuse, and Retire Custom Groups

The group picker has two clear paths:

1. **Add new group:** opens a sheet where the person must give the group a name
   and choose its apps. A name is required. Custom group names are globally
   unique in Focus: a custom name cannot duplicate a default group name or a
   custom name already used by another plan. This makes reuse unambiguous.
2. **Use an existing group:** shows previously created custom groups. Tapping a
   group first reveals its name and included apps; the sheet then offers one
   clear action, `Add this group`. This makes adding a familiar group a short,
   two-step action rather than a rebuild.

When a custom group receives an app, Focus moves that app out of its prior
group in the current plan. If that move changes an existing custom placement,
the UI states the move plainly before saving. Default groups update
automatically, so the one-group-per-app rule is never left to the user to
repair manually.

Custom groups remain reusable because they are retained in a group library.
The library may remove a custom group only when no existing Phone Plan uses it.
If a group is referenced by even one active or inactive plan, deleting it would
break the plan's historical configuration, so removal is unavailable. The
interface shows a locked Delete action that explains this reason when tapped;
it does not silently discard a group that a saved plan still needs.

## Future Scope: Session Plans (Dormant in v1)

- Sessions are time ranges within the one active day, for example Morning,
  Work, Evening, and Night.
- Each session can set different use rules for the existing groups and apps.
- A session changes the rule for an existing group or app; it does not require
  the user to select all of the apps again.
- A Session Plan does not have separately editable all-day app or group limits.
  The active Session owns the app and group budgets, block states, and
  Strict/Loose strength for its time range.
- The Daily Target is the one cross-session all-day safety layer. It remains
  above every Session rule and moves the phone into Essential-only mode when
  its threshold is reached.

### Session Rule Model

A Session is a planned set of temporary phone-use rules. When the next Session
starts, its rules replace the prior Session's rules immediately. This is the
central simplification of Phone Plans: a person plans one connected day rather
than trying to manage separately started blockers.

- Every Session can give an app or group a time allowance, block it entirely,
  and set its final protection strength to Loose or Strict.
- An app or group allowance belongs only to that Session. It starts fresh when
  that Session starts and does not carry unused minutes in from a prior Session.
- A Strict boundary protects the affected app or group for the remainder of
  the current Session. It does not keep the app locked into the next Session.
  When the next Session begins, its own configuration takes over.
- A Loose boundary offers the intentional 15-minute continuation described
  above, but only while that Session remains active. The next Session still
  starts with its own independent rules and allowance.

Example: Morning gives Instagram 45 minutes with Strict protection. Spending
those 45 minutes blocks Instagram until Morning ends. If Evening begins with
Instagram set to 45 minutes and Loose protection, Instagram becomes available
at Evening's start with that new 45-minute Evening allowance. A later Night
Session can instead give Instagram 15 minutes with Strict protection; then its
15 minutes are all that Night permits before Instagram is protected again.

Focus may show a read-only daily planning summary such as "Instagram planned:
75 min across Sessions." It is the sum of planned Session allowances, useful
for overview and reflection, but it is not a second cross-session quota and is
not edited separately. The individual Session rules are the enforceable app and
group boundaries.

### Session Setup and Reuse

New Sessions begin blank in the useful sense: they start with the plan's
default group catalog, and every group and app starts in `Limit` with no
duration. This is a real usable state, not a missing required field. A person
can configure rules from scratch, add or reuse custom groups through the plan
catalog, or reuse a Session they have already made well.

`Limit` with `No limit` means the Session imposes no local time boundary on that group or
app. It does not mean the usage disappears: the time still contributes to the
global Daily Target, and Always Blocked, Clean Sight, and the Essential-only
threshold continue to apply. The time control offers `No limit` as a clear
secondary action beneath the finite duration wheel.

`Copy existing Session` is a shortcut inside Session setup:

1. Focus lists the user's existing Phone Plans.
2. Opening a plan lists its Sessions.
3. Tapping a source Session reveals a readable summary of its group and app
   rules.
4. `Copy rules` applies that rule set to the Session currently being edited.

Copying rules never changes the current Session's start time, end time, or
place in the circular day. It copies only protection configuration: allowances,
Blocked states, check-ins, and Strict/Loose choices. The source Session remains
unchanged.

A Session is eligible for copying only when its source plan has a compatible
group catalog with the plan currently being edited. Compatibility means the
same plan-level groups and the same app membership inside each group. Matching
names alone are not enough: a group named Social with a different set of apps
is a different protection context.

The copy browser still shows incompatible Sessions, but they appear visually
inactive. Tapping one opens an explanation instead of applying anything. The
explanation identifies the exact difference, such as a group that exists in the
source plan but not in the current plan, a group present only in the current
plan, or a group whose app membership differs. The person can then deliberately
adjust the plan's group catalog or choose another compatible Session.

Copying never imports groups, moves apps between groups, or changes the target
plan's group structure. This restriction keeps a two-step Session copy honest:
when the action is available, the copied rules have exactly the same meaning in
their new Session as they had in the source Session.

There is no delete action in the `Copy existing Session` browser. Those are
real Sessions inside existing, possibly inactive plans, not disposable library
items. Removing a Session is done only in its own plan through the structural
Remove Session flow described in the circular editor.

### Session Rule Resolution

The global order in Effective Protection Resolution is evaluated before an
ordinary Session rule. Therefore Quiet Hour, Essential-only, Essentials, and
Always Blocked never need to be improvised separately by a Session screen.

When the active Session is the applicable ordinary layer, its group and
individual app rules are evaluated together. If an app and its group both have
allowances, the stricter active result wins: an individual app can be protected
before its group is exhausted, and a group can protect all of its apps before
one specific app reaches its own allowance. The Strict or Loose behavior shown
on the shield belongs to the exact ordinary boundary that was reached.

The Daily Target remains different from Session boundaries. When its
Essential-only threshold is reached, every shieldable non-essential app is
protected for the remainder of the local day, even if a later Session would
normally allow that app or a Quiet Hour temporarily allowed it. Global
Essentials and iOS-controlled system access remain available.

### Circular Session Editor

Structured Day uses one circular 24-hour editor rather than a list of unrelated
start and end fields. The circle makes the full day visible at once and makes
the connected nature of sessions obvious.

- A plan always has between one and four Sessions. Four is the maximum; more
  would make day planning unnecessarily complicated.
- Each session receives a distinct, automatically assigned color. The colors
  are for orientation in the editor and in later plan summaries, not another
  user setting to maintain.
- The circle represents `00:00` through `24:00`. Each session is a colored
  segment and each shared boundary is a draggable handle.
- Dragging a boundary changes the ending time of one session and the starting
  time of its adjacent session together. A boundary can never create a gap,
  overlap, or nested session.
- Tapping a session selects it and reveals its exact Start and End values.
  Editing one of those values moves the same shared boundary as dragging it,
  so visual and precise time editing always stay in sync.

### Adding and Removing Sessions

Session count can change after a plan is saved, but Focus treats it as a
structural change to the day rather than an ordinary time adjustment. The
editor must always show a confirmation popup before either adding or removing
a Session. This protects a person from accidentally changing the protection
shape of their day with one tap.

#### Add Session: split an existing Session

Adding does not create a free-floating range. The person chooses only the
**start time** of the new Session. Focus locates the existing Session that
contains that point and splits it:

- the original Session ends at the chosen start time;
- the new Session begins at that time;
- the new Session automatically receives the original Session's former end
  time;
- the new Session initially copies the source Session's rules so the phone
  stays consistently protected until the person intentionally changes them.

Example: adding a Session at `14:00` inside Work `09:00-17:00` changes Work to
`09:00-14:00` and creates a new Session from `14:00-17:00`. The user never has
to enter an end time or repair adjacent Sessions by hand.

Before the split is applied, Focus presents a confirmation that names the
affected Session and the new range, for example: "Add a Session from 14:00 to
17:00? Work will end at 14:00." The action is unavailable when the plan already
has four Sessions.

#### Remove Session: extend the preceding Session

Removing a Session does not divide its time 50/50 between its neighbors.
Instead, the Session immediately before it expands through the removed range
and keeps its own rules. This changes only one neighboring Session and makes
the outcome predictable.

Example: Morning `06:00-09:00`, Work `09:00-17:00`, and Evening `17:00-23:00`
become Morning `06:00-17:00` and Evening `17:00-23:00` when Work is removed.
Morning's rules govern the newly absorbed time. Because the schedule is
circular, removing the first chronological Session extends the Session that
precedes it across midnight.

Before the removal is applied, Focus presents a confirmation that states which
Session will expand and the resulting time range. The final remaining Session
cannot be removed.

#### Active-day safeguards

- In an active plan, a new Session may start only now or in the future. Focus
  never inserts a Session into elapsed time.
- In an active plan, only a fully future Session can be removed. A current or
  completed Session is historical truth and is not structurally rewritten.
- After a confirmed structural change, Focus recalculates the plan projection
  and any inline planning warnings. The user can then intentionally adjust
  allowances or Strict/Loose settings for the affected future Session.

The model is circular, not a set of independently created ranges. Therefore an
overnight session such as Sleep `23:00-07:00` is one logical session that wraps
over the top of the clock. It is not two sessions and cannot contain another
session. For native enforcement, the implementation may apply that one logical
session as two wall-clock intervals, `23:00-24:00` and `00:00-07:00`, while
preserving the same session identity, color, and rules in the user experience.

At a session boundary, the rules change immediately to the rules of the next
session. There is no interim state where both sessions are active and no gap in
which a protected app becomes accidentally available. This needs to be true in
the UI and in the native monitor schedule.

### Daily Plan Rule Resolution

The global order in Effective Protection Resolution is evaluated before an
ordinary Daily Plan rule. When the Daily Plan is the applicable ordinary layer,
the app's individual daily limit and its group daily budget are evaluated
together; the first exhausted limit protects the app. The two allowances are
never added together.

This is the concrete meaning of "the most restrictive active rule wins" inside
a Daily Plan. The higher global layers and the intentional Quiet Hour exception
are defined once in Effective Protection Resolution, so every protection screen
can state which rule became active instead of presenting a vague generic error.

## Progress and Analytics

- The Daily Target is connected to the existing Focus trophy/streak system.
- When a user keeps the plan's macro Daily Target, that day earns a trophy and
  contributes to the streak.
- The Focus landing screen provides two distinct entry points: tapping trophies
  opens the existing kept/rest/broken monthly calendar, while an explicit
  `Analytics` button opens the full Focus Analytics surface.

Analytics exist to make change visible, not to turn Focus into a competitive
scoreboard. The important comparison is personal: how much phone time a user
used before and after forming daily plans. The trend must make it easy to see
whether the person is moving toward the Daily Target over time.

The trophy is the daily emotional payoff for keeping the macro goal. Native
activity is the longer-term evidence that the user's discipline is changing.
Focus keeps these sources honest: threshold events govern the trophy ledger,
while Apple's private report renders exact activity. React Native never invents
or estimates a usage total that Apple has not made available to the host.

### Privacy-safe analytics architecture

`DeviceActivityReport` runs in a privacy sandbox. Apple prevents that extension
from moving sensitive activity outside its own process, including through a
shared `UserDefaults`, files, or the network. The product therefore uses this
architecture deliberately:

- React Native owns navigation, date/range selection, plan names and rules,
  Daily Target metadata, trophy state, and threshold/override history.
- A native SwiftUI Device Activity Report owns actual phone-time totals, hourly
  and daily bars, Apple categories, application labels, and website labels.
- The host may send non-sensitive plan metadata and opaque picker tokens into
  the report. The report may read those values to calculate Anasta group totals
  inside the extension, but it never writes activity results back out.
- Only one `DeviceActivityReport` is mounted at a time. The Analytics segmented
  control switches between a 30-day trend and a Daily Review, avoiding Apple's
  known instability when multiple reports with different filters coexist.
- The 30-day view can move backward through successive 30-day windows for up to
  roughly one year, subject to activity history that iOS still retains.

Anasta relies on ordinary tokenized Family Controls authorization. It does not
require or export non-tokenized `FamilyActivityData`, bundle identifiers, or raw
domain history. If a development profile returns
`approvedWithDataAccess`, Anasta accepts it as an approved blocker status but
continues to use the same tokenized, privacy-preserving design. Production
outside the EU must not depend on that broader authorization.

### Daily Review and Drill-down

The end-of-day report is a reflective, interactive explanation of a day, not a
generic chart screen. Its purpose is to help a person make a better next plan:
where did time actually go, where did it differ from the plan, and which future
Session or group deserves a change?

Tapping Today's Phone Plan opens the live today variant of this review. It reads
the same materialized day record and plan snapshot as the Focus landing screen,
so a deliberate mid-day plan change is reflected immediately without erasing
elapsed usage. For a Session Plan it shows only the currently active Session's
rules; allowances from other Sessions are never added together as if they were
simultaneously active.

The React-owned Daily Review opens with:

- a selectable local date, with previous/next navigation and a recent-day strip;
- the plan that governed that date, its Daily Target, and its kept, missed,
  in-progress, no-target, or unresolved state;
- a Session outline when the date used a Session Plan, including the connected
  times, configured rule count, and whether a deliberate lower-level override
  was recorded in that Session; and
- one embedded private Activity Report for the selected day.

Inside the private report, the person sees:

1. exact total iPhone activity for the selected day;
2. an hourly rhythm for seeing when phone use clustered;
3. Anasta group totals reconstructed privately from the plan's opaque app
   selections, when those selections are available;
4. Apple's category totals; and
5. the most-used applications and websites, rendered from opaque labels.

Anasta also snapshots the opaque app membership of each plan group without
reading app identity or usage into React Native. Identical group selections are
deduplicated and each local date points to the configuration that governed it,
with the same 400-day retention as plan snapshots. Editing or deleting a plan
therefore cannot rewrite which group an old day's private report attributes
activity to.

Apple report filters aggregate only hourly, daily, or weekly intervals. They do
not expose exact arbitrary 5- or 15-minute Session slices to the host. Focus
therefore never labels an estimated hour bucket as exact Session usage. Session
truth comes from the plan outline and exact native threshold events: which
boundary fired, whether the person turned back, and whether a Loose continuation
was deliberately granted. This is less theatrical and more trustworthy than a
false per-Session total.

Long-term analytics are intentionally lighter than a daily review. Their job is
to make change visible at a glance, not to expose every Session and app from
months ago. A 30-day report shows the period's private daily average, a readable
14-day bar rhythm, leading Apple categories, applications, and websites. The
person can step through older 30-day windows without creating a permanent raw
usage archive in Anasta.

Focus persists only its own compact records: plan definitions and assignments,
Session boundaries, threshold events, override decisions, Daily Target results,
trophies, and explanatory metadata. Detailed activity stays inside the native
report for the chosen period. It is never uploaded and never copied into the
React Native SQLite database.

## Plan Integrity and Streak Ledger

An active plan can be edited during the day. Focus does not use a cooldown to
prevent reasonable changes to a person's plan. Instead, it protects integrity
through an honest, irreversible record of whether each tracked limit has
already been kept or exceeded.

Every streak-bearing limit has a daily eligibility state:

- `eligible`: the limit has not been exceeded so far today.
- `lost`: the limit was exceeded at some point today. It cannot become
  eligible again through a later plan edit.

When an active plan changes, Focus compares actual use so far with the
replacement limit. The same rule applies at the macro Daily Target and at any
lower-level group or app streak that Focus displays.

| Actual use at edit time | New limit | Result |
| --- | --- | --- |
| 4h | Changed from 6h to 8h | Remains eligible. |
| 4h | Changed from 6h to 5h | Remains eligible. The new target is stricter, but it has still been kept. |
| 4h | Changed from 6h to 3h | Becomes lost. The replacement target is already exceeded. |
| 1h 30m Social use after a 1h Social limit | Later changed to a 2h Social limit | Remains lost. The earlier excess cannot be rewritten. |

This avoids two bad outcomes at once: a user is not punished for setting a
better target they already meet, and a user cannot erase a real overage by
raising the limit afterward.

### Change confirmation behavior

- If an active macro Daily Target change would make today's trophy ineligible,
  Focus shows a confirmation before saving. The message explains that the new
  target is already below time used today and that the day will no longer earn
  its trophy. This protects people who are collecting trophies from a misclick
  or an unconsidered change.
- When exact live use is unavailable to the host, changing today to a plan with
  a stricter finite Daily Target shows an honest reconciliation confirmation.
  iOS then evaluates past activity against that target. If it was already
  crossed, the delayed native event irreversibly marks the trophy lost.
- If a lower-level group or app limit becomes ineligible, Focus updates that
  streak silently. It does not interrupt the user with the same large warning.
- Reaching an enforced app or group boundary is not itself a streak loss. If
  the person leaves the app, the boundary did its job and the lower-level
  streak remains eligible. A Loose boundary becomes `lost` only after the
  person completes the return practice and deliberately opens the additional
  15-minute window; a Strict boundary offers no continuation and therefore
  cannot create an overage by itself.
- Increasing a limit never restores a streak that was already lost earlier in
  the day.
- If an app or group boundary has already fired in the active Session, raising
  that limit does not reopen it during the same Session. Universal Family
  Controls does not expose exact foreground usage to the host app, so Focus
  cannot safely reconstruct only the remaining minutes after rebuilding a
  monitor. The higher limit starts with the next Session (or the next day in a
  Daily Plan). Choosing `No limit` inside Limit mode explicitly removes that local
  boundary and applies immediately, while the Daily Target and stronger layers
  still remain in force.
- Essential Apps are a safety allowlist, not a behavioral target, so editing
  them does not affect streak eligibility.

## Native Enforcement Requirements

- Phone Plans require Apple's Screen Time frameworks: Family Controls,
  Managed Settings, and Device Activity.
- The user must grant Screen Time authorization before a plan can enforce app
  restrictions.
- Authorization is requested at the moment protection is activated: assigning
  a protective plan to today, saving new protection into today's active plan,
  starting or extending Quiet Hour, enabling a Clean Sight rule, or opening an
  Apple activity picker. Creating inactive plan drafts and arranging future
  weekdays does not interrupt planning with a permission prompt.
- The native layer must apply the Daily Target, Daily Plan group and app
  limits, and the active Session's group and app rules while Anasta is closed.
- The native layer must also apply and expire Quiet Hour while Anasta is closed.
  It must use the chosen local end time and reconcile the effective protection
  state when the device next becomes active, the app returns to foreground, or
  a relevant plan boundary is crossed.
- The native layer must treat Essential Apps as explicit exceptions to Phone
  Plan shields, while applying Clean Sight separately so blocked websites stay
  blocked even inside Essential browsers.
- The universally available setup flow uses Apple's private activity picker to
  let a person select their banking, payment, authenticator, and password
  manager apps. Anasta must not depend on automatically enumerating installed
  third-party apps.
- If the separate Family Controls App and Website Usage entitlement and
  `approvedWithDataAccess` authorization are available, Anasta may detect
  installed apps and pre-suggest matches such as a user's banking app. This is
  an enhanced path only: Apple limits customer use of that data-access API to
  EU devices with EU Apple Accounts. It is not required by Focus v4 and the
  universally available blocker/report flow must never depend on it.
- At each Session boundary, native enforcement must atomically replace the
  prior Session's restrictions with the next Session's restrictions. A Strict
  block that belongs to the prior Session must end only when the next Session's
  configured rule takes over; there can be no unprotected gap between them.
- Native enforcement uses one central effective-protection resolver. It reads
  the Daily Target state, Essentials, active Session or Daily Plan, Always
  Blocked rules, and any active Quiet Hour, then produces one final app shield
  state. Quiet Hour must not be implemented as a second permissive store that
  merely competes with a stricter plan store. Clean Sight domain protection is
  calculated as an independent non-relaxable web layer.
- The system needs a user-visible state for missing or revoked authorization;
  an unprotected plan must never be presented as active protection.
- Time calculations use the phone's local time and must recalculate when its
  time zone changes.
- Apple Device Activity intervals have a 15-minute native minimum. Quiet Hour
  therefore starts at 15 minutes, and every non-empty piece created when an
  overnight Session is split at midnight must also be at least 15 minutes.
- A logical Session that crosses midnight is represented to the user as one
  Session but scheduled natively as an early and late wall-clock interval. Both
  pieces keep the same rules and together preserve continuous protection.
- Apple permits at most 20 monitored activities for an app and its extensions.
  Focus keeps only the current and next local day, prunes expired activities,
  and reports `excessiveActivities` as a visible recovery state instead of
  pretending protection started.
- A Device Activity event with empty application, category, and web-domain
  selections intentionally uses Apple's `includesAllActivity` behavior. This
  is the native basis for the total Daily Target and Essential-only threshold;
  it is not an empty event that watches nothing.
- Managed Settings category allowlists do not shield every iOS system app.
  Apple treats that limitation as designed behavior, so Focus keeps the
  `Essentials only` state name but explains the effective result as
  `Essentials + iOS system access`. The app never claims that unselected
  system tools are guaranteed closed.
- Reapplying an unchanged payload is idempotent. Foregrounding Anasta must not
  stop and recreate active Device Activity schedules, because doing so can
  disturb threshold accounting. Plan, Quiet Hour, and temporary-access expiry
  monitors have separate fingerprints and lifecycles; changing one cannot
  silently cancel another.
- Every rebuilt plan monitor receives a revision. Delayed callbacks from an
  older revision are ignored, and rebuilding the currently active logical
  Session preserves a wall that has already fired. Changing an unrelated app
  selection or editing another rule must never reopen a reached boundary.
- A 15-minute temporary access window is granted only after its native expiry
  monitor starts successfully. If iOS rejects that monitor, Anasta reapplies
  protection immediately rather than leaving an indefinite exception.
- Temporary access is revalidated again when the person completes the return
  practice. A stale intervention screen cannot open an app or lose a streak
  after the active Session or winning boundary changed.
- Daily Target loss is scheduled one second beyond the selected target so the
  documented `at or below` trophy rule remains true. App/group limits and the
  Essential-only wall still fire at the exact configured boundary.
- Native threshold events keep their local day and plan identity. Delayed
  events are consumed before a past day earns a trophy, so reopening Anasta can
  never briefly celebrate a day that iOS already knows was broken.
- Daily Target loss also has a compact durable native ledger. It does not rely
  only on the general callback queue, so a long period away from Anasta or many
  lower-level events cannot evict the one event that decides the trophy.
- A successful target schedule is remembered separately from a saved target.
  A pending day can earn a trophy only when that exact day and plan were armed
  natively. If authorization is lost, every still-unresolved day loses that
  proof and resolves conservatively instead of receiving an unverifiable
  trophy; an already-delivered target loss still resolves as broken.
- Revoked or not-yet-granted authorization clears Anasta-owned monitors,
  settings, temporary access, and pending intervention data before the UI
  returns to an unprotected state.
- The two-day rolling schedule contains a lightweight daily rollover monitor
  even on a day with no Phone Plan. This keeps future weekly assignments alive
  across consecutive unplanned days without depending on the host app opening.
- When an active Session monitor must be rebuilt, `includesPastActivity` is
  used only for a Session that begins on an exact hour. Apple otherwise counts
  backward from the nearest full hour; for example, rebuilding a `09:30`
  Session with that flag would incorrectly charge activity from `09:00`.
  Daily Target and Essential-only observations always include prior activity
  from the current local day.
- If iOS cannot create a reliable Quiet Hour expiry monitor, the runtime payload
  is stripped of that Quiet Hour and its allowlist is not applied. This is a
  visible start failure, never an indefinite strict lock.
- Quiet Hour expiry scheduling is proven before a later Phone Plan scheduling
  fallback can apply the allowlist. The React optimistic Quiet Hour is rolled
  back only when native runtime status confirms that exact start was not armed.
- A current or next-day Phone Plan with a configured group boundary but no
  opaque app selection, or an individual rule without exactly one app token,
  is rejected before replacing the last valid native payload. Expo preview
  labels are never accepted as evidence that iPhone protection exists, including
  when a weekly assignment rolls into a new day while Anasta is closed.
- Native scheduling errors are mapped to stable product states:
  `unauthorized`, `excessiveActivities`, `intervalTooShort`,
  `intervalTooLong`, and `invalidDateComponents`. Each state carries a calm,
  actionable recovery message.

### Native architecture consequence

The React Native UI can create, edit, and explain a plan, but it cannot be the
only enforcement layer. Apple must be able to apply restrictions after Anasta
is closed and while another app is foregrounded. The final implementation needs
a native Screen Time bridge plus the required Apple app extensions, with a
shared representation of the active plan available to those extensions.

The UI should therefore never claim a plan is protecting the phone merely
because it is saved. It is protected only after the required Apple
authorization is present and the native layer confirms the active plan has been
applied. Missing permission, revoked permission, or a native scheduling error
must have an explicit, calm recovery state.
