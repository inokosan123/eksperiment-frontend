# Anasta — FOCUS Tab Blueprint (v2)

Status: agreed direction after discovery (2026-07-01). Supersedes the v1 "guards" blueprint entirely — the guard metaphor, dark aesthetic, and Sacred Silence notification pillar are dropped.

Hard rule: this is **not** the Pomodoro feature. `app/focus-zone.tsx` / `components/focus/FocusZoneView.tsx` stays untouched and will later be renamed "Pomodoro". The new FOCUS tab is a brand-new product pillar: **app blocking + website blocking with a prayer-first return flow**. Separate route, separate component folder (`components/focus-watch/` or similar), zero shared state with the Pomodoro screen.

---

## 1. Positioning

- FOCUS becomes the **4th tab**: `app/(tabs)/focus.tsx`, added to `TABS` in `app/(tabs)/_layout.tsx` (needs a new icon in `components/icons/Icons.tsx` — shield or lamp/candle silhouette, stroke style matching Home/Book/Heart).
- Tab pattern identical to the others: `ScreenTitleBar title="FOCUS"` + centered Bible quote + content below.
- The other tabs are *productivity tools*; FOCUS is *the tool that protects them* — blocking addictive content, reclaiming screen time, and turning temptation moments into prayer/Scripture moments.

Quote under the title (**DECIDED**):

> "Be sober, be vigilant; because your adversary the devil, as a roaring lion, walketh about, seeking whom he may devour."
> **1 PETER 5:8**

Rendered with the exact Inner Life pattern (`quote` serif-medium-italic 17 centered, gold `ref` caption). Matthew 26:41 ("Watch and pray…") is reserved for the shield subtitle / intervention screen copy.

---

## 2. Technical Reality (what Apple allows)

One system powers everything: the **Screen Time stack** — the same one Opal/Jomo/one sec use.

