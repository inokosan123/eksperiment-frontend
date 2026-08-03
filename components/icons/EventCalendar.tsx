import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * THE CALENDAR — Big Events.
 *
 * The card's old mark was `CalendarHeart`. The calendar was right —
 * the eyebrow reads COMING DAYS — and the heart was borrowed from a
 * card two screens away that is actually about the heart. This one
 * is about a DATE, and it says so.
 *
 * ⚠ IT MUST NOT BE A NOTEBOOK. `NotesBook` on Library is a bound
 * portrait book with holes down its edge, and a calendar drawn the
 * obvious way lands very near it. Three things keep them apart: this
 * is LANDSCAPE, it is hung from two rings rather than bound at the
 * side, and it carries a filled MONTH BAND across its head — the one
 * heavy horizontal in the family.
 *
 * THE DENSITY IS THE MONTH. Eight day-dots in two rows, at rule
 * light, which is what a calendar's grid actually looks like at a
 * glance. See `emblemStroke`.
 *
 * THE ONE MARKED DAY is the whole subject: a solid dot with a ring
 * struck around it, the only place on the mark where two weights
 * meet. It sits on the lower row, right of centre, where nothing
 * else competes for it.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

/** Landscape, and hung rather than bound. */
const PAGE = { x: 2.0, y: 4.6, w: 20.0, h: 17.6, r: 1.9 } as const;
/**
 * The month band across the head, filled.
 *
 * Drawn as a path rather than a Rect so its top corners can follow the page's
 * radius while its foot stays square against the grid below.
 */
const BAND = (() => {
  const { x, y, w, r } = PAGE;
  const foot = y + 4.5;
  const n = (v: number) => v.toFixed(2);
  return [
    `M ${n(x)} ${n(foot)}`,
    `V ${n(y + r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}`,
    `H ${n(x + w - r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)}`,
    `V ${n(foot)}`,
    'Z',
  ].join(' ');
})();

/** The two rings it hangs from, crossing the band's head. */
const RINGS: readonly number[] = [7.6, 16.4];
const RING = { top: 1.9, foot: 6.4 } as const;

/** The month, at a glance. Four columns, two rows. */
const COLS: readonly number[] = [5.6, 9.8, 14.0, 18.2];
const ROWS: readonly number[] = [13.4, 18.2];
const DOT = 0.85;

/** The day being counted toward. */
const MARKED = { cx: 14.0, cy: 18.2 } as const;
const MARK_RING = 2.5;

export default function EventCalendar({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      {/* The rings first, so the filled band closes over their feet. */}
      {RINGS.map((x, i) => (
        <Line
          key={`ring-${i}`}
          x1={x}
          y1={RING.top}
          x2={x}
          y2={RING.foot}
          stroke={c}
          strokeWidth={stroke.board}
          strokeLinecap="round"
        />
      ))}

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
      <Path d={BAND} fill={c} />

      {ROWS.flatMap((cy, r) =>
        COLS.map((cx, i) => {
          const marked = cx === MARKED.cx && cy === MARKED.cy;
          return (
            <Circle
              key={`day-${r}-${i}`}
              cx={cx}
              cy={cy}
              r={marked ? DOT * 1.15 : DOT}
              fill={c}
              opacity={marked ? 1 : EMBLEM_LIGHT.rule}
            />
          );
        }))}

      <Circle
        cx={MARKED.cx}
        cy={MARKED.cy}
        r={MARK_RING}
        stroke={c}
        strokeWidth={stroke.rule}
        fill="none"
      />
    </Svg>
  );
}
