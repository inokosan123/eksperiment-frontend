import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Reanimated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  ArrowLeft, CheckSmall, Pencil, Plus, Trash2, X,
} from '@/components/icons/Icons';
import Bloom from '@/components/focus-watch/Bloom';
import GoldButton from '@/components/focus-watch/GoldButton';
import HairlineWeave from '@/components/focus-watch/HairlineWeave';
import { C, F } from '@/constants/tokens';
import {
  getTitleBarTopPadding,
} from '@/components/shared/titleBar';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import SetAsDailyTaskCard from '@/components/shared/SetAsDailyTaskCard';
import QuickTaskSheet from '@/components/shared/QuickTaskSheet';
import {
  FormatState,
  RichTextEditor,
  RichTextEditorRef,
  RichToolbar,
} from '@/components/shared/RichTextEditor';
import RichCommentText from '@/components/shared/RichCommentText';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';

import {
  IdealSelfProfile,
  useInnerTools,
} from './InnerToolsContext';

// ─── Types ──────────────────────────────────────────────────────────────────

type StepId =
  | 'vision'
  | 'qualities'
  | 'anasta'
  | 'obstacles'
  | 'actions'
  | 'routines'
  | 'relationshipWithGod'
  | 'spiritualObstacles'
  | 'spiritualActions'
  | 'faithPractice'
  | 'congrats';

type EditField =
  | 'vision'
  | 'qualities'
  | 'obstacles'
  | 'actions'
  | 'routines'
  | 'relationshipWithGod'
  | 'spiritualObstacles'
  | 'spiritualActions'
  | 'faithPractice'
  | null;

type Draft = {
  vision: string;
  qualities: string[];
  obstacles: string[];
  actions: string[];
  routines: string[];
  relationshipWithGod: string;
  spiritualObstacles: string[];
  spiritualActions: string[];
  faithPractice: string[];
};

const EMPTY_DRAFT: Draft = {
  vision: '',
  qualities: [],
  obstacles: [],
  actions: [],
  routines: [],
  relationshipWithGod: '',
  spiritualObstacles: [],
  spiritualActions: [],
  faithPractice: [],
};

// Order matters — used to compute progress dot index. Anasta is intentionally
// excluded from the dot bar (it's a pause, not a question). The flow ends on
// the last input step; saving advances directly to the summary view.
const DOT_STEPS: StepId[] = [
  'vision',
  'qualities',
  'obstacles',
  'actions',
  'routines',
  'relationshipWithGod',
  'spiritualObstacles',
  'spiritualActions',
  'faithPractice',
];
const STEP_FLOW: StepId[] = [
  'vision',
  'qualities',
  'anasta',
  'obstacles',
  'actions',
  'routines',
  'relationshipWithGod',
  'spiritualObstacles',
  'spiritualActions',
  'faithPractice',
  'congrats',
];

const SUGGESTED_QUALITIES = [
  // Spiritual / virtue
  'Discipline', 'Patience', 'Honesty', 'Courage', 'Faith', 'Humility',
  'Self-control', 'Wisdom', 'Kindness', 'Gentleness', 'Steadiness', 'Loyalty',
  // Strength of character
  'Confident', 'Decisive', 'Reliable', 'Authentic', 'Resilient', 'Focused',
  // Action
  'Hardworking', 'Productive', 'Ambitious', 'Organized',
  // Emotional
  'Calm', 'Optimistic', 'Grateful', 'Joyful',
  // Relational
  'Generous', 'Empathetic', 'Present', 'Thoughtful',
  // Physical
  'Strong', 'Healthy', 'Energetic',
];

const BG = '#FAF7F0';
const PARCHMENT = '#F5ECD7';

// ─── Container ──────────────────────────────────────────────────────────────

