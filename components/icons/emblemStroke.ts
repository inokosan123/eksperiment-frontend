/* ─────────────────────────────────────────────────────────────
 * THE EMBLEM FAMILY.
 *
 * The section card blows its mark up to nearly half the plate's
 * width. At that size an icon-set glyph — one uniform hairline
 * traced round a 24px outline — is not an illustration, it is a
 * stretched icon, and there is nothing inside it to look at.
 *
 * `BeadLoop` was the first mark drawn for that size rather than
 * borrowed for it, and the three things it does are the whole
 * method:
 *
 *   1. MIXED WEIGHTS. Solid marks over a half-lit cord, not one
 *      stroke everywhere.
 *   2. INTERNAL DENSITY. Twelve elements, not two paths. This is
 *      what the eye finds at 80pt.
 *   3. A WHOLE OBJECT WITH A BOTTOM, so it can stand clear of the
 *      card's corner instead of being cropped by it.
 *
 * This module holds only the first of those, because it is the one
 * part that must be IDENTICAL across the family: five marks drawn
 * to five private weight scales would not look like one set.
 *
 * Weights are returned in GRID UNITS, so they scale with the emblem,
 * each with a floor in POINTS so the same component still holds
 * together at a list-row size. `gridHeight` is whatever the emblem's
 * viewBox is tall — 24 for a square mark, 24 for a portrait one
 * whose viewBox is narrower than it is high.
 * ───────────────────────────────────────────────────────────── */

/** What every emblem in the family accepts, and what `SectionCardIcon` wants. */
export type EmblemProps = { s?: number; c?: string; w?: number };

export type EmblemStrokes = {
  /** The subject — a cross, a title bar. The emblem's heaviest line. */
  heavy: number;
  /** Boards, covers, the outline of the thing itself. */
  board: number;
  /** A rubricated line: set apart from the text around it. */
  rubric: number;
  /** Ruled lines of type. Drawn at about half light. */
  rule: number;
  /** Page blocks, leaves, thickness. Drawn at about half light. */
  block: number;
  /** Tooled frames, margin rules. The faintest member. */
  hair: number;
};

export function emblemStrokes(size: number, w: number, gridHeight = 24): EmblemStrokes {
  // One point, expressed in the grid: lets a floor be stated in the size the
  // eye actually judges, while the design itself scales.
  const pt = gridHeight / size;
  const floored = (points: number, units: number) => Math.max(points * pt, units);
  return {
    heavy: floored(1.2, w * 0.92),
    board: floored(0.9, w * 0.62),
    rubric: floored(1.0, w * 0.66),
    rule: floored(0.7, w * 0.44),
    block: floored(0.6, w * 0.4),
    hair: floored(0.5, w * 0.34),
  };
}

/** How much light the half-lit members carry, so the family agrees on it. */
export const EMBLEM_LIGHT = { block: 0.45, rule: 0.5, hair: 0.42 } as const;
