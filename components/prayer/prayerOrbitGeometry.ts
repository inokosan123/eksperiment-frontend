/* ─────────────────────────────────────────────────────────────
 * THE PRAYER ORBIT'S GEOMETRY, apart from the drawing of it.
 *
 * It lives in its own file for the same reason `ribbonCardGeometry`
 * does: this figure has one job that can be stated as arithmetic, it
 * has to hold for every size the screen comes out at, and checking it
 * by eye on one phone is how the first cut of it shipped WRONG.
 *
 * THE ONE JOB. The orbit reads as three-dimensional because the far
 * half of each hoop is painted BEHIND what it encircles and the near
 * half IN FRONT of it. For that to be visible at all, the arc must
 * actually OVERLAP the thing — so the hoop has to pass behind the upper
 * part of the standing object and come back across the lower part of
 * the page, while still reaching wider than both so it encircles rather
 * than sits inside.
 *
 * ⚠ WHY THIS IS NOT A MATTER OF PICKING NICE NUMBERS. The height a
 * tilted ellipse reaches is
 *
 *     maxY = √( (a·sinθ)² + (b·cosθ)² )
 *
 * and the FIRST term dominates. `a` is set by how wide the stage is, so
 * on a wide short one the tilt alone carries the arc clean past the
 * thing it was supposed to cross, and no choice of `b` pulls it back.
 * The first version of this did exactly that on two of five sizes;
 * `tests/prayer-orbit.test.ts` is what caught it.
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

/**
 * ⚠ THE ORBIT IS TWO SCALES OF ONE SYSTEM, AND IT HAS TO BE TWO.
 *
 * It began as hoops around the timer's digits alone, which was the
 * smaller idea: a ring around a number is an ornament on a readout,
 * while hoops around the standing figure are the room it is in. The
 * obvious fix — one big hoop around the object AND the reading together
 * — turns out to be impossible, and not as a matter of taste:
 *
 *     maxX ≤ a  ⟺  reach ≤ a
 *
 * for a tilted ellipse, exactly. (Substituting sinθ = share·reach/a into
 * maxX² = a²cos²θ + b²sin²θ reduces to reach² ≤ a² with everything else
 * cancelling, for ANY tilt share.) So a hoop tall enough to span a
 * column taller than it is wide must escape sideways past its own
 * width, where react-native-svg clips it off with a straight cut edge.
 * The stage on a tall phone is around 320 by 500, so this is not an
 * exotic corner — it is the ordinary case.
 *
 * Hence two presets, on one clock and one ignition, leaning against each
 * other so they read as one armillary system seen at two distances:
 *
 *   STAGE    the great hoops, round the icon or the cross — behind its
 *            upper body, in front of its lower one. This is the depth of
 *            the page.
 *   READOUT  the small ones the timer already had, kept because a
 *            reading with nothing around it would now be the only flat
 *            thing on the screen.
 *
 * `inset` is the clear air the hoop keeps inside the box's edge, ON TOP
 * of the room its own light needs — see `orbitGeometry`. `reach` is how
 * far up and down it goes, as a share of the CONTENT's half-height;
 * `pad` is the room the box holds around the content.
 */
export type OrbitPreset = 'stage' | 'readout';

export const ORBIT_PRESETS = {
  stage: {
    pad: { x: 0, y: 0 },
    rings: [
      { inset: 6, reach: 0.72, tiltShare: -0.42, phase: 0, beadR: 2.6, ink: { near: 0.24, far: 0.1 } },
      { inset: 26, reach: 0.55, tiltShare: 0.5, phase: 0.37, beadR: 1.8, ink: { near: 0.14, far: 0.06 } },
    ],
  },
  readout: {
    pad: { x: 112, y: 34 },
    rings: [
      { inset: 6, reach: 0.62, tiltShare: -0.55, phase: 0.5, beadR: 2.2, ink: { near: 0.3, far: 0.13 } },
      { inset: 24, reach: 0.4, tiltShare: 0.62, phase: 0.12, beadR: 1.5, ink: { near: 0.17, far: 0.07 } },
    ],
  },
} as const;

/**
 * The bead's halo, as a multiple of its own radius — and, since the halo
 * is the outermost thing the figure draws, the number the box has to be
 * measured against.
 *
 * ⚠ IT IS THE OUTERMOST LAYER AND MUST STAY SO. A wider blush lived
 * outside it for one revision; it was removed for being loud on a screen
 * that has to stay quiet, and if anything is ever put back beyond the
 * halo, this constant and `orbitSpill` are what the box is sized from.
 */
export const ORBIT_HALO_MUL = 3.2;

export function orbitSpill(ring: OrbitRing) {
  return ring.beadR * ORBIT_HALO_MUL;
}

/** The smallest content the geometry will build for, so an unmeasured
 *  first frame still draws something sane. */
export const ORBIT_MIN = {
  stage: { width: 220, height: 260 },
  readout: { width: 120, height: 40 },
} as const;

