import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// The quiet "instrument face" behind Screen Time cards: a laid-paper weave of
// diagonal hairlines across the whole surface, and an orbit system in the top
// right — dashed and solid rings around a 24-tick bezel (the day-clock echo),
// with satellite nodes on the rings. Everything draws in the plan's own
// colors, barely above the gradient. A live card (today's active plan) must
// read as unmistakably alive next to the still ones: the ringed satellite
// travels its orbit with a counter-node opposite it, the main orbit breathes,
// and every few seconds a soft glint sweeps across the card.

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type BackdropVisual = {
  accent: string;
  bloom: string;
};

const SATELLITE_START_ANGLE = -2.1;

function OrbitingSatellite({
  cx,
  radius,
  accent,
  live,
}: {
  cx: number;
  radius: number;
  accent: string;
  live: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  const animate = live && !reduceMotion;

  useEffect(() => {
    if (animate) {
      t.value = 0;
      t.value = withRepeat(
        withTiming(1, { duration: 26000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      cancelAnimation(t);
      t.value = 0;
    }
    return () => cancelAnimation(t);
  }, [animate, t]);

  const ringProps = useAnimatedProps(() => {
    const angle = SATELLITE_START_ANGLE + t.value * Math.PI * 2;
    return {
      cx: cx + radius * Math.cos(angle),
      cy: cx + radius * Math.sin(angle),
    };
  });
  const dotProps = useAnimatedProps(() => {
    const angle = SATELLITE_START_ANGLE + t.value * Math.PI * 2;
    return {
      cx: cx + radius * Math.cos(angle),
      cy: cx + radius * Math.sin(angle),
    };
  });
  // A small counter-node half a revolution behind: while the satellite is off
  // the card's edge, this one is inside it — the orbit never looks frozen.
  const counterProps = useAnimatedProps(() => {
    const angle = SATELLITE_START_ANGLE + Math.PI + t.value * Math.PI * 2;
    return {
      cx: cx + radius * Math.cos(angle),
      cy: cx + radius * Math.sin(angle),
    };
  });

  return (
    <>
      <AnimatedCircle
        animatedProps={ringProps}
        r={4.6}
        stroke={accent}
        strokeOpacity={0.3}
        strokeWidth={1}
        fill="none"
      />
      <AnimatedCircle
        animatedProps={dotProps}
        r={2.2}
        fill={accent}
        fillOpacity={0.36}
      />
      <AnimatedCircle
        animatedProps={counterProps}
        r={1.8}
        fill={accent}
        fillOpacity={0.28}
      />
    </>
  );
}

// The main orbit slowly brightens and settles — a breath, not a blink.
function BreathingOrbit({
  cx,
  radius,
  accent,
  live,
}: {
  cx: number;
  radius: number;
  accent: string;
  live: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  const animate = live && !reduceMotion;

  useEffect(() => {
    if (animate) {
      t.value = 0;
      t.value = withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      );
    } else {
      cancelAnimation(t);
      t.value = 0;
    }
    return () => cancelAnimation(t);
  }, [animate, t]);

  const orbitProps = useAnimatedProps(() => ({
    strokeOpacity: 0.2 + t.value * 0.16,
  }));

  return (
    <AnimatedCircle
      animatedProps={orbitProps}
      cx={cx}
      cy={cx}
      r={radius}
      stroke={accent}
      strokeWidth={1}
      fill="none"
    />
  );
}

// A soft light band that sweeps the card every few seconds — the "glint" that
// marks the active plan. Same grammar as the FocusMeter sheen.
function LiveGlint({ boxW, boxH }: { boxW: number; boxH: number }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: 6800, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.06, 0.3, 0.4, 1], [0, 0.7, 0.7, 0, 0]),
    transform: [
      { translateX: interpolate(t.value, [0, 0.4, 1], [-96, boxW + 48, boxW + 48]) },
      { rotate: '14deg' },
    ],
  }));

  if (reduceMotion) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: -boxH * 0.25, height: boxH * 1.5, width: 68 }, style]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.46)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

