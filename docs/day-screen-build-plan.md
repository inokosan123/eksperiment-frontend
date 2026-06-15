# Day Visualization — WOW screen build plan (DETAILED checklist)

Award-winning ambition. Christian productivity app. Gold/cream, serif for sacred numbers.
Component: `V4DayPanoramaHeaderSlide` (step `dayVisualizationHeader`). Phases: `pie → waste → reclaim`.
Everything on the UI thread (Reanimated). Manual/contemplative pacing — NO auto-advance.

## Design tokens (locked)
- Sleep slice/segment: `#5B527A` (night indigo)
- Productive slice/segment: `#E8C66F` (warm gold)
- Phone slice/segment: `#17130F` (near-black — the villain)
- Brand gold: `C.gold` (#C5A059), cream `#FFFDF8`, ink `#191714`
- Loss accent (waste): `rgba(168,57,63,..)`; recovery arrow green: `#3E9B5F`
- Numbers: `F.serifSemiBold`; captions: `F.serifMediumItalic`; eyebrows: `F.sansBold` 10px letterSpacing ~2.2
- Haptic helpers: `runSelectionHaptic` (tick), `runBubbleHaptic` (medium), `runStrongHaptic` (heavy)
- Data (protectStats): `usablePercent` = phone÷16 (= % of waking life), `yearlyDays`, `lifetimeYears`, `reclaimedDays`, `reclaimedYears` (×0.4)

## Architecture (CORRECTED — was wrong before)
- SCREEN 1 = hero collage + axis + pie (hero stays on screen 1 only).
- On Continue → **hero collage, clouds AND axis fully fade/clear away.** Only the pie survives, rises to the very TOP of the now-empty screen and becomes the bar (~12-18% height). SCREEN 2 has NO hero — just bar at top + dominant cards below.

---

## PHASE 1 — Pie polish (screen 1) ⬜
Make the pie itself award-tier (it's already good; push it further).
- [ ] Slice depth: subtle inner radial shade per slice (darker toward rim) so it reads 3D, not flat.
- [ ] Crisp white separators between slices (already ~3.2 stroke) + a soft drop shadow under the whole pie disc.
- [ ] Glossy top highlight arc (thin white 30% sweep top-left) for a "ceramic" premium feel.
- [ ] Center: small cream hub circle with a tiny gold "24h" or a thin ring — gives the pie a focal core (decide: hub label vs clean). DEFAULT: tiny "24h" hub.
- [ ] Hour labels on slices: keep, but ensure contrast (phone label = cream on black, productive = ink on gold, sleep = cream on indigo).
- [ ] Entrance animation (already): each slice sweeps/draws in clockwise one by one (sleep → productive → phone), 380ms each, 120ms stagger, light tick haptic per slice as it completes; stickers pop after.
- [ ] Stickers (moon/toolbox/phone): thin connector line from sticker to its slice (so it's clear which sticker = which slice).
- NOTE: pie is user's baby — confirm direction before heavy changes; small polish OK.

## PHASE 2 — Transition pie → bar (hero clears) ⬜
The signature move. On Continue from `pie`:
- [ ] `heroClear` SV 0→1 over 620ms (ease bezier .22,1,.36,1): `dayHeaderContent` (collage + cloud bank + axis) fades opacity→0 + drifts up ~24px + scales 0.97. Fully unmounts/hidden at end.
- [ ] Stickers (phone/sleep/toolbox) fade off the pie first (0→opacity over 240ms, slight outward drift).
- [ ] Pie `morph` SV 0→1 over 760ms: pie travels from its current center up to the very top of the screen (translateY to top band), shrinks (scale ~0.34), and crossfades into the horizontal BAR (pie opacity→0 as bar opacity→1 at the same top position). The bar inherits the exact slice colors (continuity).
- [ ] Timing: stickers fade (0–240) → hero clear + pie rise begin (200–820) → bar settles (~820) → cards begin.
- [ ] Haptic: medium on Continue tap; soft tick when the bar "lands" at top.

## PHASE 3 — Bar (toolbar at top of screen 2) ⬜
- [ ] Track: full width minus margins, height ~26-30, radius full, soft inset bg. Sits in the TOP ~12-18% of screen.
- [ ] 3 segments left→right: Sleep (`#5B527A`) · Productive (`#E8C66F`) · Phone (`#17130F`), widths = hours/24.
- [ ] Segment entrance: widths grow from 0 left→right (sleep, then productive, then phone), 300ms each, staggered, as the bar lands.
- [ ] Legend row under bar: 3 dots + labels (Sleep / Productive / Phone) with hour values.
- [ ] Above-bar caption (small): "Your 24 hours" or "This is your day." (decide copy).

## PHASE 4 — Loss cards (waste state) ⬜
3 DOMINANT cards (far better than the old text-row). Stagger in one by one.
- [ ] Card design: tall (~96-110), rounded 22, cream bg, gold hairline border, soft long shadow; left vertical accent bar in loss-red.
- [ ] Layout per card: eyebrow "YOU WASTE" (small, loss-red) · BIG number (serif, ~46-52) · italic caption.
- [ ] Card 1: `{usablePercent}%` — "of your waking life"
- [ ] Card 2: `{yearlyDays}` — "days every year"
- [ ] Card 3: `{lifetimeYears}` — "years of your life"
- [ ] Numbers COUNT UP on entrance (odometer, 0 → value, ~700ms) — not a static fade.
- [ ] Entrance: each card translateY 16→0 + scale .97→1 + fade, 520ms, 720ms stagger; medium haptic per card; on the big number's odometer, a heavy haptic on its final settle.
- [ ] OPTIONAL (steal from old): tiny dot-grid behind/beside the days/years number (a small year-grid of dots, phone-share colored) — as an accent, only if it elevates. Mark optional.
- [ ] CTA: "Continue".

## PHASE 5 — Reclaim entry: dim + promise ⬜
On Continue from `waste`:
- [ ] `dim` SV 0→1 over 460ms: full-screen ink overlay (opacity ~0.82) like guided-setup; bar + cards dim behind.
- [ ] App message fades in over the dim (serif 24, cream): "Anasta can help you cut your screen time by at least **40%**." (40% gold). translateY 10→0.
- [ ] Hold ~1.6-2.0s (contemplative).
- [ ] Then `dim` 1→0 over 520ms; message fades with it; reveal the bar + cards again, now in reclaim mode.
- [ ] Haptic: medium when the message lands.

## PHASE 6 — Gold fills the bar + crest (the MASTER reclaim timeline) ⬜
This is the heart. One master SV `goldFill` 0→1 over ~2000ms (ease .32,0,.18,1) drives EVERYTHING in phases 6 & 7 in sync.
- [ ] Crest (APP_LOGO) fades/scales in above the bar (crestIntro, 620ms) just before gold starts.
- [ ] Gold grows from the PHONE end (right) leftward, eating the black phone segment: a gold overlay width 0 → (40% of phone segment), synced to goldFill.
- [ ] As gold fills: the dark phone segment visibly shrinks; the gold reclaimed slice glows.
- [ ] Crest: soft gold pulse (scale ~+4%) once gold reaches full; heartbeat haptic (firm+soft) at gold start; strong haptic at gold completion.
- [ ] Subtle gold shimmer sweep across the reclaimed segment on completion.

## PHASE 7 — Cards flip waste → get back (SYNCED to goldFill) ⬜
The detail that gives character — all driven by the SAME `goldFill` master so bar + numbers move together.
- [ ] Eyebrow crossfades "YOU WASTE" (red) → "YOU GET BACK" (gold), synced to goldFill 0→0.4.
- [ ] The big BLACK waste number: animates from center → bottom-RIGHT corner, SHRINKING (scale ~44px → ~16px), as goldFill grows; a thin DIAGONAL strike line draws across it (-18°); a small GREEN ↓ arrow appears beside it. It also counts DOWN toward the remaining loss (value → value×0.6) as it travels.
- [ ] The big GOLD "get back" number: grows IN at center (scale .7→1, fade), counting UP 0 → reclaimed value (odometer), perfectly synced to goldFill (number rises exactly as the gold fills the bar).
- [ ] Per-card stagger: card 1 flips at goldFill onset, card 2 +180ms, card 3 +360ms (cascade), each with a soft tick as its gold number starts.
- [ ] Card 1 gold: `+{reclaimedWakingPercent}%` · Card 2: `+{reclaimedDays}` days · Card 3: `+{reclaimedYears}` years.
- [ ] Card accent bar color crossfades loss-red → gold, synced.

## PHASE 8 — Final button + wiring + polish pass ⬜
- [ ] Single CTA "Let's fix this" (gold/primary) appears after the flips settle; press → onNext → protectRecap.
- [ ] "Let's fix this" sets the flag that ENABLES the Screen Time protection setup group (the "Not now"/skip path is out — single button by decision).
- [ ] Remove/unwire old `dayVisualization` step (done) — verify no dead render path shows.
- [ ] Full haptic timing pass; full timing pass on device (the contemplative beats).
- [ ] Performance: memoize cards, hardware textures on moving layers, mount heavy art per-phase only.
- [ ] Vertical-fit check on small devices (now easier — hero is gone on screen 2, full height free).

---

## Open confirmations
1. Architecture: screen 2 has NO hero, only bar at top + cards. (CONFIRM)
2. Pie polish direction (Phase 1) — confirm what to push, or trust proposed list.
3. Black waste number on flip: counts down to remaining (×0.6) — yes/keep simple (just relocate+shrink)?
