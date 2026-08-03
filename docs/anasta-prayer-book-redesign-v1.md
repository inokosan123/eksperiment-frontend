# Anasta — Prayer Book Redesign v1 (the goal)

*Front-end reorganisation only. The back-end (tasks, challenges, Jesus Prayer timer,
personal-rule timer, persistence, task launch params) already works and stays as it is.
What changes is how the screen is organised, what it shows, and how each piece is drawn.*

---

## 1. The one-sentence goal

Prayer Book stops being a five-tab Orthodox reader with My Rule hidden as a pill, and
becomes **two books under one title** — **My Rule** and **Orthodox Prayer Book** — chosen
by the app's own two-kinds plaque switch at the top, each side drawn to the standard of
the app's newest work (Focus plan sheet, Journal streak room, the main section cards).

---

## 2. The screen, top to bottom

```
┌─ PRAYER BOOK ───────────────────────────────── ⚙ (language) ─┐
│                                                              │
│   [ Set as Daily Task                              ↗ ]       │  ← ABOVE the switch:
│                                                              │    belongs to neither book
│   ┌────────────────────┬─────────────────────┐               │  ← THE SWITCH
│   │      MY RULE       │      ORTHODOX       │               │    two kinds, one plaque
│   └────────────────────┴─────────────────────┘               │    default = MY RULE
│   · one crossfading line: what this side is                  │
│                                                              │
│  ── MY RULE ──────────────  │  ── ORTHODOX ───────────────   │
│  what My Rule is, in cards  │  MORNING MEALS EVENING JESUS   │  ← category row
│  Jesus Prayer card          │  OTHER                         │    ONLY here
│                             │  ( rule pills )                │
│                             │  ( prayer preview card )       │  ← unchanged
│                                                              │
│              ( START PRAYER — floating )                     │
└──────────────────────────────────────────────────────────────┘
```

- **Default side is My Rule.** Opening Prayer Book cold lands there, always.
- **Set as Daily Task stands ABOVE the switch.** It belongs to neither book — the same
  sheet (`SetAsTaskSheet context="prayer"`), offering the same hours, whichever side is
  showing. Under the switch it read as something the choice governed; above it, the rule
  is plain: everything below the switch changes with it, and this does not.
- **The category row (MORNING / MEALS / EVENING / JESUS / OTHER) appears only on the
  Orthodox side.** It is the current row and keeps its five colours.
- **Everything below the category row on the Orthodox side stays as it is today**: rule
  pills, the preview card with its gradient, ornament and typeset blocks, the reader.
  Orthodox inherits; it is not rebuilt.
- **The My Rule side is built from scratch.** No prayer-page paper, no rubrics — the
  space is used to *explain what My Rule is* in cards, and to launch it beautifully.

---

## 3. The switch (element 1)

**Pattern:** the app's existing two-kinds plaque — `components/shared/SetAsTaskSheet.tsx`
(`segmentWrap` / `segmentPill` / `SegmentEmblem`) and `components/focus-watch/FocusRuleSwitch.tsx`.

Non-negotiable anatomy, carried verbatim:

| part | value |
|---|---|
| track | row, padding 4, gap 4, radius 20, border `#E8E3D9`, bg `#F5F2EC`, recessed |
| plaque | absolute, inset 4, radius 16, `overflow: hidden`, shadow 0/5 blur 12 @ 0.22, elevation 3, shadow colour = chosen side's colour |
| halves | `flex: 1`, minHeight 52, row, centred, gap 9, zIndex 1 |
| emblem | 32 seat / 28 disc / 22 heart / glyph, halo 40 @ `rgba(255,255,255,0.75)`, resting opacity 0.55 |
| label | `F.sansBold` 11, letter-spacing 1.6, uppercase |
| spring | **damping 18 / stiffness 235 / mass 0.72** — the app's one selection spring |

**The plaque must CHANGE INTO the side it selects.** Both faces live on the plaque at once
and cross-fade on the very shared value that drives the slide. Pill, faces, emblems and ink
all read from that one shared value on the UI thread — no React state moves while it moves.

- **ORTHODOX face — Byzantine, elegant.** Gold on warm parchment; the Orthodox cross;
  a struck double rule or a gold hairline frame; the register of a received book.
  Draw from the app's parchment/gold vocabulary (`#C5A059`, `#E8DCC4`, `#FFFBEB`).
- **MY RULE face — quieter, more western, still beautiful.** The plain cross, cool light,
  an open page rather than an illuminated one. It must not read as a lesser Orthodox face;
  it is a different tradition, drawn with equal care.

Under the track: **one crossfading consequence line** (the `FocusRuleSwitch` note pattern —
5px dot + `F.serif` 14.5). It says what the chosen side *is*, in one plain sentence.

---

## 4. The My Rule side (elements 2–4)

Currently My Rule is a pill inside Morning/Evening that renders `PersonalRulePreview` — a
dial, an intro sentence, a bulleted list, a footnote. **That content is right; its dress is
a prayer page it does not belong on.** Rebuilt as its own page:

### 4a. The lead — *what My Rule is*
Not a paragraph on paper. A short serif lead plus **cards** that carry the meaning:
"for Christians of every tradition", "no preset text", "a quiet timer runs while you pray".
Content source stays `PERSONAL_RULE_PREVIEW[lang]` (already translated sr/en/ru) — the
copy is reorganised into cards, not rewritten from nothing.

