import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage, type ImageRef as ExpoImageRef } from 'expo-image';
import LottieView from 'lottie-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import FocusLottie from '@/components/focus/FocusLottie';
import Reanimated, {
  type SharedValue,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOut,
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  ArrowUpRight,
  BellRing,
  BookMarked,
  Calendar,
  Candle,
  CheckSmall,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cross,
  Crown,
  Feather,
  Heart,
  Home,
  Hourglass,
  ListChecks,
  Moon,
  OpenBook,
  Play,
  Plus,
  Sun,
  SlidersHorizontal,
  Sparkles,
  Settings,
  Target,
  User,
  X,
} from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { AnyTaskCard, type TaskData } from '@/components/shared/TaskCards';
import { normalizeHabitIcon } from '@/components/shared/notoEmoji/legacyMap';
import {
  playAchievementCompleteFeedback,
  playTaskCompleteFeedback,
  playTaskCheckSoundOnly,
  preloadAchievementFeedbackSound,
  preloadTaskFeedbackSound,
} from '@/components/shared/taskFeedback';
import { AnimatedTaskRow, CompletionFlourish } from '@/components/shared/taskAnimations';
import BigEventsView from '@/components/journal/BigEventsView';
import WeeklyRhythm from '@/components/home/WeeklyRhythm';
import MonthlyGoalsView from '@/components/inner-tools/MonthlyGoalsView';
import HabitsView from '@/components/habits/HabitsView';
import ChallengesView from '@/components/challenges/ChallengesView';
import MyRoutineView from '@/components/routine/MyRoutineView';
import { useGuidedSetup } from '@/components/onboarding/guided/GuidedSetupContext';
import { GuidedOverlayHost } from '@/components/onboarding/guided/GuidedOverlayHost';
import { C, F } from '@/constants/tokens';

type ChristianAnswer = 'yes' | 'exploring' | 'no' | 'prefer_not';
type TraditionAnswer =
  | 'orthodox'
  | 'catholic'
  | 'protestant'
  | 'nondenominational'
  | 'other'
  | 'not_christian'
  | 'oriental'
  | 'prefer_not';
type AgeAnswer = 'under_18' | '18_24' | '25_34' | '35_44' | '45_54' | '55_plus';
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
type ValueReflectAnswer =
  | 'protect_time'
  | 'organize_life'
  | 'daily_discipline'
  | 'spiritual_discipline'
  | 'grow_spiritually'
  | 'consistent'
  | 'meant_to_be';
type CommitmentAnswer = 'all_in' | 'committed' | 'try' | 'exploring';
type OnboardingChapter = 'protect' | 'build';
type RoutineAnswer = 'morning' | 'evening' | 'prayer' | 'work';
type FocusAnswer = 'pomodoro' | 'blockers' | 'deep_work' | 'screen_time';
type PillarAnswer = 'organize' | 'focus' | 'spiritual';
type StepId =
  | 'welcome'
  | 'nameIntro'
  | 'traditionIntro'
  | 'valueOrganize'
  | 'valueDiscipline'
  | 'valueFocus'
  | 'valueFaith'
  | 'valueTools'
  | 'toolsIntroA'
  | 'toolsIntroB'
  | 'toolsShowcase'
  | 'statementsIntro'
  | 'tutorialDeck'
  | 'protectDeck'
  | 'screenTimeSlider'
  | 'dayVisualization'
  | 'protectRecap'
  | 'setupProtect'
  | 'flameProtect'
  | 'organizeDeck'
  | 'organizeRecap'
  | 'setupOrganize'
  | 'weeklyReveal'
  | 'flameOrganize'
  | 'giftMoment'
  | 'bibleWalkthrough'
  | 'prayerBook'
  | 'flameGrow'
  | 'toolsSlides'
  | 'flameTools'
  | 'privacy'
  | 'callingClose'
  | 'homeReveal'
  | 'firstCheckoff'
  | 'postPaywallBrand'
  | 'postPaywallProfile'
  | 'accountCreation'
  | 'valueReflect'
  | 'commitment'
  | 'questionIntro'
  | 'christian'
  | 'tradition'
  | 'age'
  | 'gender'
  | 'reason'
  | 'processing'
  | 'setupStart'
  | 'protectIntro'
  | 'protectPain'
  | 'protectScreenTime'
  | 'protectCalculation'
  | 'protectReframe'
  | 'protectAppBlockers'
  | 'protectWebsiteBlockers'
  | 'protectFocusBlock'
  | 'protectComplete'
  | 'buildIntro'
  | 'buildBigEvents'
  | 'buildMonthlyGoals'
  | 'buildWeeklyRhythm'
  | 'buildTaskTypes'
  | 'buildHabits'
  | 'buildSpiritualTasks'
  | 'buildRoutineTasks'
  | 'buildChallenges'
  | 'buildQuickTasks'
  | 'buildMyRoutine'
  | 'buildHomePreview'
  | 'buildComplete'
  | 'chapterCheckpointFirst'
  | 'chapterCheckpointFinal'
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
  displayName?: string;
  valueReflection?: ValueReflectAnswer[];
  commitment?: CommitmentAnswer;
  christian?: ChristianAnswer;
  tradition?: TraditionAnswer;
  isOrthodox?: boolean;
  secularFilter?: boolean;
  age?: AgeAnswer;
  gender?: GenderAnswer;
  reasons?: ReasonAnswer[];
  primaryPillar?: PillarAnswer;
  firstChapter?: OnboardingChapter;
  screenTimeHours?: number;
  confirmedProtectProblems?: string[];
  confirmedOrganizeProblems?: string[];
  gratitudeDailyTask?: boolean;
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

type StatementDeckCard = {
  id: string;
  statement: string;
  icon: React.ReactNode;
  image?: number;
  spiritual?: boolean;
  bold?: string[];
};

type StatementCardMetrics = {
  width: number;
  quoteHeight: number;
  cardHeight: number;
};

const GOLD = C.gold;
const INK = '#191714';
const PAPER = '#FFFDF9';
const MUTED = '#776E64';
const APP_LOGO = require('@/assets/images/anasta-logo.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CONFETTI_SOURCE = require('@/assets/animations/onboarding-confetti.lottie');
const PROTECT_TIME_STICKER = require('@/assets/images/onboarding/protect-time-sticker.png');
const FAITH_BIBLE_STICKER = require('@/assets/images/onboarding/faith-bible-sticker.png');
const FAITH_BIBLE_NOTES_STICKER = require('@/assets/images/onboarding/faith-bible-notes-sticker.png');
const FAITH_PRAYER_BOOK_STICKER = require('@/assets/images/onboarding/faith-prayer-book-sticker.png');
const FAITH_FREE_FOR_EVERYONE_BADGE = require('@/assets/images/onboarding/faith-free-for-everyone-badge.png');
const PROTECT_STATEMENT_IMAGES = [
  require('@/assets/images/protect-statement-1.jpg'),
  require('@/assets/images/protect-statement-2.jpg'),
  require('@/assets/images/protect-statement-3.jpg'),
  require('@/assets/images/protect-statement-4.jpg'),
  require('@/assets/images/protect-statement-5.jpg'),
  require('@/assets/images/protect-statement-6.jpg'),
];
const ORGANIZE_STATEMENT_IMAGES = [
  require('@/assets/images/organize-statement-1.jpg'),
  require('@/assets/images/organize-statement-2.jpg'),
  require('@/assets/images/organize-statement-3.jpg'),
  require('@/assets/images/organize-statement-4.jpg'),
  require('@/assets/images/organize-statement-5.jpg'),
  require('@/assets/images/organize-statement-6.jpg'),
  require('@/assets/images/organize-statement-7.jpg'),
  require('@/assets/images/organize-statement-8.jpg'),
  require('@/assets/images/organize-statement-9.jpg'),
  require('@/assets/images/organize-statement-10.jpg'),
  require('@/assets/images/organize-statement-11.jpg'),
];

const STATEMENT_IMAGE_DECODE_SIZE = 768;
const statementImageRefs = new Map<number, ExpoImageRef>();
const statementImageLoads = new Map<number, Promise<ExpoImageRef | null>>();

function loadStatementImage(source: number) {
  const cached = statementImageRefs.get(source);
  if (cached) return Promise.resolve(cached);

  const pending = statementImageLoads.get(source);
  if (pending) return pending;

  const load = ExpoImage.loadAsync(source, {
    maxWidth: STATEMENT_IMAGE_DECODE_SIZE,
    maxHeight: STATEMENT_IMAGE_DECODE_SIZE,
  })
    .then(image => {
      statementImageRefs.set(source, image);
      statementImageLoads.delete(source);
      return image;
    })
    .catch(() => {
      statementImageLoads.delete(source);
      return null;
    });

  statementImageLoads.set(source, load);
  return load;
}

function warmStatementImages(sources: number[]) {
  return Promise.all(sources.map(loadStatementImage));
}

function releaseStatementImages(sources: number[]) {
  for (const source of sources) {
    const image = statementImageRefs.get(source);
    if (image) {
      try {
        image.release();
      } catch {
        // The native ref may already have been released during a fast remount.
      }
      statementImageRefs.delete(source);
    }

    const pending = statementImageLoads.get(source);
    if (pending) {
      statementImageLoads.delete(source);
      void pending.then(loaded => {
        if (!loaded) return;
        try {
          loaded.release();
        } catch {
          // The native ref may already have been released.
        }
        if (statementImageRefs.get(source) === loaded) {
          statementImageRefs.delete(source);
        }
      });
    }
  }
}

const TUTORIAL_DECK_CARDS: StatementDeckCard[] = [
  {
    id: 'tutorial-yes',
    statement: "I sometimes feel like there's too much to do and not enough time.",
    icon: <ListChecks s={30} c="#4D8586" w={1.9} />,
    bold: ['too much to do', 'not enough time'],
  },
  {
    id: 'tutorial-no',
    statement: 'I always know exactly what to do and never feel overwhelmed.',
    icon: <Sparkles s={30} c="#4D8586" w={1.9} />,
    bold: ['always know exactly', 'never feel overwhelmed'],
  },
  {
    id: 'tutorial-ready',
    statement: 'Do you understand?',
    icon: <CheckSmall s={30} c="#4D8586" w={2.4} />,
  },
];

const PROTECT_DECK_CARDS: StatementDeckCard[] = [
  {
    id: 'lost-hour',
    statement: 'I pick up my phone for a second and lose an hour. I feel frustrated and guilty.',
    image: PROTECT_STATEMENT_IMAGES[0],
    icon: <Clock s={30} c="#4D8586" w={1.9} />,
    bold: ['lose an hour', 'frustrated and guilty'],
  },
  {
    id: 'morning-night',
    statement: "My phone is the first thing I reach for in the morning and the last thing I see at night. I feel restless and it's ruining my sleep.",
    image: PROTECT_STATEMENT_IMAGES[1],
    icon: <BellRing s={30} c="#4D8586" w={1.9} />,
    bold: ['first thing', 'last thing', 'ruining my sleep'],
  },
  {
    id: 'focus-pulled',
    statement: 'Every time I sit down for something important, notifications and apps pull me away. I feel like I can never truly focus.',
    image: PROTECT_STATEMENT_IMAGES[2],
    icon: <Target s={30} c="#4D8586" w={1.9} />,
    bold: ['pull me away', 'never truly focus'],
  },
  {
    id: 'procrastination',
    statement: 'When I need to start something hard, I feel anxious and uncomfortable — so I pick up my phone instead. I end up procrastinating for hours. And I feel like I let myself down — again.',
    image: PROTECT_STATEMENT_IMAGES[3],
    icon: <Hourglass s={30} c="#4D8586" w={1.9} />,
    bold: ['procrastinating for hours', 'let myself down'],
  },
  {
    id: 'ashamed-content',
    statement: "I'm addicted to content that I'm ashamed of — adult content, gambling, gaming, social media. It leaves me feeling empty every time.",
    image: PROTECT_STATEMENT_IMAGES[4],
    icon: <SlidersHorizontal s={30} c="#4D8586" w={1.9} />,
    bold: ['addicted', 'ashamed of', 'feeling empty'],
  },
  {
    id: 'presence',
    statement: 'I want to be fully present — in prayer, with family, at work. But distractions keep pulling me away.',
    image: PROTECT_STATEMENT_IMAGES[5],
    icon: <Heart s={30} c="#4D8586" w={1.9} />,
    spiritual: true,
    bold: ['fully present', 'keep pulling me away'],
  },
];

const ORGANIZE_DECK_CARDS: StatementDeckCard[] = [
  {
    id: 'anxious-start',
    statement: "I feel anxious when I have a lot to do and don't know where to start.",
    image: ORGANIZE_STATEMENT_IMAGES[0],
    icon: <ListChecks s={30} c={GOLD} w={1.9} />,
    bold: ['anxious', "don't know where to start"],
  },
  {
    id: 'last-minute',
    statement: 'I always end up doing everything at the last minute. I feel stressed and unprepared when it matters most.',
    image: ORGANIZE_STATEMENT_IMAGES[1],
    icon: <Clock s={30} c={GOLD} w={1.9} />,
    bold: ['last minute', 'stressed and unprepared'],
  },
  {
    id: 'plan-day',
    statement: 'I get things done — but I know I could do so much more if I just planned my day better.',
    image: ORGANIZE_STATEMENT_IMAGES[2],
    icon: <Calendar s={30} c={GOLD} w={1.9} />,
    bold: ['so much more', 'planned my day better'],
  },
  {
    id: 'habits-quit',
    statement: "I start new habits full of motivation. A few days later I've quit again. I feel like I have no discipline.",
    image: ORGANIZE_STATEMENT_IMAGES[3],
    icon: <Target s={30} c={GOLD} w={1.9} />,
    bold: ["I've quit again", 'no discipline'],
  },
  {
    id: 'wasted-day',
    statement: "I end most days feeling like I didn't do what actually mattered. It feels like I wasted another day.",
    image: ORGANIZE_STATEMENT_IMAGES[4],
    icon: <Hourglass s={30} c={GOLD} w={1.9} />,
    bold: ['what actually mattered', 'wasted another day'],
  },
  {
    id: 'forgot-promise',
    statement: 'Sometimes I forget something I promised to do. Then comes the stress — and the feeling that I let someone down.',
    image: ORGANIZE_STATEMENT_IMAGES[5],
    icon: <BellRing s={30} c={GOLD} w={1.9} />,
    bold: ['forget something I promised', 'let someone down'],
  },
  {
    id: 'no-rhythm',
    statement: 'My days have no rhythm. I never feel in control — just carried along by whatever happens.',
    image: ORGANIZE_STATEMENT_IMAGES[6],
    icon: <Home s={30} c={GOLD} w={1.9} />,
    bold: ['no rhythm', 'never feel in control'],
  },
  {
    id: 'pray-daily',
    statement: 'I want to pray every day but I rarely do. I feel distant from God and guilty about it.',
    image: ORGANIZE_STATEMENT_IMAGES[7],
    icon: <Cross s={30} c={GOLD} w={1.9} />,
    spiritual: true,
    bold: ['pray every day', 'distant from God'],
  },
  {
    id: 'goals-give-up',
    statement: 'I set goals with the best intentions. And then, somehow, I always end up giving up.',
    image: ORGANIZE_STATEMENT_IMAGES[8],
    icon: <Sparkles s={30} c={GOLD} w={1.9} />,
    bold: ['set goals', 'giving up'],
  },
  {
    id: 'scripture-time',
    statement: 'I want to read Scripture but I never make time for it. My faith is not growing the way it should.',
    image: ORGANIZE_STATEMENT_IMAGES[9],
    icon: <OpenBook s={30} c={GOLD} w={1.9} />,
    spiritual: true,
    bold: ['read Scripture', 'never make time'],
  },
  {
    id: 'intentional-time',
    statement: 'I want to be more organized, disciplined, and intentional with my time.',
    image: ORGANIZE_STATEMENT_IMAGES[10],
    icon: <Feather s={30} c={GOLD} w={1.9} />,
    bold: ['organized', 'disciplined', 'intentional'],
  },
];

const CHRISTIAN_OPTIONS: Option<ChristianAnswer>[] = [
  {
    value: 'yes',
    title: 'Yes',
    body: 'I follow Christ.',
    response: "So your faith leads the way - and we'll help you build a life around it.",
    icon: <Cross s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'exploring',
    title: "I'm exploring",
    body: "I'm open, curious, or returning.",
    response: 'Then this is a good place to begin - quietly, and at your own pace.',
    icon: <Sparkles s={21} c={GOLD} w={1.9} />,
  },
  {
    value: 'no',
    title: 'No',
    body: 'I want discipline and structure.',
    response: "So you're here to become more disciplined - and we'd love to help you get there.",
    icon: <ListChecks s={22} c={GOLD} w={1.9} />,
  },
  {
    value: 'prefer_not',
    title: 'Prefer not to say',
    body: "I'd rather keep that private.",
    response: "Of course. Whatever you're reaching for, we hope to help you find it.",
    icon: <Heart s={21} c={GOLD} w={1.8} />,
  },
];

const TRADITION_OPTIONS: Option<TraditionAnswer>[] = [
  {
    value: 'catholic',
    title: 'Catholic',
    body: 'Roman Catholic',
    icon: <Cross s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'protestant',
    title: 'Protestant',
    body: 'Reformed, evangelical, mainline...',
    icon: <Cross s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'orthodox',
    title: 'Orthodox',
    body: 'Eastern Orthodox',
    icon: <Cross s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'nondenominational',
    title: 'Non-denominational',
    body: 'Christian, no fixed denomination',
    icon: <Cross s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'other',
    title: 'Other',
    body: 'Something else',
    icon: <Cross s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'not_christian',
    title: "I'm not Christian",
    body: 'Use a general setup',
    icon: <X s={20} c={GOLD} w={2.2} />,
  },
];

const TRADITION_INTRO_TIMING = {
  nameReply: 140,
  welcome: 860,
  question: 1600,
  optionsStart: 2240,
  optionStep: 120,
};

const TRADITION_CONFIRM_TIMING = {
  userReply: 160,
  place: 900,
  begin: 1640,
  typingStart: 1840,
  cta: 2580,
};
const TRADITION_APP_TYPING_INTERVAL_MS = 24;

const AGE_OPTIONS: Option<AgeAnswer>[] = [
  {
    value: 'under_18',
    title: 'Under 18',
    body: '',
    response: 'Thank you. This helps us understand who Anasta is serving.',
    icon: <Sparkles s={21} c={GOLD} w={1.9} />,
  },
  {
    value: '18_24',
    title: '18-24',
    body: '',
    response: 'Thank you. This helps us understand who Anasta is serving.',
    icon: <Target s={22} c={GOLD} w={1.8} />,
  },
  {
    value: '25_34',
    title: '25-34',
    body: '',
    response: 'Thank you. This helps us understand who Anasta is serving.',
    icon: <ListChecks s={22} c={GOLD} w={1.9} />,
  },
  {
    value: '35_44',
    title: '35-44',
    body: '',
    response: 'Thank you. This helps us understand who Anasta is serving.',
    icon: <Crown s={22} c={GOLD} w={1.8} />,
  },
  {
    value: '45_54',
    title: '45-54',
    body: '',
    response: 'Thank you. This helps us understand who Anasta is serving.',
    icon: <Heart s={21} c={GOLD} w={1.8} />,
  },
  {
    value: '55_plus',
    title: '55+',
    body: '',
    response: 'Thank you. This helps us understand who Anasta is serving.',
    icon: <Heart s={21} c={GOLD} w={1.8} />,
  },
];

const GENDER_OPTIONS: Option<GenderAnswer>[] = [
  {
    value: 'male',
    title: 'Male',
    body: '',
    response: 'Thank you. This helps us understand who Anasta is serving.',
    icon: <Crown s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'female',
    title: 'Female',
    body: '',
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

const VALUE_REFLECT_OPTIONS: Option<ValueReflectAnswer>[] = [
  {
    value: 'protect_time',
    title: 'Protect my time',
    body: 'Take back the hours my phone quietly takes.',
    response: 'Good. Your time is worth protecting.',
    icon: <Hourglass s={22} c={GOLD} w={1.7} />,
  },
  {
    value: 'organize_life',
    title: 'Organize my life',
    body: 'Bring events, goals, and tasks into one clear place.',
    response: 'Good. A clear life is easier to return to.',
    icon: <ListChecks s={22} c={GOLD} w={1.9} />,
  },
  {
    value: 'daily_discipline',
    title: 'Build daily discipline',
    body: 'Turn the right actions into a routine I can keep.',
    response: 'Good. Discipline grows through repeated action.',
    icon: <Target s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'spiritual_discipline',
    title: 'Build spiritual discipline',
    body: 'Make prayer and Scripture a steady practice, not an afterthought.',
    response: 'Good. Your spiritual life deserves a visible rhythm.',
    icon: <Cross s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'grow_spiritually',
    title: 'Grow spiritually',
    body: 'Reflect, return, and stay close to what matters.',
    response: 'Good. Anasta should help you keep returning.',
    icon: <Candle s={22} c={GOLD} w={1.7} />,
  },
  {
    value: 'consistent',
    title: 'Stay consistent',
    body: 'Stop starting over and build something that lasts.',
    response: 'Good. Consistency is built one return at a time.',
    icon: <Crown s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'meant_to_be',
    title: "Become who I'm meant to be",
    body: "Grow into the person I'm called to be.",
    response: 'Good. That is the path Anasta is built for.',
    icon: <Sparkles s={21} c={GOLD} w={1.9} />,
  },
];

const COMMITMENT_OPTIONS: Option<CommitmentAnswer>[] = [
  {
    value: 'all_in',
    title: "I'm all in.",
    body: "I'm ready to commit and show up every day.",
    response: 'Good. Then let us build this with intention.',
    icon: <Crown s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'committed',
    title: "I'm committed.",
    body: "I want this and I'll put in the work.",
    response: 'Good. Commitment gives structure something to carry.',
    icon: <Target s={22} c={GOLD} w={1.8} />,
  },
  {
    value: 'try',
    title: 'I want to try.',
    body: "I'm hopeful but still finding my footing.",
    response: 'Good. A faithful start is still a start.',
    icon: <Sparkles s={21} c={GOLD} w={1.9} />,
  },
  {
    value: 'exploring',
    title: "I'm just exploring.",
    body: "I'm curious and seeing if this fits.",
    response: 'That is okay. Start calmly and see what helps.',
    icon: <Feather s={22} c={GOLD} w={1.8} />,
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

const PROTECT_SCREEN_TIME_CARDS = ['lost-hour', 'morning-night', 'procrastination'];
const PROTECT_FOCUS_CARDS = ['focus-pulled', 'presence'];

function stepOrder(answers: Answers): StepId[] {
  const protect = answers.confirmedProtectProblems ?? [];
  const organize = answers.confirmedOrganizeProblems ?? [];

  // Setup groups appear only for the problems the user confirmed (v4 setup loop).
  const protectSetup: StepId[] = [];
  if (protect.some(id => PROTECT_SCREEN_TIME_CARDS.includes(id))) protectSetup.push('protectAppBlockers');
  if (protect.some(id => PROTECT_FOCUS_CARDS.includes(id))) protectSetup.push('protectFocusBlock');
  if (protect.includes('ashamed-content')) protectSetup.push('protectWebsiteBlockers');

  // The guided chain in the real views is fixed: BigEvents -> MonthlyGoals ->
  // Habits -> Challenges -> MyRoutine. Any confirmed organize problem runs it.
  const organizeSetup: StepId[] = organize.length > 0
    ? ['buildBigEvents', 'buildMonthlyGoals', 'buildHabits', 'buildChallenges', 'buildMyRoutine']
    : [];

  return [
    'welcome',
    'nameIntro',
    'traditionIntro',
    'valueOrganize',
    'valueDiscipline',
    'valueFocus',
    'valueFaith',
    'toolsShowcase',
    'statementsIntro',
    'tutorialDeck',
    'protectDeck',
    'screenTimeSlider',
    'dayVisualization',
    'protectRecap',
    ...protectSetup,
    'flameProtect',
    'organizeDeck',
    'organizeRecap',
    ...organizeSetup,
    'weeklyReveal',
    'flameOrganize',
    'giftMoment',
    'bibleWalkthrough',
    'prayerBook',
    'flameGrow',
    'toolsSlides',
    'flameTools',
    'homeReveal',
    'firstCheckoff',
    'privacy',
    'callingClose',
    'paywall',
    'postPaywallBrand',
    'age',
    'gender',
    'accountCreation',
  ];
}

function selectedFor(step: StepId, answers: Answers) {
  if (step === 'christian') return answers.christian;
  if (step === 'tradition') return answers.tradition;
  if (step === 'age') return answers.age;
  if (step === 'gender') return answers.gender;
  if (step === 'commitment') return answers.commitment;
  if (step === 'pillars') return answers.primaryPillar;
  if (step === 'routine') return answers.routine;
  if (step === 'focus') return answers.focus;
  return undefined;
}

function selectedValuesFor(step: StepId, answers: Answers): string[] {
  if (step === 'valueReflect') return answers.valueReflection ?? [];
  if (step === 'reason') return answers.reasons ?? [];
  const selected = selectedFor(step, answers);
  return selected ? [selected] : [];
}

function getOptions(step: StepId): Option<string>[] {
  if (step === 'valueReflect') return VALUE_REFLECT_OPTIONS;
  if (step === 'commitment') return COMMITMENT_OPTIONS;
  if (step === 'christian') return CHRISTIAN_OPTIONS;
  if (step === 'tradition') return TRADITION_OPTIONS;
  if (step === 'age') return AGE_OPTIONS;
  if (step === 'gender') return GENDER_OPTIONS;
  if (step === 'reason') return REASON_OPTIONS;
  return [];
}

function isSecularTradition(tradition?: TraditionAnswer) {
  return tradition === 'not_christian' || tradition === 'prefer_not';
}

function questionCopy(step: StepId) {
  if (step === 'valueReflect') {
    return {
      eyebrow: 'Goals',
      title: 'What do you want to achieve with Anasta?',
      subtitle: 'Choose all that matter to you.',
    };
  }
  if (step === 'commitment') {
    return {
      eyebrow: 'Commitment',
      title: 'How committed are you to reaching these goals?',
      subtitle: 'Choose the answer that feels most honest right now.',
    };
  }
  if (step === 'christian') {
    return {
      eyebrow: 'First, a little context',
      title: 'Are you Christian?',
      subtitle: 'Anasta works for daily structure, spiritual growth, or both. This helps us start in the right place.',
    };
  }
  if (step === 'tradition') {
    return {
      eyebrow: 'Your faith',
      title: 'Which tradition are you part of?',
      subtitle: 'We use this gently, mostly to shape spiritual language and prayer context.',
    };
  }
  if (step === 'age') {
    return {
      eyebrow: 'Your season',
      title: 'How old are you?',
      subtitle: 'This helps us understand who Anasta serves.',
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

function runPreviewTaskCheckHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function runAdvanceHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function runBubbleHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

function runStrongHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

function runTypingHaptic() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

function optionEntrance(index: number, baseDelay = 70) {
  const entrance = index % 2 === 0 ? FadeInLeft : FadeInRight;
  return entrance
    .delay(baseDelay + index * 42)
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
  duration = 620,
  distance = 24,
  style,
  pointerEvents = 'auto',
}: {
  children: React.ReactNode;
  active?: boolean;
  delay?: number;
  duration?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      progress.value = withTiming(0, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      });
      return undefined;
    }

    progress.value = 0;
    const timer = setTimeout(() => {
      progress.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [active, delay, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [distance, 0]) }],
  }));

  return <Reanimated.View pointerEvents={pointerEvents} style={[style, animatedStyle]}>{children}</Reanimated.View>;
}

function progressForStep(step: StepId, answers: Answers): SectionProgress | null {
  const hasTraditionStep = answers.christian === 'yes';
  const total = hasTraditionStep ? 4 : 3;
  if (step === 'christian') return { key: 'questions', index: 0, total: 4 };
  if (step === 'tradition') return { key: 'questions', index: 1, total: 4 };
  if (step === 'age') return { key: 'questions', index: hasTraditionStep ? 2 : 1, total };
  if (step === 'gender') return { key: 'questions', index: hasTraditionStep ? 3 : 2, total };

  return null;
}

function isGuidedWalkthroughStep(step: StepId) {
  return (
    step === 'setupStart' ||
    step === 'protectIntro' ||
    step === 'protectPain' ||
    step === 'protectScreenTime' ||
    step === 'protectCalculation' ||
    step === 'protectReframe' ||
    step === 'protectAppBlockers' ||
    step === 'protectWebsiteBlockers' ||
    step === 'protectFocusBlock' ||
    step === 'protectComplete' ||
    step === 'buildIntro' ||
    step === 'buildBigEvents' ||
    step === 'buildMonthlyGoals' ||
    step === 'buildWeeklyRhythm' ||
    step === 'buildTaskTypes' ||
    step === 'buildHabits' ||
    step === 'buildSpiritualTasks' ||
    step === 'buildRoutineTasks' ||
    step === 'buildChallenges' ||
    step === 'buildQuickTasks' ||
    step === 'buildMyRoutine' ||
    step === 'buildHomePreview' ||
    step === 'buildComplete' ||
    step === 'chapterCheckpointFirst' ||
    step === 'chapterCheckpointFinal' ||
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
    step === 'paywall' ||
    step === 'toolsIntroA' ||
    step === 'toolsIntroB' ||
    step === 'statementsIntro' ||
    step === 'tutorialDeck' ||
    step === 'protectDeck' ||
    step === 'screenTimeSlider' ||
    step === 'dayVisualization' ||
    step === 'protectRecap' ||
    step === 'setupProtect' ||
    step === 'flameProtect' ||
    step === 'organizeDeck' ||
    step === 'organizeRecap' ||
    step === 'setupOrganize' ||
    step === 'weeklyReveal' ||
    step === 'flameOrganize' ||
    step === 'giftMoment' ||
    step === 'bibleWalkthrough' ||
    step === 'prayerBook' ||
    step === 'flameGrow' ||
    step === 'toolsSlides' ||
    step === 'flameTools' ||
    step === 'privacy' ||
    step === 'callingClose' ||
    step === 'homeReveal' ||
    step === 'firstCheckoff' ||
    step === 'postPaywallBrand' ||
    step === 'postPaywallProfile' ||
    step === 'accountCreation'
  );
}

type ValueStepId = 'valueOrganize' | 'valueDiscipline' | 'valueFocus' | 'valueFaith' | 'valueTools';
type ValuePhoneKind = 'organize' | 'discipline' | 'focus' | 'faith' | 'tools';

const VALUE_STEP_IDS: ValueStepId[] = [
  'valueOrganize',
  'valueDiscipline',
  'valueFocus',
  'valueFaith',
];
const VALUE_FLOW_DOT_COUNT = VALUE_STEP_IDS.length;

const VALUE_SLIDES: Record<ValueStepId, { title: string; body: string; kind: ValuePhoneKind }> = {
  valueOrganize: {
    title: 'Organize your life!',
    body: 'Your daily responsibilities and your spiritual life - organized together, in one place.',
    kind: 'organize',
  },
  valueDiscipline: {
    title: 'Build discipline!',
    body: 'Become a more disciplined person and build the habits that shape your character.',
    kind: 'discipline',
  },
  valueFocus: {
    title: 'Protect your time!',
    body: 'Block distractions, addictive content, and everything that pulls you away from what matters.',
    kind: 'focus',
  },
  valueFaith: {
    title: 'Grow closer to God!',
    body: 'Learning about God should always be free — and in Anasta, it always will be.',
    kind: 'faith',
  },
  valueTools: {
    title: "Become who you're called to be!",
    body: 'Everything you need - to organize your life, build discipline, grow closer to God, and become a better version of yourself.',
    kind: 'tools',
  },
};

function isValueStep(step: StepId): step is ValueStepId {
  return VALUE_STEP_IDS.includes(step as ValueStepId);
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
      </Reanimated.View>
    </LinearGradient>
  );
}

function WelcomeSlide({ onNext, ready }: { onNext: () => void; ready: boolean }) {
  const titleStyle = useRevealStyle(ready, 0, 16, 520);
  const logoStyle = useRevealStyle(ready, 140, 22, 640);
  const scriptureStyle = useRevealStyle(ready, 300, 16, 600);
  const promiseStyle = useRevealStyle(ready, 520, 12, 540);

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
    </View>
  );
}

function WelcomeConfettiOverlay({ active }: { active: boolean }) {
  const confettiRef = useRef<React.ElementRef<typeof LottieView>>(null);
  const confettiOpacity = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      confettiOpacity.value = 0;
      confettiRef.current?.reset();
      return undefined;
    }
    preloadAchievementFeedbackSound();
    const timer = setTimeout(() => {
      confettiOpacity.value = withTiming(1, { duration: 140 });
      confettiRef.current?.play();
      void playAchievementCompleteFeedback();
    }, 920);

    return () => clearTimeout(timer);
  }, [active, confettiOpacity]);

  const confettiStyle = useAnimatedStyle(() => ({
    opacity: confettiOpacity.value,
  }));

  return (
    <View pointerEvents="none" style={s.confettiOverlay}>
      <Reanimated.View style={[StyleSheet.absoluteFill, s.confettiLayer, confettiStyle]}>
        <LottieView
          ref={confettiRef}
          source={CONFETTI_SOURCE}
          autoPlay={false}
          loop={false}
          speed={0.92}
          resizeMode="cover"
          renderMode="SOFTWARE"
          style={[StyleSheet.absoluteFill, s.confettiLottie]}
        />
      </Reanimated.View>
    </View>
  );
}

function nameForDisplay(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\s+/g, ' ');
}

type TypedTextSegment = { text: string; highlight?: boolean };

function joinTypedSegments(segments: TypedTextSegment[]) {
  return segments.map(segment => segment.text).join('');
}

function TypedSegmentText({
  segments,
  count,
  textStyle,
  highlightStyle,
  caretStyle,
}: {
  segments: TypedTextSegment[];
  count: number;
  textStyle: StyleProp<TextStyle>;
  highlightStyle: StyleProp<TextStyle>;
  caretStyle: StyleProp<TextStyle>;
}) {
  let remaining = count;
  const totalLength = segments.reduce((sum, segment) => sum + segment.text.length, 0);

  return (
    <Text style={textStyle}>
      {segments.map((segment, index) => {
        if (remaining <= 0) return null;
        const visible = segment.text.slice(0, remaining);
        remaining -= visible.length;
        return (
          <Text key={`${segment.text}-${index}`} style={segment.highlight ? highlightStyle : undefined}>
            {visible}
          </Text>
        );
      })}
      {count < totalLength ? <Text style={caretStyle}>|</Text> : null}
    </Text>
  );
}

function NameIntroSlide({
  value,
  bottomInset,
  onNameChange,
  onNext,
}: {
  value?: string;
  bottomInset: number;
  onNameChange: (name: string) => void;
  onNext: () => void;
}) {
  const { height } = useWindowDimensions();
  const [draft, setDraft] = useState(value ?? '');
  const cleanName = draft.trim();
  const displayName = nameForDisplay(cleanName || value);
  const canSubmit = cleanName.length > 0;
  const nameContentStyle = useMemo(
    () => [s.nameIntroContent, { paddingTop: Math.max(188, Math.min(268, height * 0.285)) }],
    [height],
  );

  const handlePrimary = () => {
    if (!canSubmit) return;
    runSelectionHaptic();
    onNameChange(displayName);
    onNext();
  };

  useEffect(() => {
    const firstBubbleTimer = setTimeout(runBubbleHaptic, 260);
    const questionBubbleTimer = setTimeout(runBubbleHaptic, 1110);
    return () => {
      clearTimeout(firstBubbleTimer);
      clearTimeout(questionBubbleTimer);
    };
  }, []);

  return (
    <LinearGradient
      colors={['#FFFDF8', '#FFFDF8', '#F8EEDC', '#D9B98E']}
      locations={[0, 0.56, 0.86, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={s.nameIntroSlide}
    >
      <View pointerEvents="none" style={s.nameIntroBackdrop}>
        <View style={s.nameIntroGlow} />
        <View style={s.nameIntroLine} />
      </View>

      <ScrollView
        style={s.nameIntroScroll}
        contentContainerStyle={nameContentStyle}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Reanimated.View
          entering={FadeIn.duration(520).withInitialValues({
            opacity: 0,
            transform: [{ translateY: 14 }, { scale: 0.985 }],
          })}
          style={s.nameConversation}
        >
          <View style={s.nameBotRow}>
            <Reanimated.View
              entering={FadeInLeft.duration(660).withInitialValues({
                opacity: 0,
                transform: [{ translateX: -28 }, { translateY: 8 }, { rotate: '-3deg' }, { scale: 0.94 }],
              })}
              style={s.nameAvatarShellSmall}
            >
              <Image source={APP_LOGO} style={s.nameAvatarLogoSmall} resizeMode="cover" />
            </Reanimated.View>
            <Reanimated.View
              entering={FadeInRight.delay(260).duration(620).withInitialValues({
                opacity: 0,
                transform: [{ translateX: 18 }, { translateY: 9 }, { scale: 0.94 }],
              })}
              style={s.nameBubble}
            >
              <Text style={s.nameBubbleText}>Hi, Welcome!</Text>
            </Reanimated.View>
          </View>

          <View style={[s.nameBotRow, s.nameBotRowSecond]}>
            <Reanimated.View
              entering={FadeInLeft.delay(820).duration(720).withInitialValues({
                opacity: 0,
                transform: [{ translateX: -34 }, { translateY: 7 }, { rotate: '-7deg' }, { scale: 0.93 }],
              })}
              style={[s.nameAvatarShell, s.nameQuestionAvatarShell]}
            >
              <View style={s.nameAvatarHalo} />
              <Image source={APP_LOGO} style={s.nameAvatarLogo} resizeMode="cover" />
            </Reanimated.View>
            <Reanimated.View
              entering={FadeInRight.delay(1110).duration(650).withInitialValues({
                opacity: 0,
                transform: [{ translateX: 20 }, { translateY: 10 }, { scale: 0.93 }],
              })}
              style={[s.nameBubble, s.nameQuestionBubble]}
            >
              <Text style={s.nameBubbleText}>What is your name?</Text>
            </Reanimated.View>
          </View>

          <Reanimated.View
            entering={FadeIn.delay(1740).duration(560).withInitialValues({
              opacity: 0,
              transform: [{ translateY: 18 }, { scale: 0.975 }],
            })}
            style={s.nameInputBlock}
          >
            <Text style={s.nameInputLabel}>Your name</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Enter your name"
              placeholderTextColor="rgba(25,23,20,0.34)"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handlePrimary}
              style={s.nameInput}
            />
          </Reanimated.View>
        </Reanimated.View>
      </ScrollView>

      <AnimatedCta delay={260} style={[s.bottomAction, s.introBottomAction, { paddingBottom: bottomInset + 8 }]}>
        <View style={s.ctaIsland}>
          <TouchableOpacity
            activeOpacity={0.9}
            haptic="light"
            disabled={!canSubmit}
            onPress={handlePrimary}
            style={[s.primaryButton, !canSubmit && s.primaryButtonDisabled]}
          >
            <Text style={[s.primaryButtonText, !canSubmit && s.primaryButtonDisabledText]}>Continue</Text>
            <ChevronRight s={19} c={canSubmit ? '#FFFFFF' : 'rgba(25,23,20,0.34)'} w={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedCta>
    </LinearGradient>
  );
}

function TraditionIntroSlide({
  name,
  tradition,
  bottomInset,
  onTraditionChange,
  onNext,
}: {
  name?: string;
  tradition?: TraditionAnswer;
  bottomInset: number;
  onTraditionChange: (tradition: TraditionAnswer) => void;
  onNext: () => void;
}) {
  const displayName = nameForDisplay(name) || 'there';
  const [selectedTradition, setSelectedTradition] = useState<TraditionAnswer | undefined>(tradition);
  const [confirmed, setConfirmed] = useState(Boolean(tradition));
  const [welcomeCount, setWelcomeCount] = useState(0);
  const [placeCount, setPlaceCount] = useState(0);
  const [beginCount, setBeginCount] = useState(0);
  const [showQuestion, setShowQuestion] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showPlace, setShowPlace] = useState(false);
  const [showBegin, setShowBegin] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const selectedTraditionLabel = useMemo(
    () => TRADITION_OPTIONS.find(option => option.value === selectedTradition)?.title ?? 'My tradition',
    [selectedTradition],
  );
  const selectedTraditionReply = useMemo(() => {
    if (selectedTradition === 'not_christian') return "I'm not Christian.";
    if (selectedTradition === 'other') return 'I am from another tradition.';
    if (selectedTradition === 'nondenominational') return 'I am non-denominational.';
    return `I am ${selectedTraditionLabel}.`;
  }, [selectedTradition, selectedTraditionLabel]);
  const welcomeSegments = useMemo<TypedTextSegment[]>(() => [{ text: `Welcome, ${displayName}!` }], [displayName]);
  const welcomeText = useMemo(() => joinTypedSegments(welcomeSegments), [welcomeSegments]);
  const placeSegments = useMemo<TypedTextSegment[]>(
    () => [{ text: `You are in the right place, ${displayName}.` }],
    [displayName],
  );
  const placeText = useMemo(() => joinTypedSegments(placeSegments), [placeSegments]);
  const beginSegments = useMemo<TypedTextSegment[]>(() => [{ text: "Let's begin!", highlight: true }], []);
  const beginText = useMemo(() => joinTypedSegments(beginSegments), [beginSegments]);

  const handleSelect = (option: Option<TraditionAnswer>) => {
    if (confirmed) return;
    runSelectionHaptic();
    setSelectedTradition(option.value);
  };

  const handlePrimary = () => {
    if (!confirmed) {
      if (!selectedTradition) return;
      runSelectionHaptic();
      onTraditionChange(selectedTradition);
      setWelcomeCount(welcomeText.length);
      setShowQuestion(true);
      setShowOptions(false);
      setPlaceCount(0);
      setBeginCount(0);
      setShowPlace(false);
      setShowBegin(false);
      setShowContinue(false);
      setConfirmed(true);
      return;
    }

    onNext();
  };

  useEffect(() => {
    if (confirmed) return undefined;
    const timers = [
      setTimeout(runBubbleHaptic, TRADITION_INTRO_TIMING.nameReply + 100),
      setTimeout(runBubbleHaptic, TRADITION_INTRO_TIMING.welcome + 100),
    ];
    return () => timers.forEach(clearTimeout);
  }, [confirmed]);

  useEffect(() => {
    if (confirmed) return undefined;

    setWelcomeCount(0);
    setShowQuestion(false);
    setShowOptions(false);
    let interval: ReturnType<typeof setInterval> | undefined;
    let questionTimer: ReturnType<typeof setTimeout> | undefined;
    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        setWelcomeCount(prev => {
          if (prev >= welcomeText.length) {
            if (interval) clearInterval(interval);
            return prev;
          }
          const next = prev + 1;
          if (next % 3 === 0) runTypingHaptic();
          if (next >= welcomeText.length) {
            if (interval) clearInterval(interval);
            questionTimer = setTimeout(() => {
              runBubbleHaptic();
              setShowQuestion(true);
            }, 380);
          }
          return next;
        });
      }, TRADITION_APP_TYPING_INTERVAL_MS);
    }, TRADITION_INTRO_TIMING.welcome + 240);

    return () => {
      clearTimeout(startTimer);
      if (questionTimer) clearTimeout(questionTimer);
      if (interval) clearInterval(interval);
    };
  }, [confirmed, welcomeText]);

  useEffect(() => {
    if (!showQuestion || confirmed) return undefined;
    const timer = setTimeout(() => setShowOptions(true), 620);
    return () => clearTimeout(timer);
  }, [confirmed, showQuestion]);

  useEffect(() => {
    if (!confirmed) {
      setPlaceCount(0);
      setBeginCount(0);
      setShowPlace(false);
      setShowBegin(false);
      setShowContinue(false);
      return undefined;
    }

    setPlaceCount(0);
    setBeginCount(0);
    setShowPlace(false);
    setShowBegin(false);
    setShowContinue(false);
    const timers = [
      setTimeout(runBubbleHaptic, TRADITION_CONFIRM_TIMING.userReply + 100),
      setTimeout(() => {
        runBubbleHaptic();
        setShowPlace(true);
      }, TRADITION_CONFIRM_TIMING.place),
    ];
    return () => timers.forEach(clearTimeout);
  }, [confirmed]);

  useEffect(() => {
    if (!confirmed || !showPlace) return undefined;

    setPlaceCount(0);
    let interval: ReturnType<typeof setInterval> | undefined;
    let beginTimer: ReturnType<typeof setTimeout> | undefined;
    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        setPlaceCount(prev => {
          if (prev >= placeText.length) {
            if (interval) clearInterval(interval);
            return prev;
          }
          const next = prev + 1;
          if (next % 3 === 0) runTypingHaptic();
          if (next >= placeText.length) {
            if (interval) clearInterval(interval);
            beginTimer = setTimeout(() => {
              runBubbleHaptic();
              setShowBegin(true);
            }, 420);
          }
          return next;
        });
      }, TRADITION_APP_TYPING_INTERVAL_MS);
    }, 260);

    return () => {
      clearTimeout(startTimer);
      if (beginTimer) clearTimeout(beginTimer);
      if (interval) clearInterval(interval);
    };
  }, [confirmed, placeText, showPlace]);

  useEffect(() => {
    if (!confirmed || !showBegin) return undefined;

    setBeginCount(0);
    setShowContinue(false);
    let interval: ReturnType<typeof setInterval> | undefined;
    const continueTriggerCount = Math.max(1, beginText.indexOf('begin') + 1);
    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        setBeginCount(prev => {
          if (prev >= beginText.length) {
            if (interval) clearInterval(interval);
            return prev;
          }
          const next = prev + 1;
          if (next % 3 === 0) runTypingHaptic();
          if (next === continueTriggerCount) {
            setShowContinue(true);
          }
          if (next >= beginText.length) {
            if (interval) clearInterval(interval);
          }
          return next;
        });
      }, TRADITION_APP_TYPING_INTERVAL_MS);
    }, 260);

    return () => {
      clearTimeout(startTimer);
      if (interval) clearInterval(interval);
    };
  }, [beginText, confirmed, showBegin]);

  return (
    <LinearGradient
      colors={['#FFFDF8', '#FFFDF8', '#F8EEDC', '#D9B98E']}
      locations={[0, 0.56, 0.86, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={s.nameIntroSlide}
    >
      <View pointerEvents="none" style={s.nameIntroBackdrop}>
        <View style={s.nameIntroGlow} />
        <View style={s.nameIntroLine} />
      </View>

      <ScrollView
        style={s.nameIntroScroll}
        contentContainerStyle={s.nameIntroContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Reanimated.View
          entering={FadeIn.duration(420).withInitialValues({
            opacity: 0,
            transform: [{ translateY: 14 }, { scale: 0.985 }],
          })}
          style={s.nameConversation}
        >
          <Reanimated.View
            entering={FadeIn.delay(TRADITION_INTRO_TIMING.nameReply).duration(420)}
            style={s.nameUserRow}
          >
            <View style={[s.nameUserBubble, s.nameUserBubbleCompact]}>
              <Text style={[s.nameUserText, s.nameUserTextCompact]}>My name is {displayName}.</Text>
            </View>
          </Reanimated.View>

          <Reanimated.View
            entering={FadeIn.delay(TRADITION_INTRO_TIMING.welcome).duration(460)}
            style={[s.nameBotRow, s.nameBotRowTight]}
          >
            <View style={s.nameAvatarShellSmall}>
              <Image source={APP_LOGO} style={s.nameAvatarLogoSmall} resizeMode="cover" />
            </View>
            <View style={[s.nameBubble, s.nameBubbleAuto, s.nameBubbleCompact, s.nameWelcomeBubble]}>
              <TypedSegmentText
                segments={welcomeSegments}
                count={welcomeCount}
                textStyle={s.nameConversationText}
                highlightStyle={s.inlineGoldUnderline}
                caretStyle={s.nameTypingCaret}
              />
            </View>
          </Reanimated.View>

          {showQuestion ? (
            <Reanimated.View entering={FadeIn.duration(460)} style={[s.nameBotRow, s.nameBotRowTight]}>
              <View style={s.nameAvatarShellSmall}>
                <Image source={APP_LOGO} style={s.nameAvatarLogoSmall} resizeMode="cover" />
              </View>
              <View style={[s.nameBubble, s.nameBubbleAuto, s.nameBubbleCompact, s.nameTraditionBubble]}>
                <Text style={s.nameConversationText}>
                  Which tradition are you part of?{'\n'}
                  <Text style={s.nameBubbleSubtext}>This helps us set things up for you.</Text>
                </Text>
              </View>
            </Reanimated.View>
          ) : null}

          {!confirmed && showOptions ? (
            <View style={s.nameTraditionBlock}>
              {TRADITION_OPTIONS.map((option, index) => {
                const active = selectedTradition === option.value;
                return (
                  <Reanimated.View
                    key={option.value}
                    entering={FadeInUp.delay(index * TRADITION_INTRO_TIMING.optionStep)
                      .duration(420)
                      .easing(Easing.bezier(0.16, 1, 0.28, 1))}
                  >
                    <TouchableOpacity
                      activeOpacity={0.88}
                      haptic="light"
                      onPress={() => handleSelect(option)}
                      style={[s.nameTraditionOption, active && s.nameTraditionOptionActive]}
                    >
                      <View style={[s.nameTraditionIcon, active && s.nameTraditionIconActive]}>
                        {active ? <CheckSmall s={18} c={GOLD} w={2.6} /> : option.icon}
                      </View>
                      <View style={s.nameTraditionCopy}>
                        <Text style={[s.nameTraditionText, active && s.nameTraditionTextActive]}>{option.title}</Text>
                        {option.body ? <Text style={[s.nameTraditionSubtext, active && s.nameTraditionSubtextActive]}>{option.body}</Text> : null}
                      </View>
                      <View style={[s.nameTraditionMark, active && s.nameTraditionMarkActive]}>
                        {active ? <CheckSmall s={14} c="#FFFFFF" w={2.5} /> : null}
                      </View>
                    </TouchableOpacity>
                  </Reanimated.View>
                );
              })}
            </View>
          ) : null}

          {confirmed ? (
            <>
              <Reanimated.View
                entering={FadeIn.delay(TRADITION_CONFIRM_TIMING.userReply).duration(420)}
                style={s.nameUserRow}
              >
                <View style={[s.nameUserBubble, s.nameUserBubbleCompact]}>
                  <Text style={[s.nameUserText, s.nameUserTextCompact]}>{selectedTraditionReply}</Text>
                </View>
              </Reanimated.View>
              {showPlace ? (
                <Reanimated.View entering={FadeIn.duration(460)} style={[s.nameBotRow, s.nameBotRowTight]}>
                  <View style={s.nameAvatarShellSmall}>
                    <Image source={APP_LOGO} style={s.nameAvatarLogoSmall} resizeMode="cover" />
                  </View>
                  <View style={[s.nameBubble, s.nameBubbleAuto, s.nameBubbleCompact, s.nameFinalBubble]}>
                    <TypedSegmentText
                      segments={placeSegments}
                      count={placeCount}
                      textStyle={s.nameConversationText}
                      highlightStyle={s.inlineGoldUnderline}
                      caretStyle={s.nameTypingCaret}
                    />
                  </View>
                </Reanimated.View>
              ) : null}
              {showBegin ? (
                <Reanimated.View entering={FadeIn.duration(460)} style={[s.nameBotRow, s.nameBotRowTight]}>
                  <View style={s.nameAvatarShellSmall}>
                    <Image source={APP_LOGO} style={s.nameAvatarLogoSmall} resizeMode="cover" />
                  </View>
                  <View style={[s.nameBubble, s.nameBubbleAuto, s.nameBubbleCompact, s.nameBeginBubble]}>
                    <TypedSegmentText
                      segments={beginSegments}
                      count={beginCount}
                      textStyle={s.nameConversationText}
                      highlightStyle={s.inlineGoldUnderline}
                      caretStyle={s.nameTypingCaret}
                    />
                  </View>
                </Reanimated.View>
              ) : null}
            </>
          ) : null}
        </Reanimated.View>
      </ScrollView>

      {!confirmed && selectedTradition ? (
        <AnimatedCta
          key="tradition-confirm"
          delay={120}
          style={[s.bottomAction, s.introBottomAction, { paddingBottom: bottomInset + 8 }]}
        >
          <View style={s.ctaIsland}>
            <TouchableOpacity
              activeOpacity={0.9}
              haptic="light"
              onPress={handlePrimary}
              style={s.primaryButton}
            >
              <Text style={s.primaryButtonText}>Confirm</Text>
              <ChevronRight s={19} c="#FFFFFF" w={2.5} />
            </TouchableOpacity>
          </View>
        </AnimatedCta>
      ) : null}

      {confirmed && showContinue ? (
        <AnimatedCta
          key="tradition-continue"
          delay={0}
          style={[s.bottomAction, s.introBottomAction, { paddingBottom: bottomInset + 8 }]}
        >
          <View style={s.ctaIsland}>
            <TouchableOpacity activeOpacity={0.9} haptic="none" onPress={handlePrimary} style={s.primaryButton}>
              <Text style={s.primaryButtonText}>Continue</Text>
              <ChevronRight s={19} c="#FFFFFF" w={2.5} />
            </TouchableOpacity>
          </View>
        </AnimatedCta>
      ) : null}
    </LinearGradient>
  );
}

function ValuePreviewSlide({
  step,
  topInset,
  bottomInset,
  onNext,
  onBack,
}: {
  step: ValueStepId;
  topInset: number;
  bottomInset: number;
  onNext: () => void;
  onBack: () => void;
}) {
  const { width } = useWindowDimensions();
  const index = VALUE_STEP_IDS.indexOf(step);
  const isLast = index === VALUE_STEP_IDS.length - 1;
  const [progressIndex, setProgressIndex] = useState(index);
  const pagePosition = useSharedValue(index);
  const dragX = useSharedValue(0);

  const updateProgressIndex = useCallback((nextIndex: number) => {
    setProgressIndex(Math.max(0, Math.min(VALUE_FLOW_DOT_COUNT - 1, nextIndex)));
  }, []);

  useEffect(() => {
    setProgressIndex(index);
    pagePosition.value = index;
    dragX.value = 0;
  }, [dragX, index, pagePosition]);

  const swipeGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-18, 18])
    .onUpdate(event => {
      const raw = event.translationX;
      const canMoveRight = index > 0;

      if (raw < 0) {
        dragX.value = raw;
        return;
      }
      if (raw > 0 && canMoveRight) {
        dragX.value = raw;
        return;
      }

      dragX.value = raw * 0.16;
    })
    .onEnd(event => {
      const threshold = Math.min(88, width * 0.22);
      const shouldAdvance = event.translationX < -threshold || event.velocityX < -520;
      const shouldReturn = index > 0 && (event.translationX > threshold || event.velocityX > 520);

      if (shouldAdvance) {
        if (isLast) {
          dragX.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
          runOnJS(runStrongHaptic)();
          runOnJS(onNext)();
        } else {
          runOnJS(updateProgressIndex)(index + 1);
          dragX.value = withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) });
          pagePosition.value = withTiming(index + 1, { duration: 360, easing: Easing.out(Easing.cubic) }, () => {
            runOnJS(runStrongHaptic)();
            runOnJS(onNext)();
          });
        }
        return;
      }

      if (shouldReturn) {
        runOnJS(updateProgressIndex)(index - 1);
        dragX.value = withTiming(0, { duration: 360, easing: Easing.out(Easing.cubic) });
        pagePosition.value = withTiming(index - 1, { duration: 360, easing: Easing.out(Easing.cubic) }, () => {
          runOnJS(runStrongHaptic)();
          runOnJS(onBack)();
        });
        return;
      }

      dragX.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    }), [dragX, index, isLast, onBack, onNext, pagePosition, updateProgressIndex, width]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -(pagePosition.value * width) + dragX.value },
    ],
  }));

  return (
    <LinearGradient
      colors={['#FFFDF8', '#FFFDF8', '#F8EEDC', '#D9B98E']}
      locations={[0, 0.52, 0.82, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={s.valueSlide}
    >
      <View pointerEvents="none" style={s.valueBackdrop}>
        <View style={s.valueBackdropBandTop} />
        <View style={s.valueBackdropBandBottom} />
        <View style={s.valueBackdropLineOne} />
        <View style={s.valueBackdropLineTwo} />
      </View>

      <View style={s.valueCarouselViewport}>
        <GestureDetector gesture={swipeGesture}>
          <Reanimated.View style={[s.valueCarouselTrack, { width: width * VALUE_STEP_IDS.length }, trackStyle]}>
            {VALUE_STEP_IDS.map((valueStep, slideIndex) => (
              <ValuePreviewPage
                key={valueStep}
                width={width}
                topInset={topInset}
                slide={VALUE_SLIDES[valueStep]}
                bottomInset={bottomInset}
                animateIntro={slideIndex === 0}
                active={slideIndex === index}
              />
            ))}
          </Reanimated.View>
        </GestureDetector>
      </View>

      <View style={[s.valueNavigation, { paddingBottom: bottomInset, transform: [{ translateY: 6 }] }]}>
        <ValueSlideProgressRail activeIndex={progressIndex} total={VALUE_FLOW_DOT_COUNT} />
        <View style={s.valueSwipeHint}>
          <Text style={s.valueSwipeHintText}>Swipe To Continue</Text>
          <ChevronRight s={15} c={GOLD} w={2.4} />
        </View>
      </View>
    </LinearGradient>
  );
}

function ValueToolsClosingSlide({
  topInset,
  bottomInset,
  onNext,
}: {
  topInset: number;
  bottomInset: number;
  onNext: () => void;
}) {
  const { width } = useWindowDimensions();

  return (
    <LinearGradient
      colors={['#FFFDF8', '#FFFDF8', '#F8EEDC', '#D9B98E']}
      locations={[0, 0.52, 0.82, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={s.valueSlide}
    >
      <View pointerEvents="none" style={s.valueBackdrop}>
        <View style={s.valueBackdropBandTop} />
        <View style={s.valueBackdropBandBottom} />
        <View style={s.valueBackdropLineOne} />
        <View style={s.valueBackdropLineTwo} />
      </View>

      <View style={s.valueClosingViewport}>
        <ValuePreviewPage
          width={width}
          topInset={topInset}
          bottomInset={bottomInset}
          slide={VALUE_SLIDES.valueTools}
          animateIntro
          active
        />
      </View>

      <AnimatedCta delay={360} style={[s.valueBottomAction, { paddingBottom: bottomInset + 8 }]}>
        <View style={s.ctaIsland}>
          <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={onNext} style={s.primaryButton}>
            <Text style={s.primaryButtonText}>I&apos;m ready</Text>
            <ChevronRight s={19} c="#FFFFFF" w={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedCta>
    </LinearGradient>
  );
}

function ValueSlideProgressRail({ activeIndex, total }: { activeIndex: number; total: number }) {
  return (
    <View style={s.valueProgressRail}>
      {Array.from({ length: total }).map((_, dotIndex) => {
        const active = dotIndex === activeIndex;
        const done = dotIndex <= activeIndex;
        return <ValueProgressStep key={`value-flow-${dotIndex}`} index={dotIndex} active={active} done={done} />;
      })}
    </View>
  );
}

function ValueProgressStep({ index, active, done }: { index: number; active: boolean; done: boolean }) {
  const activeMotion = useSharedValue(active ? 1 : 0);
  const doneMotion = useSharedValue(done ? 1 : 0);

  useEffect(() => {
    activeMotion.value = withTiming(active ? 1 : 0, {
      duration: 380,
      easing: Easing.bezier(0.16, 1, 0.28, 1),
    });
    doneMotion.value = withTiming(done ? 1 : 0, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, activeMotion, done, doneMotion]);

  const stepStyle = useAnimatedStyle(() => ({
    width: interpolate(activeMotion.value, [0, 1], [34, 82]),
  }));
  const trackStyle = useAnimatedStyle(() => ({
    height: interpolate(activeMotion.value, [0, 1], [4.5, 7]),
    opacity: interpolate(activeMotion.value, [0, 1], [0.76, 1]),
    backgroundColor: interpolateColor(
      doneMotion.value,
      [0, 1],
      ['rgba(25,23,20,0.095)', 'rgba(197,160,89,0.20)'],
    ),
    borderColor: interpolateColor(
      activeMotion.value,
      [0, 1],
      ['rgba(255,255,255,0.30)', 'rgba(197,160,89,0.58)'],
    ),
  }));
  const fillStyle = useAnimatedStyle(() => ({
    width: `${doneMotion.value * 100}%`,
    backgroundColor: interpolateColor(
      activeMotion.value,
      [0, 1],
      ['rgba(197,160,89,0.54)', '#E7C36D'],
    ),
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: activeMotion.value,
    transform: [
      { translateY: interpolate(activeMotion.value, [0, 1], [5, 0]) },
      { scale: interpolate(activeMotion.value, [0, 1], [0.78, 1]) },
    ],
  }));

  return (
    <Reanimated.View style={[s.valueProgressStep, stepStyle]}>
      <Reanimated.View style={[s.valueProgressTrack, trackStyle]}>
        <Reanimated.View style={[s.valueProgressTrackFill, fillStyle]} />
      </Reanimated.View>
      <Reanimated.View style={[s.valueProgressDot, dotStyle]}>
        <Text style={s.valueProgressDotText}>{index + 1}</Text>
      </Reanimated.View>
    </Reanimated.View>
  );
}

function ValuePreviewPage({
  width,
  topInset,
  bottomInset,
  slide,
  animateIntro,
  active,
}: {
  width: number;
  topInset: number;
  bottomInset?: number;
  slide: { title: string; body: string; kind: ValuePhoneKind };
  animateIntro?: boolean;
  active: boolean;
}) {
  const [titleUnderlineWidth, setTitleUnderlineWidth] = useState(92);
  const copyEntering = animateIntro
    ? FadeIn.duration(620).withInitialValues({
      opacity: 0,
      transform: [{ translateY: 18 }, { scale: 0.985 }],
    })
    : undefined;
  const visualEntering = animateIntro
    ? FadeIn.delay(120).duration(560).withInitialValues({
      opacity: 0,
      transform: [{ translateY: 28 }, { scale: 0.97 }],
    })
    : undefined;

  return (
    <View style={[s.valuePage, { width }]}>
      <Reanimated.View entering={copyEntering} style={[s.valueCopy, { paddingTop: topInset + 36 }]}>
        <View style={s.valueTitleShell}>
          {slide.kind === 'faith' ? (
            <View pointerEvents="none" style={s.valueFreeCornerTag}>
              <Text style={s.valueFreeCornerTagText}>FREE</Text>
            </View>
          ) : null}
          <View style={s.valueTitleTextWrap}>
            <Text
              style={s.valueTitle}
              onTextLayout={event => {
                const lines = event.nativeEvent.lines;
                const lastLine = lines[lines.length - 1];
                const nextWidth = Math.max(52, Math.min(342, Math.ceil((lastLine?.width ?? 92) * 0.94)));
                setTitleUnderlineWidth(current => (Math.abs(current - nextWidth) > 1 ? nextWidth : current));
              }}
            >
              {slide.title}
            </Text>
            <View style={[s.valueTitleUnderline, { width: titleUnderlineWidth }]} />
          </View>
        </View>
        <View style={s.valueSubtitleFrame}>
          <ValueSubtitleText kind={slide.kind} />
        </View>
      </Reanimated.View>

      <Reanimated.View entering={visualEntering} style={[s.valuePhoneStage, slide.kind === 'organize' && s.valuePhoneStageOrganize]}>
        <ValueSlideVisual kind={slide.kind} active={active} />
      </Reanimated.View>

      {slide.kind === 'faith' ? (
        <View pointerEvents="none" style={[s.valueFaithFreeImageSlideSlot, { bottom: (bottomInset ?? 0) + 66 }]}>
          <AnimatedCta active={active} delay={2120} duration={620} distance={18} pointerEvents="none" style={s.valueFaithFreeImageFrame}>
            <Image source={FAITH_FREE_FOR_EVERYONE_BADGE} style={s.valueFaithFreeImage} resizeMode="contain" resizeMethod="scale" />
          </AnimatedCta>
        </View>
      ) : null}

    </View>
  );
}

function ValueSubtitleWord({ children, underline }: { children: React.ReactNode; underline?: boolean }) {
  return (
    <Text style={[s.valueSubtitleWord, underline && s.valueSubtitleWordEmphasis, underline && s.valueSubtitleWordUnderline]}>
      {children}
    </Text>
  );
}

function ValueSubtitleText({ kind }: { kind: ValuePhoneKind }) {
  if (kind === 'organize') {
    return (
      <View style={s.valueSubtitleLine}>
        <ValueSubtitleWord>Your</ValueSubtitleWord>
        <ValueSubtitleWord underline>daily responsibilities</ValueSubtitleWord>
        <ValueSubtitleWord>and</ValueSubtitleWord>
        <ValueSubtitleWord>your</ValueSubtitleWord>
        <ValueSubtitleWord underline>spiritual life</ValueSubtitleWord>
        <ValueSubtitleWord>-</ValueSubtitleWord>
        <ValueSubtitleWord>organized</ValueSubtitleWord>
        <ValueSubtitleWord>together,</ValueSubtitleWord>
        <ValueSubtitleWord>in</ValueSubtitleWord>
        <ValueSubtitleWord>one</ValueSubtitleWord>
        <ValueSubtitleWord>place.</ValueSubtitleWord>
      </View>
    );
  }

  if (kind === 'discipline') {
    return (
      <View style={s.valueSubtitleLine}>
        <ValueSubtitleWord>Become</ValueSubtitleWord>
        <ValueSubtitleWord>a</ValueSubtitleWord>
        <ValueSubtitleWord>more</ValueSubtitleWord>
        <ValueSubtitleWord underline>disciplined</ValueSubtitleWord>
        <ValueSubtitleWord>person.</ValueSubtitleWord>
        <ValueSubtitleWord>and</ValueSubtitleWord>
        <ValueSubtitleWord>build</ValueSubtitleWord>
        <ValueSubtitleWord>the</ValueSubtitleWord>
        <ValueSubtitleWord underline>habits</ValueSubtitleWord>
        <ValueSubtitleWord>that</ValueSubtitleWord>
        <ValueSubtitleWord>shape</ValueSubtitleWord>
        <ValueSubtitleWord>your</ValueSubtitleWord>
        <ValueSubtitleWord>character.</ValueSubtitleWord>
      </View>
    );
  }

  if (kind === 'focus') {
    return (
      <View style={s.valueSubtitleLine}>
        <ValueSubtitleWord>Block</ValueSubtitleWord>
        <ValueSubtitleWord underline>distractions,</ValueSubtitleWord>
        <ValueSubtitleWord underline>addictive content,</ValueSubtitleWord>
        <ValueSubtitleWord>and</ValueSubtitleWord>
        <ValueSubtitleWord>everything</ValueSubtitleWord>
        <ValueSubtitleWord>that</ValueSubtitleWord>
        <ValueSubtitleWord>pulls</ValueSubtitleWord>
        <ValueSubtitleWord>you</ValueSubtitleWord>
        <ValueSubtitleWord>away</ValueSubtitleWord>
        <ValueSubtitleWord>from</ValueSubtitleWord>
        <ValueSubtitleWord>what</ValueSubtitleWord>
        <ValueSubtitleWord underline>matters.</ValueSubtitleWord>
      </View>
    );
  }

  if (kind === 'faith') {
    return (
      <View style={s.valueSubtitleLine}>
        <ValueSubtitleWord>Learning</ValueSubtitleWord>
        <ValueSubtitleWord>about</ValueSubtitleWord>
        <ValueSubtitleWord underline>God</ValueSubtitleWord>
        <ValueSubtitleWord>should</ValueSubtitleWord>
        <ValueSubtitleWord>always</ValueSubtitleWord>
        <ValueSubtitleWord>be</ValueSubtitleWord>
        <ValueSubtitleWord underline>free</ValueSubtitleWord>
        <ValueSubtitleWord>—</ValueSubtitleWord>
        <ValueSubtitleWord>and</ValueSubtitleWord>
        <ValueSubtitleWord>in</ValueSubtitleWord>
        <ValueSubtitleWord underline>Anasta,</ValueSubtitleWord>
        <ValueSubtitleWord>it</ValueSubtitleWord>
        <ValueSubtitleWord>always</ValueSubtitleWord>
        <ValueSubtitleWord>will</ValueSubtitleWord>
        <ValueSubtitleWord>be.</ValueSubtitleWord>
      </View>
    );
  }

  return (
    <View style={s.valueSubtitleLine}>
      <ValueSubtitleWord>everything</ValueSubtitleWord>
      <ValueSubtitleWord>you</ValueSubtitleWord>
      <ValueSubtitleWord>need</ValueSubtitleWord>
      <ValueSubtitleWord>-</ValueSubtitleWord>
      <ValueSubtitleWord>to</ValueSubtitleWord>
      <ValueSubtitleWord underline>organize your life,</ValueSubtitleWord>
      <ValueSubtitleWord underline>build discipline,</ValueSubtitleWord>
      <ValueSubtitleWord>grow</ValueSubtitleWord>
      <ValueSubtitleWord>closer</ValueSubtitleWord>
      <ValueSubtitleWord>to</ValueSubtitleWord>
      <ValueSubtitleWord underline>God,</ValueSubtitleWord>
      <ValueSubtitleWord>and</ValueSubtitleWord>
      <ValueSubtitleWord>become</ValueSubtitleWord>
      <ValueSubtitleWord>a</ValueSubtitleWord>
      <ValueSubtitleWord>better</ValueSubtitleWord>
      <ValueSubtitleWord>version</ValueSubtitleWord>
      <ValueSubtitleWord>of</ValueSubtitleWord>
      <ValueSubtitleWord>yourself.</ValueSubtitleWord>
    </View>
  );
}

function ValueSlideVisual({ kind, active }: { kind: ValuePhoneKind; active: boolean }) {
  if (kind === 'organize') return <ValuePhoneMock kind={kind} active={active} />;
  if (kind === 'discipline') return <ValueDisciplineIllustration active={active} />;
  if (kind === 'focus') return <ValueFocusIllustration active={active} />;
  if (kind === 'faith') return <ValueFaithIllustration active={active} />;
  return <ValueFeatureListVisual active={active} type="tools" />;
}

function ValueVisualReveal({
  active,
  delay,
  children,
}: {
  active: boolean;
  delay: number;
  children: React.ReactNode;
}) {
  const reveal = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    reveal.value = 0;
    if (active) {
      reveal.value = withDelay(
        delay,
        withTiming(1, {
          duration: 430,
          easing: Easing.bezier(0.16, 1, 0.28, 1),
        }),
      );
    }
  }, [active, delay, reveal]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [
      { translateY: interpolate(reveal.value, [0, 1], [16, 0]) },
      { scale: interpolate(reveal.value, [0, 1], [0.97, 1]) },
    ],
  }));

  return <Reanimated.View style={[s.valueVisualReveal, revealStyle]}>{children}</Reanimated.View>;
}

function ValueFocusCardReveal({
  active,
  delay,
  children,
}: {
  active: boolean;
  delay: number;
  children: React.ReactNode;
}) {
  if (!active) return null;

  return (
    <Reanimated.View
      entering={FadeInUp.delay(delay)
        .duration(420)
        .easing(Easing.bezier(0.16, 1, 0.28, 1))}
      style={s.valueVisualReveal}
    >
      {children}
    </Reanimated.View>
  );
}

function ValueDisciplineIllustration({ active }: { active: boolean }) {
  const bars = [0.44, 0.62, 0.55, 0.76, 0.84, 0.68, 0.90];
  return (
    <View style={s.valueIllustration}>
      <ValueVisualReveal active={active} delay={80}>
        <View style={s.valueDisciplineHero}>
          <View style={s.valueDisciplineHalo} />
          <Target s={42} c={GOLD} w={1.7} />
          <Text style={s.valueDisciplineHeroText}>Discipline</Text>
        </View>
      </ValueVisualReveal>
      <View style={s.valueDisciplineBars}>
        {bars.map((height, index) => (
          <ValueVisualReveal key={`discipline-bar-${index}`} active={active} delay={260 + index * 80}>
            <View style={s.valueDisciplineBarTrack}>
              <View style={[s.valueDisciplineBarFill, { height: `${height * 100}%` }]} />
            </View>
          </ValueVisualReveal>
        ))}
      </View>
      <View style={s.valueDisciplineCards}>
        <ValueVisualReveal active={active} delay={780}>
          <ValueMiniFeatureCard icon={<Sparkles s={18} c="#8B5CF6" w={1.8} />} label="Habit streak" />
        </ValueVisualReveal>
        <ValueVisualReveal active={active} delay={900}>
          <ValueMiniFeatureCard icon={<Clock s={18} c="#4D8586" w={1.9} />} label="Challenge timer" />
        </ValueVisualReveal>
        <ValueVisualReveal active={active} delay={1020}>
          <ValueMiniFeatureCard icon={<CheckSmall s={18} c={GOLD} w={2.4} />} label="Goals checked" />
        </ValueVisualReveal>
      </View>
    </View>
  );
}

const VALUE_FOCUS_FEATURE_CARDS = [
  {
    label: 'Control your screen time',
    tint: 'rgba(197,160,89,0.12)',
    border: 'rgba(197,160,89,0.26)',
    icon: <Hourglass s={20} c={GOLD} w={2} />,
  },
  {
    label: 'Block notifications',
    tint: 'rgba(77,133,134,0.12)',
    border: 'rgba(77,133,134,0.26)',
    icon: <BellRing s={20} c="#4D8586" w={2} />,
  },
  {
    label: 'Block addictive content',
    tint: 'rgba(143,93,108,0.12)',
    border: 'rgba(143,93,108,0.26)',
    icon: <SlidersHorizontal s={20} c="#8F5D6C" w={2} />,
  },
];

function ValueFocusFeatureCard({
  icon,
  label,
  tint,
  border,
}: {
  icon: React.ReactNode;
  label: string;
  tint: string;
  border: string;
}) {
  return (
    <View style={s.valueFocusFeatureCard}>
      <LinearGradient
        colors={['#FFFFFF', '#FFFCF4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.valueFocusFeatureIcon, { backgroundColor: tint, borderColor: border }]}>{icon}</View>
      <Text style={s.valueFocusFeatureText} numberOfLines={1}>{label}</Text>
      <View style={s.valueFocusFeatureCheck}>
        <CheckSmall s={12.5} c={GOLD} w={2.7} />
      </View>
    </View>
  );
}

function ValueFocusIllustration({ active }: { active: boolean }) {
  return (
    <View style={s.valueFocusVisual}>
      <View style={s.valueFocusTagsWrap}>
        <ProtectDistractionVisual enableHaptics={false} />
      </View>
      <View style={s.valueFocusCards}>
        {VALUE_FOCUS_FEATURE_CARDS.map((card, index) => (
          <ValueFocusCardReveal key={card.label} active={active} delay={340 + index * TRADITION_INTRO_TIMING.optionStep}>
            <ValueFocusFeatureCard icon={card.icon} label={card.label} tint={card.tint} border={card.border} />
          </ValueFocusCardReveal>
        ))}
      </View>
    </View>
  );
}

const FAITH_VALUE_FEATURES = [
  {
    title: 'Bible',
    body: 'The Word of God - always with you. Read, highlight, comment, and stay connected to Scripture every day.',
    image: FAITH_BIBLE_STICKER,
    tone: 'bible' as const,
  },
  {
    title: 'Prayer Book',
    body: 'Morning, evening, mealtime, and Jesus Prayer - always ready. Set reminders and build a personal prayer rule that fits your life.',
    image: FAITH_PRAYER_BOOK_STICKER,
    tone: 'prayer' as const,
  },
  {
    title: 'Bible Notes',
    body: 'Make what you read count - write down your Observations, the Lessons you take, and how you will apply them in your life.',
    image: FAITH_BIBLE_NOTES_STICKER,
    tone: 'notes' as const,
  },
  {
    title: 'Favorites',
    body: 'Give every color a meaning, and keep highlights and comments organized for easier learning.',
    icon: <BookMarked s={30} c={GOLD} w={1.8} />,
    tone: 'favorites' as const,
  },
] as const;

function ValueFaithFeatureRow({
  item,
  index,
  active,
  onLayout,
}: {
  item: (typeof FAITH_VALUE_FEATURES)[number];
  index: number;
  active: boolean;
  onLayout?: (index: number, y: number, height: number) => void;
}) {
  const reveal = useSharedValue(active ? 1 : 0);
  const [titleRuleWidth, setTitleRuleWidth] = useState(42);
  const delay = 260 + index * 270;

  useEffect(() => {
    reveal.value = 0;
    if (active) {
      reveal.value = withDelay(
        delay,
        withTiming(1, {
          duration: 760,
          easing: Easing.bezier(0.16, 1, 0.28, 1),
        }),
      );
    }
  }, [active, delay, reveal]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [0, 0.24, 1], [0, 1, 1]),
    transform: [
      { translateX: interpolate(reveal.value, [0, 0.74, 1], [index % 2 === 0 ? -24 : 24, index % 2 === 0 ? 2 : -2, 0]) },
      { translateY: interpolate(reveal.value, [0, 0.72, 1], [24, -2, 0]) },
    ],
  }));
  const toneStyle =
    item.tone === 'prayer' ? s.valueFaithArtPrayer :
    item.tone === 'notes' ? s.valueFaithArtNotes :
    item.tone === 'favorites' ? s.valueFaithArtFavorites :
    s.valueFaithArtBible;
  const accentStyle =
    item.tone === 'prayer' ? s.valueFaithAccentPrayer :
    item.tone === 'notes' ? s.valueFaithAccentNotes :
    item.tone === 'favorites' ? s.valueFaithAccentFavorites :
    s.valueFaithAccentBible;

  const reverse = index % 2 === 1;

  return (
    <Reanimated.View
      onLayout={event => {
        const { y, height } = event.nativeEvent.layout;
        onLayout?.(index, y, height);
      }}
      style={[s.valueFaithFeatureRow, reverse && s.valueFaithFeatureRowReverse, rowStyle]}
    >
      <View style={s.valueFaithArtSlot} />
      <View style={[s.valueFaithTextCard, reverse ? s.valueFaithTextCardReverse : s.valueFaithTextCardForward, toneStyle]}>
        <View pointerEvents="none" style={[s.valueFaithCardGlow, accentStyle]} />
        <View style={s.valueFaithTitleRow}>
          <View style={[s.valueFaithTitleMark, accentStyle]} />
          <Text
            style={s.valueFaithFeatureTitle}
            onTextLayout={event => {
              const lines = event.nativeEvent.lines;
              const titleWidth = Math.ceil((lines[lines.length - 1]?.width ?? 42) + 2);
              setTitleRuleWidth(current => (Math.abs(current - titleWidth) > 1 ? titleWidth : current));
            }}
          >
            {item.title}
          </Text>
        </View>
        <View style={[s.valueFaithFeatureRule, accentStyle, { width: titleRuleWidth }]} />
        <Text style={s.valueFaithFeatureBody}>{item.body}</Text>
      </View>
    </Reanimated.View>
  );
}

function ValueFaithFeatureArt({
  item,
  index,
  active,
  layout,
}: {
  item: (typeof FAITH_VALUE_FEATURES)[number];
  index: number;
  active: boolean;
  layout: { y: number; height: number };
}) {
  const reveal = useSharedValue(active ? 1 : 0);
  const float = useSharedValue(0);
  const delay = 260 + index * 270;
  const reverse = index % 2 === 1;
  const prayerArtStyle = item.tone === 'prayer' ? s.valueFaithArtPrayerFloat : null;

  useEffect(() => {
    reveal.value = 0;
    float.value = 0;
    if (active) {
      reveal.value = withDelay(
        delay,
        withTiming(1, {
          duration: 760,
          easing: Easing.bezier(0.16, 1, 0.28, 1),
        }),
      );
      float.value = withDelay(
        delay + 560,
        withRepeat(
          withTiming(1, {
            duration: 5200 + index * 340,
            easing: Easing.linear,
          }),
          -1,
          false,
        ),
      );
    }
  }, [active, delay, float, index, reveal]);

  const slotRevealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [0, 0.24, 1], [0, 1, 1]),
    transform: [
      { translateX: interpolate(reveal.value, [0, 0.74, 1], [index % 2 === 0 ? -24 : 24, index % 2 === 0 ? 2 : -2, 0]) },
      { translateY: interpolate(reveal.value, [0, 0.72, 1], [24, -2, 0]) },
    ],
  }));
  const artStyle = useAnimatedStyle(() => {
    const rawPhase = float.value * Math.PI * 2;
    const pacedPhase =
      rawPhase +
      Math.sin(rawPhase) * 0.34 +
      Math.sin(rawPhase * 2 + index * 0.9) * 0.08;
    const phase = pacedPhase + index * 0.72;
    const secondaryPhase = rawPhase * 2 + index * 0.48;
    return {
      transform: [
        { translateY: Math.sin(phase) * (6 + index * 0.35) + Math.cos(secondaryPhase) * 1.6 },
        { translateX: Math.cos(phase) * 3.4 + Math.sin(secondaryPhase) * 1.35 },
        { rotate: `${Math.sin(phase + 0.5) * (2 + index * 0.14) + Math.cos(secondaryPhase) * 0.55}deg` },
      ],
    };
  });

  const layer = 120 + FAITH_VALUE_FEATURES.length - index;

  return (
    <Reanimated.View
      style={[
        s.valueFaithArtSlot,
        s.valueFaithArtOverlaySlot,
        {
          top: layout.y + Math.max(0, (layout.height - 108) / 2),
          left: reverse ? undefined : 0,
          right: reverse ? 0 : undefined,
          zIndex: layer,
          elevation: layer,
        },
        slotRevealStyle,
      ]}
    >
      <Reanimated.View style={[s.valueFaithArtFloat, prayerArtStyle, artStyle]}>
        {'image' in item ? (
          <Image source={item.image} style={s.valueFaithSticker} resizeMode="contain" resizeMethod="scale" />
        ) : (
          <View style={[s.valueFaithFavoriteOrb, s.valueFaithFavoriteOrbDark]}>
            <Sparkles s={16} c="#F8E8BE" w={1.9} />
            {item.icon}
          </View>
        )}
      </Reanimated.View>
    </Reanimated.View>
  );
}

function ValueFaithIllustration({ active }: { active: boolean }) {
  const [rowLayouts, setRowLayouts] = useState<Record<number, { y: number; height: number }>>({});
  const storeRowLayout = useCallback((index: number, y: number, height: number) => {
    setRowLayouts(current => {
      const existing = current[index];
      if (existing && Math.abs(existing.y - y) < 1 && Math.abs(existing.height - height) < 1) return current;
      return { ...current, [index]: { y, height } };
    });
  }, []);

  return (
    <View style={s.valueFaithVisual}>
      <View style={s.valueFaithFeatureStack}>
        {FAITH_VALUE_FEATURES.map((item, index) => (
          <ValueFaithFeatureRow key={item.title} item={item} index={index} active={active} onLayout={storeRowLayout} />
        ))}
        <View pointerEvents="none" style={s.valueFaithArtOverlay}>
          {FAITH_VALUE_FEATURES.map((item, index) => {
            const layout = rowLayouts[index];
            return layout ? (
              <ValueFaithFeatureArt key={`faith-art-${item.title}`} item={item} index={index} active={active} layout={layout} />
            ) : null;
          })}
        </View>
      </View>
    </View>
  );
}

function ValueFeatureListVisual({ active, type }: { active: boolean; type: 'faith' | 'tools' }) {
  const isFaith = type === 'faith';
  const items = isFaith
    ? [
      { label: 'Bible reading', icon: <OpenBook s={19} c={GOLD} w={1.8} /> },
      { label: 'My Favorites', icon: <BookMarked s={19} c="#4D8586" w={1.8} /> },
      { label: 'Bible Notes', icon: <Feather s={19} c="#8F5D6C" w={1.8} /> },
      { label: 'Prayer Book', icon: <Candle s={19} c={GOLD} w={1.8} /> },
    ]
    : [
      { label: 'Journal', icon: <Feather s={19} c="#1C1917" w={1.8} /> },
      { label: 'Gratitude', icon: <Heart s={19} c="#E11D48" w={1.8} /> },
      { label: 'Reading List', icon: <OpenBook s={19} c="#4D8586" w={1.8} /> },
      { label: 'Pomodoro Timer', icon: <Clock s={19} c={GOLD} w={1.8} /> },
      { label: 'Notes', icon: <ListChecks s={19} c="#8F5D6C" w={1.8} /> },
      { label: 'Bucket List', icon: <Crown s={19} c="#1C1917" w={1.8} /> },
    ];

  return (
    <View style={s.valueFeatureVisual}>
      {isFaith ? (
        <ValueVisualReveal active={active} delay={90}>
          <View style={s.valueFreeBadge}>
            <Sparkles s={17} c={GOLD} w={1.9} />
            <Text style={s.valueFreeBadgeText}>Free for all</Text>
          </View>
        </ValueVisualReveal>
      ) : (
        <ValueVisualReveal active={active} delay={90}>
          <View style={s.valueGrowthOrb}>
            <View style={s.valueGrowthGlow} />
            <Candle s={44} c={GOLD} w={1.5} />
          </View>
        </ValueVisualReveal>
      )}
      <View style={s.valueFeatureChipList}>
        {items.map((item, index) => (
          <ValueVisualReveal key={item.label} active={active} delay={240 + index * 105}>
            <ValueFeatureChip icon={item.icon} label={item.label} />
          </ValueVisualReveal>
        ))}
      </View>
    </View>
  );
}

function ValueMiniFeatureCard({
  icon,
  label,
  compact,
}: {
  icon: React.ReactNode;
  label: string;
  compact?: boolean;
}) {
  return (
    <View style={[s.valueMiniFeatureCard, compact && s.valueMiniFeatureCardCompact]}>
      <View style={s.valueMiniFeatureIcon}>{icon}</View>
      <Text style={[s.valueMiniFeatureText, compact && s.valueMiniFeatureTextCompact]}>{label}</Text>
    </View>
  );
}

function ValueFeatureChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={s.valueFeatureChip}>
      <View style={s.valueFeatureChipIcon}>{icon}</View>
      <Text style={s.valueFeatureChipText}>{label}</Text>
    </View>
  );
}

function isOrganizeValueKind(kind: ValuePhoneKind) {
  return kind === 'organize';
}

function ValuePhoneContent({ kind, active, onCelebrate }: { kind: ValuePhoneKind; active: boolean; onCelebrate: () => void }) {
  if (kind === 'organize') {
    return <ValueOrganizePhone active={active} animated onCelebrate={onCelebrate} />;
  }
  if (kind === 'discipline') return <ValueDisciplinePhone />;
  if (kind === 'focus') return <ValueFocusPhone />;
  if (kind === 'faith') return <ValueFaithPhone />;
  return <ValueToolsPhone />;
}

function ValuePhoneMock({ kind, active }: { kind: ValuePhoneKind; active: boolean }) {
  const organizeConfettiRef = useRef<React.ElementRef<typeof LottieView>>(null);
  const organizeConfettiFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const organizePhoneIntroPlayed = useRef(false);
  const organizePhoneIntro = useSharedValue(isOrganizeValueKind(kind) && !active ? 0 : 1);
  const organizeConfettiReveal = useSharedValue(0);

  useEffect(() => {
    if (organizeConfettiFadeTimer.current) {
      clearTimeout(organizeConfettiFadeTimer.current);
      organizeConfettiFadeTimer.current = null;
    }

    if (!isOrganizeValueKind(kind)) {
      organizePhoneIntro.value = 1;
      organizeConfettiReveal.value = 0;
      return;
    }

    organizeConfettiReveal.value = 0;
    organizeConfettiRef.current?.reset();
    if (organizePhoneIntroPlayed.current) {
      organizePhoneIntro.value = 1;
      return;
    }

    organizePhoneIntro.value = 0;
    if (active) {
      organizePhoneIntroPlayed.current = true;
      organizePhoneIntro.value = withDelay(
        70,
        withTiming(1, {
          duration: 640,
          easing: Easing.out(Easing.cubic),
        }),
      );
    }

    return () => {
      if (organizeConfettiFadeTimer.current) {
        clearTimeout(organizeConfettiFadeTimer.current);
        organizeConfettiFadeTimer.current = null;
      }
    };
  }, [active, kind, organizeConfettiReveal, organizePhoneIntro]);

  const playOrganizeConfetti = useCallback(() => {
    if (organizeConfettiFadeTimer.current) {
      clearTimeout(organizeConfettiFadeTimer.current);
      organizeConfettiFadeTimer.current = null;
    }
    organizeConfettiReveal.value = withTiming(1, { duration: 210 });
    organizeConfettiRef.current?.reset();
    organizeConfettiRef.current?.play();
    organizeConfettiFadeTimer.current = setTimeout(() => {
      organizeConfettiReveal.value = withTiming(0, { duration: VALUE_ORGANIZE_CONFETTI_FADE_DURATION });
      organizeConfettiFadeTimer.current = null;
    }, VALUE_ORGANIZE_CONFETTI_FADE_DELAY);
  }, [organizeConfettiReveal]);

  const organizePhoneIntroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(organizePhoneIntro.value, [0, 0.18, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(organizePhoneIntro.value, [0, 0.86, 1], [90, -3, 0]) },
    ],
  }));
  const organizeConfettiRevealStyle = useAnimatedStyle(() => ({
    opacity: organizeConfettiReveal.value,
  }));

  return (
    <Reanimated.View style={[s.valuePhoneMotionShell, isOrganizeValueKind(kind) && organizePhoneIntroStyle]}>
      {isOrganizeValueKind(kind) ? (
        <Reanimated.View pointerEvents="none" style={[s.valueOrganizeConfettiLayer, organizeConfettiRevealStyle]}>
          <LottieView
            ref={organizeConfettiRef}
            source={CONFETTI_SOURCE}
            autoPlay={false}
            loop={false}
            speed={0.68}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
        </Reanimated.View>
      ) : null}
      <View style={s.valuePhoneOuter}>
        <View style={s.valuePhoneSideButtonLeft} />
        <View style={s.valuePhoneSideButtonRightTop} />
        <View style={s.valuePhoneSideButtonRightBottom} />
        <View style={s.valuePhoneBezel}>
          <View style={s.valuePhoneNotch}>
            <View style={s.valuePhoneSpeaker} />
            <View style={s.valuePhoneCamera} />
          </View>
          <View style={s.valuePhoneScreen}>
            <ValuePhoneContent kind={kind} active={active} onCelebrate={playOrganizeConfetti} />
          </View>
        </View>
      </View>
    </Reanimated.View>
  );
}

function ValuePhoneRow({
  icon,
  title,
  meta,
  tone = 'gold',
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  tone?: 'gold' | 'purple' | 'rose' | 'green' | 'ink';
}) {
  const toneStyle =
    tone === 'purple' ? s.valueTonePurple :
    tone === 'rose' ? s.valueToneRose :
    tone === 'green' ? s.valueToneGreen :
    tone === 'ink' ? s.valueToneInk :
    s.valueToneGold;

  return (
    <View style={s.valuePhoneRow}>
      <View style={[s.valuePhoneRowIcon, toneStyle]}>{icon}</View>
      <View style={s.valuePhoneRowCopy}>
        <Text style={s.valuePhoneRowTitle}>{title}</Text>
        <Text style={s.valuePhoneRowMeta}>{meta}</Text>
      </View>
      <View style={s.valuePhoneRowCheck} />
    </View>
  );
}

function ValuePhoneTaskCard({
  item,
  completed = false,
}: {
  item: TaskTypePreview;
  completed?: boolean;
}) {
  const task = completed ? { ...item.task, state: 'done' as const } : item.task;

  return (
    <View style={s.valueMiniTaskFrame}>
      <View style={s.valueMiniTaskScale}>
        <AnimatedTaskRow done={completed}>
          <View style={s.valuePhoneTaskInteractiveWrap}>
            <AnyTaskCard task={task} />
            <CompletionFlourish
              done={completed}
              color={item.task.habitColor ?? GOLD}
              layerStyle={s.valuePhoneTaskFlourishLayer}
            />
          </View>
        </AnimatedTaskRow>
      </View>
    </View>
  );
}

function ValueOrganizeReveal({
  active,
  animated,
  delay,
  duration = 330,
  children,
}: {
  active: boolean;
  animated: boolean;
  delay: number;
  duration?: number;
  children: React.ReactNode;
}) {
  const reveal = useSharedValue(animated && active ? 0 : 1);

  useEffect(() => {
    if (!animated) {
      reveal.value = 1;
      return;
    }

    reveal.value = 0;
    if (active) {
      reveal.value = withDelay(
        delay,
        withTiming(1, {
          duration,
          easing: Easing.out(Easing.cubic),
        }),
      );
    }
  }, [active, animated, delay, duration, reveal]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [0, 0.20, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(reveal.value, [0, 0.76, 1], [15, -1.5, 0]) },
    ],
  }));

  return <Reanimated.View style={[s.valueOrganizeReveal, revealStyle]}>{children}</Reanimated.View>;
}

const VALUE_ORGANIZE_TASK_REVEAL_BASE_DELAY = 650;
const VALUE_ORGANIZE_TASK_REVEAL_STEP_DELAY = 74;
const VALUE_ORGANIZE_TASK_REVEAL_DURATION = 230;
const VALUE_ORGANIZE_TASK_COUNT = 5;
const VALUE_ORGANIZE_CHECK_DELAY =
  VALUE_ORGANIZE_TASK_REVEAL_BASE_DELAY +
  (VALUE_ORGANIZE_TASK_COUNT - 1) * VALUE_ORGANIZE_TASK_REVEAL_STEP_DELAY +
  VALUE_ORGANIZE_TASK_REVEAL_DURATION;
const VALUE_ORGANIZE_CONFETTI_FADE_DELAY = 2800;
const VALUE_ORGANIZE_CONFETTI_FADE_DURATION = 920;

function ValueProtectStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.valueProtectStat}>
      <View style={s.valueProtectStatGlow} />
      <Text style={s.valueProtectStatValue}>{value}</Text>
      <Text style={s.valueProtectStatLabel}>{label}</Text>
    </View>
  );
}

function ValueProtectHourTicks() {
  return (
    <View style={s.valueProtectHourGrid}>
      {Array.from({ length: 16 }).map((_, index) => (
        <View
          key={`protect-hour-${index}`}
          style={[s.valueProtectHourTick, index < 7 && s.valueProtectHourTickActive]}
        />
      ))}
    </View>
  );
}

function ValueProtectBlockerPill({ label, tone }: { label: string; tone: 'rose' | 'purple' | 'gold' | 'ink' }) {
  return (
    <View style={[
      s.valueProtectBlockerPill,
      tone === 'rose' && s.valueProtectBlockerPillRose,
      tone === 'purple' && s.valueProtectBlockerPillPurple,
      tone === 'gold' && s.valueProtectBlockerPillGold,
      tone === 'ink' && s.valueProtectBlockerPillInk,
    ]}>
      <View style={[
        s.valueProtectBlockerDot,
        tone === 'rose' && s.valueProtectBlockerDotRose,
        tone === 'purple' && s.valueProtectBlockerDotPurple,
        tone === 'gold' && s.valueProtectBlockerDotGold,
        tone === 'ink' && s.valueProtectBlockerDotInk,
      ]} />
      <Text style={s.valueProtectBlockerText}>{label}</Text>
    </View>
  );
}

function ValueProtectPhone() {
  return (
    <View style={s.valueProtectPhone}>
      <View style={s.valueProtectMetricCard}>
        <LinearGradient
          colors={['#FFFDF8', '#FFF6E8', '#F8EEDC']}
          locations={[0, 0.54, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.valueProtectMetricTop}>
          <Hourglass s={15} c={GOLD} w={1.9} />
          <Text style={s.valueProtectMetricEyebrow}>Average Gen Z phone time</Text>
        </View>
        <View style={s.valueProtectMetricRow}>
          <Text style={s.valueProtectMetric}>7<Text style={s.valueProtectMetricSuffix}>h</Text></Text>
          <View style={s.valueProtectMetricCopy}>
            <Text style={s.valueProtectMetricUnit}>every day</Text>
            <Text style={s.valueProtectMetricSub}>of 16h usable time</Text>
          </View>
        </View>
        <View style={s.valueProtectTickPanel}>
          <ValueProtectHourTicks />
          <View style={s.valueProtectTickLegend}>
            <Text style={s.valueProtectTickLegendActive}>7 phone hours</Text>
            <Text style={s.valueProtectTickLegendMuted}>9 usable hours left</Text>
          </View>
        </View>
      </View>

      <View style={s.valueProtectStatGrid}>
        <ValueProtectStat value="43%" label="of usable time" />
        <ValueProtectStat value="106" label="days every year" />
      </View>

      <View style={s.valueProtectLifetimeCard}>
        <Text style={s.valueProtectLifetimeLabel}>On average</Text>
        <Text style={s.valueProtectLifetimeValue}>25 years</Text>
        <Text style={s.valueProtectLifetimeText}>over an 85-year life.</Text>
      </View>

      <View style={s.valueProtectBlockerCard}>
        <View style={s.valueProtectBlockerTop}>
          <SlidersHorizontal s={14} c={GOLD} w={2} />
          <Text style={s.valueProtectBlockerTitle}>Block addictive websites and apps</Text>
        </View>
        <View style={s.valueProtectBlockerGrid}>
          <ValueProtectBlockerPill label="Adult content" tone="ink" />
          <ValueProtectBlockerPill label="Gambling" tone="rose" />
          <ValueProtectBlockerPill label="Gaming" tone="purple" />
          <ValueProtectBlockerPill label="Others" tone="gold" />
        </View>
      </View>
    </View>
  );
}

function ValueOrganizePhone({
  active = true,
  animated = false,
  onCelebrate,
}: {
  active?: boolean;
  animated?: boolean;
  onCelebrate?: () => void;
}) {
  const [completedHabit, setCompletedHabit] = useState(false);
  const [hasPlayedIntro, setHasPlayedIntro] = useState(false);
  const shouldAnimateTasks = animated && !hasPlayedIntro;
  const taskContentActive = active || hasPlayedIntro;

  useEffect(() => {
    if (!animated) {
      setCompletedHabit(false);
      return undefined;
    }

    if (hasPlayedIntro) {
      setCompletedHabit(true);
      return undefined;
    }
    if (!active) return undefined;

    setCompletedHabit(false);
    preloadTaskFeedbackSound();
    const checkTimer = setTimeout(() => {
      setCompletedHabit(true);
      setHasPlayedIntro(true);
      onCelebrate?.();
      playTaskCheckSoundOnly();
      runPreviewTaskCheckHaptic();
    }, VALUE_ORGANIZE_CHECK_DELAY);

    return () => {
      clearTimeout(checkTimer);
    };
  }, [active, animated, hasPlayedIntro, onCelebrate]);

  const days = [
    { day: 'Tue', date: '19' },
    { day: 'Wed', date: '20' },
    { day: 'Thu', date: '21' },
    { day: 'Fri', date: '22', active: true },
    { day: 'Sat', date: '23' },
    { day: 'Sun', date: '24' },
    { day: 'Mon', date: '25' },
  ];
  const taskPreviewItems = [
    TASK_TYPES.find(item => item.key === 'habit') ?? TASK_TYPES[0],
    TASK_TYPES.find(item => item.key === 'spiritual') ?? TASK_TYPES[2],
    TASK_TYPES.find(item => item.key === 'routine') ?? TASK_TYPES[1],
    TASK_TYPES.find(item => item.key === 'challenge') ?? TASK_TYPES[3],
    TASK_TYPES.find(item => item.key === 'reading') ?? TASK_TYPES[5],
  ];

  return (
    <View style={s.valueHomeScreen}>
      <View pointerEvents="none" style={s.valueHomeScreenPaper} />
      <View style={s.valueMonthHeader}>
        <View style={s.valueHomeIconButton}>
          <User s={11.5} c={INK} w={2} />
        </View>
        <View style={s.valueMonthCenter}>
          <View style={s.valueMonthNavRow}>
            <ChevronLeft s={12} c="rgba(25,23,20,0.46)" w={2.2} />
            <Text style={s.valueMonthTitle}>May</Text>
            <ChevronRight s={12} c="rgba(25,23,20,0.46)" w={2.2} />
          </View>
          <Text style={s.valueMonthYear}>2026</Text>
        </View>
        <View style={s.valueHomeIconButton}>
          <Settings s={11.5} c={INK} w={2} />
        </View>
      </View>

      <View style={s.valueDateRail}>
        {days.map((item, dayIndex) => {
          const active = !!item.active;
          return (
            <View key={`${item.day}-${dayIndex}`} style={[s.valueDatePill, active && s.valueDatePillActive]}>
              {active ? (
                <View pointerEvents="none" style={s.valueDateSelectedFillWrap}>
                  <LinearGradient
                    colors={['#E2BD75', '#C5A059', '#A87E33']}
                    locations={[0, 0.55, 1]}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.85, y: 1 }}
                    style={s.valueDateSelectedFill}
                  />
                  <View pointerEvents="none" style={s.valueDateSelectedSheen} />
                  <View pointerEvents="none" style={s.valueDateSelectedRim} />
                </View>
              ) : null}
              <Text style={[s.valueDateDay, active && s.valueDateDayActive]}>{item.day}</Text>
              <Text style={[s.valueDateNumber, active && s.valueDateNumberActive]}>{item.date}</Text>
            </View>
          );
        })}
      </View>

      <View style={s.valueVerseBlock}>
        <Text style={s.valueVerseText}>
          {'"Awake thou that sleepest, and '}
          <Text style={s.valueVerseUnderline}>arise</Text>{' '}
          <Text style={s.valueVerseGold}>(anasta)</Text>
          {' from the dead, and Christ shall give thee light."'}
        </Text>
        <Text style={s.valueVerseRef}>EPHESIANS 5:14</Text>
      </View>

      <View style={s.valueBigEventsHead}>
        <Text style={s.valueBigEventsHeading}>Big Upcoming Events</Text>
        <Text style={s.valueBigEventsSub}>1 active</Text>
      </View>
      <ValueOrganizeReveal active={active} animated={animated} delay={460}>
        <View style={[s.valueBigEventCard, { backgroundColor: '#FFFFFF' }]}>
          <View style={s.valueBigEventIconBox}>
            <NotoEmoji name={normalizeHabitIcon('birthday-cake')} size={13} />
          </View>
          <View style={s.valueBigEventCopy}>
            <Text style={s.valueBigEventTitle} numberOfLines={1}>Family birthday</Text>
          </View>
          <View style={s.valueBigEventCount}>
            <Text style={s.valueBigEventCountNum}>7</Text>
            <Text style={s.valueBigEventCountLabel}>days</Text>
          </View>
        </View>
      </ValueOrganizeReveal>

      <View style={s.valueTasksHeader}>
        <View>
          <Text style={s.valueHomeSectionTitle}>Today&apos;s Tasks</Text>
          <Text style={s.valueHomeSectionMeta}>5 active today</Text>
        </View>
        <View style={s.valueTasksProgressWrap}>
          <View style={s.valueTasksProgressTrack}>
            <View style={[s.valueTasksProgressFill, { width: completedHabit ? '20%' : '0%' }]} />
          </View>
          <Text style={s.valueTasksProgressText}>{completedHabit ? '1/5' : '0/5'}</Text>
        </View>
      </View>

      <View style={s.valueHomeTaskStack}>
        {taskPreviewItems.map((item, itemIndex) => (
          <ValueOrganizeReveal
            key={item.key}
            active={taskContentActive}
            animated={shouldAnimateTasks}
            delay={VALUE_ORGANIZE_TASK_REVEAL_BASE_DELAY + itemIndex * VALUE_ORGANIZE_TASK_REVEAL_STEP_DELAY}
            duration={VALUE_ORGANIZE_TASK_REVEAL_DURATION}
          >
            <ValuePhoneTaskCard
              item={item}
              completed={itemIndex === 0 && completedHabit}
            />
          </ValueOrganizeReveal>
        ))}
      </View>

      <ValueOrganizeReveal
        active={taskContentActive}
        animated={shouldAnimateTasks}
        delay={VALUE_ORGANIZE_TASK_REVEAL_BASE_DELAY + taskPreviewItems.length * VALUE_ORGANIZE_TASK_REVEAL_STEP_DELAY}
        duration={VALUE_ORGANIZE_TASK_REVEAL_DURATION}
      >
        <View style={s.valueHomeAddBtn}>
          <Plus s={10} c="#1C1917" w={2.5} />
          <Text style={s.valueHomeAddBtnText}>ADD QUICK TASK</Text>
        </View>
      </ValueOrganizeReveal>

      <ValueOrganizeReveal
        active={taskContentActive}
        animated={shouldAnimateTasks}
        delay={VALUE_ORGANIZE_TASK_REVEAL_BASE_DELAY + (taskPreviewItems.length + 1) * VALUE_ORGANIZE_TASK_REVEAL_STEP_DELAY}
        duration={VALUE_ORGANIZE_TASK_REVEAL_DURATION}
      >
        <LinearGradient
          colors={['#FFFFFF', '#FDF3D8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.valueHomeRoutineCard}
        >
          <View pointerEvents="none" style={s.valueHomeRoutineWatermark}>
            <Settings s={64} c="#C5A059" w={1} />
          </View>
          <View style={s.valueHomeRoutineCopy}>
            <Text style={s.valueHomeRoutineLabel}>FOUNDATION</Text>
            <Text style={s.valueHomeRoutineTitle}>My Routine</Text>
            <Text style={s.valueHomeRoutineSub}>Establish your rhythm</Text>
          </View>
          <View style={s.valueHomeRoutineArrow}>
            <ArrowUpRight s={11} c="#FFFFFF" w={2.5} />
          </View>
        </LinearGradient>
      </ValueOrganizeReveal>
    </View>
  );
}

function ValueRisePhone() {
  return (
    <View style={s.valuePhoneContent}>
      <Text style={s.valuePhoneHeading}>Rise again</Text>
      <View style={s.valueScriptureCard}>
        <Text style={s.valueScriptureRef}>EPHESIANS 5:14</Text>
        <Text style={s.valueScriptureText}>Awake thou that sleepest, and arise...</Text>
      </View>
      <ValuePhoneRow icon={<Candle s={15} c={GOLD} w={1.8} />} title="Prayer Book" meta="Morning & evening" />
      <ValuePhoneRow icon={<OpenBook s={15} c="#A8853C" w={1.9} />} title="Bible Reading" meta="Saved passages" />
      <ValuePhoneRow icon={<Feather s={15} c="#1C1917" w={1.8} />} title="Journal" meta="Notice and return" tone="ink" />
    </View>
  );
}

function ValueDisciplinePhone() {
  return (
    <View style={s.valuePhoneContent}>
      <Text style={s.valuePhoneHeading}>Weekly rhythm</Text>
      <View style={s.valueWeekBars}>
        {[0.42, 0.64, 0.52, 0.78, 0.7, 0.46, 0.58].map((height, index) => (
          <View key={index} style={s.valueWeekBarTrack}>
            <View style={[s.valueWeekBarFill, { height: `${height * 100}%` }]} />
          </View>
        ))}
      </View>
      <ValuePhoneRow icon={<Sparkles s={15} c="#8B5CF6" w={1.9} />} title="Habit task" meta="4 day streak" tone="purple" />
      <ValuePhoneRow icon={<Feather s={15} c="#1C1917" w={1.9} />} title="Routine task" meta="Every morning" tone="ink" />
    </View>
  );
}

function ValueFocusPhone() {
  return (
    <View style={s.valuePhoneContent}>
      <Text style={s.valuePhoneHeading}>Focus guard</Text>
      <View style={s.valueFocusTimer}>
        <Text style={s.valueFocusTime}>25:00</Text>
        <Text style={s.valueFocusLabel}>Deep work session</Text>
      </View>
      <ValuePhoneRow icon={<Target s={15} c="#16A34A" w={2} />} title="Focus mode" meta="Do not disturb" tone="green" />
      <ValuePhoneRow icon={<BellRing s={15} c="#DC2626" w={2} />} title="Distractions blocked" meta="Social apps & sites" tone="rose" />
    </View>
  );
}

function ValueFaithPhone() {
  return (
    <View style={s.valuePhoneContent}>
      <Text style={s.valuePhoneHeading}>Scripture</Text>
      <View style={s.valueScriptureCard}>
        <Text style={s.valueScriptureRef}>EPHESIANS 5:14</Text>
        <Text style={s.valueScriptureText}>Awake thou that sleepest, and arise...</Text>
      </View>
      <ValuePhoneRow icon={<Candle s={15} c={GOLD} w={1.8} />} title="Prayer book" meta="Morning & evening" />
      <ValuePhoneRow icon={<Feather s={15} c="#A8853C" w={1.8} />} title="Bible notes" meta="Saved thought" />
    </View>
  );
}

function ValueToolsPhone() {
  return (
    <View style={s.valuePhoneContent}>
      <Text style={s.valuePhoneHeading}>Inner work</Text>
      <View style={s.valueJournalCard}>
        <Text style={s.valueJournalLabel}>Morning pages</Text>
        <Text style={s.valueJournalText}>What needs to be named before the day begins?</Text>
      </View>
      <ValuePhoneRow icon={<Heart s={15} c="#E11D48" w={1.8} />} title="Gratitude" meta="3 blessings" tone="rose" />
      <ValuePhoneRow icon={<Crown s={15} c="#1C1917" w={1.8} />} title="Progress review" meta="Notice patterns" tone="ink" />
    </View>
  );
}

function AutoMessageSlide({
  bottomInset,
  displayName,
  onNext,
}: {
  bottomInset: number;
  displayName?: string;
  onNext: () => void;
}) {
  const name = nameForDisplay(displayName);
  const messageSegments = useMemo<TypedTextSegment[]>(() => [
    { text: name ? `${name}, before we start,\nI have ` : 'Before we start,\nI have ' },
    { text: '4 quick questions', highlight: true },
    { text: '.' },
  ], [name]);
  const message = useMemo(() => joinTypedSegments(messageSegments), [messageSegments]);
  const [typedCount, setTypedCount] = useState(0);
  const advancedRef = useRef(false);

  const advance = useCallback(() => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    runAdvanceHaptic();
    onNext();
  }, [onNext]);

  useEffect(() => {
    advancedRef.current = false;
    setTypedCount(0);
    let interval: ReturnType<typeof setInterval> | undefined;
    let advanceTimer: ReturnType<typeof setTimeout> | undefined;

    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        setTypedCount(prev => {
          if (prev >= message.length) {
            if (interval) clearInterval(interval);
            advanceTimer = setTimeout(advance, 3100);
            return prev;
          }
          const next = prev + 1;
          if (next % 3 === 0) runTypingHaptic();
          return next;
        });
      }, 33);
    }, 900);
    const bubbleHapticTimer = setTimeout(runBubbleHaptic, 560);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(bubbleHapticTimer);
      if (interval) clearInterval(interval);
      if (advanceTimer) clearTimeout(advanceTimer);
    };
  }, [advance, message]);

  return (
    <View style={s.messageSlide}>
      <View pointerEvents="none" style={s.messageWarmth}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,247,232,0.58)', 'rgba(217,185,142,0.22)']}
          locations={[0, 0.48, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={s.messageContent}>
        <Reanimated.View
          entering={FadeIn.duration(760).withInitialValues({
            opacity: 0,
            transform: [{ translateY: 20 }, { scale: 0.94 }],
          })}
          style={s.messageLogoFrame}
        >
          <View style={s.messageLogoHalo} />
          <View style={s.messageLogoPlate}>
            <Image source={APP_LOGO} style={s.messageLogo} resizeMode="cover" />
          </View>
        </Reanimated.View>

        <Reanimated.View
          entering={FadeIn.delay(560).duration(620).withInitialValues({
            opacity: 0,
            transform: [{ translateY: 18 }, { scale: 0.965 }],
          })}
          style={s.messageBubble}
        >
          <View style={s.messageBubbleTail} />
          <TypedSegmentText
            segments={messageSegments}
            count={typedCount}
            textStyle={s.messageText}
            highlightStyle={s.inlineGoldUnderline}
            caretStyle={s.nameTypingCaret}
          />
        </Reanimated.View>
      </View>

      <AnimatedCta delay={900} style={[s.bottomAction, s.introBottomAction, { paddingBottom: bottomInset + 8 }]}>
        <View style={s.ctaIsland}>
          <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={advance} style={s.primaryButton}>
            <Text style={s.primaryButtonText}>OK</Text>
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
  ctaDelay = 220,
  ctaDuration = 620,
  ctaDistance = 24,
  scrollDelay = 210,
  scrollSignal,
  autoScrollOnContentChange = false,
  ctaVisible = true,
}: {
  children: React.ReactNode;
  onNext: () => void;
  ctaLabel?: string;
  ctaDelay?: number;
  ctaDuration?: number;
  ctaDistance?: number;
  scrollDelay?: number;
  scrollSignal?: unknown;
  autoScrollOnContentChange?: boolean;
  ctaVisible?: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const scheduleScrollToEnd = useCallback(() => {
    return setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, scrollDelay);
  }, [scrollDelay]);
  const handleContentSizeChange = useCallback(() => {
    if (!autoScrollOnContentChange) return;
    scheduleScrollToEnd();
  }, [autoScrollOnContentChange, scheduleScrollToEnd]);

  useEffect(() => {
    if (scrollSignal === undefined) return undefined;
    const timer = scheduleScrollToEnd();
    return () => clearTimeout(timer);
  }, [scrollSignal, scheduleScrollToEnd]);

  return (
    <View style={s.setupSlide}>
      <ScrollView
        ref={scrollRef}
        style={s.setupScroll}
        contentContainerStyle={s.guidedScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={autoScrollOnContentChange ? handleContentSizeChange : undefined}
      >
        {children}
      </ScrollView>

      <AnimatedCta
        active={ctaVisible}
        delay={ctaDelay}
        duration={ctaDuration}
        distance={ctaDistance}
        pointerEvents={ctaVisible ? 'auto' : 'none'}
        style={s.questionFooter}
      >
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
          <AnyTaskCard task={item.task} />
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
          <AnyTaskCard task={habitPreview.task} />
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

const SCREEN_TIME_MIN_HOURS = 4.5;
const SCREEN_TIME_MAX_HOURS = 10;
const DEFAULT_SCREEN_TIME_HOURS = 7;
const USABLE_DAY_HOURS = 16;
const SLEEP_HOURS_PER_DAY = 8;
const DAY_HOURS = 24;
const PROTECT_LIFESPAN_YEARS = 85;

function clampNumber(value: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

function roundToHalfHour(value: number) {
  'worklet';
  return Math.round(value * 2) / 2;
}

function formatHourValue(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function formatYearValue(years: number) {
  return Number.isInteger(years) ? String(years) : years.toFixed(1);
}

function protectStats(screenTimeHours?: number) {
  const hours = clampNumber(screenTimeHours ?? DEFAULT_SCREEN_TIME_HOURS, SCREEN_TIME_MIN_HOURS, SCREEN_TIME_MAX_HOURS);
  const usablePercent = Math.round((hours / USABLE_DAY_HOURS) * 100);
  const yearlyDays = Math.round((hours * 365) / 24);
  const lifetimeYears = Number(((hours * PROTECT_LIFESPAN_YEARS) / 24).toFixed(1));
  const reclaimedDays = Math.round(yearlyDays * 0.4);
  const reclaimedYears = Number((lifetimeYears * 0.4).toFixed(1));
  return { hours, usablePercent, yearlyDays, lifetimeYears, reclaimedDays, reclaimedYears };
}

function screenTimeDayParts(stat: ReturnType<typeof protectStats>) {
  const sleep = SLEEP_HOURS_PER_DAY;
  const phone = Math.max(1, Math.min(DAY_HOURS - sleep, Math.round(stat.hours)));
  const awake = Math.max(0, DAY_HOURS - sleep - phone);
  return { sleep, phone, awake };
}

function screenTimeYearParts(stat: ReturnType<typeof protectStats>) {
  const sleep = Math.round((SLEEP_HOURS_PER_DAY * 365) / DAY_HOURS);
  const phone = Math.max(0, Math.min(365 - sleep, stat.yearlyDays));
  const awake = Math.max(0, 365 - sleep - phone);
  return { sleep, phone, awake };
}

function screenTimeLifetimeParts(stat: ReturnType<typeof protectStats>) {
  const sleep = Math.round((SLEEP_HOURS_PER_DAY * PROTECT_LIFESPAN_YEARS) / DAY_HOURS);
  const phone = Math.max(0, Math.min(PROTECT_LIFESPAN_YEARS - sleep, Math.round(stat.lifetimeYears)));
  const awake = Math.max(0, PROTECT_LIFESPAN_YEARS - sleep - phone);
  return { sleep, phone, awake };
}

type PromptSegment = { text: string; highlight?: boolean; gold?: boolean };

function ProtectPromptText({ segments }: { segments: PromptSegment[] }) {
  return (
    <Text style={[s.speechQuestion, s.protectSpeechQuestion]}>
      {segments.map((segment, index) => (
        <Text
          key={`${segment.text}-${index}`}
          style={[
            segment.highlight ? s.protectSpeechHighlight : undefined,
            segment.gold ? s.protectSpeechGoldHighlight : undefined,
          ]}
        >
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}

function ProtectSidePrompt({
  segments,
  motionKey,
  compact = false,
  delay = 0,
}: {
  segments: PromptSegment[];
  motionKey?: string;
  compact?: boolean;
  delay?: number;
}) {
  const mascotIntro = useSharedValue(0);
  const bubbleIntro = useSharedValue(0);

  useEffect(() => {
    mascotIntro.value = 0;
    bubbleIntro.value = 0;
    const mascotTimer = setTimeout(() => {
      mascotIntro.value = withTiming(1, {
        duration: 860,
        easing: Easing.out(Easing.cubic),
      });
    }, delay);
    const bubbleTimer = setTimeout(() => {
      runBubbleHaptic();
      bubbleIntro.value = withTiming(1, {
        duration: 620,
        easing: Easing.out(Easing.cubic),
      });
    }, delay + 680);
    return () => {
      clearTimeout(mascotTimer);
      clearTimeout(bubbleTimer);
    };
  }, [bubbleIntro, delay, mascotIntro, motionKey]);

  const mascotMotionStyle = useAnimatedStyle(() => {
    const intro = mascotIntro.value;
    return {
      opacity: interpolate(intro, [0, 0.28, 1], [0, 1, 1]),
      transform: [
        { translateX: interpolate(intro, [0, 1], [-34, 0]) },
        { translateY: interpolate(intro, [0, 0.72, 1], [2, 0, 0]) },
        { rotate: `${interpolate(intro, [0, 0.7, 1], [-3, 0.75, 0])}deg` },
        { scale: interpolate(intro, [0, 0.78, 1], [0.96, 1.015, 1]) },
      ],
    };
  });
  const mascotHaloStyle = useAnimatedStyle(() => {
    const intro = mascotIntro.value;
    return {
      opacity: interpolate(intro, [0, 0.38, 1], [0, 0.9, 1]),
      transform: [
        { rotate: `${interpolate(intro, [0, 1], [4, 12])}deg` },
        { scale: interpolate(intro, [0, 0.72, 1], [0.86, 1.04, 1]) },
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
    <Reanimated.View entering={FadeIn.duration(320)} style={s.protectPrompt}>
      <View style={s.promptRow}>
        <Reanimated.View style={mascotMotionStyle}>
          <View style={s.mascotShell}>
            <Reanimated.View style={[s.mascotHalo, mascotHaloStyle]} />
            <Image source={APP_LOGO} style={s.mascotLogo} resizeMode="cover" />
          </View>
        </Reanimated.View>
        <Reanimated.View style={[s.speechBubble, s.protectSpeechBubble, compact && s.protectSpeechBubbleCompact, speechBubbleIntroStyle]}>
          <View style={[s.speechTail, compact && s.speechTailCompact]} />
          <View style={[s.speechTailJoin, compact && s.speechTailJoinCompact]} />
          <Reanimated.View key={motionKey ?? segments.map(segment => segment.text).join('')} entering={FadeIn.delay(120).duration(340)}>
            <ProtectPromptText segments={segments} />
          </Reanimated.View>
        </Reanimated.View>
      </View>
    </Reanimated.View>
  );
}

function ProtectTypingBubble({
  message,
  delay = 360,
  intervalMs = 24,
  bubbleStyle,
  textStyle,
}: {
  message: string;
  delay?: number;
  intervalMs?: number;
  bubbleStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const [typedCount, setTypedCount] = useState(0);
  const typedMessage = message.slice(0, typedCount);

  useEffect(() => {
    setTypedCount(0);
    let interval: ReturnType<typeof setInterval> | undefined;
    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        setTypedCount(prev => {
          if (prev >= message.length) {
            if (interval) clearInterval(interval);
            return prev;
          }
          const next = prev + 1;
          if (next % 3 === 0) runTypingHaptic();
          return next;
        });
      }, intervalMs);
    }, delay);
    const bubbleHapticTimer = setTimeout(runBubbleHaptic, Math.max(0, delay - 120));

    return () => {
      clearTimeout(startTimer);
      clearTimeout(bubbleHapticTimer);
      if (interval) clearInterval(interval);
    };
  }, [delay, intervalMs, message]);

  return (
    <Reanimated.View
      entering={FadeIn.delay(Math.max(0, delay - 120)).duration(520).withInitialValues({
        opacity: 0,
        transform: [{ translateY: 16 }, { scale: 0.965 }],
      })}
      style={[s.protectCoachBubble, bubbleStyle]}
    >
      <View style={s.protectCoachBubbleTail} />
      <Text style={[s.protectCoachText, textStyle]}>
        {typedMessage}
        {typedCount < message.length ? <Text style={s.nameTypingCaret}>|</Text> : null}
      </Text>
    </Reanimated.View>
  );
}

function ProtectCoachMark({ delay = 0, compact = false }: { delay?: number; compact?: boolean }) {
  return (
    <Reanimated.View
      entering={FadeIn.delay(delay).duration(560).withInitialValues({
        opacity: 0,
        transform: [{ translateY: 18 }, { scale: 0.92 }],
      })}
      style={[s.protectCoachLogoFrame, compact && s.protectCoachLogoFrameCompact]}
    >
      <View style={s.protectCoachLogoHalo} />
      <View style={[s.protectCoachLogoPlate, compact && s.protectCoachLogoPlateCompact]}>
        <Image source={APP_LOGO} style={s.protectCoachLogo} resizeMode="cover" />
      </View>
    </Reanimated.View>
  );
}

function ProtectStrikeText({
  text,
  done,
  textStyle,
  lineColor = 'rgba(197,160,89,0.62)',
}: {
  text: string;
  done: boolean;
  textStyle?: StyleProp<TextStyle>;
  lineColor?: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(done ? 1 : 0, {
      duration: done ? 980 : 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [done, progress]);

  const lineStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    opacity: progress.value,
  }));
  const textFadeStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * 0.36,
  }));

  return (
    <View style={s.protectStrikeWrap}>
      <Reanimated.Text numberOfLines={1} style={[textStyle, textFadeStyle]}>
        {text}
      </Reanimated.Text>
      <Reanimated.View pointerEvents="none" style={[s.protectStrikeLine, { backgroundColor: lineColor }, lineStyle]} />
    </View>
  );
}

function ProtectGuardrailItem({
  index,
  title,
  body,
  done,
  icon,
}: {
  index: number;
  title: string;
  body: string;
  done: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Reanimated.View
      entering={optionEntrance(index, 170)}
      style={[s.protectGuardrailItem, done && s.protectGuardrailItemDone]}
    >
      <View style={[s.protectGuardrailIcon, done && s.protectGuardrailIconDone]}>
        {done ? <CheckSmall s={15} c="#FFFFFF" w={2.8} /> : icon}
      </View>
      <View style={s.protectGuardrailCopy}>
        <ProtectStrikeText text={title} done={done} textStyle={s.protectGuardrailTitle} />
        <Text style={[s.protectGuardrailBody, done && s.protectGuardrailBodyDone]}>{body}</Text>
      </View>
    </Reanimated.View>
  );
}

const PROTECT_GUARDRAILS = [
  {
    title: 'Block addictive apps',
    body: 'Put the loudest loops behind a real boundary.',
    icon: <SlidersHorizontal s={17} c={GOLD} w={1.9} />,
  },
  {
    title: 'Block harmful websites',
    body: 'Keep weak moments far from the first tap.',
    icon: <Target s={17} c={GOLD} w={1.9} />,
  },
  {
    title: 'Quiet interruptions',
    body: 'Protect the hours you want to use well.',
    icon: <BellRing s={17} c={GOLD} w={1.9} />,
  },
] as const;

const PROTECT_INTRO_VISUAL_DELAY_MS = 220;
const DISTRACTION_SEQUENCE_COMPLETE_MS = 2850;

function ProtectIntroSlide({ onNext }: { onNext: () => void }) {
  const [reveal, setReveal] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => {
        runSelectionHaptic();
        setReveal(1);
      }, 120),
      setTimeout(() => setReveal(2), 1650),
      setTimeout(() => setReveal(3), 3150),
    ];
    return () => timers.forEach(timer => clearTimeout(timer));
  }, []);

  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Let's start" ctaVisible={reveal >= 3}>
      <View style={s.protectIntroPromptOnly}>
        <View style={s.protectIntroPromptSlot}>
          {reveal >= 2 ? (
            <ProtectSidePrompt
              motionKey="protect-intro"
              segments={[
                { text: "Let's start with " },
                { text: 'protecting your time', highlight: true },
                { text: '.' },
              ]}
            />
          ) : null}
        </View>

        {reveal >= 1 ? (
          <Reanimated.View
            pointerEvents="none"
            entering={FadeIn.duration(820).withInitialValues({
              opacity: 0,
              transform: [{ translateY: 20 }, { scale: 0.9 }],
            })}
            style={s.protectIntroVisual}
          >
            <ProtectDistractionVisual />
          </Reanimated.View>
        ) : null}
      </View>
    </GuidedSetupShell>
  );
}

function ProtectGuardrailChecklist({ animate = false }: { animate?: boolean }) {
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    if (!animate) {
      setCompletedCount(PROTECT_GUARDRAILS.length);
      return undefined;
    }
    const timers = [
      setTimeout(() => setCompletedCount(1), 520),
      setTimeout(() => setCompletedCount(2), 1040),
      setTimeout(() => setCompletedCount(3), 1560),
    ];
    return () => timers.forEach(timer => clearTimeout(timer));
  }, [animate]);
  return (
    <View style={s.protectGuardrailList}>
      {PROTECT_GUARDRAILS.map((item, index) => (
        <ProtectGuardrailItem
          key={item.title}
          index={index}
          title={item.title}
          body={item.body}
          icon={item.icon}
          done={completedCount > index}
        />
      ))}
    </View>
  );
}

function ProtectPathItem({ index, title, active }: { index: number; title: string; active?: boolean }) {
  return (
    <View style={[s.protectPathItem, active && s.protectPathItemActive]}>
      <View style={[s.protectPathNumber, active && s.protectPathNumberActive]}>
        <Text style={[s.protectPathNumberText, active && s.protectPathNumberTextActive]}>{index}</Text>
      </View>
      <Text style={[s.protectPathText, active && s.protectPathTextActive]}>{title}</Text>
    </View>
  );
}

const DISTRACTION_CARDS = [
  {
    label: 'Social media',
    icon: <Sparkles s={15} c="#5B8A75" w={1.9} />,
    style: 'social',
    tone: '#EAF4ED',
    startX: -34,
    startRotate: '-18deg',
  },
  {
    label: 'Notifications',
    icon: <BellRing s={15} c="#9B6C2C" w={1.9} />,
    style: 'notifications',
    tone: '#FFF3D8',
    startX: 28,
    startRotate: '16deg',
  },
  {
    label: 'Messaging',
    icon: <BellRing s={15} c="#536A9D" w={1.9} />,
    style: 'messaging',
    tone: '#EEF0FA',
    startX: 22,
    startRotate: '14deg',
  },
  {
    label: 'Streaming',
    icon: <Play s={15} c="#7D5D91" w={1.9} />,
    style: 'streaming',
    tone: '#F2EAF5',
    startX: -22,
    startRotate: '-12deg',
  },
  {
    label: 'Gaming',
    icon: <Target s={15} c="#6A7F54" w={1.9} />,
    style: 'gaming',
    tone: '#EEF5E9',
    startX: -30,
    startRotate: '-17deg',
  },
  {
    label: 'Apps',
    icon: <SlidersHorizontal s={15} c="#4D8586" w={1.9} />,
    style: 'apps',
    tone: '#E7F4F4',
    startX: 30,
    startRotate: '17deg',
  },
  {
    label: 'Content',
    icon: <OpenBook s={15} c="#8F5D6C" w={1.9} />,
    style: 'content',
    tone: '#F6E9EE',
    startX: -18,
    startRotate: '-10deg',
  },
  {
    label: 'Noise',
    icon: <Sparkles s={15} c="#85723F" w={1.9} />,
    style: 'noise',
    tone: '#F2EEDC',
    startX: 18,
    startRotate: '10deg',
  },
] as const;

const DISTRACTION_CARD_REVEAL_PROFILES: Record<
  (typeof DISTRACTION_CARDS)[number]['style'],
  { delay: number; duration: number; x: number; y: number; rotate: string; scale: number }
> = {
  gaming: { delay: 300, duration: 520, x: -82, y: 28, rotate: '-18deg', scale: 0.78 },
  apps: { delay: 430, duration: 520, x: 78, y: 30, rotate: '18deg', scale: 0.78 },
  content: { delay: 570, duration: 540, x: -12, y: 58, rotate: '9deg', scale: 0.76 },
  noise: { delay: 710, duration: 540, x: 42, y: 54, rotate: '-14deg', scale: 0.76 },
  streaming: { delay: 1060, duration: 620, x: -92, y: -8, rotate: '-17deg', scale: 0.74 },
  messaging: { delay: 1360, duration: 650, x: 88, y: 10, rotate: '16deg', scale: 0.74 },
  notifications: { delay: 1660, duration: 680, x: 34, y: -86, rotate: '19deg', scale: 0.72 },
  social: { delay: 1960, duration: 680, x: -78, y: -70, rotate: '-20deg', scale: 0.72 },
};

const DISTRACTION_CARD_MOTION_PATHS = [
  { phase: 0.10, xA: 10, yA: 11, xB: 4, yB: 5, xC: 1.7, yC: 1.2, rA: 2.2, rB: 0.9, rC: 0.45, duration: 6100 },
  { phase: 0.62, xA: 9, yA: 9, xB: 6, yB: 4, xC: 1.5, yC: 1.3, rA: 2.0, rB: 1.1, rC: 0.5, duration: 6420 },
  { phase: 1.25, xA: 8, yA: 12, xB: 5, yB: 6, xC: 1.8, yC: 1.0, rA: 2.4, rB: 0.8, rC: 0.42, duration: 6260 },
  { phase: 1.88, xA: 11, yA: 8, xB: 4, yB: 7, xC: 1.3, yC: 1.6, rA: 2.1, rB: 1.3, rC: 0.55, duration: 6740 },
  { phase: 2.45, xA: 9, yA: 10, xB: 7, yB: 4, xC: 1.9, yC: 1.1, rA: 2.5, rB: 1.0, rC: 0.5, duration: 6350 },
  { phase: 3.05, xA: 10, yA: 9, xB: 5, yB: 7, xC: 1.4, yC: 1.7, rA: 2.2, rB: 1.0, rC: 0.44, duration: 6620 },
  { phase: 3.72, xA: 8, yA: 11, xB: 6, yB: 5, xC: 1.7, yC: 1.4, rA: 2.1, rB: 1.2, rC: 0.48, duration: 6180 },
  { phase: 4.38, xA: 9, yA: 8, xB: 4, yB: 6, xC: 1.5, yC: 1.5, rA: 2.3, rB: 0.9, rC: 0.52, duration: 6530 },
];

function DistractionCard({
  item,
  index,
  enableHaptics = true,
}: {
  item: (typeof DISTRACTION_CARDS)[number];
  index: number;
  enableHaptics?: boolean;
}) {
  const drift = useSharedValue(0);
  const revealProfile = DISTRACTION_CARD_REVEAL_PROFILES[item.style];
  const revealDelay = revealProfile.delay;
  const motion = DISTRACTION_CARD_MOTION_PATHS[index] ?? DISTRACTION_CARD_MOTION_PATHS[0];
  const styleByKey: Record<(typeof DISTRACTION_CARDS)[number]['style'], StyleProp<ViewStyle>> = {
    social: s.distractionCardSocial,
    notifications: s.distractionCardNotifications,
    messaging: s.distractionCardMessaging,
    streaming: s.distractionCardStreaming,
    gaming: s.distractionCardGaming,
    apps: s.distractionCardApps,
    content: s.distractionCardContent,
    noise: s.distractionCardNoise,
  };

  useEffect(() => {
    const hapticTimer = enableHaptics ? setTimeout(runStrongHaptic, revealDelay + 80) : null;
    const floatTimer = setTimeout(() => {
      drift.value = 0;
      drift.value = withRepeat(
        withTiming(1, {
          duration: motion.duration,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    }, revealDelay + revealProfile.duration - 60);

    return () => {
      if (hapticTimer) clearTimeout(hapticTimer);
      clearTimeout(floatTimer);
      drift.value = 0;
    };
  }, [drift, enableHaptics, motion.duration, revealDelay, revealProfile.duration]);

  const floatStyle = useAnimatedStyle(() => {
    const warpedDrift =
      drift.value +
      Math.sin(drift.value * Math.PI * 2 + motion.phase) * 0.032 +
      Math.sin(drift.value * Math.PI * 6 + motion.phase * 1.2) * 0.01;
    const angle = warpedDrift * Math.PI * 2 + motion.phase;
    const secondaryAngle = warpedDrift * Math.PI * 4 + motion.phase * 0.7;
    const tertiaryAngle = warpedDrift * Math.PI * 6 + motion.phase * 1.35;
    const x =
      Math.sin(angle) * motion.xA +
      Math.sin(secondaryAngle) * motion.xB +
      Math.cos(tertiaryAngle) * motion.xC;
    const y =
      Math.cos(angle) * motion.yA +
      Math.sin(secondaryAngle + 0.8) * motion.yB +
      Math.cos(tertiaryAngle + 0.35) * motion.yC;
    const rotate =
      Math.sin(angle + 0.6) * motion.rA +
      Math.cos(secondaryAngle) * motion.rB +
      Math.sin(tertiaryAngle + 0.2) * motion.rC;
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  return (
    <Reanimated.View
      entering={FadeIn
        .delay(revealDelay)
        .duration(revealProfile.duration)
        .easing(Easing.bezier(0.16, 1, 0.28, 1))
        .withInitialValues({
          opacity: 0,
          transform: [
            { translateY: revealProfile.y },
            { translateX: revealProfile.x },
            { rotate: revealProfile.rotate },
            { scale: revealProfile.scale },
          ],
        })}
      style={[s.distractionCardSlot, styleByKey[item.style]]}
    >
      <Reanimated.View style={[s.distractionCard, { backgroundColor: item.tone }, floatStyle]}>
        <View style={s.distractionCardIcon}>{item.icon}</View>
        <Text style={s.distractionCardText} numberOfLines={1}>{item.label}</Text>
      </Reanimated.View>
    </Reanimated.View>
  );
}

function ProtectDistractionVisual({ enableHaptics = true }: { enableHaptics?: boolean }) {
  return (
    <View style={s.distractionStage}>
      <Reanimated.View
        pointerEvents="none"
        entering={FadeIn.duration(520).withInitialValues({
          opacity: 0,
          transform: [{ scale: 0.78 }],
        })}
        style={s.distractionGlow}
      />
      <Reanimated.View
        pointerEvents="none"
        entering={FadeIn.delay(90).duration(540).withInitialValues({
          opacity: 0,
          transform: [{ scale: 0.8 }],
        })}
        style={s.distractionOuterRing}
      />
      <Reanimated.View
        pointerEvents="none"
        entering={FadeIn.delay(160).duration(520).withInitialValues({
          opacity: 0,
          transform: [{ scale: 0.78 }],
        })}
        style={s.distractionInnerCutout}
      />

      <Reanimated.View
        entering={FadeIn.delay(230).duration(560).withInitialValues({
          opacity: 0,
          transform: [{ scale: 0.76 }, { translateY: 8 }],
        })}
        style={s.distractionCore}
      >
        <Image source={PROTECT_TIME_STICKER} style={s.distractionStickerImage} resizeMode="contain" />
      </Reanimated.View>

      {DISTRACTION_CARDS.map((item, index) => (
        <DistractionCard key={item.label} item={item} index={index} enableHaptics={enableHaptics} />
      ))}

      <Reanimated.View
        pointerEvents="none"
        entering={FadeIn.delay(360).duration(520).withInitialValues({
          opacity: 0,
          transform: [{ scaleX: 0.7 }],
        })}
        style={s.distractionGroundShadow}
      />
    </View>
  );
}

type ProtectProblemPhase = 'intro' | 'stats' | 'problemIntro' | 'slider' | 'badNews' | 'goodNews';
type DidYouKnowAnswer = 'yes' | 'no';

function protectProblemCtaLabel(phase: ProtectProblemPhase) {
  if (phase === 'intro') return "Let's do it!";
  if (phase === 'stats') return 'Continue';
  if (phase === 'problemIntro') return 'OK';
  if (phase === 'slider') return 'Continue';
  if (phase === 'badNews') return 'OK';
  if (phase === 'goodNews') return "Let's do it!";
  return 'OK';
}

function ProtectPainSlide({
  hours,
  onChange,
  onNext,
}: {
  hours?: number;
  onChange: (value: number) => void;
  onNext: () => void;
}) {
  const [phase, setPhase] = useState<ProtectProblemPhase>('intro');
  const [introReveal, setIntroReveal] = useState(0);
  const [problemReveal, setProblemReveal] = useState(0);
  const [badReveal, setBadReveal] = useState(0);
  const [goodReveal, setGoodReveal] = useState(0);
  const [firstStatsAnswer, setFirstStatsAnswer] = useState<DidYouKnowAnswer | null>(null);
  const [secondStatsAnswer, setSecondStatsAnswer] = useState<DidYouKnowAnswer | null>(null);
  const [introExiting, setIntroExiting] = useState(false);
  const [sliderExiting, setSliderExiting] = useState(false);
  const introExitMotion = useSharedValue(0);
  const sliderExitMotion = useSharedValue(0);
  const statsExitMotion = useSharedValue(1);
  const introExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sliderExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeHours = protectStats(hours).hours;
  const showBadNews = phase === 'badNews' || phase === 'goodNews';
  const showGoodNews = phase === 'goodNews';
  const showIntroContent = phase === 'intro' || phase === 'stats' || introExiting;
  const showStats = phase === 'stats';
  const showSlider = (phase === 'stats' && problemReveal >= 10) || phase === 'slider';
  const shouldAutoScroll = phase === 'stats' || phase === 'slider' || phase === 'badNews' || phase === 'goodNews';
  const ctaVisible =
    (phase === 'intro' && introReveal >= 3) ||
    (phase === 'stats' && problemReveal >= 10 && !sliderExiting) ||
    (phase === 'problemIntro' && problemReveal >= 3) ||
    (phase === 'slider' && problemReveal >= 1 && !sliderExiting) ||
    (phase === 'badNews' && badReveal >= 6) ||
    (phase === 'goodNews' && goodReveal >= 5);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (phase === 'intro') {
      setIntroReveal(0);
      setProblemReveal(0);
      setBadReveal(0);
      setGoodReveal(0);
      setFirstStatsAnswer(null);
      setSecondStatsAnswer(null);
      setIntroExiting(false);
      introExitMotion.value = 0;
      sliderExitMotion.value = 0;
      statsExitMotion.value = 1;
      timers.push(setTimeout(() => setIntroReveal(1), PROTECT_INTRO_VISUAL_DELAY_MS));
      timers.push(setTimeout(() => {
        runStrongHaptic();
        setIntroReveal(2);
      }, DISTRACTION_SEQUENCE_COMPLETE_MS));
      timers.push(setTimeout(() => setIntroReveal(3), DISTRACTION_SEQUENCE_COMPLETE_MS + 1580));
    }

    if (phase === 'stats') {
      setProblemReveal(0);
      setBadReveal(0);
      setGoodReveal(0);
      setSliderExiting(false);
      sliderExitMotion.value = 0;
      statsExitMotion.value = 1;
      timers.push(setTimeout(() => setProblemReveal(1), 280));
    }

    if (phase === 'problemIntro') {
      setProblemReveal(0);
      setBadReveal(0);
      setGoodReveal(0);
      [180, 1040, 2860].forEach((delay, index) => {
        timers.push(setTimeout(() => setProblemReveal(index + 1), delay));
      });
    }

    if (phase === 'badNews') {
      setBadReveal(0);
      setGoodReveal(0);
      [140, 1280, 3920, 5660, 6840, 8020].forEach((delay, index) => {
        timers.push(setTimeout(() => setBadReveal(index + 1), delay));
      });
    }

    if (phase === 'goodNews') {
      setBadReveal(6);
      setGoodReveal(0);
      [360, 1860, 4500, 5700, 6900].forEach((delay, index) => {
        timers.push(setTimeout(() => setGoodReveal(index + 1), delay));
      });
    }

    if (phase === 'slider') {
      setProblemReveal(0);
      setBadReveal(0);
      setGoodReveal(0);
      setSliderExiting(false);
      sliderExitMotion.value = 0;
      statsExitMotion.value = 1;
      timers.push(setTimeout(() => {
        setProblemReveal(1);
        sliderExitMotion.value = 0;
        sliderExitMotion.value = withTiming(1, {
          duration: 980,
          easing: Easing.bezier(0.16, 1, 0.28, 1),
        });
      }, 300));
    }

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [introExitMotion, phase, sliderExitMotion, statsExitMotion]);

  useEffect(() => {
    return () => {
      if (introExitTimerRef.current) {
        clearTimeout(introExitTimerRef.current);
        introExitTimerRef.current = null;
      }
      if (sliderExitTimerRef.current) {
        clearTimeout(sliderExitTimerRef.current);
        sliderExitTimerRef.current = null;
      }
    };
  }, []);

  const introTransitionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(introExitMotion.value, [0, 0.62, 1], [1, 0.38, 0]),
    transform: [
      { translateY: interpolate(introExitMotion.value, [0, 1], [0, -18]) },
      { scale: interpolate(introExitMotion.value, [0, 1], [1, 0.972]) },
    ],
  }));
  const sliderTransitionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sliderExitMotion.value, [0, 0.18, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(sliderExitMotion.value, [0, 0.58, 1], [24, -3, 0]) },
      { scale: interpolate(sliderExitMotion.value, [0, 0.58, 1], [0.965, 1.008, 1]) },
    ],
  }));
  const statsExitStyle = useAnimatedStyle(() => ({
    opacity: interpolate(statsExitMotion.value, [0, 0.38, 1], [0, 0.72, 1]),
    transform: [
      { translateY: interpolate(statsExitMotion.value, [0, 1], [-18, 0]) },
      { scale: interpolate(statsExitMotion.value, [0, 1], [0.982, 1]) },
    ],
  }));

  const handleNext = () => {
    if (phase === 'intro') {
      runSelectionHaptic();
      setPhase('stats');
      return;
    }
    if (phase === 'stats') {
      runSelectionHaptic();
      if (sliderExiting) return;
      setSliderExiting(true);
      statsExitMotion.value = withTiming(0, {
        duration: 760,
        easing: Easing.bezier(0.16, 1, 0.28, 1),
      });
      sliderExitMotion.value = withTiming(0, {
        duration: 820,
        easing: Easing.bezier(0.16, 1, 0.28, 1),
      });
      sliderExitTimerRef.current = setTimeout(() => {
        sliderExitTimerRef.current = null;
        setPhase('badNews');
        setSliderExiting(false);
      }, 960);
      return;
    }
    if (phase === 'problemIntro') {
      runSelectionHaptic();
      setPhase('badNews');
      return;
    }
    if (phase === 'slider') {
      runSelectionHaptic();
      if (sliderExiting) return;
      setSliderExiting(true);
      statsExitMotion.value = withTiming(0, {
        duration: 760,
        easing: Easing.bezier(0.16, 1, 0.28, 1),
      });
      sliderExitMotion.value = withTiming(0, {
        duration: 820,
        easing: Easing.bezier(0.16, 1, 0.28, 1),
      });
      sliderExitTimerRef.current = setTimeout(() => {
        sliderExitTimerRef.current = null;
        setPhase('badNews');
        setSliderExiting(false);
      }, 960);
      return;
    }
    if (phase === 'badNews') {
      if (badReveal < 6) {
        setBadReveal(6);
        return;
      }
      runSelectionHaptic();
      setPhase('goodNews');
      return;
    }
    if (phase === 'goodNews') {
      if (goodReveal < 5) {
        setGoodReveal(5);
        return;
      }
      runSelectionHaptic();
      onNext();
      return;
    }
  };

  const handleStatsSliderReady = useCallback(() => {
    sliderExitMotion.value = 0;
    sliderExitMotion.value = withTiming(1, {
      duration: 980,
      easing: Easing.bezier(0.16, 1, 0.28, 1),
    });
  }, [sliderExitMotion]);

  return (
    <GuidedSetupShell
      onNext={handleNext}
      ctaLabel={protectProblemCtaLabel(phase)}
      ctaDelay={phase === 'stats' || phase === 'slider' ? 980 : phase === 'goodNews' ? 940 : 220}
      ctaDuration={phase === 'goodNews' ? 940 : 620}
      ctaDistance={phase === 'goodNews' ? 34 : 24}
      scrollDelay={phase === 'stats' || phase === 'slider' ? 980 : 210}
      scrollSignal={`${phase}-${introReveal}-${introExiting ? 'intro-exit' : 'intro-idle'}-${sliderExiting ? 'slider-exit' : 'slider-idle'}-${problemReveal}-${badReveal}-${goodReveal}`}
      autoScrollOnContentChange={shouldAutoScroll}
      ctaVisible={ctaVisible}
    >
      {showIntroContent && (
        <Reanimated.View style={[introTransitionStyle, phase === 'stats' ? statsExitStyle : null]}>
          <View style={s.protectPainIntroPromptSlot}>
            {introReveal >= 2 && (
              <ProtectSidePrompt
                motionKey="protect-pain-start"
                compact
                segments={[
                  { text: "Let's start " },
                  { text: 'protecting your time', highlight: true },
                  { text: '.' },
                ]}
              />
            )}
          </View>

          {introReveal >= 1 && (
            <Reanimated.View
              pointerEvents="none"
              entering={FadeIn.duration(620).withInitialValues({
                opacity: 0,
                transform: [{ translateY: 14 }, { scale: 0.96 }],
              })}
              style={s.protectIntroVisual}
            >
              <ProtectDistractionVisual />
            </Reanimated.View>
          )}
        </Reanimated.View>
      )}

      {showStats && (
        <Reanimated.View pointerEvents={sliderExiting ? 'none' : 'auto'} style={statsExitStyle}>
          <ProtectStatsConversation
            reveal={problemReveal}
            firstAnswer={firstStatsAnswer}
            secondAnswer={secondStatsAnswer}
            onFirstAnswer={answer => {
              runSelectionHaptic();
              setFirstStatsAnswer(answer);
              setProblemReveal(2);
            }}
            onSecondAnswer={answer => {
              runSelectionHaptic();
              setSecondStatsAnswer(answer);
              setProblemReveal(7);
            }}
            onReveal={setProblemReveal}
            onSliderReady={handleStatsSliderReady}
          />
        </Reanimated.View>
      )}

      {showSlider && problemReveal >= 1 && (
        <Reanimated.View
          pointerEvents={sliderExiting ? 'none' : 'auto'}
          style={sliderTransitionStyle}
        >
          <ScreenTimeSlider value={hours} onChange={onChange} />
        </Reanimated.View>
      )}

      {phase === 'problemIntro' && problemReveal >= 3 && (
        <Reanimated.View
          entering={FadeIn.duration(620).withInitialValues({
            opacity: 0,
            transform: [{ translateY: 18 }, { scale: 0.975 }],
          })}
        >
          <ScreenTimeSlider value={hours} onChange={onChange} />
        </Reanimated.View>
      )}

      {showBadNews && <ScreenTimeBadNewsConversation hours={activeHours} reveal={badReveal} />}

      {showGoodNews && <ScreenTimeGoodNewsConversation hours={activeHours} reveal={goodReveal} />}

    </GuidedSetupShell>
  );
}

function ProtectStatsConversation({
  reveal,
  firstAnswer,
  secondAnswer,
  onFirstAnswer,
  onSecondAnswer,
  onReveal,
  onSliderReady,
}: {
  reveal: number;
  firstAnswer: DidYouKnowAnswer | null;
  secondAnswer: DidYouKnowAnswer | null;
  onFirstAnswer: (answer: DidYouKnowAnswer) => void;
  onSecondAnswer: (answer: DidYouKnowAnswer) => void;
  onReveal: (reveal: number) => void;
  onSliderReady: () => void;
}) {
  useEffect(() => {
    if (!firstAnswer) return undefined;
    const timers = [
      setTimeout(() => onReveal(3), 920),
      setTimeout(() => onReveal(4), 3380),
    ];
    return () => timers.forEach(timer => clearTimeout(timer));
  }, [firstAnswer, onReveal]);

  useEffect(() => {
    if (!secondAnswer) return undefined;
    const timers = [
      setTimeout(() => onReveal(8), 880),
      setTimeout(() => onReveal(9), 2280),
      setTimeout(() => {
        onReveal(10);
        onSliderReady();
      }, 3880),
    ];
    return () => timers.forEach(timer => clearTimeout(timer));
  }, [onReveal, onSliderReady, secondAnswer]);

  return (
    <View style={s.protectStatsConversation}>
      {reveal >= 1 && (
        <DidYouKnowCard
          motionKey="distraction-every-ten"
          questionSegments={[
            { text: 'On average, people check their phone at least once every ' },
            { text: '10 minutes', gold: true },
            { text: '!' },
          ]}
          selected={firstAnswer}
          onSelect={onFirstAnswer}
        />
      )}

      {firstAnswer && reveal >= 2 && <UserMessageBubble text={firstAnswer === 'yes' ? 'Yes.' : 'No.'} delay={120} />}

      {reveal >= 3 && (
        <ProtectSidePrompt
          motionKey="distraction-attention-fight"
          segments={[
            { text: 'Every app on your phone is fighting\nfor one thing - your ' },
            { text: 'attention', gold: true },
            { text: '!' },
          ]}
        />
      )}

      {reveal >= 4 && (
        <DidYouKnowCard
          motionKey="distraction-return-focus"
          questionSegments={[
            { text: 'It takes exactly ' },
            { text: '23 minutes and 15 seconds', gold: true },
            { text: ' to ' },
            { text: 'return', highlight: true },
            { text: ' to the same level of focus after a distraction.' },
          ]}
          selected={secondAnswer}
          onSelect={onSecondAnswer}
        />
      )}

      {secondAnswer && reveal >= 7 && <UserMessageBubble text={secondAnswer === 'yes' ? 'Yes.' : 'No.'} delay={120} />}

      {reveal >= 8 && (
        <ProtectSidePrompt
          motionKey="distraction-by-design-second"
          compact
          segments={[
            { text: 'That is ' },
            { text: 'by design', highlight: true },
            { text: '.' },
          ]}
        />
      )}

      {reveal >= 9 && (
        <ProtectSidePrompt
          motionKey="distraction-time-at-stake"
          segments={[
            { text: "Let's see how much of your " },
            { text: 'time', highlight: true },
            { text: ' is really at ' },
            { text: 'stake', highlight: true },
            { text: '.' },
          ]}
        />
      )}
    </View>
  );
}

function DidYouKnowCard({
  motionKey,
  question,
  questionSegments,
  value,
  valueLabel,
  valueTone = 'ink',
  selected,
  onSelect,
}: {
  motionKey: string;
  question?: string;
  questionSegments?: PromptSegment[];
  value?: string;
  valueLabel?: string;
  valueTone?: 'ink' | 'gold';
  selected: DidYouKnowAnswer | null;
  onSelect: (answer: DidYouKnowAnswer) => void;
}) {
  const choicesProgress = useSharedValue(selected === null ? 1 : 0);

  useEffect(() => {
    choicesProgress.value = withTiming(selected === null ? 1 : 0, {
      duration: selected === null ? 320 : 660,
      easing: Easing.bezier(0.19, 1, 0.22, 1),
    });
  }, [choicesProgress, selected]);

  const choicesStyle = useAnimatedStyle(() => ({
    height: interpolate(choicesProgress.value, [0, 1], [0, 48]),
    marginTop: interpolate(choicesProgress.value, [0, 1], [0, 16]),
    opacity: interpolate(choicesProgress.value, [0, 0.55, 1], [0, 0.36, 1]),
    transform: [
      { translateY: interpolate(choicesProgress.value, [0, 1], [-5, 0]) },
      { scale: interpolate(choicesProgress.value, [0, 1], [0.992, 1]) },
    ],
  }));

  return (
    <Reanimated.View
      key={motionKey}
      entering={FadeIn.delay(80).duration(860).easing(Easing.bezier(0.16, 1, 0.28, 1)).withInitialValues({
        opacity: 0,
        transform: [{ translateY: 14 }, { scale: 0.985 }],
      })}
      style={s.didYouKnowCard}
    >
      <View pointerEvents="none" style={s.didYouKnowGlow} />
      <Reanimated.View
        entering={FadeIn.delay(170).duration(420).easing(Easing.bezier(0.16, 1, 0.28, 1)).withInitialValues({
          opacity: 0,
          transform: [{ translateY: 5 }],
        })}
        style={s.didYouKnowTopRow}
      >
        <Text style={s.didYouKnowHeading}>Did you know?</Text>
        <View style={s.didYouKnowSpark}>
          <Sparkles s={15} c={GOLD} w={2} />
        </View>
      </Reanimated.View>
      <Reanimated.Text
        entering={FadeIn.delay(270).duration(520).easing(Easing.bezier(0.16, 1, 0.28, 1)).withInitialValues({
          opacity: 0,
          transform: [{ translateY: 8 }],
        })}
        style={s.didYouKnowQuestion}
      >
        {questionSegments
          ? questionSegments.map((segment, index) => (
            <Text
              key={`${segment.text}-${index}`}
              style={[
                segment.highlight ? s.didYouKnowQuestionHighlight : undefined,
                segment.gold ? s.didYouKnowQuestionGold : undefined,
              ]}
            >
              {segment.text}
            </Text>
          ))
          : question}
      </Reanimated.Text>
      {value ? (
        <View style={s.didYouKnowValueWrap}>
          <Text style={[s.didYouKnowValue, valueTone === 'gold' && s.didYouKnowValueGold]}>{value}</Text>
          {valueLabel ? <Text style={s.didYouKnowValueLabel}>{valueLabel}</Text> : null}
        </View>
      ) : null}
      <Reanimated.View
        entering={FadeIn.delay(430).duration(480).easing(Easing.bezier(0.16, 1, 0.28, 1)).withInitialValues({
          opacity: 0,
          transform: [{ translateY: 8 }],
        })}
        pointerEvents={selected === null ? 'auto' : 'none'}
        style={[s.didYouKnowChoicesWrap, choicesStyle]}
      >
        <View style={s.didYouKnowChoices}>
          {(['yes', 'no'] as const).map(answer => {
            const active = selected === answer;
            return (
              <TouchableOpacity
                key={answer}
                activeOpacity={0.88}
                haptic="medium"
                disabled={selected !== null}
                onPress={() => onSelect(answer)}
                style={[s.didYouKnowChoice, active && s.didYouKnowChoiceActive]}
              >
                <Text style={[s.didYouKnowChoiceText, active && s.didYouKnowChoiceTextActive]}>
                  {answer === 'yes' ? 'Yes' : 'No'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Reanimated.View>
    </Reanimated.View>
  );
}

function ScreenTimeSlider({ value, onChange }: { value?: number; onChange: (hours: number) => void }) {
  const initial = clampNumber(value ?? DEFAULT_SCREEN_TIME_HOURS, SCREEN_TIME_MIN_HOURS, SCREEN_TIME_MAX_HOURS);
  const [localHours, setLocalHours] = useState(initial);
  const lastHoursRef = useRef(initial);
  const trackWidth = useSharedValue(1);
  const progress = useSharedValue((initial - SCREEN_TIME_MIN_HOURS) / (SCREEN_TIME_MAX_HOURS - SCREEN_TIME_MIN_HOURS));

  const commitHours = useCallback((nextHours: number) => {
    if (Math.abs(lastHoursRef.current - nextHours) < 0.01) return;
    lastHoursRef.current = nextHours;
    runSelectionHaptic();
    setLocalHours(nextHours);
    onChange(nextHours);
  }, [onChange]);

  useEffect(() => {
    const next = clampNumber(value ?? DEFAULT_SCREEN_TIME_HOURS, SCREEN_TIME_MIN_HOURS, SCREEN_TIME_MAX_HOURS);
    lastHoursRef.current = next;
    setLocalHours(next);
    progress.value = withTiming((next - SCREEN_TIME_MIN_HOURS) / (SCREEN_TIME_MAX_HOURS - SCREEN_TIME_MIN_HOURS), {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, value]);

  const updateFromX = useCallback((x: number, width: number) => {
    'worklet';
    const safeWidth = Math.max(1, width);
    const nextProgress = clampNumber(x / safeWidth, 0, 1);
    const rawHours = SCREEN_TIME_MIN_HOURS + nextProgress * (SCREEN_TIME_MAX_HOURS - SCREEN_TIME_MIN_HOURS);
    const snappedHours = clampNumber(roundToHalfHour(rawHours), SCREEN_TIME_MIN_HOURS, SCREEN_TIME_MAX_HOURS);
    const snappedProgress = (snappedHours - SCREEN_TIME_MIN_HOURS) / (SCREEN_TIME_MAX_HOURS - SCREEN_TIME_MIN_HOURS);
    progress.value = snappedProgress;
    runOnJS(commitHours)(snappedHours);
  }, [commitHours, progress]);

  const panGesture = useMemo(
    () => Gesture.Pan()
      .onBegin(event => {
        updateFromX(event.x, trackWidth.value);
      })
      .onUpdate(event => {
        updateFromX(event.x, trackWidth.value);
      }),
    [trackWidth, updateFromX],
  );
  const tapGesture = useMemo(
    () => Gesture.Tap()
      .onStart(event => {
        updateFromX(event.x, trackWidth.value);
      }),
    [trackWidth, updateFromX],
  );
  const sliderGesture = useMemo(() => Gesture.Simultaneous(tapGesture, panGesture), [panGesture, tapGesture]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * Math.max(1, trackWidth.value) - 16 }],
  }));

  return (
    <View style={s.screenTimeSliderCard}>
      <Text style={s.screenTimeSliderQuestion}>How much time do you spend on your phone each day?</Text>
      <View style={s.screenTimeSliderRule} />

      <GestureDetector gesture={sliderGesture}>
        <View
          style={s.screenTimeSliderTouch}
          onLayout={event => {
            const width = event.nativeEvent.layout.width;
            trackWidth.value = width;
            progress.value = (localHours - SCREEN_TIME_MIN_HOURS) / (SCREEN_TIME_MAX_HOURS - SCREEN_TIME_MIN_HOURS);
          }}
        >
          <View style={s.screenTimeSliderRail}>
            <Reanimated.View style={[s.screenTimeSliderFill, fillStyle]} />
          </View>
          <Reanimated.View style={[s.screenTimeSliderThumb, thumbStyle]}>
            <View style={s.screenTimeSliderThumbCore} />
          </Reanimated.View>
        </View>
      </GestureDetector>

      <Text style={s.screenTimeSliderValue}>{formatHourValue(localHours)}h</Text>

      <View style={s.screenTimeSliderScale}>
        <Text style={s.screenTimeSliderScaleText}>4h</Text>
        <Text style={s.screenTimeSliderScaleText}>Daily phone time</Text>
        <Text style={s.screenTimeSliderScaleText}>10h+</Text>
      </View>
    </View>
  );
}

function ProtectScreenTimeSlide({
  hours,
  onChange,
  onNext,
}: {
  hours?: number;
  onChange: (value: number) => void;
  onNext: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const activeHours = protectStats(hours).hours;
  const handlePrimary = () => {
    if (!submitted) {
      runSelectionHaptic();
      setSubmitted(true);
      return;
    }
    onNext();
  };

  return (
    <GuidedSetupShell onNext={handlePrimary} ctaLabel={submitted ? 'Set guardrails' : 'OK'}>
      <ProtectSidePrompt
        motionKey="protect-screen-time"
        segments={[{ text: 'How much time do you spend on your phone each day?' }]}
      />
      {!submitted ? (
        <Reanimated.View
          entering={FadeIn.delay(1400).duration(620).withInitialValues({
            opacity: 0,
            transform: [{ translateY: 18 }, { scale: 0.975 }],
          })}
        >
          <ScreenTimeSlider value={hours} onChange={onChange} />
        </Reanimated.View>
      ) : (
        <ScreenTimeConversationResult hours={activeHours} />
      )}
    </GuidedSetupShell>
  );
}

function ScreenTimeBadNewsConversation({ hours, reveal }: { hours: number; reveal: number }) {
  const stat = protectStats(hours);

  return (
    <View style={s.screenTimeConversation}>
      {reveal >= 1 && <ScreenTimeUserReply hours={stat.hours} />}
      {reveal >= 2 && (
        <ProtectSidePrompt
          motionKey={`protect-screen-time-bad-news-${stat.hours}`}
          segments={[
            { text: "That's a " },
            { text: 'meaningful part', highlight: true },
            { text: ' of your day' },
            { text: '.' },
          ]}
        />
      )}
      {reveal >= 3 && <ScreenTimeWastedIntro lifted={reveal >= 4} />}
      {reveal >= 4 && <ScreenTimePercentCard stat={stat} index={1} stackSignal={reveal} />}
      {reveal >= 5 && <ScreenTimeDaysCard stat={stat} index={2} stackSignal={reveal} />}
      {reveal >= 6 && <ScreenTimeYearsCard stat={stat} index={3} stackSignal={reveal} />}
    </View>
  );
}

function ScreenTimeGoodNewsConversation({ hours, reveal }: { hours: number; reveal: number }) {
  const stat = protectStats(hours);

  return (
    <View style={s.screenTimeConversation}>
      {reveal >= 1 && (
        <ProtectSidePrompt
          motionKey={`protect-screen-time-good-news-${stat.hours}`}
          segments={[
            { text: 'Now, ' },
            { text: 'good news', highlight: true },
            { text: '!' },
          ]}
        />
      )}
      {reveal >= 2 && (
        <ProtectSidePrompt
          motionKey={`protect-screen-time-reduce-${stat.hours}`}
          segments={[
            { text: 'If you cut your screen time by only ' },
            { text: '40%', highlight: true, gold: true },
            { text: '...' },
          ]}
        />
      )}
      {reveal >= 3 && <ScreenTimeGetBackIntro lifted={reveal >= 4} />}
      {reveal >= 4 && <ScreenTimeSavedDaysCard stat={stat} index={1} stackSignal={reveal} />}
      {reveal >= 5 && <ScreenTimeSavedYearsCard stat={stat} index={2} stackSignal={reveal} />}
    </View>
  );
}

function ScreenTimeConversationResult({ hours }: { hours: number }) {
  return (
    <>
      <ScreenTimeBadNewsConversation hours={hours} reveal={6} />
      <ScreenTimeGoodNewsConversation hours={hours} reveal={5} />
    </>
  );
}

function ScreenTimeStatIntro() {
  return (
    <Reanimated.View entering={FadeIn.duration(420).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })} style={s.screenTimeStatIntro}>
      <Text style={s.screenTimeResultKicker}>Based on that</Text>
    </Reanimated.View>
  );
}

function ScreenTimeWastedIntro({ lifted = false }: { lifted?: boolean }) {
  const lift = useSharedValue(0);

  useEffect(() => {
    runStrongHaptic();
  }, []);

  useEffect(() => {
    lift.value = withTiming(lifted ? 1 : 0, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [lift, lifted]);

  const liftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(lift.value, [0, 1], [0, -5]) },
      { scale: interpolate(lift.value, [0, 1], [1, 0.955]) },
    ],
  }));

  return (
    <Reanimated.View
      entering={FadeIn.duration(820).easing(Easing.bezier(0.16, 1, 0.28, 1)).withInitialValues({
        opacity: 0,
        transform: [{ translateY: 12 }, { scale: 0.97 }],
      })}
      style={[s.screenTimeWastedIntro, liftStyle]}
    >
      <View pointerEvents="none" style={[s.screenTimeIntroWash, s.screenTimeIntroWashWaste]} />
      <View pointerEvents="none" style={[s.screenTimeIntroCorner, s.screenTimeIntroCornerWaste]} />
      <View style={s.screenTimeIntroOrnamentRow}>
        <View style={[s.screenTimeIntroOrnamentLine, s.screenTimeIntroOrnamentLineDark]} />
        <View style={s.screenTimeIntroOrnamentDot} />
        <View style={[s.screenTimeIntroOrnamentLine, s.screenTimeIntroOrnamentLineDark]} />
      </View>
      <Text style={[s.screenTimeIntroToplinePill, s.screenTimeIntroToplinePillWaste]}>
        You
      </Text>
      <Text style={s.screenTimeWastedWord}>
        WASTE
      </Text>
      <View style={s.screenTimeWastedUnderline} />
    </Reanimated.View>
  );
}

function ScreenTimeGetBackIntro({ lifted = false }: { lifted?: boolean }) {
  const lift = useSharedValue(0);

  useEffect(() => {
    runStrongHaptic();
  }, []);

  useEffect(() => {
    lift.value = withTiming(lifted ? 1 : 0, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [lift, lifted]);

  const liftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(lift.value, [0, 1], [0, -5]) },
      { scale: interpolate(lift.value, [0, 1], [1, 0.955]) },
    ],
  }));

  return (
    <Reanimated.View
      entering={FadeIn.duration(840).easing(Easing.bezier(0.16, 1, 0.28, 1)).withInitialValues({
        opacity: 0,
        transform: [{ translateY: 12 }, { scale: 0.97 }],
      })}
      style={[s.screenTimeGetBackIntro, liftStyle]}
    >
      <View pointerEvents="none" style={[s.screenTimeIntroWash, s.screenTimeIntroWashGetBack]} />
      <View pointerEvents="none" style={[s.screenTimeIntroCorner, s.screenTimeIntroCornerGetBack]} />
      <View style={s.screenTimeIntroOrnamentRow}>
        <View style={s.screenTimeIntroOrnamentLine} />
        <View style={s.screenTimeIntroOrnamentDot} />
        <View style={s.screenTimeIntroOrnamentLine} />
      </View>
      <Text style={[s.screenTimeIntroToplinePill, s.screenTimeIntroToplinePillGetBack]}>
        You can
      </Text>
      <Text style={s.screenTimeGetBackWord}>
        GET BACK
      </Text>
      <View style={s.screenTimeGetBackUnderline} />
    </Reanimated.View>
  );
}

function ScreenTimePercentCard({
  stat,
  index,
  stackSignal,
}: {
  stat: ReturnType<typeof protectStats>;
  index?: number;
  stackSignal?: number;
}) {
  const parts = screenTimeDayParts(stat);
  return (
    <ScreenTimeStatMessage
      layout="stacked"
      haptic="strong"
      value={`${stat.usablePercent}%`}
      label="of your 16h productive day!"
      legendItems={negativeScreenTimeLegend}
      index={index}
      stackSignal={stackSignal}
      visual={(
        <View style={s.screenTimeDayBar}>
          {Array.from({ length: parts.sleep }).map((_, index) => (
            <View key={`sleep-hour-${index}`} style={[s.screenTimeDaySegment, s.screenTimeDaySegmentSleep]} />
          ))}
          {Array.from({ length: parts.awake }).map((_, index) => (
            <View key={`awake-hour-${index}`} style={[s.screenTimeDaySegment, s.screenTimeDaySegmentAwake]} />
          ))}
          {Array.from({ length: parts.phone }).map((_, index) => (
            <View key={`phone-hour-${index}`} style={[s.screenTimeDaySegment, s.screenTimeDaySegmentPhone]} />
          ))}
        </View>
      )}
    />
  );
}

function ScreenTimeDaysCard({
  stat,
  index,
  stackSignal,
}: {
  stat: ReturnType<typeof protectStats>;
  index?: number;
  stackSignal?: number;
}) {
  const parts = screenTimeYearParts(stat);
  return (
    <ScreenTimeStatMessage
      layout="stacked"
      haptic="strong"
      value={`${stat.yearlyDays}`}
      label="days every year!"
      legendItems={negativeScreenTimeLegend}
      index={index}
      stackSignal={stackSignal}
      visual={<ScreenTimeDotGrid total={365} awake={parts.awake} phone={parts.phone} sleep={parts.sleep} mode="days" />}
    />
  );
}

function ScreenTimeYearsCard({
  stat,
  index,
  stackSignal,
}: {
  stat: ReturnType<typeof protectStats>;
  index?: number;
  stackSignal?: number;
}) {
  const parts = screenTimeLifetimeParts(stat);
  return (
    <ScreenTimeStatMessage
      layout="stacked"
      haptic="strong"
      value={`${formatYearValue(stat.lifetimeYears)}`}
      label="years over 85 years!"
      legendItems={negativeScreenTimeLegend}
      index={index}
      stackSignal={stackSignal}
      visual={<ScreenTimeDotGrid total={PROTECT_LIFESPAN_YEARS} awake={parts.awake} phone={parts.phone} sleep={parts.sleep} mode="years" />}
    />
  );
}

function ScreenTimeSavedDaysCard({
  stat,
  index,
  stackSignal,
}: {
  stat: ReturnType<typeof protectStats>;
  index?: number;
  stackSignal?: number;
}) {
  const sleepDays = Math.round((SLEEP_HOURS_PER_DAY * 365) / DAY_HOURS);
  const phoneDays = Math.max(0, stat.yearlyDays - stat.reclaimedDays);
  const awakeDays = Math.max(0, 365 - sleepDays - phoneDays);
  return (
    <ScreenTimeStatMessage
      tone="dark"
      layout="stacked"
      haptic="strong"
      value={`${stat.reclaimedDays}`}
      label="days back every year!"
      legendItems={negativeScreenTimeLegend}
      index={index}
      stackSignal={stackSignal}
      visual={<ScreenTimeDotGrid total={365} awake={awakeDays} phone={phoneDays} sleep={sleepDays} mode="days" dark />}
    />
  );
}

function ScreenTimeSavedYearsCard({
  stat,
  index,
  stackSignal,
}: {
  stat: ReturnType<typeof protectStats>;
  index?: number;
  stackSignal?: number;
}) {
  const sleepYears = Math.round((SLEEP_HOURS_PER_DAY * PROTECT_LIFESPAN_YEARS) / DAY_HOURS);
  const lostYears = Math.max(0, Math.min(PROTECT_LIFESPAN_YEARS, Math.round(stat.lifetimeYears)));
  const reclaimedYears = Math.max(0, Math.min(lostYears, Math.round(stat.reclaimedYears)));
  const phoneYears = Math.max(0, lostYears - reclaimedYears);
  const awakeYears = Math.max(0, PROTECT_LIFESPAN_YEARS - sleepYears - phoneYears);
  return (
    <ScreenTimeStatMessage
      tone="dark"
      layout="stacked"
      haptic="strong"
      value={`${formatYearValue(stat.reclaimedYears)}`}
      label="years back over 85 years!"
      legendItems={negativeScreenTimeLegend}
      index={index}
      stackSignal={stackSignal}
      visual={<ScreenTimeDotGrid total={PROTECT_LIFESPAN_YEARS} awake={awakeYears} phone={phoneYears} sleep={sleepYears} mode="years" dark />}
    />
  );
}

type ScreenTimeLegendKind = 'awake' | 'phone' | 'sleep';
type ScreenTimeLegendItem = { label: string; kind: ScreenTimeLegendKind };

const negativeScreenTimeLegend: ScreenTimeLegendItem[] = [
  { label: 'Awake', kind: 'awake' },
  { label: 'Phone', kind: 'phone' },
  { label: 'Sleep', kind: 'sleep' },
];

function ScreenTimeLegend({ items, dark }: { items: ScreenTimeLegendItem[]; dark: boolean }) {
  return (
    <View style={s.screenTimeLegend}>
      {items.map(item => (
        <View key={`${item.kind}-${item.label}`} style={s.screenTimeLegendItem}>
          <View
            style={[
              s.screenTimeLegendDot,
              item.kind === 'awake' && (dark ? s.screenTimeLegendAwakeDark : s.screenTimeLegendAwakeLight),
              item.kind === 'phone' && s.screenTimeLegendPhone,
              item.kind === 'sleep' && (dark ? s.screenTimeLegendSleepDark : s.screenTimeLegendSleepLight),
            ]}
          />
          <Text style={[s.screenTimeLegendText, dark && s.screenTimeLegendTextDark]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ScreenTimeStatMessage({
  value,
  label,
  legendItems,
  visual,
  tone = 'light',
  layout = 'row',
  haptic = 'none',
  index,
  stackSignal = 0,
}: {
  value: string;
  label: string;
  legendItems: ScreenTimeLegendItem[];
  visual: React.ReactNode;
  tone?: 'light' | 'dark';
  layout?: 'row' | 'stacked';
  haptic?: 'none' | 'strong';
  index?: number;
  stackSignal?: number;
}) {
  const dark = tone === 'dark';
  const stacked = layout === 'stacked';
  const numberOnRight = typeof index === 'number' && index % 2 === 0;
  const intro = useSharedValue(0);
  const settle = useSharedValue(1);

  useEffect(() => {
    intro.value = 0;
    const startTimer = setTimeout(() => {
      intro.value = withTiming(1, {
        duration: 1080,
        easing: Easing.bezier(0.16, 1, 0.28, 1),
      });
    }, 40);
    const hapticTimer = setTimeout(() => {
      if (haptic === 'strong') runStrongHaptic();
    }, 250);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(hapticTimer);
    };
  }, [haptic, index, intro, label, value]);

  useEffect(() => {
    const delay = typeof index === 'number' ? Math.max(0, index - 1) * 62 : 0;
    const timer = setTimeout(() => {
      settle.value = 0;
      settle.value = withTiming(1, {
        duration: 760,
        easing: Easing.bezier(0.16, 1, 0.28, 1),
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [index, settle, stackSignal]);

  const cardMotionStyle = useAnimatedStyle(() => {
    const side = numberOnRight ? 1 : -1;
    const introScale = interpolate(intro.value, [0, 0.46, 0.78, 1], [1.065, 1.012, 0.997, 1]);
    const settleScale = interpolate(settle.value, [0, 0.5, 1], [1, 1.003, 1]);
    return {
      opacity: interpolate(intro.value, [0, 0.18, 1], [0, 1, 1]),
      transform: [
        { translateX: interpolate(intro.value, [0, 0.52, 0.82, 1], [side * 16, side * -3, side * 0.8, 0]) },
        {
          translateY:
            interpolate(intro.value, [0, 0.5, 0.8, 1], [26, -6, 1.5, 0]) +
            interpolate(settle.value, [0, 0.5, 1], [0, -2, 0]),
        },
        { scale: introScale * settleScale },
      ],
    };
  });

  return (
    <Reanimated.View
      style={[s.screenTimeStatMessage, dark && s.screenTimeStatMessageDark, cardMotionStyle]}
    >
      {typeof index === 'number' && (
        <Reanimated.View
          entering={FadeIn.delay(190).duration(620).easing(Easing.bezier(0.16, 1, 0.28, 1)).withInitialValues({
            opacity: 0,
            transform: [{ translateX: numberOnRight ? 12 : -12 }, { scale: 0.38 }],
          })}
          style={[s.screenTimeStatNumber, numberOnRight && s.screenTimeStatNumberRight, dark && s.screenTimeStatNumberDark]}
        >
          <Text style={[s.screenTimeStatNumberText, dark && s.screenTimeStatNumberTextDark]}>{index}.</Text>
        </Reanimated.View>
      )}
      <View style={[s.screenTimeStatHeader, stacked && s.screenTimeStatHeaderStacked]}>
        <Text style={[s.screenTimeStatValue, stacked && s.screenTimeStatValueStacked, dark && s.screenTimeStatValueDark]}>{value}</Text>
        <Text style={[s.screenTimeStatLabel, stacked && s.screenTimeStatLabelStacked, dark && s.screenTimeStatLabelDark]}>{label}</Text>
        {stacked && <View style={s.screenTimeStatLabelUnderline} />}
      </View>
      <ScreenTimeLegend items={legendItems} dark={dark} />
      {visual}
    </Reanimated.View>
  );
}

function ScreenTimeDotGrid({
  total,
  awake,
  phone,
  sleep,
  mode,
  dark = false,
}: {
  total: number;
  awake: number;
  phone: number;
  sleep: number;
  mode: 'days' | 'years';
  dark?: boolean;
}) {
  const safeSleep = Math.max(0, Math.min(total, sleep));
  const safePhone = Math.max(0, Math.min(total - safeSleep, phone));
  const safeAwake = Math.max(0, Math.min(total - safeSleep - safePhone, awake));
  const compact = total > 100;

  return (
    <View style={[s.screenTimeDotGrid, compact && s.screenTimeDotGridCompact]}>
      {Array.from({ length: total }).map((_, index) => {
        const state =
          index < safeSleep
            ? 'sleep'
            : index < safeSleep + safeAwake
              ? 'awake'
              : index < safeSleep + safeAwake + safePhone
                ? 'phone'
                : 'dim';
        return (
          <View
            key={`${mode}-${index}`}
            style={[
              compact ? s.screenTimeDotSmall : s.screenTimeDot,
              state === 'sleep' && (dark ? s.screenTimeDotSleepOnDark : s.screenTimeDotSleep),
              state === 'awake' && (dark ? s.screenTimeDotAwakeOnDark : s.screenTimeDotAwake),
              state === 'phone' && s.screenTimeDotActive,
              state === 'dim' && (dark ? s.screenTimeDotDimOnDark : s.screenTimeDotDimLight),
            ]}
          />
        );
      })}
    </View>
  );
}

function ScreenTimeRecoveryDotGrid({
  total,
  sleep,
  productive,
  reclaimed,
  stillLost,
  mode,
}: {
  total: number;
  sleep: number;
  productive: number;
  reclaimed: number;
  stillLost: number;
  mode: 'savedDays' | 'savedYears';
}) {
  const safeSleep = Math.max(0, Math.min(total, sleep));
  const safeProductive = Math.max(0, Math.min(total - safeSleep, productive));
  const safeReclaimed = Math.max(0, Math.min(total - safeSleep - safeProductive, reclaimed));
  const safeStillLost = Math.max(0, Math.min(total - safeSleep - safeProductive - safeReclaimed, stillLost));
  const compact = total > 100;

  return (
    <View style={[s.screenTimeDotGrid, compact && s.screenTimeDotGridCompact]}>
      {Array.from({ length: total }).map((_, index) => {
        const state =
          index < safeSleep
            ? 'sleep'
            : index < safeSleep + safeProductive
            ? 'productive'
            : index < safeSleep + safeProductive + safeReclaimed
              ? 'reclaimed'
              : index < safeSleep + safeProductive + safeReclaimed + safeStillLost
                ? 'stillLost'
                : 'dim';
        return (
          <View
            key={`${mode}-recovery-${index}`}
            style={[
              compact ? s.screenTimeDotSmall : s.screenTimeDot,
              state === 'sleep' && s.screenTimeDotSleepOnDark,
              state === 'productive' && s.screenTimeDotProductive,
              state === 'reclaimed' && s.screenTimeDotReclaimed,
              state === 'stillLost' && s.screenTimeDotStillLost,
              state === 'dim' && s.screenTimeDotDimOnDark,
            ]}
          />
        );
      })}
    </View>
  );
}

function ScreenTimeResultPanel({ stat }: { stat: ReturnType<typeof protectStats> }) {
  return (
    <View style={s.screenTimeResultPanel}>
      <Text style={s.screenTimeResultKicker}>Based on that</Text>

      <View style={s.screenTimeResultGrid}>
        <Reanimated.View entering={optionEntrance(0, 140)} style={s.screenTimeMetric}>
          <Text style={s.screenTimeMetricValue}>{stat.usablePercent}%</Text>
          <Text style={s.screenTimeMetricLabel}>of your 16h productive day</Text>
        </Reanimated.View>
        <Reanimated.View entering={optionEntrance(1, 180)} style={s.screenTimeMetric}>
          <Text style={s.screenTimeMetricValue}>{stat.yearlyDays}</Text>
          <Text style={s.screenTimeMetricLabel}>days every year</Text>
        </Reanimated.View>
        <Reanimated.View entering={optionEntrance(2, 220)} style={s.screenTimeMetric}>
          <Text style={s.screenTimeMetricValue}>{formatYearValue(stat.lifetimeYears)}</Text>
          <Text style={s.screenTimeMetricLabel}>years over 85 years</Text>
        </Reanimated.View>
      </View>
    </View>
  );
}

function ScreenTimeReclaimPanel({ stat }: { stat: ReturnType<typeof protectStats> }) {
  return (
    <View style={s.screenTimeReclaimCard}>
      <Text style={s.screenTimeReclaimTitle}>Reduce it by 40%</Text>
      <Text style={s.screenTimeReclaimBody}>
        You can reclaim about <Text style={s.screenTimeReclaimStrong}>{stat.reclaimedDays} days a year</Text>,
        or <Text style={s.screenTimeReclaimStrong}> {formatYearValue(stat.reclaimedYears)} years</Text> over 85 years,
        for something real instead of your phone.
      </Text>
    </View>
  );
}

function SetupStartSlide({
  selected,
  displayName,
  onSelect,
  onNext,
}: {
  selected?: OnboardingChapter;
  displayName?: string;
  onSelect: (chapter: OnboardingChapter) => void;
  onNext: () => void;
}) {
  const [reveal, setReveal] = useState(0);
  const [localSelected, setLocalSelected] = useState<OnboardingChapter | undefined>(selected);
  const [departing, setDeparting] = useState(false);
  const departMotion = useSharedValue(0);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const name = nameForDisplay(displayName);
  const greeting = name ? `Thank you, ${name}.` : 'Thank you.';

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    setReveal(0);
    [120, 1420, 2520, 3040].forEach((delay, index) => {
      timers.push(setTimeout(() => setReveal(index + 1), delay));
    });
    timers.push(setTimeout(runAdvanceHaptic, 2580));
    timers.push(setTimeout(runAdvanceHaptic, 3100));

    return () => {
      timers.forEach(timer => clearTimeout(timer));
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!departing) setLocalSelected(selected);
  }, [departing, selected]);

  const handleChapterPress = (chapter: OnboardingChapter) => {
    if (departing) return;
    setLocalSelected(chapter);
    setDeparting(true);
    onSelect(chapter);
    departMotion.value = withTiming(1, {
      duration: 1420,
      easing: Easing.bezier(0.16, 1, 0.28, 1),
    });
    transitionTimerRef.current = setTimeout(() => {
      onNext();
    }, 1940);
  };

  const setupStartExitStyle = useAnimatedStyle(() => ({
    opacity: interpolate(departMotion.value, [0, 0.64, 1], [1, 0.58, 0]),
    transform: [
      { translateY: interpolate(departMotion.value, [0, 0.72, 1], [0, -8, -22]) },
      { scale: interpolate(departMotion.value, [0, 0.72, 1], [1, 0.996, 0.982]) },
    ],
  }));

  return (
    <GuidedSetupShell
      onNext={() => {}}
      ctaVisible={false}
      scrollSignal={`${reveal}-${localSelected ?? 'none'}-${departing ? 'departing' : 'idle'}`}
    >
      <Reanimated.View style={setupStartExitStyle}>
        {reveal >= 1 && (
          <ProtectSidePrompt
            motionKey="setup-start-thanks"
            compact
            segments={[{ text: greeting }]}
          />
        )}
        {reveal >= 2 && (
          <ProtectSidePrompt
            motionKey="setup-start-choice"
            compact
            segments={[{ text: 'Where do you want to start?' }]}
          />
        )}
        {reveal >= 3 && (
          <Reanimated.View
            entering={FadeIn.duration(360)}
            style={s.chapterChoiceStack}
          >
            <ChapterChoiceCard
              chapter="protect"
              index={0}
              visible={reveal >= 3}
              active={localSelected === 'protect'}
              departing={departing}
              selectedChapter={localSelected}
              title="Protect your time"
              body={'Screen time\nBlockers\nFocus'}
              icon={<Hourglass s={28} c={localSelected === 'protect' ? INK : GOLD} w={1.75} />}
              onPress={() => handleChapterPress('protect')}
            />
            <ChapterChoiceCard
              chapter="build"
              index={1}
              visible={reveal >= 4}
              active={localSelected === 'build'}
              departing={departing}
              selectedChapter={localSelected}
              title="Build your rhythm"
              body={'Big events\nHabits & routines\nDaily tasks'}
              icon={<ListChecks s={28} c={localSelected === 'build' ? INK : GOLD} w={2.15} />}
              onPress={() => handleChapterPress('build')}
            />
          </Reanimated.View>
        )}
      </Reanimated.View>
    </GuidedSetupShell>
  );
}

function ChapterChoiceCard({
  chapter,
  index,
  visible,
  active,
  departing = false,
  selectedChapter,
  title,
  body,
  icon,
  onPress,
}: {
  chapter: OnboardingChapter;
  index: number;
  visible: boolean;
  active: boolean;
  departing?: boolean;
  selectedChapter?: OnboardingChapter;
  title: string;
  body: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const revealMotion = useSharedValue(visible ? 1 : 0);
  const selectedMotion = useSharedValue(active ? 1 : 0);
  const departCardMotion = useSharedValue(0);

  useEffect(() => {
    selectedMotion.value = withTiming(active ? 1 : 0, {
      duration: active ? 320 : 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, selectedMotion]);

  useEffect(() => {
    revealMotion.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 860 : 220,
      easing: Easing.bezier(0.16, 1, 0.28, 1),
    });
  }, [revealMotion, visible]);

  useEffect(() => {
    departCardMotion.value = withTiming(departing ? 1 : 0, {
      duration: departing ? 1320 : 220,
      easing: Easing.bezier(0.16, 1, 0.28, 1),
    });
  }, [departCardMotion, departing]);

  const motionStyle = useAnimatedStyle(() => {
    const side = index === 0 ? -1 : 1;
    const chosen = selectedChapter === chapter;
    const depart = departCardMotion.value;
    const departOpacity = interpolate(
      depart,
      [0, 0.54, 1],
      chosen ? [1, 1, 0.82] : [1, 0.34, 0],
    );
    const departTranslateX = interpolate(
      depart,
      [0, 1],
      chosen ? [0, side * -4] : [0, side * 26],
    );
    const departTranslateY = interpolate(
      depart,
      [0, 1],
      chosen ? [0, -8] : [0, 18],
    );
    const departScale = interpolate(
      depart,
      [0, 0.66, 1],
      chosen ? [1, 1.032, 0.992] : [1, 0.965, 0.92],
    );
    return {
      opacity: revealMotion.value * departOpacity,
      transform: [
        {
          translateX:
            interpolate(revealMotion.value, [0, 0.72, 1], [side * 46, side * -3, 0]) +
            departTranslateX,
        },
        {
          translateY:
            interpolate(revealMotion.value, [0, 0.72, 1], [22, -2, 0]) +
            interpolate(selectedMotion.value, [0, 1], [0, -5]) +
            departTranslateY,
        },
        { scale: interpolate(revealMotion.value, [0, 0.72, 1], [0.94, 1.018, 1]) * departScale },
      ],
    };
  });
  const iconStabilizerStyle = useAnimatedStyle(() => {
    const chosen = selectedChapter === chapter;
    const depart = departCardMotion.value;
    const revealScale = interpolate(revealMotion.value, [0, 0.72, 1], [0.94, 1.018, 1]);
    const departScale = interpolate(
      depart,
      [0, 0.66, 1],
      chosen ? [1, 1.032, 0.992] : [1, 0.965, 0.92],
    );
    const scale = chosen ? 1 / Math.max(0.001, revealScale * departScale) : 1;
    return {
      transform: [{ scale }],
    };
  });

  return (
    <Reanimated.View
      pointerEvents={visible && !departing ? 'auto' : 'none'}
      style={[s.chapterChoiceWrap, active && s.chapterChoiceWrapActive, motionStyle]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        haptic="medium"
        onPress={onPress}
        style={[s.chapterChoiceCard, active && s.chapterChoiceCardActive]}
      >
        <View style={[s.chapterChoiceGlow, active && s.chapterChoiceGlowActive]} />
        <View style={s.chapterChoiceTopRow}>
          <View style={[s.chapterChoiceIcon, active && s.chapterChoiceIconActive]}>
            <Reanimated.View style={[s.chapterChoiceIconGlyph, iconStabilizerStyle]}>
              {icon}
            </Reanimated.View>
          </View>
        </View>
        <View style={[s.chapterChoiceRadio, active && s.chapterChoiceRadioActive]}>
          {active ? <CheckSmall s={14} c="#FFFFFF" w={2.6} /> : null}
        </View>
        <View style={s.chapterChoiceCopy}>
          <Text style={[s.chapterChoiceTitle, active && s.chapterChoiceTitleActive]}>{title}</Text>
          <View style={s.chapterChoiceDivider}>
            <View style={[s.chapterChoiceDividerLine, active && s.chapterChoiceDividerLineActive]} />
          </View>
          {body.split('\n').map(line => (
            <View key={line} style={s.chapterChoiceFeatureRow}>
              <View style={[s.chapterChoiceFeatureDot, active && s.chapterChoiceFeatureDotActive]} />
              <Text style={[s.chapterChoiceBody, active && s.chapterChoiceBodyActive]}>{line}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    </Reanimated.View>
  );
}

function chapterTitle(chapter: OnboardingChapter) {
  return chapter === 'protect' ? 'Protect your time' : 'Build your rhythm';
}

type CheckpointChapter = OnboardingChapter | 'rise' | 'tools';

function chapterRailTitle(chapter: CheckpointChapter) {
  if (chapter === 'protect') return 'Protect';
  if (chapter === 'build') return 'Organize';
  if (chapter === 'rise') return 'Grow';
  return 'Tools';
}

function checkpointCtaLabel(first: OnboardingChapter, final: boolean) {
  if (final) return 'Arise';
  return first === 'protect' ? 'Build my rhythm' : 'Protect my time';
}

function checkpointMessage(first: OnboardingChapter, final: boolean): PromptSegment[] {
  if (final) {
    return [
      { text: "Good. You can see the cost of distraction, and your weekly plan is ready.\nNow let's " },
      { text: 'return to what matters', highlight: true },
      { text: '.' },
    ];
  }

  if (first === 'protect') {
    return [
      { text: "Good. The problem is visible.\nNow let's " },
      { text: 'organize your time', highlight: true },
      { text: ' and ' },
      { text: 'build better habits', highlight: true },
      { text: '.' },
    ];
  }

  return [
    { text: "Good. Your weekly plan is ready.\nNow let's protect your time from " },
    { text: 'unwanted distractions', highlight: true },
    { text: '.' },
  ];
}

function checkpointTransitionMessage(first: OnboardingChapter, final: boolean): PromptSegment[] {
  if (final) {
    return [
      { text: "Good. You can see the cost of distraction, and your weekly plan is ready.\nNow let's " },
      { text: 'return to what matters', highlight: true },
      { text: '.' },
    ];
  }

  if (first === 'protect') {
    return [
      { text: "Good. The problem is visible.\nNow let's " },
      { text: 'organize your time', highlight: true },
      { text: ' and ' },
      { text: 'build better habits', highlight: true },
      { text: '.' },
    ];
  }

  return [
    { text: "Good. Your weekly plan is ready.\nNow let's protect your time from " },
    { text: 'unwanted distractions', highlight: true },
    { text: '.' },
  ];
}

function ChapterCheckpointSlide({
  firstChapter,
  final = false,
  onNext,
}: {
  firstChapter?: OnboardingChapter;
  final?: boolean;
  onNext: () => void;
}) {
  const first = firstChapter ?? 'protect';
  const [reveal, setReveal] = useState(0);
  const completedBefore = final ? 1 : 0;
  const completedAfter = final ? 2 : 1;
  const railCompleteCount = reveal >= 4 ? completedAfter : completedBefore;
  const sealFlight = useSharedValue(0);

  useEffect(() => {
    setReveal(0);
    sealFlight.value = 0;
    preloadTaskFeedbackSound();
    preloadAchievementFeedbackSound();
    const timers = [
      setTimeout(() => setReveal(1), 180),
      setTimeout(() => {
        setReveal(2);
        void playAchievementCompleteFeedback();
      }, 560),
      setTimeout(() => setReveal(3), 1540),
      setTimeout(() => {
        setReveal(4);
        sealFlight.value = withTiming(1, {
          duration: 780,
          easing: Easing.inOut(Easing.cubic),
        });
        void playTaskCompleteFeedback();
      }, 2380),
      setTimeout(() => setReveal(5), 3260),
      setTimeout(() => setReveal(6), 4200),
      setTimeout(() => setReveal(7), 5120),
    ];
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [final, first, sealFlight]);

  const sealFlightStyle = useAnimatedStyle(() => {
    const targetX = final ? 0 : -116;
    return {
      opacity: interpolate(sealFlight.value, [0, 0.72, 1], [1, 0.96, 0]),
      transform: [
        { translateX: interpolate(sealFlight.value, [0, 0.58, 1], [0, targetX * 0.18, targetX]) },
        { translateY: interpolate(sealFlight.value, [0, 0.62, 1], [0, -164, -226]) },
        { scale: interpolate(sealFlight.value, [0, 0.64, 1], [1, 0.44, 0.15]) },
      ],
    };
  });
  const congratsFlightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sealFlight.value, [0, 0.18, 0.46], [1, 0.85, 0]),
    transform: [
      { translateY: interpolate(sealFlight.value, [0, 0.46], [0, -9]) },
      { scale: interpolate(sealFlight.value, [0, 0.46], [1, 0.97]) },
    ],
  }));

  useEffect(() => {
    if (reveal === 7) runBubbleHaptic();
  }, [reveal]);

  return (
    <GuidedSetupShell onNext={onNext} ctaLabel={checkpointCtaLabel(first, final)} ctaVisible={reveal >= 7}>
      <View style={s.chapterCheckpointStage}>
        <View style={s.chapterCheckpointSealSlot}>
          {reveal >= 1 && reveal < 5 && (
            <Reanimated.View
              entering={FadeIn.duration(760).withInitialValues({
                opacity: 0,
                transform: [{ translateY: 18 }, { scale: 0.74 }],
              })}
              exiting={FadeOut.duration(1060)}
              style={s.chapterCheckpointAchievement}
            >
              <Reanimated.View style={[s.chapterCheckpointSealFlight, sealFlightStyle]}>
                <View style={s.chapterCheckpointSeal}>
                  <View style={s.chapterCheckpointSealGlow} />
                  {reveal >= 2 && <CheckpointFlameBurst />}
                </View>
              </Reanimated.View>
              {reveal >= 2 && (
                <Reanimated.Text
                  entering={FadeIn.delay(360).duration(640).withInitialValues({
                    opacity: 0,
                    transform: [{ translateY: 10 }, { scale: 0.97 }],
                  })}
                  style={[s.chapterCheckpointCongrats, congratsFlightStyle]}
                >
                  Congratulations!
                </Reanimated.Text>
              )}
            </Reanimated.View>
          )}
        </View>

        <View style={s.chapterCheckpointRailSlot}>
          {reveal >= 3 && (
            <ChapterCheckpointRail
              first={first}
              completedCount={railCompleteCount}
              previousCompletedCount={completedBefore}
            />
          )}
        </View>

        <View style={s.chapterCheckpointCoachSlot}>
          {reveal >= 6 && (
            <Reanimated.View
              entering={FadeIn.duration(620).withInitialValues({
                opacity: 0,
                transform: [{ translateY: 10 }, { scale: 0.98 }],
              })}
              style={s.chapterCheckpointCoach}
            >
              <Reanimated.View
                entering={FadeIn.duration(680).withInitialValues({
                  opacity: 0,
                  transform: [{ translateY: 10 }, { scale: 0.94 }],
                })}
                style={s.chapterCheckpointLogoFrame}
              >
                <View style={s.messageLogoHalo} />
                <View style={s.messageLogoPlate}>
                  <Image source={APP_LOGO} style={s.messageLogo} resizeMode="cover" />
                </View>
              </Reanimated.View>
              {reveal >= 7 && (
                <Reanimated.View
                  entering={FadeIn.duration(620).withInitialValues({
                    opacity: 0,
                    transform: [{ translateX: -10 }, { translateY: 8 }, { scale: 0.92 }],
                  })}
                  style={s.chapterCheckpointBubble}
                >
                  <View style={s.messageBubbleTail} />
                  <ProtectPromptText segments={checkpointTransitionMessage(first, final)} />
                </Reanimated.View>
              )}
            </Reanimated.View>
          )}
        </View>
      </View>
    </GuidedSetupShell>
  );
}

function CheckpointFlameBurst() {
  return (
    <Reanimated.View
      entering={FadeIn.duration(300).withInitialValues({
        opacity: 0,
        transform: [{ scale: 0.54 }, { translateY: 8 }],
      })}
      style={s.checkpointFlameBurst}
    >
      <View style={s.checkpointFlameAura} />
      <FocusLottie name="flame" loop speed={0.82} style={s.checkpointFlameLottie} />
    </Reanimated.View>
  );
}

function CheckpointRailFlame() {
  return (
    <Reanimated.View
      entering={FadeIn.duration(420).withInitialValues({
        opacity: 0,
        transform: [{ scale: 0.24 }, { translateY: 8 }],
      })}
      style={s.chapterCheckpointRailFlameWrap}
    >
      <FocusLottie name="flame" loop speed={0.9} style={s.chapterCheckpointRailFlame} />
    </Reanimated.View>
  );
}

function ChapterCheckpointLineFill({ animate }: { animate: boolean }) {
  const progress = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    progress.value = animate ? 0 : 1;
    if (animate) {
      progress.value = withTiming(1, {
        duration: 760,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [animate, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    opacity: interpolate(progress.value, [0, 0.18, 1], [0, 1, 1]),
  }));

  return <Reanimated.View style={[s.chapterCheckpointStepLineFill, fillStyle]} />;
}

function ChapterCheckpointStepDot({ done, animate }: { done: boolean; animate: boolean }) {
  const pop = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    pop.value = animate ? 0 : 1;
    if (animate) {
      pop.value = withTiming(1, {
        duration: 860,
        easing: Easing.bezier(0.16, 1, 0.28, 1),
      });
    }
  }, [animate, pop]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(pop.value, [0, 0.48, 0.78, 1], [3, -4.5, 0.8, 0]) },
      { scale: interpolate(pop.value, [0, 0.46, 0.78, 1], [0.86, 1.14, 0.99, 1]) },
    ],
  }));

  return (
    <Reanimated.View style={[s.chapterCheckpointStepDot, done && s.chapterCheckpointStepDotDone, popStyle]}>
      {done ? <CheckpointRailFlame /> : null}
    </Reanimated.View>
  );
}

function ChapterCheckpointRail({
  first,
  completedCount,
  previousCompletedCount,
}: {
  first: OnboardingChapter;
  completedCount: number;
  previousCompletedCount: number;
}) {
  const second = first === 'protect' ? 'build' : 'protect';
  const steps: CheckpointChapter[] = [
    first,
    second,
    'rise',
  ];

  return (
    <View style={s.chapterCheckpointRail}>
      {steps.map((step, index) => {
        const done = index < completedCount;
        const isNewlyCompleted = done && index >= previousCompletedCount;
        return (
          <Reanimated.View
            key={`${step}-${index}`}
            entering={FadeIn.delay(index * 105).duration(430).withInitialValues({
              opacity: 0,
              transform: [{ translateY: 8 }, { scale: 0.97 }],
            })}
            style={s.chapterCheckpointStep}
          >
            <View style={[s.chapterCheckpointStepLine, done && s.chapterCheckpointStepLineDone]}>
              {done && <ChapterCheckpointLineFill key={`${step}-${index}`} animate={isNewlyCompleted} />}
            </View>
            <ChapterCheckpointStepDot done={done} animate={isNewlyCompleted} />
            <Text style={[s.chapterCheckpointStepText, done && s.chapterCheckpointStepTextDone]}>
              {chapterRailTitle(step)}
            </Text>
          </Reanimated.View>
        );
      })}
    </View>
  );
}

function ChapterChecklistItem({ title, done }: { title: string; done: boolean }) {
  return (
    <Reanimated.View
      entering={FadeIn.duration(460).withInitialValues({
        opacity: 0,
        transform: [{ translateY: 12 }, { scale: 0.985 }],
      })}
      style={[s.chapterChecklistItem, done && s.chapterChecklistItemDone]}
    >
      <View style={[s.chapterChecklistCheck, done && s.chapterChecklistCheckDone]}>
        {done ? <CheckSmall s={15} c="#FFFFFF" w={2.6} /> : null}
      </View>
      <Text style={[s.chapterChecklistText, done && s.chapterChecklistTextDone]}>{title}</Text>
      {done ? <View style={s.chapterChecklistStrike} /> : null}
    </Reanimated.View>
  );
}

function ProtectStatCard({
  index,
  value,
  label,
  body,
  accent = GOLD,
}: {
  index: number;
  value: string;
  label: string;
  body: string;
  accent?: string;
}) {
  return (
    <Reanimated.View entering={optionEntrance(index, 150)} style={s.protectStatCard}>
      <View style={[s.protectStatAccent, { backgroundColor: accent }]} />
      <View style={s.protectStatValueRow}>
        <Text style={s.protectStatValue}>{value}</Text>
        <Text style={s.protectStatLabel}>{label}</Text>
      </View>
      <Text style={s.protectStatBody}>{body}</Text>
    </Reanimated.View>
  );
}

function screenTimeComment(hours: number) {
  if (hours <= 4) return 'Well, that is OK, but it can still be better.';
  return 'That is a meaningful part of your day.';
}

function UserMessageBubble({ text, delay = 0 }: { text: string; delay?: number }) {
  useEffect(() => {
    const timer = setTimeout(runSelectionHaptic, delay + 80);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Reanimated.View
      entering={FadeInRight.delay(delay).duration(620).easing(Easing.bezier(0.16, 1, 0.28, 1)).withInitialValues({
        opacity: 0,
        transform: [{ translateX: 24 }, { translateY: 8 }, { scale: 0.975 }],
      })}
      style={s.userReplyWrap}
    >
      <View style={s.userReplyBubble}>
        <Text style={s.userReplyText}>{text}</Text>
      </View>
    </Reanimated.View>
  );
}

function ScreenTimeUserReply({ hours }: { hours: number }) {
  return <UserMessageBubble text={`I spend ${formatHourValue(hours)}h per day.`} delay={260} />;
}

function ProtectCalculationSlide({ screenTimeHours, onNext }: { screenTimeHours?: number; onNext: () => void }) {
  const stat = protectStats(screenTimeHours);
  const comment = screenTimeComment(stat.hours);

  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Keep going">
      <ScreenTimeUserReply hours={stat.hours} />
      <ProtectSidePrompt
        motionKey={`protect-calculation-${stat.hours}`}
        segments={[
          { text: comment },
          { text: '\nAt that pace, here is what your phone is asking from your ' },
          { text: 'time', highlight: true },
          { text: '.' },
        ]}
      />

      <Reanimated.View
        entering={FadeIn.delay(1500).duration(620).withInitialValues({
          opacity: 0,
          transform: [{ translateY: 18 }, { scale: 0.975 }],
        })}
        style={s.protectStatStack}
      >
        <ProtectStatCard
          index={0}
          value={`${stat.usablePercent}%`}
          label="of your 16h productive day"
          body={`Assuming 8h of sleep, ${formatHourValue(stat.hours)}h is ${stat.usablePercent}% of the time you can actually use.`}
        />
        <ProtectStatCard
          index={1}
          value={`${stat.yearlyDays}`}
          label="days every year"
          body="Full days that can disappear into a phone."
          accent="#8A8177"
        />
        <ProtectStatCard
          index={2}
          value={`${formatYearValue(stat.lifetimeYears)}`}
          label="years over 85 years"
          body="Time that could have gone into prayer, work, study, health, and people."
          accent="#1C1917"
        />
      </Reanimated.View>
    </GuidedSetupShell>
  );
}

function ProtectReframeSlide({ screenTimeHours, onNext }: { screenTimeHours?: number; onNext: () => void }) {
  const stat = protectStats(screenTimeHours);

  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Set guardrails">
      <ProtectSidePrompt
        motionKey="protect-reframe"
        segments={[
          { text: 'This is not here to shame you.' },
          { text: '\nIf you reduce that by only ' },
          { text: '40%', highlight: true },
          { text: ', you can get real days back.' },
        ]}
      />

      <Reanimated.View
        entering={FadeIn.delay(1480).duration(620).withInitialValues({
          opacity: 0,
          transform: [{ translateY: 18 }, { scale: 0.975 }],
        })}
        style={s.protectGainCard}
      >
        <Text style={s.protectGainNumber}>{stat.reclaimedDays}</Text>
        <Text style={s.protectGainUnit}>days back</Text>
        <Text style={s.protectGainBody}>for prayer, work, study, health, and the people in front of you.</Text>
      </Reanimated.View>
    </GuidedSetupShell>
  );
}

const APP_BLOCKER_OPTIONS = [
  { key: 'adult', label: 'Adult content', tone: 'ink' },
  { key: 'gambling', label: 'Gambling', tone: 'rose' },
  { key: 'gaming', label: 'Gaming', tone: 'purple' },
  { key: 'other', label: 'Other traps', tone: 'gold' },
] as const;

function ProtectAppBlockersSlide({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<string[]>(['adult', 'gaming']);
  const toggle = (key: string) => {
    runSelectionHaptic();
    setSelected(prev => (prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key]));
  };

  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Continue">
      <GuidedHero
        eyebrow="App blockers"
        title="Move addictive apps out of reach."
        body="Choose what usually pulls you back. We will turn these choices into guardrails later."
        icon={<SlidersHorizontal s={42} c={GOLD} w={1.8} />}
      />

      <View style={s.protectBlockerGrid}>
        {APP_BLOCKER_OPTIONS.map((item, index) => (
          <ProtectBlockerOption
            key={item.key}
            index={index}
            label={item.label}
            active={selected.includes(item.key)}
            onPress={() => toggle(item.key)}
          />
        ))}
      </View>
    </GuidedSetupShell>
  );
}

const WEBSITE_BLOCKER_OPTIONS = [
  { title: 'Adult sites', examples: 'explicit sites, hidden tabs' },
  { title: 'Gambling', examples: 'betting, casino, odds' },
  { title: 'Gaming', examples: 'games, streams, endless loops' },
  { title: 'Other traps', examples: 'shorts, gossip, doomscrolling' },
];

function ProtectWebsiteBlockersSlide({ onNext }: { onNext: () => void }) {
  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Protect focus">
      <GuidedHero
        eyebrow="Website blockers"
        title="Move addictive websites out of reach."
        body="Far from the eyes, far from the heart. Start with categories, then fine-tune individual websites later."
        icon={<Target s={42} c={GOLD} w={1.8} />}
      />

      <View style={s.websiteStack}>
        {WEBSITE_BLOCKER_OPTIONS.map((item, index) => (
          <Reanimated.View key={item.title} entering={optionEntrance(index, 120)} style={s.websiteCard}>
            <View style={s.websiteIcon}><Text style={s.websiteIconText}>{index + 1}</Text></View>
            <View style={s.websiteCopy}>
              <Text style={s.websiteTitle}>{item.title}</Text>
              <Text style={s.websiteExamples}>{item.examples}</Text>
            </View>
            <View style={s.websiteSwitch}><View style={s.websiteSwitchKnob} /></View>
          </Reanimated.View>
        ))}
      </View>
    </GuidedSetupShell>
  );
}

function ProtectBlockerOption({
  label,
  active,
  onPress,
  index,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  index: number;
}) {
  return (
    <Reanimated.View entering={optionEntrance(index, 130)} style={s.protectBlockerWrap}>
      <TouchableOpacity activeOpacity={0.88} haptic="none" onPress={onPress} style={[s.protectBlockerOption, active && s.protectBlockerOptionActive]}>
        <View style={[s.protectBlockerCheck, active && s.protectBlockerCheckActive]}>
          {active ? <CheckSmall s={15} c="#FFFFFF" w={2.6} /> : null}
        </View>
        <Text style={[s.protectBlockerLabel, active && s.protectBlockerLabelActive]}>{label}</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );
}

function ProtectFocusBlockSlide({ onNext }: { onNext: () => void }) {
  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Complete chapter">
      <GuidedHero
        eyebrow="Interruptions"
        title="Protect one block from being disturbed."
        body="A quiet window is easier to keep when your phone knows when to stay silent."
        icon={<Target s={42} c={GOLD} w={1.8} />}
      />

      <View style={s.focusPreviewCard}>
        <View style={s.focusPreviewHeader}>
          <Text style={s.focusPreviewLabel}>Focus block</Text>
          <Text style={s.focusPreviewTime}>09:00 - 10:30</Text>
        </View>
        <View style={s.focusPreviewTimer}>
          <Text style={s.focusPreviewTimerText}>90</Text>
          <Text style={s.focusPreviewTimerUnit}>minutes</Text>
        </View>
        <View style={s.focusPreviewRow}>
          <View style={s.focusPreviewPill}><BellRing s={14} c={GOLD} w={1.8} /><Text style={s.focusPreviewPillText}>Do Not Disturb</Text></View>
          <View style={s.focusPreviewPill}><Clock s={14} c={GOLD} w={1.8} /><Text style={s.focusPreviewPillText}>Focus Timer</Text></View>
        </View>
      </View>
    </GuidedSetupShell>
  );
}

function ProtectCompleteSlide({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Build my rhythm">
      <ProtectSidePrompt
        motionKey="protect-complete"
        segments={[
          { text: 'Your time now has ' },
          { text: 'guardrails', highlight: true },
          { text: '.\nNext, we will give that protected time a rhythm.' },
        ]}
      />

      <Reanimated.View
        entering={FadeIn.delay(1420).duration(560).withInitialValues({
          opacity: 0,
          transform: [{ translateY: 18 }, { scale: 0.975 }],
        })}
      >
        <ProtectGuardrailChecklist animate />
      </Reanimated.View>

      <Reanimated.View
        entering={FadeIn.delay(2260).duration(560).withInitialValues({
          opacity: 0,
          transform: [{ translateY: 16 }, { scale: 0.98 }],
        })}
        style={s.completeChecklist}
      >
        {[
          { label: 'Protect your time', done: true },
          { label: 'Build your rhythm', done: false },
          { label: 'Rise again', done: false },
        ].map((item, index) => (
          <Reanimated.View key={item.label} entering={optionEntrance(index, 120)} style={[s.completeItem, item.done && s.completeItemDone]}>
            <View style={[s.completeCheck, item.done && s.completeCheckDone]}>
              {item.done ? <CheckSmall s={16} c="#FFFFFF" w={2.6} /> : null}
            </View>
            <Text style={[s.completeText, item.done && s.completeTextDone]}>{item.label}</Text>
            {item.done ? <View style={s.completeStrike} /> : null}
          </Reanimated.View>
        ))}
      </Reanimated.View>
    </GuidedSetupShell>
  );
}

function BuildIntroSlide({ onNext }: { onNext: () => void }) {
  const [reveal, setReveal] = useState(0);

  useEffect(() => {
    const timings = [420, 1180, 1960, 3420, 4140, 4860, 5640, 7240, 7980];
    const timers = timings.map((delay, index) => (
      setTimeout(() => setReveal(index + 1), delay)
    ));
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return (
    <GuidedSetupShell
      onNext={onNext}
      ctaLabel="Let's start"
      ctaDelay={180}
      scrollSignal={reveal}
      autoScrollOnContentChange
      ctaVisible={reveal >= 9}
    >
      {reveal >= 1 && (
        <ProtectSidePrompt
          motionKey="build-plan-intro"
          segments={[
            { text: 'Discipline starts with a ' },
            { text: 'plan', highlight: true },
            { text: '.' },
          ]}
        />
      )}
      {reveal >= 2 && (
        <ProtectSidePrompt
          motionKey="build-plan-difference"
          segments={[
            { text: 'And the ' },
            { text: 'difference', highlight: true },
            { text: ' is real.' },
          ]}
        />
      )}
      {reveal >= 3 && (
        <BuildResearchChart
          title="Plan vs No plan"
          subtitle="How likely people are to finish what they set out to do"
          citation="Gollwitzer & Brandstätter, 1997"
          rows={[
            { label: 'Goal only', value: 32 },
            { label: 'Goal + clear plan', value: 71, featured: true },
          ]}
        />
      )}
      {reveal >= 4 && (
        <ProtectSidePrompt
          motionKey="build-even-motivated"
          segments={[
            { text: 'Even if you are highly ' },
            { text: 'motivated', highlight: true },
            { text: '.' },
          ]}
        />
      )}
      {reveal >= 5 && (
        <ProtectSidePrompt
          motionKey="build-odds"
          segments={[
            { text: 'Odds are ' },
            { text: 'against you', highlight: true },
            { text: '.' },
          ]}
        />
      )}
      {reveal >= 6 && <BuildStructureThesis />}
      {reveal >= 7 && (
        <BuildResearchChart
          title="Motivation vs Structure"
          subtitle="What actually gets people to show up and do the work"
          citation="Milne, Orbell & Sheeran, 2002"
          rows={[
            { label: 'Motivation only', value: 35 },
            { label: 'Motivation + clear plan', value: 91, featured: true },
          ]}
        />
      )}
      {reveal >= 8 && (
        <ProtectSidePrompt
          motionKey="build-about-to-build"
          segments={[
            { text: "That's what we're about to " },
            { text: 'build', highlight: true },
            { text: '.' },
          ]}
        />
      )}
      {reveal >= 9 && (
        <ProtectSidePrompt
          motionKey="build-rhythm-close"
          segments={[
            { text: 'Good habits, clear goals, and a rhythm you can keep — ' },
            { text: "let's build it together", highlight: true },
            { text: '.' },
          ]}
        />
      )}
    </GuidedSetupShell>
  );
}

type BuildResearchRow = {
  label: string;
  value: number;
  featured?: boolean;
};

function BuildResearchChart({
  title,
  subtitle,
  citation,
  rows,
}: {
  title: string;
  subtitle: string;
  citation: string;
  rows: BuildResearchRow[];
}) {
  useEffect(() => {
    runStrongHaptic();
  }, []);

  return (
    <Reanimated.View
      entering={FadeIn.duration(700).withInitialValues({
        opacity: 0,
        transform: [{ translateY: 18 }, { scale: 0.965 }],
      })}
      style={s.buildResearchCard}
    >
      <View style={s.buildResearchHeading}>
        <Text style={s.buildResearchTitle}>{title}</Text>
        <View style={s.buildResearchRule} />
      </View>
      <Text style={s.buildResearchSubtitle}>{subtitle}</Text>
      <View style={s.buildResearchRows}>
        {rows.map((row, index) => (
          <BuildResearchBar key={row.label} row={row} index={index} />
        ))}
      </View>
      <Text style={s.buildResearchCitation}>{citation}</Text>
    </Reanimated.View>
  );
}

function BuildResearchBar({ row, index }: { row: BuildResearchRow; index: number }) {
  return (
    <Reanimated.View
      entering={FadeIn.delay(220 + index * 360).duration(620).withInitialValues({
        opacity: 0,
        transform: [{ translateX: -12 }],
      })}
      style={s.buildResearchRow}
    >
      <View style={s.buildResearchRowTop}>
        <Text style={[s.buildResearchLabel, row.featured && s.buildResearchLabelFeatured]}>{row.label}</Text>
        <Text style={[s.buildResearchValue, row.featured && s.buildResearchValueFeatured]}>{row.value}%</Text>
      </View>
      <View style={s.buildResearchTrack}>
        <Reanimated.View
          entering={FadeIn.delay(320 + index * 360).duration(760).withInitialValues({
            opacity: 0,
            transform: [{ scaleX: 0.36 }],
          })}
          style={[
            s.buildResearchFill,
            row.featured && s.buildResearchFillFeatured,
            { width: `${row.value}%` },
          ]}
        />
      </View>
    </Reanimated.View>
  );
}

function BuildStructureThesis() {
  useEffect(() => {
    runStrongHaptic();
  }, []);

  return (
    <Reanimated.View
      entering={FadeIn.duration(620).withInitialValues({
        opacity: 0,
        transform: [{ translateY: 14 }, { scale: 0.97 }],
      })}
      style={s.buildThesisCard}
    >
      <Text style={s.buildThesisText}>Structure</Text>
      <Text style={s.buildThesisOperator}>&gt;</Text>
      <Text style={s.buildThesisText}>Motivation</Text>
    </Reanimated.View>
  );
}

function BuildBigEventsSlide({ onNext }: { onNext: () => void }) {
  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Add event">
      <GuidedHero
        eyebrow="Big Events"
        title="Keep important dates in front of you before they become urgent."
        body="We start with what is coming, because pressure is easier to handle when you can see it early."
        icon={<Calendar s={42} c={GOLD} w={1.7} />}
      />

      <View style={s.buildBigEventCard}>
        <View style={s.buildBigEventIcon}>
          <NotoEmoji name={normalizeHabitIcon('birthday-cake')} size={28} />
        </View>
        <View style={s.buildBigEventCopy}>
          <Text style={s.buildBigEventLabel}>Big Event</Text>
          <Text style={s.buildBigEventTitle}>Birthday</Text>
          <Text style={s.buildBigEventMeta}>In 7 days</Text>
        </View>
      </View>
    </GuidedSetupShell>
  );
}

const BUILD_GOALS = ['Prayer rule', 'Fitness', 'Study', 'Reading', 'Work', 'Family'];

function BuildMonthlyGoalsSlide({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState(['Prayer rule', 'Fitness']);
  const toggle = (goal: string) => {
    runSelectionHaptic();
    setSelected(prev => (prev.includes(goal) ? prev.filter(item => item !== goal) : [...prev, goal]));
  };

  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Set direction">
      <GuidedHero
        eyebrow="Monthly Goals"
        title="Give your month a direction."
        body="Goals do not replace daily discipline. They give it somewhere to go."
        icon={<Target s={42} c={GOLD} w={1.8} />}
      />

      <View style={s.buildGoalGrid}>
        {BUILD_GOALS.map((goal, index) => {
          const active = selected.includes(goal);
          return (
            <Reanimated.View key={goal} entering={optionEntrance(index, 120)} style={s.buildGoalWrap}>
              <TouchableOpacity activeOpacity={0.88} haptic="none" onPress={() => toggle(goal)} style={[s.buildGoalChip, active && s.buildGoalChipActive]}>
                <Text style={[s.buildGoalText, active && s.buildGoalTextActive]}>{goal}</Text>
              </TouchableOpacity>
            </Reanimated.View>
          );
        })}
      </View>
    </GuidedSetupShell>
  );
}

function BuildWeeklyRhythmSlide({ onNext }: { onNext: () => void }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Continue">
      <GuidedHero
        eyebrow="Weekly Rhythm"
        title="Let&apos;s set up your weekly rhythm together."
        body="A week should not feel like seven separate battles. It should have a shape."
        icon={<Calendar s={42} c={GOLD} w={1.7} />}
      />

      <View style={s.weekRhythmCard}>
        {days.map((day, index) => (
          <Reanimated.View key={day} entering={optionEntrance(index, 110)} style={s.weekColumn}>
            <Text style={s.weekDay}>{day}</Text>
            <View style={[s.weekBar, { height: 44 + ((index * 17) % 58) }]} />
            <View style={s.weekDot} />
          </Reanimated.View>
        ))}
      </View>
    </GuidedSetupShell>
  );
}

function BuildTaskTypesSlide({ onNext }: { onNext: () => void }) {
  return <TaskTypesSlide onNext={onNext} />;
}

function taskTypeByKey(key: string) {
  return TASK_TYPES.find(item => item.key === key) ?? TASK_TYPES[0];
}

function BuildTaskSetupSlide({
  onNext,
  typeKey,
  eyebrow,
  title,
  body,
  cta,
  chips,
}: {
  onNext: () => void;
  typeKey: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  chips: string[];
}) {
  const preview = taskTypeByKey(typeKey);
  const [selected, setSelected] = useState(chips[0]);

  return (
    <GuidedSetupShell onNext={onNext} ctaLabel={cta}>
      <GuidedHero
        eyebrow={eyebrow}
        title={title}
        body={body}
        icon={<ListChecks s={42} c={GOLD} w={1.8} />}
      />

      <View style={s.buildTaskPreview}>
        <AnyTaskCard task={preview.task} streak={preview.streak} />
      </View>

      <View style={s.buildChoiceGrid}>
        {chips.map((chip, index) => {
          const active = selected === chip;
          return (
            <Reanimated.View key={chip} entering={optionEntrance(index, 130)} style={s.buildChoiceWrap}>
              <TouchableOpacity activeOpacity={0.88} haptic="none" onPress={() => {
                runSelectionHaptic();
                setSelected(chip);
              }} style={[s.buildChoice, active && s.buildChoiceActive]}>
                <Text style={[s.buildChoiceText, active && s.buildChoiceTextActive]}>{chip}</Text>
              </TouchableOpacity>
            </Reanimated.View>
          );
        })}
      </View>
    </GuidedSetupShell>
  );
}

function BuildHabitsSlide({ onNext }: { onNext: () => void }) {
  return (
    <BuildTaskSetupSlide
      onNext={onNext}
      typeKey="habit"
      eyebrow="Habits"
      title="Turn repeated actions into a stable rhythm."
      body="Start with one small action you want to repeat until it becomes part of your day."
      cta="Add habit"
      chips={['Morning walk', 'Workout', 'Read 10 pages', 'No phone morning']}
    />
  );
}

function BuildSpiritualTasksSlide({ onNext }: { onNext: () => void }) {
  return (
    <BuildTaskSetupSlide
      onNext={onNext}
      typeKey="spiritual"
      eyebrow="Spiritual Tasks"
      title="Keep prayer, reading, and spiritual discipline visible in your week."
      body="Your spiritual life should not live only in memory. Give it a clear place."
      cta="Add spiritual task"
      chips={['Morning prayer', 'Scripture reading', 'Jesus Prayer', 'Evening examen']}
    />
  );
}

function BuildRoutineTasksSlide({ onNext }: { onNext: () => void }) {
  return (
    <BuildTaskSetupSlide
      onNext={onNext}
      typeKey="routine"
      eyebrow="Routine Tasks"
      title="Give repeated responsibilities a clear place."
      body="Morning and evening routines make ordinary responsibilities easier to return to."
      cta="Add routine"
      chips={['Plan the day', 'Evening reset', 'Clean desk', 'Prepare tomorrow']}
    />
  );
}

function BuildChallengesSlide({ onNext }: { onNext: () => void }) {
  return (
    <BuildTaskSetupSlide
      onNext={onNext}
      typeKey="challenge"
      eyebrow="Challenges"
      title="Choose a short battle and finish it."
      body="A challenge gives a serious season a beginning, an end, and a visible commitment."
      cta="Pick challenge"
      chips={['7-day prayer', 'No social media', 'Reading plan', 'Cold shower']}
    />
  );
}

function BuildQuickTasksSlide({ onNext }: { onNext: () => void }) {
  return (
    <BuildTaskSetupSlide
      onNext={onNext}
      typeKey="quick"
      eyebrow="Quick Tasks"
      title="Capture small things without breaking your flow."
      body="Not everything needs a system. Some things just need to be caught quickly."
      cta="Add quick task"
      chips={['Reply to Mark', 'Buy candles', 'Send file', 'Call back']}
    />
  );
}

function BuildMyRoutineSlide({ onNext }: { onNext: () => void }) {
  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Preview Home">
      <GuidedHero
        eyebrow="My Routine"
        title="This is where your week lives."
        body="Use My Routine to adjust habits, tasks, spiritual commitments, and weekly structure in one place."
        icon={<ListChecks s={42} c={GOLD} w={1.8} />}
      />

      <View style={s.myRoutineMock}>
        {['Morning', 'Work block', 'Evening', 'Spiritual'].map((label, index) => (
          <Reanimated.View key={label} entering={optionEntrance(index, 120)} style={s.myRoutineRow}>
            <View style={s.myRoutineTime}><Text style={s.myRoutineTimeText}>{index === 0 ? '07:00' : index === 1 ? '10:00' : index === 2 ? '20:30' : '21:00'}</Text></View>
            <View style={s.myRoutineCopy}>
              <Text style={s.myRoutineTitle}>{label}</Text>
              <Text style={s.myRoutineMeta}>{index + 2} planned items</Text>
            </View>
            <View style={s.myRoutineHandle} />
          </Reanimated.View>
        ))}
      </View>
    </GuidedSetupShell>
  );
}

function BuildHomePreviewSlide({ onNext }: { onNext: () => void }) {
  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Complete build">
      <GuidedHero
        eyebrow="Home"
        title="Your first day is no longer empty."
        body="The pieces you chose now have a place to appear when the app opens."
        icon={<Home s={42} c={GOLD} w={1.8} />}
      />

      <View style={s.buildHomePreviewShell}>
        <ValueOrganizePhone />
      </View>
    </GuidedSetupShell>
  );
}

function BuildCompleteSlide({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, []);

  return (
    <GuidedSetupShell onNext={onNext} ctaLabel="Rise again">
      <GuidedHero
        eyebrow="Chapter complete"
        title="Your rhythm is in place."
        body="You can see the cost of distraction. Your week has structure. Next, we keep what matters close."
        icon={<CheckSmall s={42} c={GOLD} w={2.2} />}
      />

      <View style={s.completeChecklist}>
        {[
          { label: 'Protect your time', done: true },
          { label: 'Build your rhythm', done: true },
          { label: 'Rise again', done: false },
        ].map((item, index) => (
          <Reanimated.View key={item.label} entering={optionEntrance(index, 120)} style={[s.completeItem, item.done && s.completeItemDone]}>
            <View style={[s.completeCheck, item.done && s.completeCheckDone]}>
              {item.done ? <CheckSmall s={16} c="#FFFFFF" w={2.6} /> : null}
            </View>
            <Text style={[s.completeText, item.done && s.completeTextDone]}>{item.label}</Text>
            {item.done ? <View style={s.completeStrike} /> : null}
          </Reanimated.View>
        ))}
      </View>
    </GuidedSetupShell>
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
        <Text style={s.screenTimeUnit}>days every year</Text>
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
          {option.body ? (
            <Text style={[s.optionBody, variant === 'question' && s.questionOptionBody]}>{option.body}</Text>
          ) : null}
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
      runBubbleHaptic();
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
      <View style={s.promptRow}>
        <Reanimated.View style={mascotMotionStyle}>
          <View style={s.mascotShell}>
            <Reanimated.View style={[s.mascotHalo, mascotHaloStyle]} />
            <Image source={APP_LOGO} style={s.mascotLogo} resizeMode="cover" />
          </View>
        </Reanimated.View>
        <Reanimated.View style={[s.speechBubble, s.questionSpeechBubble, speechBubbleIntroStyle]}>
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
  const isLongList = step === 'tradition' || step === 'reason' || step === 'valueReflect';
  const shouldScroll = isLongList || height < 720;

  const questionContent = (
    <>
      <QuestionPrompt copy={copy} response={selectedResponse} motionKey={selectedValues.join('|')} />

      <View style={[s.optionsStack, isLongList && s.optionsStackLong]}>
        {options.map((option, optionIndex) => {
          const active = selectedValues.includes(option.value);
          return (
            <Reanimated.View key={option.value} entering={optionEntrance(optionIndex, 1140)}>
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

const V4_PROGRESS_SLOTS = ['Protect', 'Organize', 'Grow', 'Tools'] as const;

function V4ProgressRail({
  completedCount,
  previousCompletedCount = completedCount,
  showTools = completedCount >= 4,
}: {
  completedCount: number;
  previousCompletedCount?: number;
  showTools?: boolean;
}) {
  const slots = showTools ? V4_PROGRESS_SLOTS : V4_PROGRESS_SLOTS.slice(0, 3);

  return (
    <View style={s.chapterCheckpointRail}>
      {slots.map((label, index) => {
        const done = index < completedCount;
        const isNewlyCompleted = done && index >= previousCompletedCount;
        return (
          <Reanimated.View
            key={label}
            entering={FadeIn.delay(index * 105).duration(430).withInitialValues({
              opacity: 0,
              transform: [{ translateY: 8 }, { scale: 0.97 }],
            })}
            style={s.chapterCheckpointStep}
          >
            <View style={[s.chapterCheckpointStepLine, done && s.chapterCheckpointStepLineDone]}>
              {done && <ChapterCheckpointLineFill key={`${label}-${index}`} animate={isNewlyCompleted} />}
            </View>
            <ChapterCheckpointStepDot done={done} animate={isNewlyCompleted} />
            <Text style={[s.chapterCheckpointStepText, done && s.chapterCheckpointStepTextDone]}>{label}</Text>
          </Reanimated.View>
        );
      })}
    </View>
  );
}

const TOOLS_PILE_LABELS = [
  'Scripture', 'Prayer Book', 'Daily Journal', 'Habits',
  'Challenges', 'Morning Prayers', 'Evening Prayers', 'Bible Notes',
  'Screen Time', 'App Blocker', 'Content Blocker', 'Notification Blocker',
  'Routines', 'Spiritual Tasks', 'Monthly Goals', 'Big Events',
  'Reading List', 'Reading Timer', 'Pomodoro', 'Free Writing',
  'Morning Pages', 'Favorites', 'Jesus Prayer', 'Bucket List',
  'Year in Pixels', 'Streaks', 'Notes',
];

const TOOLS_PILE_TONES = [
  { tone: '#F6EFDC', dot: '#C5A059' },
  { tone: '#E7F4F4', dot: '#4D8586' },
  { tone: '#F6E9EE', dot: '#8F5D6C' },
  { tone: '#F2EEDC', dot: '#85723F' },
  { tone: '#F0EFEA', dot: '#57524B' },
];

const TOOLS_PHYS_STRIDE = 8;
const TOOLS_PHYS_GRAVITY = 2300;
const TOOLS_PHYS_SPAWN_BASE = 550;
const TOOLS_PHYS_SPAWN_STEP = 95;

type ToolsPhysicsConfig = {
  count: number;
  halfLengths: number[];
  spawnTimes: number[];
  chipRadius: number;
  floorY: number;
  wallLeft: number;
  wallRight: number;
  sealX: number;
  sealY: number;
  sealRadius: number;
};

function buildToolsPhysics(width: number, height: number, bottomInset: number, compact: boolean) {
  const chipHeight = compact ? 30 : 34;
  const charWidth = compact ? 6.4 : 6.9;
  const chipPadding = compact ? 36 : 40;
  const sealSize = compact ? 122 : 144;
  const sealX = width / 2;
  const sealY = height * (compact ? 0.44 : 0.45);
  const spawnPattern = [-150, 92, -42, 148, -104, 28, 122, -64, 2];

  const chips = TOOLS_PILE_LABELS.map((label, index) => ({
    label,
    estWidth: Math.round(label.length * charWidth) + chipPadding,
    index,
  }));

  const config: ToolsPhysicsConfig = {
    count: chips.length,
    halfLengths: chips.map(chip => Math.max(2, (chip.estWidth - chipHeight) / 2)),
    spawnTimes: chips.map((_, index) => TOOLS_PHYS_SPAWN_BASE + index * TOOLS_PHYS_SPAWN_STEP),
    chipRadius: chipHeight / 2 + 1,
    floorY: height - bottomInset - 90,
    wallLeft: 8,
    wallRight: width - 8,
    sealX,
    sealY,
    sealRadius: sealSize / 2 + 5,
  };

  const initialBodies = new Array(chips.length * TOOLS_PHYS_STRIDE).fill(0);
  chips.forEach((chip, index) => {
    const base = index * TOOLS_PHYS_STRIDE;
    const spread = spawnPattern[index % spawnPattern.length] + ((index % 3) - 1) * 9;
    initialBodies[base] = Math.min(config.wallRight - chip.estWidth / 2, Math.max(config.wallLeft + chip.estWidth / 2, sealX + spread));
    initialBodies[base + 1] = -70 - (index % 5) * 26;
    initialBodies[base + 2] = (((index * 7) % 9) - 4) * 0.07;
    initialBodies[base + 3] = (((index * 5) % 7) - 3) * 26;
    initialBodies[base + 4] = 60;
    initialBodies[base + 5] = (((index * 11) % 5) - 2) * 0.9;
    initialBodies[base + 6] = 0;
    initialBodies[base + 7] = 0;
  });

  return { chips, chipHeight, sealSize, config, initialBodies };
}

function ToolsPhysicsChip({
  index,
  label,
  estWidth,
  chipHeight,
  bodies,
  compact,
}: {
  index: number;
  label: string;
  estWidth: number;
  chipHeight: number;
  bodies: SharedValue<number[]>;
  compact: boolean;
}) {
  const tone = TOOLS_PILE_TONES[index % TOOLS_PILE_TONES.length];

  const chipStyle = useAnimatedStyle(() => {
    const base = index * TOOLS_PHYS_STRIDE;
    const arr = bodies.value;
    return {
      opacity: arr[base + 6] === 0 ? 0 : 1,
      transform: [
        { translateX: arr[base] - estWidth / 2 },
        { translateY: arr[base + 1] - chipHeight / 2 },
        { rotate: `${arr[base + 2]}rad` },
      ],
    };
  });

  return (
    <Reanimated.View pointerEvents="none" style={[s.toolsPhysChipSlot, chipStyle]}>
      <View style={[s.toolsTagChip, compact && s.toolsTagChipCompact, { backgroundColor: tone.tone }]}>
        <View style={[s.toolsTagDot, { backgroundColor: tone.dot }]} />
        <Text style={[s.toolsTagText, compact && s.toolsTagTextCompact]} numberOfLines={1}>{label}</Text>
      </View>
    </Reanimated.View>
  );
}

function ToolsShowcaseSlide({
  topInset,
  bottomInset,
  onNext,
}: {
  topInset: number;
  bottomInset: number;
  onNext: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const compact = height < 760;
  const [titleUnderlineWidth, setTitleUnderlineWidth] = useState(150);
  const { chips, chipHeight, sealSize, config, initialBodies } = useMemo(
    () => buildToolsPhysics(width, height, bottomInset, compact),
    [bottomInset, compact, height, width],
  );
  const bodies = useSharedValue<number[]>(initialBodies);
  const elapsed = useSharedValue(0);
  const simDone = useSharedValue(0);
  const lastSpawnAt = TOOLS_PHYS_SPAWN_BASE + (config.count - 1) * TOOLS_PHYS_SPAWN_STEP;
  const ctaDelay = lastSpawnAt + 1300;
  const sealIn = useSharedValue(0);
  const sealGlow = useSharedValue(0);
  const lastTickRef = useRef(0);

  const landTick = useCallback(() => {
    const now = Date.now();
    if (now - lastTickRef.current < 110) return;
    lastTickRef.current = now;
    runTypingHaptic();
  }, []);

  // Lightweight rigid-body sim on the UI thread: every chip is a capsule
  // approximated by 3 circles, colliding with the floor, the side walls, the
  // crest seal (static circle) and each other. Chips settle wherever physics
  // leaves them - flat, tilted or upright.
  const frameCallback = useFrameCallback(frameInfo => {
    if (simDone.value === 1) return;
    const dtMs = Math.min(frameInfo.timeSincePreviousFrame ?? 16, 32);
    const dt = dtMs / 1000;
    elapsed.value += dtMs;
    const now = elapsed.value;
    const count = config.count;
    const halfLengths = config.halfLengths;
    const spawnTimes = config.spawnTimes;
    const radius = config.chipRadius;
    const floorY = config.floorY;
    const wallLeft = config.wallLeft;
    const wallRight = config.wallRight;
    const sealX = config.sealX;
    const sealY = config.sealY;
    const sealRadius = config.sealRadius;
    let activeCount = 0;
    let pendingCount = 0;
    let hardLanding = false;

    bodies.modify(arr => {
      'worklet';
      // 1) Spawn + integrate.
      for (let i = 0; i < count; i += 1) {
        const b = i * TOOLS_PHYS_STRIDE;
        if (arr[b + 6] === 0) {
          if (now >= spawnTimes[i]) {
            arr[b + 6] = 1;
          } else {
            pendingCount += 1;
            continue;
          }
        }
        if (arr[b + 6] === 2) continue;
        activeCount += 1;
        arr[b + 4] += TOOLS_PHYS_GRAVITY * dt;
        arr[b] += arr[b + 3] * dt;
        arr[b + 1] += arr[b + 4] * dt;
        arr[b + 2] += arr[b + 5] * dt;
        arr[b + 5] *= 0.992;
      }

      const cosA: number[] = [];
      const sinA: number[] = [];
      for (let i = 0; i < count; i += 1) {
        cosA[i] = Math.cos(arr[i * TOOLS_PHYS_STRIDE + 2]);
        sinA[i] = Math.sin(arr[i * TOOLS_PHYS_STRIDE + 2]);
      }

      // 2) Static colliders: floor, walls, seal - per chip circle.
      for (let i = 0; i < count; i += 1) {
        const b = i * TOOLS_PHYS_STRIDE;
        if (arr[b + 6] !== 1) continue;
        const inertia = halfLengths[i] * halfLengths[i] * 0.6 + 420;
        for (let c = 0; c < 3; c += 1) {
          const off = (c - 1) * halfLengths[i];
          const px = arr[b] + cosA[i] * off;
          const py = arr[b + 1] + sinA[i] * off;
          const ox = px - arr[b];
          const oy = py - arr[b + 1];

          let nx = 0;
          let ny = 0;
          let pen = 0;
          let bounce = 0;
          if (py + radius > floorY) {
            nx = 0; ny = -1; pen = py + radius - floorY; bounce = 0.34;
          } else if (px - radius < wallLeft) {
            nx = 1; ny = 0; pen = wallLeft - (px - radius); bounce = 0.3;
          } else if (px + radius > wallRight) {
            nx = -1; ny = 0; pen = (px + radius) - wallRight; bounce = 0.3;
          } else {
            const dxs = px - sealX;
            const dys = py - sealY;
            const ds = Math.sqrt(dxs * dxs + dys * dys);
            if (ds < radius + sealRadius && ds > 0.001) {
              nx = dxs / ds; ny = dys / ds; pen = radius + sealRadius - ds; bounce = 0.42;
            }
          }
          if (pen <= 0) continue;

          arr[b] += nx * pen;
          arr[b + 1] += ny * pen;
          const vcx = arr[b + 3] - arr[b + 5] * oy;
          const vcy = arr[b + 4] + arr[b + 5] * ox;
          const rvn = vcx * nx + vcy * ny;
          if (rvn < 0) {
            const cross = ox * ny - oy * nx;
            const impulse = -(1 + bounce) * rvn / (1 + (cross * cross) / inertia);
            arr[b + 3] += impulse * nx;
            arr[b + 4] += impulse * ny;
            arr[b + 5] += (ox * (impulse * ny) - oy * (impulse * nx)) / inertia;
            // Tangential friction so chips stop sliding.
            const tx = -ny;
            const ty = nx;
            const rvt = vcx * tx + vcy * ty;
            arr[b + 3] -= tx * rvt * 0.22;
            arr[b + 4] -= ty * rvt * 0.22;
            arr[b + 5] *= 0.94;
            if (ny === -1 && rvn < -300) hardLanding = true;
          }
        }
      }

      // 3) Chip-chip collisions (3x3 circles per pair).
      for (let i = 0; i < count; i += 1) {
        const bi = i * TOOLS_PHYS_STRIDE;
        if (arr[bi + 6] === 0) continue;
        for (let j = i + 1; j < count; j += 1) {
          const bj = j * TOOLS_PHYS_STRIDE;
          if (arr[bj + 6] === 0) continue;
          if (arr[bi + 6] === 2 && arr[bj + 6] === 2) continue;
          const dcx = arr[bj] - arr[bi];
          const dcy = arr[bj + 1] - arr[bi + 1];
          const reach = halfLengths[i] + halfLengths[j] + radius * 2 + 4;
          if (dcx * dcx + dcy * dcy > reach * reach) continue;

          const inertiaI = halfLengths[i] * halfLengths[i] * 0.6 + 420;
          const inertiaJ = halfLengths[j] * halfLengths[j] * 0.6 + 420;
          for (let ci = 0; ci < 3; ci += 1) {
            const offI = (ci - 1) * halfLengths[i];
            const pix = arr[bi] + cosA[i] * offI;
            const piy = arr[bi + 1] + sinA[i] * offI;
            for (let cj = 0; cj < 3; cj += 1) {
              const offJ = (cj - 1) * halfLengths[j];
              const pjx = arr[bj] + cosA[j] * offJ;
              const pjy = arr[bj + 1] + sinA[j] * offJ;
              const dx = pix - pjx;
              const dy = piy - pjy;
              const distSq = dx * dx + dy * dy;
              const minDist = radius * 2 - 2;
              if (distSq >= minDist * minDist || distSq < 0.0001) continue;
              const dist = Math.sqrt(distSq);
              const nx = dx / dist;
              const ny = dy / dist;
              const pen = minDist - dist;

              const iAsleep = arr[bi + 6] === 2;
              const jAsleep = arr[bj + 6] === 2;
              const shareI = jAsleep ? 1 : iAsleep ? 0 : 0.5;
              const shareJ = 1 - shareI;
              arr[bi] += nx * pen * shareI;
              arr[bi + 1] += ny * pen * shareI;
              arr[bj] -= nx * pen * shareJ;
              arr[bj + 1] -= ny * pen * shareJ;
              if (iAsleep && pen > 5) { arr[bi + 6] = 1; arr[bi + 7] = 0; }
              if (jAsleep && pen > 5) { arr[bj + 6] = 1; arr[bj + 7] = 0; }

              const oix = pix - arr[bi];
              const oiy = piy - arr[bi + 1];
              const ojx = pjx - arr[bj];
              const ojy = pjy - arr[bj + 1];
              const vix = arr[bi + 3] - arr[bi + 5] * oiy;
              const viy = arr[bi + 4] + arr[bi + 5] * oix;
              const vjx = arr[bj + 3] - arr[bj + 5] * ojy;
              const vjy = arr[bj + 4] + arr[bj + 5] * ojx;
              const rvn = (vix - vjx) * nx + (viy - vjy) * ny;
              if (rvn < 0) {
                const impulse = -(1 + 0.24) * rvn / 2;
                if (!iAsleep) {
                  arr[bi + 3] += impulse * nx;
                  arr[bi + 4] += impulse * ny;
                  arr[bi + 5] += (oix * (impulse * ny) - oiy * (impulse * nx)) / inertiaI;
                }
                if (!jAsleep) {
                  arr[bj + 3] -= impulse * nx;
                  arr[bj + 4] -= impulse * ny;
                  arr[bj + 5] -= (ojx * (impulse * ny) - ojy * (impulse * nx)) / inertiaJ;
                }
              }
            }
          }
        }
      }

      // 4) Sleep bookkeeping - settled chips become static colliders.
      for (let i = 0; i < count; i += 1) {
        const b = i * TOOLS_PHYS_STRIDE;
        if (arr[b + 6] !== 1) continue;
        const speed = Math.abs(arr[b + 3]) + Math.abs(arr[b + 4]);
        const nearGround = arr[b + 1] > sealY - sealRadius - 40;
        if (speed < 17 && Math.abs(arr[b + 5]) < 0.5 && nearGround) {
          arr[b + 7] += 1;
          if (arr[b + 7] > 14) {
            arr[b + 6] = 2;
            arr[b + 3] = 0;
            arr[b + 4] = 0;
            arr[b + 5] = 0;
          }
        } else {
          arr[b + 7] = 0;
        }
      }
      return arr;
    });

    if (hardLanding) {
      runOnJS(landTick)();
    }
    if (pendingCount === 0 && activeCount === 0) {
      simDone.value = 1;
    }
  }, true);

  useEffect(() => {
    sealIn.value = withDelay(220, withSpring(1, { damping: 14, stiffness: 130, mass: 0.9 }));
    sealGlow.value = withDelay(
      900,
      withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
    const hapticTimer = setTimeout(runBubbleHaptic, 620);
    // Safety stop in case a chip never falls asleep.
    const simTimer = setTimeout(() => {
      simDone.value = 1;
      frameCallback.setActive(false);
    }, lastSpawnAt + 9000);
    return () => {
      clearTimeout(hapticTimer);
      clearTimeout(simTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sealStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, sealIn.value * 1.4),
    transform: [
      { translateY: interpolate(sealIn.value, [0, 1], [20, 0]) },
      { scale: interpolate(sealIn.value, [0, 1], [0.72, 1]) },
    ],
  }));
  const sealGlowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, sealIn.value) * (0.45 + sealGlow.value * 0.55),
    transform: [
      { scale: interpolate(sealIn.value, [0, 1], [0.74, 1]) * (1 + sealGlow.value * 0.05) },
    ],
  }));

  const glowSize = sealSize + 104;

  return (
    <View style={s.toolsShowcaseRoot}>
      <Reanimated.View
        entering={FadeIn.duration(620).withInitialValues({
          opacity: 0,
          transform: [{ translateY: 16 }],
        })}
        style={[s.toolsShowcaseCopy, { paddingTop: topInset + (compact ? 16 : 24) }]}
      >
        <Text
          style={s.toolsTitle}
          onTextLayout={event => {
            const lines = event.nativeEvent.lines;
            const lastLine = lines[lines.length - 1];
            const nextWidth = Math.max(52, Math.min(320, Math.ceil((lastLine?.width ?? 150) * 0.92)));
            setTitleUnderlineWidth(current => (Math.abs(current - nextWidth) > 1 ? nextWidth : current));
          }}
        >
          Anasta has a lot of tools!
        </Text>
        <View style={[s.valueTitleUnderline, { width: titleUnderlineWidth, alignSelf: 'center' }]} />
        <View style={s.toolsSubtitleFrame}>
          <View style={s.valueSubtitleLine}>
            <ValueSubtitleWord>But</ValueSubtitleWord>
            <ValueSubtitleWord>a</ValueSubtitleWord>
            <ValueSubtitleWord>tool</ValueSubtitleWord>
            <ValueSubtitleWord>is</ValueSubtitleWord>
            <ValueSubtitleWord>only</ValueSubtitleWord>
            <ValueSubtitleWord>worth</ValueSubtitleWord>
            <ValueSubtitleWord underline>what it adds</ValueSubtitleWord>
            <ValueSubtitleWord>to</ValueSubtitleWord>
            <ValueSubtitleWord underline>your life.</ValueSubtitleWord>
          </View>
        </View>
      </Reanimated.View>

      <Reanimated.View
        pointerEvents="none"
        style={[
          s.toolsSealGlow,
          {
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            left: config.sealX - glowSize / 2,
            top: config.sealY - glowSize / 2,
          },
          sealGlowStyle,
        ]}
      />
      <Reanimated.View
        style={[
          s.toolsSealOuter,
          {
            width: sealSize,
            height: sealSize,
            borderRadius: sealSize * 0.32,
            left: config.sealX - sealSize / 2,
            top: config.sealY - sealSize / 2,
          },
          sealStyle,
        ]}
      >
        <LinearGradient
          colors={['#FFFFFF', '#FFF6E6']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: sealSize * 0.32 }]}
        />
        <View style={[s.toolsSealRing, { borderRadius: sealSize * 0.32 - 6 }]} />
        <Image
          source={APP_LOGO}
          style={{ width: sealSize * 0.66, height: sealSize * 0.66 }}
          resizeMode="cover"
        />
      </Reanimated.View>

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {chips.map(chip => (
          <ToolsPhysicsChip
            key={chip.label}
            index={chip.index}
            label={chip.label}
            estWidth={chip.estWidth}
            chipHeight={chipHeight}
            bodies={bodies}
            compact={compact}
          />
        ))}
      </View>

      <View style={s.toolsShowcaseSpacer} />

      <AnimatedCta delay={ctaDelay} style={[s.toolsShowcaseAction, { paddingBottom: bottomInset + 8 }]}>
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

function V4MomentSlide({
  eyebrow,
  title,
  body,
  onNext,
  autoAdvance,
  icon,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  onNext: () => void;
  autoAdvance?: boolean;
  icon?: React.ReactNode;
}) {
  useEffect(() => {
    if (!autoAdvance) return undefined;
    const timer = setTimeout(onNext, 2500);
    return () => clearTimeout(timer);
  }, [autoAdvance, onNext]);

  return (
    <LinearGradient
      colors={['#FFFDF8', '#FFFDF8', '#F8EEDC']}
      style={s.v4MomentSlide}
    >
      <Reanimated.View entering={FadeIn.duration(420)} style={s.v4MomentIcon}>
        {icon ?? <Image source={APP_LOGO} style={s.v4MomentLogo} resizeMode="cover" />}
      </Reanimated.View>
      {eyebrow ? <Text style={s.v4Eyebrow}>{eyebrow}</Text> : null}
      <Text style={s.v4MomentTitle}>{title}</Text>
      <Text style={s.v4MomentBody}>{body}</Text>
      {!autoAdvance && (
        <AnimatedCta delay={260} style={s.v4MomentAction}>
          <View style={s.ctaIsland}>
            <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={onNext} style={s.primaryButton}>
              <Text style={s.primaryButtonText}>Continue</Text>
              <ChevronRight s={19} c="#FFFFFF" w={2.5} />
            </TouchableOpacity>
          </View>
        </AnimatedCta>
      )}
    </LinearGradient>
  );
}

function DeckSwipeHint() {
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withDelay(
      1600,
      withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        -1,
        false,
      ),
    );
    return () => {
      sweep.value = 0;
    };
  }, [sweep]);

  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sweep.value, [0, 0.16, 0.68, 1], [0, 1, 1, 0]),
    transform: [{ translateX: interpolate(sweep.value, [0, 1], [-30, 30]) }],
  }));

  return (
    <Reanimated.View pointerEvents="none" style={[s.v4DeckHintArrow, hintStyle]}>
      <ChevronRight s={17} c={GOLD} w={2.6} />
      <ChevronRight s={17} c="rgba(197,160,89,0.45)" w={2.6} />
    </Reanimated.View>
  );
}

function V4StatementsIntroSlide({ displayName, onNext }: { displayName?: string; onNext: () => void }) {
  const name = nameForDisplay(displayName);
  return (
    <View style={s.messageSlide}>
      <ScrollView contentContainerStyle={s.v4ConversationContent} showsVerticalScrollIndicator={false}>
        <View style={s.v4ConversationInner}>
          <V4ProgressRail completedCount={0} />
          <ProtectSidePrompt
            delay={80}
            segments={[{ text: 'Anasta has a lot of tools.' }]}
          />
          <ProtectSidePrompt
            delay={360}
            segments={[
              { text: 'But their worth is measured by ' },
              { text: 'what they add to your life.', highlight: true },
            ]}
          />
          <ProtectSidePrompt
            delay={650}
            segments={[{ text: "We'll show you a few statements - just tell us if they sound like you." }]}
          />
          <ProtectSidePrompt
            delay={940}
            segments={[{ text: `${name ? `${name}, please` : 'Please'} answer honestly. The more we understand you, the better we can set Anasta up to fit your life.` }]}
          />
          <Reanimated.View entering={FadeInUp.delay(1120).duration(420)} style={s.v4DeckPreviewCard}>
            <Text style={s.v4DeckPreviewText}>Swipe right if it sounds like you.</Text>
            <DeckSwipeHint />
          </Reanimated.View>
        </View>
      </ScrollView>

      <AnimatedCta delay={1320} style={s.questionFooter}>
        <View style={s.ctaIsland}>
          <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={onNext} style={s.primaryButton}>
            <Text style={s.primaryButtonText}>Let&apos;s go</Text>
            <ChevronRight s={19} c="#FFFFFF" w={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedCta>
    </View>
  );
}

function statementQuoteHeightFor(card: StatementDeckCard, metrics: StatementCardMetrics) {
  return metrics.quoteHeight + (card.statement.length > 118 ? 28 : 0);
}

function statementCardHeightFor(card: StatementDeckCard, metrics: StatementCardMetrics) {
  return metrics.width + statementQuoteHeightFor(card, metrics);
}

function V4StatementDeckSlide({
  cards,
  accent,
  topInset,
  bottomInset,
  onDone,
}: {
  cards: StatementDeckCard[];
  accent: string;
  topInset: number;
  bottomInset: number;
  onDone: (yesIds: string[]) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [yesIds, setYesIds] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<(boolean | undefined)[]>(() => cards.map(() => undefined));
  const activeCard = cards[index];
  const isCompact = height < 760;
  const availableCardWidth = Math.max(width - 52, 280);
  const cardWidth = Math.min(availableCardWidth, isCompact ? 356 : 382);
  const quoteHeight = isCompact ? 104 : 116;
  const dragX = useSharedValue(0);
  // Mirrors `index` on the UI thread. Card poses derive from it inside
  // worklets, so the depth change and the drag reset land in the SAME UI
  // frame - a card can never flash in a wrong pose while React commits.
  const indexSV = useSharedValue(0);
  const submitRef = useRef<((yes: boolean) => void) | null>(null);
  const cardMetrics = useMemo<StatementCardMetrics>(() => ({
    width: cardWidth,
    quoteHeight,
    cardHeight: cardWidth + quoteHeight,
  }), [cardWidth, quoteHeight]);
  const slotHeight = useMemo(
    () => cards.reduce((tallest, card) => Math.max(tallest, statementCardHeightFor(card, cardMetrics)), 0),
    [cardMetrics, cards],
  );
  const registerSubmit = useCallback((submit: ((yes: boolean) => void) | null) => {
    submitRef.current = submit;
  }, []);
  const cardImages = useMemo(
    () => cards
      .map(card => card.image)
      .filter((image): image is number => typeof image === 'number'),
    [cards],
  );

  // Decode every card image up front. All cards stay mounted for the whole
  // deck, so no texture upload ever happens mid-swipe.
  useEffect(() => {
    void warmStatementImages(cardImages);
  }, [cardImages]);

  useEffect(() => () => {
    releaseStatementImages(cardImages);
  }, [cardImages]);

  const commitAnswer = useCallback((yes: boolean) => {
    setDecisions(prev => {
      const next = [...prev];
      next[index] = yes;
      return next;
    });
  }, [index]);

  const answer = useCallback((yes: boolean) => {
    if (!activeCard) return;
    const nextYes = yes ? [...yesIds, activeCard.id] : yesIds;
    setYesIds(nextYes);
    if (index >= cards.length - 1) {
      onDone(nextYes);
      return;
    }
    // Both shared values update in one UI-thread batch: the old card hides,
    // the promoted card takes the top pose and the pile re-bases atomically.
    indexSV.value = index + 1;
    dragX.value = 0;
    setIndex(prev => prev + 1);
  }, [activeCard, cards.length, dragX, index, indexSV, onDone, yesIds]);

  // Smoothstep ramp so the light builds gently at first, then surges as the
  // card approaches the commit threshold.
  const leftGlowStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, -dragX.value) / 190);
    const eased = raw * raw * (3 - 2 * raw);
    return {
      opacity: eased,
      transform: [{ scaleX: 0.5 + eased * 0.5 }],
    };
  });
  const rightGlowStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, dragX.value) / 190);
    const eased = raw * raw * (3 - 2 * raw);
    return {
      opacity: eased,
      transform: [{ scaleX: 0.5 + eased * 0.5 }],
    };
  });
  const leftGlowCoreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(-dragX.value, [88, 200], [0, 1], 'clamp'),
  }));
  const rightGlowCoreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.value, [88, 200], [0, 1], 'clamp'),
  }));

  return (
    <View style={[s.v4DeckSlideRoot, { paddingBottom: bottomInset + 10 }]}>
      <Reanimated.View pointerEvents="none" style={[s.v4EdgeGlow, s.v4EdgeGlowLeft, leftGlowStyle]}>
        <LinearGradient
          colors={['rgba(210,69,76,0.52)', 'rgba(210,69,76,0.20)', 'rgba(210,69,76,0)']}
          locations={[0, 0.42, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <Reanimated.View style={[s.v4EdgeGlowCore, leftGlowCoreStyle]}>
          <LinearGradient
            colors={['rgba(210,69,76,0.62)', 'rgba(210,69,76,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Reanimated.View>
        <LinearGradient
          pointerEvents="none"
          colors={['#FFFDF8', 'rgba(255,253,248,0)', 'rgba(255,253,248,0)', '#FFFDF8']}
          locations={[0, 0.24, 0.76, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Reanimated.View>
      <Reanimated.View pointerEvents="none" style={[s.v4EdgeGlow, s.v4EdgeGlowRight, rightGlowStyle]}>
        <LinearGradient
          colors={['rgba(47,157,88,0)', 'rgba(47,157,88,0.20)', 'rgba(47,157,88,0.52)']}
          locations={[0, 0.58, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <Reanimated.View style={[s.v4EdgeGlowCore, s.v4EdgeGlowCoreRight, rightGlowCoreStyle]}>
          <LinearGradient
            colors={['rgba(47,157,88,0)', 'rgba(47,157,88,0.62)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Reanimated.View>
        <LinearGradient
          pointerEvents="none"
          colors={['#FFFDF8', 'rgba(255,253,248,0)', 'rgba(255,253,248,0)', '#FFFDF8']}
          locations={[0, 0.24, 0.76, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Reanimated.View>

      <View style={[s.v4DeckInner, { paddingTop: topInset + 10 }]}>
        <Text style={[s.v4DeckTitle, isCompact && s.v4DeckTitleCompact]}>Do you relate to the statement below?</Text>
        <V4DeckAnswerProgress decisions={decisions} activeIndex={index} />
        <View style={[s.v4DeckStack, isCompact && s.v4DeckStackCompact]}>
          <View style={[s.v4DeckCardSlot, { width: cardMetrics.width, height: slotHeight }]}>
            {cards.map((card, cardIndex) => (
              <V4DeckCard
                key={card.id}
                card={card}
                cardIndex={cardIndex}
                activeIndex={index}
                indexSV={indexSV}
                zIndex={cards.length - cardIndex}
                accent={accent}
                metrics={cardMetrics}
                isLast={cardIndex >= cards.length - 1}
                dragX={dragX}
                imageSource={card.image ? statementImageRefs.get(card.image) ?? card.image : undefined}
                registerSubmit={registerSubmit}
                onCommit={commitAnswer}
                onAnswer={answer}
              />
            )).reverse()}
          </View>
        </View>
        <View style={[s.v4AnswerRow, { width: cardMetrics.width, alignSelf: 'center' }]}>
          <TouchableOpacity activeOpacity={0.84} haptic="none" onPress={() => submitRef.current?.(false)} style={s.v4NoButton}>
            <LinearGradient
              colors={['#FFFFFF', '#FFF2F1']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.v4AnswerIconChipNo}>
              <X s={14} c="#FFFFFF" w={2.8} />
            </View>
            <Text style={s.v4NoButtonText}>Not me</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.84} haptic="none" onPress={() => submitRef.current?.(true)} style={s.v4YesButton}>
            <LinearGradient
              colors={['#FFFFFF', '#EFF9F2']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={s.v4YesButtonText}>That&apos;s me</Text>
            <View style={s.v4AnswerIconChipYes}>
              <CheckSmall s={15} c="#FFFFFF" w={2.9} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function V4DeckAnswerProgress({
  decisions,
  activeIndex,
}: {
  decisions: (boolean | undefined)[];
  activeIndex: number;
}) {
  return (
    <View style={s.v4DeckAnswerProgress}>
      {decisions.map((decision, index) => (
        <V4DeckAnswerSegment
          key={`deck-progress-${index}`}
          decision={decision}
          active={index === activeIndex}
        />
      ))}
    </View>
  );
}

function V4DeckAnswerSegment({
  decision,
  active,
}: {
  decision?: boolean;
  active: boolean;
}) {
  const state = useSharedValue(decision === true ? 1 : decision === false ? -1 : 0);

  useEffect(() => {
    state.value = withTiming(decision === true ? 1 : decision === false ? -1 : 0, {
      duration: 190,
      easing: Easing.out(Easing.cubic),
    });
  }, [decision, state]);

  const segmentStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      state.value,
      [-1, 0, 1],
      ['#D95858', 'rgba(25,23,20,0.12)', '#43A66B'],
    ),
    opacity: state.value === 0 && !active ? 0.72 : 1,
  }));

  return <Reanimated.View style={[s.v4DeckAnswerSegment, active && decision === undefined && s.v4DeckAnswerSegmentActive, segmentStyle]} />;
}

function statementCardAccent(card: StatementDeckCard, accent: string) {
  return card.spiritual ? GOLD : accent;
}

function StatementRichText({ card }: { card: StatementDeckCard }) {
  const segments = useMemo(() => {
    const initial: { text: string; bold: boolean }[] = [{ text: card.statement, bold: false }];
    for (const phrase of card.bold ?? []) {
      for (let i = 0; i < initial.length; i += 1) {
        const segment = initial[i];
        if (segment.bold) continue;
        const at = segment.text.indexOf(phrase);
        if (at < 0) continue;
        const replacement = [
          { text: segment.text.slice(0, at), bold: false },
          { text: phrase, bold: true },
          { text: segment.text.slice(at + phrase.length), bold: false },
        ].filter(part => part.text.length > 0);
        initial.splice(i, 1, ...replacement);
        break;
      }
    }
    return initial;
  }, [card.bold, card.statement]);

  return (
    <Text
      style={s.v4StatementText}
      numberOfLines={5}
      adjustsFontSizeToFit
      minimumFontScale={0.84}
    >
      {segments.map((segment, index) => (
        segment.bold
          ? <Text key={`seg-${index}`} style={s.v4StatementTextBold}>{segment.text}</Text>
          : <Text key={`seg-${index}`}>{segment.text}</Text>
      ))}
    </Text>
  );
}

function StatementQuotePanel({
  card,
  accent,
  height,
}: {
  card: StatementDeckCard;
  accent: string;
  height: number;
}) {
  const cardAccent = statementCardAccent(card, accent);
  return (
    <View style={[s.v4StatementQuotePanel, { height }]}>
      <LinearGradient
        colors={[`${cardAccent}2E`, `${cardAccent}10`]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text pointerEvents="none" style={[s.v4StatementQuoteMark, { color: `${cardAccent}3D` }]}>“</Text>
      <View style={s.v4StatementQuoteTextWrap}>
        <StatementRichText card={card} />
      </View>
      <View style={s.v4StatementOrnamentRow}>
        <View style={[s.v4StatementOrnamentLine, { backgroundColor: `${cardAccent}4D` }]} />
        <View style={[s.v4StatementOrnamentDot, { backgroundColor: cardAccent }]} />
        <View style={[s.v4StatementOrnamentLine, { backgroundColor: `${cardAccent}4D` }]} />
      </View>
    </View>
  );
}

const V4_STACK_SCALES = [1, 0.963, 0.93, 0.9] as const;
const V4_STACK_PEEKS = [0, 7, 13, 18] as const;
const V4_STACK_ROTATES = [0, -0.4, 0.6, -0.9] as const;

// translateY that leaves exactly `peek` px of the card visible below the card
// in front of it, compensating for the scale shrinking toward the center.
function stackPose(depth: 0 | 1 | 2 | 3, cardHeight: number) {
  const scale = V4_STACK_SCALES[depth];
  return {
    y: V4_STACK_PEEKS[depth] + (cardHeight * (1 - scale)) / 2,
    scale,
    rotate: V4_STACK_ROTATES[depth],
  };
}

function StatementCardFace({
  card,
  accent,
  metrics,
  imageSource,
  imageTransition,
}: {
  card: StatementDeckCard;
  accent: string;
  metrics: StatementCardMetrics;
  imageSource?: number | ExpoImageRef;
  imageTransition: number;
}) {
  return (
    <>
      <StatementQuotePanel card={card} accent={accent} height={statementQuoteHeightFor(card, metrics)} />
      <View style={[s.v4StatementArt, { height: metrics.width }]}>
        {imageSource ? (
          <ExpoImage
            source={imageSource}
            style={s.v4StatementImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            transition={imageTransition}
            recyclingKey={card.id}
          />
        ) : (
          <View style={[s.v4StatementIcon, { backgroundColor: `${statementCardAccent(card, accent)}16` }]}>{card.icon}</View>
        )}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(23,19,15,0.10)', 'rgba(23,19,15,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={s.v4StatementArtShade}
        />
      </View>
      <View pointerEvents="none" style={s.v4StatementInnerFrame} />
    </>
  );
}

// Every card of the deck stays mounted from first render to deck unmount -
// nothing mounts or unmounts mid-swipe, so there are no texture uploads and
// no layout work during gestures. The pose (depth in the pile) is computed
// entirely on the UI thread from indexSV + dragX, so a card can never render
// a single frame in the wrong pose while React commits a new index.
function V4DeckCard({
  card,
  accent,
  metrics,
  imageSource,
  cardIndex,
  activeIndex,
  indexSV,
  zIndex,
  isLast,
  dragX,
  registerSubmit,
  onCommit,
  onAnswer,
}: {
  card: StatementDeckCard;
  accent: string;
  metrics: StatementCardMetrics;
  imageSource?: number | ExpoImageRef;
  cardIndex: number;
  activeIndex: number;
  indexSV: SharedValue<number>;
  zIndex: number;
  isLast: boolean;
  dragX: SharedValue<number>;
  registerSubmit: (submit: ((yes: boolean) => void) | null) => void;
  onCommit: (yes: boolean) => void;
  onAnswer: (yes: boolean) => void;
}) {
  const translateY = useSharedValue(0);
  const locked = useSharedValue(false);
  // Freeze the image source for this card's whole life. Swapping sources on a
  // mounted image causes a one-frame flash, so the first source wins.
  const stableImageSource = useRef(imageSource).current;
  const quoteHeight = statementQuoteHeightFor(card, metrics);
  const cardHeight = statementCardHeightFor(card, metrics);
  const active = cardIndex === activeIndex;
  const initialDepth = Math.max(0, Math.min(3, cardIndex - activeIndex)) as 0 | 1 | 2 | 3;
  const initialPose = stackPose(initialDepth, cardHeight);
  const initialHidden = cardIndex - activeIndex < 0 || cardIndex - activeIndex > 3;

  const submit = useCallback((yes: boolean) => {
    if (locked.value) return;
    locked.value = true;
    runSelectionHaptic();
    onCommit(yes);
    translateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    if (isLast) {
      // Advance while the card is still flying out so the stack never sits empty.
      setTimeout(() => onAnswer(yes), 130);
      dragX.value = withTiming(yes ? 560 : -560, { duration: 300, easing: Easing.out(Easing.cubic) });
      return;
    }
    dragX.value = withTiming(yes ? 560 : -560, { duration: 300, easing: Easing.out(Easing.cubic) }, () => {
      runOnJS(onAnswer)(yes);
    });
  }, [dragX, isLast, locked, onAnswer, onCommit, translateY]);

  useEffect(() => {
    if (!active) return undefined;
    registerSubmit(submit);
    return () => registerSubmit(null);
  }, [active, registerSubmit, submit]);

  const gesture = useMemo(() => Gesture.Pan()
    .enabled(active)
    .activeOffsetX([-12, 12])
    .failOffsetY([-18, 18])
    .onUpdate(event => {
      if (locked.value) return;
      dragX.value = event.translationX;
      translateY.value = event.translationY * 0.18;
    })
    .onEnd(event => {
      if (locked.value) return;
      if (Math.abs(event.translationX) > 88 || Math.abs(event.velocityX) > 520) {
        const yes = event.translationX > 0 || event.velocityX > 0;
        runOnJS(submit)(yes);
        return;
      }
      dragX.value = withSpring(0, { damping: 17, stiffness: 230, mass: 0.8 });
      translateY.value = withSpring(0, { damping: 17, stiffness: 230, mass: 0.8 });
    }), [active, dragX, locked, submit, translateY]);

  const poseStyle = useAnimatedStyle(() => {
    const depthNow = cardIndex - indexSV.value;
    if (depthNow < 0) {
      // Already answered - stays hidden wherever it flew off to.
      return {
        opacity: 0,
        transform: [
          { translateX: 0 },
          { translateY: 0 },
          { rotate: '0deg' },
          { scale: 1 },
        ],
      };
    }
    if (depthNow === 0) {
      return {
        opacity: 1,
        transform: [
          { translateX: dragX.value },
          { translateY: translateY.value },
          { rotate: `${interpolate(dragX.value, [-180, 180], [-6, 6])}deg` },
          { scale: 1 },
        ],
      };
    }
    const clamped = Math.min(3, depthNow);
    const progress = depthNow > 3 ? 0 : Math.min(1, Math.abs(dragX.value) / 200);
    const poseAt = (k: number) => {
      const sc = k <= 0 ? 1 : k === 1 ? 0.963 : k === 2 ? 0.93 : 0.9;
      const peek = k <= 0 ? 0 : k === 1 ? 7 : k === 2 ? 13 : 18;
      const rt = k <= 0 ? 0 : k === 1 ? -0.4 : k === 2 ? 0.6 : -0.9;
      return { y: peek + (cardHeight * (1 - sc)) / 2, scale: sc, rotate: rt };
    };
    const fromPose = poseAt(clamped);
    const toPose = poseAt(clamped - 1);
    const baseOpacity = clamped <= 1 ? 1 : clamped === 2 ? 0.95 : 0.84;
    const opacity = depthNow > 3 ? 0 : baseOpacity + (1 - baseOpacity) * progress;
    return {
      opacity,
      transform: [
        { translateX: 0 },
        { translateY: fromPose.y + (toPose.y - fromPose.y) * progress },
        { rotate: `${fromPose.rotate + (toPose.rotate - fromPose.rotate) * progress}deg` },
        { scale: fromPose.scale + (toPose.scale - fromPose.scale) * progress },
      ],
    };
  });
  const yesStampStyle = useAnimatedStyle(() => ({
    opacity: cardIndex === indexSV.value ? interpolate(dragX.value, [14, 105], [0, 1], 'clamp') : 0,
    transform: [
      { rotate: '-11deg' },
      { scale: interpolate(dragX.value, [14, 105], [0.84, 1], 'clamp') },
    ],
  }));
  const noStampStyle = useAnimatedStyle(() => ({
    opacity: cardIndex === indexSV.value ? interpolate(dragX.value, [-105, -14], [1, 0], 'clamp') : 0,
    transform: [
      { rotate: '11deg' },
      { scale: interpolate(dragX.value, [-105, -14], [1, 0.84], 'clamp') },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Reanimated.View
        style={[
          s.v4StatementCard,
          !active && s.v4StackCard,
          s.v4DeckCardBase,
          {
            width: metrics.width,
            height: cardHeight,
            zIndex,
            // Static first-frame pose so a card can never flash in the wrong
            // pose before the animated style kicks in.
            opacity: initialHidden ? 0 : 1,
            transform: [
              { translateY: initialPose.y },
              { rotate: `${initialPose.rotate}deg` },
              { scale: initialPose.scale },
            ],
          },
          poseStyle,
        ]}
      >
        <StatementCardFace card={card} accent={accent} metrics={metrics} imageSource={stableImageSource} imageTransition={120} />
        <Reanimated.View pointerEvents="none" style={[s.v4SwipeStamp, s.v4SwipeStampYes, { top: quoteHeight + 16 }, yesStampStyle]}>
          <Text style={[s.v4SwipeStampText, s.v4SwipeStampTextYes]}>That&apos;s me</Text>
        </Reanimated.View>
        <Reanimated.View pointerEvents="none" style={[s.v4SwipeStamp, s.v4SwipeStampNo, { top: quoteHeight + 16 }, noStampStyle]}>
          <Text style={[s.v4SwipeStampText, s.v4SwipeStampTextNo]}>Not me</Text>
        </Reanimated.View>
      </Reanimated.View>
    </GestureDetector>
  );
}


const SCREEN_TIME_DIAL_SPACING = 30;

const SCREEN_TIME_DIAL_VALUES = (() => {
  const values: number[] = [];
  for (let v = SCREEN_TIME_MIN_HOURS; v <= SCREEN_TIME_MAX_HOURS + 0.001; v += 0.5) {
    values.push(Number(v.toFixed(1)));
  }
  return values;
})();

function ScreenTimeDialTick({
  index,
  offset,
}: {
  index: number;
  offset: SharedValue<number>;
}) {
  const hourValue = SCREEN_TIME_DIAL_VALUES[index];
  const isHour = Number.isInteger(hourValue);
  const tickStyle = useAnimatedStyle(() => {
    const distance = Math.abs(index * SCREEN_TIME_DIAL_SPACING + offset.value);
    const focus = interpolate(distance, [0, SCREEN_TIME_DIAL_SPACING * 1.5], [1, 0], 'clamp');
    return {
      opacity: 0.38 + focus * 0.62,
      transform: [{ scaleY: 1 + focus * 0.22 }],
    };
  });

  return (
    <View style={s.screenTimeDialTickSlot}>
      <Reanimated.View
        style={[
          s.screenTimeDialTickLine,
          isHour ? s.screenTimeDialTickLineHour : s.screenTimeDialTickLineHalf,
          tickStyle,
        ]}
      />
      {isHour ? (
        <Text style={s.screenTimeDialTickLabel}>
          {hourValue >= SCREEN_TIME_MAX_HOURS ? '10+' : `${hourValue}`}
        </Text>
      ) : (
        <View style={s.screenTimeDialTickLabelSpacer} />
      )}
    </View>
  );
}

function V4ScreenTimeDial({
  value,
  onChange,
}: {
  value?: number;
  onChange: (hours: number) => void;
}) {
  const initial = clampNumber(value ?? DEFAULT_SCREEN_TIME_HOURS, SCREEN_TIME_MIN_HOURS, SCREEN_TIME_MAX_HOURS);
  const initialIndex = Math.round((initial - SCREEN_TIME_MIN_HOURS) / 0.5);
  const maxOffset = (SCREEN_TIME_DIAL_VALUES.length - 1) * SCREEN_TIME_DIAL_SPACING;
  const [localHours, setLocalHours] = useState(initial);
  const [viewportWidth, setViewportWidth] = useState(320);
  const offset = useSharedValue(-initialIndex * SCREEN_TIME_DIAL_SPACING);
  const startOffset = useSharedValue(-initialIndex * SCREEN_TIME_DIAL_SPACING);
  const lastIndex = useSharedValue(initialIndex);
  const pop = useSharedValue(1);
  const valueRef = useRef(initial);

  const commitHours = useCallback((nextHours: number) => {
    if (Math.abs(valueRef.current - nextHours) < 0.01) return;
    valueRef.current = nextHours;
    runSelectionHaptic();
    setLocalHours(nextHours);
    onChange(nextHours);
    pop.value = withSequence(
      withTiming(1.06, { duration: 90, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 170, easing: Easing.out(Easing.cubic) }),
    );
  }, [onChange, pop]);

  const dialGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-6, 6])
    .onBegin(() => {
      startOffset.value = offset.value;
    })
    .onUpdate(event => {
      const next = Math.max(-maxOffset, Math.min(0, startOffset.value + event.translationX));
      offset.value = next;
      const idx = Math.round(-next / SCREEN_TIME_DIAL_SPACING);
      if (idx !== lastIndex.value) {
        lastIndex.value = idx;
        runOnJS(commitHours)(SCREEN_TIME_DIAL_VALUES[idx]);
      }
    })
    .onEnd(event => {
      const projected = Math.max(-maxOffset, Math.min(0, offset.value + event.velocityX * 0.1));
      const idx = Math.round(-projected / SCREEN_TIME_DIAL_SPACING);
      offset.value = withSpring(-idx * SCREEN_TIME_DIAL_SPACING, { damping: 19, stiffness: 210, mass: 0.7 });
      if (idx !== lastIndex.value) {
        lastIndex.value = idx;
        runOnJS(commitHours)(SCREEN_TIME_DIAL_VALUES[idx]);
      }
    }), [commitHours, lastIndex, maxOffset, offset, startOffset]);

  const rulerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));
  const readoutStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  const sidePadding = Math.max(0, viewportWidth / 2 - SCREEN_TIME_DIAL_SPACING / 2);

  return (
    <View style={s.screenTimeDialBlock}>
      <Reanimated.View style={[s.screenTimeReadout, readoutStyle]}>
        <Text style={s.screenTimeReadoutValue}>
          {localHours >= SCREEN_TIME_MAX_HOURS ? '10+' : formatHourValue(localHours)}
        </Text>
        <Text style={s.screenTimeReadoutUnit}>hours a day</Text>
      </Reanimated.View>

      <GestureDetector gesture={dialGesture}>
        <View
          style={s.screenTimeDialViewport}
          onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}
        >
          <Reanimated.View style={[s.screenTimeDialRuler, { paddingHorizontal: sidePadding }, rulerStyle]}>
            {SCREEN_TIME_DIAL_VALUES.map((tickValue, index) => (
              <ScreenTimeDialTick key={`dial-${tickValue}`} index={index} offset={offset} />
            ))}
          </Reanimated.View>
          <LinearGradient
            pointerEvents="none"
            colors={['#FFFDF8', 'rgba(255,253,248,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[s.screenTimeDialFade, s.screenTimeDialFadeLeft]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,253,248,0)', '#FFFDF8']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[s.screenTimeDialFade, s.screenTimeDialFadeRight]}
          />
          <View pointerEvents="none" style={s.screenTimeDialNeedleWrap}>
            <View style={s.screenTimeDialNeedle} />
            <View style={s.screenTimeDialNeedleDot} />
          </View>
        </View>
      </GestureDetector>

      <Text style={s.screenTimeDialHint}>Drag the dial — be honest with yourself.</Text>
    </View>
  );
}

function V4ScreenTimeSliderSlide({
  hours,
  onChange,
  onNext,
}: {
  hours?: number;
  onChange: (hours: number) => void;
  onNext: () => void;
}) {
  useEffect(() => {
    if (hours === undefined) onChange(DEFAULT_SCREEN_TIME_HOURS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={s.screenTimeSlide}>
      <Reanimated.View
        entering={FadeIn.duration(480).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })}
      >
        <Text style={s.v4DeckTitle}>How much time do you spend on your phone each day?</Text>
      </Reanimated.View>

      <Reanimated.View
        entering={FadeIn.delay(220).duration(520).withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] })}
        style={s.screenTimeDialStage}
      >
        <V4ScreenTimeDial value={hours} onChange={onChange} />
      </Reanimated.View>

      <AnimatedCta delay={420} style={s.screenTimeAction}>
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

function V4DayPartCard({
  icon,
  tint,
  border,
  label,
  note,
  hours,
  percent,
  emphasis,
}: {
  icon: React.ReactNode;
  tint: string;
  border: string;
  label: string;
  note?: string;
  hours: string;
  percent: string;
  emphasis?: boolean;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (emphasis) {
      runStrongHaptic();
      pulse.value = withDelay(
        620,
        withRepeat(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
          -1,
          true,
        ),
      );
    } else {
      runBubbleHaptic();
    }
    return () => {
      pulse.value = 0;
    };
  }, [emphasis, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.012 }],
  }));

  return (
    <Reanimated.View
      entering={FadeIn.duration(520).easing(Easing.bezier(0.16, 1, 0.28, 1)).withInitialValues({
        opacity: 0,
        transform: [{ translateY: 16 }, { scale: 0.97 }],
      })}
      style={[s.v4DayPartCard, emphasis && s.v4DayPartCardPhone, pulseStyle]}
    >
      <View style={[s.v4DayPartIcon, { backgroundColor: tint, borderColor: border }]}>{icon}</View>
      <View style={s.v4DayPartCopy}>
        <Text style={s.v4DayPartLabel}>{label}</Text>
        {note ? <Text style={s.v4DayPartNote}>{note}</Text> : null}
      </View>
      <View style={s.v4DayPartStat}>
        <Text style={[s.v4DayPartHours, emphasis && s.v4DayPartHoursPhone]}>{hours}</Text>
        <Text style={s.v4DayPartPercent}>{percent}</Text>
      </View>
    </Reanimated.View>
  );
}

function V4DayBreakdownBar({ stat }: { stat: ReturnType<typeof protectStats> }) {
  const grow = useSharedValue(0);
  const restHours = Math.max(0, DAY_HOURS - SLEEP_HOURS_PER_DAY - stat.hours);
  const sleepPct = (SLEEP_HOURS_PER_DAY / DAY_HOURS) * 100;
  const phonePct = (stat.hours / DAY_HOURS) * 100;
  const restPct = Math.max(0, 100 - sleepPct - phonePct);

  useEffect(() => {
    runBubbleHaptic();
    grow.value = withDelay(180, withTiming(1, { duration: 980, easing: Easing.bezier(0.16, 1, 0.28, 1) }));
  }, [grow]);

  const sleepStyle = useAnimatedStyle(() => ({
    width: `${sleepPct * Math.min(1, grow.value * 3)}%`,
  }));
  const phoneStyle = useAnimatedStyle(() => ({
    width: `${phonePct * Math.max(0, Math.min(1, grow.value * 3 - 1))}%`,
  }));
  const restStyle = useAnimatedStyle(() => ({
    width: `${restPct * Math.max(0, Math.min(1, grow.value * 3 - 2))}%`,
  }));

  return (
    <Reanimated.View
      entering={FadeIn.duration(520).easing(Easing.bezier(0.16, 1, 0.28, 1)).withInitialValues({
        opacity: 0,
        transform: [{ translateY: 14 }],
      })}
      style={s.v4DayBarCard}
    >
      <View style={s.v4DayBarTrack}>
        <Reanimated.View style={[s.v4DayBarSegment, s.v4DayBarSegmentSleep, sleepStyle]} />
        <Reanimated.View style={[s.v4DayBarSegment, s.v4DayBarSegmentPhone, phoneStyle]} />
        <Reanimated.View style={[s.v4DayBarSegment, s.v4DayBarSegmentRest, restStyle]} />
      </View>
      <View style={s.v4DayBarLegend}>
        <Text style={s.v4DayBarLegendText}>
          {`${SLEEP_HOURS_PER_DAY}h sleep · `}
          <Text style={s.v4DayBarLegendPhone}>{`${formatHourValue(stat.hours)}h phone`}</Text>
          {` · ${formatHourValue(restHours)}h left`}
        </Text>
      </View>
    </Reanimated.View>
  );
}

const V4_DAY_NECESSITIES_HOURS = 3;

function V4DayVisualizationSlide({ hours, onNext }: { hours?: number; onNext: () => void }) {
  const stat = protectStats(hours);
  const restHours = Math.max(0, DAY_HOURS - SLEEP_HOURS_PER_DAY - stat.hours);
  const freeHours = Math.max(0, restHours - V4_DAY_NECESSITIES_HOURS);
  const phonePercent = Math.round((stat.hours / DAY_HOURS) * 100);
  const restPercent = Math.max(0, Math.round((restHours / DAY_HOURS) * 100));
  const [phase, setPhase] = useState<'day' | 'waste' | 'reclaim'>('day');
  const [dayReveal, setDayReveal] = useState(0);
  const [wasteReveal, setWasteReveal] = useState(0);
  const [reclaimReveal, setReclaimReveal] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (phase === 'day') {
      [260, 1240, 2260, 3300].forEach((delay, index) => {
        timers.push(setTimeout(() => setDayReveal(index + 1), delay));
      });
    }
    if (phase === 'waste') {
      [220, 1500, 3360, 5060].forEach((delay, index) => {
        timers.push(setTimeout(() => setWasteReveal(index + 1), delay));
      });
    }
    if (phase === 'reclaim') {
      [260, 1500, 3000, 4360, 5760].forEach((delay, index) => {
        timers.push(setTimeout(() => setReclaimReveal(index + 1), delay));
      });
    }
    return () => timers.forEach(timer => clearTimeout(timer));
  }, [phase]);

  const handleNext = () => {
    if (phase === 'day') {
      if (dayReveal < 4) {
        setDayReveal(4);
        return;
      }
      runSelectionHaptic();
      setPhase('waste');
      return;
    }
    if (phase === 'waste') {
      if (wasteReveal < 4) {
        setWasteReveal(4);
        return;
      }
      runSelectionHaptic();
      setPhase('reclaim');
      return;
    }
    if (reclaimReveal < 5) {
      setReclaimReveal(5);
      return;
    }
    onNext();
  };

  const ctaLabel = phase === 'day'
    ? 'Continue'
    : phase === 'waste'
      ? (wasteReveal < 4 ? 'Show me' : 'OK')
      : "Let's start fixing this";

  return (
    <GuidedSetupShell
      onNext={handleNext}
      ctaLabel={ctaLabel}
      scrollSignal={`${phase}-${dayReveal}-${wasteReveal}-${reclaimReveal}`}
      autoScrollOnContentChange
    >
      <Reanimated.View
        entering={FadeIn.duration(520).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })}
        style={s.v4DayHeader}
      >
        <Text style={s.v4Eyebrow}>Your 24 hours</Text>
        <Text style={s.v4DayTitle}>Where your day actually goes.</Text>
      </Reanimated.View>

      <View style={s.v4DayPartList}>
        {dayReveal >= 1 && (
          <V4DayPartCard
            icon={<Moon s={21} c="#5A5244" w={2} />}
            tint="rgba(25,23,20,0.06)"
            border="rgba(25,23,20,0.12)"
            label="Sleep"
            hours={`${SLEEP_HOURS_PER_DAY}h`}
            percent="33% of your day"
          />
        )}
        {dayReveal >= 2 && (
          <V4DayPartCard
            icon={<Hourglass s={21} c="#A8393F" w={2} />}
            tint="rgba(168,57,63,0.10)"
            border="rgba(168,57,63,0.22)"
            label="On your phone"
            note="Your number — be honest, it counts."
            hours={`${formatHourValue(stat.hours)}h`}
            percent={`${phonePercent}% of your day`}
            emphasis
          />
        )}
        {dayReveal >= 3 && (
          <V4DayPartCard
            icon={<Sun s={21} c={GOLD} w={2} />}
            tint="rgba(197,160,89,0.12)"
            border="rgba(197,160,89,0.26)"
            label="The rest of your day"
            note={`Eating, chores, and daily necessities take ~${V4_DAY_NECESSITIES_HOURS}h of this. Truly free: ~${formatHourValue(freeHours)}h.`}
            hours={`${formatHourValue(restHours)}h`}
            percent={`${restPercent}% of your day`}
          />
        )}
        {dayReveal >= 4 && <V4DayBreakdownBar stat={stat} />}
      </View>

      {phase !== 'day' && (
        <View style={s.screenTimeConversation}>
          {wasteReveal >= 1 && <ScreenTimeWastedIntro lifted={wasteReveal >= 2} />}
          {wasteReveal >= 2 && <ScreenTimePercentCard stat={stat} index={1} stackSignal={wasteReveal} />}
          {wasteReveal >= 3 && <ScreenTimeDaysCard stat={stat} index={2} stackSignal={wasteReveal} />}
          {wasteReveal >= 4 && <ScreenTimeYearsCard stat={stat} index={3} stackSignal={wasteReveal} />}
        </View>
      )}

      {phase === 'reclaim' && (
        <View style={s.screenTimeConversation}>
          {reclaimReveal >= 1 && (
            <ProtectSidePrompt
              motionKey={`v4-reclaim-${stat.hours}`}
              segments={[
                { text: 'If you cut your screen time by only ' },
                { text: '40%', highlight: true, gold: true },
                { text: '...' },
              ]}
            />
          )}
          {reclaimReveal >= 2 && <ScreenTimeGetBackIntro lifted={reclaimReveal >= 3} />}
          {reclaimReveal >= 3 && <ScreenTimeSavedDaysCard stat={stat} index={1} stackSignal={reclaimReveal} />}
          {reclaimReveal >= 4 && <ScreenTimeSavedYearsCard stat={stat} index={2} stackSignal={reclaimReveal} />}
          {reclaimReveal >= 5 && (
            <ProtectSidePrompt
              motionKey={`v4-reclaim-close-${stat.hours}`}
              segments={[
                { text: 'That time is yours to ' },
                { text: 'take back', highlight: true },
                { text: '.' },
              ]}
            />
          )}
        </View>
      )}
    </GuidedSetupShell>
  );
}

function V4MetricCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent?: boolean }) {
  return (
    <Reanimated.View entering={FadeInUp.duration(340)} style={[s.v4MetricCard, accent && s.v4MetricCardAccent]}>
      <Text style={s.v4MetricLabel}>{label}</Text>
      <Text style={s.v4MetricValue}>{value}</Text>
      <Text style={s.v4MetricDetail}>{detail}</Text>
    </Reanimated.View>
  );
}

const PROTECT_RECAP_WINS: Record<string, string> = {
  'lost-hour': 'Screen time under control',
  'morning-night': 'Mornings and evenings protected',
  'focus-pulled': 'Focus interruptions silenced',
  'procrastination': 'Procrastination addressed',
  'ashamed-content': 'Addictive content blocked',
  'presence': 'Present where it matters',
};

const STATEMENT_SHORT_LABELS: Record<string, string> = {
  'lost-hour': 'Hours lost to mindless scrolling',
  'morning-night': 'Phone first thing in the morning, last at night',
  'focus-pulled': 'Notifications keep breaking your focus',
  'procrastination': 'Procrastinating with your phone',
  'ashamed-content': "Addictive content you're ashamed of",
  'presence': 'Distractions pull you out of the moment',
  'anxious-start': "Anxious — you don't know where to start",
  'last-minute': 'Everything happens at the last minute',
  'plan-day': 'Your days could be planned better',
  'habits-quit': 'New habits die after a few days',
  'wasted-day': 'Days end feeling wasted',
  'forgot-promise': 'Forgetting what you promised',
  'no-rhythm': 'Your days have no rhythm',
  'pray-daily': 'Prayer keeps slipping away',
  'goals-give-up': 'Goals end in giving up',
  'scripture-time': 'No time made for Scripture',
  'intentional-time': 'You want to be more intentional',
};

function V4RecapStakesCard({ stat }: { stat: ReturnType<typeof protectStats> }) {
  useEffect(() => {
    const timer = setTimeout(runStrongHaptic, 420);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Reanimated.View
      entering={FadeIn.delay(300).duration(520).easing(Easing.bezier(0.16, 1, 0.28, 1)).withInitialValues({
        opacity: 0,
        transform: [{ translateY: 16 }, { scale: 0.965 }],
      })}
      style={s.v4RecapStakes}
    >
      <View style={s.v4RecapStakesRow}>
        <View style={s.v4RecapStakesIcon}>
          <Hourglass s={19} c="#E7C36D" w={2} />
        </View>
        <Text style={s.v4RecapStakesEyebrow}>Screen time</Text>
      </View>
      <Text style={s.v4RecapStakesTitle}>
        You lose <Text style={s.v4RecapStakesGold}>{stat.yearlyDays} days</Text> every year to your phone.
      </Text>
      <Text style={s.v4RecapStakesSub}>
        Over an 85-year life, that is <Text style={s.v4RecapStakesGold}>{formatYearValue(stat.lifetimeYears)} years</Text>.
      </Text>
    </Reanimated.View>
  );
}

function V4RecapProblemRow({
  card,
  active,
  accent,
  delay,
}: {
  card: StatementDeckCard;
  active: boolean;
  accent: string;
  delay: number;
}) {
  const cardAccent = statementCardAccent(card, accent);

  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(runSelectionHaptic, delay + 160);
    return () => clearTimeout(timer);
  }, [active, delay]);

  return (
    <Reanimated.View
      entering={FadeIn.delay(delay).duration(400).easing(Easing.bezier(0.16, 1, 0.28, 1)).withInitialValues({
        opacity: 0,
        transform: [{ translateY: 14 }, { scale: 0.97 }],
      })}
      style={[
        s.v4RecapRow,
        active
          ? { borderColor: `${cardAccent}52`, backgroundColor: `${cardAccent}12` }
          : s.v4RecapRowInactive,
      ]}
    >
      <View style={[s.v4RecapRowIcon, active ? { backgroundColor: `${cardAccent}1E` } : s.v4RecapRowIconInactive]}>
        {card.icon}
      </View>
      <Text
        numberOfLines={2}
        style={[s.v4RecapRowText, !active && s.v4RecapRowTextInactive]}
      >
        {STATEMENT_SHORT_LABELS[card.id] ?? card.statement}
      </Text>
      {active ? (
        <View style={[s.v4RecapRowBadge, { backgroundColor: cardAccent }]}>
          <CheckSmall s={13} c="#FFFFFF" w={2.8} />
        </View>
      ) : (
        <View style={[s.v4RecapRowBadge, s.v4RecapRowBadgeInactive]}>
          <X s={11} c="rgba(25,23,20,0.32)" w={2.4} />
        </View>
      )}
    </Reanimated.View>
  );
}

function V4RecapSlide({
  title,
  subtitle,
  cards,
  selected,
  accent,
  hours,
  onNext,
}: {
  title: string;
  subtitle: string;
  cards: StatementDeckCard[];
  selected: string[];
  accent: string;
  hours?: number;
  onNext: () => void;
}) {
  const stat = hours !== undefined ? protectStats(hours) : null;
  const activeCount = cards.filter(card => selected.includes(card.id)).length;
  const rowBaseDelay = stat ? 760 : 420;
  const promptDelay = rowBaseDelay + cards.length * 110 + 260;

  return (
    <View style={s.v4RecapSlide}>
      <ScrollView contentContainerStyle={s.v4RecapScrollContent} showsVerticalScrollIndicator={false}>
        <Reanimated.View
          entering={FadeIn.duration(480).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })}
          style={s.v4RecapHeader}
        >
          <Text style={s.v4DayTitle}>{title}</Text>
          <Text style={s.v4RecapSubtitle}>
            {activeCount > 0 ? subtitle.replace('{count}', `${activeCount}`) : 'Nothing weighing on you here — well done.'}
          </Text>
        </Reanimated.View>

        {stat ? <V4RecapStakesCard stat={stat} /> : null}

        <View style={s.v4RecapList}>
          {cards.map((card, index) => (
            <V4RecapProblemRow
              key={card.id}
              card={card}
              active={selected.includes(card.id)}
              accent={accent}
              delay={rowBaseDelay + index * 110}
            />
          ))}
        </View>

        <ProtectSidePrompt
          delay={promptDelay}
          motionKey={`recap-prompt-${title}`}
          segments={[
            { text: "Let's start " },
            { text: 'fixing your problems', highlight: true },
            { text: '.' },
          ]}
        />
      </ScrollView>

      <AnimatedCta delay={promptDelay + 320} style={s.questionFooter}>
        <View style={s.ctaIsland}>
          <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={onNext} style={s.primaryButton}>
            <Text style={s.primaryButtonText}>Let&apos;s start</Text>
            <ChevronRight s={19} c="#FFFFFF" w={2.5} />
          </TouchableOpacity>
        </View>
      </AnimatedCta>
    </View>
  );
}

function V4SetupLoopSlide({
  title,
  items,
  progressCount,
  onNext,
}: {
  title: string;
  items: string[];
  progressCount: number;
  onNext: () => void;
}) {
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    if (completed.length !== items.length) return undefined;
    const timer = setTimeout(onNext, 650);
    return () => clearTimeout(timer);
  }, [completed.length, items.length, onNext]);

  return (
    <ScrollView contentContainerStyle={s.v4ScrollContent} showsVerticalScrollIndicator={false}>
      <V4ProgressRail completedCount={progressCount} showTools={progressCount >= 3} />
      <Text style={s.v4MomentTitle}>{title}</Text>
      <Text style={s.v4MomentBody}>Tap each setup card and watch your system come together.</Text>
      {items.map(item => {
        const done = completed.includes(item);
        return (
          <TouchableOpacity
            key={item}
            activeOpacity={0.88}
            haptic="medium"
            onPress={() => setCompleted(prev => prev.includes(item) ? prev : [...prev, item])}
            style={[s.v4SetupCard, done && s.v4SetupCardDone]}
          >
            <Text style={s.v4SetupTitle}>{item}</Text>
            <Text style={s.v4SetupBody}>Prepared for your Anasta system.</Text>
            {done ? <CheckSmall s={22} c={GOLD} w={2.4} /> : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function V4FlameSlide({
  completedCount,
  title,
  body,
  surprise,
  recapItems,
  onNext,
}: {
  completedCount: number;
  title: string;
  body: string;
  surprise?: boolean;
  recapItems?: string[];
  onNext: () => void;
}) {
  const [reveal, setReveal] = useState(0);
  const showTools = Boolean(surprise) || completedCount >= 4;
  const previousCompletedCount = Math.max(0, completedCount - 1);
  const railCompletedCount = reveal >= 4 ? completedCount : previousCompletedCount;
  const slotCount = showTools ? 4 : 3;
  const sealFlight = useSharedValue(0);

  useEffect(() => {
    setReveal(0);
    sealFlight.value = 0;
    preloadTaskFeedbackSound();
    preloadAchievementFeedbackSound();
    const timers = [
      setTimeout(() => setReveal(1), 160),
      setTimeout(() => {
        setReveal(2);
        void playAchievementCompleteFeedback();
      }, 520),
      setTimeout(() => setReveal(3), 1340),
      setTimeout(() => {
        setReveal(4);
        sealFlight.value = withTiming(1, {
          duration: 780,
          easing: Easing.inOut(Easing.cubic),
        });
        void playTaskCompleteFeedback();
      }, 2120),
      setTimeout(() => setReveal(5), 3040),
      setTimeout(() => setReveal(6), 3860),
    ];
    return () => timers.forEach(timer => clearTimeout(timer));
  }, [completedCount, sealFlight, showTools]);

  const sealFlightStyle = useAnimatedStyle(() => {
    const denominator = Math.max(1, slotCount - 1);
    const targetX = ((completedCount - 1) / denominator - 0.5) * 300;
    return {
      opacity: interpolate(sealFlight.value, [0, 0.72, 1], [1, 0.96, 0]),
      transform: [
        { translateX: interpolate(sealFlight.value, [0, 0.58, 1], [0, targetX * 0.18, targetX]) },
        { translateY: interpolate(sealFlight.value, [0, 0.62, 1], [0, -164, -226]) },
        { scale: interpolate(sealFlight.value, [0, 0.64, 1], [1, 0.44, 0.15]) },
      ],
    };
  });
  const congratsFlightStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sealFlight.value, [0, 0.18, 0.46], [1, 0.85, 0]),
    transform: [
      { translateY: interpolate(sealFlight.value, [0, 0.46], [0, -9]) },
      { scale: interpolate(sealFlight.value, [0, 0.46], [1, 0.97]) },
    ],
  }));

  return (
    <LinearGradient colors={['#FFFDF8', '#FFFDF8', '#F8EEDC']} style={s.v4FlameSlide}>
      <View style={s.chapterCheckpointStage}>
        <View style={s.chapterCheckpointSealSlot}>
          {reveal >= 1 && reveal < 5 ? (
            <Reanimated.View
              entering={FadeIn.duration(760).withInitialValues({
                opacity: 0,
                transform: [{ translateY: 18 }, { scale: 0.74 }],
              })}
              exiting={FadeOut.duration(1060)}
              style={s.chapterCheckpointAchievement}
            >
              <Reanimated.View style={[s.chapterCheckpointSealFlight, sealFlightStyle]}>
                <View style={s.chapterCheckpointSeal}>
                  <View style={s.chapterCheckpointSealGlow} />
                  {reveal >= 2 ? <CheckpointFlameBurst /> : null}
                </View>
              </Reanimated.View>
              {reveal >= 2 ? (
                <Reanimated.Text
                  entering={FadeIn.delay(360).duration(640).withInitialValues({
                    opacity: 0,
                    transform: [{ translateY: 10 }, { scale: 0.97 }],
                  })}
                  style={[s.chapterCheckpointCongrats, congratsFlightStyle]}
                >
                  Congratulations!
                </Reanimated.Text>
              ) : null}
            </Reanimated.View>
          ) : null}
        </View>

        <View style={s.chapterCheckpointRailSlot}>
          {reveal >= 3 ? (
            <V4ProgressRail
              completedCount={railCompletedCount}
              previousCompletedCount={previousCompletedCount}
              showTools={showTools}
            />
          ) : null}
        </View>

        <View style={s.v4CheckpointCopySlot}>
          {reveal >= 5 ? (
            <Reanimated.View
              entering={FadeIn.duration(620).withInitialValues({
                opacity: 0,
                transform: [{ translateY: 12 }, { scale: 0.98 }],
              })}
              style={s.v4CheckpointCopy}
            >
              <Text style={s.v4MomentTitle}>{title}</Text>
              <Text style={s.v4MomentBody}>{body}</Text>
            </Reanimated.View>
          ) : null}
        </View>

        {reveal >= 6 && recapItems && recapItems.length > 0 ? (
          <View style={s.v4FlameRecapWrap}>
            {recapItems.map((item, itemIndex) => (
              <Reanimated.View
                key={item}
                entering={FadeIn.delay(itemIndex * 110).duration(380).easing(Easing.bezier(0.16, 1, 0.28, 1)).withInitialValues({
                  opacity: 0,
                  transform: [{ translateY: 10 }, { scale: 0.96 }],
                })}
                style={s.v4FlameRecapChip}
              >
                <CheckSmall s={13} c={GOLD} w={2.6} />
                <Text style={s.v4FlameRecapText}>{item}</Text>
              </Reanimated.View>
            ))}
          </View>
        ) : null}
      </View>

      {reveal >= 6 ? (
        <AnimatedCta
          delay={recapItems && recapItems.length > 0 ? recapItems.length * 110 + 320 : 120}
          style={s.questionFooter}
        >
          <View style={s.ctaIsland}>
            <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={onNext} style={s.primaryButton}>
              <Text style={s.primaryButtonText}>Continue</Text>
              <ChevronRight s={19} c="#FFFFFF" w={2.5} />
            </TouchableOpacity>
          </View>
        </AnimatedCta>
      ) : null}
    </LinearGradient>
  );
}

function V4WeeklyRevealSlide({ displayName, onNext }: { displayName?: string; onNext: () => void }) {
  const name = nameForDisplay(displayName);
  const { session, endGuidedSetup } = useGuidedSetup();

  useEffect(() => {
    // The guided organize chain is finished by now; clear the session so no
    // orphaned overlay state survives into the rest of the flow.
    if (session?.active) endGuidedSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(runStrongHaptic, 760);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={s.v4RecapSlide}>
      <ScrollView contentContainerStyle={s.v4RecapScrollContent} showsVerticalScrollIndicator={false}>
        <Reanimated.View
          entering={FadeIn.duration(520).withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })}
          style={s.v4DayHeader}
        >
          <Text style={s.v4Eyebrow}>Your week</Text>
          <Text style={s.v4DayTitle}>{name ? `This is your week, ${name}.` : 'This is your week.'}</Text>
        </Reanimated.View>

        <Reanimated.View
          entering={FadeIn.delay(560).duration(680).easing(Easing.bezier(0.16, 1, 0.28, 1)).withInitialValues({
            opacity: 0,
            transform: [{ translateY: 22 }, { scale: 0.97 }],
          })}
          style={s.v4WeeklyRhythmWrap}
        >
          <WeeklyRhythm />
        </Reanimated.View>

        <ProtectSidePrompt
          delay={1500}
          motionKey="weekly-reveal-prompt"
          segments={[
            { text: 'Your work, your responsibilities, and your prayer belong to ' },
            { text: 'one life', highlight: true },
            { text: '.' },
          ]}
        />
      </ScrollView>

      <AnimatedCta delay={1900} style={s.questionFooter}>
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

const V4_TOOLS_SLIDES = [
  {
    title: 'Journal',
    body: 'Reflection builds self-awareness, clarity, and consistency over time. Three ways to write — pick what fits the moment.',
    icon: <Feather s={30} c={GOLD} w={1.8} />,
    chips: ['Daily Journal', 'Morning Pages', 'Free Writing'],
  },
  {
    title: 'Gratitude',
    body: 'Gratitude during the day has a measurable impact on mood, focus, and your spiritual life.',
    icon: <Heart s={30} c={GOLD} w={1.8} />,
    chips: ['Life Gratitude', 'Daily Gratitude'],
  },
  {
    title: 'Other tools',
    body: 'Ready whenever you need them — no setup required.',
    icon: <Sparkles s={30} c={GOLD} w={1.8} />,
    chips: ['Pomodoro', 'Reading List', 'Bucket List', 'Notes'],
  },
];

function V4ToolsSlides({ onNext, onGratitude }: { onNext: () => void; onGratitude: (enabled: boolean) => void }) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [gratitudeSet, setGratitudeSet] = useState(false);
  const slide = V4_TOOLS_SLIDES[slideIndex];

  return (
    <View style={s.v4CenteredSlide}>
      <V4ProgressRail completedCount={3} showTools />
      <Reanimated.View
        key={`tools-slide-${slideIndex}`}
        entering={FadeIn.duration(420).easing(Easing.out(Easing.cubic)).withInitialValues({
          opacity: 0,
          transform: [{ translateY: 14 }, { scale: 0.98 }],
        })}
        style={s.v4ToolsSlideBody}
      >
        <View style={s.v4ToolsSlideIcon}>{slide.icon}</View>
        <Text style={s.v4Eyebrow}>Bonus tools</Text>
        <Text style={s.v4MomentTitle}>{slide.title}</Text>
        <Text style={s.v4MomentBody}>{slide.body}</Text>
        <View style={s.v4ToolsChipRow}>
          {slide.chips.map((chip, chipIndex) => (
            <Reanimated.View
              key={chip}
              entering={FadeIn.delay(220 + chipIndex * 110).duration(360).withInitialValues({
                opacity: 0,
                transform: [{ translateY: 8 }],
              })}
              style={s.v4ToolsChip}
            >
              <View style={s.v4ToolsChipDot} />
              <Text style={s.v4ToolsChipText}>{chip}</Text>
            </Reanimated.View>
          ))}
        </View>
        {slideIndex === 1 ? (
          <TouchableOpacity
            activeOpacity={0.88}
            haptic="medium"
            onPress={() => {
              setGratitudeSet(true);
              onGratitude(true);
            }}
            style={[s.v4SetupCard, gratitudeSet && s.v4SetupCardDone]}
          >
            <View style={s.v4ToolsGratitudeRow}>
              <View style={s.v4ToolsGratitudeCopy}>
                <Text style={s.v4SetupTitle}>
                  {gratitudeSet ? 'Daily Gratitude is now a task' : 'Set Daily Gratitude as a task'}
                </Text>
                <Text style={s.v4SetupBody}>
                  {gratitudeSet ? 'A quiet rhythm, every day.' : 'Add a quiet gratitude rhythm to your day.'}
                </Text>
              </View>
              {gratitudeSet ? <CheckSmall s={22} c={GOLD} w={2.4} /> : null}
            </View>
          </TouchableOpacity>
        ) : null}
      </Reanimated.View>
      <View style={s.v4ToolsDots}>
        {V4_TOOLS_SLIDES.map((_, dotIndex) => (
          <View key={`tools-dot-${dotIndex}`} style={[s.v4ToolsDot, dotIndex === slideIndex && s.v4ToolsDotActive]} />
        ))}
      </View>
      <View style={s.ctaIsland}>
        <TouchableOpacity
          activeOpacity={0.9}
          haptic="medium"
          onPress={() => slideIndex >= V4_TOOLS_SLIDES.length - 1 ? onNext() : setSlideIndex(prev => prev + 1)}
          style={s.primaryButton}
        >
          <Text style={s.primaryButtonText}>{slideIndex >= V4_TOOLS_SLIDES.length - 1 ? 'Continue' : 'Next'}</Text>
          <ChevronRight s={19} c="#FFFFFF" w={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function V4HomeRevealSlide({ onNext }: { onNext: () => void }) {
  const rows = ['Big Event countdown', 'Morning prayer', 'Deep work', 'Read Scripture', 'Daily gratitude'];
  return (
    <ScrollView contentContainerStyle={s.v4ScrollContent} showsVerticalScrollIndicator={false}>
      <Text style={s.v4Eyebrow}>Home</Text>
      <Text style={s.v4MomentTitle}>This is your Home.</Text>
      {rows.map((row, index) => (
        <Reanimated.View key={row} entering={FadeInUp.delay(index * 140).duration(340)} style={s.v4HomeRow}>
          <CheckSmall s={18} c={GOLD} w={2.2} />
          <Text style={s.v4HomeText}>{row}</Text>
        </Reanimated.View>
      ))}
      <ProtectSidePrompt delay={720} segments={[{ text: 'You built all of this. Let us show you how to use it.' }]} compact />
      <View style={s.ctaIsland}>
        <TouchableOpacity activeOpacity={0.9} haptic="medium" onPress={onNext} style={s.primaryButton}>
          <Text style={s.primaryButtonText}>Show me</Text>
          <ChevronRight s={19} c="#FFFFFF" w={2.5} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function V4FirstCheckoffSlide({ onNext }: { onNext: () => void }) {
  const [checked, setChecked] = useState(false);
  const handleCheck = () => {
    runStrongHaptic();
    setChecked(true);
    setTimeout(onNext, 1200);
  };

  return (
    <View style={s.v4CenteredSlide}>
      <Text style={s.v4MomentTitle}>Now complete your first task.</Text>
      <TouchableOpacity
        activeOpacity={0.88}
        haptic="none"
        onPress={handleCheck}
        style={[s.v4FirstTask, checked && s.v4FirstTaskDone]}
      >
        <Text style={s.v4FirstTaskText}>{checked ? 'Marked as prayed.' : 'Morning prayer'}</Text>
        {checked ? <CheckSmall s={28} c="#FFFFFF" w={2.8} /> : null}
      </TouchableOpacity>
      <Text style={s.v4MomentBody}>{checked ? 'A small beginning. Keep walking.' : 'One faithful action at a time.'}</Text>
    </View>
  );
}

function V4ProfileSlide({
  answers,
  onSelect,
  onNext,
}: {
  answers: Answers;
  onSelect: (step: StepId, value: string) => void;
  onNext: () => void;
}) {
  const ready = Boolean(answers.age && answers.gender);
  return (
    <ScrollView contentContainerStyle={s.v4ScrollContent} showsVerticalScrollIndicator={false}>
      <Text style={s.v4MomentTitle}>Help us understand who Anasta serves.</Text>
      <Text style={s.v4Eyebrow}>How old are you?</Text>
      {AGE_OPTIONS.map(option => (
        <View key={option.value} style={s.v4OptionWrap}>
          <OptionCard
            option={option}
            active={answers.age === option.value}
            disabled={false}
            onPress={() => onSelect('age', option.value)}
          />
        </View>
      ))}
      <Text style={s.v4Eyebrow}>Are you male or female?</Text>
      {GENDER_OPTIONS.map(option => (
        <View key={option.value} style={s.v4OptionWrap}>
          <OptionCard
            option={option}
            active={answers.gender === option.value}
            disabled={false}
            onPress={() => onSelect('gender', option.value)}
          />
        </View>
      ))}
      <View style={s.ctaIsland}>
        <TouchableOpacity
          activeOpacity={0.9}
          haptic="medium"
          disabled={!ready}
          onPress={onNext}
          style={[s.primaryButton, !ready && s.primaryButtonDisabled]}
        >
          <Text style={[s.primaryButtonText, !ready && s.primaryButtonDisabledText]}>Continue</Text>
          <ChevronRight s={19} c={ready ? '#FFFFFF' : 'rgba(25,23,20,0.34)'} w={2.5} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function V4AccountCreationSlide({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<'apple' | 'google' | 'email' | undefined>();
  const options: { id: 'apple' | 'google' | 'email'; title: string; body: string; icon: React.ReactNode }[] = [
    { id: 'apple', title: 'Continue with Apple', body: 'Fast, private sign in.', icon: <User s={22} c={GOLD} w={1.8} /> },
    { id: 'google', title: 'Continue with Google', body: 'Use your Google account.', icon: <Sparkles s={21} c={GOLD} w={1.9} /> },
    { id: 'email', title: 'Continue with Email', body: 'Create an account with email.', icon: <Feather s={21} c={GOLD} w={1.8} /> },
  ];

  return (
    <View style={s.v4CenteredSlide}>
      <Text style={s.v4MomentTitle}>Save your progress.</Text>
      <Text style={s.v4MomentBody}>Create an account so the system you built is ready when you return.</Text>
      <View style={s.v4AccountOptions}>
        {options.map(option => {
          const active = selected === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              activeOpacity={0.88}
              haptic="medium"
              onPress={() => setSelected(option.id)}
              style={[s.v4AccountOption, active && s.v4AccountOptionSelected]}
            >
              <View style={s.v4AccountIcon}>{active ? <CheckSmall s={20} c={GOLD} w={2.5} /> : option.icon}</View>
              <View style={s.v4AccountCopy}>
                <Text style={s.v4AccountTitle}>{option.title}</Text>
                <Text style={s.v4AccountBody}>{option.body}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.ctaIsland}>
        <TouchableOpacity
          activeOpacity={0.9}
          haptic="medium"
          disabled={!selected}
          onPress={onNext}
          style={[s.primaryButton, !selected && s.primaryButtonDisabled]}
        >
          <Text style={[s.primaryButtonText, !selected && s.primaryButtonDisabledText]}>Continue</Text>
          <ChevronRight s={19} c={selected ? '#FFFFFF' : 'rgba(25,23,20,0.34)'} w={2.5} />
        </TouchableOpacity>
      </View>
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
  const { beginGuidedSetup } = useGuidedSetup();
  const [answers, setAnswers] = useState<Answers>({});
  const [preloadPhase, setPreloadPhase] = useState<PreloadPhase>('only');
  const [tutorialRun, setTutorialRun] = useState(0);
  const steps = useMemo(() => stepOrder(answers), [answers]);
  const [index, setIndex] = useState(0);
  const activeStep = steps[Math.min(index, steps.length - 1)];
  const activeProgress = progressForStep(activeStep, answers);
  const screenMotion = useSharedValue(1);
  const preloadExit = useSharedValue(0);
  const previousStepRef = useRef(activeStep);

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
    const previousStep = previousStepRef.current;
    previousStepRef.current = activeStep;

    if (isValueStep(previousStep) && isValueStep(activeStep)) {
      screenMotion.value = 1;
      return;
    }

    screenMotion.value = 0;
    screenMotion.value = withTiming(1, {
      duration:
        previousStep === 'setupStart' && (activeStep === 'protectPain' || activeStep === 'buildIntro')
          ? 760
          : previousStep === 'valueFocus' && activeStep === 'valueReflect'
            ? 430
            : 260,
      easing:
        previousStep === 'setupStart' && (activeStep === 'protectPain' || activeStep === 'buildIntro')
          ? Easing.bezier(0.16, 1, 0.28, 1)
          : Easing.out(Easing.cubic),
    });
  }, [activeStep, screenMotion]);

  useEffect(() => {
    if (index > steps.length - 1) {
      setIndex(steps.length - 1);
    }
  }, [index, steps.length]);

  useEffect(() => {
    if (activeStep !== 'processing') return undefined;
    const delay = 1800;
    const timer = setTimeout(() => {
      runAdvanceHaptic();
      setIndex(prev => Math.min(steps.length - 1, prev + 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [activeStep, steps.length]);

  useEffect(() => {
    if (activeStep === 'statementsIntro' || activeStep === 'tutorialDeck') {
      void warmStatementImages(PROTECT_STATEMENT_IMAGES);
      return;
    }

    if (
      activeStep === 'screenTimeSlider' ||
      activeStep === 'dayVisualization' ||
      activeStep === 'protectRecap' ||
      activeStep === 'flameProtect' ||
      activeStep === 'organizeDeck'
    ) {
      void warmStatementImages(ORGANIZE_STATEMENT_IMAGES);
    }
  }, [activeStep]);

  const goBack = () => {
    const previousStep = steps[Math.max(0, index - 1)];
    if (!isValueStep(activeStep) && !isValueStep(previousStep)) {
      runAdvanceHaptic();
    }
    if (index <= 0) {
      router.back();
      return;
    }
    setIndex(prev => Math.max(0, prev - 1));
  };

  const goNext = () => {
    const nextStep = steps[Math.min(steps.length - 1, index + 1)];
    if (!isValueStep(activeStep) && !isValueStep(nextStep)) {
      runAdvanceHaptic();
    }
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
      if (step === 'tradition') {
        const nextTradition = value as TraditionAnswer;
        return {
          ...prev,
          tradition: nextTradition,
          isOrthodox: nextTradition === 'orthodox',
          secularFilter: isSecularTradition(nextTradition),
        };
      }
      if (step === 'age') return { ...prev, age: value as AgeAnswer };
      if (step === 'gender') return { ...prev, gender: value as GenderAnswer };
      if (step === 'commitment') return { ...prev, commitment: value as CommitmentAnswer };
      if (step === 'pillars') return { ...prev, primaryPillar: value as PillarAnswer };
      if (step === 'valueReflect') {
        const nextValue = value as ValueReflectAnswer;
        const current = prev.valueReflection ?? [];
        const exists = current.includes(nextValue);
        return {
          ...prev,
          valueReflection: exists ? current.filter(item => item !== nextValue) : [...current, nextValue],
        };
      }
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
  const onNameChange = (name: string) => {
    setAnswers(prev => ({ ...prev, displayName: name }));
  };
  const onTraditionChange = useCallback((tradition: TraditionAnswer) => {
    setAnswers(prev => ({
      ...prev,
      tradition,
      isOrthodox: tradition === 'orthodox',
      secularFilter: isSecularTradition(tradition),
    }));
  }, []);
  const onScreenTimeHoursChange = useCallback((hours: number) => {
    setAnswers(prev => ({ ...prev, screenTimeHours: hours }));
  }, []);
  const onFirstChapterChange = useCallback((chapter: OnboardingChapter) => {
    runSelectionHaptic();
    setAnswers(prev => ({ ...prev, firstChapter: chapter }));
  }, []);
  const startBuildSetup = () => {
    const firstChapter = answers.firstChapter ?? 'protect';
    beginGuidedSetup({
      currentChapter: 'build',
      chapterOrder: firstChapter === 'build' ? ['build', 'protect'] : ['protect', 'build'],
      activeStep: 'buildBigEvents',
      phase: 'intro',
      route: '/onboarding',
    });
    goNext();
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
  const valueStepActive = isValueStep(activeStep);
  const hideTopChrome =
    activeStep === 'nameIntro' ||
    activeStep === 'traditionIntro' ||
    activeStep === 'toolsShowcase' ||
    activeStep === 'processing' ||
    activeStep === 'valueReflect' ||
    activeStep === 'commitment' ||
    activeStep === 'age' ||
    activeStep === 'gender' ||
    valueStepActive ||
    isGuidedWalkthroughStep(activeStep);
  const visibleProgress = hideTopChrome ? null : activeProgress;
  const showBack =
    !hideTopChrome &&
    activeStep !== 'welcome' &&
    activeStep !== 'questionIntro' &&
    activeStep !== 'bridge' &&
    activeStep !== 'organizeIntro';
  const showTopSkip = visibleProgress !== null;
  const edgeToEdgeMessage =
    activeStep === 'nameIntro' ||
    activeStep === 'traditionIntro' ||
    activeStep === 'toolsShowcase' ||
    activeStep === 'tutorialDeck' ||
    activeStep === 'protectDeck' ||
    activeStep === 'organizeDeck' ||
    valueStepActive ||
    activeStep === 'bridge' ||
    activeStep === 'organizeIntro' ||
    activeStep === 'taskSetup';
  const stageBottomPadding = activeStep === 'questionIntro' || edgeToEdgeMessage ? 0 : insets.bottom + 8;
  const stageTopPadding = edgeToEdgeMessage ? 0 : hideTopChrome ? insets.top + 12 : 0;
  const stageHorizontalPadding = edgeToEdgeMessage ? 0 : 20;

  if (preloadPhase === 'only') {
    return <OnboardingPreload bottomInset={insets.bottom} topInset={insets.top} />;
  }

  if (activeStep === 'buildBigEvents') {
    return (
      <View style={s.screen}>
        <BigEventsView guided onGuidedComplete={goNext} />
        <GuidedOverlayHost />
      </View>
    );
  }

  if (activeStep === 'buildMonthlyGoals') {
    return (
      <View style={s.screen}>
        <MonthlyGoalsView guided onGuidedComplete={goNext} />
        <GuidedOverlayHost />
      </View>
    );
  }

  if (activeStep === 'buildHabits') {
    return (
      <View style={s.screen}>
        <HabitsView guided onGuidedComplete={goNext} />
        <GuidedOverlayHost />
      </View>
    );
  }

  if (activeStep === 'buildChallenges') {
    return (
      <View style={s.screen}>
        <ChallengesView guided onGuidedComplete={goNext} />
        <GuidedOverlayHost />
      </View>
    );
  }

  if (activeStep === 'buildMyRoutine') {
    return (
      <View style={s.screen}>
        <MyRoutineView guided onGuidedComplete={goNext} />
        <GuidedOverlayHost />
      </View>
    );
  }

  const renderStep = () => {
    if (activeStep === 'welcome') return <WelcomeSlide ready={preloadPhase === 'done'} onNext={goNext} />;
    if (activeStep === 'nameIntro') {
      return (
        <NameIntroSlide
          value={answers.displayName}
          bottomInset={insets.bottom}
          onNameChange={onNameChange}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'traditionIntro') {
      return (
        <TraditionIntroSlide
          name={answers.displayName}
          tradition={answers.tradition}
          bottomInset={insets.bottom}
          onTraditionChange={onTraditionChange}
          onNext={goNext}
        />
      );
    }
    if (isValueStep(activeStep)) {
      return (
        <ValuePreviewSlide
          step={activeStep}
          topInset={insets.top}
          bottomInset={insets.bottom}
          onNext={goNext}
          onBack={goBack}
        />
      );
    }
    if (activeStep === 'toolsShowcase') {
      return (
        <ToolsShowcaseSlide
          topInset={insets.top}
          bottomInset={insets.bottom}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'statementsIntro') {
      return <V4StatementsIntroSlide displayName={answers.displayName} onNext={goNext} />;
    }
    if (activeStep === 'tutorialDeck') {
      return (
        <V4StatementDeckSlide
          key={`tutorial-deck-${tutorialRun}`}
          cards={TUTORIAL_DECK_CARDS}
          accent="#4D8586"
          topInset={insets.top}
          bottomInset={insets.bottom}
          onDone={ids => ids.includes('tutorial-ready') ? goNext() : setTutorialRun(prev => prev + 1)}
        />
      );
    }
    if (activeStep === 'protectDeck') {
      const protectCards = answers.secularFilter || isSecularTradition(answers.tradition)
        ? PROTECT_DECK_CARDS.map(card => card.id === 'presence'
          ? { ...card, statement: 'I want to be fully present — in quiet moments, with family, at work. But distractions keep pulling me away.' }
          : card)
        : PROTECT_DECK_CARDS;
      return (
        <V4StatementDeckSlide
          cards={protectCards}
          accent="#4D8586"
          topInset={insets.top}
          bottomInset={insets.bottom}
          onDone={ids => {
            setAnswers(prev => ({ ...prev, confirmedProtectProblems: ids }));
            goNext();
          }}
        />
      );
    }
    if (activeStep === 'screenTimeSlider') {
      return (
        <V4ScreenTimeSliderSlide
          hours={answers.screenTimeHours}
          onChange={onScreenTimeHoursChange}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'dayVisualization') {
      return <V4DayVisualizationSlide hours={answers.screenTimeHours} onNext={goNext} />;
    }
    if (activeStep === 'protectRecap') {
      return (
        <V4RecapSlide
          title="Here's what we heard."
          subtitle="You confirmed {count} problems. Let's deal with them."
          cards={PROTECT_DECK_CARDS}
          selected={answers.confirmedProtectProblems ?? []}
          accent="#4D8586"
          hours={answers.screenTimeHours}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'flameProtect') {
      return <V4FlameSlide completedCount={1} title="Protect is ready." body="Your first slot is lit." onNext={goNext} />;
    }
    if (activeStep === 'organizeDeck') {
      const organizeCards = answers.secularFilter || isSecularTradition(answers.tradition)
        ? ORGANIZE_DECK_CARDS.filter(card => !card.spiritual)
        : ORGANIZE_DECK_CARDS;
      return (
        <V4StatementDeckSlide
          cards={organizeCards}
          accent="#4D8586"
          topInset={insets.top}
          bottomInset={insets.bottom}
          onDone={ids => {
            setAnswers(prev => ({ ...prev, confirmedOrganizeProblems: ids }));
            goNext();
          }}
        />
      );
    }
    if (activeStep === 'organizeRecap') {
      return (
        <V4RecapSlide
          title="Now — your life."
          subtitle="You confirmed {count} problems. One system fixes them."
          cards={ORGANIZE_DECK_CARDS}
          selected={answers.confirmedOrganizeProblems ?? []}
          accent="#4D8586"
          onNext={() => {
            if ((answers.confirmedOrganizeProblems ?? []).length > 0) {
              beginGuidedSetup({
                currentChapter: 'build',
                chapterOrder: ['build'],
                activeStep: 'buildBigEvents',
                phase: 'intro',
                route: '/onboarding',
              });
            }
            goNext();
          }}
        />
      );
    }
    if (activeStep === 'weeklyReveal') return <V4WeeklyRevealSlide displayName={answers.displayName} onNext={goNext} />;
    if (activeStep === 'flameOrganize') {
      return <V4FlameSlide completedCount={2} title="Organize is ready." body="Your week has a rhythm now." onNext={goNext} />;
    }
    if (activeStep === 'giftMoment') {
      return (
        <V4MomentSlide
          eyebrow="Free for everyone"
          title="Grow closer to God."
          body="Scripture, Favorites, Bible Notes, and Prayer Book stay available to everyone."
          icon={<OpenBook s={54} c={GOLD} w={1.5} />}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'bibleWalkthrough') {
      return (
        <V4MomentSlide
          title="Bible walkthrough"
          body="Highlight Ephesians 5:14, save it to Favorites, add notes, and return to the exact verse when you need it."
          icon={<BookMarked s={54} c={GOLD} w={1.5} />}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'prayerBook') {
      return (
        <V4MomentSlide
          title="Prayer Book"
          body={answers.isOrthodox || answers.tradition === 'orthodox'
            ? 'As an Orthodox Christian, morning, evening, and Jesus Prayer rules can be prepared for you.'
            : 'Morning, evening, and mealtime prayers are organized and always available.'}
          icon={<Candle s={54} c={GOLD} w={1.5} />}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'flameGrow') {
      return <V4FlameSlide completedCount={3} title="One more thing." body="Let's show you a few more tools Anasta has for you." surprise onNext={goNext} />;
    }
    if (activeStep === 'toolsSlides') {
      return <V4ToolsSlides onNext={goNext} onGratitude={enabled => setAnswers(prev => ({ ...prev, gratitudeDailyTask: enabled }))} />;
    }
    if (activeStep === 'flameTools') {
      const wins: string[] = (answers.confirmedProtectProblems ?? [])
        .map(id => PROTECT_RECAP_WINS[id])
        .filter(Boolean);
      if ((answers.confirmedOrganizeProblems ?? []).length > 0) {
        wins.push('Big event on the horizon', 'Monthly goal set', 'First habit started', 'A challenge running', 'Your week organized');
      }
      if (answers.gratitudeDailyTask) {
        wins.push('Daily gratitude in your rhythm');
      }
      return (
        <V4FlameSlide
          completedCount={4}
          title={`You're ready${nameForDisplay(answers.displayName) ? `, ${nameForDisplay(answers.displayName)}` : ''}.`}
          body="Look at everything you just built. Now keep what you made."
          surprise
          recapItems={wins}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'privacy') {
      return (
        <V4MomentSlide
          title="Your inner life deserves privacy."
          body="Your prayers, notes, journal, and reflections are personal. Anasta is built to protect that trust."
          icon={<Heart s={54} c={GOLD} w={1.5} />}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'callingClose') {
      return <ValueToolsClosingSlide topInset={insets.top} bottomInset={insets.bottom} onNext={goNext} />;
    }
    if (activeStep === 'homeReveal') return <V4HomeRevealSlide onNext={goNext} />;
    if (activeStep === 'firstCheckoff') return <V4FirstCheckoffSlide onNext={goNext} />;
    if (activeStep === 'postPaywallBrand') {
      return (
        <V4MomentSlide
          title="Arise."
          body="It's human to fall. It's not human to stay down. God still loves you when you stumble. Just arise, and keep walking."
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'postPaywallProfile') {
      return <V4ProfileSlide answers={answers} onSelect={onSelect} onNext={goNext} />;
    }
    if (activeStep === 'accountCreation') {
      return <V4AccountCreationSlide onNext={goNext} />;
    }
    if (activeStep === 'questionIntro') return <AutoMessageSlide bottomInset={insets.bottom} displayName={answers.displayName} onNext={goNext} />;
    if (activeStep === 'processing') return <ProcessingSlide />;
    if (activeStep === 'setupStart') {
      return (
        <SetupStartSlide
          selected={answers.firstChapter}
          displayName={answers.displayName}
          onSelect={onFirstChapterChange}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'protectIntro') return <ProtectIntroSlide onNext={goNext} />;
    if (activeStep === 'protectPain') {
      return (
        <ProtectPainSlide
          hours={answers.screenTimeHours}
          onChange={onScreenTimeHoursChange}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'protectScreenTime') {
      return (
        <ProtectScreenTimeSlide
          hours={answers.screenTimeHours}
          onChange={onScreenTimeHoursChange}
          onNext={goNext}
        />
      );
    }
    if (activeStep === 'protectCalculation') return <ProtectCalculationSlide screenTimeHours={answers.screenTimeHours} onNext={goNext} />;
    if (activeStep === 'protectReframe') return <ProtectReframeSlide screenTimeHours={answers.screenTimeHours} onNext={goNext} />;
    if (activeStep === 'protectAppBlockers') return <ProtectAppBlockersSlide onNext={goNext} />;
    if (activeStep === 'protectWebsiteBlockers') return <ProtectWebsiteBlockersSlide onNext={goNext} />;
    if (activeStep === 'protectFocusBlock') return <ProtectFocusBlockSlide onNext={goNext} />;
    if (activeStep === 'protectComplete') return <ProtectCompleteSlide onNext={goNext} />;
    if (activeStep === 'buildIntro') return <BuildIntroSlide onNext={startBuildSetup} />;
    if (activeStep === 'buildWeeklyRhythm') return <BuildWeeklyRhythmSlide onNext={goNext} />;
    if (activeStep === 'buildTaskTypes') return <BuildTaskTypesSlide onNext={goNext} />;
    if (activeStep === 'buildSpiritualTasks') return <BuildSpiritualTasksSlide onNext={goNext} />;
    if (activeStep === 'buildRoutineTasks') return <BuildRoutineTasksSlide onNext={goNext} />;
    if (activeStep === 'buildQuickTasks') return <BuildQuickTasksSlide onNext={goNext} />;
    if (activeStep === 'buildHomePreview') return <BuildHomePreviewSlide onNext={goNext} />;
    if (activeStep === 'buildComplete') return <BuildCompleteSlide onNext={goNext} />;
    if (activeStep === 'chapterCheckpointFirst') {
      return <ChapterCheckpointSlide firstChapter={answers.firstChapter} onNext={goNext} />;
    }
    if (activeStep === 'chapterCheckpointFinal') {
      return <ChapterCheckpointSlide firstChapter={answers.firstChapter} final onNext={goNext} />;
    }
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

      {activeStep === 'welcome' ? (
        <WelcomeConfettiOverlay active={preloadPhase === 'done'} />
      ) : null}
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
  valueSlide: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  valueCarouselViewport: {
    flex: 1,
    overflow: 'hidden',
    zIndex: 2,
  },
  valueClosingViewport: {
    flex: 1,
    overflow: 'hidden',
    zIndex: 2,
  },
  valueCarouselTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  valuePage: {
    flex: 1,
    position: 'relative',
  },
  valueBackdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  valueBackdropBandTop: {
    position: 'absolute',
    top: 74,
    left: 28,
    right: 28,
    height: 118,
    borderRadius: 70,
    backgroundColor: 'rgba(197,160,89,0.045)',
    transform: [{ rotate: '-7deg' }],
  },
  valueBackdropBandBottom: {
    position: 'absolute',
    bottom: -110,
    left: -88,
    right: -88,
    height: 310,
    borderRadius: 170,
    backgroundColor: 'rgba(197,160,89,0.18)',
    transform: [{ rotate: '8deg' }],
  },
  valueBackdropLineOne: {
    position: 'absolute',
    top: '50%',
    left: 36,
    right: 36,
    height: 1,
    backgroundColor: 'rgba(197,160,89,0.10)',
    transform: [{ rotate: '-5deg' }],
  },
  valueBackdropLineTwo: {
    position: 'absolute',
    top: '54%',
    left: 54,
    right: 54,
    height: 1,
    backgroundColor: 'rgba(25,23,20,0.035)',
    transform: [{ rotate: '-5deg' }],
  },
  valueCopy: {
    paddingHorizontal: 25,
    alignItems: 'center',
    zIndex: 2,
  },
  valueTitleShell: {
    position: 'relative',
    maxWidth: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueTitleTextWrap: {
    alignItems: 'center',
  },
  valueTitle: {
    maxWidth: 342,
    fontFamily: F.serifSemiBold,
    fontSize: 40,
    lineHeight: 42,
    textAlign: 'center',
    color: INK,
  },
  valueFreeCornerTag: {
    position: 'absolute',
    left: -5,
    top: -14,
    zIndex: 4,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: '#17130F',
    borderWidth: 1,
    borderColor: 'rgba(232,195,116,0.78)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 12,
    elevation: 3,
    transform: [{ rotate: '-11deg' }],
  },
  valueFreeCornerTagText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: '#F8E8BE',
  },
  valueTitleUnderline: {
    marginTop: -3,
    height: 2.25,
    borderRadius: 99,
    backgroundColor: GOLD,
    opacity: 0.80,
  },
  valueSubtitleFrame: {
    marginTop: 6,
    width: '100%',
    maxWidth: 348,
    minHeight: 0,
    paddingHorizontal: 6,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  valueSubtitleLine: {
    maxWidth: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'baseline',
    columnGap: 5,
    rowGap: 0,
    transform: [{ translateY: -2 }],
  },
  valueSubtitleWord: {
    fontFamily: F.serifMedium,
    fontSize: 17.4,
    lineHeight: 20.8,
    color: 'rgba(25,23,20,0.66)',
  },
  valueSubtitleWordEmphasis: {
    fontFamily: F.serifSemiBold,
  },
  valueSubtitleWordUnderline: {
    textDecorationLine: 'underline',
    textDecorationColor: GOLD,
    textDecorationStyle: 'solid',
  },
  valuePhoneStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    paddingBottom: 116,
    zIndex: 4,
  },
  valuePhoneStageOrganize: {
    paddingTop: 24,
  },
  valueVisualReveal: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueIllustration: {
    width: '100%',
    maxWidth: 342,
    alignItems: 'center',
    paddingTop: 8,
  },
  valueDisciplineHero: {
    width: 128,
    height: 128,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
    elevation: 3,
  },
  valueDisciplineHalo: {
    position: 'absolute',
    width: 162,
    height: 162,
    borderRadius: 81,
    backgroundColor: 'rgba(197,160,89,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.10)',
  },
  valueDisciplineHeroText: {
    marginTop: 8,
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    color: INK,
  },
  valueDisciplineBars: {
    height: 104,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: 8,
  },
  valueDisciplineBarTrack: {
    width: 22,
    height: 100,
    borderRadius: 999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: 'rgba(25,23,20,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.04)',
  },
  valueDisciplineBarFill: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  valueDisciplineCards: {
    width: '100%',
    marginTop: 14,
    rowGap: 8,
  },
  valueMiniFeatureCard: {
    minHeight: 54,
    width: '100%',
    borderRadius: 18,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    backgroundColor: 'rgba(255,253,248,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.045,
    shadowRadius: 14,
    elevation: 1,
  },
  valueMiniFeatureCardCompact: {
    minHeight: 50,
    borderRadius: 17,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,253,248,0.94)',
    borderColor: 'rgba(197,160,89,0.28)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.075,
    shadowRadius: 18,
    elevation: 2,
  },
  valueFocusFeatureCard: {
    minHeight: 50,
    width: '100%',
    borderRadius: 17,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 11,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.32)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  valueFocusFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  valueFocusFeatureText: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    lineHeight: 19,
    color: INK,
  },
  valueFocusFeatureCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.30)',
  },
  valueMiniFeatureIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
  },
  valueMiniFeatureText: {
    flex: 1,
    fontFamily: F.serifSemiBold,
    fontSize: 16,
    lineHeight: 20,
    color: INK,
  },
  valueMiniFeatureTextCompact: {
    fontSize: 15.8,
    lineHeight: 19.5,
  },
  valueFocusVisual: {
    width: '100%',
    maxWidth: 376,
    alignItems: 'center',
    paddingTop: 10,
  },
  valueFocusTagsWrap: {
    height: 358,
    width: '100%',
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 0.99 }, { translateY: 0 }],
  },
  valueFocusCards: {
    width: '100%',
    marginTop: 2,
    rowGap: 2,
  },
  valueFaithVisual: {
    width: '91%',
    maxWidth: 370,
    alignItems: 'center',
    paddingTop: 24,
  },
  valueFaithFeatureStack: {
    width: '100%',
    marginTop: 2,
    rowGap: 2,
    position: 'relative',
    overflow: 'visible',
  },
  valueFaithFeatureRow: {
    width: '100%',
    minHeight: 108,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 0,
    overflow: 'visible',
    zIndex: 1,
    elevation: 1,
  },
  valueFaithFeatureRowReverse: {
    flexDirection: 'row-reverse',
  },
  valueFaithArtSlot: {
    width: 106,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 40,
    elevation: 40,
  },
  valueFaithArtFloat: {
    width: 174,
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 40,
    elevation: 40,
  },
  valueFaithArtPrayerFloat: {
    width: 192,
    height: 164,
  },
  valueFaithArtOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
    zIndex: 100,
    elevation: 100,
  },
  valueFaithArtOverlaySlot: {
    position: 'absolute',
  },
  valueFaithSticker: {
    width: '100%',
    height: '100%',
  },
  valueFaithTextCard: {
    flex: 1,
    minHeight: 86,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,253,248,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.085,
    shadowRadius: 22,
    elevation: 1,
    zIndex: 1,
  },
  valueFaithTextCardForward: {
    marginLeft: -24,
    paddingLeft: 26,
  },
  valueFaithTextCardReverse: {
    marginRight: -24,
    paddingRight: 26,
  },
  valueFaithArtBible: {
    borderColor: 'rgba(197,160,89,0.28)',
    backgroundColor: 'rgba(255,250,239,0.96)',
  },
  valueFaithArtPrayer: {
    borderColor: 'rgba(77,133,134,0.22)',
    backgroundColor: 'rgba(245,250,248,0.96)',
  },
  valueFaithArtNotes: {
    borderColor: 'rgba(143,93,108,0.22)',
    backgroundColor: 'rgba(255,248,250,0.96)',
  },
  valueFaithArtFavorites: {
    borderColor: 'rgba(197,160,89,0.34)',
    backgroundColor: 'rgba(255,247,232,0.96)',
  },
  valueFaithAccentBible: {
    backgroundColor: GOLD,
  },
  valueFaithAccentPrayer: {
    backgroundColor: '#4D8586',
  },
  valueFaithAccentNotes: {
    backgroundColor: '#8F5D6C',
  },
  valueFaithAccentFavorites: {
    backgroundColor: '#17130F',
  },
  valueFaithCardGlow: {
    position: 'absolute',
    top: -28,
    right: -28,
    width: 86,
    height: 86,
    borderRadius: 43,
    opacity: 0.10,
  },
  valueFaithTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
  valueFaithTitleMark: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.92,
  },
  valueFaithFeatureTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 19.6,
    lineHeight: 23,
    color: INK,
  },
  valueFaithFeatureRule: {
    height: 2,
    marginTop: 1,
    marginLeft: 16,
    borderRadius: 999,
    opacity: 0.42,
  },
  valueFaithFeatureBody: {
    marginTop: 2,
    fontFamily: F.serifMedium,
    fontSize: 14.4,
    lineHeight: 18.8,
    color: 'rgba(25,23,20,0.70)',
  },
  valueFaithFavoriteOrb: {
    width: 96,
    height: 96,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 2,
    borderWidth: 1,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 3,
  },
  valueFaithFavoriteOrbDark: {
    backgroundColor: '#17130F',
    borderColor: 'rgba(232,195,116,0.72)',
  },
  valueFaithFreeImageFrame: {
    width: 176,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -1,
    zIndex: 12,
    elevation: 12,
  },
  valueFaithFreeImageSlideSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 16,
    elevation: 16,
  },
  valueFaithFreeImage: {
    width: '100%',
    height: '100%',
  },
  valueFaithFreeBadge: {
    minHeight: 44,
    marginTop: 14,
    borderRadius: 999,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
    backgroundColor: '#17130F',
    borderWidth: 1,
    borderColor: 'rgba(232,195,116,0.78)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 4,
  },
  valueFaithFreeBadgeText: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    lineHeight: 21,
    color: '#F8E8BE',
  },
  valueFeatureVisual: {
    width: '100%',
    maxWidth: 344,
    alignItems: 'center',
    paddingTop: 16,
  },
  valueFreeBadge: {
    minHeight: 42,
    borderRadius: 999,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 7,
    backgroundColor: '#17130F',
    borderWidth: 1,
    borderColor: 'rgba(232,195,116,0.72)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 3,
  },
  valueFreeBadgeText: {
    fontFamily: F.serifSemiBold,
    fontSize: 16,
    color: '#F8E8BE',
  },
  valueGrowthOrb: {
    width: 118,
    height: 118,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.25)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
    elevation: 3,
  },
  valueGrowthGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(197,160,89,0.10)',
  },
  valueFeatureChipList: {
    width: '100%',
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 9,
  },
  valueFeatureChip: {
    minHeight: 46,
    borderRadius: 999,
    paddingLeft: 9,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    backgroundColor: 'rgba(255,253,248,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.045,
    shadowRadius: 14,
    elevation: 1,
  },
  valueFeatureChipIcon: {
    width: 31,
    height: 31,
    borderRadius: 15.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.11)',
  },
  valueFeatureChipText: {
    fontFamily: F.serifSemiBold,
    fontSize: 15,
    lineHeight: 18,
    color: INK,
  },
  valuePhoneMotionShell: {
    width: 270,
    height: 526,
    position: 'relative',
  },
  valuePhoneOuter: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 58,
    backgroundColor: '#0F0E0D',
    padding: 4.5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.70)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.20,
    shadowRadius: 38,
    elevation: 12,
    zIndex: 2,
  },
  valueOrganizeConfettiLayer: {
    position: 'absolute',
    top: -350,
    left: -158,
    right: -158,
    bottom: -150,
    zIndex: 0,
    elevation: 0,
    transform: [{ scale: 0.86 }],
  },
  valueOrganizeReveal: {
    width: '100%',
  },
  valuePhoneSideButtonLeft: {
    position: 'absolute',
    left: -3,
    top: 104,
    width: 4,
    height: 54,
    borderRadius: 4,
    backgroundColor: '#2A2622',
    zIndex: 3,
  },
  valuePhoneSideButtonRightTop: {
    position: 'absolute',
    right: -3,
    top: 122,
    width: 4,
    height: 42,
    borderRadius: 4,
    backgroundColor: '#2A2622',
    zIndex: 3,
  },
  valuePhoneSideButtonRightBottom: {
    position: 'absolute',
    right: -3,
    top: 176,
    width: 4,
    height: 58,
    borderRadius: 4,
    backgroundColor: '#2A2622',
    zIndex: 3,
  },
  valuePhoneBezel: {
    flex: 1,
    borderRadius: 53,
    padding: 5,
    backgroundColor: '#1B1815',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  valuePhoneNotch: {
    position: 'absolute',
    top: 14,
    left: '50%',
    marginLeft: -48,
    width: 96,
    height: 27,
    borderRadius: 999,
    backgroundColor: '#050505',
    zIndex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
  },
  valuePhoneSpeaker: {
    width: 38,
    height: 3.5,
    borderRadius: 4,
    backgroundColor: '#171717',
  },
  valuePhoneCamera: {
    width: 7.5,
    height: 7.5,
    borderRadius: 4,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#2B3442',
  },
  valuePhoneScreen: {
    flex: 1,
    borderRadius: 48,
    overflow: 'hidden',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 13,
    paddingTop: 38,
    paddingBottom: 13,
  },
  valuePhoneStatus: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valuePhoneTime: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: INK,
  },
  valuePhoneBrand: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.8,
    color: 'rgba(25,23,20,0.42)',
  },
  valuePhoneContent: {
    flex: 1,
    paddingTop: 14,
  },
  valueProtectPhone: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 1,
    paddingBottom: 1,
  },
  valueProtectMetricCard: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 134,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    shadowColor: '#C5A059',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.10,
    shadowRadius: 27,
    elevation: 2,
  },
  valueProtectMetricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  valueProtectMetricEyebrow: {
    flex: 1,
    fontFamily: F.sansBold,
    fontSize: 8.4,
    letterSpacing: 1.15,
    textTransform: 'uppercase',
    color: 'rgba(25,23,20,0.58)',
  },
  valueProtectMetricRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: 10,
  },
  valueProtectMetric: {
    fontFamily: F.serifSemiBold,
    fontSize: 58,
    lineHeight: 60,
    color: INK,
  },
  valueProtectMetricSuffix: {
    fontFamily: F.serifSemiBold,
    fontSize: 31,
    lineHeight: 36,
    color: INK,
  },
  valueProtectMetricCopy: {
    flex: 1,
    paddingBottom: 7,
  },
  valueProtectMetricUnit: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: GOLD,
  },
  valueProtectMetricSub: {
    marginTop: 2,
    fontFamily: F.sansMedium,
    fontSize: 9.2,
    lineHeight: 11.5,
    color: 'rgba(25,23,20,0.50)',
  },
  valueProtectTickPanel: {
    marginTop: 6,
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.045)',
  },
  valueProtectHourGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  valueProtectHourTick: {
    width: 5.5,
    height: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(25,23,20,0.105)',
  },
  valueProtectHourTickActive: {
    backgroundColor: '#BE123C',
    shadowColor: '#BE123C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 1,
  },
  valueProtectTickLegend: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueProtectTickLegendActive: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#BE123C',
  },
  valueProtectTickLegendMuted: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(25,23,20,0.36)',
  },
  valueProtectStatGrid: {
    marginTop: 7,
    flexDirection: 'row',
    columnGap: 8,
  },
  valueProtectStat: {
    position: 'relative',
    overflow: 'hidden',
    flex: 1,
    minHeight: 58,
    borderRadius: 17,
    paddingHorizontal: 9,
    paddingVertical: 8,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.06)',
  },
  valueProtectStatGlow: {
    position: 'absolute',
    right: -18,
    top: -18,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(190,18,60,0.055)',
  },
  valueProtectStatValue: {
    fontFamily: F.sansBold,
    fontSize: 27,
    lineHeight: 29,
    color: INK,
  },
  valueProtectStatLabel: {
    marginTop: 2,
    fontFamily: F.sansMedium,
    fontSize: 8.8,
    lineHeight: 11,
    color: 'rgba(25,23,20,0.54)',
  },
  valueProtectLifetimeCard: {
    marginTop: 7,
    minHeight: 102,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17130F',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 3,
  },
  valueProtectLifetimeLabel: {
    fontFamily: F.sansBold,
    fontSize: 8.4,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(248,232,190,0.70)',
  },
  valueProtectLifetimeValue: {
    marginTop: 4,
    fontFamily: F.serifSemiBold,
    fontSize: 37,
    lineHeight: 39,
    color: '#F8E8BE',
  },
  valueProtectLifetimeText: {
    marginTop: 3,
    maxWidth: 190,
    fontFamily: F.sansMedium,
    fontSize: 8.8,
    lineHeight: 12,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.66)',
  },
  valueProtectBlockerCard: {
    marginTop: 7,
    borderRadius: 19,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.07)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  valueProtectBlockerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 7,
    marginBottom: 7,
  },
  valueProtectBlockerTitle: {
    flex: 1,
    fontFamily: F.sansBold,
    fontSize: 8.8,
    lineHeight: 11,
    letterSpacing: 0.2,
    color: INK,
  },
  valueProtectBlockerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  valueProtectBlockerPill: {
    minHeight: 22,
    borderRadius: 999,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
    borderWidth: 1,
  },
  valueProtectBlockerPillRose: {
    backgroundColor: '#FFF0F5',
    borderColor: 'rgba(190,18,60,0.12)',
  },
  valueProtectBlockerPillPurple: {
    backgroundColor: '#F5F3FF',
    borderColor: 'rgba(109,40,217,0.12)',
  },
  valueProtectBlockerPillGold: {
    backgroundColor: '#FFF7E8',
    borderColor: 'rgba(197,160,89,0.16)',
  },
  valueProtectBlockerPillInk: {
    backgroundColor: '#F5F4F0',
    borderColor: 'rgba(25,23,20,0.10)',
  },
  valueProtectBlockerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  valueProtectBlockerDotRose: {
    backgroundColor: '#BE123C',
  },
  valueProtectBlockerDotPurple: {
    backgroundColor: '#6D28D9',
  },
  valueProtectBlockerDotGold: {
    backgroundColor: GOLD,
  },
  valueProtectBlockerDotInk: {
    backgroundColor: '#17130F',
  },
  valueProtectBlockerText: {
    fontFamily: F.sansBold,
    fontSize: 7.8,
    color: 'rgba(25,23,20,0.72)',
  },
  valueHomeScreen: {
    flex: 1,
    position: 'relative',
    marginHorizontal: -13,
    marginTop: -38,
    marginBottom: -13,
    paddingHorizontal: 13,
    paddingTop: 38,
    paddingBottom: 12,
    overflow: 'hidden',
    backgroundColor: C.bg,
  },
  valueHomeScreenPaper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
  },
  valueMonthHeader: {
    height: 35,
    marginHorizontal: -2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueHomeIconButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F4F0',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.035)',
  },
  valueMonthCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueMonthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 8,
  },
  valueMonthTitle: {
    fontFamily: F.serifMedium,
    fontSize: 20.8,
    lineHeight: 23,
    color: '#BE123C',
  },
  valueMonthYear: {
    marginTop: -2,
    fontFamily: F.sansBold,
    fontSize: 6.8,
    letterSpacing: 1.4,
    color: 'rgba(25,23,20,0.42)',
  },
  valueDateRail: {
    marginTop: 2,
    marginHorizontal: -8,
    marginBottom: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  valueDatePill: {
    position: 'relative',
    width: 27,
    height: 37,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueDatePillActive: {
    shadowColor: '#A87E33',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 2,
  },
  valueDateSelectedFillWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    overflow: 'hidden',
  },
  valueDateSelectedFill: {
    flex: 1,
    borderRadius: 14,
  },
  valueDateSelectedSheen: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    height: '42%',
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  valueDateSelectedRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: 'rgba(150,108,40,0.30)',
  },
  valueDateDay: {
    fontFamily: F.serifMediumItalic,
    fontSize: 6.9,
    lineHeight: 8,
    color: 'rgba(25,23,20,0.42)',
  },
  valueDateDayActive: {
    fontFamily: F.serifMediumItalic,
    color: 'rgba(255,255,255,0.72)',
  },
  valueDateNumber: {
    marginTop: 2,
    fontFamily: F.serifSemiBold,
    fontSize: 12.8,
    lineHeight: 14,
    color: INK,
  },
  valueDateNumberActive: {
    color: '#FFFFFF',
  },
  valueVerseBlock: {
    alignItems: 'center',
    marginBottom: 5,
  },
  valueVerseText: {
    maxWidth: 204,
    fontFamily: F.serifMediumItalic,
    fontSize: 10.8,
    lineHeight: 15.6,
    textAlign: 'center',
    color: '#8C8277',
  },
  valueVerseUnderline: {
    textDecorationLine: 'underline',
  },
  valueVerseGold: {
    color: GOLD,
  },
  valueVerseRef: {
    marginTop: 3,
    fontFamily: F.sansBold,
    fontSize: 7,
    letterSpacing: 1.9,
    color: GOLD,
  },
  valueTasksHeader: {
    minHeight: 30,
    marginHorizontal: -8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueTasksProgressWrap: {
    width: 82,
    alignItems: 'flex-end',
    rowGap: 4,
  },
  valueTasksProgressTrack: {
    width: '100%',
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#ECE9DE',
  },
  valueTasksProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  valueTasksProgressText: {
    fontFamily: F.sansBold,
    fontSize: 7.6,
    letterSpacing: 1.05,
    color: 'rgba(25,23,20,0.45)',
  },
  valueBigEventsHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginHorizontal: -8,
    marginBottom: 5,
  },
  valueBigEventsHeading: {
    fontFamily: F.serifMedium,
    fontSize: 13.4,
    lineHeight: 16,
    color: INK,
  },
  valueBigEventsSub: {
    fontFamily: F.sansBold,
    fontSize: 6.7,
    letterSpacing: 1,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  valueBigEventCard: {
    minHeight: 37,
    borderRadius: 13,
    paddingLeft: 5.5,
    paddingRight: 10,
    paddingVertical: 4,
    marginHorizontal: -8,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    borderWidth: 1,
    borderColor: '#EDE9E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  valueBigEventIconBox: {
    width: 26,
    height: 26,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BE123C1F',
  },
  valueBigEventCopy: {
    flex: 1,
    minWidth: 0,
  },
  valueBigEventTitle: {
    fontFamily: F.serifMedium,
    fontSize: 13.5,
    lineHeight: 15.5,
    color: INK,
  },
  valueBigEventCount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: 3,
    flexShrink: 0,
  },
  valueBigEventCountNum: {
    fontFamily: F.serifSemiBold,
    fontSize: 15.5,
    lineHeight: 17,
    color: '#BE123C',
  },
  valueBigEventCountLabel: {
    fontFamily: F.sansMedium,
    fontSize: 8,
    color: '#A8A29E',
  },
  valueHomeSectionTitle: {
    fontFamily: F.serifMedium,
    fontSize: 15.7,
    lineHeight: 18,
    color: INK,
  },
  valueHomeSectionMeta: {
    marginTop: 2,
    fontFamily: F.sansMedium,
    fontSize: 7.6,
    lineHeight: 10,
    color: 'rgba(25,23,20,0.48)',
  },
  valueHomeTaskStack: {
    marginTop: 3,
    marginHorizontal: -8,
    alignItems: 'center',
  },
  valueMiniTaskFrame: {
    position: 'relative',
    width: '100%',
    height: 33,
    marginBottom: 1.4,
    alignItems: 'center',
    overflow: 'hidden',
  },
  valueMiniTaskScale: {
    width: 392,
    transformOrigin: 'top center',
    transform: [{ scale: 0.585 }],
  },
  valueHomeAddBtn: {
    marginTop: 4,
    marginHorizontal: -8,
    paddingVertical: 6.5,
    borderRadius: 11,
    borderWidth: 1.2,
    borderColor: '#1C1917',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 5,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 1,
  },
  valueHomeAddBtnText: {
    fontFamily: F.sansBold,
    fontSize: 7.4,
    letterSpacing: 1.7,
    color: '#1C1917',
    textTransform: 'uppercase',
  },
  valueHomeRoutineCard: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: 5,
    marginHorizontal: -8,
    borderRadius: 13,
    borderWidth: 1.2,
    borderColor: '#C5A059',
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#C5A059',
    shadowOffset: { width: 0, height: 2.5 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 2,
  },
  valueHomeRoutineWatermark: {
    position: 'absolute',
    right: -11,
    bottom: -11,
    opacity: 0.1,
  },
  valueHomeRoutineCopy: {
    flex: 1,
  },
  valueHomeRoutineLabel: {
    fontFamily: F.sansBold,
    fontSize: 6,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    color: 'rgba(197,160,89,0.8)',
    marginBottom: 3,
  },
  valueHomeRoutineTitle: {
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    lineHeight: 17,
    color: '#C5A059',
    marginBottom: 2,
  },
  valueHomeRoutineSub: {
    fontFamily: F.serifItalic,
    fontSize: 8.6,
    lineHeight: 11,
    color: 'rgba(149,115,52,0.95)',
  },
  valueHomeRoutineArrow: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: '#C5A059',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#C5A059',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
  valuePhoneTaskInteractiveWrap: {
    position: 'relative',
  },
  valuePhoneTaskFlourishLayer: {
    position: 'absolute',
    left: 4,
    top: 0,
    bottom: 6,
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuePhoneHeading: {
    fontFamily: F.serifSemiBold,
    fontSize: 25,
    lineHeight: 29,
    color: INK,
    marginBottom: 14,
  },
  valuePhoneRow: {
    minHeight: 60,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.07)',
  },
  valuePhoneRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueToneGold: {
    backgroundColor: 'rgba(197,160,89,0.14)',
  },
  valueTonePurple: {
    backgroundColor: 'rgba(139,92,246,0.13)',
  },
  valueToneRose: {
    backgroundColor: 'rgba(225,29,72,0.11)',
  },
  valueToneGreen: {
    backgroundColor: 'rgba(22,163,74,0.10)',
  },
  valueToneInk: {
    backgroundColor: 'rgba(25,23,20,0.07)',
  },
  valuePhoneRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  valuePhoneRowTitle: {
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    lineHeight: 18.5,
    color: INK,
  },
  valuePhoneRowMeta: {
    marginTop: 2,
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 0.8,
    color: 'rgba(25,23,20,0.42)',
    textTransform: 'uppercase',
  },
  valuePhoneRowCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(197,160,89,0.34)',
  },
  valuePhoneGoalCard: {
    marginTop: 4,
    borderRadius: 21,
    padding: 14,
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
  },
  valuePhoneGoalLabel: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: GOLD,
    textTransform: 'uppercase',
  },
  valuePhoneGoalTitle: {
    marginTop: 5,
    fontFamily: F.serifSemiBold,
    fontSize: 16.5,
    lineHeight: 20,
    color: INK,
  },
  valueWeekBars: {
    height: 112,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.07)',
  },
  valueWeekBarTrack: {
    flex: 1,
    height: '100%',
    borderRadius: 999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: 'rgba(25,23,20,0.045)',
  },
  valueWeekBarFill: {
    borderRadius: 999,
    backgroundColor: '#8B5CF6',
  },
  valueFocusTimer: {
    height: 154,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: '#1C1917',
  },
  valueFocusTime: {
    fontFamily: F.serifSemiBold,
    fontSize: 50,
    lineHeight: 54,
    color: '#FFFFFF',
  },
  valueFocusLabel: {
    marginTop: 4,
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.58)',
    textTransform: 'uppercase',
  },
  valueBlockerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  valueBlockerPill: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  valueBlockerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  valueBlockerText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    color: INK,
  },
  valuePhoneFootnote: {
    marginTop: 10,
    fontFamily: F.sansMedium,
    fontSize: 10,
    lineHeight: 14,
    color: 'rgba(25,23,20,0.50)',
    textAlign: 'center',
  },
  valueScriptureCard: {
    borderRadius: 23,
    padding: 15,
    marginBottom: 12,
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
  },
  valueScriptureRef: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.4,
    color: GOLD,
  },
  valueScriptureText: {
    marginTop: 8,
    fontFamily: F.serifMedium,
    fontSize: 18,
    lineHeight: 24,
    color: INK,
  },
  valueJournalCard: {
    borderRadius: 23,
    padding: 15,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  valueJournalLabel: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.3,
    color: GOLD,
    textTransform: 'uppercase',
  },
  valueJournalText: {
    marginTop: 8,
    fontFamily: F.serifMedium,
    fontSize: 18,
    lineHeight: 23,
    color: INK,
  },
  valueNavigation: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: 3,
    paddingHorizontal: 26,
    paddingTop: 3,
    zIndex: 18,
    elevation: 18,
  },
  valueProgressRail: {
    width: '100%',
    maxWidth: 314,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    columnGap: 6,
  },
  valueProgressStep: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  valueProgressTrack: {
    width: '100%',
    height: 5.5,
    borderRadius: 999,
    backgroundColor: 'rgba(25,23,20,0.082)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
    overflow: 'hidden',
  },
  valueProgressTrackDone: {
    backgroundColor: 'rgba(197,160,89,0.18)',
    borderColor: 'rgba(197,160,89,0.30)',
  },
  valueProgressTrackActive: {
    backgroundColor: 'rgba(23,19,15,0.12)',
    borderColor: 'rgba(232,195,116,0.62)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.19,
    shadowRadius: 11,
    elevation: 2,
  },
  valueProgressTrackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.68)',
  },
  valueProgressTrackFillActive: {
    backgroundColor: '#E7C36D',
  },
  valueProgressDot: {
    marginTop: -15,
    width: 31,
    height: 31,
    borderRadius: 15.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17130F',
    borderWidth: 1.3,
    borderColor: 'rgba(232,195,116,0.86)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 4,
  },
  valueProgressDotText: {
    fontFamily: F.serifSemiBold,
    fontSize: 14,
    lineHeight: 17,
    color: '#F8E8BE',
  },
  valueSwipeHint: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 5,
    backgroundColor: 'rgba(255,253,248,0.54)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
  },
  valueSwipeHintText: {
    fontFamily: F.serifSemiBold,
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: 0,
    color: 'rgba(25,23,20,0.62)',
  },
  valueBottomAction: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 10,
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 20,
    elevation: 20,
  },
  welcome: {
    flex: 1,
    position: 'relative',
    paddingTop: 2,
  },
  confettiOverlay: {
    position: 'absolute',
    top: -180,
    left: -110,
    right: -110,
    bottom: -180,
    zIndex: 10000,
    elevation: 10000,
  },
  confettiLayer: {
    zIndex: 10000,
    elevation: 10000,
  },
  confettiLottie: {
    zIndex: 10000,
    elevation: 10000,
    opacity: 0.9,
    transform: [{ scale: 0.72 }],
  },
  nameIntroSlide: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  nameIntroBackdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  nameIntroGlow: {
    position: 'absolute',
    left: 34,
    right: 34,
    top: 104,
    height: 154,
    borderRadius: 90,
    backgroundColor: 'rgba(197,160,89,0.055)',
    transform: [{ rotate: '-7deg' }],
  },
  nameIntroLine: {
    position: 'absolute',
    left: 38,
    right: 38,
    top: '48%',
    height: 1,
    backgroundColor: 'rgba(197,160,89,0.10)',
    transform: [{ rotate: '-4deg' }],
  },
  nameIntroScroll: {
    flex: 1,
    zIndex: 2,
  },
  nameIntroContent: {
    minHeight: '100%',
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 188,
    justifyContent: 'flex-start',
  },
  nameConversation: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  nameIntroEyebrow: {
    marginBottom: 18,
    paddingLeft: 4,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 4.6,
    color: 'rgba(197,160,89,0.78)',
    textAlign: 'center',
  },
  nameBotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
    marginBottom: 11,
  },
  nameBotRowTight: {
    columnGap: 6,
    marginBottom: 9,
  },
  nameBotRowSecond: {
    marginLeft: 2,
    marginBottom: 4,
  },
  nameAvatarShell: {
    width: 66,
    height: 66,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 13 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 3,
  },
  nameQuestionAvatarShell: {
    transform: [{ rotate: '-4deg' }],
  },
  nameAvatarHalo: {
    position: 'absolute',
    width: 61,
    height: 61,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.26)',
    backgroundColor: 'rgba(197,160,89,0.055)',
    transform: [{ rotate: '-5deg' }],
  },
  nameAvatarLogo: {
    width: 50,
    height: 50,
    borderRadius: 16,
  },
  nameAvatarShellSmall: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
  },
  nameAvatarLogoSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  nameBubble: {
    flex: 1,
    minHeight: 68,
    borderRadius: 27,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'center',
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 2,
  },
  nameBubbleAuto: {
    flex: 0,
    flexShrink: 1,
    maxWidth: '82%',
    alignSelf: 'flex-start',
  },
  nameBubbleCompact: {
    minHeight: 56,
    borderRadius: 23,
    paddingHorizontal: 17,
    paddingVertical: 11,
  },
  nameReplyBubble: {
    minHeight: 126,
    paddingVertical: 21,
  },
  nameWelcomeBubble: {
    minHeight: 58,
  },
  nameQuestionBubble: {
    minHeight: 64,
  },
  nameTraditionBubble: {
    minHeight: 80,
  },
  nameFinalBubble: {
    minHeight: 56,
  },
  nameBeginBubble: {
    minHeight: 54,
  },
  nameBubbleText: {
    fontFamily: F.serifSemiBold,
    fontSize: 22,
    lineHeight: 27,
    color: INK,
    zIndex: 2,
  },
  nameConversationText: {
    fontFamily: F.serifSemiBold,
    fontSize: 19,
    lineHeight: 24,
    color: INK,
    zIndex: 2,
  },
  nameBubbleSubtext: {
    fontFamily: F.sansMedium,
    fontSize: 13.5,
    lineHeight: 19.5,
    color: MUTED,
  },
  nameTypingCaret: {
    color: GOLD,
  },
  nameInputBlock: {
    marginTop: 2,
    marginLeft: 74,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
  },
  nameInputLabel: {
    marginBottom: 8,
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: GOLD,
    textTransform: 'uppercase',
  },
  nameInput: {
    minHeight: 50,
    borderBottomWidth: 1.4,
    borderBottomColor: 'rgba(197,160,89,0.42)',
    fontFamily: F.serifMedium,
    fontSize: 28,
    lineHeight: 34,
    color: INK,
    paddingVertical: 7,
  },
  nameUserRow: {
    alignItems: 'flex-end',
    marginTop: 14,
    marginBottom: 18,
  },
  nameUserBubble: {
    maxWidth: '76%',
    borderRadius: 24,
    paddingHorizontal: 19,
    paddingVertical: 13,
    backgroundColor: INK,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  nameUserBubbleCompact: {
    maxWidth: '82%',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  nameUserText: {
    fontFamily: F.serifMedium,
    fontSize: 23,
    lineHeight: 27,
    color: '#FFFFFF',
  },
  nameUserTextCompact: {
    fontSize: 19,
    lineHeight: 24,
  },
  nameTraditionBlock: {
    marginTop: 7,
    marginLeft: 48,
    rowGap: 6,
  },
  nameTraditionOption: {
    minHeight: 58,
    borderRadius: 19,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 9,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.055,
    shadowRadius: 17,
    elevation: 2,
  },
  nameTraditionOptionActive: {
    backgroundColor: '#FFF5DF',
    borderColor: 'rgba(197,160,89,0.72)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
  },
  nameTraditionIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
  },
  nameTraditionIconActive: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(197,160,89,0.46)',
  },
  nameTraditionCopy: {
    flex: 1,
    justifyContent: 'center',
    rowGap: 1,
  },
  nameTraditionText: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    lineHeight: 21,
    color: INK,
  },
  nameTraditionTextActive: {
    color: '#7A5A18',
  },
  nameTraditionSubtext: {
    fontFamily: F.sansMedium,
    fontSize: 10.5,
    lineHeight: 14,
    color: 'rgba(25,23,20,0.46)',
  },
  nameTraditionSubtextActive: {
    color: 'rgba(122,90,24,0.68)',
  },
  nameTraditionMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.10)',
    backgroundColor: 'rgba(255,255,255,0.64)',
  },
  nameTraditionMarkActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  nameValueHint: {
    marginLeft: 54,
    marginTop: -4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  nameValuePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
  },
  nameValuePillText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: 'rgba(25,23,20,0.62)',
    textTransform: 'uppercase',
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
  messageSlide: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: 'space-between',
    paddingTop: 18,
    paddingBottom: 0,
  },
  messageWarmth: {
    position: 'absolute',
    left: -22,
    right: -22,
    bottom: 0,
    height: '56%',
  },
  messageContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 126,
    zIndex: 1,
  },
  messageLogoFrame: {
    width: 78,
    height: 78,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.13,
    shadowRadius: 24,
    elevation: 3,
  },
  messageLogoHalo: {
    position: 'absolute',
    width: 73,
    height: 73,
    borderRadius: 25,
    backgroundColor: 'rgba(197,160,89,0.065)',
    transform: [{ rotate: '-7deg' }],
  },
  messageLogoPlate: {
    width: 62,
    height: 62,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageLogo: {
    width: '100%',
    height: '100%',
  },
  messageBubble: {
    width: '100%',
    maxWidth: 338,
    minHeight: 0,
    borderRadius: 28,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 15,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.34)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 2,
  },
  messageBubbleTail: {
    position: 'absolute',
    left: '50%',
    marginLeft: -8,
    top: -7,
    width: 16,
    height: 16,
    backgroundColor: '#FFFDF8',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(197,160,89,0.34)',
    transform: [{ rotate: '45deg' }],
  },
  messageText: {
    fontFamily: F.serifSemiBold,
    fontSize: 24,
    lineHeight: 31,
    textAlign: 'center',
    color: INK,
  },
  protectIntroBubble: {
    maxWidth: 344,
    minHeight: 148,
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  protectIntroText: {
    minHeight: 102,
    fontSize: 20,
    lineHeight: 27,
  },
  protectIntroPromptOnly: {
    paddingTop: 26,
  },
  protectIntroPromptSlot: {
    minHeight: 136,
    justifyContent: 'flex-start',
  },
  protectPainIntroPromptSlot: {
    minHeight: 84,
    justifyContent: 'flex-start',
  },
  protectIntroVisual: {
    width: '100%',
    maxWidth: 342,
    height: 334,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  protectIntroContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 124,
    zIndex: 1,
  },
  protectCoachLogoFrame: {
    width: 78,
    height: 78,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.13,
    shadowRadius: 23,
    elevation: 3,
  },
  protectCoachLogoFrameCompact: {
    width: 64,
    height: 64,
    borderRadius: 22,
    marginBottom: 13,
  },
  protectCoachLogoHalo: {
    position: 'absolute',
    width: '92%',
    height: '92%',
    borderRadius: 25,
    backgroundColor: 'rgba(197,160,89,0.07)',
    transform: [{ rotate: '-7deg' }],
  },
  protectCoachLogoPlate: {
    width: 62,
    height: 62,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  protectCoachLogoPlateCompact: {
    width: 50,
    height: 50,
    borderRadius: 17,
  },
  protectCoachLogo: {
    width: '100%',
    height: '100%',
  },
  protectCoachBubble: {
    width: '100%',
    maxWidth: 340,
    minHeight: 118,
    borderRadius: 27,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 20,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.32)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 23,
    elevation: 2,
  },
  protectCoachBubbleTail: {
    position: 'absolute',
    left: '50%',
    marginLeft: -8,
    top: -7,
    width: 16,
    height: 16,
    backgroundColor: '#FFFDF8',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: 'rgba(197,160,89,0.32)',
    transform: [{ rotate: '45deg' }],
  },
  protectCoachText: {
    minHeight: 78,
    fontFamily: F.serifSemiBold,
    fontSize: 20,
    lineHeight: 27,
    textAlign: 'center',
    color: INK,
  },
  protectGuardrailList: {
    width: '100%',
    maxWidth: 344,
    marginTop: 16,
    rowGap: 8,
  },
  protectGuardrailItem: {
    minHeight: 64,
    borderRadius: 19,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.07)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.045,
    shadowRadius: 14,
    elevation: 1,
  },
  protectGuardrailItemDone: {
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(197,160,89,0.22)',
  },
  protectGuardrailIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    flexShrink: 0,
  },
  protectGuardrailIconDone: {
    backgroundColor: INK,
    borderColor: INK,
  },
  protectGuardrailCopy: {
    flex: 1,
    minWidth: 0,
  },
  protectGuardrailTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    lineHeight: 21,
    color: INK,
  },
  protectGuardrailBody: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: '#756D64',
  },
  protectGuardrailBodyDone: {
    color: '#9B9288',
  },
  protectStrikeWrap: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    position: 'relative',
  },
  protectStrikeLine: {
    position: 'absolute',
    left: 0,
    top: 10.5,
    height: 1.4,
    borderRadius: 1,
  },
  protectConversationTop: {
    alignItems: 'center',
    marginBottom: 18,
  },
  protectConversationBubble: {
    maxWidth: 342,
    minHeight: 130,
  },
  protectQuestionBubble: {
    maxWidth: 342,
    minHeight: 116,
  },
  protectPainCard: {
    borderRadius: 30,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.07)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.055,
    shadowRadius: 24,
    elevation: 2,
  },
  protectPainTitle: {
    marginTop: 2,
    fontFamily: F.serifSemiBold,
    fontSize: 27,
    lineHeight: 31,
    textAlign: 'center',
    color: INK,
  },
  protectPainBody: {
    marginTop: 3,
    marginBottom: 12,
    fontFamily: F.serifMediumItalic,
    fontSize: 18,
    lineHeight: 23,
    textAlign: 'center',
    color: '#8B7A66',
  },
  distractionStage: {
    height: 360,
    width: '100%',
    maxWidth: 374,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  distractionGlow: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 46,
    height: 246,
    borderRadius: 123,
    backgroundColor: 'rgba(197,160,89,0.085)',
  },
  distractionOuterRing: {
    position: 'absolute',
    top: 61,
    width: 224,
    height: 224,
    borderRadius: 112,
    backgroundColor: 'transparent',
    borderWidth: 4,
    borderColor: 'rgba(25,23,20,0.18)',
    zIndex: 1,
  },
  distractionInnerCutout: {
    position: 'absolute',
    top: 69,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(255,253,248,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.86)',
    zIndex: 2,
  },
  distractionCore: {
    position: 'absolute',
    top: 0,
    width: 344,
    height: 344,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
    elevation: 3,
    zIndex: 5,
  },
  distractionStickerImage: {
    width: '100%',
    height: '100%',
  },
  distractionCardSlot: {
    position: 'absolute',
  },
  distractionCard: {
    width: '100%',
    minHeight: 41,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 13,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 3,
  },
  distractionCardIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.66)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.76)',
  },
  distractionCardText: {
    fontFamily: F.serifSemiBold,
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(25,23,20,0.76)',
  },
  distractionCardSocial: {
    top: 48,
    left: -7,
    width: 139,
    transform: [{ rotate: '-7deg' }],
    zIndex: 4,
  },
  distractionCardNotifications: {
    top: 22,
    right: -8,
    width: 154,
    transform: [{ rotate: '6deg' }],
    zIndex: 4,
  },
  distractionCardMessaging: {
    top: 94,
    right: -12,
    width: 132,
    transform: [{ rotate: '-2deg' }],
    zIndex: 4,
  },
  distractionCardStreaming: {
    top: 153,
    left: -10,
    width: 126,
    transform: [{ rotate: '5deg' }],
    zIndex: 7,
  },
  distractionCardGaming: {
    left: -5,
    bottom: 78,
    width: 111,
    transform: [{ rotate: '-5deg' }],
    zIndex: 8,
  },
  distractionCardApps: {
    right: 0,
    bottom: 86,
    width: 100,
    transform: [{ rotate: '6deg' }],
    zIndex: 8,
  },
  distractionCardContent: {
    left: 53,
    bottom: 22,
    width: 116,
    transform: [{ rotate: '2deg' }],
    zIndex: 7,
  },
  distractionCardNoise: {
    right: 32,
    bottom: 25,
    width: 94,
    transform: [{ rotate: '-8deg' }],
    zIndex: 7,
  },
  distractionGroundShadow: {
    position: 'absolute',
    left: 48,
    right: 48,
    bottom: 20,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(25,23,20,0.055)',
    transform: [{ scaleX: 1.12 }],
  },
  toolsShowcaseRoot: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  toolsShowcaseCopy: {
    paddingHorizontal: 24,
    alignItems: 'center',
    zIndex: 2,
  },
  toolsTitle: {
    maxWidth: 330,
    fontFamily: F.serifSemiBold,
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
    color: INK,
  },
  toolsSubtitleFrame: {
    marginTop: 8,
    width: '100%',
    maxWidth: 320,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  toolsSealGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(231,195,109,0.16)',
    zIndex: 1,
  },
  toolsSealOuter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.40)',
    shadowColor: '#8A6A2F',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 5,
    zIndex: 2,
  },
  toolsSealRing: {
    ...StyleSheet.absoluteFillObject,
    margin: 6,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.30)',
  },
  toolsPhysChipSlot: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 4,
  },
  toolsShowcaseSpacer: {
    flex: 1,
  },
  toolsTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 7,
    paddingHorizontal: 12,
    paddingVertical: 7.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    shadowColor: '#5E5142',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.13,
    shadowRadius: 9,
    elevation: 2,
  },
  toolsTagChipCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    columnGap: 6,
  },
  toolsTagDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  toolsTagText: {
    fontFamily: F.serifSemiBold,
    fontSize: 13,
    lineHeight: 16,
    color: 'rgba(25,23,20,0.78)',
  },
  toolsTagTextCompact: {
    fontSize: 12.2,
    lineHeight: 15,
  },
  toolsShowcaseAction: {
    paddingHorizontal: 20,
    zIndex: 8,
  },
  screenTimeSlide: {
    flex: 1,
    paddingTop: 22,
    paddingBottom: 8,
  },
  screenTimeDialStage: {
    flex: 1,
    justifyContent: 'center',
  },
  screenTimeDialBlock: {
    alignItems: 'center',
    rowGap: 6,
  },
  screenTimeReadout: {
    alignItems: 'center',
    marginBottom: 14,
  },
  screenTimeReadoutValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 88,
    lineHeight: 94,
    color: INK,
  },
  screenTimeReadoutUnit: {
    marginTop: -4,
    fontFamily: F.serifMediumItalic,
    fontSize: 17,
    color: '#8C8277',
  },
  screenTimeDialViewport: {
    width: '100%',
    height: 86,
    overflow: 'hidden',
    position: 'relative',
  },
  screenTimeDialRuler: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    paddingBottom: 4,
  },
  screenTimeDialTickSlot: {
    width: SCREEN_TIME_DIAL_SPACING,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  screenTimeDialTickLine: {
    width: 2.4,
    borderRadius: 2,
    backgroundColor: 'rgba(25,23,20,0.45)',
  },
  screenTimeDialTickLineHour: {
    height: 34,
  },
  screenTimeDialTickLineHalf: {
    height: 19,
    backgroundColor: 'rgba(25,23,20,0.26)',
  },
  screenTimeDialTickLabel: {
    marginTop: 7,
    fontFamily: F.serifMedium,
    fontSize: 14,
    lineHeight: 17,
    color: 'rgba(25,23,20,0.52)',
  },
  screenTimeDialTickLabelSpacer: {
    marginTop: 7,
    height: 17,
  },
  screenTimeDialFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 54,
    zIndex: 2,
  },
  screenTimeDialFadeLeft: {
    left: 0,
  },
  screenTimeDialFadeRight: {
    right: 0,
  },
  screenTimeDialNeedleWrap: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 24,
    width: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  screenTimeDialNeedle: {
    flex: 1,
    width: 3,
    borderRadius: 2,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  screenTimeDialNeedleDot: {
    position: 'absolute',
    top: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: GOLD,
    borderWidth: 1.5,
    borderColor: '#FFFDF8',
  },
  screenTimeDialHint: {
    marginTop: 10,
    fontFamily: F.sansMedium,
    fontSize: 12.5,
    letterSpacing: 0.2,
    color: 'rgba(25,23,20,0.45)',
  },
  screenTimeAction: {
    paddingTop: 6,
  },
  v4DayHeader: {
    alignItems: 'center',
    rowGap: 6,
    marginBottom: 16,
  },
  v4DayTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 29,
    lineHeight: 34,
    color: INK,
    textAlign: 'center',
    maxWidth: 330,
  },
  v4DayPartList: {
    rowGap: 10,
  },
  v4DayPartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 13,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
    shadowColor: '#5E5142',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  v4DayPartCardPhone: {
    borderColor: 'rgba(168,57,63,0.30)',
    backgroundColor: '#FFFBFA',
    shadowColor: '#A8393F',
    shadowOpacity: 0.10,
    elevation: 2,
  },
  v4DayPartIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  v4DayPartCopy: {
    flex: 1,
    minWidth: 0,
  },
  v4DayPartLabel: {
    fontFamily: F.serifSemiBold,
    fontSize: 17.5,
    lineHeight: 21,
    color: INK,
  },
  v4DayPartNote: {
    marginTop: 3,
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    lineHeight: 15,
    color: 'rgba(25,23,20,0.52)',
  },
  v4DayPartStat: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  v4DayPartHours: {
    fontFamily: F.serifSemiBold,
    fontSize: 24,
    lineHeight: 27,
    color: INK,
  },
  v4DayPartHoursPhone: {
    color: '#A8393F',
  },
  v4DayPartPercent: {
    marginTop: 2,
    fontFamily: F.sansMedium,
    fontSize: 10.5,
    letterSpacing: 0.2,
    color: 'rgba(25,23,20,0.46)',
  },
  v4DayBarCard: {
    marginTop: 4,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
    shadowColor: '#5E5142',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  v4DayBarTrack: {
    height: 18,
    borderRadius: 9,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: 'rgba(25,23,20,0.05)',
  },
  v4DayBarSegment: {
    height: '100%',
  },
  v4DayBarSegmentSleep: {
    backgroundColor: '#17130F',
  },
  v4DayBarSegmentPhone: {
    backgroundColor: '#C24B51',
  },
  v4DayBarSegmentRest: {
    backgroundColor: GOLD,
  },
  v4DayBarLegend: {
    marginTop: 10,
    alignItems: 'center',
  },
  v4DayBarLegendText: {
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    letterSpacing: 0.2,
    color: 'rgba(25,23,20,0.55)',
  },
  v4DayBarLegendPhone: {
    fontFamily: F.sansBold,
    color: '#A8393F',
  },
  v4RecapSlide: {
    flex: 1,
  },
  v4RecapScrollContent: {
    paddingTop: 18,
    paddingBottom: 130,
    rowGap: 14,
  },
  v4RecapHeader: {
    alignItems: 'center',
    rowGap: 7,
  },
  v4RecapSubtitle: {
    fontFamily: F.serifMediumItalic,
    fontSize: 15.5,
    lineHeight: 21,
    color: '#8C8277',
    textAlign: 'center',
    maxWidth: 320,
  },
  v4RecapStakes: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 17,
    backgroundColor: '#1D1813',
    borderWidth: 1,
    borderColor: 'rgba(231,195,109,0.34)',
    shadowColor: '#17130F',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 4,
  },
  v4RecapStakesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    marginBottom: 9,
  },
  v4RecapStakesIcon: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(231,195,109,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(231,195,109,0.30)',
  },
  v4RecapStakesEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,250,240,0.55)',
  },
  v4RecapStakesTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 21,
    lineHeight: 27,
    color: '#FFFAF0',
  },
  v4RecapStakesSub: {
    marginTop: 5,
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    lineHeight: 21,
    color: 'rgba(255,250,240,0.72)',
  },
  v4RecapStakesGold: {
    color: '#E7C36D',
    fontFamily: F.serifSemiBold,
  },
  v4RecapList: {
    rowGap: 8,
  },
  v4RecapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 11,
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    shadowColor: '#5E5142',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  v4RecapRowInactive: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderColor: 'rgba(25,23,20,0.07)',
    shadowOpacity: 0,
    elevation: 0,
  },
  v4RecapRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  v4RecapRowIconInactive: {
    backgroundColor: 'rgba(25,23,20,0.045)',
    opacity: 0.4,
  },
  v4RecapRowText: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    lineHeight: 19.5,
    color: INK,
  },
  v4RecapRowTextInactive: {
    color: 'rgba(25,23,20,0.36)',
  },
  v4RecapRowBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  v4RecapRowBadgeInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1.2,
    borderColor: 'rgba(25,23,20,0.16)',
  },
  v4WeeklyRhythmWrap: {
    marginHorizontal: -4,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.07)',
    shadowColor: '#5E5142',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 2,
  },
  v4FlameRecapWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 8,
    rowGap: 8,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  v4FlameRecapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7.5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.32)',
    shadowColor: '#5E5142',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1,
  },
  v4FlameRecapText: {
    fontFamily: F.serifMedium,
    fontSize: 13.5,
    lineHeight: 17,
    color: INK,
  },
  v4ToolsSlideBody: {
    alignItems: 'center',
    rowGap: 10,
  },
  v4ToolsSlideIcon: {
    width: 64,
    height: 64,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
    marginBottom: 2,
  },
  v4ToolsChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 8,
    rowGap: 8,
    marginTop: 4,
    maxWidth: 330,
  },
  v4ToolsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
    shadowColor: '#5E5142',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 1,
  },
  v4ToolsChipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: GOLD,
  },
  v4ToolsChipText: {
    fontFamily: F.serifSemiBold,
    fontSize: 14,
    lineHeight: 17,
    color: 'rgba(25,23,20,0.8)',
  },
  v4ToolsGratitudeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  v4ToolsGratitudeCopy: {
    flex: 1,
  },
  v4ToolsDots: {
    flexDirection: 'row',
    columnGap: 7,
    marginTop: 16,
    marginBottom: 4,
  },
  v4ToolsDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(25,23,20,0.14)',
  },
  v4ToolsDotActive: {
    width: 20,
    backgroundColor: GOLD,
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
    alignSelf: 'center',
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
    borderRadius: 22,
    overflow: 'visible',
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
  questionSpeechBubble: {
    minHeight: 116,
  },
  speechTail: {
    position: 'absolute',
    left: -7,
    top: '50%',
    marginTop: -8,
    width: 16,
    height: 16,
    backgroundColor: '#FFFDF8',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(197,160,89,0.38)',
    transform: [{ rotate: '45deg' }],
  },
  speechTailJoin: {
    position: 'absolute',
    left: -1,
    top: '50%',
    marginTop: -12,
    width: 12,
    height: 24,
    backgroundColor: '#FFFDF8',
  },
  speechTailCompact: {
    left: -5,
    marginTop: -6,
    width: 12,
    height: 12,
    borderColor: 'rgba(197,160,89,0.34)',
  },
  speechTailJoinCompact: {
    marginTop: -10,
    width: 10,
    height: 20,
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
  protectPrompt: {
    marginBottom: 10,
  },
  protectSpeechBubble: {
    minHeight: 0,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  protectSpeechBubbleCompact: {
    minHeight: 0,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  protectSpeechQuestion: {
    fontSize: 20,
    lineHeight: 25,
  },
  protectSpeechHighlight: {
    color: INK,
    textDecorationLine: 'underline',
    textDecorationColor: GOLD,
  },
  protectSpeechGoldHighlight: {
    fontFamily: F.serifSemiBold,
    color: GOLD,
    textDecorationLine: 'underline',
    textDecorationColor: GOLD,
  },
  inlineGoldUnderline: {
    color: INK,
    textDecorationLine: 'underline',
    textDecorationColor: GOLD,
    textDecorationStyle: 'solid',
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
    overflow: 'visible',
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
    left: -7,
    top: '50%',
    marginTop: -8,
    width: 16,
    height: 16,
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
  protectPathCard: {
    borderRadius: 24,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.07)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  protectPathItem: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  protectPathItemActive: {
    backgroundColor: '#FFF7E8',
  },
  protectPathNumber: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(25,23,20,0.06)',
  },
  protectPathNumberActive: {
    backgroundColor: INK,
  },
  protectPathNumberText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: 'rgba(25,23,20,0.50)',
  },
  protectPathNumberTextActive: {
    color: '#F8E8BE',
  },
  protectPathText: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    color: 'rgba(25,23,20,0.58)',
  },
  protectPathTextActive: {
    color: INK,
  },
  painOrbit: {
    minHeight: 224,
    borderRadius: 25,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF8',
    overflow: 'hidden',
  },
  painOrbitLine: {
    position: 'absolute',
    width: 260,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(197,160,89,0.15)',
    transform: [{ rotate: '-15deg' }],
  },
  painOrbitLineTwo: {
    transform: [{ rotate: '18deg' }],
    backgroundColor: 'rgba(25,23,20,0.07)',
  },
  painOrbitLineThree: {
    width: 210,
    transform: [{ rotate: '72deg' }],
    backgroundColor: 'rgba(197,160,89,0.11)',
  },
  painCenter: {
    width: 82,
    height: 82,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.11,
    shadowRadius: 22,
    elevation: 3,
  },
  painLogo: {
    width: 64,
    height: 64,
    borderRadius: 20,
  },
  painChip: {
    position: 'absolute',
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.055,
    shadowRadius: 14,
    elevation: 2,
  },
  painChipOne: { top: 24, left: 14 },
  painChipTwo: { top: 58, right: 16 },
  painChipThree: { bottom: 54, left: 16 },
  painChipFour: { bottom: 22, right: 18 },
  painChipText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: INK,
  },
  protectStatsConversation: {
    rowGap: 10,
  },
  didYouKnowCard: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 14,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.055,
    shadowRadius: 20,
    elevation: 2,
  },
  didYouKnowGlow: {
    position: 'absolute',
    top: -70,
    right: -58,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(248,232,190,0.24)',
  },
  didYouKnowTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  didYouKnowHeading: {
    fontFamily: F.serifSemiBold,
    fontSize: 18,
    lineHeight: 22,
    color: '#8A6427',
  },
  didYouKnowSpark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.20)',
  },
  didYouKnowQuestion: {
    marginTop: 15,
    fontFamily: F.serifSemiBold,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: 0,
    color: INK,
    textAlign: 'center',
  },
  didYouKnowQuestionHighlight: {
    textDecorationLine: 'underline',
    textDecorationColor: GOLD,
    color: INK,
  },
  didYouKnowQuestionGold: {
    fontFamily: F.serifSemiBold,
    color: GOLD,
    textDecorationLine: 'underline',
    textDecorationColor: GOLD,
  },
  didYouKnowValueWrap: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  didYouKnowValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 39,
    lineHeight: 43,
    letterSpacing: 0,
    color: INK,
    textAlign: 'center',
  },
  didYouKnowValueGold: {
    color: GOLD,
  },
  didYouKnowValueLabel: {
    marginTop: -2,
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: GOLD,
  },
  didYouKnowChoicesWrap: {
    overflow: 'hidden',
  },
  didYouKnowChoices: {
    flexDirection: 'row',
    columnGap: 10,
  },
  didYouKnowChoice: {
    flex: 1,
    minHeight: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.09)',
  },
  didYouKnowChoiceActive: {
    backgroundColor: '#17130F',
    borderColor: '#17130F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  didYouKnowChoiceText: {
    fontFamily: F.sansBold,
    fontSize: 14,
    lineHeight: 18,
    color: '#7A7067',
  },
  didYouKnowChoiceTextActive: {
    color: '#F8E8BE',
  },
  screenTimeSliderCard: {
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.10,
    shadowRadius: 26,
    elevation: 3,
    overflow: 'hidden',
  },
  screenTimeSliderQuestion: {
    maxWidth: 304,
    alignSelf: 'center',
    fontFamily: F.serifSemiBold,
    fontSize: 23,
    lineHeight: 28,
    textAlign: 'center',
    color: INK,
  },
  screenTimeSliderRule: {
    width: 72,
    height: 2,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: 12,
    backgroundColor: GOLD,
    opacity: 0.78,
  },
  screenTimeSliderHeader: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTimeSliderHeaderCopy: {
    alignItems: 'center',
  },
  screenTimeSliderKicker: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    color: GOLD,
  },
  screenTimeSliderValue: {
    marginTop: 10,
    fontFamily: F.serifSemiBold,
    fontSize: 54,
    lineHeight: 58,
    textAlign: 'center',
    color: INK,
  },
  screenTimeSliderBadge: {
    minWidth: 64,
    minHeight: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.25)',
  },
  screenTimeSliderBadgeText: {
    fontFamily: F.serifSemiBold,
    fontSize: 20,
    lineHeight: 23,
    color: '#8A6427',
  },
  screenTimeSliderTouch: {
    marginTop: 24,
    height: 40,
    justifyContent: 'center',
  },
  screenTimeSliderRail: {
    height: 11,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#F3EEE6',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
  },
  screenTimeSliderFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  screenTimeSliderThumb: {
    position: 'absolute',
    left: 0,
    top: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.52)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.20,
    shadowRadius: 10,
    elevation: 3,
  },
  screenTimeSliderThumbCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GOLD,
  },
  screenTimeSliderScale: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  screenTimeSliderScaleText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    color: '#A8A29E',
  },
  userReplyWrap: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  userReplyBubble: {
    maxWidth: 260,
    minHeight: 0,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1714',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 3,
  },
  userReplyText: {
    fontFamily: F.serifSemiBold,
    fontSize: 16.5,
    lineHeight: 21,
    color: '#FFFFFF',
  },
  screenTimeConversation: {
    marginTop: 2,
    rowGap: 2,
  },
  screenTimeStatIntro: {
    alignSelf: 'center',
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
  },
  screenTimeWastedIntro: {
    alignSelf: 'center',
    minWidth: 184,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 9,
    alignItems: 'center',
    backgroundColor: '#17130F',
    borderWidth: 1,
    borderColor: 'rgba(232,195,116,0.46)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  screenTimeIntroWash: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 7,
    height: 26,
    borderRadius: 20,
    opacity: 0.82,
  },
  screenTimeIntroWashWaste: {
    backgroundColor: 'rgba(248,232,190,0.055)',
  },
  screenTimeIntroWashGetBack: {
    backgroundColor: 'rgba(197,160,89,0.075)',
  },
  screenTimeIntroCorner: {
    position: 'absolute',
    right: -28,
    bottom: -42,
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1,
  },
  screenTimeIntroCornerWaste: {
    borderColor: 'rgba(248,232,190,0.11)',
    backgroundColor: 'rgba(248,232,190,0.025)',
  },
  screenTimeIntroCornerGetBack: {
    borderColor: 'rgba(197,160,89,0.16)',
    backgroundColor: 'rgba(197,160,89,0.035)',
  },
  screenTimeIntroOrnamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
    marginBottom: 4,
    zIndex: 1,
  },
  screenTimeIntroOrnamentLine: {
    width: 25,
    height: 1.25,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.50)',
  },
  screenTimeIntroOrnamentLineDark: {
    backgroundColor: 'rgba(248,232,190,0.36)',
  },
  screenTimeIntroOrnamentDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: GOLD,
  },
  screenTimeIntroToplinePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3,
    fontFamily: F.sansBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    zIndex: 1,
  },
  screenTimeIntroToplinePillWaste: {
    color: '#F8E8BE',
    backgroundColor: 'rgba(248,232,190,0.075)',
    borderWidth: 1,
    borderColor: 'rgba(248,232,190,0.16)',
  },
  screenTimeIntroToplinePillGetBack: {
    color: '#7A5B20',
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.20)',
  },
  screenTimeWastedWord: {
    marginTop: 2,
    fontFamily: F.serifSemiBold,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: 1.1,
    color: '#F8E8BE',
    zIndex: 1,
    textShadowColor: 'rgba(232,195,116,0.22)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 14,
  },
  screenTimeWastedSubline: {
    marginTop: 0,
    fontFamily: F.sansBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.58)',
  },
  screenTimeWastedUnderline: {
    marginTop: 5,
    width: 94,
    height: 2,
    borderRadius: 999,
    backgroundColor: GOLD,
    zIndex: 1,
  },
  screenTimeGetBackIntro: {
    alignSelf: 'center',
    minWidth: 202,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 9,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.34)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.13,
    shadowRadius: 24,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  screenTimeGetBackWord: {
    marginTop: 2,
    fontFamily: F.serifSemiBold,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: 0.75,
    color: INK,
    zIndex: 1,
  },
  screenTimeGetBackSubline: {
    marginTop: 1,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    lineHeight: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#8B7A64',
  },
  screenTimeGetBackUnderline: {
    marginTop: 5,
    width: 116,
    height: 2,
    borderRadius: 999,
    backgroundColor: GOLD,
    zIndex: 1,
  },
  screenTimeStatMessage: {
    borderRadius: 27,
    paddingHorizontal: 15,
    paddingVertical: 13,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.30)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.075,
    shadowRadius: 26,
    elevation: 2,
    position: 'relative',
  },
  screenTimeStatMessageDark: {
    backgroundColor: '#17130F',
    borderColor: 'rgba(197,160,89,0.42)',
    shadowColor: '#000000',
    shadowOpacity: 0.17,
  },
  screenTimeStatHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    columnGap: 10,
  },
  screenTimeStatNumber: {
    position: 'absolute',
    left: 11,
    top: 11,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17130F',
    borderWidth: 1.2,
    borderColor: 'rgba(232,195,116,0.42)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 2,
  },
  screenTimeStatNumberRight: {
    left: undefined,
    right: 11,
  },
  screenTimeStatNumberDark: {
    backgroundColor: '#F8E8BE',
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: GOLD,
    shadowOpacity: 0.18,
  },
  screenTimeStatNumberText: {
    fontFamily: F.serifSemiBold,
    fontSize: 16,
    lineHeight: 19,
    color: '#F8E8BE',
  },
  screenTimeStatNumberTextDark: {
    color: '#17130F',
  },
  screenTimeStatHeaderStacked: {
    flexDirection: 'column',
    alignItems: 'center',
    columnGap: 0,
  },
  screenTimeStatValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 50,
    lineHeight: 54,
    color: INK,
  },
  screenTimeStatValueStacked: {
    fontSize: 66,
    lineHeight: 61,
  },
  screenTimeStatValueDark: {
    color: '#F8E8BE',
  },
  screenTimeStatLabel: {
    flexShrink: 1,
    paddingBottom: 8,
    fontFamily: F.sansBold,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: GOLD,
  },
  screenTimeStatLabelStacked: {
    maxWidth: 240,
    paddingBottom: 0,
    marginTop: -7,
    fontFamily: F.serifSemiBold,
    fontSize: 19.5,
    lineHeight: 22,
    letterSpacing: 0,
    textTransform: 'none',
    textAlign: 'center',
    color: INK,
  },
  screenTimeStatLabelUnderline: {
    marginTop: 3,
    width: 138,
    height: 2,
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  screenTimeStatLabelDark: {
    color: '#F8E8BE',
  },
  screenTimeStatBody: {
    marginTop: 6,
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    lineHeight: 21,
    textAlign: 'center',
    color: '#6E6257',
  },
  screenTimeStatBodyDark: {
    color: 'rgba(255,255,255,0.78)',
  },
  screenTimeLegend: {
    marginTop: 9,
    alignSelf: 'center',
    maxWidth: 260,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  screenTimeLegendItem: {
    minHeight: 20,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
    backgroundColor: 'rgba(197,160,89,0.08)',
  },
  screenTimeLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  screenTimeLegendAwakeLight: {
    backgroundColor: '#F3EEE6',
    borderColor: 'rgba(25,23,20,0.28)',
  },
  screenTimeLegendAwakeDark: {
    backgroundColor: '#FFF7E8',
    borderColor: 'rgba(255,255,255,0.86)',
  },
  screenTimeLegendPhone: {
    backgroundColor: GOLD,
    borderColor: 'rgba(248,232,190,0.48)',
  },
  screenTimeLegendReclaimed: {
    backgroundColor: GOLD,
  },
  screenTimeLegendSleepLight: {
    backgroundColor: '#17130F',
    borderColor: '#17130F',
  },
  screenTimeLegendSleepDark: {
    backgroundColor: '#6E6257',
    borderColor: 'rgba(248,232,190,0.30)',
  },
  screenTimeLegendStillLost: {
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  screenTimeLegendText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    color: '#7B7064',
  },
  screenTimeLegendTextDark: {
    color: 'rgba(255,255,255,0.78)',
  },
  screenTimeDayBar: {
    marginTop: 13,
    flexDirection: 'row',
    columnGap: 2,
  },
  screenTimeDaySegment: {
    flex: 1,
    height: 17,
    borderRadius: 5,
    backgroundColor: 'rgba(25,23,20,0.08)',
  },
  screenTimeDaySegmentActive: {
    backgroundColor: GOLD,
  },
  screenTimeDaySegmentSleep: {
    backgroundColor: '#17130F',
  },
  screenTimeDaySegmentAwake: {
    backgroundColor: '#F3EEE6',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.18)',
  },
  screenTimeDaySegmentPhone: {
    backgroundColor: GOLD,
  },
  screenTimeDotGrid: {
    marginTop: 14,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 286,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
  },
  screenTimeDotGridCompact: {
    maxWidth: 292,
    gap: 2,
  },
  screenTimeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(25,23,20,0.10)',
  },
  screenTimeDotSmall: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(25,23,20,0.10)',
  },
  screenTimeDotActive: {
    backgroundColor: GOLD,
  },
  screenTimeDotAwake: {
    backgroundColor: '#F3EEE6',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.24)',
  },
  screenTimeDotAwakeOnDark: {
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.40)',
  },
  screenTimeDotSleep: {
    backgroundColor: '#17130F',
  },
  screenTimeDotSleepOnDark: {
    backgroundColor: '#6E6257',
    borderWidth: 1,
    borderColor: 'rgba(248,232,190,0.18)',
  },
  screenTimeDotDimLight: {
    backgroundColor: 'rgba(25,23,20,0.10)',
  },
  screenTimeDotSaved: {
    backgroundColor: '#F8E8BE',
  },
  screenTimeDotProductive: {
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
  },
  screenTimeDotReclaimed: {
    backgroundColor: GOLD,
  },
  screenTimeDotStillLost: {
    backgroundColor: '#6E6257',
    borderWidth: 1,
    borderColor: 'rgba(248,232,190,0.16)',
  },
  screenTimeDotDimOnDark: {
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  screenTimeResultPanel: {
    borderRadius: 28,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.15)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 2,
  },
  screenTimeResultKicker: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: GOLD,
    textAlign: 'center',
  },
  screenTimeResultGrid: {
    marginTop: 12,
    rowGap: 9,
  },
  screenTimeMetric: {
    minHeight: 68,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 13,
    backgroundColor: '#FFF9EF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
  },
  screenTimeMetricValue: {
    minWidth: 74,
    fontFamily: F.serifSemiBold,
    fontSize: 35,
    lineHeight: 39,
    color: INK,
    textAlign: 'center',
  },
  screenTimeMetricLabel: {
    flex: 1,
    fontFamily: F.sansBold,
    fontSize: 15,
    lineHeight: 20,
    color: '#5F574F',
  },
  screenTimeReclaimCard: {
    marginTop: 11,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: '#17130F',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 3,
  },
  screenTimeReclaimTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 22,
    lineHeight: 26,
    color: '#F8E8BE',
    textAlign: 'center',
  },
  screenTimeReclaimBody: {
    marginTop: 8,
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
  },
  screenTimeReclaimStrong: {
    color: '#FFFFFF',
    fontFamily: F.serifSemiBold,
  },
  wakingDayPreview: {
    marginTop: 17,
    borderRadius: 20,
    padding: 12,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.14)',
  },
  wakingDayLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  wakingDayLabel: {
    fontFamily: F.serifSemiBold,
    fontSize: 16,
    color: INK,
  },
  wakingDayValue: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    color: '#A8A29E',
  },
  wakingDayRail: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(25,23,20,0.08)',
  },
  wakingDayFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.78)',
  },
  protectStatStack: {
    rowGap: 10,
  },
  protectStatCard: {
    minHeight: 96,
    borderRadius: 24,
    paddingHorizontal: 15,
    paddingVertical: 13,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.07)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.045,
    shadowRadius: 16,
    elevation: 1,
  },
  protectStatAccent: {
    position: 'absolute',
    left: 0,
    top: 13,
    bottom: 13,
    width: 4,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  protectStatValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: 10,
  },
  protectStatValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 42,
    lineHeight: 46,
    color: INK,
  },
  protectStatLabel: {
    flex: 1,
    fontFamily: F.sansBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: GOLD,
  },
  protectStatBody: {
    marginTop: 5,
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    lineHeight: 20,
    color: '#6E6257',
  },
  protectTimeMeter: {
    borderRadius: 28,
    padding: 18,
    alignItems: 'center',
    backgroundColor: '#17130F',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.34)',
  },
  protectTimeNumber: {
    fontFamily: F.serifSemiBold,
    fontSize: 56,
    lineHeight: 61,
    color: '#F8E8BE',
  },
  protectTimeLabel: {
    marginTop: 2,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.64)',
  },
  protectTimeRail: {
    marginTop: 15,
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  protectTimeRailFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  protectOptionGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  protectOptionWrap: {
    flexGrow: 1,
    minWidth: '30%',
  },
  protectOption: {
    minHeight: 45,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  protectOptionActive: {
    backgroundColor: '#FFF7E8',
    borderColor: 'rgba(197,160,89,0.50)',
  },
  protectOptionText: {
    fontFamily: F.sansBold,
    fontSize: 12,
    color: 'rgba(25,23,20,0.58)',
  },
  protectOptionTextActive: {
    color: INK,
  },
  protectBigStatCard: {
    borderRadius: 32,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.09,
    shadowRadius: 25,
    elevation: 2,
  },
  protectBigStatNumber: {
    fontFamily: F.serifSemiBold,
    fontSize: 72,
    lineHeight: 76,
    color: INK,
  },
  protectBigStatUnit: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: GOLD,
  },
  protectDayDots: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  protectDayDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(25,23,20,0.09)',
  },
  protectDayDotActive: {
    backgroundColor: GOLD,
  },
  protectGainCard: {
    borderRadius: 32,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
  },
  protectGainNumber: {
    fontFamily: F.serifSemiBold,
    fontSize: 76,
    lineHeight: 80,
    color: INK,
  },
  protectGainUnit: {
    fontFamily: F.sansBold,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: GOLD,
  },
  protectGainBody: {
    marginTop: 12,
    maxWidth: 270,
    fontFamily: F.serifMedium,
    fontSize: 18,
    lineHeight: 25,
    textAlign: 'center',
    color: '#6E6257',
  },
  protectBlockerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  protectBlockerWrap: {
    width: '48%',
  },
  protectBlockerOption: {
    minHeight: 94,
    borderRadius: 22,
    padding: 13,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  protectBlockerOptionActive: {
    backgroundColor: '#FFF7E8',
    borderColor: 'rgba(197,160,89,0.46)',
  },
  protectBlockerCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.4,
    borderColor: 'rgba(25,23,20,0.12)',
  },
  protectBlockerCheckActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  protectBlockerLabel: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    lineHeight: 20,
    color: 'rgba(25,23,20,0.66)',
  },
  protectBlockerLabelActive: {
    color: INK,
  },
  websiteStack: {
    rowGap: 9,
  },
  websiteCard: {
    minHeight: 66,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.075)',
  },
  websiteIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E8',
  },
  websiteIconText: {
    fontFamily: F.sansBold,
    color: GOLD,
  },
  websiteCopy: {
    flex: 1,
    minWidth: 0,
  },
  websiteTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 16,
    color: INK,
  },
  websiteExamples: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 11.5,
    lineHeight: 15,
    color: MUTED,
  },
  websiteSwitch: {
    width: 42,
    height: 25,
    borderRadius: 999,
    padding: 3,
    alignItems: 'flex-end',
    backgroundColor: INK,
  },
  websiteSwitchKnob: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  focusPreviewCard: {
    borderRadius: 30,
    padding: 16,
    backgroundColor: '#17130F',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.34)',
  },
  focusPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: 10,
  },
  focusPreviewLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(248,232,190,0.68)',
  },
  focusPreviewTime: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: '#F8E8BE',
  },
  focusPreviewTimer: {
    marginTop: 18,
    alignItems: 'center',
  },
  focusPreviewTimerText: {
    fontFamily: F.serifSemiBold,
    fontSize: 78,
    lineHeight: 82,
    color: '#FFFFFF',
  },
  focusPreviewTimerUnit: {
    marginTop: -2,
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.54)',
  },
  focusPreviewRow: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 8,
  },
  focusPreviewPill: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  focusPreviewPillText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    color: '#F8E8BE',
  },
  completeChecklist: {
    borderRadius: 28,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.07)',
  },
  completeItem: {
    minHeight: 58,
    borderRadius: 19,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    position: 'relative',
  },
  completeItemDone: {
    backgroundColor: '#FFF7E8',
  },
  completeCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: 'rgba(25,23,20,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeCheckDone: {
    backgroundColor: INK,
    borderColor: INK,
  },
  completeText: {
    fontFamily: F.serifSemiBold,
    fontSize: 18,
    color: 'rgba(25,23,20,0.58)',
  },
  completeTextDone: {
    color: INK,
  },
  completeStrike: {
    position: 'absolute',
    left: 54,
    right: 18,
    height: 2,
    borderRadius: 999,
    backgroundColor: GOLD,
    opacity: 0.75,
  },
  chapterChoiceStack: {
    flexDirection: 'row',
    columnGap: 10,
    alignItems: 'stretch',
    marginTop: 2,
    overflow: 'visible',
  },
  chapterChoiceWrap: {
    flex: 1,
    zIndex: 1,
    elevation: 1,
  },
  chapterChoiceWrapActive: {
    zIndex: 20,
    elevation: 20,
  },
  chapterChoiceCard: {
    minHeight: 206,
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingTop: 17,
    paddingBottom: 13,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.055,
    shadowRadius: 22,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  chapterChoiceCardActive: {
    backgroundColor: '#17130F',
    borderColor: 'rgba(197,160,89,0.62)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.20,
    shadowRadius: 28,
    elevation: 5,
  },
  chapterChoiceGlow: {
    position: 'absolute',
    left: -24,
    right: -24,
    bottom: -44,
    height: 112,
    borderRadius: 76,
    backgroundColor: 'rgba(197,160,89,0.075)',
    transform: [{ rotate: '-8deg' }],
  },
  chapterChoiceGlowActive: {
    backgroundColor: 'rgba(197,160,89,0.21)',
  },
  chapterChoiceAccent: {
    position: 'absolute',
    left: 16,
    top: 12,
    width: 42,
    height: 2.5,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.36)',
  },
  chapterChoiceAccentActive: {
    width: 58,
    height: 3,
    backgroundColor: GOLD,
  },
  chapterChoiceTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  chapterChoiceIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 1,
  },
  chapterChoiceIconActive: {
    backgroundColor: GOLD,
    borderColor: 'rgba(248,232,190,0.38)',
    shadowOpacity: 0.22,
    elevation: 3,
  },
  chapterChoiceIconGlyph: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterChoiceCopy: {
    marginTop: 15,
    minWidth: 0,
    width: '100%',
    alignItems: 'center',
  },
  chapterChoiceTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 21,
    lineHeight: 24,
    textAlign: 'center',
    color: INK,
  },
  chapterChoiceTitleActive: {
    color: '#F8E8BE',
  },
  chapterChoiceDivider: {
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chapterChoiceDividerLine: {
    width: 34,
    height: 1.5,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.38)',
  },
  chapterChoiceDividerLineActive: {
    width: 43,
    backgroundColor: GOLD,
  },
  chapterChoiceFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    columnGap: 7,
    marginTop: 5,
    width: '100%',
  },
  chapterChoiceFeatureDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 8,
    backgroundColor: 'rgba(197,160,89,0.50)',
  },
  chapterChoiceFeatureDotActive: {
    backgroundColor: '#F8E8BE',
  },
  chapterChoiceBody: {
    fontFamily: F.serifMedium,
    fontSize: 13.5,
    lineHeight: 18,
    textAlign: 'left',
    color: '#6E6257',
    flex: 1,
  },
  chapterChoiceBodyActive: {
    color: 'rgba(255,255,255,0.76)',
  },
  chapterChoiceRadio: {
    position: 'absolute',
    top: 13,
    right: 13,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.4,
    borderColor: 'rgba(25,23,20,0.14)',
  },
  chapterChoiceRadioActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  chapterCheckpointStage: {
    flex: 1,
    minHeight: 520,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 28,
  },
  chapterCheckpointSealSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -82,
    height: 164,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterCheckpointAchievement: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterCheckpointSealFlight: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  chapterCheckpointSeal: {
    width: 102,
    height: 102,
    borderRadius: 51,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17130F',
    borderWidth: 1.2,
    borderColor: 'rgba(232,195,116,0.74)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.34,
    shadowRadius: 34,
    elevation: 6,
  },
  chapterCheckpointSealGlow: {
    position: 'absolute',
    width: 134,
    height: 134,
    borderRadius: 67,
    backgroundColor: 'rgba(197,160,89,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.14)',
  },
  checkpointFlameBurst: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkpointFlameAura: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(255,214,122,0.23)',
    borderWidth: 1,
    borderColor: 'rgba(255,233,182,0.40)',
  },
  checkpointFlameLottie: {
    width: 86,
    height: 86,
  },
  chapterCheckpointCongrats: {
    marginTop: 18,
    fontFamily: F.serifSemiBold,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: 0,
    color: INK,
    textAlign: 'center',
  },
  chapterCheckpointRailSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -8,
    width: '100%',
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterCheckpointRail: {
    width: '100%',
    maxWidth: 338,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    columnGap: 9,
  },
  chapterCheckpointStep: {
    flex: 1,
    alignItems: 'center',
  },
  chapterCheckpointStepDone: {},
  chapterCheckpointStepLine: {
    width: '100%',
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(25,23,20,0.075)',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.035)',
    overflow: 'hidden',
  },
  chapterCheckpointStepLineDone: {
    backgroundColor: 'rgba(197,160,89,0.18)',
    borderColor: 'rgba(197,160,89,0.44)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 2,
  },
  chapterCheckpointStepLineFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: '#E7C36D',
  },
  chapterCheckpointStepDot: {
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF8',
    borderWidth: 1.2,
    borderColor: 'rgba(25,23,20,0.12)',
  },
  chapterCheckpointStepDotDone: {
    backgroundColor: '#17130F',
    borderColor: 'rgba(232,195,116,0.86)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 4,
  },
  chapterCheckpointRailFlameWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
  },
  chapterCheckpointRailFlame: {
    width: 38,
    height: 38,
    transform: [{ translateY: 2 }],
  },
  chapterCheckpointStepText: {
    marginTop: 8,
    fontFamily: F.sansBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.15,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: '#A8A29E',
  },
  chapterCheckpointStepTextDone: {
    color: INK,
  },
  chapterCheckpointCoach: {
    width: '100%',
    alignItems: 'center',
  },
  chapterCheckpointCoachSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -74,
    width: '100%',
    minHeight: 218,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  chapterCheckpointLogoFrame: {
    width: 70,
    height: 70,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 3,
  },
  chapterCheckpointBubble: {
    width: '100%',
    maxWidth: 338,
    minHeight: 0,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 15,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.34)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 2,
  },
  chapterChecklist: {
    rowGap: 10,
    borderRadius: 28,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.15)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.055,
    shadowRadius: 22,
    elevation: 2,
  },
  chapterChecklistItem: {
    minHeight: 62,
    borderRadius: 20,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 11,
    position: 'relative',
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.055)',
  },
  chapterChecklistItemDone: {
    backgroundColor: '#FFF7E8',
    borderColor: 'rgba(197,160,89,0.20)',
  },
  chapterChecklistCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.4,
    borderColor: 'rgba(25,23,20,0.12)',
  },
  chapterChecklistCheckDone: {
    backgroundColor: INK,
    borderColor: INK,
  },
  chapterChecklistText: {
    flex: 1,
    fontFamily: F.serifSemiBold,
    fontSize: 19,
    color: '#8A8177',
  },
  chapterChecklistTextDone: {
    color: INK,
  },
  chapterChecklistStrike: {
    position: 'absolute',
    left: 54,
    right: 18,
    height: 2,
    borderRadius: 999,
    backgroundColor: GOLD,
    opacity: 0.74,
  },
  buildProductivityCard: {
    borderRadius: 30,
    paddingHorizontal: 17,
    paddingVertical: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 2,
  },
  buildProductivityKicker: {
    fontFamily: F.serifSemiBold,
    fontSize: 25,
    lineHeight: 29,
    textAlign: 'center',
    color: INK,
  },
  buildChartStage: {
    marginTop: 18,
    minHeight: 214,
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 13,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.15)',
    position: 'relative',
    overflow: 'hidden',
  },
  buildChartGridLine: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 74,
    height: 1,
    backgroundColor: 'rgba(25,23,20,0.08)',
  },
  buildChartGridLineMiddle: {
    bottom: 140,
  },
  buildChartColumns: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    columnGap: 34,
    paddingTop: 36,
  },
  buildChartColumn: {
    width: 88,
    alignItems: 'center',
  },
  buildChartBarTrack: {
    width: 58,
    height: 124,
    borderRadius: 18,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: 'rgba(25,23,20,0.055)',
  },
  buildChartBar: {
    width: '100%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  buildChartValue: {
    marginTop: 8,
    fontFamily: F.serifSemiBold,
    fontSize: 21,
    lineHeight: 24,
    color: '#8A8177',
  },
  buildChartValueFeatured: {
    color: '#3E9F68',
  },
  buildChartLabel: {
    marginTop: 2,
    fontFamily: F.sansBold,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
    color: '#8A8177',
  },
  buildChartLabelFeatured: {
    color: INK,
  },
  buildChartLiftBadge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    minWidth: 132,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: '#17130F',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.32)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 2,
  },
  buildChartLiftNumber: {
    fontFamily: F.serifSemiBold,
    fontSize: 24,
    lineHeight: 27,
    color: '#F8E8BE',
  },
  buildChartLiftText: {
    marginTop: -1,
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.72)',
  },
  buildProductivityBody: {
    marginTop: 12,
    fontFamily: F.serifMedium,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: '#6E6257',
  },
  buildBigEventCard: {
    minHeight: 132,
    borderRadius: 30,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.20)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.09,
    shadowRadius: 24,
    elevation: 2,
  },
  buildBigEventIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
  },
  buildBigEventCopy: {
    flex: 1,
    minWidth: 0,
  },
  buildBigEventLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: GOLD,
  },
  buildBigEventTitle: {
    marginTop: 5,
    fontFamily: F.serifSemiBold,
    fontSize: 28,
    lineHeight: 32,
    color: INK,
  },
  buildBigEventMeta: {
    marginTop: 3,
    fontFamily: F.sansBold,
    fontSize: 13,
    color: MUTED,
  },
  buildGoalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  buildGoalWrap: {
    width: '48%',
  },
  buildGoalChip: {
    minHeight: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  buildGoalChipActive: {
    backgroundColor: '#FFF7E8',
    borderColor: 'rgba(197,160,89,0.48)',
  },
  buildGoalText: {
    fontFamily: F.serifSemiBold,
    fontSize: 16,
    color: 'rgba(25,23,20,0.62)',
    textAlign: 'center',
  },
  buildGoalTextActive: {
    color: INK,
  },
  weekRhythmCard: {
    minHeight: 210,
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
  },
  weekColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  weekDay: {
    marginBottom: 10,
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: 'rgba(25,23,20,0.42)',
    textTransform: 'uppercase',
  },
  weekBar: {
    width: '100%',
    maxWidth: 27,
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  weekDot: {
    marginTop: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(25,23,20,0.16)',
  },
  buildTaskPreview: {
    borderRadius: 24,
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.20)',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.055,
    shadowRadius: 18,
    elevation: 2,
  },
  buildChoiceGrid: {
    marginTop: 13,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  buildChoiceWrap: {
    flexGrow: 1,
    minWidth: '46%',
  },
  buildChoice: {
    minHeight: 45,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  buildChoiceActive: {
    backgroundColor: '#17130F',
    borderColor: '#17130F',
  },
  buildChoiceText: {
    fontFamily: F.sansBold,
    fontSize: 12,
    color: 'rgba(25,23,20,0.62)',
    textAlign: 'center',
  },
  buildChoiceTextActive: {
    color: '#F8E8BE',
  },
  myRoutineMock: {
    borderRadius: 30,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
  },
  myRoutineRow: {
    minHeight: 64,
    borderRadius: 20,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 11,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.06)',
  },
  myRoutineTime: {
    width: 52,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7E8',
  },
  myRoutineTimeText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    color: GOLD,
  },
  myRoutineCopy: {
    flex: 1,
    minWidth: 0,
  },
  myRoutineTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    color: INK,
  },
  myRoutineMeta: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 11.5,
    color: MUTED,
  },
  myRoutineHandle: {
    width: 22,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(25,23,20,0.16)',
  },
  buildHomePreviewShell: {
    alignSelf: 'center',
    width: 270,
    height: 470,
    borderRadius: 34,
    padding: 16,
    backgroundColor: '#FFFDF8',
    borderWidth: 2,
    borderColor: '#17130F',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 4,
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
  buildResearchCard: {
    marginTop: 14,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 13,
    overflow: 'hidden',
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.26)',
    shadowColor: '#8B6B2F',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  buildResearchHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  buildResearchTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 21,
    lineHeight: 24,
    color: INK,
  },
  buildResearchRule: {
    flex: 1,
    height: 1,
    marginTop: 3,
    backgroundColor: 'rgba(197,160,89,0.42)',
  },
  buildResearchSubtitle: {
    marginTop: 5,
    maxWidth: 270,
    fontFamily: F.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: 'rgba(25,23,20,0.52)',
  },
  buildResearchRows: {
    marginTop: 15,
    rowGap: 13,
  },
  buildResearchRow: {
    rowGap: 6,
  },
  buildResearchRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  buildResearchLabel: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    color: 'rgba(25,23,20,0.56)',
  },
  buildResearchLabelFeatured: {
    fontFamily: F.sansBold,
    color: '#6F5324',
  },
  buildResearchValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 20,
    lineHeight: 21,
    color: 'rgba(25,23,20,0.56)',
  },
  buildResearchValueFeatured: {
    color: GOLD,
  },
  buildResearchTrack: {
    height: 10,
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: 'rgba(25,23,20,0.055)',
  },
  buildResearchFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(25,23,20,0.26)',
    transformOrigin: 'left center',
  },
  buildResearchFillFeatured: {
    backgroundColor: GOLD,
  },
  buildResearchCitation: {
    marginTop: 13,
    fontFamily: F.serifMediumItalic,
    fontSize: 11.5,
    color: 'rgba(25,23,20,0.45)',
  },
  buildThesisCard: {
    minHeight: 62,
    marginTop: 14,
    borderRadius: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 10,
    backgroundColor: '#1D1A17',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    elevation: 3,
  },
  buildThesisText: {
    fontFamily: F.serifSemiBold,
    fontSize: 22,
    color: '#FFFFFF',
  },
  buildThesisOperator: {
    paddingBottom: 2,
    fontFamily: F.sansBold,
    fontSize: 17,
    color: GOLD,
  },
  v4MomentSlide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    rowGap: 18,
  },
  v4MomentIcon: {
    width: 94,
    height: 94,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
  },
  v4MomentLogo: {
    width: 82,
    height: 82,
    borderRadius: 24,
  },
  v4Eyebrow: {
    fontFamily: F.sansBold,
    fontSize: 12,
    color: GOLD,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  v4MomentTitle: {
    alignSelf: 'center',
    maxWidth: 430,
    fontFamily: F.serifSemiBold,
    fontSize: 34,
    lineHeight: 40,
    color: INK,
    textAlign: 'center',
  },
  v4MomentBody: {
    alignSelf: 'center',
    maxWidth: 342,
    fontFamily: F.sansMedium,
    fontSize: 16,
    lineHeight: 24,
    color: MUTED,
    textAlign: 'center',
  },
  v4MomentAction: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 8,
  },
  v4ProgressRail: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 10,
    marginBottom: 16,
    paddingTop: 8,
  },
  v4ProgressSlot: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  v4ProgressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(25,23,20,0.10)',
  },
  v4ProgressTrackDone: {
    backgroundColor: 'rgba(197,160,89,0.82)',
  },
  v4ProgressDot: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.12)',
  },
  v4ProgressDotDone: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  v4ProgressDotNew: {
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  v4ProgressLabel: {
    marginTop: 11,
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1,
    color: 'rgba(25,23,20,0.42)',
    textTransform: 'uppercase',
  },
  v4ProgressLabelDone: {
    color: GOLD,
  },
  v4FlameSlide: {
    flex: 1,
    position: 'relative',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 0,
  },
  v4CheckpointCopySlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: 64,
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  v4CheckpointCopy: {
    width: '100%',
    alignItems: 'center',
    rowGap: 10,
  },
  v4CenteredSlide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    rowGap: 18,
  },
  v4ScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 34,
    alignItems: 'center',
    rowGap: 14,
  },
  v4ConversationContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 120,
    rowGap: 14,
  },
  v4ConversationInner: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    rowGap: 14,
  },
  v4DeckPreviewCard: {
    height: 184,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9E4DA',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  v4DeckPreviewText: {
    fontFamily: F.sansBold,
    fontSize: 14,
    color: 'rgba(25,23,20,0.54)',
  },
  v4DeckHintArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginLeft: -4,
  },
  v4DeckSlideRoot: {
    flex: 1,
    position: 'relative',
  },
  v4DeckInner: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    rowGap: 9,
    zIndex: 1,
  },
  v4DeckTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 29,
    lineHeight: 34,
    color: INK,
    textAlign: 'center',
    maxWidth: 350,
    alignSelf: 'center',
  },
  v4DeckTitleCompact: {
    fontSize: 27,
    lineHeight: 32,
  },
  v4DeckAnswerProgress: {
    width: '100%',
    maxWidth: 250,
    minHeight: 9,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    paddingHorizontal: 2,
    marginTop: 2,
  },
  v4DeckAnswerSegment: {
    flex: 1,
    height: 5,
    minWidth: 7,
    borderRadius: 999,
  },
  v4DeckAnswerSegmentActive: {
    height: 6.5,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
  },
  v4DeckStack: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  v4DeckStackCompact: {
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  v4StackCard: {
    position: 'absolute',
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.09)',
    overflow: 'hidden',
    shadowColor: '#5E5142',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 1,
  },
  v4DeckCardSlot: {
    position: 'relative',
  },
  v4DeckCardBase: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  v4EdgeGlow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 152,
    zIndex: 5,
  },
  v4EdgeGlowLeft: {
    left: 0,
    transformOrigin: 'left',
  },
  v4EdgeGlowRight: {
    right: 0,
    transformOrigin: 'right',
  },
  v4EdgeGlowCore: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 64,
  },
  v4EdgeGlowCoreRight: {
    left: undefined,
    right: 0,
  },
  v4SwipeCardWrap: {
    alignSelf: 'center',
  },
  v4StatementCard: {
    height: 500,
    borderRadius: 31,
    padding: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.11,
    shadowRadius: 24,
    elevation: 4,
    zIndex: 4,
  },
  v4StatementQuotePanel: {
    height: 116,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 9,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  v4StatementQuoteMark: {
    position: 'absolute',
    top: -6,
    left: 12,
    fontFamily: F.serifSemiBold,
    fontSize: 64,
    lineHeight: 72,
  },
  v4StatementQuoteTextWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  v4StatementOrnamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 7,
    marginTop: 3,
  },
  v4StatementOrnamentLine: {
    width: 30,
    height: 1,
    borderRadius: 1,
  },
  v4StatementOrnamentDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  v4StatementArt: {
    width: '100%',
    height: 354,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#F8F1E7',
  },
  v4StatementImage: {
    width: '100%',
    height: '100%',
  },
  v4StatementArtShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 24,
  },
  v4StatementInnerFrame: {
    ...StyleSheet.absoluteFillObject,
    margin: 7,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    zIndex: 5,
  },
  v4StatementIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F0E6',
  },
  v4StatementText: {
    fontFamily: F.serifMedium,
    fontSize: 17.5,
    lineHeight: 23,
    color: 'rgba(25,23,20,0.84)',
    textAlign: 'center',
  },
  v4StatementTextBold: {
    fontFamily: F.serifSemiBold,
    color: INK,
  },
  v4SwipeStamp: {
    position: 'absolute',
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: 11,
    borderWidth: 2.6,
    backgroundColor: 'rgba(255,253,248,0.88)',
    zIndex: 6,
  },
  v4SwipeStampYes: {
    left: 16,
    borderColor: '#2F8F57',
  },
  v4SwipeStampNo: {
    right: 16,
    borderColor: '#C0494F',
  },
  v4SwipeStampText: {
    fontFamily: F.serifSemiBold,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: 0.4,
  },
  v4SwipeStampTextYes: {
    color: '#23603E',
  },
  v4SwipeStampTextNo: {
    color: '#9B353B',
  },
  v4AnswerRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginTop: 14,
    zIndex: 3,
  },
  v4AnswerIconChipNo: {
    width: 29,
    height: 29,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C0494F',
    shadowColor: '#C0494F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 7,
    elevation: 2,
  },
  v4AnswerIconChipYes: {
    width: 29,
    height: 29,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2F8F57',
    shadowColor: '#2F8F57',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 7,
    elevation: 2,
  },
  v4NoButton: {
    flex: 1,
    minHeight: 60,
    borderRadius: 999,
    flexDirection: 'row',
    columnGap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.4,
    borderColor: 'rgba(192,73,79,0.34)',
    shadowColor: '#A8393F',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 3,
  },
  v4NoButtonText: {
    fontFamily: F.serifSemiBold,
    fontSize: 18.5,
    letterSpacing: 0.2,
    color: '#7C3136',
  },
  v4YesButton: {
    flex: 1,
    minHeight: 60,
    borderRadius: 999,
    flexDirection: 'row',
    columnGap: 9,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.4,
    borderColor: 'rgba(47,143,87,0.36)',
    shadowColor: '#2F8F57',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 3,
  },
  v4YesButtonText: {
    fontFamily: F.serifSemiBold,
    fontSize: 18.5,
    letterSpacing: 0.2,
    color: '#23603E',
  },
  v4MetricCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  v4MetricCardAccent: {
    backgroundColor: 'rgba(77,133,134,0.10)',
    borderColor: 'rgba(77,133,134,0.28)',
  },
  v4MetricLabel: {
    fontFamily: F.sansBold,
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
  },
  v4MetricValue: {
    marginTop: 5,
    fontFamily: F.serifSemiBold,
    fontSize: 28,
    color: INK,
    textAlign: 'center',
  },
  v4MetricDetail: {
    marginTop: 4,
    fontFamily: F.sansMedium,
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
  },
  v4WasteTitle: {
    marginTop: 6,
    fontFamily: F.sansBold,
    fontSize: 27,
    color: '#9A342F',
    textAlign: 'center',
  },
  v4GoodTitle: {
    marginTop: 6,
    fontFamily: F.sansBold,
    fontSize: 27,
    color: GOLD,
    textAlign: 'center',
  },
  v4StakesPanel: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 22,
    padding: 15,
    backgroundColor: 'rgba(77,133,134,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(77,133,134,0.22)',
  },
  v4StakesText: {
    fontFamily: F.sansBold,
    fontSize: 14,
    lineHeight: 20,
    color: INK,
    textAlign: 'center',
  },
  v4RecapCard: {
    width: '100%',
    maxWidth: 430,
    flexDirection: 'row',
    columnGap: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.26)',
  },
  v4RecapCardMuted: {
    opacity: 0.44,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  v4RecapMark: {
    width: 34,
    fontFamily: F.sansBold,
    fontSize: 12,
    color: GOLD,
  },
  v4RecapText: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 13,
    lineHeight: 19,
    color: INK,
  },
  v4OptionWrap: {
    width: '100%',
    maxWidth: 430,
  },
  v4SetupCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 22,
    padding: 18,
    rowGap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  v4SetupCardDone: {
    backgroundColor: 'rgba(197,160,89,0.13)',
    borderColor: 'rgba(197,160,89,0.34)',
  },
  v4SetupTitle: {
    fontFamily: F.sansBold,
    fontSize: 17,
    color: INK,
  },
  v4SetupBody: {
    fontFamily: F.sansMedium,
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
  },
  v4BigFlame: {
    width: 142,
    height: 142,
  },
  v4WeekRow: {
    width: '100%',
    maxWidth: 430,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 13,
    borderRadius: 18,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  v4WeekDay: {
    width: 44,
    fontFamily: F.sansBold,
    color: GOLD,
  },
  v4WeekText: {
    flex: 1,
    fontFamily: F.sansBold,
    color: INK,
  },
  v4HomeRow: {
    width: '100%',
    maxWidth: 430,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    borderRadius: 18,
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  v4HomeText: {
    flex: 1,
    fontFamily: F.sansBold,
    color: INK,
  },
  v4FirstTask: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 430,
    minHeight: 82,
    borderRadius: 26,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  v4FirstTaskDone: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  v4FirstTaskText: {
    fontFamily: F.serifSemiBold,
    fontSize: 22,
    color: INK,
  },
  v4AccountOptions: {
    width: '100%',
    maxWidth: 430,
    rowGap: 10,
  },
  v4AccountOption: {
    minHeight: 74,
    borderRadius: 22,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(25,23,20,0.08)',
  },
  v4AccountOptionSelected: {
    backgroundColor: '#FFF7E8',
    borderColor: 'rgba(197,160,89,0.48)',
  },
  v4AccountIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.12)',
  },
  v4AccountCopy: {
    flex: 1,
  },
  v4AccountTitle: {
    fontFamily: F.sansBold,
    fontSize: 15,
    color: INK,
  },
  v4AccountBody: {
    marginTop: 3,
    fontFamily: F.sansMedium,
    fontSize: 12,
    color: MUTED,
  },
});
