import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * THE TROPHY — Bucket List.
 *
 * When a dream is ticked off, the app answers with the challenge
 * trophy; the card that holds those dreams wears the thing the dream
 * earns. There is exactly one trophy in this app and that is on
 * purpose — the trophy is the repeating unit, the medallion belongs
 * to Focus, and Challenges wears a crown, which is received rather
 * than won.
 *
 * ⚠ THE RIM IS AN ELLIPSE. This is the whole difference between the
 * first cut and this one. A cup closed with a straight line across
 * the top is a flat shape; an elliptical rim says the mouth is a
 * circle seen from slightly above, and the object gains its volume
 * from that one curve. Everything else follows it: the chased band
 * under the rim is an ellipse too, on the same axis, so the eye
 * reads a consistent point of view.
 *
 * THE BOWL IS FLUTED rather than starred. The first cut cut a star
 * into it, and `FavoriteStar` on Library is a star — two starred
 * marks in one app is one too many. Two hairline flutes following
 * the bowl's own curvature say "turned metal" without adding a
 * second symbol, and they are the family's tooled line again.
 *
 * THE STEM HAS A KNOP — the small turned bead between bowl and foot.
 * It is the detail that separates a made cup from a funnel, and it
 * is one of the mark's solid masses along with the plinth.
 *
 * The handles are what make a cup a trophy, so they are drawn full
 * and open, out well past the bowl.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

/** The mouth, seen from slightly above. The mark's founding curve. */
const RIM = { cx: 12, cy: 4.4, rx: 5.7, ry: 1.55 } as const;
/** The chased band under it — same centre, same axis, so the view holds. */
const CHASE = { cx: 12, cy: 6.6, rx: 5.4, ry: 1.4 } as const;

/** The bowl's walls, falling from the rim's ends to the base. */
const BOWL_LEFT = 'M 6.3 4.4 C 6.3 9.6 8.6 12.9 12 13.9';
const BOWL_RIGHT = 'M 17.7 4.4 C 17.7 9.6 15.4 12.9 12 13.9';

/** Two flutes, following the bowl rather than ruled straight down it. */
const FLUTE_LEFT = 'M 9.5 7.7 C 9.4 9.4 9.9 11.0 10.6 11.9';
const FLUTE_RIGHT = 'M 14.5 7.7 C 14.6 9.4 14.1 11.0 13.4 11.9';

/** Out well past the bowl: this is what makes a cup a trophy. */
const HANDLE_RIGHT = 'M 17.5 5.6 C 21.2 5.6 21.6 10.8 17.0 12.2';
const HANDLE_LEFT = 'M 6.5 5.6 C 2.8 5.6 2.4 10.8 7.0 12.2';

const STEM = { x: 12, top: 13.9, foot: 17.4 } as const;
/** The turned bead between bowl and foot. */
const KNOP = { cx: 12, cy: 15.6, r: 1.05 } as const;

/** The splayed foot, and the plinth it sets down on. */
const FOOT = 'M 10.0 17.4 L 14.0 17.4 L 15.6 19.9 L 8.4 19.9 Z';
const PLINTH = { x: 6.0, y: 19.9, w: 12.0, h: 2.4, r: 0.9 } as const;

export default function DreamTrophy({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      <Path d={HANDLE_LEFT} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinecap="round" />
      <Path d={HANDLE_RIGHT} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinecap="round" />

      <Path d={BOWL_LEFT} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinecap="round" />
      <Path d={BOWL_RIGHT} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinecap="round" />

      <Path d={FLUTE_LEFT} stroke={c} strokeWidth={stroke.hair} fill="none" strokeLinecap="round" opacity={EMBLEM_LIGHT.hair} />
      <Path d={FLUTE_RIGHT} stroke={c} strokeWidth={stroke.hair} fill="none" strokeLinecap="round" opacity={EMBLEM_LIGHT.hair} />

      <Ellipse
        cx={CHASE.cx}
        cy={CHASE.cy}
        rx={CHASE.rx}
        ry={CHASE.ry}
        stroke={c}
        strokeWidth={stroke.hair}
        fill="none"
        opacity={EMBLEM_LIGHT.hair}
      />
      <Ellipse
        cx={RIM.cx}
        cy={RIM.cy}
        rx={RIM.rx}
        ry={RIM.ry}
        stroke={c}
        strokeWidth={stroke.board}
        fill="none"
      />

      <Line x1={STEM.x} y1={STEM.top} x2={STEM.x} y2={STEM.foot} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />
      <Circle cx={KNOP.cx} cy={KNOP.cy} r={KNOP.r} fill={c} />

      <Path d={FOOT} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinejoin="round" />
      <Rect x={PLINTH.x} y={PLINTH.y} width={PLINTH.w} height={PLINTH.h} rx={PLINTH.r} ry={PLINTH.r} fill={c} />
    </Svg>
  );
}
