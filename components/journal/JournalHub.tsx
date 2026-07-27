import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  InteractionManager,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Feather,
  FileEdit,
  Grid3x3,
  Pencil,
} from '@/components/icons/Icons';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SetAsDailyTaskCard from '@/components/shared/SetAsDailyTaskCard';
import SetAsTaskSheet from '@/components/shared/SetAsTaskSheet';
import FocusLottie from '@/components/focus/FocusLottie';
import JournalStreakCelebration from '@/components/journal/JournalStreakCelebration';
import JournalStreakSheet from '@/components/journal/JournalStreakSheet';
import { useTasks } from '@/components/tasks/TaskProvider';
import { useJournal, type JournalDotKind } from '@/components/journal/JournalContext';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';


const BG = '#FAF7F0';
const GOLD = '#C5A059';
const PURPLE = '#7C6EAF';
const TEAL = '#4A9E8F';
const INK = '#1C1917';
const BORDER = '#EDE5D6';

// The journal's own streak emblem: the book of your days. The living Lottie
// turns its pages in the hero; this still frame carries the chain medallions.
const BOOK_PNG = require('@/assets/images/streak-book-512.png');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type JournalTechniqueKind = 'daily' | 'morning' | 'free';
type Route = '/journal-daily' | '/journal-morning' | '/journal-free';

type WriteCard = {
  key: JournalTechniqueKind;
  label: string;
  title: string;
  description: string;
  bg: string;
  border: string;
  labelColor: string;
  titleColor: string;
  bodyColor: string;
  arrowBg: string;
  Decor: React.ComponentType<any>;
  decorColor: string;
  route: Route;
};

const WRITE_CARDS: WriteCard[] = [
  {
    key: 'daily',
    label: 'EVENING REFLECTION',
    title: 'Daily Journal',
    description: 'Capture your day, notice grace, return with a clearer heart.',
    bg: '#FBF3DE',
    border: '#F0E3B8',
    labelColor: '#A9863F',
    titleColor: '#6D4F13',
    bodyColor: '#A9863F',
    arrowBg: '#8A5A1A',
    Decor: Pencil,
    decorColor: '#B45309',
    route: '/journal-daily',
  },
  {
    key: 'morning',
    label: 'CLEAR YOUR MIND',
    title: 'Morning Pages',
    description: 'Three pages of stream-of-thought to start the day untangled.',
    bg: '#EEEAF5',
    border: '#DDD5ED',
    labelColor: '#6D5AAE',
    titleColor: '#3B2F76',
    bodyColor: '#6D5AAE',
    arrowBg: '#2E2478',
    Decor: Feather,
    decorColor: '#6D5AAE',
    route: '/journal-morning',
  },
  {
    key: 'free',
    label: 'OPEN PAGE',
    title: 'Free Writing',
    description: 'Write whatever flows. No prompts, no rules - just the page.',
    bg: '#E1F1EC',
    border: '#C8E6DD',
    labelColor: '#3D8273',
    titleColor: '#1F4E45',
    bodyColor: '#3D8273',
    arrowBg: '#2A6E5F',
    Decor: FileEdit,
    decorColor: '#3D8273',
    route: '/journal-free',
  },
];

const MORNING_DRAFT_PURPLE = '#C9BDE6';

const DOT_COLORS: Record<JournalDotKind, string> = {
  daily: GOLD,
  morning: PURPLE,
  morningDraft: MORNING_DRAFT_PURPLE,
  free: TEAL,
};

// The legend wears each technique's own card tints — the same families as
// the write cards below, so color meaning is learned once.
const LEGEND_ITEMS = [
  { label: 'Daily', dot: GOLD, bg: '#FBF3DE', border: '#F0E3B8', ink: '#A9863F' },
  { label: 'Morning', dot: PURPLE, bg: '#EEEAF5', border: '#DDD5ED', ink: '#6D5AAE' },
  { label: 'Draft', dot: MORNING_DRAFT_PURPLE, bg: '#F4F1FA', border: '#E5DFF3', ink: '#8C7EC0' },
  { label: 'Free', dot: TEAL, bg: '#E1F1EC', border: '#C8E6DD', ink: '#3D8273' },
] as const;

function hasTechniqueDot(kinds: JournalDotKind[], technique: JournalTechniqueKind) {
  if (technique === 'morning') {
    return kinds.includes('morning') || kinds.includes('morningDraft');
  }
  return kinds.includes(technique);
}

function techniqueHint(kinds: JournalDotKind[], technique: JournalTechniqueKind, editable: boolean) {
  if (editable) return 'Open';
  if (technique === 'morning' && kinds.includes('morningDraft') && !kinds.includes('morning')) {
    return 'Draft';
  }
  return 'Saved';
}

function localDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12);
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function previousDateKey(key: string) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() - 1);
  return localDateKey(date);
}

