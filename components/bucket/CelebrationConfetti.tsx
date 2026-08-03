import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop, Ellipse } from 'react-native-svg';

// The two things a celebration was missing.
//
// The burst that already existed throws everything outward once, from a point
// that mostly sits behind the card — a pop, and then nothing. What reads as
// CELEBRATION is weather: paper falling across the whole screen for as long as
// you are looking at it. And what reads as GLORY, in an app that speaks this
// language, is light radiating from behind the thing you earned.
//
// Both run off a single shared value each, on the UI thread. Twenty-four flakes
// cost twenty-four transforms per frame and not one React render.

const GOLD = '#C5A059';
const DEEP_GOLD = '#A9782C';
const CREAM = '#FFF3D2';
const ROSE = '#EFB3A7';
const SKY = '#A9CFD3';

export type ParticleShape = 'diamond' | 'leaf' | 'dot' | 'ray' | 'ribbon';

export function ParticleGlyph({ shape, color }: { shape: ParticleShape; color: string }) {
  if (shape === 'ray') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 12 34">
        <Path d="M6 1.5 C8.4 9.8 8.2 23.9 6 32.5 C3.8 23.9 3.6 9.8 6 1.5 Z" fill={color} />
        <Path d="M6 5.5 C6.8 12.2 6.8 22 6 28.4" stroke="#FFFDF2" strokeWidth={1.2} strokeLinecap="round" opacity={0.62} />
      </Svg>
    );
  }
  if (shape === 'leaf') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 18 24">
        <Path d="M9 2 C15 6.8 15.2 16.3 9 22 C2.8 16.3 3 6.8 9 2 Z" fill={color} />
        <Path d="M9 5.7 C10 10.1 9.9 15.3 9 19" stroke="#FFF9E6" strokeWidth={1.1} strokeLinecap="round" opacity={0.58} />
      </Svg>
    );
  }
  if (shape === 'ribbon') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 34 14">
        <Path d="M2 8 C9 0 17 16 32 5" fill="none" stroke={color} strokeWidth={4.2} strokeLinecap="round" />
        <Path d="M4 7.5 C10 2.8 17 12.6 29 5.5" fill="none" stroke="#FFF8E2" strokeWidth={1.3} strokeLinecap="round" opacity={0.72} />
      </Svg>
    );
  }
  if (shape === 'diamond') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 18 18">
        <Path d="M9 1.5 L16.5 9 L9 16.5 L1.5 9 Z" fill={color} />
        <Path d="M9 4.3 L13.7 9 L9 13.7 L4.3 9 Z" fill="#FFF9E9" opacity={0.62} />
      </Svg>
    );
  }
  return (
    <Svg width="100%" height="100%" viewBox="0 0 14 14">
      <Circle cx={7} cy={7} r={5.2} fill={color} />
      <Circle cx={5.1} cy={4.7} r={1.35} fill="#FFFDF2" opacity={0.8} />
    </Svg>
  );
}

// ── Falling paper ──────────────────────────────────────────────────────────
// Each flake carries its own phase into one shared clock, so the field is
// already mid-fall when it appears rather than starting as a tidy row, and it
// wraps seamlessly for as long as the overlay is up.

type Flake = {
  /** Where it falls, as a fraction of the screen width. */
  x: number;
  size: number;
  /** Offset into the shared cycle, 0–1. Staggers the field. */
  phase: number;
  /** How many cycles it completes per turn of the clock — its fall speed. */
  speed: number;
  /** Sideways drift in points, and how many times it swings on the way down. */
  sway: number;
  swayTurns: number;
  swayPhase: number;
  /** Degrees turned over one fall, plus where it starts. */
  spin: number;
  tilt: number;
  /** How many times it turns edge-on during one fall — the paper tumble. */
  flutter: number;
  /** Near flakes are bigger and more solid, far ones smaller and fainter. */
  depth: number;
  color: string;
  shape: ParticleShape;
};

