import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Reanimated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  BellRing,
  BookMarked,
  Candle,
  CheckSmall,
  ChevronRight,
  Clock,
  Cross,
  Crown,
  Feather,
  Heart,
  Hourglass,
  ListChecks,
  OpenBook,
  SlidersHorizontal,
  Sparkles,
  Target,
} from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { AnyTaskCard, type TaskData } from '@/components/shared/TaskCards';
import { playAchievementCompleteFeedback, preloadAchievementFeedbackSound } from '@/components/shared/taskFeedback';
import { C, F } from '@/constants/tokens';

type ChristianAnswer = 'yes' | 'exploring' | 'no' | 'prefer_not';
type TraditionAnswer = 'orthodox' | 'catholic' | 'protestant' | 'oriental' | 'other' | 'prefer_not';
type AgeAnswer = 'under_18' | '18_24' | '25_34' | '35_44' | '45_plus';
type GenderAnswer = 'male' | 'female';
type ReasonAnswer =
  | 'organize'
  | 'grow_spiritually'
  | 'spiritual_discipline'
  | 'daily_discipline'
  | 'focus'
  | 'beat_addiction'
  | 'closer_to_god'
  | 'important'
  | 'consistent'
  | 'screen_time'
  | 'procrastination'
  | 'routines';
type RoutineAnswer = 'morning' | 'evening' | 'prayer' | 'work';
type FocusAnswer = 'pomodoro' | 'blockers' | 'deep_work' | 'screen_time';
type PillarAnswer = 'organize' | 'focus' | 'spiritual';
type StepId =
  | 'welcome'
  | 'questionIntro'
  | 'christian'
  | 'tradition'
  | 'age'
  | 'gender'
  | 'reason'
  | 'processing'
  | 'bridge'
  | 'pillars'
  | 'organizeIntro'
  | 'taskTypes'
  | 'taskSetup'
  | 'taskManagement'
  | 'focusCost'
  | 'blockers'
  | 'focusSetup'
  | 'routine'
  | 'focus'
  | 'bibleFree'
  | 'bibleReading'
  | 'bibleTools'
  | 'paywall';

type PreloadPhase = 'only' | 'exit' | 'done';

type SectionProgress = {
  key: 'questions' | 'organize' | 'focus' | 'spiritual';
  index: number;
  total: number;
};

type Answers = {
  christian?: ChristianAnswer;
  tradition?: TraditionAnswer;
  age?: AgeAnswer;
  gender?: GenderAnswer;
  reasons?: ReasonAnswer[];
  primaryPillar?: PillarAnswer;
  routine?: RoutineAnswer;
  focus?: FocusAnswer;
};

type Option<Value extends string> = {
  value: Value;
  title: string;
  body: string;
  response?: string;
  icon: React.ReactNode;
};

type SetupFeature = {
  eyebrow: string;
  title: string;
  subtitle: string;
  pillar: string;
  valueTitle: string;
  valueBody: string;
  previewTitle: string;
  previewRows: string[];
  options: Option<string>[];
};

const GOLD = C.gold;
const INK = '#191714';
const PAPER = '#FFFDF9';
const MUTED = '#776E64';
const APP_LOGO = require('@/assets/images/anasta-logo.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CONFETTI_SOURCE = require('@/assets/animations/onboarding-confetti.lottie');

const CHRISTIAN_OPTIONS: Option<ChristianAnswer>[] = [
  {
    value: 'yes',
    title: 'Yes',
    body: 'I follow Christ.',
    response: 'Good. We will keep your spiritual life close to your daily rhythm.',
    icon: <Cross s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'exploring',
    title: "I'm exploring",
    body: 'I am open, curious, or returning.',
    response: 'Then Anasta can give you a quiet place to begin without pressure.',
    icon: <Sparkles s={21} c={GOLD} w={1.9} />,
  },
  {
    value: 'no',
    title: 'No',
    body: 'I mainly want discipline and structure.',
    response: 'Then we will focus on order, routines, focus, and steady progress.',
    icon: <ListChecks s={22} c={GOLD} w={1.9} />,
  },
  {
    value: 'prefer_not',
    title: 'Prefer not to say',
    body: 'Keep this private.',
    response: 'That is fine. Your path can still be built with care and clarity.',
    icon: <Heart s={21} c={GOLD} w={1.8} />,
  },
];

const TRADITION_OPTIONS: Option<TraditionAnswer>[] = [
  {
    value: 'orthodox',
    title: 'Orthodox',
    body: 'Prayer, Scripture, feasts, and spiritual rhythm.',
    response: 'Beautiful. Anasta will be shaped around rhythm, return, and practice.',
    icon: <Cross s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'catholic',
    title: 'Catholic',
    body: 'Daily discipline with room for prayer and devotion.',
    response: 'Good. We will build a structure that helps faith become regular.',
    icon: <BookMarked s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'protestant',
    title: 'Protestant',
    body: 'Scripture, prayer, habits, and personal growth.',
    response: 'Good. We will keep the Word and your daily practice easy to return to.',
    icon: <Feather s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'oriental',
    title: 'Oriental Orthodox',
    body: 'Ancient rhythm, prayer, fasting, and remembrance.',
    response: 'Good. Anasta can support a serious spiritual rhythm without noise.',
    icon: <Crown s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'other',
    title: 'Other Christian',
    body: 'A Christian tradition not listed here.',
    response: 'Understood. We will keep this flexible and centered on practice.',
    icon: <Sparkles s={21} c={GOLD} w={1.9} />,
  },
  {
    value: 'prefer_not',
    title: 'Prefer not to say',
    body: 'Skip this detail.',
    response: 'No problem. Anasta will stay useful without needing every label.',
    icon: <Heart s={21} c={GOLD} w={1.8} />,
  },
];

const AGE_OPTIONS: Option<AgeAnswer>[] = [
  {
    value: 'under_18',
    title: 'Under 18',
    body: 'Build structure for what matters to you now.',
    response: 'Good. We are glad to help you organize your goals, faith, focus, and daily rhythm with care.',
    icon: <Sparkles s={21} c={GOLD} w={1.9} />,
  },
  {
    value: '18_24',
    title: '18-24',
    body: 'Create rhythm, direction, and discipline.',
    response: 'Good. Anasta can help turn intention into a clear rhythm you can return to every day.',
    icon: <Target s={22} c={GOLD} w={1.8} />,
  },
  {
    value: '25_34',
    title: '25-34',
    body: 'Keep your priorities visible and organized.',
    response: 'Good. We will help you keep daily responsibilities, spiritual life, and long-term goals in one calm structure.',
    icon: <ListChecks s={22} c={GOLD} w={1.9} />,
  },
  {
    value: '35_44',
    title: '35-44',
    body: 'Strengthen your rhythm and protect your attention.',
    response: 'Good. Anasta can help you carry what matters with more clarity, less noise, and a steadier daily system.',
    icon: <Crown s={22} c={GOLD} w={1.8} />,
  },
  {
    value: '45_plus',
    title: '45+',
    body: 'Bring more order, reflection, and consistency.',
    response: 'Good. We are glad to help you build a system that respects your priorities and supports your daily walk.',
    icon: <Heart s={21} c={GOLD} w={1.8} />,
  },
];

const GENDER_OPTIONS: Option<GenderAnswer>[] = [
  {
    value: 'male',
    title: 'Male',
    body: 'A little context for the people Anasta serves.',
    response: 'Thank you. This helps us understand who Anasta is serving.',
    icon: <Crown s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'female',
    title: 'Female',
    body: 'A little context for the people Anasta serves.',
    response: 'Thank you. This helps us understand who Anasta is serving.',
    icon: <Heart s={21} c={GOLD} w={1.8} />,
  },
];

const REASON_OPTIONS: Option<ReasonAnswer>[] = [
  {
    value: 'organize',
    title: 'Organize my life',
    body: 'Tasks, routines, goals, and events in one place.',
    response: 'Then we will begin with structure: tasks, routines, monthly goals, and events.',
    icon: <ListChecks s={22} c={GOLD} w={1.9} />,
  },
  {
    value: 'grow_spiritually',
    title: 'Grow spiritually',
    body: 'Prayer, Scripture, gratitude, and reflection.',
    response: 'Then we will make your spiritual rhythm visible and easier to return to.',
    icon: <Cross s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'spiritual_discipline',
    title: 'Build discipline in spiritual life',
    body: 'Keep prayer, Scripture, and reflection steady.',
    response: 'Good. Spiritual discipline grows through a rhythm you can return to.',
    icon: <Target s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'daily_discipline',
    title: 'Build discipline in daily tasks',
    body: 'Follow through on work, chores, habits, and plans.',
    response: 'Then we will make daily discipline practical, visible, and repeatable.',
    icon: <ListChecks s={22} c={GOLD} w={1.9} />,
  },
  {
    value: 'focus',
    title: 'Protect my focus',
    body: 'Less distraction. More intentional time.',
    response: 'Then focus protection should become part of your daily structure.',
    icon: <Sparkles s={21} c={GOLD} w={1.9} />,
  },
  {
    value: 'beat_addiction',
    title: 'Beat addiction',
    body: 'Build guardrails, replace triggers, and rise after setbacks.',
    response: 'Then Anasta should help you build protection, replacement habits, and a way back after a fall.',
    icon: <Heart s={21} c={GOLD} w={1.8} />,
  },
  {
    value: 'closer_to_god',
    title: 'Grow closer to God',
    body: 'Make space for prayer, repentance, Scripture, and gratitude.',
    response: 'Then your spiritual life should not be hidden in a forgotten corner of the app.',
    icon: <Cross s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'important',
    title: 'Prepare for something important',
    body: 'A season, event, exam, milestone, or change.',
    response: 'Then we will give that season a place in your daily rhythm.',
    icon: <Crown s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'consistent',
    title: 'Become more consistent',
    body: 'Fall less often, and rise faster when you do.',
    response: 'That is the heart of Anasta: rise again, then keep walking.',
    icon: <Heart s={21} c={GOLD} w={1.8} />,
  },
  {
    value: 'screen_time',
    title: 'Reduce screen time',
    body: 'Use your phone with intention instead of drift.',
    response: 'Then focus tools and blockers should help your phone serve your life, not steal it.',
    icon: <Target s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'procrastination',
    title: 'Stop procrastinating',
    body: 'Turn vague intention into the next concrete step.',
    response: 'Then we will help you break work into steps small enough to start.',
    icon: <Sparkles s={21} c={GOLD} w={1.9} />,
  },
  {
    value: 'routines',
    title: 'Build better routines',
    body: 'Morning, evening, prayer, work, health, and reset rhythms.',
    response: 'Then routines should become the backbone of your setup.',
    icon: <ListChecks s={22} c={GOLD} w={1.9} />,
  },
];

const ROUTINE_OPTIONS: Option<RoutineAnswer>[] = [
  {
    value: 'morning',
    title: 'Morning discipline',
    body: 'Prayer, planning, and the first task before noise starts.',
    icon: <Sparkles s={21} c={GOLD} w={1.9} />,
  },
  {
    value: 'evening',
    title: 'Evening reset',
    body: 'Review the day, prepare tomorrow, and close with intention.',
    icon: <Feather s={21} c={GOLD} w={1.8} />,
  },
  {
    value: 'prayer',
    title: 'Prayer rhythm',
    body: 'A repeatable rule of prayer that does not disappear from the day.',
    icon: <Candle s={21} c={GOLD} w={1.8} />,
  },
  {
    value: 'work',
    title: 'Work block',
    body: 'A focused routine for study, work, or a serious project.',
    icon: <ListChecks s={22} c={GOLD} w={1.9} />,
  },
];

const FOCUS_OPTIONS: Option<FocusAnswer>[] = [
  {
    value: 'pomodoro',
    title: 'Start with Pomodoro',
    body: 'Work in clean focused blocks with short breaks.',
    icon: <Clock s={21} c={GOLD} w={1.9} />,
  },
  {
    value: 'blockers',
    title: 'Block distractions',
    body: 'Protect prayer, work, study, and sleep from impulse taps.',
    icon: <SlidersHorizontal s={21} c={GOLD} w={1.8} />,
  },
  {
    value: 'deep_work',
    title: 'Deep work ritual',
    body: 'A calm block for meaningful work, not just busy work.',
    icon: <Target s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'screen_time',
    title: 'Reduce screen time',
    body: 'See the pattern, set the guardrail, and rise after a fall.',
    icon: <Hourglass s={22} c={GOLD} w={1.6} />,
  },
];

const PILLAR_OPTIONS: Option<PillarAnswer>[] = [
  {
    value: 'organize',
    title: 'Organize my life',
    body: 'Tasks, habits, routines, goals, and events.',
    response: 'Good. We will start by turning scattered plans into a visible system.',
    icon: <ListChecks s={22} c={GOLD} w={1.9} />,
  },
  {
    value: 'focus',
    title: 'Protect my focus',
    body: 'Blockers, focus time, phone boundaries, and deep work.',
    response: 'Good. We will help your phone serve your life instead of quietly taking it.',
    icon: <Target s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'spiritual',
    title: 'Grow spiritually',
    body: 'Scripture, prayer, spiritual tasks, notes, and challenges.',
    response: 'Good. We will keep your spiritual life close to your daily rhythm.',
    icon: <Cross s={22} c={GOLD} w={1.8} />,
  },
];

function stepOrder(answers: Answers): StepId[] {
  const questionSteps: StepId[] =
    answers.christian === 'yes'
      ? ['christian', 'tradition', 'age', 'gender', 'reason']
      : ['christian', 'age', 'gender', 'reason'];

  return [
    'welcome',
    'questionIntro',
    ...questionSteps,
    'processing',
    'bridge',
    'organizeIntro',
    'taskTypes',
    'taskSetup',
    'taskManagement',
    'focusCost',
    'blockers',
    'focusSetup',
    'bibleFree',
    'bibleReading',
    'bibleTools',
    'paywall',
  ];
}

function selectedFor(step: StepId, answers: Answers) {
  if (step === 'christian') return answers.christian;
  if (step === 'tradition') return answers.tradition;
  if (step === 'age') return answers.age;
  if (step === 'gender') return answers.gender;
  if (step === 'pillars') return answers.primaryPillar;
  if (step === 'routine') return answers.routine;
  if (step === 'focus') return answers.focus;
  return undefined;
}

function selectedValuesFor(step: StepId, answers: Answers): string[] {
  if (step === 'reason') return answers.reasons ?? [];
  const selected = selectedFor(step, answers);
  return selected ? [selected] : [];
}

function getOptions(step: StepId): Option<string>[] {
  if (step === 'christian') return CHRISTIAN_OPTIONS;
  if (step === 'tradition') return TRADITION_OPTIONS;
  if (step === 'age') return AGE_OPTIONS;
  if (step === 'gender') return GENDER_OPTIONS;
  if (step === 'reason') return REASON_OPTIONS;
  return [];
}

function questionCopy(step: StepId) {
  if (step === 'christian') {
    return {
      eyebrow: 'First, a little context',
      title: 'Are you Christian?',
      subtitle: 'Anasta can be used for daily structure, spiritual growth, or both. This helps us start in the right place.',
    };
  }
  if (step === 'tradition') {
    return {
      eyebrow: 'Your faith',
      title: 'Which tradition are you part of?',
      subtitle: 'We will use this carefully, mostly to shape the spiritual language and prayer context.',
    };
  }
  if (step === 'age') {
    return {
      eyebrow: 'Your season',
      title: 'How old are you?',
      subtitle: 'Different seasons need different rhythms. Keep it broad, keep it simple.',
    };
  }
  if (step === 'gender') {
    return {
      eyebrow: 'A little more context',
      title: 'Are you male or female?',
      subtitle: 'This helps us understand who Anasta is serving.',
    };
  }
  return {
    eyebrow: 'Choose your starting points',
    title: 'Why did you download Anasta?',
    subtitle: 'Select everything that fits. We will use this to decide what the app sets up first.',
  };
}

function runSelectionHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function runAdvanceHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function optionEntrance(index: number) {
  const entrance = index % 2 === 0 ? FadeInLeft : FadeInRight;
  return entrance
    .delay(70 + index * 42)
    .duration(320)
    .withInitialValues({
      opacity: 0,
      transform: [{ translateX: index % 2 === 0 ? -18 : 18 }],
    });
}

function useChoiceMotion(active: boolean) {
  const progress = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 170 });
  }, [active, progress]);
  return progress;
}

