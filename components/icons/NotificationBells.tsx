import Svg, { Circle, Path } from 'react-native-svg';

/* ─────────────────────────────────────────────────────────────
 * NONE · SINGLE · DOUBLE — the notification selector's three marks.
 *
 * The row used the icon set's `BellOff`, `Bell` and `BellRing`. The
 * middle two are nearly the same drawing, and the third says
 * "ringing" rather than "twice" — so nothing in the set carried the
 * one thing the setting is actually about, which is HOW MANY.
 *
 * ONE BELL, and the only thing that changes between the three is THE
 * NUMBER OF ARCS COMING OFF IT: none, one, two. The count is the
 * meaning, and it is legible before the label under it is read.
 * `none` keeps the same bell and adds the slash, so the three read
 * as one control at three settings rather than as three pictures.
 *
 * THE BELL, part by part — this is where the drawing was won:
 *
 *   · THE CANON, the loop it hangs by. A stroke with a dot on top of
 *     it is a lollipop; a real bell is hung by a closed loop, and
 *     that loop is the single detail that makes the mark look cast
 *     rather than drawn. It is narrow and tall so it never reads as
 *     a second dome.
 *   · THE PROFILE reverses. Each wall rises CONCAVE out of the lip,
 *     turns through the waist, and closes CONVEX into the shoulder.
 *     A bell drawn with one curvature is a dome or a cone; the
 *     reversal is the whole silhouette, and the mouth is set at 1.7
 *     times the shoulder so the flare is unmistakable at 27pt.
 *   · THE CLAPPER hangs just clear of the lip — a hair below the
 *     mouth's own stroke, so it reads as hanging out of the bell
 *     rather than floating under it. It is the mark's one solid
 *     mass.
 *   · THE ARCS are struck about the bell's body on ONE centre, so
 *     the pair in `double` is truly concentric. Their span is held
 *     to 24° — wider and the lower ends swing down into the flare,
 *     which is what made the first pass look tangled.
 *
 * ⚠ ICON scale, not emblem scale. The card emblems' method —
 * hairlines, half light, a dozen members — inverts here; see the
 * note in `PrayerHours`. Few strokes, one weight, grid filled.
 * ───────────────────────────────────────────────────────────── */

type P = { s?: number; c?: string; w?: number };

const D = '#000';

/** The loop it hangs by. Narrow and tall, so it never reads as a second dome. */
const CANON = 'M 10.9 5.7 C 10.9 2.7 13.1 2.7 13.1 5.7';

/**
 * The bell. Mouth 5.6→18.4 against shoulders 8.2→15.8 — a flare of 1.7, which
 * is what carries the silhouette at this size.
 */
const BODY = [
  'M 5.6 16.9',
  'C 7.5 15.3 8.2 13.2 8.2 10.6',      // left wall out of the lip, concave
  'C 8.2 7.5 9.85 5.5 12 5.5',          // through the waist into the shoulder
  'C 14.15 5.5 15.8 7.5 15.8 10.6',     // right shoulder
  'C 15.8 13.2 16.5 15.3 18.4 16.9',    // right wall down to the lip
  'Z',
].join(' ');

/** Just clear of the lip's own stroke, so it hangs OUT of the bell. */
const CLAPPER = { cx: 12, cy: 19.7, r: 1.3 } as const;

/** One centre for both arcs, so the pair in `double` is truly concentric. */
const WAVE_CENTRE = { x: 12, y: 11.5 } as const;
// ⚠ The outer radius is capped by the arc's MIDPOINT, not its ends. An arc
// spanning ±24° reaches its furthest at 0°, where x = centre + r — so 11.2 put
// the right-hand arc a fifth of a unit outside the viewBox and had its crown
// shaved off. 10.6 leaves it 0.4 of air at stroke width 2.
const WAVE_RADII = [8.5, 10.6] as const;
const WAVE_SPAN = (24 * Math.PI) / 180;

function wave(r: number, side: 1 | -1): string {
  const x = WAVE_CENTRE.x + r * Math.cos(WAVE_SPAN) * side;
  const dy = r * Math.sin(WAVE_SPAN);
  // The sweep follows the side, so both arcs bow away from the bell.
  return `M ${x.toFixed(2)} ${(WAVE_CENTRE.y - dy).toFixed(2)} A ${r} ${r} 0 0 ${side === 1 ? 1 : 0} ${x.toFixed(2)} ${(WAVE_CENTRE.y + dy).toFixed(2)}`;
}

/** The refusal. Corner to corner, so it is unmistakably a strike-through. */
const SLASH = 'M 4.2 19.8 L 19.8 4.2';

function Bell({
  s: size = 27,
  c = D,
  w = 2,
  waves = 0,
  silent = false,
}: P & { waves?: 0 | 1 | 2; silent?: boolean }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={c}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {WAVE_RADII.slice(0, waves).map((r, i) => (
        <Path key={`r${i}`} d={wave(r, 1)} />
      ))}
      {WAVE_RADII.slice(0, waves).map((r, i) => (
        <Path key={`l${i}`} d={wave(r, -1)} />
      ))}

      <Path d={CANON} />
      <Path d={BODY} />
      <Circle cx={CLAPPER.cx} cy={CLAPPER.cy} r={CLAPPER.r} fill={c} stroke="none" />

      {silent && <Path d={SLASH} />}
    </Svg>
  );
}

export const BellNone = (p: P) => <Bell {...p} waves={0} silent />;
export const BellSingle = (p: P) => <Bell {...p} waves={1} />;
export const BellDouble = (p: P) => <Bell {...p} waves={2} />;
