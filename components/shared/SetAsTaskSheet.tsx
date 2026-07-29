import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutAnimation,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Reanimated, {
  Easing,
  FadeIn,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StaticChallengeTrophy } from '@/components/challenges/ChallengeTrophy';
import TaskTimeEditor from '@/components/shared/TaskTimeEditor';
import {
  Book,
  BookMarked,
  CalendarCheck,
  CheckSmall,
  ChevronDown,
  Cross,
  Feather,
  Moon,
  Notebook,
  OpenBook,
  OrthodoxCross,
  Pause,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
  Utensils,
  X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { useChallenges } from '@/components/challenges/ChallengesContext';
import { challengeRecordToTaskDraft } from '@/components/challenges/challengeTaskSync';
import NotificationSettings, { type NotificationMode } from '@/components/shared/NotificationSettings';
import {
  ChallengeCatalogEntry,
  ChallengeChurchConfig,
  ChallengePrayerConfig,
  ChallengeRecord,
  ChallengeScriptureConfig,
  compareChallengeCatalogEntries,
} from '@/components/challenges/challengeData';
import type { TaskDraft, TaskSchedule } from '@/components/tasks/taskTypes';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';


// eslint-disable-next-line @typescript-eslint/no-require-imports
const DateTimePickerModule = Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker');
const NativeDateTimePicker = DateTimePickerModule?.default ?? null;
const NativeDateTimePickerAndroid = DateTimePickerModule?.DateTimePickerAndroid ?? null;
const STREAK_FLAME_PNG = require('@/assets/images/streak-flame.png');
const ROUTINE_TASK_ACCENT = '#1F2937';
const ROUTINE_TASK_ACCENT_MUTED = '#57534E';

// The two sides of this switch are two different things, so they are shown
// as the app's own currencies rather than as two line icons from the same
// set: a challenge is a trophy, a spiritual task is a flame, a journal
// routine is a book. Each sits in the trophy's own double disc — a warmer
// outer ring and a paler heart — so the three read as one family struck to
// one pattern. Line icons said "two options"; these say what each one is.
const SEGMENT_FLAME = require('@/assets/images/streak-flame-512.png');
const SEGMENT_BOOK = require('@/assets/images/streak-book-512.png');

/**
 * The light the flame casts on its own plaque.
 *
 * A flat disc of warm colour behind the emblem is a shape, and the eye reads
 * it as one — a second ring outside the two the emblem already has. Light is
 * not a shape: it is strongest at its source and gone by its edge, so it is
 * drawn as a real radial fall-off. This is the pool of light the app pours
 * under its seals elsewhere, lit here by the one emblem that is literally a
 * flame.
 *
 * Static: no clock, no worklet, one <Svg> that mounts with the sheet. The
 * emblem's own opacity is the only thing that ever moves.
 */
const BLOOM = 64;

function FlameBloom() {
  return (
    <View pointerEvents="none" style={seg.bloom}>
      <Svg width={BLOOM} height={BLOOM}>
        <Defs>
          <RadialGradient id="segFlameBloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFAE4A" stopOpacity={0.40} />
            <Stop offset="0.5" stopColor="#FFBE6E" stopOpacity={0.17} />
            <Stop offset="1" stopColor="#FFD6A4" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={BLOOM / 2} cy={BLOOM / 2} r={BLOOM / 2} fill="url(#segFlameBloom)" />
      </Svg>
    </View>
  );
}

/* ⚠ THE RINGS OF THE STRIKE WERE HERE, AND ARE GONE.
 *
 * Concentric hairlines spreading from under the flame, lifted from the medal
 * streak card in Focus. Handsome, and the wrong dialect: rings of a strike are
 * the language of an INSTRUMENT — a minted face, a struck medal — and this is
 * the plaque of a spiritual task, whose register in this app is the manuscript
 * page. The ruled frame below is the same weight of figure said in the right
 * language, and the two could never share the surface: a frame crossing rings
 * reads as a mistake in one of them. */

function SegmentEmblem({
  kind,
  active,
  onInk = false,
}: {
  kind: 'flame' | 'book' | 'trophy';
  active: boolean;
  onInk?: boolean;
}) {
  /* ⚠ THE SEAT MUST BE READ AGAINST ITS OWN GROUND.
   *
   * All three emblems were struck to one pattern — a pale outer disc and a
   * paler heart — which is right on the challenge plaque (near-white) and on
   * the journal one (ink), and was invisible on the spiritual one: its cream
   * face is #FFF4DC and the disc laid on it was #FFF4D6. The same colour. The
   * halo, a whitening, disappeared into it too, so the flame stood on nothing
   * while the trophy across the switch sat properly seated.
   *
   * The pattern is kept — 28 disc, 22 heart, one centre — and only the values
   * turn over on cream: the disc goes DEEPER than its ground rather than
   * paler, the heart stays light, and the two-ring structure comes back. The
   * flame's halo becomes what a flame's halo should be, a warm amber bloom,
   * since a whitening cannot show on cream. */
  const onCream = kind === 'flame' && !onInk;

  // Selected, the emblem throws its own light: amber off the flame, gilt off
  // the trophy and the book. It is the plaque catching what stands on it, and
  // it is what stops the emblem reading as pasted on.
  const glow = !active ? null : onCream ? (
    // On cream a whitening is nothing at all, and a flat amber disc is just a
    // third ring. What a flame casts is light, so it is drawn as light.
    <FlameBloom />
  ) : (
    <View
      style={[
        seg.emblemGlow,
        kind === 'flame' && seg.emblemGlowWarm,
        // On ink a halo is light; on cream it can only be a bloom.
        onInk && seg.emblemGlowOnInk,
      ]}
    />
  );

  if (kind === 'trophy') {
    // The challenge screen's own trophy, which already carries this disc.
    return (
      <View style={[seg.emblemSeat, !active && seg.emblemResting]}>
        {glow}
        <StaticChallengeTrophy size={32} />
      </View>
    );
  }
  return (
    <View style={[seg.emblemSeat, !active && seg.emblemResting]}>
      {glow}
      {/* On cream the seat is struck rather than painted: it takes light at
          the shoulder and turns to gold at the foot, like every other
          medallion in this app. A flat wash of one colour was legible — which
          was the fault being fixed — but legible is not the same as made. */}
      <View style={[seg.emblemDisc, onCream && seg.emblemDiscOnCream]}>
        {onCream && (
          <LinearGradient
            colors={['rgba(255,255,255,0.66)', 'rgba(197,160,89,0.30)']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
      </View>
      <View style={[seg.emblemHeart, onCream && seg.emblemHeartOnCream]} />
      <Image
        source={kind === 'flame' ? SEGMENT_FLAME : SEGMENT_BOOK}
        // The trophy fills its 32 box; the flame was sitting at 17 inside the
        // same box and reading as the smaller of the two currencies.
        style={[seg.emblemArt, onCream && seg.emblemArtFlame]}
        resizeMode="contain"
      />
    </View>
  );
}

const seg = StyleSheet.create({
  // The trophy's own construction, to the point. Its discs are 52 and 41 of
  // a 120 box, so at 32 they come out 28 and 22 — the box stays 32 so both
  // emblems sit on the same centre and the two halves of the switch line up.
  emblemSeat: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemDisc: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF4D6',
  },
  emblemHeart: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF9E8',
  },
  // On cream the disc is the one ring that has to be DARKER than its ground —
  // a warm wash of the gold the whole spiritual register is set in. Held at
  // 0.20 it is a seat, not a badge: strong enough to give the flame a rim to
  // stand on, quiet enough that the plaque still reads as warm paper.
  // ⚠ And a rim of gilt around it. The trophy opposite is a modelled object
  // that fills its seat and holds its own edge; the flame is a small piece of
  // art laid on a disc, and without a struck rim it reads as the lesser of the
  // two currencies however well the disc under it is made.
  emblemDiscOnCream: {
    overflow: 'hidden',
    backgroundColor: 'rgba(197,160,89,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.5)',
  },
  // And the heart runs the other way, near white, so the two rings show
  // against each other instead of both dissolving into the plate.
  emblemHeartOnCream: { backgroundColor: '#FFFDF7' },
  emblemArt: { width: 17, height: 17 },
  emblemArtFlame: { width: 19, height: 19 },
  // The bloom hangs outside the 32 seat, centred on it by the seat's own
  // align rules — the same way the 40 halo already does.
  bloom: { position: 'absolute', width: BLOOM, height: BLOOM },
  // On the light plaque the halo is a whitening, not a glow: it lifts the
  // emblem off the cream the way the doors' halo seats do.
  emblemGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  emblemGlowWarm: { backgroundColor: 'rgba(255,252,244,0.8)' },
  emblemGlowOnInk: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,240,205,0.20)',
  },
  // Unselected, the emblem is still itself — only dimmer. Greying it out
  // would have thrown away the one thing worth showing.
  emblemResting: { opacity: 0.55 },
});
const ROUTINE_TASK_SOFT = '#F5F5F4';
const ROUTINE_TASK_BORDER = '#D6D3D1';