export default function IdealSelfView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { idealSelf, saveIdealSelf } = useInnerTools();

  // Mode: 'flow' walks the user through the 7 screens, 'summary' shows the
  // existing profile (only available when one exists).
  const initialMode: 'flow' | 'summary' = idealSelf ? 'summary' : 'flow';
  const [mode, setMode] = useState<'flow' | 'summary'>(initialMode);
  const [step, setStep] = useState<StepId>('vision');
  const [draft, setDraft] = useState<Draft>(() => profileToDraft(idealSelf));
  const [editField, setEditField] = useState<EditField>(null);

  const stepIndex = STEP_FLOW.indexOf(step);
  const dotIndex = DOT_STEPS.indexOf(step);

  // Whenever the profile changes externally (after save), keep the local
  // draft in sync so editing-from-summary opens with the latest values.
  useEffect(() => {
    if (mode === 'summary') {
      setDraft(profileToDraft(idealSelf));
    }
  }, [idealSelf, mode]);

  const goBackTopBar = () => {
    if (mode === 'flow' && stepIndex > 0) {
      setStep(STEP_FLOW[stepIndex - 1]);
      return;
    }
    router.back();
  };

  const advance = () => {
    Haptics.selectionAsync().catch(() => {});
    const next = STEP_FLOW[stepIndex + 1];
    if (next) setStep(next);
  };

  const goPrev = () => {
    Haptics.selectionAsync().catch(() => {});
    const prev = STEP_FLOW[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const startRefine = () => {
    setMode('flow');
    setStep('vision');
  };

  const finishFlow = () => {
    const now = Date.now();
    saveIdealSelf({
      // vision/relationshipWithGod are HTML strings from the rich editor —
      // don't trim them or you'll corrupt closing tags. richIsEmpty handles
      // the "looks empty but has markup" case.
      vision: draft.vision,
      relationshipWithGod: draft.relationshipWithGod,
      qualities: draft.qualities.map(item => item.trim()).filter(Boolean),
      obstacles: draft.obstacles.map(item => item.trim()).filter(Boolean),
      actions: draft.actions.map(item => item.trim()).filter(Boolean),
      routines: draft.routines.map(item => item.trim()).filter(Boolean),
      spiritualObstacles: draft.spiritualObstacles.map(item => item.trim()).filter(Boolean),
      spiritualActions: draft.spiritualActions.map(item => item.trim()).filter(Boolean),
      faithPractice: draft.faithPractice.map(item => item.trim()).filter(Boolean),
      createdAt: idealSelf?.createdAt ?? now,
      updatedAt: now,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setMode('summary');
  };

  const updateField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(d => ({ ...d, [key]: value }));
  };

  const saveEditField = (field: Exclude<EditField, null>, value: string | string[]) => {
    if (!idealSelf) return;
    const merged: IdealSelfProfile = {
      ...idealSelf,
      [field]: value,
      updatedAt: Date.now(),
    };
    saveIdealSelf(merged);
    setEditField(null);
  };

  // ── Mode: SUMMARY ────────────────────────────────────────────────────────
  if (mode === 'summary' && idealSelf) {
    return (
      <View style={s.screen}>
        <ScreenTitleBar title="IDEAL SELF" showBack bg={BG} />
        <Summary
          profile={idealSelf}
          onRefine={startRefine}
          onEditField={setEditField}
        />
        <EditFieldSheet
          field={editField}
          profile={idealSelf}
          onClose={() => setEditField(null)}
          onSave={saveEditField}
        />
      </View>
    );
  }

  // ── Mode: FLOW ───────────────────────────────────────────────────────────
  // Note: rich-text steps (Vision / Calling) handle keyboard scrolling inside
  // the WebView. List/chip steps use plain TextInput inside a ScrollView with
  // keyboardShouldPersistTaps. Wrapping everything in a top-level
  // KeyboardAvoidingView fights with both, so we don't.
  return (
    <View style={s.screen}>
      {/* The flow is lit from above — a warm gold breath over the parchment, so
          every question sits in light rather than on a flat sheet. */}
      <View pointerEvents="none" style={s.screenBloom}>
        <Bloom color={C.gold} opacity={0.17} />
      </View>
      {step !== 'anasta' && step !== 'congrats' && (
        <FlowHeader
          dotIndex={dotIndex}
          onBack={goBackTopBar}
          canBack={stepIndex > 0}
          topInset={insets.top}
        />
      )}

      <StepTransition stepKey={step}>
        <StepRenderer
          step={step}
          draft={draft}
          updateField={updateField}
          advance={advance}
          goPrev={goPrev}
          finishFlow={finishFlow}
          insetsBottom={insets.bottom}
        />
      </StepTransition>
    </View>
  );
}

// Cross-fade + small slide-up wrapper that re-runs whenever the step changes.
// Keying on stepKey forces React to mount a fresh tree per step, so the
// animation always starts from the entry pose. Cheap, no shared elements,
// and works for both rich-text and list-based step screens.
function StepTransition({
  stepKey, children,
}: {
  stepKey: string;
  children: React.ReactNode;
}) {
  const opacity = useSharedValue(0);
  const lift = useSharedValue(12);

  useEffect(() => {
    opacity.value = 0;
    lift.value = 12;
    opacity.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
    lift.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) });
  }, [stepKey, opacity, lift]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: lift.value }],
  }));

  return (
    <Reanimated.View key={stepKey} style={[{ flex: 1 }, animatedStyle]}>
      {children}
    </Reanimated.View>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function profileToDraft(profile: IdealSelfProfile | null): Draft {
  if (!profile) return EMPTY_DRAFT;
  return {
    vision: profile.vision,
    qualities: profile.qualities,
    obstacles: profile.obstacles,
    actions: profile.actions,
    routines: profile.routines,
    relationshipWithGod: profile.relationshipWithGod,
    spiritualObstacles: profile.spiritualObstacles,
    spiritualActions: profile.spiritualActions,
    faithPractice: profile.faithPractice,
  };
}

// ─── Top progress bar ──────────────────────────────────────────────────────

function FlowHeader({
  dotIndex,
  onBack,
  canBack,
  topInset,
}: {
  dotIndex: number;
  onBack: () => void;
  canBack: boolean;
  topInset: number;
}) {
  return (
    <View style={[s.flowHeader, { paddingTop: getTitleBarTopPadding(topInset) }]}>
      <TouchableOpacity onPress={onBack} style={s.titleBarBtn} activeOpacity={0.72}>
        <ArrowLeft s={22} c={canBack ? '#5C5752' : '#C9C5BD'} />
      </TouchableOpacity>
      {/* One gold thread that fills as the flow advances — nine tiny dots read
          as debris at this size; a single rail reads as progress. */}
      <View style={s.progressRail}>
        <FlowProgress dotIndex={dotIndex} />
      </View>
      <View style={s.titleBarBtn} />
    </View>
  );
}

function FlowProgress({ dotIndex }: { dotIndex: number }) {
  const reduceMotion = useReducedMotion();
  const target = DOT_STEPS.length <= 1
    ? 1
    : Math.max(0, Math.min(1, (dotIndex + 1) / DOT_STEPS.length));
  const progress = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? target
      : withTiming(target, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion, target]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={s.progressTrack}>
      <Reanimated.View style={[s.progressFill, fillStyle]}>
        <LinearGradient
          colors={['#E0C489', C.gold, '#B8933F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Reanimated.View>
    </View>
  );
}

// ─── Step router ───────────────────────────────────────────────────────────

function StepRenderer({
  step, draft, updateField, advance, goPrev, finishFlow, insetsBottom,
}: {
  step: StepId;
  draft: Draft;
  updateField: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  advance: () => void;
  goPrev: () => void;
  finishFlow: () => void;
  insetsBottom: number;
}) {
  switch (step) {
    case 'vision':
      return (
        <RichStep
          title="Picture your ideal self"
          body="Not your best day. The person you mean to become."
          html={draft.vision}
          onChangeHtml={value => updateField('vision', value)}
          placeholder="Someone disciplined and at peace. A man of his word. Close to God — not just on Sundays. Strong, but gentle…"
          insetsBottom={insetsBottom}
          continueDisabled={richIsEmpty(draft.vision)}
          onContinue={advance}
        />
      );

    case 'qualities':
      return (
        <QualitiesStep
          values={draft.qualities}
          onChange={value => updateField('qualities', value)}
          onBack={goPrev}
          onContinue={advance}
        />
      );

    case 'anasta':
      return <AnastaScreen onContinue={advance} />;

    case 'obstacles':
      return (
        <ListStep
          title="What separates you most from that person?"
          body="The real answer, not the polite one. Naming it is half the battle."
          values={draft.obstacles}
          onChange={value => updateField('obstacles', value)}
          maxItems={3}
          placeholder="A habit, a fear, a weakness…"
          onContinue={advance}
          continueDisabled={draft.obstacles.filter(item => item.trim().length > 0).length === 0}
          tone="warning"
        />
      );

    case 'actions':
      return (
        <ListStep
          title="What can you do every day to come closer?"
          body="A small thing kept beats a great thing abandoned."
          values={draft.actions}
          onChange={value => updateField('actions', value)}
          maxItems={5}
          placeholder="Wake up before 7. Read a few verses with morning coffee…"
          onContinue={advance}
          continueDisabled={draft.actions.filter(item => item.trim().length > 0).length === 0}
          tone="positive"
        />
      );

    case 'routines':
      return (
        <ListStep
          title="What routines does that person keep?"
          body="The rhythms that hold a day together."
          values={draft.routines}
          onChange={value => updateField('routines', value)}
          maxItems={6}
          placeholder="Morning prayer rule. Walk after dinner. Read 10 min before bed…"
          onContinue={advance}
          continueDisabled={false}
          tone="neutral"
          footer="You can schedule these as habits later from your dashboard."
        />
      );

    case 'relationshipWithGod':
      return (
        <RichStep
          title="What relationship with God do you want?"
          body="Not what you should believe. What you long for."
          html={draft.relationshipWithGod}
          onChangeHtml={value => updateField('relationshipWithGod', value)}
          placeholder=""
          insetsBottom={insetsBottom}
          continueDisabled={false}
          onContinue={advance}
        />
      );

    case 'spiritualObstacles':
      return (
        <ListStep
          title="What blocks that relationship most?"
          body="Distraction. Doubt. Pride. The habit of forgetting Him."
          values={draft.spiritualObstacles}
          onChange={value => updateField('spiritualObstacles', value)}
          maxItems={3}
          placeholder="Phone before prayer. Doubt when tired. Forgetting He's there…"
          onContinue={advance}
          continueDisabled={draft.spiritualObstacles.filter(item => item.trim().length > 0).length === 0}
          tone="warning"
        />
      );

    case 'spiritualActions':
      return (
        <ListStep
          title="What can you do every day to draw closer?"
          body="The ones you can keep, even on tired days."
          values={draft.spiritualActions}
          onChange={value => updateField('spiritualActions', value)}
          maxItems={5}
          placeholder="Sign of the cross before phone. One Psalm a day. Five quiet minutes…"
          onContinue={advance}
          continueDisabled={draft.spiritualActions.filter(item => item.trim().length > 0).length === 0}
          tone="positive"
        />
      );

    case 'faithPractice':
      return (
        <ListStep
          title="What does their faith practice look like?"
          body="Prayer. Scripture. Confession. Fasting."
          values={draft.faithPractice}
          onChange={value => updateField('faithPractice', value)}
          maxItems={6}
          placeholder="Morning rule. Liturgy on Sundays. Fast on Wednesdays and Fridays…"
          onContinue={advance}
          continueDisabled={false}
          tone="neutral"
          continueLabel="Lay down the path"
          footer="You can schedule these as spiritual tasks later from your dashboard."
        />
      );

    case 'congrats':
      return <CongratsScreen onContinue={finishFlow} />;
  }
}

// ─── Rich text helpers ─────────────────────────────────────────────────────

// HTML coming out of contenteditable looks empty when the user hasn't typed
// anything but still contains markup like `<br>`, `<div><br></div>`, or
// `&nbsp;`. Strip tags and entities to test for "real" content.
function richIsEmpty(html: string): boolean {
  if (!html) return true;
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim().length === 0;
}

// Vision / Calling step. Rich text editor (WebView-based) takes over the
// space below the heading, with a fixed Continue button pinned to the bottom
// so the keyboard never hides it. Mirrors the pattern from NotesView.
function RichStep({
  title,
  body,
  html,
  onChangeHtml,
  placeholder,
  insetsBottom,
  continueDisabled,
  onContinue,
}: {
  title: string;
  body: React.ReactNode;
  html: string;
  onChangeHtml: (value: string) => void;
  placeholder: string;
  insetsBottom: number;
  continueDisabled: boolean;
  onContinue: () => void;
}) {
  const editorRef = useRef<RichTextEditorRef>(null);
  const [formatState, setFormatState] = useState<FormatState>({ bold: false, italic: false, underline: false });
  // Keep the editor's source HTML stable for its lifetime (the RichTextEditor
  // intentionally never re-renders source mid-typing), so we capture it once
  // when the step mounts.
  const initialHtmlRef = useRef(html);

  return (
    <View style={s.richStep}>
      <View style={s.richHeading}>
        <Text style={s.stepTitle}>{title}</Text>
        {typeof body === 'string'
          ? <Text style={s.stepBody}>{body}</Text>
          : body}
      </View>

      {/* Toolbar pinned to the top of the editor area — always visible, even
          when the keyboard pushes the WebView up. */}
      <View style={s.richEditorWrap}>
        <RichToolbar
          editorRef={editorRef}
          activeFormats={formatState}
          style={s.richToolbarTop}
        />
        <RichTextEditor
          ref={editorRef}
          initialHTML={initialHtmlRef.current}
          onChange={onChangeHtml}
          onFormatChange={setFormatState}
          placeholder={placeholder}
          backgroundColor="#FFFFFF"
          color="#1F2937"
          style={s.richEditor}
        />
      </View>

      <View style={[s.richFooter, { paddingBottom: insetsBottom + 10 }]}>
        <TouchableOpacity
          onPress={onContinue}
          disabled={continueDisabled}
          activeOpacity={0.84}
          style={[s.primaryBtn, continueDisabled && s.primaryBtnDisabled]}
        >
          <Text style={s.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Layout primitives ─────────────────────────────────────────────────────

function FlowScroll({
  children, insetsBottom,
}: {
  children: React.ReactNode;
  insetsBottom: number;
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[s.flowContent, { paddingBottom: insetsBottom + 32 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

// The question carries the screen: one large serif line, one quiet line under
// it. The heading rises first, the body a beat later — the page composes
// itself rather than appearing all at once.
function StepHeading({
  title, body,
}: {
  title: string;
  body: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <View style={s.stepHeading}>
      <Reanimated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(460).easing(Easing.out(Easing.cubic))}
      >
        <Text style={s.stepTitle}>{title}</Text>
      </Reanimated.View>
      {!!body && (
        <Reanimated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(110).duration(460).easing(Easing.out(Easing.cubic))}
        >
          <Text style={s.stepBody}>{body}</Text>
        </Reanimated.View>
      )}
    </View>
  );
}

// The flow's own action, in the app's signature gold — the black pill with
// 11pt letterspaced caps read like a form's submit, not like an invitation.
function PrimaryButton({
  label, onPress, disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return <GoldButton label={label} onPress={onPress} disabled={disabled} height={54} style={s.primaryBtn} />;
}

// ─── Step: Qualities (chips) ────────────────────────────────────────────────

function QualitiesStep({
  values, onChange, onBack, onContinue,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [draft, setDraft] = useState('');
  const insets = useSafeAreaInsets();

  const addQuality = (raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) return;
    if (values.length >= 10) return;
    if (values.some(item => item.toLowerCase() === cleaned.toLowerCase())) return;
    onChange([...values, cleaned]);
    setDraft('');
    Haptics.selectionAsync().catch(() => {});
  };

  const removeQuality = (item: string) => {
    onChange(values.filter(q => q !== item));
  };

  const canContinue = values.length >= 3;
  const remainingSuggestions = SUGGESTED_QUALITIES.filter(
    suggestion => !values.some(item => item.toLowerCase() === suggestion.toLowerCase())
  );

  return (
    <FlowScroll insetsBottom={insets.bottom}>
      <StepHeading
        title="What they're made of"
        body="Write what comes when you picture them."
      />

      <View style={s.chipInputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => addQuality(draft)}
          blurOnSubmit={false}
          returnKeyType="done"
          multiline={false}
          maxLength={32}
          placeholder="Type a quality and press enter"
          placeholderTextColor="#C9C5BD"
          style={s.chipTextInput}
        />
        <TouchableOpacity
          onPress={() => addQuality(draft)}
          disabled={draft.trim().length === 0 || values.length >= 10}
          activeOpacity={0.84}
          style={[
            s.chipAddBtn,
            (draft.trim().length === 0 || values.length >= 10) && s.chipAddBtnDisabled,
          ]}
        >
          <Plus s={16} c="#FFFFFF" w={2.6} />
        </TouchableOpacity>
      </View>

      {values.length > 0 && (
        <View style={s.chipBlock}>
          <Text style={s.chipBlockLabel}>YOUR QUALITIES · {values.length} / 10</Text>
          <View style={s.chipsWrap}>
            {values.map(item => (
              <TouchableOpacity
                key={item}
                onPress={() => removeQuality(item)}
                activeOpacity={0.78}
                style={s.chipFilled}
              >
                <Text style={s.chipFilledText}>{item}</Text>
                <X s={12} c="#7C6328" w={2.4} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {remainingSuggestions.length > 0 && (
        <View style={s.chipBlock}>
          <Text style={s.chipBlockLabel}>OR PICK FROM BELOW</Text>
          <View style={s.chipsWrap}>
            {remainingSuggestions.map(item => (
              <TouchableOpacity
                key={item}
                onPress={() => addQuality(item)}
                disabled={values.length >= 10}
                activeOpacity={0.84}
                style={[s.chipSuggested, values.length >= 10 && { opacity: 0.45 }]}
              >
                <Text style={s.chipSuggestedText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <PrimaryButton
        label="Continue"
        onPress={onContinue}
        disabled={!canContinue}
      />
      {!canContinue && (
        <Text style={s.helperHint}>Pick at least 3 qualities to continue.</Text>
      )}
    </FlowScroll>
  );
}

// ─── Step: List (obstacles, actions) ───────────────────────────────────────

function ListStep({
  title, body, values, onChange, maxItems,
  placeholder, onContinue, continueDisabled, tone = 'neutral',
  continueLabel = 'Continue',
  footer,
}: {
  title: string;
  body: string;
  values: string[];
  onChange: (next: string[]) => void;
  maxItems: number;
  placeholder: string;
  onContinue: () => void;
  continueDisabled: boolean;
  tone?: 'neutral' | 'warning' | 'positive';
  continueLabel?: string;
  footer?: string;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  // Treat values as the committed list — empty drafts are not part of state
  // anymore. The single input above commits its content on +/Enter.
  const items = values.filter(item => item.trim().length > 0);
  const atMax = items.length >= maxItems;
  const canCommit = draft.trim().length > 0 && !atMax;

  const commit = () => {
    if (!canCommit) return;
    onChange([...items, draft.trim()]);
    setDraft('');
    Haptics.selectionAsync().catch(() => {});
  };

  const requestDelete = (idx: number) => {
    Haptics.selectionAsync().catch(() => {});
    setPendingDelete(idx);
  };

  const confirmDelete = () => {
    if (pendingDelete === null) return;
    onChange(items.filter((_, i) => i !== pendingDelete));
    setPendingDelete(null);
  };

  return (
    <>
      <FlowScroll insetsBottom={insets.bottom}>
        <StepHeading title={title} body={body} />

        <View style={s.entryRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={commit}
            placeholder={atMax ? `Maximum reached (${maxItems})` : placeholder}
            placeholderTextColor="#C9C5BD"
            multiline={false}
            maxLength={120}
            returnKeyType="done"
            blurOnSubmit={false}
            editable={!atMax}
            style={s.entryInput}
          />
          <TouchableOpacity
            onPress={commit}
            disabled={!canCommit}
            activeOpacity={0.84}
            style={[s.entryAddBtn, !canCommit && s.entryAddBtnDisabled]}
          >
            <Plus s={18} c="#FFFFFF" w={2.6} />
          </TouchableOpacity>
        </View>

        {items.length > 0 && (
          <View style={s.itemList}>
            {items.map((value, idx) => (
              <View key={`${value}-${idx}`} style={[s.itemCard, toneToCardStyle(tone)]}>
                <Text style={[s.itemText, toneToTextStyle(tone)]} numberOfLines={3}>{value}</Text>
                <TouchableOpacity
                  onPress={() => requestDelete(idx)}
                  activeOpacity={0.7}
                  hitSlop={6}
                  style={[s.itemDeleteBtn, toneToDeleteStyle(tone)]}
                >
                  <X s={14} c={toneToDeleteIconColor(tone)} w={2.4} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={s.itemCounter}>{items.length} / {maxItems}</Text>

        {footer && <Text style={s.listFooter}>{footer}</Text>}

        <PrimaryButton label={continueLabel} onPress={onContinue} disabled={continueDisabled} />
      </FlowScroll>

      <ConfirmModal
        visible={pendingDelete !== null}
        icon={<Trash2 s={22} c={C.red} />}
        iconBg="#FEF2F2"
        title="Remove this?"
        body={pendingDelete !== null && items[pendingDelete] ? `"${items[pendingDelete]}" will be removed.` : ''}
        confirmLabel="DELETE"
        confirmColor={C.red}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

// ─── Step: Anasta (pause) ──────────────────────────────────────────────────

// The two benediction screens are read, not scanned — so they arrive the way
// they are read: one thought at a time, the word itself last and lit.
function Rising({ delay, children }: { delay: number; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <>{children}</>;
  return (
    <Reanimated.View entering={FadeInDown.delay(delay).duration(620).easing(Easing.out(Easing.cubic))}>
      {children}
    </Reanimated.View>
  );
}

// "Anasta." — the word the whole app is named for. It rises last, over a gold
// breath that keeps living behind it.
function AnastaWord({
  word, sub, delay, wordStyle, subStyle,
}: {
  word: string;
  sub: string;
  delay: number;
  wordStyle: object;
  subStyle: object;
}) {
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0.5;
      return;
    }
    breath.value = withDelay(
      delay,
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
    );
  }, [breath, delay, reduceMotion]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.2 + breath.value * 0.5 }));

  return (
    <Rising delay={delay}>
      <View style={s.anastaWordWrap}>
        <Reanimated.View pointerEvents="none" style={[s.anastaGlow, glowStyle]}>
          <Bloom color={C.gold} opacity={0.5} />
        </Reanimated.View>
        <Text style={wordStyle}>{word}</Text>
        <Text style={subStyle}>{sub}</Text>
      </View>
    </Rising>
  );
}

function AnastaScreen({ onContinue }: { onContinue: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[BG, PARCHMENT, BG]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[s.anastaScreen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={s.anastaContent}>
        <Rising delay={0}>
          <Text style={s.anastaIntro}>Before you go further, hear this.</Text>
        </Rising>

        <Rising delay={260}>
          <View style={s.anastaBlock}>
            <Text style={s.anastaLine}>You will not become this person perfectly.</Text>
            <Text style={s.anastaLine}>You will fall. Many times.</Text>
          </View>
        </Rising>

        <Rising delay={520}>
          <View style={s.anastaBlock}>
            <Text style={s.anastaLine}>That is not failure — that is the path.</Text>
            <Text style={s.anastaLine}>Every saint fell. Every saint rose again.</Text>
          </View>
        </Rising>

        <Rising delay={780}>
          <View style={s.anastaBlock}>
            <Text style={s.anastaLine}>{"The devil's trap is not the fall."}</Text>
            <Text style={s.anastaLine}>It is the shame after — the lie that says</Text>
            <Text style={[s.anastaLine, s.anastaItalic]}>God does not want you back.</Text>
            <Text style={s.anastaLine}>He always does.</Text>
          </View>
        </Rising>

        <Rising delay={1040}>
          <View style={s.anastaBlock}>
            <Text style={s.anastaLine}>So when you fall, do not lie there.</Text>
            <Text style={s.anastaLine}>Get up. Without shame. Without delay.</Text>
          </View>
        </Rising>

        <AnastaWord word="Anasta." sub="Rise." delay={1320} wordStyle={s.anastaWord} subStyle={s.anastaWordSub} />

        <Rising delay={1620}>
          <GoldButton label="I am ready to continue" onPress={onContinue} height={54} style={s.anastaBtn} />
        </Rising>
      </View>
    </LinearGradient>
  );
}

// ─── Step: Congrats (final benediction before summary) ─────────────────────

function CongratsScreen({ onContinue }: { onContinue: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[BG, PARCHMENT, BG]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[s.congratsScreen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <View style={s.congratsContent}>
        <Rising delay={0}>
          <Text style={s.congratsEyebrow}>The path is laid</Text>
        </Rising>

        <Rising delay={200}>
          <Text style={s.congratsTitle}>You named it.</Text>
        </Rising>

        <Rising delay={480}>
          <View style={s.congratsBlock}>
            <Text style={s.congratsLine}>Who you want to become.</Text>
            <Text style={s.congratsLine}>What gets in the way.</Text>
            <Text style={s.congratsLine}>What you can carry.</Text>
          </View>
        </Rising>

        <Rising delay={760}>
          <View style={s.congratsBlock}>
            <Text style={s.congratsLine}>Now begins the walking.</Text>
            <Text style={s.congratsLine}>One day at a time.</Text>
            <Text style={[s.congratsLine, s.anastaItalic]}>
              Every fall is part of the road.
            </Text>
          </View>
        </Rising>

        <AnastaWord word="Anasta." sub="Begin." delay={1040} wordStyle={s.congratsWord} subStyle={s.congratsWordSub} />

        <Rising delay={1340}>
          <GoldButton label="Walk this path" onPress={onContinue} height={54} style={s.congratsBtn} />
        </Rising>
      </View>
    </LinearGradient>
  );
}

// ─── Mode: SUMMARY ─────────────────────────────────────────────────────────

function Summary({
  profile, onRefine, onEditField,
}: {
  profile: IdealSelfProfile;
  onRefine: () => void;
  onEditField: (field: EditField) => void;
}) {
  const insets = useSafeAreaInsets();
  // Front-end only for now: the "Set as Daily Task" card opens the standard
  // QuickTaskSheet drawer (same pattern as Gratitude / Reading list). Saving
  // the task itself stays a no-op until we wire it up to a real task draft.
  const [showTaskSheet, setShowTaskSheet] = useState(false);

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.summaryContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* The profile opens on its own lit plate — the vow, then the promise
            that failing it is not the end. */}
        <View style={s.summaryHero}>
          <LinearGradient
            colors={['#FFFDF6', '#FDF6E6', '#FFFCF4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <HairlineWeave color="#8A6A2F" opacity={0.05} />
          <View pointerEvents="none" style={s.summaryHeroBloom}>
            <Bloom color={C.gold} opacity={0.24} />
          </View>
          <View style={s.summaryHeaderRule} />
          <Text style={s.summaryHeaderEyebrow}>WHO I AM BECOMING</Text>
          <Text style={s.summaryHeaderTitle}>This is the path</Text>
          <Text style={s.summaryHeaderTagline}>
            You will fall. That is not the end. <Text style={s.summaryHeaderAnasta}>Anasta.</Text>
          </Text>
        </View>

        <SetAsDailyTaskCard
          variant="soft"
          title="Set as Daily Task"
          subtitle="Add Ideal Self to your daily routine"
          onPress={() => setShowTaskSheet(true)}
        />

        <Text style={s.summaryGroupLabel}>WHO I AM BECOMING</Text>
        <EditableSection
          label="The person I am becoming"
          body={profile.vision}
          onEdit={() => onEditField('vision')}
        />
        <EditableChips
          label="What they are made of"
          items={profile.qualities}
          onEdit={() => onEditField('qualities')}
        />

        <Text style={s.summaryGroupLabel}>LIFE</Text>
        <EditableList
          label="What separates me from that person"
          items={profile.obstacles}
          tone="warning"
          onEdit={() => onEditField('obstacles')}
        />
        <EditableList
          label="What I can do, every day"
          items={profile.actions}
          tone="positive"
          onEdit={() => onEditField('actions')}
        />
        <EditableList
          label="Routines that person keeps"
          items={profile.routines}
          onEdit={() => onEditField('routines')}
        />

        <Text style={s.summaryGroupLabel}>FAITH</Text>
        <EditableSection
          label="The relationship with God I want"
          body={profile.relationshipWithGod}
          italic
          onEdit={() => onEditField('relationshipWithGod')}
        />
        <EditableList
          label="What blocks that relationship"
          items={profile.spiritualObstacles}
          tone="warning"
          onEdit={() => onEditField('spiritualObstacles')}
        />
        <EditableList
          label="What I can do every day to draw closer"
          items={profile.spiritualActions}
          tone="positive"
          onEdit={() => onEditField('spiritualActions')}
        />
        <EditableList
          label="Their faith practice"
          items={profile.faithPractice}
          onEdit={() => onEditField('faithPractice')}
        />

        <View style={s.linkedBlock}>
          <Text style={s.linkedLabel}>LINKED TASKS &amp; HABITS</Text>
          <Text style={s.linkedBody}>
            Tasks and habits tagged to your ideal self will appear here, ordered by time, with progress at a glance.
          </Text>
          <Text style={s.linkedComing}>Coming soon</Text>
        </View>

        <TouchableOpacity onPress={onRefine} activeOpacity={0.84} style={s.refineBtn}>
          <Text style={s.refineBtnText}>Walk the path again</Text>
        </TouchableOpacity>
        <Text style={s.refineCaption}>Goes through every step in order.</Text>
      </ScrollView>

      <QuickTaskSheet
        visible={showTaskSheet}
        onClose={() => setShowTaskSheet(false)}
        onTaskDraft={() => {
          // Front-end only — wiring the actual task creation is a follow-up.
          setShowTaskSheet(false);
        }}
      />
    </>
  );
}

function EditableSection({
  label, body, italic, onEdit,
}: {
  label: string;
  body: string;
  italic?: boolean;
  onEdit: () => void;
}) {
  const empty = richIsEmpty(body);
  return (
    <View style={s.editBlock}>
      <View style={s.editBlockHead}>
        <Text style={s.sumLabel}>{label}</Text>
        <TouchableOpacity onPress={onEdit} activeOpacity={0.7} hitSlop={6} style={s.editIconBtn}>
          <Pencil s={14} c="#A8A29E" w={2} />
        </TouchableOpacity>
      </View>
      {empty
        ? <Text style={s.sumBody}>—</Text>
        : <RichCommentText html={body} color={italic ? '#5C5752' : '#1F2937'} />
      }
    </View>
  );
}

function EditableChips({
  label, items, onEdit,
}: {
  label: string;
  items: string[];
  onEdit: () => void;
}) {
  return (
    <View style={s.editBlock}>
      <View style={s.editBlockHead}>
        <Text style={s.sumLabel}>{label}</Text>
        <TouchableOpacity onPress={onEdit} activeOpacity={0.7} hitSlop={6} style={s.editIconBtn}>
          <Pencil s={14} c="#A8A29E" w={2} />
        </TouchableOpacity>
      </View>
      {items.length > 0 ? (
        <View style={s.chipsWrap}>
          {items.map(item => (
            <View key={item} style={s.chipFilled}>
              <Text style={s.chipFilledText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.sumBody}>—</Text>
      )}
    </View>
  );
}

function EditableList({
  label, items, tone = 'neutral', onEdit,
}: {
  label: string;
  items: string[];
  tone?: Tone;
  onEdit: () => void;
}) {
  const filled = items.filter(item => item.trim().length > 0);
  return (
    <View style={s.editBlock}>
      <View style={s.editBlockHead}>
        <Text style={s.sumLabel}>{label}</Text>
        <TouchableOpacity onPress={onEdit} activeOpacity={0.7} hitSlop={6} style={s.editIconBtn}>
          <Pencil s={14} c="#A8A29E" w={2} />
        </TouchableOpacity>
      </View>
      {filled.length > 0 ? (
        filled.map((item, idx) => (
          <View key={idx} style={s.sumListItem}>
            <View style={[s.sumBullet, toneToBulletColor(tone)]} />
            <Text style={s.sumBody}>{item}</Text>
          </View>
        ))
      ) : (
        <Text style={s.sumBody}>—</Text>
      )}
    </View>
  );
}

function toneToBulletColor(tone: Tone) {
  if (tone === 'warning') return { backgroundColor: '#B65A3C' };
  if (tone === 'positive') return { backgroundColor: '#5C7A48' };
  return null;
}

// ─── Edit-field bottom sheet ───────────────────────────────────────────────

function EditFieldSheet({
  field, profile, onClose, onSave,
}: {
  field: EditField;
  profile: IdealSelfProfile;
  onClose: () => void;
  onSave: (field: Exclude<EditField, null>, value: string | string[]) => void;
}) {
  const visible = field !== null;
  const [text, setText] = useState('');
  const [list, setList] = useState<string[]>([]);
  const editorRef = useRef<RichTextEditorRef>(null);
  const [formatState, setFormatState] = useState<FormatState>({ bold: false, italic: false, underline: false });

  useEffect(() => {
    if (!field) return;
    if (field === 'vision' || field === 'relationshipWithGod') {
      setText(profile[field] ?? '');
    } else {
      setList(profile[field] ?? []);
    }
  }, [field, profile]);

  const isText = field === 'vision' || field === 'relationshipWithGod';
  const isChips = field === 'qualities';
  const isList =
    field === 'obstacles' ||
    field === 'actions' ||
    field === 'routines' ||
    field === 'spiritualObstacles' ||
    field === 'spiritualActions' ||
    field === 'faithPractice';

  const fieldTitle: Record<NonNullable<EditField>, string> = {
    vision: 'The person I am becoming',
    qualities: 'What they are made of',
    obstacles: 'What separates me from that person',
    actions: 'What I can do, every day',
    routines: 'Routines that person keeps',
    relationshipWithGod: 'The relationship with God I want',
    spiritualObstacles: 'What blocks that relationship',
    spiritualActions: 'What I can do every day to draw closer',
    faithPractice: 'Their faith practice',
  };

  const fieldMax: Record<NonNullable<EditField>, number> = {
    vision: 0,
    qualities: 10,
    obstacles: 3,
    actions: 5,
    routines: 6,
    relationshipWithGod: 0,
    spiritualObstacles: 3,
    spiritualActions: 5,
    faithPractice: 6,
  };

  const save = () => {
    if (!field) return;
    if (isText) onSave(field, text);
    else onSave(field, list.map(item => item.trim()).filter(Boolean));
  };

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={onClose}
      keyboardAware
      sheetStyle={isText ? s.editSheetTall : s.editSheet}
    >
      <View style={s.handle} />
      <View style={s.editSheetHead}>
        <TouchableOpacity onPress={onClose} activeOpacity={0.78} style={s.editSheetBtn}>
          <X s={18} c="#A8A29E" />
        </TouchableOpacity>
        <Text style={s.editSheetTitle}>{field ? fieldTitle[field] : ''}</Text>
        <TouchableOpacity onPress={save} activeOpacity={0.84} style={s.editSheetSave}>
          <CheckSmall s={18} c="#FFFFFF" w={3} />
        </TouchableOpacity>
      </View>

      {isText && field ? (
        // Use a fresh key per field so the WebView remounts with the right
        // initialHTML when the user opens a different field.
        <View style={s.editSheetTextBody}>
          <View style={s.editSheetEditorWrap}>
            <RichToolbar
              editorRef={editorRef}
              activeFormats={formatState}
              style={s.richToolbarTop}
            />
            <RichTextEditor
              key={field}
              ref={editorRef}
              initialHTML={profile[field] ?? ''}
              onChange={setText}
              onFormatChange={setFormatState}
              placeholder="Write here..."
              backgroundColor="#FFFFFF"
              color="#1F2937"
              style={s.richEditor}
            />
          </View>
        </View>
      ) : (
        <ScrollView
          style={{ maxHeight: 460 }}
          contentContainerStyle={s.editSheetContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isChips && (
            <ChipsEditor values={list} onChange={setList} max={10} />
          )}
          {isList && (
            <ListEditor values={list} onChange={setList} max={field ? fieldMax[field] : 5} />
          )}
        </ScrollView>
      )}
    </SmoothBottomSheet>
  );
}

function ChipsEditor({
  values, onChange, max,
}: { values: string[]; onChange: (next: string[]) => void; max: number }) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) return;
    if (values.length >= max) return;
    if (values.some(item => item.toLowerCase() === cleaned.toLowerCase())) return;
    onChange([...values, cleaned]);
    setDraft('');
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={s.chipInputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => add(draft)}
          blurOnSubmit={false}
          returnKeyType="done"
          multiline={false}
          maxLength={32}
          placeholder="Type and press enter"
          placeholderTextColor="#C9C5BD"
          style={s.chipTextInput}
        />
        <TouchableOpacity
          onPress={() => add(draft)}
          disabled={draft.trim().length === 0 || values.length >= max}
          activeOpacity={0.84}
          style={[
            s.chipAddBtn,
            (draft.trim().length === 0 || values.length >= max) && s.chipAddBtnDisabled,
          ]}
        >
          <Plus s={16} c="#FFFFFF" w={2.6} />
        </TouchableOpacity>
      </View>
      <View style={s.chipsWrap}>
        {values.map(item => (
          <TouchableOpacity
            key={item}
            onPress={() => onChange(values.filter(q => q !== item))}
            activeOpacity={0.78}
            style={s.chipFilled}
          >
            <Text style={s.chipFilledText}>{item}</Text>
            <X s={12} c="#7C6328" w={2.4} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ListEditor({
  values, onChange, max,
}: { values: string[]; onChange: (next: string[]) => void; max: number }) {
  const [draft, setDraft] = useState('');
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  const items = values.filter(item => item.trim().length > 0);
  const atMax = items.length >= max;
  const canCommit = draft.trim().length > 0 && !atMax;

  const commit = () => {
    if (!canCommit) return;
    onChange([...items, draft.trim()]);
    setDraft('');
  };

  const confirmDelete = () => {
    if (pendingDelete === null) return;
    onChange(items.filter((_, i) => i !== pendingDelete));
    setPendingDelete(null);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={s.entryRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          placeholder={atMax ? `Maximum reached (${max})` : 'Type and press +'}
          placeholderTextColor="#C9C5BD"
          multiline={false}
          maxLength={120}
          returnKeyType="done"
          blurOnSubmit={false}
          editable={!atMax}
          style={s.entryInput}
        />
        <TouchableOpacity
          onPress={commit}
          disabled={!canCommit}
          activeOpacity={0.84}
          style={[s.entryAddBtn, !canCommit && s.entryAddBtnDisabled]}
        >
          <Plus s={18} c="#FFFFFF" w={2.6} />
        </TouchableOpacity>
      </View>

      {items.map((value, idx) => (
        <View key={`${value}-${idx}`} style={s.itemCard}>
          <Text style={s.itemText} numberOfLines={3}>{value}</Text>
          <TouchableOpacity
            onPress={() => setPendingDelete(idx)}
            activeOpacity={0.7}
            hitSlop={6}
            style={s.itemDeleteBtn}
          >
            <X s={14} c="#A8A29E" w={2.4} />
          </TouchableOpacity>
        </View>
      ))}

      <ConfirmModal
        visible={pendingDelete !== null}
        icon={<Trash2 s={22} c={C.red} />}
        iconBg="#FEF2F2"
        title="Remove this?"
        body={pendingDelete !== null && items[pendingDelete] ? `"${items[pendingDelete]}" will be removed.` : ''}
        confirmLabel="DELETE"
        confirmColor={C.red}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

// ─── Tone helpers ──────────────────────────────────────────────────────────
// Obstacles read as "what I struggle with" → warm rust/terracotta cards.
// Actions read as "what helps me grow"     → soft sage green cards.
// Falls back to the default gold tone for everything else.

type Tone = 'neutral' | 'warning' | 'positive';

function toneToCardStyle(tone: Tone) {
  if (tone === 'warning') return { backgroundColor: '#FBE6DD', borderColor: '#F0C6B5' };
  if (tone === 'positive') return { backgroundColor: '#E5EFDF', borderColor: '#C6D9B5' };
  return null;
}

function toneToTextStyle(tone: Tone) {
  if (tone === 'warning') return { color: '#7A2E18' };
  if (tone === 'positive') return { color: '#2E5223' };
  return null;
}

function toneToDeleteStyle(tone: Tone) {
  if (tone === 'warning') return { borderColor: '#F0C6B5' };
  if (tone === 'positive') return { borderColor: '#C6D9B5' };
  return null;
}

function toneToDeleteIconColor(tone: Tone): string {
  if (tone === 'warning') return '#B65A3C';
  if (tone === 'positive') return '#5C7A48';
  return '#A8A29E';
}

// ─── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  screenBloom: { position: 'absolute', left: -60, right: -60, top: -170, height: 420 },

  // Top bars
  titleBarBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  flowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  progressRail: { flex: 1, paddingHorizontal: 10 },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#EBE3D2',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 999, overflow: 'hidden' },

  // Flow
  flowContent: { paddingHorizontal: 22, paddingTop: 6, gap: 16 },
  stepHeading: { gap: 10, marginBottom: 4 },
  stepEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: C.gold,
    textTransform: 'uppercase',
  },
  // The question is the screen. Big enough to be read once and felt, not
  // scanned — it carries the weight the old 28pt shared with a paragraph.
  stepTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 33,
    color: '#221E1A',
    lineHeight: 39,
    letterSpacing: -0.5,
  },
  // One quiet line under it. Upright serif at a readable size — the old 15pt
  // italic paragraph competed with the question and read as fine print.
  stepBody: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    lineHeight: 25,
    color: '#7C7266',
    letterSpacing: 0.05,
  },
  // Rich step
  richStep: { flex: 1 },
  richHeading: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 14,
    gap: 8,
  },
  // The writing surface is a page, not a form field: warm parchment, a gold
  // hairline and a soft lift, so what you write feels inscribed.
  richEditorWrap: {
    flex: 1,
    marginHorizontal: 22,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: '#E6DCC2',
    overflow: 'hidden',
    boxShadow: '0 10px 26px rgba(67, 53, 31, 0.08)',
  },
  richEditor: { flex: 1 },
  richFooter: {
    paddingHorizontal: 22,
    paddingTop: 8,
    gap: 10,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: '#EAE3CF',
  },
  richToolbar: {
    borderColor: '#EAE3CF',
  },
  // Toolbar variant pinned at the TOP of the editor box. Flush corners with
  // the editor wrapper, no shadow (the wrapper border + bottom rule already
  // separate it from the editor below).
  richToolbarTop: {
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E9D5',
    backgroundColor: '#FFFEFB',
    shadowOpacity: 0,
    elevation: 0,
    minHeight: 44,
    paddingHorizontal: 10,
  },

  // Buttons
  primaryBtn: { marginTop: 6 },
  primaryBtnDisabled: { backgroundColor: '#D6D3D1' },
  primaryBtnText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  secondaryBtn: { alignItems: 'center', paddingVertical: 14 },
  secondaryBtnText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  helperHint: {
    textAlign: 'center',
    fontFamily: F.serifMedium,
    fontSize: 15,
    color: '#9A9086',
    marginTop: -2,
  },

  // Chips
  chipInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chipTextInput: {
    flex: 1,
    height: 56,
    borderRadius: 17,
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: '#E6DCC2',
    paddingHorizontal: 17,
    paddingVertical: 0,
    fontFamily: F.serifMedium,
    fontSize: 18,
    lineHeight: 24,
    color: '#221E1A',
    // Android-only: stop the platform from adding extra vertical padding
    // around the text run, which pushes single-line placeholders down.
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  chipAddBtn: {
    width: 56,
    height: 56,
    borderRadius: 17,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(197,160,89,0.35)',
  },
  chipAddBtnDisabled: { backgroundColor: '#DDD8CE', boxShadow: 'none' },
  chipBlock: { gap: 11 },
  chipBlockLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.9,
    color: '#A09585',
    textTransform: 'uppercase',
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  // A chosen quality is minted — warm gold on parchment. A suggestion is bare.
  chipFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: '#F8EFD6',
    borderWidth: 1,
    borderColor: '#E2CE9F',
  },
  chipFilledText: {
    fontFamily: F.serifSemiBold,
    fontSize: 16,
    color: '#7A5E22',
  },
  chipSuggested: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: '#E6DCC2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSuggestedText: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    color: '#6E665C',
  },

  // Lists — single input + commit pattern. Input is white, committed cards
  // sit on a soft parchment fill so the eye reads "this is saved" at a glance.
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryInput: {
    flex: 1,
    height: 56,
    borderRadius: 17,
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: '#E6DCC2',
    paddingHorizontal: 17,
    paddingVertical: 0,
    fontFamily: F.serifMedium,
    fontSize: 18,
    lineHeight: 24,
    color: '#221E1A',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  entryAddBtn: {
    width: 56,
    height: 56,
    borderRadius: 17,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(197,160,89,0.35)',
  },
  entryAddBtnDisabled: { backgroundColor: '#DDD8CE', boxShadow: 'none' },
  itemList: { gap: 9 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: '#F8F0D8',
    borderWidth: 1,
    borderColor: '#E8DCC4',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemText: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 17.5,
    lineHeight: 24,
    color: '#332B22',
  },
  itemDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DCC4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCounter: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.9,
    color: '#A09585',
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  listFooter: {
    fontFamily: F.serifMediumItalic,
    fontSize: 13,
    lineHeight: 19,
    color: '#A8A29E',
    textAlign: 'center',
    paddingHorizontal: 8,
    marginTop: 4,
  },

  // Anasta
  anastaScreen: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  anastaContent: { gap: 22, alignItems: 'center' },
  anastaIntro: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: '#A8853C',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  anastaBlock: { gap: 4, alignItems: 'center' },
  anastaLine: {
    fontFamily: F.serifMedium,
    fontSize: 18.5,
    lineHeight: 28,
    color: '#332B22',
    textAlign: 'center',
  },
  anastaItalic: {
    fontFamily: F.serifMediumItalic,
    color: '#5C5752',
  },
  // The word sits over its own gold breath.
  anastaWordWrap: { alignItems: 'center', marginTop: 18 },
  anastaGlow: { position: 'absolute', left: -110, right: -110, top: -54, height: 170 },
  anastaWord: {
    fontFamily: F.serifSemiBold,
    fontSize: 44,
    lineHeight: 52,
    color: C.goldDark,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  anastaWordSub: {
    fontFamily: F.serifMedium,
    fontSize: 20,
    color: '#9A7C36',
    marginTop: 2,
    textAlign: 'center',
  },
  anastaBtn: { marginTop: 28, minWidth: 250 },
  anastaTagline: {
    fontFamily: F.serifMediumItalic,
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 18,
  },
  anastaTaglineWord: {
    fontFamily: F.serifMedium,
    fontSize: 22,
    color: C.gold,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },

  // Congrats — final benediction screen. Shares Anasta's voice but lighter:
  // the "rise" word becomes "begin", and the centred title acknowledges the
  // user just laid out a real path. Same gradient + serif typography.
  congratsScreen: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  congratsContent: { gap: 20, alignItems: 'center' },
  congratsEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: '#A8853C',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  congratsTitle: {
    fontFamily: F.serifMedium,
    fontSize: 32,
    color: '#1F2937',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  congratsBlock: { gap: 4, alignItems: 'center' },
  congratsLine: {
    fontFamily: F.serifMedium,
    fontSize: 18.5,
    lineHeight: 28,
    color: '#332B22',
    textAlign: 'center',
  },
  congratsWord: {
    fontFamily: F.serifSemiBold,
    fontSize: 46,
    lineHeight: 54,
    color: C.goldDark,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  congratsWordSub: {
    fontFamily: F.serifMedium,
    fontSize: 20,
    color: '#9A7C36',
    marginTop: 2,
    textAlign: 'center',
  },
  congratsBtn: { marginTop: 22, minWidth: 250 },

  // Summary card (inside review step)
  summaryCard: {
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE3CF',
    paddingVertical: 22,
    paddingHorizontal: 22,
    gap: 16,
  },
  sumBlock: { gap: 8 },
  sumLabel: {
    flex: 1,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: C.goldDark,
    textTransform: 'uppercase',
  },
  sumBody: {
    fontFamily: F.serifMedium,
    fontSize: 17.5,
    lineHeight: 26,
    color: '#221E1A',
  },
  sumDivider: { height: 1, backgroundColor: '#F0E9D5' },
  sumListItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  sumBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.gold,
    marginTop: 10,
  },

  // Summary screen (mode='summary')
  summaryContent: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 32, gap: 18 },
  // The vow's own plate: parchment, weave, a gold breath and a struck rule.
  summaryHero: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E7D7B4',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 22,
    gap: 7,
    boxShadow: '0 10px 28px rgba(67, 53, 31, 0.08)',
  },
  summaryHeroBloom: { position: 'absolute', left: -40, right: -40, top: -96, height: 200 },
  summaryHeaderRule: { width: 34, height: 2, borderRadius: 1, backgroundColor: C.gold, opacity: 0.65, marginBottom: 3 },
  summaryHeaderEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.goldDark,
    textTransform: 'uppercase',
  },
  summaryHeaderTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
    color: '#221E1A',
    textAlign: 'center',
  },
  summaryHeaderTagline: {
    fontFamily: F.serifMedium,
    fontSize: 16.5,
    lineHeight: 23,
    color: '#7C7266',
    textAlign: 'center',
    marginTop: 2,
  },
  // Group dividers in the summary view: WHO I AM BECOMING / LIFE / FAITH.
  // Sit above their associated cards as a quiet section header.
  summaryGroupLabel: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: C.goldDark,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: -4,
    paddingHorizontal: 4,
  },
  summaryHeaderAnasta: { color: C.goldDark, fontFamily: F.serifSemiBold },

  editBlock: {
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: '#E6DCC2',
    paddingVertical: 17,
    paddingHorizontal: 18,
    gap: 11,
    boxShadow: '0 6px 18px rgba(67, 53, 31, 0.05)',
  },
  editBlockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FAFAF9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Linked tasks placeholder
  linkedBlock: {
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#EAE3CF',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 6,
  },
  linkedLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  linkedBody: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    lineHeight: 23,
    color: '#7C7266',
  },
  linkedComing: {
    marginTop: 4,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.gold,
    textTransform: 'uppercase',
  },

  // Reads as an invitation to walk it again, not a caps-locked control.
  refineBtn: {
    marginTop: 10,
    height: 54,
    borderRadius: 17,
    borderCurve: 'continuous',
    backgroundColor: '#FFFEFB',
    borderWidth: 1.5,
    borderColor: '#E2CE9F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refineBtnText: {
    fontFamily: F.serifSemiBold,
    fontSize: 19,
    letterSpacing: 0.2,
    color: C.goldDark,
  },
  refineCaption: {
    textAlign: 'center',
    fontFamily: F.serifMedium,
    fontSize: 15,
    color: '#9A9086',
  },

  // Edit sheet
  editSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FFFEFB',
    paddingBottom: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E7E1D2',
    marginTop: 8,
  },
  editSheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  editSheetTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: F.serifMedium,
    fontSize: 16,
    color: '#1F2937',
    paddingHorizontal: 8,
  },
  editSheetBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F2EA',
  },
  editSheetSave: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.gold,
  },
  editSheetContent: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 24 },
  // Tall variant — used when the sheet hosts a RichTextEditor (vision/calling).
  // RichTextEditor is a flex:1 WebView, so the sheet itself needs a fixed
  // height for the editor to render at all.
  editSheetTall: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FFFEFB',
    height: '88%',
  },
  editSheetTextBody: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 10,
  },
  editSheetEditorWrap: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE3CF',
    overflow: 'hidden',
  },
});
