import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import Reanimated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  orbitGeometry,
  orbitPoint,
  type OrbitRing,
} from '@/components/prayer/prayerOrbitGeometry';

/* ─────────────────────────────────────────────────────────────
 * THE ORBIT — what the prayer timer does while it runs.
 *
 * Starting a prayer used to change one colour and nothing else, on a
 * screen whose whole subject is that something has begun. So the
 * reading now sits inside an orbit: a hairline ellipse, tilted, with a
 * bead of light travelling it.
 *
 * WHAT MAKES IT READ AS DEPTH, AND IT IS ONE IDEA
 *
 * The ring is drawn TWICE, in two layers, with the numbers between
 * them. The far half of the ellipse is painted in the layer BEHIND the
 * digits; the near half in the layer IN FRONT. The bead crosses from
 * one to the other as it goes round. Nothing here is really
 * three-dimensional — there is no projection and no z — but the eye is
 * given the one cue it actually uses, which is occlusion, and it
 * supplies the rest.
 *
 * ⚠ THE ARITHMETIC IS NOT HERE. It lives in `prayerOrbitGeometry`,
 * which `tests/prayer-orbit.test.ts` checks at every reading this screen
 * produces — because the figure only works if the arc genuinely overlaps
 * the digits, and the first cut of it did not on two of five sizes while
 * looking perfectly fine on the phone it was written against.
 *
 * DEPTH IS ALSO IN THE INK. The far half is fainter than the near half
 * and the bead dims and shrinks as it goes round the back — the same
 * thing atmosphere does to anything far away.
 *
 * ⚠ THE BEAD SHRINKS AS AN SVG RADIUS, NOT AS A VIEW SCALE. Scaling a
 * small view on Android resamples its bitmap and this app has been
 * bitten by that before; `r` on a vector circle is resolution-free.
 *
 * THE CLOCK IS ITS OWN. The app's shared wall-clock would carry the
 * bead forward through a pause and drop it somewhere else on resume;
 * an orbit that teleports while you were not praying is worse than no
 * orbit. This one accumulates only while it runs, so pausing parks the
 * bead exactly where it stood and starting picks it up from there.
 * ───────────────────────────────────────────────────────────── */

const TAU = Math.PI * 2;
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const AnimatedPath = Reanimated.createAnimatedComponent(Path);
const AnimatedEllipse = Reanimated.createAnimatedComponent(Ellipse);

/** How long one lap takes. Slow: this is a prayer, not a stopwatch. */
const LAP_MS = { outer: 7400, inner: 11900 } as const;

/** How long the orbit takes to kindle when the prayer begins. */
const IGNITION_MS = 620;
const RESTING_MS = 340;

/**
 * The one value the whole screen lights from.
 *
 * ⚠ IT IS OWNED BY THE SCREEN AND HANDED DOWN, not made in three places.
 * The orbit, the reading's ink and the start button all brighten on this
 * — and if each kept its own copy they would agree today and drift the
 * first time somebody tuned one curve.
 */
export function useIgnition(running: boolean): SharedValue<number> {
  const ignition = useSharedValue(running ? 1 : 0);

  useEffect(() => {
    ignition.value = withTiming(running ? 1 : 0, {
      duration: running ? IGNITION_MS : RESTING_MS,
      easing: running ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
    });
  }, [ignition, running]);

  return ignition;
}

export default function PrayerOrbit({
  /** The measured size of the reading this orbits. */
  readout,
  running,
  ignition,
  tint,
  children,
}: {
  readout: { width: number; height: number };
  running: boolean;
  ignition: SharedValue<number>;
  tint: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const spin = useSharedValue(0);
  const spinInner = useSharedValue(0);
  const life = ignition;

  useEffect(() => {
    if (!running || reduceMotion) {
      // Parked, not reset. The bead waits where the prayer left it.
      cancelAnimation(spin);
      cancelAnimation(spinInner);
      return;
    }
    // withRepeat replays the same leg — from wherever the bead stands to
    // one lap on — so cancelling mid-lap and re-arming from the new value
    // is seamless, and the worklet only ever reads the fraction.
    spin.value = withRepeat(
      withTiming(spin.value + 1, { duration: LAP_MS.outer, easing: Easing.linear }), -1, false);
    spinInner.value = withRepeat(
      withTiming(spinInner.value + 1, { duration: LAP_MS.inner, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(spinInner);
    };
  }, [reduceMotion, running, spin, spinInner]);

  const geometry = useMemo(
    () => orbitGeometry(readout),
    [readout],
  );

  const spins = [spin, spinInner];

  return (
    <View style={[s.box, { width: geometry.boxW, height: geometry.boxH }]}>
      {/* ── Behind the numbers: the far side of both orbits ─────────── */}
      <Svg
        pointerEvents="none"
        width={geometry.boxW}
        height={geometry.boxH}
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient id="prayerOrbitBloom" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tint} stopOpacity={0.22} />
            <Stop offset="0.55" stopColor={tint} stopOpacity={0.08} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* The light the reading stands in once it is running. */}
        <Bloom
          cx={geometry.cx}
          cy={geometry.cy}
          rx={geometry.boxW / 2}
          ry={geometry.boxH / 2}
          life={life}
        />

        {geometry.rings.map((ring, index) => (
          <Arc
            key={`far-${index}`}
            d={geometry.paths[index].far}
            tint={tint}
            base={ring.ink.far}
            width={1}
            life={life}
          />
        ))}
        {geometry.rings.map((ring, index) => (
          <Bead
            key={`far-bead-${index}`}
            ring={ring}
            cx={geometry.cx}
            cy={geometry.cy}
            spin={spins[index]}
            life={life}
            tint={tint}
            side="far"
          />
        ))}
      </Svg>

      {children}

      {/* ── In front of the numbers: the near side ──────────────────── */}
      <Svg
        pointerEvents="none"
        width={geometry.boxW}
        height={geometry.boxH}
        style={StyleSheet.absoluteFill}
      >
        {geometry.rings.map((ring, index) => (
          <Arc
            key={`near-${index}`}
            d={geometry.paths[index].near}
            tint={tint}
            base={ring.ink.near}
            width={1.2}
            life={life}
          />
        ))}
        {geometry.rings.map((ring, index) => (
          <Bead
            key={`near-bead-${index}`}
            ring={ring}
            cx={geometry.cx}
            cy={geometry.cy}
            spin={spins[index]}
            life={life}
            tint={tint}
            side="near"
          />
        ))}
      </Svg>
    </View>
  );
}

/**
 * One half of one ring.
 *
 * At rest it does not vanish — it holds at a sixth of its strength, so
 * the reading keeps the socket it lives in and starting the prayer
 * brightens something that was already there rather than conjuring a
 * figure out of nothing.
 */
function Arc({
  d, tint, base, width, life,
}: {
  d: string;
  tint: string;
  base: number;
  width: number;
  life: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => ({
    opacity: base * (0.16 + 0.84 * life.value),
  }));

  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={tint}
      strokeWidth={width}
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  );
}

