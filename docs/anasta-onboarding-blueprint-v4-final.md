# Anasta Onboarding — Blueprint v4 (DEFINITIVE)

Complete, build-ready specification. This synthesizes everything: v1–v3, every psychological
hook we refined, the council feedback, and the final 35-screen card-deck architecture. This is
the master document. Hand it to the coder.

**Identity is non-negotiable:** Anasta is a **Christian app**. Faith is the center;
productivity, discipline, and focus are faith *in practice* — not secular features beside the
spiritual ones. Discipline is a virtue. Time is a gift not to be wasted. Order is part of
devotion. Every screen must read as "made by someone who lives the Christian life," never as
"a productivity app with a cross."

---

## 0. The Felt Experience (the spine — read first)

1. **A conversation, not a form.** The Anasta crest speaks in bubbles; the user answers; the
   app reflects back.

2. **The onboarding IS the trailer.** This is not a setup wizard. This is the most important
   piece of product the team will ever build — it is the first and only chance to make a first
   impression. It must be smoother, more premium, and more polished than the app itself.
   Every animation, every transition, every haptic, every sound must be crafted with the same
   care a film studio puts into a trailer. If the trailer is bad, nobody watches the film.
   If the onboarding feels cheap, nobody pays.
   - **The standard:** if any screen, animation, or transition would look out of place in a
     premium Apple product demo — it is not good enough. Redo it.
   - **The rhythm:** the onboarding has a pace, like music. Fast where it should be fast
     (swipe cards, quick confirmations), slow where it should be slow (weekly reveal, flame
     celebrations, Arise story). The coder must feel this rhythm and build to it.

3. **Premium restraint.** Smooth, intentional, quiet. Gold-and-cream palette. Serif for
   sacred moments. Full device refresh rate — **do NOT cap at 60fps** (support 120Hz
   ProMotion). Janky = wrong.

   **Haptics — every tap must be felt, not just seen:**
   - Light haptic: bubble appearing, card swipe, small confirmations
   - Medium haptic: submitting a name, making a selection, completing a setup step
   - Strong haptic: flame lighting, first checkoff, weekly reveal, recap cards appearing
   - Haptics fire at the EXACT moment of visual feedback — not before, not after. Timing
     is everything. A haptic that fires 50ms late feels broken.
   - Never over-haptic — not every tap needs feedback. Only meaningful interactions.

   **Animation timing — the rhythm of the onboarding:**
   - Card swipes: 280-320ms, spring physics, slight overshoot that snaps back
   - Bubble appearing: 200ms ease-out, slight scale from 0.95 → 1.0
   - Spotlight cutout moving: 350ms ease-in-out, smooth path between elements
   - Flame lighting: 600ms, warm glow expands from center, not instant
   - Cards going inactive (recap petlja): 300ms per card, one by one, 80ms stagger
   - Weekly reveal sequence: 400ms per element, 200ms stagger between elements
   - Recap cards appearing (pre-paywall): 350ms per card, 120ms stagger, scale+fade in
   - Page/screen transitions: 380ms, smooth push or fade — never hard cut
   - All animations: cubic-bezier curves, never linear. Linear = robotic.

   **Sound:**
   - Warm, soft, short sounds on meaningful completions (flame, first checkoff)
   - No sound on regular taps or swipes — only on emotional beats
   - Sound + haptic always fire together, never one without the other
   - Sound must be off by default if device is on silent — respect system settings

   **All animations must match the rhythm of the onboarding.** Every transition,
   celebration, and motion should feel smooth, intentional, and premium — never jarring,
   never generic. The animation IS part of the brand. If it doesn't feel like it belongs in
   Anasta, it's wrong.

4. **The user is already using the app.** Real actions on real screens, everything persists.

5. **No empty ceremony steps.** A tap IS the transition. Never echo a choice back as a user
   bubble followed by an app acknowledgment followed by another CTA. Every step carries value
   or it's cut.

6. **Continuity rule:** the user arrives from an emotional creator edit about discipline and
   faith. The onboarding continues that feeling — same register — to the paywall. Ad →
   onboarding → paywall = one story.

### The psychological engine (applied throughout — DON'T LOSE THESE)
- **Frame problem → solution early.** First screens make the user feel understood.
- **Personal "aha" within the first minute** (the screen-time waste math, the focus stats).
- **Ask questions that make the user diagnose themselves** (the card decks) — they convince
  *themselves* they need this, we don't hard-sell.
- **Reflect their answers back** (personalization screens, the weekly reveal built from THEIR
  inputs).
- **Let them use the core feature** (real setup, the first check-off).
- **Celebrate at the peak + ask for review there** (first check-off + Day 1).
- **Loss aversion:** by the paywall they've built a real system they don't want to lose.
- **Commitment & consistency (Cialdini):** optional commitment question (currently cut —
  cheap A/B test to re-add if conversion is weak).
- **Per-feature value:** every feature is introduced with its *why* (a wow/value beat) before
  or as the user sets it up — never a bare feature tour.

---

## 1. Positioning & Branding

**Tagline:** *A Christian productivity app for becoming who you're meant to be.*

**Hero (two-part):**
> *A Christian productivity app.*
> *Build discipline in your everyday life and your spiritual life — and become who you're
> meant to be.*

**Closing line (Welcome, end of journey):** *Become the person you are called to be.*
("meant to be" = positioning; "called to be" = spiritual payoff — keep distinct.)

**App Store / Marketing description (locked copy):**
> *The first all-in-one Christian productivity app — built to help you organize both your
> daily responsibilities and your spiritual life in one place, build discipline, and grow
> closer to God.*
>
> *Plan your days, set meaningful goals, and build better habits. Read Scripture, pray, and
> strengthen your spiritual life. Journal, reflect, practice gratitude, and protect your time
> and focus by taking control of your screen time and the distractions that pull you away —
> and so much more.*
>
> *Instead of scattering your life across a dozen different apps, Anasta brings everything
> into one Christian system that helps you live with more order, grow in the virtue of
> discipline, and become the person you are called to be.*

---

**Core positioning:**

**The first all-in-one Christian productivity app — built to help you organize both your daily responsibilities and your spiritual life in one place, build discipline, and grow closer to God.**

Plan your days, set meaningful goals, and build better habits. Read Scripture, pray, and strengthen your spiritual life. Journal, reflect, practice gratitude, and protect your time and focus by taking control of your screen time and the distractions that pull you away — and so much more.

Instead of scattering your life across a dozen different apps, Anasta brings everything into one Christian system that helps you live with more order, grow in the virtue of discipline, and become the person you are called to be.

**What Anasta is:**
Anasta is not just a task manager, not just a habit tracker, and not just a Bible or prayer app. It is an all-in-one Christian productivity system for organizing the whole Christian life: daily responsibilities, spiritual growth, discipline, focus, prayer, Scripture, reflection, and personal growth in one place.

**Core brand promise:**
Anasta helps Christians live a more organized, productive, disciplined, and faithful life — so they can grow closer to God and become the person they are called to be.

**Main value pillars:**
- **Organize your Christian life** — bring daily responsibilities and spiritual life into one place.
- **Build discipline as a virtue** — form habits, stay consistent, and grow in character.
- **Protect your time and focus** — reduce screen time, silence distractions, and block what pulls you away.
- **Grow closer to God** — read Scripture, pray, reflect, and keep spiritual life visible in your real day.
- **Become who you are called to be** — use the app not only to do more, but to become more ordered, disciplined, and faithful.

**Brand meaning:**
Anasta means "Arise." This is not the main product positioning, but the deeper meaning behind the name. It reminds the user that the path to discipline and spiritual growth will not be perfect. When they fall, miss a day, lose rhythm, or get distracted, they should not stay down. They should repent, return to God, and arise again.

**Counter-positioning:**
Anasta should not feel like a secular productivity app with Christian features added on top. It should feel like a Christian app built for the whole Christian life — because discipline, time, focus, prayer, Scripture, and daily responsibilities all belong to one life.

**Distribution:** Anasta's early distribution is built around two types of partners: **UGC creators** and **editors**. Because the launch phase has no large upfront marketing budget, both groups are paid primarily by performance, not by views. The payment model is based on real conversions and creator/editor promo codes.

The creator/editor offer must be aggressive enough to make many partners willing to promote the app without guaranteed upfront payment:
- The user receives a strong creator-code discount: around **40% off for the first 3 months**, then around **30% off after that** while the code remains active.
- The creator/editor receives around **50% of the first transaction** from users they bring.
- The creator/editor can receive around **15–20% of later transactions** from those users, but only while they continue promoting Anasta according to the agreement.
- Continued recurring payouts are tied to continued promotion. For example, to keep earning the recurring percentage, a creator/editor may need to publish at least one Anasta video per week or meet another consistency requirement defined in their contract.

