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
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';
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
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Activity, BarChart3 } from '@/components/icons/Icons';
import FocusLottie from '@/components/focus/FocusLottie';
import { C, F } from '@/constants/tokens';
import { useTasks } from '@/components/tasks/TaskProvider';
import { listTaskInstancesBetween } from '@/components/tasks/taskDb';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


const FLAME_PNG = require('@/assets/images/streak-flame-512.png');

const AnimatedPath = Reanimated.createAnimatedComponent(Path);

const TILE_SIZE = 32;
const ICON_SIZE = 20;
const CANDLE_W = 32;
const CANDLE_H = 60;
const GOLD = '#C5A059';
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

/* ── Dawn backdrop ────────────────────────────────────────── */
// The trophy card's shine grammar, tuned for Home: a diagonal hairline
// weave across the warm gradient, and a few four-point sparkles
// twinkling at their own quiet rhythms.

const SPARKLE_PATH = 'M12 0 C13.2 7.4 16.6 10.8 24 12 C16.6 13.2 13.2 16.6 12 24 C10.8 16.6 7.4 13.2 0 12 C7.4 10.8 10.8 7.4 12 0 Z';

function Sparkle({
  size,
  delay,
  style,
  color = GOLD,
}: {
  size: number;
  delay: number;
  style: object;
  color?: string;
}) {
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
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, delay, t]);

  const twinkle = useAnimatedStyle(() => ({
    opacity: 0.14 + t.value * 0.42,
  }));

  return (
    <Reanimated.View pointerEvents="none" style={[{ position: 'absolute' }, style, twinkle]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={SPARKLE_PATH} fill={color} />
      </Svg>
    </Reanimated.View>
  );
}

// A band of warm light that sweeps across the whole card every few
// seconds — the glint grammar of the focus cards, in daylight.
function CardGlint() {
  const reduceMotion = useReducedMotion();
  const [w, setW] = useState(0);
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || w === 0) return;
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: 7600, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, w, t]);

  const sweep = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.08, 0.3, 0.42, 1], [0, 0.85, 0.85, 0, 0]),
    transform: [
      { translateX: interpolate(t.value, [0, 0.42, 1], [-110, w + 60, w + 60]) },
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
        <Reanimated.View style={[cg.band, sweep]}>
          <LinearGradient
            colors={['rgba(255,251,235,0)', 'rgba(255,247,219,0.55)', 'rgba(255,251,235,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Reanimated.View>
      )}
    </View>
  );
}

const cg = StyleSheet.create({
  band: { position: 'absolute', top: -30, bottom: -30, width: 96 },
});

function DawnBackdrop({ muted = false }: { muted?: boolean }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const step = 30;
  const lineCount = box.w > 0 ? Math.ceil((box.w + box.h) / step) + 1 : 0;
  const weaveColor = muted ? '#A8A093' : GOLD;
  const sparkleColor = muted ? '#B0A995' : GOLD;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setBox({ w: width, h: height });
      }}
    >
      {lineCount > 0 && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          {Array.from({ length: lineCount }).map((_, index) => {
            const offset = index * step;
            return (
              <Line
                key={index}
                x1={offset}
                y1={-4}
                x2={offset - box.h - 8}
                y2={box.h + 4}
                stroke={weaveColor}
                strokeOpacity={0.05}
                strokeWidth={1}
              />
            );
          })}
        </Svg>
      )}
      <Sparkle size={13} delay={0} style={{ right: 86, top: 30 }} color={sparkleColor} />
      <Sparkle size={9} delay={900} style={{ right: 16, top: 18 }} color={sparkleColor} />
      <Sparkle size={8} delay={1700} style={{ left: 148, top: 24 }} color={sparkleColor} />
      <Sparkle size={11} delay={2600} style={{ left: 20, top: 118 }} color={sparkleColor} />
    </View>
  );
}