function useRevealStyle(active: boolean, delay = 0, distance = 14, duration = 430) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (active) {
      progress.value = 0;
      timer = setTimeout(() => {
        progress.value = withTiming(1, {
          duration,
          easing: Easing.out(Easing.cubic),
        });
      }, delay);
    } else {
      progress.value = 0;
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [active, delay, distance, duration, progress]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [distance, 0]) },
      { scale: interpolate(progress.value, [0, 0.82, 1], [0.985, 1.006, 1]) },
    ],
  }));
}

function AnimatedCta({
  children,
  active = true,
  delay = 220,
  style,
}: {
  children: React.ReactNode;
  active?: boolean;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    if (!active) return undefined;
    const timer = setTimeout(() => {
      progress.value = withTiming(1, {
        duration: 620,
        easing: Easing.out(Easing.cubic),
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [active, delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [24, 0]) }],
  }));

  return <Reanimated.View style={[style, animatedStyle]}>{children}</Reanimated.View>;
}

function progressForStep(step: StepId): SectionProgress | null {
  if (step === 'christian' || step === 'tradition') return { key: 'questions', index: 0, total: 4 };
  if (step === 'age') return { key: 'questions', index: 1, total: 4 };
  if (step === 'gender') return { key: 'questions', index: 2, total: 4 };
  if (step === 'reason') return { key: 'questions', index: 3, total: 4 };

  return null;
}

function isGuidedWalkthroughStep(step: StepId) {
  return (
    step === 'taskTypes' ||
    step === 'taskSetup' ||
    step === 'taskManagement' ||
    step === 'focusCost' ||
    step === 'blockers' ||
    step === 'focusSetup' ||
    step === 'routine' ||
    step === 'focus' ||
    step === 'bibleFree' ||
    step === 'bibleReading' ||
    step === 'bibleTools' ||
    step === 'paywall'
  );
}