const FLAKES: Flake[] = [
  // Near — big, quick, solid, tumbling hard.
  { x: 0.04, size: 14, phase: 0.00, speed: 1.16, sway: 26, swayTurns: 2.0, swayPhase: 0.00, spin: 420, tilt: 12, flutter: 2.4, depth: 1.14, color: GOLD, shape: 'ribbon' },
  { x: 0.23, size: 16, phase: 0.19, speed: 1.24, sway: 20, swayTurns: 2.3, swayPhase: 0.15, spin: -480, tilt: 25, flutter: 3.1, depth: 1.10, color: SKY, shape: 'ribbon' },
  { x: 0.47, size: 15, phase: 0.33, speed: 1.20, sway: 33, swayTurns: 1.5, swayPhase: 0.20, spin: -450, tilt: 50, flutter: 2.7, depth: 1.16, color: ROSE, shape: 'ribbon' },
  { x: 0.71, size: 17, phase: 0.94, speed: 1.28, sway: 30, swayTurns: 1.6, swayPhase: 0.35, spin: -405, tilt: 44, flutter: 3.4, depth: 1.08, color: DEEP_GOLD, shape: 'ribbon' },
  { x: 0.89, size: 14, phase: 0.09, speed: 1.18, sway: 29, swayTurns: 1.7, swayPhase: 0.50, spin: 435, tilt: 15, flutter: 2.2, depth: 1.12, color: GOLD, shape: 'leaf' },
  { x: 0.36, size: 15, phase: 0.55, speed: 1.22, sway: 24, swayTurns: 1.8, swayPhase: 0.68, spin: -390, tilt: 34, flutter: 2.9, depth: 1.06, color: CREAM, shape: 'ribbon' },
  { x: 0.60, size: 13, phase: 0.77, speed: 1.30, sway: 31, swayTurns: 2.1, swayPhase: 0.11, spin: 450, tilt: 58, flutter: 3.6, depth: 1.10, color: ROSE, shape: 'leaf' },

  // Mid — the body of the field.
  { x: 0.11, size: 10, phase: 0.42, speed: 0.98, sway: 15, swayTurns: 2.6, swayPhase: 0.30, spin: -300, tilt: 40, flutter: 1.9, depth: 0.96, color: CREAM, shape: 'dot' },
  { x: 0.17, size: 12, phase: 0.78, speed: 0.92, sway: 31, swayTurns: 1.7, swayPhase: 0.60, spin: 360, tilt: 0, flutter: 2.3, depth: 0.98, color: ROSE, shape: 'leaf' },
  { x: 0.29, size: 11, phase: 0.61, speed: 1.02, sway: 28, swayTurns: 1.9, swayPhase: 0.75, spin: 330, tilt: 60, flutter: 2.6, depth: 0.94, color: DEEP_GOLD, shape: 'diamond' },
  { x: 0.41, size: 9, phase: 0.87, speed: 0.95, sway: 24, swayTurns: 2.1, swayPhase: 0.90, spin: 300, tilt: 33, flutter: 1.7, depth: 1.00, color: GOLD, shape: 'dot' },
  { x: 0.53, size: 12, phase: 0.70, speed: 1.06, sway: 19, swayTurns: 2.5, swayPhase: 0.55, spin: 375, tilt: 18, flutter: 2.8, depth: 0.92, color: CREAM, shape: 'diamond' },
  { x: 0.59, size: 13, phase: 0.14, speed: 0.90, sway: 27, swayTurns: 1.8, swayPhase: 0.05, spin: -345, tilt: 70, flutter: 2.1, depth: 1.02, color: SKY, shape: 'leaf' },
  { x: 0.77, size: 12, phase: 0.26, speed: 1.04, sway: 22, swayTurns: 2.4, swayPhase: 0.80, spin: 360, tilt: 22, flutter: 2.5, depth: 0.96, color: CREAM, shape: 'ray' },
  { x: 0.83, size: 11, phase: 0.66, speed: 0.94, sway: 25, swayTurns: 2.0, swayPhase: 0.10, spin: -315, tilt: 55, flutter: 3.0, depth: 0.99, color: ROSE, shape: 'diamond' },
  { x: 0.08, size: 11, phase: 0.58, speed: 1.00, sway: 23, swayTurns: 2.2, swayPhase: 0.70, spin: 390, tilt: 30, flutter: 2.2, depth: 0.93, color: CREAM, shape: 'diamond' },
  { x: 0.20, size: 13, phase: 0.91, speed: 0.88, sway: 32, swayTurns: 1.4, swayPhase: 0.40, spin: -420, tilt: 3, flutter: 1.8, depth: 1.03, color: GOLD, shape: 'ribbon' },
  { x: 0.44, size: 12, phase: 0.74, speed: 0.97, sway: 26, swayTurns: 1.9, swayPhase: 0.12, spin: -360, tilt: 27, flutter: 2.4, depth: 0.95, color: DEEP_GOLD, shape: 'leaf' },
  { x: 0.56, size: 14, phase: 0.22, speed: 0.86, sway: 34, swayTurns: 1.5, swayPhase: 0.58, spin: 465, tilt: 62, flutter: 3.2, depth: 1.00, color: SKY, shape: 'ribbon' },
  { x: 0.68, size: 11, phase: 0.83, speed: 1.08, sway: 21, swayTurns: 2.5, swayPhase: 0.28, spin: -330, tilt: 10, flutter: 2.0, depth: 0.97, color: CREAM, shape: 'ray' },
  { x: 0.80, size: 12, phase: 0.30, speed: 0.99, sway: 24, swayTurns: 2.1, swayPhase: 0.95, spin: 405, tilt: 38, flutter: 2.7, depth: 0.94, color: GOLD, shape: 'diamond' },
  { x: 0.92, size: 13, phase: 0.65, speed: 0.91, sway: 28, swayTurns: 1.8, swayPhase: 0.48, spin: -375, tilt: 72, flutter: 2.3, depth: 1.01, color: ROSE, shape: 'leaf' },
  { x: 0.14, size: 10, phase: 0.36, speed: 1.05, sway: 20, swayTurns: 2.7, swayPhase: 0.22, spin: 345, tilt: 46, flutter: 1.6, depth: 0.98, color: SKY, shape: 'diamond' },
  { x: 0.50, size: 13, phase: 0.48, speed: 0.93, sway: 29, swayTurns: 1.6, swayPhase: 0.83, spin: -435, tilt: 7, flutter: 2.9, depth: 1.04, color: GOLD, shape: 'ray' },
  { x: 0.86, size: 12, phase: 0.16, speed: 1.01, sway: 23, swayTurns: 2.2, swayPhase: 0.37, spin: 375, tilt: 52, flutter: 2.5, depth: 0.96, color: DEEP_GOLD, shape: 'leaf' },

  // Far — small, slow, faint. They are what gives the field its depth.
  { x: 0.35, size: 8, phase: 0.05, speed: 0.74, sway: 17, swayTurns: 2.8, swayPhase: 0.45, spin: -390, tilt: 8, flutter: 1.4, depth: 0.76, color: CREAM, shape: 'ray' },
  { x: 0.65, size: 7, phase: 0.52, speed: 0.70, sway: 14, swayTurns: 3.0, swayPhase: 0.65, spin: 420, tilt: 5, flutter: 1.2, depth: 0.72, color: GOLD, shape: 'dot' },
  { x: 0.95, size: 7, phase: 0.47, speed: 0.78, sway: 16, swayTurns: 2.7, swayPhase: 0.25, spin: -285, tilt: 66, flutter: 1.5, depth: 0.78, color: SKY, shape: 'dot' },
  { x: 0.32, size: 8, phase: 0.37, speed: 0.72, sway: 18, swayTurns: 2.9, swayPhase: 0.85, spin: 345, tilt: 48, flutter: 1.3, depth: 0.74, color: ROSE, shape: 'dot' },
  { x: 0.02, size: 8, phase: 0.68, speed: 0.76, sway: 19, swayTurns: 2.4, swayPhase: 0.53, spin: -270, tilt: 20, flutter: 1.6, depth: 0.80, color: GOLD, shape: 'diamond' },
  { x: 0.26, size: 7, phase: 0.13, speed: 0.68, sway: 15, swayTurns: 3.1, swayPhase: 0.07, spin: 315, tilt: 64, flutter: 1.1, depth: 0.70, color: CREAM, shape: 'dot' },
  { x: 0.62, size: 9, phase: 0.89, speed: 0.80, sway: 21, swayTurns: 2.6, swayPhase: 0.72, spin: -300, tilt: 36, flutter: 1.7, depth: 0.82, color: DEEP_GOLD, shape: 'leaf' },
  { x: 0.74, size: 7, phase: 0.44, speed: 0.71, sway: 16, swayTurns: 2.9, swayPhase: 0.18, spin: 330, tilt: 9, flutter: 1.2, depth: 0.73, color: ROSE, shape: 'dot' },
  { x: 0.98, size: 8, phase: 0.24, speed: 0.77, sway: 13, swayTurns: 3.2, swayPhase: 0.61, spin: -345, tilt: 42, flutter: 1.5, depth: 0.79, color: CREAM, shape: 'diamond' },
];

