import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * THE JOURNAL AND THE PEN — Journal.
 *
 * The card's old mark was `Feather`: three paths, a bare leaf on a
 * stick at emblem size. A quill on a scroll came before this and was
 * the wrong century for the card — the scroll is what you keep a
 * record ON, and a journal is a book you keep.
 *
 * So: the book open and WRITTEN IN, with a heading and A RULE UNDER
 * IT, and the pen laid alongside. The underline is the whole point.
 * Five bare lines of hand are a page of anything; a heading with a
 * rule under it and the body set below is a DATED ENTRY, which is
 * the one thing only a journal has.
 *
 * WHAT KEEPS IT OFF THE OTHER TWO BOOKS. Bible Notes is a portrait
 * notebook standing up, bound at the edge, with the cross written at
 * its head; Notes is loose dog-eared slips. This lies flat and open
 * with an instrument beside it — a desk, not an object. And the pen
 * is the differentiator that costs nothing to read at a glance.
 *
 * THE PEN IS A FOUNTAIN PEN and is drawn as one: body, clip, the
 * band where the cap meets it, the grip tapering out, and a NIB with
 * its slit and its breather hole. That last pair is what stops it
 * reading as a pencil — a pencil has a cone and a point, a pen has a
 * split tip. The band is filled and so is the breather: those are
 * the solid masses the family wants, the rope's beads again.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

// ── The book ────────────────────────────────────────────────────────────────
const PAGE = { x: 1.6, y: 2.4, w: 13.4, h: 19.6, r: 0.7 } as const;
/** The leaves under the open one — right edge and foot, 0.9 proud. */
const BLOCK = 'M 15.9 3.3 L 15.9 22.9 L 2.5 22.9';

/** The heading, and the rule under it. */
const TITLE = { y: 6.0, x1: 3.4, x2: 9.8 } as const;
/**
 * ⚠ Full light, not half. The body below runs at `EMBLEM_LIGHT.rule`; if the
 * underline runs there too it becomes a sixth line of text and the entry loses
 * its head. It is a rule, so it is drawn like one.
 */
const UNDERLINE = { y: 7.6, x1: 3.4, x2: 13.2 } as const;

/** The entry, `[lineEnd, y]`. The last runs short, as a last line does. */
const BODY_X = 3.4;
const BODY: readonly (readonly [number, number])[] = [
  [13.2, 10.2], [12.4, 12.4], [13.2, 14.6], [11.6, 16.8], [9.4, 19.0],
];

// ── The pen ─────────────────────────────────────────────────────────────────
const PEN = { x: 18.2, y: 2.2, w: 2.6, h: 16.8, r: 1.25 } as const;
/** Where the cap meets the barrel. Filled — one of the mark's two solid marks. */
const BAND = { x: 18.2, y: 10.4, w: 2.6, h: 0.9 } as const;
const CLIP = 'M 20.5 3.0 L 21.1 3.5 L 21.1 8.8';
/** The nib, outlined rather than filled: a solid wedge reads as a pencil. */
const NIB = 'M 18.9 19.0 L 20.1 19.0 L 19.5 22.9 Z';
const SLIT = { x: 19.5, y1: 20.6, y2: 22.6 } as const;
const BREATHER = { cx: 19.5, cy: 20.1, r: 0.42 } as const;

export default function JournalPen({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
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
        x={PAGE.x}
        y={PAGE.y}
        width={PAGE.w}
        height={PAGE.h}
        rx={PAGE.r}
        ry={PAGE.r}
        stroke={c}
        strokeWidth={stroke.board}
        fill="none"
      />

      <Line x1={TITLE.x1} y1={TITLE.y} x2={TITLE.x2} y2={TITLE.y} stroke={c} strokeWidth={stroke.rubric} strokeLinecap="round" />
      <Line x1={UNDERLINE.x1} y1={UNDERLINE.y} x2={UNDERLINE.x2} y2={UNDERLINE.y} stroke={c} strokeWidth={stroke.rule} strokeLinecap="round" />

      {BODY.map(([x2, y], i) => (
        <Line
          key={`body-${i}`}
          x1={BODY_X}
          y1={y}
          x2={x2}
          y2={y}
          stroke={c}
          strokeWidth={stroke.rule}
          strokeLinecap="round"
          opacity={EMBLEM_LIGHT.rule}
        />
      ))}

      <Path d={CLIP} stroke={c} strokeWidth={stroke.block} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Rect
        x={PEN.x}
        y={PEN.y}
        width={PEN.w}
        height={PEN.h}
        rx={PEN.r}
        ry={PEN.r}
        stroke={c}
        strokeWidth={stroke.board}
        fill="none"
      />
      <Rect x={BAND.x} y={BAND.y} width={BAND.w} height={BAND.h} fill={c} />

      <Path d={NIB} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinejoin="round" />
      <Line x1={SLIT.x} y1={SLIT.y1} x2={SLIT.x} y2={SLIT.y2} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />
      <Circle cx={BREATHER.cx} cy={BREATHER.cy} r={BREATHER.r} fill={c} />
    </Svg>
  );
}
