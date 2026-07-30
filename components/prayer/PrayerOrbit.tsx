import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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
  ORBIT_HALO_MUL,
  orbitGeometry,
  orbitPoint,
  type OrbitRing,
} from '@/components/prayer/prayerOrbitGeometry';
import { MINE_ACCENT } from '@/components/prayer/myRuleTone';

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

/**
 * WHAT THE ORBIT IS DRAWN IN — its own colour, never the hour's.
 *
 * ⚠ THIS IS THE FIX FOR GOLD ON GOLD. The orbit used to take the same
 * accent the reading warms into, so on the default hour a gold ring lay
 * over gold digits and the two dissolved into each other. Tying it to
 * the theme could only ever move that collision to another hour.
 *
 * It is MY RULE'S OWN DOVE BLUE — `MINE_ACCENT`, the colour this app
 * already assigned to this exact rule, and the colour of the page this
 * screen is launched from. Three things follow from it and all three
 * are the point:
 *
 *   · it is COOL, against warm paper and gold digits, so nothing has to
 *     fight for the same part of the spectrum;
 *   · it is CALM. A prayer screen is not a place to be alerted;
 *   · and it already belongs here, so the orbit reads as part of My Rule
 *     rather than as an effect laid on top of it.
 *
 * ⚠ IT WAS CINNABAR FOR ONE REVISION AND THAT WAS WRONG. Red beside gold
 * is a beautiful manuscript pairing and a bad idea here: red is the
 * app's own colour for destructive things — the Exit dialog on this very
 * screen is drawn in it — and more simply, a red light circling the
 * numbers while you pray is an alarm. Do not go back to it.
 *
 * The bead keeps a cool halo and a white heart, so what travels the ring
 * reads as a small pearl of light rather than as a coloured dot.
 */
const ORBIT = {
  ring: MINE_ACCENT,
  body: '#6E8DAF',
  halo: '#AFC6DC',
  core: '#FFFFFF',
} as const;

/** One circle riding the ring, and where in the stack it sits. */
type DotSpec = {
  /** How far behind the bead it rides, in laps. 0 is the bead itself. */
  lag: number;
  /** Radius, as a multiple of the ring's own bead radius. */
  rMul: number;
  peak: number;
  fill: string;
  /**
   * True for light rather than substance: it kindles sharply as the bead
   * comes to the front and is all but out at the back, the way a
   * highlight behaves. False fades gently, the way an object does.
   */
  hot?: boolean;
};

/* Painted in order, so the first is furthest back. The halo is the
 * outermost layer, and `orbitSpill` is what the box is measured against
 * — see the geometry module.
 *
 * ⚠ THREE LAYERS, NOT SIX. A revision of this had a wide red blush
 * outside the halo and two dots trailing the bead like a comet. Every
 * one of them was defensible on its own and together they made a small
 * solar system under an icon. What is left is a pearl: a soft halo, a
 * body, and a heart that kindles as it swings to the front. */
const HERO_NEAR: DotSpec[] = [
  { lag: 0, rMul: ORBIT_HALO_MUL, peak: 0.3, fill: ORBIT.halo },
  { lag: 0, rMul: 1, peak: 0.85, fill: ORBIT.body },
  { lag: 0, rMul: 0.44, peak: 0.9, fill: ORBIT.core, hot: true },
];

const QUIET_NEAR: DotSpec[] = [
  { lag: 0, rMul: 2.4, peak: 0.18, fill: ORBIT.halo },
  { lag: 0, rMul: 1, peak: 0.6, fill: ORBIT.body },
];

/* Behind the numbers there is no glow at all: light spilling off
 * something that is BEHIND the digits would be light coming through
 * them, which is the one thing that would break the illusion the whole
 * figure exists for. Just the body, dim. */
const FAR: DotSpec[] = [
  { lag: 0, rMul: 0.9, peak: 0.26, fill: ORBIT.ring },
];

