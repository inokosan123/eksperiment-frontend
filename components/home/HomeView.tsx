import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowUpRight,
  Bell,
  Book,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleIcon,
  Clock,
  Heart,
  Plus,
  AlertTriangle,
  Settings,
  Skip,
  User,
  X,
} from '@/components/icons/Icons';
import DateStrip from './DateStrip';
import DayTally, { type DayOutcome } from './DayTally';
import HomePerformanceFooter, { type HomePerformanceFooterHandle } from './HomePerformanceFooter';
import { C, F } from '@/constants/tokens';
import { AnimatedTaskCheckTransition, AnyTaskCard, TaskData, TaskState } from '@/components/shared/TaskCards';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { CompletionFlourish } from '@/components/shared/taskAnimations';
import { playTaskCompleteFeedback, playTaskUndoFeedback, preloadTaskFeedbackSound } from '@/components/shared/taskFeedback';
import QuickTaskSheet from '@/components/shared/QuickTaskSheet';
import TaskAnalyticsSheet from '@/components/tasks/TaskAnalyticsSheet';
import NotificationsSheet from '@/components/tasks/NotificationsSheet';
import { useReadingList } from '@/components/library/ReadingListContext';
import { useInnerTools } from '@/components/inner-tools/InnerToolsContext';
import { sortMonthlyGoals, useMonthlyGoals } from '@/components/inner-tools/MonthlyGoalsContext';
import { AnimatedSealCheck, AnimatedStrikeText, fireGoalToggleHaptic, GoalCompletionConfetti, MONTHLY_GOAL_CELEBRATION_MS, toRoman } from '@/components/inner-tools/MonthlyGoalRow';
import { ReadableText } from '@/components/shared/typographyScale';
import { useTasks } from '@/components/tasks/TaskProvider';
import { useBigEvents } from '@/components/journal/BigEventsContext';
import { getBigEventCountdown, getBigEventsForDate } from '@/components/journal/bigEventsLogic';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { normalizeHabitIcon } from '@/components/shared/notoEmoji/legacyMap';
import {
  getEffectiveTaskTime,
  getLocalDateKey,
  parseTaskTimeToDate,
  scheduleMatchesDate,
} from '@/components/tasks/taskScheduler';
import {
  beginTaskCompletionReturn,
  clearTaskCompletionReturnAnimation,
  consumeSettledTaskCompletionReturnAnimations,
  peekTaskCompletionReturnAnimations,
  queueTaskCompletionReturnAnimation,
  requeueTaskCompletionReturnAnimations,
  subscribeTaskCompletionReturns,
  type QueuedCompletionAnimation,
} from '@/components/tasks/taskReturnAnimation';
import {
  NEXT_CHALLENGE_POPUP_GAP_MS,
  RECOVERED_CHALLENGE_POPUP_DELAY_MS,
  TASK_CHECK_TO_CHALLENGE_POPUP_MS,
  remainingDirectPopupDelayMs,
  remainingReturnCheckDelayMs,
} from '@/components/tasks/taskCompletionTimeline';
import type { TaskDefinition, TaskDraft, TaskLaunchDescriptor } from '@/components/tasks/taskTypes';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import ChallengeCompletionHomeModal from '@/components/challenges/ChallengeCompletionHomeModal';
import { preloadChallengeCompleteFeedback } from '@/components/challenges/challengeFeedback';
import {
  acknowledgeChallengeCelebration,
  getPendingChallengeCelebration,
} from '@/components/challenges/challengeDb';
import { useGuidedSetup, useGuideTarget } from '@/components/onboarding/guided/GuidedSetupContext';
import { useGuidedScrollTransition } from '@/components/onboarding/guided/use-guided-scroll-transition';
import { useViewportMotionBudget } from '@/components/shared/use-viewport-motion-budget';
import { canReuseHomeTaskRow } from '@/components/home/home-task-row-identity';


type HomeCard = {
  id: string;
  taskId?: string;
  instanceId?: string;
  instanceStatus?: string;
  task: TaskData;
  streak?: number;
  route?: string;
  launch?: TaskLaunchDescriptor;
  backend?: boolean;
};

type HomeReadingBook = {
  author?: string;
  category?: string;
  totalMinutes?: number;
  sessions?: number;
};

export type HomeTaskRowModel = {
  card: HomeCard;
  displayTask: TaskData;
  dateInactive: boolean;
  futureInactive: boolean;
  canToggle: boolean;
  canSkip: boolean;
  canShowAnalytics: boolean;
  book?: HomeReadingBook;
  blessingsToday: number;
  activeBridgeLabel?: string;
};

type IdleRuntime = typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

function scheduleHomeIdle(callback: () => void) {
  const runtime = globalThis as IdleRuntime;
  if (runtime.requestIdleCallback) {
    runtime.requestIdleCallback(callback, { timeout: 900 });
    return;
  }
  setTimeout(callback, 0);
}

type ChallengeCompletionModalState = {
  title: string;
  variant?: 'challenge' | 'churchWeek';
  trophyCount?: number;
  currentStreak?: number;
  eventId?: string;
  challengeId?: string;
  weekStart?: string;
};

const HOME_GUIDE_TARGETS = {
  bigEvents: 'home.big-events',
  tasks: 'home.tasks',
  firstTask: 'home.first-task',
  monthlyGoals: 'home.monthly-goals',
  myRoutine: 'home.my-routine',
} as const;

function taskStateToInstanceStatus(state: TaskState, fallback?: string) {
  if (state === 'done') return 'completed';
  if (state === 'skipped') return 'skipped';
  if (state === 'pending' || state === 'active') return 'pending';
  return fallback;
}

type TaskConfirmAction = {
  mode: 'uncheck' | 'unskip' | 'skip';
  instanceId: string;
  date: string;
  title: string;
  warning?: 'scriptureChallengeProgress';
} | null;

function TaskConfirmGlyph({
  mode,
  warning,
}: {
  mode: NonNullable<TaskConfirmAction>['mode'];
  warning?: NonNullable<TaskConfirmAction>['warning'];
}) {
  if (mode === 'skip') {
    return <Skip s={21} c="#9A3412" w={2.25} />;
  }

  if (mode === 'unskip') {
    return <Plus s={22} c={C.gold} w={2.6} />;
  }

  if (warning === 'scriptureChallengeProgress') {
    return <AlertTriangle s={23} c="#9A3412" w={2.15} />;
  }

  return <X s={23} c={C.red} w={2.45} />;
}

function isScriptureChallengeReadingTask(card: HomeCard) {
  return card.task.variant === 'challenge' && card.task.type === 'reading';
}

function isReadingBookTaskRef(taskId?: string, source?: string) {
  return source === 'reading_book' || !!taskId?.startsWith('reading_book_');
}

function getTaskConfirmBody(action: TaskConfirmAction) {
  if (!action) return '';
  if (action.mode === 'skip') return 'Do you want to skip this task for today?';
  if (action.mode === 'unskip') return 'Do you want to return this task to your list?';
  if (action.warning === 'scriptureChallengeProgress') {
    return 'This will mark the task as incomplete and delete the reading progress from this session. Your challenge progress will move back.';
  }
  return 'Do you want to mark this task as incomplete?';
}

function getTaskConfirmIconBg(action: TaskConfirmAction) {
  if (action?.mode === 'skip') return '#FFF1E8';
  if (action?.mode === 'unskip') return '#FFF7E6';
  if (action?.warning === 'scriptureChallengeProgress') return '#FFF1E8';
  return '#FFF1F2';
}

function getTaskConfirmColor(action: TaskConfirmAction) {
  if (action?.mode === 'skip' || action?.mode === 'unskip') return '#1C1917';
  if (action?.warning === 'scriptureChallengeProgress') return '#B45335';
  return C.red;
}

function isCompletionFlowTask(card: HomeCard) {
  return card.task.variant === 'reading'
    || card.task.variant === 'gratitude'
    || card.task.type === 'gratitude'
    || isJournalFlowCandidate(card)
    || isSpiritualScriptureCandidate(card)
    || (card.task.variant === 'challenge' && card.task.type === 'reading')
    || !!card.taskId?.startsWith('reading_book_')
    || isPrayerFlowCandidate(card);
}

function isJournalFlowCandidate(card: HomeCard) {
  return card.task.type === 'journal' || !!card.route?.startsWith('/journal');
}

function isSpiritualScriptureCandidate(card: HomeCard) {
  return card.task.variant === 'spiritual' && card.task.type === 'reading';
}

function isPrayerFlowCandidate(card: HomeCard) {
  return card.task.type === 'prayer'
    && (card.task.variant === 'spiritual' || card.task.variant === 'challenge');
}

function shiftMonth(dateKey: string, delta: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const next = new Date(year, month - 1 + delta, 1, 12, 0, 0, 0);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return getLocalDateKey(next);
}

function addLocalDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const next = new Date(year, month - 1, day, 12, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return getLocalDateKey(next);
}

function getMonthMeta(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return {
    month: date.toLocaleDateString('en-US', { month: 'long' }),
    year: String(date.getFullYear()),
  };
}

function getDateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function getOrdinalDay(day: number) {
  const teen = day % 100;
  if (teen >= 11 && teen <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function getTaskSectionTitle(selectedDate: string, todayKey: string) {
  if (selectedDate === todayKey) return "Today's Tasks";
  if (selectedDate === addLocalDays(todayKey, -1)) return "Yesterday's Tasks";
  if (selectedDate === addLocalDays(todayKey, 1)) return "Tomorrow's Tasks";
  const date = getDateFromKey(selectedDate);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `Tasks for ${month} ${getOrdinalDay(date.getDate())}`;
}

function getNoTasksCopy(selectedDate: string, todayKey: string) {
  if (selectedDate < todayKey) {
    return {
      eyebrow: 'Past Day',
      title: 'A Quiet Day',
      body: 'No tasks were scheduled or saved for this date.',
      status: 'No saved tasks for this day',
    };
  }

  if (selectedDate > todayKey) {
    return {
      eyebrow: 'Ahead',
      title: 'Open Space',
      body: 'No tasks are planned for this date yet.',
      status: 'No planned tasks for this day',
    };
  }

  return {
    eyebrow: 'Today',
    title: 'A Clear Day',
    body: 'Create a routine task or adjust your schedule when you are ready.',
    status: 'No tasks for today',
  };
}

function parseTaskTimeMinutes(time?: string) {
  if (!time) return null;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function formatTimeBridgeDuration(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (hours > 0 && remainingMinutes > 0) return `${hours}h ${remainingMinutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${Math.max(1, remainingMinutes)}m`;
}

function getActiveTimeBridge(cards: HomeCard[], currentMinute: number) {
  const nextUnresolvedIndex = cards.findIndex(card => {
    if (card.task.state === 'done' || card.task.state === 'skipped' || card.task.state === 'locked') {
      return false;
    }

    const minute = parseTaskTimeMinutes(card.task.time);
    return minute != null && minute > currentMinute;
  });
  if (nextUnresolvedIndex <= 0) return null;

  const nextCard = cards[nextUnresolvedIndex];
  const afterCard = cards[nextUnresolvedIndex - 1];
  const nextMinute = parseTaskTimeMinutes(nextCard.task.time);
  if (!afterCard || nextMinute == null) return null;

  const minutesLeft = nextMinute - currentMinute;
  if (minutesLeft <= 0) return null;

  return {
    afterCardId: afterCard.id,
    nextLabel: `Next task in ${formatTimeBridgeDuration(minutesLeft)}`,
  };
}

function firstScheduledTaskToday(tasks: TaskDefinition[], todayKey: string) {
  return tasks
    .filter(task => task.status === 'active' && scheduleMatchesDate(task.schedule, todayKey))
    .map(task => parseTaskTimeToDate(todayKey, getEffectiveTaskTime(task.schedule, todayKey)))
    .filter((date): date is Date => !!date)
    .sort((a, b) => a.getTime() - b.getTime())[0];
}

function canMutateTaskDate(selectedDate: string, tasks: TaskDefinition[]) {
  const now = new Date();
  const todayKey = getLocalDateKey(now);
  if (selectedDate === todayKey) return true;

  const yesterdayKey = addLocalDays(todayKey, -1);
  if (selectedDate !== yesterdayKey) return false;

  const firstToday = firstScheduledTaskToday(tasks, todayKey);
  return firstToday ? now.getTime() < firstToday.getTime() : true;
}

function HomeHeader({
  selectedDate,
  todayKey,
  onSelectDate,
}: {
  selectedDate: string;
  todayKey: string;
  onSelectDate: (dateKey: string) => void;
}) {
  const router = useRouter();
  const monthMeta = getMonthMeta(selectedDate);

  return (
    <>
      <View style={h.row}>
        <TouchableOpacity
          style={h.iconBtn}
          activeOpacity={0.7}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/account' as any);
          }}
        >
          <User s={18} c={C.text} />
        </TouchableOpacity>
        <View style={h.monthWrap}>
          <TouchableOpacity activeOpacity={0.72} onPress={() => onSelectDate(shiftMonth(selectedDate, -1))} style={h.monthNavBtn}>
            <ChevronLeft s={18} c={C.textMuted} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={h.month}>{monthMeta.month}</Text>
            <Text style={h.year}>{monthMeta.year}</Text>
          </View>
          <TouchableOpacity activeOpacity={0.72} onPress={() => onSelectDate(shiftMonth(selectedDate, 1))} style={h.monthNavBtn}>
            <ChevronRight s={18} c={C.textMuted} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={h.iconBtn}
          activeOpacity={0.7}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/settings' as any);
          }}
        >
          <Settings s={18} c={C.text} />
        </TouchableOpacity>
      </View>

      <DateStrip selectedKey={selectedDate} todayKey={todayKey} onSelect={onSelectDate} />

      <View style={h.quoteWrap}>
        <Text style={h.quote}>
          {'"Awake thou that sleepest, and '}
          <Text style={{ textDecorationLine: 'underline' }}>arise</Text>{' '}
          <Text style={{ color: C.gold }}>(anasta)</Text>
          {' from the dead, and Christ shall give thee light."'}
        </Text>
        <Text style={h.ref}>EPHESIANS 5:14</Text>
      </View>
    </>
  );
}

