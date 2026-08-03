import Svg, { Circle, Path } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * THE STAR — Favorites.
 *
 * Still a star, because that is what the card has always been; the
 * old one was `Star`, a single lucide polygon, and at emblem size a
 * five-pointed outline with nothing in it is the emptiest mark on
 * the screen. See `emblemStroke` for why.
 *
 * Four points with hollowed sides rather than five straight ones: a
 * five-pointed star is a rating, a sheriff, a flag. The four-pointed
 * star with drawn-in flanks is the one that reads as LIGHT, which is
 * what a kept verse is meant to be.
 *
 * It is given the Gospel's own vocabulary so the two are plainly one
 * set — a tooled ring, FOUR BOSSES on it, and a solid centre — and
 * the four long points break out through the ring, which is the
 * whole reason the ring is there. A star inside a circle is a badge;
 * a star piercing one is a star.
 *
 * The bosses stand in the diagonals, where the star is at its
 * narrowest, so they fill the emptiest quarter of the mark and are
 * the solid mass the eye holds on to — the job the rope's beads do.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;
const C = 12;

/**
 * The four-pointed star. Each flank is one quadratic whose control point sits
 * near the centre, which is what pulls the sides in; a straight line between
 * the tips would draw a diamond.
 */
const STAR =
  'M 23.2 12 Q 13.2 10.8 12 0.8 Q 10.8 10.8 0.8 12 Q 10.8 13.2 12 23.2 Q 13.2 13.2 23.2 12 Z';

/** The ring the points pierce. Placed outside the star's waist (r≈4.8). */
const RING_R = 7.4;
/** On the diagonals, on the ring — the emptiest quarter of the mark. */
const BOSS_R = 0.85;
const BOSS = RING_R * Math.SQRT1_2;
const BOSSES: readonly (readonly [number, number])[] = [
  [C + BOSS, C - BOSS], [C - BOSS, C - BOSS],
  [C - BOSS, C + BOSS], [C + BOSS, C + BOSS],
];

export default function FavoriteStar({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      <Circle
        cx={C}
        cy={C}
        r={RING_R}
        stroke={c}
        strokeWidth={stroke.hair}
        fill="none"
        opacity={EMBLEM_LIGHT.hair}
      />

      <Path d={STAR} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinejoin="round" />

      {BOSSES.map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={BOSS_R} fill={c} />
      ))}

      {/* The heart of it. Small: at any more it stops being a star's centre
          and becomes a disc with spikes. */}
      <Circle cx={C} cy={C} r={1.25} fill={c} />
    </Svg>
  );
}
