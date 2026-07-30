import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

/* ─────────────────────────────────────────────────────────────
 * THE CROSS — the other thing that can stand on the prayer screen.
 *
 * It is the default, and it is not a fallback. My Rule is written for
 * Christians of every tradition, and while a Byzantine icon is a natural
 * thing for some of them to pray in front of, for others praying before
 * an image is precisely what they do not do. The cross is the ground all
 * of them share.
 *
 * ⚠ SO IT IS MADE TO THE SAME STANDARD AS THE ICON, not to a lesser one.
 * Same height, same lamp behind it, same seat. The two screens are one
 * room with a different object in it — that is the whole relationship,
 * and it fails the moment the cross looks like the option for people who
 * could not have the good one.
 *
 * ⚠ IT WAS A DRAWN VECTOR AND IS NOW A PHOTOGRAPHED OBJECT, which is the
 * point of the change: a wooden cross with a mahogany frame and a pale
 * maple inlay stands beside a sixth-century painted panel as an equal.
 * A flat gold silhouette did not, however carefully its flare was cut.
 *
 * ⚠ THE SOURCE ARRIVED ON A GREEN SCREEN AND WAS KEYED IN THE REPO, not
 * by eye in an editor. `assets/images/prayer/standing-cross.png` is the
 * result, and the recipe is worth keeping because the naive version of
 * it fails in two specific ways:
 *
 *   · Keying by DISTANCE to the key colour eats the wood's own warm
 *     tones along the rim. The measure that works is how far GREEN
 *     stands above the larger of the other two channels — wood scores at
 *     or below zero, the key scores one, and the antialiased rim scores
 *     in between, which is the alpha it should be given.
 *   · Spill has to be suppressed in two passes. The first removes the
 *     key in proportion to how much was there; the second flattens
 *     anything still green-dominant, because the outline's own dark rim
 *     is a blend of dark wood WITH green — olive, around (40, 78, 15) —
 *     which the first pass barely touches and which reads against warm
 *     paper as exactly the fringe all of this exists to prevent.
 *
 * And it is shipped at source resolution rather than downscaled:
 * resampling straight-alpha RGBA averages the RGB of cleared pixels back
 * into their neighbours, which put 581 green pixels along the rim on the
 * first attempt. 1182 tall covers a 3x screen at the 380-point ceiling
 * this is ever drawn at.
 * ───────────────────────────────────────────────────────────── */

const CROSS_IMAGE = require('@/assets/images/prayer/standing-cross.png');

/**
 * The keyed file's own proportion, 760 × 1182.
 *
 * Measured from the cropped asset rather than assumed, so the frame this
 * is laid in is always exactly the shape of the object in it and the
 * cross can never be stretched.
 */
export const CROSS_ASPECT = 760 / 1182;

export function crossWidth(height: number) {
  return height * CROSS_ASPECT;
}

export default function StandingCross({
  height,
  style,
}: {
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: crossWidth(height), height }, style]}>
      <ExpoImage
        source={CROSS_IMAGE}
        style={StyleSheet.absoluteFill}
        // `contain`, not `cover`: the box is already the image's own
        // proportion, so this only guards against a rounding difference
        // cropping a millimetre off an arm.
        contentFit="contain"
        transition={220}
        accessibilityLabel="A wooden cross"
      />
    </View>
  );
}
