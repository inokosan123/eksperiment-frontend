import { clampReadableFontScale } from '@/components/shared/typographyScalePolicy';

/* ─────────────────────────────────────────────────────────────
 * RIBBON — where things stand on the plate.
 *
 * The design was drawn in the card lab, inside a dashed shell that
 * ate 66pt of the screen. The real card gives back 34 of those, and
 * then keeps moving: 288pt on a small phone, 398 on a large one. A
 * constellation pinned at fixed pixel offsets cannot survive that
 * spread — measured against it, seven of the eight stars broke out
 * of their room, and one landed underneath the arrow button, which
 * is opaque, so it spent its life invisible.
 *
 * So nothing here is a pixel guess. The plate is divided into three
 * rooms that are, by construction, clear of the type, the button and
 * the edges, and every star is placed INSIDE one of them as a
 * fraction of that room. A star cannot leave its room, whatever the
 * card's size — which is why `tests/ribbon-card.test.ts` can prove
 * the whole field is clean across every width the app runs at,
 * instead of us re-checking it by eye on each device.
 *
 * The one thing that must scale rather than hold still is the
 * emblem. Type is set in points and does not grow with the plate, but
 * the emblem is a proportion of it — 46% of the width in the lab —
 * and that proportion is the card's whole silhouette.
 * ───────────────────────────────────────────────────────────── */

/** What the card's layout nails down, in points. Mirrors the stylesheet. */
export const RIBBON = {
  /** body paddingHorizontal — the type's left margin, and the gutter's width */
  pad: 18,
  /** body paddingTop / paddingBottom */
  top: 16,
  bottom: 18,
  /** body maxWidth, as a share of the plate — sets where the sentence wraps */
  textWidth: 0.82,

  arrowInset: 14,
  arrowSize: 36,

  /* The type is absolutely sized, so these hold at every card width.
   * Eyebrow: 18 characters at most ('HIGHLIGHTS & NOTES'), Inter bold 10
   * with 2.4 tracking ≈ 8.6/char. Title: 14 at most ('Holy Scripture'),
   * EB Garamond 28 ≈ 13/char. Both carry a little margin. */
  labelEnd: 175,
  titleEnd: 205,

  /** rows of the type block: label, title, then the sentence */
  labelBottom: 28,
  titleTop: 36,
  titleBottom: 68,
  descTop: 72,
  descLine: 23,

  /** the emblem's share of the plate's width, as tuned in the lab at 326pt */
  emblemScale: 0.46,
  /** how far it hangs off the right and bottom, as a share of its own size */
  emblemBleedX: 0.173,
  emblemBleedY: 0.2,
} as const;

export type RibbonZone = 'gutter' | 'pocket' | 'column';
export type RibbonClock = 'shoulder' | 'foot';

export type Rect = { x0: number; y0: number; x1: number; y1: number };

/**
 * The three rooms a star may stand in — each one disjoint from the type,
 * the arrow and the plate's edges by construction, at any size.
 */
export function ribbonZones(
  w: number,
  h: number,
  labelEnd: number = RIBBON.labelEnd,
): Record<RibbonZone, Rect> {
  const arrowLeft = w - RIBBON.arrowInset - RIBBON.arrowSize;
  const arrowBottom = RIBBON.arrowInset + RIBBON.arrowSize;
  // Where the sentence is allowed to reach before it wraps.
  const wrapRight = RIBBON.textWidth * w - RIBBON.pad;

  return {
    // Left of the type, down the pale fold of the card.
    gutter: { x0: 2, y0: RIBBON.titleTop, x1: RIBBON.pad - 3, y1: h - RIBBON.bottom - 4 },
    // Past the end of the eyebrow ROW — which on Focus carries a live status
    // pill beside the words, and under a large system font size runs wider
    // than any constant could predict, so the card measures it and says.
    pocket: { x0: labelEnd + 6, y0: RIBBON.top, x1: arrowLeft - 12, y1: RIBBON.labelBottom },
    // Right of the sentence's wrap and below the arrow: the emblem's corner.
    column: { x0: wrapRight + 5, y0: arrowBottom + 6, x1: w - 6, y1: h - 6 },
  };
}

export type RibbonStarSpec = {
  zone: RibbonZone;
  /** position inside the zone, 0..1 — 0 is flush left/top, 1 flush right/bottom */
  u: number;
  v: number;
  size: number;
  clock: RibbonClock;
  phase: number;
  peak: number;
  /** the card's own tone, or white where the ground has gone saturated */
  tone: 'ink' | 'light';
  /** a fixed tilt, so eight identical sparks do not read as a printed pattern */
  turn: number;
};

