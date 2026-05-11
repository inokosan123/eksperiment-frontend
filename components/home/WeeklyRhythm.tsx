import { useEffect, useMemo, useState } from 'react';
import { Image, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Activity, ArrowUpRight } from '@/components/icons/Icons';
import FocusLottie from '@/components/focus/FocusLottie';
import { C, F } from '@/constants/tokens';
import { useTasks } from '@/components/tasks/TaskProvider';
import { listTaskInstancesBetween } from '@/components/tasks/taskDb';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';

const AnimatedLinearGradient = Reanimated.createAnimatedComponent(LinearGradient);

const FLAME_PNG = require('@/assets/images/streak-flame-512.png');

const TILE_SIZE = 32;
const ICON_SIZE = 20;
const CANDLE_W = 22;
const CANDLE_H = 56;
// Indexed by Date.getDay() — Sun=0, Mon=1, ..., Sat=6
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type DayMode = 'no-tasks' | 'all-skipped' | 'normal';

type DayStat = {
  letter: string;
  dateKey: string;
  isToday: boolean;
  isFuture: boolean;
  pct: number | null; // null = no tasks or future day
  mode: DayMode;
};

function formatLocalDateKey(date: Date) {
  return getLocalDateKey(date);
}

function buildWeek(): { dateKey: string; letter: string; isToday: boolean; isFuture: boolean }[] {
  const today = new Date();
  const todayKey = formatLocalDateKey(today);
  // Rolling 7-day window ending today: index 0 = 6 days ago, index 6 = today.
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = formatLocalDateKey(d);
    return {
      dateKey: key,
      letter: DAY_LETTERS[d.getDay()],
      isToday: key === todayKey,
      isFuture: false,
    };
  });
}

/* ── Candle ───────────────────────────────────────────────── */
function Candle({ pct, mode }: { pct: number | null; mode: DayMode }) {
  // No-tasks day OR all-skipped day → no candle at all (empty space)
  if (pct === null || mode === 'no-tasks' || mode === 'all-skipped') {
    return <View style={[s.candleCol, { height: CANDLE_H + 22 }]} />;
  }

  const filled = Math.max(0, Math.min(100, pct));
  const isEmpty = filled === 0;
  const isFull = filled >= 100;

  return (
    <View style={s.candleCol}>
      {/* Top slot — flame at 100%, otherwise tapered cotton wick with
          ember tip while there is progress. */}
      <View style={s.candleFlameSlot}>
        {isFull ? (
          <Image source={FLAME_PNG} style={s.candleFlameImg} />
        ) : (
          <>
            <View style={s.candleWickWrap} pointerEvents="none">
              <View style={s.candleWickTip} />
              <View style={s.candleWickBase} />
            </View>
            {!isEmpty && <View style={s.candleEmber} pointerEvents="none" />}
          </>
        )}
      </View>

      {/* Body */}
      <View style={[s.candleBody, isEmpty && s.candleBodyDimmed]}>
        {filled > 0 && (
          <View style={[s.candleFill, { height: `${filled}%` }]}>
            {filled < 100 && <View style={s.candleFillTopLine} pointerEvents="none" />}
          </View>
        )}
        <View style={s.candleSideHighlight} pointerEvents="none" />
        <View style={[s.candleRim, isEmpty && s.candleRimDimmed]} pointerEvents="none" />
        <View style={[s.candleBase, isEmpty && s.candleBaseDimmed]} pointerEvents="none" />
      </View>
    </View>
  );
}

/* ── Bottom badge ─────────────────────────────────────────── */
function FlameTile({ pct, mode }: { pct: number | null; mode: DayMode }) {
  // No tasks OR all-skipped → empty circle (no flame icon inside)
  if (pct === null || mode === 'no-tasks' || mode === 'all-skipped') {
    return (
      <View style={s.flameWrap}>
        <View style={[s.flameTile, s.flameEmpty]} />
      </View>
    );
  }

  const filled = Math.max(0, Math.min(100, pct));
  const isFull = filled >= 100;

  if (isFull) {
    return (
      <View style={s.flameWrap}>
        <View style={[s.flameTile, s.flameColored, s.flameGlow]}>
          <FocusLottie name="flame" loop style={s.flameLottie} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.flameWrap}>
      <View style={[s.flameTile, s.flameGray]}>
        <Image source={FLAME_PNG} style={[s.flameImg, { tintColor: '#C9C4B7' }]} />
      </View>
      {filled > 0 && (
        <View style={[s.flameClip, { height: `${filled}%` }]} pointerEvents="none">
          <View style={[s.flameTile, s.flameColored, s.flameColoredAbs]}>
            <Image source={FLAME_PNG} style={s.flameImg} />
          </View>
        </View>
      )}
    </View>
  );
}

