import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * THE CROWN — Challenges.
 *
 * The eyebrow reads SACRED EFFORTS, and the crown in this tradition
 * is what the effort is FOR — the martyr's crown, the one given at
 * the end.
 *
 * ⚠ NOT A TROPHY AND NOT A MEDALLION. The app ranks its rewards by
 * rarity: the trophy is the repeating unit and stands on Bucket
 * List, the medallion belongs to Focus. A third gold cup here would
 * collapse that. A crown is a different KIND of thing — received
 * rather than won — which is the distinction the card wants.
 *
 * IT IS A CLOSED CROWN, NOT A ZIGZAG. The first cut was the usual
 * three-spike outline, which is a shape everyone has seen on a
 * sticker and reads as nothing in particular. This one is built the
 * way a real one is: a banded CIRCLET, an ARCH rising from it to an
 * orb, and the cross standing on that. The arch is what makes it an
 * object with a volume rather than a silhouette, and the second,
 * shallower arch behind it at hairline light is what tells the eye
 * the crown is round and not flat.
 *
 * THE PENDILIA are the detail worth keeping: two jewelled strands
 * hanging from the band, as Byzantine crowns wear them. They give
 * the mark a bottom — the thing this family always needs — and they
 * are the reason it looks made rather than drawn.
 *
 * Solid masses: the centre gem cut as a lozenge, two pearls beside
 * it, the orb under the cross and the two hanging jewels. See
 * `emblemStroke`.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

/** The circlet the whole crown stands on. */
const BAND = { x: 3.8, y: 15.4, w: 16.4, h: 4.0, r: 1.1 } as const;
/** A tooled line along its lower edge. */
const BAND_RULE = { y: 18.2, x1: 5.2, x2: 18.8 } as const;

/** The arch, rising from the band's shoulders to the orb. */
const ARCH = 'M 5.0 15.4 C 5.4 10.8 8.2 8.9 12 8.9 C 15.8 8.9 18.6 10.8 19.0 15.4';
/** The arch behind it — this is what makes the crown read as round. */
const ARCH_BACK = 'M 8.6 15.4 C 8.8 12.3 10.2 11.0 12 11.0 C 13.8 11.0 15.2 12.3 15.4 15.4';

/** The orb where the arches meet, and the cross standing on it. */
const ORB = { cx: 12, cy: 8.9, r: 0.95 } as const;
const CROSS = {
  x: 12, top: 2.4, foot: 8.4,
  titulus: { y: 3.6, x1: 10.85, x2: 13.15 },
  bar: { y: 5.2, x1: 9.7, x2: 14.3 },
} as const;

/** The centre stone, cut as a lozenge so it is not a third round bead. */
const GEM = { cx: 12, cy: 17.3, half: 1.35 } as const;
const GEM_PATH =
  `M ${GEM.cx} ${GEM.cy - GEM.half} L ${GEM.cx + GEM.half} ${GEM.cy} L ${GEM.cx} ${GEM.cy + GEM.half} L ${GEM.cx - GEM.half} ${GEM.cy} Z`;
const BAND_PEARLS: readonly number[] = [7.4, 16.6];

/** Jewelled strands hanging from the band, as Byzantine crowns wear them. */
const PENDILIA: readonly number[] = [5.9, 18.1];
const PEND = { top: 19.4, foot: 21.7, jewel: 22.6, r: 0.85 } as const;

export default function EffortCrown({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      <Path d={ARCH_BACK} stroke={c} strokeWidth={stroke.hair} fill="none" strokeLinecap="round" opacity={EMBLEM_LIGHT.hair} />
      <Path d={ARCH} stroke={c} strokeWidth={stroke.board} fill="none" strokeLinecap="round" />

      {PENDILIA.map((x, i) => (
        <Line key={`pend-${i}`} x1={x} y1={PEND.top} x2={x} y2={PEND.foot} stroke={c} strokeWidth={stroke.block} strokeLinecap="round" opacity={EMBLEM_LIGHT.block} />
      ))}
      {PENDILIA.map((x, i) => (
        <Circle key={`jewel-${i}`} cx={x} cy={PEND.jewel} r={PEND.r} fill={c} />
      ))}

      <Rect
        x={BAND.x}
        y={BAND.y}
        width={BAND.w}
        height={BAND.h}
        rx={BAND.r}
        ry={BAND.r}
        stroke={c}
        strokeWidth={stroke.board}
        fill="none"
      />
      <Line x1={BAND_RULE.x1} y1={BAND_RULE.y} x2={BAND_RULE.x2} y2={BAND_RULE.y} stroke={c} strokeWidth={stroke.hair} strokeLinecap="round" opacity={EMBLEM_LIGHT.hair} />

      <Path d={GEM_PATH} fill={c} />
      {BAND_PEARLS.map((cx, i) => (
        <Circle key={`pearl-${i}`} cx={cx} cy={GEM.cy} r={0.85} fill={c} />
      ))}

      <Circle cx={ORB.cx} cy={ORB.cy} r={ORB.r} fill={c} />
      <Line x1={CROSS.x} y1={CROSS.top} x2={CROSS.x} y2={CROSS.foot} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />
      <Line x1={CROSS.titulus.x1} y1={CROSS.titulus.y} x2={CROSS.titulus.x2} y2={CROSS.titulus.y} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />
      <Line x1={CROSS.bar.x1} y1={CROSS.bar.y} x2={CROSS.bar.x2} y2={CROSS.bar.y} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />
    </Svg>
  );
}
