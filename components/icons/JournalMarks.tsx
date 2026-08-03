import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * MORNING PAGES · FREE WRITING — two of Journal's three cards.
 *
 * They carried `Feather` and `FileEdit` at 110pt and 12% opacity —
 * the stretched-icon problem this whole emblem family exists to fix.
 * See `emblemStroke` for the method, and `JournalPen`, which the
 * third card (Daily Journal) already wears.
 *
 * The three have to be tellable apart at a glance and from a
 * distance, since they are stacked in one column. So each says its
 * own sentence rather than "writing" three times:
 *
 *   DAILY JOURNAL   a book, open and written in, with the pen laid
 *                   alongside — `JournalPen`.
 *   MORNING PAGES   the page, with the SUN RISING BESIDE IT.
 *   FREE WRITING    the page with ONE UNBROKEN LINE that runs off
 *                   its edge.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

/* ── MORNING PAGES ────────────────────────────────────────────────────────── */

/**
 * The sun, clear to the LEFT of the page.
 *
 * ⚠ It used to sit BEHIND the page, cut by its top edge. That reads as depth
 * on a card with a flat background, and as a collision on one with a gradient:
 * the disc's arc ran under the sheet and the two shapes fought. Standing them
 * side by side says the same thing — morning, and a page — and each keeps its
 * own silhouette.
 *
 * Every distance below is checked against the other: the disc clears the
 * sheet's left edge, and the ray fan is narrowed to ±20° off the horizontal so
 * its longest arms neither leave the grid nor reach across to the sheet.
 */
const SUN = { cx: 5.3, cy: 5.5, r: 2.7 } as const;

/**
 * A FULL RING of rays, not the upper arc.
 *
 * The arc was left over from when the sun sat behind the page: rays below it
 * would have run into the sheet, so there were none. Standing free, a sun lit
 * on one side only reads as half-drawn — so it now wears the whole ring, and
 * the page moved clear enough to allow it.
 *
 * TWELVE, ALTERNATING LONG AND SHORT. An even ring of twelve is a clock face;
 * the alternation is what makes it a sunburst, and it is the same trick the
 * focus seal's ray field uses.
 */
const RAY_COUNT = 12;
const RAY_FROM = 3.5;
const RAY_LONG = 4.7;
const RAY_SHORT = 4.1;

const SUN_RAYS = Array.from({ length: RAY_COUNT }, (_, i) => {
  const a = ((360 * i) / RAY_COUNT) * (Math.PI / 180);
  const to = i % 2 === 0 ? RAY_LONG : RAY_SHORT;
  return {
    x1: SUN.cx + Math.cos(a) * RAY_FROM,
    y1: SUN.cy + Math.sin(a) * RAY_FROM,
    x2: SUN.cx + Math.cos(a) * to,
    y2: SUN.cy + Math.sin(a) * to,
    long: i % 2 === 0,
  };
});

/** The page, standing beside it — lower and to the right. */
const PAGE = { x: 9.8, y: 9.6, w: 11.6, h: 12.0, r: 1.0 } as const;
/** One line proud of its right edge and foot: the pages under this one. */
const PAGE_BLOCK = 'M 22.3 10.6 L 22.3 22.5 L 10.7 22.5';

/** The hand on it. Three lines, the last running short. */
const MORNING_LINES: readonly (readonly [number, number, number])[] = [
  [11.0, 19.4, 13.0],
  [11.0, 18.6, 15.6],
  [11.0, 16.2, 18.2],
];

export function MorningPage({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      {SUN_RAYS.map((r, i) => (
        <Line
          key={`ray-${i}`}
          x1={r.x1}
          y1={r.y1}
          x2={r.x2}
          y2={r.y2}
          stroke={c}
          strokeWidth={r.long ? stroke.block : stroke.rule}
          strokeLinecap="round"
          opacity={r.long ? EMBLEM_LIGHT.block : EMBLEM_LIGHT.rule * 0.8}
        />
      ))}
      <Circle cx={SUN.cx} cy={SUN.cy} r={SUN.r} stroke={c} strokeWidth={stroke.board} fill="none" />

      <Path
        d={PAGE_BLOCK}
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

      {MORNING_LINES.map(([x1, x2, y], i) => (
        <Line
          key={`line-${i}`}
          x1={x1}
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

/* ── FREE WRITING ─────────────────────────────────────────────────────────── */

/** The sheet: taller and narrower, so it is not the same rectangle as above. */
const SHEET = { x: 4.0, y: 2.6, w: 14.6, h: 18.8, r: 1.2 } as const;

/**
 * The one unbroken line.
 *
 * It starts inside the sheet, loops four times, and RUNS OFF the right edge —
 * that overrun is the whole idea of the card. "No prompts, no rules": the
 * writing does not stop where the page says it should.
 */
const FLOW = [
  'M 6.4 8.0',
  'C 8.4 5.9 10.6 9.4 12.6 7.6',
  'C 14.3 6.1 16.3 8.6 16.3 8.6',
  'M 6.4 12.2',
  'C 8.6 10.0 11.0 13.7 13.2 11.6',
  'C 15.0 9.9 17.1 12.5 17.1 12.5',
  'M 6.4 16.4',
  'C 8.8 14.1 11.4 18.0 13.9 15.8',
  'C 16.2 13.8 19.6 17.0 21.6 14.4',
].join(' ');

/** Where the line leaves: a small solid nib-mark, the mark's one full weight. */
const OVERRUN = { cx: 21.6, cy: 14.4, r: 0.85 } as const;

export function FreePage({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      {/* The sheet, open on three sides: its right edge is deliberately absent
          below the flow's exit, so nothing contradicts the line running out. */}
      <Path
        d={`M ${SHEET.x + SHEET.w} ${SHEET.y + 9.2} L ${SHEET.x + SHEET.w} ${SHEET.y} L ${SHEET.x + SHEET.r} ${SHEET.y} Q ${SHEET.x} ${SHEET.y} ${SHEET.x} ${SHEET.y + SHEET.r} L ${SHEET.x} ${SHEET.y + SHEET.h - SHEET.r} Q ${SHEET.x} ${SHEET.y + SHEET.h} ${SHEET.x + SHEET.r} ${SHEET.y + SHEET.h} L ${SHEET.x + SHEET.w} ${SHEET.y + SHEET.h}`}
        stroke={c}
        strokeWidth={stroke.board}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={`M ${SHEET.x + SHEET.w} ${SHEET.y + SHEET.h} L ${SHEET.x + SHEET.w} ${SHEET.y + 13.4}`}
        stroke={c}
        strokeWidth={stroke.board}
        fill="none"
        strokeLinecap="round"
      />

      <Path
        d={FLOW}
        stroke={c}
        strokeWidth={stroke.rubric}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={OVERRUN.cx} cy={OVERRUN.cy} r={OVERRUN.r} fill={c} />
    </Svg>
  );
}
