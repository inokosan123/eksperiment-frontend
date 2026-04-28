import React, { useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowUpRight,
  Book,
  Calendar,
  CheckSmall,
  ChevronLeft,
  ChevronRight,
  CircleIcon,
  Clock,
  Heart,
  Plus,
  Settings,
} from '@/components/icons/Icons';
import DateStrip from './DateStrip';
import WeeklyRhythm from './WeeklyRhythm';
import ChallengesSection from './ChallengesSection';
import ExploreSection from './ExploreSection';
import { C, F } from '@/constants/tokens';
import { AnyTaskCard, TaskData, TaskState } from '@/components/shared/TaskCards';
import { useReadingList } from '@/components/library/ReadingListContext';
import { useInnerTools } from '@/components/inner-tools/InnerToolsContext';
import { HabitItem, INITIAL_HABITS } from '@/components/habits/habitData';
import { useChallenges } from '@/components/challenges/ChallengesContext';
import { useTasks } from '@/components/tasks/TaskProvider';
import {
  getEffectiveTaskTime,
  getLocalDateKey,
  parseTaskTimeToDate,
  scheduleMatchesDate,
} from '@/components/tasks/taskScheduler';
import type { TaskDefinition } from '@/components/tasks/taskTypes';

type HomeCard = {
  id: string;
  instanceId?: string;
  instanceStatus?: string;
  task: TaskData;
  streak?: number;
  route?: string;
  backend?: boolean;
};

function isScheduledToday(
  frequency?: 'daily' | 'weekdays' | 'weekends' | 'specific_days' | 'monthly',
  selectedDays?: number[],
  monthlyDays?: number[],
) {
  const day = new Date().getDay();
  const date = new Date().getDate();

  switch (frequency) {
    case 'weekdays':
      return day >= 1 && day <= 5;
    case 'weekends':
      return day === 0 || day === 6;
    case 'specific_days':
      return (selectedDays ?? []).includes(day);
    case 'monthly':
      return (monthlyDays ?? [1]).includes(date);
    case 'daily':
    default:
      return true;
  }
}

function getScheduleLabel(
  frequency?: 'daily' | 'weekdays' | 'weekends' | 'specific_days' | 'monthly',
  selectedDays?: number[],
  monthlyDays?: number[],
) {
  switch (frequency) {
    case 'weekdays':
      return 'Weekdays';
    case 'weekends':
      return 'Weekends';
    case 'specific_days':
      return selectedDays && selectedDays.length > 0 ? `${selectedDays.length} days` : 'Custom schedule';
    case 'monthly':
      return monthlyDays && monthlyDays.length > 0 ? `Monthly ${monthlyDays.join(', ')}` : 'Monthly';
    case 'daily':
    default:
      return 'Daily';
  }
}

