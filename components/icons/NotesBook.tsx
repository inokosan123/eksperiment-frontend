import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * THE NOTEBOOK — Bible Notes.
 *
 * The card's old mark was `Notebook`, and this is still a notebook:
 * the same object, drawn for the size it is actually shown at. See
 * `emblemStroke` for the method.
 *
 * What separates it from the Gospel on the Scripture card, which is
 * also a closed book, is everything a notebook has and a binding
 * does not — the bound edge with its holes, the ruled page, and the
 * MARGIN RULE, which is the single detail that says "written in"
 * rather than "printed". The Gospel is tooled and symmetrical; this
 * is ruled and ranged left.
 *
 * And the cross at the head of the page, which is where one is
 * actually written: not stamped on a cover as an ornament, but put
 * down first, before the writing. Three bars, because two bare ones
 * tilt into a plus sign — and this mark takes the card's -8° like
 * the rest of the family.
 *
 * It shares the Gospel's page block — one line proud of the right
 * edge and the foot — because the two sit two cards apart and have
 * to look bound by the same hand.
 * ───────────────────────────────────────────────────────────── */

/** Portrait, like the Gospel. `s` is the emblem's HEIGHT. */
const GRID = { w: 18, h: 24 } as const;

const COVER = { x: 1.0, y: 1.4, w: 14.0, h: 19.8, r: 0.8 } as const;
/** The leaves behind the board — right edge and foot, 0.9 proud. */
const BLOCK = 'M 15.9 2.3 L 15.9 22.1 L 1.9 22.1';

/** The bound edge. Five reads as a binding; three reads as a mistake. */
const HOLE_X = 2.5;
const HOLE_R = 0.6;
const HOLES = [4.4, 8.0, 11.6, 15.2, 18.8];

/** The margin rule — the detail that makes it a notebook and not a book. */
const MARGIN = { x: 4.2, y1: 2.6, y2: 20.0 } as const;

/** Written first, at the head of the page. */
const CROSS = {
  x: 8.9, top: 3.0, foot: 8.8,
  titulus: { y: 4.3, x1: 8.0, x2: 9.8 },
  bar: { y: 5.7, x1: 7.0, x2: 10.8 },
} as const;

/** The hand, `[x2, y]`, all starting at the margin. Lengths carry the rhythm. */
const RULE_X1 = 4.8;
const RULES: readonly (readonly [number, number])[] = [
  [13.6, 11.2], [13.0, 13.1], [13.6, 15.0], [12.4, 16.9], [10.4, 18.8],
];

export default function NotesBook({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID.h);

  return (
    <Svg
      width={(size * GRID.w) / GRID.h}
      height={size}
      viewBox={`0 0 ${GRID.w} ${GRID.h}`}
    >
      <Path
        d={BLOCK}
        stroke={c}
        strokeWidth={stroke.block}
        fill="none"
        opacity={EMBLEM_LIGHT.block}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <Rect
        x={COVER.x}
        y={COVER.y}
        width={COVER.w}
        height={COVER.h}
        rx={COVER.r}
        ry={COVER.r}
        stroke={c}
        strokeWidth={stroke.board}
        fill="none"
      />

      <Line
        x1={MARGIN.x}
        y1={MARGIN.y1}
        x2={MARGIN.x}
        y2={MARGIN.y2}
        stroke={c}
        strokeWidth={stroke.hair}
        opacity={EMBLEM_LIGHT.hair}
        strokeLinecap="round"
      />

      {HOLES.map((cy, i) => (
        <Circle key={i} cx={HOLE_X} cy={cy} r={HOLE_R} fill={c} />
      ))}

      <Line x1={CROSS.x} y1={CROSS.top} x2={CROSS.x} y2={CROSS.foot} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />
      <Line x1={CROSS.titulus.x1} y1={CROSS.titulus.y} x2={CROSS.titulus.x2} y2={CROSS.titulus.y} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />
      <Line x1={CROSS.bar.x1} y1={CROSS.bar.y} x2={CROSS.bar.x2} y2={CROSS.bar.y} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />

      {RULES.map(([x2, y], i) => (
        <Line
          key={i}
          x1={RULE_X1}
          y1={y}
          x2={x2}
          y2={y}
          stroke={c}
          strokeWidth={stroke.rule}
          strokeLinecap="round"
          opacity={EMBLEM_LIGHT.rule}
        />
      ))}
    </Svg>
  );
}