export default function PrayerOrbit({
  /** The measured size of the reading this orbits. */
  readout,
  running,
  ignition,
  children,
}: {
  readout: { width: number; height: number };
  running: boolean;
  ignition: SharedValue<number>;
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

  const geometry = useMemo(() => orbitGeometry(readout), [readout]);
  const spins = [spin, spinInner];
  const nearDots = [HERO_NEAR, QUIET_NEAR];

  return (
    <View style={[s.box, { width: geometry.boxW, height: geometry.boxH }]}>
      {/* ── Behind the numbers: the far side of both orbits ─────────── */}
      <Svg
        pointerEvents="none"
        width={geometry.boxW}
        height={geometry.boxH}
        style={StyleSheet.absoluteFill}
      >
        {/* ⚠ NO POOL OF LIGHT UNDER THE READING. There was one, and it
            was one thing too many: the reading already warms into the
            hour's colour when the prayer starts, the rings already
            brighten, and a wash behind the digits on top of that was
            simply more to look at on a screen that is trying to be
            quiet. Two signals for one event is enough. */}
        {geometry.rings.map((ring, index) => (
          <Arc key={`far-${index}`} d={geometry.paths[index].far} base={ring.ink.far} width={1} life={life} />
        ))}
        {geometry.rings.map((ring, index) => (
          <Bead
            key={`far-bead-${index}`}
            ring={ring}
            cx={geometry.cx}
            cy={geometry.cy}
            spin={spins[index]}
            life={life}
            side="far"
            specs={FAR}
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
          <Arc key={`near-${index}`} d={geometry.paths[index].near} base={ring.ink.near} width={1.2} life={life} />
        ))}
        {geometry.rings.map((ring, index) => (
          <Bead
            key={`near-bead-${index}`}
            ring={ring}
            cx={geometry.cx}
            cy={geometry.cy}
            spin={spins[index]}
            life={life}
            side="near"
            specs={nearDots[index]}
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
  d, base, width, life,
}: {
  d: string;
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
      stroke={ORBIT.ring}
      strokeWidth={width}
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  );
}

/**
 * The travelling light, in as many layers as its side deserves.
 *
 * Both layers hold a copy and each shows only while the bead is on its
 * own side. The handover is a short fade rather than a switch: over a
 * narrow band around the ellipse's edge both copies are partly lit, and
 * because they stand at the same coordinates the crossing cannot be
 * seen — a hard swap would flicker for a frame at each end.
 */
function Bead({
  ring, cx, cy, spin, life, side, specs,
}: {
  ring: OrbitRing;
  cx: number;
  cy: number;
  spin: SharedValue<number>;
  life: SharedValue<number>;
  side: 'near' | 'far';
  specs: DotSpec[];
}) {
  return (
    <>
      {specs.map((spec, index) => (
        <Dot
          key={index}
          ring={ring}
          cx={cx}
          cy={cy}
          spin={spin}
          life={life}
          side={side}
          spec={spec}
        />
      ))}
    </>
  );
}

function Dot({
  ring, cx, cy, spin, life, side, spec,
}: {
  ring: OrbitRing;
  cx: number;
  cy: number;
  spin: SharedValue<number>;
  life: SharedValue<number>;
  side: 'near' | 'far';
  spec: DotSpec;
}) {
  // ⚠ This calls `orbitPoint` — the same function the paths and the tests
  // are built on — rather than keeping the ellipse's formula inline. Two
  // copies of a formula become two different formulas the first time one
  // of them is tuned.
  const animatedProps = useAnimatedProps(() => {
    // The lag can carry the phase below zero, and a negative modulo in
    // JavaScript stays negative; the extra turn is what keeps a trailing
    // dot on the ring instead of flinging it to the far side.
    const turn = (((spin.value + ring.phase - spec.lag) % 1) + 1) % 1;
    const p = orbitPoint(ring, turn * TAU, cx, cy);
    // 0 at the far pole, 1 at the near one.
    const near = (p.depth + 1) / 2;
    const facing = side === 'near' ? p.depth : -p.depth;
    const shown = Math.min(1, Math.max(0, facing / 0.09));
    const bright = side === 'far'
      ? 0.35 + near * 0.4
      : spec.hot ? near * near : 0.45 + near * 0.55;

    return {
      cx: p.x,
      cy: p.y,
      // Nearer is bigger, which is the other half of the depth cue the
      // occlusion begins. ⚠ As an SVG radius, never a view scale: scaling
      // a small view on Android resamples its bitmap.
      r: ring.beadR * spec.rMul * (0.68 + near * 0.62),
      opacity: shown * life.value * spec.peak * bright,
    };
  });

  return <AnimatedCircle fill={spec.fill} animatedProps={animatedProps} cx={cx} cy={cy} r={1} />;
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
