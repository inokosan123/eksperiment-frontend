import Svg, { Line, Rect } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * THE LADDER — Habits.
 *
 * The card's old mark was `ListChecks`, and a checklist was the one
 * thing this emblem could not be: `NotesBook` is a ruled notebook
 * and `NoteSlips` is a bulleted slip, both a screen away, and a
 * third list would have said nothing about what makes THIS card
 * different from those.
 *
 * A habit is not a list. It is the same step taken again, and the
 * image for that here is the LADDER — the Ladder of Divine Ascent,
 * which is about exactly this and belongs to this app rather than to
 * productivity software. Nothing else in the app is a ladder.
 *
 * IT CLIMBS, IT DOES NOT LIE FLAT. Two things do that, and they are
 * the difference between this and the first cut:
 *
 *   · THE RAILS CONVERGE toward the head, so the ladder leans away.
 *   · THE RUNGS FORESHORTEN. Their spacing is a real projective
 *     progression rather than an even one, so the gaps close as they
 *     recede. Evenly spaced rungs on converging rails read as a
 *     mistake — the eye knows the two do not go together.
 *
 * EACH RAIL IS A BEAM, not a line: a second hairline inside it gives
 * it a thickness, which is the whole reason it reads as timber. That
 * one extra stroke is most of what this drawing gained.
 *
 * FIVE RUNGS, NOT SIX. With foreshortening the upper gaps close on
 * their own, and a sixth crowded the head of the ladder exactly
 * where the drawing most needs air.
 *
 * The foot is shod with two solid blocks — the mark's solid mass,
 * and what gives it a bottom to stand on — and the TOP rung is
 * struck at full light: the step being climbed toward.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

/** Foot and head of each rail. The head is narrower, so the ladder leans away. */
const RAIL = {
  leftFoot: 4.3, leftHead: 8.3,
  rightFoot: 19.7, rightHead: 15.7,
  foot: 22.4, head: 2.1,
} as const;
/** How far inside each rail its second line runs, giving the beam a thickness. */
const BEAM = 0.62;

const RUNG_COUNT = 5;
const RUNG_FOOT = 20.6;
const RUNG_HEAD = 4.4;
/**
 * How hard the rungs foreshorten. 1 would be even spacing; this is the
 * projective interpolation `t·k / (1 + t(k−1))`, which is what equally spaced
 * steps actually do when they recede from the eye.
 */
const RECESSION = 2.05;

/** Where a rail stands at a given height. */
function railX(foot: number, head: number, y: number): number {
  const t = (RAIL.foot - y) / (RAIL.foot - RAIL.head);
  return foot + (head - foot) * t;
}

const RUNGS = Array.from({ length: RUNG_COUNT }, (_, i) => {
  const t = i / (RUNG_COUNT - 1);
  const projected = (t * RECESSION) / (1 + t * (RECESSION - 1));
  const y = RUNG_FOOT - (RUNG_FOOT - RUNG_HEAD) * projected;
  // Held a little inside the rails: at this weight an overshoot reads as a
  // burr rather than as a joint.
  const inset = 0.3;
  return {
    y,
    x1: railX(RAIL.leftFoot, RAIL.leftHead, y) + inset,
    x2: railX(RAIL.rightFoot, RAIL.rightHead, y) - inset,
    top: i === RUNG_COUNT - 1,
  };
});

/** The shoes at the foot of each rail: the mark's solid mass. */
const SHOE = { w: 2.5, h: 1.5, r: 0.5 } as const;

export default function AscentLadder({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      {/* Each rail: its outer edge, then the inner line that gives it body. */}
      <Line x1={RAIL.leftFoot} y1={RAIL.foot} x2={RAIL.leftHead} y2={RAIL.head} stroke={c} strokeWidth={stroke.board} strokeLinecap="round" />
      <Line x1={RAIL.leftFoot + BEAM} y1={RAIL.foot} x2={RAIL.leftHead + BEAM} y2={RAIL.head} stroke={c} strokeWidth={stroke.hair} strokeLinecap="round" opacity={EMBLEM_LIGHT.hair} />
      <Line x1={RAIL.rightFoot} y1={RAIL.foot} x2={RAIL.rightHead} y2={RAIL.head} stroke={c} strokeWidth={stroke.board} strokeLinecap="round" />
      <Line x1={RAIL.rightFoot - BEAM} y1={RAIL.foot} x2={RAIL.rightHead - BEAM} y2={RAIL.head} stroke={c} strokeWidth={stroke.hair} strokeLinecap="round" opacity={EMBLEM_LIGHT.hair} />

      {RUNGS.map(({ y, x1, x2, top }, i) => (
        <Line
          key={i}
          x1={x1}
          y1={y}
          x2={x2}
          y2={y}
          stroke={c}
          strokeWidth={top ? stroke.rubric : stroke.rule}
          strokeLinecap="round"
          opacity={top ? 1 : EMBLEM_LIGHT.rule}
        />
      ))}

      <Rect x={RAIL.leftFoot - SHOE.w / 2} y={RAIL.foot - SHOE.h / 2} width={SHOE.w} height={SHOE.h} rx={SHOE.r} ry={SHOE.r} fill={c} />
      <Rect x={RAIL.rightFoot - SHOE.w / 2} y={RAIL.foot - SHOE.h / 2} width={SHOE.w} height={SHOE.h} rx={SHOE.r} ry={SHOE.r} fill={c} />
    </Svg>
  );
}
