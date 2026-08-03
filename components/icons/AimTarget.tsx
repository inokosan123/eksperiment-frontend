import Svg, { Path } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';
import {
  closedPath,
  polygonGate,
  sampleEllipse,
  trimRuns,
  type Pt,
} from '@/components/icons/emblemGeometry';

/* ─────────────────────────────────────────────────────────────
 * THE MARK, STRUCK — Monthly Goals.
 *
 * The eyebrow reads MONTHLY AIM. Three bare concentric circles are a
 * diagram; a target with an ARROW STANDING IN IT is a month that was
 * hit, which is what the card promises. The arrow is also what keeps
 * the mark clear of `FavoriteStar`, which is likewise a ring with
 * things set on it.
 *
 * ⚠ THE ARROW IS IN FRONT, AND THE RINGS PROVE IT. Every ring is
 * TRIMMED where the arrow crosses it — see `emblemGeometry` — so the
 * lines genuinely stop at its edge and pick up again on the far
 * side. The first cut drew the arrow as a line laid over the rings,
 * which reads as a diagram of a circle with a stick on it. This is
 * the same occlusion the Focus guard emblems use, and it is most of
 * what makes the mark look drawn rather than assembled.
 *
 * THE HEAD IS BARBED. A plain triangle is a paper dart; the swept
 * back edge is what makes it an arrowhead at a glance. Two vanes of
 * fletching sit up the shaft from the nock, and they are the detail
 * that stops the diagonal reading as a ruled line.
 *
 * THE BULL IS A RING AND THE HEAD STANDS INSIDE IT. Drawn as a solid
 * disc it is the same colour as the arrowhead landing on it and the
 * two merge into one smudge; as a ring, the head reads plainly as an
 * arrow in the middle of the target. The head is the solid mass this
 * family wants, and the centre is the right place for it.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

const CENTRE = { x: 10.7, y: 10.5 } as const;
/** Outer to inner. The outer is the object; the two inside are its markings. */
const RINGS = [9.0, 6.3, 3.7] as const;
const BULL = 2.0;

/** Loosed from the lower right, so the shaft crosses the plate's own diagonal. */
const NOCK = { x: 22.3, y: 21.9 } as const;

const HEAD = { length: 3.5, half: 1.35, barb: 0.95 } as const;
/** Half-width of the shaft, and of the air kept around it. */
const SHAFT_HALF = 0.5;
const AIR = 1.05;

const arrow = (() => {
  const dx = CENTRE.x - NOCK.x;
  const dy = CENTRE.y - NOCK.y;
  const len = Math.hypot(dx, dy);
  const d = { x: dx / len, y: dy / len };
  const n = { x: -d.y, y: d.x };

  const at = (along: number, across: number): Pt => [
    NOCK.x + d.x * along + n.x * across,
    NOCK.y + d.y * along + n.y * across,
  ];

  const tipAt = len;
  const baseAt = len - HEAD.length;

  /**
   * The head, barbed: tip, out to each shoulder, and back IN along a swept
   * edge before meeting the shaft. Those two inner points are the barb.
   */
  const head = closedPath([
    at(tipAt, 0),
    at(baseAt, HEAD.half),
    at(baseAt + HEAD.barb, SHAFT_HALF),
    at(baseAt + HEAD.barb, -SHAFT_HALF),
    at(baseAt, -HEAD.half),
  ]);

  /** Two vanes, up the shaft from the nock and swept back toward it. */
  const fletch = ([1, -1] as const).map(side => closedPath([
    at(0.6, side * SHAFT_HALF),
    at(0.2, side * 1.75),
    at(3.4, side * 1.55),
    at(3.6, side * SHAFT_HALF),
  ]));

  /** The silhouette the rings are trimmed against: shaft box plus head. */
  const silhouette: Pt[] = [
    at(0, SHAFT_HALF),
    at(baseAt, SHAFT_HALF),
    at(baseAt, HEAD.half),
    at(tipAt, 0),
    at(baseAt, -HEAD.half),
    at(baseAt, -SHAFT_HALF),
    at(0, -SHAFT_HALF),
  ];

  return {
    head,
    fletch,
    silhouette,
    shaft: closedPath([at(0, SHAFT_HALF), at(baseAt + HEAD.barb, SHAFT_HALF), at(baseAt + HEAD.barb, -SHAFT_HALF), at(0, -SHAFT_HALF)]),
  };
})();

const GATE = polygonGate(arrow.silhouette, AIR);
const RING_RUNS = RINGS.map(r => trimRuns(sampleEllipse(CENTRE.x, CENTRE.y, r, r), GATE));
const BULL_RUNS = trimRuns(sampleEllipse(CENTRE.x, CENTRE.y, BULL, BULL), GATE);

export default function AimTarget({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      {RING_RUNS.map((runs, ring) =>
        runs.map((d, i) => (
          <Path
            key={`ring-${ring}-${i}`}
            d={d}
            stroke={c}
            strokeWidth={ring === 0 ? stroke.board : stroke.rule}
            fill="none"
            strokeLinecap="round"
            opacity={ring === 0 ? 1 : EMBLEM_LIGHT.rule}
          />
        )))}

      {/* ⚠ The bull is a RING, not a disc. Filled, it is the same colour as the
          arrowhead standing in it and the two merge into one smudge; drawn as
          a ring the head sits plainly inside it. It is trimmed like the
          others, so the shaft passes in front of it too. */}
      {BULL_RUNS.map((d, i) => (
        <Path key={`bull-${i}`} d={d} stroke={c} strokeWidth={stroke.rubric} fill="none" strokeLinecap="round" />
      ))}

      {arrow.fletch.map((d, i) => (
        <Path key={`fletch-${i}`} d={d} fill={c} opacity={EMBLEM_LIGHT.rule} />
      ))}
      <Path d={arrow.shaft} fill={c} />
      <Path d={arrow.head} fill={c} />
    </Svg>
  );
}
