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
- "Session Plan" refers only to fixed time segments inside one day. It is not
  a separately started focus session.
- `Session` is the user-facing name for those time segments. Focus does not
  call them Watches: a Watch implied a separately started blocker, while a
  Session is one connected part of a single planned day.

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
  current protection, the active Session when one exists, the day's plan state,
  and Clean Sight. It must not carry legacy Watch cards, overlapping Watch
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

- The shield and phone Lottie assets may remain visibly animated while Focus is
  on screen. A continuously alive status animation is part of the high-tech
  character of this product, provided the asset itself is light enough for a
  weaker iPhone.
- At most one primary Lottie animation is mounted and playing on the Focus
  landing screen. It pauses immediately when the route loses focus, the app
  backgrounds, the relevant state disappears, or Reduce Motion is enabled.
- The shield is shown whenever any protection is truly active: an active
  Session rule, Always Blocked protection, Clean Sight, or the Essential-only
  state. The phone animation represents an unprotected state. Neither asset
  loops continuously merely to prove that a status still exists.
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

## Phone Plans

- A plan belongs to one day and governs that full 24-hour day.
- There can be only one active Phone Plan for a given day.
- A user chooses one of two planning experiences when creating a plan:
  - Daily Plan: one consistent set of rules for the whole day.
  - Session Plan: the same 24-hour day is split into distinct sessions, each
    with its own app-use rules.
- A Session Plan has no overlaps and no uncovered time. Its sessions always
  cover the complete day.

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

- A person turns a Protection Pack on or off.
- Focus supplies preloaded packs for common unwanted-content needs.
- A person can create a named custom pack, add domains one by one, or add a
  custom domain to an existing relevant pack.
- The Clean Sight detail screen is for choosing packs and editing domains; it
  does not contain Phone Plan sessions, Daily Targets, or a second scheduling
  system.
- Clean Sight remains effective even when a browser is an Essential App. An
  Essential browser can open ordinary allowed websites, but not domains or
  content covered by active Clean Sight protection.

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

The weekly assignment defines future days. It must not rewrite the resolved
plan, usage, eligibility, or trophies of a day that is already in progress or
has already ended. This keeps the weekly planner compatible with the Plan
Integrity and Streak Ledger: changing a Tuesday template is planning for future
Tuesdays, not an edit to historical phone use.

## Daily Target

Every Phone Plan starts with a Daily Target: the user's intended total phone
use for that day, such as under four hours.

The target has three states:

1. Target: the intended daily amount. Reaching it is a successful day.
2. Tolerable zone: a visible buffer after the target, where the user is over
   the target but has not reached the strongest device protection yet.
3. Essential-only threshold: once this ceiling is reached, only the user's
   Essential Apps remain available.

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

The system has three layers.

1. **Core Essentials:** always active and not removable through ordinary
   settings. Where present on the device, this includes Phone, Messages,
   FaceTime, Maps, Camera, and Wallet. Banking and payment apps, authenticator
   apps, and password managers that the user designates during Financial &
   Access setup also become Core. Adding such an app is deliberate; after it
   becomes Core, it cannot be switched off with an Essential toggle.
2. **Preloaded Optional Essentials:** initially active but freely removable.
   The starter set is Mail, Gmail, Calendar, Reminders, Clock, Google Maps or
   Waze, Health, Find My, Settings, Safari, and Chrome when present. This gives
   a person who moves quickly through setup a phone that remains broadly useful
   during strong protection.
3. **All other apps:** every remaining app is available in the picker and can
   become an Optional Essential. This includes WhatsApp, Viber, Instagram,
   Photos, App Store, or any other app a person's work or life genuinely
   requires. An app is never categorically forbidden from being Essential.

Optional Essential Apps can be added or removed at any time, including while a
plan is active. The native protection state updates immediately from that
moment forward. This is an access/safety choice, not a behavioral score, so it
does not rewrite usage, change streak eligibility, or require a cooldown.

Essential is not an App Group. An Essential App keeps its existing group
membership for organization and analytics, but the Essential allowlist takes
priority over ordinary Phone Plan limits. Clean Sight remains above this
allowlist: making Safari or Chrome Essential never makes blocked websites or
unwanted content available.