This model is not view-based. It is conversion-based because the early-stage goal is to scale distribution without burning cash upfront. Later, as the app grows and cash flow improves, Anasta can move into paid creator deals, fixed-fee collaborations, Spark Ads, and larger distribution campaigns.

The onboarding must emotionally pay off the promise from creator/editor content. If a user arrives from a Christian discipline edit, the onboarding must continue the same story: organize your Christian life, build discipline, protect your focus, grow closer to God, and become the person you are called to be.

---

## 2. Progress Bar System

A persistent **gold progress bar** appears from the diagnosis phase onward (`statementsIntro`,
Screen 9). Starts with **3 visible slots**. After the 3rd flame lights, a **4th slot animates
in as a surprise**. Each completed section lights a **flame** (warm glow, not explosion).

**Slot names — must match the exact section order:**

| Slot | Name | Lights after |
|---|---|---|
| 1 | **Protect** | Protect setup complete |
| 2 | **Organize** | Weekly reveal complete |
| 3 | **Grow** | Prayer Book complete |
| 4 | **Tools** | Tools slides complete (surprise slot) |

Names are short, visible under each flame marker, and consistent with the language used
throughout the onboarding. Korisnik uvek zna gde je i šta dolazi sledeće.

The bar gives constant progress awareness, reduces "is this endless?" anxiety, and delivers
a small dopamine hit with each flame. The 4th slot appearing as a surprise after the 3rd
flame is the key moment — it should feel like a bonus, not a burden.

---

## 3. Full Screen Order (35 screens)

```
FAZA 0 — UVOD
1. loading
2. welcome
3. conversation (name + tradition)
4-8. valueSlider (5 slides; slide 4/"Grow closer to God" carries ✦ Free-for-all tag)
9. toolsIntroA (full-screen: "Anasta has a lot of tools...")
10. toolsIntroB (full-screen: "That's why we want to understand you better...")

FAZA 1 — DIJAGNOZA & SETUP (Section 1: Protect Your Time)
11. statementsIntro (progress bar appears: Protect · Organize · Grow slots)
12. tutorialDeck (3 tutorial cards — teach swipe mechanic)
13. deck1 (Protect Your Time — 6 cards)
14. screenTimeSlider (how much time on phone — AFTER deck)
15. dayVisualization (24h breakdown + YOU WASTE + YOU CAN GET BACK)
16. protectRecap (card summary + screen time panel at top — HOME BASE)
17. setupProtect (3-group setup loop: Screen Time → DND → Website Blocker)
18. flame1 (🔥 Protect slot lights)

FAZA 2 — DIJAGNOZA & SETUP (Section 2: Organize Your Life)
19. deck2 (Organize Your Life — 11 cards)
20. organizeRecap (card summary — HOME BASE)
21. setupOrganize (3-group setup loop: Big Events → Monthly Goals → Task System)
22. weeklyReveal ★ WOW
23. flame2 (🔥 Organize slot lights)

FAZA 3 — GROW CLOSER TO GOD (Section 3, FREE)
24. giftMoment
25. bibleWalkthrough (highlight → favorites → comments → Bible Notes → navigation)
26. prayerBook
27. flame3 + SURPRISE 4th slot (🔥 Grow slot lights → Tools slot appears)

FAZA 4 — TOOLS (Section 4, bonus)
28. toolsSlides (3 slides: Journal → Gratitude → Other tools)
29. flame4 + congrats + recap + final message (🔥 Tools slot lights)

FAZA 5 — CLIMAX (posle paywalla)
30. homeReveal
31. gestureTutorial + firstCheckoff ★ EMOTIONAL PEAK (+ review modal)

FAZA 6 — ZAKLJUČAK
32. privacy
33. paywall
34. postPaywallBrand (Arise story)
35. postPaywallProfile (age + gender)
36. accountCreation (Apple/Google/Email)
```

---

## 4. Screen-by-Screen Detail

### Screen 1 — `loading`

> **Implementation note:** This screen is already well made in the current build. **Do not
> change it.** The description below is for documentation purposes only — so the coder has
> full context of what exists and why.

**Purpose:** Gives the Welcome screen time to fully load before the user arrives. Not just a
technical placeholder — it's the first impression. Should feel like the app is "coming toward
you," not like you're waiting.

**Visual:**
- Background: warm cream (`#FAF7F2` or `color-background-primary` token)
- Anasta crest centered horizontally and vertically — the only element on screen
- No wordmark, no text, no loading indicator

**Animation sequence:**
1. Crest starts invisible (opacity 0, scale 0.88)
2. **Fade in + grow** (600ms, ease-out) — opacity 0→1, scale 0.88→1.0. Feels like the crest
   "emerges from silence" — calm and dignified, not dramatic.
3. **Hold** (600ms) — crest holds still. Silence is part of the animation.
4. **Subtle pulse** (800ms, ease-in-out) — scale 1.0→1.04→1.0 with a soft warm golden glow
   behind the crest (radial gradient that appears and fades). Happens once only — does not
   loop.
5. **Fade out** (400ms, ease-in) — crest and background fade together into Welcome.

Total duration: ~2.4s. Long enough for Welcome to load; short enough that the user never
thinks the app froze.

**Haptics:** none — silence is intentional here.
**Sound:** none.
**Interaction:** none. Auto-advance only.

**Technical:**
- Welcome screen preloads all assets during this screen.
- If Welcome loads before 2.4s → wait for animation to finish before transitioning.
- If Welcome is not ready at 2.4s → hold crest on screen until it's ready. Never show a
  blank screen.

**Persists:** `onboardingStarted = true`

### Screen 2 — `welcome`

> **Implementation note:** This screen is already perfect in the current build. **Do not
> change it.** The description below is for documentation purposes only.

**Visual:** Crest centered. Quiet golden light behind crest (radial gradient, gently
expanding). Serif type.

**Copy:**
- Verse: *"Awake thou that sleepest, and arise from the dead, and Christ shall give thee
  light." — EPHESIANS 5:14*
- Bottom (gold): *Become the person you are called to be.*
- CTA: `Let's begin`

**No back button.**

**Motion:** golden light pulses once slowly (2s); verse fades in line by line; CTA appears
last.

### Screen 3 — `conversation` (name + tradition)

> **Implementation note:** This screen needs changes from the current build. The conversation
> layout must be unified with the rest of the app — same logo size, same bubble sizes, same
> animations as everywhere else in the app where this conversation style is used. Currently
> the screen starts from the middle and has inconsistent sizing. Fix: start from the top,
> unify all sizes and animations with the rest of the app.

**Purpose:**
1. Get the user's name → personalize the entire onboarding experience.
2. Get their Christian tradition → enable Orthodox-specific personalization in Prayer Book.

**Visual & Layout:**
- Chat bubble layout, starts from the **top of the screen** (not middle)
- Anasta crest — **same size as everywhere else in the app**
- App bubbles: left. User bubbles: right.
- **All sizes, spacing, and animations must be identical to every other conversation screen
  in the app.** This is a unified component, not a one-off screen.

**Conversation flow:**
```
App:  "Hi! What is your name?"
      [ text input field ]

User types name → submits

User bubble: "{Name}"
App:  "Welcome, {Name}."
App:  "Which tradition are you part of?
       This helps us set things up for you."

      ○ Orthodox
      ○ Catholic
      ○ Protestant
      ○ Non-denominational
      ○ Other
      ○ I'm not Christian

[User selects any option]

App:  "You're in the right place, {Name}. Let's begin."

→ short pause → auto-advance to value slides
  (no CTA button — "Let's begin" IS the transition signal)
```

**Same response for all traditions** — no different messages per tradition on this screen.

**Orthodox personalization flag:**
- `tradition === 'orthodox'` → set `isOrthodox = true`
- Used ONLY in Prayer Book (Screen 23): three Orthodox prayer rules pre-loaded + personal
  prayer rule option explained.
- Everything else in the onboarding is identical for all traditions.

**Non-Christian filter:**
- `I'm not Christian` → set `secularFilter = true`
- No follow-up questions here. The card decks later handle it naturally: a non-Christian
  user simply won't tap the spiritual problem cards, so they organically receive less
  spiritual setup. No separate onboarding path needed.

**Interaction:**
- Text input: keyboard appears, user types name, submits via keyboard "done" or bottom button.
- Tradition: single tap → response bubble → auto-advance after short pause. CTA available to
  skip the wait.

**Haptics:**
- Light haptic on each app bubble appearing.
- Medium haptic on name submission.
- Light haptic on tradition selection.

**Persists:** `userName`, `tradition`, `isOrthodox` (bool), `secularFilter` (bool)

> Age and gender are NOT collected here — they are post-paywall (Screen 34).

### Screens 4–8 — `valueSlider` (5 slides)

