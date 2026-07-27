import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Asset } from 'expo-asset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import Reanimated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { ChevronLeft, ChevronRight, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { F } from '@/constants/tokens';

// The journal's own streak hall — deliberately NOT the Focus trophy sheet.
// Focus is a bright gold morning where trophies are struck and rest days
// are mercy; the journal is a dark hearth at night where a BOOK is earned
// for a day written, and the days you wrote link into a chain of light.
// The two streaks think differently, so they get different rooms.
//
// The journal keeps only three marks:
//   · earned  — the day was written: a full book in a gold-rimmed medal;
//   · empty   — the day passed unwritten: the same book, gone to ash,
//               behind a dashed rim;
//   · today   — still open: a solid gold rim breathing its ring outward.
// There are no rest days here — a page is either written or it is not.

const VELVET = ['#2C2517', '#211C12', '#1A160E'] as const;
const GOLD = '#C5A059';
const GOLD_LIT = '#D9B064';
const GOLD_RAY = '#E8C87E';
const CREAM = '#F3E2BC';
const EYEBROW = '#D9B978';
const ASH_BOOK = '#6E6553';
const RAIL = 'rgba(197,160,89,0.32)';

const BOOK_PNG = require('@/assets/images/streak-book-512.png');
let bookAssetWarmup: Promise<void> | null = null;

function preloadBookAsset() {
  if (!bookAssetWarmup) {
    bookAssetWarmup = (async () => {
      const asset = Asset.fromModule(BOOK_PNG);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      if (uri) await Image.prefetch(uri);
    })().catch(() => undefined);
  }
  return bookAssetWarmup;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// Anasta means rise. The closing line says it plainly: standing back up is
// the whole point, which is why this sheet counts the books you have kept
// rather than the days you have lost.
const MERCY_LINE =
  'A missed day is not a failure — rise, write today, and your books keep adding up!';
const STEADY_LINE = 'The streak is not the score — every book you write is yours to keep!';

const enter = (delay: number) => FadeInDown.duration(360).delay(delay);

function dateKeyOf(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthKey(date: Date) {
  return date.getFullYear() * 12 + date.getMonth();
}

type CellState = 'earned' | 'empty' | 'today' | 'future' | 'untracked' | 'blank';

type Cell = {
  day: number;
  cell: CellState;
  // Consecutive written days fuse into the chain, drawn per cell as two
  // half links so neighbours meet seamlessly at the cell border.
  linkLeft: boolean;
  linkRight: boolean;
};

/* ── Count-up ─────────────────────────────────────────────── */
// A number that arrives — rolling up from zero on the UI thread via an
// uneditable TextInput (the Reanimated ReText move), so no re-renders.
const AnimatedTextInput = Reanimated.createAnimatedComponent(TextInput);

function CountUp({
  value,
  delay = 0,
  textStyle,
}: {
  value: number;
  delay?: number;
  textStyle: StyleProp<TextStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const n = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    n.value = 0;
    n.value = withDelay(delay, withTiming(value, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    }));
    return () => cancelAnimation(n);
  }, [delay, n, reduceMotion, value]);

  const animatedProps = useAnimatedProps(() => ({
    text: String(Math.round(n.value)),
  } as never));

  if (reduceMotion || value === 0) {
    return <Text style={textStyle} allowFontScaling={false}>{value}</Text>;
  }
  return (
    <View pointerEvents="none">
      <AnimatedTextInput
        editable={false}
        caretHidden
        allowFontScaling={false}
        underlineColorAndroid="transparent"
        defaultValue="0"
        animatedProps={animatedProps}
        style={[textStyle, cu.reset]}
      />
    </View>
  );
}

const cu = StyleSheet.create({
  reset: { padding: 0, margin: 0 },
});

/* ── Gold dust ────────────────────────────────────────────── */
// The hearth's own air: motes of gold hanging in the dark, twinkling at
// their own rhythms.
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
        true,
      ),
    );
    return () => cancelAnimation(t);
  }, [delay, reduceMotion, t]);

  const twinkle = useAnimatedStyle(() => ({ opacity: 0.1 + t.value * 0.42 }));

  return (
    <Reanimated.View pointerEvents="none" style={[s.dustWrap, style, twinkle]}>
      <View style={s.dust} />
    </Reanimated.View>
  );
}

