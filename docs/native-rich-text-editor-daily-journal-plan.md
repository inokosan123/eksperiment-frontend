# Native Rich Text Editor — Daily Journal pilot and app-wide rollout

> Status: implementation specification and source of truth  
> Last researched: 2026-07-27  
> First target: Daily Journal  
> Final target: one consistent rich-text experience everywhere in Anasta

## 1. Objective

Replace the current WebView-based rich-text editing experience with a reliable native editor that feels like part of iOS, while keeping Anasta's visual identity and protecting every journal entry from data loss.

Daily Journal is the pilot because it is the hardest real case in the app: one scrollable screen can contain multiple rich editors, prompt blocks can be added, deleted, and reordered, the screen autosaves, the date can change, and the fixed `Finish` action competes for the same bottom space as the keyboard toolbar. If the solution is correct here, the simpler editor screens can reuse it safely.

This is not only a visual toolbar replacement. It is a coordinated change to:

- the editing engine;
- keyboard and scrolling behavior;
- selection and formatting state;
- autosave and SQL write ordering;
- HTML compatibility and migration;
- accessibility and device support;
- the shared editor API and rollout strategy.

The release standard is: no lost text, no stale save overwriting newer text, no keyboard-covered caret, no duplicate formatting toolbars, no obvious keyboard jump, and no regression in existing saved formatting.

## 2. Product decision

### 2.1 Final on-screen behavior

Use one custom Anasta formatting toolbar for the currently focused rich-text field.

- When no rich editor is focused, the toolbar is absent and reserves no empty space.
- When the software keyboard is open, the toolbar sits directly above it and follows the keyboard's movement.
- The current permanent toolbar above every editor is removed from the final experience.
- The system selection menu remains available for Cut, Copy, Paste, Select, and Select All. We do not add a second Bold/Italic/Underline row to that menu.
- Tapping a toolbar command must preserve the current selection, focus, and open keyboard.
- When a normal `TextInput` is focused, the rich-text toolbar does not appear.
- While Daily Journal is being edited, the fixed `Finish` footer is hidden. It returns when the keyboard closes; the editor toolbar and `Finish` must never overlap.
- Opening Customize, changing the journal date, reordering/deleting a prompt, leaving the screen, or pressing Finish first flushes the affected editor content safely.

### 2.2 Recommended native stack

Use:

