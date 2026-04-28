import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Book,
  BookMarked,
  CalendarCheck,
  CheckSmall,
  ChevronDown,
  Cross,
  Feather,
  Flame,
  Moon,
  Notebook,
  OpenBook,
  Pause,
  Pencil,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  Trophy,
  Utensils,
  X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { useChallenges } from '@/components/challenges/ChallengesContext';
import NotificationSettings, { type NotificationMode } from '@/components/shared/NotificationSettings';
import {
  ChallengeCatalogEntry,
  ChallengeIconKey,
  ChallengePrayerConfig,
  ChallengeRecord,
  GROUP_ORDER,
} from '@/components/challenges/challengeData';
import type { TaskDraft, TaskSchedule, TaskType } from '@/components/tasks/taskTypes';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DateTimePickerModule = Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker');
const NativeDateTimePicker = DateTimePickerModule?.default ?? null;
const NativeDateTimePickerAndroid = DateTimePickerModule?.DateTimePickerAndroid ?? null;

if (Platform.OS === 'android' && typeof UIManager.setLayoutAnimationEnabledExperimental === 'function') {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TaskSheetContext = 'prayer' | 'journal' | 'scripture';
type TaskTab = 'spiritual' | 'challenge';
type RuleFrequency = 'daily' | 'weekdays' | 'weekends' | 'specific_days' | 'monthly';
type PrayerType = 'morning' | 'evening' | 'meal' | 'jesus' | 'custom';
type JournalTechnique = 'daily' | 'morning_pages' | 'free_writing';
type ScriptureReadingType = 'new_testament' | 'old_testament' | 'psalter' | 'church_calendar' | 'custom';
type PrayerRuleChoice = 'standard' | 'short' | 'seraphim' | 'personal' | 'breakfast' | 'lunch' | 'dinner';
type PrayerChallengeRuleChoice = Extract<PrayerRuleChoice, 'standard' | 'short' | 'seraphim' | 'personal'>;
type JesusPrayerMode = 'duration' | 'count';

type ScheduleDraft = {
  time: string;
  frequency: RuleFrequency;
  selectedDays: number[];
  monthlyDays: number[];
  sameTimeEveryDay: boolean;
  dayTimes: Record<number, string>;
  notificationMode: NotificationMode;
  reminderMinutes: number;
};

type ChallengeScheduleDraft = {
  time: string;
  sameTimeEveryDay: boolean;
  dayTimes: Record<number, string>;
  notificationMode: NotificationMode;
  reminderMinutes: number;
};

type Props = {
  visible: boolean;
  context: TaskSheetContext;
  onClose: () => void;
  onSummaryChange?: (subtitle: string) => void;
  onTaskDraft?: (draft: TaskDraft) => void | Promise<unknown>;
};

type ChallengeConfirmAction = {
  mode: 'pause' | 'end';
  item: ChallengeRecord;
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const PRAYER_TYPES: {
  key: PrayerType;
  label: string;
  short: string;
  Icon: React.ComponentType<{ s?: number; c?: string; w?: number }>;
  accent: string;
  tint: string;
  border: string;
  defaultTitle: string;
  defaultTime: string;
}[] = [
  { key: 'morning', label: 'Morning', short: 'MORN', Icon: Sun, accent: '#D59D2C', tint: '#FFF7E7', border: '#F0D8A8', defaultTitle: 'Morning Prayer', defaultTime: '07:00' },
  { key: 'evening', label: 'Evening', short: 'EVE', Icon: Moon, accent: '#7867C6', tint: '#F3F0FF', border: '#DDD5FF', defaultTitle: 'Evening Prayer', defaultTime: '21:00' },
  { key: 'meal', label: 'Meals', short: 'MEALS', Icon: Utensils, accent: '#7D8FC9', tint: '#F1F5FF', border: '#D9E1F7', defaultTitle: 'Meal Prayer', defaultTime: '12:00' },
  { key: 'jesus', label: 'Jesus', short: 'JESUS', Icon: Sparkles, accent: '#B98228', tint: '#FFF3E2', border: '#E9C98E', defaultTitle: 'Jesus Prayer', defaultTime: '13:00' },
  { key: 'custom', label: 'Custom', short: 'CUSTOM', Icon: Feather, accent: '#5F9F97', tint: '#EDF8F6', border: '#CBE7E3', defaultTitle: 'Custom Prayer', defaultTime: '08:00' },
];

const JOURNAL_TECHNIQUES: {
  key: JournalTechnique;
  label: string;
  Icon: React.ComponentType<{ s?: number; c?: string; w?: number }>;
  color: string;
  defaultTitle: string;
  defaultTime: string;
}[] = [
  { key: 'daily', label: 'Daily Journal', Icon: Pencil, color: '#C5A059', defaultTitle: 'Daily Journal', defaultTime: '21:30' },
  { key: 'morning_pages', label: 'Morning Pages', Icon: Feather, color: '#7C6EAF', defaultTitle: 'Morning Pages', defaultTime: '07:15' },
  { key: 'free_writing', label: 'Free Writing', Icon: Notebook, color: '#4A9E8F', defaultTitle: 'Free Writing', defaultTime: '20:45' },
];

const SCRIPTURE_TYPES: {
  key: ScriptureReadingType;
  label: string;
  Icon: React.ComponentType<{ s?: number; c?: string; w?: number }>;
  defaultTitle: string;
  accent: string;
}[] = [
  { key: 'new_testament', label: 'New Testament', Icon: OpenBook, defaultTitle: 'New Testament Reading', accent: '#5E7B55' },
  { key: 'old_testament', label: 'Old Testament', Icon: Book, defaultTitle: 'Old Testament Reading', accent: '#A97732' },
  { key: 'psalter', label: 'Psalter', Icon: BookMarked, defaultTitle: 'Psalter Reading', accent: '#C58A2D' },
  { key: 'church_calendar', label: 'Church Readings', Icon: CalendarCheck, defaultTitle: 'Church Calendar Reading', accent: '#7B915D' },
  { key: 'custom', label: 'Custom', Icon: Sparkles, defaultTitle: 'Custom Scripture Reading', accent: '#7C6EAF' },
];

const PRAYER_RULES: Record<Exclude<PrayerType, 'jesus' | 'custom'>, { key: PrayerRuleChoice; label: string; desc: string }[]> = {
  morning: [
    { key: 'personal', label: 'Personal Rule', desc: 'Reading from your physical prayer book' },
    { key: 'standard', label: 'Standard Rule', desc: 'Full morning prayers' },
    { key: 'short', label: 'Shortened Rule', desc: 'Abbreviated prayer rule' },
    { key: 'seraphim', label: 'St. Seraphim Rule', desc: 'Rule of St. Seraphim of Sarov' },
  ],
  evening: [
    { key: 'personal', label: 'Personal Rule', desc: 'Reading from your physical prayer book' },
    { key: 'standard', label: 'Standard Rule', desc: 'Full evening prayers' },
    { key: 'short', label: 'Shortened Rule', desc: 'Abbreviated prayer rule' },
    { key: 'seraphim', label: 'St. Seraphim Rule', desc: 'Rule of St. Seraphim of Sarov' },
  ],
  meal: [
    { key: 'breakfast', label: 'Breakfast Prayer', desc: 'Prayer before the morning meal' },
    { key: 'lunch', label: 'Lunch Prayer', desc: 'Prayer before the midday meal' },
    { key: 'dinner', label: 'Dinner Prayer', desc: 'Prayer before the evening meal' },
  ],
};

const FULL_FREQUENCY_OPTIONS: { value: RuleFrequency; label: string; desc: string }[] = [
  { value: 'daily', label: 'Daily', desc: 'Every day' },
  { value: 'weekdays', label: 'Weekdays', desc: 'Mon - Fri' },
  { value: 'weekends', label: 'Weekends', desc: 'Sat - Sun' },
  { value: 'monthly', label: 'Monthly', desc: 'Days of month' },
  { value: 'specific_days', label: 'Specific Days', desc: 'Choose days' },
];

const TIME_WHEEL_ITEM_HEIGHT = 44;
const TIME_WHEEL_VISIBLE_ROWS = 5;
const TIME_WHEEL_PADDING = TIME_WHEEL_ITEM_HEIGHT * 2;
const TIME_WHEEL_HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const TIME_WHEEL_MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

function defaultSchedule(time = '08:00', notificationMode: NotificationMode = 'none'): ScheduleDraft {
  return {
    time,
    frequency: 'daily',
    selectedDays: [],
    monthlyDays: [1],
    sameTimeEveryDay: true,
    dayTimes: {},
    notificationMode,
    reminderMinutes: 15,
  };
}

function defaultChallengeSchedule(time = '08:00', notificationMode: NotificationMode = 'single'): ChallengeScheduleDraft {
  return {
    time,
    sameTimeEveryDay: true,
    dayTimes: {},
    notificationMode,
    reminderMinutes: 15,
  };
}

function scheduleDraftToTaskSchedule(schedule: ScheduleDraft): TaskSchedule {
  return {
    frequency: schedule.frequency,
    selectedDays: schedule.frequency === 'specific_days' ? schedule.selectedDays : [],
    monthlyDays: schedule.frequency === 'monthly' ? schedule.monthlyDays : [1],
    time: schedule.time,
    sameTimeEveryDay: schedule.sameTimeEveryDay,
    dayTimes: schedule.sameTimeEveryDay ? {} : schedule.dayTimes,
  };
}

function challengeScheduleToTaskSchedule(schedule: ChallengeScheduleDraft): TaskSchedule {
  return {
    frequency: 'daily',
    selectedDays: [],
    monthlyDays: [1],
    time: schedule.time,
    sameTimeEveryDay: schedule.sameTimeEveryDay,
    dayTimes: schedule.sameTimeEveryDay ? {} : schedule.dayTimes,
  };
}

function taskTypeForChallengeCategory(category: ChallengeCatalogEntry['category']): TaskType {
  switch (category) {
    case 'prayer':
      return 'prayer';
    case 'journal':
      return 'journal';
    case 'scripture':
      return 'reading';
    case 'church':
      return 'church';
    default:
      return 'custom';
  }
}

function journalTypeForChallenge(entry: ChallengeCatalogEntry) {
  if (entry.templateId.includes('morning')) return 'morning_pages' as const;
  if (entry.templateId.includes('free')) return 'free_writing' as const;
  return 'daily' as const;
}

function scriptureReadingTypeForChallenge(entry: ChallengeCatalogEntry) {
  if (entry.groupKey === 'psalter') return 'psalter' as const;
  if (entry.groupKey === 'old_testament') return 'old_testament' as const;
  if (entry.groupKey === 'lectionary') return 'church_calendar' as const;
  return 'new_testament' as const;
}

function challengeCategoryForContext(context: TaskSheetContext) {
  switch (context) {
    case 'prayer': return 'prayer';
    case 'journal': return 'journal';
    case 'scripture': return 'scripture';
  }
}

function challengeIcon(icon: ChallengeIconKey, color: string) {
  const common = { s: 18, c: color, w: 1.9 };
  switch (icon) {
    case 'sun': return <Sun {...common} />;
    case 'moon': return <Moon {...common} />;
    case 'sparkles': return <Sparkles {...common} />;
    case 'book': return <Book {...common} />;
    case 'openBook': return <OpenBook {...common} />;
    case 'bookMarked': return <BookMarked {...common} />;
    case 'calendarCheck': return <CalendarCheck {...common} />;
    case 'feather': return <Feather {...common} />;
    case 'notebook': return <Notebook {...common} />;
    case 'cross': return <Cross {...common} />;
    default: return <Sparkles {...common} />;
  }
}

function formatMonthlyDays(days: number[]) {
  return [...days]
    .sort((a, b) => a - b)
    .map(day => `${day}`)
    .join(', ');
}

function parseTimeParts(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  const hour = match ? Math.min(23, Math.max(0, Number(match[1]))) : 8;
  const minute = match ? Number(match[2]) : 0;
  const roundedMinute = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]
    .reduce((closest, candidate) => (
      Math.abs(candidate - minute) < Math.abs(closest - minute) ? candidate : closest
    ), 0);

  return {
    hour: String(hour).padStart(2, '0'),
    minute: String(roundedMinute).padStart(2, '0'),
  };
}

function formatTimeValue(hour: string, minute: string) {
  return `${hour}:${minute}`;
}

function formatTimeFromDate(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatSummaryFrequency(
  scheduleOrFrequency: ScheduleDraft | RuleFrequency,
  selectedDays: number[] = [],
  monthlyDays: number[] = [1],
) {
  const schedule = typeof scheduleOrFrequency === 'string'
    ? {
        frequency: scheduleOrFrequency,
        selectedDays,
        monthlyDays,
      }
    : scheduleOrFrequency;

  switch (schedule.frequency) {
    case 'weekdays': return 'Mon - Fri';
    case 'weekends': return 'Sat - Sun';
    case 'monthly':
      return schedule.monthlyDays.length
        ? `Monthly on ${formatMonthlyDays(schedule.monthlyDays)}`
        : 'Monthly';
    case 'specific_days':
      return schedule.selectedDays.length
        ? schedule.selectedDays.map(day => WEEKDAY_LABELS[day]).join(' ')
        : 'Selected days';
    case 'daily':
    default:
      return 'Daily';
  }
}

function groupedEntries(entries: ChallengeCatalogEntry[]) {
  return [...entries].sort((a, b) => {
    const groupDiff = GROUP_ORDER.indexOf(a.groupKey) - GROUP_ORDER.indexOf(b.groupKey);
    if (groupDiff !== 0) return groupDiff;
    return a.title.localeCompare(b.title);
  });
}

function isScriptureChallengeEntry(entry: ChallengeCatalogEntry | null) {
  return !!entry && entry.category === 'scripture';
}

function needsScriptureDailyAmount(entry: ChallengeCatalogEntry | null) {
  return isScriptureChallengeEntry(entry) && entry?.id !== 'lectionary_daily';
}

function scriptureDailyAmountLabel(entry: ChallengeCatalogEntry | null, amount: number) {
  const isPsalter = entry?.groupKey === 'psalter';
  const singular = isPsalter ? 'psalm' : 'chapter';
  const plural = isPsalter ? 'psalms' : 'chapters';
  return `${amount} ${amount === 1 ? singular : plural}/day`;
}

function scriptureDailyAmountTitle(entry: ChallengeCatalogEntry | null) {
  return entry?.groupKey === 'psalter' ? 'Psalms per Day' : 'Chapters per Day';
}

function scriptureApproxDays(entry: ChallengeCatalogEntry | null, amount: number) {
  if (!entry?.totalUnits || !needsScriptureDailyAmount(entry)) return null;
  return Math.max(1, Math.ceil(entry.totalUnits / Math.max(1, amount)));
}

function isPrayerRuleChallenge(entry: ChallengeCatalogEntry | ChallengeRecord | null) {
  return !!entry && (
    entry.id === 'prayer_morning'
    || entry.id === 'prayer_evening'
    || entry.templateId === 'prayer_morning'
    || entry.templateId === 'prayer_evening'
  );
}

function isJesusPrayerChallenge(entry: ChallengeCatalogEntry | ChallengeRecord | null) {
  return entry?.id === 'prayer_jesus' || entry?.templateId === 'prayer_jesus';
}

function prayerRuleSummary(rule: PrayerRuleChoice) {
  switch (rule) {
    case 'standard': return 'Standard Rule';
    case 'short': return 'Shortened Rule';
    case 'seraphim': return 'St. Seraphim Rule';
    case 'personal': return 'Personal Rule';
    case 'breakfast': return 'Breakfast Prayer';
    case 'lunch': return 'Lunch Prayer';
    case 'dinner': return 'Dinner Prayer';
    default: return 'Prayer Rule';
  }
}

function jesusPrayerSummary(mode: JesusPrayerMode, duration: string, count: string) {
  const value = mode === 'duration'
    ? Math.max(1, Number.parseInt(duration || '15', 10) || 15)
    : Math.max(1, Number.parseInt(count || '100', 10) || 100);
  return mode === 'duration' ? `${value} min` : `${value} times`;
}

function prayerChallengeDetail(
  entry: ChallengeCatalogEntry | ChallengeRecord | null,
  rule: PrayerChallengeRuleChoice,
  mode: JesusPrayerMode,
  duration: string,
  count: string,
) {
  if (isJesusPrayerChallenge(entry)) return jesusPrayerSummary(mode, duration, count);
  if (isPrayerRuleChallenge(entry)) return prayerRuleSummary(rule);
  return null;
}

function buildPrayerChallengeConfig(
  entry: ChallengeCatalogEntry | ChallengeRecord,
  rule: PrayerChallengeRuleChoice,
  mode: JesusPrayerMode,
  duration: string,
  count: string,
  schedule: ChallengeScheduleDraft,
): ChallengePrayerConfig | undefined {
  if (isJesusPrayerChallenge(entry)) {
    return {
      taskKind: 'jesus_prayer',
      jesusPrayerMode: mode,
      jesusPrayerDuration: mode === 'duration' ? Number.parseInt(duration || '15', 10) || 15 : undefined,
      jesusPrayerCount: mode === 'count' ? Number.parseInt(count || '100', 10) || 100 : undefined,
      time: schedule.time,
      sameTimeEveryDay: schedule.sameTimeEveryDay,
      dayTimes: schedule.sameTimeEveryDay ? {} : schedule.dayTimes,
      notificationMode: schedule.notificationMode,
      reminderMinutes: schedule.notificationMode === 'double' ? schedule.reminderMinutes : undefined,
    };
  }

  if (!isPrayerRuleChallenge(entry)) return undefined;

  return {
    taskKind: rule === 'personal' ? 'personal_rule' : 'guided_rule',
    prayerType: entry.id === 'prayer_evening' || entry.templateId === 'prayer_evening' ? 'evening' : 'morning',
    prayerRule: rule,
    time: schedule.time,
    sameTimeEveryDay: schedule.sameTimeEveryDay,
    dayTimes: schedule.sameTimeEveryDay ? {} : schedule.dayTimes,
    notificationMode: schedule.notificationMode,
    reminderMinutes: schedule.notificationMode === 'double' ? schedule.reminderMinutes : undefined,
  };
}

function useSelectionMotion(active: boolean) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: active ? 1 : 0,
      friction: 15,
      tension: 145,
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  return progress;
}

function animateSoftLayoutChange() {
  try {
    LayoutAnimation.configureNext({
      duration: 280,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  } catch {
    // LayoutAnimation is native-first; web can safely ignore this.
  }
}

function animateChallengeListChange() {
  try {
    LayoutAnimation.configureNext({
      duration: 380,
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  } catch {
    // Web may no-op LayoutAnimation; native still gets the polished transition.
  }
}

export default function SetAsTaskSheet({
  visible,
  context,
  onClose,
  onSummaryChange,
  onTaskDraft,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const {
    activeChallenges,
    pausedChallenges,
    availableCatalogEntries,
    startChallenge,
    updateChallenge,
    pauseChallenge,
    resumeChallenge,
    endChallenge,
  } = useChallenges();

  const [taskTab, setTaskTab] = useState<TaskTab>('spiritual');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [expandedChallengeId, setExpandedChallengeId] = useState<string | null>(null);

  const [prayerType, setPrayerType] = useState<PrayerType | null>(null);
  const [prayerTitle, setPrayerTitle] = useState('');
  const [prayerRule, setPrayerRule] = useState<PrayerRuleChoice>('standard');
  const [jesusMode, setJesusMode] = useState<JesusPrayerMode>('duration');
  const [jesusDuration, setJesusDuration] = useState('15');
  const [jesusCount, setJesusCount] = useState('100');
  const [prayerSchedule, setPrayerSchedule] = useState<ScheduleDraft>(defaultSchedule('08:00'));

  const [journalTechnique, setJournalTechnique] = useState<JournalTechnique>('daily');
  const [journalTime, setJournalTime] = useState<ScheduleDraft>(defaultSchedule('21:30'));

  const [scriptureType, setScriptureType] = useState<ScriptureReadingType | null>(null);
  const [scriptureTitle, setScriptureTitle] = useState('');
  const [scriptureSchedule, setScriptureSchedule] = useState<ScheduleDraft>(defaultSchedule('08:00'));
  const [scriptureDailyAmount, setScriptureDailyAmount] = useState(1);

  const [challengeSchedule, setChallengeSchedule] = useState<ChallengeScheduleDraft>(defaultChallengeSchedule('08:00'));
  const [selectedPaceId, setSelectedPaceId] = useState<string | null>(null);
  const [challengeScriptureDailyAmount, setChallengeScriptureDailyAmount] = useState(1);
  const [challengePrayerRule, setChallengePrayerRule] = useState<PrayerChallengeRuleChoice>('personal');
  const [challengeJesusMode, setChallengeJesusMode] = useState<JesusPrayerMode>('duration');
  const [challengeJesusDuration, setChallengeJesusDuration] = useState('15');
  const [challengeJesusCount, setChallengeJesusCount] = useState('100');
  const [recentlyStartedTemplateId, setRecentlyStartedTemplateId] = useState<string | null>(null);
  const contentScrollRef = useRef<ScrollView>(null);
  const recentStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetProgress = useRef(new Animated.Value(0)).current;
  const tabMotion = useRef(new Animated.Value(0)).current;
  const tabContentMotion = useRef(new Animated.Value(1)).current;
  const [mounted, setMounted] = useState(visible);
  const [segmentWidth, setSegmentWidth] = useState(0);

  const activeForContext = useMemo(
    () => activeChallenges.filter(item => item.category === challengeCategoryForContext(context)),
    [activeChallenges, context],
  );
  const pausedForContext = useMemo(
    () => pausedChallenges.filter(item => item.category === challengeCategoryForContext(context)),
    [context, pausedChallenges],
  );
  const availableForContext = useMemo(
    () => groupedEntries(availableCatalogEntries.filter(item => item.category === challengeCategoryForContext(context))),
    [availableCatalogEntries, context],
  );
  const selectedCatalog = useMemo(
    () => availableForContext.find(item => item.id === selectedCatalogId) ?? null,
    [availableForContext, selectedCatalogId],
  );

  useEffect(() => {
    if (!visible) return;
    setTaskTab('spiritual');
    setSelectedCatalogId(null);
    setExpandedChallengeId(null);
  }, [context, visible]);

  useEffect(() => {
    Animated.spring(tabMotion, {
      toValue: taskTab === 'challenge' ? 1 : 0,
      friction: 16,
      tension: 145,
      useNativeDriver: false,
    }).start();

    tabContentMotion.setValue(0);
    Animated.timing(tabContentMotion, {
      toValue: 1,
      duration: 230,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tabContentMotion, tabMotion, taskTab]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      requestAnimationFrame(() => {
        Animated.timing(sheetProgress, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
      return;
    }

    Animated.timing(sheetProgress, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [sheetProgress, visible]);

  useEffect(() => () => {
    if (recentStartTimerRef.current) {
      clearTimeout(recentStartTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (context !== 'journal') return;
    const draft = JOURNAL_TECHNIQUES.find(item => item.key === journalTechnique);
    if (!draft) return;
    setJournalTime(current => ({ ...current, time: current.time || draft.defaultTime }));
  }, [context, journalTechnique]);

  const selectPrayerType = (next: PrayerType) => {
    setPrayerType(next);
    const meta = PRAYER_TYPES.find(item => item.key === next);
    setPrayerTitle(meta?.defaultTitle ?? 'Prayer');
    setPrayerSchedule(defaultSchedule(meta?.defaultTime ?? '08:00'));
    setPrayerRule(next === 'meal' ? 'breakfast' : (next === 'morning' || next === 'evening' ? 'personal' : 'standard'));
    setJesusMode('duration');
    setJesusDuration('15');
    setJesusCount('100');
  };

  const selectScriptureType = (next: ScriptureReadingType) => {
    const meta = SCRIPTURE_TYPES.find(item => item.key === next);
    setScriptureType(next);
    setScriptureTitle(meta?.defaultTitle ?? 'Scripture Reading');
    setScriptureSchedule(defaultSchedule(next === 'psalter' ? '06:45' : next === 'church_calendar' ? '06:30' : '08:00'));
    setScriptureDailyAmount(1);
  };

  const openChallengeSetup = (entry: ChallengeCatalogEntry) => {
    animateSoftLayoutChange();
    setExpandedChallengeId(null);
    if (selectedCatalogId === entry.id) {
      setSelectedCatalogId(null);
      return;
    }
    setSelectedCatalogId(entry.id);
    setSelectedPaceId(entry.paceOptions?.[0]?.id ?? null);
    setChallengeSchedule(defaultChallengeSchedule(entry.defaultTime ?? '08:00'));
    setChallengeScriptureDailyAmount(1);
    setChallengePrayerRule('personal');
    setChallengeJesusMode('duration');
    setChallengeJesusDuration('15');
    setChallengeJesusCount('100');
    setTaskTab('challenge');
  };

  const switchTaskTab = (nextTab: TaskTab) => {
    if (taskTab === nextTab) return;
    animateSoftLayoutChange();
    setTaskTab(nextTab);
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  };

  const handleSaveSpiritual = () => {
    if (context === 'prayer') {
      if (!prayerType || !prayerTitle.trim()) return;
      const prayerDetail = prayerType === 'jesus'
        ? jesusPrayerSummary(jesusMode, jesusDuration, jesusCount)
        : prayerRuleSummary(prayerRule);
      void onTaskDraft?.({
        title: prayerTitle.trim(),
        subtitle: `${prayerDetail} - ${formatSummaryFrequency(prayerSchedule)}`,
        level: 1,
        source: 'spiritual',
        type: 'prayer',
        targetView: '/prayer',
        schedule: scheduleDraftToTaskSchedule(prayerSchedule),
        notificationMode: prayerSchedule.notificationMode,
        reminderMinutes: prayerSchedule.notificationMode === 'double' ? prayerSchedule.reminderMinutes : undefined,
        prayerConfig: {
          prayerType,
          prayerRule,
          prayerTaskKind: prayerType === 'jesus'
            ? 'jesus_prayer'
            : prayerRule === 'personal'
              ? 'personal_rule'
              : 'guided_rule',
          jesusPrayerMode: prayerType === 'jesus' ? jesusMode : undefined,
          jesusPrayerDuration: prayerType === 'jesus' && jesusMode === 'duration' ? Number.parseInt(jesusDuration || '15', 10) || 15 : undefined,
          jesusPrayerCount: prayerType === 'jesus' && jesusMode === 'count' ? Number.parseInt(jesusCount || '100', 10) || 100 : undefined,
        },
      });
      onSummaryChange?.(`${prayerTitle.trim()} · ${prayerDetail} · ${formatSummaryFrequency(prayerSchedule)} · ${prayerSchedule.time}`);
    }

    if (context === 'journal') {
      const technique = JOURNAL_TECHNIQUES.find(item => item.key === journalTechnique);
      if (!technique) return;
      void onTaskDraft?.({
        title: technique.defaultTitle,
        subtitle: `${formatSummaryFrequency(journalTime)} - ${journalTime.time}`,
        level: 1,
        source: 'spiritual',
        type: 'journal',
        targetView: journalTechnique === 'daily'
          ? '/journal-daily'
          : journalTechnique === 'morning_pages'
            ? '/journal-morning'
            : '/journal-free',
        schedule: scheduleDraftToTaskSchedule(journalTime),
        notificationMode: journalTime.notificationMode,
        reminderMinutes: journalTime.notificationMode === 'double' ? journalTime.reminderMinutes : undefined,
        journalConfig: {
          journalType: journalTechnique,
          technique: journalTechnique,
        },
      });
      onSummaryChange?.(`${technique.label} · ${formatSummaryFrequency(journalTime)} · ${journalTime.time}`);
    }

    if (context === 'scripture') {
      if (!scriptureType || !scriptureTitle.trim()) return;
      void onTaskDraft?.({
        title: scriptureTitle.trim(),
        subtitle: `${formatSummaryFrequency(scriptureSchedule)} - ${scriptureSchedule.time}`,
        level: 1,
        source: 'spiritual',
        type: 'reading',
        targetView: '/scripture',
        schedule: scheduleDraftToTaskSchedule(scriptureSchedule),
        notificationMode: scriptureSchedule.notificationMode,
        reminderMinutes: scriptureSchedule.notificationMode === 'double' ? scriptureSchedule.reminderMinutes : undefined,
        scriptureConfig: {
          readingType: scriptureType,
          chaptersPerDay: scriptureType === 'church_calendar' ? 0 : 1,
          totalUnitsRead: 0,
        },
      });
      onSummaryChange?.(`${scriptureTitle.trim()} · ${formatSummaryFrequency(scriptureSchedule)} · ${scriptureSchedule.time}`);
    }

    onClose();
  };

  const playChallengeStartTransition = (entry: ChallengeCatalogEntry) => {
    animateChallengeListChange();
    setTaskTab('challenge');
    setRecentlyStartedTemplateId(entry.templateId);

    if (recentStartTimerRef.current) {
      clearTimeout(recentStartTimerRef.current);
    }

    recentStartTimerRef.current = setTimeout(() => {
      setRecentlyStartedTemplateId(current => current === entry.templateId ? null : current);
    }, 1600);

    setTimeout(() => {
      contentScrollRef.current?.scrollTo({ y: 0, animated: true });
    }, 180);
  };

  const handleStartChallenge = () => {
    if (!selectedCatalog) return;
    const selectedPace = selectedCatalog.paceOptions?.find(item => item.id === selectedPaceId) ?? null;
    const prayerDetail = prayerChallengeDetail(
      selectedCatalog,
      challengePrayerRule,
      challengeJesusMode,
      challengeJesusDuration,
      challengeJesusCount,
    );
    const paceParts = [selectedPace?.label, prayerDetail].filter(Boolean) as string[];
    const prayerConfig = buildPrayerChallengeConfig(
      selectedCatalog,
      challengePrayerRule,
      challengeJesusMode,
      challengeJesusDuration,
      challengeJesusCount,
      challengeSchedule,
    );

    playChallengeStartTransition(selectedCatalog);
    startChallenge(selectedCatalog.id, selectedPace, selectedCatalog.category === 'prayer' ? {
      time: challengeSchedule.time,
      paceLabel: paceParts.join(' · '),
      prayerConfig,
    } : undefined);
    void onTaskDraft?.({
      title: selectedCatalog.title,
      subtitle: `${paceParts.join(' - ') || selectedCatalog.scheduleLabel} - ${challengeSchedule.time}`,
      level: 1,
      source: 'challenge',
      type: taskTypeForChallengeCategory(selectedCatalog.category),
      targetView: '/challenges',
      targetTab: selectedCatalog.category,
      schedule: challengeScheduleToTaskSchedule(challengeSchedule),
      notificationMode: challengeSchedule.notificationMode,
      reminderMinutes: challengeSchedule.notificationMode === 'double' ? challengeSchedule.reminderMinutes : undefined,
      challengeConfig: {
        challengeId: selectedCatalog.id,
        templateId: selectedCatalog.templateId,
        progressCurrent: 0,
        progressTotal: selectedCatalog.totalUnits,
        progressUnit: selectedCatalog.category === 'church' ? 'weeks' : 'days',
      },
      prayerConfig: selectedCatalog.category === 'prayer' && prayerConfig
        ? {
            prayerType: prayerConfig.prayerType,
            prayerRule: prayerConfig.prayerRule,
            prayerTaskKind: prayerConfig.taskKind,
            jesusPrayerMode: prayerConfig.jesusPrayerMode,
            jesusPrayerDuration: prayerConfig.jesusPrayerDuration,
            jesusPrayerCount: prayerConfig.jesusPrayerCount,
          }
        : undefined,
      journalConfig: selectedCatalog.category === 'journal'
        ? {
            journalType: journalTypeForChallenge(selectedCatalog),
            technique: journalTypeForChallenge(selectedCatalog),
          }
        : undefined,
    });
    const paceLabel = paceParts.length ? ` · ${paceParts.join(' · ')}` : '';
    onSummaryChange?.(`${selectedCatalog.title}${paceLabel} · ${challengeSchedule.time}`);
    setSelectedCatalogId(null);
  };

  const handleConfiguredChallengeStart = () => {
    if (!selectedCatalog) return;
    playChallengeStartTransition(selectedCatalog);

    if (selectedCatalog.category === 'scripture') {
      const totalDays = scriptureApproxDays(selectedCatalog, challengeScriptureDailyAmount);
      const paceLabel = needsScriptureDailyAmount(selectedCatalog)
        ? scriptureDailyAmountLabel(selectedCatalog, challengeScriptureDailyAmount)
        : undefined;

      startChallenge(selectedCatalog.id, null, {
        time: challengeSchedule.time,
        scheduleLabel: selectedCatalog.scheduleLabel,
        paceLabel,
        totalUnits: selectedCatalog.totalUnits,
        durationDays: selectedCatalog.id === 'lectionary_daily' ? 365 : (totalDays ?? undefined),
        progressCurrent: 0,
        progressTotal: selectedCatalog.id === 'lectionary_daily' ? 0 : (totalDays ?? undefined),
        progressUnit: 'days',
        headline: selectedCatalog.id === 'lectionary_daily'
          ? 'Day 1'
          : `Day 1 of ${totalDays ?? 1}`,
        subline: selectedCatalog.id === 'lectionary_daily'
          ? 'Church-calendar daily readings'
          : `0/${totalDays ?? 1} days completed`,
        showBar: selectedCatalog.id !== 'lectionary_daily',
        scriptureConfig: {
          chaptersPerDay: selectedCatalog.id === 'lectionary_daily' ? 0 : challengeScriptureDailyAmount,
          time: challengeSchedule.time,
          sameTimeEveryDay: challengeSchedule.sameTimeEveryDay,
          dayTimes: challengeSchedule.sameTimeEveryDay ? {} : challengeSchedule.dayTimes,
          notificationMode: challengeSchedule.notificationMode,
          reminderMinutes: challengeSchedule.notificationMode === 'double' ? challengeSchedule.reminderMinutes : undefined,
        },
      });

      void onTaskDraft?.({
        title: selectedCatalog.title,
        subtitle: `${paceLabel ?? selectedCatalog.scheduleLabel} - ${challengeSchedule.time}`,
        level: 1,
        source: 'challenge',
        type: 'reading',
        targetView: '/challenges',
        targetTab: selectedCatalog.category,
        schedule: challengeScheduleToTaskSchedule(challengeSchedule),
        notificationMode: challengeSchedule.notificationMode,
        reminderMinutes: challengeSchedule.notificationMode === 'double' ? challengeSchedule.reminderMinutes : undefined,
        scriptureConfig: {
          readingType: scriptureReadingTypeForChallenge(selectedCatalog),
          chaptersPerDay: selectedCatalog.id === 'lectionary_daily' ? 0 : challengeScriptureDailyAmount,
          totalUnitsRead: 0,
        },
        challengeConfig: {
          challengeId: selectedCatalog.id,
          templateId: selectedCatalog.templateId,
          progressCurrent: 0,
          progressTotal: selectedCatalog.id === 'lectionary_daily' ? 0 : (totalDays ?? selectedCatalog.totalUnits),
          progressUnit: 'days',
        },
      });

      const summaryBits = [
        selectedCatalog.title,
        paceLabel ?? null,
        totalDays ? `${totalDays} days` : null,
        challengeSchedule.time,
      ].filter(Boolean);
      onSummaryChange?.(summaryBits.join(' · '));
    } else {
      const selectedPace = selectedCatalog.paceOptions?.find(item => item.id === selectedPaceId) ?? null;
      startChallenge(selectedCatalog.id, selectedPace);
      const paceLabel = selectedPace?.label ? ` · ${selectedPace.label}` : '';
      onSummaryChange?.(`${selectedCatalog.title}${paceLabel} · ${challengeSchedule.time}`);
    }

    setSelectedCatalogId(null);
  };

  if (!mounted) return null;

  const sheetTranslateY = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(430, windowHeight * 0.72), 0],
  });

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.overlayScrim, { opacity: sheetProgress }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            s.sheetShell,
            {
              opacity: sheetProgress,
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={s.handle} />

          <View style={s.header}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.84} style={s.headerBtn}>
              <X s={20} c="#A8A29E" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Set as Task</Text>
            <View style={s.headerSpacer} />
          </View>

          <View
            style={s.segmentWrap}
            onLayout={event => setSegmentWidth(event.nativeEvent.layout.width)}
          >
            {segmentWidth > 0 && (
              <Animated.View
                pointerEvents="none"
                style={[
                  s.segmentPill,
                  {
                    width: (segmentWidth - 12) / 2,
                    transform: [{
                      translateX: tabMotion.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, (segmentWidth - 12) / 2 + 4],
                      }),
                    }],
                  },
                ]}
              />
            )}
            <TouchableOpacity
              onPress={() => switchTaskTab('spiritual')}
              activeOpacity={0.86}
              style={s.segmentBtn}
            >
              <Flame s={16} color={taskTab === 'spiritual' ? '#FFFFFF' : '#C5A059'} filled={taskTab === 'spiritual'} />
              <Text style={[s.segmentText, taskTab === 'spiritual' && s.segmentTextActive]}>SPIRITUAL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => switchTaskTab('challenge')}
              activeOpacity={0.86}
              style={s.segmentBtn}
            >
              <Trophy s={16} c={taskTab === 'challenge' ? '#FFFFFF' : '#C5A059'} />
              <Text style={[s.segmentText, taskTab === 'challenge' && s.segmentTextActive]}>CHALLENGE</Text>
            </TouchableOpacity>
          </View>

          <ScrollView ref={contentScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
            <Animated.View
              style={{
                opacity: tabContentMotion,
                transform: [{
                  translateY: tabContentMotion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                }],
              }}
            >
              {taskTab === 'spiritual' && (
                <>
                  {context === 'prayer' && (
                    <PrayerSpiritualPanel
                      prayerType={prayerType}
                      prayerTitle={prayerTitle}
                      prayerRule={prayerRule}
                      jesusMode={jesusMode}
                      jesusDuration={jesusDuration}
                      jesusCount={jesusCount}
                      schedule={prayerSchedule}
                      onSelectPrayerType={selectPrayerType}
                      onTitleChange={setPrayerTitle}
                      onRuleChange={setPrayerRule}
                      onJesusModeChange={setJesusMode}
                      onJesusDurationChange={setJesusDuration}
                      onJesusCountChange={setJesusCount}
                      onScheduleChange={setPrayerSchedule}
                      onSave={handleSaveSpiritual}
                    />
                  )}

                  {context === 'journal' && (
                    <JournalSpiritualPanel
                      journalTechnique={journalTechnique}
                      schedule={journalTime}
                      onTechniqueChange={setJournalTechnique}
                      onScheduleChange={setJournalTime}
                      onSave={handleSaveSpiritual}
                    />
                  )}

                  {context === 'scripture' && (
                    <ScriptureSpiritualPanel
                      scriptureType={scriptureType}
                      scriptureTitle={scriptureTitle}
                      schedule={scriptureSchedule}
                      dailyAmount={scriptureDailyAmount}
                      onSelectScriptureType={selectScriptureType}
                      onTitleChange={setScriptureTitle}
                      onScheduleChange={setScriptureSchedule}
                      onDailyAmountChange={setScriptureDailyAmount}
                      onSave={handleSaveSpiritual}
                    />
                  )}
                </>
              )}

              {taskTab === 'challenge' && (
                <ChallengePanel
                  context={context}
                  activeItems={activeForContext}
                  pausedItems={pausedForContext}
                  availableItems={availableForContext}
                  selectedCatalog={selectedCatalog}
                  selectedPaceId={selectedPaceId}
                  challengeSchedule={challengeSchedule}
                  scriptureDailyAmount={challengeScriptureDailyAmount}
                  challengePrayerRule={challengePrayerRule}
                  challengeJesusMode={challengeJesusMode}
                  challengeJesusDuration={challengeJesusDuration}
                  challengeJesusCount={challengeJesusCount}
                  expandedChallengeId={expandedChallengeId}
                  recentlyStartedTemplateId={recentlyStartedTemplateId}
                  onOpenSetup={openChallengeSetup}
                  onSelectedPaceIdChange={setSelectedPaceId}
                  onChallengeScheduleChange={setChallengeSchedule}
                  onScriptureDailyAmountChange={setChallengeScriptureDailyAmount}
                  onChallengePrayerRuleChange={setChallengePrayerRule}
                  onChallengeJesusModeChange={setChallengeJesusMode}
                  onChallengeJesusDurationChange={setChallengeJesusDuration}
                  onChallengeJesusCountChange={setChallengeJesusCount}
                  onStartChallenge={context === 'scripture' ? handleConfiguredChallengeStart : handleStartChallenge}
                  onExpandedChallengeChange={setExpandedChallengeId}
                  onPauseChallenge={pauseChallenge}
                  onResumeChallenge={resumeChallenge}
                  onEndChallenge={endChallenge}
                  onUpdateChallenge={updateChallenge}
                />
              )}
            </Animated.View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PrayerSpiritualPanel({
  prayerType,
  prayerTitle,
  prayerRule,
  jesusMode,
  jesusDuration,
  jesusCount,
  schedule,
  onSelectPrayerType,
  onTitleChange,
  onRuleChange,
  onJesusModeChange,
  onJesusDurationChange,
  onJesusCountChange,
  onScheduleChange,
  onSave,
}: {
  prayerType: PrayerType | null;
  prayerTitle: string;
  prayerRule: PrayerRuleChoice;
  jesusMode: JesusPrayerMode;
  jesusDuration: string;
  jesusCount: string;
  schedule: ScheduleDraft;
  onSelectPrayerType: (type: PrayerType) => void;
  onTitleChange: (value: string) => void;
  onRuleChange: (value: PrayerRuleChoice) => void;
  onJesusModeChange: (value: JesusPrayerMode) => void;
  onJesusDurationChange: (value: string) => void;
  onJesusCountChange: (value: string) => void;
  onScheduleChange: (value: ScheduleDraft) => void;
  onSave: () => void;
}) {
  const rules = prayerType && prayerType !== 'jesus' && prayerType !== 'custom'
    ? PRAYER_RULES[prayerType]
    : [];

  return (
    <View style={s.stack}>
      <CardBlock label="Prayer Type">
        <View style={s.prayerTypeGrid}>
          {PRAYER_TYPES.map(item => {
            const active = prayerType === item.key;
            return (
              <PrayerTypeChoice
                key={item.key}
                item={item}
                active={active}
                onPress={() => onSelectPrayerType(item.key)}
              />
            );
          })}
        </View>
      </CardBlock>

      {!!prayerType && (
        <>
          <CardBlock label="Task Name">
            <TextInput
              value={prayerTitle}
              onChangeText={onTitleChange}
              placeholder="e.g. Morning Prayer"
              placeholderTextColor="#D1D5DB"
              style={s.bigTitleInput}
            />
          </CardBlock>

          {prayerType === 'jesus' && (
            <CardBlock label="Jesus Prayer">
              <JesusPrayerConfigurator
                mode={jesusMode}
                duration={jesusDuration}
                count={jesusCount}
                onModeChange={onJesusModeChange}
                onDurationChange={onJesusDurationChange}
                onCountChange={onJesusCountChange}
              />
            </CardBlock>
          )}

          {rules.length > 0 && (
            <CardBlock label="Prayer Rule">
              <View style={s.optionStack}>
                {rules.map(item => {
                  const active = prayerRule === item.key;
                  return (
                    <PrayerRuleOption
                      key={item.key}
                      item={item}
                      active={active}
                      onPress={() => onRuleChange(item.key)}
                    />
                  );
                })}
              </View>
            </CardBlock>
          )}

          <ScheduleEditor
            value={schedule}
            onChange={onScheduleChange}
            showFrequency
          />

          <PrimaryButton label="Save Spiritual Task" onPress={onSave} />
        </>
      )}
    </View>
  );
}

function PrayerTypeChoice({
  item,
  active,
  onPress,
}: {
  item: typeof PRAYER_TYPES[number];
  active: boolean;
  onPress: () => void;
}) {
  const progress = useSelectionMotion(active);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.014] });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [item.tint, item.accent],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [item.border, item.accent],
  });
  const shadowOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.015, 0.16] });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.prayerTypeTouch}>
      <Animated.View
        style={[
          s.prayerTypeBtn,
          {
            backgroundColor,
            borderColor,
            shadowColor: item.accent,
            shadowOpacity,
            transform: [{ scale }],
          },
        ]}
      >
        <item.Icon s={20} c={active ? '#FFFFFF' : item.accent} w={active ? 2.2 : 1.8} />
        <Text style={[s.prayerTypeText, { color: active ? '#FFFFFF' : item.accent }]}>{item.short}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function PrayerRuleOption({
  item,
  active,
  onPress,
}: {
  item: { key: PrayerRuleChoice; label: string; desc: string };
  active: boolean;
  onPress: () => void;
}) {
  const progress = useSelectionMotion(active);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.008] });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#FFF9EE'],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#F0EDE6', '#D8B56E'],
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <Animated.View style={[s.optionCard, { backgroundColor, borderColor, transform: [{ scale }] }]}>
        <View style={[s.optionRadio, active && s.optionRadioActive]}>
          {active && <View style={s.optionRadioInner} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.optionTitle, active && s.optionTitleActive]}>{item.label}</Text>
          <Text style={s.optionBody}>{item.desc}</Text>
        </View>
        {active && <CheckSmall s={16} c={C.gold} />}
      </Animated.View>
    </TouchableOpacity>
  );
}

