import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import Reanimated, {
  useAnimatedStyle,
} from 'react-native-reanimated';
import { C } from '@/constants/tokens';
import { BANKED } from '@/components/shared/BankedEmber';
import {
  continuousPhase,
  pingPongPhase,
} from '@/components/shared/use-continuous-animation-clock';
import { useAmbientMotion } from '@/components/shared/ambient-motion';
import { FocusMedallionMark } from './FocusMedallion';

/**
 * TODAY — the day in progress, drawn once for everywhere it appears.
 *
 * The Focus tab shows this day twice: on the Medal Streak card's week strip,
 * and in the monthly calendar that card opens. They were two separate
 * treatments that had drifted apart — the sheet's was right and the card's was
 * a featureless ash disc that read as an image which had failed to load — and
 * even once the card was ported to match, the two were two copies of the same
 * idea kept in step by hand. This is the one object both rooms mount, so a
 * change to the day in progress happens in one place.
 *
 * WHAT IT IS. A die waiting to be struck. Everything about it says "not yet,
 * and soon":
 *
 *   · a lit cream SEAT inside a solid gold rim — the mark is standing IN
 *     something, which is the whole difference between waiting and absent;
 *   · the medallion's own disc, in ash: every scallop, ring and the numeral,
 *     so it is plainly the same medal the days beside it already won, only
 *     unstruck;
 *   · a WARMTH under it that breathes — the day is being worked on;
 *   · one hairline ring outside, breathing against that warmth so the mark is
 *     never entirely still;
 *   · and a single spark that orbits the rim, the one moving thing small
 *     enough to read as anticipation rather than as activity.
 *
 * Everything animates OPACITY and ROTATION only. Nothing scales — a scaled
 * small view resamples its bitmap on Android, which is the standing rule.
 *
 * BANKED, the whole thing is held: no plan covers today, so there is no medal
 * on the table to wait for. The seat goes to ash, the light goes out, and one
 * warm coal is left in the middle of it.
 */

/** The mark's diameter as a fraction of the seat: 24 in 36, the sheet's ratio. */
const MARK_RATIO = 0.667;

/** The card's own glint, so the spark belongs to the surface it turns on. */
const SPARKLE_PATH = 'M12 0 C12.7 8.2 15.8 11.3 24 12 C15.8 12.7 12.7 15.8 12 24 C11.3 15.8 8.2 12.7 0 12 C8.2 11.3 11.3 8.2 12 0 Z';

export default function MedalDayInProgress({
  size,
  banked = false,
  active = true,
}: {
  /** The seat's diameter. The mark and every ring are struck from it. */
  size: number;
  banked?: boolean;
  active?: boolean;
}) {
  const runtime = useAmbientMotion(active && !banked);
  const running = runtime.enabled;
  const clock = runtime.clock;

  const mark = Math.round(size * MARK_RATIO);
  // The warmth spills well past the seat: it is the light the day is being
  // worked in, and at a tight radius it was a rim rather than a glow.
  const halo = size * 1.7;
  const ring = size + Math.max(5, size * 0.2);
  const orbitR = ring / 2;
  const spark = Math.max(7, size * 0.26);

  // The warmth under the mark leads; the ring counter-breathes against it, so
  // there is always one of the two on its way up.
  const glowStyle = useAnimatedStyle(() => ({
    opacity: running ? 0.5 + pingPongPhase(clock.value, 1900) * 0.5 : 0.75,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: running ? 0.78 - pingPongPhase(clock.value, 1900) * 0.38 : 0.6,
  }));

  // The spark rides the ring, brightest on the far side of its turn.
  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(running ? continuousPhase(clock.value, 5200) : 0) * 360}deg` }],
  }));
  const sparkStyle = useAnimatedStyle(() => ({
    opacity: (() => {
      if (!running) return 0;
      const turn = continuousPhase(clock.value, 5200);
      return 0.25 + (0.5 + 0.5 * Math.sin(turn * Math.PI * 2)) * 0.65;
    })(),
  }));

  return (
    <View style={[stage.wrap, { width: size, height: size }]}>
      {/* The warmth the day is being worked in. Behind the seat, so it reads as
          light coming THROUGH the rim rather than as a wash laid over it. */}
      {!banked && (
        <Reanimated.View
          pointerEvents="none"
          style={[
            // Placed by its own offsets rather than centred as an oversized
            // child of an absoluteFill: on web that arrangement clipped the
            // glow to the cell's box and painted it as a square of light.
            {
              position: 'absolute',
              width: halo,
              height: halo,
              left: (size - halo) / 2,
              top: (size - halo) / 2,
            },
            glowStyle,
          ]}
        >
          <Svg width={halo} height={halo}>
            <Defs>
              <RadialGradient id="dayWarmth" cx="50%" cy="50%" r="50%">
                <Stop offset="0.3" stopColor="#FFF6DA" stopOpacity={0.72} />
                <Stop offset="0.52" stopColor="#FBE7B4" stopOpacity={0.34} />
                <Stop offset="1" stopColor="#EDCB88" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={halo / 2} cy={halo / 2} r={halo / 2} fill="url(#dayWarmth)" />
          </Svg>
        </Reanimated.View>
      )}

      {/* One hairline ring outside the seat. One, not two: the seat already
          wears a rim, and a seated mark inside two more rings is three
          concentric gold circles on one small cell — a target, not a day. */}
      <Reanimated.View
        pointerEvents="none"
        style={[
          stage.ring,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderColor: banked ? BANKED.ashLine : C.gold,
            borderWidth: banked ? 1 : 1.4,
          },
          banked ? stage.ringHeld : ringStyle,
        ]}
      />

      {/* The seat, and the die waiting in it. */}
      <View
        style={[
          stage.seat,
          { width: size, height: size, borderRadius: size / 2 },
          banked ? stage.seatBanked : stage.seatLive,
        ]}
      >
        {banked ? (
          <View style={[stage.ember, { width: spark, height: spark, borderRadius: spark / 2 }]} />
        ) : (
          <FocusMedallionMark size={mark} muted />
        )}
      </View>

      {/* The orbiting spark — the one moving thing on the cell. Its container
          is centred and turns; the spark is a centred child lifted out by the
          orbit radius, so it circles the seat cleanly.

          It is the app's four-point glint, not a dot: a small circle riding a
          ring reads as a second, escaped bead of the object it is orbiting,
          and a rimmed one reads as a bug. A glint reads as light, which is
          what it is — and it is the same mark the card's own dust is struck
          from, so the cell borrows the surface's language instead of adding
          to it. */}
      {!banked && (
        <Reanimated.View pointerEvents="none" style={[stage.fill, orbitStyle]}>
          <Reanimated.View style={[{ transform: [{ translateY: -orbitR }] }, sparkStyle]}>
            <Svg width={spark} height={spark} viewBox="0 0 24 24">
              <Path d={SPARKLE_PATH} fill="#FFF6D8" />
            </Svg>
          </Reanimated.View>
        </Reanimated.View>
      )}
    </View>
  );
}

const stage = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  fill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { position: 'absolute' },
  ringHeld: { opacity: 0.5 },
  seat: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  seatLive: { backgroundColor: '#FFFBEF', borderColor: C.gold },
  seatBanked: {
    backgroundColor: '#FBF8F0',
    borderColor: BANKED.ash,
    borderStyle: 'dashed',
  },
  ember: { backgroundColor: BANKED.ember },
});