/**
 * The pool of light the reading stands in.
 *
 * ⚠ AN ELLIPSE FITTED TO THE BOX, not a circle. react-native-svg clips
 * its children to the surface, and a round bloom sized to the box's
 * WIDTH is still at nearly a tenth of its strength where the box's much
 * shorter height cuts it — which draws a hard horizontal line across
 * the reading, exactly the edge a glow must not have. Fitted to both
 * axes it reaches nothing at every edge it meets.
 */
function Bloom({
  cx, cy, rx, ry, life,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  life: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => ({ opacity: life.value }));
  return (
    <AnimatedEllipse
      cx={cx}
      cy={cy}
      rx={rx}
      ry={ry}
      fill="url(#prayerOrbitBloom)"
      animatedProps={animatedProps}
    />
  );
}

/**
 * The travelling light.
 *
 * Both layers hold a copy and each shows only while the bead is on its
 * own side. The handover is a short fade rather than a switch: over a
 * narrow band around the ellipse's edge both copies are partly lit, and
 * because they stand at the same coordinates the crossing cannot be
 * seen — a hard swap would flicker for a frame at each end.
 */
function Bead({
  ring, cx, cy, spin, life, tint, side,
}: {
  ring: OrbitRing;
  cx: number;
  cy: number;
  spin: SharedValue<number>;
  life: SharedValue<number>;
  tint: string;
  side: 'near' | 'far';
}) {
  // ⚠ Both worklets call `orbitPoint` — the same function the paths and the
  // tests are built on — rather than keeping the ellipse's formula inline.
  // Two copies of a formula become two different formulas the first time
  // one of them is tuned.
  const animatedProps = useAnimatedProps(() => {
    const p = orbitPoint(ring, ((spin.value + ring.phase) % 1) * TAU, cx, cy);
    // 0 at the far pole, 1 at the near one.
    const near = (p.depth + 1) / 2;
    const facing = side === 'near' ? p.depth : -p.depth;
    const shown = Math.min(1, Math.max(0, facing / 0.09));

    return {
      cx: p.x,
      cy: p.y,
      r: ring.beadR * (0.68 + near * 0.62),
      opacity: shown * life.value * (side === 'near' ? 0.45 + near * 0.55 : 0.2 + near * 0.3),
    };
  });

  const haloProps = useAnimatedProps(() => {
    const p = orbitPoint(ring, ((spin.value + ring.phase) % 1) * TAU, cx, cy);
    const near = (p.depth + 1) / 2;
    const shown = Math.min(1, Math.max(0, p.depth / 0.09));

    return {
      cx: p.x,
      cy: p.y,
      r: ring.beadR * 3.4,
      opacity: shown * life.value * near * 0.22,
    };
  });

  return (
    <>
      {/* Only the near copy carries a halo: light spilling off something
          that is behind the numbers would be light coming through them. */}
      {side === 'near' && (
        <AnimatedCircle fill={tint} animatedProps={haloProps} cx={cx} cy={cy} r={1} />
      )}
      <AnimatedCircle fill={tint} animatedProps={animatedProps} cx={cx} cy={cy} r={1} />
    </>
  );
}

const s = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});

/**
 * The reading's own colour, travelling rather than switching.
 *
 * The digits used to flip to the accent the instant `running` changed,
 * while everything around them eased — the tell of a colour driven by
 * React state instead of by the same animation as its surroundings.
 * On the ignition value, the reading warms exactly as the ring kindles.
 */
export function useReadoutInk(ignition: SharedValue<number>, from: string, to: string) {
  return useAnimatedStyle(() => ({
    color: interpolateColor(ignition.value, [0, 1], [from, to]),
  }), [from, to]);
}