export default function PlanCardBackdrop({
  visual,
  compact = false,
  ringSize,
  live = false,
}: {
  visual: BackdropVisual;
  compact?: boolean;
  ringSize?: number;   // override the orbit system's footprint
  live?: boolean;      // today's active plan: the satellite travels its orbit
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const ring = ringSize ?? (compact ? 150 : 230);
  const cx = ring / 2;

  // Diagonal hairlines: one line every `step` px along the top edge, drawn at
  // 45° so together they read as a fine woven texture, not stripes.
  const step = 30;
  const lineCount = box.w > 0 ? Math.ceil((box.w + box.h) / step) + 1 : 0;

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
                stroke={visual.accent}
                strokeOpacity={0.045}
                strokeWidth={1}
              />
            );
          })}
        </Svg>
      )}
      <View
        style={{
          position: 'absolute',
          right: -ring * 0.26,
          top: -ring * 0.30,
          width: ring,
          height: ring,
          borderRadius: ring / 2,
          backgroundColor: visual.bloom,
          opacity: 0.5,
        }}
      />
      <Svg
        width={ring}
        height={ring}
        style={{ position: 'absolute', right: -ring * 0.26, top: -ring * 0.30 }}
      >
        {/* Outer orbit — fine dotted */}
        <Circle cx={cx} cy={cx} r={ring * 0.47} stroke={visual.accent} strokeOpacity={0.13} strokeWidth={1} fill="none" strokeDasharray="1 6" />
        {/* Main solid orbit — breathes on a live card */}
        <BreathingOrbit cx={cx} radius={ring * 0.385} accent={visual.accent} live={live} />
        {/* Bezel ring: 24 hour ticks, the day-clock echo */}
        {Array.from({ length: 24 }).map((_, index) => {
          const angle = (index / 24) * Math.PI * 2;
          const strong = index % 6 === 0;
          const r1 = ring * (strong ? 0.285 : 0.295);
          const r2 = ring * 0.325;
          return (
            <Line
              key={index}
              x1={cx + r1 * Math.cos(angle)}
              y1={cx + r1 * Math.sin(angle)}
              x2={cx + r2 * Math.cos(angle)}
              y2={cx + r2 * Math.sin(angle)}
              stroke={visual.accent}
              strokeOpacity={strong ? 0.26 : 0.15}
              strokeWidth={strong ? 1.3 : 1}
            />
          );
        })}
        {/* Inner orbits */}
        <Circle cx={cx} cy={cx} r={ring * 0.22} stroke={visual.accent} strokeOpacity={0.14} strokeWidth={1} fill="none" strokeDasharray="1 4" />
        <Circle cx={cx} cy={cx} r={ring * 0.135} stroke={visual.accent} strokeOpacity={0.1} strokeWidth={1} fill="none" />
        {/* Center */}
        <Circle cx={cx} cy={cx} r={2.2} fill={visual.accent} fillOpacity={0.24} />
        {/* Orbit nodes: a ringed satellite on the main orbit, plain dots elsewhere */}
        <OrbitingSatellite cx={cx} radius={ring * 0.385} accent={visual.accent} live={live} />
        <Circle
          cx={cx + ring * 0.47 * Math.cos(-0.7)}
          cy={cx + ring * 0.47 * Math.sin(-0.7)}
          r={1.7}
          fill={visual.accent}
          fillOpacity={0.22}
        />
        <Circle
          cx={cx + ring * 0.22 * Math.cos(2.6)}
          cy={cx + ring * 0.22 * Math.sin(2.6)}
          r={1.8}
          fill={visual.accent}
          fillOpacity={0.26}
        />
        <Circle
          cx={cx + ring * 0.47 * Math.cos(2.0)}
          cy={cx + ring * 0.47 * Math.sin(2.0)}
          r={1.4}
          fill={visual.accent}
          fillOpacity={0.18}
        />
      </Svg>
      {live && box.w > 0 && <LiveGlint boxW={box.w} boxH={box.h} />}
    </View>
  );
}
