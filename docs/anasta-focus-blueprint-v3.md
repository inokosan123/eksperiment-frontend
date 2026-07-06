# Anasta — FOCUS Tab Blueprint (v3) — "Day Plan" Redesign

Status: **agreed direction, 2026-07-06.** Supersedes v2 entirely. This document is the single
source of truth for the FOCUS tab redesign and is written so that any model/agent
(Fable, Opus, Codex) can execute it without further context.

Hard rules (unchanged from v2):
- This is **NOT** the Pomodoro feature. `app/focus-zone.tsx` / `components/focus/` stay untouched.
- All work lives in `components/focus-watch/` + its routes. Zero shared state with Pomodoro.
- Never touch `C:\Users\User\Desktop\Daily-Christian` (read-only reference only).
- Workflow per phase: edit → `npx tsc --noEmit` → `git add` → commit → push → user tests on device.
- Reanimated for interactions; Lottie decorative only; spring tone `damping:15, stiffness:160, mass:1`;
  **no `transform: scale` animations on small Android views** (bitmap pixelation).
- Visual language: warm white (`C.bg`), EB Garamond serif, gold accents. No dark theme, no cyber look.

---

## 1. The Big Cut — what the tab IS now

FOCUS = **"two features, but rich"** (user's words):

1. **APP BLOCKING → "Day Plan"** — you *plan your phone* the way you plan your tasks:
   the day is split into named zones, groups of apps have daily limits, plans are
   assigned to weekdays. Keeping the plan earns a daily **trophy**.
2. **WEBSITE BLOCKING → "Clean Sight"** — always-on purity protection: packs + custom
   domains + Never Allowed + locks. **No day planning here** ("blocked is blocked").
   Strong Mode (DNS-level, v2) is designed in from day one as the future top tier.

### Killed concepts (do NOT resurrect)
| Killed | Why | Replaced by |
|---|---|---|
| "Watch" (name + concept) | user rejected the name; zones express the same thing | Plan zones |
| UPCOMING list on landing | watches died | Day Plan hero card meta |
| Per-watch streaks/flames + `watchHistory.ts` fake history | fake data; per-plan streaks confuse | One day-trophy system |
| `WatchStatsSheet` per-plan calendar | same | `TrophyCalendarSheet` (one, global) |
| Simple Phone (screen + landing card + allowlist mode) | weakest feature, overlaps zones | — (maybe a preset much later) |
| Strict Watch as its own screen | not a feature, it's a lock layer | "Locks" section inside Clean Sight |
| Never Allowed as its own screen | near-duplicate of Clean Sight | merged into Clean Sight screen |
| Per-zone minute budgets | rollover confusion + iOS reality | day-level limits + zone closures |
| Live global budget machine | Apple sandbox makes real math impossible on iOS | wizard does math at planning time |
| Productive/malignant taxonomy | groups already do the job | apps not in limited groups are simply free |
| Daily "Congratulations" popup | daily ceremony = spam by day 4 | milestone ceremony at 7/30/100 |

### Deferred (design later, do not build now)
- **Anasta "Ustani" (Rise) screen** — encouragement after real falls. Deferred by user
  decision (2026-07-06): it must be designed together with task-failure encouragement
  as ONE cross-feature system. Leave a hook (`onStreakReset`) but no UI.
- **Strong Mode (DNS filtering)** — v2. iOS: DNS-profile filtering is App Store-legal
  (Purge, CleanBrowsing model); NOT full VPN packet filtering (MDM-only). Android:
  VpnService + Play declaration form. Requires filter infrastructure (cost). Ship a
  designed teaser card now, real thing after native Phase 2.
- Fasting-day auto plans (Wed/Fri/Lent via Orthodox calendar) — v1.5, design plan
  switching so this slots in.
- Remote-updatable web pack lists (needed before "…and 400+ more" copy is honest —
  until then soften the claim).
- DeviceActivityReport embedded charts (iOS) — post-MVP.

---

## 2. Core model

```ts
// ---- groups --------------------------------------------------------------
// Reuse APP_CATEGORIES (social, entertainment, games, news, shopping, dating)
// + custom groups (existing CustomGroup). "Leisure groups" = all of these.
// Apps NOT selected into any limited group are invisible to the blocker →
// Gmail/Phone/Messages are never interrupted. No productivity taxonomy.

export type GroupRule = {
  groupId: string;                 // category id or custom group id
  dailyMinutes: number | null;     // null = no time limit (zone closures may still apply)
  strength: 'loose' | 'strict';    // per-group (user decision)
  practice: PracticeKind;          // per-group return practice, default 'prayer'
};

export type PlanZone = {
  id: string;
  name: string;                    // user-editable; defaults: Morning / Day / Evening / Night
  startMinutes: number;            // 0..1439
  endMinutes: number;              // endMinutes <= startMinutes ⇒ wraps past midnight
  closedGroupIds: string[];        // groups FULLY closed during this zone
};

export type DayPlan = {
  id: string;
  name: string;                    // "Work Plan", "Weekend"…
  zones: PlanZone[];               // 1..4, non-overlapping (circular check), gaps = open time
  rules: GroupRule[];              // day-level quantities + strength + practice
  createdAt: number;
  updatedAt: number;
};

// Monday-first day indexing (0 = Mon … 6 = Sun) — matches the rest of the app.
export type WeeklySchedule = (string | null)[];  // length 7; planId or null = unprotected day

export type QuietHourSession = {                 // replaces ActiveWatchSession
  startedAt: number; endsAt: number; totalMs: number;
  strength: 'loose' | 'strict';                  // default strict
  closedGroupIds: string[];                      // default: ALL leisure groups
};

export type OpenDoor = {                         // timed unlock after a return practice
  groupId: string;
  endsAt: number;                                // 5/10/15 min chosen in intervention
};

export type FocusEventKind =
  | 'attempt'          // shield shown (native later; mock: intervention opened)
  | 'returned'         // user chose Turn back
  | 'door_opened'      // entered after practice (loose) → violation
  | 'limit_exceeded'   // daily minutes crossed → violation
  | 'zone_breach'      // entered closed-zone group → violation
  | 'plan_swapped'     // never a violation (user decision)
  | 'quiet_started' | 'quiet_ended';

export type FocusEvent = {
  id: string; ts: number; kind: FocusEventKind;
  groupId?: string; planId?: string; meta?: Record<string, unknown>;
};

export type DayRecord = {
  date: string;                    // 'YYYY-MM-DD'
  planId: string | null;           // null ⇒ unprotected day
  status: 'pending' | 'kept' | 'broken' | 'off';
  violations: number;
};
```

### Rules engine (exact semantics — implement precisely)

**Violation** (loses today's trophy, immediately):
1. a group's `dailyMinutes` is exceeded (`limit_exceeded`),
2. entering a group while a zone closes it (`zone_breach`),
3. entering through the **loose door** after completing a practice (`door_opened`).

**NOT violations:** "Turn back" (celebrated as a returned moment), **plan swaps at any
time in any direction** — user's explicit decision (2026-07-06): switching to a looser
plan mid-day keeps trophy eligibility; only actual violations break the day.

**Day resolution** (run at first store init of a new local day, and on midnight tick):
- yesterday `pending` + plan assigned + 0 violations → `kept` (+1 trophy)
- yesterday `pending` + violations > 0 → `broken`
- no plan assigned → `off` (neutral)

**Merciful streak** (user decision):
- streak = consecutive kept days, **ignoring `off` days** (off never breaks, never adds)
- ONE `broken` day → black X in calendar, **streak survives** (gap)
- TWO consecutive `broken` days → streak resets to 0 (fire `onStreakReset` hook — no UI yet)
- track: `currentStreak`, `bestStreak`, `totalTrophies`

**Milestones:** big congratulations overlay ONLY when `currentStreak` reaches **7, 30, 100**
(each shown once per achievement — persist shown-set in meta). Trophy Lottie plays there.
Daily kept days land silently in the calendar. Any research stats used in encouragement
copy must be real and verified before ship (e.g., Lally 2010 habit-formation, "never miss
twice") — **no invented numbers.**

**Live day state** (NOW panel): `kept-so-far` | `broken` | `off` | `quiet-hour` | `door-open`.
Progress ring = fraction of today elapsed, gold while kept; on violation the ring stops
filling, turns muted, and a **red X badge** appears (user decision).

### Calendar marks (user decision)
- kept day → **small golden trophy** (reuse `ChallengeTrophyAnimation` /
  `CHALLENGE_TROPHY_SOURCE` from `components/challenges/ChallengeTrophy.tsx`; static
  frame in grid, animated on tap)
- broken day → **black ✕**
- off day → gray empty circle
- future → faint dot

---

## 3. Persistence (Phase A — no more in-memory-only)

New file `components/focus-watch/focusWatchDb.ts` following the exact pattern of
`components/focus/focusDb.ts` (expo-sqlite via `openUserContentDb()` from `@/data/userContentDb`):

```sql
CREATE TABLE IF NOT EXISTS focus_watch_plans (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  zones_json TEXT NOT NULL, rules_json TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS focus_watch_schedule (
  day INTEGER PRIMARY KEY, plan_id TEXT);              -- 0=Mon … 6=Sun
CREATE TABLE IF NOT EXISTS focus_watch_days (
  date TEXT PRIMARY KEY, plan_id TEXT, status TEXT NOT NULL,
  violations INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS focus_watch_events (
  id TEXT PRIMARY KEY, ts INTEGER NOT NULL, kind TEXT NOT NULL,
  group_id TEXT, plan_id TEXT, meta_json TEXT);
CREATE INDEX IF NOT EXISTS idx_focus_watch_events_ts ON focus_watch_events(ts);
CREATE TABLE IF NOT EXISTS focus_watch_meta (key TEXT PRIMARY KEY, value TEXT);
-- meta keys: quiet_session, open_door, purity_state, locks_state, custom_groups,
--            streak_cache, milestones_shown, permission_status, pending_change
```

Store: new `components/focus-watch/dayPlanStore.ts` — same `useSyncExternalStore`
public-hook pattern as today (screens call `useDayPlan()` + action functions). Hydrate
from SQLite on first subscribe; every mutation writes through. Keep the store the ONLY
writer. `pendingChange { effectiveAt }` lives here for lock cooldowns (weakening a rule
under Strict Locks takes effect only after the cooldown).

Phase-2 note (unchanged): iOS enforcement maps zones → `DeviceActivitySchedule`
intervals and limits → daily thresholds (+ optional 50/80% checkpoints for coarse
"near limit" display — iOS cannot expose exact minutes to our code; Android can via
UsageStats). Only **today's resolved plan** is compiled to the system, never all plans.

### Defaults seeded on first run
- Plan "Weekdays": zones Morning 06:00–09:00 (social+news closed), Evening 21:00–23:00
  (social+entertainment+games closed), Night 23:00–06:00 (all leisure closed);
  rules: Social 45m loose/prayer, Entertainment 45m loose/prayer, Games 30m loose/prayer.
- Plan "Weekend": Night zone only (23:30–07:00 all closed); Social 90m, Entertainment 90m.
- Schedule: Mon–Fri → Weekdays, Sat–Sun → Weekend. (User edits everything.)

---

## 4. Screen map & specs

```
(tabs)/focus                 FOCUS landing (rebuilt)
 ├─ /day-plans               Day Plan hub: weekly strip + plan cards        [NEW]
 │   └─ /day-plan?planId=…   Plan editor: zones + group rules + wizard     [NEW, replaces /watch-plan]
 ├─ /clean-sight             Purity: packs + domains + Never Allowed +
 │                           Locks + Strong Mode teaser                    [MERGED]
 └─ /focus-intervention      Return practice player (kept, + 5/10/15)
DELETED ROUTES: /protect-time, /watch-plan, /never-allowed, /strict-watch, /simple-phone
```

### 4.1 Landing `FocusWatchView` (rebuild)

```
        F O C U S
 "Be sober, be vigilant; …"        ← 1 PETER 5:8 (v2 decision restored;
        1 PETER 5:8                   Matthew 26:41 belongs to shield/intervention ONLY)

┌ TODAY ────────────────────────────┐
│ TODAY · WORK PLAN        ● KEPT   │  ← plan name + live day state
│     [GuardedPhone + day ring]     │  ← reuse GuardedPhone `progress` ring =
│   "Evening — social is closed."   │     day elapsed, gold while kept;
│  Social ●●○ · Games ●○○ · Ent ●○○ │     violation ⇒ ring muted + red ✕ badge
│  [        Quiet Hour        ]     │  ← panic button (GoldButton)
├───────────────────────────────────┤
│ 🏆 12 trophies · 5-day streak  ›  │  ← strip → TrophyCalendarSheet
└───────────────────────────────────┘

┌ APP BLOCKING ─────────────── ↗ ┐   hero card 1 → /day-plans
│ Day Plan                        │   meta: "Today: Work Plan · Next zone: Evening 21:00"
│ Plan your phone like your day.  │   + mini week strip M T W T F S S (dots = plan assigned)
└─────────────────────────────────┘
┌ WEBSITE BLOCKING ──────────── ↗ ┐   hero card 2 → /clean-sight
│ Clean Sight                     │   meta: "2 packs · 4 sites · locks on"
└─────────────────────────────────┘
```

NOW panel states (exactly five): `off-day` (quiet copy "No plan guards today." +
Quiet Hour + link to weekly schedule) · `kept-so-far` (above) · `broken` (ring stopped,
red ✕, honest-but-merciful copy: "Today broke. Tomorrow is a new page." — no shame
language) · `quiet-hour` (countdown, +15, end-early per strength — current ActiveState
pattern) · `door-open` ("Door open · 4:12 left · [Close now]" → relock = end OpenDoor).

Design-quality goals for the rebuild (user asked for a visual step UP):
- **Kill the chip soup.** Max ONE tag row per row/card; whole words, no 8.5px micro-text
  walls. Limits shown as calm dot-meters (●●○), not 5 chips.
- One hero moment per screen (GuardedPhone + ring); everything else quiet.
- Week strip and zone timeline reuse the task-planner visual grammar (same as
  `WeeklyPlannerView` feel) so the app reads as one system.

### 4.2 Day Plan hub `/day-plans` → `DayPlanHubView` [NEW]

- Header THIS WEEK: 7-day strip (M…S), each day shows assigned plan name (tap → picker:
  any plan / "No plan"). Today highlighted. This IS the weekly schedule editor.
- **Swap today**: today's cell offers "Switch today's plan" — takes effect immediately,
  logs `plan_swapped`, trophy eligibility untouched.
- PLANS section: one card per plan — name, zone summary ("3 zones · night closed"),
  rules summary ("Social 45m · Games 30m"), assigned-days dots. Tap → editor.
  Dashed "New plan" card. Plans have no enabled switch — assignment to days is what
  activates them (delete guarded by ConfirmModal; if assigned, reassign those days to null).
- Footer note: honest Phase-1 copy ("Blocking becomes real once the Screen Time
  permission arrives — shape your plans now.")

### 4.3 Plan editor `/day-plan?planId=…` → `PlanEditorView` [NEW]

Sections (GroupCard grammar, FadeInDown entrances like today):
1. **NAME** — text input (required, ≤28 chars).
2. **ZONES (1–4)** — horizontal 24h **timeline bar** showing zones as colored segments
   (gaps = open). Below: one row per zone (name · time range · closed-group chips) →
   tap opens `ZoneEditorSheet`: name, start/end via existing `TimeWheelSheet`,
   closed groups via `AppPicker`. "+ Add zone" (max 4). Validation: no overlap
   (circular/overnight aware — reuse v2 overnight math), start ≠ end.
3. **DAILY LIMITS** — one row per leisure group: group name · minutes stepper/wheel
   (15-min steps, "No limit" option) · Loose/Strict segmented toggle · practice picker
   (existing RETURN_PRACTICES rows, collapsed to a small selector). Custom groups
   manageable here (reuse AppPicker manageGroups).
4. **WIZARD** (entry button "Help me plan" — also auto-offered on first-ever plan):
   sheet asks "How much leisure time per day?" (chips 1h/1.5h/2h/3h/custom) → proposes
   a per-group split → user drags/adjusts → writes `dailyMinutes` per group. Pure
   planning-time math, NO live budget tracking afterwards.
5. Footer: Save (GoldButton) / Remove plan.

### 4.4 Quiet Hour → `QuietHourSheet` (refactor of `QuickWatchSheet`)

One-tap panic: duration chips (15/30/45/60/90/120/180) · strength (default **Strict**)
· closes ALL leisure groups by default with a collapsed "Adjust what's closed" AppPicker
for the rare case. Editing an active loose session stays (current behavior). Rename all
copy: "Quiet Hour" / "Begin the Quiet Hour".

### 4.5 Clean Sight `/clean-sight` → `PurityView` (merge) 

Order: intro ("Close the door on what wounds the eyes.") → Lottie →
1. **PROTECTION PACKS** — existing `WebPackCard` list (gambling/adult/social/news).
   Each pack card gains a **"Never" toggle row inside the expanded card**: marking a
   pack Never = permanent, no unlock path (replaces the separate Never Allowed packs
   duplication — one list, one mental model).
2. **CUSTOM WEBSITES** — existing input + list; each domain row has a small
   lock glyph toggle: normal ⇄ **never** (never = red-tinted row, removal requires
   ConfirmModal + respects lock cooldown).
3. **LOCKS** (absorbed Strict Watch): master switch + cooldown chips (10m/1h/morning)
   + uninstall protection + deny new installs. Weakening anything while Locks on ⇒
   `pendingChange` with `effectiveAt` (banner: "Takes effect tomorrow morning").
4. **STRONG MODE** — designed teaser card (v2): "System-deep filtering that also covers
   links inside apps. Coming with the next foundation." — muted, honest, no fake toggle.
5. Footnote: honest capability copy; replace "…and 400+ more, updated by us" with
   "…a curated list we keep growing" until remote lists exist.

Websites have **no day planning and no trophy interaction** — purity is binary and
always-on (user decision).

### 4.6 Intervention `/focus-intervention` (small upgrade)

Keep practice player + Turn back. Changes:
- "Enter for 5 minutes" → three ghost options **5 / 10 / 15 min** → creates `OpenDoor`,
  logs `door_opened` (violation), navigates back. NOW panel shows door-open state;
  expiry or "Close now" clears it (re-shield in native phase).
- Strict groups: no enter options at all ("This door stays closed today.").
- Never-marked packs/domains: intervention unreachable (no unlock path).
- Verse here stays **Matthew 26:41**.

### 4.7 Trophy analytics → `TrophyCalendarSheet` [NEW, replaces WatchStatsSheet]

SmoothBottomSheet: header "Your days" · stat row: current streak / best streak / total
trophies · month grid (marks per §2) with chevron month nav (bounded by first record) ·
legend (trophy = kept, ✕ = broken, ○ = off) · small encouragement line rotating
verified consistency facts. `MilestoneCongratsOverlay` [NEW]: full-screen moment with
`ChallengeTrophyAnimation` at streak 7/30/100 (pattern-match `ChallengeCompletionHomeModal`).

### 4.8 My Routine bridge (LIGHT, info-only — user decision)

In `components/routine/MyRoutineView.tsx`, at the bottom of the day view: one compact
card "Phone · Monday — Work Plan ›" (icon + plan name for the viewed weekday, from
`WeeklySchedule`). Tap → `router.push('/day-plans')`. **No functional coupling, no
shared state writes — read-only lookup.** Keep the edit tightly scoped; nothing else
in routine changes.

---

## 5. Carried-over fixes folded into this work
- `selectionTagLabels` must resolve app/group **names** (`appName()`, custom-group name),
  never raw ids (Phase A, in new store helpers).
- One time formatter, **24h everywhere** (kill locale `formatEndsAt` drift).
- Zone/time validation: start ≠ end; overlap check.
- Shared `usePermissionGate()` hook replacing the 6× duplicated
  ScreenTimePermissionModal ritual (Phase B; screens adopt as they're rebuilt).
- Landing quote back to 1 Peter 5:8 (v2 Decisions Log said so; code drifted).
- Empty-state copy never repeats itself.

## 6. Build phases (each = compiling app, commit + push, device-checkable)

**Phase A — Foundation (no visible change).**
`focusWatchDb.ts` + `dayPlanStore.ts` (types, hydration, actions, day resolution,
streak math, event journal, defaults seeding, quiet hour, open door, purity/locks state,
pendingChange). Old `focusWatchStore.ts` untouched — new store built alongside.
✔ tsc clean; unit-testable pure functions for streak/day resolution kept in store file.

**Phase B — Landing rebuild.**
New NowPanel (5 states, day ring on GuardedPhone, trophy strip) + QuietHourSheet rename
+ hero cards (Day Plan / Clean Sight meta) + `usePermissionGate` + **delete Simple Phone
route/card/view + GuardRows**. Landing no longer imports old store.
✔ Landing runs fully on new store.

**Phase C — Day Plan hub + editor.**
`DayPlanHubView` (+ route `/day-plans`), `PlanEditorView` (+ route `/day-plan`),
`ZoneEditorSheet`, limits rows, wizard sheet. **Delete** `/protect-time`, `/watch-plan`,
`ProtectTimeView`, `WatchPlanEditorView`.
✔ Create/edit/assign/swap plans end-to-end on device (mock enforcement).

**Phase D — Trophy engine surfaces.**
`TrophyCalendarSheet`, `MilestoneCongratsOverlay`, NOW wiring of live day state,
violation simulation via intervention (mock), `onStreakReset` hook stub.
✔ Kept/broken/off days render correctly across month boundaries; milestones fire once.

**Phase E — Clean Sight merge.**
`PurityView` (packs + never toggles + domains + locks + Strong Mode teaser + honest copy).
**Delete** `/never-allowed`, `/strict-watch`, `NeverAllowedView`, `StrictWatchView`.
✔ Never entries survive restart; lock cooldown produces pendingChange banner.

**Phase F — Intervention + bridges + cleanup.**
5/10/15 open door + NOW door-open state + My Routine info card + **final deletion**:
`focusWatchStore.ts`, `watchHistory.ts`, `WatchStatsSheet.tsx`, `StreakFlame.tsx`,
`SimplePhoneView.tsx` remnants, dead exports in `focusContent.tsx`. Copy pass (verses,
honest claims, EN strings). ✔ `grep -r "watch" components/focus-watch` returns only
file-name legacy (folder name stays `focus-watch/` — renaming the folder is churn
without user value).

**Phase 2 (native, unchanged from v2 §2):** Screen Time entitlement + dev build; compile
today's plan to DeviceActivity schedules/thresholds; shield config; Android
UsageStats/foreground engine; then Strong Mode spike.

## 7. Decisions log (all confirmed by user)
- 2026-07-05: two pillars; web blocking is where we out-deliver competitors; VPN-level valued.
- 2026-07-06: Simple Phone OUT now. VPN = v2 after basic blocking (feasibility verified:
  iOS DNS-profile path is App Store-legal; Android VpnService + declaration).
- 2026-07-06: Day sections (1–4 named zones, custom hours) replace watches entirely;
  weekly plan assignment like the task planner; **"watch" name dead**.
- 2026-07-06: Day-level limits + zone closures (no per-zone budgets); wizard math at
  planning time only; per-group strength + practice.
- 2026-07-06: **Plan swaps never cost the trophy, in any direction** (user overrode
  the gameability objection — recorded as accepted risk).
- 2026-07-06: Trophy daily in calendar (gold mini trophy / black ✕ / gray ○);
  live day = filling ring, violation = immediate red ✕ + stop; congratulations ONLY
  at 7/30/100; trophy count tracked; reuse challenge trophy animation.
- 2026-07-06: Merciful streak (1 miss survives, 2 consecutive reset); off days neutral;
  encouragement copy uses only verified research; **Anasta "Ustani" screen deferred**
  (future cross-feature system with tasks).
- 2026-07-06: Names: **Day Plan** (APP BLOCKING) + **Quiet Hour** (panic) + Clean Sight
  (WEBSITE BLOCKING). Zone defaults Morning/Day/Evening/Night.
- 2026-07-06: Trophy/progress widget lives **only in the Focus tab** (Home & Journal untouched).
- 2026-07-06: My Routine gets an info-only card linking to Day Plans (light bridge).
