/* ─────────────────────────────────────────────────────────────
 * THE GUARD'S SHIELD.
 *
 * Focus's two protection subjects — the phone and the web — are the
 * same promise about two different things, so they are drawn as the
 * same composition: THE THING BEING GUARDED, with this shield
 * standing in front of its lower-right corner, carrying a device
 * that says what kind of guarding it is.
 *
 * The shield lives here rather than in either emblem so the two can
 * never drift apart. One silhouette, one corner radius, one set of
 * devices, used twice.
 *
 * ⚠ HOW IT STANDS IN FRONT. Depth in a line drawing is one thing
 * plainly covering another. The obvious way is to fill the shield
 * with the background colour, and it is the wrong way here: these
 * emblems sit BOTH on a white disc and on a ribbon card's gradient
 * plate, and a fill can only ever match one of them.
 *
 * So nothing is filled: the object behind is sampled and the points
 * the shield covers are dropped. That machinery is generic and lives
 * in `emblemGeometry` — `AimTarget` uses it for an arrow standing in
 * front of a target. Only the shield's own silhouette is here.
 * ───────────────────────────────────────────────────────────── */

import { cubeAt, polygonGate, sampleLine, type Pt } from '@/components/icons/emblemGeometry';

export { sampleEllipse, sampleLine, sampleRoundRect, trimRuns } from '@/components/icons/emblemGeometry';

export type Box = { x: number; y: number; w: number; h: number };

/**
 * The classic shield: square shoulders with a small radius, sides falling
 * straight to just below the middle, then swept to a point at the foot.
 *
 * Everything is a share of the box, so one silhouette serves both emblems.
 */
export function guardShieldPath({ x, y, w, h }: Box): string {
  const r = w * 0.15;
  const x1 = x + w;
  const mid = y + h * 0.46;
  const cx = x + w / 2;
  const n = (v: number) => v.toFixed(2);
  return [
    `M ${n(x + r)} ${n(y)}`,
    `H ${n(x1 - r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(x1)} ${n(y + r)}`,
    `L ${n(x1)} ${n(mid)}`,
    `C ${n(x1)} ${n(y + h * 0.8)} ${n(x + w * 0.74)} ${n(y + h * 0.94)} ${n(cx)} ${n(y + h)}`,
    `C ${n(x + w * 0.26)} ${n(y + h * 0.94)} ${n(x)} ${n(y + h * 0.8)} ${n(x)} ${n(mid)}`,
    `L ${n(x)} ${n(y + r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}`,
    'Z',
  ].join(' ');
}

/** A hairline inside the edge — the family's tooled line, as on the Gospel. */
export function guardShieldInner(box: Box, inset: number): string {
  return guardShieldPath({
    x: box.x + inset,
    y: box.y + inset,
    w: box.w - inset * 2,
    h: box.h - inset * 2.1,
  });
}

/** Where a device sits on the shield: its visual centre, a little above true. */
export function shieldHeart(box: Box): { cx: number; cy: number } {
  return { cx: box.x + box.w / 2, cy: box.y + box.h * 0.44 };
}

// ── Occlusion ───────────────────────────────────────────────────────────────

/** The shield's silhouette as points, for the occlusion test. */
function shieldPolygon(box: Box): Pt[] {
  const { x, y, w, h } = box;
  const x1 = x + w, mid = y + h * 0.46, cx = x + w / 2, r = w * 0.15;
  const out: Pt[] = [];
  out.push(...sampleLine(x + r, y, x1 - r, y));
  out.push([x1, y + r], [x1, mid]);
  for (let i = 1; i <= 40; i++) {
    out.push(cubeAt([x1, mid], [x1, y + h * 0.8], [x + w * 0.74, y + h * 0.94], [cx, y + h], i / 40));
  }
  for (let i = 1; i <= 40; i++) {
    out.push(cubeAt([cx, y + h], [x + w * 0.26, y + h * 0.94], [x, y + h * 0.8], [x, mid], i / 40));
  }
  out.push([x, y + r]);
  return out;
}

/** A test for "this point is clear of the shield". See `polygonGate`. */
export function shieldGate(box: Box, pad: number): (p: Pt) => boolean {
  return polygonGate(shieldPolygon(box), pad);
}

// ── Devices ─────────────────────────────────────────────────────────────────

/**
 * The padlock the Web shield carries: a shut body with its shackle above.
 *
 * The body is filled and the shackle stroked — the mixed weight is what keeps
 * a lock this small from closing into a blob.
 */
export function padlock(box: Box, scale: number): {
  body: string;
  shackle: string;
  keyhole: { x: number; y1: number; y2: number };
} {
  const { cx, cy } = shieldHeart(box);
  const bw = 4.6 * scale, bh = 3.4 * scale;
  const bx = cx - bw / 2, by = cy - bh * 0.28;
  const r = 0.7 * scale, sr = bw * 0.3;
  const n = (v: number) => v.toFixed(2);
  return {
    body: [
      `M ${n(bx + r)} ${n(by)}`,
      `H ${n(bx + bw - r)}`,
      `A ${n(r)} ${n(r)} 0 0 1 ${n(bx + bw)} ${n(by + r)}`,
      `V ${n(by + bh - r)}`,
      `A ${n(r)} ${n(r)} 0 0 1 ${n(bx + bw - r)} ${n(by + bh)}`,
      `H ${n(bx + r)}`,
      `A ${n(r)} ${n(r)} 0 0 1 ${n(bx)} ${n(by + bh - r)}`,
      `V ${n(by + r)}`,
      `A ${n(r)} ${n(r)} 0 0 1 ${n(bx + r)} ${n(by)}`,
      'Z',
    ].join(' '),
    shackle: `M ${n(cx - sr)} ${n(by)} V ${n(by - sr * 0.72)} A ${n(sr)} ${n(sr)} 0 0 1 ${n(cx + sr)} ${n(by - sr * 0.72)} V ${n(by)}`,
    // Struck THROUGH the filled body in the emblem's own colour would be
    // invisible, so the keyhole is a short gap cut by drawing over it in the
    // page's stroke — see the emblem, which draws it as a slot at plate light.
    keyhole: { x: cx, y1: by + bh * 0.3, y2: by + bh * 0.72 },
  };
}

/** The tick the Screen Time shield carries: the limit was kept. */
export function shieldCheck(box: Box, scale: number): string {
  const { cx, cy } = shieldHeart(box);
  const n = (v: number) => v.toFixed(2);
  return [
    `M ${n(cx - 2.5 * scale)} ${n(cy)}`,
    `L ${n(cx - 0.7 * scale)} ${n(cy + 1.9 * scale)}`,
    `L ${n(cx + 2.7 * scale)} ${n(cy - 2.1 * scale)}`,
  ].join(' ');
}