const h = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 9, paddingBottom: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f5f4f0', alignItems: 'center', justifyContent: 'center' },
  monthWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthNavBtn: { width: 24, height: 28, alignItems: 'center', justifyContent: 'center' },
  month: { fontFamily: F.serifMedium, fontSize: 27, color: C.red, lineHeight: 32 },
  year: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.textMuted, marginTop: 2 },
  quoteWrap: { paddingHorizontal: 30, paddingTop: 6, paddingBottom: 4, alignItems: 'center' },
  quote: {
    maxWidth: 330,
    fontFamily: F.serifMediumItalic,
    fontSize: 14,
    color: '#8C8277',
    lineHeight: 18.5,
    textAlign: 'center',
  },
  ref: { marginTop: 4, fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2.5, color: C.gold },
});

const MemoizedHomeHeader = React.memo(HomeHeader);


function TaskLoadingCard() {
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withTiming(1, { duration: 180 });
  }, [reveal]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 6 }],
  }));

  return (
    <Reanimated.View style={[s.loadingCard, cardStyle]}>
      <ActivityIndicator color={C.gold} size="small" />
    </Reanimated.View>
  );
}

function TaskContentAppear({ children }: { children: React.ReactNode }) {
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withTiming(1, { duration: 260 });
  }, [reveal]);

  const style = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 8 }],
  }));

  return <Reanimated.View style={style}>{children}</Reanimated.View>;
}