/* ── Today bar ────────────────────────────────────────────── */
function DailyProgressBar({ pct, mode }: { pct: number; mode: DayMode }) {
  // Black-fill states: "all-skipped" or "no-tasks" — bar is fully black, no % text.
  const isBlackFull = mode === 'all-skipped' || mode === 'no-tasks';
  const target = isBlackFull ? 100 : Math.max(0, Math.min(100, pct));
  const anim = useSharedValue(target);
  useEffect(() => {
    anim.value = withTiming(target, { duration: 600 });
  }, [anim, target]);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(100, anim.value))}%`,
  }));
  return (
    <View style={s.barRow}>
      <View style={s.barTrack}>
        {isBlackFull ? (
          <Reanimated.View style={[s.barFill, s.barFillBlack, fillStyle]} />
        ) : (
          <AnimatedLinearGradient
            colors={['#E0B770', C.gold]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[s.barFill, fillStyle]}
          />
        )}
      </View>
      {!isBlackFull && (
        <Text style={s.barPct}>{Math.round(target)}%</Text>
      )}
    </View>
  );
}

/* ── Main ─────────────────────────────────────────────────── */
export default function WeeklyRhythm() {
  const router = useRouter();
  const { instances } = useTasks();
  const [weekStats, setWeekStats] = useState<DayStat[]>([]);

  const week = useMemo(() => buildWeek(), []);

  // Reload weekly stats whenever today's instances change (proxy for data updates).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fromKey = week[0].dateKey;
      const toKey = week[6].dateKey;
      const all = await listTaskInstancesBetween(fromKey, toKey);

      const stats: DayStat[] = week.map(day => {
        if (day.isFuture) {
          return {
            letter: day.letter, dateKey: day.dateKey,
            isToday: day.isToday, isFuture: true,
            pct: null, mode: 'no-tasks',
          };
        }
        const dayInstances = all.filter(inst => inst.date === day.dateKey);
        const scheduled = dayInstances.filter(inst => inst.status !== 'not_applicable').length;
        if (scheduled === 0) {
          return {
            letter: day.letter, dateKey: day.dateKey,
            isToday: day.isToday, isFuture: false,
            pct: null, mode: 'no-tasks',
          };
        }
        const completed = dayInstances.filter(inst => inst.status === 'completed').length;
        const skipped = dayInstances.filter(inst => inst.status === 'skipped').length;

        // ALL skipped (no completed, no missed, no pending) → black-bar / no-candle state
        if (completed === 0 && skipped > 0 && skipped === scheduled) {
          return {
            letter: day.letter, dateKey: day.dateKey,
            isToday: day.isToday, isFuture: false,
            pct: 100, mode: 'all-skipped',
          };
        }

        // Skipped tasks are neutral — exclude from denominator.
        const effective = scheduled - skipped;
        return {
          letter: day.letter, dateKey: day.dateKey,
          isToday: day.isToday, isFuture: false,
          pct: effective > 0 ? Math.round((completed / effective) * 100) : 0,
          mode: 'normal',
        };
      });

      if (!cancelled) setWeekStats(stats);
    })();
    return () => { cancelled = true; };
  }, [instances, week]);

  const todayStat = weekStats.find(d => d.isToday);
  const todayPct = todayStat?.pct ?? 0;
  const todayMode: DayMode = todayStat?.mode ?? 'no-tasks';

  const openAnalytics = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/statistics');
  };

  const display: DayStat[] = weekStats.length > 0 ? weekStats : week.map(d => ({
    letter: d.letter,
    dateKey: d.dateKey,
    isToday: d.isToday,
    isFuture: d.isFuture,
    pct: null,
    mode: 'no-tasks',
  }));

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Activity s={15} c={C.gold} />
        <Text style={s.heading}>Your Progress</Text>
      </View>

      <TouchableOpacity style={s.card} activeOpacity={0.85}>
        <Text style={s.cardLabel}>TODAY</Text>
        <DailyProgressBar pct={todayPct} mode={todayMode} />

        <View style={s.divider} />

        <Text style={s.cardLabel}>LAST 7 DAYS</Text>

        {/* Candles row */}
        <View style={s.candlesRow}>
          {display.map((d, i) => (
            <View key={i} style={s.weekCol}>
              <Candle pct={d.pct} mode={d.mode} />
            </View>
          ))}
        </View>

        {/* Day labels */}
        <View style={s.daysLabelRow}>
          {display.map((d, i) => (
            <View key={i} style={s.weekCol}>
              <Text style={[s.dayLetter, { color: d.isToday ? C.gold : C.textMuted }]}>{d.letter}</Text>
            </View>
          ))}
        </View>

        {/* Flames row */}
        <View style={s.daysRow}>
          {display.map((d, i) => (
            <View key={i} style={s.weekCol}>
              <FlameTile pct={d.pct} mode={d.mode} />
            </View>
          ))}
        </View>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.86} onPress={openAnalytics}>
        <LinearGradient
          colors={[C.gold, C.goldSoft]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={s.analyticsBtn}
        >
          <Text style={s.analyticsBtnTxt}>VIEW ANALYTICS</Text>
          <ArrowUpRight s={12} c="#fff" w={2.6} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 18, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  heading: { fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f0efeb',
    borderRadius: 22,
    padding: 16,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.2, color: C.textMuted, marginBottom: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F5F4EE',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barFillBlack: {
    backgroundColor: '#1c1917',
  },
  barPct: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 0.4, color: C.gold, minWidth: 36, textAlign: 'right' },
  barPctBlack: { color: '#1c1917' },
  divider: { height: 1, backgroundColor: '#F0EFEB', marginTop: 14, marginBottom: 14 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  daysLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 10 },
  weekCol: { flex: 1, alignItems: 'center' },
  dayLetter: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 0.6 },

  /* Bottom flame badge */
  flameWrap: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    position: 'relative',
  },
  flameTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: TILE_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameGray: {
    backgroundColor: '#F6F4EE',
    borderColor: '#E5E1D6',
  },
  flameColored: {
    backgroundColor: '#FFF3D8',
    borderColor: C.gold,
  },
  flameEmpty: {
    backgroundColor: '#FAFAF7',
    borderColor: '#EDEAE0',
    borderStyle: 'dashed',
  },
  flameColoredAbs: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  flameClip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  flameImg: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    resizeMode: 'contain',
  },
  flameLottie: {
    width: TILE_SIZE + 8,
    height: TILE_SIZE + 8,
  },
  flameGlow: {
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },

  /* Candle */
  candlesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 2 },
  candleCol: { alignItems: 'center' },
  candleFlameSlot: {
    width: 26,
    height: 22,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: -5,
    zIndex: 2,
    overflow: 'visible',
  },
  candleFlameImg: { width: 20, height: 20, resizeMode: 'contain' },
  candleWickWrap: {
    position: 'absolute',
    bottom: 5,
    left: '50%',
    marginLeft: -0.75,
    width: 1.5,
    height: 6,
    alignItems: 'center',
  },
  candleWickTip: {
    width: 1.1,
    height: 2,
    backgroundColor: '#0F0807',
    borderTopLeftRadius: 0.55,
    borderTopRightRadius: 0.55,
  },
  candleWickBase: {
    width: 1.4,
    height: 4,
    backgroundColor: '#1F1310',
  },
  candleEmber: {
    position: 'absolute',
    bottom: 11,
    left: '50%',
    marginLeft: -1.5,
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FF8B2E',
    shadowColor: '#FFB347',
    shadowOpacity: 0.85,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 3,
    elevation: 2,
  },
  candleBody: {
    width: CANDLE_W,
    height: CANDLE_H,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    backgroundColor: '#FFF4C9',
    borderWidth: 1.8,
    borderColor: '#1F1310',
    overflow: 'hidden',
    position: 'relative',
  },
  candleBodyDimmed: {
    backgroundColor: '#F2EDD8',
    borderColor: '#3B2A1F',
  },
  candleSideHighlight: {
    position: 'absolute',
    top: 5,
    bottom: 4,
    left: 3,
    width: 1.4,
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderRadius: 0.7,
  },
  candleFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFC857',
  },
  candleFillTopLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(31,19,16,0.50)',
  },
  candleRim: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    height: 1.2,
    backgroundColor: 'rgba(31,19,16,0.20)',
    borderRadius: 1,
  },
  candleRimDimmed: {
    backgroundColor: 'rgba(31,19,16,0.12)',
  },
  candleBase: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: 'rgba(31,19,16,0.15)',
  },
  candleBaseDimmed: {
    backgroundColor: 'rgba(31,19,16,0.08)',
  },
  analyticsBtn: {
    marginTop: 10,
    padding: 11,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  analyticsBtnTxt: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 2, color: '#fff' },
});
