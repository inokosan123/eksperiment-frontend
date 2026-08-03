/** Fixed-brand release policy shared by native UI and geometry tests. */
export const MAX_READABLE_FONT_MULTIPLIER = 1;
export const MIN_READABLE_LINE_HEIGHT_RATIO = 1.28;

export function clampReadableFontScale(_fontScale: number): number {
  return 1;
}

export function scaleReadableMetric(value: number, fontScale: number): number {
  return value * clampReadableFontScale(fontScale);
}

export function scaleReadableLineHeight(
  fontSize: number,
  lineHeight: number | undefined,
  _fontScale: number,
): number {
  return lineHeight ?? fontSize * MIN_READABLE_LINE_HEIGHT_RATIO;
}