function lastSevenDays(todayKey: string) {
  const today = dateFromKey(todayKey);
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return {
      key: localDateKey(date),
      label: labels[date.getDay()],
    };
  });
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i += 1) cells.push(null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function AppText(props: React.ComponentProps<typeof Text>) {
  return <Text {...props} allowFontScaling={false} maxFontSizeMultiplier={1} />;
}

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

// Today's cell in the streak chain breathes a soft gold ring outward — the
// same quiet pulse the rest of the app gives to "now". Vector radius only,
// so the small circle stays crisp on Android.
function StreakTodayPulse() {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0.2;
      return;
    }
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  const ringProps = useAnimatedProps(() => ({
    opacity: (1 - t.value) * 0.45,
    r: 16 + t.value * 7,
  }));

  return (
    <View pointerEvents="none" style={s.streakPulse}>
      <Svg width={56} height={56}>
        <AnimatedCircle cx={28} cy={28} fill="none" stroke={GOLD} strokeWidth={1.4} animatedProps={ringProps} />
      </Svg>
    </View>
  );
}

// The streak's hero: the book of days, alive — its pages turn on a breathing
// glow with a golden ray burst, the same radiance the app reserves for what
// is alive and earned. The Lottie canvas carries wide margins, so the box is
// oversized and nudged to seat the book itself on the stage's center.
function RadiantBook() {
  const reduceMotion = useReducedMotion();
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      breathe.value = 0.6;
      return;
    }
    breathe.value = 0;
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );
    return () => cancelAnimation(breathe);
  }, [reduceMotion, breathe]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.45 + breathe.value * 0.55 }));
  const field = 96;
  const cx = field / 2;
  const inner = 26;

  return (
    <View style={s.bookStage}>
      <Reanimated.View pointerEvents="none" style={[s.bookGlow, glowStyle]} />
      <Svg pointerEvents="none" width={field} height={field} style={s.bookRays}>
        {Array.from({ length: 12 }).map((_, index) => {
          const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
          const long = index % 2 === 0;
          const r2 = inner + (long ? 13 : 7);
          return (
            <Line
              key={index}
              x1={cx + inner * Math.cos(angle)}
              y1={cx + inner * Math.sin(angle)}
              x2={cx + r2 * Math.cos(angle)}
              y2={cx + r2 * Math.sin(angle)}
              stroke="#E8C87E"
              strokeOpacity={long ? 0.5 : 0.28}
              strokeWidth={long ? 1.6 : 1.2}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
      <View style={s.bookLottie} pointerEvents="none">
        <FocusLottie name="meru-book" loop autoplay speed={0.85} style={{ width: '100%', height: '100%' }} />
      </View>
    </View>
  );
}

// A pixel of the year, drifting on the card and twinkling at its own rhythm.
function TwinklePixel({ delay, style, color }: { delay: number; style: object; color: string }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0.5;
      return;
    }
    t.value = 0;
    t.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      )
    );
    return () => cancelAnimation(t);
  }, [delay, reduceMotion, t]);

  const twinkle = useAnimatedStyle(() => ({ opacity: 0.12 + t.value * 0.34 }));

  return (
    <Reanimated.View pointerEvents="none" style={[s.fieldPixelWrap, style, twinkle]}>
      <View style={[s.fieldPixel, { backgroundColor: color }]} />
    </Reanimated.View>
  );
}

// A band of warm light that sweeps across the dark hearth every few seconds —
// the same glint grammar the Focus cards use, slowed to candlelight.
function HearthGlint() {
  const reduceMotion = useReducedMotion();
  const [w, setW] = useState(0);
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || w === 0) return;
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: 7200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, w, t]);

  const sweep = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.08, 0.3, 0.42, 1], [0, 0.9, 0.9, 0, 0]),
    transform: [
      { translateX: interpolate(t.value, [0, 0.42, 1], [-90, w + 50, w + 50]) },
      { rotate: '14deg' },
    ],
  }));

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={event => setW(event.nativeEvent.layout.width)}
    >
      {!reduceMotion && w > 0 && (
        <Reanimated.View style={[s.hearthGlint, sweep]}>
          <LinearGradient
            colors={['rgba(255,241,205,0)', 'rgba(255,241,205,0.14)', 'rgba(255,241,205,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Reanimated.View>
      )}
    </View>
  );
}

// A mote of gold dust hanging in the hearth's light, twinkling at its own pace.
function GoldDust({ delay, style }: { delay: number; style: object }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0.5;
      return;
    }
    t.value = 0;
    t.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      )
    );
    return () => cancelAnimation(t);
  }, [delay, reduceMotion, t]);

  const twinkle = useAnimatedStyle(() => ({ opacity: 0.15 + t.value * 0.5 }));

  return (
    <Reanimated.View pointerEvents="none" style={[s.dustWrap, style, twinkle]}>
      <View style={s.dust} />
    </Reanimated.View>
  );
}