/**
 * Eight stars: three framing the type on the pale shoulder, five circling the
 * emblem at the foot. The phases are deliberately uneven, so the gaps between
 * arrivals differ and neither group ever keeps time with itself.
 */
export const RIBBON_STARS: RibbonStarSpec[] = [
  // The lit shoulder. `u: 0.05` keeps the pocket star tucked against the end
  // of the eyebrow instead of drifting to mid-card on a large phone.
  { zone: 'pocket', u: 0.05, v: 0.2, size: 10, clock: 'shoulder', phase: 0.0, peak: 0.58, tone: 'ink', turn: 12 },
  { zone: 'gutter', u: 0.5, v: 0.13, size: 12, clock: 'shoulder', phase: 0.31, peak: 0.66, tone: 'ink', turn: -8 },
  { zone: 'gutter', u: 0.5, v: 0.84, size: 8, clock: 'shoulder', phase: 0.66, peak: 0.46, tone: 'ink', turn: 20 },

  // The foot, ringing the emblem.
  { zone: 'column', u: 0.06, v: 0.5, size: 11, clock: 'foot', phase: 0.0, peak: 0.62, tone: 'ink', turn: 0 },
  { zone: 'column', u: 0.58, v: 0.16, size: 9, clock: 'foot', phase: 0.22, peak: 0.5, tone: 'ink', turn: 15 },
  { zone: 'column', u: 0.24, v: 0.04, size: 12, clock: 'foot', phase: 0.44, peak: 0.58, tone: 'ink', turn: -10 },
  { zone: 'column', u: 0.94, v: 0.58, size: 10, clock: 'foot', phase: 0.62, peak: 0.85, tone: 'light', turn: 8 },
  { zone: 'column', u: 0.46, v: 0.94, size: 8, clock: 'foot', phase: 0.8, peak: 0.9, tone: 'light', turn: -18 },
];

/* ── The stack's rhythm ───────────────────────────────────────
 * Every main card reads the same continuous tabs clock, so its own phase and
 * tempo must keep the stack from moving in formation: the big star beside the
 * title should never arrive on all five at once.
 *
 * Offsetting the phase alone is not enough. Cards on the SAME period and
 * different phases hold a fixed formation — a wave rolling down the list,
 * repeating every ten seconds, which the eye learns as quickly as unison. So
 * the periods differ too, and the cards drift apart for good.
 *
 * Both come off irrationals rather than a random number: the spread is then
 * even for any number of cards, and identical on every launch, so it can be
 * checked here instead of watched for.
 */

/** The golden ratio: successive multiples land as far apart as numbers can. */
const PHI = 0.618033988749895;
/** √2 − 1, a second irrational, so stretch does not track offset. */
const SILVER = 0.414213562373095;

/** How much the periods may differ between cards, either way. */
const STRETCH = 0.16;

export function ribbonCardRhythm(index: number): { offset: number; stretch: number } {
  // A card that never learns its place must still keep time, not stop: NaN
  // would otherwise travel all the way into the worklet and blank the field.
  const i = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return {
    offset: (i * PHI) % 1,
    stretch: 1 + (((i * SILVER) % 1) - 0.5) * STRETCH,
  };
}

export type PlacedStar = RibbonStarSpec & { x: number; y: number; d: string };

/* The four-pointed spark, as control points in a 24×24 box: one moveTo
 * followed by four cubics. Kept as numbers rather than a path string so the
 * placed star can be emitted as finished path data. */
const SPARK: number[] = [
  12, 0,
  13.2, 7.4, 16.6, 10.8, 24, 12,
  16.6, 13.2, 13.2, 16.6, 12, 24,
  10.8, 16.6, 7.4, 13.2, 0, 12,
  7.4, 10.8, 10.8, 7.4, 12, 0,
];

/**
 * The spark, rotated about its own centre, scaled, and moved into place —
 * written out as path data.
 *
 * The position could equally be carried on the element's `transform`, but
 * that hands the placement of every star to a transform-string parser and to
 * the order react-native-svg composes its transform props in. Baking it into
 * the coordinates leaves nothing to interpret: what the geometry computes is
 * literally what gets drawn, and it can be checked here rather than on a
 * phone.
 */
