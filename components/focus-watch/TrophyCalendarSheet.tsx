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
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import FocusSheetHeader from './FocusSheetHeader';
import { ChevronLeft, ChevronRight, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { StaticChallengeTrophy } from '@/components/challenges/ChallengeTrophy';
import { RadiantTrophy, TrophyShineBackdrop } from './TrophyRadiance';
import { C, F } from '@/constants/tokens';
import { dateKey, useDayPlan, type DayRecord } from './dayPlanStore';

// The streak sheet is the app's trophy hall, and it is built to travel:
// the same composition will later stand behind the Journal and Home
// streaks. Three moves carry it —
//   1. the hero is the trophy CARD's own dawn surface (gradient, weave,
//      sparkles, radiant emblem), so tapping the card opens more of the
//      same world rather than a plain white report;
//   2. the calendar reads as treasure, not bookkeeping: struck gold
//      coins nearly fill their cells, and consecutive kept days fuse
//      into one golden band — the streak itself made visible;
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
  // Consecutive kept days fuse: each kept cell knows whether the golden
  // band continues into its neighbours within the week row.
  linkLeft: boolean;
  linkRight: boolean;
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

    const result: Cell[] = [];
    for (let i = 0; i < leading; i++) {
      result.push({ day: 0, cell: 'blank', linkLeft: false, linkRight: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const key = dateKey(new Date(shownYear, shownMonth, day));
      const record: DayRecord | undefined = state.days[key];
      let cell: CellState;
      if (key === todayStr) cell = 'today';
      else if (key > todayStr) cell = 'future';
      else if (!record || record.status === 'off' || record.status === 'pending') cell = 'off';
      else cell = record.status === 'kept' ? 'kept' : 'broken';
      result.push({ day, cell, linkLeft: false, linkRight: false });
    }
    // Fuse consecutive kept days into bands, within each week row.
    for (let i = 0; i < result.length; i++) {
      if (result[i].cell !== 'kept') continue;
      result[i].linkLeft = i % 7 !== 0 && result[i - 1]?.cell === 'kept';
      result[i].linkRight = i % 7 !== 6 && result[i + 1]?.cell === 'kept';
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

      {/* Hero — the trophy card's own dawn surface, carried into the
          sheet: current streak counted up beside the radiant emblem, best
          and total on an engraved rail beneath. */}
      <Animated.View entering={enter(40)} style={s.hero}>
        <LinearGradient
          colors={['#F8E7BE', '#FFF8E9', '#FFFEFA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <TrophyShineBackdrop />
        <View style={s.heroTop}>
          <View style={s.heroCopy}>
            <Text style={s.heroKicker}>CURRENT STREAK</Text>
            <View style={s.heroValueRow}>
              <CountUp value={state.streak.current} delay={340} textStyle={s.heroValue} />
              <Text style={s.heroUnit}>{state.streak.current === 1 ? 'day' : 'days'}</Text>
            </View>
            <View style={s.heroRule} />
          </View>
          <RadiantTrophy size={72} halo />
        </View>
        <View style={s.heroRail}>
          <View style={s.railCell}>
            <Text style={s.railLabel}>BEST</Text>
            <View style={s.railValueRow}>
              <CountUp value={state.streak.best} delay={480} textStyle={s.railValue} />
              <Text style={s.railUnit}>{state.streak.best === 1 ? 'day' : 'days'}</Text>
            </View>
          </View>
          <View style={s.railDiamond} />
          <View style={s.railCell}>
            <Text style={s.railLabel}>TROPHIES</Text>
            <View style={s.railValueRow}>
              <StaticChallengeTrophy size={15} />
              <CountUp value={state.streak.trophies} delay={560} textStyle={s.railValue} />
              <Text style={s.railUnit}>earned</Text>
            </View>
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
                  style={[s.band, s.bandLeft]}
                />
              )}
              {entry.linkRight && (
                <Reanimated.View
                  entering={FadeIn.duration(220).delay(140 + (row + col) * 26)}
                  style={[s.band, s.bandRight]}
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

  /* Hero plaque */
  hero: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: 16,
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E8D8B5',
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 6,
    paddingRight: 12,
  },
  heroCopy: {
    flexShrink: 1,
    paddingRight: 10,
  },
  heroKicker: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 1.6,
    color: 'rgba(121,89,30,0.72)',
  },
  heroValueRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  heroValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1,
    color: '#4A3820',
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  heroUnit: {
    fontFamily: F.serif,
    fontSize: 14,
    color: '#8B6B2F',
    paddingBottom: 5,
  },
  heroRule: {
    marginTop: 6,
    width: 44,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(169,134,63,0.45)',
  },
  heroRail: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EADFC8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  railCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  railLabel: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 1.6,
    color: 'rgba(121,89,30,0.66)',
  },
  railValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  railValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 19,
    lineHeight: 23,
    color: '#4A3820',
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  railUnit: {
    fontFamily: F.sans,
    fontSize: 11,
    color: '#8B6B2F',
  },
  railDiamond: {
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