The register is the app's **newest** one — Library's and Inner's `RibbonSectionCard`:
colour lifted in HSL (hue kept, saturation held, lightness raised) rather than washed
toward white, a plate running near-white at the shoulder to full colour at the foot, a lit
hairline on the top edge, a pane of light on the shoulder, one large emblem bleeding off
the right edge, eyebrow `sansBold 10/2.4` + `serifMedium 28/32` title + `serif 16/23` body.
Airy and ranged left, not a centred devotional page.

### 4b. The ways-to-pray rows
`listItems` (prayer book, devotional, rosary/prayer rope, memorised prayers, own words, any
other way) sit in one plate, divided by fading folds, each on a **lifted** seat in one of
the Prayer Book's five hours' colours — built with the ribbon palette's own `lit()`/`deep()`
so the tints are rich rather than pastel. The colour is on the seat only; a plate around
each row would be six cards inside a card.

### 4c. The launch
Start Prayer on this side opens `/personal-rule` (`PersonalRuleTaskView`) — the existing
timer, unchanged. What is redesigned is the *approach*: the lead card's emblem **is** the
dial, at rest and breathing, bleeding off the right edge where every ribbon card carries
its mark. Every other rule opens a page of prayers, so its preview is a page; this one
opens a dial, so its preview is the dial.

### 4d. The Jesus Prayer card
**New on this side.** A real ribbon card in gold, carrying a mark nothing else in the app
carries — a rope of beads curving off the edge — that opens `/jesus-prayer`
(`JesusPrayerTaskView`), the same screen the Orthodox JESUS tab reaches. Jesus Prayer
belongs to both sides: a **tab** on the Orthodox side, a **card** here.

⚠ It was a Scripture door (`DoorGround`/`DoorSeal`) first, and was rejected: a door
borrowed whole from another screen is exactly what this page did not need.

---

## 5. The Orthodox side (element 5)

Inherits. Concretely:

- category row `CATEGORIES` + `CAT_THEMES` — kept, five colours kept
- `RulePill` row — kept
- the preview card (gradient, lit edge, `ORTH.` badge, ornament row, `PrayerBlockView`) — kept
- `PrayerReader` and everything under it — untouched
- **`personal` is removed from the Morning and Evening pill lists** (`getPrayerOptions`),
  because My Rule now lives one level up. `defaultOptionId` stops preferring it.
  `isPersonalRuleOption` / `PersonalRulePreview` move to the My Rule side.

Polish allowed on this side where it is clearly behind the app's newest work — but it is
polish, not a rebuild.

---

## 6. The design bar

Every element gets designed to the level of the app's newest surfaces, not the level of the
screen it is replacing. The references, in the repo:

| what | where |
|---|---|
| two-kinds switch | `components/shared/SetAsTaskSheet.tsx`, `components/focus-watch/FocusRuleSwitch.tsx` |
| consequential choice seats | `components/shared/TaskFrequencyEditor.tsx` → `FrequencyChoice`, `components/focus-watch/FocusChoiceList.tsx` |
| sheet construction, element by element | `components/focus-watch/PlanEditorView.tsx`, `PlanGroupSheet.tsx`, `FocusSheetHeader.tsx` |
| the section-card family | `components/shared/SetAsDailyTaskCard.tsx`, `SectionCard.tsx`, `RibbonSectionCard.tsx`, `main-section-cards-screen.tsx` |
| streak / lit surfaces | Journal streak room, `focus-watch/StreakDayCoin.tsx`, `TrophyRadiance.tsx` |

Standing rules that apply here:

- **Registers are not one style.** Prayer Book is the app's *bright, colourful* register —
  five hours in five distinct colours, flat tinted seats. Do not drag it into the engraved
  parchment register wholesale. The Orthodox switch face is the one place that leans Byzantine.
- **No cards inside cards.** Inside a card, divide sections with a fading hairline (gold line
  + white catch-light), never with a nested bordered/shadowed plate.
- **The value is the explanation.** No sentence under a row whose value already says it.
- **Hierarchy comes from the seat, the plate and the accent** — not from display type.
- **Animation:** Reanimated + gesture-handler only, on the UI thread. No `PanResponder`,
  no JS-thread `Animated.Value`. One selection spring everywhere.

---

## 7. Out of scope

- The prayer **reader** (`PrayerReader`) — a separate later pass.
- Back-end: task creation, challenge wiring, `TaskProvider`, persistence, notification
  scheduling, the Jesus Prayer and personal-rule timers themselves.
- Onboarding's guided tour must keep working (`guided` / `guidedOrthodox` props,
  `PRAYER_GUIDE_TARGETS` anchors) — its spotlight anchors are re-pointed, not deleted,
  and no onboarding behaviour leaks into the real screen.
- Prayer text content and translations.

---

## 8. Done means

1. Prayer Book opens on **My Rule**, every time.
2. The switch reads as one gesture: plaque travels *and* becomes the other book.
3. Set as Daily Task works identically from both sides.
4. Orthodox side behaves exactly as before, minus the `My Rule` pill.
5. My Rule side explains itself in cards, launches the timer, and carries its own
   Jesus Prayer card.
6. Jesus Prayer is reachable from both sides.
7. No regression in: task launch (`?category=&optionId=&autoStart=&isTask=`), language
   menu, reader, onboarding tour, completion return animation.
8. `npx tsc --noEmit` clean; lint clean on touched files.
