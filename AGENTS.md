# Eksperiment Frontend Agent Rules

## Hard Boundary

- Work only inside `C:\Users\User\Desktop\eksperiment-frontend`.
- `C:\Users\User\Desktop\Daily-Christian` is reference-only. Read/copy patterns from it, but never edit, delete, format, move, or write files there.

## Animation Performance Standard

- User-facing touch interactions must feel instant on real phones.
- For gestures, swipes, drag, sheet motion, segmented controls, toggles, task check/skip feedback, and anything that follows a finger, use `react-native-gesture-handler` plus `react-native-reanimated`.
- Avoid `PanResponder`, `Animated.Value`, `Animated.timing`, `Animated.spring`, and JS-thread driven gesture animations for new interactive UI.
- Lottie is allowed for decorative, non-blocking animations that are already on screen or run away from core input. Do not use Lottie as the primary feedback for task check, skip, or other high-frequency actions.
- Any new animation should be tested on phone, not judged only by web.

## Task Interaction Rule

- Check, uncheck, skip, pause, and save actions should update optimistically first, then persist to SQL.
- The visual feedback should be light: quick Reanimated motion, haptic where appropriate, no heavy audio or heavy Lottie on the critical tap path.

## Regression Safety

- Before making changes, understand the existing flow around the touched component and preserve current behavior unless the user explicitly asks to change it.
- Keep edits narrowly scoped so fixes in one screen do not accidentally affect other app areas.
- Pay special attention to shared components, task flows, scripture flows, navigation, persistence, and overlays; changes there must not create bugs, layout regressions, broken taps, or degraded behavior in existing elements.
- After editing, run the lightest relevant verification available and call out any parts that still need phone testing.

## Onboarding Isolation Rule

- Onboarding may reference, preview, or visually reuse existing app concepts such as Habits, tasks, Home, Scripture, Prayer Book, Journal, blockers, or focus tools, but onboarding-specific behavior must stay isolated inside onboarding code.
- Do not change how existing app features behave at runtime just to support onboarding. Habits, task cards, journal, Home, Scripture, navigation, persistence, and shared performance should remain the same after onboarding work unless the user explicitly asks to change those real app features.
- Do not delete the existing onboarding implementation while rebuilding or upgrading it. Preserve useful existing onboarding elements and replace screens incrementally.
- If onboarding needs a special mock, animation, data shape, task preview, or guided behavior, create it locally for onboarding or pass explicit preview-only props without changing default shared-component behavior.
- When onboarding needs to demonstrate an existing tool, show it through an onboarding-only overlay, dim layer, guided bubble, mock screen, or preview prop. Do not edit the real tool's runtime behavior, persistence, navigation, gestures, or task logic to satisfy onboarding.
- Never remove app features, shared components, assets, routes, or persistence code as part of onboarding work unless the user explicitly asks for that exact removal.
- Be especially careful with shared components and imported helpers. A change made for onboarding must not make the main app slower, more laggy, visually different, or behaviorally different after the user exits onboarding.