export function sparkPath(x: number, y: number, size: number, turn: number): string {
  const k = size / 24;
  const a = (turn * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const at = (i: number) => {
    const dx = SPARK[i] - 12;
    const dy = SPARK[i + 1] - 12;
    const px = (12 + dx * cos - dy * sin) * k + x;
    const py = (12 + dx * sin + dy * cos) * k + y;
    return `${round(px)} ${round(py)}`;
  };
  let d = `M${at(0)}`;
  for (let i = 2; i < SPARK.length; i += 6) {
    d += `C${at(i)} ${at(i + 2)} ${at(i + 4)}`;
  }
  return `${d}Z`;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Resolve the field against a measured plate.
 *
 * The star's own size is taken out of the room before `u`/`v` are applied, so
 * `u: 1` puts its right edge on the room's right wall rather than its origin —
 * a star can never overhang the room it was given.
 */
export function placeRibbonStars(w: number, h: number, labelEnd?: number): PlacedStar[] {
  const zones = ribbonZones(w, h, labelEnd);
  const placed: PlacedStar[] = [];
  RIBBON_STARS.forEach(star => {
    const room = zones[star.zone];
    // A room can be squeezed out of existence — a long eyebrow with a status
    // pill beside it leaves almost nothing between the words and the arrow.
    // The star then goes without rather than being crushed onto the type: one
    // spark fewer is a thing nobody notices, and a spark on a word is the
    // thing everybody does.
    if (room.x1 - room.x0 < star.size || room.y1 - room.y0 < star.size) return;
    const x = room.x0 + star.u * (room.x1 - room.x0 - star.size);
    const y = room.y0 + star.v * (room.y1 - room.y0 - star.size);
    placed.push({ ...star, x, y, d: sparkPath(x, y, star.size, star.turn) });
  });
  return placed;
}

/**
 * The emblem holds its share of the plate rather than a fixed pixel size.
 *
 * Width alone is not enough, because the plate's height does not follow its
 * width — it goes the other way. A wide card wraps its sentence into FEWER
 * lines and comes out SHORTER, so on a large phone 46% of the width pushes
 * the emblem's head clean off the top edge: 84pt of it, on a 398 plate with a
 * two-line sentence. The mark is meant to bleed off the right and the bottom
 * and nowhere else; cut at the top as well, it stops reading as an object and
 * becomes a slab.
 *
 * So it is bounded by the height too, at exactly the point where its top edge
 * meets the plate's. The lab's own card — 150pt on a 326×182 plate — sat one
 * point inside that limit, which is why the proportion looked right there and
 * only there. This keeps the lab's number and holds it everywhere else.
 */
export function ribbonEmblem(w: number, h: number): { size: number; right: number; bottom: number } {
  const size = Math.round(
    Math.min(RIBBON.emblemScale * w, h / (1 + RIBBON.emblemBleedY)),
  );
  return {
    size,
    right: -Math.round(RIBBON.emblemBleedX * size),
    bottom: -Math.round(RIBBON.emblemBleedY * size),
  };
}

/**
 * A first-frame height for a card whose native layout has not reported yet.
 *
 * The real plate still replaces this estimate through `onLayout`. Keeping a
 * close estimate available synchronously means the emblem and constellation
 * can be present in the first committed frame instead of popping in one frame
 * later. The fixed 90pt is the measured label/title/padding block; each
 * description line contributes the stylesheet's 23pt line height.
 */
export function estimateRibbonHeight(w: number, description = '', readableScale?: number): number {
  const textWidth = Math.max(120, RIBBON.textWidth * w - RIBBON.pad * 2);
  const hasReadableCopy = readableScale !== undefined;
  const safeScale = hasReadableCopy
    ? clampReadableFontScale(readableScale)
    : 1;
  const averageGlyphWidth = 7.2 * safeScale;
  const spaceWidth = 4 * safeScale;
  const words = description.trim().split(/\s+/).filter(Boolean);
  let lines = 1;
  let lineWidth = 0;

  words.forEach(word => {
    const wordWidth = word.length * averageGlyphWidth;
    const nextWidth = lineWidth === 0 ? wordWidth : lineWidth + spaceWidth + wordWidth;
    if (lineWidth > 0 && nextWidth > textWidth) {
      lines += 1;
      lineWidth = wordWidth;
    } else {
      lineWidth = nextWidth;
    }
  });

  const titleGrowth = 0;
  return 90 + titleGrowth + Math.min(5, Math.max(2, lines)) * RIBBON.descLine * safeScale;
}