The preloaded browser and Settings decision intentionally favors a functioning
phone over a pure dumb-phone mode. A browser can still reach non-blocked sites
after the daily Essential-only threshold, and Settings remains available; the
product must communicate that tradeoff plainly. Safari, Chrome, and Settings
are Optional rather than Core, so a person who wants a stronger device can
remove them from their own Essentials.

The exact target, tolerable-zone, and Essential-only values are configured for
the plan. The product may suggest sensible defaults, but does not assume that
every person's work and life require the same amount of phone time.

### Daily Target outcome rules

- A day earns the Daily Target trophy only when total use remains at or below
  the target. Time in the tolerable zone does not earn the trophy.
- Entering the tolerable zone is informative, not a failure state. It should
  make the remaining room visible without shaming the user.
- Reaching the Essential-only threshold changes availability: every app that
  is not in Essential Apps is protected for the rest of the active day.
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

Focus reserves 20 percent of the Daily Target for necessary and unplanned phone
use. The remaining 80 percent is the recommended Planning Capacity that a
person can distribute among their top-level app groups.

Example: a four-hour Daily Target has a Planning Capacity of three hours and
twelve minutes, with forty-eight minutes held as an Unplanned Reserve.

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
- `No limit` is not drawn as zero planned time. It has no finite segment and is
  represented as an unbounded `infinity` state in the relevant group detail,
  so the rail never pretends that unrestricted time was planned.
- The projection updates immediately whenever an allowance changes, a Session
  is added or removed, or a group is changed.

The 80 percent marker is visual guidance, not a warning on its own. Focus stays
quiet while the finite group plan is at or below 90 percent of the Daily Target.
Once the colored plan crosses 90 percent of the Daily Target, Focus shows a
small warning with a triangle and a concrete reason: the plan leaves very
little room for ordinary or unplanned phone use. At and beyond the Daily Target
the warning becomes stronger, but saving remains allowed. The Essential-only
threshold remains a safety boundary, never an amount that the person is invited
to plan into.

This is the product's projection moment. It helps a person make a realistic
plan before the day starts, rather than discovering halfway through the day
that messages, maps, and ordinary life have consumed the time they forgot to
reserve.

## Daily Plan Limits

- A Daily Plan uses all-day limits for a group and for an individual app.
- A group limit is a shared daily budget for the apps inside that group.
- An app limit is the maximum daily use of that specific app.
- The most restrictive active rule always wins.

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

## Session Plans

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
default group catalog, but every group and app rule is explicitly set to
`No limit`. This is a real usable state, not a missing required field. A person
can configure rules from scratch, add or reuse custom groups through the plan
catalog, or reuse a Session they have already made well.

`No limit` means the Session imposes no local time boundary on that group or
app. It does not mean the usage disappears: the time still contributes to the
global Daily Target, and Always Blocked, Clean Sight, and the Essential-only
threshold continue to apply. In the time control, `No limit` sits at the
far-right endpoint as a stable `infinity` state. Moving away from that endpoint
activates a concrete allowance and exposes its related protection settings.

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

For an app inside the active Session, Focus evaluates the following boundaries:

1. If the app is an Essential App, allow it under Phone Plans.
2. The global Daily Target Essential-only threshold.
3. The active Session's group rule.
4. The active Session's individual app rule.

For non-Essential Apps, the first boundary reached controls access. If an app
and its group both have allowances, the stricter active result wins: an
individual app can be protected before its group is exhausted, and a group can
protect all of its apps before one specific app reaches its own allowance. The
Strict or Loose behavior shown on the shield belongs to the exact boundary that
was reached.

The Daily Target remains different from every one of these boundaries. When its
Essential-only threshold is reached, every non-essential app is protected for
the remainder of the local day, even if a later Session would normally allow
that app. Only Essential Apps remain available.

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

For a Daily Plan, Focus resolves access in this order:

1. If the app is an Essential App, allow it under Phone Plans.
2. If the Essential-only threshold is active, protect the app.
3. If the app's individual daily limit is exhausted, protect the app.
4. If the app's group daily budget is exhausted, protect the app.
5. Otherwise, allow the app under the remaining daily limits.

This order is the concrete meaning of "the most restrictive active rule wins."
It also makes future explanations possible: every protection screen can say
which rule became active instead of presenting a vague generic error.