Full-screen swipeable carousel. Dot indicators at bottom. Each slide swipes horizontally.
Last slide → CTA `I'm ready →` → auto-advance to Screen 9.

---

### Screen 9 — `toolsIntroA`

**Full-screen animated intro — not a conversation, not a form. A moment.**
Large title, subtitle, background animation. Same format as chapter intros in any premium
onboarding. No crest bubble here — this is a standalone statement screen.

**Visual:** full screen, centered text, warm background animation (subtle, not distracting).

**Copy:**
- Title (large, bold): *"Anasta has a lot of tools."*
- Subtitle: *"But their worth is measured by what they add to your life — not by how many
  there are."*

**Motion:** title fades in first, subtitle follows 400ms later. Brief hold, then auto-advance
to Screen 10 after ~2.5s (or tap anywhere to skip wait).

---

### Screen 10 — `toolsIntroB`

**Same full-screen format as Screen 9. Continues the thought directly.**

**Copy:**
- Title (large, bold): *"That's why we want to understand you better."*
- Subtitle: *"In the next screens, we'll show you a few statements. Answer honestly — the
  more we know about you, the better we can set Anasta up to truly fit your life."*

**Motion:** same as Screen 9. After ~2.5s or tap → auto-advance to Screen 11.

---

**General rule:** every slide has its own distinct animation/visual treatment — not the same
layout repeated 5 times. Each one should feel like its own moment.

---

**Slide 4 — "Organize your daily & spiritual life"**

> **Implementation note:** This slide is already well made — great animation, phone mockup,
> confetti. **Do not change it. Keep exactly as is.**

- Title: `Organize your daily & spiritual life`
- Visual: Phone mockup showing organized week with tasks and spiritual items mixed together.
  Confetti animation. Already implemented and polished.
- This slide stays identical to current build.

---

**Slide 5 — "Build discipline that lasts"**

- Title: `Build discipline that lasts`
- Subtitle: `In your daily routines and your spiritual life — habits, challenges, goals,
  and more.`
- Visual: Illustration or animation showing habit streaks, a challenge timer, goals being
  checked off. Should feel active and progressive — discipline being built, not just
  represented statically.
- The subtitle carries the key message: discipline in BOTH daily AND spiritual — this is
  Anasta's core differentiation from both generic productivity apps and generic Bible apps.

---

**Slide 6 — "Protect your time and focus"**

- Title: `Protect your time and focus`
- Visual (top, smaller than full screen): **The existing Anasta floating tags animation** —
  crest in the middle, distraction tags floating around it (Social media, Notifications,
  Gaming, Addictive content, etc.). Keep this animation exactly as it is, but sized to leave
  room for three feature cards below.
- **Three small feature cards below the animation** (horizontal row or stacked):
  1. `Control your screen time`
  2. `Block notifications during focus time`
  3. `Block addictive websites and apps`
- These cards are simple, clean, icon + label. No descriptions needed — labels are enough.
- The combination of the animation (shows the problem visually) + three cards (shows the
  solution clearly) makes this slide immediately understandable without any extra copy.

---

**Slide 7 — "Grow closer to God"** ✦ FREE FOR ALL

- Title: `Grow closer to God`
- Subtitle: `All of these features are free for everyone — always.`
- The subtitle makes the free status unmistakable — not just a tag but a clear statement.
- **✦ Free for all** tag — displayed prominently, enters with a gentle gold pulse to draw
  the eye.
- Visual: **Animated list of features**, each card sliding or fading in smoothly one by one.
  Each item is a well-designed tag/chip showing a feature name + small icon:
  - 📖 Bible reading
  - ⭐ My Favorites (highlights + notes)
  - 📝 Bible Notes
  - 🙏 Prayer Book
- The list animation makes it feel like they're receiving gifts, not reading a feature list.
  The design of each tag must be premium — not a plain text list.

---

**Slide 8 — "Become who you're called to be"**

- Title: `Become who you're called to be`
- Subtitle: `We give you all the tools you need — to reflect, grow, and stay focused.`
- Visual: Animation or illustration representing personal growth and reflection. (Open to
  creative direction — suggestions: a person rising, a candle burning, a journal opening,
  light growing. Should feel aspirational and warm, not corporate.)
- **Animated feature list** (same style as slide 7 — designed tags, smooth appearance):
  - 📓 Journal (3 methods)
  - 🙏 Gratitude
  - 📚 Reading List
  - ⏱ Pomodoro Timer
  - 📋 Notes
  - 🪣 Bucket List
- The list here serves the same purpose as slide 7: shows breadth of tools at a glance,
  premium design, animated in smoothly.

---

**Last slide → CTA `I'm ready →`**

**Secular filter:** slide 7 stays identical (Bible is free, non-pushy for non-Christians).
Rest of slides identical for all users.

**The sneaky-but-honest free/paid signal:** only slide 7 explicitly says "free" — so the
user subconsciously understands the rest is paid. No separate free/paid screen needed.

---

### Screen 11 — `statementsIntro`

**Purpose:** Transition from value slides into the card deck diagnosis. Builds anticipation,
explains why we're asking, motivates honest answers. Sets up the deck format before the first
real card appears.

**Visual & Layout:**
- Chat bubble style, same conversation component as Screen 3.
- Progress bar animates in at the top with **3 empty slots** as the first bubble appears.
- Crest visible as speaker.

**Conversation flow (4 bubbles, each appears after the previous one settles):**

```
App: "Anasta has a lot of tools."

App: "But their worth is measured by
      what they add to your life!"
      ← this line: BOLD + GOLD UNDERLINE

App: "We'll show you a few statements —
      just tell us if they sound like you."

App: "Please answer honestly.
      The more we understand you, the better
      we can set Anasta up to fit your life."
```

**After the 4th bubble:** a grey card mockup (empty, no text) slides up from the bottom of
the screen — a preview of the deck that's coming. This visually bridges the conversation into
the card deck without needing an extra screen.

**CTA:** `Let's go` — appears after the card mockup is visible.
**+ One-time gesture hint:** a hand animation swipes right over the grey mockup card to teach
the gesture before the real deck starts.

**Haptics:** light haptic on each bubble appearing.

**Motion:** bubbles appear one by one with natural typing delay. Gold underline on the second
bubble animates in (draws from left to right). Grey card mockup slides up smoothly from
bottom after the 4th bubble.

### Screen 12 — `tutorialDeck` (3 tutorial cards)

**Purpose:** Teach the swipe mechanic before the real card deck starts. Short, fast, fun.
The user learns by doing — not by reading instructions.

**Layout:** Same card deck component as the real deck. Stack of cards, same visual style.
Logo + bubble at the top — appears only on Card 1, hidden on Cards 2 and 3.

**Bubble copy:**
- First run (Card 1): *"Swipe right if it sounds like you, left if it doesn't."*
- After "No" on Card 3 (reload, Card 1 again): *"OK, let's try again!"*
- Cards 2 and 3: no bubble — cards only.

**Yes/No buttons:** visible below each card (same as real deck) for accessibility.

---

**Tutorial Card 1 — "Yes" card**
- Illustration: something relatable and universal (e.g. person looking at a full to-do list,
  overwhelmed)
- Text: *"I sometimes feel like there's too much to do and not enough time."*
- Expected answer: **Yes (swipe right)**
- This is intentionally something almost everyone agrees with.

**Tutorial Card 2 — "No" card**
- Illustration: something clearly not applicable (e.g. person relaxing with nothing to do,
  completely calm and organized)
- Text: *"I always know exactly what to do and never feel overwhelmed."*
- Expected answer: **No (swipe left)**
- This is intentionally something almost no one agrees with — makes the "No" obvious.

**Tutorial Card 3 — "Do you understand?"**
- Illustration: simple, friendly (e.g. crest, a question mark, or a light bulb)
- Text: *"Do you understand?"*
- **Yes (swipe right):** bubble changes to *"Great, let's go!"* → auto-advance to real deck
- **No (swipe left):** bubble changes to *"OK, let's try again!"* → reload tutorial from
  Card 1

**Haptics:** same as real deck — light haptic on each swipe.
**Motion:** same card physics as real deck — consistent experience.

---

---

### Screen 13 — `deck1` (Protect Your Time — 6 cards)

**Card deck on ONE screen.** 2-3 cards visible behind the top card (offset + scale effect).
Each card: illustration (top ~65%) + statement text. Buttons below: `✕ Not me` / `That's me ✓`

**Swipe right = "That's me" ✓** → gold tint + haptic, card flies right
**Swipe left = "Not me" ✗** → neutral + haptic, card flies left

**Colors:** second color (TBD by designer) = all 6 cards in this deck.

**Cards:**

