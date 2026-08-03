import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * THE SLIPS — Notes.
 *
 * The card's old mark was `Notebook`, and that is now the Bible
 * Notes mark two screens over. Two cards in one app cannot both be
 * "a notebook", and of the two this is the one that should give it
 * up: Bible Notes is a book you keep, and this card says
 * SELF-CORRECTION — honest notes and practical reminders, kept for
 * when you need them. That is not a bound volume. It is a slip.
 *
 * So: two loose sheets, the back one showing past the front, and
 * the front one DOG-EARED at the foot — the corner turned up, which
 * is the single detail that says a hand has been at it. The bound
 * notebook is square and ruled; this is loose and turned down.
 *
 * On it, a rubricated heading and three BULLETED lines, because a
 * reminder is a thing on a list. The bullets are the solid marks the
 * family wants — the rope's beads again. See `emblemStroke`.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

/** The sheet behind, offset up and to the right. */
const BACK = { x: 5.0, y: 1.4, w: 16.0, h: 17.0, r: 0.8 } as const;

/**
 * The sheet in front, with its foot corner turned up.
 *
 * The outline stops short of the corner and cuts across; the flap is drawn
 * separately, so the fold is a real edge rather than a line laid over a
 * rectangle that is still whole underneath it.
 */
const FRONT = 'M 2.6 3.8 H 18.6 V 18.4 L 14.4 22.6 H 2.6 Z';
const FOLD = 'M 18.6 18.4 H 14.4 V 22.6';

/** Written first, and set apart. */
const HEADING = { y: 7.4, x1: 4.6, x2: 11.4 } as const;

/** `[y, lineEnd]`. The bullet stands at `BULLET_X`, the line starts after it. */
const BULLET_X = 5.2;
const LINE_X1 = 6.9;
const REMINDERS: readonly (readonly [number, number])[] = [
  [10.8, 16.4], [13.9, 15.0], [17.0, 13.2],
];

export default function NoteSlips({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      <Rect
        x={BACK.x}
        y={BACK.y}
        width={BACK.w}
        height={BACK.h}
        rx={BACK.r}
        ry={BACK.r}
        stroke={c}
        strokeWidth={stroke.block}
        fill="none"
        opacity={EMBLEM_LIGHT.block}
      />

      <Path d={FRONT} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinejoin="round" />
      <Path
        d={FOLD}
        stroke={c}
        strokeWidth={stroke.hair}
        fill="none"
        strokeLinejoin="round"
        opacity={EMBLEM_LIGHT.hair}
      />

      <Line
        x1={HEADING.x1}
        y1={HEADING.y}
        x2={HEADING.x2}
        y2={HEADING.y}
        stroke={c}
        strokeWidth={stroke.rubric}
        strokeLinecap="round"
      />

      {REMINDERS.map(([y], i) => (
        <Circle key={`bullet-${i}`} cx={BULLET_X} cy={y} r={0.5} fill={c} />
      ))}
      {REMINDERS.map(([y, x2], i) => (
        <Line
          key={`line-${i}`}
          x1={LINE_X1}
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