/* ── Today's ring ─────────────────────────────────────────── */
// The journal's pulse: a ring that truly expands outward, animated by
// SVG RADIUS rather than transform — so the small circle never resamples
// on Android. Straight from the streak chain on the Journal card.
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

function TodayPulse({ field = 50 }: { field?: number }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0.35;
      return;
    }
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: 2100, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  const ringProps = useAnimatedProps(() => ({
    opacity: (1 - t.value) * 0.5,
    r: 14 + t.value * 7,
  }));

  return (
    <View pointerEvents="none" style={[s.todayPulse, { width: field, height: field, left: -(field - 32) / 2, top: -(field - 32) / 2 }]}>
      <Svg width={field} height={field}>
        <AnimatedCircle
          cx={field / 2}
          cy={field / 2}
          fill="none"
          stroke={GOLD}
          strokeWidth={1.4}
          animatedProps={ringProps}
        />
      </Svg>
    </View>
  );
}

/* ── Laurel sprig ─────────────────────────────────────────── */
// The crown the streak halls share — an engraved laurel branch, the same
// wreath Focus and Home wear, here struck in straight GOLD on the dark
// velvet where it glows like gilt. Drawn once, mirrored by a pure flip.
const LAUREL_LEAVES: { x: number; y: number; a: number; inner?: boolean }[] = [
  { x: 21.5, y: 51, a: -34 },
  { x: 24.5, y: 45, a: -6, inner: true },
  { x: 15, y: 42.5, a: -50 },
  { x: 19, y: 34.5, a: -20, inner: true },
  { x: 11.5, y: 32.5, a: -64 },
  { x: 15.5, y: 24, a: -36, inner: true },
  { x: 10.5, y: 22.5, a: -78 },
  { x: 14, y: 14, a: -52, inner: true },
  { x: 12.5, y: 12, a: -95 },
];

function LaurelSprig({ flip = false }: { flip?: boolean }) {
  return (
    <Svg
      width={38}
      height={76}
      viewBox="0 0 30 60"
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Path
        d="M 25 57 C 13 48, 9.5 36, 11.5 25 C 13 16, 15.5 10, 17.5 4"
        fill="none"
        stroke="rgba(217,176,100,0.9)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {LAUREL_LEAVES.map((leaf, index) => (
        <Ellipse
          key={index}
          cx={leaf.x}
          cy={leaf.y}
          rx={4.8}
          ry={2}
          fill={leaf.inner ? GOLD_RAY : GOLD_LIT}
          fillOpacity={leaf.inner ? 0.5 : 0.72}
          transform={`rotate(${leaf.a} ${leaf.x} ${leaf.y})`}
        />
      ))}
    </Svg>
  );
}

/* ── Day marks ────────────────────────────────────────────── */
// Three marks, no more: the book earned, the book left empty, and the
// page still open.
function DayMark({ cell }: { cell: CellState }) {
  if (cell === 'earned') {
    return (
      <View style={[s.medal, s.medalEarned]}>
        <Image key="book-lit" source={BOOK_PNG} style={s.book} resizeMode="contain" />
      </View>
    );
  }
  if (cell === 'today') {
    return (
      <View style={s.medalWrap}>
        <TodayPulse />
        <View style={[s.medal, s.medalToday]}>
          <Image key="book-today" source={BOOK_PNG} style={[s.book, s.bookToday]} resizeMode="contain" />
        </View>
      </View>
    );
  }
  if (cell === 'empty') {
    return (
      <View style={[s.medal, s.medalEmpty]}>
        <Image key="book-ash" source={BOOK_PNG} style={[s.book, s.bookAsh]} resizeMode="contain" />
      </View>
    );
  }
  if (cell === 'untracked') {
    return <View style={s.untrackedDot} />;
  }
  return <View style={s.futureDot} />;
}