function ActiveTimeBridge({ nextLabel }: { nextLabel: string }) {
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withTiming(1, { duration: 260 });
  }, [reveal]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * -4 }],
  }));

  const ruleStyle = useAnimatedStyle(() => ({
    opacity: 0.36 + reveal.value * 0.64,
    transform: [{ scaleX: 0.82 + reveal.value * 0.18 }],
  }));

  return (
    <Reanimated.View pointerEvents="none" style={[s.timeBridgeWrap, wrapStyle]}>
      <View style={s.timeBridgeSpine}>
        <View style={s.timeBridgeSpineLine} />
        <LinearGradient
          colors={['#FFFDF8', '#F2DCA8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.timeBridgeDotOuter}
        >
          <View style={s.timeBridgeDotHalo} />
          <View style={s.timeBridgeDotInner} />
        </LinearGradient>
      </View>
      <View style={s.timeBridgeContent}>
        <Reanimated.View style={[s.timeBridgeRule, ruleStyle]} />
        <LinearGradient
          colors={['#FFFDF8', '#F8EED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.timeBridgePill}
        >
          <View style={s.timeBridgePillGlow} />
          <View style={s.timeBridgeIconBadge}>
            <Clock s={10} c="#A8853C" w={2.2} />
          </View>
          <Text style={s.timeBridgeNextText} numberOfLines={1}>{nextLabel}</Text>
        </LinearGradient>
        <Reanimated.View style={[s.timeBridgeRule, ruleStyle]} />
      </View>
    </Reanimated.View>
  );
}

function BigEventBanner({
  events,
  selectedDate,
  onPress,
}: {
  events: ReturnType<typeof useBigEvents>['bigEvents'];
  selectedDate: string;
  onPress: () => void;
}) {
  const list = useMemo(() => getBigEventsForDate(events, selectedDate, 4), [events, selectedDate]);
  if (list.length === 0) return null;

  return (
    <View style={beb.section}>
      <View style={beb.head}>
        <Text style={beb.headTitle}>Big Upcoming Events</Text>
        <Text style={beb.headSub}>
          {list.length === 1 ? '1 active' : `${list.length} active`}
        </Text>
      </View>
      {list.map(event => (
        <BigEventRow key={event.id} event={event} today={selectedDate} onPress={onPress} />
      ))}
    </View>
  );
}

function BigEventRow({
  event,
  today,
  onPress,
}: {
  event: ReturnType<typeof useBigEvents>['bigEvents'][number];
  today: string;
  onPress: () => void;
}) {
  const days = getBigEventCountdown(event, today);
  const tint = `${event.color}1F`;
  const isToday = days === 0;

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={beb.row}>
      <View style={[beb.iconBox, { backgroundColor: tint }]}>
        <NotoEmoji name={normalizeHabitIcon(event.icon)} size={18} />
      </View>
      <View style={beb.copy}>
        <ReadableText style={[beb.title, !isToday && beb.titleLarge]} numberOfLines={1} ellipsizeMode="tail">{event.title}</ReadableText>
        {isToday && <ReadableText style={[beb.todayHint, { color: event.color }]}>The day is here</ReadableText>}
      </View>
      {isToday ? (
        <View style={[beb.todayPill, { backgroundColor: event.color }]}>
          <View style={beb.todayDot} />
          <Text style={beb.todayPillText}>TODAY</Text>
        </View>
      ) : (
        <View style={beb.count}>
          <Text style={[beb.countNum, { color: event.color }]}>{days}</Text>
          <Text style={beb.countLabel}>{days === 1 ? 'day' : 'days'}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const MemoizedBigEventBanner = React.memo(BigEventBanner);

const beb = StyleSheet.create({
  section: { marginHorizontal: 16, marginTop: 6, marginBottom: 0 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  headTitle: { fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  headSub: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: '#A8A29E', textTransform: 'uppercase' },
  row: {
    flexDirection: 'row', alignItems: 'center', columnGap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#EDE9E0',
    paddingLeft: 6, paddingRight: 16, paddingVertical: 5, marginBottom: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  iconBox:   { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  copy:      { flex: 1, minWidth: 0 },
  title:     { fontFamily: F.serifMedium, fontSize: 16, color: C.text, flexShrink: 1, minWidth: 0 },
  titleLarge:{ fontSize: 17 },
  todayHint: { marginTop: 2, fontFamily: F.serifMediumItalic, fontSize: 11 },
  count:     { flexDirection: 'row', alignItems: 'baseline', columnGap: 4, flexShrink: 0 },
  countNum:  { fontFamily: F.serifSemiBold, fontSize: 19, lineHeight: 21 },
  countLabel:{ fontFamily: F.sansMedium, fontSize: 11, color: '#A8A29E' },
  todayPill: {
    flexDirection: 'row', alignItems: 'center', columnGap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10,
    flexShrink: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 3,
  },
  todayDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.95)' },
  todayPillText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, color: '#FFFFFF' },
});

export default function HomeView({
  guided = false,
  onGuidedComplete,
}: {
  guided?: boolean;
  onGuidedComplete?: () => void;
} = {}) {
  const insets = useSafeAreaInsets();
  const { height: guideScreenHeight } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  const homeScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const homeFooterRef = useRef<HomePerformanceFooterHandle>(null);
  const scheduleHomeViewportUpdate = useViewportMotionBudget(scrollY => {
    homeFooterRef.current?.updateViewport(scrollY);
  });
  const {
    session,
    patchSession,
    setPresentation,
  } = useGuidedSetup();
  const { books, ready: readingListReady } = useReadingList();
  const booksById = useMemo(
    () => new Map(books.map(book => [book.id, book])),
    [books],
  );
  const booksByTitle = useMemo(
    () => new Map(books.map(book => [book.title, book])),
    [books],
  );
  const { gratitudeEntries } = useInnerTools();
  const { bigEvents } = useBigEvents();
  const {
    ready: taskBackendReady,
    challengeCompletionRevision,
    selectedDate,
    taskDataDate,
    isDateLoading,
    tasks: taskDefinitions,
    listItems: backendTasks,
    refresh: refreshTasks,
    createOrUpdateTask,
    archiveTasksImmediately,
    commitInstanceCompletion,
    reconcileCommittedCompletion,
    skipInstance,
    skipInstances,
    resetInstance,
  } = useTasks();
  const topPadding = Platform.OS === 'web'
    ? 10
    : Math.max(insets.top, 0) + 4;

  const todayKey = getLocalDateKey();
  const validReadingTaskIds = useMemo(() => new Set(
    books
      .filter(book => book.status === 'reading' && book.showOnHome)
      .map(book => `reading_book_${book.id}`),
  ), [books]);
  const visibleTaskDefinitions = useMemo(() => (
    taskDefinitions.filter(task => (
      !isReadingBookTaskRef(task.id, task.source) || !readingListReady || validReadingTaskIds.has(task.id)
    ))
  ), [readingListReady, taskDefinitions, validReadingTaskIds]);
  const visibleBackendTasks = useMemo(() => (
    backendTasks.filter(item => (
      !isReadingBookTaskRef(item.instance.taskId, item.instance.source)
        || !readingListReady
        || validReadingTaskIds.has(item.instance.taskId)
    ))
  ), [backendTasks, readingListReady, validReadingTaskIds]);
  const taskContentDate = taskBackendReady && !isDateLoading ? selectedDate : taskDataDate;
  const isTaskContentLoading = !taskBackendReady || isDateLoading;
  const canMutateSelectedDate = !isTaskContentLoading && canMutateTaskDate(taskContentDate, visibleTaskDefinitions);
  const [optimisticStates, setOptimisticStates] = useState<Record<string, TaskState>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [quickTaskSheetOpen, setQuickTaskSheetOpen] = useState(false);
  const [analyticsCard, setAnalyticsCard] = useState<HomeCard | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [skipDayConfirmOpen, setSkipDayConfirmOpen] = useState(false);
  const [taskConfirmAction, setTaskConfirmAction] = useState<TaskConfirmAction>(null);
  const [challengeCompletionModal, setChallengeCompletionModal] = useState<ChallengeCompletionModalState | null>(null);
  const challengeCompletionModalRef = useRef<ChallengeCompletionModalState | null>(null);
  const isGuided = guided && session?.active === true && session.activeStep === 'homeClimax';
  const guidePhase = isGuided ? session.phase : '';
  const bigEventsTarget = useGuideTarget(HOME_GUIDE_TARGETS.bigEvents, isGuided);
  const tasksTarget = useGuideTarget(HOME_GUIDE_TARGETS.tasks, isGuided);
  const firstTaskTarget = useGuideTarget(HOME_GUIDE_TARGETS.firstTask, isGuided);
  const monthlyGoalsTarget = useGuideTarget(HOME_GUIDE_TARGETS.monthlyGoals, isGuided);
  const myRoutineTarget = useGuideTarget(HOME_GUIDE_TARGETS.myRoutine, isGuided);

  useEffect(() => {
    preloadTaskFeedbackSound();
    preloadChallengeCompleteFeedback();
  }, []);

  useFocusEffect(useCallback(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const syncMinute = () => {
      const next = Date.now();
      setNowTick(current => (
        Math.floor(current / 60_000) === Math.floor(next / 60_000) ? current : next
      ));
    };

    const stopClock = () => {
      if (timeout) clearTimeout(timeout);
      if (interval) clearInterval(interval);
      timeout = undefined;
      interval = undefined;
    };

    const startClock = () => {
      stopClock();
      syncMinute();
      timeout = setTimeout(() => {
        syncMinute();
        interval = setInterval(syncMinute, 60_000);
      }, 60_000 - (Date.now() % 60_000) + 50);
    };

    if (AppState.currentState === 'active') startClock();
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') startClock();
      else stopClock();
    });

    return () => {
      subscription.remove();
      stopClock();
    };
  }, []));

  useEffect(() => {
    if (!readingListReady) return;
    const invalidReadingTaskIds = backendTasks
      .filter(item => isReadingBookTaskRef(item.instance.taskId, item.instance.source))
      .filter(item => !validReadingTaskIds.has(item.instance.taskId))
      .map(item => item.instance.taskId);

    const uniqueIds = [...new Set(invalidReadingTaskIds)];
    if (uniqueIds.length === 0) return;
    void archiveTasksImmediately(uniqueIds, selectedDate).catch(error => {
      console.warn('Reading task cleanup failed:', error);
    });
  }, [archiveTasksImmediately, backendTasks, readingListReady, selectedDate, validReadingTaskIds]);

  const selectDate = useCallback((dateKey: string) => {
    void refreshTasks(dateKey);
  }, [refreshTasks]);

  const refreshTasksRef = useRef(refreshTasks);
  refreshTasksRef.current = refreshTasks;
  const returnAnimationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mutatingInstancesRef = useRef<Set<string>>(new Set());
  const isHomeFocusedRef = useRef(false);
  const isHomeRouteVisibleRef = useRef(pathname === '/');
  const isAppActiveRef = useRef(AppState.currentState === 'active');
  const completionTimelineGenerationRef = useRef(0);
  const completionTimelineBusyRef = useRef(false);
  const completionLookupInFlightRef = useRef(false);
  const completionLookupRetryRequestedRef = useRef(false);
  const completionLookupScheduledRef = useRef(false);
  const activeTimelineCompletionsRef = useRef<QueuedCompletionAnimation[]>([]);
  const deferredTimelineCompletionsRef = useRef<QueuedCompletionAnimation[]>([]);
  const drainCompletionTimelineRef = useRef<() => void>(() => {});

  useEffect(() => () => {
    for (const timer of returnAnimationTimersRef.current) {
      clearTimeout(timer);
    }
    returnAnimationTimersRef.current = [];
  }, []);

  const markReturnedCompletionsPending = useCallback((completions: QueuedCompletionAnimation[]) => {
    const returnedCompletionIds = completions.map(item => item.instanceId);
    if (returnedCompletionIds.length === 0) return;

    setOptimisticStates(prev => {
      const next = { ...prev };
      for (const instanceId of returnedCompletionIds) {
        next[instanceId] = 'pending';
      }
      return next;
    });
  }, []);

  const playReturnedCompletionCheck = useCallback((completions: QueuedCompletionAnimation[]) => {
    const returnedCompletionIds = completions.map(item => item.instanceId);
    if (returnedCompletionIds.length === 0) return;
    void playTaskCompleteFeedback();
    setOptimisticStates(prev => {
      const next = { ...prev };
      for (const instanceId of returnedCompletionIds) {
        next[instanceId] = 'done';
      }
      return next;
    });

    const clearTimer = setTimeout(() => {
      setOptimisticStates(prev => {
        let changed = false;
        const next = { ...prev };
        for (const instanceId of returnedCompletionIds) {
          if (next[instanceId] !== 'done') continue;
          delete next[instanceId];
          changed = true;
        }
        return changed ? next : prev;
      });
    }, 1500);
    returnAnimationTimersRef.current.push(clearTimer);
  }, []);

  const showChallengeCompletionModal = useCallback((modal: ChallengeCompletionModalState) => {
    challengeCompletionModalRef.current = modal;
    setChallengeCompletionModal(modal);
  }, []);

  const loadPendingChallengeCelebration = useCallback(async () => {
    if (
      !taskBackendReady
      || !isHomeFocusedRef.current
      || !isHomeRouteVisibleRef.current
      || !isAppActiveRef.current
      || completionTimelineBusyRef.current
      || challengeCompletionModalRef.current
      || mutatingInstancesRef.current.size > 0
    ) return;
    if (completionLookupInFlightRef.current) {
      completionLookupRetryRequestedRef.current = true;
      return;
    }

    completionLookupInFlightRef.current = true;
    const generation = completionTimelineGenerationRef.current;
    try {
      const pending = await getPendingChallengeCelebration();
      if (
        !pending
        || generation !== completionTimelineGenerationRef.current
        || !isHomeFocusedRef.current
        || !isHomeRouteVisibleRef.current
        || !isAppActiveRef.current
        || completionTimelineBusyRef.current
        || challengeCompletionModalRef.current
        || mutatingInstancesRef.current.size > 0
      ) return;

      completionTimelineBusyRef.current = true;
      showChallengeCompletionModal({
        title: pending.title,
        variant: pending.variant,
        trophyCount: pending.trophyCount,
        currentStreak: pending.currentStreak,
        eventId: pending.eventId,
        challengeId: pending.challengeId,
        weekStart: pending.weekStart,
      });
    } catch (error) {
      console.warn('Pending challenge celebration lookup failed:', error);
    } finally {
      completionLookupInFlightRef.current = false;
      if (completionLookupRetryRequestedRef.current) {
        completionLookupRetryRequestedRef.current = false;
        const retryTimer = setTimeout(() => drainCompletionTimelineRef.current(), 0);
        returnAnimationTimersRef.current.push(retryTimer);
      }
    }
  }, [showChallengeCompletionModal, taskBackendReady]);

  const drainCompletionTimeline = useCallback(() => {
    if (
      !taskBackendReady
      || !isHomeFocusedRef.current
      || !isHomeRouteVisibleRef.current
      || !isAppActiveRef.current
    ) return;

    const queuedSnapshot = peekTaskCompletionReturnAnimations();
    const readyRoutedCompletions = queuedSnapshot.filter(item => (
      item.source === 'routed'
      && item.state !== 'committing'
      && !item.feedbackPlayedAt
    ));
    if (readyRoutedCompletions.length > 0) {
      // A committed row stays visually pending while the native screen closes.
      // This masks any provider refresh that lands before the check timeline.
      markReturnedCompletionsPending(readyRoutedCompletions);
    }

    const newlyQueued = consumeSettledTaskCompletionReturnAnimations();
    if (newlyQueued.length > 0) {
      const combined = new Map(
        [...deferredTimelineCompletionsRef.current, ...newlyQueued]
          .map(item => [item.instanceId, item]),
      );
      deferredTimelineCompletionsRef.current = [...combined.values()];
    }

    if (completionTimelineBusyRef.current || challengeCompletionModalRef.current) return;

    const completions = deferredTimelineCompletionsRef.current;
    if (completions.length === 0) {
      // A route is still committing or its native close has not settled. Do
      // not inspect the durable challenge outbox ahead of the row animation.
      if (queuedSnapshot.length > 0) return;
      if (completionLookupInFlightRef.current) {
        completionLookupRetryRequestedRef.current = true;
        return;
      }
      if (completionLookupScheduledRef.current || mutatingInstancesRef.current.size > 0) return;

      completionLookupScheduledRef.current = true;
      const generation = completionTimelineGenerationRef.current;
      scheduleHomeIdle(() => {
        if (
          generation !== completionTimelineGenerationRef.current
          || !isHomeFocusedRef.current
          || !isHomeRouteVisibleRef.current
          || !isAppActiveRef.current
        ) {
          completionLookupScheduledRef.current = false;
          return;
        }
        const lookupTimer = setTimeout(() => {
          completionLookupScheduledRef.current = false;
          if (
            generation === completionTimelineGenerationRef.current
            && isHomeFocusedRef.current
            && isHomeRouteVisibleRef.current
            && isAppActiveRef.current
          ) {
            void loadPendingChallengeCelebration();
          }
        }, RECOVERED_CHALLENGE_POPUP_DELAY_MS);
        returnAnimationTimersRef.current.push(lookupTimer);
      });
      return;
    }

    deferredTimelineCompletionsRef.current = [];
    completionLookupScheduledRef.current = false;
    completionTimelineBusyRef.current = true;
    const generation = completionTimelineGenerationRef.current + 1;
    completionTimelineGenerationRef.current = generation;
    activeTimelineCompletionsRef.current = completions;

    const awaitingTaskFeedback = completions.filter(item => !item.feedbackPlayedAt);
    const latestPlayedFeedbackAt = Math.max(
      0,
      ...completions.map(item => item.feedbackPlayedAt ?? 0),
    );
    const celebration = completions.find(
      item => item.celebration?.type === 'challengeComplete',
    )?.celebration;

    if (awaitingTaskFeedback.length > 0) {
      markReturnedCompletionsPending(awaitingTaskFeedback);
    }

    const isCurrent = () => (
      generation === completionTimelineGenerationRef.current
      && isHomeFocusedRef.current
      && isHomeRouteVisibleRef.current
      && isAppActiveRef.current
    );
    const releaseTimeline = (nextDelayMs: number) => {
      if (!isCurrent()) return;
      activeTimelineCompletionsRef.current = [];
      completionTimelineBusyRef.current = false;
      const nextTimer = setTimeout(() => drainCompletionTimelineRef.current(), nextDelayMs);
      returnAnimationTimersRef.current.push(nextTimer);
    };
    const presentCelebration = () => {
      if (!isCurrent() || !celebration) return;
      showChallengeCompletionModal({
        title: celebration.title ?? 'Challenge Complete',
        variant: celebration.variant,
        trophyCount: celebration.trophyCount,
        currentStreak: celebration.currentStreak,
        eventId: celebration.eventId,
        challengeId: celebration.challengeId,
        weekStart: celebration.weekStart,
      });
    };

    if (!isCurrent()) return;

    if (awaitingTaskFeedback.length === 0) {
      if (!celebration) {
        releaseTimeline(0);
        return;
      }
      const popupTimer = setTimeout(
        presentCelebration,
        remainingDirectPopupDelayMs(latestPlayedFeedbackAt),
      );
      returnAnimationTimersRef.current.push(popupTimer);
      return;
    }

    const checkTimer = setTimeout(() => {
      if (!isCurrent()) return;
      playReturnedCompletionCheck(awaitingTaskFeedback);

      if (!celebration) {
        // A durable event with missing in-memory metadata is still allowed a
        // quiet beat after the check before the outbox is inspected.
        releaseTimeline(TASK_CHECK_TO_CHALLENGE_POPUP_MS);
        return;
      }
      const popupTimer = setTimeout(presentCelebration, TASK_CHECK_TO_CHALLENGE_POPUP_MS);
      returnAnimationTimersRef.current.push(popupTimer);
    }, remainingReturnCheckDelayMs(awaitingTaskFeedback));
    returnAnimationTimersRef.current.push(checkTimer);
  }, [
    loadPendingChallengeCelebration,
    markReturnedCompletionsPending,
    playReturnedCompletionCheck,
    showChallengeCompletionModal,
    taskBackendReady,
  ]);
  drainCompletionTimelineRef.current = drainCompletionTimeline;

  const suspendCompletionTimeline = useCallback(() => {
    completionTimelineGenerationRef.current += 1;
    completionLookupScheduledRef.current = false;

    if (!challengeCompletionModalRef.current) {
      requeueTaskCompletionReturnAnimations([
        ...activeTimelineCompletionsRef.current,
        ...deferredTimelineCompletionsRef.current,
      ]);
      activeTimelineCompletionsRef.current = [];
      deferredTimelineCompletionsRef.current = [];
      completionTimelineBusyRef.current = false;
    }
  }, []);

  const cancelCompletionTimelineForInstance = useCallback((instanceId: string) => {
    clearTaskCompletionReturnAnimation(instanceId);
    deferredTimelineCompletionsRef.current = deferredTimelineCompletionsRef.current
      .filter(item => item.instanceId !== instanceId);

    const active = activeTimelineCompletionsRef.current;
    if (
      !challengeCompletionModalRef.current
      && active.some(item => item.instanceId === instanceId)
    ) {
      completionTimelineGenerationRef.current += 1;
      completionLookupScheduledRef.current = false;
      activeTimelineCompletionsRef.current = [];
      completionTimelineBusyRef.current = false;
      requeueTaskCompletionReturnAnimations(
        active.filter(item => item.instanceId !== instanceId),
      );
    }
  }, []);

  const finishChallengeCompletionModal = useCallback(() => {
    const modal = challengeCompletionModalRef.current;
    if (!modal) return;
    const eventId = modal.eventId;
    challengeCompletionModalRef.current = null;
    setChallengeCompletionModal(null);
    completionTimelineGenerationRef.current += 1;
    activeTimelineCompletionsRef.current = [];

    const releaseAfterDismiss = () => {
      completionTimelineBusyRef.current = false;
      const nextTimer = setTimeout(
        () => drainCompletionTimelineRef.current(),
        NEXT_CHALLENGE_POPUP_GAP_MS,
      );
      returnAnimationTimersRef.current.push(nextTimer);
    };

    if (eventId) {
      void acknowledgeChallengeCelebration(eventId)
        .then(releaseAfterDismiss)
        .catch(error => {
          completionTimelineBusyRef.current = false;
          console.warn('Challenge celebration acknowledgement failed:', error);
        });
      return;
    }
    releaseAfterDismiss();
  }, []);

  useFocusEffect(useCallback(() => {
    isHomeFocusedRef.current = true;
    if (taskBackendReady) {
      const pendingReturns = peekTaskCompletionReturnAnimations();
      if (pendingReturns.length === 0) {
        void refreshTasksRef.current(getLocalDateKey());
      }
      drainCompletionTimelineRef.current();
    }

    return () => {
      isHomeFocusedRef.current = false;
      suspendCompletionTimeline();
    };
  }, [suspendCompletionTimeline, taskBackendReady]));

  useEffect(() => subscribeTaskCompletionReturns(() => {
    drainCompletionTimelineRef.current();
  }), []);

  useEffect(() => {
    const visible = pathname === '/';
    isHomeRouteVisibleRef.current = visible;
    if (visible) drainCompletionTimelineRef.current();
    else suspendCompletionTimeline();
  }, [pathname, suspendCompletionTimeline]);

  // Native notification actions and direct Home checks can complete while the
  // Home route remains focused, so a focus effect alone is not sufficient.
  useEffect(() => {
    if (!taskBackendReady || challengeCompletionRevision === 0) return;
    drainCompletionTimelineRef.current();
  }, [challengeCompletionRevision, taskBackendReady]);

  useEffect(() => {
    if (!taskBackendReady) return undefined;
    const subscription = AppState.addEventListener('change', state => {
      isAppActiveRef.current = state === 'active';
      if (state === 'active') drainCompletionTimelineRef.current();
      else suspendCompletionTimeline();
    });
    return () => subscription.remove();
  }, [suspendCompletionTimeline, taskBackendReady]);

  useEffect(() => {
    setOptimisticStates({});
  }, [selectedDate]);

  useEffect(() => {
    setOptimisticStates(prev => {
      let changed = false;
      const next: Record<string, TaskState> = {};

      for (const [instanceId, state] of Object.entries(prev)) {
        const backend = visibleBackendTasks.find(item => item.instance.id === instanceId);
        if (backend && backend.card.state !== state) {
          next[instanceId] = state;
        } else {
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [visibleBackendTasks]);

  const homeCardCacheRef = useRef(new Map<string, {
    source: (typeof visibleBackendTasks)[number];
    optimisticState?: TaskState;
    card: HomeCard;
  }>());
  const homeCards = useMemo<HomeCard[]>(() => {
    if (!taskBackendReady || visibleBackendTasks.length === 0) {
      homeCardCacheRef.current.clear();
      return [];
    }
    const nextCache = new Map<string, {
      source: (typeof visibleBackendTasks)[number];
      optimisticState?: TaskState;
      card: HomeCard;
    }>();
    const nextCards = visibleBackendTasks.map(item => {
      const optimisticState = optimisticStates[item.instance.id];
      const previous = homeCardCacheRef.current.get(item.instance.id);
      if (previous?.source === item && previous.optimisticState === optimisticState) {
        nextCache.set(item.instance.id, previous);
        return previous.card;
      }
      const card: HomeCard = {
        id: item.instance.id,
        taskId: item.instance.taskId,
        instanceId: item.instance.id,
        instanceStatus: optimisticState
          ? taskStateToInstanceStatus(optimisticState, item.instance.status)
          : item.instance.status,
        route: item.route,
        launch: item.launch,
        task: optimisticState ? { ...item.card, state: optimisticState } : item.card,
        backend: true,
      };
      nextCache.set(item.instance.id, { source: item, optimisticState, card });
      return card;
    });
    homeCardCacheRef.current = nextCache;
    return nextCards;
  }, [optimisticStates, taskBackendReady, visibleBackendTasks]);

  const taskStats = useMemo(() => {
    const hasVisibleBackendTasks = visibleBackendTasks.length > 0;
    const stats = {
      visibleTaskCount: hasVisibleBackendTasks ? homeCards.length : 0,
      scheduledToday: 0,
      completedToday: 0,
      skippedToday: 0,
      resolvedToday: 0,
      skippableCards: [] as HomeCard[],
      // One entry per task the tally counts — the same set scheduledToday
      // counts, in card order, so the bar and the status line can never
      // disagree about the size of the day.
      outcomes: [] as DayOutcome[],
    };

    if (!hasVisibleBackendTasks) return stats;

    for (const card of homeCards) {
      const state = card.task.state;
      if (state !== 'locked') {
        stats.scheduledToday += 1;
        stats.outcomes.push(
          state === 'done' ? 'done' : state === 'skipped' ? 'skipped' : 'pending',
        );
      }
      if (state === 'done') stats.completedToday += 1;
      if (state === 'skipped') stats.skippedToday += 1;
      if (state === 'done' || state === 'skipped') stats.resolvedToday += 1;
      if (
        card.instanceId
        && (card.instanceStatus === 'pending' || card.instanceStatus === 'missed')
      ) {
        stats.skippableCards.push(card);
      }
    }

    return stats;
  }, [homeCards, visibleBackendTasks.length]);
  const {
    visibleTaskCount,
    scheduledToday,
    completedToday,
    skippedToday,
    resolvedToday,
    skippableCards,
    outcomes: taskOutcomes,
  } = taskStats;
  // Skip All Day must capture every unresolved task for the day — including
  // past-due ones the reconcile loop already auto-marked as 'missed'. The
  // adapter maps 'missed' → 'locked' for display, so filter on instanceStatus
  // (raw DB status) instead of card state.
  const skipDayDisabled = !canMutateSelectedDate || skippableCards.length === 0;
  const progressTotal = taskContentDate < todayKey && visibleTaskCount > 0 ? visibleTaskCount : scheduledToday;

  // Universal rule (matches WeeklyRhythm): all tasks skipped → the day is
  // struck black. Otherwise the tally carries each task's own outcome, so a
  // skipped task no longer has to leave the sum to stay neutral.
  const allSkipped = progressTotal > 0
    && completedToday === 0
    && skippedToday === progressTotal;
  const progressMode: 'normal' | 'all-skipped' = allSkipped ? 'all-skipped' : 'normal';
  const statusLine = !taskBackendReady
    ? 'Loading your routine...'
    : visibleBackendTasks.length === 0 && visibleTaskDefinitions.length > 0
      ? getNoTasksCopy(taskContentDate, todayKey).status
      : taskContentDate < todayKey && visibleTaskCount > 0
        ? resolvedToday > 0
          ? `${resolvedToday} of ${visibleTaskCount} resolved`
          : `${visibleTaskCount} task snapshot`
      : taskContentDate > todayKey && visibleTaskCount > 0
        ? `${visibleTaskCount} tasks scheduled`
      : scheduledToday === 0
        ? 'Set up tasks to fill your Home flow'
        : skippedToday > 0
          ? `${resolvedToday} of ${scheduledToday} resolved`
        : completedToday > 0
          ? `${completedToday} of ${scheduledToday} completed`
          : taskContentDate === todayKey
            ? `${scheduledToday} active today`
            : `${scheduledToday} tasks scheduled`;

  const hasBackendTasks = taskBackendReady && (
    visibleBackendTasks.length > 0 || visibleTaskDefinitions.some(task => task.status !== 'archived')
  );
  const taskSectionTitle = getTaskSectionTitle(taskContentDate, todayKey);
  const noTasksCopy = getNoTasksCopy(taskContentDate, todayKey);
  const currentMinute = useMemo(() => {
    const now = new Date(nowTick);
    return now.getHours() * 60 + now.getMinutes();
  }, [nowTick]);
  const activeTimeBridge = useMemo(
    () => taskContentDate === todayKey ? getActiveTimeBridge(homeCards, currentMinute) : null,
    [currentMinute, homeCards, taskContentDate, todayKey],
  );
  const gratitudeDailyCountForTaskDate = useMemo(
    () => gratitudeEntries.reduce((count, entry) => (
      entry.kind === 'daily' && entry.date === taskContentDate ? count + 1 : count
    ), 0),
    [gratitudeEntries, taskContentDate],
  );
  const homeTaskRowCacheRef = useRef(new Map<string, HomeTaskRowModel>());
  const homeTaskRows = useMemo(() => {
    const nextCache = new Map<string, HomeTaskRowModel>();
    const rows = homeCards.map(card => {
      const dateInactive = !!card.backend && taskContentDate !== todayKey && !canMutateSelectedDate;
      const futureInactive = dateInactive && taskContentDate > todayKey;
      const baseDisplayTask = card.backend
        ? canMutateSelectedDate && card.instanceStatus === 'missed'
          ? { ...card.task, state: 'pending' as TaskState }
          : !canMutateSelectedDate && card.task.state !== 'done' && card.task.state !== 'skipped'
            ? { ...card.task, state: 'locked' as TaskState }
            : card.task
        : card.task;
      const optimisticState = card.instanceId ? optimisticStates[card.instanceId] : undefined;
      const displayTask = optimisticState
        ? { ...baseDisplayTask, state: optimisticState }
        : baseDisplayTask;
      const canToggle = !!card.instanceId && canMutateSelectedDate && displayTask.state !== 'locked';
      const next: HomeTaskRowModel = {
        card,
        displayTask,
        dateInactive,
        futureInactive,
        canToggle,
        canSkip: canToggle && displayTask.state !== 'done' && displayTask.state !== 'skipped',
        canShowAnalytics: !!card.backend && !!card.taskId && displayTask.variant !== 'quick',
        book: card.id === 'reading-task' ? booksByTitle.get(displayTask.title) : undefined,
        blessingsToday: card.id === 'gratitude-task' ? gratitudeDailyCountForTaskDate : 0,
        activeBridgeLabel: activeTimeBridge?.afterCardId === card.id
          ? activeTimeBridge.nextLabel
          : undefined,
      };
      const previous = homeTaskRowCacheRef.current.get(card.id);
      const resolved = previous && canReuseHomeTaskRow(previous, next)
        ? previous
        : next;
      nextCache.set(card.id, resolved);
      return resolved;
    });
    homeTaskRowCacheRef.current = nextCache;
    return rows;
  }, [
    activeTimeBridge,
    booksByTitle,
    canMutateSelectedDate,
    gratitudeDailyCountForTaskDate,
    homeCards,
    optimisticStates,
    taskContentDate,
    todayKey,
  ]);
  const openBigEvents = useCallback(() => {
    router.push('/big-events' as any);
  }, [router]);

  const resetTaskInstance = useCallback((instanceId: string, date: string) => {
    if (mutatingInstancesRef.current.has(instanceId)) return;
    mutatingInstancesRef.current.add(instanceId);
    cancelCompletionTimelineForInstance(instanceId);
    playTaskUndoFeedback();
    setOptimisticStates(prev => ({ ...prev, [instanceId]: 'pending' }));
    void resetInstance(instanceId, date)
      .catch(error => {
        console.warn('Task reset failed:', { instanceId, error });
        setOptimisticStates(prev => {
          const next = { ...prev };
          delete next[instanceId];
          return next;
        });
      })
      .finally(() => {
        mutatingInstancesRef.current.delete(instanceId);
        drainCompletionTimelineRef.current();
      });
  }, [cancelCompletionTimelineForInstance, resetInstance]);

  const completeTaskInstance = useCallback((instanceId: string, date: string) => {
    if (mutatingInstancesRef.current.has(instanceId)) return;
    mutatingInstancesRef.current.add(instanceId);
    const feedbackPlayedAt = Date.now();
    beginTaskCompletionReturn(instanceId, date);
    void playTaskCompleteFeedback();
    setOptimisticStates(prev => ({ ...prev, [instanceId]: 'done' }));
    void commitInstanceCompletion(instanceId, date)
      .then(commit => {
        const celebration = commit.challengeResult?.celebration;
        queueTaskCompletionReturnAnimation(instanceId, 0, {
          source: 'home',
          feedbackPlayedAt,
          taskDate: date,
          updated: commit.updated,
          celebration: celebration ? {
            type: 'challengeComplete',
            title: celebration.title,
            variant: celebration.variant,
            trophyCount: celebration.trophyCount,
            currentStreak: celebration.currentStreak,
            eventId: celebration.eventId,
            challengeId: celebration.challengeId,
            weekStart: celebration.weekStart,
          } : undefined,
        });
        drainCompletionTimelineRef.current();
        scheduleHomeIdle(() => {
          void reconcileCommittedCompletion(instanceId, date, commit.updated);
        });
      })
      .catch(error => {
        clearTaskCompletionReturnAnimation(instanceId);
        cancelCompletionTimelineForInstance(instanceId);
        console.warn('Task completion failed:', { instanceId, error });
        setOptimisticStates(prev => {
          const next = { ...prev };
          delete next[instanceId];
          return next;
        });
      })
      .finally(() => {
        mutatingInstancesRef.current.delete(instanceId);
        drainCompletionTimelineRef.current();
      });
  }, [cancelCompletionTimelineForInstance, commitInstanceCompletion, reconcileCommittedCompletion]);

  const skipTaskInstance = useCallback((instanceId: string, date: string) => {
    if (mutatingInstancesRef.current.has(instanceId)) return;
    mutatingInstancesRef.current.add(instanceId);
    setOptimisticStates(prev => ({ ...prev, [instanceId]: 'skipped' }));
    void skipInstance(instanceId, date)
      .catch(error => {
        console.warn('Task skip failed:', { instanceId, error });
        setOptimisticStates(prev => {
          const next = { ...prev };
          delete next[instanceId];
          return next;
        });
      })
      .finally(() => {
        mutatingInstancesRef.current.delete(instanceId);
      });
  }, [skipInstance]);

  const openCompletionFlowTask = useCallback((card: HomeCard) => {
    if (!card.instanceId) return false;
    const launch = card.launch;
    if (!launch || launch.kind === 'directCompletion') return false;

    if (launch.kind === 'gratitude') {
      router.push({
        pathname: '/gratitude-task',
        params: {
          taskInstanceId: card.instanceId,
          taskDate: taskContentDate,
        },
      } as any);
      return true;
    }

    if (launch.kind === 'journal') {
      router.push({
        pathname: launch.route,
        params: {
          date: taskContentDate,
          title: card.task.title,
          isTask: 'true',
          taskInstanceId: card.instanceId,
          taskDate: taskContentDate,
        },
      } as any);
      return true;
    }

    if (launch.kind === 'scriptureCheckpoint') {
      router.push({
        pathname: '/scripture-checkpoint',
        params: {
          title: card.task.title,
          plannedCount: String(launch.plannedCount),
          taskInstanceId: card.instanceId,
          taskDate: taskContentDate,
        },
      } as any);
      return true;
    }

    if (launch.kind === 'scriptureChallenge') {
      router.push({
        pathname: '/scripture-challenge',
        params: {
          title: card.task.title,
          taskInstanceId: card.instanceId,
          taskDate: taskContentDate,
        },
      } as any);
      return true;
    }

    if (launch.kind === 'readingSession') {
      const book = booksById.get(launch.bookId)
        ?? booksByTitle.get(card.task.title);

      router.push({
        pathname: '/reading-session',
        params: {
          bookId: book?.id ?? launch.bookId,
          title: book?.title ?? card.task.title,
          author: book?.author ?? '',
          isTask: 'true',
          taskInstanceId: card.instanceId,
          taskDate: taskContentDate,
        },
      } as any);
      return true;
    }

    if (launch.kind === 'jesusPrayer') {
      router.push({
        pathname: '/jesus-prayer',
        params: {
          title: card.task.title,
          mode: launch.mode,
          duration: String(launch.duration),
          count: String(launch.count),
          isTask: 'true',
          taskInstanceId: card.instanceId,
          taskDate: taskContentDate,
        },
      } as any);
      return true;
    }

    if (launch.kind === 'personalRule') {
      router.push({
        pathname: '/personal-rule',
        params: {
          title: card.task.title,
          prayerType: launch.prayerType,
          isTask: 'true',
          taskInstanceId: card.instanceId,
          taskDate: taskContentDate,
        },
      } as any);
      return true;
    }

    router.push({
      pathname: '/prayer',
      params: {
        category: launch.category,
        optionId: launch.optionId,
        autoStart: 'true',
        isTask: 'true',
        taskInstanceId: card.instanceId,
        taskDate: taskContentDate,
      },
    } as any);
    return true;

  }, [booksById, booksByTitle, router, taskContentDate]);

  const toggleTaskInstance = useCallback((card: HomeCard, state: TaskState) => {
    if (!card.instanceId || !canMutateSelectedDate || state === 'locked') return;
    if (mutatingInstancesRef.current.has(card.instanceId)) return;
    if (state === 'done' || state === 'skipped') {
      setTaskConfirmAction({
        mode: state === 'skipped' ? 'unskip' : 'uncheck',
        instanceId: card.instanceId,
        date: taskContentDate,
        title: card.task.title,
        warning: state === 'done' && isScriptureChallengeReadingTask(card)
          ? 'scriptureChallengeProgress'
          : undefined,
      });
      return;
    }
    // During the guided check lesson the completion flow (prayer, scripture…)
    // stays closed: the point is the check itself, and the flow would carry
    // the user away mid-tour.
    if (isCompletionFlowTask(card) && !(isGuided && guidePhase === 'checkTask')) {
      const handled = openCompletionFlowTask(card);
      if (!handled) completeTaskInstance(card.instanceId, taskContentDate);
      return;
    }
    completeTaskInstance(card.instanceId, taskContentDate);
    if (isGuided && guidePhase === 'checkTask') {
      patchSession({ phase: 'uncheckTask' });
    }
  }, [canMutateSelectedDate, completeTaskInstance, guidePhase, isGuided, openCompletionFlowTask, patchSession, taskContentDate]);

  const requestSkipTaskInstance = useCallback((card: HomeCard, state: TaskState) => {
    if (
      !card.instanceId ||
      mutatingInstancesRef.current.has(card.instanceId) ||
      !canMutateSelectedDate ||
      state === 'locked' ||
      state === 'done' ||
      state === 'skipped'
    ) return false;
    setTaskConfirmAction({
      mode: 'skip',
      instanceId: card.instanceId,
      date: taskContentDate,
      title: card.task.title,
    });
    return true;
  }, [canMutateSelectedDate, taskContentDate]);

  const openTaskAnalytics = useCallback((card: HomeCard) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setAnalyticsCard(card);
    if (isGuided && guidePhase === 'analytics') {
      patchSession({ phase: 'analyticsOpen' });
    }
  }, [guidePhase, isGuided, patchSession]);

  const confirmTaskAction = useCallback(() => {
    if (!taskConfirmAction) return;
    const action = taskConfirmAction;
    setTaskConfirmAction(null);
    if (action.mode === 'skip') {
      skipTaskInstance(action.instanceId, action.date);
      if (isGuided && guidePhase === 'skipTask') {
        patchSession({ phase: 'analytics' });
      }
      return;
    }
    resetTaskInstance(action.instanceId, action.date);
    if (isGuided && guidePhase === 'uncheckTask') {
      patchSession({ phase: 'skipTask' });
    }
  }, [guidePhase, isGuided, patchSession, resetTaskInstance, skipTaskInstance, taskConfirmAction]);

  const createQuickTask = useCallback(async (draft: TaskDraft) => {
    await createOrUpdateTask(draft, selectedDate);
  }, [createOrUpdateTask, selectedDate]);

  const confirmSkipAllDay = useCallback(() => {
    setSkipDayConfirmOpen(false);
    const instanceIds = skippableCards.flatMap(card => card.instanceId ? [card.instanceId] : []);
    if (instanceIds.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    for (const instanceId of instanceIds) {
      mutatingInstancesRef.current.add(instanceId);
    }

    // A previous uncheck can still have a local `pending` override while its
    // refresh is settling. Replace every targeted override before persisting so
    // the task cards and the backend-driven daily progress stay in sync.
    setOptimisticStates(prev => {
      const next = { ...prev };
      for (const instanceId of instanceIds) next[instanceId] = 'skipped';
      return next;
    });

    void skipInstances(instanceIds, taskContentDate)
      .catch(error => {
        console.warn('Skip all day failed:', { instanceIds, error });
        setOptimisticStates(prev => {
          let changed = false;
          const next = { ...prev };
          for (const instanceId of instanceIds) {
            if (next[instanceId] !== 'skipped') continue;
            delete next[instanceId];
            changed = true;
          }
          return changed ? next : prev;
        });
      })
      .finally(() => {
        for (const instanceId of instanceIds) {
          mutatingInstancesRef.current.delete(instanceId);
        }
      });
  }, [skippableCards, skipInstances, taskContentDate]);

  const guidedFirstCard = homeCards.find(card => card.instanceId && card.task.state !== 'locked') ?? homeCards[0];

  // ─── Guided tour choreography ──────────────────────────────────────────────
  // Every phase first glides its section into a deliberate position (origin
  // for the opening, top edge for the task lessons, center for the closing
  // sections), waits for the scroll to settle, re-measures the target, and
  // only then presents — so the spotlight always lands on fresh coordinates.
  const {
    clear: clearGuideTimers,
    finish: finishGuideScroll,
    onScroll: handleGuideScroll,
    schedule: scheduleGuide,
    scrollYRef: guideScrollY,
    stageTarget: stageGuideTarget,
  } = useGuidedScrollTransition({
    scrollRef: homeScrollRef,
    screenHeight: guideScreenHeight,
    setPresentation,
  });

  const handleHomeScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scheduleHomeViewportUpdate(event.nativeEvent.contentOffset.y);
    if (isGuided) handleGuideScroll(event);
  }, [handleGuideScroll, isGuided, scheduleHomeViewportUpdate]);

  const stageGuidePhase = useCallback((
    binding: ReturnType<typeof useGuideTarget> | null,
    position: 'origin' | 'topEdge' | 'lesson' | 'middle',
    present: () => void,
  ) => {
    const targetPosition = position === 'origin'
      ? 'origin' as const
      : (targetHeight: number) => (
        position === 'topEdge'
          ? insets.top + 62
          : position === 'lesson'
            ? insets.top + 124
            : Math.max(insets.top + 90, guideScreenHeight * 0.5 - targetHeight / 2)
      );
    stageGuideTarget(binding, targetPosition, present);
  }, [guideScreenHeight, insets.top, stageGuideTarget]);

  useEffect(() => {
    if (!isGuided) return;

    const hasBigEventTarget = bigEvents.length > 0;
    const tourSteps = hasBigEventTarget
      ? ['welcome', 'bigEvents', 'tasks', 'checkTask', 'uncheckTask', 'skipTask', 'analytics', 'monthlyGoals', 'myRoutine']
      : ['welcome', 'tasks', 'checkTask', 'uncheckTask', 'skipTask', 'analytics', 'monthlyGoals', 'myRoutine'];
    const progressFor = (phase: string) => {
      const index = tourSteps.indexOf(phase);
      return index >= 0 ? { current: index + 1, total: tourSteps.length } : undefined;
    };

    clearGuideTimers();

    if (guidePhase === 'intro') {
      patchSession({ phase: 'welcome' });
      return;
    }

    // A breath before anything is spotlit: the whole Home, barely veiled.
    if (guidePhase === 'welcome') {
      if (guideScrollY.current > 4) {
        homeScrollRef.current?.scrollTo({ y: 0, animated: true });
      }
      scheduleGuide(() => {
        setPresentation({
          key: 'home-tour-welcome',
          placement: 'bottom',
          lightScrim: true,
          eyebrow: 'HOME TOUR',
          progress: progressFor('welcome'),
          message: 'Welcome to your Home screen. Your day, goals, and priorities stay together here to keep you organized.',
          highlights: ['Home screen', 'keep you organized'],
          ctaLabel: 'Look around',
          onCta: () => patchSession({ phase: hasBigEventTarget ? 'bigEvents' : 'tasks' }),
        });
      }, 380);
      return;
    }

    if (guidePhase === 'bigEvents') {
      stageGuidePhase(bigEventsTarget, 'origin', () => {
        setPresentation({
          key: 'home-tour-big-events',
          targetId: HOME_GUIDE_TARGETS.bigEvents,
          cutoutPadding: 8,
          placement: 'below',
          allowTargetInteraction: false,
          eyebrow: 'HOME TOUR',
          progress: progressFor('bigEvents'),
          message: 'Your Big Events stay at the top of Home, with a countdown showing exactly how many days remain — so nothing important catches you by surprise.',
          highlights: ['Big Events', 'how many days remain'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'tasks' }),
        });
      });
      return;
    }

    if (guidePhase === 'tasks') {
      stageGuidePhase(tasksTarget, 'topEdge', () => {
        setPresentation({
          key: 'home-tour-tasks',
          targetId: HOME_GUIDE_TARGETS.tasks,
          cutoutPadding: 8,
          placement: 'below',
          allowTargetInteraction: false,
          eyebrow: 'HOME TOUR',
          progress: progressFor('tasks'),
          message: 'Here are the tasks you planned for today.',
          highlights: ['planned for today'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'checkTask' }),
        });
      });
      return;
    }

    // Gesture lessons carry no Continue button when a task card is available:
    // the phase only advances once the user performs the real gesture.
    if (guidePhase === 'checkTask') {
      stageGuidePhase(guidedFirstCard ? firstTaskTarget : tasksTarget, 'lesson', () => {
        setPresentation({
          key: 'home-tour-check-task',
          targetId: guidedFirstCard ? HOME_GUIDE_TARGETS.firstTask : HOME_GUIDE_TARGETS.tasks,
          cutoutPadding: 8,
          placement: 'below',
          allowTargetInteraction: true,
          eyebrow: 'HOME TOUR',
          progress: progressFor('checkTask'),
          message: 'Completing a task is one quiet tap.',
          highlights: ['one quiet tap'],
          action: guidedFirstCard ? 'Tap the check circle on the task' : undefined,
          hint: guidedFirstCard ? 'tap' : undefined,
          hintAnchor: 'left',
          ctaLabel: guidedFirstCard ? undefined : 'Continue',
          onCta: guidedFirstCard ? undefined : () => patchSession({ phase: 'monthlyGoals' }),
        });
      });
      return;
    }

    if (guidePhase === 'uncheckTask') {
      stageGuidePhase(guidedFirstCard ? firstTaskTarget : tasksTarget, 'lesson', () => {
        setPresentation({
          key: 'home-tour-uncheck-task',
          targetId: guidedFirstCard ? HOME_GUIDE_TARGETS.firstTask : HOME_GUIDE_TARGETS.tasks,
          cutoutPadding: 8,
          placement: 'below',
          allowTargetInteraction: true,
          eyebrow: 'HOME TOUR',
          progress: progressFor('uncheckTask'),
          message: 'Checked by mistake? Press it again — Anasta asks first, so progress is never lost by accident.',
          highlights: ['asks first'],
          action: guidedFirstCard ? 'Tap the check again, then confirm' : undefined,
          hint: guidedFirstCard ? 'tap' : undefined,
          hintAnchor: 'left',
          ctaLabel: guidedFirstCard ? undefined : 'Continue',
          onCta: guidedFirstCard ? undefined : () => patchSession({ phase: 'skipTask' }),
        });
      });
      return;
    }

    if (guidePhase === 'skipTask') {
      stageGuidePhase(guidedFirstCard ? firstTaskTarget : tasksTarget, 'lesson', () => {
        setPresentation({
          key: 'home-tour-skip-task',
          targetId: guidedFirstCard ? HOME_GUIDE_TARGETS.firstTask : HOME_GUIDE_TARGETS.tasks,
          cutoutPadding: 8,
          placement: 'below',
          allowTargetInteraction: true,
          eyebrow: 'HOME TOUR',
          progress: progressFor('skipTask'),
          message: 'A day does not always go as planned. A skipped task stays in your rhythm — just not for today.',
          highlights: ['stays in your rhythm'],
          action: guidedFirstCard ? 'Swipe the task to the left' : undefined,
          hint: guidedFirstCard ? 'swipe-left' : undefined,
          ctaLabel: guidedFirstCard ? undefined : 'Continue',
          onCta: guidedFirstCard ? undefined : () => patchSession({ phase: 'analytics' }),
        });
      });
      return;
    }

    if (guidePhase === 'analytics') {
      stageGuidePhase(guidedFirstCard ? firstTaskTarget : tasksTarget, 'lesson', () => {
        setPresentation({
          key: 'home-tour-analytics',
          targetId: guidedFirstCard ? HOME_GUIDE_TARGETS.firstTask : HOME_GUIDE_TARGETS.tasks,
          cutoutPadding: 8,
          placement: 'below',
          allowTargetInteraction: true,
          eyebrow: 'HOME TOUR',
          progress: progressFor('analytics'),
          message: 'Every task has its own analytics. See when you completed it, skipped it, or missed it — and how your consistency changes over time.',
          highlights: ['its own analytics', 'completed it', 'skipped it', 'missed it'],
          action: guidedFirstCard ? 'Press and hold the task' : undefined,
          hint: guidedFirstCard ? 'long-press' : undefined,
          hintAnchor: 'right',
          ctaLabel: guidedFirstCard ? undefined : 'Continue',
          onCta: guidedFirstCard ? undefined : () => patchSession({ phase: 'monthlyGoals' }),
        });
      });
      return;
    }

    // While analytics is open the overlay steps aside entirely — the sheet is
    // the user's to explore, and finding the X themselves is part of learning
    // it. Closing advances the tour to Monthly Goals.
    if (guidePhase === 'analyticsOpen') {
      setPresentation(null);
      return;
    }

    if (guidePhase === 'monthlyGoals') {
      stageGuidePhase(monthlyGoalsTarget, 'middle', () => {
        setPresentation({
          key: 'home-tour-monthly-goals',
          targetId: HOME_GUIDE_TARGETS.monthlyGoals,
          cutoutPadding: 8,
          placement: 'above',
          allowTargetInteraction: false,
          eyebrow: 'HOME TOUR',
          progress: progressFor('monthlyGoals'),
          message: 'Here are your Monthly Goals. They keep what you want to achieve this month in sight.',
          highlights: ['your Monthly Goals'],
          ctaLabel: 'Continue',
          onCta: () => patchSession({ phase: 'myRoutine' }),
        });
      });
      return;
    }

    if (guidePhase === 'myRoutine') {
      stageGuidePhase(myRoutineTarget, 'middle', () => {
        setPresentation({
          key: 'home-tour-my-routine',
          targetId: HOME_GUIDE_TARGETS.myRoutine,
          cutoutPadding: 8,
          placement: 'above',
          allowTargetInteraction: true,
          eyebrow: 'HOME TOUR',
          progress: progressFor('myRoutine'),
          message: 'And this is My Routine — the room where your whole weekly plan is shaped.',
          highlights: ['My Routine'],
          action: 'Tap My Routine to open it',
          hint: 'tap',
        });
      });
      return;
    }

    setPresentation(null);
  }, [
    bigEvents.length,
    bigEventsTarget,
    clearGuideTimers,
    firstTaskTarget,
    guidePhase,
    guideScrollY,
    guidedFirstCard,
    isGuided,
    monthlyGoalsTarget,
    myRoutineTarget,
    patchSession,
    scheduleGuide,
    setPresentation,
    stageGuidePhase,
    tasksTarget,
  ]);

  // Clears any pending stage timers whenever the phase moves on (or the tour
  // unmounts) so a stale presentation can never fire over a newer phase.
  useEffect(() => clearGuideTimers, [clearGuideTimers, guidePhase]);

  return (
    <View style={s.homeRoot}>
      <ScrollView
        ref={homeScrollRef}
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={handleHomeScroll}
        onMomentumScrollEnd={isGuided ? finishGuideScroll : undefined}
        scrollEventThrottle={isGuided ? 16 : 32}
      >
        <MemoizedHomeHeader selectedDate={selectedDate} todayKey={todayKey} onSelectDate={selectDate} />

      <View {...bigEventsTarget}>
        <MemoizedBigEventBanner
          events={bigEvents}
          selectedDate={selectedDate}
          onPress={openBigEvents}
        />
      </View>

      <View {...tasksTarget} style={s.tasksWrap}>
        <View style={s.tasksHead}>
          <View>
            <Text style={s.tasksTitle}>{taskSectionTitle}</Text>
            <Text style={s.tasksSub}>{statusLine}</Text>
          </View>
          <View style={s.progressWrap}>
            <DayTally outcomes={taskOutcomes} allSkipped={progressMode === 'all-skipped'} />
          </View>
        </View>

        {isTaskContentLoading && (
          <TaskLoadingCard />
        )}

        {!isTaskContentLoading && !hasBackendTasks && taskBackendReady && (
          <TouchableOpacity activeOpacity={0.84} onPress={() => router.push('/my-routine')} style={s.emptyTaskCard}>
            <Text style={s.emptyTaskTitle}>No tasks yet</Text>
            <Text style={s.emptyTaskBody}>Create your first routine, prayer, reading, habit, or challenge task.</Text>
          </TouchableOpacity>
        )}

        {!isTaskContentLoading && hasBackendTasks && taskBackendReady && homeCards.length === 0 && (
          <View style={s.emptyTaskCard}>
            <View style={s.emptyTaskText}>
              <Text style={s.emptyTaskEyebrow}>{noTasksCopy.eyebrow}</Text>
              <Text style={s.emptyTaskTitle}>{noTasksCopy.title}</Text>
              <Text style={s.emptyTaskBody}>{noTasksCopy.body}</Text>
            </View>
            <View style={s.emptyTaskArt}>
              <View style={s.emptyTaskArtGlow} />
              <Calendar s={23} c="#C5A059" />
              <View style={s.emptyTaskArtDot} />
            </View>
          </View>
        )}

        {!isTaskContentLoading && (
          <TaskContentAppear key={taskContentDate}>
            <View style={s.cardsList}>
              {homeTaskRows.map((model, index) => (
                <HomeTaskRow
                  key={model.card.id}
                  model={model}
                  targetProps={index === 0 ? firstTaskTarget : undefined}
                  onSkip={requestSkipTaskInstance}
                  onToggle={toggleTaskInstance}
                  onAnalytics={openTaskAnalytics}
                />
              ))}
            </View>
          </TaskContentAppear>
        )}

        {!isTaskContentLoading && hasBackendTasks && taskBackendReady && (
          <View style={s.dayActionsRow}>
            <TouchableOpacity
              activeOpacity={0.82}
              style={s.dayActionBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setNotificationsOpen(true);
              }}
            >
              <Bell s={14} c={C.gold} w={2.2} />
              <Text style={s.dayActionTxt}>NOTIFICATIONS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={skipDayDisabled ? 1 : 0.82}
              disabled={skipDayDisabled}
              style={[s.dayActionBtn, s.dayActionBtnSkip, skipDayDisabled && s.dayActionBtnDisabled]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setSkipDayConfirmOpen(true);
              }}
            >
              <Skip s={14} c={skipDayDisabled ? '#D6D3D1' : C.textSecondary} w={2.2} />
              <Text style={[s.dayActionTxt, s.dayActionTxtSkip, skipDayDisabled && s.dayActionTxtDisabled]}>SKIP DAY</Text>
            </TouchableOpacity>
          </View>
        )}
        <TouchableOpacity activeOpacity={0.82} style={{ marginTop: 8 }} onPress={() => setQuickTaskSheetOpen(true)}>
          <LinearGradient
            colors={['#FFFFFF', '#F0FDF4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.addBtn}
          >
            <Plus s={16} c="#1C1917" w={2.5} />
            <Text style={s.addBtnTxt}>ADD QUICK TASK</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          {...myRoutineTarget}
          activeOpacity={0.82}
          style={{ marginTop: 8 }}
          onPress={() => {
            // During the tour, opening My Routine IS the lesson — the tap
            // hands over to the guided routine stage instead of navigating.
            if (isGuided && guidePhase === 'myRoutine') {
              onGuidedComplete?.();
              return;
            }
            router.push('/my-routine');
          }}
        >
          <LinearGradient
            colors={['#FFFFFF', '#FDF3D8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.myRoutineBtn}
          >
            <View pointerEvents="none" style={s.myRoutineWatermark}>
              <Settings s={120} c="#C5A059" w={1} />
            </View>
            <View style={s.myRoutineContent}>
              <Text style={s.myRoutineLabel}>Foundation</Text>
              <Text style={s.myRoutineTitle}>My Routine</Text>
              <Text style={s.myRoutineSub}>Establish your rhythm</Text>
            </View>
            <View style={s.myRoutineArrow}>
              <ArrowUpRight s={18} c="#FFFFFF" w={2.5} />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <View {...monthlyGoalsTarget}>
          <MemoizedMonthlyGoalsHomeCard />
        </View>
      </View>

        <HomePerformanceFooter
          ref={homeFooterRef}
          viewportHeight={guideScreenHeight}
        />
      </ScrollView>
      <QuickTaskSheet
        visible={quickTaskSheetOpen}
        defaultDate={todayKey}
        onClose={() => setQuickTaskSheetOpen(false)}
        onTaskDraft={createQuickTask}
      />
      <TaskAnalyticsSheet
        visible={!!analyticsCard}
        taskId={analyticsCard?.taskId}
        taskTitle={analyticsCard?.task.title ?? ''}
        taskSubtitle={analyticsCard?.task.subtitle}
        onClose={() => {
          setAnalyticsCard(null);
          if (isGuided && guidePhase === 'analyticsOpen') {
            // Let the sheet finish its dismissal before the tour scrolls on —
            // otherwise the background moves behind the closing modal.
            scheduleGuide(() => {
              patchSession({ phase: 'monthlyGoals' });
            }, 340);
          }
        }}
      />
      <NotificationsSheet
        visible={notificationsOpen}
        selectedDate={selectedDate}
        onClose={() => setNotificationsOpen(false)}
      />
      <ChallengeCompletionHomeModal
        visible={!!challengeCompletionModal}
        title={challengeCompletionModal?.title ?? 'Challenge Complete'}
        variant={challengeCompletionModal?.variant}
        trophyCount={challengeCompletionModal?.trophyCount}
        currentStreak={challengeCompletionModal?.currentStreak}
        onExited={finishChallengeCompletionModal}
      />
      <ConfirmModal
        visible={skipDayConfirmOpen}
        icon={<Skip s={21} c="#9A3412" w={2.25} />}
        iconBg="#FFF1E8"
        title="Skip all day?"
        body={`Skip ${skippableCards.length} unfinished ${skippableCards.length === 1 ? 'task' : 'tasks'} for the day?`}
        confirmLabel="SKIP DAY"
        confirmColor="#1C1917"
        onCancel={() => setSkipDayConfirmOpen(false)}
        onConfirm={confirmSkipAllDay}
      />
      <ConfirmModal
        visible={!!taskConfirmAction}
        icon={<TaskConfirmGlyph mode={taskConfirmAction?.mode ?? 'uncheck'} warning={taskConfirmAction?.warning} />}
        iconBg={getTaskConfirmIconBg(taskConfirmAction)}
        title={taskConfirmAction?.mode === 'skip'
          ? 'Skip this task?'
          : taskConfirmAction?.mode === 'unskip'
            ? 'Unskip this task?'
            : taskConfirmAction?.warning === 'scriptureChallengeProgress'
              ? 'Delete reading progress?'
            : 'Uncheck this task?'}
        body={getTaskConfirmBody(taskConfirmAction)}
        subject={taskConfirmAction?.title}
        confirmLabel={taskConfirmAction?.mode === 'skip'
          ? 'SKIP'
          : taskConfirmAction?.mode === 'unskip'
            ? 'UNSKIP'
            : 'UNCHECK'}
        confirmColor={getTaskConfirmColor(taskConfirmAction)}
        onCancel={() => setTaskConfirmAction(null)}
        onConfirm={confirmTaskAction}
      />
    </View>
  );
}

function MonthlyGoalsHomeCard() {
  const router = useRouter();
  const { goalsByMonth, toggleGoal } = useMonthlyGoals();
  const today = useMemo(() => new Date(), []);
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = today.toLocaleDateString('en-US', { month: 'long' });
  const [uncheckConfirm, setUncheckConfirm] = useState<{ id: string; text: string } | null>(null);
  const [celebratingGoalIds, setCelebratingGoalIds] = useState<string[]>([]);
  const completionTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const allGoals = useMemo(() => goalsByMonth[monthKey] ?? [], [goalsByMonth, monthKey]);
  // Stable order: respect sortOrder, then creation time. Completed goals stay
  // in place — checking should not reorder the list.
  const sorted = useMemo(() => {
    return sortMonthlyGoals(allGoals);
  }, [allGoals]);

  const total = allGoals.length;
  const done = allGoals.filter(g => g.isCompleted).length;
  const active = total - done;
  const allDone = total > 0 && done === total;

  // Cap visible to keep home compact. If more, show "+N more →".
  const MAX_VISIBLE = 4;
  const visible = sorted.slice(0, MAX_VISIBLE);
  const hiddenCount = Math.max(0, sorted.length - MAX_VISIBLE);

  useEffect(() => () => {
    Object.values(completionTimersRef.current).forEach(clearTimeout);
  }, []);

  const completeAfterCelebration = (id: string) => {
    if (completionTimersRef.current[id]) return;
    setCelebratingGoalIds(current => current.includes(id) ? current : [...current, id]);
    completionTimersRef.current[id] = setTimeout(() => {
      delete completionTimersRef.current[id];
      void toggleGoal(id).finally(() => {
        setCelebratingGoalIds(current => current.filter(goalId => goalId !== id));
      });
    }, MONTHLY_GOAL_CELEBRATION_MS);
  };

  const onToggle = (goal: { id: string; text: string; isCompleted: boolean }) => {
    if (goal.isCompleted) {
      setUncheckConfirm({ id: goal.id, text: goal.text });
      return;
    }
    fireGoalToggleHaptic(true);
    completeAfterCelebration(goal.id);
  };

  const confirmUncheck = () => {
    if (!uncheckConfirm) return;
    fireGoalToggleHaptic(false);
    toggleGoal(uncheckConfirm.id);
    setUncheckConfirm(null);
  };

  const openManage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/monthly-goals');
  };

  if (total === 0) {
    return (
      <View style={s.mgSection}>
        <View style={s.mgHead}>
          <Text style={s.mgHeadTitle}>Goals for {monthLabel}</Text>
          <TouchableOpacity onPress={openManage} activeOpacity={0.84} style={s.mgSetPill}>
            <Plus s={11} c="#FFFFFF" w={2.6} />
            <Text style={s.mgSetPillText}>SET</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={openManage} activeOpacity={0.84} style={s.mgEmpty}>
          <Text style={s.mgEmptyText}>No intentions yet for this month</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.mgSection}>
      <View style={s.mgHead}>
        <Text style={s.mgHeadTitle}>Goals for {monthLabel}</Text>
        <Text style={s.mgHeadSub}>
          {allDone ? 'ALL DONE' : `${active} active`}
        </Text>
      </View>
      {visible.map((goal, index) => (
        (() => {
          const isCelebrating = celebratingGoalIds.includes(goal.id);
          const displayDone = goal.isCompleted || isCelebrating;
          return (
        <Reanimated.View
          key={goal.id}
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          layout={LinearTransition.duration(340).easing(Easing.out(Easing.cubic))}
        >
        <View pointerEvents={isCelebrating ? 'none' : 'auto'} style={[s.mgRow, displayDone && s.mgRowDone]}>
          <View pointerEvents="none" style={[s.mgRowHighlight, displayDone && s.mgRowHighlightDone]} />
          {displayDone && <View pointerEvents="none" style={s.mgDoneSpine} />}
          <AnimatedSealCheck
            done={displayDone}
            numeral={toRoman(index)}
            onPress={() => onToggle(goal)}
            size={30}
          />
          <AnimatedStrikeText
            text={goal.text}
            done={displayDone}
            textStyle={s.mgRowText}
          />
        </View>
        <GoalCompletionConfetti done={displayDone} />
        </Reanimated.View>
          );
        })()
      ))}
      <TouchableOpacity onPress={openManage} activeOpacity={0.84} style={s.mgFooter}>
        <Text style={s.mgFooterText}>
          {hiddenCount > 0 ? `+${hiddenCount} more · MANAGE GOALS` : 'MANAGE GOALS'}
        </Text>
        <ChevronRight s={13} c="#A8853C" />
      </TouchableOpacity>
      <ConfirmModal
        visible={!!uncheckConfirm}
        icon={<TaskConfirmGlyph mode="uncheck" />}
        iconBg="#FFF1F2"
        title="Uncheck this goal?"
        body="Do you want to mark this goal as incomplete?"
        subject={uncheckConfirm?.text}
        confirmLabel="UNCHECK"
        confirmColor={C.red}
        onCancel={() => setUncheckConfirm(null)}
        onConfirm={confirmUncheck}
      />
    </View>
  );
}

const MemoizedMonthlyGoalsHomeCard = React.memo(MonthlyGoalsHomeCard);

function LongPressGate({
  enabled,
  onActivate,
  children,
}: {
  enabled: boolean;
  onActivate: () => void;
  children: React.ReactNode;
}) {
  const gesture = useMemo(
    () =>
      Gesture.LongPress()
        .enabled(enabled)
        .minDuration(600)
        .onStart(() => {
          'worklet';
          runOnJS(onActivate)();
        }),
    [enabled, onActivate],
  );

  if (!enabled) return <View>{children}</View>;
  return (
    <GestureDetector gesture={gesture}>
      <View>{children}</View>
    </GestureDetector>
  );
}

function StatusAnimatedTaskRow({
  state,
  children,
}: {
  state: TaskState;
  children: React.ReactNode;
}) {
  // Keep the card and its text at a native 1:1 scale. Scaling this wrapper
  // made iOS resample the entire gradient/text subtree and the softened frame
  // was especially visible while a native task route was opening or closing.
  // The check, strike and flourish carry the completion motion instead.
  const isInactive = state === 'done' || state === 'skipped';
  const tintOpacity = useSharedValue(isInactive ? 1 : 0);
  const previousState = useRef(state);

  useEffect(() => {
    const stateChanged = previousState.current !== state;
    const becameInactive = stateChanged && isInactive;
    const becameActive = stateChanged && !isInactive;
    previousState.current = state;

    if (!stateChanged) {
      tintOpacity.value = isInactive ? 1 : 0;
      return;
    }

    if (becameInactive) {
      // For 'done' we delay the dim until the celebratory burst + strike
      // finish (~1160ms). For 'skipped' there's no celebration, so dim now.
      const dimDelay = state === 'done' ? 1160 : 0;
      tintOpacity.value = withDelay(dimDelay, withTiming(1, { duration: 280 }));
    } else if (becameActive) {
      tintOpacity.value = withTiming(0, { duration: 115 });
    } else {
      tintOpacity.value = withTiming(isInactive ? 1 : 0, { duration: 150 });
    }
  }, [isInactive, state, tintOpacity]);

  const tintStyle = useAnimatedStyle(() => ({
    opacity: tintOpacity.value,
  }));

  return (
    <View>
      {children}
      <Reanimated.View pointerEvents="none" style={[s.settledTaskTint, tintStyle]} />
    </View>
  );
}

function DateInactiveTaskShell({
  future,
  children,
}: {
  future: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={s.inactiveDateShell}>
      <View style={[s.inactiveDateContent, future && s.futureDateContent]}>
        {children}
      </View>
    </View>
  );
}

function SwipeTaskRow({
  children,
  disabled,
  onSkip,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onSkip: () => boolean;
}) {
  const translateX = useSharedValue(0);
  const revealProgress = useSharedValue(0);
  const committed = useSharedValue(0);
  const skippingRef = useRef(false);

  const finishSkip = useCallback(() => {
    if (skippingRef.current) return;
    skippingRef.current = true;
    onSkip();
    setTimeout(() => {
      skippingRef.current = false;
    }, 260);
  }, [onSkip]);

  useEffect(() => {
    if (!disabled) return;
    translateX.value = withTiming(0, { duration: 140 });
    revealProgress.value = withTiming(0, { duration: 120 });
    committed.value = 0;
  }, [committed, disabled, revealProgress, translateX]);

  const panGesture = useMemo(() => Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-8, 8])
    .failOffsetY([-18, 18])
    .onBegin(() => {
      // Do not scale the row on touch-down. onBegin also runs for ordinary
      // check taps which never become a pan, so a scale here blurred the card
      // just before router.push captured the outgoing Home frame.
      committed.value = 0;
    })
    .onUpdate(event => {
      if (committed.value) return;
      const next = Math.max(-92, Math.min(0, event.translationX));
      translateX.value = next;
      revealProgress.value = Math.min(1, Math.abs(next) / 68);
    })
    .onEnd(event => {
      const shouldSkip = event.translationX < -54 || event.velocityX < -520;

      if (!shouldSkip) {
        translateX.value = withSpring(0, {
          damping: 22,
          stiffness: 260,
          mass: 0.7,
        });
        revealProgress.value = withTiming(0, { duration: 130 });
        return;
      }

      committed.value = 1;
      runOnJS(finishSkip)();
      translateX.value = withTiming(-92, { duration: 70 }, () => {
        translateX.value = withSpring(0, {
          damping: 24,
          stiffness: 285,
          mass: 0.68,
        });
      });
      revealProgress.value = withTiming(1, { duration: 70 }, () => {
        revealProgress.value = withTiming(0, { duration: 150 });
      });
    })
    .onFinalize(() => {
      if (!committed.value) {
        translateX.value = withSpring(0, {
          damping: 22,
          stiffness: 260,
          mass: 0.7,
        });
        revealProgress.value = withTiming(0, { duration: 130 });
      }
    }), [committed, disabled, finishSkip, revealProgress, translateX]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: revealProgress.value,
    transform: [{ scale: 0.96 + revealProgress.value * 0.04 }],
  }));

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={s.swipeWrap}>
      {!disabled && (
        <Reanimated.View pointerEvents="none" style={[s.skipReveal, revealStyle]}>
          <Text style={s.skipRevealText}>SKIP</Text>
        </Reanimated.View>
      )}
      <GestureDetector gesture={panGesture}>
        <Reanimated.View style={rowStyle}>
          {children}
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

const HomeTaskRow = React.memo(function HomeTaskRow({
  model,
  targetProps,
  onSkip,
  onToggle,
  onAnalytics,
}: {
  model: HomeTaskRowModel;
  targetProps?: ReturnType<typeof useGuideTarget>;
  onSkip: (card: HomeCard, state: TaskState) => boolean;
  onToggle: (card: HomeCard, state: TaskState) => void;
  onAnalytics: (card: HomeCard) => void;
}) {
  const {
    card,
    displayTask,
    dateInactive,
    futureInactive,
    canToggle,
    canSkip,
    canShowAnalytics,
    book,
    blessingsToday,
    activeBridgeLabel,
  } = model;
  const handleSkip = useCallback(
    () => onSkip(card, displayTask.state),
    [card, displayTask.state, onSkip],
  );
  const handleToggle = useCallback(
    () => onToggle(card, displayTask.state),
    [card, displayTask.state, onToggle],
  );
  const handleAnalytics = useCallback(
    () => onAnalytics(card),
    [card, onAnalytics],
  );
  const content = (
    <HomeTaskCardVisual
      backend={!!card.backend}
      cardId={card.id}
      task={displayTask}
      streak={card.streak}
      book={book}
      blessingsToday={blessingsToday}
    />
  );
  const datedContent = dateInactive
    ? <DateInactiveTaskShell future={futureInactive}>{content}</DateInactiveTaskShell>
    : content;

  return (
    <View {...targetProps}>
      <SwipeTaskRow disabled={!canSkip} onSkip={handleSkip}>
        <StatusAnimatedTaskRow state={displayTask.state}>
          <View style={s.taskTouchableWrap}>
            <LongPressGate enabled={canShowAnalytics} onActivate={handleAnalytics}>
              {datedContent}
            </LongPressGate>
            {canToggle && (
              <CompletionFlourish
                done={displayTask.state === 'done'}
                color="#C5A059"
                layerStyle={s.checkFlourishLayer}
                unmountWhenSettled
              />
            )}
            {canToggle && (
              <TouchableOpacity
                activeOpacity={0.72}
                onPress={handleToggle}
                style={s.checkHitArea}
              />
            )}
          </View>
        </StatusAnimatedTaskRow>
      </SwipeTaskRow>
      {activeBridgeLabel && <ActiveTimeBridge nextLabel={activeBridgeLabel} />}
    </View>
  );
});



function HomeReadingCard({
  task,
  book,
}: {
  task: TaskData;
  book?: { author?: string; category?: string; totalMinutes?: number; sessions?: number };
}) {
  const isDone = task.state === 'done';
  const isLocked = task.state === 'locked';

  return (
    <LinearGradient
      colors={['#F8F6FE', '#FDFCFF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[custom.readingCard, { opacity: isLocked ? 0.7 : 1 }]}
    >
      {/* Checker — indigo ring */}
      <AnimatedTaskCheckTransition
        done={isDone}
        size={36}
        accent="#6D28D9"
        pending={(
          <View style={custom.readingCheck}>
            <CircleIcon s={18} c="rgba(109,40,217,0.30)" w={2} />
          </View>
        )}
      />

      {/* Content */}
      <View style={custom.readingMid}>
        <Text style={custom.readingTitle} numberOfLines={1} ellipsizeMode="tail">{task.title}</Text>
        <View style={custom.readingMetaRow}>
          {task.time ? (
            <>
              <Clock s={9} c="#7C6FB0" />
              <Text style={custom.readingMeta}>{task.time}</Text>
              <Text style={custom.readingDot}>•</Text>
            </>
          ) : null}
          <Text style={[custom.readingMeta, custom.metaText]} numberOfLines={1} ellipsizeMode="tail">
            {book?.author ?? task.subtitle ?? 'Reading Task'}
          </Text>
        </View>
      </View>

      {/* Book icon badge — indigo/purple */}
      <View style={custom.readingIconBadge}>
        <Book s={16} c="#6D28D9" />
      </View>
    </LinearGradient>
  );
}

function HomeGratitudeCard({
  task,
  blessingsToday,
}: {
  task: TaskData;
  blessingsToday: number;
}) {
  const isDone = task.state === 'done';
  const isLocked = task.state === 'locked';

  return (
    <LinearGradient
      colors={['#FFEDF2', '#FFF6F8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[custom.gratitudeCard, { opacity: isLocked ? 0.72 : 1 }]}
    >
      <View style={custom.gratitudeRow}>
        {/* Standard task checker, rose-accented */}
        <AnimatedTaskCheckTransition
          done={isDone}
          size={36}
          accent="#E11D48"
          pending={(
            <View style={custom.gratitudeCheck}>
              <CircleIcon s={19} c="#F472B6" w={2} />
            </View>
          )}
        />

        <View style={custom.gratitudeMid}>
          <Text style={custom.gratitudeTitle} numberOfLines={1} ellipsizeMode="tail">{task.title}</Text>
          <View style={custom.gratitudeMetaRow}>
            {task.time ? (
              <>
                <Clock s={9} c="#E11D48" />
                <Text style={custom.gratitudeMeta}>{task.time}</Text>
                <Text style={custom.gratitudeDot}>•</Text>
              </>
            ) : null}
            <Text style={[custom.gratitudeMeta, custom.metaText]} numberOfLines={1} ellipsizeMode="tail">
              {isDone
                ? (blessingsToday > 0 ? `${blessingsToday} blessings` : 'Completed')
                : task.subtitle || 'Daily Gratitude'}
            </Text>
          </View>
        </View>

        {/* Small heart type badge */}
        <View style={custom.gratitudeTypeBox}>
          <Heart s={16} c="#E11D48" />
        </View>
      </View>
    </LinearGradient>
  );
}

const HomeTaskCardVisual = React.memo(function HomeTaskCardVisual({
  backend,
  cardId,
  task,
  streak,
  book,
  blessingsToday,
}: {
  backend: boolean;
  cardId: string;
  task: TaskData;
  streak?: number;
  book?: { author?: string; category?: string; totalMinutes?: number; sessions?: number };
  blessingsToday: number;
}) {
  if (backend) return <AnyTaskCard task={task} streak={streak} />;
  if (cardId === 'reading-task') return <HomeReadingCard task={task} book={book} />;
  if (cardId === 'gratitude-task') {
    return <HomeGratitudeCard task={task} blessingsToday={blessingsToday} />;
  }
  return <AnyTaskCard task={task} streak={streak} />;
});

const s = StyleSheet.create({
  homeRoot: {
    flex: 1,
    position: 'relative',
    backgroundColor: C.bg,
  },
  tasksWrap: { paddingHorizontal: 20, paddingTop: 12 },
  tasksHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  tasksTitle: { fontFamily: F.serifMedium, fontSize: 22, color: C.text },
  tasksSub: { fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 4 },
  // The tally is 7pt where the old bar was 3pt; this keeps its centre on the
  // line the bar already sat on, against the title.
  progressWrap: { marginTop: 6 },
  loadingCard: {
    minHeight: 58,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1EDE5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardsList: { marginTop: 14 },
  timeBridgeWrap: {
    height: 30,
    marginTop: -4,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeBridgeSpine: {
    width: 60,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBridgeSpineLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(197,160,89,0.34)',
    shadowColor: '#C5A059',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  timeBridgeDotOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C5A059',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 1,
  },
  timeBridgeDotHalo: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(197,160,89,0.10)',
  },
  timeBridgeDotInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#B88B36',
    opacity: 0.88,
  },
  timeBridgeContent: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 4,
    paddingRight: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeBridgeRule: {
    flex: 1,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(197,160,89,0.16)',
  },
  timeBridgePill: {
    minHeight: 27,
    paddingHorizontal: 8,
    paddingRight: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#C5A059',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 7,
    elevation: 2,
    overflow: 'hidden',
  },
  timeBridgePillGlow: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 2,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  timeBridgeIconBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBridgeNextText: {
    fontFamily: F.sansBold,
    fontSize: 10.75,
    letterSpacing: 0,
    color: '#8F7138',
  },
  swipeWrap: { position: 'relative', marginBottom: 0 },
  settledTaskTint: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 4,
    borderRadius: 18,
    backgroundColor: 'rgba(252,252,252,0.28)',
  },
  dayActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  dayActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FBF7EE',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#A87E33',
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
  dayActionBtnSkip: {
    backgroundColor: '#EFEDE6',
    borderColor: 'rgba(28,25,23,0.32)',
    shadowColor: '#1C1917',
  },
  dayActionBtnDisabled: {
    backgroundColor: '#FAFAF7',
    borderColor: '#F4F2EC',
    shadowOpacity: 0,
    elevation: 0,
  },
  dayActionTxt: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: C.gold,
  },
  dayActionTxtSkip: { color: C.textSecondary },
  dayActionTxtDisabled: { color: '#D6D3D1' },
  inactiveDateShell: {
    position: 'relative',
  },
  inactiveDateContent: {
    opacity: 0.72,
  },
  futureDateContent: {
    opacity: 0.62,
  },
  skipReveal: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 6,
    width: 92,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipRevealText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: '#DC2626',
  },
  taskTouchableWrap: { position: 'relative' },
  checkFlourishLayer: {
    position: 'absolute',
    left: 4,
    top: 0,
    bottom: 6,
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkHitArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 6,
    width: 64,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  emptyTaskCard: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 18,
    paddingVertical: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    overflow: 'hidden',
    shadowColor: '#C5A059',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 2,
  },
  emptyTaskText: {
    flex: 1,
  },
  emptyTaskEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2.2,
    color: 'rgba(197,160,89,0.82)',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  emptyTaskTitle: { fontFamily: F.serifMedium, fontSize: 21, lineHeight: 24, color: C.text },
  emptyTaskBody: { marginTop: 6, fontFamily: F.sans, fontSize: 12.5, lineHeight: 18, color: C.textMuted },
  emptyTaskArt: {
    position: 'relative',
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emptyTaskArtGlow: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(197,160,89,0.08)',
    right: -30,
    bottom: -34,
  },
  emptyTaskArtDot: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D6B66F',
  },
  addBtn: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#1C1917',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  addBtnTxt: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.5, color: '#1C1917', textTransform: 'uppercase' },
  myRoutineBtn: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#C5A059',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#C5A059',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  myRoutineWatermark: {
    position: 'absolute',
    right: -18,
    bottom: -18,
    opacity: 0.1,
  },
  myRoutineContent: { flex: 1 },
  myRoutineLabel: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(197,160,89,0.8)',
    marginBottom: 6,
  },
  myRoutineTitle: {
    fontFamily: F.serifMedium,
    fontSize: 26,
    lineHeight: 28,
    color: '#C5A059',
    marginBottom: 4,
  },
  myRoutineSub: {
    fontFamily: F.serifItalic,
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(149,115,52,0.95)',
  },
  myRoutineArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C5A059',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#C5A059',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  mgSection: { marginTop: 14, position: 'relative', overflow: 'visible' },
  mgHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  mgHeadTitle: { fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  mgHeadSub: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: '#A8A29E', textTransform: 'uppercase' },
  mgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    backgroundColor: '#FFFEFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.30)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 5,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#C5A059',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.075,
    shadowRadius: 10,
    elevation: 1,
  },
  mgRowDone: {
    backgroundColor: '#FDF8EA',
    borderColor: 'rgba(197,160,89,0.44)',
  },
  mgDoneSpine: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: 'rgba(197,160,89,0.55)',
  },
  mgRowHighlight: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 0,
    height: 1.25,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  mgRowHighlightDone: {
    backgroundColor: 'rgba(255,255,255,0.74)',
  },
  mgRowText: {
    fontFamily: F.serifMedium,
    fontSize: 16.5,
    lineHeight: 20.5,
    color: '#1A1714',
  },
  mgEmpty: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDE9E0',
    paddingVertical: 14,
    alignItems: 'center',
  },
  mgEmptyText: {
    fontFamily: F.serifMediumItalic,
    fontSize: 13.5,
    color: '#A8A29E',
  },
  mgFooter: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    columnGap: 4,
    paddingTop: 6,
    paddingHorizontal: 6,
  },
  mgFooterText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, color: '#A8853C' },
  mgSetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 11,
    backgroundColor: '#C5A059',
    shadowColor: '#C5A059',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 7,
    elevation: 2,
  },
  mgSetPillText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, color: '#FFFFFF' },
});

