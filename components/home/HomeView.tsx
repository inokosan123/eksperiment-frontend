import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, InteractionManager, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import WeeklyRhythm from './WeeklyRhythm';
import ExploreSection from './ExploreSection';
import { C, F } from '@/constants/tokens';
import { AnyTaskCard, CompletedTaskCheck, TaskData, TaskState } from '@/components/shared/TaskCards';
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
import { getJournalTaskConfig, getPrayerTaskConfig, getScriptureTaskConfig } from '@/components/tasks/taskDb';
import {
  consumeTaskCompletionReturnAnimations,
  type QueuedCompletionAnimation,
} from '@/components/tasks/taskReturnAnimation';
import type { PrayerTaskConfig, TaskDefinition, TaskDraft } from '@/components/tasks/taskTypes';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import ChallengeCompletionHomeModal from '@/components/challenges/ChallengeCompletionHomeModal';


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

function taskStateToInstanceStatus(state: TaskState, fallback?: string) {
  if (state === 'done') return 'completed';
  if (state === 'skipped') return 'skipped';
  if (state === 'pending' || state === 'active') return 'pending';
  return fallback;
}

function inferScriptureReadingTypeFromTitle(title?: string) {
  const key = String(title ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!key) return undefined;
  if (key.includes('psalter') || key.includes('psalm')) return 'psalter';
  if (key.includes('old_testament')) return 'old_testament';
  if (key.includes('new_testament')) return 'new_testament';
  return undefined;
}

function positiveWholeNumber(value: unknown) {
  const numeric = typeof value === 'number'
    ? value
    : Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return Math.round(numeric);
}

