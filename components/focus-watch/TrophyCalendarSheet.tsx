import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

const Animated = Reanimated;
import Svg, { Ellipse, Path } from 'react-native-svg';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import FocusSheetHeader from './FocusSheetHeader';
import { ChevronLeft, ChevronRight, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { StaticChallengeTrophy } from '@/components/challenges/ChallengeTrophy';
import { C, F } from '@/constants/tokens';
import { dateKey, useDayPlan, type DayRecord } from './dayPlanStore';

// The streak sheet is the app's trophy hall, and it is built to travel:
// the same composition will later stand behind the Journal and Home
// streaks. Three moves carry it —
//   1. the hero is the hall's OWN emblem, not a copy of the card that
//      opened it: the current streak held between two engraved laurel
//      sprigs, open on the page — no plaque, no repeated dawn surface —
//      with best and trophies as full-size counters beneath;
//   2. the calendar reads as treasure, not bookkeeping: struck gold
//      coins nearly fill their cells, and consecutive kept days fuse
//      into one golden band. Rest days do not break the merciful streak,
//      so the band BRIDGES them — a paler run under the resting ring —
//      and reaches today with a soft tail when yesterday was kept;
//   3. everything arrives: numbers count up from zero, the month pours
//      in as a diagonal wave of coins.

const enter = (delay: number) => FadeInDown.duration(360).delay(delay);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Verified habit-formation copy only — no invented numbers (blueprint §2).
const MERCY_LINE =
  'One missed day does not undo what you are building — returning is what builds it.';
const STEADY_LINE = 'Never miss twice: one miss is an accident, not a new habit.';

function monthKey(date: Date) {
  return date.getFullYear() * 12 + date.getMonth();
}

type CellState = 'kept' | 'broken' | 'off' | 'today' | 'future' | 'blank';

type Cell = {
  day: number;
  cell: CellState;
  // Consecutive run days fuse: each cell knows whether the golden band
  // continues into its neighbours within the week row, and whether that
  // half-segment is full gold (kept↔kept) or the paler bridge tone
  // (carried across a rest day, or reaching into today).
  linkLeft: boolean;
  linkRight: boolean;
  softLeft: boolean;
  softRight: boolean;
  bridge: boolean;
};

/* ── Count-up ─────────────────────────────────────────────── */
// A number that arrives — rolling up from zero on the UI thread via an
// uneditable TextInput, the standard Reanimated ReText move. Reduced
// motion (or zero) renders a plain Text.
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

/* ── Laurel sprig ─────────────────────────────────────────── */
// The hall's own emblem: an engraved laurel branch — hairline stem, leaf
// pairs set along it like a struck medal's wreath. Drawn once, mirrored
// for the right side (a pure flip keeps the vector crisp).
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
      width={30}
      height={60}
      viewBox="0 0 30 60"
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Path
        d="M 25 57 C 13 48, 9.5 36, 11.5 25 C 13 16, 15.5 10, 17.5 4"
        fill="none"
        stroke="rgba(197,160,89,0.8)"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {LAUREL_LEAVES.map((leaf, index) => (
        <Ellipse
          key={index}
          cx={leaf.x}
          cy={leaf.y}
          rx={4.7}
          ry={1.95}
          fill={leaf.inner ? 'rgba(197,160,89,0.34)' : 'rgba(197,160,89,0.52)'}
          transform={`rotate(${leaf.a} ${leaf.x} ${leaf.y})`}
        />
      ))}
    </Svg>
  );
}

/* ── Today ring ───────────────────────────────────────────── */
// The one live pulse in the grid — an outer ring breathing around today,
// opacity only.
function TodayPulse() {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0.5;
      return;
    }
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  const pulse = useAnimatedStyle(() => ({ opacity: 0.18 + t.value * 0.5 }));

  return <Reanimated.View pointerEvents="none" style={[s.todayPulse, pulse]} />;
}