const custom = StyleSheet.create({
  // Reading card — indigo/literary aesthetic
  readingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 18,
    borderColor: 'rgba(109,40,217,0.14)',
    marginBottom: 6,
  },
  readingCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(109,40,217,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  readingCheckDone: {
    backgroundColor: '#6D28D9',
    borderColor: '#6D28D9',
  },
  readingMid: { flex: 1, minWidth: 0, overflow: 'hidden' },
  readingTitle: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    lineHeight: 20,
    color: '#1C1917',
  },
  readingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    minWidth: 0,
    overflow: 'hidden',
  },
  readingMeta: {
    fontFamily: F.sansMedium,
    fontSize: 10,
    color: '#7C6FB0',
  },
  metaText: { flexShrink: 1, minWidth: 0 },
  readingDot: { color: '#7C6FB0', opacity: 0.6, fontSize: 9 },
  readingIconBadge: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#ECE8F5',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Gratitude card — 2-line, same size as other cards
  gratitudeCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F9A8D4',
    marginBottom: 6,
    padding: 13,
  },
  gratitudeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gratitudeCheck: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#F472B6',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  gratitudeCheckDone: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  gratitudeMid: { flex: 1, minWidth: 0, overflow: 'hidden' },
  gratitudeTitle: {
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    lineHeight: 19,
    color: '#1C1917',
  },
  gratitudeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    minWidth: 0,
    overflow: 'hidden',
  },
  gratitudeMeta: {
    fontFamily: F.sansMedium,
    fontSize: 10.5,
    color: '#E11D48',
  },
  gratitudeDot: { color: '#E11D48', opacity: 0.65, fontSize: 10 },
  gratitudeTypeBox: {
    padding: 7,
    borderRadius: 9,
    borderWidth: 1,
    backgroundColor: '#FFD6DF',
    borderColor: 'rgba(225,29,72,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