function inferScripturePlannedCount(card: HomeCard, configuredCount?: number) {
  const fromConfig = positiveWholeNumber(configuredCount);
  if (fromConfig) return fromConfig;

  const label = `${card.task.title ?? ''} ${card.task.subtitle ?? ''}`;
  const countMatch = label.match(/\b(\d{1,2})\s*(?:chapter|chapters|psalm|psalms)\b/i)
    ?? label.match(/\b(?:chapter|chapters|psalm|psalms)\s*(?:per\s*day|\/day)?\D{0,8}(\d{1,2})\b/i);
  return positiveWholeNumber(countMatch?.[1]) ?? 1;
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

  return <X s={23} c="#B85C5C" w={2.45} />;
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
  return '#B85C5C';
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

type JournalTaskRoute = '/journal-daily' | '/journal-morning' | '/journal-free';

function journalTaskRouteFromPath(route?: string): JournalTaskRoute | null {
  if (route === '/journal-daily' || route === '/journal-morning' || route === '/journal-free') return route;
  return null;
}

function journalTaskRouteForTechnique(technique?: string | null): JournalTaskRoute {
  if (technique === 'morning_pages') return '/journal-morning';
  if (technique === 'free_writing') return '/journal-free';
  return '/journal-daily';
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

function prayerOptionIdForTaskConfig(config: PrayerTaskConfig) {
  if (config.prayerTaskKind === 'jesus_prayer' || config.prayerType === 'jesus') return 'jesus';

  switch (config.prayerRule) {
    case 'seraphim':
      return 'short';
    case 'short':
      return 'medium';
    case 'breakfast':
    case 'lunch':
    case 'dinner':
      return config.prayerRule;
    case 'standard':
    default:
      return 'standard';
  }
}

function prayerCategoryForTaskConfig(config: PrayerTaskConfig) {
  if (config.prayerTaskKind === 'jesus_prayer' || config.prayerType === 'jesus') return 'jesus';
  if (config.prayerType === 'morning' || config.prayerType === 'evening' || config.prayerType === 'meal') {
    return config.prayerType;
  }
  return null;
}

function isPersonalRuleTaskConfig(config: PrayerTaskConfig | undefined) {
  return config?.prayerTaskKind === 'personal_rule' || config?.prayerRule === 'personal';
}

function shouldLaunchPersonalRuleTimer(config: PrayerTaskConfig | undefined) {
  return isPersonalRuleTaskConfig(config) && config?.prayerType !== 'meal';
}

function isJesusPrayerTaskConfig(config: PrayerTaskConfig | undefined) {
  return config?.prayerTaskKind === 'jesus_prayer' || config?.prayerType === 'jesus';
}

function prayerLaunchForTaskConfig(config: PrayerTaskConfig | undefined) {
  if (!config || isPersonalRuleTaskConfig(config)) return null;
  const category = prayerCategoryForTaskConfig(config);
  if (!category) return null;

  return {
    category,
    optionId: prayerOptionIdForTaskConfig(config),
  };
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
    lineHeight: 22,
    textAlign: 'center',
  },
  ref: { marginTop: 4, fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2.5, color: C.gold },
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
        <NotoEmoji name={normalizeHabitIcon(event.icon)} size={18} />
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

export default function HomeView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { books, ready: readingListReady } = useReadingList();
  const { gratitudeEntries } = useInnerTools();
  const { bigEvents } = useBigEvents();
  const {
    ready: taskBackendReady,
    selectedDate,
    taskDataDate,
    isDateLoading,
    tasks: taskDefinitions,
    listItems: backendTasks,
    refresh: refreshTasks,
    createOrUpdateTask,
    archiveTasksImmediately,
    completeInstance,
    skipInstance,
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
  const [challengeCompletionModal, setChallengeCompletionModal] = useState<{
    title: string;
    completions: QueuedCompletionAnimation[];
  } | null>(null);

  useEffect(() => {
    preloadTaskFeedbackSound();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNowTick(Date.now());
      interval = setInterval(() => {
        setNowTick(Date.now());
      }, 60_000);
    }, 60_000 - (Date.now() % 60_000) + 50);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

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

  const scheduleReturnedCompletionCheck = useCallback((
    completions: QueuedCompletionAnimation[],
    delayMs?: number,
    shouldCancel?: () => boolean,
  ) => {
    const returnedCompletionIds = completions.map(item => item.instanceId);
    if (returnedCompletionIds.length === 0) return;
    const animationDelayMs = delayMs ?? Math.max(...completions.map(item => item.delayMs));

    const doneTimer = setTimeout(() => {
      if (shouldCancel?.()) return;
      void playTaskCompleteFeedback();
      setOptimisticStates(prev => {
        const next = { ...prev };
        for (const instanceId of returnedCompletionIds) {
          next[instanceId] = 'done';
        }
        return next;
      });

      const clearTimer = setTimeout(() => {
        if (shouldCancel?.()) return;
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
    }, animationDelayMs);
    returnAnimationTimersRef.current.push(doneTimer);
  }, []);

  const finishChallengeCompletionModal = useCallback(() => {
    const completions = challengeCompletionModal?.completions ?? [];
    setChallengeCompletionModal(null);
    scheduleReturnedCompletionCheck(completions, 120);
  }, [challengeCompletionModal, scheduleReturnedCompletionCheck]);

  useFocusEffect(
    useCallback(() => {
      void refreshTasksRef.current(getLocalDateKey());
      const returnedCompletions = consumeTaskCompletionReturnAnimations();
      if (returnedCompletions.length === 0) return;
      const challengeCelebration = returnedCompletions.find(
        item => item.celebration?.type === 'challengeComplete',
      )?.celebration;

      markReturnedCompletionsPending(returnedCompletions);

      if (challengeCelebration) {
        setChallengeCompletionModal({
          title: challengeCelebration.title ?? 'Challenge Complete',
          completions: returnedCompletions,
        });
        return;
      }

      let cancelled = false;
      const interactionHandle = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        scheduleReturnedCompletionCheck(returnedCompletions, undefined, () => cancelled);
      });

      return () => {
        cancelled = true;
        interactionHandle.cancel();
      };
    }, [markReturnedCompletionsPending, scheduleReturnedCompletionCheck]),
  );

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

  const homeCards = useMemo<HomeCard[]>(() => {
    if (!taskBackendReady || visibleBackendTasks.length === 0) return [];
    return visibleBackendTasks.map(item => {
      const optimisticState = optimisticStates[item.instance.id];
      return {
        id: item.instance.id,
        taskId: item.instance.taskId,
        instanceId: item.instance.id,
        instanceStatus: optimisticState
          ? taskStateToInstanceStatus(optimisticState, item.instance.status)
          : item.instance.status,
        route: item.route,
        task: optimisticState ? { ...item.card, state: optimisticState } : item.card,
        backend: true,
      };
    });
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
    };

    if (!hasVisibleBackendTasks) return stats;

    for (const card of homeCards) {
      const state = card.task.state;
      if (state !== 'locked') stats.scheduledToday += 1;
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
  } = taskStats;
  // Skip All Day must capture every unresolved task for the day — including
  // past-due ones the reconcile loop already auto-marked as 'missed'. The
  // adapter maps 'missed' → 'locked' for display, so filter on instanceStatus
  // (raw DB status) instead of card state.
  const skipDayDisabled = !canMutateSelectedDate || skippableCards.length === 0;
  const progressTotal = taskContentDate < todayKey && visibleTaskCount > 0 ? visibleTaskCount : scheduledToday;

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

  const resetTaskInstance = useCallback((instanceId: string, date: string) => {
    if (mutatingInstancesRef.current.has(instanceId)) return;
    mutatingInstancesRef.current.add(instanceId);
    playTaskUndoFeedback();
    setOptimisticStates(prev => ({ ...prev, [instanceId]: 'pending' }));
    void resetInstance(instanceId, date)
      .catch(() => {
        setOptimisticStates(prev => {
          const next = { ...prev };
          delete next[instanceId];
          return next;
        });
      })
      .finally(() => {
        mutatingInstancesRef.current.delete(instanceId);
      });
  }, [resetInstance]);

  const completeTaskInstance = useCallback((instanceId: string, date: string) => {
    if (mutatingInstancesRef.current.has(instanceId)) return;
    mutatingInstancesRef.current.add(instanceId);
    void playTaskCompleteFeedback();
    setOptimisticStates(prev => ({ ...prev, [instanceId]: 'done' }));
    void completeInstance(instanceId, date)
      .catch(() => {
        setOptimisticStates(prev => {
          const next = { ...prev };
          delete next[instanceId];
          return next;
        });
      })
      .finally(() => {
        mutatingInstancesRef.current.delete(instanceId);
      });
  }, [completeInstance]);

  const skipTaskInstance = useCallback((instanceId: string, date: string) => {
    if (mutatingInstancesRef.current.has(instanceId)) return;
    mutatingInstancesRef.current.add(instanceId);
    setOptimisticStates(prev => ({ ...prev, [instanceId]: 'skipped' }));
    void skipInstance(instanceId, date)
      .catch(() => {
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

  const openCompletionFlowTask = useCallback(async (card: HomeCard) => {
    if (!card.instanceId) return false;
    if (card.task.variant === 'gratitude' || card.task.type === 'gratitude') {
      router.push({
        pathname: '/gratitude-task',
        params: {
          taskInstanceId: card.instanceId,
          taskDate: taskContentDate,
        },
      } as any);
      return true;
    }

    if (isJournalFlowCandidate(card)) {
      let journalRoute = journalTaskRouteFromPath(card.route);
      if (!journalRoute && card.taskId) {
        const config = await getJournalTaskConfig(card.taskId);
        journalRoute = journalTaskRouteForTechnique(config?.technique ?? config?.journalType);
      }

      router.push({
        pathname: journalRoute ?? '/journal-daily',
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

    if (isSpiritualScriptureCandidate(card) && card.taskId) {
      const config = await getScriptureTaskConfig(card.taskId);
      const readingType = config?.readingType ?? inferScriptureReadingTypeFromTitle(card.task.title) ?? 'custom';
      if (readingType === 'church_calendar') return false;
      const plannedCount = inferScripturePlannedCount(card, config?.chaptersPerDay);
      router.push({
        pathname: '/scripture-checkpoint',
        params: {
          title: card.task.title,
          readingType,
          plannedCount: String(plannedCount),
          taskInstanceId: card.instanceId,
          taskDate: taskContentDate,
        },
      } as any);
      return true;
    }

    if (card.task.variant === 'challenge' && card.task.type === 'reading') {
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
          taskDate: taskContentDate,
        },
      } as any);
      return true;
    }

    if (isPrayerFlowCandidate(card) && card.taskId) {
      const config = await getPrayerTaskConfig(card.taskId);
      if (isJesusPrayerTaskConfig(config)) {
        router.push({
          pathname: '/jesus-prayer',
          params: {
            title: card.task.title,
            mode: config?.jesusPrayerMode ?? 'duration',
            duration: String(config?.jesusPrayerDuration ?? 15),
            count: String(config?.jesusPrayerCount ?? 100),
            isTask: 'true',
            taskInstanceId: card.instanceId,
            taskDate: taskContentDate,
          },
        } as any);
        return true;
      }

      if (shouldLaunchPersonalRuleTimer(config)) {
        router.push({
          pathname: '/personal-rule',
          params: {
            title: card.task.title,
            prayerType: config?.prayerType ?? '',
            isTask: 'true',
            taskInstanceId: card.instanceId,
            taskDate: taskContentDate,
          },
        } as any);
        return true;
      }

      const launch = prayerLaunchForTaskConfig(config);
      if (!launch) return false;

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
    }

    return false;
  }, [books, router, taskContentDate]);

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
    if (isCompletionFlowTask(card)) {
      void openCompletionFlowTask(card)
        .then(handled => {
          if (!handled && card.instanceId) completeTaskInstance(card.instanceId, taskContentDate);
        })
        .catch(() => {
          if (card.instanceId) completeTaskInstance(card.instanceId, taskContentDate);
        });
      return;
    }
    completeTaskInstance(card.instanceId, taskContentDate);
  }, [canMutateSelectedDate, completeTaskInstance, openCompletionFlowTask, taskContentDate]);

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
    await createOrUpdateTask(draft, selectedDate);
  }, [createOrUpdateTask, selectedDate]);

  const confirmSkipAllDay = useCallback(() => {
    setSkipDayConfirmOpen(false);
    if (skippableCards.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    for (const card of skippableCards) {
      if (!card.instanceId) continue;
      void skipInstance(card.instanceId, taskContentDate).catch(() => {});
    }
  }, [skippableCards, skipInstance, taskContentDate]);

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
              {homeCards.map(card => {
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
                        blessingsToday={gratitudeDailyCountForTaskDate}
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
                  <React.Fragment key={card.id}>
                    <SwipeTaskRow
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
                    {activeTimeBridge?.afterCardId === card.id && (
                      <ActiveTimeBridge nextLabel={activeTimeBridge.nextLabel} />
                    )}
                  </React.Fragment>
                );
              })}
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
        <ExploreSection />
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
        onClose={() => setAnalyticsCard(null)}
      />
      <NotificationsSheet
        visible={notificationsOpen}
        selectedDate={selectedDate}
        onClose={() => setNotificationsOpen(false)}
      />
      <ChallengeCompletionHomeModal
        visible={!!challengeCompletionModal}
        title={challengeCompletionModal?.title ?? 'Challenge Complete'}
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
        <View key={goal.id} style={[s.mgRow, goal.isCompleted && s.mgRowDone]}>
          <View pointerEvents="none" style={[s.mgRowHighlight, goal.isCompleted && s.mgRowHighlightDone]} />
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
        iconBg="#FFF1F2"
        title="Uncheck this goal?"
        body="Do you want to mark this goal as incomplete?"
        subject={uncheckConfirm?.text}
        confirmLabel="UNCHECK"
        confirmColor="#B85C5C"
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
      {isDone ? (
        <CompletedTaskCheck size={36} accent="#6D28D9" />
      ) : (
        <View style={custom.readingCheck}>
          <CircleIcon s={18} c="rgba(109,40,217,0.30)" w={2} />
        </View>
      )}

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
        {isDone ? (
          <CompletedTaskCheck size={36} accent="#E11D48" />
        ) : (
          <View style={custom.gratitudeCheck}>
            <CircleIcon s={19} c="#F472B6" w={2} />
          </View>
        )}

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
  tasksWrap: { paddingHorizontal: 20, paddingTop: 12 },
  tasksHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  tasksTitle: { fontFamily: F.serifMedium, fontSize: 22, color: C.text },
  tasksSub: { fontFamily: F.sans, fontSize: 12, color: C.textMuted, marginTop: 4 },
  progressWrap: { marginTop: 8 },
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
    columnGap: 11,
    backgroundColor: '#FFFDFC',
    borderRadius: 20,
    borderWidth: 1.4,
    borderColor: 'rgba(197,160,89,0.54)',
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 7,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#C5A059',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 2,
  },
  mgRowDone: {
    backgroundColor: '#FFFDF4',
    borderColor: 'rgba(197,160,89,0.62)',
  },
  mgRowHighlight: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 0,
    height: 1.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  mgRowHighlightDone: {
    backgroundColor: 'rgba(255,255,255,0.74)',
  },
  mgRowText: {
    fontFamily: F.serifMedium,
    fontSize: 19,
    lineHeight: 24.4,
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