| # | Statement |
|---|---|
| 1 | *"I pick up my phone for a second and lose an hour. I feel frustrated and guilty."* |
| 2 | *"My phone is the first thing I reach for in the morning and the last thing I see at night. I feel restless and it's ruining my sleep."* |
| 3 | *"Every time I sit down for something important, notifications and apps pull me away. I feel like I can never truly focus."* |
| 4 | *"When I need to start something hard, I feel anxious and uncomfortable — so I pick up my phone instead. I end up procrastinating for hours. And I feel like I let myself down — again."* |
| 5 | *"I'm addicted to content that I'm ashamed of — adult content, gambling, gaming, social media. It leaves me feeling empty every time."* |
| 6 | *"I want to be fully present — in prayer, with family, at work. But distractions keep pulling me away."* |

**Illustration direction (per card):**
1. Person looking at phone, clock on wall showing time has passed
2. Person in bed, phone in hand, morning and night atmosphere
3. Person trying to focus, notifications flying in from all sides
4. Person on phone, important task visible but untouched in background
5. Person in darkness, face lit by screen, expression of discomfort
6. Person distracted by phone while family/prayer/work is nearby

**Motion:** card follows finger (Reanimated gesture), gentle rotation max ~6°. Stack behind
shifts forward when top card swiped away. ~15-20s for whole deck. Reflective momentum —
not gamified. Every swipe should feel like a genuine answer.

**Persists:** `confirmedProtectProblems[]`
**Secular filter:** card 6 → if `secularFilter = true`, soften "in prayer" to "in quiet moments."

---

### Screen 14 — `screenTimeSlider`

**Purpose:** Immediately after the user has answered the Protect problem cards and is in
the mindset of "yes, my phone is a problem" — we ask the one quantitative question that
powers the visualization on Screen 15. The emotional timing is deliberate: they've just
felt the problem, now we quantify it.

**Visual:** full screen, clean, centered. No conversation bubbles — just the question and
the slider. Simple and direct.

**Copy:**
- Question (large): *"How much time do you spend on your phone each day?"*
- Slider: 4h → 10h+, default position 4h, snaps in half-hour increments
- Under slider: current selection shown dynamically (e.g. *"6 hours"*)

**CTA:** `Continue`

**After CTA — calculate immediately and store (do NOT show yet):**
```
phoneHours = slider value
sleepHours = 8 (fixed — population average)
usableHoursPerDay = 24 - 8 = 16

phonePercentOfDay = (phoneHours / 24) × 100  → round to 1 decimal
sleepPercentOfDay = (8 / 24) × 100 = 33.3%
usablePercentOfDay = ((16 - phoneHours) / 24) × 100  → round to 1 decimal

yearlyDays = (phoneHours × 365) / 24  → round to 1 decimal
lifetimeYears = (yearlyDays × 85) / 365  → round to 1 decimal
savedDays = yearlyDays × 0.4  → round to 1 decimal
savedYears = lifetimeYears × 0.4  → round to 1 decimal
```

All values stored. Nothing shown yet — the reveal happens on Screen 15.

**Persists:** `phoneHours`, all calculated values above.

---

### Screen 15 — `dayVisualization`

**Purpose:** The WOW screen. Show the user a visual breakdown of their 24-hour day using
the number they just entered on Screen 14. Every number is THEIR number. The abstract
problem — "I spend too much time on my phone" — becomes viscerally real when they see it
as a slice of their own day, then as days and years of their life.

**Visual:** animated full-screen infographic. A 24-hour day split into three parts, each
with its own illustration, label, percentage, and hours. They animate in one by one.

---

**Animation Part 1 — Sleep (animates in first):**
- Illustration: person sleeping peacefully
- Label: *"Sleep"*
- Hours: *"8 hours"* (fixed — population average, no need to ask)
- Percentage: *"33% of your day"*

**Animation Part 2 — Phone (animates in second):**
- Illustration: person scrolling phone, distracted
- Label: *"On your phone"*
- Hours: *"{phoneHours} hours"* ← THEIR number from Screen 14
- Percentage: *"{phonePercentOfDay}% of your day"*
- **Visual treatment:** this segment must feel heavier and more prominent than the others.
  Slightly larger, slightly more intense color, maybe a subtle pulse animation. This is the
  segment that makes the user uncomfortable — lean into that.

