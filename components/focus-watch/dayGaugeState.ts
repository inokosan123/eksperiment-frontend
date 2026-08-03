export const GAUGE_UNDER_COLOR = '#327153';
export const GAUGE_TOLERANCE_COLOR = '#B07E23';
export const GAUGE_ESSENTIALS_COLOR = '#A24351';

export type DayGaugeStanding = 'unknown' | 'under' | 'tolerance' | 'essentials';

export function gaugeStanding(
  goalMinutes: number,
  toleranceEndMinutes: number | null,
  usedMinutes: number | null
): DayGaugeStanding {
  if (usedMinutes == null) return 'unknown';
  // The native hard wall takes effect at equality. Check it before the goal so
  // a zero-length tolerance cannot look healthy while Essentials is active.
  if (toleranceEndMinutes != null && usedMinutes >= toleranceEndMinutes) return 'essentials';
  if (usedMinutes <= goalMinutes) return 'under';
  if (toleranceEndMinutes != null) return 'tolerance';
  return 'essentials';
}

// The traffic-light color of a standing; `fallback` is used while usage is unknown.
export function gaugeStateColor(standing: DayGaugeStanding, fallback: string) {
  if (standing === 'under') return GAUGE_UNDER_COLOR;
  if (standing === 'tolerance') return GAUGE_TOLERANCE_COLOR;
  if (standing === 'essentials') return GAUGE_ESSENTIALS_COLOR;
  return fallback;
}
