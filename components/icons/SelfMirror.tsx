import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';
import { EMBLEM_LIGHT, emblemStrokes, type EmblemProps } from '@/components/icons/emblemStroke';

/* ─────────────────────────────────────────────────────────────
 * THE MIRROR — Ideal Self.
 *
 * The card's old mark was `Leaf`, which is growth in general and
 * this card in particular is not: it says "define the qualities you
 * are trying to live and CHECK THEM HONESTLY EACH DAY". That is
 * self-examination, and its image — in the ascetic writers as much
 * as anywhere — is the mirror. The leaf also sat one screen from
 * three other green growing things and had stopped meaning anything.
 *
 * A standing glass, framed, on a stem: oval rather than round, so it
 * is a looking-glass and not a porthole. It takes the family's own
 * construction — an outer frame, a TOOLED INNER LINE at the glass's
 * edge, and SOLID MASSES at the crest and the foot of the handle.
 *
 * ⚠ THE TWO ARCS ACROSS THE GLASS ARE THE WHOLE MARK. Without them
 * this is an empty oval on a stick — a hand fan, a portrait frame, a
 * lollipop. A struck highlight is the only thing that tells the eye
 * a surface is reflective, and it is why the mark reads at 77pt.
 *
 * ⚠ Judgement call, flagged: `Leaf` was replaced rather than
 * redrawn, on the card's own copy. If the mirror reads as vanity
 * rather than examination, a sapling in this construction is the
 * fallback and the placement below does not change.
 * ───────────────────────────────────────────────────────────── */

const GRID = 24;

const GLASS = { cx: 12, cy: 10.7, rx: 6.3, ry: 7.6 } as const;
const FRAME = { cx: 12, cy: 10.7, rx: 7.4, ry: 8.7 } as const;

// The crest at the head of the frame, and the knop at the foot of the stem.
// ⚠ The crest sat at cy 0.95 with r 1.05 — its head fell on y = -0.1, and an
// <Svg> clips to its viewBox, so the top of it was simply not drawn. Anything
// this family puts at the head or the foot has to be checked against 0 and 24.
const CREST = { cx: 12, cy: 2.0, r: 1.0 } as const;
const KNOP = { cx: 12, cy: 22.5, r: 1.15 } as const;
const STEM = { x: 12, top: 19.4, foot: 21.6 } as const;

/**
 * The highlight — two arcs across the upper left of the glass, the longer one
 * outside. Struck at rule light, not hairline: at hairline they vanish under
 * the mark's own resting opacity and the mirror goes back to being an oval.
 */
const GLINT_LONG = 'M 8.0 7.2 C 8.7 5.4 10.3 4.2 12.2 4.0';
const GLINT_SHORT = 'M 8.1 10.4 C 8.1 9.2 8.4 8.2 8.9 7.3';

export default function SelfMirror({ s: size = 24, c = '#000', w = 1.2 }: EmblemProps) {
  const stroke = emblemStrokes(size, w, GRID);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
      {/* The stem, drawn first so the frame closes over its head. */}
      <Line x1={STEM.x} y1={STEM.top} x2={STEM.x} y2={STEM.foot} stroke={c} strokeWidth={stroke.heavy} strokeLinecap="round" />
      <Circle cx={KNOP.cx} cy={KNOP.cy} r={KNOP.r} fill={c} />

      <Ellipse
        cx={FRAME.cx}
        cy={FRAME.cy}
        rx={FRAME.rx}
        ry={FRAME.ry}
        stroke={c}
        strokeWidth={stroke.board}
        fill="none"
      />
      <Ellipse
        cx={GLASS.cx}
        cy={GLASS.cy}
        rx={GLASS.rx}
        ry={GLASS.ry}
        stroke={c}
        strokeWidth={stroke.hair}
        fill="none"
        opacity={EMBLEM_LIGHT.hair}
      />

      <Path d={GLINT_LONG} stroke={c} strokeWidth={stroke.rule} fill="none" strokeLinecap="round" opacity={EMBLEM_LIGHT.rule} />
      <Path d={GLINT_SHORT} stroke={c} strokeWidth={stroke.rule} fill="none" strokeLinecap="round" opacity={EMBLEM_LIGHT.rule} />

      <Circle cx={CREST.cx} cy={CREST.cy} r={CREST.r} fill={c} />
    </Svg>
  );
}
