import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

/* ─────────────────────────────────────────────────────────────
 * THE HOURS — the Prayer Book's category row.
 *
 * ⚠ THIS IS NOT THE CARD-EMBLEM STYLE, AND MUST NOT BECOME IT. The
 * drawn emblems on Library, Inner, Focus and Home are watermarks at
 * 74–79pt, and their whole method is internal density: mixed
 * weights, a dozen members, hairlines at half light. These render at
 * TWENTY-ONE POINTS, five across a row. Every one of those rules
 * inverts here — a hairline at 21pt is not a whisper, it is a gap,
 * and a dozen members is a smudge.
 *
 * So these are built the opposite way: FEW STROKES, ONE WEIGHT, BOLD
 * SHAPES, and the grid filled. They also keep the Prayer Book's own
 * register, which is deliberately brighter and more playful than the
 * rest of the app — a sun with its rays out, a bowl that steams, a
 * moon with a star beside it. The austere line-work that suits a
 * Gospel would be wrong on this row.
 *
 * They take the icon set's own `{ s, c, w }` and use `w` directly,
 * rather than `emblemStrokes`, for the same reason: that scale is
 * built for watermarks and would floor these into hairlines.
 *
 * JESUS is not here. That hour wears `BeadLoop`, the prayer rope the
 * app already owns — the one prayer that needs no book, drawn as the
 * thing you actually hold. It reads down to 18pt, which is where
 * `MyRulePage` already uses it.
 * ───────────────────────────────────────────────────────────── */

type P = { s?: number; c?: string; w?: number };

const D = '#000';

/** MORNING — the sun, full and out. */
export const MorningSun = ({ s = 21, c = D, w = 1.8 }: P) => {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return {
      x1: 12 + Math.cos(a) * 7.0, y1: 12 + Math.sin(a) * 7.0,
      x2: 12 + Math.cos(a) * 9.4, y2: 12 + Math.sin(a) * 9.4,
    };
  });
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round">
      <Circle cx={12} cy={12} r={4.5} />
      {rays.map((r, i) => (
        <Line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
      ))}
    </Svg>
  );
};

/**
 * MEALS — a bowl, steaming.
 *
 * A knife and fork was the obvious mark and the wrong one: this row sits in a
 * prayer book, and cutlery is a restaurant sign. A bowl with something rising
 * off it is warmer, and it reads at 21pt where two crossed implements do not.
 */
export const MealBowl = ({ s = 21, c = D, w = 1.8 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M 3.7 12.2 H 20.3 A 8.3 8.3 0 0 1 3.7 12.2 Z" />
    <Path d="M 9.6 9.2 C 10.5 8.1 9.2 7.0 10.1 5.0" />
    <Path d="M 14.4 9.2 C 15.3 8.1 14.0 7.0 14.9 5.0" />
  </Svg>
);

/** EVENING — the crescent, with one star in the space it opens. */
export const EveningMoon = ({ s = 21, c = D, w = 1.8 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M 12.2 3.4 A 6.4 6.4 0 0 0 20.6 11.8 A 9.4 9.4 0 1 1 12.2 3.4 Z" />
    {/* Filled, and small: at this size an outlined star of any use would be
        wider than the gap the crescent leaves for it. */}
    <Path
      d="M 19.6 3.0 L 20.3 4.3 L 21.6 5.0 L 20.3 5.7 L 19.6 7.0 L 18.9 5.7 L 17.6 5.0 L 18.9 4.3 Z"
      fill={c}
      stroke="none"
    />
  </Svg>
);

/**
 * OTHER — a lit candle.
 *
 * This hour is not a time of day at all: it holds the prayers for particular
 * occasions — before lessons, when troubled by thoughts. A candle is what one
 * lights for a particular need, which is exactly that, and it keeps the row
 * from ending on a shrug.
 */
export const PrayerCandle = ({ s = 21, c = D, w = 1.8 }: P) => (
  <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M 12 2.6 C 14.6 5.7 15.2 7.2 15.2 8.7 A 3.2 3.2 0 0 1 8.8 8.7 C 8.8 7.2 9.4 5.7 12 2.6 Z" />
    <Rect x={8.9} y={12.3} width={6.2} height={8.5} rx={1.1} ry={1.1} />
    <Line x1={6.8} y1={21.6} x2={17.2} y2={21.6} />
  </Svg>
);
