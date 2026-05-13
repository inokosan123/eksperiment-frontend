import {
  useEffect,
  useMemo,
  useState } from 'react';
import { Image,
  View,
  Text,
  StyleSheet,
} from 'react-native';
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
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


const FLAME_PNG = require('@/assets/images/streak-flame-512.png');

const TILE_SIZE = 32;
const ICON_SIZE = 20;
const CANDLE_W = 24;
const CANDLE_H = 58;
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
    return <View style={[s.candleCol, { height: CANDLE_H + 24 }]} />;
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
          <>
            <View style={s.candleFlameAura} pointerEvents="none" />
            <Image source={FLAME_PNG} style={s.candleFlameImg} />
          </>
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
      <View style={s.candleBodyWrap}>
        <View style={[s.candleBodyHalo, isFull && s.candleBodyHaloFull, isEmpty && s.candleBodyHaloDimmed]} pointerEvents="none" />
        <View style={[s.candleBody, isEmpty && s.candleBodyDimmed]}>
          <LinearGradient
            colors={isEmpty ? ['#F7F3E7', '#EDE6D6'] : ['#FFFDF6', '#FFF1CA', '#E9C66E']}
            locations={[0, 0.52, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={[s.candleInnerShade, isEmpty && s.candleInnerShadeDimmed]} pointerEvents="none" />
          {filled > 0 && (
            <View style={[s.candleFill, { height: `${filled}%` }, isFull && s.candleFillFull]}>
              <LinearGradient
                colors={isFull ? ['#FFE6A2', '#E8B955', '#C88B2E'] : ['#FFD982', '#F0B94F', '#D49431']}
                locations={[0, 0.58, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={s.candleFillBloom} pointerEvents="none" />
              <View style={s.candleSideHighlight} pointerEvents="none" />
              {filled < 100 && <View style={s.candleFillTopLine} pointerEvents="none" />}
            </View>
          )}
          <View style={s.candleWickInset} pointerEvents="none" />
          <View style={[s.candleWaxLip, isFull && s.candleWaxLipFull, isEmpty && s.candleWaxLipDimmed]} pointerEvents="none" />
          <View style={[s.candleWaxDrop, isEmpty && s.candleWaxDropDimmed]} pointerEvents="none" />
          <View style={[s.candleWaxDropSmall, isEmpty && s.candleWaxDropDimmed]} pointerEvents="none" />
          <View style={s.candleGloss} pointerEvents="none" />
          <View style={[s.candleRim, isEmpty && s.candleRimDimmed]} pointerEvents="none" />
          <View style={[s.candleBase, isEmpty && s.candleBaseDimmed]} pointerEvents="none" />
        </View>
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
          <FocusLottie name="flame" loop speed={1} style={s.flameLottie} />
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
          <Reanimated.View style={[s.barFill, fillStyle]}>
            <LinearGradient
              colors={['#E0B770', C.gold]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Reanimated.View>
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
  cardLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.2, color: C.textMuted, marginBottom: 4 },
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
  divider: { height: 1, backgroundColor: '#F0EFEB', marginTop: 12, marginBottom: 10 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  daysLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 6 },
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
  candlesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 4 },
  candleCol: { alignItems: 'center' },
  candleFlameSlot: {
    width: 30,
    height: 24,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: -4,
    zIndex: 2,
    overflow: 'visible',
  },
  candleFlameAura: {
    position: 'absolute',
    bottom: 1,
    width: 22,
    height: 16,
    borderRadius: 11,
    backgroundColor: 'rgba(255,198,87,0.22)',
    shadowColor: '#F4A62A',
    shadowOpacity: 0.42,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 9,
    elevation: 3,
  },
  candleFlameImg: { width: 21, height: 21, resizeMode: 'contain' },
  candleWickWrap: {
    position: 'absolute',
    bottom: 4,
    left: '50%',
    marginLeft: -0.75,
    width: 1.5,
    height: 8,
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
    height: 6,
    backgroundColor: '#2A1B16',
  },
  candleEmber: {
    position: 'absolute',
    bottom: 13,
    left: '50%',
    marginLeft: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF9E3C',
    shadowColor: '#FFB347',
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4,
    elevation: 2,
  },
  candleBodyWrap: {
    width: CANDLE_W + 8,
    height: CANDLE_H + 4,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  candleBodyHalo: {
    position: 'absolute',
    top: 8,
    width: CANDLE_W + 8,
    height: CANDLE_H - 6,
    borderRadius: 12,
    backgroundColor: 'rgba(197,160,89,0.12)',
    shadowColor: '#C5A059',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 1,
  },
  candleBodyHaloFull: {
    backgroundColor: 'rgba(255,202,91,0.20)',
    shadowOpacity: 0.30,
    shadowRadius: 10,
  },
  candleBodyHaloDimmed: {
    backgroundColor: 'rgba(160,145,117,0.08)',
    shadowOpacity: 0.04,
  },
  candleBody: {
    width: CANDLE_W,
    height: CANDLE_H,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    backgroundColor: '#FFF8DF',
    borderWidth: 1,
    borderColor: '#9C7A39',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#C5A059',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  candleBodyDimmed: {
    backgroundColor: '#F2EDD8',
    borderColor: '#D7CBAE',
    shadowOpacity: 0.05,
  },
  candleInnerShade: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 7,
    borderRightWidth: 3,
    borderRightColor: 'rgba(122,82,22,0.10)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.52)',
  },
  candleInnerShadeDimmed: {
    borderRightColor: 'rgba(91,76,52,0.08)',
    borderLeftColor: 'rgba(255,255,255,0.34)',
  },
  candleSideHighlight: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 3,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.46)',
    borderRadius: 1,
  },
  candleFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F0B94F',
    overflow: 'hidden',
  },
  candleFillBloom: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 4,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  candleFillFull: {
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  candleFillTopLine: {
    position: 'absolute',
    top: 0,
    left: 2,
    right: 2,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,243,203,0.76)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(154,105,35,0.20)',
  },
  candleWickInset: {
    position: 'absolute',
    top: 2,
    left: '50%',
    marginLeft: -0.75,
    width: 1.5,
    height: 8,
    borderRadius: 1,
    backgroundColor: '#2A1B16',
  },
  candleWaxLip: {
    position: 'absolute',
    top: 0,
    left: 1,
    right: 1,
    height: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,254,248,0.84)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(197,160,89,0.20)',
  },
  candleWaxLipFull: {
    backgroundColor: 'rgba(255,227,157,0.74)',
    borderBottomColor: 'rgba(168,111,34,0.24)',
  },
  candleWaxLipDimmed: {
    backgroundColor: 'rgba(255,255,255,0.44)',
    borderBottomColor: 'rgba(139,116,83,0.12)',
  },
  candleWaxDrop: {
    position: 'absolute',
    top: 7,
    right: 4,
    width: 4,
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255,250,235,0.72)',
  },
  candleWaxDropSmall: {
    position: 'absolute',
    top: 9,
    left: 5,
    width: 3,
    height: 8,
    borderRadius: 3,
    backgroundColor: 'rgba(255,252,241,0.56)',
  },
  candleWaxDropDimmed: {
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  candleGloss: {
    position: 'absolute',
    top: 10,
    bottom: 8,
    left: 4,
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  candleRim: {
    position: 'absolute',
    top: 1,
    left: 3,
    right: 3,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 999,
  },
  candleRimDimmed: {
    backgroundColor: 'rgba(255,255,255,0.40)',
  },
  candleBase: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(105,68,20,0.16)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.24)',
  },
  candleBaseDimmed: {
    backgroundColor: 'rgba(91,76,52,0.08)',
    borderTopColor: 'rgba(255,255,255,0.12)',
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
