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
