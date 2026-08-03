import Svg, { Line, Path } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';
import { closedPath, cubeAt, type Pt } from '@/components/icons/emblemGeometry';

/* ─────────────────────────────────────────────────────────────
 * THE HEART, FILLING — Gratitude.
 *
 * The card's old mark was `Heart`, one path, which at emblem size is
 * an empty outline and — worse — says LOVE, not THANKS. The card
 * says "Notice God's gifts, record your blessings, and give thanks";
 * a bare heart carries none of that.
 *
 * ⚠ WHAT REPLACED THE NESTED HEARTS. The first cut gave the outline a
 * tooled heart inside it and a solid heart inside that — three of the
 * same shape on one centre, which is not density, it is a TARGET. At
 * emblem size the eye read concentric rings before it read a heart.
 *
 * What is there instead is the one image gratitude actually has: a
 * heart BEING FILLED. The lower part of the outline is solid, cut off
 * at a level and capped with a bright line — the app's own meniscus,
 * lifted from Home's rising-fire token, which is what makes a fill
 * read as something arriving rather than as a shape coloured in.
 * Above it, five rays fall on the cleft: the gifts, and the heart
 * that is filling with them.
 *
 * ⚠ THE FILL IS DERIVED FROM THE OUTLINE, not drawn beside it. The
 * heart is sampled, the points below the level are kept, and the two
 * runs are closed across the top — so the fill can never drift out of
 * the shape it belongs to, whatever either is tuned to next.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

/**
 * The heart, drawn LOW and LARGE in the grid, filling y 9.4 to 23.
 *
 * An earlier cut sat it in the middle with a halo of rays all round, which
 * left five units of the grid empty at the foot and pushed the mark's own
 * ceiling down to 66pt — low enough to have dragged every other emblem in the
 * app down with it.
 */
const HEART: readonly (readonly [Pt, Pt, Pt, Pt])[] = [
  [[12.0, 23.0], [8.65, 20.49], [3.4, 17.56], [3.4, 13.58]],
  [[3.4, 13.58], [3.4, 10.66], [6.03, 9.4], [8.3, 9.4]],
  [[8.3, 9.4], [10.21, 9.4], [11.4, 10.45], [12.0, 11.39]],
  [[12.0, 11.39], [12.59, 10.45], [13.79, 9.4], [15.7, 9.4]],
  [[15.7, 9.4], [17.97, 9.4], [20.59, 10.66], [20.59, 13.58]],
  [[20.59, 13.58], [20.59, 17.56], [15.34, 20.49], [12.0, 23.0]],
];

const OUTLINE = HEART.map(([p0, c1, c2, p1], i) =>
  `${i === 0 ? `M ${p0[0]} ${p0[1]} ` : ''}C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p1[0]} ${p1[1]}`,
).join(' ') + ' Z';

/**
 * Where the fill stands.
 *
 * ⚠ Tuned against the shape, not chosen. At 14.9 the surface came out 97% of
 * the heart's widest span — near enough to full width that it read as a CUT
 * across the shape rather than as a level inside it. Dropped to 15.9 it runs
 * 92%, visibly inset on both sides, and still leaves the fill at 38% of the
 * heart's area: filling, which is what the card is about, rather than full or
 * barely begun.
 */
const LEVEL = 15.9;

/**
 * The fill, and the width of its surface — both taken off the outline itself.
 *
 * The heart's own path runs bottom point → up the LEFT wall → over both lobes
 * → down the RIGHT wall → bottom point. So the points at or below the level
 * arrive as exactly two runs: a leading one climbing the left wall, and a
 * trailing one coming down the right. Joined head to tail they close into the
 * filled region, and the seam between them IS the surface.
 */
const { fill, surface } = (() => {
  const pts: Pt[] = [];
  for (const [p0, c1, c2, p1] of HEART) {
    for (let i = 0; i <= 40; i++) pts.push(cubeAt(p0, c1, c2, p1, i / 40));
  }
  const lead: Pt[] = [];
  const tail: Pt[] = [];
  let seenAbove = false;
  for (const p of pts) {
    if (p[1] >= LEVEL) (seenAbove ? tail : lead).push(p);
    else seenAbove = true;
  }
  const ring = [...lead, ...tail];
  const left = lead[lead.length - 1];
  const right = tail[0];
  return {
    fill: closedPath(ring),
    // ⚠ The seam's OWN y, not `LEVEL`. Sampling lands on the nearest point at
    // or below the level rather than exactly on it, so the fill's top edge
    // sits a fraction under — drawing the surface at `LEVEL` floated it off
    // the mass it is supposed to cap and left a hairline of ground between.
    surface: { x1: left[0], x2: right[0], y: (left[1] + right[1]) / 2 },
  };
})();

/**
 * The light coming down on it: a fan of five, all aimed at the heart's cleft
 * and standing clear above its lobes.
 *
 * A FAN, not a halo. Rays all round widen the mark without making it taller,
 * and the wide top corner is exactly what the arrow orb takes away.
 */
const CLEFT = { x: 12, y: 10.6 } as const;
const RAY_FROM = 4.2;
const RAY_TO = 6.8;
const RAYS = [40, 65, 90, 115, 140].map(deg => {
  const r = (deg * Math.PI) / 180;
  const dx = Math.cos(r), dy = -Math.sin(r);
  return [
    CLEFT.x + dx * RAY_FROM, CLEFT.y + dy * RAY_FROM,
    CLEFT.x + dx * RAY_TO, CLEFT.y + dy * RAY_TO,
  ] as const;
});

export default function GratefulHeart({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      {RAYS.map(([x1, y1, x2, y2], i) => (
        <Line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={c}
          strokeWidth={stroke.block}
          strokeLinecap="round"
          opacity={EMBLEM_LIGHT.block}
        />
      ))}

      {/* The fill first, the outline over it: the outline's own stroke then
          finishes the fill's edge instead of sitting beside it. */}
      <Path d={fill} fill={c} opacity={0.9} />
      <Path d={OUTLINE} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinejoin="round" />
      {/* The surface. Struck at the emblem's heaviest weight because it is the
          one line that says the heart is filling rather than merely half dark. */}
      <Line
        x1={surface.x1}
        y1={surface.y}
        x2={surface.x2}
        y2={surface.y}
        stroke={c}
        strokeWidth={stroke.heavy}
        strokeLinecap="round"
      />
    </Svg>
  );
}
