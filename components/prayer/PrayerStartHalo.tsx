import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Reanimated, {
  useAnimatedProps,
  type SharedValue,
} from 'react-native-reanimated';

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

/* ─────────────────────────────────────────────────────────────
 * THE LIGHT AROUND THE START BUTTON.
 *
 * Pressing start is the one deliberate act on this screen, and the
 * button answered it by fading a flat disc up behind itself. Three
 * things happen now, and they are three because a single event with a
 * beginning, a body and an end is what reads as considered:
 *
 *   THE STRIKE   two rings leave the button's edge once, the second a
 *                fifth of a beat behind the first, widening and thinning
 *                as they go. A bell struck, not a ripple in a pond —
 *                they are gone inside a second and a half and never
 *                come back.
 *   THE RING     a hairline standing just off the button's edge for as
 *                long as the prayer runs, breathing with it. This is
 *                the part that says "still going".
 *   THE POOL     warmth gathered under both, so the rings are light
 *                rather than drawn circles.
 *
 * ⚠ EVERY RADIUS IS AN SVG RADIUS, NEVER A VIEW SCALE. Scaling a small
 * view on Android resamples its bitmap each frame, and this one would
 * be scaling for as long as somebody prays. `r` on a vector circle is
 * resolution-free and costs nothing.
 *
 * ⚠ AND IT IS DRAWN BEHIND THE BUTTON, in a box that does not receive
 * touches, so nothing here can steal the press it is celebrating.
 * ───────────────────────────────────────────────────────────── */

export default function PrayerStartHalo({
  /** The button's own diameter. Everything else is figured from it. */
  size,
  tint,
  /** 0 at rest, 1 while the prayer runs. */
  ignition,
  /** The slow breath, 0…1, already running only while the prayer does. */
  breath,
  /** 0 → 1 once each time the prayer is started. */
  strike,
}: {
  size: number;
  tint: string;
  ignition: SharedValue<number>;
  breath: SharedValue<number>;
  strike: SharedValue<number>;
}) {
  // Room for the strike's full reach. The outer ring travels to 2.5
  // radii, so 5.4 across the box leaves a little air at the edge — a
  // ring clipped by its own surface is a straight line, which is the one
  // thing a light must never end in.
  const field = Math.round(size * 2.7);
  const c = field / 2;
  const edge = size / 2;

  const poolProps = useAnimatedProps(() => ({
    opacity: ignition.value * (0.55 + breath.value * 0.45),
  }));

  const ringProps = useAnimatedProps(() => ({
    // The standing ring breathes a hair wider as it brightens, which is
    // what makes it read as light rather than as a drawn circle.
    r: edge * (1.2 + breath.value * 0.035),
    opacity: ignition.value * (0.3 + breath.value * 0.16),
  }));

  return (
    <View pointerEvents="none" style={[s.wrap, { width: field, height: field }]}>
      <Svg width={field} height={field}>
        <Defs>
          <RadialGradient id="prayerStartPool" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tint} stopOpacity={0.34} />
            <Stop offset="0.42" stopColor={tint} stopOpacity={0.15} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <AnimatedCircle
          cx={c}
          cy={c}
          r={edge * 2.05}
          fill="url(#prayerStartPool)"
          animatedProps={poolProps}
        />

        <StrikeRing c={c} edge={edge} tint={tint} strike={strike} delay={0} />
        <StrikeRing c={c} edge={edge} tint={tint} strike={strike} delay={0.2} />

        <AnimatedCircle
          cx={c}
          cy={c}
          fill="none"
          stroke={tint}
          strokeWidth={1}
          r={edge * 1.2}
          animatedProps={ringProps}
        />
      </Svg>
    </View>
  );
}

/**
 * One ring leaving the button.
 *
 * `delay` is a share of the strike's own progress rather than a second
 * timer, so the pair cannot drift apart and cancelling the strike
 * cancels both. It also means the trailing ring is still travelling when
 * the leading one has gone, which is what gives the gesture a tail.
 */
function StrikeRing({
  c, edge, tint, strike, delay,
}: {
  c: number;
  edge: number;
  tint: string;
  strike: SharedValue<number>;
  delay: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = Math.max(0, (strike.value - delay) / (1 - delay));
    return {
      // From the button's own edge outward. Never from its centre: a ring
      // born inside the button appears from under it and reads as a
      // mistake rather than as something leaving.
      r: edge * (1.02 + t * 1.5),
      // Cubed, so it is bright for the first instant and then almost
      // immediately faint — which is what a struck thing does, and what
      // an even fade never looks like.
      opacity: t <= 0 || t >= 1 ? 0 : (1 - t) * (1 - t) * (1 - t) * 0.62,
      strokeWidth: 1.9 - t * 1.2,
    };
  });

  return (
    <AnimatedCircle
      cx={c}
      cy={c}
      r={edge}
      fill="none"
      stroke={tint}
      strokeWidth={1.4}
      opacity={0}
      animatedProps={animatedProps}
    />
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
