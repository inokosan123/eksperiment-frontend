/**
 * MY RULE'S OWN COLOUR.
 *
 * The Prayer Book's five hours already hold amber, blue, violet, gold and
 * emerald. My Rule is not an hour and belongs to no single tradition, so it
 * takes none of them: a dove blue, bright and western, kept in one place
 * because the switch's left face and the page it opens must be struck in
 * exactly the same light or they read as two unrelated things.
 */
export const MINE_ACCENT = '#5B7FA6';
export const MINE_INK = '#3E546E';
export const MINE_TINT = '#EEF4FA';
export const MINE_BORDER = '#D5E1EE';

/** The accent at a given strength, for hairlines, seats and watermarks. */
export function mineAlpha(alpha: number) {
  return `rgba(91, 127, 166, ${alpha})`;
}