## Progress and Analytics

- The Daily Target is connected to the existing Focus trophy/streak system.
- When a user keeps the plan's macro Daily Target, that day earns a trophy and
  contributes to the streak.
- Focus will provide clear usage analytics that compare current phone use with
  earlier use, including a readable trend over the previous month.

Analytics exist to make change visible, not to turn Focus into a competitive
scoreboard. The important comparison is personal: how much phone time a user
used before and after forming daily plans. The trend must make it easy to see
whether the person is moving toward the Daily Target over time.

The trophy is the daily emotional payoff for keeping the macro goal. The
analytics are the longer-term evidence that the user's discipline is changing.
Both should be driven by the same locally calculated Daily Target result so a
streak and a chart can never contradict each other.

### Daily Review and Drill-down

The end-of-day report is a reflective, interactive explanation of a day, not a
generic chart screen. Its purpose is to help a person make a better next plan:
where did time actually go, where did it differ from the plan, and which future
Session or group deserves a change?

The report opens at the global day level:

- actual total phone time compared with the Daily Target, tolerable zone, and
  Essential-only threshold;
- Daily Target trophy or streak result;
- a color view of actual time by top-level group; and
- a short evidence-based review of what most affected the day, such as an
  Evening Session that exceeded its plan, a group that used more than its
  allowance, or time spent in an unbounded `No limit` rule.

From there, the user drills down without losing the context of the day:

1. Tap a Session to see its actual use alongside its planned rules and group
   composition.
2. Tap a group inside that Session to see the contributing apps and their use.
3. Return to the day to compare a different Session or group.

The report must distinguish a planned maximum from actual use. It should never
claim a person failed merely because a Session had a large allowance. It names
an overage only where actual use crossed a meaningful plan boundary or where an
unbounded rule made the time intentionally unplanned.

Long-term analytics are intentionally lighter than a daily review. Their job is
to make change visible at a glance, not to expose every Session and app from
months ago. The main historical view shows only the useful high-level answers:

- average daily phone time and its direction since Focus began;
- Daily Target and trophy consistency over recent days; and
- a selectable group trend, for example Social, Work, Games, or News across
  recent days and months.

A person can select a day to open its detailed Daily Review. The current month
may show days individually; earlier history collapses into readable monthly
summaries. Historical group views are aggregate, visual, and scannable. They
do not default to a deep app-by-app or Session-by-Session data explorer.

Focus persists only the small derived records it needs for this experience:
daily totals, group aggregates, Daily Target result, trophies, and plan or
threshold metadata. Detailed per-app and per-Session inspection stays inside
the native report for a chosen day, instead of becoming an ever-growing raw
usage archive.

### Analytics native boundary

Detailed app, category, and web-domain reporting is rendered through a native
Device Activity Report extension. Apple provides that extension privacy-
preserving activity data and requires the report UI to remain inside its native
sandbox. The detailed report therefore belongs to a native SwiftUI analytics
surface embedded in Focus, rather than exporting raw usage records to React
Native or a server. Focus can store its own plan snapshots, Session boundaries,
threshold events, trophies, and explanatory metadata alongside that native
report.

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
- If a lower-level group or app limit becomes ineligible, Focus updates that
  streak silently. It does not interrupt the user with the same large warning.
- Increasing a limit never restores a streak that was already lost earlier in
  the day.
- Essential Apps are a safety allowlist, not a behavioral target, so editing
  them does not affect streak eligibility.

## Native Enforcement Requirements

- Phone Plans require Apple's Screen Time frameworks: Family Controls,
  Managed Settings, and Device Activity.
- The user must grant Screen Time authorization before a plan can enforce app
  restrictions.
- The native layer must apply the Daily Target, Daily Plan group and app
  limits, and the active Session's group and app rules while Anasta is closed.
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
  EU devices with EU Apple Accounts.
- At each Session boundary, native enforcement must atomically replace the
  prior Session's restrictions with the next Session's restrictions. A Strict
  block that belongs to the prior Session must end only when the next Session's
  configured rule takes over; there can be no unprotected gap between them.
- The system needs a user-visible state for missing or revoked authorization;
  an unprotected plan must never be presented as active protection.
- Time calculations use the phone's local time and must recalculate when its
  time zone changes.

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