function CalendarStreakCard({
  year,
  month,
  todayKey,
  onPrev,
  onNext,
  canNext,
  selectedDate,
  onSelect,
  dotsByDate,
  completedDates,
  currentStreak,
  onOpenStreak,
}: {
  year: number;
  month: number;
  todayKey: string;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
  selectedDate: string;
  onSelect: (key: string) => void;
  dotsByDate: Record<string, JournalDotKind[]>;
  completedDates: string[];
  currentStreak: number;
  onOpenStreak: () => void;
}) {
  const cells = useMemo(() => monthCells(year, month), [year, month]);
  const completedSet = useMemo(() => new Set(completedDates), [completedDates]);
  const streakDays = useMemo(() => lastSevenDays(todayKey), [todayKey]);

  return (
    <View style={s.card}>
      <View style={s.monthHead}>
        <TouchableOpacity style={s.monthBtn} activeOpacity={0.75} onPress={onPrev} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
          <ChevronLeft s={19} c="#9A6B1E" w={2.3} />
        </TouchableOpacity>
        <View style={s.monthCenter}>
          <AppText style={s.monthName}>{MONTH_NAMES[month]}</AppText>
          {/* The year set like an engraving line: italic gold between two
              hairline rules. */}
          <View style={s.yearRow}>
            <View style={s.yearRule} />
            <AppText style={s.yearText}>{year}</AppText>
            <View style={s.yearRule} />
          </View>
        </View>
        <TouchableOpacity
          style={[s.monthBtn, !canNext && s.disabled]}
          activeOpacity={0.75}
          onPress={onNext}
          disabled={!canNext}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
        >
          <ChevronRight s={19} c="#9A6B1E" w={2.3} />
        </TouchableOpacity>
      </View>

      <View style={s.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <View key={`${w}-${i}`} style={s.weekCell}>
            <AppText style={[s.weekText, i >= 5 && s.weekTextWeekend]}>{w}</AppText>
          </View>
        ))}
      </View>

      <View style={s.calendarGrid}>
        {cells.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={s.dateSlot} />;
          const key = dateKey(year, month, day);
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const isFuture = key > todayKey;
          const dots = dotsByDate[key] || [];

          return (
            <View key={key} style={s.dateSlot}>
              <Pressable
                disabled={isFuture}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                style={({ pressed }) => [
                  s.dateShell,
                  pressed && !isFuture && s.pressed,
                ]}
                onPress={() => onSelect(key)}
              >
                {/* One fixed disc, centered by flexbox; the dots live in normal
                    flow below it. No absolute offsets — the layout cannot
                    drift, whatever the font metrics do. */}
                <View
                  style={[
                    s.dateDisc,
                    isToday && s.dateDiscToday,
                    isSelected && s.dateDiscSelected,
                  ]}
                  pointerEvents="none"
                >
                  {/* A second hairline inside today's disc — the seal ring.
                      Anchored to the fixed 36px disc, so it can never drift
                      with font metrics. */}
                  {isToday && <View style={s.todaySealRing} />}
                  <AppText
                    numberOfLines={1}
                    style={[
                      s.dateText,
                      dots.length === 0 && s.dateTextEmpty,
                      isToday && s.todayText,
                      isSelected && s.selectedDateText,
                      isFuture && s.futureText,
                    ]}
                  >
                    {day}
                  </AppText>
                </View>
                <View style={s.dots} pointerEvents="none">
                  {dots.slice(0, 3).map((kind, dotIndex) => (
                    <View key={`${kind}-${dotIndex}`} style={[s.dot, { backgroundColor: DOT_COLORS[kind] }]} />
                  ))}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={s.legend}>
        {LEGEND_ITEMS.map(item => (
          <View key={item.label} style={[s.legendChip, { backgroundColor: item.bg, borderColor: item.border }]}>
            <View style={[s.legendDot, { backgroundColor: item.dot }]} />
            <AppText style={[s.legendText, { color: item.ink }]}>{item.label}</AppText>
          </View>
        ))}
      </View>

      {/* The hearth: one dark velvet panel inside the pale card — the book
          glows against it, light sweeps across, gold dust hangs in the air.
          The most precious corner of the screen. */}
      <TouchableOpacity
        style={s.hearth}
        activeOpacity={0.9}
        onPress={onOpenStreak}
        accessibilityRole="button"
        accessibilityLabel="Open journal trophy streak"
      >
        <LinearGradient
          colors={['#2C2517', '#211C12', '#1A160E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View pointerEvents="none" style={s.hearthSheen} />
        <HearthGlint />
        <GoldDust delay={0} style={{ right: 24, top: 13 }} />
        <GoldDust delay={1500} style={{ right: 64, top: 34 }} />
        <GoldDust delay={2700} style={{ left: 74, bottom: 64 }} />

        <View style={s.streakHead}>
          <RadiantBook />
          <View style={s.streakHeadCopy}>
            <AppText style={s.streakEyebrow}>JOURNAL STREAK</AppText>
            <View style={s.streakNumberRow}>
              <AppText style={s.streakNumber}>{currentStreak}</AppText>
              <AppText style={s.streakLabel}>day streak</AppText>
            </View>
          </View>
        </View>

        <View style={s.streakRow}>
        {/* The chain: each link between two written days turns gold — the
            streak literally lights up through the week. */}
        {Array.from({ length: 6 }).map((_, index) => {
          const lit = completedSet.has(streakDays[index].key)
            && completedSet.has(streakDays[index + 1].key);
          return (
            <View
              key={`seg-${index}`}
              pointerEvents="none"
              style={[
                s.streakSegment,
                { left: `${(100 / 7) * (index + 0.5)}%` },
                lit && s.streakSegmentLit,
              ]}
            />
          );
        })}
        {streakDays.map((item) => {
          const active = completedSet.has(item.key);
          const isTodayCell = item.key === todayKey;
          return (
          <View key={item.key} style={s.streakDay}>
            <View style={s.streakCircleWrap}>
              {isTodayCell && <StreakTodayPulse />}
              <View
                style={[
                  s.streakCircle,
                  active ? s.streakCircleActive : s.streakCircleResting,
                  isTodayCell && !active && s.streakCircleToday,
                ]}
              >
                {/* key remount: a tinted Image must never be reused untinted —
                    template rendering sticks and iOS paints it system blue */}
                <Image
                  key={active ? 'book-lit' : 'book-resting'}
                  source={BOOK_PNG}
                  style={[
                    s.streakBook,
                    !active && s.streakBookResting,
                  ]}
                  resizeMode="contain"
                />
              </View>
            </View>
            <AppText style={[
              s.streakDayText,
              active && s.streakDayTextActive,
              isTodayCell && s.streakDayTextToday,
            ]}>{item.label}</AppText>
          </View>
          );
        })}
        </View>
      </TouchableOpacity>
    </View>
  );
}

function DayChoicesPanel({
  date,
  kinds,
  editable,
  onClose,
  onOpen,
}: {
  date: string;
  kinds: JournalDotKind[];
  editable: boolean;
  onClose: () => void;
  onOpen: (route: Route, readOnly: boolean) => void;
}) {
  const choices = WRITE_CARDS;
  const displayDate = dateFromKey(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  if (!date) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.choiceOverlay} onPress={onClose}>
        <Pressable style={s.choicePanel} onPress={() => {}}>
          <View style={s.choiceHead}>
            <View>
              <AppText style={s.choiceKicker}>{displayDate}</AppText>
              <AppText style={s.choiceTitle}>{editable ? 'Choose Technique' : 'Saved Entries'}</AppText>
              <AppText style={s.choiceDate}>
                {editable ? 'Write or edit today\'s reflection.' : 'Saved drafts and entries can be opened.'}
              </AppText>
            </View>
            <TouchableOpacity onPress={onClose} style={s.choiceClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <AppText style={s.choiceCloseText}>x</AppText>
            </TouchableOpacity>
          </View>
          <View style={s.choiceRow}>
            {choices.map(item => {
              const enabled = editable || hasTechniqueDot(kinds, item.key);
              return (
                <TouchableOpacity
                  key={item.key}
                  disabled={!enabled}
                  activeOpacity={0.85}
                  style={[
                    s.choiceChip,
                    { backgroundColor: item.bg, borderColor: item.border },
                    !enabled && s.choiceChipDisabled,
                  ]}
                  onPress={() => onOpen(item.route, !editable)}
                >
                  <View style={[
                    s.choiceIcon,
                    { backgroundColor: '#FFFFFF', borderColor: item.border },
                    !enabled && s.choiceIconDisabled,
                  ]}>
                    <item.Decor s={24} c={enabled ? item.labelColor : '#9C948A'} w={2} />
                  </View>
                  <AppText style={[
                    s.choiceChipText,
                    { color: enabled ? item.titleColor : '#BDB7AD' },
                  ]}>
                    {item.title}
                  </AppText>
                  <AppText style={[
                    s.choiceChipHint,
                    { color: enabled ? item.labelColor : '#C6C0B7' },
                  ]}>
                    {enabled ? techniqueHint(kinds, item.key, editable) : 'Empty'}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function WriteSectionCard({ card, onPress }: { card: WriteCard; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[s.writeCard, { backgroundColor: card.bg, borderColor: card.border }]}
    >
      <LinearGradient
        colors={[card.bg, '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={s.writeWatermark} pointerEvents="none">
        <card.Decor s={110} c={card.decorColor} w={1} />
      </View>

      <View style={[s.writeArrow, { backgroundColor: card.arrowBg }]} pointerEvents="none">
        <View style={s.writeArrowRotated}>
          <ArrowUpRight s={16} c="#fff" w={2.5} />
        </View>
      </View>

      <View style={s.writeContent}>
        <AppText style={[s.writeLabel, { color: card.labelColor }]}>{card.label}</AppText>
        <AppText style={[s.writeTitle, { color: card.titleColor }]}>{card.title}</AppText>
        <AppText style={[s.writeDesc, { color: card.bodyColor }]}>{card.description}</AppText>
      </View>
    </TouchableOpacity>
  );
}

// A quiet echo of the real grid: the five mood tones the Year in Pixels page
// itself paints with, resting cells between them.
const MOSAIC_TONES = [
  '#EAB308', '#22C55E', '#EDEAE3', '#84CC16', '#EDEAE3',
  '#F97316', '#EDEAE3', '#22C55E', '#EAB308', '#84CC16',
  '#EDEAE3', '#84CC16', '#EF4444', '#EDEAE3', '#22C55E',
  '#22C55E', '#EDEAE3', '#EAB308', '#84CC16', '#EDEAE3',
  '#EDEAE3', '#F97316', '#EDEAE3', '#22C55E', '#EAB308',
];

function PixelMosaic() {
  return (
    <View style={s.pixelMosaic} pointerEvents="none">
      {MOSAIC_TONES.map((tone, index) => (
        <View key={index} style={[s.pixelCell, { backgroundColor: tone }]} />
      ))}
    </View>
  );
}

function YearInPixelsSection({
  onPress,
  entryCount,
}: {
  onPress: () => void;
  entryCount: number;
}) {
  return (
    <View style={s.toolsWrap}>
      <View style={s.sectionHead}>
        <AppText style={s.sectionTitle}>YEAR IN PIXELS</AppText>
        <AppText style={s.sectionHint}>Reflect gently</AppText>
      </View>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={s.yearPixelCard}>
        <LinearGradient
          colors={['#EEEAF5', '#FBFAFE', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={s.yearPixelWatermark} pointerEvents="none">
          <Grid3x3 s={104} c={PURPLE} w={1} />
        </View>
        {/* Year-dust: stray pixels of the year drifting across the card, two
            of them twinkling at their own quiet rhythms. */}
        <View pointerEvents="none" style={[s.fieldPixelWrap, s.fieldPixelA]}><View style={[s.fieldPixel, { backgroundColor: '#EAB308' }]} /></View>
        <View pointerEvents="none" style={[s.fieldPixelWrap, s.fieldPixelB]}><View style={[s.fieldPixel, { backgroundColor: '#22C55E' }]} /></View>
        <View pointerEvents="none" style={[s.fieldPixelWrap, s.fieldPixelC]}><View style={[s.fieldPixel, { backgroundColor: PURPLE }]} /></View>
        <TwinklePixel delay={0} style={s.fieldPixelD} color="#F97316" />
        <TwinklePixel delay={1300} style={s.fieldPixelE} color={TEAL} />
        <View style={s.paintingFrame}>
          <PixelMosaic />
        </View>
        <View style={s.yearPixelCopy}>
          <AppText style={s.yearPixelLabel}>ONE SQUARE PER DAY</AppText>
          <AppText style={s.yearPixelTitle}>Year in Pixels</AppText>
          <AppText style={s.yearPixelSub}>
            {entryCount === 0 ? 'No entries yet' : `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
          </AppText>
        </View>
        <View style={s.yearPixelArrow} pointerEvents="none">
          <View style={s.writeArrowRotated}>
            <ArrowUpRight s={15} c="#fff" w={2.5} />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function JournalHub() {
  const router = useRouter();
  const { createOrUpdateTask, refresh: refreshTasks } = useTasks();
  const {
    completionEvent,
    dismissCompletionEvent,
    dotsByDate,
    streak,
    entries,
  } = useJournal();
  const today = useMemo(() => new Date(), []);
  const todayKey = localDateKey(today);
  const yesterdayKey = useMemo(() => previousDateKey(todayKey), [todayKey]);
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskSummary, setTaskSummary] = useState('Add to your daily routine');
  const [chosenDate, setChosenDate] = useState('');
  const [trophiesOpen, setTrophiesOpen] = useState(false);
  const [celebrationStreak, setCelebrationStreak] = useState<number | null>(null);
  const handledCompletionEventRef = useRef<number | null>(null);
  const chosenKinds = chosenDate ? dotsByDate[chosenDate] ?? [] : [];
  const chosenDateEditable = chosenDate === todayKey || chosenDate === yesterdayKey;
  const canNext = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());
  // The journal's streak sheet reads the journal's own record directly —
  // it is its own room, not a themed copy of the Focus trophy hall.
  const journalEntryDates = useMemo(() => entries.map(entry => entry.date), [entries]);

  useFocusEffect(useCallback(() => {
    if (!completionEvent) return undefined;
    if (handledCompletionEventRef.current === completionEvent.id) return undefined;

    let active = true;
    let firstFrame: number | null = null;
    let secondFrame: number | null = null;
    const event = completionEvent;
    const interaction = InteractionManager.runAfterInteractions(() => {
      // Let the returning Journal Hub paint twice after the editor/navigation
      // teardown before mounting the celebration's Lottie and SVG field.
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          if (!active) return;
          handledCompletionEventRef.current = event.id;
          dismissCompletionEvent(event.id);
          if (event.date === todayKey) {
            setCelebrationStreak(Math.max(1, event.currentStreak));
          }
        });
      });
    });

    return () => {
      active = false;
      interaction.cancel();
      if (firstFrame !== null) cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
    };
  }, [completionEvent, dismissCompletionEvent, todayKey]));

  const nav = (route?: string, date?: string, readOnly = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!route) return;
    if (date) {
      router.push({ pathname: route as any, params: { date, ...(readOnly ? { readOnly: '1' } : {}) } });
      return;
    }
    router.push(route as any);
  };

  const prevMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (month === 0) {
      setMonth(11);
      setYear(v => v - 1);
    } else {
      setMonth(v => v - 1);
    }
  };

  const nextMonth = () => {
    if (!canNext) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (month === 11) {
      setMonth(0);
      setYear(v => v + 1);
    } else {
      setMonth(v => v + 1);
    }
  };

  const selectDate = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const dots = dotsByDate[key] || [];
    const isEditableDate = key === todayKey || key === yesterdayKey;

    if (isEditableDate || dots.length > 0) {
      setChosenDate(key);
      return;
    }

    setChosenDate('');
  };

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="JOURNAL" showBack bg={BG} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        <View style={s.body}>
          <CalendarStreakCard
            year={year}
            month={month}
            todayKey={todayKey}
            onPrev={prevMonth}
            onNext={nextMonth}
            canNext={canNext}
            selectedDate={chosenDate}
            onSelect={selectDate}
            dotsByDate={dotsByDate}
            completedDates={streak.completedDates}
            currentStreak={streak.currentStreak}
            onOpenStreak={() => setTrophiesOpen(true)}
          />

          <DayChoicesPanel
            date={chosenDate}
            kinds={chosenKinds}
            editable={chosenDateEditable}
            onClose={() => setChosenDate('')}
            onOpen={(route, readOnly) => {
              const date = chosenDate;
              setChosenDate('');
              nav(route, date, readOnly);
            }}
          />

          <View style={s.writeStack}>
            {WRITE_CARDS.map(card => (
              <WriteSectionCard key={card.key} card={card} onPress={() => nav(card.route, todayKey)} />
            ))}
          </View>

          <View style={s.taskCardWrap}>
            <SetAsDailyTaskCard
              subtitle={taskSummary}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTaskOpen(true);
              }}
              textMaxFontSizeMultiplier={1}
            />
          </View>

          <YearInPixelsSection
            entryCount={entries.length}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              router.push('/year-in-pixels');
            }}
          />
        </View>
      </ScrollView>

      <SetAsTaskSheet
        visible={taskOpen}
        context="journal"
        onClose={() => setTaskOpen(false)}
        onSummaryChange={setTaskSummary}
        onTaskDraft={createOrUpdateTask}
        onTaskMutation={refreshTasks}
      />

      <JournalStreakSheet
        visible={trophiesOpen}
        onClose={() => setTrophiesOpen(false)}
        completedDates={streak.completedDates}
        entryDates={journalEntryDates}
        currentStreak={streak.currentStreak}
        bestStreak={streak.bestStreak}
      />

      {celebrationStreak !== null && (
        <JournalStreakCelebration
          currentStreak={celebrationStreak}
          onClose={() => setCelebrationStreak(null)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 140 },
  body: { width: '100%', paddingHorizontal: 16, paddingTop: 6, alignItems: 'stretch' },

  card: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 18,
    shadowColor: '#8C7A4F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  monthHead: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 13,
    borderCurve: 'continuous',
    backgroundColor: '#FFFAEF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 1,
  },
  disabled: { opacity: 0.32 },
  monthCenter: { alignItems: 'center', justifyContent: 'center' },
  monthName: { fontFamily: F.serifSemiBold, fontSize: 23, lineHeight: 27, color: INK },
  yearRow: { marginTop: 1, flexDirection: 'row', alignItems: 'center', columnGap: 7 },
  yearRule: { width: 15, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(154,107,30,0.5)' },
  yearText: { fontFamily: F.serifMediumItalic, fontSize: 14, lineHeight: 18, color: '#A9863F', letterSpacing: 0.8 },
  weekRow: {
    width: '100%',
    alignSelf: 'stretch',
    marginTop: 13,
    paddingBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F2EDE4',
    flexDirection: 'row',
  },
  weekCell: { flex: 1, height: 18, alignItems: 'center', justifyContent: 'center' },
  weekText: { fontFamily: F.sansBold, fontSize: 10, lineHeight: 12, letterSpacing: 1.2, color: '#A5A09A' },
  weekTextWeekend: { color: '#C2A377' },
  calendarGrid: {
    width: '100%',
    alignSelf: 'stretch',
    marginTop: 7,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dateSlot: {
    width: `${100 / 7}%`,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The cell is a plain flex column: disc, then dots, nothing absolute.
  dateShell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  dateDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDiscToday: { backgroundColor: '#FFF6E1', borderWidth: 1.2, borderColor: GOLD },
  dateDiscSelected: { backgroundColor: '#F8E8C6', borderWidth: 1.4, borderColor: '#B08A3E' },
  todaySealRing: {
    position: 'absolute',
    left: 2.5,
    top: 2.5,
    right: 2.5,
    bottom: 2.5,
    borderRadius: 15.5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(154,107,30,0.45)',
  },
  dateText: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    lineHeight: 21,
    color: INK,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  // Days that carry entries keep full ink; empty past days recede — the month
  // becomes scannable at a glance.
  dateTextEmpty: { color: '#97918A' },
  todayText: { fontFamily: F.serifSemiBold, color: '#9A6B1E' },
  selectedDateText: { fontFamily: F.serifSemiBold, color: '#7A5310' },
  futureText: { color: '#D7D1C8' },
  pressed: { opacity: 0.76 },
  dots: {
    height: 8,
    marginTop: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 4.6, height: 4.6, borderRadius: 3, marginHorizontal: 1.2 },

  legend: {
    marginTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 7,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
  },
  legendDot: { width: 6.5, height: 6.5, borderRadius: 4 },
  legendText: { fontFamily: F.sansMedium, fontSize: 10.5, lineHeight: 13 },

  // The hearth: a dark velvet track running the full width of the card —
  // edge to edge, hairline gold rails top and bottom, the white footer of the
  // card left untouched beneath it.
  hearth: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: 14,
    marginHorizontal: -16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(197,160,89,0.32)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 13,
  },
  hearthSheen: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: 'rgba(255,244,214,0.14)',
  },
  hearthGlint: { position: 'absolute', top: -24, bottom: -24, width: 88 },
  dustWrap: { position: 'absolute' },
  dust: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#E8C87E' },

  streakHead: { flexDirection: 'row', alignItems: 'center' },
  bookStage: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  bookGlow: {
    position: 'absolute',
    left: 7,
    top: 7,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(240,196,107,0.22)',
  },
  bookRays: { position: 'absolute', left: -10, top: -10 },
  // The Lottie book sits exactly on its 400px canvas center; a 112px box
  // centered on the 76px stage (offset -18) seats it in the glow, book ~41px
  // wide, page-flip sparkles rising into the dark above.
  bookLottie: { position: 'absolute', left: -18, top: -18, width: 112, height: 112 },
  streakHeadCopy: { flex: 1, minWidth: 0, marginLeft: 6 },
  streakEyebrow: { fontFamily: F.sansBold, fontSize: 9, lineHeight: 12, letterSpacing: 2.2, color: '#D9B978' },
  streakNumberRow: { flexDirection: 'row', alignItems: 'baseline', columnGap: 7, marginTop: 2 },
  streakNumber: { fontFamily: F.serifSemiBold, fontSize: 34, lineHeight: 38, color: '#F3E2BC' },
  streakLabel: { fontFamily: F.serifMediumItalic, fontSize: 16, lineHeight: 20, color: 'rgba(243,226,188,0.6)' },
  // The last seven days are a chain across the dark: each link between two
  // written days turns gold, and today breathes its ring.
  streakRow: { position: 'relative', marginTop: 11, flexDirection: 'row' },
  streakSegment: {
    position: 'absolute',
    width: `${100 / 7}%`,
    top: 15.5,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  streakSegmentLit: { backgroundColor: 'rgba(212,176,106,0.65)', height: 2, top: 15.25 },
  streakDay: { flex: 1, alignItems: 'center' },
  streakCircleWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  streakPulse: { position: 'absolute', left: -12, top: -12, width: 56, height: 56 },
  streakCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCircleResting: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  streakCircleActive: {
    borderColor: '#D9B064',
    backgroundColor: 'rgba(197,160,89,0.2)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 3,
  },
  streakCircleToday: { borderStyle: 'solid', borderColor: '#D9B064', backgroundColor: 'rgba(255,244,214,0.08)' },
  streakBook: { width: 22, height: 22 },
  streakBookResting: { tintColor: '#6E6553', opacity: 0.55 },
  streakDayText: { marginTop: 5, fontFamily: F.sansBold, fontSize: 10, lineHeight: 12, color: 'rgba(255,255,255,0.34)' },
  streakDayTextActive: { color: '#D9B978' },
  streakDayTextToday: { color: '#F3E2BC' },

  choiceOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28, 25, 23, 0.34)',
    paddingHorizontal: 22,
  },
  choicePanel: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#EFE3CF',
    backgroundColor: '#FFFFFF',
    padding: 18,
    paddingTop: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  choiceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choiceKicker: {
    fontFamily: F.sansBold,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.8,
    color: GOLD,
    textTransform: 'uppercase',
  },
  choiceTitle: { marginTop: 2, fontFamily: F.serifSemiBold, fontSize: 23, lineHeight: 28, color: INK },
  choiceDate: { marginTop: 3, fontFamily: F.serifItalic, fontSize: 13, lineHeight: 17, color: '#A29A91' },
  choiceClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F6F4F0', alignItems: 'center', justifyContent: 'center' },
  choiceCloseText: { fontFamily: F.serifMedium, fontSize: 24, lineHeight: 28, color: '#A8A29E' },
  choiceRow: { rowGap: 10, marginTop: 18 },
  choiceChip: {
    width: '100%',
    minHeight: 68,
    borderRadius: 19,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 11,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  choiceChipDisabled: { backgroundColor: '#F3F0EA', borderColor: '#E6E0D6', opacity: 0.74 },
  choiceIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  choiceIconDisabled: { backgroundColor: '#F7F4EE', borderColor: '#E2DCD2' },
  choiceChipText: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 17,
    lineHeight: 21,
    textAlign: 'left',
  },
  choiceChipHint: {
    marginLeft: 10,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 1.1,
    textAlign: 'right',
    textTransform: 'uppercase',
  },

  writeStack: { width: '100%', alignSelf: 'stretch', marginTop: 14, rowGap: 12 },
  writeCard: {
    position: 'relative',
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  writeWatermark: {
    position: 'absolute',
    bottom: -8,
    right: 14,
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.12,
  },
  writeArrow: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  writeArrowRotated: { transform: [{ rotate: '-15deg' }] },
  writeContent: { padding: 18, paddingRight: 70, maxWidth: '88%' },
  writeLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 2.2,
    marginBottom: 6,
  },
  writeTitle: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    lineHeight: 28,
    marginBottom: 6,
  },
  writeDesc: {
    fontFamily: F.serif,
    fontSize: 14,
    lineHeight: 19,
  },

  taskCardWrap: { width: '100%', alignSelf: 'stretch', marginTop: 14 },

  toolsWrap: { width: '100%', alignSelf: 'stretch', marginTop: 18 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: { fontFamily: F.sansBold, fontSize: 10, lineHeight: 13, letterSpacing: 2.3, color: GOLD },
  sectionHint: { fontFamily: F.serifMediumItalic, fontSize: 14, lineHeight: 18, color: '#A7A098' },
  yearPixelCard: {
    position: 'relative',
    width: '100%',
    minHeight: 96,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DDD5ED',
    backgroundColor: '#EEEAF5',
    paddingHorizontal: 15,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 13,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  yearPixelWatermark: {
    position: 'absolute',
    right: 8,
    bottom: -20,
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.1,
  },
  yearPixelArrow: {
    position: 'absolute',
    top: 13,
    right: 13,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2E2478',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  // The year hangs on the card like a small painting: a white frame, gently
  // tilted, holding a 5x5 swatch of the real mood palette.
  paintingFrame: {
    width: 69,
    height: 69,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#DDD5ED',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
    shadowColor: '#3B2F76',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  pixelMosaic: {
    width: 53,
    height: 53,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pixelCell: { width: 9, height: 9, borderRadius: 2.5 },
  fieldPixelWrap: { position: 'absolute' },
  fieldPixel: { width: 7, height: 7, borderRadius: 2 },
  fieldPixelA: { right: 118, top: 14, opacity: 0.3 },
  fieldPixelB: { right: 84, top: 64, opacity: 0.26 },
  fieldPixelC: { right: 148, top: 40, opacity: 0.2 },
  fieldPixelD: { right: 62, top: 26 },
  fieldPixelE: { right: 128, top: 76 },
  yearPixelCopy: { flex: 1, minWidth: 0, paddingRight: 26 },
  yearPixelLabel: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 2,
    color: '#6D5AAE',
    marginBottom: 4,
  },
  yearPixelTitle: { fontFamily: F.serifMedium, fontSize: 21, lineHeight: 25, color: '#3B2F76' },
  yearPixelSub: { marginTop: 3, fontFamily: F.sans, fontSize: 12, lineHeight: 15, color: '#8A82A8' },
});
