import { useCallback, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { CheckSmall, ChevronRight, Globe, Lock, Shield } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import { WEB_PACKS } from './focusContent';
import {
  confirmNeverAllowedNativeApplied,
  createNeverAllowedCommitment,
  getDayPlanState,
  grantScreenTimePermission,
  resolveNeverAllowedTarget,
  setNativeProtectionState,
  useDayPlan,
  type NeverAllowedCommitment,
  type NeverAllowedTargetKind,
} from './dayPlanStore';
import { applyNativeProtection, requestNativeAuthorization } from './focusNativeBridge';

const QUESTIONS = [
  {
    title: 'What are you choosing to leave behind?',
    helper: 'Write plainly about what this has taken from your peace, time, relationships, faith, or the person you want to become.',
  },
  {
    title: 'When temptation comes, what does that moment feel like?',
    helper: 'Describe the thoughts, feelings, places, or situations that usually pull you back.',
  },
  {
    title: 'What do you want yourself to do next?',
    helper: 'Give yourself a small, concrete path for the next few minutes: step away, breathe, pray, call someone, or return to what matters.',
  },
] as const;

const ANSWER_MIN = 20;
const ANSWER_MAX = 600;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Seal({ pending = false }: { pending?: boolean }) {
  return (
    <View style={[styles.seal, pending && styles.sealPending]} accessibilityElementsHidden>
      <View style={styles.sealInner}>
        <Lock s={22} c={pending ? '#9B7C48' : '#8F2638'} />
      </View>
    </View>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <View style={styles.progressRow} accessibilityLabel={`Step ${step + 1} of 4`}>
      {[0, 1, 2, 3].map(index => (
        <View key={index} style={[styles.progressTrack, index <= step && styles.progressTrackActive]} />
      ))}
    </View>
  );
}

function HoldToCommit({ disabled, onComplete }: { disabled: boolean; onComplete: () => void }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const complete = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
  }, [onComplete]);
  const gesture = useMemo(() => Gesture.LongPress()
    .enabled(!disabled)
    .minDuration(1250)
    .onBegin(() => {
      progress.value = withTiming(1, { duration: reduceMotion ? 1 : 1250 });
    })
    .onStart(() => {
      runOnJS(complete)();
    })
    .onFinalize(() => {
      progress.value = withTiming(0, { duration: reduceMotion ? 1 : 180 });
    }), [complete, disabled, progress, reduceMotion]);
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel="Make Never Allowed"
        accessibilityHint="Press and hold to make this promise permanent in Anasta"
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: 'activate', label: 'Make Never Allowed' }]}
        onAccessibilityAction={event => {
          if (!disabled && event.nativeEvent.actionName === 'activate') complete();
        }}
        style={[styles.holdButton, disabled && styles.holdButtonDisabled]}
      >
        <Animated.View style={[styles.holdFill, fillStyle]} />
        <Lock s={17} c="#FFF9EF" />
        <Text style={styles.holdLabel}>MAKE NEVER ALLOWED</Text>
        <Text style={styles.holdHint}>HOLD</Text>
      </Animated.View>
    </GestureDetector>
  );
}

