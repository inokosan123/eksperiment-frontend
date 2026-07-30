import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * THE CHURCH.
 *
 * The third mark of the spiritual set, drawn to stand beside the
 * two the app already owns: `BeadLoop`, the prayer rope, and
 * `ScriptureBook`, the Gospel. Those two were drawn rather than
 * borrowed, and this one has to be, because no icon set's "church"
 * is an Orthodox one — they are all a western steeple, which is the
 * wrong building for this app.
 *
 * It follows the family's method exactly (see `emblemStroke`):
 * mixed weights, real internal density, and a whole object with a
 * bottom rather than a shape cropped at the edge.
 *
 *   · THE CROSS, at the very top and in the heaviest stroke, with
 *     titulus, bar and the slanted footrest — raised on the
 *     VIEWER'S LEFT, toward the repentant thief, exactly as
 *     `ScriptureBook` sets the cross on its cover.
 *   · THE DOME, an onion that bulges and draws back to the point
 *     the cross stands on. A hemisphere was tried first and read as
 *     a mosque; the shoulder is the whole difference.
 *   · THE DRUM beneath it, with its ring of light slits — the
 *     windows a real drum is pierced with, and the members that
 *     give the mark something to look at up close.
 *   · THE CORNICE, one rubricated line wider than the walls, which
 *     is what makes the body read as built rather than drawn.
 *   · THE BODY, and inside it the ARCHED DOOR and TWO WINDOWS,
 *     filled. Filled because the family's solid marks are what
 *     carry it at emblem size — the rope's beads, the Gospel's four
 *     Evangelists — and because a window seen from outside is dark.
 *   · TWO ACROTERIA at the ends of the cornice, the set's bosses.
 *   · THE STEPS, two lines at half light. They give the church a
 *     foot to stand on, the way the Gospel's page block does.
 *
 * The building is drawn square and symmetrical, so unlike the
 * Gospel it may be set upright OR at the card family's -8°: the
 * cross here is part of an object, not two bare lines.
 * ───────────────────────────────────────────────────────────── */

/** Nearly square, and a shade wider than tall: a church has shoulders. */
const GRID = { w: 22, h: 24 } as const;

/** The cross stands on the dome's point at y=4.75. Kept narrow on purpose:
 * struck as wide as the Gospel's it stopped being a finial and started
 * reading as an aerial planted in the roof. */
const CROSS = {
  x: 11, top: 1.0, foot: 4.75,
  titulus: { y: 1.95, x1: 10.15, x2: 11.85 },
  bar: { y: 2.95, x1: 9.3, x2: 12.7 },
  rest: { x1: 9.85, y1: 3.95, x2: 12.15, y2: 4.4 },
} as const;

/** The onion: out to the shoulders, then back to the point. */
const DOME = 'M 7.55 9.5 C 6.85 7.25, 9.35 6.35, 11 4.75 C 12.65 6.35, 15.15 7.25, 14.45 9.5';

const DRUM = { x: 8.6, y: 9.5, w: 4.8, h: 2.9 } as const;
/** The drum's ring of light. */
const SLITS: readonly number[] = [9.8, 11, 12.2];

const CORNICE = { y: 12.4, x1: 3.0, x2: 19.0 } as const;
const BODY = { x: 3.7, y: 12.4, w: 14.6, h: 9.0, r: 0.5 } as const;

/** The ends of the cornice — this mark's bosses. */
const ACROTERIA: readonly (readonly [number, number])[] = [[3.2, 12.4], [18.8, 12.4]];
const ACROTERION_R = 0.7;

/** The door: arched, and it reaches the floor. */
const DOOR = 'M 9.3 21.4 L 9.3 17.6 A 1.7 1.7 0 0 1 12.7 17.6 L 12.7 21.4 Z';
/** Two windows, arched the same way, filled for the same reason. */
const WINDOWS = [
  'M 5.85 19.3 L 5.85 17.0 A 0.85 0.85 0 0 1 7.55 17.0 L 7.55 19.3 Z',
  'M 14.45 19.3 L 14.45 17.0 A 0.85 0.85 0 0 1 16.15 17.0 L 16.15 19.3 Z',
] as const;

/** The steps, at half light, so the building has a bottom. */
const STEPS = 'M 2.9 21.4 L 19.1 21.4 M 2.2 22.6 L 19.8 22.6';

export default function ChurchDome({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID.h);

  return (
    <Svg
      width={(size * GRID.w) / GRID.h}
      height={size}
      viewBox={`0 0 ${GRID.w} ${GRID.h}`}
    >
      {/* The ground it stands on. */}
      <Path
        d={STEPS}
        stroke={c}
        strokeWidth={stroke.block}
        fill="none"
        opacity={EMBLEM_LIGHT.block}
        strokeLinecap="round"
      />

      <Rect
        x={BODY.x}
        y={BODY.y}
        width={BODY.w}
        height={BODY.h}
        rx={BODY.r}
        ry={BODY.r}
        stroke={c}
        strokeWidth={stroke.board}
        fill="none"
      />

      <Line
        x1={CORNICE.x1}
        y1={CORNICE.y}
        x2={CORNICE.x2}
        y2={CORNICE.y}
        stroke={c}
        strokeWidth={stroke.rubric}
        strokeLinecap="round"
      />
      {ACROTERIA.map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={ACROTERION_R} fill={c} />
      ))}

      <Rect
        x={DRUM.x}
        y={DRUM.y}
        width={DRUM.w}
        height={DRUM.h}
        stroke={c}
        strokeWidth={stroke.board}
        fill="none"
      />
      {SLITS.map((x, i) => (
        <Line
          key={i}
          x1={x}
          y1={10.2}
          x2={x}
          y2={11.7}
          stroke={c}
          strokeWidth={stroke.hair}
          opacity={EMBLEM_LIGHT.hair}
          strokeLinecap="round"
        />
      ))}

      <Path
        d={DOME}
        stroke={c}
        strokeWidth={stroke.board}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* The cross — the heaviest member, because it is why this is a
          church and not a hall. */}
      <Line x1={CROSS.x} y1={CROSS.top} x2={CROSS.x} y2={CROSS.foot} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />
      <Line x1={CROSS.titulus.x1} y1={CROSS.titulus.y} x2={CROSS.titulus.x2} y2={CROSS.titulus.y} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />
      <Line x1={CROSS.bar.x1} y1={CROSS.bar.y} x2={CROSS.bar.x2} y2={CROSS.bar.y} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />
      <Line x1={CROSS.rest.x1} y1={CROSS.rest.y1} x2={CROSS.rest.x2} y2={CROSS.rest.y2} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />

      <Path d={DOOR} fill={c} />
      {WINDOWS.map((d, i) => (
        <Path key={i} d={d} fill={c} />
      ))}
    </Svg>
  );
}
