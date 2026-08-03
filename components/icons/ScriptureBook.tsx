import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * THE GOSPEL BOOK.
 *
 * Drawn rather than borrowed, for the same reason `BeadLoop` was:
 * the icon set's `OpenBook` is two paths, and the ribbon card blows
 * its emblem up to nearly half the plate's width. At that size a
 * 24px outline in one uniform hairline is not an illustration, it
 * is a stretched icon — there is nothing inside it to look at.
 *
 * It is A BOOK, and the cross is ON it. An earlier cut ran one axis
 * through the whole emblem — cross above, spine in the gutter,
 * marker below — which was a handsome object and the wrong one: it
 * had stopped being a book and become a crucifix wearing a book.
 * This is the thing itself, the Gospel as it actually sits on the
 * analogion, and every part of it is a part real bindings have:
 *
 *   · THE COVER, closed and face on, in the portrait proportion a
 *     Gospel is bound in — not the square an icon grid pushes you
 *     toward. Hence a 18×24 viewBox rather than 24×24; `s` is the
 *     emblem's HEIGHT and it draws three quarters as wide.
 *   · ONE LINE tracing the right edge and the foot, a little outside
 *     the cover: the block of pages behind the board. It is what
 *     stops the cover reading as a picture frame.
 *   · THE TOOLED BORDER, a hairline inset frame. Cheap, and it is
 *     most of why a binding looks bound.
 *   · THE CROSS on the centre of the cover: upright, titulus, bar,
 *     and the slanted footrest, in the emblem's heaviest stroke
 *     because it is the subject. Its bar ends stand in the same two
 *     columns as the bosses, so the whole face is on one grid.
 *   · FOUR BOSSES at the corners of the frame — the Evangelists, as
 *     they are set on real covers. Filled, and they are this
 *     emblem's beads: the solid marks that give a large watermark
 *     something to hold, exactly the job the rope's beads do.
 *   · THE MARKER falling from between the boards, ending in a
 *     swallowtail. It gives the object a bottom.
 *
 * ⚠ IT TAKES THE CARD'S -8°. Only `Cross` stands square in this app,
 * because two bare lines tilted read as a fallen plus. A cross
 * DEPICTED ON an object has no such problem — the object tilts, the
 * way a book laid down does — so nothing here is drawn pre-rotated
 * and the card's `decorUpright` is left OFF for this one.
 *
 * Weights come from `emblemStroke`, which the whole family shares.
 * ───────────────────────────────────────────────────────────── */

/** Portrait: the grid a book is actually bound in. `s` is the height. */
const GRID = { w: 18, h: 24 } as const;

const COVER = { x: 1.0, y: 1.6, w: 14.0, h: 18.2, r: 1.0 } as const;
/** The page block behind the board — right edge and foot, 0.9 proud. */
const BLOCK = 'M 15.9 2.6 L 15.9 20.7 L 1.9 20.7';
const FRAME = { x: 2.6, y: 3.2, w: 10.8, h: 15.0, r: 0.6 } as const;

/** The Evangelists, at the corners of the frame, inset 1.7 on both axes. */
const BOSS_R = 0.75;
const BOSSES: readonly (readonly [number, number])[] = [
  [4.3, 4.9], [11.7, 4.9], [4.3, 16.5], [11.7, 16.5],
];

/**
 * The cross, on the centre of the cover — which is also the centre of the
 * frame, (8.0, 10.7).
 *
 * The footrest is raised on the VIEWER'S LEFT: the lifted end points to the
 * repentant thief, who stands at Christ's right hand. (`OrthodoxCross` in
 * `Icons.tsx` has it the other way round.)
 */
const CROSS = {
  x: 8.0, top: 6.4, foot: 15.4,
  titulus: { y: 7.9, x1: 6.7, x2: 9.3 },
  bar: { y: 9.9, x1: 5.0, x2: 11.0 },
  rest: { x1: 5.9, y1: 12.9, x2: 10.1, y2: 13.5 },
} as const;

/** The marker: the one falling mass, leaving from between the boards. */
const RIBBON = 'M 7.15 19.4 L 7.15 23.4 L 8 22.1 L 8.85 23.4 L 8.85 19.4 Z';

export default function ScriptureBook({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID.h);

  return (
    <Svg
      width={(size * GRID.w) / GRID.h}
      height={size}
      viewBox={`0 0 ${GRID.w} ${GRID.h}`}
    >
      {/* Behind the board: the block of pages it closes over. */}
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
      <Rect
        x={FRAME.x}
        y={FRAME.y}
        width={FRAME.w}
        height={FRAME.h}
        rx={FRAME.r}
        ry={FRAME.r}
        stroke={c}
        strokeWidth={stroke.hair}
        fill="none"
        opacity={EMBLEM_LIGHT.hair}
      />

      {BOSSES.map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={BOSS_R} fill={c} />
      ))}

      {/* The cross — the heaviest member on the emblem, because it is why
          this is a Gospel and not a book. */}
      <Line x1={CROSS.x} y1={CROSS.top} x2={CROSS.x} y2={CROSS.foot} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />
      <Line x1={CROSS.titulus.x1} y1={CROSS.titulus.y} x2={CROSS.titulus.x2} y2={CROSS.titulus.y} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />
      <Line x1={CROSS.bar.x1} y1={CROSS.bar.y} x2={CROSS.bar.x2} y2={CROSS.bar.y} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />
      <Line x1={CROSS.rest.x1} y1={CROSS.rest.y1} x2={CROSS.rest.x2} y2={CROSS.rest.y2} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />

      <Path d={RIBBON} fill={c} />
    </Svg>
  );
}
