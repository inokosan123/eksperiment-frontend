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

### Why this boundary matters

The Focus tab must not become a pile of independent blocker tools. A Christian
user should be able to answer one simple question: "How do I want to use my
phone today?" Phone Plans answer that question. Clean Sight answers a different
one: "What content do I not want to have available to me at all?"

Pomodoro already serves deliberate focused work inside Inner Life. It must not
be represented as a protection plan, a session, or a phone-use limit.

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

The user selects the apps that remain available in Essential-only mode. The
setup must explain plainly that these are apps they still need when the rest of
the phone is protected, for example Phone, Messages, Maps, banking, an
authenticator, or another personally necessary app.

Essential Apps are a user-owned allowlist, not an Anasta-controlled list. The
setup can suggest common examples, but it must make clear that each person is
responsible for choosing the apps they genuinely need available during strong
protection. This prevents the global target from becoming impractical or unsafe
for ordinary life.

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

## Daily Limits

- Users can set daily limits for a group and for an individual app.
- A group limit is a shared daily budget for the apps inside that group.
- An app limit is the maximum daily use of that specific app.
- The most restrictive active rule always wins.

Daily limits are enforceable boundaries, unlike the Daily Target which begins
as a goal and only becomes a broad protective action at the Essential-only
threshold. Keeping those concepts separate makes the product easier to trust:
a user can see whether they are looking at a goal, a group budget, an app cap,
or a currently active session restriction.

Example: Instagram has a 45-minute daily limit, Social has a 60-minute shared
limit, and the current session blocks Social. Instagram is blocked during that
session even if neither daily budget has been spent.

When an app and its group both have remaining time, the app becomes unavailable
as soon as either its individual budget or its group's shared budget is used.
The product never adds the two allowances together. This is important because a
group budget exists to prevent moving compulsive use from one social app to
another.

## Intentional Use Check-ins

An app with a daily limit can also have an Intentional Use Check-in. The
standard cadence is every 15 minutes of use.

This is a soft boundary, not the final daily limit. Its purpose is to interrupt
autopilot use before a person loses awareness of time. A person can open a
social app with a genuine intention and then slip into scrolling without
noticing that 20 or 30 minutes have passed. The check-in makes that moment
visible again and gives the person a deliberate choice.

Example: Instagram has a 45-minute daily limit and a 15-minute check-in.

1. At 15 minutes of use, Focus displays a gentle shield moment.
2. The person chooses to leave the app or consciously continue for another
   15 minutes.
3. If they continue, the next check-in arrives at 30 minutes of total use.
4. At 45 minutes, the app reaches its final daily boundary and follows the
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

Every final daily boundary has a protection strength:

- Loose: when the daily limit is reached, the shield offers a deliberate
  additional 15-minute window or an exit from the app.
- Strict: when the daily limit is reached, the app remains protected for the
  remainder of the active day or active session. No continuation is offered on
  the shield.

For example, a 45-minute daily Instagram limit can have 15-minute check-ins at
15 and 30 minutes, then become Strict at 45 minutes. The soft check-in and the
final strength solve different problems and can work together in the same rule.

## App Groups

- Focus provides useful default groups, such as Social, Video & Entertainment,
  Games, News, Work, and Essentials.
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

## Session Plans

- Sessions are time ranges within the one active day, for example Morning,
  Work, Evening, and Night.
- Each session can set different use rules for the existing groups and apps.
- A session changes the rule for an existing group or app; it does not require
  the user to select all of the apps again.
- The session-specific rule and the daily rule work together. The more
  protective result applies.

At a session boundary, the rules change immediately to the rules of the next
session. There is no interim state where both sessions are active and no gap in
which a protected app becomes accidentally available. This needs to be true in
the UI and in the native monitor schedule.

### Rule-resolution order

For any attempted app use, Focus resolves access in this order:

1. If the Essential-only threshold is active and the app is not in Essential
   Apps, protect the app.
2. If the current session blocks the app or its group, protect the app.
3. If the app's individual daily limit is exhausted, protect the app.
4. If the app's group daily budget is exhausted, protect the app.
5. Otherwise, allow the app under the remaining active limits.

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

## Native Enforcement Requirements

- Phone Plans require Apple's Screen Time frameworks: Family Controls,
  Managed Settings, and Device Activity.
- The user must grant Screen Time authorization before a plan can enforce app
  restrictions.
- The native layer must apply the Daily Target, group limits, individual app
  limits, and session rules while Anasta is closed.
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