function TargetPicker({
  onSelect,
}: {
  onSelect: (kind: NeverAllowedTargetKind, id: string) => void;
}) {
  const state = useDayPlan();
  const permanentByTarget = useMemo(() => {
    const result = new Map<string, Set<string>>();
    const neverAllowed = Array.isArray(state.purity.neverAllowed) ? state.purity.neverAllowed : [];
    for (const commitment of neverAllowed) {
      const key = `${commitment.targetKind}:${commitment.targetId}`;
      const current = result.get(key) ?? new Set<string>();
      commitment.domainsSnapshot.forEach(domain => current.add(domain));
      result.set(key, current);
    }
    return result;
  }, [state.purity.neverAllowed]);
  const hasNewScope = useCallback((kind: NeverAllowedTargetKind, id: string) => {
    const target = resolveNeverAllowedTarget(kind, id);
    const sealed = permanentByTarget.get(`${kind}:${id}`) ?? new Set<string>();
    return !!target?.domains.some(domain => !sealed.has(domain));
  }, [permanentByTarget]);

  const targets = [
    ...WEB_PACKS
      .filter(pack => hasNewScope('builtin-pack', pack.id))
      .map(pack => ({ kind: 'builtin-pack' as const, id: pack.id, label: pack.name, detail: pack.detail })),
    ...state.purity.customPacks
      .filter(pack => hasNewScope('custom-pack', pack.id))
      .map(pack => ({ kind: 'custom-pack' as const, id: pack.id, label: pack.name, detail: `${pack.domains.length} websites` })),
    ...state.purity.customDomains
      .filter(entry => hasNewScope('domain', entry.domain))
      .map(entry => ({ kind: 'domain' as const, id: entry.domain, label: entry.domain, detail: 'Individual website' })),
  ];

  return (
    <ScrollView contentContainerStyle={styles.pickerContent} keyboardShouldPersistTaps="handled">
      <Animated.View entering={FadeInDown.duration(360)}>
        <Text style={styles.eyebrow}>A PERMANENT WEB PROMISE</Text>
        <Text style={styles.heroTitle}>What should remain closed?</Text>
        <Text style={styles.heroBody}>
          Choose one web pack or domain. You will see its exact scope before anything becomes permanent.
        </Text>
      </Animated.View>
      <View style={styles.targetList}>
        {targets.map((target, index) => {
          const snapshot = resolveNeverAllowedTarget(target.kind, target.id);
          return (
            <Animated.View key={`${target.kind}:${target.id}`} entering={FadeInDown.delay(70 + index * 35).duration(320)}>
              <TouchableOpacity
                haptic="light"
                activeOpacity={0.78}
                style={styles.targetCard}
                onPress={() => onSelect(target.kind, target.id)}
              >
                <View style={styles.targetIcon}><Globe s={19} c="#87672C" /></View>
                <View style={styles.targetCopy}>
                  <Text style={styles.targetTitle}>{target.label}</Text>
                  <Text style={styles.targetDetail}>{target.detail} · {snapshot?.domains.length ?? 0} domains</Text>
                </View>
                <ChevronRight s={18} c="#A28F6C" />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
        {targets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Seal />
            <Text style={styles.emptyTitle}>Everything listed here is already sealed.</Text>
            <Text style={styles.emptyBody}>New catalog domains will always require a new confirmation.</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function PromiseReminder({ commitment }: { commitment: NeverAllowedCommitment }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const breath = useSharedValue(0.82);
  const [quiet, setQuiet] = useState(false);
  const breathStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));

  const startQuiet = () => {
    setQuiet(true);
    breath.value = reduceMotion
      ? 1
      : withRepeat(withTiming(1.12, { duration: 4200 }), -1, true);
  };
  const pages = [
    { kicker: 'YOUR PROMISE IS HOLDING', title: 'This stays blocked.', body: 'You asked Anasta to keep this promise. There is no override control here.' },
    { kicker: 'A MESSAGE FROM YOU, TO YOU', title: commitment.reason, body: commitment.temptation },
    { kicker: 'WHAT YOU TOLD YOURSELF TO DO NOW', title: commitment.nextStep, body: 'Choose the smallest faithful next action. You do not need to solve the whole day in this moment.' },
    { kicker: 'LET THIS MOMENT PASS', title: 'Your promise still stands.', body: 'You may feel frustrated right now. You do not have to follow this feeling.' },
  ];
  const page = pages[step];

  return (
    <View style={styles.screen}>
      <ScreenTitleBar title="YOUR PROMISE" showBack bg="#FBF7EE" />
      <View style={styles.reminderWrap}>
        <Animated.View key={step} entering={reduceMotion ? undefined : FadeIn.duration(360)} style={styles.reminderCard}>
          <Seal />
          <Text style={styles.reminderTarget}>{commitment.targetLabel} · {commitment.domainsSnapshot.length} domains</Text>
          <Text style={styles.eyebrow}>{page.kicker}</Text>
          <Text style={styles.reminderTitle}>{page.title}</Text>
          <View style={styles.fineRule} />
          <Text style={styles.reminderBody}>{page.body}</Text>
          {quiet ? (
            <View style={styles.quietWrap}>
              <Animated.View style={[styles.breathCircle, breathStyle]} />
              <Text style={styles.quietText}>Breathe slowly. This feeling can move through you.</Text>
            </View>
          ) : null}
        </Animated.View>
        {step < 3 ? (
          <GoldButton label="Continue" onPress={() => setStep(value => value + 1)} />
        ) : (
          <View style={styles.copingActions}>
            <GoldButton label="Pray now" onPress={() => router.push('/jesus-prayer' as never)} />
            <GoldButton label="Take a quiet minute" variant="outline" onPress={startQuiet} />
            <TouchableOpacity haptic="light" onPress={() => router.back()} style={styles.returnButton}>
              <Text style={styles.returnText}>Return to Anasta</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

export default function NeverAllowedView() {
  const params = useLocalSearchParams<{ mode?: string; commitment?: string; targetKind?: string; targetId?: string; candidateDomain?: string }>();
  const router = useRouter();
  const state = useDayPlan();
  const neverAllowed = Array.isArray(state.purity.neverAllowed) ? state.purity.neverAllowed : [];
  const reduceMotion = useReducedMotion();
  const mode = firstParam(params.mode);
  const commitmentId = firstParam(params.commitment);
  const reminder = neverAllowed.find(entry => entry.id === commitmentId);
  const initialKind = firstParam(params.targetKind) as NeverAllowedTargetKind | undefined;
  const initialId = firstParam(params.targetId);
  const candidateDomain = firstParam(params.candidateDomain);
  const [target, setTarget] = useState<{ kind: NeverAllowedTargetKind; id: string } | null>(
    initialKind && initialId ? { kind: initialKind, id: initialId } : null
  );
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(['', '', '']);
  const [reusedFromId, setReusedFromId] = useState<string | undefined>();
  const [understood, setUnderstood] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'success' | 'recovery' | null>(null);
  const [error, setError] = useState('');
  const submitRef = useRef(false);

  if (mode === 'reminder' && reminder) return <PromiseReminder commitment={reminder} />;

  const targetSnapshot = target
    ? (() => {
        const resolved = resolveNeverAllowedTarget(target.kind, target.id);
        return resolved && candidateDomain ? { ...resolved, domains: [candidateDomain] } : resolved;
      })()
    : null;
  const answer = answers[step] ?? '';
  const answerValid = answer.trim().length >= ANSWER_MIN && answer.trim().length <= ANSWER_MAX;

  const copyPreviousPromise = (entry: NeverAllowedCommitment) => {
    setAnswers([entry.reason, entry.temptation, entry.nextStep]);
    setReusedFromId(entry.id);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const submit = async () => {
    if (!target || submitRef.current) return;
    submitRef.current = true;
    setSubmitting(true);
    setError('');
    let readyState = getDayPlanState();
    if (readyState.permission !== 'approved') {
      const authorization = await requestNativeAuthorization();
      if (authorization !== 'approved') {
        setError('Screen Time permission must be active before Anasta can keep a permanent web promise.');
        setSubmitting(false);
        submitRef.current = false;
        return;
      }
      grantScreenTimePermission('approved');
      readyState = getDayPlanState();
    }
    if (readyState.nativeProtection.status !== 'applied') {
      try {
        const ready = await applyNativeProtection(readyState);
        if (!ready.applied) throw new Error('Native protection was not applied.');
        setNativeProtectionState({ status: 'applied', appliedAt: Date.now(), error: null, hardWallDate: null });
      } catch {
        setError('Anasta could not verify native protection. Restore Screen Time permission, then hold again.');
        setSubmitting(false);
        submitRef.current = false;
        return;
      }
    }
    const created = createNeverAllowedCommitment({
      targetKind: target.kind,
      targetId: target.id,
      reason: answers[0],
      temptation: answers[1],
      nextStep: answers[2],
      reusedFromId,
      candidateDomain,
    });
    if (!created.ok) {
      const copy = {
        permission: 'Screen Time permission must be active before Anasta can keep a permanent web promise.',
        native: 'Protection must be successfully applied on this iPhone before the promise can be finalized.',
        answers: 'Each answer must contain between 20 and 600 characters.',
        target: 'This web target is no longer available.',
        duplicate: 'Every domain in this target is already Never Allowed.',
        capacity: 'This promise cannot fit inside Apple’s 50-domain explicit protection limit.',
      }[created.reason];
      setError(copy);
      setSubmitting(false);
      submitRef.current = false;
      return;
    }
    try {
      const applied = await applyNativeProtection(getDayPlanState());
      if (applied.applied) {
        confirmNeverAllowedNativeApplied(created.commitment.id);
        setResult('success');
      } else {
        setResult('recovery');
      }
    } catch {
      setResult('recovery');
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (result) return router.back();
    if (target && step > 0) return setStep(value => value - 1);
    if (target) return setTarget(null);
    router.back();
  };

  if (!target) {
    return (
      <View style={styles.screen}>
        <ScreenTitleBar title="NEVER ALLOWED" showBack bg="#FBF7EE" />
        <TargetPicker onSelect={(kind, id) => setTarget({ kind, id })} />
      </View>
    );
  }

  if (result) {
    return (
      <View style={styles.screen}>
        <ScreenTitleBar title="PROMISE SEALED" showBack onBackOverride={() => router.back()} bg="#FBF7EE" />
        <View style={styles.resultWrap}>
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(460)}>
            <Seal pending={result === 'recovery'} />
            <Text style={styles.resultTitle}>{result === 'success' ? 'Your promise is active.' : 'Your promise is saved.'}</Text>
            <Text style={styles.resultBody}>
              {result === 'success'
                ? `${targetSnapshot?.label ?? 'This target'} is now Never Allowed in Anasta.`
                : 'Anasta could not confirm native protection. The promise remains saved and protected here; restore Screen Time permission to finish recovery.'}
            </Text>
          </Animated.View>
          <GoldButton label="Return to Web Protection" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenTitleBar title="NEVER ALLOWED" showBack onBackOverride={goBack} bg="#FBF7EE" />
      <Progress step={step} />
      {step < 3 ? (
        <ScrollView
          key={step}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.questionContent}
          automaticallyAdjustKeyboardInsets
        >
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(360)}>
            <Text style={styles.questionNumber}>PROMISE · {step + 1} OF 3</Text>
            <Text style={styles.questionTitle}>{QUESTIONS[step].title}</Text>
            <Text style={styles.questionHelper}>{QUESTIONS[step].helper}</Text>
            <View style={[styles.inputCard, answerValid && styles.inputCardValid]}>
              <TextInput
                value={answer}
                onChangeText={value => setAnswers(current => current.map((item, index) => index === step ? value : item))}
                placeholder="Write honestly, in your own words…"
                placeholderTextColor="#A79D8B"
                multiline
                maxLength={ANSWER_MAX}
                textAlignVertical="top"
                autoFocus={false}
                style={styles.input}
                accessibilityLabel={QUESTIONS[step].title}
              />
              <Text style={[styles.counter, answer.trim().length > 0 && !answerValid && styles.counterInvalid]}>
                {answer.trim().length}/{ANSWER_MAX} · minimum {ANSWER_MIN}
              </Text>
            </View>
            {neverAllowed.length > 0 && step === 0 ? (
              <View style={styles.reuseBlock}>
                <Text style={styles.reuseLabel}>USE A PREVIOUS PROMISE</Text>
                {neverAllowed.slice().reverse().slice(0, 3).map(entry => (
                  <TouchableOpacity key={entry.id} haptic="light" style={styles.reuseRow} onPress={() => copyPreviousPromise(entry)}>
                    <Text numberOfLines={1} style={styles.reuseTitle}>{entry.targetLabel}</Text>
                    <Text style={styles.reuseAction}>Copy & edit</Text>
                  </TouchableOpacity>
                ))}
                <Text style={styles.reuseHint}>This copies your answers into a new draft. The original promise never changes.</Text>
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.reviewContent}>
          <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(360)}>
            <Text style={styles.eyebrow}>REVIEW THE PROMISE</Text>
            <Text style={styles.reviewTitle}>{targetSnapshot?.label}</Text>
            <Text style={styles.reviewScope}>{targetSnapshot?.domains.length ?? 0} domains · snapshot locked at confirmation</Text>
            {QUESTIONS.map((question, index) => (
              <View key={question.title} style={styles.answerCard}>
                <Text style={styles.answerLabel}>{question.title}</Text>
                <Text style={styles.answerText}>{answers[index]}</Text>
              </View>
            ))}
            <View style={styles.warningCard}>
              <Shield s={20} c="#8F2638" />
              <Text style={styles.warningText}>
                There is no unlock, countdown, deletion, or recovery inside Anasta while the app and Screen Time permission remain present.
              </Text>
            </View>
            <TouchableOpacity
              haptic="light"
              activeOpacity={0.76}
              onPress={() => setUnderstood(value => !value)}
              style={styles.understandRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: understood }}
            >
              <View style={[styles.checkbox, understood && styles.checkboxChecked]}>
                {understood ? <CheckSmall s={15} c="#FFF" /> : null}
              </View>
              <Text style={styles.understandText}>I understand that Anasta will not provide an unlock for this promise.</Text>
            </TouchableOpacity>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </Animated.View>
        </ScrollView>
      )}
      <View style={styles.footer}>
        {step < 3 ? (
          <GoldButton label={step === 2 ? 'Review promise' : 'Continue'} disabled={!answerValid} onPress={() => setStep(value => value + 1)} />
        ) : (
          <HoldToCommit disabled={!understood || submitting} onComplete={() => void submit()} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBF7EE' },
  pickerContent: { paddingHorizontal: 20, paddingBottom: 50 },
  eyebrow: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2.1, color: '#8F2638' },
  heroTitle: { marginTop: 8, fontFamily: F.serifSemiBold, fontSize: 32, lineHeight: 35, letterSpacing: -0.45, color: C.text },
  heroBody: { marginTop: 8, maxWidth: 355, fontFamily: F.serif, fontSize: 16.5, lineHeight: 22, color: '#71675C' },
  targetList: { marginTop: 24, gap: 10 },
  targetCard: { minHeight: 74, paddingHorizontal: 15, paddingVertical: 13, borderWidth: 1, borderColor: '#E4D8C2', borderRadius: 18, backgroundColor: '#FFFCF7', flexDirection: 'row', alignItems: 'center' },
  targetIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F3E9D5', alignItems: 'center', justifyContent: 'center' },
  targetCopy: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
  targetTitle: { fontFamily: F.serifSemiBold, fontSize: 18, color: C.text },
  targetDetail: { marginTop: 2, fontFamily: F.sans, fontSize: 11.5, lineHeight: 15.5, color: C.textSecondary },
  emptyCard: { paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center', borderWidth: 1, borderColor: '#E5D7BC', borderRadius: 22, backgroundColor: '#FFFCF7' },
  emptyTitle: { marginTop: 14, textAlign: 'center', fontFamily: F.serifSemiBold, fontSize: 19, color: C.text },
  emptyBody: { marginTop: 5, textAlign: 'center', fontFamily: F.serif, fontSize: 14, lineHeight: 19, color: C.textSecondary },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 22, paddingTop: 8 },
  progressTrack: { flex: 1, height: 3, borderRadius: 3, backgroundColor: '#E6D9C2' },
  progressTrackActive: { backgroundColor: '#9A3847' },
  questionContent: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 30 },
  questionNumber: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: '#9A3847' },
  questionTitle: { marginTop: 10, fontFamily: F.serifSemiBold, fontSize: 30, lineHeight: 34, letterSpacing: -0.4, color: C.text },
  questionHelper: { marginTop: 9, fontFamily: F.serif, fontSize: 16, lineHeight: 22, color: '#70665B' },
  inputCard: { marginTop: 22, minHeight: 210, borderWidth: 1.2, borderColor: '#DDCEB4', borderRadius: 20, backgroundColor: '#FFFCF7', overflow: 'hidden' },
  inputCardValid: { borderColor: '#BFA66F' },
  input: { minHeight: 174, paddingHorizontal: 17, paddingTop: 16, paddingBottom: 8, fontFamily: F.serif, fontSize: 18, lineHeight: 24, color: C.text },
  counter: { paddingHorizontal: 16, paddingBottom: 12, textAlign: 'right', fontFamily: F.sansMedium, fontSize: 10.5, color: '#9C927F' },
  counterInvalid: { color: '#A24351' },
  reuseBlock: { marginTop: 22 },
  reuseLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.7, color: '#8D806D' },
  reuseRow: { marginTop: 8, minHeight: 46, paddingHorizontal: 13, borderRadius: 14, backgroundColor: '#F3EAD9', flexDirection: 'row', alignItems: 'center' },
  reuseTitle: { flex: 1, fontFamily: F.serifMedium, fontSize: 15.5, color: C.text },
  reuseAction: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 0.7, color: '#8F2638' },
  reuseHint: { marginTop: 7, fontFamily: F.sans, fontSize: 10.5, lineHeight: 14.5, color: C.textMuted },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 30 : 20, backgroundColor: '#FBF7EE' },
  reviewContent: { paddingHorizontal: 20, paddingTop: 25, paddingBottom: 24 },
  reviewTitle: { marginTop: 7, fontFamily: F.serifSemiBold, fontSize: 29, color: C.text },
  reviewScope: { marginTop: 3, marginBottom: 15, fontFamily: F.sansMedium, fontSize: 11.5, color: C.textSecondary },
  answerCard: { marginTop: 10, padding: 15, borderWidth: 1, borderColor: '#E4D7C0', borderRadius: 17, backgroundColor: '#FFFCF7' },
  answerLabel: { fontFamily: F.sansBold, fontSize: 8.5, lineHeight: 12, letterSpacing: 1.05, textTransform: 'uppercase', color: '#8F2638' },
  answerText: { marginTop: 7, fontFamily: F.serif, fontSize: 16.5, lineHeight: 21.5, color: '#3B352F' },
  warningCard: { marginTop: 14, padding: 15, borderRadius: 17, backgroundColor: '#F7E9E8', flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  warningText: { flex: 1, fontFamily: F.serifMedium, fontSize: 14.5, lineHeight: 19, color: '#6D333B' },
  understandRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 11 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.2, borderColor: '#A78E65', backgroundColor: '#FFFCF7', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { borderColor: '#8F2638', backgroundColor: '#8F2638' },
  understandText: { flex: 1, fontFamily: F.serifMedium, fontSize: 14.5, lineHeight: 18.5, color: C.text },
  errorText: { marginTop: 12, fontFamily: F.sansMedium, fontSize: 11.5, lineHeight: 16, color: '#A24351', textAlign: 'center' },
  holdButton: { height: 58, borderRadius: 999, backgroundColor: '#6E1F2E', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#7B2031', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  holdButtonDisabled: { opacity: 0.42 },
  holdFill: { ...StyleSheet.absoluteFillObject, backgroundColor: '#A13B4C' },
  holdLabel: { fontFamily: F.sansBold, fontSize: 11.5, letterSpacing: 1.45, color: '#FFF9EF' },
  holdHint: { position: 'absolute', right: 18, fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1.1, color: 'rgba(255,249,239,0.65)' },
  seal: { alignSelf: 'center', width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: '#9A3345', backgroundColor: '#F6E7E7', alignItems: 'center', justifyContent: 'center', shadowColor: '#8F2638', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  sealPending: { borderColor: '#B39255', backgroundColor: '#F4EBD8' },
  sealInner: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: 'rgba(143,38,56,0.3)', alignItems: 'center', justifyContent: 'center' },
  resultWrap: { flex: 1, paddingHorizontal: 28, paddingVertical: 40, justifyContent: 'space-between' },
  resultTitle: { marginTop: 24, textAlign: 'center', fontFamily: F.serifSemiBold, fontSize: 31, color: C.text },
  resultBody: { marginTop: 10, textAlign: 'center', fontFamily: F.serif, fontSize: 17, lineHeight: 23, color: C.textSecondary },
  reminderWrap: { flex: 1, paddingHorizontal: 22, paddingTop: 22, paddingBottom: Platform.OS === 'ios' ? 30 : 20, justifyContent: 'space-between' },
  reminderCard: { flex: 1, marginBottom: 22, paddingHorizontal: 22, paddingVertical: 28, borderRadius: 26, borderWidth: 1, borderColor: '#E4D5BA', backgroundColor: '#FFFCF7', alignItems: 'center', justifyContent: 'center' },
  reminderTarget: { marginTop: 12, marginBottom: 22, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.15, color: '#8E7A59', textTransform: 'uppercase' },
  reminderTitle: { marginTop: 12, fontFamily: F.serifSemiBold, fontSize: 28, lineHeight: 33, color: C.text, textAlign: 'center' },
  fineRule: { marginVertical: 17, width: 54, height: 1, backgroundColor: '#C4A76F' },
  reminderBody: { fontFamily: F.serif, fontSize: 17, lineHeight: 23, color: '#6F655A', textAlign: 'center' },
  copingActions: { gap: 10 },
  returnButton: { height: 42, alignItems: 'center', justifyContent: 'center' },
  returnText: { fontFamily: F.serifSemiBold, fontSize: 15.5, color: C.textSecondary },
  quietWrap: { marginTop: 24, alignItems: 'center' },
  breathCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(197,160,89,0.23)', borderWidth: 1, borderColor: '#C5A059' },
  quietText: { marginTop: 16, fontFamily: F.serifItalic, fontSize: 14.5, color: C.textSecondary, textAlign: 'center' },
});
