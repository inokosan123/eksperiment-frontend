# Anasta fixed typography — iOS release policy

Status: implemented in runtime code on 2026-07-29. Physical-iPhone visual
verification remains before release.

## 1. Authoritative release decision

All app-owned typography renders at the exact size authored in the design.
iOS per-app Text Size, Dynamic Type and accessibility text-size settings must
not enlarge or shrink any app-owned text or input.

There is one state only:

```ts
const appFontScale = 1;
```

This replaces every earlier `100/110`, `ReadableText` allowlist and screen-level
exception. It applies equally to Home, Library, Inner Life, Focus, Prayer,
Scripture, Journal, onboarding, sheets, modals and editors.

## 2. Surfaces covered

The fixed policy includes:

- page and section titles, subtitles and descriptions;
- Home Tasks, TODAY labels, Big Events and Monthly Goals;
- Home Organize cards: Challenges, Habits, Big Events and Monthly Goals;
- Library, Inner Life and Focus cards;
- buttons, tabs, badges, chips, counters, timers and calendar text;
- confirmation and error copy;
- every React Native `Text` and `TextInput` owned by the app;
- React Native `Animated.Text` and Reanimated `Text`;
- prayer and Scripture reading text;
- Journal, Notes, Gratitude and Bible Notes content;
- native rich-text editor/display and the Expo Go WebView fallback;
- placeholder, list-marker and user-authored text inside editors.

Native operating-system UI outside the app's ownership is not restyled by this
policy. VoiceOver labels remain complete even when visible compact text is
intentionally truncated.

## 3. Runtime enforcement

### 3.1 React Native text

The Babel policy in `scripts/babel-plugin-fixed-native-text.cjs` transforms all
app-owned native text call sites to end with:

```tsx
allowFontScaling={false}
maxFontSizeMultiplier={1}
```

The transform covers imported `Text`, `TextInput`, React Native
`Animated.Text`, and Reanimated `Text`. It skips `node_modules`.

Direct scaling props are removed and the fixed props are appended after spread
props. Therefore neither an old `allowFontScaling={true}` nor `{...props}` can
accidentally re-enable scaling.

### 3.2 Compatibility wrappers

`ReadableText`, `ReadableTextInput`, `useReadableFontScale`, and the geometry
helpers remain temporarily available so this release does not require a risky
wide refactor. Their behavior is now fixed:

- wrapper styles are passed through unchanged;
- `useReadableFontScale()` always returns `1`;
- font metrics always return their authored values;
- no wrapper reads `useWindowDimensions().fontScale`.

The old names are compatibility names, not opt-ins.

### 3.3 Native rich text

Native rich-text editor and display components use
`allowFontScaling={false}`. Their font size, line height, list markers, padding
and caret geometry all receive the fixed scale `1`.

### 3.4 WebView rich text

The Expo Go fallback uses fixed pixel CSS and declares:

```css
html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
```

This prevents WebKit text autosizing from creating a second scaling path.

## 4. Layout invariants

- Authored `fontSize` and `lineHeight` are not recalculated from system scale.
- Hidden measurement text and visible animated text use identical metrics.
- Strike lines, highlights and JS height estimates use the same fixed metrics.
- A live iOS Text Size change must not alter card height, wrapping, truncation,
  editor geometry or scroll position.
- Changing the system setting must never write content, trigger autosave,
  reorder data, complete a task or reset navigation.
- Existing wrapping and truncation remain product decisions of each screen.

## 5. Regression checks

Automated checks must prove:

1. raw `Text` and `TextInput` receive fixed props;
2. Animated and Reanimated text receive fixed props;
3. explicit opt-ins and spread props cannot bypass the policy;
4. dependencies in `node_modules` are not rewritten;
5. every system scale input resolves to `1`;
6. font, line-height and Ribbon first-frame geometry stay unchanged;
7. the actual Expo Babel pipeline installs the transform;
8. TypeScript, lint and an iOS/Hermes export pass.

## 6. Physical-iPhone release matrix

Compare the same screens at:

- a smaller-than-default per-app Text Size;
- default Text Size;
- one step above default;
- 150%;
- maximum accessibility size.

The following must be pixel-stable at every setting:

- Home Tasks and the TODAY tag;
- all four Home Organize cards;
- Home Monthly Goals and Big Events;
- representative Library, Inner Life and Focus cards;
- prayer and Scripture reader text;
- Journal and Notes editor plus read-only content;
- a sheet, confirmation modal, calendar and onboarding screen.

If any app-owned glyph, line break, card height or input geometry changes, the
release check fails.

## 7. Acceptance criteria

- No app-owned text grows or shrinks with iOS Text Size.
- All brand typography stays at its authored `100%` metrics.
- Native and Expo Go rich editors match at every tested system setting.
- Existing animations, taps, persistence and navigation remain unchanged.
- TypeScript, targeted tests, lint, Expo iOS export and phone checks pass.

## References

- [React Native Text props](https://reactnative.dev/docs/text)
- [React Native TextInput props](https://reactnative.dev/docs/textinput)
- [React 19 upgrade guide — function `defaultProps` removal](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [Apple typography guidance](https://developer.apple.com/design/human-interface-guidelines/typography)