// One fall, top to bottom, at speed 1.
const FALL_CYCLE_MS = 5200;

// The clock counts turns and never resets. withRepeat would snap it back to
// zero, and since no flake's speed is a whole number, every flake in the field
// would jump at that instant — one visible stutter every cycle. Counting up
// instead means a flake only ever wraps on its own, behind its own edge fade.
const FALL_TURNS = 60;

// How long the paper keeps falling if nobody dismisses the celebration.
const FALL_SETTLE_MS = 10000;

function glyphBox(shape: ParticleShape, size: number) {
  const width = shape === 'ribbon' ? size * 2.35 : shape === 'ray' ? size * 0.72 : size;
  const height = shape === 'ribbon' ? size : shape === 'ray' ? size * 2.05 : shape === 'leaf' ? size * 1.48 : size;
  return { width, height };
}

function FallingFlake({
  flake,
  clock,
  fade,
  travel,
  left,
}: {
  flake: Flake;
  clock: SharedValue<number>;
  fade: SharedValue<number>;
  travel: number;
  left: number;
}) {
  const { width, height } = glyphBox(flake.shape, flake.size);

  const style = useAnimatedStyle(() => {
    // Its own progress down the screen: the shared clock, taken at its own
    // speed and offset. The clock only ever counts up, so this wraps when THIS
    // flake reaches the bottom and never when the clock does.
    const raw = clock.value * flake.speed + flake.phase;
    const t = raw - Math.floor(raw);

    // The edges of the field are soft — paper appears above the screen and is
    // gone before it reaches the very bottom. The flat dead bands at either end
    // matter: a flake recycles somewhere inside them, so it is at exactly zero
    // opacity for several frames on both sides of its wrap and the recycle can
    // never be seen. Fading merely *towards* zero left a frame at 4%.
    const edge = t < 0.02
      ? 0
      : t < 0.10
        ? (t - 0.02) / 0.08
        : t > 0.97
          ? 0
          : t > 0.88
            ? (0.97 - t) / 0.09
            : 1;

    // Paper tumbles: it turns edge-on and back as it falls. Passing through
    // zero width is the whole effect, so the cosine is used raw — the glyph
    // flattens, vanishes for an instant, and comes back showing its other side.
    const flutter = Math.cos((t * flake.flutter + flake.swayPhase * 0.7 + 0.31) * Math.PI * 2);

    return {
      opacity: edge * fade.value * (0.62 + flake.depth * 0.34),
      transform: [
        { translateY: -height - 20 + t * travel },
        { translateX: Math.sin((t * flake.swayTurns + flake.swayPhase) * Math.PI * 2) * flake.sway },
        { rotate: `${flake.tilt + t * flake.spin}deg` },
        { scaleX: flutter },
        { scale: flake.depth },
      ],
    };
  });

  return (
    <Reanimated.View pointerEvents="none" style={[s.flake, { left, width, height }, style]}>
      <ParticleGlyph shape={flake.shape} color={flake.color} />
    </Reanimated.View>
  );
}

