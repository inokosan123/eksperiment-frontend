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
 *   · THE DRUM beneath it, under its own hairline cornice, pierced
 *     by an arcade of three filled arches — the windows a real drum
 *     is lit through, and the members that give the mark something
 *     to look at up close.
 *   · THE LOW GABLED ROOF, whose ridge is the drum's seat. A flat
 *     box with a cornice was drawn first and it read as a hall with
 *     a dome dropped on it; the pitch is what makes it a nave.
 *   · THE EAVES, one rubricated line wider than the walls, which is
 *     what makes the building read as built rather than drawn.
 *   · THE WALLS, and between them the ARCHED DOOR and TWO WINDOWS,
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

/** The cross stands on the dome's point at y=4.4, and the whole of it —
 * titulus, bar and footrest — is inside the grid. Kept narrow on purpose:
 * struck as wide as the Gospel's it stopped being a finial and started
 * reading as an aerial planted in the roof. */
const CROSS = {
  x: 11, top: 0.6, foot: 4.4,
  titulus: { y: 1.5, x1: 10.2, x2: 11.8 },
  bar: { y: 2.45, x1: 9.4, x2: 12.6 },
  rest: { x1: 9.9, y1: 3.35, x2: 12.1, y2: 3.8 },
} as const;

/** The onion: out to the shoulders, then back to the point. */
const DOME = 'M 7.5 8.4 C 6.75 6.25, 9.35 5.45, 11 4.4 C 12.65 5.45, 15.25 6.25, 14.5 8.4';

const DRUM = { x: 8.6, y: 8.4, w: 4.8, h: 3.2 } as const;
/** The drum's own cornice, and the arcade of windows under it. */
const DRUM_CORNICE = { y: 9.25, x1: 8.6, x2: 13.4 } as const;
const ARCADE: readonly number[] = [9.8, 11, 12.2];

/** The nave: two walls under a low gable, and the drum rides its ridge. */
const WALLS = 'M 4.4 21.6 L 4.4 14.6 M 17.6 21.6 L 17.6 14.6';
const ROOF = 'M 3.2 14.6 L 11 11.6 L 18.8 14.6 Z';
const EAVES = { y: 14.6, x1: 3.2, x2: 18.8 } as const;

/** The ends of the eaves — this mark's bosses. */
const ACROTERIA: readonly (readonly [number, number])[] = [[3.3, 14.6], [18.7, 14.6]];
const ACROTERION_R = 0.7;

/** The door: arched, and it reaches the floor. */
const DOOR = 'M 9.4 21.6 L 9.4 18.1 A 1.6 1.6 0 0 1 12.6 18.1 L 12.6 21.6 Z';
/** Two windows, arched the same way, filled for the same reason. */
const WINDOWS = [
  'M 5.82 19.8 L 5.82 17.7 A 0.78 0.78 0 0 1 7.38 17.7 L 7.38 19.8 Z',
  'M 14.62 19.8 L 14.62 17.7 A 0.78 0.78 0 0 1 16.18 17.7 L 16.18 19.8 Z',
] as const;

/** The steps, at half light, so the building has a bottom. */
const STEPS = 'M 2.6 21.6 L 19.4 21.6 M 1.9 22.8 L 20.1 22.8';

/** One arch of the drum's arcade, filled the way the windows are. */
function arcade(x: number) {
  return `M ${x - 0.4} 11.15 L ${x - 0.4} 10.15 A 0.4 0.4 0 0 1 ${x + 0.4} 10.15 L ${x + 0.4} 11.15 Z`;
}

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

      <Path
        d={WALLS}
        stroke={c}
        strokeWidth={stroke.board}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={ROOF}
        stroke={c}
        strokeWidth={stroke.board}
        fill="none"
        strokeLinejoin="round"
      />

      <Line
        x1={EAVES.x1}
        y1={EAVES.y}
        x2={EAVES.x2}
        y2={EAVES.y}
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
      <Line
        x1={DRUM_CORNICE.x1}
        y1={DRUM_CORNICE.y}
        x2={DRUM_CORNICE.x2}
        y2={DRUM_CORNICE.y}
        stroke={c}
        strokeWidth={stroke.hair}
        opacity={EMBLEM_LIGHT.rule}
      />
      {ARCADE.map((x, i) => (
        <Path key={i} d={arcade(x)} fill={c} opacity={0.9} />
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
