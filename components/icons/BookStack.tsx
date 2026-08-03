import Svg, { Line, Path, Rect } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * THE STACK — Reading List.
 *
 * The card's old mark was `Book`, one closed book — which is also
 * what the Scripture card is, and two cards on the same shelf
 * cannot both be "a book". So this is THREE: a reading list is by
 * definition more than one, and the stack says that before a single
 * word of the card is read. See `emblemStroke` for the method.
 *
 * They lie spine-out, the way books waiting to be read actually sit
 * on a desk rather than shelved. Each carries the two things a bound
 * spine has and nothing else does: the RAISED BANDS running across
 * it, and the stamped TITLE between them. That is the density — nine
 * members over three outlines — and it is why the stack reads at
 * 80pt where a single outlined book does not.
 *
 * The widths step: widest at the foot, narrowest in the middle,
 * the top one between. A stack of three identical rectangles is a
 * ladder; the step is what makes it a pile.
 *
 * The marker rides out of the top volume, the same swallowtail the
 * Gospel drops from its boards — the one part shared straight across
 * the family, so the shelf looks like one shelf.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

type Volume = {
  /** the board */
  x1: number; x2: number; y1: number; y2: number;
  /** the two raised bands, and how far they are held off the spine's edges */
  bands: readonly [number, number];
  bandInset: number;
  /** the stamped title */
  title: { x1: number; x2: number; y: number };
};

/** Foot to top. The widths step so the pile does not read as a ladder. */
const VOLUMES: readonly Volume[] = [
  {
    x1: 1.2, x2: 21.0, y1: 16.0, y2: 22.6,
    bands: [4.6, 17.6], bandInset: 0.5,
    title: { x1: 7.4, x2: 14.8, y: 19.3 },
  },
  {
    x1: 2.4, x2: 19.6, y1: 9.2, y2: 15.4,
    bands: [5.8, 16.2], bandInset: 0.5,
    title: { x1: 8.4, x2: 13.6, y: 12.3 },
  },
  {
    x1: 1.8, x2: 18.6, y1: 2.4, y2: 8.6,
    bands: [5.2, 15.2], bandInset: 0.5,
    title: { x1: 7.6, x2: 12.8, y: 5.5 },
  },
];

const BOARD_R = 0.7;

/** Out of the top volume, pointing away from the stack. */
const MARKER = 'M 18.6 4.4 L 21.9 4.4 L 20.7 5.5 L 21.9 6.6 L 18.6 6.6 Z';

export default function BookStack({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      {VOLUMES.map((v, i) => (
        <Rect
          key={`board-${i}`}
          x={v.x1}
          y={v.y1}
          width={v.x2 - v.x1}
          height={v.y2 - v.y1}
          rx={BOARD_R}
          ry={BOARD_R}
          stroke={c}
          strokeWidth={stroke.board}
          fill="none"
        />
      ))}

      {/* The raised bands, across each spine. Half light: they are the
          binding's texture, not its outline. */}
      {VOLUMES.flatMap((v, i) =>
        v.bands.map((x, j) => (
          <Line
            key={`band-${i}-${j}`}
            x1={x}
            y1={v.y1 + v.bandInset}
            x2={x}
            y2={v.y2 - v.bandInset}
            stroke={c}
            strokeWidth={stroke.block}
            strokeLinecap="round"
            opacity={EMBLEM_LIGHT.block}
          />
        )),
      )}

      {/* The stamped title — the solid mark on each volume. */}
      {VOLUMES.map((v, i) => (
        <Line
          key={`title-${i}`}
          x1={v.title.x1}
          y1={v.title.y}
          x2={v.title.x2}
          y2={v.title.y}
          stroke={c}
          strokeWidth={stroke.rubric}
          strokeLinecap="round"
        />
      ))}

      <Path d={MARKER} fill={c} />
    </Svg>
  );
}