/**
 * A ring that reaches exactly as far as it is told to.
 *
 * `b` and the tilt are SOLVED, not picked:
 *
 *     a·sinθ = share · reach            →  θ = asin(share·reach / a)
 *     b·cosθ = reach·√(1 − share²)      →  b = reach·√(1 − share²)/cosθ
 *
 * so that maxY² = (a·sinθ)² + (b·cosθ)² = share²·reach² + reach²(1−share²)
 * = reach², whatever `a` turns out to be.
 *
 * ⚠ WHEN THE ASKED-FOR TILT IS IMPOSSIBLE, THE TILT GIVES WAY — NOT THE
 * REACH. `share·reach/a` is the sine of an angle, so it cannot pass 1; a
 * narrow stage with a tall reach asks for exactly that. Clamping the
 * angle alone and keeping the requested share in `b` was wrong and the
 * tests caught it: the two disagreed and the ring came out short. So the
 * clamp is folded back into the share that is actually achieved, which
 * keeps maxY = reach true for every input rather than for the convenient
 * ones.
 */
export function makeOrbitRing({ a, reach, tiltShare, phase, beadR, ink }: OrbitRingSpec): OrbitRing {
  // Short of 1, so `b` stays finite as the ellipse approaches edge-on.
  const LIMIT = 0.9;
  const sin = Math.max(-LIMIT, Math.min(LIMIT, (tiltShare * reach) / a));
  const tilt = Math.asin(sin);
  const share = reach === 0 ? 0 : (sin * a) / reach;
  const b = (reach * Math.sqrt(Math.max(0, 1 - share * share))) / Math.cos(tilt);
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
 * silently draws the other half. Sampled points are exact to well under
 * a pixel at this size, cost nothing — the string is built once and
 * never animated — and cannot be subtly wrong.
 */
export const ORBIT_STEPS = 64;

export function orbitHalfPath(ring: OrbitRing, cx: number, cy: number, near: boolean) {
  const from = near ? 0 : Math.PI;
  let d = '';
  for (let i = 0; i <= ORBIT_STEPS; i += 1) {
    const p = orbitPoint(ring, from + (Math.PI * i) / ORBIT_STEPS, cx, cy);
    d += `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }
  return d;
}

/** Everything the orbit needs, resolved against the measured content. */
export function orbitGeometry(
  content: { width: number; height: number },
  preset: OrbitPreset = 'stage',
) {
  const { pad, rings: specs } = ORBIT_PRESETS[preset];
  const floor = ORBIT_MIN[preset];
  const w = Math.max(floor.width, content.width) + pad.x;
  const h = Math.max(floor.height, content.height) + pad.y;
  const cx = w / 2;
  const cy = h / 2;
  // ⚠ Off the CONTENT, not off the padded box. On the readout preset the
  // padding is most of the box, and measuring the reach against it would
  // sail the arcs clean over the digits — which is the exact failure the
  // whole solved-geometry approach exists to prevent.
  const half = Math.max(floor.height, content.height) / 2;

  const rings = specs.map(spec => {
    /**
     * ⚠ THE BEAD'S OWN LIGHT IS SUBTRACTED HERE, so the figure cannot
     * escape its box whatever else is tuned.
     *
     * react-native-svg clips to its surface, and a halo cut off by that
     * edge is a glow ending in a straight line — the worst failure this
     * drawing has. Reserving the halo's radius up front makes that
     * impossible by construction rather than by a constant somebody has
     * to remember to keep in step with `beadR`.
     */
    const a = Math.max(40, w / 2 - spec.inset - spec.beadR * ORBIT_HALO_MUL);
    return makeOrbitRing({
      a,
      /**
       * ⚠ THE REACH IS CAPPED AT THE SEMI-AXIS, AND THAT ONE `min` IS
       * WHAT KEEPS THE FIGURE INSIDE THE SCREEN.
       *
       * A tilted ellipse whose reach exceeds its own `a` swings out
       * SIDEWAYS as it leans: on a narrow tall stage the outer hoop
       * wanted 216 of reach against a semi-axis of 124 and ended up 228
       * wide in a box only 140 wide — clipped by react-native-svg with a
       * straight cut edge, which is the worst thing that can happen to a
       * glow. The tests caught it on two of five stages.
       *
       * At reach = a the arithmetic falls out exactly: maxX² becomes
       * a²[(1−t²) + t²] = a², for ANY tilt share. So capping here bounds
       * the width at `a` — that is, at the stage's own half-width less
       * its inset — with no case analysis and nothing left to tune.
       */
      reach: Math.min(half * spec.reach, a),
      tiltShare: spec.tiltShare,
      phase: spec.phase,
      beadR: spec.beadR,
      ink: spec.ink,
    });
  });

  return {
    boxW: w,
    boxH: h,
    cx,
    cy,
    rings,
    paths: rings.map(ring => ({
      near: orbitHalfPath(ring, cx, cy, true),
      far: orbitHalfPath(ring, cx, cy, false),
    })),
  };
}