/* ── Today medallion ──────────────────────────────────────── */
// The layered-ellipse bloom carrying today's percentage in its brightest
// pool — but unlike the trophy's purely ornamental engraving, the curve
// beneath the number here is alive: a hairline track that fills with
// gold to today's progress, sweeping when the day moves.
function TodayMedallion({ pct, mode }: { pct: number; mode: DayMode }) {
  const size = 74;
  const quiet = mode === 'no-tasks' || mode === 'all-skipped';
  const skipped = mode === 'all-skipped';
  const clamped = Math.round(Math.max(0, Math.min(100, pct)));
  const display = quiet ? '—' : String(clamped);
  const extraCharacters = Math.max(0, display.length - 1);
  const digitExpansion = extraCharacters === 0
    ? 0
    : size * 0.24 + Math.max(0, extraCharacters - 1) * size * 0.15;
  const ornamentSpacing = size * 0.16;
  const width = size * 2.08 + digitExpansion + ornamentSpacing;
  const height = size * 0.92;

  // Progress arc: dash length approximates the bezier's arc length —
  // slightly generous so 100% closes the track completely.
  const arcLen = width * 0.98;
  const frac = quiet ? 0 : clamped / 100;
  const arcProgress = useSharedValue(0);

  useEffect(() => {
    arcProgress.value = withDelay(250, withTiming(frac, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    }));
  }, [arcProgress, frac]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLen * (1 - arcProgress.value),
  }));

  return (
    <View style={{ width, height }}>
      <Svg
        pointerEvents="none"
        width={width * 1.14}
        height={height * 1.12}
        style={{ position: 'absolute', left: -width * 0.07, top: -height * 0.06 }}
      >
        {/* Layered ellipses, darker rim to lightest heart — the number sits
            in the brightest pool. */}
        <Ellipse
          cx={width * 0.52}
          cy={height * 0.56}
          rx={width * 0.52}
          ry={height * 0.52}
          fill={skipped ? '#DBD7CA' : '#EBD5A0'}
          opacity={0.8}
          transform={`rotate(-5 ${width * 0.52} ${height * 0.56})`}
        />
        <Ellipse
          cx={width * 0.52}
          cy={height * 0.53}
          rx={width * 0.46}
          ry={height * 0.44}
          fill={skipped ? '#E8E5DA' : '#F5E5BE'}
          opacity={0.85}
          transform={`rotate(4 ${width * 0.52} ${height * 0.53})`}
        />
        <Ellipse
          cx={width * 0.49}
          cy={height * 0.57}
          rx={width * 0.42}
          ry={height * 0.39}
          fill={skipped ? '#F5F3EC' : '#FFF8E4'}
          opacity={0.95}
          transform={`rotate(-3 ${width * 0.49} ${height * 0.57})`}
        />
        <Path
          d={`M ${size * 0.13 + width * 0.07} ${height * 0.82} C ${width * 0.43} ${height * 1.01}, ${width * 0.76} ${height * 0.97}, ${width * 1.0} ${height * 0.64}`}
          fill="none"
          stroke={skipped ? '#9B9484' : GOLD}
          strokeOpacity={skipped ? 0.24 : 0.18}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <AnimatedPath
          d={`M ${size * 0.13 + width * 0.07} ${height * 0.82} C ${width * 0.43} ${height * 1.01}, ${width * 0.76} ${height * 0.97}, ${width * 1.0} ${height * 0.64}`}
          fill="none"
          stroke={GOLD}
          strokeOpacity={0.9}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${arcLen}`}
          animatedProps={arcProps}
        />
        <Line
          x1={size * 0.92 + digitExpansion + width * 0.07}
          y1={height * 0.32}
          x2={size * 0.92 + digitExpansion + width * 0.07}
          y2={height * 0.78}
          stroke={skipped ? '#9B9484' : GOLD}
          strokeOpacity={0.38}
          strokeWidth={1}
          strokeLinecap="round"
        />
      </Svg>

      <View
        style={[
          ms.valueWell,
          { left: size * 0.04, width: size * 0.86 + digitExpansion, height },
        ]}
      >
        <Text
          style={[
            ms.value,
            { fontSize: size * 0.58, lineHeight: size * 0.66 },
            quiet && ms.valueDormant,
            skipped && ms.valueSkipped,
          ]}
          numberOfLines={1}
        >
          {display}
          {!quiet && <Text style={ms.valuePct}>%</Text>}
        </Text>
      </View>

      <View
        style={[
          ms.copy,
          { left: size * 1.04 + digitExpansion, top: height * 0.27 },
        ]}
      >
        <Text style={[ms.eyebrow, skipped && ms.eyebrowSkipped]} numberOfLines={1}>TODAY</Text>
        <Text style={[ms.label, skipped && ms.labelSkipped]} numberOfLines={1}>PROGRESS</Text>
        <View style={[ms.copyRule, skipped && ms.copyRuleSkipped]} />
      </View>

      <View pointerEvents="none" style={[ms.glint, { right: size * 0.05, top: height * 0.08 }, skipped && ms.glintSkipped]} />
      <View pointerEvents="none" style={[ms.glintSmall, { right: size * 0.42, top: height * 0.86 }, skipped && ms.glintSkipped]} />

      {/* A rest-day stamp struck at a slight angle across the arc line */}
      {skipped && (
        <View pointerEvents="none" style={[ms.stampWrap, { top: height * 0.74 }]}>
          <View style={ms.stampLine} />
          <Text style={ms.stampText}>SKIPPED</Text>
          <View style={ms.stampLine} />
        </View>
      )}
    </View>
  );
}

const ms = StyleSheet.create({
  valueWell: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    width: '100%',
    fontFamily: F.serifSemiBold,
    letterSpacing: -1,
    color: '#4A3820',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  valuePct: {
    fontSize: 21,
    letterSpacing: 0,
    color: '#8B6B2F',
  },
  valueDormant: {
    color: '#9A7F4D',
  },
  valueSkipped: {
    color: '#8F887A',
  },
  eyebrowSkipped: {
    color: 'rgba(122,116,102,0.75)',
  },
  labelSkipped: {
    color: '#6E685B',
  },
  copyRuleSkipped: {
    backgroundColor: 'rgba(155,148,132,0.45)',
  },
  glintSkipped: {
    backgroundColor: 'rgba(155,148,132,0.5)',
  },
  stampWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    transform: [{ rotate: '-6deg' }],
  },
  stampText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 3,
    color: '#9B9484',
  },
  stampLine: {
    width: 22,
    height: 1,
    backgroundColor: 'rgba(155,148,132,0.5)',
  },
  copy: {
    position: 'absolute',
    width: 72,
    gap: 1,
    zIndex: 1,
  },
  eyebrow: {
    fontFamily: F.sansBold,
    fontSize: 8.2,
    lineHeight: 10,
    letterSpacing: 1.15,
    color: 'rgba(121,89,30,0.72)',
  },
  label: {
    fontFamily: F.sansBold,
    fontSize: 11.5,
    lineHeight: 14,
    letterSpacing: 1.2,
    color: '#6F5016',
  },
  copyRule: {
    width: 27,
    height: 1,
    marginTop: 4,
    borderRadius: 1,
    backgroundColor: 'rgba(169,134,63,0.45)',
  },
  glint: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 1.5,
    backgroundColor: 'rgba(197,160,89,0.68)',
    transform: [{ rotate: '45deg' }],
  },
  glintSmall: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1,
    backgroundColor: 'rgba(197,160,89,0.48)',
    transform: [{ rotate: '45deg' }],
  },
});

/* ── Radiant flame ────────────────────────────────────────── */
// The one living animation on the card: today's fire in a true sun — a
// layered radiance built like the medallion's bloom (dark rim to bright
// heart), a hairline halo ring, a struck-medal ray burst, and diamond
// glints at the corners. The flame always burns in full color; on quiet
// days the sun around it simply softens.
function RadiantFlame({ pct, mode }: { pct: number | null; mode: DayMode }) {
  const reduceMotion = useReducedMotion();
  const quiet = pct === null || mode === 'no-tasks' || mode === 'all-skipped';
  const skipped = mode === 'all-skipped';
  const full = !quiet && pct >= 100;
  const sunColor = skipped ? '#A8A093' : GOLD;
  const field = 150;
  const cx = field / 2;
  const ringR = 44;
  const rayInner = 48;
  const breathe = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      breathe.value = 0.5;
      return;
    }
    breathe.value = 0;
    breathe.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    // The sun turns, imperceptibly slow — one revolution per minute.
    // On a rest day it stands still.
    spin.value = 0;
    if (!skipped) {
      spin.value = withRepeat(
        withTiming(1, { duration: 60000, easing: Easing.linear }),
        -1,
        false,
      );
    }
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(spin);
    };
  }, [breathe, reduceMotion, skipped, spin]);

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: (quiet ? 0.3 : 0.5) + breathe.value * (quiet ? 0.15 : 0.4),
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <View style={rf.stage}>
      {/* Layered radiance — the bloom grammar, radial */}
      <Reanimated.View pointerEvents="none" style={[rf.glowOuter, outerGlowStyle, skipped && rf.glowOuterSkipped]} />
      <View pointerEvents="none" style={[rf.glowMid, quiet && rf.glowQuiet, skipped && rf.glowMidSkipped]} />
      <View pointerEvents="none" style={[rf.glowHeart, quiet && rf.glowHeartQuiet, full && rf.glowHeartFull, skipped && rf.glowHeartSkipped]} />

      {/* Hairline halo ring — steady while the rays turn */}
      <Svg pointerEvents="none" width={field} height={field} style={[rf.rays, quiet && rf.raysQuiet]}>
        <Circle cx={cx} cy={cx} r={ringR} fill="none" stroke={sunColor} strokeOpacity={full ? 0.44 : 0.32} strokeWidth={1} />
      </Svg>

      <Reanimated.View pointerEvents="none" style={[rf.rays, spinStyle, quiet && rf.raysQuiet]}>
        <Svg width={field} height={field}>
          {/* Ray burst — long/short alternating, like a struck medal.
              On a finished day the sun stands at full strength. */}
          {Array.from({ length: 12 }).map((_, index) => {
            const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
            const long = index % 2 === 0;
            const r1 = rayInner;
            const r2 = rayInner + (long ? (full ? 24 : 20) : (full ? 15 : 12));
            return (
              <Line
                key={index}
                x1={cx + r1 * Math.cos(angle)}
                y1={cx + r1 * Math.sin(angle)}
                x2={cx + r2 * Math.cos(angle)}
                y2={cx + r2 * Math.sin(angle)}
                stroke={sunColor}
                strokeOpacity={long ? (full ? 0.64 : 0.52) : (full ? 0.4 : 0.3)}
                strokeWidth={long ? 1.9 : 1.35}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      </Reanimated.View>

      {/* Diamond glints in the sun's corners — a third joins on a full day */}
      <View pointerEvents="none" style={[rf.glint, { right: 6, top: 10 }, skipped && rf.glintSkipped]} />
      <View pointerEvents="none" style={[rf.glintSmall, { left: 10, bottom: 14 }, skipped && rf.glintSkipped]} />
      {full && <View pointerEvents="none" style={[rf.glintSmall, { left: 6, top: 20 }]} />}

      {/* On a rest day the fire itself rests: a still, ashen silhouette. */}
      {skipped ? (
        <Image source={FLAME_PNG} style={[rf.flameStill, { tintColor: '#AFA795' }]} />
      ) : (
        <FocusLottie name="flame" loop speed={0.9} style={rf.flame} />
      )}
    </View>
  );
}

const rf = StyleSheet.create({
  stage: {
    width: 104,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(235,213,160,0.4)',
  },
  glowMid: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(245,229,190,0.6)',
  },
  glowHeart: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,248,228,0.95)',
  },
  glowQuiet: {
    backgroundColor: 'rgba(245,229,190,0.35)',
  },
  glowHeartQuiet: {
    backgroundColor: 'rgba(255,248,228,0.6)',
  },
  glowHeartFull: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,250,232,1)',
  },
  glowOuterSkipped: {
    backgroundColor: 'rgba(198,192,178,0.4)',
  },
  glowMidSkipped: {
    backgroundColor: 'rgba(213,208,196,0.55)',
  },
  glowHeartSkipped: {
    backgroundColor: 'rgba(246,244,238,0.92)',
  },
  glintSkipped: {
    backgroundColor: 'rgba(155,148,132,0.5)',
  },
  flameStill: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    opacity: 0.62,
  },
  rays: {
    position: 'absolute',
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raysQuiet: {
    opacity: 0.55,
  },
  glint: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 1.5,
    backgroundColor: 'rgba(197,160,89,0.68)',
    transform: [{ rotate: '45deg' }],
  },
  glintSmall: {
    position: 'absolute',
    width: 3.5,
    height: 3.5,
    borderRadius: 1,
    backgroundColor: 'rgba(197,160,89,0.5)',
    transform: [{ rotate: '45deg' }],
  },
  flame: { width: 74, height: 74 },
});

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
// A soft ring that breathes around today's tile — the only motion in the
// week band, marking the day being written.
function TodayPulseRing({ muted = false }: { muted?: boolean }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0.5;
      return;
    }
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  const pulse = useAnimatedStyle(() => ({
    opacity: 0.2 + t.value * 0.5,
  }));

  return <Reanimated.View pointerEvents="none" style={[s.todayRing, muted && s.todayRingMuted, pulse]} />;
}

// Static PNG flames only — the hero carries the one living Lottie, so a
// full week never stacks seven looping animations on the phone. Each
// tile is struck like a small coin: a gradient face, a warm rim, and a
// sheen once the day is won.
function FlameTile({ pct, mode, isToday }: { pct: number | null; mode: DayMode; isToday: boolean }) {
  const ring = isToday ? <TodayPulseRing muted={mode === 'all-skipped'} /> : null;

  // No tasks OR all-skipped → an empty socket with a resting stud
  if (pct === null || mode === 'no-tasks' || mode === 'all-skipped') {
    return (
      <View style={s.flameWrap}>
        {ring}
        <View style={[s.flameTile, s.flameEmpty]}>
          <View style={s.emptyStud} />
        </View>
      </View>
    );
  }

  const filled = Math.max(0, Math.min(100, pct));
  const isFull = filled >= 100;

  if (isFull) {
    return (
      <View style={s.flameWrap}>
        {ring}
        <View style={[s.flameTile, s.flameColored, s.flameGlow]}>
          <LinearGradient
            colors={['#FFF7DE', '#F7E0A8']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Image source={FLAME_PNG} style={s.flameImgFull} />
          <View style={s.tileSheen} pointerEvents="none" />
        </View>
      </View>
    );
  }

  return (
    <View style={s.flameWrap}>
      {ring}
      <View style={[s.flameTile, s.flameGray]}>
        <LinearGradient
          colors={['#FBF9F2', '#F1EBDC']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Image source={FLAME_PNG} style={[s.flameImg, { tintColor: '#CDC2A8' }]} />
      </View>
      {filled > 0 && (
        <View style={[s.flameClip, { height: `${filled}%` }]} pointerEvents="none">
          <View style={[s.flameTile, s.flameColored, s.flameColoredAbs]}>
            <LinearGradient
              colors={['#FFF7DE', '#F7E0A8']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Image source={FLAME_PNG} style={s.flameImg} />
          </View>
        </View>
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

        // ALL skipped (no completed, no missed, no pending) → quiet state
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
  const skippedToday = todayMode === 'all-skipped';

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

  // The voice keeps pace with the day: reserved while little is done,
  // warm in the middle, expectant near the top.
  const headline = todayMode === 'no-tasks'
    ? 'A quiet day — nothing scheduled.'
    : todayMode === 'all-skipped'
      ? 'Today was laid aside to rest.'
      : todayPct >= 100
        ? 'The candle is full — today’s flame is lit.'
        : todayPct >= 70
          ? 'Almost there — the flame is within reach.'
          : todayPct >= 40
            ? 'Good pace — the wax is rising steadily.'
            : todayPct > 0
              ? `Only ${todayPct}% so far — keep filling the candle.`
              : 'The day’s candle awaits its first task.';

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Activity s={15} c={C.gold} />
        <Text style={s.heading}>Your Progress</Text>
      </View>

      <TouchableOpacity style={[s.card, skippedToday && s.cardSkipped]} activeOpacity={0.88} onPress={openAnalytics}>
        <LinearGradient
          colors={skippedToday
            ? ['#E9E7DF', '#F4F3EE', '#FBFAF8']
            : ['#F8E7BE', '#FFF8E9', '#FFFEFA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <DawnBackdrop muted={skippedToday} />
        {!skippedToday && <CardGlint />}

        {/* Hero: today's percentage in the bloom, today's fire radiant */}
        <View style={s.heroRow}>
          <TodayMedallion pct={todayPct} mode={todayMode} />
          <RadiantFlame pct={todayStat?.pct ?? null} mode={todayMode} />
        </View>

        <Text style={[s.headline, skippedToday && s.headlineSkipped]} numberOfLines={2}>{headline}</Text>

        {/* The week band: candles, letters, flames between hairline rails */}
        <View style={[s.weekBand, skippedToday && s.weekBandSkipped]}>
          <View style={s.candlesRow}>
            {display.map((d, i) => (
              <View key={i} style={s.weekCol}>
                <Candle pct={d.pct} mode={d.mode} />
              </View>
            ))}
          </View>

          <View style={s.daysLabelRow}>
            {display.map((d, i) => (
              <View key={i} style={s.weekCol}>
                <Text style={[s.dayLetter, d.isToday && (skippedToday ? s.dayLetterTodaySkipped : s.dayLetterToday)]}>{d.letter}</Text>
              </View>
            ))}
          </View>

          <View style={s.daysRow}>
            {display.map((d, i) => (
              <View key={i} style={s.weekCol}>
                <FlameTile pct={d.pct} mode={d.mode} isToday={d.isToday} />
              </View>
            ))}
          </View>
        </View>
      </TouchableOpacity>

      {/* The card's sibling: same dawn surface, quieted to a single line */}
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={openAnalytics}
        style={[s.analyticsBtn, skippedToday && s.analyticsBtnSkipped]}
      >
        <LinearGradient
          colors={skippedToday ? ['#F0EEE7', '#FAF9F5'] : ['#FBEED0', '#FFFDF7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[s.analyticsDiamond, skippedToday && s.analyticsDiamondSkipped]} />
        <BarChart3 s={13} c={skippedToday ? '#8F887A' : C.goldDark} w={2.1} />
        <Text style={[s.analyticsTxt, skippedToday && s.analyticsTxtSkipped]}>VIEW ANALYTICS</Text>
        <View style={[s.analyticsDiamond, skippedToday && s.analyticsDiamondSkipped]} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 18, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  heading: { fontFamily: F.serifMedium, fontSize: 18, color: C.text },
  analyticsBtn: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: 12,
    minHeight: 46,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E8D8B5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  analyticsBtnSkipped: { borderColor: '#DED9CB' },
  analyticsTxt: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 2.2, color: C.goldDark },
  analyticsTxtSkipped: { color: '#8F887A' },
  analyticsDiamond: {
    width: 4,
    height: 4,
    borderRadius: 0.5,
    backgroundColor: 'rgba(197,160,89,0.5)',
    transform: [{ rotate: '45deg' }],
  },
  analyticsDiamondSkipped: { backgroundColor: 'rgba(155,148,132,0.5)' },
  card: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E8D8B5',
    padding: 16,
    paddingBottom: 14,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  heroRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 8,
    paddingRight: 10,
  },
  cardSkipped: { borderColor: '#D9D4C6' },
  headline: {
    marginTop: 12,
    fontFamily: F.serif,
    fontSize: 14.5,
    lineHeight: 19,
    color: C.textSecondary,
    textAlign: 'center',
  },
  headlineSkipped: {
    fontFamily: F.serifItalic,
    color: '#8F887A',
  },
  weekBand: {
    marginTop: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EADFC8',
  },
  weekBandSkipped: { borderColor: '#DFDACD' },
  candlesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  daysLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, marginBottom: 6 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekCol: { flex: 1, alignItems: 'center' },
  dayLetter: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 0.6, color: C.textMuted },
  dayLetterToday: { color: C.goldDark },
  dayLetterTodaySkipped: { color: '#8F887A' },

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
    overflow: 'hidden',
  },
  flameGray: {
    backgroundColor: '#F7F4EA',
    borderColor: '#E3DCC8',
  },
  flameColored: {
    backgroundColor: '#FFF3D8',
    borderColor: '#D2A755',
  },
  flameEmpty: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderColor: '#E0D6BE',
    borderStyle: 'dashed',
  },
  emptyStud: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8CDB6',
  },
  tileSheen: {
    position: 'absolute',
    top: 4,
    left: 6,
    width: 9,
    height: 3.5,
    borderRadius: 4,
    backgroundColor: 'rgba(255,253,246,0.85)',
    transform: [{ rotate: '-18deg' }],
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
  flameImgFull: {
    width: ICON_SIZE + 2,
    height: ICON_SIZE + 2,
    resizeMode: 'contain',
  },
  todayRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: TILE_SIZE + 8,
    height: TILE_SIZE + 8,
    borderRadius: (TILE_SIZE + 8) / 2,
    borderWidth: 1.5,
    borderColor: C.gold,
  },
  todayRingMuted: {
    borderColor: '#B7B0A0',
  },
  flameGlow: {
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },

  /* Candle */
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
});