/* ── Sheet ────────────────────────────────────────────────── */
export default function JournalStreakSheet({
  visible,
  onClose,
  completedDates,
  entryDates,
  currentStreak,
  bestStreak,
}: {
  visible: boolean;
  onClose: () => void;
  // Days whose journal entry counts as complete — a book was earned.
  completedDates: string[];
  // Any day with journal activity; the earliest anchors the record, so
  // days before you ever wrote are never blamed as missed.
  entryDates: string[];
  currentStreak: number;
  bestStreak: number;
}) {
  const [monthOffset, setMonthOffset] = useState(0);
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // A ceiling, not a height: the sheet stands as tall as the hearth needs
  // and no taller, so the closing line always rests near the edge instead
  // of floating above a stretch of empty velvet.
  const sheetMaxHeight = Math.min(760, windowHeight * 0.88);

  useEffect(() => {
    void preloadBookAsset();
  }, []);

  const today = new Date();
  const todayStr = dateKeyOf(today);
  const todayKey = monthKey(today);

  const completedSet = useMemo(() => new Set(completedDates), [completedDates]);
  const booksEarned = completedSet.size;

  // The record opens on the first day you ever touched the journal.
  const firstTracked = useMemo(() => {
    const all = [...completedDates, ...entryDates].filter(Boolean).sort();
    return all.length > 0 ? all[0] : todayStr;
  }, [completedDates, entryDates, todayStr]);

  const firstRecordKey = useMemo(() => {
    const [year, month] = firstTracked.split('-').map(Number);
    return Number.isFinite(year) && Number.isFinite(month)
      ? year * 12 + (month - 1)
      : todayKey;
  }, [firstTracked, todayKey]);

  const shownKey = Math.min(todayKey, Math.max(firstRecordKey, todayKey + monthOffset));
  const shownYear = Math.floor(shownKey / 12);
  const shownMonth = shownKey % 12;
  const canGoBack = shownKey > firstRecordKey;
  const canGoForward = shownKey < todayKey;
  const onCurrentMonth = shownKey === todayKey;
  const todayColumn = (today.getDay() + 6) % 7;

  const cells = useMemo(() => {
    const firstOfMonth = new Date(shownYear, shownMonth, 1);
    const leading = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(shownYear, shownMonth + 1, 0).getDate();

    const blank = (): Cell => ({ day: 0, cell: 'blank', linkLeft: false, linkRight: false });
    const result: Cell[] = [];
    for (let i = 0; i < leading; i += 1) result.push(blank());

    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = dateKeyOf(new Date(shownYear, shownMonth, day));
      let cell: CellState;
      if (completedSet.has(key)) cell = 'earned';
      else if (key === todayStr) cell = 'today';
      else if (key > todayStr) cell = 'future';
      else if (key < firstTracked) cell = 'untracked';
      else cell = 'empty';
      result.push({ day, cell, linkLeft: false, linkRight: false });
    }

    // The chain: written days link to written neighbours within the row.
    for (let i = 0; i < result.length; i += 1) {
      if (result[i].cell !== 'earned') continue;
      result[i].linkLeft = i % 7 !== 0 && result[i - 1]?.cell === 'earned';
      result[i].linkRight = i % 7 !== 6 && result[i + 1]?.cell === 'earned';
    }
    // A live chain reaches into today when yesterday was written.
    const todayIndex = result.findIndex(entry => entry.cell === 'today');
    if (todayIndex > 0 && todayIndex % 7 !== 0 && result[todayIndex - 1]?.cell === 'earned') {
      result[todayIndex].linkLeft = true;
      result[todayIndex - 1].linkRight = true;
    }
    return result;
  }, [completedSet, firstTracked, shownMonth, shownYear, todayStr]);

  const recentEmpty = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffKey = dateKeyOf(cutoff);
    for (let cursor = new Date(cutoff); dateKeyOf(cursor) < todayStr; cursor.setDate(cursor.getDate() + 1)) {
      const key = dateKeyOf(cursor);
      if (key >= cutoffKey && key >= firstTracked && !completedSet.has(key)) return true;
    }
    return false;
  }, [completedSet, firstTracked, todayStr]);

  const close = () => {
    setMonthOffset(0);
    onClose();
  };

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={close}
      sheetStyle={[s.sheet, { maxHeight: sheetMaxHeight }]}
    >
      <LinearGradient
        colors={VELVET}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <GoldDust delay={0} style={{ right: 30, top: 74 }} />
      <GoldDust delay={1500} style={{ left: 34, top: 128 }} />
      <GoldDust delay={2700} style={{ right: 76, top: 168 }} />

      {/* Header — the hearth's own, in gold on the dark. */}
      <View style={s.handle} />
      <View style={s.headerRow}>
        <View style={s.headerCopy}>
          <Text style={s.kicker}>THE BOOK OF DAYS</Text>
          <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.84}>
            Your Journal Streak
          </Text>
        </View>
        <TouchableOpacity style={s.closeButton} onPress={close} hitSlop={10} activeOpacity={0.76}>
          <X s={18} c="rgba(243,226,188,0.72)" w={2.2} />
        </TouchableOpacity>
      </View>

      {/* Hero — the living book above its count, a shrine rather than a
          plaque. Focus crowns its number with laurels; the journal sets
          the book itself over the page. */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.scrollContent,
          // Same clearance the Home rhythm sheet keeps: a gesture bar gets a
          // hair of room under a line nobody taps, a tall button bar keeps
          // its full inset so the text never lands inside it.
          { paddingBottom: insets.bottom > 36 ? insets.bottom : Math.max(10, insets.bottom - 10) },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        contentInsetAdjustmentBehavior="never"
      >
      <Reanimated.View entering={enter(40)} style={s.hero}>
        <View style={s.laurelRow}>
          <LaurelSprig />
          <View style={s.heroCenter}>
            <CountUp value={currentStreak} delay={320} textStyle={s.heroValue} />
            <Text style={s.heroUnit}>day streak</Text>
          </View>
          <LaurelSprig flip />
        </View>
      </Reanimated.View>

      <Reanimated.View entering={enter(80)} style={s.counters}>
        <View style={s.counterCell}>
          <View style={s.counterRow}>
            <CountUp value={bestStreak} delay={460} textStyle={s.counterValue} />
            <Text style={s.counterUnit}>{bestStreak === 1 ? 'day' : 'days'}</Text>
          </View>
          <Text style={s.counterLabel}>BEST STREAK</Text>
        </View>
        <View style={s.counterSplit}>
          <View style={s.counterSplitLine} />
          <View style={s.counterSplitGem} />
          <View style={s.counterSplitLine} />
        </View>
        <View style={s.counterCell}>
          <View style={[s.counterRow, s.counterRowCenter]}>
            <CountUp value={booksEarned} delay={540} textStyle={s.counterValue} />
            <Image key="book-counter" source={BOOK_PNG} style={s.counterBook} resizeMode="contain" />
          </View>
          <Text style={s.counterLabel}>BOOKS COLLECTED</Text>
        </View>
      </Reanimated.View>

      <Reanimated.View entering={enter(110)} style={s.monthRow}>
        <TouchableOpacity
          onPress={() => canGoBack && setMonthOffset(value => value - 1)}
          activeOpacity={0.7}
          disabled={!canGoBack}
          style={[s.monthBtn, !canGoBack && s.monthBtnOff]}
        >
          <ChevronLeft s={18} c={CREAM} />
        </TouchableOpacity>
        <Text style={s.monthTitle}>{MONTH_NAMES[shownMonth]} {shownYear}</Text>
        <TouchableOpacity
          onPress={() => canGoForward && setMonthOffset(value => value + 1)}
          activeOpacity={0.7}
          disabled={!canGoForward}
          style={[s.monthBtn, !canGoForward && s.monthBtnOff]}
        >
          <ChevronRight s={18} c={CREAM} />
        </TouchableOpacity>
      </Reanimated.View>

      <Reanimated.View entering={enter(140)} style={s.weekHeader}>
        {DAY_LABELS.map((label, index) => (
          <Text
            key={label}
            style={[s.weekLetter, onCurrentMonth && index === todayColumn && s.weekLetterToday]}
          >
            {label}
          </Text>
        ))}
      </Reanimated.View>

      {/* Reveal the fully prepared month as one surface so switching months
          never exposes per-day drawing. Written days still share a chain. */}
      <Reanimated.View
        key={shownKey}
        entering={FadeIn.duration(140)}
        style={s.grid}
      >
        {cells.map((entry, index) => {
          if (entry.cell === 'blank') return <View key={index} style={s.cell} />;
          return (
            <View key={index} style={s.cell}>
              {entry.linkLeft && (
                <View style={[s.chain, s.chainLeft]} />
              )}
              {entry.linkRight && (
                <View style={[s.chain, s.chainRight]} />
              )}
              <View style={s.cellInner}>
                <View style={s.markWrap}>
                  <DayMark cell={entry.cell} />
                </View>
                <Text
                  style={[
                    s.cellDay,
                    entry.cell === 'earned' && s.cellDayEarned,
                    entry.cell === 'today' && s.cellDayToday,
                  ]}
                  allowFontScaling={false}
                >
                  {entry.day}
                </Text>
              </View>
            </View>
          );
        })}
      </Reanimated.View>

      <Reanimated.View entering={enter(420)} style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.legendMedal, s.medalEarned]}>
            <Image key="legend-lit" source={BOOK_PNG} style={s.legendBook} resizeMode="contain" />
          </View>
          <Text style={s.legendText}>written</Text>
        </View>
        <View style={s.legendGem} />
        <View style={s.legendItem}>
          <View style={[s.legendMedal, s.medalEmpty]}>
            <Image key="legend-ash" source={BOOK_PNG} style={[s.legendBook, s.bookAsh]} resizeMode="contain" />
          </View>
          <Text style={s.legendText}>unwritten</Text>
        </View>
      </Reanimated.View>

      <Reanimated.View entering={enter(470)}>
        <View style={s.mercyRail}>
          <View style={s.mercyLine} />
          <View style={s.mercyGem} />
          <View style={s.mercyLine} />
        </View>
        <Text style={s.mercy}>{recentEmpty ? MERCY_LINE : STEADY_LINE}</Text>
      </Reanimated.View>
      </ScrollView>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#211C12',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: RAIL,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  // Hugs its content, and only shrinks into a scroll once the sheet has
  // hit its ceiling.
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { paddingBottom: 22 },
  dustWrap: { position: 'absolute' },
  dust: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: GOLD_RAY },

  /* Header */
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(243,226,188,0.22)',
    marginTop: 10,
  },
  headerRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  kicker: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2.2,
    color: EYEBROW,
  },
  title: {
    marginTop: 3,
    fontFamily: F.serifMedium,
    fontSize: 25,
    lineHeight: 29,
    color: CREAM,
  },
  closeButton: {
    flexShrink: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(243,226,188,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Hero — the streak crowned between two gold laurels, open on the dark. */
  hero: { marginTop: 8, alignItems: 'center' },
  laurelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroCenter: { alignItems: 'center', minWidth: 118 },
  // Crowned like the Focus hall: a tall line box seats the glyph low, the
  // caption pulled up hard beneath so the laurels hug the number.
  heroValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 66,
    lineHeight: 78,
    letterSpacing: -2,
    color: CREAM,
    textAlign: 'center',
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  heroUnit: {
    marginTop: -14,
    fontFamily: F.serifMediumItalic,
    fontSize: 16,
    lineHeight: 21,
    color: 'rgba(243,226,188,0.6)',
  },

  /* Counters */
  counters: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: 2,
  },
  counterCell: { flex: 1, alignItems: 'center', gap: 1 },
  counterRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  counterRowCenter: { alignItems: 'center', gap: 6 },
  counterValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 27,
    lineHeight: 32,
    color: CREAM,
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  counterUnit: {
    fontFamily: F.serif,
    fontSize: 14,
    color: 'rgba(243,226,188,0.6)',
  },
  counterBook: { width: 23, height: 23 },
  counterLabel: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    lineHeight: 13,
    letterSpacing: 1.7,
    color: EYEBROW,
  },
  counterSplit: { alignItems: 'center', gap: 4 },
  counterSplitLine: { width: 1, height: 14, borderRadius: 1, backgroundColor: 'rgba(197,160,89,0.3)' },
  counterSplitGem: {
    width: 5,
    height: 5,
    borderRadius: 0.5,
    backgroundColor: 'rgba(212,176,106,0.6)',
    transform: [{ rotate: '45deg' }],
  },

  /* Month navigation */
  monthRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(243,226,188,0.18)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnOff: { opacity: 0.28 },
  monthTitle: { fontFamily: F.serifMedium, fontSize: 19, color: CREAM },

  /* Week header */
  weekHeader: { marginTop: 10, width: '100%', flexDirection: 'row' },
  weekLetter: {
    width: `${100 / 7}%`,
    flexGrow: 0,
    flexShrink: 0,
    textAlign: 'center',
    fontFamily: F.sansBold,
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 0.55,
    color: 'rgba(255,255,255,0.34)',
  },
  weekLetterToday: { color: EYEBROW },

  /* Grid */
  grid: { marginTop: 5, flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, position: 'relative', alignItems: 'center', paddingVertical: 2 },
  cellInner: { alignItems: 'center' },
  markWrap: { height: 34, width: 34, alignItems: 'center', justifyContent: 'center' },
  // The chain of light between written days.
  chain: {
    position: 'absolute',
    top: 2 + 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(212,176,106,0.55)',
  },
  chainLeft: { left: 0, right: '50%' },
  chainRight: { left: '50%', right: 0 },

  /* Day marks */
  medalWrap: { alignItems: 'center', justifyContent: 'center' },
  medal: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalEarned: {
    borderColor: GOLD_LIT,
    backgroundColor: 'rgba(197,160,89,0.2)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 3,
  },
  medalEmpty: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  medalToday: {
    borderColor: GOLD_LIT,
    backgroundColor: 'rgba(255,244,214,0.08)',
  },
  book: { width: 20, height: 20 },
  bookAsh: { tintColor: ASH_BOOK, opacity: 0.55 },
  // Today's book is a ghost of the one you can still earn.
  bookToday: { tintColor: '#D9C79A', opacity: 0.4 },
  todayPulse: { position: 'absolute' },
  untrackedDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  futureDot: { width: 4.5, height: 4.5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.08)' },
  cellDay: {
    marginTop: 1,
    fontFamily: F.sansMedium,
    fontSize: 9.5,
    lineHeight: 12,
    color: 'rgba(255,255,255,0.32)',
    fontVariant: ['tabular-nums'],
  },
  cellDayEarned: { color: EYEBROW },
  cellDayToday: { fontFamily: F.sansBold, color: CREAM },

  /* Legend */
  legend: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendMedal: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendBook: { width: 13, height: 13 },
  legendText: { fontFamily: F.sans, fontSize: 11.5, color: 'rgba(243,226,188,0.62)' },
  legendGem: {
    width: 3.5,
    height: 3.5,
    borderRadius: 0.5,
    backgroundColor: 'rgba(197,160,89,0.45)',
    transform: [{ rotate: '45deg' }],
  },

  /* Mercy */
  mercyRail: {
    marginTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  mercyLine: { width: 26, height: 1, borderRadius: 1, backgroundColor: 'rgba(197,160,89,0.3)' },
  mercyGem: {
    width: 4,
    height: 4,
    borderRadius: 0.5,
    backgroundColor: 'rgba(212,176,106,0.55)',
    transform: [{ rotate: '45deg' }],
  },
  mercy: {
    marginTop: 9,
    paddingHorizontal: 12,
    fontFamily: F.serifItalic,
    fontSize: 13.5,
    lineHeight: 18.5,
    color: 'rgba(243,226,188,0.58)',
    textAlign: 'center',
  },
});