export default function FallingConfetti({
  width,
  height,
  active,
  reduceMotion = false,
}: {
  width: number;
  height: number;
  /** Goes false on dismiss; the field fades rather than vanishing. */
  active: boolean;
  reduceMotion?: boolean;
}) {
  const clock = useSharedValue(0);
  const fade = useSharedValue(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    // One long, strictly linear count. No repeat, so there is no instant at
    // which the whole field is repositioned together.
    clock.value = withTiming(FALL_TURNS, {
      duration: FALL_TURNS * FALL_CYCLE_MS,
      easing: Easing.linear,
    });
    // Weather passes. If the overlay is left standing, the field thins out and
    // the clock stops rather than turning frames forever.
    const timer = setTimeout(() => setSettled(true), FALL_SETTLE_MS);
    return () => {
      clearTimeout(timer);
      cancelAnimation(clock);
    };
  }, [clock, reduceMotion]);

  useEffect(() => {
    const showing = active && !settled;
    fade.value = withTiming(showing ? 1 : 0, {
      duration: showing ? 420 : active ? 1400 : 220,
      easing: Easing.out(Easing.quad),
    }, finished => {
      // Nothing to draw any more — let the clock go.
      if (finished && !showing) cancelAnimation(clock);
    });
  }, [active, clock, fade, settled]);

  if (reduceMotion) return null;

  const travel = height + 120;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.field]}>
      {FLAKES.map((flake, index) => (
        <FallingFlake
          key={index}
          flake={flake}
          clock={clock}
          fade={fade}
          travel={travel}
          left={flake.x * width - glyphBox(flake.shape, flake.size).width / 2}
        />
      ))}
    </View>
  );
}

