# Anasta Onboarding v4 Implementation Plan

## Non-Negotiable Guardrail

- Do not edit real app tool behavior for onboarding. Existing tools may be shown through onboarding-only overlays, mock previews, guided wrappers, or existing guided props, but their default runtime behavior, persistence, navigation, gestures, and shared components must remain unchanged.
- Do not delete the current onboarding implementation wholesale. Replace and add screens incrementally inside onboarding code.
- Keep the work primarily inside `components/onboarding/OnboardingView.tsx` and onboarding-only helper files/assets.

## Current Code Shape

- Entry route: `app/onboarding.tsx` renders `components/onboarding/OnboardingView.tsx`.
- Existing reusable pieces to keep:
  - `OnboardingPreload` for Screen 1 loading.
  - `WelcomeSlide` for Screen 2 welcome.
  - `NameIntroSlide` shell/animations for Screen 3, adjusted to collect name + tradition only.
  - Value phone/mockup components and screen-time visualization components.
  - `ScreenTimeSlider`, `ProtectCalculationSlide`, `ProtectReframeSlide` pieces for Screen 14-15.
  - `ChapterCheckpointSlide` / flame rail visual language for flame screens.
  - `PaywallSlide` as the base for Screen 33 paywall, with pricing copy updated later when confirmed.
  - `GuidedOverlayHost` and guided context only where already supported.

## New Step Order

1. `welcome`
2. `conversation`
3. `valueOrganize`
4. `valueDiscipline`
5. `valueFocus`
6. `valueFaith`
7. `valueTools`
8. `toolsIntroA`
9. `toolsIntroB`
10. `statementsIntro`
11. `tutorialDeck`
12. `protectDeck`
13. `screenTimeSlider`
14. `dayVisualization`
15. `protectRecap`
16. `setupProtect`
17. `flameProtect`
18. `organizeDeck`
19. `organizeRecap`
20. `setupOrganize`
21. `weeklyReveal`
22. `flameOrganize`
23. `giftMoment`
24. `bibleWalkthrough`
25. `prayerBook`
26. `flameGrow`
27. `toolsSlides`
28. `flameTools`
29. `privacy`
30. `paywall`
31. `homeReveal`
32. `firstCheckoff`
33. `postPaywallBrand`
34. `postPaywallProfile`
35. `accountCreation`

Note: The blueprint text has numbering drift around the paywall/climax section. The product order requested in the latest blueprint is preserved: build value, privacy/paywall, then reveal/home/checkoff/post-paywall/account.

## Build Sequence

### Phase 0: Shell and State
- Replace `StepId` with the v4 linear step list.
- Extend `Answers` with `tradition`, `isOrthodox`, `secularFilter`, `confirmedProtectProblems`, `confirmedOrganizeProblems`, `phoneHours`, `gratitudeDailyTask`, `age`, and `gender`.
- Replace `stepOrder` with a linear order that skips spiritual deck cards only via local onboarding state.
- Keep preload and welcome unchanged.

### Phase 1: Intro Screens
- Convert `NameIntroSlide` into `ConversationSlide`: name input, tradition options, then auto-advance.
- Expand value slides from 3 to 5 using existing value visual components where possible.
- Add `toolsIntroA` and `toolsIntroB` as auto-advancing full-screen statement slides.
- Add `statementsIntro` with progress rail and deck preview mock.

### Phase 2: Deck System
- Add an onboarding-only `SwipeStatementDeck` using `react-native-gesture-handler` + Reanimated.
- Add tutorial deck with 3 cards and retry-on-no logic.
- Add protect deck with 6 cards and local persisted answer array.
- Add organize deck with 11 cards and local persisted answer array.
- Use onboarding-owned image assets when present; otherwise use icon/gradient illustration placeholders.

### Phase 3: Protect Section
- Reuse `ScreenTimeSlider` for the standalone Screen 14.
- Build `dayVisualization` from existing screen-time stat components, with 24h breakdown, waste, and get-back sections.
- Add `protectRecap` as a card-summary home base with screen-time stakes panel.
- Build `setupProtect` as onboarding-only setup cards for Screen Time, DND, and Website Blocker. Do not modify real blocker/focus tools.
- Use existing flame/checkpoint styling for `flameProtect`.

### Phase 4: Organize Section
- Add `organizeRecap` as card-summary home base.
- Build `setupOrganize` as onboarding-only setup cards for Big Events, Monthly Goals, and Task System. Use existing guided tools only if they already support guided mode; otherwise mock locally.
- Add `weeklyReveal` as an onboarding-only weekly plan preview.
- Use existing flame/checkpoint styling for `flameOrganize`.

### Phase 5: Grow and Tools
- Add `giftMoment`.
- Build `bibleWalkthrough` as an onboarding-only preview/walkthrough; do not change Bible/Favorites/Bible Notes implementation.
- Build `prayerBook` as an onboarding-only preview with Orthodox-specific copy based on `tradition`.
- Add `flameGrow` with surprise fourth slot.
- Add `toolsSlides` for Journal, Gratitude, and other tools. Gratitude setup toggles local onboarding state only unless a real safe persistence API already exists.
- Add `flameTools` with personalized recap.

### Phase 6: Conversion and Finish
- Add `privacy`.
- Keep `PaywallSlide` base, update placement and CTA copy if needed.
- Add `homeReveal` and `firstCheckoff` as onboarding-only Home preview/checkoff sequence unless existing Home guided flow can be used without modifying it.
- Add `postPaywallBrand`, `postPaywallProfile`, and `accountCreation`.

## Verification

- Run TypeScript/build check after each major phase.
- Run Expo web only as a layout smoke test.
- Phone testing required for all gestures, haptics, deck swipes, slider feel, flame timing, and first-checkoff feedback.