/* ── Day marks ────────────────────────────────────────────── */
// Struck-coin grammar, straight from the week bands of Home and Focus,
// grown to nearly fill the cell.
function DayMark({ cell }: { cell: CellState }) {
  if (cell === 'kept') {
    return (
      <View style={s.keptCoin}>
        <LinearGradient
          colors={['#FFF7DE', '#F7E0A8']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <StaticChallengeTrophy size={24} />
        <View style={s.coinSheen} pointerEvents="none" />
      </View>
    );
  }
  if (cell === 'broken') {
    return (
      <View style={s.brokenCoin}>
        <X s={15} c="#B45360" w={2.6} />
      </View>
    );
  }
  if (cell === 'today') {
    return (
      <View style={s.todayCoin}>
        <TodayPulse />
        <View style={s.todayGhost}>
          <StaticChallengeTrophy size={22} />
        </View>
      </View>
    );
  }
  if (cell === 'off') {
    return (
      <View style={s.restRing}>
        <View style={s.restStud} />
      </View>
    );
  }
  return <View style={s.futureDot} />;
}

/* ── Sheet ────────────────────────────────────────────────── */
export default function TrophyCalendarSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const state = useDayPlan();
  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date();
  const todayKey = monthKey(today);
  const firstRecordKey = useMemo(() => {
    const dates = Object.keys(state.days).sort();
    if (dates.length === 0) return todayKey;
    const [year, month] = dates[0].split('-').map(Number);
    return year * 12 + (month - 1);
  }, [state.days, todayKey]);

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
    const todayStr = dateKey(today);

    const blank = (): Cell => ({
      day: 0, cell: 'blank',
      linkLeft: false, linkRight: false, softLeft: false, softRight: false, bridge: false,
    });
    const result: Cell[] = [];
    for (let i = 0; i < leading; i++) result.push(blank());
    for (let day = 1; day <= daysInMonth; day++) {
      const key = dateKey(new Date(shownYear, shownMonth, day));
      const record: DayRecord | undefined = state.days[key];
      let cell: CellState;
      if (key === todayStr) cell = 'today';
      else if (key > todayStr) cell = 'future';
      else if (!record || record.status === 'off' || record.status === 'pending') cell = 'off';
      else cell = record.status === 'kept' ? 'kept' : 'broken';
      result.push({
        day, cell,
        linkLeft: false, linkRight: false, softLeft: false, softRight: false, bridge: false,
      });
    }

    // The merciful streak survives rest days, so the band must too: any
    // stretch of rest days with a kept day on BOTH sides becomes a bridge.
    for (let i = 0; i < result.length; i++) {
      if (result[i].cell !== 'off') continue;
      let prev = i - 1;
      while (prev >= 0 && result[prev].cell === 'off') prev--;
      let next = i + 1;
      while (next < result.length && result[next].cell === 'off') next++;
      if (result[prev]?.cell === 'kept' && result[next]?.cell === 'kept') {
        result[i].bridge = true;
      }
    }

    // Fuse run members into bands; drawing stays within the week row.
    const inRun = (entry?: Cell) => !!entry && (entry.cell === 'kept' || entry.bridge);
    for (let i = 0; i < result.length; i++) {
      if (!inRun(result[i])) continue;
      result[i].linkLeft = i % 7 !== 0 && inRun(result[i - 1]);
      result[i].linkRight = i % 7 !== 6 && inRun(result[i + 1]);
    }
    // A half-segment is soft when either side of the seam is a bridge.
    for (let i = 0; i < result.length; i++) {
      if (result[i].linkLeft) {
        result[i].softLeft = result[i].bridge || result[i - 1]?.bridge === true;
      }
      if (result[i].linkRight) {
        result[i].softRight = result[i].bridge || result[i + 1]?.bridge === true;
      }
    }
    // The streak is alive: when yesterday is part of the run, a soft tail
    // reaches into today's ring.
    const todayIndex = result.findIndex(entry => entry.cell === 'today');
    if (todayIndex > 0 && todayIndex % 7 !== 0 && inRun(result[todayIndex - 1])) {
      result[todayIndex].linkLeft = true;
      result[todayIndex].softLeft = true;
      result[todayIndex - 1].linkRight = true;
      result[todayIndex - 1].softRight = true;
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.days, shownYear, shownMonth, visible]);

  const recentBroken = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffKey = dateKey(cutoff);
    return Object.values(state.days).some(
      record => record.status === 'broken' && record.date >= cutoffKey
    );
  }, [state.days]);

  const close = () => {
    setMonthOffset(0);
    onClose();
  };

  return (
    <SmoothBottomSheet visible={visible} onClose={close} sheetStyle={s.sheet}>
      <FocusSheetHeader
        kicker="FOCUS TROPHIES"
        title="Your Trophy Streak"
        onClose={close}
      />

      {/* Hero — the hall's own emblem, open on the page: the current
          streak crowned between two engraved laurel sprigs, best and
          trophies as full-size counters beneath. */}
      <Animated.View entering={enter(40)} style={s.hero}>
        <View style={s.laurelRow}>
          <LaurelSprig />
          <View style={s.heroCenter}>
            <CountUp value={state.streak.current} delay={320} textStyle={s.heroValue} />
            <Text style={s.heroUnit}>day streak</Text>
          </View>
          <LaurelSprig flip />
        </View>

        <View style={s.subStats}>
          <View style={s.subCell}>
            <View style={s.subValueRow}>
              <CountUp value={state.streak.best} delay={460} textStyle={s.subValue} />
              <Text style={s.subUnit}>{state.streak.best === 1 ? 'day' : 'days'}</Text>
            </View>
            <Text style={s.subLabel}>BEST STREAK</Text>
          </View>
          <View style={s.subSeparator}>
            <View style={s.subSeparatorLine} />
            <View style={s.subSeparatorDiamond} />
            <View style={s.subSeparatorLine} />
          </View>
          <View style={s.subCell}>
            <View style={s.subValueRow}>
              <StaticChallengeTrophy size={20} />
              <CountUp value={state.streak.trophies} delay={540} textStyle={s.subValue} />
            </View>
            <Text style={s.subLabel}>TROPHIES EARNED</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={enter(90)} style={s.monthRow}>
        <TouchableOpacity
          onPress={() => canGoBack && setMonthOffset(value => value - 1)}
          activeOpacity={0.7}
          disabled={!canGoBack}
          style={[s.monthBtn, !canGoBack && { opacity: 0.3 }]}
        >
          <ChevronLeft s={18} c={C.textSecondary} />
        </TouchableOpacity>
        <Text style={s.monthTitle}>
          {MONTH_NAMES[shownMonth]} {shownYear}
        </Text>
        <TouchableOpacity
          onPress={() => canGoForward && setMonthOffset(value => value + 1)}
          activeOpacity={0.7}
          disabled={!canGoForward}
          style={[s.monthBtn, !canGoForward && { opacity: 0.3 }]}
        >
          <ChevronRight s={18} c={C.textSecondary} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={enter(110)} style={s.weekHeader}>
        {DAY_LETTERS.map((letter, index) => (
          <Text
            key={index}
            style={[
              s.weekHeaderText,
              onCurrentMonth && index === todayColumn && s.weekHeaderToday,
            ]}
          >
            {letter}
          </Text>
        ))}
      </Animated.View>

      {/* The month pours in as a diagonal wave of coins; switching months
          replays it. Consecutive kept days share one golden band. */}
      <View style={s.grid} key={shownKey}>
        {cells.map((entry, index) => {
          if (entry.cell === 'blank') {
            return <View key={index} style={s.cell} />;
          }
          const row = Math.floor(index / 7);
          const col = index % 7;
          return (
            <View key={index} style={s.cell}>
              {entry.linkLeft && (
                <Reanimated.View
                  entering={FadeIn.duration(220).delay(140 + (row + col) * 26)}
                  style={[s.band, s.bandLeft, entry.softLeft && s.bandSoft]}
                />
              )}
              {entry.linkRight && (
                <Reanimated.View
                  entering={FadeIn.duration(220).delay(140 + (row + col) * 26)}
                  style={[s.band, s.bandRight, entry.softRight && s.bandSoft]}
                />
              )}
              <Reanimated.View
                entering={FadeInDown.duration(240).delay(150 + (row + col) * 26)}
                style={s.cellInner}
              >
                <View style={s.markWrap}>
                  <DayMark cell={entry.cell} />
                </View>
                <Text
                  style={[s.cellDay, entry.cell === 'today' && s.cellDayToday]}
                  allowFontScaling={false}
                >
                  {entry.day}
                </Text>
              </Reanimated.View>
            </View>
          );
        })}
      </View>

      <Animated.View entering={enter(420)} style={s.legendRow}>
        <View style={s.legendItem}>
          <View style={s.legendCoin}>
            <LinearGradient
              colors={['#FFF7DE', '#F7E0A8']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <StaticChallengeTrophy size={13} />
          </View>
          <Text style={s.legendText}>kept</Text>
        </View>
        <View style={s.legendDiamond} />
        <View style={s.legendItem}>
          <View style={s.legendBroken}>
            <X s={10} c="#B45360" w={2.5} />
          </View>
          <Text style={s.legendText}>broken</Text>
        </View>
        <View style={s.legendDiamond} />
        <View style={s.legendItem}>
          <View style={s.legendRest}>
            <View style={s.restStud} />
          </View>
          <Text style={s.legendText}>rest day</Text>
        </View>
      </Animated.View>

      <Animated.View entering={enter(470)}>
        <View style={s.mercyRail}>
          <View style={s.mercyLine} />
          <View style={s.mercyDiamond} />
          <View style={s.mercyLine} />
        </View>
        <Text style={s.encouragement}>{recentBroken ? MERCY_LINE : STEADY_LINE}</Text>
      </Animated.View>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },

  /* Hero — laurel emblem, open on the page */
  hero: {
    marginTop: 10,
    alignItems: 'center',
  },
  laurelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  heroCenter: {
    alignItems: 'center',
    minWidth: 96,
  },
  heroValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 52,
    lineHeight: 58,
    letterSpacing: -1.5,
    color: '#4A3820',
    textAlign: 'center',
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  heroUnit: {
    marginTop: 1,
    fontFamily: F.serifItalic,
    fontSize: 14.5,
    lineHeight: 18,
    color: '#8B6B2F',
  },
  subStats: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: 8,
  },
  subCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  subValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  subValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 26,
    lineHeight: 31,
    color: '#4A3820',
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  subUnit: {
    fontFamily: F.serif,
    fontSize: 13,
    color: '#8B6B2F',
  },
  subLabel: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 1.5,
    color: 'rgba(121,89,30,0.7)',
  },
  subSeparator: {
    alignItems: 'center',
    gap: 4,
  },
  subSeparatorLine: {
    width: 1,
    height: 12,
    borderRadius: 1,
    backgroundColor: 'rgba(197,160,89,0.35)',
  },
  subSeparatorDiamond: {
    width: 4.5,
    height: 4.5,
    borderRadius: 0.5,
    backgroundColor: 'rgba(197,160,89,0.5)',
    transform: [{ rotate: '45deg' }],
  },

  /* Month navigation */
  monthRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontFamily: F.serifMedium,
    fontSize: 19,
    color: C.text,
  },

  /* Week header */
  weekHeader: {
    marginTop: 12,
    flexDirection: 'row',
  },
  weekHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: F.sansBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    color: C.textMuted,
  },
  weekHeaderToday: {
    color: C.goldDark,
  },

  /* Grid */
  grid: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    position: 'relative',
    alignItems: 'center',
    paddingVertical: 3,
  },
  cellInner: {
    alignItems: 'center',
  },
  markWrap: {
    height: 38,
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The golden band fusing consecutive kept days — drawn per cell as two
  // half segments so neighbours meet seamlessly at the cell border.
  band: {
    position: 'absolute',
    top: 3 + 4,
    height: 30,
    backgroundColor: 'rgba(247,226,171,0.55)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
  },
  bandLeft: { left: 0, right: '50%' },
  bandRight: { left: '50%', right: 0 },
  // The bridge tone: the run carried across a rest day, or reaching
  // into today.
  bandSoft: {
    backgroundColor: 'rgba(247,226,171,0.28)',
    borderColor: 'rgba(197,160,89,0.16)',
  },

  /* Day marks */
  keptCoin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#D2A755',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.32,
    shadowRadius: 4,
    elevation: 2,
  },
  coinSheen: {
    position: 'absolute',
    top: 4.5,
    left: 7,
    width: 10,
    height: 3.5,
    borderRadius: 4,
    backgroundColor: 'rgba(255,253,246,0.85)',
    transform: [{ rotate: '-18deg' }],
  },
  brokenCoin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FBEDEF',
    borderWidth: 1,
    borderColor: '#EBC7CD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCoin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.gold,
    backgroundColor: '#FFFBEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPulse: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: C.gold,
  },
  todayGhost: {
    opacity: 0.34,
  },
  restRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#DDD8CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restStud: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D3CEC1',
  },
  futureDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: '#EAE8E2',
  },
  cellDay: {
    marginTop: 1,
    fontFamily: F.sansMedium,
    fontSize: 9.5,
    lineHeight: 12,
    color: C.textMuted,
    fontVariant: ['tabular-nums'],
  },
  cellDayToday: {
    fontFamily: F.sansBold,
    color: C.goldDark,
  },

  /* Legend */
  legendRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendCoin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D2A755',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  legendBroken: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FBEDEF',
    borderWidth: 1,
    borderColor: '#EBC7CD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRest: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    borderWidth: 1.4,
    borderStyle: 'dashed',
    borderColor: '#DDD8CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendText: {
    fontFamily: F.sans,
    fontSize: 11.5,
    color: C.textSecondary,
  },
  legendDiamond: {
    width: 3.5,
    height: 3.5,
    borderRadius: 0.5,
    backgroundColor: 'rgba(197,160,89,0.4)',
    transform: [{ rotate: '45deg' }],
  },

  /* Encouragement */
  mercyRail: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  mercyLine: {
    width: 26,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(197,160,89,0.35)',
  },
  mercyDiamond: {
    width: 4,
    height: 4,
    borderRadius: 0.5,
    backgroundColor: 'rgba(197,160,89,0.5)',
    transform: [{ rotate: '45deg' }],
  },
  encouragement: {
    marginTop: 9,
    paddingHorizontal: 14,
    fontFamily: F.serifItalic,
    fontSize: 13.5,
    lineHeight: 18.5,
    color: C.textSecondary,
    textAlign: 'center',
  },
});
