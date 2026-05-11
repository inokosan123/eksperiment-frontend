import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
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
  CheckSmall,
  ChevronLeft,
  ChevronRight,
  CircleIcon,
  Clock,
  Heart,
  Minus,
  Plus,
  Settings,
  Skip,
} from '@/components/icons/Icons';
import DateStrip from './DateStrip';
import WeeklyRhythm from './WeeklyRhythm';
import ChallengesSection from './ChallengesSection';
import ExploreSection from './ExploreSection';
import { C, F } from '@/constants/tokens';
import { AnyTaskCard, TaskData, TaskState } from '@/components/shared/TaskCards';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { CompletionFlourish } from '@/components/shared/taskAnimations';
import { playTaskCompleteFeedback, playTaskUndoFeedback, preloadTaskFeedbackSound } from '@/components/shared/taskFeedback';
import QuickTaskSheet from '@/components/shared/QuickTaskSheet';
import TaskAnalyticsSheet from '@/components/tasks/TaskAnalyticsSheet';
import NotificationsSheet from '@/components/tasks/NotificationsSheet';
import { useReadingList } from '@/components/library/ReadingListContext';
import { useInnerTools } from '@/components/inner-tools/InnerToolsContext';
import { useMonthlyGoals } from '@/components/inner-tools/MonthlyGoalsContext';
import { AnimatedGoalCheck, AnimatedStrikeText, fireGoalToggleHaptic } from '@/components/inner-tools/MonthlyGoalRow';
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
import type { TaskDefinition, TaskDraft } from '@/components/tasks/taskTypes';

type HomeCard = {
  id: string;
  taskId?: string;
  instanceId?: string;
  instanceStatus?: string;
  task: TaskData;
  streak?: number;
  route?: string;
  backend?: boolean;
};

type TaskConfirmAction = {
  mode: 'uncheck' | 'unskip' | 'skip';
  instanceId: string;
  date: string;
  title: string;
} | null;

function TaskConfirmGlyph({ mode }: { mode: NonNullable<TaskConfirmAction>['mode'] }) {
  if (mode === 'skip') {
    return <Skip s={21} c="#9A3412" w={2.25} />;
  }

  if (mode === 'unskip') {
    return <Plus s={22} c={C.gold} w={2.6} />;
  }

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <CheckSmall s={22} c={C.gold} w={2.6} />
      <View style={{
        position: 'absolute',
        bottom: 4,
        width: 17,
        height: 17,
        borderRadius: 9,
        backgroundColor: '#FFF7E6',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Minus s={12} c={C.goldDark} w={2.6} />
      </View>
    </View>
  );
}

function isCompletionFlowTask(card: HomeCard) {
  return card.task.variant === 'reading'
    || card.task.variant === 'gratitude'
    || card.task.type === 'gratitude'
    || !!card.taskId?.startsWith('reading_book_');
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
  const monthMeta = getMonthMeta(selectedDate);

  return (
    <>
      <View style={h.row}>
        <TouchableOpacity style={h.iconBtn} activeOpacity={0.7}>
          <Settings s={18} c={C.text} />
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
        <TouchableOpacity style={h.iconBtn} activeOpacity={0.7} onPress={() => onSelectDate(todayKey)}>
          <Calendar s={18} c={C.text} />
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f5f4f0', alignItems: 'center', justifyContent: 'center' },
  monthWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  monthNavBtn: { width: 28, height: 34, alignItems: 'center', justifyContent: 'center' },
  month: { fontFamily: F.serifMedium, fontSize: 28, color: C.red, lineHeight: 32 },
  year: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: C.textMuted, marginTop: 3 },
  quoteWrap: { paddingHorizontal: 30, paddingTop: 18, paddingBottom: 6, alignItems: 'center' },
  quote: {
    maxWidth: 330,
    fontFamily: F.serifMediumItalic,
    fontSize: 16,
    color: '#8C8277',
    lineHeight: 25,
    textAlign: 'center',
  },
  ref: { marginTop: 10, fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 2.5, color: C.gold },
});

