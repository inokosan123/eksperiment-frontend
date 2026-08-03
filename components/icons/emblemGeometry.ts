/* ─────────────────────────────────────────────────────────────
 * EMBLEM GEOMETRY.
 *
 * Sampling and occlusion for the drawn card emblems. It began inside
 * `guardShield`, where the shield had to stand plainly in FRONT of a
 * phone and a globe; `AimTarget` needs exactly the same thing for an
 * arrow standing in front of a target, so it lives here and both use
 * it.
 *
 * ⚠ WHY NOT A FILL, AND WHY NOT A MASK. The obvious way to put one
 * thing in front of another is to fill the front one with the
 * background colour. These emblems sit on a white disc AND on a
 * ribbon card's gradient plate, so a fill can only ever match one of
 * them. `Mask` would work but is unused anywhere else in this app,
 * and its native behaviour is not something to discover on a
 * shipping card.
 *
 * So the thing behind is sampled into points, the points the front
 * shape covers are DROPPED, and what remains is emitted as open runs
 * that genuinely stop at its edge. Background-independent, and it
 * costs nothing at render: every run is computed once at module load
 * and handed to `<Path>` as finished data.
 * ───────────────────────────────────────────────────────────── */

export type Pt = readonly [number, number];

export function cubeAt(p0: Pt, c1: Pt, c2: Pt, p1: Pt, t: number): Pt {
  const u = 1 - t;
  return [
    u ** 3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p1[0],
    u ** 3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p1[1],
  ];
}

export function sampleLine(x1: number, y1: number, x2: number, y2: number, step = 0.22): Pt[] {
  const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step));
  return Array.from({ length: n + 1 }, (_, i) => [x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n] as Pt);
}

export function sampleEllipse(cx: number, cy: number, rx: number, ry: number, step = 0.22): Pt[] {
  const n = Math.max(24, Math.ceil((Math.PI * (rx + ry)) / step));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as Pt;
  });
}

/** A rounded rectangle's outline, walked clockwise from the top-left corner. */
export function sampleRoundRect(x: number, y: number, w: number, h: number, r: number, step = 0.22): Pt[] {
  const out: Pt[] = [];
  const arc = (cx: number, cy: number, from: number) => {
    const n = Math.max(4, Math.ceil((Math.PI * r) / (2 * step)));
    for (let i = 0; i <= n; i++) {
      const a = from + (i / n) * (Math.PI / 2);
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  out.push(...sampleLine(x + r, y, x + w - r, y, step));
  arc(x + w - r, y + r, -Math.PI / 2);
  out.push(...sampleLine(x + w, y + r, x + w, y + h - r, step));
  arc(x + w - r, y + h - r, 0);
  out.push(...sampleLine(x + w - r, y + h, x + r, y + h, step));
  arc(x + r, y + h - r, Math.PI / 2);
  out.push(...sampleLine(x, y + h - r, x, y + r, step));
  arc(x + r, y + r, Math.PI);
  return out;
}

function inside(poly: Pt[], px: number, py: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function distToPoly(poly: Pt[], px: number, py: number): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    const dx = xj - xi, dy = yj - yi;
    const len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - xi) * dx + (py - yi) * dy) / len));
    best = Math.min(best, Math.hypot(px - (xi + t * dx), py - (yi + t * dy)));
  }
  return best;
}

/**
 * A test for "this point is clear of `poly`".
 *
 * `pad` is the air left between the front shape's edge and whatever passes
 * behind it. Without it the two outlines meet exactly and read as one welded
 * shape; with it the thing behind plainly goes BEHIND. It wants to be about
 * half the front shape's stroke plus a little.
 */
export function polygonGate(poly: Pt[], pad: number): (p: Pt) => boolean {
  return ([x, y]: Pt) => !inside(poly, x, y) && distToPoly(poly, x, y) >= pad;
}

/** Splits a sampled line into the runs of it the front shape does not cover. */
export function trimRuns(points: Pt[], gate: (p: Pt) => boolean): string[] {
  const runs: Pt[][] = [];
  let run: Pt[] = [];
  for (const p of points) {
    if (gate(p)) run.push(p);
    else if (run.length) { runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  return runs
    .filter(r => r.length > 1)
    .map(r => r.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' '));
}

/** A closed path from a list of points — for a silhouette drawn as one shape. */
export function closedPath(pts: Pt[]): string {
  return `${pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')} Z`;
}