**Animation Part 3 — Everything else (animates in last):**
- Illustration: person doing meaningful things (reading, praying, working, with family)
- Label: *"The rest of your day"*
- Hours: *"{16 - phoneHours} hours"*
- Percentage: *"{usablePercentOfDay}% of your day"*
- Small note below: *"This includes eating, commuting, and other daily necessities."*
  (so the user understands this isn't all free time — sets realistic expectations)

**After all three parts visible — brief pause (1 second) — then transition to impact:**

The three-part visual transitions or scrolls down to reveal yearly and lifetime impact.

---

**YOU WASTE** (large, dramatic — same visual treatment as in branding):

Stat cards appear one at a time, each with a **strong haptic**:
- Card 1: *"{yearlyDays} days every year"*
- Card 2: *"{lifetimeYears} years over a lifetime"*

Visual: a year-grid or calendar showing all the days colored in — the wasted time made
visible. This is not abstract. This is their life, drawn out.

---

**Brief pause — then the good news:**

Transition line (large, gold): *"If you cut your screen time by only **40%**..."*
(40% is bold + underlined + gold highlight)

**YOU CAN GET BACK!** (same large visual treatment, warm gold):

Stat cards appear one at a time, each with a **warm haptic**:
- Card 1: *"{savedDays} days back every year!"*
- Card 2: *"{savedYears} years back over a lifetime!"*

---

**CTA:** `Let's start fixing this.`

→ User taps → auto-advance to Screen 16 (protectRecap).

---

### Screen 16 — `protectRecap`

> **Visual reference for coder:**
> https://mobbin.com/screens/a3da3471-9470-46d5-9d67-c5345df3de16
> Use this as the visual reference for the card summary layout. Access via Mobbin MCP.

**Purpose:** Show the user all 6 cards from deck1 in a summary view — active (confirmed)
and inactive (not confirmed). This is the "home base" between every setup group. The user
returns here after each group completes. A screen time panel at the top keeps the stakes
visible throughout the entire setup loop.

**Visual layout — two sections:**

**TOP PANEL — Screen Time Stakes (always visible throughout setup loop):**
A compact, persistent panel at the very top of the screen:
- *"📱 You spend {yearlyDays} days/year on your phone."*
- *"That's {lifetimeYears} years of your life."*
This panel does NOT disappear between groups. It stays visible during every setup step,
reminding the user WHY they are doing this. Every action they take (setting a limit,
blocking an app, setting DND) is connected to these numbers.

**BELOW TOP PANEL — Card Summary (all 6 cards):**
- **Active cards (Yes)** — full color, prominent, visually "alive"
- **Inactive cards (No)** — grayed out, faded, visually "quiet"

**Copy:**
```
App: "Let's start fixing your problems."
CTA: "Let's start"
```

**Interaction:** user taps `Let's start` → setup loop begins immediately.

---

### Screen 17 — `setupProtect` (3-group setup loop — DETAILED LOGIC FOR CODER)

> This is the most complex behavioral screen in the onboarding. Read every detail carefully
> before implementing. The logic must work exactly as described.

---

**THE CORE CONCEPT — protectRecap is the "home base":**

The user always returns to `protectRecap` between every group. The recap screen shows the
current state of all 6 cards at any moment. It is NOT a one-time screen — it is visited
multiple times, each time with an updated state. This is how the user sees their progress.

**Card states:**
- **Active** = confirmed Yes in deck1, not yet fixed → full color, prominent
- **Inactive** = either confirmed No in deck1, OR already fixed → grayed out, faded

---

**FULL BEHAVIORAL FLOW (step by step):**

```
[User taps "Let's start" on protectRecap]

↓
CHECK: Does Group 1 have any active cards? (Cards 1, 2, or 4)
  YES → Cards 1/2/4 that are active ANIMATE (grow, brighten, come forward)
        App bubble appears: "Let's protect your time."
        Group 1 setup runs (spotlight on real screen)
        When done → RETURN to protectRecap
        Cards 1/2/4 that were just fixed → ANIMATE TO INACTIVE (fade to gray, haptic)
  NO  → Skip Group 1 silently. No animation. No message. Go straight to Group 2 check.

↓
CHECK: Does Group 2 have any active cards? (Cards 3 or 6)
  YES → Cards 3/6 that are active ANIMATE (grow, brighten)
        App bubble: "Let's make sure nothing interrupts you."
        Group 2 setup runs
        When done → RETURN to protectRecap
        Cards 3/6 → ANIMATE TO INACTIVE
  NO  → Skip Group 2 silently. Go to Group 3 check.

↓
CHECK: Does Group 3 have any active cards? (Card 5)
  YES → Card 5 ANIMATES
        App bubble: "Let's block what's pulling you in."
        Group 3 setup runs
        When done → RETURN to protectRecap ONE FINAL TIME
        Card 5 → ANIMATES TO INACTIVE
  NO  → Skip Group 3. Return to protectRecap one final time.

↓
ALL 6 cards are now inactive.
→ AUTO-ADVANCE to flame1 (no CTA — the visual of all cards going inactive IS the trigger)
```

---

**THE ANIMATION DETAILS:**

When a group is about to run — its cards "come alive":
- Cards grow slightly (scale 1.0 → 1.06)
- Brightness increases, color returns if they were dimmed
- They visually "come forward" from the stack
- A soft haptic fires as each card animates

When a group finishes — its cards "go to rest":
- Cards fade to gray (smooth transition, ~400ms)
- Scale returns to 1.0
- A soft haptic fires for EACH card as it goes inactive (one by one, not all at once)
- This should feel satisfying — like checking things off a list

---

**GROUP 1 — Screen Time Protection**
*Trigger cards: 1 (lose an hour), 2 (morning/evening), 4 (procrastination)*
*Skip if ALL THREE were "Not me".*

Active cards from {1, 2, 4} animate. App bubble: *"Let's protect your time."*

Setup — what runs depends on which cards are active:

**If Card 1 OR Card 4 is active (or both):**
→ Spotlight opens on the real Screen Time settings screen.
→ Crest bubble: *"Set a daily limit for how long you spend on your phone."*
→ User sets their daily limit.
→ Soft haptic + micro checkmark when confirmed.

**If Card 2 is active (morning/evening phone problem):**
→ This step runs IN ADDITION to the above (or alone if only Card 2 is active).
→ Crest bubble: *"You told us your phone is the first thing you reach for
   in the morning and the last thing you see at night.
   Let's protect those hours."*
   ↑ This exact reference to their answer is intentional — it proves we listened.
→ User sets a morning protection block (time range — e.g. 6:00–8:00 AM)
→ User sets an evening protection block (time range — e.g. 9:00–11:00 PM)
→ During these time windows, selected apps are blocked automatically.
→ Soft haptic + micro checkmark when confirmed.

Return to protectRecap. Cards 1, 2, 4 (whichever were active) animate to inactive.

---

**GROUP 2 — Do Not Disturb**
*Trigger cards: 3 (focus interrupted), 6 (can't be present)*
*Skip if BOTH were "Not me".*

Active cards from {3, 6} animate. App bubble: *"Let's make sure nothing interrupts
you when it matters."*

Setup (always identical regardless of which card triggered):
→ Spotlight on DND / Focus Mode settings screen.
→ Crest bubble: *"When do you need complete focus?"*
→ User selects focus time windows (prayer time, work blocks, family time, etc.)
→ User chooses which notifications (if any) can still come through.
→ Soft haptic + micro checkmark.

Return to protectRecap. Cards 3, 6 (whichever were active) animate to inactive.

---

**GROUP 3 — Website & Content Blocker**
*Trigger card: 5 (addicted to unwanted content)*
*Skip if Card 5 was "Not me".*

Card 5 animates. App bubble: *"Let's block the content that's pulling you in."*

Setup:
→ Spotlight on Website/Content Blocker screen.
→ Crest bubble: *"Select the categories you want to block."*
→ User selects: adult content, gambling, gaming, social media, etc.
→ User can add specific websites manually.
→ Soft haptic + micro checkmark.

Return to protectRecap FINAL TIME. Card 5 animates to inactive.
All 6 cards now inactive → auto-advance to flame1.

---

**EDGE CASES:**

ALL 6 cards were "Not me":
→ protectRecap shows all 6 inactive immediately.
→ No setup runs. No message. Auto-advance directly to flame1.
→ Simple and clean — if they have no problems in this area, we don't make a big deal of it.

User goes back during setup:
→ Return to protectRecap in its current state (some active, some inactive).
→ Setup resumes from where it was interrupted — the next uncompleted group.

---

**APPLE ENTITLEMENT (critical):**
Groups 1, 2, and 3 all require the **Screen Time / Family Controls entitlement** from Apple.
Until approved and active:
- Wow beats (stats, slider, YOU WASTE / GET BACK) → run normally, no entitlement needed.
- protectRecap with active/inactive cards → shows normally.
- Setup screens → show UI, guide through it, but DO NOT promise enforcement the build
  can't yet deliver. No "your apps are blocked" or "you are protected" copy.
- flame1 copy must NOT claim anything is "protected" or "blocked" until entitlement is live.

---

### Screen 18 — `flame1` (Protect Your Time — complete)

**Triggered automatically** when all 6 cards on protectRecap go inactive.
No CTA on protectRecap needed — the all-inactive visual IS the transition trigger.

**Visual:** flame checkpoint screen, same style as the app's existing checkpoints.
Progress bar: first flame lights 🔥 (1 of 3), warm glow.

**Copy:**
```
App: "Protect Your Time — done, {Name}!"
App: "Let's continue. We have more
      questions for you."
CTA: "Continue"
```

CTA → `deck2` (Organize Your Life cards begin).

---

> **THE SAME LOOP REPEATS FOR ORGANIZE (deck2):**
> deck2 answered → `organizeRecap` screen (same visual as protectRecap, Organize cards) →
> active/inactive state shown → Group setups run one at a time → each group's cards go
> inactive after setup → all inactive → flame2 → next section (Grow Closer to God).
> Pattern is identical. Only the cards and feature setups differ.

### Screen 13 — `weeklyReveal` ★ WOW MOMENT (first peak)
Full Mon–Sun grid. **Sequential animation:**
1. Empty week (Mon–Sun columns)
2. Spiritual tasks enter first (slide to their days)
3. Routine tasks arrange around them
4. Habit + monthly goal appear
5. One realistic day highlights
6. Pause (1s)
- Copy (after pause): `Your work, your responsibilities, and your prayer belong to one life.
  This is your week, {Name}.`
- CTA `Continue`; user can tap a day and edit immediately (the reveal is only convincing if
  it's THEIR real week).
- Motion: calm, deliberate. A sparse but believable week — NOT cluttered. No confetti.

### Screen 14 — `flame1`
- Progress bar, first flame lights 🔥 (1 of 3), warm glow.
- `Your rhythm is taking shape. I have just one more set of questions for you, {Name}.`

---

### Screen 15 — `deck2` (Organize Your Life — 11 cards)

**Same deck mechanism as deck1.** Card deck on ONE screen, 2-3 cards visible behind the top.
Swipe right = "That's me" ✓ / Swipe left = "Not me" ✗. Buttons below for accessibility.

**Colors:** gold = earthly discipline, blue = spiritual (warm night tone, NOT depression blue).

| # | Color | Statement |
|---|---|---|
| 1 | ★ second color | *"I feel anxious when I have a lot to do and don't know where to start."* |
| 2 | ★ second color | *"I always end up doing everything at the last minute. I feel stressed and unprepared when it matters most."* |
| 3 | ★ second color | *"I get things done — but I know I could do so much more if I just planned my day better."* |
| 4 | ★ second color | *"I start new habits full of motivation. A few days later I've quit again. I feel like I have no discipline."* |
| 5 | ★ second color | *"I end most days feeling like I didn't do what actually mattered. It feels like I wasted another day."* |
| 6 | ★ second color | *"Sometimes I forget something I promised to do. Then comes the stress — and the feeling that I let someone down."* |
| 7 | ★ second color | *"My days have no rhythm. I never feel in control — just carried along by whatever happens."* |
| 8 | ✦ gold | *"I want to pray every day but I rarely do. I feel distant from God and guilty about it."* |
| 9 | ★ second color | *"I set goals with the best intentions. And then, somehow, I always end up giving up."* |
| 10 | ✦ gold | *"I want to read Scripture but I never make time for it. My faith is not growing the way it should."* |
| 11 | ★ second color | *"I want to be more organized, disciplined, and intentional with my time."* |

**Card → Feature mapping (used for setup loop):**
- Cards 1, 5, 6 → **Weekly view + Routine tasks setup**
- Cards 2, 3, 9 → **Big Events + Monthly Goals setup**
- Cards 4, 7 → **Habits + Challenges setup**
- Cards 8, 10 → **Spiritual tasks setup**
- Card 11 (aspirational) → triggers full setup (all groups active)

**Motion:** same as deck1 — reflective, not gamified. ~25-30s for whole deck.
**Persists:** `confirmedOrganizeProblems[]`
**Secular filter:** cards 8, 10 (blue/spiritual) hidden → deck = 9 gold cards.

### Screen 20 — `flame2`
- Second flame 🔥 (2 of 3). `Two down. Now — a gift.`

---

### Screen 16 — `organizeRecap`

> **Same visual as `protectRecap`.** All 11 Organize cards displayed, active/inactive.
> Same Mobbin visual reference applies.
> Same loop logic as Protect — user returns here between groups.

**Visual:** all 11 cards shown. Active (Yes) = full color. Inactive (No) = grayed out.
**Colors:** gold = spiritual cards (8, 10). Second color TBD by designer = all other cards.

App bubble: *"Let's start organizing your life."*
CTA: `Let's start`

---

### Screen 17 — `setupOrganize` (3-group setup loop)

Same behavioral pattern as `setupProtect`. User always returns to `organizeRecap` between
groups. Cards animate active before setup, animate to inactive after. All inactive →
auto-advance to `weeklyReveal`.

---

**GROUP 1 — Big Events**
*Trigger: Card 2 ("I always end up doing everything at the last minute")*
*Skip if Card 2 = "Not me"*

Card 2 animates. App bubble: *"Let's make sure important moments never catch you off guard."*

Setup (spotlight on real Big Events screen):
→ Crest bubble: *"Add an event you're counting down to."*
→ Un-gray "+" button → user adds name + emoji + date
→ Live countdown appears: *"In {N} days"*
→ Micro-celebration ✓
→ Return to `organizeRecap`. Card 2 → inactive.

---

**GROUP 2 — Monthly Goals**
*Trigger: Card 9 ("I set deadlines but always extend them")*
*Skip if Card 9 = "Not me"*

Card 9 animates. App bubble: *"Let's give this month a direction."*

Setup (spotlight on real Monthly Goals screen):
→ Crest bubble: *"Set one goal for this month."*
→ User types goal + selects target month
→ Micro-celebration ✓
→ Return to `organizeRecap`. Card 9 → inactive.

---

**GROUP 3 — Task System**
*Trigger: any of cards 1, 3, 4, 5, 6, 7, 8, 10, 11*
*Skip if ALL of them = "Not me"*

Active cards from this group animate. App bubble:
*"We have a really complex task management system. Let us walk you through it so you can
get the most out of it."*

---

**STEP 1 — HABITS**

Habits get a **popup slideshow** — an educational mini-presentation before the user creates
their own. The popup has beautiful slide animations, premium feel. It opens automatically
when Group 3 starts.

**Popup Slide 1 — What is a habit:**
- Title: *"Habits are the building blocks of discipline."*
- Body: explains the concept — a habit is tied to a goal, and progress happens step by step.
  A habit without a goal is just a routine. A habit tied to a goal is a step forward.
- Visual: simple illustration showing goal → steps → habit chain

**Popup Slide 2 — The chart:**
- Small chart showing habit consistency with vs without a system
- Keeps it visual, not text-heavy
- Reinforces WHY Anasta's habit system is different

**Popup Slide 3 — Example habit 1:**
- One real, specific habit example (e.g. "Morning walk — every day")
- Shows how it looks in the app: habit card, streak, linked goal
- Visual: the actual habit card design

**Popup Slide 4 — Example habit 2:**
- Second real, specific habit example (e.g. "Read 10 pages — weekdays")
- Same format as Slide 3
- **At the bottom of this slide: CTA button "Start your own"**
- User taps → popup closes → spotlight opens on the real Habits screen

**Real Habits setup (spotlight):**
→ Un-gray "+" → user creates one habit (name + frequency)
→ Optional: link to Monthly Goal if one was set in Group 2
→ Micro-celebration ✓

---

**STEP 2 — CHALLENGES**

No slideshow — direct setup.

App bubble: *"A challenge gives you a clear beginning, an end, and a commitment."*

Spotlight on real Challenges screen:
→ Example chips: 7-day prayer, No social media, Reading plan, Cold shower
→ User starts one challenge + selects duration
→ Brief mention: there is a trophy on completion
→ Micro-celebration ✓

---

**STEP 3 — MY ROUTINE (spiritual + routine tasks)**

Both spiritual and routine tasks live on the same **My Routine** screen.
Spotlight opens on the real My Routine screen.

**Spiritual tasks** (if cards 8 or 10 active):
App bubble: *"Let's give your prayer and Scripture a place in your day."*
→ User adds Morning prayer → day picker (S M T W T F S)
→ User adds Scripture reading → day picker
→ Evening prayer (optional) → day picker
→ Sacred language always applies:
   - Complete = *"Marked as prayed."* (never "Task completed")
   - Missed = *"Begin again today."* (never red overdue)

**Routine tasks** (if cards 1, 5, or 6 active):
App bubble: *"Now let's give your daily responsibilities a place."*
→ Example chips: Plan the day, Evening reset, Gym, Prepare tomorrow
→ User adds ≥1 routine task + day picker
→ Micro-celebration ✓

---

**STEP 4 — DAY STRIP (Pon-Ned)**

After tasks are created, show the day strip at the top of My Routine.
Spotlight on the Mon–Sun name strip.
App bubble: *"This is your week. Every task you create lands here."*
→ Show all tasks distributed across their chosen days.
→ No interaction needed — just show and explain.

---

**STEP 5 — EDITING**

Spotlight on one of the user's own tasks.
App bubble: *"You can edit any task at any time."*
→ User taps the task → edit screen opens
→ User changes something (name, day, frequency — anything)
→ Save → back to My Routine
→ Nothing is locked. Everything is theirs to adjust.

---

**STEP 6 — DELETE (pre-loaded task)**

Before onboarding runs, one task is pre-loaded into My Routine called **"Delete task"**.
This task exists only for this moment — to teach the delete gesture.

> **Open question for dev team:** Does this task get created automatically when the user
> reaches this step, or is it pre-seeded into the database before onboarding begins?
> Confirm and update this section accordingly.

App bubble: *"And you can delete anything you don't need."*
→ Spotlight on "Delete task"
→ User deletes it
→ Micro-celebration ✓ (satisfying — something unwanted is gone)

---

**STEP 7 — MY ROUTINE AS THE HUB**

App bubble: *"My Routine is the home of all your tasks — every type."*
App bubble: *"Habits, challenges, spiritual tasks, routines — you can start, edit, and
manage all of them from here."*
→ Brief spotlight showing the different task types visible in My Routine
→ No interaction — just show and tell.

---

After all steps complete → return to `organizeRecap`.
All active cards → animate to inactive.
All 11 inactive → auto-advance to `weeklyReveal`.

**Edge case — ALL 11 "Not me":**
→ All cards inactive immediately. No setup. Auto-advance to `weeklyReveal` directly.

---

### Screen 18 — `weeklyReveal` ★ WOW MOMENT

**This is the emotional peak of the Organize section.**
Triggered automatically when all cards on `organizeRecap` go inactive.

Full Mon–Sun grid. Sequential animation:
1. Empty week (Mon–Sun columns appear)
2. Spiritual tasks slide in first (to their chosen days)
3. Routine tasks arrange around them
4. Habit appears
5. Monthly goal appears
6. Big event countdown visible at top
7. One realistic day highlights
8. Pause (1s)

Copy (after pause):
*"Your work, your responsibilities, and your prayer belong to one life. This is your week, {Name}."*

- CTA `Continue`
- User can tap any day and edit immediately — the reveal is only convincing if it's THEIR
  real week, not a mock.
- Motion: calm, deliberate. A sparse but believable week — NOT cluttered or overwhelming.
- If user had all "Not me" (edge case): show a brief preview of what the week COULD look
  like with example tasks, then continue.
- Persists: all setup data already saved in previous steps.

---

### Screen 19 — `flame2`

**Triggered automatically** after `weeklyReveal` CTA.

**Visual:** progress bar, second flame lights 🔥 (2 of 3), warm glow.

Copy:
```
App: "Organize Your Life — done, {Name}!"
App: "Now for something special."
CTA: "Continue"
```

CTA → `giftMoment` (Grow Closer to God — FREE section begins).

---
- Crest, warm golden light. Changes register from self-improvement to generosity.
- `This part is for everyone. Always free.`
- `Bible reading and the Prayer Book are yours in Anasta — now and always.`
- CTA `Show me`

### Screen 22 — `bibleWalkthrough` (connected flow — 3 features)

**This is a single connected guided flow on the REAL Bible screen.** Not separate screens —
one continuous spotlight walkthrough that moves through: Highlight → Favorites → Comment →
Bible Notes → Navigation. The crest bubble guides each step.

**Pre-loaded data (must be set up before onboarding runs):**
- One color in My Favorites is pre-named **"Anasta"**
- That color has a **preloaded comment** — a meaningful phrase/quote (TBD — pick something
  that resonates with the app's brand and the Christian life)
- This is the only pre-seeded content in the whole onboarding — everything else the user
  creates themselves

---

**STEP 1 — Open Bible + Highlight the app's slogan verse**

Open the real Bible screen. Navigate to the verse used on the Welcome screen:
*EPHESIANS 5:14 — "Awake thou that sleepest, and arise from the dead..."*

Spotlight on the verse text.
Crest bubble: *"This is the verse Anasta is built around. Let's highlight it."*

→ User selects the verse text (spotlight guides the tap/drag)
→ Color picker appears
→ User selects a color/category
→ Highlight is applied to the verse
→ Micro-celebration: soft haptic

---

**STEP 2 — Go to My Favorites**

Spotlight on the star icon (top right corner).
Crest bubble: *"Press the star to see your Favorites."*

→ User taps star → My Favorites opens
→ Crest bubble: *"Everything you ever highlight is saved here — organized by meaning."*

**Show the filter system (3 levels):**
Spotlight on the filter/search bar.
Crest bubble: *"Favorites has three levels of filters."*
Describe each level:
1. Filter by **All / Type** (highlights vs. comments)
2. Filter by **Source** (which book of the Bible)
3. Filter by **Color/Category** (the meaning-based system)

**Show the pen icon:**
Spotlight on the pen icon next to a color name.
Crest bubble: *"That pen icon lets you rename any color — so your system is completely
personal. Name them by meaning, by theme, by whatever helps you grow."*

---

**STEP 3 — The "Anasta" color + preloaded comment**

Spotlight on the **"Anasta"** color in the filter list.
Crest bubble: *"We've prepared something for you here."*

→ User taps "Anasta" color filter
→ They see the preloaded comment (the pre-seeded phrase)
→ Crest bubble describes what they're seeing

Spotlight on the comment card.
Crest bubble: *"Tap the comment — it will take you back to exactly where it is in Scripture."*

→ User taps the comment card
→ App navigates back to that exact verse in the Bible, comment visible and marked
→ Crest bubble: *"Any highlight or comment always brings you back to its place in Scripture."*

---

**STEP 4 — Adding a comment (popup)**

Back in the Bible screen.
Spotlight on the star icon of a highlighted verse.
Crest bubble: *"Press the star on a highlight to add a personal comment."*

→ User taps star on the highlight
→ **Popup appears** showing: how to type a comment + how it will look inside the Bible
→ Crest bubble: *"You can add thoughts, reflections, or prayers — and they stay right here
   in the text, forever."*
→ Crest bubble: *"Close the popup when you're ready."*
→ User closes popup

---

**STEP 5 — Bible Notes**

Spotlight on the Bible Notes button (top right).
Crest bubble: *"Now let's look at Bible Notes."*

→ User taps Bible Notes
→ Bible Notes screen opens
→ Crest bubble describes the **three sections** of Bible Notes (TBD — define the 3 sections
   with the dev team and add here)

Spotlight on the **search button** in Bible Notes.
Crest bubble: *"You can search your Bible Notes across the entire Bible — not just this chapter."*

Spotlight on the **Set as Task** button.
Crest bubble: *"You can set any Bible reading as a task or a challenge — so it becomes part
of your daily rhythm."*

Spotlight on the **Favorites button** in Bible Notes.
Brief mention: *"Your favorites are always one tap away."*

---

**STEP 6 — Navigation (search and find Scripture)**

Back on the main Bible screen.
Spotlight on the **book/chapter selector**.
Crest bubble: *"Finding any Scripture is simple. Tap here to select any book and chapter."*

→ Show the selector opening
→ User sees the list of books and chapters
→ Crest bubble: *"Everything in Scripture — right here, always free."*

→ Auto-advance to Prayer Book

**Persists:** the highlight the user made on the Ephesians verse is saved to My Favorites.

---

### Screen 23 — `prayerBook`

**Purpose:** Show the Prayer Book briefly. Tradition-specific — this is where Orthodox
personalization pays off.

**Visual:** real Prayer Book screen, one page visible.

**If `isOrthodox = true`:**
Crest bubble: *"As an Orthodox Christian, you have three prayer rules already loaded —
morning, evening, and the Jesus Prayer rule."*
→ Show the three rules listed
→ Crest bubble: *"You also have a personal prayer rule option — for when you read from
   your own prayer book at home."*
→ Brief, one screen, no deep setup.

**If any other tradition:**
Crest bubble: *"Your Prayer Book is here — morning, evening, and mealtime prayers,
organized and always available."*
→ Show one page of appropriate prayers for their tradition.

**All traditions:**
*"Available anytime. Completely free."*
CTA: `Continue`

### Screen 24 — `flame3` + SURPRISE 4th slot

**Two moments on one screen, sequenced:**

**Moment 1 — Third flame:**
Progress bar, third flame lights 🔥 (3 of 3). Warm glow animation.
Feels like the end — user sees all 3 slots filled and thinks "we're done."
Brief pause to let that feeling land.

**Moment 2 — The surprise:**
After the pause, a **4th empty gray slot** smoothly slides onto the progress bar from the
right. Unexpected — one more thing.

Crest bubble: *"One more thing, {Name}."*
*"Let's show you a few more tools Anasta has for you."*

→ Auto-advance to tools slides (Screen 25).

---

### Screen 25 — `toolsSlides` (3 slides)

A swipeable 3-slide presentation of additional tools. Clean, premium, fast.
Each slide has a CTA at the bottom — either an action or "Continue."
No forced setup — user chooses what they want.

---

**Slide 1 — Journal**

Visual: animated illustration of the Journal screen, showing the 3 methods.

Title: *"Journal"*
Body: briefly explains the 3 techniques:
- **Daily Journal** — structured daily reflection
- **Morning Pages** — free-form stream of consciousness
- **Free Writing** — open, no rules

Why it helps: reflection builds self-awareness, clarity, and consistency over time.

CTA at bottom: `Continue` (skip if not interested, no pressure)

---

**Slide 2 — Gratitude**

Visual: animated contribution chart (shows how daily gratitude builds over time as a
visual grid — like GitHub contribution graph but for gratitude).

Title: *"Gratitude"*
Body: gratitude during the day has measurable impact on mood, focus, and spiritual life.
Two types in Anasta:
- **Life Gratitude** — things you're grateful for in life overall
- **Daily Gratitude** — what you're grateful for today

At the bottom, a question:
*"Do you want to set Daily Gratitude as a daily task?"*

Two buttons:
- `Set up as daily task` → popup sheet opens → user sets it as a daily task → closes →
  Slide 3
- `Continue` → skip setup, go to Slide 3

---

**Slide 3 — Other tools**

Title: *"Other tools"*
Body: brief list with one-line descriptions:
- ⏱ **Pomodoro** — focused work sessions with built-in breaks
- 📚 **Reading List** — track your books and reading sessions
- 🪣 **Bucket List** — everything you want to do in your lifetime
- 📋 **Notes** — short notes and reminders to yourself

CTA at bottom: `Continue`

---

**After Slide 3 CTA → auto-advance to flame4 (Screen 26)**

**Persists:** `gratitudeDailyTask = true/false` based on Slide 2 choice.

---

### Screen 26 — `flame4` + congrats + recap + final message

**This is one continuous screen with 4 sequential moments:**

---

**Moment 1 — Fourth flame:**
Progress bar, fourth flame lights 🔥. All 4 slots now full.
Warm glow — slightly more celebratory than previous flames, still premium, not gamified.

Congratulations title appears (large, warm):
*"You're ready, {Name}."*

Brief hold — let it land.

---

**Moment 2 — Congrats title moves away:**
The congratulations title smoothly animates off screen (slides up or fades out).
Progress bar stays visible at top throughout.

---

**Moment 3 — Personalized recap cards appear:**
Cards animate in one by one showing everything accomplished. Cards are personalized — only
what THIS user actually set up and confirmed shows up. Nothing is generic.

Two categories of cards, shown together:

**Problems eliminated (from deck1 + deck2 confirmed cards):**
- ✓ *Screen time under control*
- ✓ *Morning and evening protected*
- ✓ *Distractions blocked during focus time*
- ✓ *Procrastination addressed*
- ✓ *Your week is organized*
- ✓ *Prayer in your daily rhythm*
- ✓ *Scripture reading scheduled*
- etc. (only the ones they confirmed Yes on)

**Things set up:**
- ✓ *One habit started*
- ✓ *One challenge running*
- ✓ *Big event added*
- ✓ *Monthly goal set*
- ✓ *Daily gratitude as a task*
- etc. (only what was actually created)

Cards hold on screen for a moment — user reads what they've built.
Loss aversion at its peak: "all of this disappears if I don't continue."

---

**Moment 4 — Cards move away, final message appears:**
Cards smoothly animate off screen.
One final message appears, centered:

*"You are now ready, {Name}."*

Brief pause → auto-advance to paywall.

> **Design note:** This entire screen (flame4 → congrats → recap → final message) should
> feel like a satisfying sequence, not a rushed list. Each moment needs breathing room.
> The recap cards are the emotional climax — this is where loss aversion does its work
> before the paywall. Don't rush it.

---

### Screen 28 — `homeReveal`

**Purpose:** The emotional payoff for everything the user built during onboarding. They
spent 20+ minutes creating their system — now they see it all in one place for the first
time. This must feel like a reveal, not just a navigation.

**Animation — "Before/After" approach:**

1. Home screen opens **completely empty** — no tasks, no events, nothing. Just the bare
   skeleton of the Home screen. Brief pause (~800ms). Let the emptiness land.

2. Elements animate in **one by one, top to bottom**, each with a soft haptic:
   - Big Event countdown appears first (most visual, sets the tone)
   - Daily tasks slide in (spiritual first if any, then routine)
   - Habit appears
   - Weekly strip at the bottom fills in last

3. Each element has its own entrance animation — not all the same. Big event might scale in,
   tasks slide from left, habit fades in. Varied but rhythmic.

4. When everything is in place — brief pause (1s).

5. Crest bubble appears:
   *"This is your Home, {Name}."*
   *"You built all of this."*

6. Second bubble after short pause:
   *"Let us show you how to use it."*

→ Auto-advance to gestureTutorial (no CTA needed)

**Persists:** nothing new — everything was already saved during setup.

---

### Screen 29 — `gestureTutorial` + `firstCheckoff` ★ EMOTIONAL PEAK

**This is one continuous guided flow on the real Home screen.**
Spotlight moves from element to element. Crest bubble guides each step.
Redosled je tačan i ne menja se: Skip → Unskip → Long press → Check (ostaje čekiran).

---

**STEP 1 — SKIP**

Spotlight on one of the user's tasks (pick a non-spiritual one — routine or habit).
Crest bubble: *"Swipe right to skip a task."*
*"It's a choice — not a failure."*

→ User swipes right on the task
→ Task moves to "skipped" state (visual change — grayed, strikethrough, or moved)
→ Medium haptic

---

**STEP 2 — UNSKIP**

Spotlight stays on the same (now skipped) task.
Crest bubble: *"Changed your mind? You can always bring it back."*

→ User taps the skipped task (or swipes back — whatever the app's gesture is)
→ Task returns to normal state
→ Light haptic

---

**STEP 3 — LONG PRESS**

Spotlight moves to a different task.
Crest bubble: *"Long press to see your progress and details."*

→ User long presses the task
→ Analytics/detail sheet opens (shows progress, streak, stats)
→ Crest bubble briefly: *"Everything you complete builds here."*
→ User closes the sheet (or it auto-closes after a moment)
→ Light haptic on open

---

**STEP 4 — FIRST CHECKOFF ★ (emotional peak)**

Spotlight moves to the most meaningful task available:
- If user has a spiritual task → that one (morning prayer, scripture reading)
- Otherwise → first routine task or habit

Crest bubble:
*"Now — complete your first task."*

→ User taps the task
→ **The moment:**
   - Strong haptic (the strongest in the whole onboarding)
   - Warm checkmark animation — smooth, satisfying, premium
   - Warm sound fires simultaneously with haptic
   - Task transitions to "done" state

- Spiritual task → *"Marked as prayed."* (never "Task completed")
- Regular task → *"Done."*

→ **Day 1** marker appears — calm, not flashy. Just there.
→ Task stays checked. It is now part of the user's real data.

**→ REVIEW MODAL fires here, at this exact moment.**
This is the highest-converting placement for a review request — the user is at their
emotional peak, they just completed something, they feel the app working. Not at the end
of onboarding, not after the paywall — HERE.

The review modal appears on top of the Home screen with the checked task still visible
behind it. The user sees what they built, feels what they just did, and is asked to rate.

After review modal (whether they rate or dismiss) → auto-advance to `privacy`.

**Persists:** task completion, streak `Day 1 = true`, review requested flag.

---

### Screen 31 — `privacy`
- Quiet, minimal, line-by-line fade in. Lands hardest right after private spiritual content.
- `No cloud.` · `No AI.` · `Your inner life stays on your device.` · closing: `Your data is
  yours alone.`
- Honestly mention backup/export somewhere (no cloud = loss if phone lost). CTA `Continue`.

### Screen 32 — `paywall`
- Premium, clean. Eyebrow `Anasta Premium`. Title `How your free trial works`.
- Timeline: `Today — Unlock your full Anasta` · `Day 6 — We remind you before it ends` ·
  `Day 7 — $12.99/month unless you cancel`
- Plans: ○ Monthly $12.99/month (secondary small: "about $2.99/week") · ● Annual $XX/year — Save
  X% [BEST VALUE]
- CTA `Start 7-Day Free Trial` · under: `No payment today. Cancel anytime.`
- Small link: `Have a creator code?` (opens input, not a separate screen). On valid code:
  celebratory micro-beat + carry discount.
- Persists: `selectedPlan`, `promoCode`.
- Pricing is placeholder — confirm. Premium pricing intentional (price signals quality, lifts
  conversion). Weekly equivalent shown, not daily (daily $0.43 feels cheap).

### Screen 33 — `postPaywallBrand` (the Arise comfort)
- Crest, warm golden light. The emotional brand payoff.
- `You built your first rhythm.`
- `It's human to fall. It's not human to stay down.`
- `God still loves you when you stumble. Just arise, and keep walking.`
- `Arise, and become who you are called to be.`
- CTA `Enter Anasta`

### Screen 34 — `postPaywallProfile` (age + gender)
- Marketing data, now that the user is committed (and these are the demographics of people who
  *convert* — better targeting data).
- `Help us understand who Anasta serves.`
- `How old are you?` — Under 18 / 18-24 / 25-34 / 35-44 / 45-54 / 55+ (TikTok/Meta-aligned)
- `Are you male or female?` — Male / Female
- Persists: `ageBracket`, `gender`.

### Screen 35 — `accountCreation`
- `Save your progress and unlock Anasta on this device.`
- Continue with Apple / Google / Email. Everything created in onboarding binds to the account.
- Persists: `userId`, auth token.

---

## 5. Global Elements

- **Progress bar:** visible from Screen 9. 3 empty slots → after 3rd flame, 4th slot animates
  in. Flame = gold, warm glow, not gamified.
- **Resumable:** every setup action saves immediately. A user who quits at 6 min returns to a
  partially built system.
- **Secular filter (1% case):** `secularFilter = true` → blue (spiritual) cards hidden,
  spiritual task setup skipped, Bible/Prayer remains a quiet free mention. Same skeleton with a
  flag — NOT a separate onboarding. Don't over-build for a segment that's 1%.
- **Real-screen rule:** onboarding behavior via wrapper/preview props; never change a real
  screen's default behavior. Persist only expected data.
- **Spiritual language everywhere:** "Marked as prayed" not "completed"; "Begin again today"
  not red overdue. Prayer ≠ chores.

---

## 6. Per-Feature Value Principle (DON'T LOSE THIS)

Even though the structure is card-deck-driven, **every feature still gets its "why" before or
as it's set up** — this is the wow/value beat from earlier versions, preserved:
- Organize → the diagnosis cards + weekly reveal ARE the value demonstration
- Focus → the screen-time stats + 23-min fact + YOU WASTE/GET BACK ARE the wow
- Bible → the favorites-by-meaning reveal IS the value
- Habits → tied to a goal (the "twice as powerful" framing)
- Each tool → Journal gets a hero preview
The user never sees a bare feature; they always feel why it matters first.

---

## 7. Implementation Rules

1. Check active step order before polishing — inactive screens show nothing on device.
2. Real screens stay real (wrapper/preview props).
3. **Persist everything** the user creates.
4. One-sentence response copy where the user answers rapidly.
5. Review modal at `firstCheckoff` peak, not the end.
6. Honesty on blockers — no "blocked" claims until Apple entitlement ships.
7. Feel is a requirement — haptics, full-refresh-rate transitions, the check-off celebration,
   protective confirmations on destructive actions (so a stray tap can't ruin a streak).
8. No empty ceremony steps — tap = transition.
9. Spotlight overlay must be smooth; build custom if libraries aren't premium enough.

---

## 8. Open Questions

1. Did-you-know card Yes/No responses — finalize neutral copy.
2. Apple entitlement status — determines whether Focus section has real setup or value-only.
3. Pricing — confirm monthly/annual numbers and creator-code discount math.
4. Cut commitment question — keep cut, or re-add as cheap A/B test if conversion is weak?
5. Goals/commitment screens — currently cut (diagnosis covers it); confirm staying cut.
6. Secular filter — v1 or fast-follow v2? (Christian path perfect first.)
7. Promo code validation UX on invalid/expired codes.
8. Confetti on Welcome — council says remove; confirm quiet golden light only.
9. Flame vs candle/"Day 1" for streak — your brand call (flame stays, rendered subtle).
10. Backup/export honesty line placement (no-cloud caveat).
11. Card illustrations — commission all deck + value-slide art.
12. Guessed-vs-real threshold — 1.5× or fixed 2h+ gap.