function getTodayTaskDayIndex() {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function getHabitState(habit: HabitItem): TaskState {
  if (!habit.active) return 'locked';

  const total = habit.steps.length;
  const done = habit.steps.filter(step => step.completedToday).length;

  if (total > 0 && done === total) return 'done';
  if (done > 0) return 'active';
  return 'pending';
}

function getHabitIconName(habit: HabitItem): TaskData['habitIconName'] {
  if (habit.name.toLowerCase().includes('morning')) return 'Sun';
  if (habit.name.toLowerCase().includes('study')) return 'Book';
  if (habit.name.toLowerCase().includes('review')) return 'Feather';
  return 'Heart';
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

function ProgressBar({ pct }: { pct: number }) {
  return (
    <View style={progress.track}>
      <View style={[progress.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const progress = StyleSheet.create({
  track: { width: 110, height: 3, borderRadius: 3, backgroundColor: '#ece9de', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: C.gold, borderRadius: 3 },
});

export default function HomeView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { books } = useReadingList();
  const {
    gratitudeEntries,
    gratitudeTaskEnabled,
    gratitudeTaskFrequency,
    gratitudeTaskTime,
    gratitudeTaskSameTimeEveryDay,
    gratitudeTaskDayTimes,
  } = useInnerTools();
  const { activeChallenges, pausedChallenges } = useChallenges();
  const {
    ready: taskBackendReady,
    selectedDate,
    tasks: taskDefinitions,
    listItems: backendTasks,
    refresh: refreshTasks,
    completeInstance,
    skipInstance,
    resetInstance,
  } = useTasks();
  const topPadding = Platform.OS === 'web'
    ? 10
    : Math.max(insets.top, 0) + 4;

  const todayKey = getLocalDateKey();
  const canMutateSelectedDate = canMutateTaskDate(selectedDate, taskDefinitions);

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

  const homeCards = useMemo<HomeCard[]>(() => {
    const featuredHabit = INITIAL_HABITS.find(habit => habit.active && habit.steps.some(step => !step.completedToday))
      ?? INITIAL_HABITS.find(habit => habit.active)
      ?? INITIAL_HABITS[0];
    const habitDone = featuredHabit.steps.filter(step => step.completedToday).length;
    const habitTotal = featuredHabit.steps.length;
    const nextHabitStep = featuredHabit.steps.find(step => !step.completedToday) ?? featuredHabit.steps[0];

    const featuredReading = books.find(book => book.showOnHome && book.status === 'reading')
      ?? books.find(book => book.showOnHome)
      ?? books.find(book => book.status === 'reading');
    const readingScheduled = featuredReading
      ? isScheduledToday(featuredReading.taskFrequency, featuredReading.taskSelectedDays, featuredReading.taskMonthlyDays)
      : false;
    const readingDoneToday = !!(featuredReading?.lastSessionAt && dateKey(featuredReading.lastSessionAt) === todayKey);
    const readingDisplayTime = featuredReading?.taskSameTimeEveryDay === false
      ? featuredReading.taskDayTimes?.[getTodayTaskDayIndex()] ?? featuredReading.taskTime
      : featuredReading?.taskTime;

    const gratitudeTodayCount = gratitudeEntries.filter(
      entry => entry.kind === 'daily' && entry.date === todayKey,
    ).length;
    const gratitudeScheduled = gratitudeTaskEnabled
      && isScheduledToday(gratitudeTaskFrequency, gratitudeTaskFrequency === 'daily' ? undefined : [1, 2, 3, 4, 5]);
    const gratitudeDoneToday = gratitudeTodayCount >= 3;
    const gratitudeDisplayTime = gratitudeTaskSameTimeEveryDay
      ? gratitudeTaskTime
      : gratitudeTaskDayTimes[getTodayTaskDayIndex()] ?? gratitudeTaskTime;

    const primaryChallenge = activeChallenges[0] ?? pausedChallenges[0];

    const legacyCards: HomeCard[] = [
      {
        id: 'spiritual-routine',
        route: '/prayer',
        streak: 4,
        task: {
          variant: 'spiritual',
          title: 'Morning Prayer',
          time: '07:00',
          subtitle: 'Spiritual routine',
          state: 'active',
          type: 'prayer',
        },
      },
      {
        id: 'habit-flow',
        route: '/habits',
        streak: nextHabitStep?.currentStreak ?? 0,
        task: {
          variant: 'habit',
          title: featuredHabit?.name ?? 'Habits',
          time: nextHabitStep?.time,
          subtitle: featuredHabit ? `${habitDone}/${habitTotal} steps today` : 'Create your first habit',
          state: featuredHabit ? getHabitState(featuredHabit) : 'locked',
          habitColor: featuredHabit?.color ?? C.gold,
          habitIconName: featuredHabit ? getHabitIconName(featuredHabit) : 'Heart',
        },
      },
      {
        id: 'routine-demo',
        task: {
          variant: 'routine',
          title: 'Evening Walk',
          time: '19:00',
          subtitle: 'Daily',
          state: 'pending',
          type: 'custom',
          habitIconName: 'Activity',
        },
      },
      {
        id: 'reading-task',
        route: '/reading-list',
        task: {
          variant: 'routine',
          title: featuredReading?.title ?? 'Reading List',
          time: readingDisplayTime,
          subtitle: featuredReading
            ? getScheduleLabel(featuredReading.taskFrequency, featuredReading.taskSelectedDays, featuredReading.taskMonthlyDays)
            : 'Add a reading task',
          state: featuredReading ? (readingDoneToday ? 'done' : readingScheduled ? 'active' : 'locked') : 'locked',
          type: 'reading',
        },
      },
      {
        id: 'gratitude-task',
        route: '/gratitude',
        task: {
          variant: 'routine',
          title: 'Gratitude',
          time: gratitudeTaskEnabled ? gratitudeDisplayTime : undefined,
          subtitle: gratitudeTaskEnabled
            ? getScheduleLabel(gratitudeTaskFrequency)
            : 'Set as daily task',
          state: gratitudeTaskEnabled ? (gratitudeDoneToday ? 'done' : gratitudeScheduled ? 'active' : 'locked') : 'locked',
          type: 'gratitude',
        },
      },
      {
        id: 'quick-task-demo',
        task: {
          variant: 'quick',
          title: 'Reply to Father Nikolaj',
          state: 'pending',
          type: 'custom',
        },
      },
      {
        id: 'challenge-task',
        route: '/challenges',
        streak: primaryChallenge?.streak,
        task: {
          variant: 'challenge',
          title: primaryChallenge?.title ?? 'Challenges',
          time: primaryChallenge?.progressTotal ? `${primaryChallenge.progressCurrent}/${primaryChallenge.progressTotal}` : primaryChallenge?.time,
          subtitle: primaryChallenge ? primaryChallenge.subline : 'No active challenges',
          state: primaryChallenge ? (primaryChallenge.status === 'paused' ? 'pending' : 'active') : 'locked',
          type: 'reading',
        },
      },
    ];

    if (!taskBackendReady) return legacyCards.filter(() => false);

    if (backendTasks.length > 0) {
      return backendTasks.map(item => ({
        id: item.instance.id,
        instanceId: item.instance.id,
        instanceStatus: item.instance.status,
        route: item.route,
        task: item.card,
        backend: true,
      }));
    }

    return [];
  }, [
    activeChallenges,
    backendTasks,
    books,
    gratitudeEntries,
    gratitudeTaskDayTimes,
    gratitudeTaskEnabled,
    gratitudeTaskFrequency,
    gratitudeTaskSameTimeEveryDay,
    gratitudeTaskTime,
    pausedChallenges,
    taskBackendReady,
    todayKey,
  ]);

  const scheduledToday = backendTasks.length > 0
    ? homeCards.filter(card => card.task.state !== 'locked').length
    : 0;
  const completedToday = backendTasks.length > 0
    ? homeCards.filter(card => card.task.state === 'done').length
    : 0;
  const progressPct = scheduledToday === 0 ? 0 : Math.round((completedToday / scheduledToday) * 100);
  const statusLine = !taskBackendReady
    ? 'Loading your routine...'
    : backendTasks.length === 0 && taskDefinitions.length > 0
      ? 'No tasks for this date'
      : scheduledToday === 0
        ? 'Set up tasks to fill your Home flow'
        : completedToday > 0
          ? `${completedToday} of ${scheduledToday} completed`
          : selectedDate === todayKey
            ? `${scheduledToday} active today`
            : `${scheduledToday} tasks scheduled`;

  const hasBackendTasks = taskBackendReady && taskDefinitions.some(task => task.status !== 'archived');
  const taskSectionTitle = getTaskSectionTitle(selectedDate, todayKey);

  const toggleTaskInstance = useCallback((card: HomeCard, state: TaskState) => {
    if (!card.instanceId || !canMutateSelectedDate || state === 'locked') return;
    if (state === 'done') {
      void resetInstance(card.instanceId);
      return;
    }
    void completeInstance(card.instanceId);
  }, [canMutateSelectedDate, completeInstance, resetInstance]);

  const skipTaskInstance = useCallback((card: HomeCard, state: TaskState) => {
    if (
      !card.instanceId ||
      !canMutateSelectedDate ||
      state === 'locked' ||
      state === 'done' ||
      state === 'skipped'
    ) return;
    void skipInstance(card.instanceId);
  }, [canMutateSelectedDate, skipInstance]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{
        paddingTop: topPadding,
        paddingBottom: 120,
      }}
      showsVerticalScrollIndicator={false}
    >
      <HomeHeader selectedDate={selectedDate} todayKey={todayKey} onSelectDate={selectDate} />

      <View style={s.tasksWrap}>
        <View style={s.tasksHead}>
          <View>
            <Text style={s.tasksTitle}>{taskSectionTitle}</Text>
            <Text style={s.tasksSub}>{statusLine}</Text>
          </View>
          <View style={s.progressWrap}>
            <ProgressBar pct={progressPct} />
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
            <Text style={s.emptyTaskTitle}>No tasks for this date</Text>
            <Text style={s.emptyTaskBody}>Choose another day or adjust your routine schedule.</Text>
          </View>
        )}

        <View style={s.cardsList}>
          {homeCards.map(card => {
            const displayTask = card.backend
              ? canMutateSelectedDate && card.instanceStatus === 'missed'
                ? { ...card.task, state: 'pending' as TaskState }
                : !canMutateSelectedDate && card.task.state !== 'done' && card.task.state !== 'skipped'
                  ? { ...card.task, state: 'locked' as TaskState }
                  : card.task
              : card.task;
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

            const canToggle = !!card.instanceId && canMutateSelectedDate && displayTask.state !== 'locked';
            const canSkip = canToggle && displayTask.state !== 'done' && displayTask.state !== 'skipped';

            const route = card.route;
            const cardBody = route ? (
              <TouchableOpacity
                activeOpacity={0.84}
                onPress={() => router.push(route as any)}
              >
                {content}
              </TouchableOpacity>
            ) : (
              <View>{content}</View>
            );

            return (
              <SwipeTaskRow
                key={card.id}
                disabled={!canSkip}
                onSkip={() => skipTaskInstance(card, displayTask.state)}
              >
                <View style={s.taskTouchableWrap}>
                  {cardBody}
                  {canToggle && (
                    <TouchableOpacity
                      activeOpacity={0.72}
                      onPress={() => toggleTaskInstance(card, displayTask.state)}
                      style={s.checkHitArea}
                    />
                  )}
                </View>
              </SwipeTaskRow>
            );
          })}
        </View>

        <TouchableOpacity activeOpacity={0.82} style={{ marginTop: 8 }} onPress={() => router.push('/my-routine')}>
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
      </View>

      <WeeklyRhythm />
      <ChallengesSection />
      <ExploreSection />
    </ScrollView>
  );
}

function SwipeTaskRow({
  children,
  disabled,
  onSkip,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onSkip: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  const resetPosition = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      friction: 16,
      tension: 170,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      !disabled &&
      Math.abs(gesture.dx) > 12 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25
    ),
    onPanResponderMove: (_, gesture) => {
      translateX.setValue(Math.max(-92, Math.min(0, gesture.dx)));
    },
    onPanResponderRelease: (_, gesture) => {
      const shouldSkip = gesture.dx < -68 || gesture.vx < -0.75;
      if (shouldSkip) onSkip();
      resetPosition();
    },
    onPanResponderTerminate: resetPosition,
  }), [disabled, onSkip, resetPosition, translateX]);

  return (
    <View style={s.swipeWrap}>
      {!disabled && (
        <View pointerEvents="none" style={s.skipReveal}>
          <Text style={s.skipRevealText}>SKIP</Text>
        </View>
      )}
      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function dateKey(timestamp: number) {
  return new Date(timestamp).toISOString().split('T')[0];
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
        <Text style={custom.readingTitle} numberOfLines={1}>{task.title}</Text>
        <View style={custom.readingMetaRow}>
          {task.time ? (
            <>
              <Clock s={9} c="#7C6FB0" />
              <Text style={custom.readingMeta}>{task.time}</Text>
              <Text style={custom.readingDot}>•</Text>
            </>
          ) : null}
          <Text style={custom.readingMeta} numberOfLines={1}>
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
          <Text style={custom.gratitudeTitle}>{task.title}</Text>
          <View style={custom.gratitudeMetaRow}>
            {task.time ? (
              <>
                <Clock s={9} c="#E11D48" />
                <Text style={custom.gratitudeMeta}>{task.time}</Text>
                <Text style={custom.gratitudeDot}>•</Text>
              </>
            ) : null}
            <Text style={custom.gratitudeMeta} numberOfLines={1}>
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
  tasksWrap: { paddingHorizontal: 20, paddingTop: 18 },
  tasksHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  tasksTitle: { fontFamily: F.serifMedium, fontSize: 22, color: C.text },
  tasksSub: { fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 4 },
  progressWrap: { marginTop: 8 },
  cardsList: { marginTop: 14 },
  swipeWrap: { position: 'relative', marginBottom: 0 },
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
    borderColor: '#E8DCC4',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  emptyTaskTitle: { fontFamily: F.serifMedium, fontSize: 20, color: C.text },
  emptyTaskBody: { marginTop: 5, fontFamily: F.sans, fontSize: 12, lineHeight: 18, color: C.textMuted },
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
    fontSize: 12,
    color: 'rgba(197,160,89,0.7)',
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
  readingMid: { flex: 1, minWidth: 0 },
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
  },
  readingMeta: {
    fontFamily: F.sansMedium,
    fontSize: 10,
    color: '#7C6FB0',
  },
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
  gratitudeMid: { flex: 1, minWidth: 0 },
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
