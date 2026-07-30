/* ─────────────────────────────────────────────────────────────
 * THE PRAYER ORBIT'S GEOMETRY, apart from the drawing of it.
 *
 * It lives in its own file for the same reason `ribbonCardGeometry`
 * does: this figure has one job that can be stated as arithmetic, it
 * has to hold for every size the reading comes out at, and checking it
 * by eye on one phone is how the first cut of it shipped WRONG.
 *
 * THE ONE JOB. The orbit reads as three-dimensional because the far
 * half of the ellipse is painted behind the digits and the near half in
 * front of them. For that to be visible at all, the arc must actually
 * OVERLAP the digits — near arc across their lower half, far arc behind
 * their upper half — while still reaching wider than the type so the
 * figure encircles it rather than sitting inside it.
 *
 * ⚠ WHY THIS IS NOT A MATTER OF PICKING NICE NUMBERS. The height a
 * tilted ellipse reaches is
 *
 *     maxY = √( (a·sinθ)² + (b·cosθ)² )
 *
 * and the FIRST term dominates. `a` is set by how wide the reading is,
 * so the moment an hour appears on the clock — a wider, shorter reading
 * — the tilt alone carried the arc clean over the digits and the whole
 * effect disappeared. No choice of `b` can pull it back, because the
 * tilt is already past the target on its own. The first version of this
 * did exactly that on two of five sizes; `tests/prayer-orbit.test.ts`
 * is what caught it.
 * ───────────────────────────────────────────────────────────── */

export type OrbitRing = {
  /** Semi-major axis, across. */
  a: number;
  /** Semi-minor axis, before the tilt. */
  b: number;
  /** In-plane tilt, radians. */
  tilt: number;
  /** Where on the ellipse this ring's bead starts, so the two never pair up. */
  phase: number;
  beadR: number;
  ink: { near: number; far: number };
};

export type OrbitRingSpec = {
  a: number;
  /** How far up and down the arc should reach, in points. */
  reach: number;
  /**
   * The signed share of `reach` the tilt is allowed to contribute, in
   * (−1, 1). Its sign is which way the ring leans, so two rings given
   * opposite signs cross like the hoops of an armillary sphere.
   */
  tiltShare: number;
  phase: number;
  beadR: number;
  ink: { near: number; far: number };
};

/** How wide and tall the orbit's own box is, around a reading of that size. */
export const ORBIT_BOX = { padX: 76, padY: 34 } as const;

/**
 * How far each ring reaches, as a share of the reading's half-height, and
 * how much of that reach its tilt provides.
 *
 * The outer ring crosses the digits low and the inner one nearer their
 * middle, so the two crossings are read as two separate hoops rather
 * than as one thick line.
 */
export const ORBIT_RINGS = {
  outer: { spread: 26, reach: 0.62, tiltShare: -0.55, phase: 0, beadR: 2.1, ink: { near: 0.52, far: 0.2 } },
  inner: { spread: 12, reach: 0.40, tiltShare: 0.62, phase: 0.37, beadR: 1.5, ink: { near: 0.3, far: 0.12 } },
} as const;

/** The smallest reading the geometry will build for, so an unmeasured
 *  first frame still draws something sane. */
export const ORBIT_MIN = { width: 120, height: 40 } as const;

/**
 * A ring that reaches exactly as far as it is told to.
 *
 * `b` and the tilt are SOLVED, not picked:
 *
 *     a·sinθ = tiltShare · reach        →  θ = asin(tiltShare·reach / a)
 *     b·cosθ = reach·√(1 − tiltShare²)  →  b = reach·√(1 − tiltShare²)/cosθ
 *
 * which gives maxY = reach identically, whatever `a` turns out to be.
 */
export function makeOrbitRing({ a, reach, tiltShare, phase, beadR, ink }: OrbitRingSpec): OrbitRing {
  const tilt = Math.asin(Math.max(-0.9, Math.min(0.9, (tiltShare * reach) / a)));
  const b = (reach * Math.sqrt(1 - tiltShare * tiltShare)) / Math.cos(tilt);
  return { a, b, tilt, phase, beadR, ink };
}

/**
 * One point of the tilted ellipse, and how near it is.
 *
 * `depth` runs −1 at the far side to +1 at the near side. It is taken
 * BEFORE the tilt is applied, because the tilt is an in-plane rotation
 * for looks and the near half is the lower half of the untilted figure.
 */
export function orbitPoint(ring: OrbitRing, t: number, cx = 0, cy = 0) {
  // Marked so the travelling bead can call this straight from its worklet
  // instead of keeping a second copy of the formula on the UI thread — two
  // copies of a formula are two formulas the moment one is tuned. Harmless
  // where it is called normally: on the JS side it is a string literal.
  'worklet';
  const lx = ring.a * Math.cos(t);
  const ly = ring.b * Math.sin(t);
  const cos = Math.cos(ring.tilt);
  const sin = Math.sin(ring.tilt);
  return {
    x: cx + lx * cos - ly * sin,
    y: cy + lx * sin + ly * cos,
    depth: Math.sin(t),
  };
}

/**
 * Half the ellipse, as a polyline.
 *
 * Not an SVG arc command: an arc across a rotated ellipse needs the
 * large-arc and sweep flags reasoned out correctly in a coordinate
 * system whose y runs downward, and getting one of them backwards
 * silently draws the other half. Forty-eight sampled points are exact
 * to well under a pixel at this size, cost nothing — the string is
 * built once and never animated — and cannot be subtly wrong.
 */
export function orbitHalfPath(ring: OrbitRing, cx: number, cy: number, near: boolean) {
  const from = near ? 0 : Math.PI;
  const steps = 48;
  let d = '';
  for (let i = 0; i <= steps; i += 1) {
    const p = orbitPoint(ring, from + (Math.PI * i) / steps, cx, cy);
    d += `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  return d;
}

/** Everything the orbit needs, resolved against the measured reading. */
export function orbitGeometry(readout: { width: number; height: number }) {
  const w = Math.max(ORBIT_MIN.width, readout.width);
  const h = Math.max(ORBIT_MIN.height, readout.height);
  const boxW = w + ORBIT_BOX.padX;
  const boxH = h + ORBIT_BOX.padY;
  const cx = boxW / 2;
  const cy = boxH / 2;
  const half = h / 2;

  const rings = [ORBIT_RINGS.outer, ORBIT_RINGS.inner].map(spec => makeOrbitRing({
    a: w / 2 + spec.spread,
    reach: half * spec.reach,
    tiltShare: spec.tiltShare,
    phase: spec.phase,
    beadR: spec.beadR,
    ink: spec.ink,
  }));

  return {
    boxW,
    boxH,
    cx,
    cy,
    rings,
    paths: rings.map(ring => ({
      near: orbitHalfPath(ring, cx, cy, true),
      far: orbitHalfPath(ring, cx, cy, false),
    })),
  };
}

/** How far a bead's halo spills past the ring it rides. */
export function orbitHaloReach(ring: OrbitRing) {
  return ring.beadR * 3.4;
}
