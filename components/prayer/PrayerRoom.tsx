import { StyleSheet } from 'react-native';
import Svg, { Defs, Rect, RadialGradient, Stop } from 'react-native-svg';
import Reanimated, {
  useAnimatedProps,
  type SharedValue,
} from 'react-native-reanimated';

const AnimatedRect = Reanimated.createAnimatedComponent(Rect);

/* ─────────────────────────────────────────────────────────────
 * THE ROOM — what the page itself does when the prayer begins.
 *
 * The screen used to answer the start of a prayer with lines: hoops
 * turning round the object and round the clock. They were handsome and
 * they were the wrong instinct — a thing that MOVES asks to be watched,
 * and this is a screen you are supposed to be looking through rather
 * than at.
 *
 * So the answer is now light. Nothing here moves at all; the room simply
 * gets darker at its edges, the way a room does when someone turns the
 * lamp up and everything away from it falls back. That single change
 * carries the whole state:
 *
 *   at rest    even warm paper, edge to edge
 *   running    the corners in shadow, the centre — where the cross or
 *              the icon stands — the only lit part of the page
 *
 * ⚠ IT IS A VIGNETTE, WHICH IS THE OPPOSITE OF A GLOW, and that is the
 * point. A glow added at the centre would brighten a page that is
 * already the brightest thing on the phone, so nothing would read; the
 * lamp behind the object already does what little brightening is wanted.
 * Taking light AWAY from everything else is what makes the object
 * present, and it is the one move that cannot compete with it.
 *
 * ⚠ AND IT IS WARM SHADOW, NOT GREY. A neutral darkening over warm paper
 * reads as the screen dimming — a phone problem, not a mood. Shadow the
 * colour of the paper's own deepest tone reads as evening.
 *
 * ONE SURFACE, ONE ANIMATED PROPERTY. A rect filled with a radial
 * gradient, its opacity on the shared ignition. No clock, no worklet
 * loop, nothing recomputed per frame.
 */
export default function PrayerRoom({
  ignition,
}: {
  /** 0 at rest, 1 while the prayer runs. */
  ignition: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => ({ opacity: ignition.value }));

  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Defs>
        {/*
          ⚠ THE CLEAR CENTRE REACHES MOST OF THE WAY OUT. A vignette that
          starts closing at the middle darkens the object it is supposed
          to be presenting. Holding it clear to 55% and letting it gather
          only in the last third puts the whole shadow outside where the
          cross and the icon stand, at every phone size, without the
          geometry having to know how big they are.

          `r="72%"` rather than 50: the gradient is measured on the
          shorter axis of the box, so on a tall screen a 50% radius would
          finish well before the corners and leave a visible round edge
          of shadow. Past 70 it clears the corners on every aspect ratio
          a phone has.
        */}
        <RadialGradient id="prayerRoomVignette" cx="50%" cy="46%" r="72%">
          <Stop offset="0" stopColor="#6B4E1E" stopOpacity={0} />
          <Stop offset="0.55" stopColor="#6B4E1E" stopOpacity={0} />
          <Stop offset="0.78" stopColor="#6B4E1E" stopOpacity={0.09} />
          <Stop offset="1" stopColor="#4A3312" stopOpacity={0.2} />
        </RadialGradient>
      </Defs>
      <AnimatedRect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="url(#prayerRoomVignette)"
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
