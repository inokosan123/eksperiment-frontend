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
import Svg, { Circle, Path } from 'react-native-svg';
import Reanimated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
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
const CANDLE_W = 32;
const CANDLE_H = 60;
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

/* ── Hearth atmosphere ────────────────────────────────────── */
// A band of warm light that sweeps across the dark hearth every few
// seconds — the same glint grammar the journal hearth uses.
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
      false,
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

// A mote of gold dust hanging in the hearth's light.
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

  const twinkle = useAnimatedStyle(() => ({ opacity: 0.15 + t.value * 0.5 }));

  return (
    <Reanimated.View pointerEvents="none" style={[s.dustWrap, style, twinkle]}>
      <View style={s.dust} />
    </Reanimated.View>
  );
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
  const bodyX = 6;
  const bodyY = 4;
  const bodyW = 20;
  const bodyH = 54;
  const fillH = (bodyH * filled) / 100;
  const fillY = bodyY + bodyH - fillH;
  const fillTopY = isFull ? bodyY + 8.5 : fillY;
  const fillLineY = Math.max(bodyY + 8, Math.min(bodyY + bodyH - 3, fillY));
  const fillPath = `M${bodyX + 1.2} ${fillTopY}
    H${bodyX + bodyW - 1.2}
    V${bodyY + bodyH - 6}
    Q${bodyX + bodyW - 1.2} ${bodyY + bodyH - 1.2} ${bodyX + bodyW - 6} ${bodyY + bodyH - 1.2}
    H${bodyX + 6}
    Q${bodyX + 1.2} ${bodyY + bodyH - 1.2} ${bodyX + 1.2} ${bodyY + bodyH - 6}
    Z`;

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
        <Svg width={CANDLE_W} height={CANDLE_H} viewBox="0 0 32 60">
          <Path
            d="M7 10 C7 6.6 10.1 4 16 4 C21.9 4 25 6.6 25 10 V51 C25 54.6 21.7 58 16 58 C10.3 58 7 54.6 7 51 Z"
            fill={isEmpty ? '#F3EDDD' : '#FFF4DE'}
            stroke={isEmpty ? '#D8CDB6' : '#C8A15D'}
            strokeWidth={1.45}
          />
          {!isEmpty && (
            <Path d={fillPath} fill={isFull ? '#D6A246' : '#D7A348'} />
          )}
          {isFull && (
            <>
              <Path
                d="M9.4 14 C11.2 17.5 11.1 42.4 9.9 49.8 C12.4 52.5 19.5 52.4 22.1 49.7 C21.3 40.9 21.1 23.3 22.6 14.3 C19.4 15.2 12.8 15.1 9.4 14 Z"
                fill="#E1B75A"
                opacity={0.62}
              />
              <Path
                d="M21.5 15 C22.1 24.1 22 39.3 20.7 49.4 C21.7 48.8 22.5 47.7 22.9 46.5 C23 36.6 22.9 25.4 22.5 15.7 Z"
                fill="#9C6423"
                opacity={0.22}
              />
              <Path
                d="M11.1 16.3 C10.5 25.3 10.6 39.8 11.7 49.2"
                fill="none"
                stroke="#FFE8AE"
                strokeWidth={1.35}
                strokeLinecap="round"
                opacity={0.74}
              />
              <Path
                d="M13.2 51.2 C15.3 52.2 18.7 52.1 20.7 50.9"
                fill="none"
                stroke="#F8D482"
                strokeWidth={1.1}
                strokeLinecap="round"
                opacity={0.58}
              />
              <Circle cx={20.5} cy={25.2} r={0.95} fill="#F8D88F" opacity={0.72} />
              <Circle cx={19.8} cy={32.4} r={0.62} fill="#FBE3A6" opacity={0.5} />
            </>
          )}
          {!isEmpty && !isFull && (
            <>
              <Path
                d={`M8.9 ${fillLineY - 0.5} C11.2 ${fillLineY - 1.7} 13.6 ${fillLineY - 0.4} 16 ${fillLineY - 1.15} C18.8 ${fillLineY - 2} 21.2 ${fillLineY - 1.25} 23.1 ${fillLineY - 0.45}`}
                fill="none"
                stroke="#FFE6A8"
                strokeWidth={2.25}
                strokeLinecap="round"
              />
              <Path
                d={`M9.1 ${fillLineY + 1.35} C12 ${fillLineY + 2.1} 19.6 ${fillLineY + 2} 22.9 ${fillLineY + 1.25}`}
                fill="none"
                stroke="#9F6824"
                strokeWidth={0.8}
                strokeLinecap="round"
                opacity={0.34}
              />
            </>
          )}
          {isFull && (
            <Path
              d="M11.3 47 C13.4 48.4 18.4 48.2 20.8 46.5"
              fill="none"
              stroke="#F3C86B"
              strokeWidth={1.3}
              strokeLinecap="round"
              opacity={0.62}
            />
          )}
          {isFull ? (
            <>
              <Path
                d="M8.1 9 C9.9 6.8 13.3 6.2 16 7.2 C18.9 6.2 22.2 6.8 23.9 9 V13.1 C22 14.7 19.3 13.3 16.1 13.2 C12.9 13.1 10 14.7 8.1 13.1 Z"
                fill="#FFF0B9"
                stroke="#D0A45A"
                strokeWidth={1.05}
              />
              <Path
                d="M10.1 9.5 C12.1 8.3 14.4 8.2 16.2 8.8 C18.1 8.2 20.6 8.4 22 9.6"
                fill="none"
                stroke="#FFF9DF"
                strokeWidth={1.2}
                strokeLinecap="round"
                opacity={0.82}
              />
              <Path
                d="M9.5 12.4 C12 13.2 13.8 11.9 16.1 12 C18.5 12.1 20.7 13.1 22.7 12.2"
                fill="none"
                stroke="#B87828"
                strokeWidth={0.75}
                strokeLinecap="round"
                opacity={0.26}
              />
              <Path
                d="M22.1 12.4 C22.5 17.7 20.3 19 19.1 17.2 C18.3 16 19.3 14.2 19.2 12.8"
                fill="#F7C86F"
                stroke="#D0A45A"
                strokeWidth={0.9}
                strokeLinejoin="round"
              />
              <Path
                d="M10.3 12.8 C10 16 11.3 17.1 12.3 16 C12.9 15.1 12.1 14 12.2 12.7"
                fill="#FFF7D8"
                stroke="#D8B975"
                strokeWidth={0.85}
                strokeLinejoin="round"
              />
            </>
          ) : (
            <Path
              d="M8.3 9.5 C10.2 7.4 13.4 6.7 16 7.4 C18.7 6.7 21.8 7.4 23.7 9.5 V12 C21.8 13.3 19.2 12.2 16 12.2 C12.8 12.2 10.2 13.3 8.3 12 Z"
              fill={isEmpty ? '#F8F1E2' : '#FFF9EA'}
              stroke={isEmpty ? '#DED3BF' : '#D8BD82'}
              strokeWidth={0.95}
            />
          )}
          <Path
            d="M11.2 18 C10.6 28.5 10.8 39.8 11.9 50.2"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={1.7}
            strokeLinecap="round"
            opacity={isEmpty ? 0.42 : 0.72}
          />
          <Circle cx={20.4} cy={22} r={1.15} fill={isEmpty ? '#ECE2CF' : '#F6DFAE'} opacity={0.55} />
          <Path
            d="M8 51.5 C10.7 54.5 21.4 54.5 24 51.4"
            fill="none"
            stroke={isEmpty ? '#D9CEB8' : '#A87933'}
            strokeWidth={1.3}
            strokeLinecap="round"
            opacity={0.78}
          />
        </Svg>
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
        <Image source={FLAME_PNG} style={[s.flameImg, { tintColor: '#6E6553', opacity: 0.6 }]} />
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

      <View style={s.card}>
        <Text style={s.cardLabel}>TODAY</Text>
        <DailyProgressBar pct={todayPct} mode={todayMode} />

        {/* Engraved divider: line — diamond — line */}
        <View style={s.ornamentRow}>
          <View style={s.ornamentLine} />
          <View style={s.ornamentDiamond} />
          <View style={s.ornamentLine} />
        </View>

        <Text style={s.cardLabel}>LAST 7 DAYS</Text>

        {/* Candles stand on the mantel — the light zone of the card,
            their bases resting on the hearth's top rail below. */}
        <View style={s.candlesRow}>
          {display.map((d, i) => (
            <View key={i} style={s.weekCol}>
              <Candle pct={d.pct} mode={d.mode} />
            </View>
          ))}
        </View>

        {/* The hearth: a dark velvet panel running edge to edge under the
            candles — the week's flames glow inside it. */}
        <View style={s.hearth}>
          <LinearGradient
            colors={['#2C2517', '#211C12', '#1A160E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View pointerEvents="none" style={s.hearthSheen} />
          <HearthGlint />
          <GoldDust delay={0} style={{ right: 22, top: 10 }} />
          <GoldDust delay={1500} style={{ left: 30, top: 26 }} />
          <GoldDust delay={2700} style={{ right: 74, bottom: 12 }} />

          {/* Day labels */}
          <View style={s.daysLabelRow}>
            {display.map((d, i) => (
              <View key={i} style={s.weekCol}>
                <Text style={[s.dayLetter, d.isToday ? s.dayLetterToday : null]}>{d.letter}</Text>
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
        </View>
      </View>

      <TouchableOpacity activeOpacity={0.86} onPress={openAnalytics} style={s.analyticsBtn}>
        <View style={s.analyticsDiamond} />
        <Text style={s.analyticsBtnTxt}>VIEW ANALYTICS</Text>
        <ArrowUpRight s={12} c="#E8C374" w={2.6} />
        <View style={s.analyticsDiamond} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 18, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  heading: { fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  card: {
    backgroundColor: '#FFFEFB',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    borderRadius: 24,
    padding: 16,
    paddingBottom: 14,
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  cardLabel: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2.2, color: '#B89A5A', marginBottom: 7 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  barTrack: {
    flex: 1,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#F6F1E4',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  barFillBlack: {
    backgroundColor: '#1c1917',
  },
  barPct: { fontFamily: F.serifSemiBold, fontSize: 15, color: C.gold, minWidth: 40, textAlign: 'right' },
  barPctBlack: { color: '#1c1917' },
  ornamentRow: { flexDirection: 'row', alignItems: 'center', marginTop: 13, marginBottom: 11 },
  ornamentLine: { flex: 1, height: 1, backgroundColor: 'rgba(197,160,89,0.26)' },
  ornamentDiamond: { width: 5, height: 5, marginHorizontal: 8, borderRadius: 1, backgroundColor: C.gold, transform: [{ rotate: '45deg' }] },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  daysLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  weekCol: { flex: 1, alignItems: 'center' },
  dayLetter: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.38)' },
  dayLetterToday: { color: '#F3E2BC' },

  /* Hearth */
  hearth: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: 0,
    marginHorizontal: -16,
    marginBottom: -14,
    borderTopWidth: 1,
    borderColor: 'rgba(197,160,89,0.32)',
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 16,
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  flameColored: {
    backgroundColor: 'rgba(197,160,89,0.22)',
    borderColor: '#D9B064',
  },
  flameEmpty: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.18)',
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
    shadowOpacity: 0.55,
    shadowRadius: 7,
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
    marginBottom: -5,
    zIndex: 2,
    overflow: 'visible',
  },
  candleFlameAura: {
    position: 'absolute',
    bottom: -1,
    width: 24,
    height: 18,
    borderRadius: 13,
    backgroundColor: 'rgba(255,199,82,0.16)',
    shadowColor: '#F4A62A',
    shadowOpacity: 0.36,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: 3,
  },
  candleFlameImg: { width: 19, height: 19, resizeMode: 'contain', zIndex: 2 },
  candleWickWrap: {
    position: 'absolute',
    bottom: -2,
    left: '50%',
    marginLeft: -0.8,
    width: 1.6,
    height: 9,
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
    width: 1.5,
    height: 7,
    backgroundColor: '#1D1512',
  },
  candleEmber: {
    position: 'absolute',
    bottom: 5,
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
    width: CANDLE_W + 4,
    height: CANDLE_H + 2,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
  },
  candleBodyHalo: {
    position: 'absolute',
    top: 9,
    width: CANDLE_W + 2,
    height: CANDLE_H - 10,
    borderRadius: 13,
    backgroundColor: 'rgba(197,160,89,0.08)',
    shadowColor: '#C5A059',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 1,
  },
  candleBodyHaloFull: {
    backgroundColor: 'rgba(255,198,80,0.13)',
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
  candleBodyHaloDimmed: {
    backgroundColor: 'rgba(160,145,117,0.08)',
    shadowOpacity: 0.04,
  },
  analyticsBtn: {
    marginTop: 12,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: '#17130F',
    borderWidth: 1,
    borderColor: 'rgba(232,195,116,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  analyticsBtnTxt: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2, color: '#E8C374' },
  analyticsDiamond: { width: 4, height: 4, borderRadius: 0.5, backgroundColor: 'rgba(232,195,116,0.55)', transform: [{ rotate: '45deg' }] },
});