function ProgressBar({ pct, mode = 'normal' }: { pct: number; mode?: 'normal' | 'all-skipped' }) {
  const anim = useSharedValue(pct);
  useEffect(() => {
    anim.value = withTiming(pct, { duration: 600 });
  }, [anim, pct]);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(100, anim.value))}%`,
  }));
  return (
    <View style={progress.track}>
      <Reanimated.View style={[progress.fill, mode === 'all-skipped' && progress.fillBlack, fillStyle]} />
    </View>
  );
}

const progress = StyleSheet.create({
  track: { width: 110, height: 3, borderRadius: 3, backgroundColor: '#ece9de', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: C.gold, borderRadius: 3 },
  fillBlack: { backgroundColor: '#1c1917' },
});

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
        <NotoEmoji name={normalizeHabitIcon(event.icon)} size={22} />
      </View>
      <View style={beb.copy}>
        <Text style={[beb.title, !isToday && beb.titleLarge]} numberOfLines={1} ellipsizeMode="tail">{event.title}</Text>
        {isToday && <Text style={[beb.todayHint, { color: event.color }]}>The day is here</Text>}
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

const beb = StyleSheet.create({
  section: { marginHorizontal: 16, marginTop: 10, marginBottom: 0 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  headTitle: { fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  headSub: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: '#A8A29E', textTransform: 'uppercase' },
  row: {
    flexDirection: 'row', alignItems: 'center', columnGap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#EDE9E0',
    paddingLeft: 7, paddingRight: 18, paddingVertical: 7, marginBottom: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  iconBox:   { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy:      { flex: 1, minWidth: 0 },
  title:     { fontFamily: F.serifMedium, fontSize: 16, color: C.text, flexShrink: 1, minWidth: 0 },
  titleLarge:{ fontSize: 18 },
  todayHint: { marginTop: 2, fontFamily: F.serifMediumItalic, fontSize: 12 },
  count:     { flexDirection: 'row', alignItems: 'baseline', columnGap: 5, flexShrink: 0 },
  countNum:  { fontFamily: F.serifSemiBold, fontSize: 22, lineHeight: 24 },
  countLabel:{ fontFamily: F.sansMedium, fontSize: 13, color: '#A8A29E' },
  todayPill: {
    flexDirection: 'row', alignItems: 'center', columnGap: 6,
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 11,
    flexShrink: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 3,
  },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.95)' },
  todayPillText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.4, color: '#FFFFFF' },
});

export default function HomeView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { books } = useReadingList();
  const { gratitudeEntries } = useInnerTools();
  const { bigEvents } = useBigEvents();
  const {
    ready: taskBackendReady,
    selectedDate,
    tasks: taskDefinitions,
    listItems: backendTasks,
    refresh: refreshTasks,
    createOrUpdateTask,
    completeInstance,
    skipInstance,
    resetInstance,
  } = useTasks();
  const topPadding = Platform.OS === 'web'
    ? 10
    : Math.max(insets.top, 0) + 4;

  const todayKey = getLocalDateKey();
  const canMutateSelectedDate = canMutateTaskDate(selectedDate, taskDefinitions);
  const [optimisticStates, setOptimisticStates] = useState<Record<string, TaskState>>({});
  const [quickTaskSheetOpen, setQuickTaskSheetOpen] = useState(false);
  const [analyticsCard, setAnalyticsCard] = useState<HomeCard | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [skipDayConfirmOpen, setSkipDayConfirmOpen] = useState(false);
  const [taskConfirmAction, setTaskConfirmAction] = useState<TaskConfirmAction>(null);

  useEffect(() => {
    preloadTaskFeedbackSound();
  }, []);

  const selectDate = useCallback((dateKey: string) => {
    void refreshTasks(dateKey);
  }, [refreshTasks]);

  const refreshTasksRef = useRef(refreshTasks);
  refreshTasksRef.current = refreshTasks;

  useFocusEffect(
    useCallback(() => {
      void refreshTasksRef.current(getLocalDateKey());
    }, []),
  );

  useEffect(() => {
    setOptimisticStates({});
  }, [selectedDate]);

  useEffect(() => {
    setOptimisticStates(prev => {
      let changed = false;
      const next: Record<string, TaskState> = {};

      for (const [instanceId, state] of Object.entries(prev)) {
        const backend = backendTasks.find(item => item.instance.id === instanceId);
        if (backend && backend.card.state !== state) {
          next[instanceId] = state;
        } else {
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [backendTasks]);

  const homeCards = useMemo<HomeCard[]>(() => {
    if (!taskBackendReady || backendTasks.length === 0) return [];
    return backendTasks.map(item => ({
      id: item.instance.id,
      taskId: item.instance.taskId,
      instanceId: item.instance.id,
      instanceStatus: item.instance.status,
      route: item.route,
      task: item.card,
      backend: true,
    }));
  }, [backendTasks, taskBackendReady]);

  const visibleTaskCount = backendTasks.length > 0 ? homeCards.length : 0;
  const scheduledToday = backendTasks.length > 0
    ? homeCards.filter(card => card.task.state !== 'locked').length
    : 0;
  const completedToday = backendTasks.length > 0
    ? homeCards.filter(card => card.task.state === 'done').length
    : 0;
  const skippedToday = backendTasks.length > 0
    ? homeCards.filter(card => card.task.state === 'skipped').length
    : 0;
  // Skip All Day must capture every unresolved task for the day — including
  // past-due ones the reconcile loop already auto-marked as 'missed'. The
  // adapter maps 'missed' → 'locked' for display, so filter on instanceStatus
  // (raw DB status) instead of card state.
  const skippableCards = useMemo(
    () => homeCards.filter(
      card => !!card.instanceId
        && (card.instanceStatus === 'pending' || card.instanceStatus === 'missed'),
    ),
    [homeCards],
  );
  const skipDayDisabled = !canMutateSelectedDate || skippableCards.length === 0;
  const resolvedToday = backendTasks.length > 0
    ? homeCards.filter(card => card.task.state === 'done' || card.task.state === 'skipped').length
    : 0;
  const progressTotal = selectedDate < todayKey && visibleTaskCount > 0 ? visibleTaskCount : scheduledToday;

  // Universal rule (matches WeeklyRhythm):
  //  - All tasks skipped → black bar, 100%
  //  - Otherwise → completed / (total - skipped). Skipped tasks are neutral:
  //    they neither count as done nor as missed.
  const allSkipped = progressTotal > 0
    && completedToday === 0
    && skippedToday === progressTotal;
  const progressMode: 'normal' | 'all-skipped' = allSkipped ? 'all-skipped' : 'normal';
  const effectiveProgressTotal = Math.max(0, progressTotal - skippedToday);
  const progressPct = progressTotal === 0
    ? 0
    : allSkipped
      ? 100
      : effectiveProgressTotal === 0
        ? 0
        : Math.round((completedToday / effectiveProgressTotal) * 100);
  const statusLine = !taskBackendReady
    ? 'Loading your routine...'
    : backendTasks.length === 0 && taskDefinitions.length > 0
      ? getNoTasksCopy(selectedDate, todayKey).status
      : selectedDate < todayKey && visibleTaskCount > 0
        ? resolvedToday > 0
          ? `${resolvedToday} of ${visibleTaskCount} resolved`
          : `${visibleTaskCount} task snapshot`
      : selectedDate > todayKey && visibleTaskCount > 0
        ? `${visibleTaskCount} tasks scheduled`
      : scheduledToday === 0
        ? 'Set up tasks to fill your Home flow'
        : skippedToday > 0
          ? `${resolvedToday} of ${scheduledToday} resolved`
        : completedToday > 0
          ? `${completedToday} of ${scheduledToday} completed`
          : selectedDate === todayKey
            ? `${scheduledToday} active today`
            : `${scheduledToday} tasks scheduled`;

  const hasBackendTasks = taskBackendReady && (
    backendTasks.length > 0 || taskDefinitions.some(task => task.status !== 'archived')
  );
  const taskSectionTitle = getTaskSectionTitle(selectedDate, todayKey);
  const noTasksCopy = getNoTasksCopy(selectedDate, todayKey);

  const resetTaskInstance = useCallback((instanceId: string, date: string) => {
    playTaskUndoFeedback();
    setOptimisticStates(prev => ({ ...prev, [instanceId]: 'pending' }));
    void resetInstance(instanceId, date).catch(() => {
      setOptimisticStates(prev => {
        const next = { ...prev };
        delete next[instanceId];
        return next;
      });
    });
  }, [resetInstance]);

  const completeTaskInstance = useCallback((instanceId: string, date: string) => {
    void playTaskCompleteFeedback();
    setOptimisticStates(prev => ({ ...prev, [instanceId]: 'done' }));
    void completeInstance(instanceId, date).catch(() => {
      setOptimisticStates(prev => {
        const next = { ...prev };
        delete next[instanceId];
        return next;
      });
    });
  }, [completeInstance]);

  const skipTaskInstance = useCallback((instanceId: string, date: string) => {
    setOptimisticStates(prev => ({ ...prev, [instanceId]: 'skipped' }));
    void skipInstance(instanceId, date).catch(() => {
      setOptimisticStates(prev => {
        const next = { ...prev };
        delete next[instanceId];
        return next;
      });
    });
  }, [skipInstance]);

  const openCompletionFlowTask = useCallback((card: HomeCard) => {
    if (!card.instanceId) return;
    if (card.task.variant === 'gratitude' || card.task.type === 'gratitude') {
      router.push({
        pathname: '/gratitude-task',
        params: {
          taskInstanceId: card.instanceId,
          taskDate: selectedDate,
        },
      } as any);
      return;
    }

    if (card.task.variant === 'reading' || card.taskId?.startsWith('reading_book_')) {
      const bookId = card.taskId?.startsWith('reading_book_')
        ? card.taskId.slice('reading_book_'.length)
        : undefined;
      const book = (bookId ? books.find(item => item.id === bookId) : undefined)
        ?? books.find(item => item.title === card.task.title);

      router.push({
        pathname: '/reading-session',
        params: {
          bookId: book?.id ?? bookId ?? '',
          title: book?.title ?? card.task.title,
          author: book?.author ?? '',
          isTask: 'true',
          taskInstanceId: card.instanceId,
          taskDate: selectedDate,
        },
      } as any);
    }
  }, [books, router, selectedDate]);

  const toggleTaskInstance = useCallback((card: HomeCard, state: TaskState) => {
    if (!card.instanceId || !canMutateSelectedDate || state === 'locked') return;
    if (state === 'done' || state === 'skipped') {
      setTaskConfirmAction({
        mode: state === 'skipped' ? 'unskip' : 'uncheck',
        instanceId: card.instanceId,
        date: selectedDate,
        title: card.task.title,
      });
      return;
    }
    if (isCompletionFlowTask(card)) {
      openCompletionFlowTask(card);
      return;
    }
    completeTaskInstance(card.instanceId, selectedDate);
  }, [canMutateSelectedDate, completeTaskInstance, openCompletionFlowTask, selectedDate]);

  const requestSkipTaskInstance = useCallback((card: HomeCard, state: TaskState) => {
    if (
      !card.instanceId ||
      !canMutateSelectedDate ||
      state === 'locked' ||
      state === 'done' ||
      state === 'skipped'
    ) return false;
    setTaskConfirmAction({
      mode: 'skip',
      instanceId: card.instanceId,
      date: selectedDate,
      title: card.task.title,
    });
    return true;
  }, [canMutateSelectedDate, selectedDate]);

  const confirmTaskAction = useCallback(() => {
    if (!taskConfirmAction) return;
    const action = taskConfirmAction;
    setTaskConfirmAction(null);
    if (action.mode === 'skip') {
      skipTaskInstance(action.instanceId, action.date);
      return;
    }
    resetTaskInstance(action.instanceId, action.date);
  }, [resetTaskInstance, skipTaskInstance, taskConfirmAction]);

  const createQuickTask = useCallback(async (draft: TaskDraft) => {
    await createOrUpdateTask(draft);
    await refreshTasks(draft.quickConfig?.date ?? selectedDate);
  }, [createOrUpdateTask, refreshTasks, selectedDate]);

  const confirmSkipAllDay = useCallback(() => {
    setSkipDayConfirmOpen(false);
    if (skippableCards.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    for (const card of skippableCards) {
      if (!card.instanceId) continue;
      void skipInstance(card.instanceId, selectedDate).catch(() => {});
    }
  }, [skippableCards, skipInstance, selectedDate]);

  return (
    <View style={s.homeRoot}>
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <HomeHeader selectedDate={selectedDate} todayKey={todayKey} onSelectDate={selectDate} />

      <BigEventBanner
        events={bigEvents}
        selectedDate={selectedDate}
        onPress={() => router.push('/big-events' as any)}
      />

      <View style={s.tasksWrap}>
        <View style={s.tasksHead}>
          <View>
            <Text style={s.tasksTitle}>{taskSectionTitle}</Text>
            <Text style={s.tasksSub}>{statusLine}</Text>
          </View>
          <View style={s.progressWrap}>
            <ProgressBar pct={progressPct} mode={progressMode} />
          </View>
        </View>

        {!hasBackendTasks && taskBackendReady && (
          <TouchableOpacity activeOpacity={0.84} onPress={() => router.push('/my-routine')} style={s.emptyTaskCard}>
            <Text style={s.emptyTaskTitle}>No tasks yet</Text>
            <Text style={s.emptyTaskBody}>Create your first routine, prayer, reading, habit, or challenge task.</Text>
          </TouchableOpacity>
        )}

        {hasBackendTasks && taskBackendReady && homeCards.length === 0 && (
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

        <View style={s.cardsList}>
          {homeCards.map(card => {
            const dateInactive = !!card.backend && selectedDate !== todayKey && !canMutateSelectedDate;
            const futureInactive = dateInactive && selectedDate > todayKey;
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
            const content = card.backend
              ? <AnyTaskCard task={displayTask} streak={card.streak} />
              : card.id === 'reading-task'
              ? (
                <HomeReadingCard
                  task={displayTask}
                  book={books.find(book => book.title === displayTask.title)}
                />
              )
              : card.id === 'gratitude-task'
                ? (
                  <HomeGratitudeCard
                    task={displayTask}
                    blessingsToday={gratitudeEntries.filter(
                      entry => entry.kind === 'daily' && entry.date === todayKey,
                    ).length}
                  />
                )
                : <AnyTaskCard task={displayTask} streak={card.streak} />;
            const datedContent = dateInactive
              ? (
                <DateInactiveTaskShell future={futureInactive}>
                  {content}
                </DateInactiveTaskShell>
              )
              : content;

            const canToggle = !!card.instanceId && canMutateSelectedDate && displayTask.state !== 'locked';
            const canSkip = canToggle && displayTask.state !== 'done' && displayTask.state !== 'skipped';
            const canShowAnalytics = !!card.backend && !!card.taskId && displayTask.variant !== 'quick';
            return (
              <SwipeTaskRow
                key={card.id}
                disabled={!canSkip}
                onSkip={() => requestSkipTaskInstance(card, displayTask.state)}
              >
                <StatusAnimatedTaskRow state={displayTask.state}>
                  <View style={s.taskTouchableWrap}>
                    <LongPressGate
                      enabled={canShowAnalytics}
                      onActivate={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        setAnalyticsCard(card);
                      }}
                    >
                      {datedContent}
                    </LongPressGate>
                    {canToggle && (
                      <CompletionFlourish
                        done={displayTask.state === 'done'}
                        color="#C5A059"
                        layerStyle={s.checkFlourishLayer}
                      />
                    )}
                    {canToggle && (
                      <TouchableOpacity
                        activeOpacity={0.72}
                        onPress={() => toggleTaskInstance(card, displayTask.state)}
                        style={s.checkHitArea}
                      />
                    )}
                  </View>
                </StatusAnimatedTaskRow>
              </SwipeTaskRow>
            );
          })}
        </View>

        {hasBackendTasks && taskBackendReady && (
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
              style={[s.dayActionBtn, skipDayDisabled && s.dayActionBtnDisabled]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setSkipDayConfirmOpen(true);
              }}
            >
              <Skip s={14} c={skipDayDisabled ? '#D6D3D1' : C.gold} w={2.2} />
              <Text style={[s.dayActionTxt, skipDayDisabled && s.dayActionTxtDisabled]}>SKIP DAY</Text>
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

        <TouchableOpacity activeOpacity={0.82} style={{ marginTop: 8 }} onPress={() => router.push('/my-routine')}>
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

        <MonthlyGoalsHomeCard />
      </View>

        <WeeklyRhythm />
        <ChallengesSection />
        <ExploreSection />
      </ScrollView>
      <QuickTaskSheet
        visible={quickTaskSheetOpen}
        defaultDate={selectedDate >= todayKey ? selectedDate : todayKey}
        onClose={() => setQuickTaskSheetOpen(false)}
        onTaskDraft={createQuickTask}
      />
      <TaskAnalyticsSheet
        visible={!!analyticsCard}
        taskId={analyticsCard?.taskId}
        taskTitle={analyticsCard?.task.title ?? ''}
        taskSubtitle={analyticsCard?.task.subtitle}
        onClose={() => setAnalyticsCard(null)}
      />
      <NotificationsSheet
        visible={notificationsOpen}
        selectedDate={selectedDate}
        onClose={() => setNotificationsOpen(false)}
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
        icon={<TaskConfirmGlyph mode={taskConfirmAction?.mode ?? 'uncheck'} />}
        iconBg={taskConfirmAction?.mode === 'skip' ? '#FFF1E8' : '#FFF7E6'}
        title={taskConfirmAction?.mode === 'skip'
          ? 'Skip this task?'
          : taskConfirmAction?.mode === 'unskip'
            ? 'Unskip this task?'
            : 'Uncheck this task?'}
        body={taskConfirmAction?.mode === 'skip'
          ? 'Do you want to skip this task for today?'
          : taskConfirmAction?.mode === 'unskip'
            ? 'Do you want to return this task to your list?'
            : 'Do you want to mark this task as incomplete?'}
        subject={taskConfirmAction?.title}
        confirmLabel={taskConfirmAction?.mode === 'skip'
          ? 'SKIP'
          : taskConfirmAction?.mode === 'unskip'
            ? 'UNSKIP'
            : 'UNCHECK'}
        confirmColor="#1C1917"
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

  const allGoals = goalsByMonth[monthKey] ?? [];
  // Stable order: respect sortOrder, then creation time. Completed goals stay
  // in place — checking should not reorder the list.
  const sorted = useMemo(() => {
    return [...allGoals].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  }, [allGoals]);

  const total = allGoals.length;
  const done = allGoals.filter(g => g.isCompleted).length;
  const active = total - done;
  const allDone = total > 0 && done === total;

  // Cap visible to keep home compact. If more, show "+N more →".
  const MAX_VISIBLE = 4;
  const visible = sorted.slice(0, MAX_VISIBLE);
  const hiddenCount = Math.max(0, sorted.length - MAX_VISIBLE);

  const onToggle = (goal: { id: string; text: string; isCompleted: boolean }) => {
    if (goal.isCompleted) {
      setUncheckConfirm({ id: goal.id, text: goal.text });
      return;
    }
    fireGoalToggleHaptic(true);
    toggleGoal(goal.id);
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
      {visible.map(goal => (
        <View key={goal.id} style={s.mgRow}>
          <AnimatedGoalCheck
            done={goal.isCompleted}
            onPress={() => onToggle(goal)}
            size={22}
          />
          <AnimatedStrikeText
            text={goal.text}
            done={goal.isCompleted}
            textStyle={s.mgRowText}
          />
        </View>
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
        iconBg="#FFF7E6"
        title="Uncheck this goal?"
        body="Do you want to mark this goal as incomplete?"
        subject={uncheckConfirm?.text}
        confirmLabel="UNCHECK"
        confirmColor="#1C1917"
        onCancel={() => setUncheckConfirm(null)}
        onConfirm={confirmUncheck}
      />
    </View>
  );
}

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
  const isInactive = state === 'done' || state === 'skipped';
  const opacity = useSharedValue(isInactive ? 0.72 : 1);
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  const previousState = useRef(state);

  useEffect(() => {
    const becameInactive = previousState.current !== state && isInactive;
    const becameActive = previousState.current !== state && !isInactive;
    previousState.current = state;

    if (becameInactive) {
      // For 'done' we delay the dim until the celebratory burst + strike
      // finish (~1160ms). For 'skipped' there's no celebration, so dim now.
      const dimDelay = state === 'done' ? 1160 : 0;
      opacity.value = withDelay(dimDelay, withTiming(0.72, { duration: 280 }));
      scale.value = withTiming(0.985, { duration: 95 }, () => {
        scale.value = withSpring(1, {
          damping: 18,
          stiffness: 245,
          mass: 0.7,
        });
      });
      lift.value = withTiming(-3, { duration: 95 }, () => {
        lift.value = withSpring(0, {
          damping: 18,
          stiffness: 245,
          mass: 0.7,
        });
      });
      return;
    }

    if (becameActive) {
      opacity.value = withTiming(1, { duration: 115 });
      lift.value = withSpring(0, {
        damping: 20,
        stiffness: 260,
        mass: 0.75,
      });
      scale.value = withSpring(1.012, {
        damping: 16,
        stiffness: 255,
        mass: 0.72,
      }, () => {
        scale.value = withSpring(1, {
          damping: 18,
          stiffness: 245,
          mass: 0.72,
        });
      });
      return;
    }

    opacity.value = withTiming(isInactive ? 0.72 : 1, { duration: 150 });
    scale.value = withSpring(1, {
      damping: 18,
      stiffness: 245,
      mass: 0.72,
    });
    lift.value = withSpring(0, {
      damping: 18,
      stiffness: 245,
      mass: 0.72,
    });
  }, [isInactive, lift, opacity, scale, state]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: lift.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Reanimated.View style={animatedStyle}>
      {children}
    </Reanimated.View>
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
      <View
        pointerEvents="none"
        style={[
          s.inactiveDateOverlay,
          future ? s.futureDateOverlay : s.pastDateOverlay,
        ]}
      />
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
  const pressScale = useSharedValue(1);
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
    pressScale.value = withTiming(1, { duration: 120 });
    committed.value = 0;
  }, [committed, disabled, pressScale, revealProgress, translateX]);

  const panGesture = useMemo(() => Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-8, 8])
    .failOffsetY([-18, 18])
    .onBegin(() => {
      committed.value = 0;
      pressScale.value = withTiming(0.995, { duration: 70 });
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
        pressScale.value = withTiming(1, { duration: 120 });
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
      pressScale.value = withTiming(0.985, { duration: 70 }, () => {
        pressScale.value = withSpring(1, {
          damping: 18,
          stiffness: 250,
          mass: 0.75,
        });
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
        pressScale.value = withTiming(1, { duration: 120 });
      }
    }), [committed, disabled, finishSkip, pressScale, revealProgress, translateX]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: revealProgress.value,
    transform: [{ scale: 0.96 + revealProgress.value * 0.04 }],
  }));

  const rowStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: pressScale.value },
    ],
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
      <View style={[custom.readingCheck, isDone && custom.readingCheckDone]}>
        {isDone
          ? <CheckSmall s={18} c="#FFFFFF" w={2.8} />
          : <CircleIcon s={18} c="rgba(109,40,217,0.30)" w={2} />
        }
      </View>

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
        <View style={[custom.gratitudeCheck, isDone && custom.gratitudeCheckDone]}>
          {isDone
            ? <CheckSmall s={19} c="#FFFFFF" w={2.8} />
            : <CircleIcon s={19} c="#F472B6" w={2} />
          }
        </View>

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

const s = StyleSheet.create({
  homeRoot: {
    flex: 1,
    position: 'relative',
    backgroundColor: C.bg,
  },
  tasksWrap: { paddingHorizontal: 20, paddingTop: 18 },
  tasksHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  tasksTitle: { fontFamily: F.serifMedium, fontSize: 22, color: C.text },
  tasksSub: { fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 4 },
  progressWrap: { marginTop: 8 },
  cardsList: { marginTop: 14 },
  swipeWrap: { position: 'relative', marginBottom: 0 },
  dayActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  dayActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EFEB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  dayActionBtnDisabled: {
    backgroundColor: '#FAFAF7',
    borderColor: '#F4F2EC',
    shadowOpacity: 0,
    elevation: 0,
  },
  dayActionTxt: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: C.textSecondary,
  },
  dayActionTxtDisabled: { color: '#D6D3D1' },
  inactiveDateShell: {
    position: 'relative',
    borderRadius: 22,
    overflow: 'hidden',
  },
  inactiveDateContent: {
    opacity: 0.72,
  },
  futureDateContent: {
    opacity: 0.62,
  },
  inactiveDateOverlay: {
    ...StyleSheet.absoluteFillObject,
    bottom: 6,
    borderRadius: 22,
    borderWidth: 1,
  },
  pastDateOverlay: {
    backgroundColor: 'rgba(245,245,244,0.28)',
    borderColor: 'rgba(168,162,158,0.16)',
  },
  futureDateOverlay: {
    backgroundColor: 'rgba(231,229,228,0.42)',
    borderColor: 'rgba(168,162,158,0.24)',
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
    left: 9,
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
  mgSection: { marginTop: 14 },
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
    columnGap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDE9E0',
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 3,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 7,
    elevation: 1,
  },
  mgRowText: {
    fontFamily: F.serifMedium,
    fontSize: 15,
    lineHeight: 20,
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
