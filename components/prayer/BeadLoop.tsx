import { useMemo } from 'react';
import Svg, { Circle, Line } from 'react-native-svg';

/* ─────────────────────────────────────────────────────────────
 * THE PRAYER ROPE.
 *
 * Drawn rather than borrowed: the icon set has no beads, and at any
 * size a straight string of them is indistinguishable from an
 * ellipsis. What everyone who has held a rope or a rosary recognises
 * instantly is the whole object — a LOOP, the knot where it is tied,
 * a short tail, and a cross at the end of it.
 *
 * A bare ring of dots was the first attempt and it read as a flower.
 * The tail and the cross are what turn a circle into a rope; they
 * cost four more paths and they are the entire difference.
 *
 * Everything is laid out in a 24-unit square and scaled, so one
 * component serves both the 21pt mark on a list row and the ~110pt
 * emblem bleeding off a card's corner.
 * ───────────────────────────────────────────────────────────── */

/** Beads around the loop. Twelve reads as a rope; six reads as a flower. */
const BEAD_COUNT = 12;

const LOOP = { cx: 12, cy: 9.1, r: 6.5 };
/** Where the rope is tied, and where the hand comes back to rest. */
const KNOT = { cx: 12, cy: LOOP.cy + LOOP.r };
const CROSS = { top: 18.6, bottom: 23, arm: 20.1, halfArm: 2.1 };

export default function BeadLoop({
  s: size = 24,
  c = '#000',
  w = 1.2,
}: {
  s?: number;
  c?: string;
  w?: number;
}) {
  const k = size / 24;

  // The knot occupies the bottom of the ring, so the beads skip that seat
  // rather than piling a bead on top of it.
  const beads = useMemo(() => (
    Array.from({ length: BEAD_COUNT - 1 }, (_, i) => {
      const angle = ((i + 1) / BEAD_COUNT) * Math.PI * 2 + Math.PI / 2;
      return {
        cx: (LOOP.cx + Math.cos(angle) * LOOP.r) * k,
        cy: (LOOP.cy + Math.sin(angle) * LOOP.r) * k,
      };
    })
  ), [k]);

  const bead = Math.max(0.9, 1.15 * k);
  const cord = Math.max(0.5, w * 0.55 * k);
  const stem = Math.max(0.8, w * 0.95 * k);

  return (
    <Svg width={size} height={size}>
      {/* The cord the beads are strung on, under them. */}
      <Circle
        cx={LOOP.cx * k}
        cy={LOOP.cy * k}
        r={LOOP.r * k}
        stroke={c}
        strokeWidth={cord}
        fill="none"
        opacity={0.45}
      />

      {beads.map((b, i) => (
        <Circle key={i} cx={b.cx} cy={b.cy} r={bead} fill={c} />
      ))}

      {/* The knot — a heavier bead where the two ends meet. */}
      <Circle cx={KNOT.cx * k} cy={KNOT.cy * k} r={bead * 1.55} fill={c} />

      {/* The tail, and the cross hanging from it. */}
      <Line
        x1={KNOT.cx * k}
        y1={KNOT.cy * k}
        x2={KNOT.cx * k}
        y2={CROSS.top * k}
        stroke={c}
        strokeWidth={cord}
        opacity={0.5}
      />
      {/* The cross stands on the loop's own axis. */}
      <Line
        x1={KNOT.cx * k}
        y1={CROSS.top * k}
        x2={KNOT.cx * k}
        y2={CROSS.bottom * k}
        stroke={c}
        strokeWidth={stem}
        strokeLinecap="round"
      />
      <Line
        x1={(KNOT.cx - CROSS.halfArm) * k}
        y1={CROSS.arm * k}
        x2={(KNOT.cx + CROSS.halfArm) * k}
        y2={CROSS.arm * k}
        stroke={c}
        strokeWidth={stem}
        strokeLinecap="round"
      />
    </Svg>
  );
}