| Capability | API | Verdict |
|---|---|---|
| Block selected apps/categories | FamilyControls + ManagedSettings shield | ✅ Yes |
| Private app selection (we never see app names) | FamilyActivityPicker | ✅ Yes (tokens are opaque) |
| Block websites/domains **across browsers** (Safari, Chrome, etc.) | ManagedSettings `WebContentSettings.FilterPolicy` | ✅ Expected — MUST verify on device before marketing "all browsers" |
| Apple's automatic adult-content web filter | `FilterPolicy.auto()` | ✅ Yes |
| Schedules / timed sessions / usage limits | DeviceActivity monitor extension | ✅ Yes |
| Branded block screen (shield) | ShieldConfiguration extension: icon, title, subtitle, 1–2 buttons, button color, bg blur/color | ✅ Yes, but limited — no custom layout, no timers, no rich UI |
| Shield button opens Anasta | ShieldAction extension → `.defer` / open-parent-app response | ✅ Yes — this is the hinge of Prayer Unlock |
| Prevent uninstalling Anasta | ManagedSettings `application.denyAppRemoval` | ✅ Yes (while our restriction is active) |
| Prevent installing new apps | ManagedSettings `application.denyAppInstallation` | ✅ Yes |
| Usage stats for Review screen | DeviceActivityReport extension | ✅ Yes (data stays sandboxed; report UI renders inside Apple's frame) |
| Turn off other apps' notifications / trigger iOS Focus | — | ❌ No. Feature dropped. |
| Filter content *inside* Instagram/TikTok | — | ❌ No — only whole-app blocking |
| DNS-level blocking | NetworkExtension (DNS proxy / content filter) | ⚠️ Deferred — extra entitlements, App Review risk, some modes supervised-only. Post-MVP spike as "strong mode", never the foundation |
| Block ads in Safari | Safari Content Blocker | ⚠️ Optional later, Safari-only |

**Permissions:** one Family Controls entitlement (must be requested from Apple per bundle ID + each extension target), one `AuthorizationCenter.requestAuthorization(for: .individual)` prompt for the user. That single grant covers app blocking, web blocking, shields, and schedules.

**Build reality:** requires a custom dev client / EAS build with native targets (main app + 3–4 extensions). Not possible in Expo Go. Candidate shortcut: `react-native-device-activity` (Kingstinct) Expo config plugin — verify it covers WebContentSettings + deny-removal before committing to it. Phase 1 (UI) needs none of this.

---

## 3. Core Model: the Watch Plan

Everything reduces to one object. A **Watch Plan** answers five questions:

1. **What** — apps / categories / websites (FamilyActivityPicker + domain lists)
2. **When** — always-on, right now for N minutes, recurring schedule, or after a usage limit
3. **Strength** — `Loose` (Apple-style: warning, can continue) or `Strict` (must complete a Return Practice in Anasta to unlock)
4. **Return Practice** — what the shield invites you to do: short prayer / Jesus Prayer timer / a Psalm / a Bible chapter / written intention
5. **Anti-bypass** — cooldown on edits, uninstall protection, deny app installs, (later) accountability contact

Never Allowed, Quick Watch, Allowlist Mode, Strict Watch are **not separate features** — they are preset shapes of a Watch Plan:

- **Never Allowed** = Watch Plan with When=always, Strength=strict, no unlock. (gambling, adult)
- **Quick Watch** = one-tap Watch Plan: default block set, 30/60/120 min.
- **Allowlist Mode** = inverted What: block everything except Phone, Messages, Maps, Anasta… ("simple phone")
- **Strict Watch** = the anti-bypass layer toggled onto any plan.

## 4. Feature Groups

### A. Protect Time (app blocking) — hero feature
- Block selected apps/categories via Apple picker (privacy note: "Your selection never leaves this phone.")
- Sessions: now (15/30/60/custom), recurring schedules (Morning, Work, Evening, Night, Sunday), usage limits (e.g. Instagram after 10 min)
- Quick Watch one-tap start
- Allowlist Mode as a special session type
- Timed unlock (5/10/15 min) after completing a Return Practice, then re-shield + re-intervention on the next attempt

### B. Clean Sight (website blocking)
- Preset packs: Gambling, Adult (Apple auto-filter + curated list), Social web, News/doomscroll
- Custom domains
- Never Allowed domains (permanent)
- Honest copy: system-level blocking across browsers; in-app ads/content inside social apps can't be filtered

### C. Return Practices (the Anasta moat — shared by A & B)
Shield → "Pray first" → opens Anasta intervention screen → practice → unlock or turn back.
Practices reuse existing app content: Prayer Book prayer, Jesus Prayer timer (`app/jesus-prayer.tsx` flow), random Psalm, Scripture passage/chapter (`scripture-reader`), written intention ("Why am I opening this?"), or simply "Turn back" (no unlock, counted as a returned moment).

### D. Strict Watch (lock layer, applies to any plan)
- Cooldown before rule changes (10 min / 1 h / next morning — impulse protection)
- Uninstall protection (deny app removal)
- Deny new app installation (blocks re-downloading betting apps)
- Limited unlocks per day
- Later: accountability contact approves weakening; passcode

### E. The Watch / Review (post-MVP)
Quiet stats, no gamified shame: attempts interrupted, prayers offered, time returned, hardest hours. DeviceActivityReport extension.

---

## 5. Screen Map

```
(tabs)/focus  ── FOCUS landing
 ├─ watch-plan editor (sheet/page: what → when → strength → practice)
 ├─ protect-time screen   (sessions list, schedules, allowlist mode)
 ├─ clean-sight screen    (preset packs, custom domains, never-allowed web)
 ├─ never-allowed screen  (permanent list, apps + domains)
 ├─ strict-watch settings (cooldown, uninstall/install protection)
 ├─ intervention screen   (opened FROM shield: practice player + unlock choice)
 └─ review screen         (later)
```

### Landing layout (**DECIDED — hybrid of "chapel lamp" and Opal "Blocks" list**)

```
        F O C U S
 "Be sober, be vigilant; because your adversary the devil,
  as a roaring lion, walketh about, seeking whom he may devour."
        1 PETER 5:8

┌──────────────────────────────────┐   NOW panel ("chapel lamp")
│ NOW                   ● active   │   quiet state: "All is quiet." +
│ Evening Watch                    │   [Begin a watch] + Quick Watch
│ 7 apps · gambling sites          │   chips 30/60/120
│ ▂▂▂▂▂▂▂░░░░░       ends 22:00    │
│ ── also active ────────────────  │   extra active layers stack as
│ ✕ Gambling sites · always        │   compact rows inside the panel
└──────────────────────────────────┘

UPCOMING                              only rendered when schedules
│ Morning Watch · 06–07 · weekdays ›  exist; max 2–3 rows, "See all"
│ Sunday · all day                 ›  → Protect Time screen

┌──────────────────────────────────┐
│ APP BLOCKING                 ↗   │   hero SectionCard #1
│ Protect Time                     │   (hybrid naming: functional
│ 3 schedules · next 21:00         │   label + poetic serif title)
└──────────────────────────────────┘
┌──────────────────────────────────┐
│ WEBSITE BLOCKING             ↗   │   hero SectionCard #2
│ Clean Sight                      │
│ Gambling, Adult + 4 domains      │
└──────────────────────────────────┘

 ✕ Never Allowed   12 sites · 2 apps ›   compact rows, not cards
 ⛨ Strict Watch    off                ›
 (Review row appears here post-MVP)
```

Order of information: **status first** (what protects me right now), **plans second** (what is coming), **library third** (the two tools), **guard rails last**. The Now panel and Upcoming list borrow Opal's Blocks-screen clarity; the visual language stays Anasta (warm white, serif, gold ember — no dashboard grid, no dark theme).

**Card naming (DECIDED — hybrid):** small functional uppercase label + poetic serif title, e.g. label `APP BLOCKING` / title `Protect Time`, label `WEBSITE BLOCKING` / title `Clean Sight`. Every poetic name in the tab carries a functional label so first-time users never guess.

Mobbin takeaways applied: Opal's Blocks screen (Now → Upcoming list → add) proves the "status first, library second" order; Opal's setup sheet (Schedule/Timer toggle, name, days, block list, save) is the model for our plan editor; Opal's active screen (remaining-time line, block-list chip, difficulty chip, snooze primary + red leave-early) maps to our Now panel. What we reject: dark cyber aesthetic, focus score, leaderboards, mascot gems. Anasta stays warm white (`C.bg`), EB Garamond, gold accents, red only for lock/end-early copy. one sec's contribution: friction-with-meaning (breathing/intention) → ours is prayer/Scripture; ScreenZen: limited unlocks/day; AppBlock: cooldown + strict profiles.

### Shield (Apple-rendered, our config)
- Anasta icon, title "Pause before you enter.", subtitle verse fragment
- Primary: **Pray first** (gold) → opens Anasta intervention
- Secondary: **Turn back** (dismiss, logged as returned moment)
- Strict plans may show only "Pray first"; Never Allowed shows no unlock path ("This door stays closed.")

### Intervention screen (in Anasta)
Practice player per plan config → on completion: choice of "Return" (no unlock, celebrated quietly) or "Enter for 5/10/15 min" (starts timed unlock; re-shield after). Written-intention practice requires typing a reason first.

---

## 6. Build Phases

1. **Phase 1 — UI, fully mocked, production-shaped**: 4th tab + icon, landing (both Now states), plan editor flow, Protect Time / Clean Sight / Never Allowed / Strict Watch screens, intervention screen, mock store (Zustand/SQL like the rest of the app). Checkpoint commit per screen.
2. **Phase 2 — native spike**: dev-client build, Family Controls entitlement request, picker + shield + one real timed session end-to-end. Device test website blocking in Safari/Chrome/Firefox/Brave.
3. **Phase 3 — Protect Time real**: schedules (DeviceActivity), timed unlocks, re-shield, strict/loose strength.
4. **Phase 4 — Clean Sight real**: WebContentSettings packs + custom domains + Never Allowed.
5. **Phase 5 — Strict Watch**: cooldown engine, deny removal/installation, limited unlocks.
6. **Phase 6 — Review** + (optional spikes: DNS strong mode, Safari content blocker, accountability contact).

## 7. Build Log

- Phase 1 (mocked UI, production-shaped) **shipped 2026-07-02**, commits `be15cf1` → `761f02f`:
  4th tab + landing (NOW panel quiet/active, UPCOMING, hero cards, guard rows), Protect Time
  (plan cards + switches, Allowlist Mode), Watch Plan editor (name/categories/when/strength/practice),
  Clean Sight (packs + custom domains), Never Allowed, Strict Watch (cooldown + locks),
  Intervention screen (practice player → Turn back / timed enter). Store: `components/focus-watch/focusWatchStore.ts`
  (in-memory mock, public shape ready for the Phase 2 Screen Time bridge).
- Next: user visual pass on device → then Phase 2 native spike (entitlement request, dev build, picker/shield).

## 8. Decisions Log

- [x] Quote: **1 Peter 5:8** (Matthew 26:41 moves to shield/intervention copy)
- [x] Card naming: **hybrid** — functional label + poetic title (`APP BLOCKING` / Protect Time, `WEBSITE BLOCKING` / Clean Sight)
- [x] Landing: **hybrid layout** — chapel-lamp Now panel + Upcoming schedule rows + 2 hero cards + compact guard-rail rows (see §5)
- [x] Allowlist Mode lives **inside Protect Time** as a session type, not its own card
- [ ] Confirm hybrid landing mock on screen before styling pass (Phase 1, first checkpoint)
