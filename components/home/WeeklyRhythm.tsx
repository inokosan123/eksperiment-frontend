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
import { BANKED, BankedWeave, EmberPulse, LedgerCartouche, RestSeal } from '@/components/shared/BankedEmber';


const FLAME_PNG = require('@/assets/images/streak-flame-512.png');

const AnimatedPath = Reanimated.createAnimatedComponent(Path);

// The week reads through the flame tiles alone now — the candle row said the
// same thing twice, so the tiles took its space and grew into it.
const TILE_SIZE = 38;
const ICON_SIZE = 23;
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
  slow = false,
}: {
  size: number;
  delay: number;
  style: object;
  color?: string;
  slow?: boolean;
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
        withTiming(1, { duration: slow ? 4400 : 2400, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, delay, slow, t]);

  // Banked: the sparks are half as bright and take nearly twice as long.
  const twinkle = useAnimatedStyle(() => ({
    opacity: slow ? 0.07 + t.value * 0.19 : 0.14 + t.value * 0.42,
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
  const lineCount = !muted && box.w > 0 ? Math.ceil((box.w + box.h) / step) + 1 : 0;
  const sparkleColor = muted ? BANKED.ember : GOLD;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setBox({ w: width, h: height });
      }}
    >
      {/* Resting, the single gold rake gives way to the counter-raked ash
          weave — laid paper instead of a drained gold field. */}
      {muted && <BankedWeave />}
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
                stroke={GOLD}
                strokeOpacity={0.05}
                strokeWidth={1}
              />
            );
          })}
        </Svg>
      )}
      <Sparkle size={13} delay={0} style={{ right: 86, top: 30 }} color={sparkleColor} slow={muted} />
      <Sparkle size={9} delay={900} style={{ right: 16, top: 18 }} color={sparkleColor} slow={muted} />
      <Sparkle size={8} delay={1700} style={{ left: 148, top: 24 }} color={sparkleColor} slow={muted} />
      <Sparkle size={11} delay={2600} style={{ left: 20, top: 118 }} color={sparkleColor} slow={muted} />
    </View>
  );
}