1. [`react-native-enriched-html`](https://github.com/software-mansion/react-native-enriched-html) as the native rich-text input/display engine, behind an Anasta-owned adapter.
2. [`react-native-keyboard-controller`](https://kirillzyusko.github.io/react-native-keyboard-controller/) to coordinate keyboard movement, screen insets, and the single sticky toolbar.
3. The existing Expo SQLite persistence layer, upgraded with a per-entry write coordinator so overlapping autosaves cannot reorder or lose content.

Why this direction:

- `react-native-enriched-html` uses native text views rather than a hidden browser/contenteditable bridge.
- It supports the exact required v1 feature set: Bold, Italic, Underline, bulleted lists, and numbered lists.
- It supports React Native 0.81–0.86 and requires the New Architecture, which matches this project (Expo SDK 54, React Native 0.81.5, New Architecture enabled).
- Its uncontrolled model lets native text editing remain native instead of rerendering the whole Daily Journal on every keystroke.
- Keyboard Controller is already compatible with the project's RN generation and provides a UI-thread-aware way to keep a custom toolbar attached to the keyboard.

Important limitation: the native editor contains native code and does **not** work in Expo Go. It must be tested with a custom Expo development build and a release/TestFlight build. Expo Go can retain a strictly development-only legacy fallback during migration, but Expo Go is not an acceptance environment for this feature.

### 2.3 Rejected primary alternatives

| Alternative | Why it is not the default |
| --- | --- |
| Keep the current custom WebView editor | It sends full HTML over the JS bridge on every input, uses deprecated `document.execCommand`, duplicates a toolbar for every field, and needs manual caret/height messaging. It is the source of the complexity we are removing. |
| TenTap/Tiptap | Despite providing a native-looking toolbar, its editor surface is WebView/ProseMirror-based. It preserves many of the keyboard, selection, bridge, and nested-scroll risks of the current solution. |
| Pell (`react-native-rich-editor`) | Also WebView/contenteditable-based and has a long history of cursor, scrolling, and loading edge cases. |
| Build a complete UIKit editor from scratch | Maximum control, but substantially more code, QA surface, and maintenance risk. Reserve this for a narrow patch or future advanced editing requirements. |
| React Native core `InputAccessoryView` as the only toolbar host | RN documentation still lists problems with multiline text inputs and bottom tab bars, and the selected editor does not expose an `inputAccessoryViewID`. A narrow UIKit accessory integration remains a fallback only if Keyboard Controller cannot meet the phone tests. |

## 3. Current implementation audit

### 3.1 Shared editor

The current [`components/shared/RichTextEditor.tsx`](../components/shared/RichTextEditor.tsx) is a WebView containing a `contenteditable` document.

Current risks:

- formatting relies on deprecated browser `document.execCommand` behavior;
- every editor owns its own permanent React Native toolbar;
- the Bold, Italic, and Underline buttons reflect active state, but list state is not represented consistently;
- toolbar controls are approximately `34 × 31`, below Apple's recommended default `44 × 44 pt` interaction region;
- every input event sends the entire `innerHTML` string to JavaScript;
- auto-height is calculated inside WebView and passed across the bridge;
- caret visibility is implemented through a custom browser `getBoundingClientRect()` message;
- `getHTML()` depends on bridge messaging and a 250 ms timeout;
- content-key changes rebuild/remount the editor, which can discard focus and selection;
- there is no deliberate policy for the extra iOS keyboard accessory/predictive UI;
- the editor implementation leaks WebView-specific assumptions into every consumer.

The component is used by Daily Journal, Free Writing, Morning Pages, Notes, Gratitude, Bible Notes, Ideal Self, Scripture Reader, and Scripture Bible Notes. Replacing it without an adapter would create a large, risky all-at-once rewrite.

### 3.2 Daily Journal is the highest-risk screen

[`components/journal/DailyEntryView.tsx`](../components/journal/DailyEntryView.tsx) can render several prompt editors plus the free-writing editor inside one outer `ScrollView`.

Current risks specific to this screen:

- each prompt and free-writing section owns a separate toolbar and format state;
- editor HTML is lifted into parent React state on every keystroke, so a single character can rerender a large screen and sibling editors;
- multiple auto-height WebViews live inside an outer scroll container;
- caret scrolling uses manual keyboard listeners, `Dimensions`, and immediate/non-native scroll calculations;
- prompt add/delete/reorder can invalidate a focused editor ref and its selection;
- opening Customize can compete with an open editor and keyboard;
- `editorContentKey` remounts editor instances during hydration/date changes;
- autosave is debounced by roughly 350 ms but operates on React snapshots that may already be stale;
- an unmount-triggered async save cannot be awaited by React;
- there is no explicit flush when `AppState` becomes `inactive` before the app reaches `background`;
- a quick Finish/back/date-switch sequence can overlap with a pending debounce or database write.

There is also an existing content-semantic issue: [`components/journal/journalLogic.ts`](../components/journal/journalLogic.ts) does not count `freeWritingHtml` in the Daily Journal content check. A day containing only free writing can therefore be treated as empty for Finish/task-completion logic. The pilot must fix and test this behavior.

### 3.3 Guided Daily flow compatibility

[`components/journal/DailyGuidedEntryView.tsx`](../components/journal/DailyGuidedEntryView.tsx) currently displays some rich HTML as plain text and converts edited plain text back to HTML.

Required safeguard:

- opening, navigating through, or finishing the guided flow must never destroy formatting in an untouched field;
- if a user deliberately edits a guided plain-text field, normalization may be expected for that field in the first phase, but it must be documented and covered by a test;
- a future migration can reuse the native editor in the guided flow after the main Daily pilot is stable.

### 3.4 Current save ordering is unsafe under overlap

[`components/journal/JournalContext.tsx`](../components/journal/JournalContext.tsx) optimistically merges an entry, awaits the database, and then merges the returned entry again. It has no per-date serialized queue or monotonic save token.

[`components/journal/journalDb.ts`](../components/journal/journalDb.ts) upserts the full journal entry and deletes/reinserts all prompt/check/scale child rows within a transaction.

Potential failure sequence:

1. Save A starts with older content.
2. The user types more and Save B starts with newer content.
3. Save B finishes first.
4. Save A finishes later and its older full-entry snapshot becomes the latest context/SQL state.

Additional database concern: Expo documents that `withTransactionAsync` is not exclusive; other asynchronous queries started while it is active may join the transaction. Since the journal shares the user-content database, blindly changing to an exclusive transaction could instead introduce contention or locking elsewhere. The correct first fix is serialization/coalescing at the journal repository/coordinator boundary, followed by measured evaluation of `withExclusiveTransactionAsync`.

### 3.5 Authoritative remaining-consumer inventory

Daily is the only real screen currently connected to the native adapter. Every
consumer below deliberately remains on the legacy editor until Daily passes the
custom-build phone gate. This inventory is based on current imports, storage
fields, and save code rather than on route names alone.

| Consumer | Persisted contract and current lifecycle | Required migration safeguard |
| --- | --- | --- |
| [`DailyEntryView.tsx`](../components/journal/DailyEntryView.tsx) | `JournalEntry.prompts[].answer` and `freeWritingHtml`; 750 ms autosave plus blur, Finish, back, date-switch, Customize, structure-change, guided-navigation, inactive/background, and unmount boundaries. | Pilot implementation. Keep stable `date + promptId` IDs, inner-fragment HTML storage, the serialized per-date write queue, and one screen toolbar. Physical-device gates remain mandatory. |
| [`DailyGuidedEntryView.tsx`](../components/journal/DailyGuidedEntryView.tsx) | Reads Daily rich HTML through a plain-text guided flow and may write an intentionally edited field back as normalized HTML. | Opening or traversing the guide must not rewrite untouched markup. A deliberately edited guided field needs an explicit, tested normalization rule before this flow adopts the native editor. |
| [`FreeWritingView.tsx`](../components/journal/FreeWritingView.tsx) | `JournalEntry.freeWritingHtml`; approximately 350 ms autosave, manual Finish/back, unmount snapshot, task completion, and read-only mode. | Replace the boolean-dirty autosave with the same revision-aware journal coordinator. Flush native HTML before Finish/date exit; never let an older write clear a newer dirty revision. |
| [`MorningPagesView.tsx`](../components/journal/MorningPagesView.tsx) | `JournalEntry.morningPagesHtml` and derived `morningPagesWordCount`; approximately 350 ms autosave, manual Finish/back, unmount snapshot, task completion, word target, and read-only mode. | Flush once, derive both HTML and word count from that same snapshot, then enqueue one atomic patch. Preserve target/count UI and use revision-aware clean-state handling. |
| [`GratitudeView.tsx`](../components/inner-tools/GratitudeView.tsx) | `GratitudeEntry.title` plus rich `content`; manual Save/Cancel inside a custom modal, with `RichCommentText` on saved cards. | Give the modal one local provider/toolbar. Imperatively flush before Save so the final character and formatting-only changes are included; preserve Cancel/discard semantics and do not let the plain title input activate the rich toolbar. |
| [`NotesView.tsx`](../components/inner-tools/NotesView.tsx) | `Note.content`, color/title/type, and `sourceRefs`; rich segments are serialized around Scripture quote tokens. Manual Save and unsaved-change confirmation; current Save already calls `getHTML()`. | Preserve `buildEditorBlocks`/quote-token round trips exactly. Flush the rich segment before serialization and dirty comparison, keep draggable quote blocks outside the native editor, and verify close-after-keyboard plus discard behavior. |
| [`IdealSelfView.tsx`](../components/inner-tools/IdealSelfView.tsx) | Rich `vision` and `relationshipWithGod` values in both the initial multi-step flow and later edit sheet; manual saves and read-only `RichCommentText` cards. | Migrate both entry points together. Replace WebView-specific fixed-height/tall-sheet assumptions, keep stable source HTML during a session, flush before Continue/Save, and preserve list fields that remain normal text inputs. |
| [`BibleNotesView.tsx`](../components/inner-tools/BibleNotesView.tsx) | Three rich fields—`observations`, `lessons`, and `application`—saved together per book/chapter; manual Save, deep-link back behavior, open-in-Scripture save, delete, and guided preview. | Use one provider and one toolbar for all three editors. `flushAll()` must produce one atomic chapter snapshot before Save, Scripture navigation, chapter change, or close; field IDs must include book/chapter/field. |
| [`ScriptureBibleNotesSheet.tsx`](../components/scripture/ScriptureBibleNotesSheet.tsx) | The same three chapter fields, but with autosave, collapsed/expanded motion, reference switching, unmount fallback, retry state, and a local save version. | Combine native dirty IDs with a per-reference revision. Flush all three fields before autosave, collapse, reference switch, delete, and unmount; a failed/old save must not mark a newer chapter draft clean. The sheet gesture and keyboard toolbar must remain independent UI-thread interactions. |
| [`ScriptureReaderView.tsx`](../components/scripture/ScriptureReaderView.tsx) comment modals | `ScriptureAnnotation.comment`; add/edit category flow, unsaved confirmation, saved preview, and onboarding-only guided auto-typing that repeatedly calls `setHTML(..., false)`. | Migrate last. Preserve category/verse state, make programmatic guided typing non-dirty until its explicit completion, flush before Save/close checks, and keep one toolbar per presented modal. Test edit-existing, guided read-only, selection, and overlay exit animation separately. |
| [`RichCommentText.tsx`](../components/shared/RichCommentText.tsx) read-only surfaces | Shared renderer used by Gratitude, Ideal Self, Scripture Reader previews, and My Favorites. | Move consumers to the Anasta read-only adapter only after Gate G proves paragraph/list/line-height parity. Saved HTML must render consistently whether its editor screen has migrated or not. |

Rollout order after Daily passes on a physical iPhone:

1. Free Writing, then Morning Pages (single editor, but first upgrade their save revisions).
2. Gratitude (single modal and manual save).
3. Notes (manual save plus quote-token serialization).
4. Ideal Self (two editor entry points and WebView-specific sheet sizing).
5. Bible Notes full-screen editor (three-field atomic manual save).
6. Scripture Bible Notes sheet (three-field autosave and reference changes).
7. Scripture Reader comments (guided programmatic typing and multiple modal modes).
8. Remaining read-only `RichCommentText` surfaces, followed by removal of the legacy WebView implementation.

Each screen or presented modal owns its own `RichTextEditorProvider` and exactly
one keyboard toolbar. Only the low-level Keyboard Controller boundary may live
at the app root; active-editor state must never leak between routes or sheets.

## 4. Proposed architecture

### 4.1 Keep third-party code behind an Anasta adapter

Create a focused module, for example:

```text
components/shared/rich-text/
  NativeRichTextEditor.tsx
  RichTextEditorProvider.tsx
  RichTextKeyboardToolbar.tsx
  RichTextRenderer.tsx
  richTextHtml.ts
  richTextTypes.ts
  __tests__/
```

No screen should import third-party editor types directly. The adapter owns version-specific workarounds and exposes a stable app API.

Suggested imperative interface:

```ts
export interface RichTextEditorRef {
  focus(): void;
  blur(): void;
  getHTML(): Promise<string>;
  setHTML(html: string): void;
  toggleBold(): void;
  toggleItalic(): void;
  toggleUnderline(): void;
  toggleBulletedList(): void;
  toggleNumberedList(): void;
  flush(): Promise<string>;
}
```

The adapter should accept stable `editorId`, `defaultValue`, typography/theme props, accessibility metadata, focus/blur callbacks, a lightweight dirty callback, and optional auto-growth/caret-layout callbacks. It must not expose WebView messages or require controlled HTML on every key.

### 4.2 One screen-scoped editor provider

`RichTextEditorProvider` belongs at screen level, not app-global level. It manages:

- editor refs keyed by stable `editorId`;
- the currently focused editor;
- Bold/Italic/Underline/list active state from native `onChangeState`;
- dirty editor IDs and generation/date tokens;
- toolbar command routing;
- `flushEditor(id)` and `flushAll()`;
- keyboard visibility and the toolbar/Finish-footer handoff.

Stable IDs are mandatory. Prompt array indices cannot be editor IDs because reordering changes them.

### 4.3 Native editor remains uncontrolled

Initial HTML is passed through `defaultValue`. Full HTML is fetched only when a save boundary is reached. Do not store the complete document in parent React state on every keystroke.

The native library warns that `onChangeHtml` performs HTML serialization on every change and recommends `getHTML()` when saving. `onChangeText` also extracts text and must be benchmarked before it is used as a dirty signal.

Implementation order:

1. Try `onChangeText` solely as a dirty notification and ignore its payload.
2. Measure long-document typing and Daily screen rerenders on physical devices.
3. If it is costly, add a narrow no-payload native `onContentChange` event in the adapter/maintained patch rather than returning to per-key HTML serialization.

### 4.4 Journal draft and save coordinator

Add a Daily Journal-specific coordinator, conceptually `JournalDraftSaveCoordinator`, which owns the latest draft independently of render state.

Responsibilities:

- cache the latest flushed HTML per stable editor ID;
- maintain a monotonically increasing local draft revision;
- coalesce rapid dirty notifications;
- allow only one database write in flight per journal date;
- ensure the next queued write is built from the newest complete draft;
- mark clean only if the completed revision still equals the latest requested revision;
- retain dirty state and retry after a persistence error;
- reject late results from an old date/editor generation;
- expose `flush(reason)` with explicit reasons for logging and tests.

Recommended debounce target is 750 ms (acceptable tuning range 600–1000 ms), not one SQL write per character. The exact delay is less important than correct flush boundaries and write ordering.

Required flush boundaries:

- active editor blur or focus switch;
- app transitions to `inactive` or `background`;
- navigation `beforeRemove`/back;
- Finish;
- journal date change;
- entering/exiting guided navigation;
- opening Customize;
- prompt delete or reorder;
- screen unmount as best-effort final backup.

The route date is immutable inside one editor session. If Expo Router changes the `date` parameter without first unmounting the screen, an outer session gate keeps the old date and its editor registry mounted, awaits a successful save, and only then remounts the provider/content under the newest requested date. A failed save leaves the old entry visible and dirty; a later successful Retry re-triggers the pending switch. Never reset hydration or editor IDs directly from a new route date while the old session is still dirty.

For destructive/structural prompt actions: flush the active editor, blur it, dismiss the keyboard, wait for confirmed local draft capture, then mutate prompt structure. Do not delete or move the ref while its selection is active.

Use monotonic timestamps if the schema continues to depend on `updatedAt`, for example `max(Date.now(), previousUpdatedAt + 1)`, so two saves within one millisecond remain ordered. Prefer in-memory revisions first; add a persisted revision only if cross-session conflict handling requires it.

Do not immediately replace every SQLite transaction with an exclusive transaction. First add per-date serialization. Then test whether `withExclusiveTransactionAsync` improves isolation without locking tasks, Scripture, or other user-content writers. If used, keep its callback short and add busy/retry handling.

### 4.5 HTML compatibility contract

Define an explicit accepted subset rather than trusting each engine's arbitrary output:

- paragraphs/line breaks;
- `<strong>`/`<b>`;
- `<em>`/`<i>`;
- `<u>`;
- `<ul>`, `<ol>`, and `<li>`;
- plain text, Unicode, emoji, and common HTML entities.

Nested lists are out of scope for v1 because the selected engine supports one list level. Toolbar and copy must not imply indentation/nesting support.

Build a golden corpus from existing production-style entries:

- empty value and whitespace-only value;
- plain one-line and multiline text;
- `<div>`/`<br>` combinations emitted by the current WebView;
- mixed bold/italic/underline;
- ordered and unordered lists;
- empty list item and list followed by paragraph;
- emoji, apostrophes, ampersands, non-Latin text, and entities;
- malformed but currently tolerated HTML;
- 1,000-word and 5,000-word documents.

The requirement is semantic and visual equivalence, not byte-for-byte HTML equality. Normalization must be deterministic and idempotent: normalizing an already normalized document must not keep changing it.

Do not enable the library's experimental `useHtmlNormalizer` by default. Validate it against the golden corpus first or own a small app-specific normalizer with tests.

No bulk database migration is needed initially. Convert/normalize a record only after a successful native edit/save, while read-only rendering must continue to support legacy HTML. Keep a backup/rollback window before deleting the legacy path.

Keep the SQL/storage shape and the native transport shape deliberately different:

- SQL stores only the canonical inner fragment, for example `<p>Grace <strong>today</strong>.</p>`;
- iOS and Android receive exactly one outer `<html>...</html>` wrapper at the adapter/display boundary;
- empty native input is transported as `<html><p></p></html>` but persists as an empty string;
- `getHTML()` output is canonicalized back to the inner fragment before it reaches the draft/save coordinator.

This wrapper is mandatory, not cosmetic. The installed `react-native-enriched-html@1.0.0` Android implementation checks `startsWith("<html>") && endsWith("</html>")`, and its iOS parser performs the same boundary check after whitespace normalization. Without the wrapper and with `useHtmlNormalizer={false}`, a stored fragment can be treated as plain text instead of styled HTML. Regression tests must prove that wrapping is single, deterministic, and exactly reversible.

## 5. Daily Journal screen design specification

### 5.1 Toolbar layout

The toolbar should feel like a quiet native extension of the keyboard, not a floating feature card.

- Full available width, directly above the software keyboard.
- Warm white/neutral surface from existing app tokens.
- `1 px` top divider or a very subtle shadow; no heavy border, glow, or bounce.
- Nominal toolbar height: `48 pt`; `52 pt` is acceptable if required by the bottom/safe-area layout.
- Horizontal padding: `12 pt`.
- Gap between compact controls: approximately `4 pt`.
- Every command has at least a `44 × 44 pt` hit target even if the visible icon is smaller.
- Icon size: approximately `18–20 pt`.
- Commands: Bold, Italic, Underline, bulleted list, numbered list, separator, Done/dismiss keyboard.
- Keep the layout usable at `320 pt` width. Prefer compact icons and one short `Done` action; never shrink touch targets below the accessibility target merely to fit.
- Inactive color: existing secondary text/ink token.
- Active format: existing gold accent with a subtle tinted background, for example the app gold and roughly `14%` opacity behind the control.
- Disabled state: visibly lower contrast but still identifiable.
- No spring or bounce. Movement follows system keyboard timing and honors Reduce Motion.

### 5.2 Editor typography and spacing

- Body font remains aligned with the journal's reading identity: EBGaramond or the project's established journal serif.
- Starting text size: `17 pt`, matching iOS's common body-text default.
- Starting line height: approximately `27–29 pt`, finalized by testing the real font metrics, not copied blindly from CSS.
- Internal horizontal padding: `12–14 pt`.
- Internal vertical padding: `12–14 pt`.
- Preserve paragraph and list rhythm across edit and read-only renderers.
- Keep the caret at least `16 pt` above the toolbar when the screen scrolls it into view.
- Respect font scaling/Dynamic Type. Never disable scaling globally to protect layout.

### 5.3 Focus, scroll, and keyboard behavior

- Focus feedback should feel immediate. Target visible focus/keyboard response within 100 ms on a physical phone under normal conditions.
- The outer Daily scroll view, not the inner editor, owns page scrolling while editors grow naturally.
- When the caret moves below the visible region, scroll only the minimum necessary distance and use native/keyboard-coordinated movement.
- Never guess the caret position from line count, font size, or HTML length.
- Do not use JS-thread `Animated.Value`/`Animated.timing` or `PanResponder` for the keyboard toolbar. This project requires Gesture Handler/Reanimated for interactions, and Reanimated's own `useAnimatedKeyboard` is currently deprecated for this use because of iOS 26 issues. Use Keyboard Controller for this integration.
- Start the Daily pilot with `keyboardDismissMode="none"` or carefully tested `"on-drag"`. Do not enable iOS interactive dismissal until the open Keyboard Controller iOS 26 lag/stuck issues have been proven absent on our device matrix.
- Keep the toolbar mounted until the close animation completes; otherwise it can vanish before the keyboard and make the content jump.
- Configure `keyboardShouldPersistTaps` so formatting taps and prompt controls do not accidentally dismiss the keyboard before their action runs.

### 5.4 Software, floating, and hardware keyboards

- Software keyboard: toolbar sticks above it.
- Hardware keyboard: when a rich editor is focused but the software keyboard height is zero, show the same toolbar docked above the screen safe area so formatting remains discoverable.
- iPad floating keyboard: controller APIs may report zero keyboard height; a bottom-docked toolbar is an acceptable documented behavior for v1, provided it does not cover text.
- Support or preserve standard hardware shortcuts where the native editor provides them, especially Command-B, Command-I, and Command-U. Do not implement shortcuts by intercepting ordinary typing.

### 5.5 Accessibility

Every toolbar control requires:

- an explicit label: `Bold`, `Italic`, `Underline`, `Bulleted list`, `Numbered list`, and `Dismiss keyboard`;
- selected state for active formats;
- disabled state where applicable;
- logical VoiceOver order;
- at least a `44 × 44 pt` default touch target;
- visible focus/pressed state and sufficient contrast;
- compatibility with larger text, VoiceOver, Full Keyboard Access, and Reduce Motion.

Read-only journal content should remain selectable where practical. If the native input's `editable={false}` disables selection/interactions, use the dedicated read-only renderer only after its typography parity is verified.

## 6. Upstream risks and mandatory decision gates

These are release gates, not optional polish.

### Gate A — Native build compatibility

Prove the pinned editor version builds and runs with Expo SDK 54, RN 0.81.5, New Architecture, and the app's minimum iOS version in both custom development and release configurations.

The current stable editor release is `1.0.0` (2026-06-16). Pin the exact verified version. Do not track a floating range during the pilot.

### Gate B — Existing HTML round-trip

Load every golden HTML fixture, edit at several positions, save, reload from SQLite, and compare semantic/visual output. No data or formatting may silently disappear.

### Gate C — Caret visibility in the real Daily layout

The editor currently does not expose caret screen coordinates; [issue #469](https://github.com/software-mansion/react-native-enriched-html/issues/469) indicates the maintainer does not currently plan this API. This matters because Daily uses multiple auto-height editors inside one outer scroll view.

Spike in this order:

1. Native auto-growth plus Keyboard Controller's keyboard-aware scrolling.
2. Test deep caret movement in three or more prompt editors and 1,000+ words.
3. Test selection changes, tapping earlier paragraphs, list editing, and keyboard reopen.
4. If the caret can still be obscured, add a narrow, upstreamable native `onCaretRectChange`/`getCaretRect` API behind the Anasta adapter.

Do not ship a JavaScript line-height/character-count approximation.

### Gate D — iOS 26 keyboard motion

Expo SDK 54 recommends Keyboard Controller `1.18.5`; begin with that compatible pinned version instead of blindly installing the newest package.

Recent upstream reports describe iOS 26 interactive-dismissal failures: stuck midway ([#1562](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1562)), sticky content lag/jump ([#1563](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1563)), and position mismatch during drag ([#1557](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1557)). The pilot avoids interactive dismissal until verified.

If the pinned controller still fails acceptance tests, the fallback is a narrowly scoped UIKit `inputAccessoryView` integration in the editor adapter/fork—not a new JS-thread keyboard animation.

### Gate E — Styled selection stability

[`react-native-enriched-html` issue #709](https://github.com/software-mansion/react-native-enriched-html/issues/709) reports an iOS 26 selection-handle drag across formatted ranges causing React Native touch-registry desynchronization and a debug SIGABRT in another RN generation. The maintainer could not reproduce it at the time of research.

Stress-test selection handles across bold/italic/list boundaries on this project's RN 0.81 build, on physical iOS 18 and iOS 26 devices, in debug and release. If reproduced, release is blocked until we pin a verified fix or maintain a tested patch.

### Gate F — Dirty event and typing performance

Measure the native editor with long text and multiple simultaneous Daily editors. The `/rich-text-lab` screen exposes render count, dirty-event count, keyboard latency, flush latency/failures, and deterministic 1,000-/5,000-word programmatic documents for this gate. Programmatic hydration must not increment dirty events. If `onChangeText` extraction causes missed frames, replace it with a no-payload native change signal. Full HTML must never flow into parent React state per keystroke.

### Gate G — Read-only renderer parity

An open renderer line-height problem is tracked in [issue #608](https://github.com/software-mansion/react-native-enriched-html/issues/608); [PR #724](https://github.com/software-mansion/react-native-enriched-html/pull/724) was not merged/released when this document was written. Do not depend on an unreleased PR.

Verify typography, paragraph spacing, lists, selection, and accessibility using the released renderer. If parity is not acceptable, either use a verified pinned patch or keep a temporary read-only legacy renderer behind the adapter while editing is migrated. Do not mix visible editor styles indefinitely.

### Gate H — Undo and large paste

Imperative undo/redo and `canUndo` state are not currently available ([issue #675](https://github.com/software-mansion/react-native-enriched-html/issues/675)). The current app does not expose undo/redo controls, so they remain out of the v1 toolbar. Preserve native OS undo behavior where available; do not fake history by snapshotting HTML.

Large paste has had an inconclusive report ([issue #225](https://github.com/software-mansion/react-native-enriched-html/issues/225)). Test at least 1,000-word rich and plain-text paste, plus a 5,000-word usable-document target.

## 7. Implementation phases

Implementation checkpoint (2026-07-27): the native path is enabled only in the EAS `development` profile. Preview and production builds intentionally remain on the legacy editor until the physical-device gates below pass. Expo Doctor passes 18/18 checks; TypeScript, 39 targeted logic tests, targeted rich-text lint, a default web export, and an Android Hermes export containing the editable and read-only native dependencies have passed. A fresh Expo Go Metro process also serves the full iOS development bundle with HTTP 200. The two optional Tiptap menu packages are overridden to `3.20.4`, matching the editor's pinned Tiptap stack, so `npm ls` no longer reports an invalid peer tree. A bounded native-flush timeout now rejects lost bridge promises without clearing the dirty draft, formatting-only commands explicitly mark the native document dirty, and programmatic hydration—including an empty editor—consumes its native plain-text echo without marking untouched data dirty. A save snapshot captures its revision before awaiting native HTML, so input arriving during the bridge call retains a newer dirty revision and its newly scheduled debounce. Terminal boundaries blur input and retry bounded snapshots until the newest revision is clean, failing closed instead of navigating with an unsaved draft. Daily shows an honest retry state after a failed save, same-route date changes save before remounting, and the native library's outer `<html>` transport wrapper is added only at the native boundary and removed before storage so existing inner-HTML records stay consistent. Development-only metrics capture render, keyboard, flush, queue, and SQL timings for the phone gate. Actual-route Daily Journal web preflights at 390 x 844 and 320 x 844 prove that the toolbar fits at the narrow target, only one toolbar appears, `Finish` is hidden while editing, `Done` removes the toolbar and restores `Finish`, and a formatting-button tap does not dismiss the toolbar. A separate read-only Daily preflight confirms that the display path has no toolbar or legacy WebView fallback message. The provider includes a delayed dismissal fallback for web, hardware-keyboard, and zero-height-keyboard states in which the keyboard controller can remain logically visible after editor blur, and the root Keyboard Controller provider is absent whenever the pilot feature flag is off so unrelated screens keep their previous keyboard context. None of those checks replace the outstanding custom-build iOS phone tests.

The physical-device laboratory has also been upgraded for the phone gate: it records dirty-event counts alongside render and latency metrics, includes a normal `TextInput` negative control, exercises multiple editable fields and the native read-only renderer together, and can programmatically load deterministic 1,000- and 5,000-word documents without falsely marking them dirty.

Current verification supersedes the earlier 39-test checkpoint: 48 targeted tests now pass. The additional coverage proves that rapid/coalesced native hydration echoes cannot create false autosaves, literal user text containing angle brackets is never parsed as HTML during `onChangeText`, Expo Go cannot eagerly evaluate Keyboard Controller through an accidental runtime import, and one-shot route generation contains only real files below `app/`. Keyboard Controller now has one guarded lazy loader; the root provider, keyboard-aware scroll view, toolbar, Daily screen, and laboratory all cross that boundary only when both the native-build and public pilot flags are enabled. A normal `TextInput` focus also clears a blurred rich toolbar while a genuine keyboard-dismissal animation keeps the sticky view mounted until the keyboard has travelled off screen.

### Phase 0 — Baseline and safety net

- [x] Record the existing saved HTML forms and create the golden corpus.
- [x] Add tests for `hasDailyJournalContent`, including a day with only `freeWritingHtml`.
- [x] Add development-only instrumentation for committed editor renders, dirty-event count, focus-to-keyboard latency, flush duration/failures, save queue depth, SQL duration/failures, and last persisted revision; physical-phone baselines remain to be recorded.
- [x] Add a feature flag, e.g. `nativeRichTextEditor`, with a controlled rollback path.
- [x] Confirm current dirty worktree before every edit; do not overwrite unrelated changes.

Exit: we can compare the new path against repeatable current behavior.

### Phase 1 — Isolated native editor laboratory

- [x] Install exact Expo-compatible native dependency versions.
- [x] Install the Expo SDK-compatible development client required for an iPhone pilot build.
- [ ] Build a custom iOS development client; do not judge native behavior in Expo Go.
- [x] Implement the Anasta adapter and ref API.
- [x] Implement HTML normalization/fixtures and semantic round-trip tests.
- [x] Enforce the installed library's exact native `<html>...</html>` transport contract while keeping SQL on canonical inner fragments.
- [x] Build a development-only phone laboratory with a normal-input negative control, multiple editor focus handoff, read-only parity, metrics, and programmatic 1,000-/5,000-word document scenarios.
- [x] Place every Keyboard Controller runtime dependency behind one guarded lazy loader and add a source-level regression test so Expo Go cannot evaluate native bindings while the feature is disabled.
- [x] Queue and bound programmatic hydration echoes so rapid `setHTML` calls and coalesced native events do not schedule false autosaves.
- [x] Normalize the library's already-plain `onChangeText` payload without parsing literal angle-bracket text as markup.
- [ ] Verify B/I/U/bulleted/numbered formatting and active-state events.
- [ ] Test autocorrect, predictive text, dictation, emoji, paste, selection handles, and hardware shortcuts.
- [ ] Resolve Gates A, B, E, F, G, and H before connecting real journal persistence.

Exit: one isolated editor is stable, visually correct, and compatible with existing HTML.

Development operation: after installing or replacing Keyboard Controller, restart Metro with `expo start --clear`. Metro can cache a missing codegen-spec lookup from the installation window and continue reporting `Unable to resolve ./specs/KeyboardExtenderNativeComponent` even though the file is present. Do not patch `node_modules` for that symptom: verify the installed file first, restart the bundler, then request a fresh iOS bundle. The 2026-07-27 occurrence was resolved this way and the rebuilt iOS bundle returned HTTP 200.

Expo Router 6.0.24 also has a Windows watcher defect: its current outside-root check recognizes `../` but not the `..\` returned by `path.relative()` on Windows. A newly added component or test can therefore be inserted into `.expo/types/router.d.ts` as a false `/../components` or `/../tests` route; rapid events can even leave concatenated declarations. Anasta's `npm start` commands now run `scripts/generate-expo-router-types.cjs` first, validate that the declaration contains `/rich-text-lab` and no `/../` route, and set Expo's official `EXPO_NO_TYPESCRIPT_SETUP=1` only for that Metro process so the faulty live watcher cannot rewrite it. Typed routes remain enabled and are refreshed on each restart; `npm run typegen:routes` performs the same verified refresh without restarting. Do not run a static Expo export concurrently with the long-lived development server, and never hand-edit the generated declaration.

### Phase 2 — Keyboard toolbar and scrolling spike

- [x] Add the screen-scoped provider and one sticky toolbar.
- [x] Integrate the pinned Keyboard Controller version and required provider.
- [x] Disable keyboard preload for the pilot to avoid first-focus/startup flicker.
- [x] Implement the software/hardware/floating-keyboard fallback behavior; physical verification remains pending.
- [x] Implement toolbar/Finish-footer handoff.
- [ ] Integrate the outer scroll view and prove caret visibility with multiple auto-growing editors.
- [ ] Resolve Gates C and D, including the native caret-rect fallback if required.

Exit: the toolbar never duplicates, jumps, covers text, or loses selection on supported test devices.

### Phase 3 — Correct save pipeline before visual rollout

- [x] Implement per-date serialized/coalesced writes.
- [x] Introduce monotonic local draft revisions and generation/date-aware editor IDs.
- [x] Build every SQL patch from the newest complete draft, not a stale component closure.
- [x] Keep dirty state when a write fails; retry and surface a subtle honest state if the failure persists.
- [x] Add explicit flush boundaries for autosave, editor blur, Finish, guided navigation, Customize/structure changes, app backgrounding, route removal, and unmount fallback.
- [x] Mark B/I/U/bulleted/numbered commands dirty inside the adapter so a formatting-only edit is persisted even when the library correctly emits no plain-text change event.
- [x] Suppress programmatic `defaultValue`/`setValue` text echoes, including the empty-string case, so merely opening an existing or blank entry never schedules a false autosave.
- [x] Capture each save revision before awaiting native `getHTML()` and leave any debounce created by newer input intact; an older flush cannot acknowledge or strand a newer draft.
- [x] At Finish, back, date change, guided navigation, and inactive/background boundaries, blur input and retry bounded snapshots until clean; fail closed instead of navigating with a newer unsaved revision.
- [x] Inject artificial persistence delay/errors and prove an older completed write cannot commit stale UI state while the newest queued draft still persists. (A real-device SQLite contention run remains part of the phone matrix.)
- [ ] Evaluate exclusive SQLite transactions only after journal serialization is correct and cross-feature contention is tested.

Exit: rapid typing/navigation/app-background sequences cannot lose or roll back content.

### Phase 4 — Daily Journal integration

- [x] Replace editable prompt WebViews with adapter instances keyed by stable date/prompt IDs behind the development flag.
- [x] Replace the editable inline free-writing editor behind the development flag.
- [x] Remove per-editor permanent toolbars from the native path.
- [x] Stop lifting full HTML into parent state on each key in the native path.
- [x] Flush/blur safely before prompt delete/reorder and Customize in the native path.
- [x] Preserve content across same-route date changes with a save-before-remount session gate, and flush before guided-flow navigation; physical-device verification remains pending.
- [x] Fix free-writing-only completion detection without making standalone Free Writing masquerade as Daily Journal.
- [x] Run actual-route Daily web preflights at 390 x 844 and 320 x 844 for narrow-width fit, the single-toolbar rule, formatting-button focus, `Done`, and the `Finish` handoff; native keyboard motion and persistence still require the phone matrix.
- [x] Use the released native `EnrichedText` renderer for read-only Daily content and share the 17 pt / 28 pt typography, padding, list markers, scaling, selection color, and HTML transport contract with the editor; line-height/list parity still requires the physical Gate G matrix.
- [ ] Run the full Daily acceptance matrix on phone.

Exit: Daily Journal is production-ready behind the flag and the legacy path can be selected instantly if a release blocker appears.

### Phase 5 — Staged app-wide rollout

After Daily is stable, follow the per-consumer order and safeguards in section
3.5. Do not treat all Bible or Scripture integrations as one change: their
manual-save, autosave, reference-switch, and guided-typing lifecycles are
different acceptance surfaces.

For each family:

- [ ] inventory its save, navigation, sheet, and read-only behavior;
- [ ] reuse the same adapter/provider/toolbar—no screen-specific editor forks;
- [ ] preserve its current data contract;
- [ ] run focused regression tests and physical-phone keyboard tests;
- [ ] release behind the same flag/controlled cohort if available.

Only after every consumer passes:

- [ ] remove the production WebView editor path;
- [ ] remove unused WebView-only bridge/height/cursor code;
- [ ] remove temporary Expo Go fallback if no longer needed;
- [ ] document the final shared component contract.

## 8. Required test matrix

### 8.0 Custom iOS gate execution recipe

This gate changes external EAS/Apple state and may consume build quota, so start
it only after explicit authorization.

Execution status (2026-07-27): local authorization and preflight are complete.
EAS CLI authenticates as owner `p1b2`, and the app resolves to the existing
project `@p1b2/eksperiment-frontend`
(`0d7cabc8-20b3-49cb-84f0-1036c47910d3`) when the native-build flags are set.
There are currently no iOS builds for this project, and `eas device:list`
reports that no Apple team is connected to the Expo account. The next action
therefore requires the Apple Developer account holder to complete the
interactive team/credentials step and register the test iPhone before EAS can
produce an installable physical-device development build. Do not create a
second EAS project: the existing project linkage is correct.

1. Confirm the test iPhone has Developer Mode enabled (required on iOS 16+).
2. If its UDID is not already part of the project's ad hoc provisioning set,
   run `eas device:create` and finish registration on that iPhone. A build made
   before the device is registered cannot be installed on it.
3. Run `eas build --platform ios --profile development`. The checked-in
   development profile already sets `developmentClient: true`, internal
   distribution, a physical-device target, and both native-editor flags.
4. Install the resulting `.ipa` from the EAS build page's Install/QR flow (or
   Expo Orbit). Do not scan the normal Expo Go QR as proof of this gate.
5. Stop the Expo Go Metro process before starting the development-client Metro
   process; two concurrent Expo watchers can race the generated typed routes.
6. Run `npm run start:dev-client:clear`. That script sets
   `ANASTA_NATIVE_BUILD=1` and `EXPO_PUBLIC_NATIVE_RICH_TEXT_EDITOR=1` for the
   local manifest and starts Expo with `--dev-client`.
7. From the installed Anasta development client, connect to that LAN server and
   first open `/rich-text-lab`. Confirm the manifest reports
   `extra.nativeRichTextEditor: true`, then complete Gates A, B, E, F, G, and H.
8. Only after the laboratory passes, run the complete Daily workflow/lifecycle
   matrix below and record device, iOS version, build ID, results, and measured
   diagnostics in this document.

JavaScript-only fixes can reuse the installed client. Rebuild when a native
dependency, config plugin, entitlement, deployment target, or native app config
changes.

### 8.1 Devices and builds

- Small iPhone widths: approximately 320 and 375 pt.
- Current standard iPhone and a device with home indicator.
- Minimum supported iOS, iOS 18, and iOS 26.
- iPad full screen and split view.
- iPad software, floating, and hardware keyboards.
- Custom development build and Release/TestFlight build; some native crashes differ between debug and release.
- Android smoke test even though iOS is the primary acceptance platform.

### 8.2 Editing behavior

- Plain typing, rapid typing, autocorrect, predictive text, dictation, emoji, non-Latin/Cyrillic, CJK, and RTL smoke test.
- B/I/U at the caret and over a selection.
- Formatting-only edit followed immediately by `Done`, back, Finish, background, and relaunch; the style must survive without requiring an additional typed character.
- Mixed selections across formatted/unformatted text.
- Bulleted/numbered list creation, conversion, empty items, newline, backspace, and exit from a list.
- Copy/paste rich HTML and plain text.
- Tap and drag selection handles repeatedly across style boundaries.
- Dismiss/reopen keyboard without losing selection or active-state truth.
- Toolbar tap does not blur the editor.
- Format state includes list buttons, not only B/I/U.

### 8.3 Daily Journal workflows

- Three or more prompt editors plus free writing on the same screen.
- Add, delete, and reorder prompts with and without a focused editor.
- Open Customize while editing.
- Focus a deep field, type below the fold, move caret to an earlier paragraph, then back to the end.
- Switch dates rapidly while a debounce and database write are pending.
- Press Finish/back rapidly after the last character.
- Enter and leave guided mode without altering untouched rich HTML.
- Finish a day containing only inline free-writing HTML.
- Long entry: 1,000 and 5,000 words.
- Large paste while several editors are mounted.

### 8.4 Lifecycle and failure behavior

- Open Control Center/Notification Center (`AppState` may become `inactive`).
- App switch, background, lock phone, incoming-call interruption, terminate, and relaunch.
- Simulated slow database and injected write failure.
- Two saves complete out of order in the test harness; older content never wins.
- Screen unmounts while a save is pending.
- Low-memory/navigation remount restores the latest saved draft.
- Open an existing formatted entry and a completely blank entry, perform no interaction, wait past autosave, background, and return; neither entry may be rewritten or receive a new `updatedAt` solely from hydration.

Do not use a hard reload of the statically exported web build as evidence for SQLite/native persistence. Expo SQLite's OPFS worker can retain an open sync access handle across that artificial reload and fail with `NoModificationAllowedError`/`unable to open database file`; that is a web-hosting test-harness limitation, not an iOS persistence result. Verify persistence through ordinary in-app navigation in the web smoke test and through background, terminate, and relaunch in the custom iOS build.

### 8.5 Accessibility and visual QA

- VoiceOver labels, order, selected state, and dismissal.
- Large Dynamic Type sizes without clipped controls or unusable editing area.
- Reduce Motion.
- Full Keyboard Access and hardware shortcuts.
- Light/dark behavior if the screen supports both.
- Toolbar and caret clear the safe area, tab bar, sheet, and home indicator.
- Edit and read-only HTML have equivalent typography and list spacing.

## 9. Performance and quality budgets

These are project acceptance targets, not claims from Apple:

- No whole Daily Journal rerender for each character.
- Keyboard and toolbar motion should sustain the device refresh rate; target 60 fps on supported 60 Hz phones.
- Visible focus feedback target: at most 100 ms in normal physical-device use.
- No normal input operation should introduce a main-thread stall over 100 ms.
- No more than one in-flight journal database write per date.
- A 5,000-word entry remains editable without crashes or unusable input lag.
- A 1,000-word paste completes without crash, lost formatting, or permanent UI freeze.
- No SQL write on every keystroke.
- Development instrumentation records editor render count, HTML serialization duration, save queue depth, save duration, and last successful revision.

Quality rules:

- keep changes narrow and protect unrelated Home, task, Scripture, navigation, and overlay behavior;
- do not silently swallow persistence failures;
- do not introduce nightly/unreleased dependencies into production without a pinned audited patch;
- do not expose vendor APIs throughout the app;
- do not claim completion until physical-device tests pass;
- keep the legacy implementation available only for staged rollback, then delete it after the app-wide rollout is verified.

### 9.1 Dependency-advisory baseline

`npm audit --omit=dev` currently reports 40 transitive findings (1 low, 15 moderate, 23 high, 1 critical). The critical `shell-quote` path is `react-native@0.81.5 -> react-devtools-core@6.1.5 -> shell-quote@1.8.3`; it is not introduced by the rich-text editor. `react-native-enriched-html` itself is not listed as a vulnerable package in this report. The audit does list the existing Expo/React Native toolchain and the newly required `expo-dev-client` through their transitive chains.

Do not run `npm audit fix --force`: the suggested remediations can cross the supported Expo SDK/React Native version boundary. Track this as a separate dependency-remediation task, upgrade through an Expo-supported SDK path, rerun Doctor/build/regression gates, and repeat the advisory check immediately before release.

## 10. Definition of done for the Daily pilot

Daily Journal is done only when all of the following are true:

- [ ] There is exactly one rich-text toolbar on screen.
- [ ] It appears only for a focused rich editor and moves with the keyboard without a jump.
- [ ] The `Finish` footer and toolbar never overlap.
- [ ] B/I/U/bulleted/numbered commands preserve focus and selection.
- [ ] Formatting-only changes persist across autosave, immediate exit, and relaunch.
- [ ] Active-format state is correct for both caret and selected ranges.
- [ ] The caret stays visible in every prompt and free-writing field.
- [ ] Existing saved HTML loads without semantic data loss.
- [ ] New HTML saves and reloads with equivalent formatting.
- [ ] A stale save cannot overwrite a newer draft.
- [ ] Backgrounding, back, Finish, date switch, Customize, prompt reorder/delete, and guided navigation flush correctly.
- [ ] A free-writing-only Daily entry counts as content.
- [ ] The guided flow does not destroy untouched rich formatting.
- [ ] Accessibility and physical-device test matrices pass.
- [ ] Debug and Release/TestFlight builds pass the iOS styled-selection stress test.
- [ ] No unrelated journal, task, Scripture, navigation, or sheet regression is found.

## 11. Definition of done for the full goal

The complete goal is done only when:

- Daily Journal meets its definition of done;
- every current rich-text consumer uses the same shared native adapter and visual toolbar behavior;
- each consumer's existing data and navigation behavior is regression-tested;
- the production WebView editor and duplicate fixed toolbars are removed;
- the final editor architecture and supported HTML subset are documented;
- the app has a verified rollback/recovery story for saved user content;
- physical iOS testing confirms a consistent, premium experience throughout the app.

## 12. Sources and verification notes

Sources were checked on 2026-07-27. Open issue and pull-request status can change; re-check them immediately before dependency pinning and before release.

### Editor

- [React Native Enriched — repository and compatibility](https://github.com/software-mansion/react-native-enriched-html)
- [React Native Enriched input API and performance guidance](https://github.com/software-mansion/react-native-enriched-html/blob/main/docs/INPUT_API_REFERENCE.md)
- [React Native Enriched releases](https://github.com/software-mansion/react-native-enriched-html/releases)
- [Caret-coordinate request #469](https://github.com/software-mansion/react-native-enriched-html/issues/469)
- [iOS styled-selection crash report #709](https://github.com/software-mansion/react-native-enriched-html/issues/709)
- [Read-only line-height issue #608](https://github.com/software-mansion/react-native-enriched-html/issues/608)
- [Open read-only line-height PR #724](https://github.com/software-mansion/react-native-enriched-html/pull/724)
- [Undo/redo request #675](https://github.com/software-mansion/react-native-enriched-html/issues/675)
- [Large paste report #225](https://github.com/software-mansion/react-native-enriched-html/issues/225)

### Keyboard and React Native

- [Expo SDK 54 Keyboard Controller guidance](https://docs.expo.dev/versions/v54.0.0/sdk/keyboard-controller/)
- [KeyboardStickyView API](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-sticky-view)
- [Keyboard Controller installation](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/installation)
- [Keyboard Controller compatibility](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/guides/compatibility)
- [Keyboard Controller FAQ](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/faq)
- [Keyboard Controller iOS 26 issue #1562](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1562)
- [Keyboard Controller iOS 26 issue #1563](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1563)
- [Keyboard Controller iOS 26 issue #1557](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1557)
- [React Native `InputAccessoryView` and documented limitations](https://reactnative.dev/docs/inputaccessoryview)
- [React Native 0.81 `AppState`](https://reactnative.dev/docs/0.81/appstate)
- [React Native 0.81 `ScrollView` keyboard props](https://reactnative.dev/docs/0.81/scrollview)
- [Reanimated `useAnimatedKeyboard` deprecation/iOS 26 notice](https://docs.swmansion.com/react-native-reanimated/docs/device/useAnimatedKeyboard/)
- [Expo development builds — why native libraries require a custom client](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo — create and install an iOS device development build](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/)
- [Expo — connect an installed development client to Metro](https://docs.expo.dev/develop/development-builds/use-development-builds/)

### Apple design and platform guidance

- [Apple Human Interface Guidelines — Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Apple Human Interface Guidelines — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple Human Interface Guidelines — Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards)
- [Apple Human Interface Guidelines — Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)
- [UIKit `UIResponder.inputAccessoryView`](https://developer.apple.com/documentation/uikit/uiresponder/inputaccessoryview)
- [UIKit `UITextView`](https://developer.apple.com/documentation/uikit/uitextview/)

### Persistence and considered alternatives

- [Expo SDK 54 SQLite transactions](https://docs.expo.dev/versions/v54.0.0/sdk/sqlite/)
- [TenTap editor](https://github.com/10play/10tap-editor)
- [Pell-based React Native rich editor](https://github.com/wxik/react-native-rich-editor)

## 13. First implementation move

Do not begin by replacing all current editors. Begin with Phase 0 and the isolated Phase 1 laboratory. The first coding milestone is a native editor adapter, golden HTML corpus, and physical-device proof of selection/build stability. Daily Journal integration begins only after those gates pass. That sequence protects user content and keeps the most visually attractive solution from hiding a persistence or native-selection defect.
