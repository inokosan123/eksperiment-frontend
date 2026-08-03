import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * THE HOURGLASS — Focus Zone.
 *
 * A timer only reads as a timer if TIME HAS PASSED IN IT, so this
 * one is caught mid-run and that is where its density lives.
 *
 * What the first cut got wrong was the making of it. The glass was
 * four separate curves — top-left, top-right, foot-left, foot-right
 * — which is a bow tie with a line through it. A real hourglass is
 * TWO CURVES: each side runs unbroken from the head, in to the
 * waist, and out again to the foot. Drawn that way the waist is a
 * pinch in one continuous wall rather than the place four strokes
 * happen to meet, and the whole object gains a middle.
 *
 * The frame was two bare verticals; now each post is a BEAM, an
 * outer line with a hairline inside it, the same trick that made the
 * Habits ladder read as timber. The caps are filled — the mark's
 * solid masses, and what gives it a bottom to stand on.
 *
 * THE SAND IS DISHED. Its top is a concave curve, because sand
 * running out of a funnel leaves a depression rather than a flat
 * line; that one curve is the difference between "an hourglass" and
 * "an hourglass that is running". Below it a thread with two loose
 * grains, and a heaped mound already settled.
 *
 * The highlight on the upper bulb is the family's tooled hairline —
 * one short curve, and it is what tells the eye the wall is glass.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

/** The caps: filled, and the object's footing. */
const CAP = { x: 3.8, w: 16.4, h: 1.6, r: 0.7, top: 1.7, foot: 20.7 } as const;
/** The posts between them, each drawn as a beam. */
const POST = { left: 5.6, right: 18.4, top: 3.3, foot: 20.7 } as const;
const BEAM = 0.6;

/**
 * Each wall in ONE stroke: head, in to the waist, out to the foot.
 *
 * The waist is deliberately not a point — the two walls stop 0.55 apart, which
 * is the neck the sand actually runs through.
 */
const WALL_LEFT = 'M 7.2 4.3 C 7.2 9.3 11.1 10.7 11.72 12 C 11.1 13.3 7.2 14.7 7.2 19.7';
const WALL_RIGHT = 'M 16.8 4.3 C 16.8 9.3 12.9 10.7 12.28 12 C 12.9 13.3 16.8 14.7 16.8 19.7';
/** The head and foot of the glass, closing it against the caps. */
const GLASS_HEAD = { y: 4.3, x1: 7.2, x2: 16.8 } as const;
const GLASS_FOOT = { y: 19.7, x1: 7.2, x2: 16.8 } as const;

/** What is left, dished where it is running out. */
const SAND_TOP = 'M 8.9 9.7 C 10.2 10.75 13.8 10.75 15.1 9.7 L 12.5 11.75 L 11.5 11.75 Z';
/** What has fallen, heaped. */
const SAND_FOOT = 'M 8.3 19.7 C 9.2 16.9 14.8 16.9 15.7 19.7 Z';

/** The thread, and two grains loose on it. */
const THREAD = { x: 12, y1: 12.3, y2: 17.2 } as const;
const GRAINS: readonly number[] = [13.9, 15.7];

/** One curve on the upper wall: this is what makes it glass. */
const GLINT = 'M 8.7 5.7 C 8.6 7.3 9.3 8.7 10.3 9.5';

export default function FocusGlass({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      <Line x1={POST.left} y1={POST.top} x2={POST.left} y2={POST.foot} stroke={c} strokeWidth={stroke.board} strokeLinecap="round" />
      <Line x1={POST.left + BEAM} y1={POST.top} x2={POST.left + BEAM} y2={POST.foot} stroke={c} strokeWidth={stroke.hair} strokeLinecap="round" opacity={EMBLEM_LIGHT.hair} />
      <Line x1={POST.right} y1={POST.top} x2={POST.right} y2={POST.foot} stroke={c} strokeWidth={stroke.board} strokeLinecap="round" />
      <Line x1={POST.right - BEAM} y1={POST.top} x2={POST.right - BEAM} y2={POST.foot} stroke={c} strokeWidth={stroke.hair} strokeLinecap="round" opacity={EMBLEM_LIGHT.hair} />

      <Path d={WALL_LEFT} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinecap="round" />
      <Path d={WALL_RIGHT} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinecap="round" />
      <Line x1={GLASS_HEAD.x1} y1={GLASS_HEAD.y} x2={GLASS_HEAD.x2} y2={GLASS_HEAD.y} stroke={c} strokeWidth={stroke.rule} strokeLinecap="round" opacity={EMBLEM_LIGHT.rule} />
      <Line x1={GLASS_FOOT.x1} y1={GLASS_FOOT.y} x2={GLASS_FOOT.x2} y2={GLASS_FOOT.y} stroke={c} strokeWidth={stroke.rule} strokeLinecap="round" opacity={EMBLEM_LIGHT.rule} />

      <Path d={GLINT} stroke={c} strokeWidth={stroke.hair} fill="none" strokeLinecap="round" opacity={EMBLEM_LIGHT.hair} />

      <Line x1={THREAD.x} y1={THREAD.y1} x2={THREAD.x} y2={THREAD.y2} stroke={c} strokeWidth={stroke.hair} strokeLinecap="round" opacity={EMBLEM_LIGHT.hair} />
      {GRAINS.map((cy, i) => (
        <Circle key={i} cx={THREAD.x} cy={cy} r={0.5} fill={c} />
      ))}

      <Path d={SAND_TOP} fill={c} />
      <Path d={SAND_FOOT} fill={c} />

      <Rect x={CAP.x} y={CAP.top} width={CAP.w} height={CAP.h} rx={CAP.r} ry={CAP.r} fill={c} />
      <Rect x={CAP.x} y={CAP.foot} width={CAP.w} height={CAP.h} rx={CAP.r} ry={CAP.r} fill={c} />
    </Svg>
  );
}