function JesusPrayerConfigurator({
  mode,
  duration,
  count,
  onModeChange,
  onDurationChange,
  onCountChange,
}: {
  mode: JesusPrayerMode;
  duration: string;
  count: string;
  onModeChange: (value: JesusPrayerMode) => void;
  onDurationChange: (value: string) => void;
  onCountChange: (value: string) => void;
}) {
  const options = mode === 'duration'
    ? [5, 10, 15, 30]
    : [33, 50, 100, 300];
  const selected = Number.parseInt(mode === 'duration' ? duration : count, 10);
  const modeMotion = useRef(new Animated.Value(mode === 'count' ? 1 : 0)).current;
  const [modeWidth, setModeWidth] = useState(0);

  useEffect(() => {
    Animated.spring(modeMotion, {
      toValue: mode === 'count' ? 1 : 0,
      friction: 16,
      tension: 145,
      useNativeDriver: false,
    }).start();
  }, [mode, modeMotion]);

  return (
    <View style={s.jesusConfigStack}>
      <View
        style={s.jesusModeWrap}
        onLayout={event => setModeWidth(event.nativeEvent.layout.width)}
      >
        {modeWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              s.jesusModePill,
              {
                width: (modeWidth - 8) / 2,
                transform: [{
                  translateX: modeMotion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, (modeWidth - 8) / 2],
                  }),
                }],
              },
            ]}
          />
        )}
        {([
          { key: 'duration' as const, label: 'By Time' },
          { key: 'count' as const, label: 'By Count' },
        ]).map(item => {
          const active = mode === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => {
                animateSoftLayoutChange();
                onModeChange(item.key);
              }}
              activeOpacity={0.84}
              style={s.jesusModeBtn}
            >
              <Text style={[s.jesusModeText, active && s.jesusModeTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.jesusValueRow}>
        {options.map(value => {
          const active = selected === value;
          return (
            <JesusValueChoice
              key={value}
              label={mode === 'duration' ? `${value} min` : `${value}`}
              active={active}
              onPress={() => {
                animateSoftLayoutChange();
                if (mode === 'duration') {
                  onDurationChange(String(value));
                } else {
                  onCountChange(String(value));
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function JesusValueChoice({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const progress = useSelectionMotion(active);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#FFF7E8'],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#EEE8DE', '#D7AA54'],
  });
  const shadowOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.02, 0.15] });
  const textColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#717782', '#B6822D'],
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.jesusValueTouch}>
      <Animated.View
        style={[
          s.jesusValueChip,
          {
            backgroundColor,
            borderColor,
            shadowOpacity,
            transform: [{ scale }],
          },
        ]}
      >
        <Animated.Text style={[s.jesusValueText, { color: textColor }]}>{label}</Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function PrayerChallengeRuleEditor({
  entry,
  value,
  onChange,
}: {
  entry: ChallengeCatalogEntry | ChallengeRecord;
  value: PrayerChallengeRuleChoice;
  onChange: (value: PrayerChallengeRuleChoice) => void;
}) {
  return (
    <View style={s.optionStack}>
      {(['personal', 'standard', 'short', 'seraphim'] as PrayerChallengeRuleChoice[]).map(rule => {
        const active = value === rule;
        const option = {
          key: rule,
          label: prayerRuleSummary(rule),
          desc: rule === 'personal'
            ? 'Reading from your physical prayer book'
            : rule === 'standard'
              ? `Full ${entry.id === 'prayer_evening' || entry.templateId === 'prayer_evening' ? 'evening' : 'morning'} prayers`
              : rule === 'short'
                ? 'Abbreviated prayer rule'
                : 'Rule of St. Seraphim of Sarov',
        };
        return (
          <PrayerRuleOption
            key={rule}
            item={option}
            active={active}
            onPress={() => onChange(rule)}
          />
        );
      })}
    </View>
  );
}

function JournalSpiritualPanel({
  journalTechnique,
  schedule,
  onTechniqueChange,
  onScheduleChange,
  onSave,
}: {
  journalTechnique: JournalTechnique;
  schedule: ScheduleDraft;
  onTechniqueChange: (value: JournalTechnique) => void;
  onScheduleChange: (value: ScheduleDraft) => void;
  onSave: () => void;
}) {
  return (
    <View style={s.stack}>
      <CardBlock label="Technique">
        <View style={s.techniqueRow}>
          {JOURNAL_TECHNIQUES.map(item => {
            const active = journalTechnique === item.key;
            return (
              <TechniqueChoice
                key={item.key}
                item={item}
                active={active}
                onPress={() => {
                  onTechniqueChange(item.key);
                  onScheduleChange(defaultSchedule(item.defaultTime));
                }}
              />
            );
          })}
        </View>
      </CardBlock>

      <ScheduleEditor value={schedule} onChange={onScheduleChange} showFrequency />

      <PrimaryButton label="Save Spiritual Task" onPress={onSave} />
    </View>
  );
}

function TechniqueChoice({
  item,
  active,
  onPress,
}: {
  item: typeof JOURNAL_TECHNIQUES[number];
  active: boolean;
  onPress: () => void;
}) {
  const progress = useSelectionMotion(active);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', item.color],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#F0EDE6', item.color],
  });
  const shadowOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.015, 0.18] });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.techniqueTouch}>
      <Animated.View
        style={[
          s.techniqueBtn,
          {
            backgroundColor,
            borderColor,
            shadowColor: item.color,
            shadowOpacity,
            transform: [{ scale }],
          },
        ]}
      >
        <item.Icon s={20} c={active ? '#FFFFFF' : item.color} />
        <Text style={[s.techniqueBtnText, active && s.techniqueBtnTextActive]}>{item.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function ScriptureSpiritualPanel({
  scriptureType,
  scriptureTitle,
  schedule,
  dailyAmount,
  onSelectScriptureType,
  onTitleChange,
  onScheduleChange,
  onDailyAmountChange,
  onSave,
}: {
  scriptureType: ScriptureReadingType | null;
  scriptureTitle: string;
  schedule: ScheduleDraft;
  dailyAmount: number;
  onSelectScriptureType: (value: ScriptureReadingType) => void;
  onTitleChange: (value: string) => void;
  onScheduleChange: (value: ScheduleDraft) => void;
  onDailyAmountChange: (value: number) => void;
  onSave: () => void;
}) {
  return (
    <View style={s.stack}>
      <CardBlock label="Reading Type">
        <View style={s.typeGridTwo}>
          {SCRIPTURE_TYPES.map(item => {
            const active = scriptureType === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => onSelectScriptureType(item.key)}
                activeOpacity={0.84}
                style={[s.scriptureTypeChip, active && { backgroundColor: `${item.accent}10`, borderColor: item.accent }]}
              >
                <item.Icon s={22} c={active ? item.accent : '#B6B8C0'} />
                <Text style={[s.scriptureTypeText, active && { color: item.accent }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </CardBlock>

      {!!scriptureType && (
        <>
          <CardBlock label="Task Name">
            <TextInput
              value={scriptureTitle}
              onChangeText={onTitleChange}
              placeholder="e.g. Daily Bible Reading"
              placeholderTextColor="#D1D5DB"
              style={s.bigTitleInput}
            />
          </CardBlock>

          {scriptureType !== 'church_calendar' && (
            <>
              <CardBlock label={scriptureType === 'psalter' ? 'Psalms per Day' : 'Chapters per Day'}>
                <View style={s.amountRow}>
                  <TouchableOpacity
                    onPress={() => onDailyAmountChange(Math.max(1, dailyAmount - 1))}
                    activeOpacity={0.84}
                    style={s.amountBtn}
                  >
                    <Text style={s.amountBtnText}>-</Text>
                  </TouchableOpacity>
                  <View style={s.amountCenter}>
                    <Text style={s.amountValue}>{dailyAmount}</Text>
                    <Text style={s.amountCaption}>
                      {scriptureType === 'psalter'
                        ? `${dailyAmount === 1 ? 'Psalm' : 'Psalms'} per day`
                        : `${dailyAmount === 1 ? 'Chapter' : 'Chapters'} per day`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onDailyAmountChange(Math.min(10, dailyAmount + 1))}
                    activeOpacity={0.84}
                    style={s.amountBtn}
                  >
                    <Plus s={18} c={C.gold} />
                  </TouchableOpacity>
                </View>
              </CardBlock>
            </>
          )}

          <ScheduleEditor
            value={schedule}
            onChange={onScheduleChange}
            showFrequency
          />

          <PrimaryButton label="Save Spiritual Task" onPress={onSave} />
        </>
      )}
    </View>
  );
}

function ChallengePanel({
  context,
  activeItems,
  pausedItems,
  availableItems,
  selectedCatalog,
  selectedPaceId,
  challengeSchedule,
  scriptureDailyAmount,
  challengePrayerRule,
  challengeJesusMode,
  challengeJesusDuration,
  challengeJesusCount,
  expandedChallengeId,
  recentlyStartedTemplateId,
  onOpenSetup,
  onSelectedPaceIdChange,
  onChallengeScheduleChange,
  onScriptureDailyAmountChange,
  onChallengePrayerRuleChange,
  onChallengeJesusModeChange,
  onChallengeJesusDurationChange,
  onChallengeJesusCountChange,
  onStartChallenge,
  onExpandedChallengeChange,
  onPauseChallenge,
  onResumeChallenge,
  onEndChallenge,
  onUpdateChallenge,
}: {
  context: TaskSheetContext;
  activeItems: ChallengeRecord[];
  pausedItems: ChallengeRecord[];
  availableItems: ChallengeCatalogEntry[];
  selectedCatalog: ChallengeCatalogEntry | null;
  selectedPaceId: string | null;
  challengeSchedule: ChallengeScheduleDraft;
  scriptureDailyAmount: number;
  challengePrayerRule: PrayerChallengeRuleChoice;
  challengeJesusMode: JesusPrayerMode;
  challengeJesusDuration: string;
  challengeJesusCount: string;
  expandedChallengeId: string | null;
  recentlyStartedTemplateId: string | null;
  onOpenSetup: (entry: ChallengeCatalogEntry) => void;
  onSelectedPaceIdChange: (id: string | null) => void;
  onChallengeScheduleChange: (value: ChallengeScheduleDraft) => void;
  onScriptureDailyAmountChange: (value: number) => void;
  onChallengePrayerRuleChange: (value: PrayerChallengeRuleChoice) => void;
  onChallengeJesusModeChange: (value: JesusPrayerMode) => void;
  onChallengeJesusDurationChange: (value: string) => void;
  onChallengeJesusCountChange: (value: string) => void;
  onStartChallenge: () => void;
  onExpandedChallengeChange: (id: string | null) => void;
  onPauseChallenge: (id: string) => void;
  onResumeChallenge: (id: string) => void;
  onEndChallenge: (id: string) => void;
  onUpdateChallenge: (id: string, updates: { time?: string; scheduleLabel?: string; paceLabel?: string; prayerConfig?: ChallengePrayerConfig }) => void;
}) {
  const [confirmAction, setConfirmAction] = useState<ChallengeConfirmAction | null>(null);

  const groupedAvailable = useMemo(() => {
    if (context !== 'scripture') return null;
    return availableItems.reduce<Record<string, ChallengeCatalogEntry[]>>((acc, item) => {
      const key = item.groupLabel;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [availableItems, context]);

  const seedActiveChallengeEditor = (item: ChallengeRecord) => {
    const savedSchedule = item.prayerConfig ?? item.scriptureConfig;
    onChallengeScheduleChange({
      time: savedSchedule?.time ?? item.time ?? '08:00',
      sameTimeEveryDay: savedSchedule?.sameTimeEveryDay ?? true,
      dayTimes: savedSchedule?.dayTimes ?? {},
      notificationMode: savedSchedule?.notificationMode ?? 'single',
      reminderMinutes: savedSchedule?.reminderMinutes ?? 15,
    });

    if (item.prayerConfig?.taskKind === 'jesus_prayer') {
      onChallengeJesusModeChange(item.prayerConfig.jesusPrayerMode ?? 'duration');
      onChallengeJesusDurationChange(String(item.prayerConfig.jesusPrayerDuration ?? 15));
      onChallengeJesusCountChange(String(item.prayerConfig.jesusPrayerCount ?? 100));
      return;
    }

    if (item.prayerConfig?.taskKind === 'personal_rule') {
      onChallengePrayerRuleChange('personal');
      return;
    }

    if (item.prayerConfig?.prayerRule) {
      onChallengePrayerRuleChange(item.prayerConfig.prayerRule);
      return;
    }

    if (isPrayerRuleChallenge(item)) {
      onChallengePrayerRuleChange('personal');
    }
  };

  const toggleActiveChallenge = (item: ChallengeRecord, expanded: boolean) => {
    animateSoftLayoutChange();
    if (expanded) {
      onExpandedChallengeChange(null);
      return;
    }
    seedActiveChallengeEditor(item);
    onExpandedChallengeChange(item.id);
  };

  return (
    <View style={s.stack}>
      {activeItems.length > 0 && (
        <View style={s.stack}>
          <SectionLabel text="Active" accent="#10B981" />
          {activeItems.map(item => {
            const expanded = expandedChallengeId === item.id;
            const recentlyStarted = item.templateId === recentlyStartedTemplateId;
            return (
              <View key={item.id} style={[s.challengeCardShell, recentlyStarted && s.challengeCardShellStarted]}>
                <TouchableOpacity
                  onPress={() => toggleActiveChallenge(item, expanded)}
                  activeOpacity={0.84}
                  style={s.challengeCard}
                >
                  <View style={s.challengeTop}>
                    <View style={s.challengeBadge}>
                      <Text style={s.challengeBadgeText}>{item.category.toUpperCase()}</Text>
                    </View>
                    <View style={s.challengeFlame}>
                      <Flame s={12} filled color="#F97316" />
                      <Text style={s.challengeFlameText}>{item.streak}</Text>
                    </View>
                  </View>

                  <View style={s.challengeTitleRow}>
                    <Text style={s.challengeTitle}>{item.title}</Text>
                    <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
                      <ChevronDown s={14} c="#C9B18A" />
                    </View>
                  </View>

                  <Text style={s.challengeMetaText}>
                    {item.time || '--:--'}  ·  {item.paceLabel || item.scheduleLabel}
                  </Text>

                  {item.showBar && item.progressTotal ? (
                    <View style={s.challengeProgressTrack}>
                      <View style={[s.challengeProgressFill, { width: `${Math.min(100, Math.round((item.progressCurrent / item.progressTotal) * 100))}%` }]} />
                    </View>
                  ) : (
                    <View style={[s.challengeProgressTrack, { opacity: 0.4 }]} />
                  )}
                </TouchableOpacity>

                {expanded && (
                  <View style={s.challengeEditor}>
                    {isPrayerRuleChallenge(item) && (
                      <View style={s.catalogSetupBlock}>
                        <Text style={s.scriptureSetupLabel}>Prayer Rule</Text>
                        <PrayerChallengeRuleEditor
                          entry={item}
                          value={challengePrayerRule}
                          onChange={onChallengePrayerRuleChange}
                        />
                      </View>
                    )}

                    {isJesusPrayerChallenge(item) && (
                      <View style={s.catalogSetupBlock}>
                        <Text style={s.scriptureSetupLabel}>Jesus Prayer</Text>
                        <JesusPrayerConfigurator
                          mode={challengeJesusMode}
                          duration={challengeJesusDuration}
                          count={challengeJesusCount}
                          onModeChange={onChallengeJesusModeChange}
                          onDurationChange={onChallengeJesusDurationChange}
                          onCountChange={onChallengeJesusCountChange}
                        />
                      </View>
                    )}

                    <ChallengeTimeEditor value={challengeSchedule} onChange={onChallengeScheduleChange} />

                    <NotificationSettings
                      mode={challengeSchedule.notificationMode}
                      reminderMinutes={challengeSchedule.reminderMinutes}
                      onModeChange={mode => onChallengeScheduleChange({ ...challengeSchedule, notificationMode: mode })}
                      onReminderChange={reminderMinutes => onChallengeScheduleChange({ ...challengeSchedule, reminderMinutes })}
                    />

                    {!!item.paceLabel && (
                      <Text style={s.smallHint}>Current pace: {item.paceLabel}</Text>
                    )}

                    <View style={s.challengeActionRow}>
                      <TouchableOpacity
                        onPress={() => {
                          const prayerConfig = buildPrayerChallengeConfig(
                            item,
                            challengePrayerRule,
                            challengeJesusMode,
                            challengeJesusDuration,
                            challengeJesusCount,
                            challengeSchedule,
                          );
                          const prayerDetail = prayerChallengeDetail(
                            item,
                            challengePrayerRule,
                            challengeJesusMode,
                            challengeJesusDuration,
                            challengeJesusCount,
                          );
                          const paceLabel = prayerDetail
                            ? [item.paceLabel?.split(' · ')[0], prayerDetail].filter(Boolean).join(' · ')
                            : item.paceLabel;
                          onUpdateChallenge(item.id, {
                            time: challengeSchedule.time,
                            paceLabel,
                            scheduleLabel: item.scheduleLabel,
                            prayerConfig,
                          });
                          onExpandedChallengeChange(null);
                        }}
                        activeOpacity={0.84}
                        style={s.secondaryBtn}
                      >
                        <Text style={s.secondaryBtnText}>Save</Text>
                      </TouchableOpacity>

                      {item.status === 'paused' ? (
                        <TouchableOpacity onPress={() => onResumeChallenge(item.id)} activeOpacity={0.84} style={s.secondaryBtn}>
                          <Text style={s.secondaryBtnText}>Resume</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => setConfirmAction({ mode: 'pause', item })}
                          activeOpacity={0.84}
                          style={s.secondaryBtn}
                        >
                          <Text style={s.secondaryBtnText}>Pause</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={() => setConfirmAction({ mode: 'end', item })}
                        activeOpacity={0.84}
                        style={s.dangerBtn}
                      >
                        <Text style={s.dangerBtnText}>End</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {pausedItems.length > 0 && (
        <View style={s.stack}>
          <SectionLabel text="Paused" accent="#A8A29E" />
          {pausedItems.map(item => (
            <View key={item.id} style={[s.challengeCardShell, { opacity: 0.84 }]}>
              <TouchableOpacity onPress={() => onResumeChallenge(item.id)} activeOpacity={0.84} style={s.challengeCard}>
                <View style={s.challengeTop}>
                  <View style={s.challengeBadgeMuted}>
                    <Text style={s.challengeBadgeMutedText}>{item.category.toUpperCase()}</Text>
                  </View>
                  <Text style={s.challengePausedText}>PAUSED</Text>
                </View>
                <Text style={s.challengeTitle}>{item.title}</Text>
                <Text style={s.challengeMetaText}>{item.time || '--:--'}  ·  {item.paceLabel || item.scheduleLabel}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={s.stack}>
        {context !== 'scripture' && <SectionLabel text="Start New" accent="#C5A059" />}

        {context === 'scripture' && groupedAvailable
          ? Object.entries(groupedAvailable).map(([group, entries]) => (
              <View key={group} style={s.stack}>
                <Text style={s.groupTitle}>{group.toUpperCase()}</Text>
                {entries.map(entry => (
                  <ScriptureCatalogEntryCard
                    key={entry.id}
                    entry={entry}
                    expanded={selectedCatalog?.id === entry.id}
                    scriptureDailyAmount={scriptureDailyAmount}
                    challengeSchedule={challengeSchedule}
                    onToggle={() => onOpenSetup(entry)}
                    onScriptureDailyAmountChange={onScriptureDailyAmountChange}
                    onChallengeScheduleChange={onChallengeScheduleChange}
                    onStart={onStartChallenge}
                  />
                ))}
              </View>
            ))
          : availableItems.map(entry => (
              <ChallengeCatalogEntryCard
                key={entry.id}
                entry={entry}
                expanded={selectedCatalog?.id === entry.id}
                selectedPaceId={selectedPaceId}
                challengeSchedule={challengeSchedule}
                challengePrayerRule={challengePrayerRule}
                challengeJesusMode={challengeJesusMode}
                challengeJesusDuration={challengeJesusDuration}
                challengeJesusCount={challengeJesusCount}
                onToggle={() => onOpenSetup(entry)}
                onSelectedPaceIdChange={onSelectedPaceIdChange}
                onChallengeScheduleChange={onChallengeScheduleChange}
                onChallengePrayerRuleChange={onChallengePrayerRuleChange}
                onChallengeJesusModeChange={onChallengeJesusModeChange}
                onChallengeJesusDurationChange={onChallengeJesusDurationChange}
                onChallengeJesusCountChange={onChallengeJesusCountChange}
                onStart={onStartChallenge}
              />
            ))}
      </View>

      <ChallengeActionConfirmModal
        action={confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={action => {
          if (action.mode === 'pause') {
            onPauseChallenge(action.item.id);
          } else {
            onEndChallenge(action.item.id);
          }
          onExpandedChallengeChange(null);
          setConfirmAction(null);
        }}
      />
    </View>
  );
}

function ChallengeActionConfirmModal({
  action,
  onCancel,
  onConfirm,
}: {
  action: ChallengeConfirmAction | null;
  onCancel: () => void;
  onConfirm: (action: ChallengeConfirmAction) => void;
}) {
  const danger = action?.mode === 'end';
  const title = danger ? 'End Challenge?' : 'Pause Challenge?';
  const itemTitle = action?.item.title ?? 'this challenge';
  const body = danger
    ? `Progress stays in history, but "${itemTitle}" leaves your active routine.`
    : `"${itemTitle}" will move to Paused and stop showing as active until you resume it.`;

  return (
    <Modal transparent visible={!!action} animationType="fade" onRequestClose={onCancel}>
      <View style={s.challengeConfirmOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={s.challengeConfirmCard}>
          <View style={[s.challengeConfirmIcon, danger && s.challengeConfirmIconDanger]}>
            {danger ? <Trash2 s={19} c="#DC2626" /> : <Pause s={18} c={C.gold} />}
          </View>
          <Text style={s.challengeConfirmTitle}>{title}</Text>
          <Text style={s.challengeConfirmBody}>{body}</Text>
          <View style={s.challengeConfirmRow}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.84} style={s.challengeConfirmCancel}>
              <Text style={s.challengeConfirmCancelText}>{danger ? 'CANCEL' : 'KEEP ACTIVE'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => action && onConfirm(action)}
              activeOpacity={0.84}
              style={[s.challengeConfirmPrimary, danger && s.challengeConfirmDanger]}
            >
              <Text style={s.challengeConfirmPrimaryText}>{danger ? 'END' : 'PAUSE'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ScriptureCatalogEntryCard({
  entry,
  expanded,
  scriptureDailyAmount,
  challengeSchedule,
  onToggle,
  onScriptureDailyAmountChange,
  onChallengeScheduleChange,
  onStart,
}: {
  entry: ChallengeCatalogEntry;
  expanded: boolean;
  scriptureDailyAmount: number;
  challengeSchedule: ChallengeScheduleDraft;
  onToggle: () => void;
  onScriptureDailyAmountChange: (value: number) => void;
  onChallengeScheduleChange: (value: ChallengeScheduleDraft) => void;
  onStart: () => void;
}) {
  const displayTitle = entry.id === 'lectionary_daily' ? `${entry.title} — 365 Days` : entry.title;

  return (
    <View style={[s.scriptureStartCard, expanded && s.scriptureStartCardExpanded]}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.84} style={s.scriptureStartCardTap}>
        <View style={s.scriptureStartTopRow}>
          <View style={s.scriptureStartMain}>
            <View style={s.scriptureStartIconWrap}>
              {entry.id === 'lectionary_daily'
                ? challengeIcon(entry.icon, '#C5A059')
                : <OpenBook s={18} c="#C5A059" w={1.9} />}
            </View>
            <View style={s.scriptureStartCopy}>
              <Text style={s.scriptureStartTitle}>{displayTitle}</Text>
              <Text style={s.scriptureStartBody}>{entry.description}</Text>
            </View>
          </View>
          <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
            <ChevronDown s={15} c="#C9B18A" />
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={s.scriptureSetupInline}>
          {needsScriptureDailyAmount(entry) && (
            <View style={s.scriptureSetupBlock}>
              <Text style={s.scriptureSetupLabel}>{scriptureDailyAmountTitle(entry)}</Text>
              <View style={s.scriptureAmountRow}>
                {[1, 2, 3, 4, 5].map(amount => {
                  const active = scriptureDailyAmount === amount;
                  return (
                    <TouchableOpacity
                      key={amount}
                      onPress={() => onScriptureDailyAmountChange(amount)}
                      activeOpacity={0.84}
                      style={[s.scriptureAmountChip, active && s.scriptureAmountChipActive]}
                    >
                      <Text style={[s.scriptureAmountValue, active && s.scriptureAmountValueActive]}>{amount}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={s.scriptureApproxDays}>
                ≈ {scriptureApproxDays(entry, scriptureDailyAmount) || 1} days
              </Text>
            </View>
          )}

          <View style={s.scriptureScheduleShell}>
            <ChallengeTimeEditor
              value={challengeSchedule}
              onChange={onChallengeScheduleChange}
              allowPerDayTimes={entry.id !== 'lectionary_daily'}
            />
          </View>

          <NotificationSettings
            mode={challengeSchedule.notificationMode}
            reminderMinutes={challengeSchedule.reminderMinutes}
            onModeChange={mode => onChallengeScheduleChange({ ...challengeSchedule, notificationMode: mode })}
            onReminderChange={reminderMinutes => onChallengeScheduleChange({ ...challengeSchedule, reminderMinutes })}
          />

          <PrimaryButton label="Start Challenge" onPress={onStart} />
        </View>
      )}
    </View>
  );
}

function ChallengeCatalogEntryCard({
  entry,
  expanded,
  selectedPaceId,
  challengeSchedule,
  challengePrayerRule,
  challengeJesusMode,
  challengeJesusDuration,
  challengeJesusCount,
  onToggle,
  onSelectedPaceIdChange,
  onChallengeScheduleChange,
  onChallengePrayerRuleChange,
  onChallengeJesusModeChange,
  onChallengeJesusDurationChange,
  onChallengeJesusCountChange,
  onStart,
}: {
  entry: ChallengeCatalogEntry;
  expanded: boolean;
  selectedPaceId: string | null;
  challengeSchedule: ChallengeScheduleDraft;
  challengePrayerRule: PrayerChallengeRuleChoice;
  challengeJesusMode: JesusPrayerMode;
  challengeJesusDuration: string;
  challengeJesusCount: string;
  onToggle: () => void;
  onSelectedPaceIdChange: (id: string | null) => void;
  onChallengeScheduleChange: (value: ChallengeScheduleDraft) => void;
  onChallengePrayerRuleChange: (value: PrayerChallengeRuleChoice) => void;
  onChallengeJesusModeChange: (value: JesusPrayerMode) => void;
  onChallengeJesusDurationChange: (value: string) => void;
  onChallengeJesusCountChange: (value: string) => void;
  onStart: () => void;
}) {
  const selectedPace = entry.paceOptions?.find(option => option.id === selectedPaceId) ?? entry.paceOptions?.[0] ?? null;

  return (
    <View style={[s.catalogStartCard, expanded && s.catalogStartCardExpanded]}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.84} style={s.catalogStartTap}>
        <View style={s.catalogStartTopRow}>
          <View style={s.catalogStartMain}>
            <View style={s.catalogStartIconWrap}>
              {challengeIcon(entry.icon, '#C5A059')}
            </View>
            <View style={s.catalogStartCopy}>
              <Text style={s.catalogStartTitle}>{entry.title}</Text>
              <Text style={s.catalogStartBody}>{entry.description}</Text>
              {selectedPace && !expanded ? (
                <Text style={s.catalogStartMeta}>{selectedPace.label.toUpperCase()} · {entry.defaultTime ?? '08:00'}</Text>
              ) : null}
            </View>
          </View>
          <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
            <ChevronDown s={15} c="#C9B18A" />
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={s.catalogSetupInline}>
          {!!entry.paceOptions?.length && (
            <View style={s.catalogSetupBlock}>
              <Text style={s.scriptureSetupLabel}>Duration</Text>
              <View style={s.paceRow}>
                {entry.paceOptions.map(option => {
                  const active = selectedPaceId === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => {
                        animateSoftLayoutChange();
                        onSelectedPaceIdChange(option.id);
                      }}
                      activeOpacity={0.84}
                      style={[s.paceChip, active && s.paceChipActive]}
                    >
                      <Text style={[s.paceLabel, active && s.paceLabelActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {isPrayerRuleChallenge(entry) && (
            <View style={s.catalogSetupBlock}>
              <Text style={s.scriptureSetupLabel}>Prayer Rule</Text>
              <PrayerChallengeRuleEditor
                entry={entry}
                value={challengePrayerRule}
                onChange={onChallengePrayerRuleChange}
              />
            </View>
          )}

          {isJesusPrayerChallenge(entry) && (
            <View style={s.catalogSetupBlock}>
              <Text style={s.scriptureSetupLabel}>Jesus Prayer</Text>
              <JesusPrayerConfigurator
                mode={challengeJesusMode}
                duration={challengeJesusDuration}
                count={challengeJesusCount}
                onModeChange={onChallengeJesusModeChange}
                onDurationChange={onChallengeJesusDurationChange}
                onCountChange={onChallengeJesusCountChange}
              />
            </View>
          )}

          <View style={s.catalogScheduleShell}>
            <Text style={s.scriptureSetupLabel}>Schedule</Text>
            <ChallengeTimeEditor value={challengeSchedule} onChange={onChallengeScheduleChange} />
          </View>

          <NotificationSettings
            mode={challengeSchedule.notificationMode}
            reminderMinutes={challengeSchedule.reminderMinutes}
            onModeChange={mode => onChallengeScheduleChange({ ...challengeSchedule, notificationMode: mode })}
            onReminderChange={reminderMinutes => onChallengeScheduleChange({ ...challengeSchedule, reminderMinutes })}
          />

          <PrimaryButton label="Start Challenge" onPress={onStart} />
        </View>
      )}
    </View>
  );
}

function ScheduleEditor({
  value,
  onChange,
  showFrequency,
}: {
  value: ScheduleDraft;
  onChange: (value: ScheduleDraft) => void;
  showFrequency: boolean;
}) {
  const [gridWidth, setGridWidth] = useState(0);
  const activeDayIndexes = useMemo(() => {
    switch (value.frequency) {
      case 'weekdays':
        return [0, 1, 2, 3, 4];
      case 'weekends':
        return [5, 6];
      case 'specific_days':
        return value.selectedDays.length ? value.selectedDays : [0, 1, 2, 3, 4, 5, 6];
      default:
        return [0, 1, 2, 3, 4, 5, 6];
    }
  }, [value.frequency, value.selectedDays]);
  const isCompactGrid = gridWidth > 0 && gridWidth < 284;
  const weekdayGap = isCompactGrid ? 6 : 8;
  const monthlyGap = isCompactGrid ? 4 : 6;
  const weekdaySize = gridWidth
    ? Math.max(30, Math.min(40, Math.floor((gridWidth - weekdayGap * 6) / 7)))
    : 36;
  const weekdayFontSize = weekdaySize <= 32 ? 10 : 11;
  const monthlyCellSize = gridWidth
    ? Math.max(30, Math.min(42, Math.floor((gridWidth - monthlyGap * 6) / 7)))
    : 36;
  const showBaseTime = value.sameTimeEveryDay || value.frequency === 'monthly';

  return (
    <CardBlock label="Schedule">
      <View style={s.stack}>
        {showFrequency && (
          <>
            <View style={s.frequencyWrap}>
              {FULL_FREQUENCY_OPTIONS.map(option => {
                const active = value.frequency === option.value;
                return (
                  <FrequencyChoice
                    key={option.value}
                    option={option}
                    active={active}
                    onPress={() => onChange({
                      ...value,
                      frequency: option.value,
                      sameTimeEveryDay: option.value === 'monthly' ? true : value.sameTimeEveryDay,
                      monthlyDays: option.value === 'monthly' && !value.monthlyDays.length ? [1] : value.monthlyDays,
                    })}
                  />
                );
              })}
            </View>

            {value.frequency === 'specific_days' && (
              <View style={s.gridMeasure} onLayout={event => setGridWidth(Math.floor(event.nativeEvent.layout.width))}>
                <View style={[s.dayChipRow, { columnGap: weekdayGap }]}>
                  {WEEKDAY_LABELS.map((label, index) => {
                    const active = value.selectedDays.includes(index);
                    return (
                      <TouchableOpacity
                        key={label}
                        onPress={() => onChange({
                          ...value,
                          selectedDays: active
                            ? value.selectedDays.filter(day => day !== index)
                            : [...value.selectedDays, index].sort((a, b) => a - b),
                        })}
                        activeOpacity={0.84}
                        style={[
                          s.dayChip,
                          {
                            width: weekdaySize,
                            height: weekdaySize,
                            borderRadius: Math.round(weekdaySize / 2),
                          },
                          active && s.dayChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            s.dayChipText,
                            { fontSize: weekdayFontSize },
                            active && s.dayChipTextActive,
                          ]}
                        >
                          {label[0]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {value.frequency === 'monthly' && (
              <View
                style={s.monthlyGridWrap}
                onLayout={event => setGridWidth(Math.floor(event.nativeEvent.layout.width))}
              >
                <SectionLabel text="Days of Month" accent="#C5A059" compact />
                <Text style={s.monthlyHint}>Choose one or more dates for the monthly repeat.</Text>
                <View style={[s.monthlyGrid, { gap: monthlyGap }]}>
                  {Array.from({ length: 31 }, (_, index) => index + 1).map(day => {
                    const active = value.monthlyDays.includes(day);
                    return (
                      <TouchableOpacity
                        key={day}
                        onPress={() => {
                          const nextMonthlyDays = active
                            ? value.monthlyDays.filter(item => item !== day)
                            : [...value.monthlyDays, day].sort((a, b) => a - b);
                          onChange({
                            ...value,
                            monthlyDays: nextMonthlyDays.length ? nextMonthlyDays : [day],
                          });
                        }}
                        activeOpacity={0.84}
                        style={[
                          s.chapterCell,
                          s.monthlyCell,
                          {
                            width: monthlyCellSize,
                            minHeight: monthlyCellSize,
                          },
                          active && s.chapterCellActive,
                        ]}
                      >
                        <Text style={[s.chapterCellTextSmall, active && s.chapterCellTextSmallActive]}>{day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}

        {showBaseTime && (
          <TimeField label="Time" value={value.time} onChangeText={time => onChange({ ...value, time })} />
        )}

        {value.frequency !== 'monthly' && (
          <ToggleRow
            label="Different time per day"
            active={!value.sameTimeEveryDay}
            onPress={() => onChange({ ...value, sameTimeEveryDay: !value.sameTimeEveryDay })}
          />
        )}

        {!value.sameTimeEveryDay && value.frequency !== 'monthly' && (
          <View style={s.dayTimeStack}>
            {activeDayIndexes.map(index => (
              <View key={WEEKDAY_LABELS[index]} style={s.dayTimeRow}>
                <Text style={s.dayTimeLabel}>{WEEKDAY_LABELS[index]}</Text>
                <TimePickerButton
                  value={value.dayTimes[index] || value.time}
                  onChangeText={time => onChange({ ...value, dayTimes: { ...value.dayTimes, [index]: time } })}
                  compact
                />
              </View>
            ))}
          </View>
        )}

        <NotificationSettings
          mode={value.notificationMode}
          reminderMinutes={value.reminderMinutes}
          onModeChange={mode => onChange({ ...value, notificationMode: mode })}
          onReminderChange={reminderMinutes => onChange({ ...value, reminderMinutes })}
        />
      </View>
    </CardBlock>
  );
}

function FrequencyChoice({
  option,
  active,
  onPress,
}: {
  option: typeof FULL_FREQUENCY_OPTIONS[number];
  active: boolean;
  onPress: () => void;
}) {
  const progress = useSelectionMotion(active);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.01] });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', '#FFF9EE'],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#F0EDE6', '#D6B067'],
  });
  const shadowOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.015, 0.10] });
  const dotScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const handlePress = () => {
    animateSoftLayoutChange();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Animated.View
        style={[
          s.frequencyChip,
          {
            backgroundColor,
            borderColor,
            shadowOpacity,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={s.frequencyCopy}>
          <Text style={[s.frequencyChipText, active && s.frequencyChipTextActive]}>{option.label}</Text>
          <Text style={[s.frequencyChipSub, active && s.frequencyChipSubActive]}>{option.desc}</Text>
        </View>
        <View style={[s.frequencyDotRing, active && s.frequencyDotRingActive]}>
          <Animated.View
            style={[
              s.frequencyDot,
              {
                opacity: progress,
                transform: [{ scale: dotScale }],
              },
            ]}
          />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

function ChallengeTimeEditor({
  value,
  onChange,
  allowPerDayTimes = true,
}: {
  value: ChallengeScheduleDraft;
  onChange: (value: ChallengeScheduleDraft) => void;
  allowPerDayTimes?: boolean;
}) {
  const showBaseTime = !allowPerDayTimes || value.sameTimeEveryDay;

  return (
    <View style={s.stack}>
      {showBaseTime && (
        <TimeField label="Time" value={value.time} onChangeText={time => onChange({ ...value, time })} />
      )}

      {allowPerDayTimes && (
        <ToggleRow
          label="Different time per day"
          active={!value.sameTimeEveryDay}
          onPress={() => onChange({ ...value, sameTimeEveryDay: !value.sameTimeEveryDay })}
        />
      )}

      {allowPerDayTimes && !value.sameTimeEveryDay && (
        <View style={s.dayTimeStack}>
          {WEEKDAY_LABELS.map((label, index) => (
            <View key={label} style={s.dayTimeRow}>
              <Text style={s.dayTimeLabel}>{label}</Text>
              <TimePickerButton
                value={value.dayTimes[index] || value.time}
                onChangeText={time => onChange({ ...value, dayTimes: { ...value.dayTimes, [index]: time } })}
                compact
              />
            </View>
          ))}
        </View>
      )}

    </View>
  );
}

function CardBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.cardBlock}>
      <Text style={s.blockLabel}>{label}</Text>
      {children}
    </View>
  );
}

function TimePickerButton({
  value,
  onChangeText,
  compact = false,
}: {
  value: string;
  onChangeText: (text: string) => void;
  compact?: boolean;
}) {
  const normalized = parseTimeParts(value);
  const [visible, setVisible] = useState(false);
  const [hour, setHour] = useState(normalized.hour);
  const [minute, setMinute] = useState(normalized.minute);
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);
  const nativeDate = useMemo(() => {
    const next = new Date();
    next.setHours(Number(hour), Number(minute), 0, 0);
    return next;
  }, [hour, minute]);

  const openPicker = () => {
    const next = parseTimeParts(value);
    setHour(next.hour);
    setMinute(next.minute);

    if (Platform.OS === 'android' && NativeDateTimePickerAndroid) {
      const seed = new Date();
      seed.setHours(Number(next.hour), Number(next.minute), 0, 0);
      NativeDateTimePickerAndroid.open({
        value: seed,
        mode: 'time',
        is24Hour: true,
        display: 'spinner',
        minuteInterval: 5,
        positiveButton: { label: 'Save', textColor: '#B08A47' },
        negativeButton: { label: 'Cancel', textColor: '#9CA3AF' },
        onChange: (event: { type?: string }, selectedDate?: Date) => {
          if (event?.type !== 'set' || !selectedDate) return;
          onChangeText(formatTimeFromDate(selectedDate));
        },
      });
      return;
    }

    setVisible(true);
  };

  const applyValue = () => {
    onChangeText(formatTimeValue(hour, minute));
    setVisible(false);
  };

  useEffect(() => {
    if (!visible) return;

    const next = parseTimeParts(value);
    const hourIndex = Math.max(0, TIME_WHEEL_HOURS.indexOf(next.hour));
    const minuteIndex = Math.max(0, TIME_WHEEL_MINUTES.indexOf(next.minute));

    const timer = setTimeout(() => {
      hourScrollRef.current?.scrollTo({ y: hourIndex * TIME_WHEEL_ITEM_HEIGHT, animated: false });
      minuteScrollRef.current?.scrollTo({ y: minuteIndex * TIME_WHEEL_ITEM_HEIGHT, animated: false });
    }, 0);

    return () => clearTimeout(timer);
  }, [value, visible]);

  const handleWheelEnd = (
    kind: 'hour' | 'minute',
    yOffset: number,
  ) => {
    const options = kind === 'hour' ? TIME_WHEEL_HOURS : TIME_WHEEL_MINUTES;
    const index = Math.max(0, Math.min(options.length - 1, Math.round(yOffset / TIME_WHEEL_ITEM_HEIGHT)));
    const nextValue = options[index];

    if (kind === 'hour') {
      setHour(nextValue);
      hourScrollRef.current?.scrollTo({ y: index * TIME_WHEEL_ITEM_HEIGHT, animated: true });
    } else {
      setMinute(nextValue);
      minuteScrollRef.current?.scrollTo({ y: index * TIME_WHEEL_ITEM_HEIGHT, animated: true });
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={openPicker}
        activeOpacity={0.84}
        style={[s.timeButton, compact && s.timeButtonCompact]}
      >
        <Text style={[s.timeButtonValue, compact && s.timeButtonValueCompact]}>
          {formatTimeValue(hour, minute)}
        </Text>
        <ChevronDown s={compact ? 14 : 16} c="#C5A059" />
      </TouchableOpacity>

      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={s.pickerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
          {Platform.OS === 'ios' && NativeDateTimePicker ? (
            <View style={s.timePickerSheet}>
              <View style={s.timePickerHandle} />
              <View style={s.timePickerHeader}>
                <Text style={s.timePickerTitle}>Select Time</Text>
                <TouchableOpacity onPress={() => setVisible(false)} activeOpacity={0.84} style={s.timePickerClose}>
                  <X s={18} c="#A8A29E" />
                </TouchableOpacity>
              </View>

              <View style={s.timePreviewInline}>
                <Text style={s.timePreviewInlineLabel}>Selected</Text>
                <Text style={s.timePreviewInlineValue}>{formatTimeValue(hour, minute)}</Text>
              </View>

              <View style={s.nativeIosPickerWrap}>
                <NativeDateTimePicker
                  value={nativeDate}
                  mode="time"
                  display="spinner"
                  minuteInterval={5}
                  is24Hour
                  themeVariant="light"
                  textColor="#2F3440"
                  onChange={(_event: unknown, selectedDate?: Date) => {
                    if (!selectedDate) return;
                    setHour(String(selectedDate.getHours()).padStart(2, '0'));
                    setMinute(String(selectedDate.getMinutes()).padStart(2, '0'));
                  }}
                  style={s.nativeIosPicker}
                />
              </View>

              <TouchableOpacity onPress={applyValue} activeOpacity={0.86} style={s.timeSaveButton}>
                <Text style={s.timeSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.timePickerSheet}>
              <View style={s.timePickerHandle} />
              <View style={s.timePickerHeader}>
                <Text style={s.timePickerTitle}>Select Time</Text>
                <TouchableOpacity onPress={() => setVisible(false)} activeOpacity={0.84} style={s.timePickerClose}>
                  <X s={18} c="#A8A29E" />
                </TouchableOpacity>
              </View>

              <View style={s.timePreviewInline}>
                <Text style={s.timePreviewInlineLabel}>Selected</Text>
                <Text style={s.timePreviewInlineValue}>{formatTimeValue(hour, minute)}</Text>
              </View>

              <View style={s.timeWheelCard}>
                <View style={s.timeWheelSelectionBand} />

                <View style={s.timeWheelFadeTop} pointerEvents="none" />
                <View style={s.timeWheelFadeBottom} pointerEvents="none" />

                <View style={s.timeWheelColumns}>
                  <View style={s.timeWheelColumn}>
                    <ScrollView
                      ref={hourScrollRef}
                      showsVerticalScrollIndicator={false}
                      snapToInterval={TIME_WHEEL_ITEM_HEIGHT}
                      decelerationRate="fast"
                      bounces={false}
                      scrollEventThrottle={16}
                      onMomentumScrollEnd={event => handleWheelEnd('hour', event.nativeEvent.contentOffset.y)}
                      contentContainerStyle={s.timeWheelContent}
                    >
                      {TIME_WHEEL_HOURS.map(option => {
                        const active = option === hour;
                        return (
                          <View key={option} style={s.timeWheelItem}>
                            <Text style={[s.timeWheelItemText, active && s.timeWheelItemTextActive]}>{option}</Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <Text style={s.timeWheelColon}>:</Text>

                  <View style={s.timeWheelColumn}>
                    <ScrollView
                      ref={minuteScrollRef}
                      showsVerticalScrollIndicator={false}
                      snapToInterval={TIME_WHEEL_ITEM_HEIGHT}
                      decelerationRate="fast"
                      bounces={false}
                      scrollEventThrottle={16}
                      onMomentumScrollEnd={event => handleWheelEnd('minute', event.nativeEvent.contentOffset.y)}
                      contentContainerStyle={s.timeWheelContent}
                    >
                      {TIME_WHEEL_MINUTES.map(option => {
                        const active = option === minute;
                        return (
                          <View key={option} style={s.timeWheelItem}>
                            <Text style={[s.timeWheelItemText, active && s.timeWheelItemTextActive]}>{option}</Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              </View>

              <TouchableOpacity onPress={applyValue} activeOpacity={0.86} style={s.timeSaveButton}>
                <Text style={s.timeSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

function TimeField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={s.stackTight}>
      <SectionLabel text={label} accent="#C5A059" compact />
      <TimePickerButton value={value} onChangeText={onChangeText} />
    </View>
  );
}

function ToggleRow({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const progress = useSelectionMotion(active);
  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E7EB', C.gold],
  });
  const thumbTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 16],
  });

  const handlePress = () => {
    animateSoftLayoutChange();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.84} style={s.toggleRow}>
      <Text style={s.toggleText}>{label}</Text>
      <Animated.View style={[s.toggleTrack, { backgroundColor: trackColor }]}>
        <Animated.View style={[s.toggleThumb, { transform: [{ translateX: thumbTranslateX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

function SectionLabel({
  text,
  accent,
  compact = false,
}: {
  text: string;
  accent: string;
  compact?: boolean;
}) {
  return (
    <Text style={[s.sectionLabel, { color: accent }, compact && { marginBottom: 0 }]}>{text}</Text>
  );
}

function PrimaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.84} style={s.primaryBtn}>
      <Text style={s.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayScrim: {
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sheetShell: {
    maxHeight: '88%',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D6D3D1',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE6',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 36 },
  headerTitle: {
    fontFamily: F.serifMedium,
    fontSize: 20,
    color: '#1F2937',
  },
  segmentWrap: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginTop: 16,
    padding: 4,
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECE8E0',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
  },
  segmentPill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 16,
    backgroundColor: C.gold,
    shadowColor: C.gold,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 3,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 1,
  },
  segmentText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  segmentTextActive: { color: '#FFFFFF' },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 30,
    gap: 18,
  },
  stack: { gap: 16 },
  stackTight: { gap: 10 },
  rowGap10: { gap: 10 },
  cardBlock: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
  },
  blockLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: C.gold,
    textTransform: 'uppercase',
  },
  sectionLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  typeGridFive: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  prayerTypeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  prayerTypeTouch: {
    flex: 1,
    minWidth: 0,
  },
  prayerTypeBtn: {
    minHeight: 72,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 9,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 2,
  },
  prayerTypeText: {
    fontFamily: F.sansBold,
    fontSize: 8.3,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 11,
  },
  typeGridTwo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    width: '18%',
    minWidth: 58,
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  typeChipText: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.1,
    color: '#B6B8C0',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  scriptureTypeChip: {
    width: '48%',
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  scriptureTypeText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.3,
    lineHeight: 14,
    color: '#B6B8C0',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  bigTitleInput: {
    minHeight: 50,
    fontFamily: F.serif,
    fontSize: 24,
    color: '#1F2937',
    paddingVertical: 0,
  },
  timeLikeInput: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9DEC9',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 16,
    fontFamily: F.serifMedium,
    fontSize: 22,
    color: '#1F2937',
    textAlign: 'center',
  },
  timeButton: {
    minHeight: 56,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9DEC9',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  timeButtonCompact: {
    minHeight: 44,
    minWidth: 108,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderColor: '#ECE2CF',
    marginLeft: 'auto',
  },
  timeButtonValue: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    color: '#2F3440',
    letterSpacing: 0.2,
  },
  timeButtonValueCompact: {
    fontSize: 18,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16,24,40,0.24)',
  },
  timePickerSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FFFEFB',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },
  timePickerHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    backgroundColor: '#DED9D0',
  },
  timePickerHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timePickerTitle: {
    fontFamily: F.serifMedium,
    fontSize: 22,
    color: '#1F2937',
  },
  timePickerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F2EC',
  },
  timePreviewInline: {
    alignItems: 'center',
    gap: 2,
  },
  timePreviewInlineLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.9,
    color: '#B08A47',
    textTransform: 'uppercase',
  },
  timePreviewInlineValue: {
    fontFamily: F.serifMedium,
    fontSize: 32,
    color: '#2F3440',
    letterSpacing: 0.4,
  },
  nativeIosPickerWrap: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#EFE5D3',
    backgroundColor: '#FFFDF8',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  nativeIosPicker: {
    width: '100%',
    height: 210,
  },
  timeWheelCard: {
    position: 'relative',
    height: TIME_WHEEL_ITEM_HEIGHT * TIME_WHEEL_VISIBLE_ROWS,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#EFE5D3',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  timeWheelSelectionBand: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: TIME_WHEEL_PADDING,
    height: TIME_WHEEL_ITEM_HEIGHT,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8D4AB',
    backgroundColor: '#FFF9EE',
    shadowColor: '#D7B574',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  timeWheelFadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TIME_WHEEL_PADDING,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  timeWheelFadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: TIME_WHEEL_PADDING,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  timeWheelColumns: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  timeWheelColumn: {
    width: 96,
    height: '100%',
  },
  timeWheelColon: {
    width: 30,
    textAlign: 'center',
    fontFamily: F.serifMedium,
    fontSize: 30,
    color: '#B08A47',
    marginTop: -2,
  },
  timeWheelContent: {
    paddingVertical: TIME_WHEEL_PADDING,
  },
  timeWheelItem: {
    height: TIME_WHEEL_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeWheelItemText: {
    fontFamily: F.serifMedium,
    fontSize: 26,
    color: 'rgba(47,52,64,0.28)',
    letterSpacing: 0.2,
  },
  timeWheelItemTextActive: {
    color: '#B08A47',
    fontSize: 30,
  },
  timeSaveButton: {
    minHeight: 56,
    borderRadius: 22,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.gold,
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  timeSaveButtonText: {
    fontFamily: F.sansBold,
    fontSize: 17,
    letterSpacing: 0.4,
    color: '#FFFDF8',
  },
  optionStack: { gap: 10 },
  optionCard: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  optionCardActive: {
    borderColor: '#D8B56E',
    backgroundColor: '#FFF9EE',
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D6D3D1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRadioActive: { borderColor: C.gold },
  optionRadioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: C.gold,
  },
  optionTitle: {
    fontFamily: F.serifMedium,
    fontSize: 15,
    color: '#4B5563',
  },
  optionTitleActive: { color: '#111827' },
  optionBody: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 15,
    color: '#9CA3AF',
  },
  segmentMiniWrap: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FAFAFA',
  },
  segmentMiniBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentMiniBtnActive: {
    backgroundColor: C.gold,
  },
  segmentMiniText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.3,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  segmentMiniTextActive: { color: '#FFFFFF' },
  jesusConfigStack: {
    gap: 12,
  },
  jesusModeWrap: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EEE3D1',
    backgroundColor: '#FFFDF8',
    position: 'relative',
    overflow: 'hidden',
  },
  jesusModePill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 14,
    backgroundColor: C.gold,
    shadowColor: C.gold,
    shadowOpacity: 0.26,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 12,
    elevation: 3,
  },
  jesusModeBtn: {
    flex: 1,
    minHeight: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  jesusModeText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  jesusModeTextActive: {
    color: '#FFFFFF',
  },
  jesusValueRow: {
    flexDirection: 'row',
    gap: 8,
  },
  jesusValueTouch: {
    flex: 1,
  },
  jesusValueChip: {
    minHeight: 43,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    shadowColor: C.gold,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  jesusValueText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  techniqueRow: {
    flexDirection: 'row',
    gap: 9,
  },
  techniqueTouch: {
    flex: 1,
  },
  techniqueBtn: {
    minHeight: 70,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 9,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 2,
    overflow: 'hidden',
  },
  techniqueBtnText: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.05,
    color: '#A8A29E',
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 12,
  },
  techniqueBtnTextActive: { color: '#FFFFFF' },
  frequencyWrap: {
    gap: 8,
  },
  frequencyChip: {
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    paddingHorizontal: 15,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 1,
  },
  frequencyChipActive: {
    borderColor: '#D6B067',
    backgroundColor: '#FFF9EE',
  },
  frequencyCopy: {
    flex: 1,
    minWidth: 0,
  },
  frequencyChipText: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    color: '#4B5563',
  },
  frequencyChipTextActive: { color: '#1F2937' },
  frequencyChipSub: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 11,
    color: '#9CA3AF',
  },
  frequencyChipSubActive: { color: '#B08A47' },
  frequencyDotRing: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#EEE7D8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyDotRingActive: {
    borderColor: '#E4C987',
    backgroundColor: '#FFFBEB',
  },
  frequencyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.gold,
  },
  gridMeasure: {
    width: '100%',
  },
  dayChipRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  dayChip: {
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    borderColor: C.gold,
    backgroundColor: '#FFF9EE',
  },
  dayChipText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: '#A8A29E',
  },
  dayChipTextActive: { color: C.gold },
  monthlyGridWrap: {
    gap: 8,
  },
  monthlyHint: {
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 18,
    color: '#8B909A',
  },
  monthlyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  monthlyCell: {
    width: 42,
  },
  toggleRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleText: {
    flex: 1,
    fontFamily: F.sans,
    fontSize: 12,
    color: '#6B7280',
  },
  toggleTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E5E7EB',
    padding: 2,
  },
  toggleTrackActive: {
    backgroundColor: C.gold,
  },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  dayTimeStack: { gap: 8, overflow: 'hidden' },
  dayTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1E7D6',
    backgroundColor: '#FFFCF7',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  dayTimeLabel: {
    flex: 1,
    fontFamily: F.sansBold,
    fontSize: 14,
    letterSpacing: 0.15,
    color: '#5B616C',
  },
  notificationRow: {
    flexDirection: 'row',
    gap: 9,
  },
  notificationChip: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECE8E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationChipActive: {
    borderColor: C.gold,
    backgroundColor: '#FFF9EE',
  },
  notificationChipText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.3,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  notificationChipTextActive: { color: C.gold },
  reminderRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  reminderChip: {
    minWidth: 54,
    minHeight: 36,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECE8E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  reminderChipActive: {
    borderColor: C.gold,
    backgroundColor: '#FFF9EE',
  },
  reminderChipText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: '#9CA3AF',
  },
  reminderChipTextActive: { color: C.gold },
  pickerButton: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECE8E0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pickerButtonActive: {
    borderColor: C.gold,
    backgroundColor: '#FFF9EE',
  },
  pickerValue: {
    flex: 1,
    fontFamily: F.serif,
    fontSize: 16,
    color: '#1F2937',
  },
  psalmGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    maxHeight: 250,
  },
  psalmCell: {
    width: 48,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ECE8E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  psalmCellActive: {
    borderColor: C.gold,
    backgroundColor: '#FFF9EE',
  },
  psalmCellText: {
    fontFamily: F.serif,
    fontSize: 16,
    color: '#6B7280',
  },
  psalmCellTextActive: { color: C.gold },
  bookAccordion: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    overflow: 'hidden',
  },
  bookAccordionItem: {
    borderTopWidth: 1,
    borderTopColor: '#F7F5F1',
  },
  bookAccordionBtn: {
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  bookAccordionBtnActive: {
    backgroundColor: '#FFF9EE',
  },
  bookAccordionTitle: {
    fontFamily: F.serif,
    fontSize: 16,
    color: '#4B5563',
  },
  bookAccordionTitleActive: { color: C.goldDark },
  bookAccordionMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chapterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    backgroundColor: '#FFFDFC',
  },
  chapterCell: {
    width: 40,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ECE8E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterCellActive: {
    borderColor: C.gold,
    backgroundColor: C.gold,
  },
  chapterCellTextSmall: {
    fontFamily: F.serif,
    fontSize: 13,
    color: '#6B7280',
  },
  chapterCellTextSmallActive: { color: '#FFFFFF' },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amountBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECE8E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountBtnText: {
    fontFamily: F.serifMedium,
    fontSize: 26,
    color: C.gold,
    marginTop: -2,
  },
  amountCenter: {
    flex: 1,
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9DEC9',
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountValue: {
    fontFamily: F.serifMedium,
    fontSize: 30,
    color: '#1F2937',
  },
  amountCaption: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 11,
    color: '#9CA3AF',
  },
  challengeCardShell: {
    borderRadius: 32,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderColor: 'rgba(197,160,89,0.22)',
    borderLeftColor: C.gold,
    borderRightColor: C.gold,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#C5A059',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  challengeCardShellStarted: {
    borderColor: 'rgba(197,160,89,0.48)',
    borderLeftColor: C.gold,
    borderRightColor: C.gold,
    backgroundColor: '#FFFDF7',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 4,
  },
  challengeCard: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  challengeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  challengeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  challengeBadgeText: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.3,
    color: '#3B82F6',
    textTransform: 'uppercase',
  },
  challengeBadgeMuted: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#F5F5F4',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  challengeBadgeMutedText: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.3,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  challengeFlame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  challengeFlameText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: '#F97316',
  },
  challengeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  challengeTitle: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 17,
    lineHeight: 23,
    color: '#1F2937',
  },
  challengeMetaText: {
    marginTop: 7,
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.1,
    color: '#B49B67',
  },
  challengePausedText: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  challengeProgressTrack: {
    marginTop: 13,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.15)',
    overflow: 'hidden',
  },
  challengeProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: C.gold,
  },
  challengeEditor: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFFDF7',
    gap: 14,
  },
  challengeActionRow: {
    flexDirection: 'row',
    gap: 9,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECE8E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  dangerBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: '#EF4444',
    textTransform: 'uppercase',
  },
  challengeConfirmOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  challengeConfirmCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 26,
    elevation: 10,
  },
  challengeConfirmIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF8E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  challengeConfirmIconDanger: {
    backgroundColor: '#FEF2F2',
  },
  challengeConfirmTitle: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    color: '#111827',
    textAlign: 'center',
  },
  challengeConfirmBody: {
    marginTop: 7,
    fontFamily: F.serifItalic,
    fontSize: 15,
    lineHeight: 21,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  challengeConfirmRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 20,
  },
  challengeConfirmCancel: {
    flex: 1,
    minHeight: 46,
    borderRadius: 22,
    backgroundColor: '#F5F5F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeConfirmPrimary: {
    flex: 1,
    minHeight: 46,
    borderRadius: 22,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeConfirmDanger: {
    backgroundColor: '#DC2626',
  },
  challengeConfirmCancelText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: '#6B7280',
  },
  challengeConfirmPrimaryText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: '#FFFFFF',
  },
  catalogCard: {
    minHeight: 76,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catalogCardActive: {
    borderColor: '#D8B56E',
    backgroundColor: '#FFF9EE',
  },
  catalogIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogTitle: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    color: '#1F2937',
  },
  catalogBody: {
    marginTop: 4,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 15,
    color: '#9CA3AF',
  },
  catalogStartCard: {
    borderRadius: 28,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftColor: 'rgba(197,160,89,0.34)',
    borderRightColor: 'rgba(197,160,89,0.34)',
    borderTopColor: 'rgba(197,160,89,0.18)',
    borderBottomColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFFDF8',
    overflow: 'hidden',
    shadowColor: '#C5A059',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 16,
    elevation: 2,
  },
  catalogStartCardExpanded: {
    borderLeftColor: '#C5A059',
    borderRightColor: '#C5A059',
    borderTopColor: 'rgba(197,160,89,0.34)',
    borderBottomColor: 'rgba(197,160,89,0.34)',
    backgroundColor: '#FFFCF4',
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 4,
  },
  catalogStartTap: {
    paddingHorizontal: 16,
    paddingVertical: 17,
  },
  catalogStartTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  catalogStartMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  catalogStartIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#FBF4E7',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogStartCopy: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  catalogStartTitle: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    lineHeight: 22,
    color: '#231F20',
  },
  catalogStartBody: {
    marginTop: 4,
    fontFamily: F.sans,
    fontSize: 12.2,
    lineHeight: 16,
    color: '#A1A4B2',
  },
  catalogStartMeta: {
    marginTop: 8,
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.3,
    color: '#B08A47',
  },
  catalogSetupInline: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,160,89,0.18)',
    paddingHorizontal: 16,
    paddingTop: 17,
    paddingBottom: 18,
    gap: 16,
  },
  catalogSetupBlock: {
    gap: 10,
  },
  catalogScheduleShell: {
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EDD6A6',
    backgroundColor: '#FFFCF4',
    padding: 15,
  },
  setupCard: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E9DDC5',
    backgroundColor: '#FFFDF7',
    padding: 16,
    gap: 14,
  },
  setupTitle: {
    fontFamily: F.serifMedium,
    fontSize: 20,
    color: '#1F2937',
  },
  setupBody: {
    fontFamily: F.serif,
    fontSize: 14,
    lineHeight: 20,
    color: '#8B8E96',
  },
  scriptureStartCard: {
    borderRadius: 32,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftColor: 'rgba(197,160,89,0.38)',
    borderRightColor: 'rgba(197,160,89,0.38)',
    borderTopColor: 'rgba(197,160,89,0.16)',
    borderBottomColor: 'rgba(197,160,89,0.16)',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#C5A059',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 16,
    elevation: 1,
  },
  scriptureStartCardExpanded: {
    borderLeftColor: '#C5A059',
    borderRightColor: '#C5A059',
    borderTopColor: 'rgba(197,160,89,0.3)',
    borderBottomColor: 'rgba(197,160,89,0.3)',
    backgroundColor: '#FFFDF7',
  },
  scriptureStartCardTap: {
    paddingHorizontal: 18,
    paddingVertical: 19,
  },
  scriptureStartTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  scriptureStartMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  scriptureStartIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#FBF4E7',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scriptureStartCopy: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  scriptureStartTitle: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    lineHeight: 22,
    color: '#231F20',
  },
  scriptureStartBody: {
    marginTop: 5,
    fontFamily: F.sans,
    fontSize: 12.5,
    lineHeight: 17,
    color: '#A3A3B2',
  },
  scriptureSetupInline: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(197,160,89,0.18)',
    paddingHorizontal: 18,
    paddingTop: 17,
    paddingBottom: 18,
    gap: 16,
  },
  scriptureSetupBlock: {
    gap: 10,
  },
  scriptureSetupLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: '#C5A059',
    textTransform: 'uppercase',
  },
  scriptureAmountRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scriptureAmountChip: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ECE8E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scriptureAmountChipActive: {
    borderColor: C.gold,
    backgroundColor: '#FFF9EE',
  },
  scriptureAmountValue: {
    fontFamily: F.serifMedium,
    fontSize: 19,
    color: '#7C7A73',
  },
  scriptureAmountValueActive: {
    color: C.goldDark,
  },
  scriptureAmountMeta: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  scriptureAmountLabel: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: '#A97732',
    textTransform: 'uppercase',
  },
  scriptureAmountHint: {
    fontFamily: F.serif,
    fontSize: 14,
    color: '#8B8E96',
  },
  scriptureApproxDays: {
    marginTop: 2,
    textAlign: 'center',
    fontFamily: F.sans,
    fontSize: 12.5,
    color: '#A8A29E',
  },
  scriptureScheduleShell: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#EDD6A6',
    backgroundColor: '#FFFCF4',
    padding: 16,
  },
  paceRow: {
    flexDirection: 'row',
    gap: 7,
    flexWrap: 'wrap',
  },
  paceChip: {
    flexGrow: 1,
    minWidth: 76,
    minHeight: 42,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9DEC9',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C5A059',
    shadowOpacity: 0.035,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
  },
  paceChipActive: {
    borderColor: C.gold,
    backgroundColor: '#FFF6E6',
    shadowOpacity: 0.12,
  },
  paceLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: '#8A826F',
    textTransform: 'uppercase',
  },
  paceLabelActive: { color: C.goldDark },
  groupTitle: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: '#A8A29E',
    textTransform: 'uppercase',
    marginBottom: -4,
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 20,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.gold,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 4,
  },
  primaryBtnText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  smallHint: {
    fontFamily: F.sans,
    fontSize: 11,
    color: '#9CA3AF',
  },
});
