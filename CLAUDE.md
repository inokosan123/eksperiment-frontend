# Eksperiment Frontend Rules

## Do Not Touch Daily-Christian

- This project is `C:\Users\User\Desktop\eksperiment-frontend`.
- `C:\Users\User\Desktop\Daily-Christian` may be used only as a read-only reference.
- Never edit, delete, format, move, or write files inside Daily-Christian.

## Animation Standard

- Interactive animations must be built for real phone performance.
- Use `react-native-gesture-handler` and `react-native-reanimated` for gestures, swipes, drag interactions, sheets, selectors, toggles, task check/skip feedback, and anything that follows a finger.
- Do not use `PanResponder` or JS-thread `Animated.Value` for new interactive animations.
- Lottie is only for decorative or non-blocking animation. Do not put heavy Lottie on task check/skip or other frequent actions.
- Test animation feel on iOS/Android, not only web.

## Task Feedback

- Task interactions should update optimistically first, then save to SQL.
- Keep check/skip feedback light: Reanimated micro-motion plus haptic, no heavy sound or confetti on the critical path.

## Regression Safety

- Before making changes, understand the existing flow around the touched component and preserve current behavior unless the user explicitly asks to change it.
- Keep edits narrowly scoped so fixes in one screen do not accidentally affect other app areas.
- Pay special attention to shared components, task flows, scripture flows, navigation, persistence, and overlays; changes there must not create bugs, layout regressions, broken taps, or degraded behavior in existing elements.
- After editing, run the lightest relevant verification available and call out any parts that still need phone testing.
