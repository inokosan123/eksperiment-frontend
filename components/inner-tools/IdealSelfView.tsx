import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  ArrowLeft, CheckSmall, Pencil, Plus, Trash2, X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import {
  getTitleBarTopPadding,
  TITLE_BAR_BOTTOM_PADDING,
} from '@/components/shared/titleBar';
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
        <View style={[s.titleBar, { paddingTop: getTitleBarTopPadding(insets.top) }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.titleBarBtn} activeOpacity={0.72}>
            <ArrowLeft s={22} c="#9CA3AF" />
          </TouchableOpacity>
          <Text style={s.titleBarText}>IDEAL SELF</Text>
          <View style={s.titleBarBtn} />
        </View>
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
      <View style={s.dotsRow}>
        {DOT_STEPS.map((_, i) => (
          <FlowDot key={i} index={i} activeIndex={dotIndex} />
        ))}
      </View>
      <View style={s.titleBarBtn} />
    </View>
  );
}

function FlowDot({ index, activeIndex }: { index: number; activeIndex: number }) {
  const state: 'past' | 'active' | 'future' =
    index < activeIndex ? 'past' : index === activeIndex ? 'active' : 'future';

  const widthSv = useSharedValue(state === 'active' ? 24 : 8);
  const colorSv = useSharedValue(
    state === 'active' ? 1 : state === 'past' ? 0.5 : 0
  );

  useEffect(() => {
    widthSv.value = withTiming(state === 'active' ? 24 : 8, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
    colorSv.value = withTiming(
      state === 'active' ? 1 : state === 'past' ? 0.5 : 0,
      { duration: 320, easing: Easing.out(Easing.cubic) }
    );
  }, [state, widthSv, colorSv]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: widthSv.value,
    // Lerp manually between three states by sampling colour points.
    backgroundColor:
      colorSv.value >= 1
        ? C.gold
        : colorSv.value >= 0.5
        ? '#B5944A'
        : '#E7E1D2',
  }));

  return (
    <Reanimated.View
      style={[
        { height: 8, borderRadius: 4 },
        state === 'active' && {
          shadowColor: C.gold,
          shadowOpacity: 0.45,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 4,
          elevation: 2,
        },
        animatedStyle,
      ]}
    />
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
          body="Take a moment. Picture the person you're meant to become. Not who you are on your best day, but who you want to become. Write what you see. Honestly. Not what sounds right on paper."
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
          body="Be honest. Not the polite answer — the real one. Naming it is half the battle."
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
          body="Forget the perfect plan. What can you carry — every day? A small thing kept is worth more than a great thing abandoned."
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
          body="What anchors their day? Morning rule. Evening reflection. Daily walk. The rhythms that hold a soul together."
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
          body="Set aside what you should believe. What kind of bond — what kind of trust, prayer, surrender — do you long for with Him?"
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
          body="Distraction. Doubt. Pride. The habit of forgetting Him. What stands between you and Him?"
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
          body="Small things. Honest things. The ones you can keep, even on tired days."
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
          body="Prayer. Scripture. Confession. Fasting. The shape of a life set apart for Him."
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

function StepHeading({
  title, body,
}: {
  title: string;
  body: string;
}) {
  return (
    <View style={s.stepHeading}>
      <Text style={s.stepTitle}>{title}</Text>
      <Text style={s.stepBody}>{body}</Text>
    </View>
  );
}

function PrimaryButton({
  label, onPress, disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.84}
      style={[s.primaryBtn, disabled && s.primaryBtnDisabled]}
    >
      <Text style={s.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
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
        body="Don't overthink it — write what comes when you picture that person."
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
        icon={<Trash2 s={22} c="#EF4444" />}
        iconBg="#FEF2F2"
        title="Remove this?"
        body={pendingDelete !== null && items[pendingDelete] ? `"${items[pendingDelete]}" will be removed.` : ''}
        confirmLabel="DELETE"
        confirmColor="#EF4444"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

// ─── Step: Anasta (pause) ──────────────────────────────────────────────────

function AnastaScreen({ onContinue }: { onContinue: () => void }) {
  const insets = useSafeAreaInsets();
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [fade]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <LinearGradient
      colors={[BG, PARCHMENT, BG]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[s.anastaScreen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <Reanimated.View style={[s.anastaContent, fadeStyle]}>
        <Text style={s.anastaIntro}>Before you go further, hear this.</Text>

        <View style={s.anastaBlock}>
          <Text style={s.anastaLine}>You will not become this person perfectly.</Text>
          <Text style={s.anastaLine}>You will fall. Many times.</Text>
        </View>

        <View style={s.anastaBlock}>
          <Text style={s.anastaLine}>That is not failure — that is the path.</Text>
          <Text style={s.anastaLine}>Every saint fell. Every saint rose again.</Text>
        </View>

        <View style={s.anastaBlock}>
          <Text style={s.anastaLine}>{"The devil's trap is not the fall."}</Text>
          <Text style={s.anastaLine}>It is the shame after — the lie that says</Text>
          <Text style={[s.anastaLine, s.anastaItalic]}>God does not want you back.</Text>
          <Text style={s.anastaLine}>He always does.</Text>
        </View>

        <View style={s.anastaBlock}>
          <Text style={s.anastaLine}>So when you fall, do not lie there.</Text>
          <Text style={s.anastaLine}>Get up. Without shame. Without delay.</Text>
        </View>

        <Text style={s.anastaWord}>Anasta.</Text>
        <Text style={s.anastaWordSub}>Rise.</Text>

        <TouchableOpacity
          onPress={onContinue}
          activeOpacity={0.84}
          style={s.anastaBtn}
        >
          <Text style={s.anastaBtnText}>I am ready to continue</Text>
        </TouchableOpacity>
      </Reanimated.View>
    </LinearGradient>
  );
}

// ─── Step: Congrats (final benediction before summary) ─────────────────────

function CongratsScreen({ onContinue }: { onContinue: () => void }) {
  const insets = useSafeAreaInsets();
  const fade = useSharedValue(0);
  const lift = useSharedValue(16);

  useEffect(() => {
    fade.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
    lift.value = withTiming(0, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [fade, lift]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: lift.value }],
  }));

  return (
    <LinearGradient
      colors={[BG, PARCHMENT, BG]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={[s.congratsScreen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <Reanimated.View style={[s.congratsContent, fadeStyle]}>
        <Text style={s.congratsEyebrow}>The path is laid</Text>

        <Text style={s.congratsTitle}>You named it.</Text>

        <View style={s.congratsBlock}>
          <Text style={s.congratsLine}>Who you want to become.</Text>
          <Text style={s.congratsLine}>What gets in the way.</Text>
          <Text style={s.congratsLine}>What you can carry.</Text>
        </View>

        <View style={s.congratsBlock}>
          <Text style={s.congratsLine}>Now begins the walking.</Text>
          <Text style={s.congratsLine}>One day at a time.</Text>
          <Text style={[s.congratsLine, s.anastaItalic]}>
            Every fall is part of the road.
          </Text>
        </View>

        <Text style={s.congratsWord}>Anasta.</Text>
        <Text style={s.congratsWordSub}>Begin.</Text>

        <TouchableOpacity onPress={onContinue} activeOpacity={0.84} style={s.congratsBtn}>
          <Text style={s.congratsBtnText}>Walk this path</Text>
        </TouchableOpacity>
      </Reanimated.View>
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
        <View style={s.summaryHeader}>
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
        icon={<Trash2 s={22} c="#EF4444" />}
        iconBg="#FEF2F2"
        title="Remove this?"
        body={pendingDelete !== null && items[pendingDelete] ? `"${items[pendingDelete]}" will be removed.` : ''}
        confirmLabel="DELETE"
        confirmColor="#EF4444"
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

  // Top bars
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: TITLE_BAR_BOTTOM_PADDING,
  },
  titleBarBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titleBarText: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    letterSpacing: 4,
    color: '#1F2937',
  },
  flowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Flow
  flowContent: { paddingHorizontal: 22, paddingTop: 4, gap: 14 },
  stepHeading: { gap: 8, marginBottom: 2 },
  stepEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: C.gold,
    textTransform: 'uppercase',
  },
  stepTitle: {
    fontFamily: F.serifMedium,
    fontSize: 28,
    color: '#1F2937',
    lineHeight: 34,
    letterSpacing: -0.2,
  },
  // Body reads as a quiet invitation, not an instruction. Italic serif gives
  // it the right "voice" — the user feels prompted, not lectured. Slight
  // warm-grey tone matches the parchment background.
  stepBody: {
    fontFamily: F.serifMediumItalic,
    fontSize: 15,
    lineHeight: 25,
    color: '#8A7E6E',
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
  richEditorWrap: {
    flex: 1,
    marginHorizontal: 22,
    marginBottom: 12,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE3CF',
    overflow: 'hidden',
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
  primaryBtn: {
    marginTop: 2,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#1C1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    fontFamily: F.serif,
    fontSize: 13,
    color: '#A8A29E',
    marginTop: -8,
  },

  // Chips
  chipInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chipTextInput: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE3CF',
    paddingHorizontal: 16,
    paddingVertical: 0,
    fontFamily: F.serif,
    fontSize: 16,
    lineHeight: 22,
    color: '#1F2937',
    // Android-only: stop the platform from adding extra vertical padding
    // around the text run, which pushes single-line placeholders down.
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  chipAddBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAddBtnDisabled: { backgroundColor: '#D6D3D1' },
  chipBlock: { gap: 10 },
  chipBlockLabel: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: '#F8F0D8',
    borderWidth: 1,
    borderColor: '#E8DCC4',
  },
  chipFilledText: {
    fontFamily: F.serifMedium,
    fontSize: 13,
    color: '#7C6328',
  },
  chipSuggested: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE3CF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSuggestedText: {
    fontFamily: F.serif,
    fontSize: 13,
    color: '#6B7280',
  },

  // Lists — single input + commit pattern. Input is white, committed cards
  // sit on a soft parchment fill so the eye reads "this is saved" at a glance.
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryInput: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE3CF',
    paddingHorizontal: 16,
    paddingVertical: 0,
    fontFamily: F.serif,
    fontSize: 16,
    lineHeight: 22,
    color: '#1F2937',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  entryAddBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryAddBtnDisabled: { backgroundColor: '#D6D3D1' },
  itemList: { gap: 8 },
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
    fontSize: 15,
    lineHeight: 22,
    color: '#3D3229',
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
    letterSpacing: 1.6,
    color: '#A8A29E',
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
    fontFamily: F.serif,
    fontSize: 17,
    lineHeight: 26,
    color: '#3D3229',
    textAlign: 'center',
  },
  anastaItalic: {
    fontFamily: F.serifMediumItalic,
    color: '#5C5752',
  },
  anastaWord: {
    fontFamily: F.serifMedium,
    fontSize: 36,
    color: C.gold,
    letterSpacing: 2,
    marginTop: 18,
    textAlign: 'center',
  },
  anastaWordSub: {
    fontFamily: F.serifMediumItalic,
    fontSize: 18,
    color: '#A8853C',
    marginTop: 2,
    textAlign: 'center',
  },
  anastaBtn: {
    marginTop: 28,
    height: 56,
    paddingHorizontal: 28,
    borderRadius: 18,
    backgroundColor: '#1C1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
  anastaBtnText: {
    fontFamily: F.sansBold,
    fontSize: 12,
    letterSpacing: 2.4,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
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
    fontFamily: F.serif,
    fontSize: 17,
    lineHeight: 26,
    color: '#3D3229',
    textAlign: 'center',
  },
  congratsWord: {
    fontFamily: F.serifMedium,
    fontSize: 40,
    color: C.gold,
    letterSpacing: 2,
    marginTop: 14,
    textAlign: 'center',
  },
  congratsWordSub: {
    fontFamily: F.serifMediumItalic,
    fontSize: 18,
    color: '#A8853C',
    marginTop: 2,
    textAlign: 'center',
  },
  congratsBtn: {
    marginTop: 22,
    height: 56,
    paddingHorizontal: 36,
    borderRadius: 18,
    backgroundColor: '#1C1917',
    alignItems: 'center',
    justifyContent: 'center',
  },
  congratsBtnText: {
    fontFamily: F.sansBold,
    fontSize: 12,
    letterSpacing: 2.4,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },

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
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: C.gold,
    textTransform: 'uppercase',
  },
  sumBody: {
    fontFamily: F.serif,
    fontSize: 16,
    lineHeight: 24,
    color: '#1F2937',
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
  summaryHeader: { paddingVertical: 4, gap: 6 },
  summaryHeaderEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: C.gold,
    textTransform: 'uppercase',
  },
  summaryHeaderTitle: {
    fontFamily: F.serifMedium,
    fontSize: 30,
    color: '#1F2937',
  },
  summaryHeaderTagline: {
    fontFamily: F.serifMediumItalic,
    fontSize: 14,
    color: '#A8A29E',
    marginTop: 4,
  },
  // Group dividers in the summary view: WHO I AM BECOMING / LIFE / FAITH.
  // Sit above their associated cards as a quiet section header.
  summaryGroupLabel: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: C.gold,
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: -4,
    paddingHorizontal: 4,
  },
  summaryHeaderAnasta: { color: C.gold, fontFamily: F.serifMedium },

  editBlock: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE3CF',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 10,
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
    fontFamily: F.serif,
    fontSize: 14,
    lineHeight: 22,
    color: '#6B7280',
  },
  linkedComing: {
    marginTop: 4,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.gold,
    textTransform: 'uppercase',
  },

  refineBtn: {
    marginTop: 10,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refineBtnText: {
    fontFamily: F.sansBold,
    fontSize: 12,
    letterSpacing: 2.4,
    color: C.gold,
    textTransform: 'uppercase',
  },
  refineCaption: {
    textAlign: 'center',
    fontFamily: F.serif,
    fontSize: 12,
    color: '#A8A29E',
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