// ── The glory ──────────────────────────────────────────────────────────────
// A fan of tapering rays turning slowly behind what was earned. It is the halo
// this app already draws around its seals, opened out — and it is what makes a
// trophy read as given rather than placed.

const RAY_COUNT = 16;

function rayPath(index: number, count: number) {
  const step = 360 / count;
  const half = step * 0.19;
  const a0 = deg(index * step - half);
  const a1 = deg(index * step + half);
  const inner = 15;
  const outer = 50;
  const x0 = 50 + Math.cos(a0) * inner;
  const y0 = 50 + Math.sin(a0) * inner;
  const x1 = 50 + Math.cos(a0) * outer;
  const y1 = 50 + Math.sin(a0) * outer;
  const x2 = 50 + Math.cos(a1) * outer;
  const y2 = 50 + Math.sin(a1) * outer;
  const x3 = 50 + Math.cos(a1) * inner;
  const y3 = 50 + Math.sin(a1) * inner;
  return `M${x0} ${y0} L${x1} ${y1} L${x2} ${y2} L${x3} ${y3} Z`;
}

function deg(value: number) {
  return (value * Math.PI) / 180;
}

export function GloryRays({
  size,
  phase,
  reduceMotion = false,
}: {
  size: number;
  /** The overlay's arrival value — the fan opens with everything else. */
  phase: SharedValue<number>;
  reduceMotion?: boolean;
}) {
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(
      withTiming(1, { duration: 26000, easing: Easing.linear }),
      -1,
      false
    );
  }, [reduceMotion, spin]);

  const style = useAnimatedStyle(() => {
    const t = phase.value;
    return {
      opacity: Math.min(1, t * 1.6) * 0.9,
      transform: [
        { rotate: `${spin.value * 360}deg` },
        { scale: 0.72 + t * 0.28 },
      ],
    };
  });

  return (
    <Reanimated.View pointerEvents="none" style={[s.rays, { width: size, height: size }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="glory-fade" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={GOLD} stopOpacity={0.42} />
            <Stop offset="52%" stopColor={GOLD} stopOpacity={0.2} />
            <Stop offset="100%" stopColor={GOLD} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {Array.from({ length: RAY_COUNT }, (_, index) => (
          <Path key={index} d={rayPath(index, RAY_COUNT)} fill="url(#glory-fade)" />
        ))}
      </Svg>
    </Reanimated.View>
  );
}

// ── The light the whole screen is lit by ───────────────────────────────────
// A warm pool gathered where the trophy stands, dying out well before the
// edges, so the veil reads as a lit room instead of a flat wash of cream.
export function VeilBloom({
  width,
  height,
  centerY,
}: {
  width: number;
  height: number;
  centerY: number;
}) {
  const size = Math.max(width * 1.7, 520);
  return (
    <View
      pointerEvents="none"
      style={[s.bloom, { width: size, height: size, left: (width - size) / 2, top: centerY - size / 2 }]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="veil-bloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFF0C8" stopOpacity={0.95} />
            <Stop offset="42%" stopColor="#FFF6DF" stopOpacity={0.55} />
            <Stop offset="100%" stopColor="#FFF6DF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={50} cy={50} rx={50} ry={50} fill="url(#veil-bloom)" />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  field: { zIndex: 26, elevation: 26 },
  flake: { position: 'absolute', top: 0 },
  rays: { position: 'absolute' },
  bloom: { position: 'absolute' },
});