if (Platform.OS === 'android' && typeof UIManager.setLayoutAnimationEnabledExperimental === 'function') {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TaskSheetContext = 'prayer' | 'journal' | 'scripture' | 'church';

type GuideTargetBinding = {
  ref?: React.Ref<any>;
  onLayout?: (event: any) => void;
};

export type ChallengeGuideBindings = {
  catalogEntryId?: string;
  catalogEntry?: GuideTargetBinding;
  start?: GuideTargetBinding;
};
type TaskTab = 'spiritual' | 'routine' | 'challenge';
type RuleFrequency = 'daily' | 'weekdays' | 'weekends' | 'specific_days' | 'monthly';
export type PrayerType = 'morning' | 'evening' | 'meal' | 'jesus' | 'custom';
type JournalTechnique = 'daily' | 'morning_pages' | 'free_writing';
export type ScriptureReadingType = 'new_testament' | 'old_testament' | 'psalter' | 'church_calendar' | 'custom';
type PrayerRuleChoice = 'standard' | 'short' | 'seraphim' | 'personal' | 'breakfast' | 'lunch' | 'dinner';
export type PrayerChallengeRuleChoice = Extract<PrayerRuleChoice, 'standard' | 'short' | 'seraphim' | 'personal'>;
export type JesusPrayerMode = 'duration' | 'count';

function isOrthodoxRuleChoice(rule: PrayerRuleChoice) {
  return rule !== 'personal';
}

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

export type ChallengeChurchScheduleDraft = ScheduleDraft;

export type ChallengeScheduleDraft = {
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
  onTaskMutation?: () => void | Promise<void>;
  // Optional preselects (used by onboarding): when provided, the sheet opens
  // with this type already chosen — identical to the user tapping it.
  // Default behavior is unchanged when omitted.
  initialPrayerType?: PrayerType;
  initialScriptureType?: ScriptureReadingType;
  lockToPrimaryTask?: boolean;
};

type ChallengeConfirmAction = {
  mode: 'pause' | 'resume' | 'end';
  item: ChallengeRecord;
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function currentWeekdayIndex() {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function ensureSelectedWeekdays(days: number[]) {
  return days.length ? days : [currentWeekdayIndex()];
}

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
  { key: 'jesus', label: 'Jesus', short: 'JESUS', Icon: Cross, accent: '#B98228', tint: '#FFF3E2', border: '#E9C98E', defaultTitle: 'Jesus Prayer', defaultTime: '13:00' },
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
  { key: 'daily', label: 'Daily Journal', Icon: Pencil, color: '#1F2937', defaultTitle: 'Daily Journal', defaultTime: '21:30' },
  { key: 'morning_pages', label: 'Morning Pages', Icon: Feather, color: '#44403C', defaultTitle: 'Morning Pages', defaultTime: '07:15' },
  { key: 'free_writing', label: 'Free Writing', Icon: Notebook, color: '#57534E', defaultTitle: 'Free Writing', defaultTime: '20:45' },
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

function scriptureSessionAmountLabel(type: ScriptureReadingType, amount: number) {
  if (type === 'church_calendar') return 'Church readings';
  const safeAmount = Math.max(1, Math.round(Number.isFinite(amount) ? amount : 1));
  if (type === 'psalter') return `${safeAmount} ${safeAmount === 1 ? 'psalm' : 'psalms'}/day`;
  return `${safeAmount} ${safeAmount === 1 ? 'chapter' : 'chapters'}/day`;
}

const META_SEPARATOR = ` ${String.fromCharCode(183)} `;

function cleanMetaSeparators(value?: string) {
  if (!value) return '';
  return value
    .replace(/\s*\u00C2\u00B7\s*/g, META_SEPARATOR)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const PRAYER_RULES: Record<Exclude<PrayerType, 'jesus' | 'custom'>, { key: PrayerRuleChoice; label: string; desc: string }[]> = {
  morning: [
    { key: 'personal', label: 'My Rule', desc: 'From your own prayer book or in your own way — any tradition' },
    { key: 'standard', label: 'Standard Rule', desc: 'Full morning prayers' },
    { key: 'short', label: 'Shortened Rule', desc: 'Abbreviated prayer rule' },
    { key: 'seraphim', label: 'St. Seraphim Rule', desc: 'Rule of St. Seraphim of Sarov' },
  ],
  evening: [
    { key: 'personal', label: 'My Rule', desc: 'From your own prayer book or in your own way — any tradition' },
    { key: 'standard', label: 'Standard Rule', desc: 'Full evening prayers' },
    { key: 'short', label: 'Shortened Rule', desc: 'Abbreviated prayer rule' },
    { key: 'seraphim', label: 'St. Seraphim Rule', desc: 'Rule of St. Seraphim of Sarov' },
  ],
  meal: [
    { key: 'personal', label: 'My Rule', desc: 'Your own meal prayer or blessing' },
    { key: 'breakfast', label: 'Breakfast Prayer', desc: 'Prayer before the morning meal' },
    { key: 'lunch', label: 'Lunch Prayer', desc: 'Prayer before the midday meal' },
    { key: 'dinner', label: 'Dinner Prayer', desc: 'Prayer before the evening meal' },
  ],
};

function prayerTaskIcon(prayerType: PrayerType) {
  switch (prayerType) {
    case 'evening':
      return 'Moon';
    case 'jesus':
      return 'Cross';
    case 'meal':
      return 'Utensils';
    case 'custom':
      return 'Feather';
    case 'morning':
    default:
      return 'Sun';
  }
}

function journalTaskIcon(technique: JournalTechnique) {
  switch (technique) {
    case 'morning_pages':
      return 'Feather';
    case 'free_writing':
      return 'Notebook';
    case 'daily':
    default:
      return 'Pencil';
  }
}

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

export function defaultChallengeSchedule(time = '08:00', notificationMode: NotificationMode = 'single'): ChallengeScheduleDraft {
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
    selectedDays: schedule.frequency === 'specific_days' ? ensureSelectedWeekdays(schedule.selectedDays) : [],
    monthlyDays: schedule.frequency === 'monthly' ? schedule.monthlyDays : [1],
    time: schedule.time,
    sameTimeEveryDay: schedule.sameTimeEveryDay,
    dayTimes: schedule.sameTimeEveryDay ? {} : schedule.dayTimes,
  };
}

function challengeCategoryForContext(context: TaskSheetContext) {
  switch (context) {
    case 'prayer': return 'prayer';
    case 'journal': return 'journal';
    case 'scripture': return 'scripture';
    case 'church': return 'church';
  }
}

const CHURCH_DEFAULT_DAYS = [6];

function defaultChurchChallengeSchedule(time = '09:00'): ChallengeChurchScheduleDraft {
  return {
    ...defaultSchedule(time, 'single'),
    frequency: 'specific_days',
    selectedDays: CHURCH_DEFAULT_DAYS,
  };
}

function churchScheduleLabel(schedule: ChallengeChurchScheduleDraft) {
  switch (schedule.frequency) {
    case 'daily':
      return 'Daily';
    case 'weekdays':
      return 'Weekdays';
    case 'weekends':
      return 'Weekends';
    case 'monthly':
      return `Monthly ${formatMonthlyDays(schedule.monthlyDays)}`;
    case 'specific_days': {
      const selectedDays = schedule.selectedDays.length ? schedule.selectedDays : CHURCH_DEFAULT_DAYS;
      if (selectedDays.length === 1 && selectedDays[0] === 6) return 'Every Sunday';
      return selectedDays.map(day => WEEKDAY_LABELS[day]).join(' / ');
    }
    default:
      return 'Every Sunday';
  }
}

function churchScheduleToConfig(schedule: ChallengeChurchScheduleDraft): ChallengeChurchConfig {
  return {
    frequency: schedule.frequency,
    selectedDays: schedule.frequency === 'specific_days'
      ? (schedule.selectedDays.length ? schedule.selectedDays : CHURCH_DEFAULT_DAYS)
      : [],
    monthlyDays: schedule.frequency === 'monthly' ? schedule.monthlyDays : [1],
    time: schedule.time,
    sameTimeEveryDay: schedule.sameTimeEveryDay,
    dayTimes: schedule.sameTimeEveryDay ? {} : schedule.dayTimes,
    notificationMode: schedule.notificationMode,
    reminderMinutes: schedule.notificationMode === 'double' ? schedule.reminderMinutes : undefined,
  };
}

/**
 * The category tag — the one coloured thing on a challenge card.
 *
 * Shape and voice are the achievement card's badge: a plain tinted pill, the
 * word set in the serif at a size meant to be read, no dot and no 8pt tracked
 * capitals. Colour is the card's own sorting tab, so a journal card carries
 * the violet you filtered it with and a scripture card the gold.
 *
 * The tag colours the tag and nothing else. The icon, the rails, the border,
 * the whisper frame and the progress gold are the app's material rather than a
 * per-category signal — tint those and one shelf becomes four.
 */
const CHALLENGE_TAG_PALETTE = {
  prayer: { label: 'Prayer', text: '#A76F16', bg: '#FDF3E1' },
  scripture: { label: 'Scripture', text: '#8E6F2C', bg: '#FBF3E2' },
  journal: { label: 'Journal', text: '#6D3FD4', bg: '#F3EDFE' },
  church: { label: 'Church', text: '#227954', bg: '#E7F4EE' },
} as const;

function challengeTag(category: ChallengeRecord['category'] | ChallengeCatalogEntry['category']) {
  return CHALLENGE_TAG_PALETTE[category as keyof typeof CHALLENGE_TAG_PALETTE]
    ?? CHALLENGE_TAG_PALETTE.scripture;
}

function challengePanelTone(category: ChallengeRecord['category'] | ChallengeCatalogEntry['category']) {
  void category;
  return {
    accent: '#C5A059',
    border: 'rgba(197,160,89,0.30)',
    badgeBg: '#FBF4E7',
    badgeText: '#8B6B2F',
    meta: '#9B7A39',
  };
}

/**
 * The figure at the right of the foot row.
 *
 * Every challenge has one, but not every challenge has an end: a church
 * rhythm and the daily lectionary run for as long as you keep them, so they
 * carry `showBar: false` and `progressTotal: 0`. Those cards used to reach
 * this row with nothing on the right at all, which left the foot lopsided and
 * made two of the categories look like a different card from the rest.
 * Open-ended or not, what has been done is a real figure — it is only the
 * proportion that is missing.
 */
function challengeFigure(item: ChallengeRecord) {
  return item.progressTotal
    ? `${item.progressCurrent}/${item.progressTotal} ${item.progressUnit}`
    : `${item.progressCurrent} ${item.progressUnit}`;
}

/** The card's inner divider: a gold hairline fading out at both ends. */
function ChallengeRule() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(197,160,89,0)', 'rgba(197,160,89,0.34)', 'rgba(197,160,89,0)']}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={s.challengeRule}
    />
  );
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
      return ensureSelectedWeekdays(schedule.selectedDays)
        .map(day => WEEKDAY_LABELS[day])
        .join(' ');
    case 'daily':
    default:
      return 'Daily';
  }
}

function groupedEntries(entries: ChallengeCatalogEntry[]) {
  return [...entries].sort(compareChallengeCatalogEntries);
}

function isScriptureChallengeEntry(entry: ChallengeCatalogEntry | null) {
  return !!entry && entry.category === 'scripture';
}

function needsScriptureDailyAmount(entry: ChallengeCatalogEntry | null) {
  return isScriptureChallengeEntry(entry) && entry?.id !== 'lectionary_daily';
}

export function scriptureDailyAmountLabel(entry: ChallengeCatalogEntry | null, amount: number) {
  const isPsalter = entry?.groupKey === 'psalter';
  const singular = isPsalter ? 'psalm' : 'chapter';
  const plural = isPsalter ? 'psalms' : 'chapters';
  return `${amount} ${amount === 1 ? singular : plural}/day`;
}

function scriptureDailyAmountTitle(entry: ChallengeCatalogEntry | null) {
  return entry?.groupKey === 'psalter' ? 'Psalms per Day' : 'Chapters per Day';
}

