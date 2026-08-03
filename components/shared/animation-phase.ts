export function continuousPhase(elapsedMs: number, durationMs: number, offset = 0): number {
  'worklet';
  const phase = (elapsedMs / durationMs + offset) % 1;
  return phase < 0 ? phase + 1 : phase;
}

export function easeInOutQuad(progress: number): number {
  'worklet';
  return progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
}

/**
 * A near-exact half-sine pulse without a transcendental call in every frame.
 * Bhaskara's rational approximation stays within roughly 0.16% of
 * `sin(πx)` on 0…1 while using only basic arithmetic.
 */
export function halfSinePulse(progress: number): number {
  'worklet';
  const x = Math.max(0, Math.min(1, progress));
  const product = x * (1 - x);
  return (16 * product) / (5 - 4 * product);
}

export function windowedHalfSinePulse(
  elapsedMs: number,
  durationMs: number,
  offset: number,
  window: number,
): number {
  'worklet';
  const phase = continuousPhase(elapsedMs, durationMs, offset);
  return phase < window ? halfSinePulse(phase / window) : 0;
}

/** Matches withRepeat(withTiming(0→1, legDuration), -1, true). */
export function pingPongPhase(elapsedMs: number, legDurationMs: number, offsetMs = 0): number {
  'worklet';
  const cycle = legDurationMs * 2;
  const phase = continuousPhase(elapsedMs - offsetMs, cycle);
  return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
}

/** Linear 0→1→0 phase for callers that must preserve a specific easing. */
export function trianglePhase(elapsedMs: number, legDurationMs: number, offsetMs = 0): number {
  'worklet';
  const phase = continuousPhase(elapsedMs - offsetMs, legDurationMs * 2);
  return phase <= 0.5 ? phase * 2 : (1 - phase) * 2;
}
