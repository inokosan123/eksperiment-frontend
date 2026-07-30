import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

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
 * Same gold, same height, same lamp behind it, same seat. The two
 * screens are one room with a different object in it — that is the whole
 * relationship, and it fails the moment the cross looks like the option
 * for people who could not have the good one.
 *
 * WHAT IT IS. A Latin cross with flared ends — the arms narrow at the
 * crossing and widen again at the tips, the way a struck or cast cross
 * does, because bars of even width read as two rectangles laid over each
 * other rather than as one object. It is a single outline, so the
 * flaring is continuous through the crossing and there is no seam where
 * the arms meet.
 *
 * ⚠ NO ORNAMENT ON IT. No inscription, no rays, no jewelling. Half the
 * traditions this side exists for would find any of those to be the
 * thing they were avoiding, and the object is better for the restraint
 * anyway: what carries it is the gilding, the flare and the light.
 * ───────────────────────────────────────────────────────────── */

/**
 * The cross's proportions, all as shares of its height.
 *
 * A Latin cross puts the crossing above the middle — the upright below
 * the arms is roughly twice the length of the head. Everything else
 * follows from that so the figure keeps its proportion at any size.
 */
const CROSS = {
  /** Where the arms cross, measured down from the top. */
  crossing: 0.335,
  /** Half the span of the arms. */
  arm: 0.3,
  /** Half-thickness of the bars at the crossing. */
  waist: 0.045,
  /** Half-thickness at the tips — the flare. */
  tip: 0.058,
} as const;

/** The board's gilding, so the two objects are cut from one metal. */
const GOLD = ['#EFD7A0', '#D3AE6B', '#A9803A'] as const;

export function crossWidth(height: number) {
  return height * CROSS.arm * 2;
}

/**
 * The outline, once, going clockwise from the head's top-left corner.
 *
 * Twelve points: each arm contributes its two tip corners and the two
 * waisted corners where it meets the crossing. Writing it as one path
 * rather than as two overlapping bars is what lets the flare run
 * continuously and leaves no join to catch the light wrongly.
 */
function crossPath(width: number, height: number) {
  const cx = width / 2;
  const cy = height * CROSS.crossing;
  const arm = height * CROSS.arm;
  const w = height * CROSS.waist;
  const t = height * CROSS.tip;
  const top = 0;
  const bottom = height;

  const p = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`;

  return [
    `M${p(cx - t, top)}`,
    `L${p(cx + t, top)}`,
    `L${p(cx + w, cy - w)}`,
    `L${p(cx + arm, cy - t)}`,
    `L${p(cx + arm, cy + t)}`,
    `L${p(cx + w, cy + w)}`,
    `L${p(cx + t, bottom)}`,
    `L${p(cx - t, bottom)}`,
    `L${p(cx - w, cy + w)}`,
    `L${p(cx - arm, cy + t)}`,
    `L${p(cx - arm, cy - t)}`,
    `L${p(cx - w, cy - w)}`,
    'Z',
  ].join('');
}

export default function StandingCross({
  height,
  style,
}: {
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const width = crossWidth(height);
  // The shadow is the same outline dropped a little and darkened, which
  // is what gives the object weight. Drawn first, so it lies under.
  const d = useMemo(() => crossPath(width, height), [height, width]);
  const drop = Math.max(3, height * 0.014);

  return (
    <View style={[{ width, height: height + drop }, style]}>
      <Svg width={width} height={height + drop}>
        <Defs>
          <LinearGradient id="standingCrossFace" x1="0.1" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor={GOLD[0]} />
            <Stop offset="0.55" stopColor={GOLD[1]} />
            <Stop offset="1" stopColor={GOLD[2]} />
          </LinearGradient>
          {/* The rim: light along the top-left edges, gone by the foot.
              A rim of even weight all the way round reads as an outline
              drawn on the shape; light only ever falls on one side. */}
          <LinearGradient id="standingCrossRim" x1="0.1" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.72} />
            <Stop offset="0.45" stopColor="#FFF6E2" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#8A6526" stopOpacity={0.34} />
          </LinearGradient>
        </Defs>

        <Path d={d} fill="#3A2A10" opacity={0.16} translateY={drop} />
        <Path d={d} fill="url(#standingCrossFace)" />
        <Path d={d} fill="none" stroke="url(#standingCrossRim)" strokeWidth={1.2} />
      </Svg>
    </View>
  );
}