/* ── Today medallion ──────────────────────────────────────── */
// The layered-ellipse bloom carrying today's percentage in its brightest
// pool — but unlike the trophy's purely ornamental engraving, the curve
// beneath the number here is alive: a hairline track that fills with
// gold to today's progress, sweeping when the day moves. Banked, the whole
// instrument goes out of service — ash bloom, dashed track, and a ruled
// entry where the reading would stand.
function TodayMedallion({ pct, mode }: { pct: number; mode: DayMode }) {
  const size = 74;
  // Banked: nothing was scheduled, or the whole day was laid aside. The
  // instrument keeps its face but stops reading — an empty ruled entry
  // where the number would stand, and a dashed track instead of a live one.
  const banked = mode === 'no-tasks' || mode === 'all-skipped';
  const skipped = mode === 'all-skipped';
  const clamped = Math.round(Math.max(0, Math.min(100, pct)));
  const display = banked ? '' : String(clamped);
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
  const frac = banked ? 0 : clamped / 100;
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
          fill={banked ? BANKED.bloomRim : '#EBD5A0'}
          opacity={0.8}
          transform={`rotate(-5 ${width * 0.52} ${height * 0.56})`}
        />
        <Ellipse
          cx={width * 0.52}
          cy={height * 0.53}
          rx={width * 0.46}
          ry={height * 0.44}
          fill={banked ? BANKED.bloomMid : '#F5E5BE'}
          opacity={0.85}
          transform={`rotate(4 ${width * 0.52} ${height * 0.53})`}
        />
        <Ellipse
          cx={width * 0.49}
          cy={height * 0.57}
          rx={width * 0.42}
          ry={height * 0.39}
          fill={banked ? BANKED.bloomHeart : '#FFF8E4'}
          opacity={0.95}
          transform={`rotate(-3 ${width * 0.49} ${height * 0.57})`}
        />
        {/* The progress track. Solid while the day can still be written,
            dashed once it is banked — a gauge visibly taken out of service. */}
        <Path
          d={`M ${size * 0.13 + width * 0.07} ${height * 0.82} C ${width * 0.43} ${height * 1.01}, ${width * 0.76} ${height * 0.97}, ${width * 1.0} ${height * 0.64}`}
          fill="none"
          stroke={banked ? BANKED.ash : GOLD}
          strokeOpacity={banked ? 0.42 : 0.18}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={banked ? '3 5' : undefined}
        />
        {!banked && (
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
        )}
        <Line
          x1={size * 0.92 + digitExpansion + width * 0.07}
          y1={height * 0.32}
          x2={size * 0.92 + digitExpansion + width * 0.07}
          y2={height * 0.78}
          stroke={banked ? BANKED.ash : GOLD}
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
        {banked ? (
          // A day you struck yourself is ruled out in oxblood; a day nobody
          // ever wrote on is simply left blank in ash.
          <LedgerCartouche
            width={size * 0.78}
            height={size * 0.44}
            tone={skipped ? 'struck' : 'quiet'}
          />
        ) : (
          <Text
            style={[ms.value, { fontSize: size * 0.58, lineHeight: size * 0.66 }]}
            numberOfLines={1}
          >
            {display}
            <Text style={ms.valuePct}>%</Text>
          </Text>
        )}
      </View>

      <View
        style={[
          ms.copy,
          { left: size * 1.04 + digitExpansion, top: height * 0.27 },
        ]}
      >
        <Text style={[ms.eyebrow, banked && ms.eyebrowBanked]} numberOfLines={1}>TODAY</Text>
        <Text style={[ms.label, banked && ms.labelBanked]} numberOfLines={1}>
          {skipped ? 'AT REST' : banked ? 'NO TASKS' : 'PROGRESS'}
        </Text>
        <View style={[ms.copyRule, banked && ms.copyRuleBanked]} />
      </View>

      <View pointerEvents="none" style={[ms.glint, { right: size * 0.05, top: height * 0.08 }, banked && ms.glintBanked]} />
      <View pointerEvents="none" style={[ms.glintSmall, { right: size * 0.42, top: height * 0.86 }, banked && ms.glintBanked]} />
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
  eyebrowBanked: {
    color: BANKED.inkSoft,
  },
  labelBanked: {
    color: BANKED.ink,
  },
  copyRuleBanked: {
    backgroundColor: BANKED.ashLine,
  },
  glintBanked: {
    backgroundColor: BANKED.ashLine,
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
// glints at the corners. On a day that cannot be written the whole sun is
// banked: the rays pull back to even stubs, the ring breaks into dashes,
// the flame stills to a warm ashen silhouette, and a coal breathes under it.
function RadiantFlame({ pct, mode }: { pct: number | null; mode: DayMode }) {
  const reduceMotion = useReducedMotion();
  // Nothing scheduled and a day laid aside are the same fire: banked.
  const banked = pct === null || mode === 'no-tasks' || mode === 'all-skipped';
  const full = !banked && pct >= 100;
  const sunColor = banked ? BANKED.ash : GOLD;
  const field = 150;
  const cx = field / 2;
  const ringR = 44;
  const rayInner = 48;
  const breathe = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    // A banked sun neither breathes nor turns — the coal underneath is the
    // only thing still moving on the card.
    if (reduceMotion || banked) {
      breathe.value = 0.5;
      spin.value = 0;
      return;
    }
    breathe.value = 0;
    breathe.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    // The sun turns, imperceptibly slow — one revolution per minute.
    spin.value = 0;
    spin.value = withRepeat(
      withTiming(1, { duration: 60000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(spin);
    };
  }, [banked, breathe, reduceMotion, spin]);

  const outerGlowStyle = useAnimatedStyle(() => ({
    opacity: banked ? 0.34 : 0.5 + breathe.value * 0.4,
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <View style={rf.stage}>
      {/* Layered radiance — the bloom grammar, radial */}
      <Reanimated.View pointerEvents="none" style={[rf.glowOuter, outerGlowStyle, banked && rf.glowOuterBanked]} />
      <View pointerEvents="none" style={[rf.glowMid, banked && rf.glowMidBanked]} />
      <View pointerEvents="none" style={[rf.glowHeart, full && rf.glowHeartFull, banked && rf.glowHeartBanked]} />

      {/* Hairline halo ring — steady while the rays turn, and broken into
          dashes once the sun is banked. */}
      <Svg pointerEvents="none" width={field} height={field} style={[rf.rays, banked && rf.raysBanked]}>
        <Circle
          cx={cx}
          cy={cx}
          r={ringR}
          fill="none"
          stroke={sunColor}
          strokeOpacity={banked ? 0.5 : full ? 0.44 : 0.32}
          strokeWidth={1}
          strokeDasharray={banked ? '3 6' : undefined}
        />
        {/* A banked instrument gains an outer orbit on a slower dash rhythm,
            so the face reads as layered rather than as one broken circle. */}
        {banked && (
          <Circle
            cx={cx}
            cy={cx}
            r={ringR + 17}
            fill="none"
            stroke={sunColor}
            strokeOpacity={0.26}
            strokeWidth={1}
            strokeDasharray="2 9"
          />
        )}
      </Svg>

      <Reanimated.View pointerEvents="none" style={[rf.rays, spinStyle, banked && rf.raysBanked]}>
        <Svg width={field} height={field}>
          {/* Ray burst — long/short alternating, like a struck medal. On a
              finished day the sun stands at full strength; on a banked one
              every ray pulls back to the same short stub. */}
          {Array.from({ length: 12 }).map((_, index) => {
            const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
            const long = !banked && index % 2 === 0;
            const r1 = rayInner;
            const r2 = rayInner + (banked ? 5 : long ? (full ? 24 : 20) : (full ? 15 : 12));
            return (
              <Line
                key={index}
                x1={cx + r1 * Math.cos(angle)}
                y1={cx + r1 * Math.sin(angle)}
                x2={cx + r2 * Math.cos(angle)}
                y2={cx + r2 * Math.sin(angle)}
                stroke={sunColor}
                strokeOpacity={banked ? 0.3 : long ? (full ? 0.64 : 0.52) : (full ? 0.4 : 0.3)}
                strokeWidth={banked ? 1 : long ? 1.9 : 1.35}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      </Reanimated.View>

      {/* Diamond glints in the sun's corners — a third joins on a full day */}
      <View pointerEvents="none" style={[rf.glint, { right: 6, top: 10 }, banked && rf.glintBanked]} />
      <View pointerEvents="none" style={[rf.glintSmall, { left: 10, bottom: 14 }, banked && rf.glintBanked]} />
      {full && <View pointerEvents="none" style={[rf.glintSmall, { left: 6, top: 20 }]} />}

      {/* Banked: the fire itself stands still — a warm ashen silhouette over
          a coal that is still breathing, so the day reads as held, not over. */}
      {banked ? (
        <>
          <EmberPulse size={40} style={rf.emberSeat} />
          <Image key="flame-banked" source={FLAME_PNG} style={rf.flameStill} />
        </>
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
  glowHeartFull: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,250,232,1)',
  },
  glowOuterBanked: {
    backgroundColor: 'rgba(222,210,184,0.42)',
  },
  glowMidBanked: {
    backgroundColor: 'rgba(239,231,212,0.55)',
  },
  glowHeartBanked: {
    backgroundColor: 'rgba(251,247,236,0.92)',
  },
  glintBanked: {
    backgroundColor: BANKED.ashLine,
  },
  emberSeat: {
    bottom: 24,
  },
  // A silhouette only reads as one when it is genuinely darker than the
  // paper behind it. Warm ash, not grey, and struck firmly — the coal
  // breathing underneath does the softening.
  flameStill: {
    width: 58,
    height: 58,
    resizeMode: 'contain',
    opacity: 0.82,
    tintColor: '#A2937A',
  },
  rays: {
    position: 'absolute',
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raysBanked: {
    opacity: 0.72,
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

/* ── Bottom badge ─────────────────────────────────────────── */
// A soft ring that breathes around today's tile — the only motion in the
// week band, marking the day being written.
function TodayPulseRing({ muted = false }: { muted?: boolean }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    // A banked day's ring is held, not breathing.
    if (reduceMotion || muted) {
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
  }, [muted, reduceMotion, t]);

  const pulse = useAnimatedStyle(() => ({
    opacity: muted ? 0.5 : 0.2 + t.value * 0.5,
  }));

  return <Reanimated.View pointerEvents="none" style={[s.todayRing, muted && s.todayRingMuted, pulse]} />;
}

// Static PNG flames only — the hero carries the one living Lottie, so a
// full week never stacks seven looping animations on the phone. Each
// tile is struck like a small coin: a gradient face, a warm rim, and a
// sheen once the day is won.
function FlameTile({ pct, mode, isToday }: { pct: number | null; mode: DayMode; isToday: boolean }) {
  const bankedDay = pct === null || mode === 'no-tasks' || mode === 'all-skipped';
  const ring = isToday ? <TodayPulseRing muted={bankedDay} /> : null;

  // No tasks OR all-skipped → an empty socket with a resting stud; today's
  // own socket keeps a warm coal in it rather than a cold one.
  if (bankedDay) {
    return (
      <View style={s.flameWrap}>
        {ring}
        <View style={[s.flameTile, s.flameEmpty]}>
          <View style={[s.emptyStud, isToday && s.emptyStudToday]} />
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
          {/* key remount: a tinted Image must never be reused untinted —
              template rendering sticks and iOS paints it system blue */}
          <Image key="flame-full" source={FLAME_PNG} style={s.flameImgFull} />
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
        <Image key="flame-tinted" source={FLAME_PNG} style={[s.flameImg, { tintColor: '#CDC2A8' }]} />
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
            <Image key="flame-fill" source={FLAME_PNG} style={s.flameImg} />
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
  // The card banks whenever today cannot be written: nothing was scheduled,
  // or every task was laid aside.
  const banked = todayMode === 'no-tasks' || skippedToday;

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

  // The voice keeps pace with the day: reserved while little is done, warm
  // in the middle, expectant near the top. The fire always FILLS — never
  // burns down — and the noun follows what is actually on the card now that
  // the candle row is gone.
  const headline = todayMode === 'no-tasks'
    ? 'A quiet day — nothing is scheduled. The fire keeps its warmth.'
    : todayMode === 'all-skipped'
      ? 'Today was laid aside to rest. Tomorrow the fire is lit again.'
      : todayPct >= 100
        ? 'The day is full — today’s flame is lit.'
        : todayPct >= 70
          ? 'Almost there — the flame is within reach.'
          : todayPct >= 40
            ? 'Good pace — the fire is rising steadily.'
            : todayPct > 0
              ? `Only ${todayPct}% so far — keep feeding today’s fire.`
              : 'The day’s fire awaits its first task.';

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Activity s={15} c={C.gold} />
        <Text style={s.heading}>Your Progress</Text>
      </View>

      <TouchableOpacity style={[s.card, banked && s.cardBanked]} activeOpacity={0.88} onPress={openAnalytics}>
        <LinearGradient
          colors={banked ? BANKED.surface : ['#F8E7BE', '#FFF8E9', '#FFFEFA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <DawnBackdrop muted={banked} />
        {/* No sweep across a resting card — the ember carries the motion. */}
        {!banked && <CardGlint />}

        {/* Hero: today's percentage in the bloom, today's fire radiant */}
        <View style={s.heroRow}>
          <TodayMedallion pct={todayPct} mode={todayMode} />
          <RadiantFlame pct={todayStat?.pct ?? null} mode={todayMode} />
        </View>

        {banked && (
          <RestSeal
            label={skippedToday ? 'SKIPPED' : 'UNWRITTEN'}
            tone={skippedToday ? 'struck' : 'quiet'}
            style={s.restSeal}
          />
        )}

        <Text style={[s.headline, banked && s.headlineBanked]} numberOfLines={2}>{headline}</Text>

        {/* The week band: letters over flame tiles, between hairline rails */}
        <View style={[s.weekBand, banked && s.weekBandBanked]}>
          <View style={s.daysLabelRow}>
            {display.map((d, i) => (
              <View key={i} style={s.weekCol}>
                <Text style={[s.dayLetter, d.isToday && (banked ? s.dayLetterTodayBanked : s.dayLetterToday)]}>{d.letter}</Text>
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
        style={[s.analyticsBtn, banked && s.analyticsBtnBanked]}
      >
        <LinearGradient
          colors={banked ? BANKED.buttonSurface : ['#FBEED0', '#FFFDF7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[s.analyticsDiamond, banked && s.analyticsDiamondBanked]} />
        <BarChart3 s={13} c={banked ? BANKED.inkMuted : C.goldDark} w={2.1} />
        <Text style={[s.analyticsTxt, banked && s.analyticsTxtBanked]}>VIEW ANALYTICS</Text>
        <View style={[s.analyticsDiamond, banked && s.analyticsDiamondBanked]} />
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
  analyticsBtnBanked: { borderColor: BANKED.border },
  analyticsTxt: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 2.2, color: C.goldDark },
  analyticsTxtBanked: { color: BANKED.inkMuted },
  analyticsDiamond: {
    width: 4,
    height: 4,
    borderRadius: 0.5,
    backgroundColor: 'rgba(197,160,89,0.5)',
    transform: [{ rotate: '45deg' }],
  },
  analyticsDiamondBanked: { backgroundColor: BANKED.ashLine },
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
  cardBanked: { borderColor: BANKED.border },
  restSeal: { marginTop: 14 },
  headline: {
    marginTop: 12,
    fontFamily: F.serif,
    fontSize: 14.5,
    lineHeight: 19,
    color: C.textSecondary,
    textAlign: 'center',
  },
  headlineBanked: {
    marginTop: 9,
    fontFamily: F.serifItalic,
    color: BANKED.ink,
  },
  weekBand: {
    marginTop: 14,
    paddingTop: 13,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#EADFC8',
  },
  weekBandBanked: { borderColor: BANKED.rule },
  daysLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekCol: { flex: 1, alignItems: 'center' },
  dayLetter: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 0.9, color: C.textMuted },
  dayLetterToday: { color: C.goldDark },
  dayLetterTodayBanked: { color: BANKED.inkMuted },

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
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D8CDB6',
  },
  emptyStudToday: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.25,
    backgroundColor: BANKED.ember,
  },
  tileSheen: {
    position: 'absolute',
    top: 5,
    left: 8,
    width: 11,
    height: 4,
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
    borderColor: BANKED.ash,
  },
  flameGlow: {
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
});