function ProgressBar({ progress }: { progress: SectionProgress }) {
  const segments = Array.from({ length: progress.total });

  return (
    <View key={progress.key} style={s.progressShell}>
      {segments.map((_, segmentIndex) => {
        const isActive = segmentIndex <= progress.index;
        const isCurrent = segmentIndex === progress.index;
        return (
          <View
            key={`${progress.key}-${segmentIndex}`}
            style={[
              s.progressSegment,
              isActive && s.progressSegmentActive,
              isCurrent && s.progressSegmentCurrent,
            ]}
          >
            {isActive && (
              <Reanimated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
                <LinearGradient
                  colors={isCurrent ? ['#B98B42', GOLD] : ['#D7BA75', '#C59E57']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Reanimated.View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function OnboardingPreload({
  animateIn = true,
  bottomInset,
  topInset,
}: {
  animateIn?: boolean;
  bottomInset: number;
  topInset: number;
}) {
  return (
    <LinearGradient
      colors={['#FFFFFF', '#FFFFFF', '#FFFDF8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[s.preloadScreen, { paddingTop: topInset, paddingBottom: bottomInset + 18 }]}
    >
      <View pointerEvents="none" style={s.preloadWarmth}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(246,225,202,0.46)', 'rgba(255,241,225,0.98)']}
          locations={[0, 0.52, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <Reanimated.View entering={animateIn ? FadeIn.duration(360) : undefined} style={s.preloadCenter}>
        <View style={s.preloadLogoFrame}>
          <View style={s.preloadLogoPlate}>
            <Image source={APP_LOGO} style={s.preloadLogo} resizeMode="cover" />
          </View>
        </View>
        <Text style={s.preloadBrand}>ANASTA</Text>
      </Reanimated.View>
    </LinearGradient>
  );
}

function WelcomeSlide({ onNext, ready }: { onNext: () => void; ready: boolean }) {
  const confettiRef = useRef<React.ElementRef<typeof LottieView>>(null);
  const confettiOpacity = useSharedValue(0);
  const titleStyle = useRevealStyle(ready, 0, 16, 520);
  const logoStyle = useRevealStyle(ready, 140, 22, 640);
  const scriptureStyle = useRevealStyle(ready, 300, 16, 600);
  const promiseStyle = useRevealStyle(ready, 520, 12, 540);

  useEffect(() => {
    if (!ready) {
      confettiOpacity.value = 0;
      return undefined;
    }
    preloadAchievementFeedbackSound();
    const timer = setTimeout(() => {
      confettiOpacity.value = withTiming(1, { duration: 140 });
      confettiRef.current?.play();
      void playAchievementCompleteFeedback();
    }, 920);

    return () => clearTimeout(timer);
  }, [confettiOpacity, ready]);

  const confettiStyle = useAnimatedStyle(() => ({
    opacity: confettiOpacity.value,
  }));

  return (
    <View style={s.welcome}>
      <View style={s.heroBlock}>
        <Reanimated.Text style={[s.welcomeTitle, titleStyle]}>
          Welcome!
        </Reanimated.Text>

        <View style={s.welcomeCenterGroup}>
          <Reanimated.View style={[s.logoFrame, logoStyle]}>
            <View style={s.logoFrameHalo} />
            <View style={s.logoPlate}>
              <View style={s.logoImageMask}>
                <Image source={APP_LOGO} style={s.logoImage} resizeMode="cover" />
              </View>
            </View>
          </Reanimated.View>

          <Reanimated.View style={[s.scriptureBlock, scriptureStyle]}>
            <View style={s.scriptureDivider} />
            <Text style={s.scriptureQuote}>
              {'"Awake thou that sleepest, and '}
              <Text style={s.scriptureUnderline}>arise</Text>{' '}
              <Text style={s.scriptureGold}>(anasta)</Text>
              {' from the dead, and Christ shall give thee light."'}
            </Text>
            <Text style={s.scriptureRef}>EPHESIANS 5:14</Text>
          </Reanimated.View>
        </View>

        <Reanimated.View style={[s.promiseBlock, promiseStyle]}>
          <View style={s.promiseRule} />
          <Text style={s.heroPromise}>
            Become the person{'\n'}
            you are <Text style={s.heroPromiseAccent}>called to be.</Text>
          </Text>
        </Reanimated.View>
      </View>

      <AnimatedCta active={ready} delay={680} style={s.bottomAction}>
        <View style={s.ctaIsland}>
          <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={onNext} style={s.primaryButton}>
            <Text style={s.primaryButtonText}>Let&apos;s begin</Text>
            <ChevronRight s={19} c="#FFFFFF" w={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedCta>

      <View pointerEvents="none" style={s.confettiOverlay}>
        <Reanimated.View style={[StyleSheet.absoluteFill, s.confettiLayer, confettiStyle]}>
          <LottieView
            ref={confettiRef}
            source={CONFETTI_SOURCE}
            autoPlay={false}
            loop={false}
            speed={0.92}
            resizeMode="cover"
            renderMode="AUTOMATIC"
            style={[StyleSheet.absoluteFill, s.confettiLottie]}
          />
        </Reanimated.View>
      </View>
    </View>
  );
}

function AutoMessageSlide({ bottomInset, onNext }: { bottomInset: number; onNext: () => void }) {
  return (
    <View style={s.introSlide}>
      <View pointerEvents="none" style={s.introWarmth}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(246,225,202,0.46)', 'rgba(255,241,225,0.98)']}
          locations={[0, 0.52, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={s.introContent}>
        <Reanimated.View
          entering={FadeInLeft.duration(520).withInitialValues({
            opacity: 0,
            transform: [{ translateX: -18 }],
          })}
          style={s.introLogoFrame}
        >
          <View style={s.introLogoPlate}>
            <Image source={APP_LOGO} style={s.introLogo} resizeMode="cover" />
          </View>
        </Reanimated.View>

        <Reanimated.View
          entering={FadeIn.delay(120).duration(380)}
          style={s.introRule}
        />

        <Reanimated.View
          entering={FadeInRight.delay(180).duration(560).withInitialValues({
            opacity: 0,
            transform: [{ translateX: 18 }],
          })}
          style={s.introCopy}
        >
          <Text style={s.introTitle}>Let&apos;s start with{'\n'}4 quick questions.</Text>
          <Text style={s.introBody}>So we can start at the right place.</Text>
        </Reanimated.View>
      </View>

      <AnimatedCta delay={420} style={[s.bottomAction, s.introBottomAction, { paddingBottom: bottomInset + 8 }]}>
        <View style={s.ctaIsland}>
          <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={onNext} style={s.primaryButton}>
            <Text style={s.primaryButtonText}>Continue</Text>
            <ChevronRight s={19} c="#FFFFFF" w={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedCta>
    </View>
  );
}

function ProcessingSlide() {
  return (
    <Reanimated.View
      entering={FadeIn.duration(360)}
      exiting={FadeOut.duration(280)}
      style={s.processingSimpleSlide}
    >
      <Reanimated.Text entering={FadeIn.delay(80).duration(360)} style={s.processingSimpleText}>
        Processing your answers.
      </Reanimated.Text>
      <Reanimated.View entering={FadeIn.delay(220).duration(340)} style={s.processingSimpleSpinner}>
        <ActivityIndicator size="large" color={GOLD} />
      </Reanimated.View>
    </Reanimated.View>
  );
}

function BridgeSlide({ bottomInset, onNext }: { bottomInset: number; onNext: () => void }) {
  return (
    <View style={s.introSlide}>
      <View pointerEvents="none" style={s.introWarmth}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(246,225,202,0.46)', 'rgba(255,241,225,0.98)']}
          locations={[0, 0.52, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={s.introContent}>
        <Reanimated.View
          entering={FadeInLeft.duration(520).withInitialValues({
            opacity: 0,
            transform: [{ translateX: -18 }],
          })}
          style={s.introLogoFrame}
        >
          <View style={s.introLogoPlate}>
            <Image source={APP_LOGO} style={s.introLogo} resizeMode="cover" />
          </View>
        </Reanimated.View>

        <Reanimated.View entering={FadeIn.delay(120).duration(380)} style={s.introRule} />

        <Reanimated.View
          entering={FadeInRight.delay(180).duration(560).withInitialValues({
            opacity: 0,
            transform: [{ translateX: 18 }],
          })}
          style={s.introCopy}
        >
          <Text style={s.introTitle}>Let&apos;s Start{'\n'}using the app.</Text>
        </Reanimated.View>
      </View>

      <AnimatedCta delay={420} style={[s.bottomAction, s.introBottomAction, { paddingBottom: bottomInset + 8 }]}>
        <View style={s.ctaIsland}>
          <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={onNext} style={s.primaryButton}>
            <Text style={s.primaryButtonText}>START</Text>
            <ChevronRight s={19} c="#FFFFFF" w={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedCta>
    </View>
  );
}

function OrganizeIntroSlide({ bottomInset, onNext }: { bottomInset: number; onNext: () => void }) {
  return (
    <View style={s.introSlide}>
      <View pointerEvents="none" style={s.introWarmth}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(246,225,202,0.46)', 'rgba(255,241,225,0.98)']}
          locations={[0, 0.52, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={s.introContent}>
        <Reanimated.View
          entering={FadeInLeft.duration(520).withInitialValues({
            opacity: 0,
            transform: [{ translateX: -18 }],
          })}
          style={s.introLogoFrame}
        >
          <View style={s.introLogoPlate}>
            <Image source={APP_LOGO} style={s.introLogo} resizeMode="cover" />
          </View>
        </Reanimated.View>

        <Reanimated.View entering={FadeIn.delay(120).duration(380)} style={s.introRule} />

        <Reanimated.View
          entering={FadeInRight.delay(180).duration(560).withInitialValues({
            opacity: 0,
            transform: [{ translateX: 18 }],
          })}
          style={s.introCopy}
        >
          <Text style={s.introTitle}>Let&apos;s set up your{'\n'}weekly rhythm{'\n'}together!</Text>
        </Reanimated.View>
      </View>

      <AnimatedCta delay={420} style={[s.bottomAction, s.introBottomAction, { paddingBottom: bottomInset + 8 }]}>
        <View style={s.ctaIsland}>
          <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={onNext} style={s.primaryButton}>
            <Text style={s.primaryButtonText}>Continue</Text>
            <ChevronRight s={19} c="#FFFFFF" w={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedCta>
    </View>
  );
}

function PillarChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={s.pillarChip}>
      {icon}
      <Text style={s.pillarChipText}>{label}</Text>
    </View>
  );
}

function GuidedSetupShell({
  children,
  onNext,
  ctaLabel = 'Continue',
}: {
  children: React.ReactNode;
  onNext: () => void;
  ctaLabel?: string;
}) {
  return (
    <View style={s.setupSlide}>
      <ScrollView
        style={s.setupScroll}
        contentContainerStyle={s.guidedScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      <AnimatedCta delay={220} style={s.questionFooter}>
        <View style={s.ctaIsland}>
          <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={onNext} style={s.primaryButton}>
            <Text style={s.primaryButtonText}>{ctaLabel}</Text>
            <ChevronRight s={19} c="#FFFFFF" w={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedCta>
    </View>
  );
}

function GuidedHero({
  eyebrow,
  title,
  body,
  icon,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon?: React.ReactNode;
}) {
  return (
    <View style={s.guidedHero}>
      <Reanimated.View entering={FadeIn.duration(360)} style={s.guidedHeroIcon}>
        {icon ?? <Image source={APP_LOGO} style={s.guidedHeroLogo} resizeMode="cover" />}
      </Reanimated.View>
      <Reanimated.Text entering={FadeIn.delay(80).duration(380)} style={s.questionEyebrow}>
        {eyebrow}
      </Reanimated.Text>
      <Reanimated.Text entering={FadeIn.delay(130).duration(430)} style={s.guidedTitle}>
        {title}
      </Reanimated.Text>
      <Reanimated.Text entering={FadeIn.delay(190).duration(430)} style={s.guidedBody}>
        {body}
      </Reanimated.Text>
    </View>
  );
}

function PillarPrioritySlide({
  selected,
  onSelect,
  onNext,
}: {
  selected?: PillarAnswer;
  onSelect: (value: string) => void;
  onNext: () => void;
}) {
  return (
    <View style={s.setupSlide}>
      <ScrollView
        style={s.setupScroll}
        contentContainerStyle={s.guidedScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <GuidedHero
          eyebrow="Your three pillars"
          title="What should we build around first?"
          body="We will still set up all three. This just decides the order and emphasis of your first Anasta system."
        />

        <View style={s.optionsStack}>
          {PILLAR_OPTIONS.map((option, optionIndex) => (
            <Reanimated.View key={option.value} entering={optionEntrance(optionIndex)}>
              <OptionCard option={option} active={selected === option.value} disabled={false} onPress={() => onSelect(option.value)} />
            </Reanimated.View>
          ))}
        </View>

        <View style={s.pillarMapCard}>
          <PillarMapRow icon={<ListChecks s={18} c={GOLD} w={2} />} title="Organize" body="Tasks, habits, routines, goals, events." />
          <PillarMapRow icon={<Target s={18} c={GOLD} w={2} />} title="Protect" body="Focus timer, blockers, screen-time guardrails." />
          <PillarMapRow icon={<Cross s={18} c={GOLD} w={1.9} />} title="Grow" body="Scripture, prayer, notes, spiritual challenges." />
        </View>
      </ScrollView>

      <AnimatedCta delay={220} style={s.questionFooter}>
        <View style={s.ctaIsland}>
          <TouchableOpacity
            activeOpacity={0.9}
            haptic="light"
            disabled={!selected}
            onPress={onNext}
            style={[s.primaryButton, !selected && s.primaryButtonDisabled]}
          >
            <Text style={[s.primaryButtonText, !selected && s.primaryButtonDisabledText]}>Continue</Text>
            <ChevronRight s={19} c={selected ? '#FFFFFF' : 'rgba(25,23,20,0.34)'} w={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedCta>
    </View>
  );
}

function PillarMapRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <View style={s.pillarMapRow}>
      <View style={s.pillarMapIcon}>{icon}</View>
      <View style={s.pillarMapCopy}>
        <Text style={s.pillarMapTitle}>{title}</Text>
        <Text style={s.pillarMapBody}>{body}</Text>
      </View>
    </View>
  );
}

type TaskTypePreview = {
  key: string;
  task: TaskData;
  streak?: number;
  detailTitle: string;
  detail: string;
};

const TASK_TYPES: TaskTypePreview[] = [
  {
    key: 'habit',
    task: {
      variant: 'habit',
      title: 'Habit task',
      time: '07:00',
      subtitle: 'Morning walk',
      state: 'pending',
      habitColor: '#8B5CF6',
      habitIconName: 'rocket',
    },
    streak: 4,
    detailTitle: 'Habits',
    detail: 'For repeatable practices you want to build into your life. Habits track consistency and keep small disciplines visible.',
  },
  {
    key: 'routine',
    task: {
      variant: 'routine',
      title: 'Routine task',
      time: '08:00',
      subtitle: 'Plan the day',
      state: 'pending',
      type: 'custom',
      habitIconName: 'notebook',
    },
    detailTitle: 'Routine tasks',
    detail: 'For structured rhythms like planning the day, evening review, work startup, or a weekly reset.',
  },
  {
    key: 'spiritual',
    task: {
      variant: 'spiritual',
      title: 'Spiritual task',
      time: '07:15',
      subtitle: 'Morning Prayer',
      state: 'pending',
      type: 'prayer',
      habitIconName: 'Sun',
    },
    streak: 3,
    detailTitle: 'Spiritual tasks',
    detail: 'For prayer, Scripture, gratitude, repentance, and reflection, so spiritual life stays beside daily life.',
  },
  {
    key: 'challenge',
    task: {
      variant: 'challenge',
      title: 'Challenge task',
      time: 'Today',
      subtitle: 'Daily Jesus Prayer',
      state: 'pending',
      type: 'prayer',
      habitIconName: 'Candle',
    },
    streak: 2,
    detailTitle: 'Challenges',
    detail: 'For a defined season of effort: focus fasts, prayer commitments, reading plans, or character-building goals.',
  },
  {
    key: 'gratitude',
    task: {
      variant: 'gratitude',
      title: 'Gratitude task',
      time: 'Evening',
      subtitle: 'Daily gratitude',
      state: 'pending',
      type: 'gratitude',
    },
    streak: 5,
    detailTitle: 'Gratitude tasks',
    detail: 'For intentionally noticing what was given, what changed, and what deserves thanks.',
  },
  {
    key: 'reading',
    task: {
      variant: 'reading',
      title: 'Reading task',
      time: '21:00',
      subtitle: 'Bible reading',
      state: 'pending',
      type: 'reading',
    },
    streak: 6,
    detailTitle: 'Reading tasks',
    detail: 'For Scripture and reading plans that need a clear place in your day.',
  },
  {
    key: 'quick',
    task: {
      variant: 'quick',
      title: 'Quick task',
      time: 'Now',
      state: 'pending',
    },
    detailTitle: 'Quick tasks',
    detail: 'For fast capture. Add the small thing now, keep moving, and deal with it without breaking your flow.',
  },
];

function TaskTypesSlide({ onNext }: { onNext: () => void }) {
  const [openKey, setOpenKey] = useState(TASK_TYPES[0].key);

  return (
    <GuidedSetupShell onNext={onNext}>
      <View style={s.taskTypeHero}>
        <Text style={s.taskTypeHeroTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.88}>
          Every task has a purpose.
        </Text>
        <View style={s.taskTypeHeroRule} />
        <Text style={s.taskTypeHeroBody}>
          Different parts of life need different kinds of tasks. Each one has its own design, so your week stays clear at a glance.
        </Text>
      </View>

      <View style={s.taskTypeGrid}>
        {TASK_TYPES.map((item, index) => (
          <TaskTypeCard
            key={item.key}
            item={item}
            index={index}
            open={openKey === item.key}
            onPress={() => {
              runSelectionHaptic();
              setOpenKey(item.key);
            }}
          />
        ))}
      </View>
    </GuidedSetupShell>
  );
}

function TaskTypeCard({
  item,
  index,
  open,
  onPress,
}: {
  item: (typeof TASK_TYPES)[number];
  index: number;
  open: boolean;
  onPress: () => void;
}) {
  return (
    <Reanimated.View entering={optionEntrance(index)}>
      <View style={s.taskTypePreviewWrap}>
        <TouchableOpacity activeOpacity={0.9} haptic="none" onPress={onPress}>
          <AnyTaskCard task={item.task} streak={item.streak} />
        </TouchableOpacity>
        {open && (
          <Reanimated.View
            entering={FadeIn.duration(240).withInitialValues({
              opacity: 0,
              transform: [{ translateY: -8 }],
            })}
            style={s.taskTypeDetail}
          >
            <View pointerEvents="none" style={s.taskTypeDetailStem} />
            <Text style={s.taskTypeDetailTitle}>{item.detailTitle}</Text>
            <Text style={s.taskTypeDetailText}>{item.detail}</Text>
          </Reanimated.View>
        )}
      </View>
    </Reanimated.View>
  );
}

const HABIT_COACH_MESSAGES = [
  {
    message: 'Let\u2019s set up habits first.',
    button: 'Continue',
  },
  {
    message: 'Habits are small actions you repeat until discipline becomes part of your rhythm.',
    button: 'Set up habits',
  },
];

function SetupCoachPrompt({ message, motionKey }: { message: string; motionKey: string }) {
  return (
    <Reanimated.View
      key={motionKey}
      entering={FadeIn.duration(340)}
      style={s.setupCoachPrompt}
    >
      <Reanimated.View
        entering={FadeInLeft.duration(540).withInitialValues({
          opacity: 0,
          transform: [{ translateX: -18 }],
        })}
      >
        <View style={s.setupCoachMascotShell}>
          <View style={s.setupCoachMascotHalo} />
          <Image source={APP_LOGO} style={s.setupCoachMascotLogo} resizeMode="cover" />
        </View>
      </Reanimated.View>

      <Reanimated.View
        entering={FadeInRight.delay(180).duration(560).withInitialValues({
          opacity: 0,
          transform: [{ translateX: 18 }],
        })}
        style={s.setupCoachBubble}
      >
        <View style={s.setupCoachBubbleTail} />
        <Reanimated.Text key={message} entering={FadeIn.duration(260)} style={s.setupCoachText}>
          {message}
        </Reanimated.Text>
      </Reanimated.View>
    </Reanimated.View>
  );
}

function TaskSetupSlide({ bottomInset, onNext }: { bottomInset: number; onNext: () => void }) {
  const [coachIndex, setCoachIndex] = useState(0);
  const coachMessage = HABIT_COACH_MESSAGES[coachIndex] ?? HABIT_COACH_MESSAGES[0];
  const habitPreview = TASK_TYPES[0];
  const handleCoachNext = () => {
    if (coachIndex < HABIT_COACH_MESSAGES.length - 1) {
      setCoachIndex(prev => prev + 1);
      return;
    }
    onNext();
  };

  return (
    <View style={s.setupCoachScreen}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={s.setupCoachDim} />
        <LinearGradient
          colors={['rgba(25,23,20,0.88)', 'rgba(25,23,20,0.80)', 'rgba(25,23,20,0.92)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.setupCoachMockHeader} />
        <View style={s.setupCoachMockLineWide} />
        <View style={s.setupCoachMockLineShort} />
        <View style={s.setupCoachMockFab} />
      </View>

      <View style={s.setupCoachContent}>
        <SetupCoachPrompt message={coachMessage.message} motionKey={`habit-${coachIndex}`} />

        <Reanimated.View
          entering={FadeIn.delay(260).duration(420)}
          style={s.setupCoachSpotlight}
        >
          <AnyTaskCard task={habitPreview.task} streak={habitPreview.streak} />
        </Reanimated.View>
      </View>

      <AnimatedCta delay={420} style={[s.bottomAction, s.introBottomAction, { paddingBottom: bottomInset + 8 }]}>
        <View style={s.ctaIsland}>
          <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={handleCoachNext} style={s.setupCoachButton}>
            <Text style={s.setupCoachButtonText}>{coachMessage.button}</Text>
            <ChevronRight s={19} c={INK} w={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedCta>
    </View>
  );
}

function TaskManagementSlide({ onNext }: { onNext: () => void }) {
  return (
    <GuidedSetupShell onNext={onNext}>
      <GuidedHero
        eyebrow="Task management"
        title="When life changes, your system should bend without breaking."
        body="Anasta is not only a checklist. It helps you skip, reschedule, review, and see what is actually happening."
        icon={<SlidersHorizontal s={40} c={GOLD} w={1.8} />}
      />

      <View style={s.managementStack}>
        <ManagementCard
          index={0}
          icon={<Target s={23} c={GOLD} w={1.9} />}
          title="Analytics"
          body="See consistency, streaks, skipped tasks, and where discipline is slipping."
        />
        <ManagementCard
          index={1}
          icon={<Clock s={23} c={GOLD} w={1.9} />}
          title="Skip and reschedule"
          body="A missed task is not the end. Move it, learn from it, and keep walking."
        />
        <ManagementCard
          index={2}
          icon={<ListChecks s={23} c={GOLD} w={1.9} />}
          title="My Routine"
          body="One place to manage habits, routines, spiritual tasks, challenges, and journals."
        />
      </View>
    </GuidedSetupShell>
  );
}

function ManagementCard({
  icon,
  title,
  body,
  index,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  index: number;
}) {
  return (
    <Reanimated.View entering={optionEntrance(index)} style={s.managementCard}>
      <View style={s.managementIcon}>{icon}</View>
      <View style={s.managementCopy}>
        <Text style={s.managementTitle}>{title}</Text>
        <Text style={s.managementBody}>{body}</Text>
      </View>
    </Reanimated.View>
  );
}

const SCREEN_TIME_OPTIONS = [
  { key: 'lt2', label: 'Under 2h', hours: 2, days: 30 },
  { key: '2_4', label: '2-4h', hours: 4, days: 61 },
  { key: '4_6', label: '4-6h', hours: 6, days: 91 },
  { key: '6_plus', label: '6h+', hours: 8, days: 122 },
] as const;

function FocusCostSlide({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<(typeof SCREEN_TIME_OPTIONS)[number]['key']>('4_6');
  const active = SCREEN_TIME_OPTIONS.find(item => item.key === selected) ?? SCREEN_TIME_OPTIONS[2];

  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Set a guardrail">
      <GuidedHero
        eyebrow="Protect your focus"
        title="Do you want to know how much life your phone can take?"
        body="Not to shame you. To make the cost visible enough to protect what matters."
        icon={<Hourglass s={41} c={GOLD} w={1.5} />}
      />

      <View style={s.screenTimeCard}>
        <Text style={s.screenTimeNumber}>{active.days}</Text>
        <Text style={s.screenTimeUnit}>full days this year</Text>
        <Text style={s.screenTimeBody}>
          At about {active.hours} hours per day, distraction can quietly become {active.days} full days in a year.
        </Text>
      </View>

      <View style={s.screenTimeOptions}>
        {SCREEN_TIME_OPTIONS.map(item => {
          const isActive = selected === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.86}
              haptic="none"
              onPress={() => {
                runSelectionHaptic();
                setSelected(item.key);
              }}
              style={[s.screenTimeOption, isActive && s.screenTimeOptionActive]}
            >
              <Text style={[s.screenTimeOptionText, isActive && s.screenTimeOptionTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </GuidedSetupShell>
  );
}

const BLOCKER_CATEGORIES = [
  { key: 'social', title: 'Social loops', body: 'Instagram, TikTok, X, endless feeds.' },
  { key: 'explicit', title: 'Explicit content', body: 'Keep weak moments far from the first tap.' },
  { key: 'news', title: 'Doomscrolling', body: 'News, gossip, outrage, and compulsive checking.' },
  { key: 'shopping', title: 'Impulse spending', body: 'Stores, deals, wishlists, and late-night browsing.' },
  { key: 'gaming', title: 'Games and escapes', body: 'Limit the apps that turn breaks into hours.' },
];

function BlockersSlide({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<string[]>(['social', 'explicit']);

  const toggle = (key: string) => {
    runSelectionHaptic();
    setSelected(prev => (prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]));
  };

  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Continue">
      <GuidedHero
        eyebrow="Blockers"
        title="Far from eyes. Far from heart."
        body="You will be able to block whole categories, then fine-tune individual websites and apps."
        icon={<SlidersHorizontal s={40} c={GOLD} w={1.8} />}
      />

      <View style={s.blockerStack}>
        {BLOCKER_CATEGORIES.map((item, index) => {
          const isActive = selected.includes(item.key);
          return (
            <Reanimated.View key={item.key} entering={optionEntrance(index)}>
              <TouchableOpacity activeOpacity={0.88} haptic="none" onPress={() => toggle(item.key)} style={[s.blockerCard, isActive && s.blockerCardActive]}>
                <View style={[s.blockerCheck, isActive && s.blockerCheckActive]}>
                  {isActive ? <CheckSmall s={15} c="#FFFFFF" w={2.6} /> : null}
                </View>
                <View style={s.blockerCopy}>
                  <Text style={s.blockerTitle}>{item.title}</Text>
                  <Text style={s.blockerBody}>{item.body}</Text>
                </View>
              </TouchableOpacity>
            </Reanimated.View>
          );
        })}
      </View>
    </GuidedSetupShell>
  );
}

function FocusSetupSlide({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState('timer');

  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Finish focus setup">
      <GuidedHero
        eyebrow="Focus mode"
        title="Choose the first focus tool we should prepare."
        body="Later this connects with app blocking, Do Not Disturb, and your focus timer."
        icon={<Target s={42} c={GOLD} w={1.8} />}
      />

      <View style={s.focusToolStack}>
        {[
          { key: 'timer', title: 'Focus timer', body: 'A clean block for work, study, prayer, or reading.', icon: <Clock s={22} c={GOLD} w={1.9} /> },
          { key: 'dnd', title: 'Do Not Disturb window', body: 'Protect the hours where your attention should be quiet.', icon: <BellRing s={22} c={GOLD} w={1.9} /> },
          { key: 'limits', title: 'Daily app limits', body: 'Set limits before the impulse arrives.', icon: <Hourglass s={22} c={GOLD} w={1.6} /> },
        ].map((item, index) => {
          const isActive = selected === item.key;
          return (
            <Reanimated.View key={item.key} entering={optionEntrance(index)}>
              <TouchableOpacity
                activeOpacity={0.88}
                haptic="none"
                onPress={() => {
                  runSelectionHaptic();
                  setSelected(item.key);
                }}
                style={[s.focusToolCard, isActive && s.focusToolCardActive]}
              >
                <View style={[s.focusToolIcon, isActive && s.focusToolIconActive]}>{item.icon}</View>
                <View style={s.focusToolCopy}>
                  <Text style={s.focusToolTitle}>{item.title}</Text>
                  <Text style={s.focusToolBody}>{item.body}</Text>
                </View>
                {isActive ? <CheckSmall s={20} c={GOLD} w={2.4} /> : <ChevronRight s={18} c="rgba(25,23,20,0.24)" w={2.2} />}
              </TouchableOpacity>
            </Reanimated.View>
          );
        })}
      </View>
    </GuidedSetupShell>
  );
}

function BibleReadingSlide({ onNext }: { onNext: () => void }) {
  return (
    <GuidedSetupShell onNext={onNext}>
      <GuidedHero
        eyebrow="Bible reading"
        title="Read, save, and return."
        body="The Scripture area is designed to be calm: reading first, then favorites and notes when something speaks to you."
        icon={<OpenBook s={44} c={GOLD} w={1.35} />}
      />

      <View style={s.scripturePreview}>
        <Text style={s.scripturePreviewKicker}>JOHN 15</Text>
        <Text style={s.scripturePreviewText}>
          Abide in me, and I in you. As the branch cannot bear fruit of itself...
        </Text>
        <View style={s.scripturePreviewActions}>
          <PillarChip icon={<Heart s={15} c={GOLD} w={1.9} />} label="Favorite" />
          <PillarChip icon={<Feather s={15} c={GOLD} w={1.9} />} label="Note" />
        </View>
      </View>

      <View style={s.featureValueCard}>
        <Text style={s.featureValueTitle}>The Bible is not a locked upsell.</Text>
        <Text style={s.featureValueBody}>Favorites, notes, and the reading foundation stay available for everyone.</Text>
      </View>
    </GuidedSetupShell>
  );
}

function BibleToolsSlide({ onNext }: { onNext: () => void }) {
  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Continue to trial">
      <GuidedHero
        eyebrow="Prayer and notes"
        title="Keep your spiritual life close to your daily rhythm."
        body="Prayer book, Bible notes, favorites, gratitude, and spiritual challenges live beside the rest of your discipline."
        icon={<Candle s={42} c={GOLD} w={1.7} />}
      />

      <View style={s.managementStack}>
        <ManagementCard
          index={0}
          icon={<Feather s={23} c={GOLD} w={1.9} />}
          title="Bible notes"
          body="Capture what you notice, what convicted you, and what you need to remember."
        />
        <ManagementCard
          index={1}
          icon={<Candle s={23} c={GOLD} w={1.8} />}
          title="Prayer book"
          body="Build a visible place for prayers, people, and intentions."
        />
        <ManagementCard
          index={2}
          icon={<Crown s={23} c={GOLD} w={1.8} />}
          title="Spiritual challenges"
          body="Create a season of prayer, Scripture, fasting from distraction, or gratitude."
        />
      </View>
    </GuidedSetupShell>
  );
}

function OptionCard({
  option,
  active,
  compact,
  disabled,
  variant = 'default',
  onPress,
}: {
  option: Option<string>;
  active: boolean;
  compact?: boolean;
  disabled: boolean;
  variant?: 'default' | 'question';
  onPress: () => void;
}) {
  const progress = useChoiceMotion(active);
  const animStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      variant === 'question' ? ['rgba(25,23,20,0.10)', 'rgba(197,160,89,0.88)'] : ['rgba(25,23,20,0.10)', 'rgba(197,160,89,0.78)'],
    ),
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      variant === 'question' ? ['#FFFFFF', '#FFFCF3'] : ['rgba(255,255,255,0.78)', '#FFF7E8'],
    ),
  }));
  const iconStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      variant === 'question' ? ['rgba(25,23,20,0.035)', 'rgba(197,160,89,0.18)'] : ['rgba(197,160,89,0.11)', 'rgba(197,160,89,0.24)'],
    ),
  }));
  const railStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleY: interpolate(progress.value, [0, 1], [0.35, 1]) }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.78, 1]) }],
  }));

  return (
    <TouchableOpacity activeOpacity={0.88} haptic="none" disabled={disabled} onPress={onPress}>
      <Reanimated.View
        style={[
          s.optionCard,
          compact && s.optionCardCompact,
          variant === 'question' && s.questionOptionCard,
          compact && variant === 'question' && s.questionOptionCardCompact,
          active && s.optionCardSelected,
          animStyle,
        ]}
      >
        {active && <View style={s.optionSelectedWash} />}
        <Reanimated.View style={[s.optionRail, variant === 'question' && s.questionOptionRail, railStyle]} />
        <Reanimated.View
          style={[
            s.optionIcon,
            compact && s.optionIconCompact,
            variant === 'question' && s.questionOptionIcon,
            active && s.optionIconSelected,
            iconStyle,
          ]}
        >
          {active ? <CheckSmall s={21} c={GOLD} w={2.6} /> : option.icon}
        </Reanimated.View>
        <View style={s.optionCopy}>
          <Text style={[s.optionTitle, variant === 'question' && s.questionOptionTitle]}>{option.title}</Text>
          <Text style={[s.optionBody, variant === 'question' && s.questionOptionBody]}>{option.body}</Text>
        </View>
        <Reanimated.View style={[s.optionBadge, badgeStyle]}>
          <CheckSmall s={14} c="#FFFFFF" w={2.4} />
        </Reanimated.View>
      </Reanimated.View>
    </TouchableOpacity>
  );
}

function QuestionPrompt({
  copy,
  response,
  motionKey,
}: {
  copy: ReturnType<typeof questionCopy>;
  response?: string;
  motionKey?: string;
}) {
  const message = response ?? copy.title;
  const isResponse = Boolean(response);
  const mascotIntro = useSharedValue(0);
  const mascotReaction = useSharedValue(0);
  const bubbleIntro = useSharedValue(0);
  const isReactingRef = useRef(false);
  const previousMotionKeyRef = useRef(motionKey);
  const finishMascotReaction = useCallback(() => {
    isReactingRef.current = false;
    mascotReaction.value = 0;
  }, [mascotReaction]);

  useEffect(() => {
    mascotIntro.value = 0;
    bubbleIntro.value = 0;
    mascotIntro.value = withTiming(1, {
      duration: 860,
      easing: Easing.out(Easing.cubic),
    });
    const timer = setTimeout(() => {
      bubbleIntro.value = withTiming(1, {
        duration: 620,
        easing: Easing.out(Easing.cubic),
      });
    }, 680);

    return () => clearTimeout(timer);
  }, [bubbleIntro, mascotIntro]);

  useEffect(() => {
    if (!motionKey || motionKey === previousMotionKeyRef.current) return;
    previousMotionKeyRef.current = motionKey;
    if (isReactingRef.current) return;

    isReactingRef.current = true;
    mascotReaction.value = 0;
    mascotReaction.value = withTiming(
      1,
      {
        duration: 760,
        easing: Easing.out(Easing.cubic),
      },
      finished => {
        if (finished) runOnJS(finishMascotReaction)();
      },
    );
  }, [finishMascotReaction, mascotReaction, motionKey]);

  const mascotMotionStyle = useAnimatedStyle(() => {
    const intro = mascotIntro.value;
    const reaction = mascotReaction.value;
    const introRotate = interpolate(intro, [0, 0.7, 1], [-3, 0.75, 0]);
    const reactionRotate = interpolate(reaction, [0, 0.32, 0.68, 1], [0, -1.8, 1.1, 0]);
    return {
      opacity: interpolate(intro, [0, 0.28, 1], [0, 1, 1]),
      transform: [
        { translateX: interpolate(intro, [0, 1], [-34, 0]) },
        {
          translateY:
            interpolate(intro, [0, 0.72, 1], [2, 0, 0]) +
            interpolate(reaction, [0, 0.34, 0.72, 1], [0, -3.5, 1, 0]),
        },
        { rotate: `${introRotate + reactionRotate}deg` },
        {
          scale:
            interpolate(intro, [0, 0.78, 1], [0.96, 1.015, 1]) *
            interpolate(reaction, [0, 0.4, 1], [1, 1.018, 1]),
        },
      ],
    };
  });
  const mascotHaloStyle = useAnimatedStyle(() => {
    const intro = mascotIntro.value;
    const reaction = mascotReaction.value;
    return {
      opacity: Math.min(1, interpolate(intro, [0, 0.38, 1], [0, 0.9, 1]) + interpolate(reaction, [0, 0.2, 0.7, 1], [0, 0.28, 0.08, 0])),
      transform: [
        { rotate: `${interpolate(intro, [0, 1], [4, 12]) + interpolate(reaction, [0, 0.42, 1], [0, 2.5, 0])}deg` },
        {
          scale:
            interpolate(intro, [0, 0.72, 1], [0.86, 1.04, 1]) *
            interpolate(reaction, [0, 0.4, 1], [1, 1.07, 1]),
        },
      ],
    };
  });
  const speechBubbleIntroStyle = useAnimatedStyle(() => {
    const intro = bubbleIntro.value;
    return {
      opacity: intro,
      transform: [
        { translateX: interpolate(intro, [0, 1], [-10, 0]) },
        { translateY: interpolate(intro, [0, 0.78, 1], [8, -1, 0]) },
        { scale: interpolate(intro, [0, 0.74, 1], [0.92, 1.018, 1]) },
      ],
    };
  });

  return (
    <Reanimated.View entering={FadeIn.duration(320)} style={s.questionPrompt}>
      <View style={s.questionPromptMeta}>
        <Text style={s.questionPromptEyebrow}>{copy.eyebrow}</Text>
      </View>

      <View style={s.promptRow}>
        <Reanimated.View style={mascotMotionStyle}>
          <View style={s.mascotShell}>
            <Reanimated.View style={[s.mascotHalo, mascotHaloStyle]} />
            <Image source={APP_LOGO} style={s.mascotLogo} resizeMode="cover" />
          </View>
        </Reanimated.View>
        <Reanimated.View style={[s.speechBubble, speechBubbleIntroStyle]}>
          <View style={s.speechTail} />
          <Reanimated.Text
            key={message}
            entering={FadeIn.duration(340)}
            style={[s.speechQuestion, isResponse && s.speechResponse]}
          >
            {message}
          </Reanimated.Text>
        </Reanimated.View>
      </View>
    </Reanimated.View>
  );
}

function QuestionSlide({
  step,
  answers,
  onSelect,
  onNext,
}: {
  step: StepId;
  answers: Answers;
  onSelect: (step: StepId, value: string) => void;
  onNext: () => void;
}) {
  const { height } = useWindowDimensions();
  const copy = questionCopy(step);
  const options = getOptions(step);
  const selectedValues = selectedValuesFor(step, answers);
  const hasSelection = selectedValues.length > 0;
  const selectedResponse = hasSelection
    ? options.find(option => option.value === selectedValues[selectedValues.length - 1])?.response
    : undefined;
  const isLongList = step === 'tradition' || step === 'reason';
  const shouldScroll = isLongList || height < 720;

  const questionContent = (
    <>
      <QuestionPrompt copy={copy} response={selectedResponse} motionKey={selectedValues.join('|')} />

      <View style={[s.optionsStack, isLongList && s.optionsStackLong]}>
        {options.map((option, optionIndex) => {
          const active = selectedValues.includes(option.value);
          return (
            <Reanimated.View key={option.value} entering={optionEntrance(optionIndex)}>
              <OptionCard
                option={option}
                active={active}
                compact={isLongList}
                disabled={false}
                onPress={() => onSelect(step, option.value)}
              />
            </Reanimated.View>
          );
        })}
      </View>
    </>
  );

  return (
    <View style={s.questionSlide}>
      {shouldScroll ? (
        <ScrollView
          style={s.questionScroll}
          contentContainerStyle={s.questionScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {questionContent}
        </ScrollView>
      ) : (
        <View style={s.questionFixedContent}>{questionContent}</View>
      )}

      <AnimatedCta delay={200} style={s.questionFooter}>
        <View style={s.ctaIsland}>
          <TouchableOpacity
            activeOpacity={0.9}
            haptic="light"
            disabled={!hasSelection}
            onPress={onNext}
            style={[s.primaryButton, !hasSelection && s.primaryButtonDisabled]}
          >
            <Text style={[s.primaryButtonText, !hasSelection && s.primaryButtonDisabledText]}>Continue</Text>
            <ChevronRight s={19} c={hasSelection ? '#FFFFFF' : 'rgba(25,23,20,0.34)'} w={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedCta>
    </View>
  );
}

const ROUTINE_FEATURE: SetupFeature = {
  eyebrow: 'Organize your life',
  title: 'Build your first routine.',
  subtitle: 'Routines turn scattered intention into something you can actually return to tomorrow.',
  pillar: 'Tasks, routines, habits, goals, events',
  valueTitle: 'Why this matters',
  valueBody: 'A routine is not a motivational quote. It is a small structure that carries you when the day gets loud.',
  previewTitle: 'Your starter routine',
  previewRows: ['Morning prayer or review', "Choose today's first task", 'Plan one concrete next step'],
  options: ROUTINE_OPTIONS,
};

const FOCUS_FEATURE: SetupFeature = {
  eyebrow: 'Protect your focus',
  title: 'Choose your first guardrail.',
  subtitle: 'Focus is easier when the phone has boundaries before the temptation starts.',
  pillar: 'Pomodoro, blockers, screen time',
  valueTitle: 'Why this matters',
  valueBody: 'Anasta should help your phone serve your life, not quietly rearrange your day around distraction.',
  previewTitle: 'Your focus setup',
  previewRows: ['Focus block ready', 'Distraction guardrail chosen', 'Reminder to return after a fall'],
  options: FOCUS_OPTIONS,
};

function SetupSlide({
  feature,
  selected,
  onSelect,
  onNext,
}: {
  feature: SetupFeature;
  selected?: string;
  onSelect: (value: string) => void;
  onNext: () => void;
}) {
  return (
    <View style={s.setupSlide}>
      <ScrollView
        style={s.setupScroll}
        contentContainerStyle={s.setupScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.featureHeader}>
          <Text style={s.questionEyebrow}>{feature.eyebrow}</Text>
          <Text style={s.featureTitle}>{feature.title}</Text>
          <Text style={s.featureSubtitle}>{feature.subtitle}</Text>
          <View style={s.pillarNote}>
            <Sparkles s={15} c={GOLD} w={2} />
            <Text style={s.pillarNoteText}>{feature.pillar}</Text>
          </View>
        </View>

        <View style={s.featureValueCard}>
          <Text style={s.featureValueTitle}>{feature.valueTitle}</Text>
          <Text style={s.featureValueBody}>{feature.valueBody}</Text>
        </View>

        <View style={s.previewCard}>
          <Text style={s.previewLabel}>{feature.previewTitle}</Text>
          {feature.previewRows.map((row, index) => (
            <View key={row} style={s.previewRow}>
              <View style={s.previewCheck}>
                <CheckSmall s={13} c={GOLD} w={2.4} />
              </View>
              <Text style={s.previewText}>{row}</Text>
              <Text style={s.previewTime}>{index === 0 ? 'Today' : 'Soon'}</Text>
            </View>
          ))}
        </View>

        <Text style={s.setupPrompt}>Choose the version you want to start with.</Text>
        <View style={s.optionsStack}>
          {feature.options.map((option, optionIndex) => (
            <Reanimated.View key={option.value} entering={optionEntrance(optionIndex)}>
              <OptionCard option={option} active={selected === option.value} disabled={false} onPress={() => onSelect(option.value)} />
            </Reanimated.View>
          ))}
        </View>
      </ScrollView>

      <AnimatedCta delay={220} style={s.questionFooter}>
        <View style={s.ctaIsland}>
          <TouchableOpacity
            activeOpacity={0.9}
            haptic="light"
            disabled={!selected}
            onPress={onNext}
            style={[s.primaryButton, !selected && s.primaryButtonDisabled]}
          >
            <Text style={[s.primaryButtonText, !selected && s.primaryButtonDisabledText]}>Continue</Text>
            <ChevronRight s={19} c={selected ? '#FFFFFF' : 'rgba(25,23,20,0.34)'} w={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedCta>
    </View>
  );
}

function BibleFreeSlide({ onNext }: { onNext: () => void }) {
  return (
    <View style={s.bibleSlide}>
      <ScrollView
        style={s.setupScroll}
        contentContainerStyle={s.bibleScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Reanimated.View entering={FadeIn.duration(380)} style={s.bibleIconShell}>
          <OpenBook s={68} c={GOLD} w={1.35} />
        </Reanimated.View>
        <Text style={s.bibleEyebrow}>Grow spiritually</Text>
        <Text style={s.bibleTitle}>The Bible side of Anasta is always free.</Text>
        <Text style={s.bibleBody}>
          Scripture should never feel like a locked feature. Bible reading, favorites, notes, and the core prayer book
          system stay open.
        </Text>

        <View style={s.freeCard}>
          <FreeRow icon={<BookMarked s={20} c={GOLD} w={1.9} />} title="Bible reading" body="Read and return without a paywall." />
          <FreeRow icon={<Heart s={20} c={GOLD} w={1.8} />} title="Favorites" body="Keep verses close for the days you need them." />
          <FreeRow icon={<Feather s={20} c={GOLD} w={1.8} />} title="Notes" body="Write what you notice, pray, and remember." />
          <FreeRow icon={<Candle s={20} c={GOLD} w={1.8} />} title="Prayer book" body="Build a spiritual rhythm without making Scripture a premium trick." />
        </View>

        <View style={s.moralCard}>
          <Text style={s.moralTitle}>Premium supports the full system.</Text>
          <Text style={s.moralBody}>
            Anasta Premium is for deeper structure, focus tools, routines, analytics, blockers, and guided discipline.
            The Word itself remains free.
          </Text>
        </View>
      </ScrollView>

      <AnimatedCta delay={220} style={s.questionFooter}>
        <View style={s.ctaIsland}>
          <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={onNext} style={s.primaryButton}>
            <Text style={s.primaryButtonText}>Continue</Text>
            <ChevronRight s={19} c="#FFFFFF" w={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedCta>
    </View>
  );
}

function FreeRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <View style={s.freeRow}>
      <View style={s.freeIcon}>{icon}</View>
      <View style={s.freeCopy}>
        <Text style={s.freeTitle}>{title}</Text>
        <Text style={s.freeBody}>{body}</Text>
      </View>
      <CheckSmall s={18} c={GOLD} w={2.5} />
    </View>
  );
}

function PaywallSlide({ onFinish }: { onFinish: () => void }) {
  return (
    <View style={s.paywallSlide}>
      <ScrollView
        style={s.setupScroll}
        contentContainerStyle={s.paywallScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.paywallHeader}>
          <Text style={s.paywallEyebrow}>Anasta Premium</Text>
          <Text style={s.paywallTitle}>How your free trial works</Text>
          <Text style={s.paywallSubtitle}>Clear, honest, and easy to cancel. No payment is due today.</Text>
        </View>

        <View style={s.timelineCard}>
          <TrialRow
            icon={<CheckSmall s={18} c="#FFFFFF" w={2.5} />}
            label="Today"
            title="Unlock your full Anasta system"
            body="Routines, goals, focus tools, analytics, blockers, spiritual challenges, and the guided setup you just started."
            active
          />
          <TrialRow
            icon={<BellRing s={17} c="#FFFFFF" w={2.1} />}
            label="Day 6"
            title="We remind you before it ends"
            body="You will get a notification before the trial ends, so it does not feel hidden or sneaky."
          />
          <TrialRow
            icon={<Crown s={17} c="#FFFFFF" w={2.1} />}
            label="Day 7"
            title="Trial ends"
            body="You will be charged $89.99 per year unless you cancel before then."
            last
          />
        </View>

        <View style={s.offerCard}>
          <View style={s.offerTopRow}>
            <Text style={s.offerLabel}>7-day free trial</Text>
            <View style={s.offerBadge}>
              <Text style={s.offerBadgeText}>No payment today</Text>
            </View>
          </View>
          <Text style={s.offerPrice}>Then $89.99/year</Text>
          <Text style={s.offerFinePrint}>About $7.50/month. Cancel anytime in your App Store subscription settings.</Text>
        </View>

        <TouchableOpacity activeOpacity={0.88} haptic="light" style={s.creatorCodeCard}>
          <View>
            <Text style={s.creatorCodeTitle}>Have a creator code?</Text>
            <Text style={s.creatorCodeBody}>Add a promo code before starting your trial.</Text>
          </View>
          <ChevronRight s={18} c={GOLD} w={2.4} />
        </TouchableOpacity>

        <View style={s.cancelCard}>
          <Text style={s.cancelTitle}>How can I cancel?</Text>
          <Text style={s.cancelBody}>
            Open the App Store subscriptions page, choose Anasta, and cancel before the trial ends. Your setup remains on
            this phone.
          </Text>
        </View>
      </ScrollView>

      <AnimatedCta delay={220} style={s.paywallFooter}>
        <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={onFinish} style={s.trialButton}>
          <Text style={s.trialButtonText}>Start my free trial now</Text>
          <Text style={s.trialButtonSubtext}>2 taps to start, easy to cancel</Text>
        </TouchableOpacity>
        <Text style={s.restoreText}>View all plans  |  Restore purchase</Text>
      </AnimatedCta>
    </View>
  );
}

function TrialRow({
  icon,
  label,
  title,
  body,
  active,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  body: string;
  active?: boolean;
  last?: boolean;
}) {
  return (
    <View style={s.trialRow}>
      <View style={s.trialRailWrap}>
        <View style={[s.trialDot, active && s.trialDotActive]}>{icon}</View>
        {!last && <View style={s.trialRail} />}
      </View>
      <View style={s.trialCopy}>
        <Text style={s.trialLabel}>{label}</Text>
        <Text style={s.trialTitle}>{title}</Text>
        <Text style={s.trialBody}>{body}</Text>
      </View>
    </View>
  );
}

export default function OnboardingView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState<Answers>({});
  const [preloadPhase, setPreloadPhase] = useState<PreloadPhase>('only');
  const steps = useMemo(() => stepOrder(answers), [answers]);
  const [index, setIndex] = useState(0);
  const activeStep = steps[Math.min(index, steps.length - 1)];
  const activeProgress = progressForStep(activeStep);
  const screenMotion = useSharedValue(1);
  const preloadExit = useSharedValue(0);

  useEffect(() => {
    preloadAchievementFeedbackSound();
    const exitTimer = setTimeout(() => {
      setPreloadPhase('exit');
      preloadExit.value = 0;
      preloadExit.value = withTiming(1, {
        duration: 980,
        easing: Easing.inOut(Easing.cubic),
      });
    }, 1600);
    const doneTimer = setTimeout(() => setPreloadPhase('done'), 2630);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [preloadExit]);

  useEffect(() => {
    screenMotion.value = 0;
    screenMotion.value = withTiming(1, { duration: 260 });
  }, [activeStep, screenMotion]);

  useEffect(() => {
    if (index > steps.length - 1) {
      setIndex(steps.length - 1);
    }
  }, [index, steps.length]);

  useEffect(() => {
    if (activeStep !== 'processing') return undefined;
    const delay = 2100;
    const timer = setTimeout(() => {
      runAdvanceHaptic();
      setIndex(prev => Math.min(steps.length - 1, prev + 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [activeStep, steps.length]);

  const goBack = () => {
    runAdvanceHaptic();
    if (index <= 0) {
      router.back();
      return;
    }
    setIndex(prev => Math.max(0, prev - 1));
  };

  const goNext = () => {
    runAdvanceHaptic();
    if (index >= steps.length - 1) {
      router.back();
      return;
    }
    setIndex(prev => Math.min(steps.length - 1, prev + 1));
  };

  const onSelect = (step: StepId, value: string) => {
    runSelectionHaptic();
    setAnswers(prev => {
      if (step === 'christian') {
        return {
          ...prev,
          christian: value as ChristianAnswer,
          tradition: value === 'yes' ? prev.tradition : undefined,
        };
      }
      if (step === 'tradition') return { ...prev, tradition: value as TraditionAnswer };
      if (step === 'age') return { ...prev, age: value as AgeAnswer };
      if (step === 'gender') return { ...prev, gender: value as GenderAnswer };
      if (step === 'pillars') return { ...prev, primaryPillar: value as PillarAnswer };
      if (step === 'reason') {
        const nextValue = value as ReasonAnswer;
        const current = prev.reasons ?? [];
        const exists = current.includes(nextValue);
        return {
          ...prev,
          reasons: exists ? current.filter(item => item !== nextValue) : [...current, nextValue],
        };
      }
      if (step === 'routine') return { ...prev, routine: value as RoutineAnswer };
      if (step === 'focus') return { ...prev, focus: value as FocusAnswer };
      return prev;
    });
  };

  const stageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(screenMotion.value, [0, 1], [0.82, 1]),
    transform: [{ scale: interpolate(screenMotion.value, [0, 1], [0.997, 1]) }],
  }));
  const preloadOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(preloadExit.value, [0, 1], [1, 0]),
    transform: [
      { scale: interpolate(preloadExit.value, [0, 1], [1, 0.985]) },
    ],
  }));
  const hideTopChrome = isGuidedWalkthroughStep(activeStep);
  const visibleProgress = hideTopChrome ? null : activeProgress;
  const showBack =
    !hideTopChrome &&
    activeStep !== 'welcome' &&
    activeStep !== 'questionIntro' &&
    activeStep !== 'processing' &&
    activeStep !== 'bridge' &&
    activeStep !== 'organizeIntro';
  const showTopSkip = visibleProgress !== null;
  const edgeToEdgeMessage = activeStep === 'bridge' || activeStep === 'organizeIntro' || activeStep === 'taskSetup';
  const stageBottomPadding = activeStep === 'questionIntro' || edgeToEdgeMessage ? 0 : insets.bottom + 8;
  const stageTopPadding = hideTopChrome ? insets.top + 12 : 0;
  const stageHorizontalPadding = edgeToEdgeMessage ? 0 : 20;

  if (preloadPhase === 'only') {
    return <OnboardingPreload bottomInset={insets.bottom} topInset={insets.top} />;
  }

  const renderStep = () => {
    if (activeStep === 'welcome') return <WelcomeSlide ready={preloadPhase === 'done'} onNext={goNext} />;
    if (activeStep === 'questionIntro') return <AutoMessageSlide bottomInset={insets.bottom} onNext={goNext} />;
    if (activeStep === 'processing') return <ProcessingSlide />;
    if (activeStep === 'bridge') return <BridgeSlide bottomInset={insets.bottom} onNext={goNext} />;
    if (activeStep === 'organizeIntro') return <OrganizeIntroSlide bottomInset={insets.bottom} onNext={goNext} />;
    if (activeStep === 'pillars') {
      return (
        <PillarPrioritySlide
          selected={answers.primaryPillar}
          onSelect={value => onSelect('pillars', value)}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'taskTypes') return <TaskTypesSlide onNext={goNext} />;
    if (activeStep === 'taskSetup') return <TaskSetupSlide bottomInset={insets.bottom} onNext={goNext} />;
    if (activeStep === 'taskManagement') return <TaskManagementSlide onNext={goNext} />;
    if (activeStep === 'focusCost') return <FocusCostSlide onNext={goNext} />;
    if (activeStep === 'blockers') return <BlockersSlide onNext={goNext} />;
    if (activeStep === 'focusSetup') return <FocusSetupSlide onNext={goNext} />;
    if (activeStep === 'routine') {
      return (
        <SetupSlide
          key="routine"
          feature={ROUTINE_FEATURE}
          selected={answers.routine}
          onSelect={value => onSelect('routine', value)}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'focus') {
      return (
        <SetupSlide
          key="focus"
          feature={FOCUS_FEATURE}
          selected={answers.focus}
          onSelect={value => onSelect('focus', value)}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'bibleFree') return <BibleFreeSlide onNext={goNext} />;
    if (activeStep === 'bibleReading') return <BibleReadingSlide onNext={goNext} />;
    if (activeStep === 'bibleTools') return <BibleToolsSlide onNext={goNext} />;
    if (activeStep === 'paywall') return <PaywallSlide onFinish={goNext} />;

    return (
      <QuestionSlide
        key={activeStep}
        step={activeStep}
        answers={answers}
        onSelect={onSelect}
        onNext={goNext}
      />
    );
  };

  return (
    <LinearGradient
      colors={['#FFFFFF', '#FFFFFF', PAPER]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.screen}
    >
      {!hideTopChrome && (
        <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
          {showBack ? (
            <TouchableOpacity activeOpacity={0.72} haptic="light" onPress={goBack} style={s.topNavButton}>
              <Text style={s.topNavText}>Back</Text>
              <View style={s.topNavUnderline} />
            </TouchableOpacity>
          ) : (
            <View style={s.topNavButton} />
          )}
          <View style={s.topCenter}>
            {visibleProgress ? <ProgressBar progress={visibleProgress} /> : null}
          </View>
          {showTopSkip ? (
            <TouchableOpacity activeOpacity={0.72} haptic="light" onPress={goNext} style={[s.topNavButton, s.topNavButtonRight]}>
              <Text style={s.topNavText}>Skip</Text>
              <View style={s.topNavUnderline} />
            </TouchableOpacity>
          ) : (
            <View style={s.topNavButton} />
          )}
        </View>
      )}

      <Reanimated.View style={[s.stage, { paddingTop: stageTopPadding, paddingBottom: stageBottomPadding, paddingHorizontal: stageHorizontalPadding }, stageStyle]}>
        {renderStep()}
      </Reanimated.View>

      {preloadPhase === 'exit' && (
        <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.preloadOverlay, preloadOverlayStyle]}>
          <OnboardingPreload animateIn={false} bottomInset={insets.bottom} topInset={insets.top} />
        </Reanimated.View>
      )}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  preloadScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  preloadOverlay: {
    zIndex: 90,
  },
  preloadWarmth: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '52%',
  },
  preloadCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 18,
  },
  preloadLogoFrame: {
    width: 148,
    height: 148,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.12)',
  },
  preloadLogoPlate: {
    width: 122,
    height: 122,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  preloadLogo: {
    width: 112,
    height: 112,
    borderRadius: 30,
  },
  preloadBrand: {
    marginTop: 15,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 3.4,
    color: 'rgba(25,23,20,0.46)',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  topNavButton: {
    width: 58,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topNavButtonRight: {
    alignItems: 'center',
  },
  topNavText: {
    fontFamily: F.serifSemiBold,
    fontSize: 15.5,
    lineHeight: 19,
    color: '#2F2923',
  },
  topNavUnderline: {
    marginTop: 2.5,
    width: 30,
    height: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.66)',
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBrand: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 3,
    color: 'rgba(25,23,20,0.42)',
  },
  progressShell: {
    width: '78%',
    maxWidth: 220,
    height: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(25,23,20,0.045)',
  },
  progressSegmentActive: {
    backgroundColor: 'rgba(197,160,89,0.20)',
  },
  progressSegmentCurrent: {
    height: 5.5,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 1,
  },
  stage: {
    flex: 1,
    paddingHorizontal: 20,
  },
  welcome: {
    flex: 1,
    position: 'relative',
    paddingTop: 2,
  },
  confettiOverlay: {
    position: 'absolute',
    top: -30,
    left: -8,
    right: -8,
    bottom: -8,
    zIndex: 999,
    elevation: 999,
  },
  confettiLayer: {
    zIndex: 999,
    elevation: 999,
  },
  confettiLottie: {
    zIndex: 999,
    elevation: 999,
    opacity: 0.92,
    transform: [{ scale: 0.55 }],
  },
  heroBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 10,
    paddingBottom: 0,
    minHeight: 540,
    zIndex: 1,
  },
  welcomeCenterGroup: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 22,
    transform: [{ translateY: -18 }],
  },
  logoFrame: {
    marginTop: 0,
    marginBottom: 16,
    width: 198,
    height: 198,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFrameHalo: {
    position: 'absolute',
    width: 198,
    height: 198,
    borderRadius: 48,
    backgroundColor: 'rgba(197,160,89,0.10)',
    transform: [{ rotate: '7deg' }],
  },
  logoPlate: {
    width: 176,
    height: 176,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.1,
    shadowRadius: 32,
    elevation: 4,
  },
  logoImageMask: {
    width: 152,
    height: 152,
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  logoImage: {
    width: 152,
    height: 152,
    borderRadius: 34,
  },
  welcomeTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 68,
    lineHeight: 70,
    textAlign: 'center',
    color: INK,
    transform: [{ translateY: -4 }],
  },
  scriptureBlock: {
    maxWidth: 336,
    alignItems: 'center',
  },
  scriptureDivider: {
    width: 54,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.34)',
    marginBottom: 13,
  },
  scriptureQuote: {
    fontFamily: F.serifMediumItalic,
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
    color: '#776E64',
  },
  scriptureUnderline: {
    textDecorationLine: 'underline',
    color: INK,
  },
  scriptureGold: {
    color: GOLD,
  },
  scriptureRef: {
    marginTop: 7,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2.5,
    color: GOLD,
  },
  promiseBlock: {
    alignItems: 'center',
    marginTop: 0,
    paddingBottom: 2,
  },
  promiseRule: {
    width: 42,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.34)',
    marginBottom: 12,
  },
  heroPromise: {
    maxWidth: 300,
    fontFamily: F.serifMedium,
    fontSize: 23,
    lineHeight: 28,
    textAlign: 'center',
    color: INK,
  },
  heroPromiseAccent: {
    fontFamily: F.serifSemiBold,
    color: GOLD,
  },
  bottomAction: {
    paddingTop: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 21,
  },
  introSlide: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingBottom: 0,
  },
  introWarmth: {
    position: 'absolute',
    left: -22,
    right: -22,
    bottom: 0,
    height: '52%',
  },
  introContent: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 118,
    zIndex: 1,
  },
  introLogoFrame: {
    width: 68,
    height: 68,
    borderRadius: 23,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(197,160,89,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.10)',
  },
  introLogoPlate: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
  },
  introLogo: {
    width: 50,
    height: 50,
    borderRadius: 16,
  },
  introRule: {
    width: 38,
    height: 2,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(197,160,89,0.42)',
  },
  introCopy: {
    alignItems: 'center',
  },
  introEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: GOLD,
    textTransform: 'uppercase',
  },
  introTitle: {
    maxWidth: 340,
    fontFamily: F.serifSemiBold,
    fontSize: 41,
    lineHeight: 44,
    textAlign: 'center',
    color: INK,
  },
  introBody: {
    marginTop: 12,
    maxWidth: 244,
    fontFamily: F.sans,
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: 'center',
    color: '#6F665D',
  },
  introBottomAction: {
    backgroundColor: 'transparent',
  },
  ctaIsland: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    padding: 5,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.54)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.085,
    shadowRadius: 24,
    elevation: 4,
  },
  introThanks: {
    marginTop: 16,
    maxWidth: 270,
    fontFamily: F.serifMediumItalic,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    color: '#8B7A66',
  },
  introNotes: {
    marginTop: 28,
    alignSelf: 'center',
    rowGap: 9,
  },
  introNote: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
  },
  introNoteText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: '#6E6257',
  },
  primaryButton: {
    width: '100%',
    maxWidth: 326,
    minHeight: 53,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    backgroundColor: '#15120F',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.96)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 5,
  },
  primaryButtonDisabled: {
    backgroundColor: '#F2EEE8',
    borderColor: 'rgba(25,23,20,0.06)',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    fontFamily: F.serifSemiBold,
    fontSize: 16.5,
    lineHeight: 20,
    color: '#FFFFFF',
    letterSpacing: 0,
  },
  primaryButtonDisabledText: {
    color: 'rgba(25,23,20,0.36)',
  },
  centerSlide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 36,
  },
  messageIconWrap: {
    width: 78,
    height: 78,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
    marginBottom: 26,
  },
  centerEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: GOLD,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  centerTitle: {
    marginTop: 12,
    maxWidth: 330,
    fontFamily: F.serifSemiBold,
    fontSize: 31,
    lineHeight: 36,
    color: INK,
    textAlign: 'center',
  },
  centerBody: {
    marginTop: 13,
    maxWidth: 320,
    fontFamily: F.sans,
    fontSize: 14,
    lineHeight: 22,
    color: MUTED,
    textAlign: 'center',
  },
  autoDots: {
    marginTop: 30,
    flexDirection: 'row',
    columnGap: 7,
  },
  autoDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(25,23,20,0.14)',
  },
  autoDotActive: {
    width: 22,
    backgroundColor: GOLD,
  },
  processingSimpleSlide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  processingSimpleText: {
    fontFamily: F.serifSemiBold,
    fontSize: 28,
    lineHeight: 33,
    textAlign: 'center',
    color: INK,
  },
  processingSimpleSpinner: {
    marginTop: 24,
  },
  processingSlide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 34,
    overflow: 'hidden',
  },
  processingWarmth: {
    position: 'absolute',
    left: -52,
    right: -52,
    top: '20%',
    height: 310,
  },
  processingOrb: {
    width: 214,
    height: 214,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  processingGlowLarge: {
    position: 'absolute',
    width: 214,
    height: 214,
    borderRadius: 107,
    backgroundColor: 'rgba(197,160,89,0.08)',
  },
  processingGlowSmall: {
    position: 'absolute',
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: 'rgba(255,247,232,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.14)',
  },
  processingRing: {
    position: 'absolute',
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 2,
    borderColor: 'rgba(197,160,89,0.16)',
    backgroundColor: 'rgba(197,160,89,0.06)',
  },
  processingCore: {
    width: 86,
    height: 86,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 3,
  },
  processingLogo: {
    width: 70,
    height: 70,
    borderRadius: 22,
  },
  processingPanel: {
    width: '100%',
    marginTop: 24,
    borderRadius: 24,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.065)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.05,
    shadowRadius: 28,
    elevation: 2,
  },
  processingStatus: {
    minHeight: 70,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 11,
  },
  processingStatusActive: {
    backgroundColor: '#FFFDF8',
  },
  processingStatusIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(25,23,20,0.06)',
  },
  processingStatusIconActive: {
    backgroundColor: GOLD,
  },
  processingStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(25,23,20,0.20)',
  },
  processingStatusCopy: {
    flex: 1,
  },
  processingStatusTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  processingStatusLabel: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    color: 'rgba(25,23,20,0.44)',
  },
  processingStatusLabelActive: {
    color: INK,
  },
  processingStatusState: {
    fontFamily: F.sansBold,
    fontSize: 10,
    color: 'rgba(25,23,20,0.32)',
  },
  processingStatusStateActive: {
    color: GOLD,
  },
  processingStatusBody: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: MUTED,
  },
  processingRail: {
    marginTop: 8,
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(25,23,20,0.055)',
  },
  processingRailFill: {
    width: '14%',
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(25,23,20,0.14)',
  },
  processingRailFillActive: {
    width: '100%',
    backgroundColor: 'rgba(197,160,89,0.70)',
  },
  processingRailFillCurrent: {
    width: '68%',
    backgroundColor: GOLD,
  },
  processingChecklist: {
    marginTop: 24,
    rowGap: 9,
  },
  miniCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    alignSelf: 'center',
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    opacity: 0.58,
  },
  miniCheckActive: {
    opacity: 1,
    backgroundColor: 'rgba(197,160,89,0.08)',
  },
  miniCheckDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(25,23,20,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCheckDotActive: {
    backgroundColor: GOLD,
  },
  miniCheckText: {
    fontFamily: F.sansBold,
    fontSize: 12,
    color: '#70665D',
  },
  miniCheckTextActive: {
    color: INK,
  },
  bridgeSlide: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  bridgeWarmth: {
    position: 'absolute',
    left: -22,
    right: -22,
    bottom: -8,
    height: '52%',
  },
  bridgeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 26,
    zIndex: 1,
  },
  bridgeLogoWrap: {
    width: 108,
    height: 108,
    borderRadius: 31,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.07,
    shadowRadius: 26,
    elevation: 2,
  },
  bridgeLogo: {
    width: '100%',
    height: '100%',
  },
  bridgeRule: {
    width: 42,
    height: 2,
    borderRadius: 999,
    marginBottom: 18,
    backgroundColor: 'rgba(197,160,89,0.40)',
  },
  bridgeKicker: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: GOLD,
    letterSpacing: 2.1,
    textTransform: 'uppercase',
  },
  bridgeTitle: {
    marginTop: 12,
    fontFamily: F.serifSemiBold,
    fontSize: 31,
    lineHeight: 36,
    textAlign: 'center',
    color: INK,
  },
  bridgeBody: {
    marginTop: 14,
    fontFamily: F.sans,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: MUTED,
  },
  pillarRow: {
    marginTop: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  pillarChip: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 7,
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
  },
  pillarChipText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: INK,
  },
  questionSlide: {
    flex: 1,
    position: 'relative',
    paddingTop: 0,
  },
  questionScroll: {
    flex: 1,
  },
  questionScrollContent: {
    paddingTop: 6,
    paddingBottom: 132,
  },
  questionFixedContent: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 18,
    paddingBottom: 112,
  },
  questionPrompt: {
    marginBottom: 20,
  },
  questionPromptMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    marginBottom: 10,
  },
  questionPromptEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: GOLD,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  mascotShell: {
    width: 60,
    height: 60,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.13,
    shadowRadius: 20,
    elevation: 3,
  },
  mascotHalo: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(197,160,89,0.07)',
    transform: [{ rotate: '12deg' }],
  },
  mascotLogo: {
    width: 47,
    height: 47,
    borderRadius: 14,
  },
  speechBubble: {
    flex: 1,
    height: 116,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 19,
    paddingVertical: 13,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.38)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 2,
  },
  speechTail: {
    position: 'absolute',
    left: -8,
    width: 17,
    height: 17,
    backgroundColor: '#FFFDF8',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(197,160,89,0.38)',
    transform: [{ rotate: '45deg' }],
  },
  speechQuestion: {
    fontFamily: F.serifSemiBold,
    fontSize: 21,
    lineHeight: 26,
    textAlign: 'center',
    color: INK,
  },
  speechResponse: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    lineHeight: 21,
    color: '#5F574F',
  },
  questionHeader: {
    marginBottom: 20,
  },
  questionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  questionEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: GOLD,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  questionCounter: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: 'rgba(25,23,20,0.42)',
  },
  questionTitle: {
    marginTop: 14,
    fontFamily: F.serifSemiBold,
    fontSize: 33,
    lineHeight: 36,
    color: INK,
  },
  questionSubtitle: {
    marginTop: 10,
    fontFamily: F.sans,
    fontSize: 13,
    lineHeight: 20,
    color: '#746A60',
  },
  optionsStack: {
    rowGap: 10,
  },
  optionsStackLong: {
    rowGap: 8,
  },
  optionCard: {
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.045,
    shadowRadius: 18,
    elevation: 1,
  },
  optionCardSelected: {
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 2,
  },
  optionSelectedWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(197,160,89,0.045)',
  },
  optionCardCompact: {
    minHeight: 66,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 15,
  },
  questionOptionCard: {
    minHeight: 78,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0.025,
    shadowRadius: 12,
  },
  questionOptionCardCompact: {
    minHeight: 70,
    borderRadius: 19,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  optionRail: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    backgroundColor: GOLD,
  },
  questionOptionRail: {
    width: 0,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconSelected: {
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.32)',
  },
  optionIconCompact: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  questionOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    color: INK,
  },
  questionOptionTitle: {
    fontFamily: F.sansBold,
    fontSize: 20,
    lineHeight: 24,
  },
  optionBody: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 16,
    color: '#7B7167',
  },
  questionOptionBody: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: '#8A8177',
  },
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  questionFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    alignItems: 'center',
    borderTopWidth: 0,
    backgroundColor: 'transparent',
  },
  setupSlide: {
    flex: 1,
    position: 'relative',
  },
  setupCoachScreen: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  setupCoachDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1C1917',
  },
  setupCoachMockHeader: {
    position: 'absolute',
    top: 70,
    left: 40,
    right: 40,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  setupCoachMockLineWide: {
    position: 'absolute',
    top: 154,
    left: 34,
    right: 34,
    height: 86,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.040)',
  },
  setupCoachMockLineShort: {
    position: 'absolute',
    top: 258,
    left: 76,
    right: 76,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.040)',
  },
  setupCoachMockFab: {
    position: 'absolute',
    right: 34,
    bottom: 126,
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(197,160,89,0.13)',
  },
  setupCoachContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 90,
  },
  setupCoachPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    zIndex: 3,
    elevation: 3,
  },
  setupCoachMascotShell: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.34)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 26,
    elevation: 5,
  },
  setupCoachMascotHalo: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: 'rgba(197,160,89,0.09)',
    transform: [{ rotate: '12deg' }],
  },
  setupCoachMascotLogo: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  setupCoachBubble: {
    flex: 1,
    minHeight: 118,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF8E8',
    borderWidth: 1.5,
    borderColor: 'rgba(197,160,89,0.58)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.26,
    shadowRadius: 30,
    elevation: 6,
  },
  setupCoachBubbleTail: {
    position: 'absolute',
    left: -8,
    width: 18,
    height: 18,
    backgroundColor: '#FFF8E8',
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: 'rgba(197,160,89,0.58)',
    transform: [{ rotate: '45deg' }],
  },
  setupCoachText: {
    fontFamily: F.serifSemiBold,
    fontSize: 22,
    lineHeight: 27,
    textAlign: 'center',
    color: INK,
  },
  setupCoachSpotlight: {
    marginTop: 20,
    borderRadius: 24,
    padding: 9,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 2,
    borderColor: 'rgba(197,160,89,0.72)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 5,
    zIndex: 2,
  },
  setupCoachButton: {
    minHeight: 52,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.38)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  setupCoachButtonText: {
    fontFamily: F.sansBold,
    fontSize: 14,
    color: INK,
  },
  setupScroll: {
    flex: 1,
  },
  setupScrollContent: {
    paddingTop: 16,
    paddingBottom: 142,
  },
  guidedScrollContent: {
    paddingTop: 12,
    paddingBottom: 142,
  },
  guidedHero: {
    alignItems: 'center',
    marginBottom: 20,
  },
  guidedHeroIcon: {
    width: 82,
    height: 82,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.20)',
    marginBottom: 16,
  },
  guidedHeroLogo: {
    width: 70,
    height: 70,
    borderRadius: 22,
  },
  guidedTitle: {
    marginTop: 12,
    maxWidth: 342,
    fontFamily: F.serifSemiBold,
    fontSize: 32,
    lineHeight: 36,
    textAlign: 'center',
    color: INK,
  },
  guidedBody: {
    marginTop: 10,
    maxWidth: 330,
    fontFamily: F.sans,
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: 'center',
    color: MUTED,
  },
  pillarMapCard: {
    marginTop: 14,
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.07)',
  },
  pillarMapRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  pillarMapIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E8',
  },
  pillarMapCopy: {
    flex: 1,
  },
  pillarMapTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    color: INK,
  },
  pillarMapBody: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },
  taskTypeGrid: {
    rowGap: 0,
  },
  taskTypeHero: {
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  taskTypeEyebrowPill: {
    minHeight: 31,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 7,
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
  },
  taskTypeEyebrowText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: GOLD,
    textTransform: 'uppercase',
  },
  taskTypeHeroTitle: {
    maxWidth: 320,
    fontFamily: F.serifSemiBold,
    fontSize: 32,
    lineHeight: 35,
    textAlign: 'center',
    color: INK,
  },
  taskTypeHeroRule: {
    marginTop: 10,
    width: 38,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.34)',
  },
  taskTypeHeroBody: {
    marginTop: 9,
    maxWidth: 292,
    fontFamily: F.sans,
    fontSize: 12.5,
    lineHeight: 18.5,
    textAlign: 'center',
    color: '#776D63',
  },
  taskTypePreviewWrap: {
    borderRadius: 20,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  taskTypeCard: {
    borderRadius: 20,
    padding: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.035,
    shadowRadius: 16,
    elevation: 1,
  },
  taskTypeCardOpen: {
    borderColor: 'rgba(197,160,89,0.48)',
    backgroundColor: '#FFFDF8',
  },
  taskTypeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 11,
  },
  taskTypeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E8',
  },
  taskTypeIconOpen: {
    backgroundColor: 'rgba(197,160,89,0.18)',
  },
  taskTypeCopy: {
    flex: 1,
    minWidth: 0,
  },
  taskTypeTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 18,
    color: INK,
  },
  taskTypeBody: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },
  taskTypeLabel: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'rgba(25,23,20,0.045)',
  },
  taskTypeLabelOpen: {
    backgroundColor: GOLD,
  },
  taskTypeLabelText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    color: 'rgba(25,23,20,0.48)',
  },
  taskTypeLabelTextOpen: {
    color: '#FFFFFF',
  },
  taskTypeDetail: {
    marginTop: 3,
    marginBottom: 4,
    marginHorizontal: 8,
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,253,248,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    position: 'relative',
    overflow: 'visible',
  },
  taskTypeDetailStem: {
    position: 'absolute',
    top: -5,
    left: 26,
    width: 42,
    height: 10,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    backgroundColor: 'rgba(255,253,248,0.98)',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
  },
  taskTypeDetailTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 16,
    color: INK,
  },
  taskTypeDetailText: {
    marginTop: 4,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 18,
    color: '#6F665D',
  },
  starterRow: {
    minHeight: 70,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 8,
  },
  starterCopy: {
    flex: 1,
    minWidth: 0,
  },
  starterTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  starterBody: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.70)',
  },
  starterMeta: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    color: GOLD,
  },
  managementStack: {
    rowGap: 11,
  },
  managementCard: {
    minHeight: 92,
    borderRadius: 22,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  managementIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E8',
  },
  managementCopy: {
    flex: 1,
  },
  managementTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 19,
    color: INK,
  },
  managementBody: {
    marginTop: 5,
    fontFamily: F.sans,
    fontSize: 12.5,
    lineHeight: 19,
    color: MUTED,
  },
  screenTimeCard: {
    alignItems: 'center',
    borderRadius: 28,
    paddingVertical: 26,
    paddingHorizontal: 18,
    backgroundColor: '#181512',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
    elevation: 3,
  },
  screenTimeNumber: {
    fontFamily: F.serifSemiBold,
    fontSize: 74,
    lineHeight: 78,
    color: GOLD,
  },
  screenTimeUnit: {
    fontFamily: F.sansBold,
    fontSize: 12,
    letterSpacing: 1.5,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  screenTimeBody: {
    marginTop: 12,
    maxWidth: 270,
    fontFamily: F.sans,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.72)',
  },
  screenTimeOptions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  screenTimeOption: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  screenTimeOptionActive: {
    backgroundColor: '#FFF7E8',
    borderColor: 'rgba(197,160,89,0.58)',
  },
  screenTimeOptionText: {
    fontFamily: F.sansBold,
    fontSize: 11.5,
    color: 'rgba(25,23,20,0.52)',
  },
  screenTimeOptionTextActive: {
    color: INK,
  },
  blockerStack: {
    rowGap: 10,
  },
  blockerCard: {
    minHeight: 76,
    borderRadius: 20,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  blockerCardActive: {
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(197,160,89,0.48)',
  },
  blockerCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(25,23,20,0.055)',
  },
  blockerCheckActive: {
    backgroundColor: GOLD,
  },
  blockerCopy: {
    flex: 1,
  },
  blockerTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 18,
    color: INK,
  },
  blockerBody: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },
  focusToolStack: {
    rowGap: 11,
  },
  focusToolCard: {
    minHeight: 82,
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  focusToolCardActive: {
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(197,160,89,0.48)',
  },
  focusToolIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E8',
  },
  focusToolIconActive: {
    backgroundColor: 'rgba(197,160,89,0.20)',
  },
  focusToolCopy: {
    flex: 1,
  },
  focusToolTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 18,
    color: INK,
  },
  focusToolBody: {
    marginTop: 4,
    fontFamily: F.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: MUTED,
  },
  scripturePreview: {
    borderRadius: 26,
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
    marginBottom: 13,
  },
  scripturePreviewKicker: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: GOLD,
  },
  scripturePreviewText: {
    marginTop: 12,
    fontFamily: F.serifMedium,
    fontSize: 24,
    lineHeight: 32,
    color: INK,
  },
  scripturePreviewActions: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureHeader: {
    marginBottom: 16,
  },
  featureTitle: {
    marginTop: 12,
    fontFamily: F.serifSemiBold,
    fontSize: 34,
    lineHeight: 38,
    color: INK,
  },
  featureSubtitle: {
    marginTop: 10,
    fontFamily: F.sans,
    fontSize: 14,
    lineHeight: 22,
    color: MUTED,
  },
  pillarNote: {
    marginTop: 14,
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    backgroundColor: '#FFF7E8',
  },
  pillarNoteText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: INK,
  },
  featureValueCard: {
    borderRadius: 20,
    padding: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
    marginBottom: 12,
  },
  featureValueTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 20,
    color: INK,
  },
  featureValueBody: {
    marginTop: 7,
    fontFamily: F.sans,
    fontSize: 13,
    lineHeight: 20,
    color: MUTED,
  },
  previewCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#181512',
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 3,
  },
  previewLabel: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: 'rgba(255,255,255,0.62)',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  previewRow: {
    minHeight: 48,
    borderRadius: 15,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 8,
  },
  previewCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.18)',
  },
  previewText: {
    flex: 1,
    fontFamily: F.sansBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  previewTime: {
    fontFamily: F.sansBold,
    fontSize: 10,
    color: GOLD,
  },
  setupPrompt: {
    marginBottom: 10,
    fontFamily: F.sansBold,
    fontSize: 12,
    color: 'rgba(25,23,20,0.48)',
  },
  bibleSlide: {
    flex: 1,
    position: 'relative',
  },
  bibleScrollContent: {
    paddingTop: 20,
    paddingBottom: 144,
    alignItems: 'center',
  },
  bibleIconShell: {
    width: 126,
    height: 126,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    marginBottom: 22,
  },
  bibleEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: GOLD,
    textTransform: 'uppercase',
  },
  bibleTitle: {
    marginTop: 12,
    maxWidth: 330,
    fontFamily: F.serifSemiBold,
    fontSize: 33,
    lineHeight: 38,
    textAlign: 'center',
    color: INK,
  },
  bibleBody: {
    marginTop: 12,
    maxWidth: 334,
    fontFamily: F.sans,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: MUTED,
  },
  freeCard: {
    width: '100%',
    marginTop: 24,
    borderRadius: 24,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  freeRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    paddingVertical: 8,
  },
  freeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E8',
  },
  freeCopy: {
    flex: 1,
  },
  freeTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    color: INK,
  },
  freeBody: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },
  moralCard: {
    width: '100%',
    marginTop: 14,
    borderRadius: 22,
    padding: 17,
    backgroundColor: '#181512',
  },
  moralTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 20,
    color: '#FFFFFF',
  },
  moralBody: {
    marginTop: 8,
    fontFamily: F.sans,
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.72)',
  },
  paywallSlide: {
    flex: 1,
  },
  paywallScrollContent: {
    paddingTop: 14,
    paddingBottom: 22,
  },
  paywallHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  paywallEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: GOLD,
    textTransform: 'uppercase',
  },
  paywallTitle: {
    marginTop: 10,
    maxWidth: 330,
    fontFamily: F.serifSemiBold,
    fontSize: 32,
    lineHeight: 36,
    textAlign: 'center',
    color: INK,
  },
  paywallSubtitle: {
    marginTop: 8,
    maxWidth: 310,
    fontFamily: F.sans,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: MUTED,
  },
  timelineCard: {
    borderRadius: 26,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.06,
    shadowRadius: 28,
    elevation: 2,
  },
  trialRow: {
    flexDirection: 'row',
    columnGap: 13,
  },
  trialRailWrap: {
    width: 34,
    alignItems: 'center',
  },
  trialDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#24211D',
  },
  trialDotActive: {
    backgroundColor: GOLD,
  },
  trialRail: {
    width: 3,
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.22)',
  },
  trialCopy: {
    flex: 1,
    paddingBottom: 18,
  },
  trialLabel: {
    fontFamily: F.sansBold,
    fontSize: 13,
    color: GOLD,
  },
  trialTitle: {
    marginTop: 2,
    fontFamily: F.serifSemiBold,
    fontSize: 18,
    color: INK,
  },
  trialBody: {
    marginTop: 4,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 18,
    color: MUTED,
  },
  offerCard: {
    marginTop: 14,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#181512',
  },
  offerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  offerLabel: {
    fontFamily: F.serifSemiBold,
    fontSize: 20,
    color: '#FFFFFF',
  },
  offerBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(197,160,89,0.22)',
  },
  offerBadgeText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    color: '#FFFFFF',
  },
  offerPrice: {
    marginTop: 12,
    fontFamily: F.sansBold,
    fontSize: 15,
    color: GOLD,
  },
  offerFinePrint: {
    marginTop: 5,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.72)',
  },
  creatorCodeCard: {
    marginTop: 12,
    minHeight: 70,
    borderRadius: 20,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
  },
  creatorCodeTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 18,
    color: INK,
  },
  creatorCodeBody: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 12,
    color: MUTED,
  },
  cancelCard: {
    marginTop: 12,
    borderRadius: 20,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  cancelTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 18,
    color: INK,
  },
  cancelBody: {
    marginTop: 6,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 18,
    color: MUTED,
  },
  paywallFooter: {
    paddingTop: 10,
    alignItems: 'center',
    borderTopWidth: 0,
    backgroundColor: 'transparent',
  },
  trialButton: {
    width: '100%',
    maxWidth: 326,
    minHeight: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#54C878',
    shadowColor: '#54C878',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 4,
  },
  trialButtonText: {
    fontFamily: F.sansBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  trialButtonSubtext: {
    marginTop: 3,
    fontFamily: F.sansBold,
    fontSize: 10,
    color: 'rgba(255,255,255,0.82)',
  },
  restoreText: {
    marginTop: 10,
    textAlign: 'center',
    fontFamily: F.sansBold,
    fontSize: 11,
    color: 'rgba(25,23,20,0.44)',
  },
});