export function scriptureApproxDays(entry: ChallengeCatalogEntry | null, amount: number) {
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
    case 'personal': return 'My Rule';
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

export function prayerChallengeDetail(
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

export function buildPrayerChallengeConfig(
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
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, {
      damping: 18,
      stiffness: 235,
      mass: 0.72,
    });
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
  onTaskMutation,
  initialPrayerType,
  initialScriptureType,
  lockToPrimaryTask = false,
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

  const [taskTab, setTaskTab] = useState<TaskTab>(context === 'journal' ? 'routine' : 'spiritual');
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
  const sheetProgress = useSharedValue(0);
  const tabMotion = useSharedValue(0);
  const tabContentMotion = useSharedValue(1);
  const [mounted, setMounted] = useState(visible);
  const [segmentWidth, setSegmentWidth] = useState(0);
  const primaryTaskTab: TaskTab = context === 'journal' ? 'routine' : 'spiritual';
  const primaryTaskTabActive = taskTab === primaryTaskTab;
  const primaryTaskTabLabel = context === 'journal' ? 'ROUTINE' : 'SPIRITUAL';
  // Journal's primary side is a routine task, which the app strikes in slate
  // rather than gold — so that plaque is ink, not cream.
  const primaryFaceIsInk = context === 'journal';
  const showTaskSwitcher = !lockToPrimaryTask;

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
    setTaskTab(context === 'journal' ? 'routine' : 'spiritual');
    setSelectedCatalogId(null);
    setExpandedChallengeId(null);
    // Apply onboarding preselects exactly as a user tap would (see
    // selectPrayerType / selectScriptureType) — setters only, so this stays
    // inert while the sheet is open.
    if (initialPrayerType) {
      const meta = PRAYER_TYPES.find(item => item.key === initialPrayerType);
      setPrayerType(initialPrayerType);
      setPrayerTitle(meta?.defaultTitle ?? 'Prayer');
      setPrayerSchedule(defaultSchedule(meta?.defaultTime ?? '08:00'));
      setPrayerRule(
        initialPrayerType === 'meal' || initialPrayerType === 'morning' || initialPrayerType === 'evening'
          ? 'personal'
          : 'standard'
      );
      setJesusMode('duration');
      setJesusDuration('15');
      setJesusCount('100');
    }
    if (initialScriptureType) {
      const meta = SCRIPTURE_TYPES.find(item => item.key === initialScriptureType);
      setScriptureType(initialScriptureType);
      setScriptureTitle(meta?.defaultTitle ?? 'Scripture Reading');
      setScriptureSchedule(
        defaultSchedule(
          initialScriptureType === 'psalter' ? '06:45' : initialScriptureType === 'church_calendar' ? '06:30' : '08:00'
        )
      );
      setScriptureDailyAmount(1);
    }
  }, [context, initialPrayerType, initialScriptureType, visible]);

  useEffect(() => {
    tabMotion.value = withSpring(taskTab === 'challenge' ? 1 : 0, {
      damping: 18,
      stiffness: 235,
      mass: 0.72,
    });

    tabContentMotion.value = 0;
    tabContentMotion.value = withTiming(1, {
      duration: 230,
      easing: Easing.out(Easing.cubic),
    });
  }, [tabContentMotion, tabMotion, taskTab]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      sheetProgress.value = 0;
      requestAnimationFrame(() => {
        sheetProgress.value = withTiming(1, {
          duration: 280,
          easing: Easing.out(Easing.cubic),
        });
      });
      return;
    }

    sheetProgress.value = withTiming(0, {
      duration: 200,
      easing: Easing.in(Easing.cubic),
    }, finished => {
      if (finished) runOnJS(setMounted)(false);
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
    setPrayerRule(next === 'meal' || next === 'morning' || next === 'evening' ? 'personal' : 'standard');
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
    if (lockToPrimaryTask) return;
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
    if (lockToPrimaryTask && nextTab !== primaryTaskTab) return;
    if (taskTab === nextTab) return;
    animateSoftLayoutChange();
    setTaskTab(nextTab);
    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  };

  const handleSaveSpiritual = async () => {
    if (context === 'prayer') {
      if (!prayerType || !prayerTitle.trim()) return;
      const prayerDetail = prayerType === 'jesus'
        ? jesusPrayerSummary(jesusMode, jesusDuration, jesusCount)
        : prayerRuleSummary(prayerRule);
      await onTaskDraft?.({
        title: prayerTitle.trim(),
        subtitle: `${prayerDetail} - ${formatSummaryFrequency(prayerSchedule)}`,
        level: 1,
        source: 'spiritual',
        type: 'prayer',
        icon: prayerTaskIcon(prayerType),
        targetView: prayerType === 'jesus'
          ? '/jesus-prayer'
          : prayerRule === 'personal' && prayerType !== 'meal'
            ? '/personal-rule'
            : '/prayer',
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
      await onTaskDraft?.({
        title: technique.defaultTitle,
        subtitle: `${formatSummaryFrequency(journalTime)} - ${journalTime.time}`,
        level: 2,
        source: 'routine',
        type: 'journal',
        icon: journalTaskIcon(journalTechnique),
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
      const amountLabel = scriptureSessionAmountLabel(scriptureType, scriptureDailyAmount);
      await onTaskDraft?.({
        title: scriptureTitle.trim(),
        subtitle: `${amountLabel} - ${formatSummaryFrequency(scriptureSchedule)} - ${scriptureSchedule.time}`,
        level: 1,
        source: 'spiritual',
        type: 'reading',
        targetView: '/scripture',
        schedule: scheduleDraftToTaskSchedule(scriptureSchedule),
        notificationMode: scriptureSchedule.notificationMode,
        reminderMinutes: scriptureSchedule.notificationMode === 'double' ? scriptureSchedule.reminderMinutes : undefined,
        scriptureConfig: {
          readingType: scriptureType,
          chaptersPerDay: scriptureType === 'church_calendar' ? 0 : scriptureDailyAmount,
          totalUnitsRead: 0,
        },
      });
      onSummaryChange?.(`${scriptureTitle.trim()} · ${amountLabel} · ${formatSummaryFrequency(scriptureSchedule)} · ${scriptureSchedule.time}`);
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

  const handleStartChallenge = async () => {
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
    const record = await startChallenge(selectedCatalog.id, selectedPace, selectedCatalog.category === 'prayer' ? {
      time: challengeSchedule.time,
      paceLabel: paceParts.join(' · '),
      prayerConfig,
    } : { time: challengeSchedule.time });
    if (record) await onTaskDraft?.(challengeRecordToTaskDraft(record));
    const paceLabel = paceParts.length ? ` · ${paceParts.join(' · ')}` : '';
    onSummaryChange?.(`${selectedCatalog.title}${paceLabel} · ${challengeSchedule.time}`);
    setSelectedCatalogId(null);
  };

  const handleConfiguredChallengeStart = async () => {
    if (!selectedCatalog) return;
    playChallengeStartTransition(selectedCatalog);

    if (selectedCatalog.category === 'scripture') {
      const totalDays = scriptureApproxDays(selectedCatalog, challengeScriptureDailyAmount);
      const paceLabel = needsScriptureDailyAmount(selectedCatalog)
        ? scriptureDailyAmountLabel(selectedCatalog, challengeScriptureDailyAmount)
        : undefined;

      const record = await startChallenge(selectedCatalog.id, null, {
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

      if (record) await onTaskDraft?.(challengeRecordToTaskDraft(record));

      const summaryBits = [
        selectedCatalog.title,
        paceLabel ?? null,
        totalDays ? `${totalDays} days` : null,
        challengeSchedule.time,
      ].filter(Boolean);
      onSummaryChange?.(summaryBits.join(' · '));
    } else {
      const selectedPace = selectedCatalog.paceOptions?.find(item => item.id === selectedPaceId) ?? null;
      const record = await startChallenge(selectedCatalog.id, selectedPace, {
        time: challengeSchedule.time,
      });
      if (record) await onTaskDraft?.(challengeRecordToTaskDraft(record));
      const paceLabel = selectedPace?.label ? ` · ${selectedPace.label}` : '';
      onSummaryChange?.(`${selectedCatalog.title}${paceLabel} · ${challengeSchedule.time}`);
    }

    setSelectedCatalogId(null);
  };

  const sheetStartY = Math.max(430, windowHeight * 0.72);
  const scrimMotionStyle = useAnimatedStyle(() => ({
    opacity: sheetProgress.value,
  }));
  const sheetMotionStyle = useAnimatedStyle(() => ({
    opacity: sheetProgress.value,
    transform: [{ translateY: (1 - sheetProgress.value) * sheetStartY }],
  }));
  const segmentPillMotionStyle = useAnimatedStyle(() => ({
    transform: [{
      translateX: tabMotion.value * (((segmentWidth - 12) / 2) + 4),
    }],
  }));
  // The plaque's two faces, cross-fading on the same value as the slide.
  const segmentSpiritualFaceStyle = useAnimatedStyle(() => ({
    opacity: 1 - tabMotion.value,
  }));
  const segmentChallengeFaceStyle = useAnimatedStyle(() => ({
    opacity: tabMotion.value,
  }));
  const tabContentMotionStyle = useAnimatedStyle(() => ({
    opacity: tabContentMotion.value,
    transform: [{ translateY: (1 - tabContentMotion.value) * 10 }],
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.overlayScrim, scrimMotionStyle]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Reanimated.View
          style={[
            s.sheetShell,
            sheetMotionStyle,
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

          {showTaskSwitcher ? (
            <View
              style={s.segmentWrap}
              onLayout={event => setSegmentWidth(event.nativeEvent.layout.width)}
            >
              {/* The plaque does not just travel — it CHANGES INTO the thing
                  it is selecting. Sitting left it is a spiritual task: warm
                  cream under a soft gold hairline. Sliding right it becomes
                  an active challenge card: pale parchment between two thick
                  gold rails, exactly as the Challenges screen strikes its
                  live cards. The two faces cross-fade on the same value that
                  drives the slide, so one gesture carries both. */}
              {segmentWidth > 0 && (
                <Reanimated.View
                  pointerEvents="none"
                  style={[
                    s.segmentPill,
                    {
                      width: (segmentWidth - 12) / 2,
                      // Gold light under a gold plaque; slate under an ink one.
                      shadowColor: primaryFaceIsInk ? '#1F2937' : '#B6913D',
                    },
                    segmentPillMotionStyle,
                  ]}
                >
                  <Reanimated.View style={[StyleSheet.absoluteFill, segmentSpiritualFaceStyle]}>
                    {/* Journal's other side is a ROUTINE task, and a routine
                        task is not gold — the app gives it slate (#1F2937).
                        So there the plaque is struck in ink instead, and the
                        book stands on it the way the flame stands on cream. */}
                    <LinearGradient
                      colors={primaryFaceIsInk
                        ? ['#343A44', '#1F2937', '#141A22']
                        // Three stops on the diagonal, not two straight down.
                        // The challenge face is near-white on a cream track
                        // and so it lifts off it; this one was cream on cream,
                        // and no amount of ornament fixes a plate that has
                        // nothing to stand out FROM. It now starts white at
                        // the shoulder and reaches real gilt at the foot.
                        : ['#FFFFFF', '#FFF6E2', '#FBE9C4']}
                      locations={primaryFaceIsInk ? [0, 0.55, 1] : [0, 0.48, 1]}
                      start={{ x: 0, y: 0 }}
                      end={primaryFaceIsInk ? { x: 1, y: 1 } : { x: 0.85, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={primaryFaceIsInk ? s.segmentFaceInk : s.segmentFaceSpiritual} />
                    {primaryFaceIsInk
                      ? <View style={s.segmentInkSheen} />
                      : (
                        <>
                          {/* THE RULED FRAME — this face's answer to the two
                              heavy rails opposite.

                              A live challenge is struck between rails; that is
                              the Challenges screen's signature and it is why
                              that half looks made while this one looked
                              defaulted. A spiritual task's own register is not
                              the card, it is the PAGE: the manuscript double
                              rule that closes Scripture's doors and the
                              Orthodox plaque — a firm gilt rule with a finer
                              one inside it. Same weight of figure, opposite
                              axis, each taken from its own screen. */}
                          <View style={s.segmentFaceRule} />
                          <View style={s.segmentFaceRuleInner} />
                          {/* The hairline of light every lifted plate in this
                              app catches along its top edge; the ink face had
                              its sheen and the cream one had nothing. */}
                          <View style={s.segmentFaceLit} />
                        </>
                      )}
                  </Reanimated.View>

                  <Reanimated.View style={[StyleSheet.absoluteFill, segmentChallengeFaceStyle]}>
                    <LinearGradient
                      colors={['#FFFDF8', '#FFFFFF']}
                      start={{ x: 0.02, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={s.segmentFaceChallenge} />
                    <View style={[s.segmentRail, s.segmentRailLeft]} />
                    <View style={[s.segmentRail, s.segmentRailRight]} />
                  </Reanimated.View>
                </Reanimated.View>
              )}
              <TouchableOpacity
                onPress={() => switchTaskTab(primaryTaskTab)}
                activeOpacity={0.86}
                style={s.segmentBtn}
              >
                <SegmentEmblem
                  kind={context === 'journal' ? 'book' : 'flame'}
                  active={primaryTaskTabActive}
                  onInk={primaryFaceIsInk}
                />
                <Text
                  style={[
                    s.segmentText,
                    primaryTaskTabActive && (primaryFaceIsInk ? s.segmentTextOnInk : s.segmentTextActive),
                  ]}
                >{primaryTaskTabLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => switchTaskTab('challenge')}
                activeOpacity={0.86}
                style={s.segmentBtn}
              >
                <SegmentEmblem kind="trophy" active={taskTab === 'challenge'} />
                <Text style={[s.segmentText, taskTab === 'challenge' && s.segmentTextActive]}>CHALLENGE</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <ScrollView ref={contentScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
            <Reanimated.View style={tabContentMotionStyle}>
              {primaryTaskTabActive && (
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
                    <JournalRoutinePanel
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

              {showTaskSwitcher && taskTab === 'challenge' && (
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
                  onPauseChallenge={async id => {
                    await pauseChallenge(id);
                    await onTaskMutation?.();
                  }}
                  onResumeChallenge={async id => {
                    await resumeChallenge(id);
                    await onTaskMutation?.();
                  }}
                  onEndChallenge={async id => {
                    await endChallenge(id);
                    await onTaskMutation?.();
                  }}
                  onUpdateChallenge={async (id, updates) => {
                    await updateChallenge(id, updates);
                    await onTaskMutation?.();
                  }}
                />
              )}
            </Reanimated.View>
          </ScrollView>
        </Reanimated.View>
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
          <CardBlock label="Name Activity">
            <TextInput
              value={prayerTitle}
              onChangeText={onTitleChange}
              placeholder="e.g. Morning Prayer"
              placeholderTextColor="#D1D5DB"
              style={s.activityNameInput}
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
  const motionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [item.tint, item.accent]),
    borderColor: interpolateColor(progress.value, [0, 1], [item.border, item.accent]),
    shadowOpacity: 0.015 + progress.value * 0.145,
    transform: [{ scale: 1 + progress.value * 0.014 }],
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.prayerTypeTouch}>
      <Reanimated.View
        style={[
          s.prayerTypeBtn,
          motionStyle,
          {
            shadowColor: item.accent,
          },
        ]}
      >
        <item.Icon s={20} c={active ? '#FFFFFF' : item.accent} w={active ? 2.2 : 1.8} />
        <Text style={[s.prayerTypeText, { color: active ? '#FFFFFF' : item.accent }]}>{item.short}</Text>
      </Reanimated.View>
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
  const showOrthodoxBadge = isOrthodoxRuleChoice(item.key);
  const motionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', '#FFF9EE']),
    borderColor: interpolateColor(progress.value, [0, 1], ['#F0EDE6', '#D8B56E']),
    transform: [{ scale: 1 + progress.value * 0.008 }],
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <Reanimated.View style={[s.optionCard, motionStyle]}>
        <View style={[s.optionRadio, active && s.optionRadioActive]}>
          {active && <View style={s.optionRadioInner} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.optionTitle, active && s.optionTitleActive]}>{item.label}</Text>
          <Text style={s.optionBody}>{item.desc}</Text>
        </View>
        {(showOrthodoxBadge || active) && (
          <View style={s.optionTrailing}>
            {showOrthodoxBadge && (
              <View style={s.orthodoxRuleBadge}>
                <OrthodoxCross s={11} c={C.gold} w={1.35} />
                <Text style={s.orthodoxRuleBadgeText}>ORTH.</Text>
              </View>
            )}
            {active && <CheckSmall s={16} c={C.gold} />}
          </View>
        )}
      </Reanimated.View>
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
    : [33, 50, 100, 200, 300];
  const selected = Number.parseInt(mode === 'duration' ? duration : count, 10);
  const modeMotion = useSharedValue(mode === 'count' ? 1 : 0);
  const [modeWidth, setModeWidth] = useState(0);
  const [customFocused, setCustomFocused] = useState(false);
  const customValue = mode === 'duration' ? duration : count;
  const customActive = customFocused || (Number.isFinite(selected) && !options.includes(selected));
  const customUnit = mode === 'duration' ? 'min' : 'reps';

  useEffect(() => {
    modeMotion.value = withSpring(mode === 'count' ? 1 : 0, {
      damping: 18,
      stiffness: 235,
      mass: 0.72,
    });
  }, [mode, modeMotion]);
  const modePillMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: modeMotion.value * ((modeWidth - 8) / 2) }],
  }));

  return (
    <View style={s.jesusConfigStack}>
      <View
        style={s.jesusModeWrap}
        onLayout={event => setModeWidth(event.nativeEvent.layout.width)}
      >
        {modeWidth > 0 && (
          <Reanimated.View
            pointerEvents="none"
            style={[
              s.jesusModePill,
              {
                width: (modeWidth - 8) / 2,
              },
              modePillMotionStyle,
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

      <View style={[s.jesusCustomBox, customActive && s.jesusCustomBoxActive]}>
        <View style={s.jesusCustomHeader}>
          <Text style={[s.jesusCustomLabel, customActive && s.jesusCustomLabelActive]}>
            Custom {mode === 'duration' ? 'time' : 'count'}
          </Text>
        </View>
        <View style={[s.jesusCustomInputWrap, customFocused && s.jesusCustomInputWrapFocused]}>
          <TextInput
            value={customValue}
            onChangeText={text => {
              const clean = text.replace(/[^\d]/g, '');
              if (mode === 'duration') {
                onDurationChange(clean);
              } else {
                onCountChange(clean);
              }
            }}
            onFocus={() => setCustomFocused(true)}
            onBlur={() => setCustomFocused(false)}
            keyboardType="number-pad"
            placeholder={mode === 'duration' ? '15' : '100'}
            placeholderTextColor="#D1D5DB"
            style={s.jesusCustomInput}
          />
          <View style={s.jesusCustomDivider} />
          <Text style={s.jesusCustomSuffix}>{customUnit}</Text>
        </View>
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
  const motionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', '#FFF7E8']),
    borderColor: interpolateColor(progress.value, [0, 1], ['#EEE8DE', '#D7AA54']),
    shadowOpacity: 0.02 + progress.value * 0.13,
    transform: [{ scale: 1 + progress.value * 0.04 }],
  }));
  const textMotionStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], ['#717782', '#B6822D']),
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.jesusValueTouch}>
      <Reanimated.View
        style={[
          s.jesusValueChip,
          motionStyle,
        ]}
      >
        <Reanimated.Text style={[s.jesusValueText, textMotionStyle]}>{label}</Reanimated.Text>
      </Reanimated.View>
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

function JournalRoutinePanel({
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
      <CardBlock label="Technique" accent={ROUTINE_TASK_ACCENT}>
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

      <ScheduleEditor value={schedule} onChange={onScheduleChange} showFrequency accent={ROUTINE_TASK_ACCENT} />

      <PrimaryButton label="Save Routine Task" onPress={onSave} accent={ROUTINE_TASK_ACCENT} />
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
  const motionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', item.color]),
    borderColor: interpolateColor(progress.value, [0, 1], ['#F0EDE6', item.color]),
    shadowOpacity: 0.015 + progress.value * 0.165,
    transform: [{ scale: 1 + progress.value * 0.012 }],
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.techniqueTouch}>
      <Reanimated.View
        style={[
          s.techniqueBtn,
          motionStyle,
          {
            shadowColor: item.color,
          },
        ]}
      >
        <item.Icon s={20} c={active ? '#FFFFFF' : item.color} />
        <Text style={[s.techniqueBtnText, active && s.techniqueBtnTextActive]}>{item.label}</Text>
      </Reanimated.View>
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
          <CardBlock label="Name Activity">
            <TextInput
              value={scriptureTitle}
              onChangeText={onTitleChange}
              placeholder="e.g. Daily Bible Reading"
              placeholderTextColor="#D1D5DB"
              style={s.activityNameInput}
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

export function ChallengePanel({
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
  churchSchedule,
  expandedChallengeId,
  recentlyStartedTemplateId,
  externalSaveRequestId = 0,
  showActiveLabel = true,
  showPausedLabel = true,
  onOpenSetup,
  onSelectedPaceIdChange,
  onChallengeScheduleChange,
  onScriptureDailyAmountChange,
  onChallengePrayerRuleChange,
  onChallengeJesusModeChange,
  onChallengeJesusDurationChange,
  onChallengeJesusCountChange,
  onChurchScheduleChange,
  onStartChallenge,
  onChallengePress,
  onExpandedChallengeChange,
  onPauseChallenge,
  onResumeChallenge,
  onEndChallenge,
  onUpdateChallenge,
  guideBindings,
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
  churchSchedule?: ChallengeChurchScheduleDraft;
  expandedChallengeId: string | null;
  recentlyStartedTemplateId: string | null;
  externalSaveRequestId?: number;
  showActiveLabel?: boolean;
  showPausedLabel?: boolean;
  onOpenSetup: (entry: ChallengeCatalogEntry) => void;
  onSelectedPaceIdChange: (id: string | null) => void;
  onChallengeScheduleChange: (value: ChallengeScheduleDraft) => void;
  onScriptureDailyAmountChange: (value: number) => void;
  onChallengePrayerRuleChange: (value: PrayerChallengeRuleChoice) => void;
  onChallengeJesusModeChange: (value: JesusPrayerMode) => void;
  onChallengeJesusDurationChange: (value: string) => void;
  onChallengeJesusCountChange: (value: string) => void;
  onChurchScheduleChange?: (value: ChallengeChurchScheduleDraft) => void;
  onStartChallenge: () => void | Promise<void>;
  onChallengePress?: (item: ChallengeRecord) => void;
  onExpandedChallengeChange: (id: string | null) => void;
  onPauseChallenge: (id: string) => void | Promise<void>;
  onResumeChallenge: (id: string) => void | Promise<void>;
  onEndChallenge: (id: string) => void | Promise<void>;
  onUpdateChallenge: (id: string, updates: { time?: string; scheduleLabel?: string; paceLabel?: string; prayerConfig?: ChallengePrayerConfig; scriptureConfig?: ChallengeScriptureConfig; churchConfig?: ChallengeChurchConfig }) => void | Promise<void>;
  guideBindings?: ChallengeGuideBindings;
}) {
  const [confirmAction, setConfirmAction] = useState<ChallengeConfirmAction | null>(null);
  const handledExternalSaveRef = useRef(0);

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
    if (item.category === 'church') {
      const savedFrequency = item.churchConfig?.frequency === 'monthly'
        ? 'specific_days'
        : item.churchConfig?.frequency ?? 'specific_days';
      onChurchScheduleChange?.({
        ...defaultChurchChallengeSchedule(item.time ?? '09:00'),
        frequency: savedFrequency,
        selectedDays: savedFrequency === 'specific_days' && item.churchConfig?.selectedDays?.length
          ? item.churchConfig.selectedDays
          : CHURCH_DEFAULT_DAYS,
        monthlyDays: item.churchConfig?.monthlyDays?.length ? item.churchConfig.monthlyDays : [1],
        time: item.churchConfig?.time ?? item.time ?? '09:00',
        sameTimeEveryDay: item.churchConfig?.sameTimeEveryDay ?? true,
        dayTimes: item.churchConfig?.dayTimes ?? {},
        notificationMode: item.churchConfig?.notificationMode ?? 'single',
        reminderMinutes: item.churchConfig?.reminderMinutes ?? 15,
      });
      return;
    }

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

    if (item.category === 'scripture' && item.scriptureConfig) {
      onScriptureDailyAmountChange(Math.max(1, item.scriptureConfig.chaptersPerDay || 1));
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
    if (onChallengePress) {
      onChallengePress(item);
      return;
    }
    animateSoftLayoutChange();
    if (expanded) {
      onExpandedChallengeChange(null);
      return;
    }
    seedActiveChallengeEditor(item);
    onExpandedChallengeChange(item.id);
  };

  const saveChallengeEdits = useCallback((item: ChallengeRecord) => {
    if (item.category === 'church' && churchSchedule) {
      return Promise.resolve(onUpdateChallenge(item.id, {
        time: churchSchedule.time,
        scheduleLabel: churchScheduleLabel(churchSchedule),
        churchConfig: churchScheduleToConfig(churchSchedule),
      })).finally(() => onExpandedChallengeChange(null));
    }

    if (item.category === 'scripture' && item.scriptureConfig) {
      const chaptersPerDay = Math.max(1, Math.round(scriptureDailyAmount || item.scriptureConfig.chaptersPerDay || 1));
      const pacePrefix = cleanMetaSeparators(item.paceLabel).split(META_SEPARATOR)[0];
      const paceLabel = [pacePrefix, `${chaptersPerDay} ${item.groupKey === 'psalter' ? (chaptersPerDay === 1 ? 'psalm/day' : 'psalms/day') : (chaptersPerDay === 1 ? 'chapter/day' : 'chapters/day')}`]
        .filter(Boolean)
        .join(META_SEPARATOR);
      return Promise.resolve(onUpdateChallenge(item.id, {
        time: challengeSchedule.time,
        scheduleLabel: item.scheduleLabel,
        paceLabel,
        scriptureConfig: {
          ...item.scriptureConfig,
          chaptersPerDay,
          time: challengeSchedule.time,
          sameTimeEveryDay: challengeSchedule.sameTimeEveryDay,
          dayTimes: challengeSchedule.sameTimeEveryDay ? {} : challengeSchedule.dayTimes,
          notificationMode: challengeSchedule.notificationMode,
          reminderMinutes: challengeSchedule.notificationMode === 'double' ? challengeSchedule.reminderMinutes : undefined,
        },
      })).finally(() => onExpandedChallengeChange(null));
    }

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

    return Promise.resolve(onUpdateChallenge(item.id, {
      time: challengeSchedule.time,
      paceLabel,
      scheduleLabel: item.scheduleLabel,
      prayerConfig,
    })).finally(() => onExpandedChallengeChange(null));
  }, [
    challengeJesusCount,
    challengeJesusDuration,
    challengeJesusMode,
    challengePrayerRule,
    challengeSchedule,
    scriptureDailyAmount,
    churchSchedule,
    onExpandedChallengeChange,
    onUpdateChallenge,
  ]);

  useEffect(() => {
    if (!externalSaveRequestId || handledExternalSaveRef.current === externalSaveRequestId) return;
    handledExternalSaveRef.current = externalSaveRequestId;
    const item = [...activeItems, ...pausedItems].find(entry => entry.id === expandedChallengeId)
      ?? activeItems[0]
      ?? pausedItems[0];
    if (!item) return;
    void saveChallengeEdits(item);
  }, [externalSaveRequestId, activeItems, pausedItems, expandedChallengeId, saveChallengeEdits]);

  return (
    <View style={s.stack}>
      {activeItems.length > 0 && (
        <View style={s.stack}>
          {showActiveLabel && <SectionLabel text="Active" accent="#10B981" />}
          <View style={s.challengeCardList}>
          {activeItems.map(item => {
            const expanded = expandedChallengeId === item.id;
            const recentlyStarted = item.templateId === recentlyStartedTemplateId;
            const tone = challengePanelTone(item.category);
            const tag = challengeTag(item.category);
            const progressPct = item.showBar && item.progressTotal
              ? Math.min(100, Math.round((item.progressCurrent / item.progressTotal) * 100))
              : null;
            return (
              <View
                key={item.id}
                style={[
                  s.challengeCardShell,
                  { borderColor: tone.border },
                  recentlyStarted && s.challengeCardShellStarted,
                ]}
              >
                <TouchableOpacity
                  onPress={() => toggleActiveChallenge(item, expanded)}
                  activeOpacity={0.84}
                  style={s.challengeCard}
                >
                  <LinearGradient
                    pointerEvents="none"
                    colors={['#FFF8E9', '#FFFDF7', '#FFFFFF']}
                    start={{ x: 0.04, y: 0 }}
                    end={{ x: 0.94, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View pointerEvents="none" style={s.challengeCardGlow} />
                  <View pointerEvents="none" style={s.challengeTrophyWatermark}>
                    <StaticChallengeTrophy size={64} />
                  </View>
                  <View pointerEvents="none" style={s.challengeWhisperFrame} />
                  <View pointerEvents="none" style={s.challengeTopHighlight} />
                  {/* The head. The title starts the card, where the eye
                      starts — it used to sit third, under a badge row that was
                      mostly empty air, with the card's whole upper band spent
                      on two small pills. The rule of the challenge is read
                      directly beneath it, and the right column carries the two
                      things that are not content: the tag that files the card
                      and the handle that opens it. */}
                  <View style={s.challengeHead}>
                    <View style={s.challengeHeadCopy}>
                      <Text style={s.challengeTitle} numberOfLines={2}>{item.title}</Text>
                      {/* The time and the pace, read as a line. They were
                          boxed in a bordered capsule — a box inside a framed
                          card, for two words. */}
                      <Text style={s.challengeMetaLine} numberOfLines={1}>
                        {item.time || '--:--'}
                        <Text style={s.challengeMetaSep}>{'   ·   '}</Text>
                        {item.paceLabel || item.scheduleLabel}
                      </Text>
                    </View>

                    <View style={s.challengeHeadAside}>
                      <View style={[s.challengeTag, { backgroundColor: tag.bg }]}>
                        <Text style={[s.challengeTagText, { color: tag.text }]}>{tag.label}</Text>
                      </View>
                      <SpinChevron expanded={expanded} shellStyle={s.challengeChevron} />
                    </View>
                  </View>

                  {/* The foot: the card's two figures on one line — how long
                      the streak has run, and how far the challenge has got —
                      over the bar that measures the second of them. */}
                  <View style={s.challengeFoot}>
                    <ChallengeRule />
                    <View style={s.challengeFootRow}>
                      <View style={s.challengeFootLead}>
                        <ChallengeStreakPill count={item.streak} />
                        {!!item.headline && (
                          <Text style={[s.challengeFootLabel, { color: tone.meta }]} numberOfLines={1}>
                            {item.headline}
                          </Text>
                        )}
                      </View>
                      <Text style={s.challengeFootValue} numberOfLines={1}>
                        {challengeFigure(item)}
                      </Text>
                    </View>
                    {progressPct !== null && (
                      <View style={s.challengeProgressTrack}>
                        <LinearGradient
                          colors={['#E7C77F', C.gold, '#A97925']}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          style={[s.challengeProgressFill, { width: `${progressPct}%` }]}
                        >
                          <View style={s.challengeProgressShine} />
                        </LinearGradient>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {expanded && (
                  <Reanimated.View entering={FadeIn.duration(240)} style={s.challengeEditor}>
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

                    {item.category === 'scripture' && item.scriptureConfig && item.scriptureConfig.chaptersPerDay > 0 && (
                      <View style={s.scriptureSetupBlock}>
                        <Text style={s.scriptureSetupLabel}>{item.groupKey === 'psalter' ? 'Psalms per Day' : 'Chapters per Day'}</Text>
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
                      </View>
                    )}

                    {item.category === 'church' && churchSchedule && onChurchScheduleChange ? (
                      <ScheduleEditor value={churchSchedule} onChange={onChurchScheduleChange} showFrequency allowMonthly={false} />
                    ) : (
                      <>
                        <ChallengeTimeEditor value={challengeSchedule} onChange={onChallengeScheduleChange} />

                        <NotificationSettings
                          mode={challengeSchedule.notificationMode}
                          reminderMinutes={challengeSchedule.reminderMinutes}
                          onModeChange={mode => onChallengeScheduleChange({ ...challengeSchedule, notificationMode: mode })}
                          onReminderChange={reminderMinutes => onChallengeScheduleChange({ ...challengeSchedule, reminderMinutes })}
                        />
                      </>
                    )}

                    {!!item.paceLabel && (
                      <Text style={s.smallHint}>Current pace: {item.paceLabel}</Text>
                    )}

                    <View style={s.challengeActionRow}>
                      <TouchableOpacity
                        onPress={() => {
                          if (item.category === 'church' || item.category === 'scripture') {
                            void saveChallengeEdits(item);
                            return;
                          }
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
                          void Promise.resolve(onUpdateChallenge(item.id, {
                            time: challengeSchedule.time,
                            paceLabel,
                            scheduleLabel: item.scheduleLabel,
                            prayerConfig,
                          }))
                            .finally(() => onExpandedChallengeChange(null));
                        }}
                        activeOpacity={0.84}
                        style={s.secondaryBtn}
                      >
                        <Text style={s.secondaryBtnText}>Save</Text>
                      </TouchableOpacity>

                      {item.status === 'paused' ? (
                        <TouchableOpacity
                          onPress={() => setConfirmAction({ mode: 'resume', item })}
                          activeOpacity={0.84}
                          style={s.resumeBtn}
                        >
                          <Text style={s.resumeBtnText}>Resume</Text>
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
                  </Reanimated.View>
                )}
                <View pointerEvents="none" style={[s.challengeRail, s.challengeRailLeft]} />
                <View pointerEvents="none" style={[s.challengeRail, s.challengeRailRight]} />
              </View>
            );
          })}
          </View>
        </View>
      )}

      {pausedItems.length > 0 && (
        <View style={s.stack}>
          {showPausedLabel && <SectionLabel text="Paused" accent="#A8A29E" />}
          <View style={s.challengeCardList}>
          {pausedItems.map(item => {
            const expanded = expandedChallengeId === item.id;
            const tag = challengeTag(item.category);
            const progressPct = item.showBar && item.progressTotal
              ? Math.min(100, Math.round((item.progressCurrent / item.progressTotal) * 100))
              : null;
            return (
            <View
              key={item.id}
              style={[
                s.challengeCardShell,
                s.challengeCardShellPaused,
              ]}
            >
              <TouchableOpacity
                onPress={() => {
                  toggleActiveChallenge(item, expanded);
                }}
                activeOpacity={0.84}
                style={[s.challengeCard, s.challengeCardPaused]}
              >
                <LinearGradient
                  pointerEvents="none"
                  colors={['#FAF6ED', '#FCFAF6', '#FFFFFF']}
                  start={{ x: 0.05, y: 0 }}
                  end={{ x: 0.95, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View pointerEvents="none" style={[s.challengeCardGlow, s.challengeCardGlowPaused]} />
                {/* A paused card had no trophy at all, so it read as a
                    different card rather than as the same card resting. The
                    prize is still ghosted into the face, only fainter. */}
                <View pointerEvents="none" style={[s.challengeTrophyWatermark, s.challengeTrophyWatermarkPaused]}>
                  <StaticChallengeTrophy size={64} />
                </View>
                <View pointerEvents="none" style={[s.challengeWhisperFrame, s.challengeWhisperFramePaused]} />
                <View pointerEvents="none" style={s.challengeTopHighlight} />
                {/* The live card's skeleton, resting. Same head, same foot —
                    only the state pill takes the streak's seat, because a
                    paused challenge's streak is not running. */}
                <View style={s.challengeHead}>
                  <View style={s.challengeHeadCopy}>
                    <Text style={[s.challengeTitle, s.challengeTitlePaused]} numberOfLines={2}>{item.title}</Text>
                    <Text style={[s.challengeMetaLine, s.challengeMetaLinePaused]} numberOfLines={1}>
                      {item.time || '--:--'}
                      <Text style={s.challengeMetaSep}>{'   ·   '}</Text>
                      {item.paceLabel || item.scheduleLabel}
                    </Text>
                  </View>

                  <View style={s.challengeHeadAside}>
                    <View style={[s.challengeTag, s.challengeTagPaused, { backgroundColor: tag.bg }]}>
                      <Text style={[s.challengeTagText, { color: tag.text }]}>{tag.label}</Text>
                    </View>
                    <SpinChevron expanded={expanded} tint="#BEB6A8" shellStyle={[s.challengeChevron, s.challengeChevronPaused]} />
                  </View>
                </View>

                <View style={s.challengeFoot}>
                  <ChallengeRule />
                  <View style={s.challengeFootRow}>
                    <View style={s.challengeFootLead}>
                      <View style={s.challengePausedPill}>
                        <Pause s={10} c="#8A7F6C" />
                        <Text style={s.challengePausedText}>PAUSED</Text>
                      </View>
                      <Text style={[s.challengeFootLabel, s.challengeFootLabelPaused]} numberOfLines={1}>
                        Saved progress
                      </Text>
                    </View>
                    <Text style={[s.challengeFootValue, s.challengeFootValuePaused]} numberOfLines={1}>
                      {challengeFigure(item)}
                    </Text>
                  </View>
                  {progressPct !== null && (
                    <View style={[s.challengeProgressTrack, s.challengeProgressTrackPaused]}>
                      <View
                        style={[
                          s.challengeProgressFill,
                          s.challengeProgressFillPaused,
                          { width: `${progressPct}%` },
                        ]}
                      />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              {expanded && (
                <Reanimated.View entering={FadeIn.duration(240)} style={s.challengeEditor}>
                  <View style={s.pausedNotice}>
                    <Text style={s.pausedNoticeLabel}>Paused</Text>
                    <Text style={s.pausedNoticeBody}>
                      This challenge is saved. Resume it when you are ready to continue.
                    </Text>
                  </View>

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

                  {item.category === 'scripture' && item.scriptureConfig && item.scriptureConfig.chaptersPerDay > 0 && (
                    <View style={s.scriptureSetupBlock}>
                      <Text style={s.scriptureSetupLabel}>{item.groupKey === 'psalter' ? 'Psalms per Day' : 'Chapters per Day'}</Text>
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
                    </View>
                  )}

                  {item.category === 'church' && churchSchedule && onChurchScheduleChange ? (
                    <ScheduleEditor value={churchSchedule} onChange={onChurchScheduleChange} showFrequency allowMonthly={false} />
                  ) : (
                    <>
                      <ChallengeTimeEditor value={challengeSchedule} onChange={onChallengeScheduleChange} />

                      <NotificationSettings
                        mode={challengeSchedule.notificationMode}
                        reminderMinutes={challengeSchedule.reminderMinutes}
                        onModeChange={mode => onChallengeScheduleChange({ ...challengeSchedule, notificationMode: mode })}
                        onReminderChange={reminderMinutes => onChallengeScheduleChange({ ...challengeSchedule, reminderMinutes })}
                      />
                    </>
                  )}

                  {!!item.paceLabel && (
                    <Text style={s.smallHint}>Saved pace: {item.paceLabel}</Text>
                  )}

                  <View style={s.challengeActionRow}>
                    <TouchableOpacity
                      onPress={() => {
                        void saveChallengeEdits(item);
                      }}
                      activeOpacity={0.84}
                      style={s.secondaryBtn}
                    >
                      <Text style={s.secondaryBtnText}>Save</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setConfirmAction({ mode: 'resume', item })}
                      activeOpacity={0.84}
                      style={s.resumeBtn}
                    >
                      <Text style={s.resumeBtnText}>Resume</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setConfirmAction({ mode: 'end', item })}
                      activeOpacity={0.84}
                      style={s.dangerBtn}
                    >
                      <Text style={s.dangerBtnText}>End</Text>
                    </TouchableOpacity>
                  </View>
                </Reanimated.View>
              )}
              <View pointerEvents="none" style={[s.challengeRail, s.challengeRailLeft, s.challengeRailPaused]} />
              <View pointerEvents="none" style={[s.challengeRail, s.challengeRailRight, s.challengeRailPaused]} />
            </View>
            );
          })}
          </View>
        </View>
      )}

      {availableItems.length > 0 && (
        <View style={s.challengeCatalogStack}>
          {context !== 'scripture' && <SectionLabel text="Start New" accent="#C5A059" />}

          {context === 'scripture' && groupedAvailable
            ? Object.entries(groupedAvailable).map(([group, entries]) => (
                <View key={group} style={s.scriptureChallengeGroup}>
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
                      guideEntryBinding={guideBindings?.catalogEntryId === entry.id ? guideBindings.catalogEntry : undefined}
                      guideStartBinding={guideBindings?.catalogEntryId === entry.id ? guideBindings.start : undefined}
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
                  churchSchedule={churchSchedule}
                  onToggle={() => onOpenSetup(entry)}
                  onSelectedPaceIdChange={onSelectedPaceIdChange}
                  onChallengeScheduleChange={onChallengeScheduleChange}
                  onChallengePrayerRuleChange={onChallengePrayerRuleChange}
                  onChallengeJesusModeChange={onChallengeJesusModeChange}
                  onChallengeJesusDurationChange={onChallengeJesusDurationChange}
                  onChallengeJesusCountChange={onChallengeJesusCountChange}
                  onChurchScheduleChange={onChurchScheduleChange}
                  onStart={onStartChallenge}
                  guideEntryBinding={guideBindings?.catalogEntryId === entry.id ? guideBindings.catalogEntry : undefined}
                  guideStartBinding={guideBindings?.catalogEntryId === entry.id ? guideBindings.start : undefined}
                />
              ))}
        </View>
      )}

      <ChallengeActionConfirmModal
        action={confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={action => {
          void (async () => {
            if (action.mode === 'pause') {
              await onPauseChallenge(action.item.id);
            } else if (action.mode === 'resume') {
              await saveChallengeEdits(action.item);
              await onResumeChallenge(action.item.id);
            } else {
              await onEndChallenge(action.item.id);
            }
            onExpandedChallengeChange(null);
            setConfirmAction(null);
          })();
        }}
      />
    </View>
  );
}

// The one chevron all challenge cards share — turns with a soft settle
// instead of snapping, so open/close reads as one continuous motion with the
// LayoutAnimation height change beneath it.
function SpinChevron({
  expanded,
  tint = '#C9B18A',
  shellStyle,
}: {
  expanded: boolean;
  tint?: string;
  shellStyle: StyleProp<ViewStyle>;
}) {
  const t = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    t.value = withTiming(expanded ? 1 : 0, { duration: 260, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [expanded, t]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${t.value * 180}deg` }],
  }));

  return (
    <Reanimated.View style={[shellStyle, spinStyle]}>
      <ChevronDown s={14} c={tint} />
    </Reanimated.View>
  );
}

/**
 * The face of a challenge that has not been started yet.
 *
 * Two things a first pass got wrong. It gave this card the live card's foot —
 * a pill, a schedule and a figure over a rule — which made a shelf of things
 * you have never touched read as a shelf of paused ones, and which stated a
 * schedule and a size you are about to choose for yourself two taps later.
 * And it set that foot in the tracked sans, the app's voice for labels on a
 * card whose whole job is to be read.
 *
 * So: no foot. An unstarted challenge is a name and what it is, set entirely
 * in the serif, with the tag and the handle in the same column at the same
 * edge as everywhere else. The rule and the figures below it are what a
 * challenge earns by being started — they are the mark of a card with a
 * history, and this card has none yet. What it shares with its live siblings
 * is the shell, the rails, the frame, the tag and the head; what it does not
 * share is the part that reports.
 */
function ChallengeStartFace({
  entry,
  expanded,
  title,
}: {
  entry: ChallengeCatalogEntry;
  expanded: boolean;
  title?: string;
}) {
  const tag = challengeTag(entry.category);
  return (
    <View style={s.challengeHead}>
      <View style={s.challengeHeadCopy}>
        <Text style={s.challengeTitle} numberOfLines={2}>{title ?? entry.title}</Text>
        <Text style={s.challengeStartBody} numberOfLines={expanded ? 4 : 2}>{entry.description}</Text>
      </View>

      <View style={s.challengeHeadAside}>
        <View style={[s.challengeTag, { backgroundColor: tag.bg }]}>
          <Text style={[s.challengeTagText, { color: tag.text }]}>{tag.label}</Text>
        </View>
        <SpinChevron expanded={expanded} shellStyle={s.challengeChevron} />
      </View>
    </View>
  );
}

function ChallengeStreakPill({ count }: { count: number }) {
  return (
    <View style={s.challengeFlame}>
      <Text style={s.challengeFlameText}>{count}</Text>
      <View style={s.challengeFlameIcon}>
        <Image source={STREAK_FLAME_PNG} style={s.challengeFlameImage} resizeMode="contain" />
      </View>
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
  const resume = action?.mode === 'resume';
  const title = danger ? 'End Challenge?' : resume ? 'Resume Challenge?' : 'Pause Challenge?';
  const itemTitle = action?.item.title ?? 'this challenge';
  const body = danger
    ? `"${itemTitle}" will be removed and its progress will be deleted. Pause it instead if you want to save it for later.`
    : resume
      ? `"${itemTitle}" will return to your active challenge flow.`
      : `"${itemTitle}" will move to Paused and stop showing as active until you resume it.`;

  return (
    <Modal transparent visible={!!action} animationType="fade" onRequestClose={onCancel}>
      <View style={s.challengeConfirmOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={s.challengeConfirmCard}>
          <View style={[s.challengeConfirmIcon, danger && s.challengeConfirmIconDanger, resume && s.challengeConfirmIconResume]}>
            {danger
              ? <Trash2 s={19} c={C.red} />
              : resume
                ? <RotateCcw s={18} c="#16A34A" />
                : <Pause s={18} c={C.gold} />}
          </View>
          <Text style={s.challengeConfirmTitle}>{title}</Text>
          <Text style={s.challengeConfirmBody}>{body}</Text>
          <View style={s.challengeConfirmRow}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.84} style={s.challengeConfirmCancel}>
              <Text style={s.challengeConfirmCancelText}>{danger ? 'CANCEL' : resume ? 'KEEP PAUSED' : 'KEEP ACTIVE'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => action && onConfirm(action)}
              activeOpacity={0.84}
              style={[s.challengeConfirmPrimary, danger && s.challengeConfirmDanger, resume && s.challengeConfirmResume]}
            >
              <Text style={s.challengeConfirmPrimaryText}>{danger ? 'END' : resume ? 'RESUME' : 'PAUSE'}</Text>
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
  guideEntryBinding,
  guideStartBinding,
}: {
  entry: ChallengeCatalogEntry;
  expanded: boolean;
  scriptureDailyAmount: number;
  challengeSchedule: ChallengeScheduleDraft;
  onToggle: () => void;
  onScriptureDailyAmountChange: (value: number) => void;
  onChallengeScheduleChange: (value: ChallengeScheduleDraft) => void;
  onStart: () => void | Promise<void>;
  guideEntryBinding?: GuideTargetBinding;
  guideStartBinding?: GuideTargetBinding;
}) {
  const displayTitle = entry.id === 'lectionary_daily' ? `${entry.title} — 365 Days` : entry.title;

  return (
    <View style={[s.challengeCardShell, expanded && s.challengeCardShellStarted]}>
      <TouchableOpacity {...guideEntryBinding} onPress={onToggle} activeOpacity={0.84} style={s.challengeCard}>
        <LinearGradient
          pointerEvents="none"
          colors={['#FFF8EA', '#FFFDF7', '#FFFFFF']}
          start={{ x: 0.04, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={s.challengeCardGlow} />
        <View pointerEvents="none" style={s.challengeTrophyWatermarkStart}>
          <StaticChallengeTrophy size={104} />
        </View>
        <View pointerEvents="none" style={s.challengeWhisperFrame} />
        <View pointerEvents="none" style={s.challengeTopHighlight} />
        <ChallengeStartFace entry={entry} expanded={expanded} title={displayTitle} />
      </TouchableOpacity>

      {expanded && (
        <Reanimated.View entering={FadeIn.duration(240)} style={s.scriptureSetupInline}>
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

          <PrimaryButton label="Start Challenge" onPress={onStart} targetBinding={guideStartBinding} />
        </Reanimated.View>
      )}
      {/* The same 5pt rails as every other card in the stack — this one used
          to run 4pt, which read as a slightly narrower card rather than as a
          deliberate difference. */}
      <View pointerEvents="none" style={[s.challengeRail, s.challengeRailLeft, !expanded && s.challengeRailStart]} />
      <View pointerEvents="none" style={[s.challengeRail, s.challengeRailRight, !expanded && s.challengeRailStart]} />
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
  churchSchedule,
  onToggle,
  onSelectedPaceIdChange,
  onChallengeScheduleChange,
  onChallengePrayerRuleChange,
  onChallengeJesusModeChange,
  onChallengeJesusDurationChange,
  onChallengeJesusCountChange,
  onChurchScheduleChange,
  onStart,
  guideEntryBinding,
  guideStartBinding,
}: {
  entry: ChallengeCatalogEntry;
  expanded: boolean;
  selectedPaceId: string | null;
  challengeSchedule: ChallengeScheduleDraft;
  challengePrayerRule: PrayerChallengeRuleChoice;
  challengeJesusMode: JesusPrayerMode;
  challengeJesusDuration: string;
  challengeJesusCount: string;
  churchSchedule?: ChallengeChurchScheduleDraft;
  onToggle: () => void;
  onSelectedPaceIdChange: (id: string | null) => void;
  onChallengeScheduleChange: (value: ChallengeScheduleDraft) => void;
  onChallengePrayerRuleChange: (value: PrayerChallengeRuleChoice) => void;
  onChallengeJesusModeChange: (value: JesusPrayerMode) => void;
  onChallengeJesusDurationChange: (value: string) => void;
  onChallengeJesusCountChange: (value: string) => void;
  onChurchScheduleChange?: (value: ChallengeChurchScheduleDraft) => void;
  onStart: () => void | Promise<void>;
  guideEntryBinding?: GuideTargetBinding;
  guideStartBinding?: GuideTargetBinding;
}) {
  const tone = challengePanelTone(entry.category);
  return (
    <View style={[s.challengeCardShell, { borderColor: tone.border }, expanded && s.challengeCardShellStarted]}>
      <TouchableOpacity {...guideEntryBinding} onPress={onToggle} activeOpacity={0.84} style={s.challengeCard}>
        <LinearGradient
          pointerEvents="none"
          colors={['#FFF8EA', '#FFFDF7', '#FFFFFF']}
          start={{ x: 0.04, y: 0 }}
          end={{ x: 0.94, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={s.challengeCardGlow} />
        {/* The prize is on the face here too, at a whisper — what the card is
            for, before there is anything to show for it. */}
        <View pointerEvents="none" style={s.challengeTrophyWatermarkStart}>
          <StaticChallengeTrophy size={104} />
        </View>
        <View pointerEvents="none" style={s.challengeWhisperFrame} />
        <View pointerEvents="none" style={s.challengeTopHighlight} />
        <ChallengeStartFace entry={entry} expanded={expanded} />
      </TouchableOpacity>

      {expanded && (
        <Reanimated.View entering={FadeIn.duration(240)} style={s.catalogSetupInline}>
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

          {entry.category === 'church' && churchSchedule && onChurchScheduleChange ? (
            <ScheduleEditor value={churchSchedule} onChange={onChurchScheduleChange} showFrequency allowMonthly={false} />
          ) : (
            <>
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
            </>
          )}

          <PrimaryButton label="Start Challenge" onPress={onStart} targetBinding={guideStartBinding} />
        </Reanimated.View>
      )}
      <View pointerEvents="none" style={[s.challengeRail, s.challengeRailLeft, !expanded && s.challengeRailStart]} />
      <View pointerEvents="none" style={[s.challengeRail, s.challengeRailRight, !expanded && s.challengeRailStart]} />
    </View>
  );
}

function ScheduleEditor({
  value,
  onChange,
  showFrequency,
  accent = C.gold,
  allowMonthly = true,
}: {
  value: ScheduleDraft;
  onChange: (value: ScheduleDraft) => void;
  showFrequency: boolean;
  accent?: string;
  allowMonthly?: boolean;
}) {
  const [gridWidth, setGridWidth] = useState(0);
  const activeDayIndexes = useMemo(() => {
    switch (value.frequency) {
      case 'weekdays':
        return [0, 1, 2, 3, 4];
      case 'weekends':
        return [5, 6];
      case 'specific_days':
        return ensureSelectedWeekdays(value.selectedDays);
      default:
        return [0, 1, 2, 3, 4, 5, 6];
    }
  }, [value.frequency, value.selectedDays]);
  const effectiveSelectedDays = value.frequency === 'specific_days'
    ? ensureSelectedWeekdays(value.selectedDays)
    : value.selectedDays;
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
    <CardBlock label="Schedule" accent={accent}>
      <View style={s.stack}>
        {showFrequency && (
          <>
            <View style={s.frequencyWrap}>
              {FULL_FREQUENCY_OPTIONS.filter(option => allowMonthly || option.value !== 'monthly').map(option => {
                const active = value.frequency === option.value;
                return (
                  <FrequencyChoice
                    key={option.value}
                    option={option}
                    active={active}
                    accent={accent}
                    onPress={() => onChange({
                      ...value,
                      frequency: option.value,
                      selectedDays: option.value === 'specific_days'
                        ? ensureSelectedWeekdays(value.selectedDays)
                        : value.selectedDays,
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
                    const active = effectiveSelectedDays.includes(index);
                    return (
                      <TouchableOpacity
                        key={label}
                        onPress={() => {
                          if (active && effectiveSelectedDays.length === 1) return;
                          onChange({
                            ...value,
                            selectedDays: active
                              ? effectiveSelectedDays.filter(day => day !== index)
                              : [...effectiveSelectedDays, index].sort((a, b) => a - b),
                          });
                        }}
                        activeOpacity={0.84}
                        style={[
                          s.dayChip,
                          {
                            width: weekdaySize,
                            height: weekdaySize,
                            borderRadius: Math.round(weekdaySize / 2),
                          },
                          active && s.dayChipActive,
                          active && {
                            borderColor: accent,
                            backgroundColor: accent === C.gold ? '#FFF9EE' : ROUTINE_TASK_SOFT,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            s.dayChipText,
                            { fontSize: weekdayFontSize },
                            active && s.dayChipTextActive,
                            active && { color: accent },
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

            {allowMonthly && value.frequency === 'monthly' && (
              <View
                style={s.monthlyGridWrap}
                onLayout={event => setGridWidth(Math.floor(event.nativeEvent.layout.width))}
              >
                <SectionLabel text="Days of Month" accent={accent} compact />
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
                          active && { borderColor: accent, backgroundColor: accent },
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
          <TimeField label="Time" value={value.time} onChangeText={time => onChange({ ...value, time })} accent={accent} />
        )}

        {value.frequency !== 'monthly' && (
          <ToggleRow
            label="Different time per day"
            active={!value.sameTimeEveryDay}
            accent={accent}
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
                  accent={accent}
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
          accent={accent}
        />
      </View>
    </CardBlock>
  );
}

function FrequencyChoice({
  option,
  active,
  accent,
  onPress,
}: {
  option: typeof FULL_FREQUENCY_OPTIONS[number];
  active: boolean;
  accent: string;
  onPress: () => void;
}) {
  const softAccent = accent === C.gold ? '#FFF9EE' : ROUTINE_TASK_SOFT;
  const borderAccent = accent === C.gold ? '#D6B067' : ROUTINE_TASK_BORDER;
  const subAccent = accent === C.gold ? '#B08A47' : ROUTINE_TASK_ACCENT_MUTED;
  const progress = useSelectionMotion(active);
  const motionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', softAccent]),
    borderColor: interpolateColor(progress.value, [0, 1], ['#F0EDE6', borderAccent]),
    shadowOpacity: 0.015 + progress.value * 0.085,
    transform: [{ scale: 1 + progress.value * 0.01 }],
  }));
  const dotMotionStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.55 + progress.value * 0.45 }],
  }));
  const handlePress = () => {
    animateSoftLayoutChange();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Reanimated.View
        style={[
          s.frequencyChip,
          motionStyle,
          { shadowColor: accent },
        ]}
      >
        <View style={s.frequencyCopy}>
          <Text style={[s.frequencyChipText, active && s.frequencyChipTextActive]}>{option.label}</Text>
          <Text style={[s.frequencyChipSub, active && s.frequencyChipSubActive, active && { color: subAccent }]}>{option.desc}</Text>
        </View>
        <View style={[s.frequencyDotRing, active && s.frequencyDotRingActive, active && { borderColor: borderAccent, backgroundColor: softAccent }]}>
          <Reanimated.View style={[s.frequencyDot, { backgroundColor: accent }, dotMotionStyle]} />
        </View>
      </Reanimated.View>
    </TouchableOpacity>
  );
}

// Challenges pick their time on the same universal editor tasks use — the
// hero time row with its sub-line and the per-day schedule card, plus the
// redesigned picker sheet. The gold theme is TaskTimeEditor's own default, so
// it drops straight into the challenge cards. This is a thin adapter from the
// challenge schedule draft to the editor's flat props.
function ChallengeTimeEditor({
  value,
  onChange,
  allowPerDayTimes = true,
}: {
  value: ChallengeScheduleDraft;
  onChange: (value: ChallengeScheduleDraft) => void;
  allowPerDayTimes?: boolean;
}) {
  return (
    <TaskTimeEditor
      time={value.time}
      sameTimeEveryDay={value.sameTimeEveryDay}
      dayTimes={value.dayTimes}
      onTimeChange={time => onChange({ ...value, time })}
      onSameTimeEveryDayChange={sameTimeEveryDay => onChange({ ...value, sameTimeEveryDay })}
      onDayTimesChange={dayTimes => onChange({ ...value, dayTimes })}
      allowPerDayTimes={allowPerDayTimes}
    />
  );
}

function CardBlock({
  label,
  children,
  accent = C.gold,
}: {
  label: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <View style={s.cardBlock}>
      <Text style={[s.blockLabel, { color: accent }]}>{label}</Text>
      {children}
    </View>
  );
}

function TimePickerButton({
  value,
  onChangeText,
  accent = C.gold,
  compact = false,
}: {
  value: string;
  onChangeText: (text: string) => void;
  accent?: string;
  compact?: boolean;
}) {
  const normalized = parseTimeParts(value);
  const [visible, setVisible] = useState(false);
  const [hour, setHour] = useState(normalized.hour);
  const [minute, setMinute] = useState(normalized.minute);
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);
  const timeButtonBorder = accent === C.gold ? '#E9DEC9' : ROUTINE_TASK_BORDER;
  const timeButtonBg = accent === C.gold ? '#FFFBEB' : ROUTINE_TASK_SOFT;
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
        positiveButton: { label: 'Save', textColor: accent },
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
        style={[
          s.timeButton,
          compact && s.timeButtonCompact,
          { borderColor: compact ? '#ECE2CF' : timeButtonBorder, backgroundColor: compact ? '#FFFFFF' : timeButtonBg },
        ]}
      >
        {compact ? (
          <>
            <Text style={[s.timeButtonValue, s.timeButtonValueCompact]}>
              {formatTimeValue(hour, minute)}
            </Text>
            <ChevronDown s={14} c={accent} />
          </>
        ) : (
          <>
            <Text style={s.timeButtonValue}>
              {formatTimeValue(hour, minute)}
            </Text>
            <View style={[s.timeActionPill, { borderColor: timeButtonBorder }]}>
              <Text style={[s.timeActionText, { color: accent }]}>Change</Text>
              <ChevronDown s={14} c={accent} />
            </View>
          </>
        )}
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
                <Text style={[s.timePreviewInlineValue, { color: accent }]}>{formatTimeValue(hour, minute)}</Text>
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

              <TouchableOpacity onPress={applyValue} activeOpacity={0.86} style={[s.timeSaveButton, { backgroundColor: accent, shadowColor: accent }]}>
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
                <Text style={[s.timePreviewInlineValue, { color: accent }]}>{formatTimeValue(hour, minute)}</Text>
              </View>

              <View style={s.timeWheelCard}>
                <View style={[s.timeWheelSelectionBand, { borderColor: accent === C.gold ? '#EAD9B7' : ROUTINE_TASK_BORDER, backgroundColor: accent === C.gold ? '#FFFBEB' : ROUTINE_TASK_SOFT }]} />

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
                            <Text style={[s.timeWheelItemText, active && s.timeWheelItemTextActive, active && { color: accent }]}>{option}</Text>
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
                            <Text style={[s.timeWheelItemText, active && s.timeWheelItemTextActive, active && { color: accent }]}>{option}</Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              </View>

              <TouchableOpacity onPress={applyValue} activeOpacity={0.86} style={[s.timeSaveButton, { backgroundColor: accent, shadowColor: accent }]}>
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
  accent = C.gold,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  accent?: string;
}) {
  return (
    <View style={s.stackTight}>
      <SectionLabel text={label} accent={accent} compact />
      <TimePickerButton value={value} onChangeText={onChangeText} accent={accent} />
    </View>
  );
}

function ToggleRow({
  label,
  active,
  accent = C.gold,
  onPress,
}: {
  label: string;
  active: boolean;
  accent?: string;
  onPress: () => void;
}) {
  const progress = useSelectionMotion(active);
  const trackMotionStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#E5E7EB', accent]),
  }));
  const thumbMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 16 }],
  }));

  const handlePress = () => {
    animateSoftLayoutChange();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.84} style={s.toggleRow}>
      <Text style={s.toggleText}>{label}</Text>
      <Reanimated.View style={[s.toggleTrack, trackMotionStyle]}>
        <Reanimated.View style={[s.toggleThumb, thumbMotionStyle]} />
      </Reanimated.View>
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
  accent = C.gold,
  targetBinding,
}: {
  label: string;
  onPress: () => void;
  accent?: string;
  targetBinding?: GuideTargetBinding;
}) {
  return (
    <TouchableOpacity {...targetBinding} onPress={onPress} activeOpacity={0.84} style={[s.primaryBtn, { backgroundColor: accent, shadowColor: accent }]}>
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
    borderColor: '#E8E3D9',
    // The track is recessed and the plaque is raised. On a white track a
    // pale plaque had nothing to lift off.
    backgroundColor: '#F5F2EC',
    position: 'relative',
    overflow: 'hidden',
  },
  segmentPill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#B6913D',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 12,
    elevation: 3,
  },
  // A spiritual task's own frame. The hairline used to sit at 0.34 — softer
  // than the challenge face's solid gold border, on a plate barely lighter
  // than the track it stands in, which is the whole reason that half read as
  // the made one and this as the default one. The gilt is firm now, and the
  // rules inside it carry the figure.
  segmentFaceSpiritual: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.58)',
  },
  // The manuscript double rule, at the doors' own insets: 5 and 8 off the
  // frame, each radius stepping down with it. The inner one runs faint — a
  // second line at the first one's weight is a box drawn twice, not ruling.
  segmentFaceRule: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.4)',
  },
  segmentFaceRuleInner: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.19)',
  },
  // A routine task's ink plaque: a pale hairline, since slate takes no gold.
  segmentFaceInk: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  segmentFaceLit: {
    position: 'absolute',
    top: 1,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  segmentInkSheen: {
    position: 'absolute',
    top: 5,
    left: 14,
    width: 44,
    height: 7,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.1)',
    transform: [{ rotate: '-6deg' }],
  },
  // An active challenge card: a fine gold outline carrying two heavy rails.
  segmentFaceChallenge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.gold,
  },
  segmentRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: C.gold,
  },
  segmentRailLeft: { left: 0, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  segmentRailRight: { right: 0, borderTopRightRadius: 16, borderBottomRightRadius: 16 },
  segmentBtn: {
    flex: 1,
    // 52, up from 46: the emblems are 32 and were crowding a 46 band.
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    zIndex: 1,
  },
  segmentText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  segmentTextActive: { color: '#8B6B2F' },
  segmentTextOnInk: { color: '#F3F1EC' },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 30,
    gap: 18,
  },
  stack: { gap: 16 },
  challengeCatalogStack: { gap: 9 },
  scriptureChallengeGroup: { gap: 7 },
  // The cards carry a 6/18 drop shadow and sat 5pt apart, so each one's shadow
  // fell on the card below and the stack read as one shaded slab. They stand
  // apart now, and the spacing lives on the list rather than on the card.
  challengeCardList: { gap: 12 },
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
  activityNameInput: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#F2F1EC',
    paddingHorizontal: 16,
    fontFamily: F.serif,
    fontSize: 22,
    color: '#111827',
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
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  timeButtonCompact: {
    minHeight: 44,
    minWidth: 108,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginLeft: 'auto',
    justifyContent: 'space-between',
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
  timeActionPill: {
    minHeight: 32,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeActionText: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
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
    flexShrink: 1,
  },
  optionTitleActive: { color: '#111827' },
  optionTrailing: {
    minWidth: 54,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 7,
  },
  orthodoxRuleBadge: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8DCC4',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  orthodoxRuleBadgeText: {
    fontFamily: F.sansBold,
    fontSize: 7.5,
    letterSpacing: 0.9,
    color: C.gold,
    textTransform: 'uppercase',
  },
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
  jesusCustomBox: {
    alignSelf: 'center',
    width: '54%',
    minWidth: 154,
    maxWidth: 188,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFFBF4',
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 6,
  },
  jesusCustomBoxActive: {
    borderColor: 'rgba(197,160,89,0.42)',
    backgroundColor: '#FFF8EA',
    shadowColor: C.gold,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 2,
  },
  jesusCustomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jesusCustomLabel: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.25,
    color: '#9C948C',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  jesusCustomLabelActive: {
    color: '#B6822D',
  },
  jesusCustomUnitPill: {
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E7D8',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  jesusCustomUnitPillActive: {
    backgroundColor: '#FFF2D8',
    borderColor: 'rgba(197,160,89,0.28)',
  },
  jesusCustomUnitPillText: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1,
    color: '#B7B0A7',
    textTransform: 'uppercase',
  },
  jesusCustomUnitPillTextActive: {
    color: '#B6822D',
  },
  jesusCustomInputWrap: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEE8DE',
    backgroundColor: '#FFFFFF',
    paddingLeft: 12,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  jesusCustomInputWrapFocused: {
    borderColor: '#D7AA54',
  },
  jesusCustomInput: {
    flex: 1,
    minHeight: 40,
    padding: 0,
    fontFamily: F.serifMedium,
    fontSize: 20,
    color: C.text,
    textAlign: 'center',
  },
  jesusCustomDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#F0EDE6',
    marginLeft: 8,
    marginRight: 8,
  },
  jesusCustomSuffix: {
    minWidth: 30,
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1,
    color: '#B6822D',
    textTransform: 'uppercase',
    textAlign: 'right',
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
  // The Home challenge task card, grown up. The shell wears ONE uniform
  // hairline all the way around — so the rounded corners stay crisp — and the
  // gold rails live just inside it as full-height bands, each finished with
  // its own thin dark edge, the same boundary the top and bottom wear. The
  // shell's radius clips the bands into the curve like a bound book cover.
  challengeCardShell: {
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(158,120,50,0.40)',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    boxShadow: '0 6px 18px rgba(92,67,25,0.10)',
  },
  challengeCardShellStarted: {
    borderColor: 'rgba(158,120,50,0.55)',
    backgroundColor: '#FFFDF7',
    boxShadow: '0 9px 24px rgba(92,67,25,0.14)',
  },
  challengeCardShellPaused: {
    borderColor: 'rgba(150,132,96,0.32)',
    backgroundColor: '#FCFAF5',
    boxShadow: '0 3px 12px rgba(67,60,51,0.05)',
  },
  challengeRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: '#C5A059',
  },
  challengeRailLeft: {
    left: 0,
    borderRightWidth: 1,
    borderRightColor: 'rgba(146,108,40,0.45)',
  },
  challengeRailRight: {
    right: 0,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(146,108,40,0.45)',
  },
  challengeRailPaused: {
    backgroundColor: '#DCCBA2',
    borderLeftColor: 'rgba(150,132,96,0.40)',
    borderRightColor: 'rgba(150,132,96,0.40)',
  },
  // Start cards keep quieter rails until they are opened.
  challengeRailStart: {
    backgroundColor: 'rgba(197,160,89,0.62)',
    borderLeftColor: 'rgba(146,108,40,0.32)',
    borderRightColor: 'rgba(146,108,40,0.32)',
  },
  challengeCardPaused: {
    backgroundColor: 'transparent',
  },
  // The card wears two frames: a 5pt rail down each side and a hairline
  // whisper frame floating 9pt inside the face. The content used to be set
  // 15/11/13 from the edge — 6pt inside that whisper frame at the sides and
  // 2pt at the top, which is not a margin, it is a collision. Everything now
  // clears the frame on all four sides, so the frame reads as a frame and the
  // card has an inside — but the title needs less room over it than the sides
  // need beside it, so the vertical inset is the tighter of the two.
  challengeCard: {
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: 19,
    paddingTop: 15,
    paddingBottom: 15,
  },
  challengeCardGlow: {
    position: 'absolute',
    width: 132,
    height: 74,
    borderRadius: 66,
    right: -34,
    top: -40,
    backgroundColor: 'rgba(197,160,89,0.10)',
    transform: [{ rotate: '-10deg' }],
  },
  challengeCardGlowPaused: {
    backgroundColor: 'rgba(143,132,113,0.055)',
  },
  // The hairline inner frame every house plaque wears — a whisper of a border
  // floating just inside the face.
  challengeWhisperFrame: {
    ...StyleSheet.absoluteFillObject,
    margin: 9,
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.15)',
  },
  challengeWhisperFramePaused: {
    borderColor: 'rgba(160,146,118,0.12)',
  },
  // The prize itself, ghosted into the face of a live challenge — held at the
  // card's own mid-height, pulled in from the edge so the chevron never
  // crosses it. It was tried up in the corner at half strength and lost: the
  // trophy wants to sit in the middle of the face, where it reads as the card
  // being watermarked rather than as a mark stamped on one corner of it.
  challengeTrophyWatermark: {
    position: 'absolute',
    right: 40,
    top: 40,
    opacity: 0.34,
    transform: [{ rotate: '10deg' }],
  },
  challengeTrophyWatermarkPaused: { opacity: 0.16 },
  // The unstarted card's trophy is ornament, not status.
  //
  // Sharing the live card's position made it the one thing that still read as
  // a paused challenge: a small trophy sitting whole in the middle of the
  // face, at a low opacity, is exactly what a resting card looks like. A mark
  // cropped by the card's own edge cannot be mistaken for a badge — it is
  // bigger, it leans the other way, and only its lower edge is cut, so it
  // reads as printing on the card rather than as something placed on it.
  //
  // It stands alone rather than layering over the live card's watermark: that
  // one anchors from the top, this one from the bottom, and cancelling a
  // `top` by overriding it with undefined is a trick that reads as a mistake.
  challengeTrophyWatermarkStart: {
    position: 'absolute',
    right: 54,
    bottom: -22,
    opacity: 0.15,
    transform: [{ rotate: '-12deg' }],
  },
  challengeTopHighlight: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 1,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  /* — the head: title + rule of the challenge | tag over handle — */
  // No icon plate here on purpose: at 44pt plus its gap it took 56pt off a
  // ~320pt line, and the title is the one thing on this card that needs the
  // width. The card already carries the trophy watermark for texture.
  challengeHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  challengeHeadCopy: { flex: 1, minWidth: 0, paddingTop: 1 },
  // The tag files the card and the handle opens it — neither is content, so
  // both live in one column at the far edge, clear of the title.
  challengeHeadAside: { alignItems: 'flex-end', gap: 9, flexShrink: 0 },
  // The achievement card's badge, brought over: a plain tinted pill with the
  // word set in the serif, no dot and no tracked capitals.
  challengeTag: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
  },
  challengeTagPaused: { opacity: 0.72 },
  challengeTagText: {
    fontFamily: F.serifSemiBold,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 0.2,
  },
  challengeMetaLine: {
    marginTop: 4,
    fontFamily: F.sansBold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.6,
    color: '#B49B67',
  },
  challengeMetaLinePaused: { color: '#A8A29E' },
  challengeMetaSep: { color: '#D9CBAC' },
  // The unstarted card's second line is a sentence about the challenge, so it
  // is set in the serif the card's title is set in — the app's reading voice,
  // at the size the history card reads its own prose at. It was 12.5pt Inter,
  // which is the voice this app uses for controls, not for description.
  challengeStartBody: {
    marginTop: 5,
    fontFamily: F.serif,
    fontSize: 14.5,
    lineHeight: 19.5,
    color: '#87806F',
  },

  /* — the foot: the two figures, over the bar — */
  // The head and the rule were 15pt apart with 12 under it — 27pt of air in
  // the middle of a card whose whole content is four lines. The rule needs
  // only enough room to read as a division; the card tightens by 9.
  challengeFoot: { marginTop: 10 },
  challengeRule: { height: 1, marginBottom: 8 },
  challengeFootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  challengeFootLead: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  challengeFootLabel: {
    flexShrink: 1,
    fontFamily: F.sansBold,
    fontSize: 9.4,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  challengeFootLabelPaused: { color: '#A8A29E' },
  challengeFootValue: {
    flexShrink: 0,
    fontFamily: F.serifSemiBold,
    fontSize: 13.5,
    lineHeight: 17,
    color: '#4A423A',
  },
  challengeFootValuePaused: { color: '#8C857B' },
  challengeFlame: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    height: 24,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: '#FFF5E7',
    borderWidth: 1,
    borderColor: '#F2D8B4',
    paddingLeft: 9,
    paddingRight: 3,
  },
  challengeFlameIcon: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#FFF0D4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeFlameImage: {
    width: 12,
    height: 12,
  },
  challengeFlameText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    color: '#C46A19',
    minWidth: 9,
    textAlign: 'right',
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
  },
  challengeTitle: {
    fontFamily: F.serifMedium,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.2,
    color: '#1A1714',
  },
  challengeTitlePaused: {
    color: '#57534E',
  },
  challengeChevron: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEE4D3',
    backgroundColor: 'rgba(255,251,242,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeChevronPaused: {
    borderColor: '#E7E1D7',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  challengePausedPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5DBC6',
    backgroundColor: '#F8F4EA',
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  challengePausedText: {
    fontFamily: F.sansBold,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 1.4,
    color: '#8A7F6C',
    textTransform: 'uppercase',
  },
  challengeProgressTrack: {
    marginTop: 0,
    height: 7.5,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.15)',
    overflow: 'hidden',
  },
  challengeProgressTrackPaused: {
    backgroundColor: '#EBE5D8',
  },
  challengeProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: C.gold,
    overflow: 'hidden',
  },
  // Saved progress keeps its gold, only dimmed — a paused rule is resting,
  // not erased.
  challengeProgressFillPaused: {
    backgroundColor: '#CDB98C',
  },
  challengeProgressShine: {
    position: 'absolute',
    top: 1,
    left: 6,
    right: 6,
    height: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.42)',
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
    minHeight: 48,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.32)',
    backgroundColor: '#FFFDF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.3,
    color: '#8B6B2F',
    textTransform: 'uppercase',
  },
  resumeBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: C.gold,
    borderWidth: 1,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 2,
  },
  resumeBtnText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.3,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  dangerBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: '#FEF5F4',
    borderWidth: 1,
    borderColor: '#F4D4D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.3,
    color: '#C25048',
    textTransform: 'uppercase',
  },
  pausedNotice: {
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E9E2D2',
    backgroundColor: '#FBF8F1',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pausedNoticeLabel: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: '#8A7F6C',
    textTransform: 'uppercase',
  },
  pausedNoticeBody: {
    marginTop: 5,
    fontFamily: F.serif,
    fontSize: 14.5,
    lineHeight: 20.5,
    color: '#6E675C',
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
  challengeConfirmIconResume: {
    backgroundColor: '#ECFDF3',
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
    backgroundColor: C.red,
  },
  challengeConfirmResume: {
    backgroundColor: '#16A34A',
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
    marginBottom: -1,
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

// Reused by the Focus tab watch editor so time selection matches tasks 1:1.
export { TimePickerButton };
