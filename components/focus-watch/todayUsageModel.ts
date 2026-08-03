export type UsageBoundaryMode = 'blocked' | 'limit' | 'noLimit';
export type UsageBoundaryState = 'blocked' | 'met' | 'open' | 'over' | 'planned' | 'within';
export type UsageActivityState = 'active' | 'pending' | 'quiet';
export type UsageVisualState = 'atLimit' | 'limitActive' | 'noLimit' | 'overLimit' | 'pending';

export function usageActivityState(used: number | null): UsageActivityState {
  if (used == null) return 'pending';
  return used > 0 ? 'active' : 'quiet';
}

export function usageBoundaryState(
  mode: UsageBoundaryMode,
  limit: number | null,
  used: number | null
): UsageBoundaryState {
  if (mode === 'blocked') return used != null && used > 0 ? 'over' : 'blocked';
  if (mode === 'noLimit' || limit == null) return 'open';
  if (used == null || used === 0) return 'planned';
  if (used === limit) return 'met';
  return used > limit ? 'over' : 'within';
}

// The report deliberately has fewer visual states than rule states. A blocked
// group that held at 0 minutes wears the same calm, firm treatment as a limit
// met exactly; only recorded use after either boundary turns the card red.
export function usageVisualState(
  mode: UsageBoundaryMode,
  limit: number | null,
  used: number | null
): UsageVisualState {
  if (used == null) return 'pending';
  if (mode === 'blocked') return used > 0 ? 'overLimit' : 'atLimit';
  if (mode === 'noLimit' || limit == null) return 'noLimit';
  if (used < limit) return 'limitActive';
  if (used === limit) return 'atLimit';
  return 'overLimit';
}

export function sortUsageRows<T extends { name: string; usedMinutes: number | null }>(rows: T[]): T[] {
  return [...rows].sort((first, second) => {
    const firstActive = usageActivityState(first.usedMinutes) === 'active';
    const secondActive = usageActivityState(second.usedMinutes) === 'active';
    if (firstActive !== secondActive) return firstActive ? -1 : 1;
    if (firstActive && secondActive && first.usedMinutes !== second.usedMinutes) {
      return (second.usedMinutes ?? 0) - (first.usedMinutes ?? 0);
    }
    return first.name.localeCompare(second.name);
  });
}

// ---------------------------------------------------------------------------
// Boundary appearance
// ---------------------------------------------------------------------------
//
// `usageVisualState` above folds a configured block into the same treatment as
// a limit — calm when held, red when exceeded. That reads a standing block and
// a broken limit as the same event, and they are not: Apple's report counts
// every minute of the day, including minutes spent before the plan became
// active, so a blocked group showing time is a fact to state, not a violation
// to accuse. These six appearances keep the two apart.
//
// Colour here carries STATE, never category and never identity.

export type FocusBoundaryAppearance =
  | 'pending'
  | 'noLimit'
  | 'limitActive'
  | 'blocked'
  | 'atLimit'
  | 'overLimit';

export type FocusSecondarySignal =
  | { kind: 'childOver'; count: number }
  | { kind: 'childAtLimit'; count: number }
  | { kind: 'recordedWhileBlocked'; minutes: number }
  | null;

export type FocusBoundaryInput = {
  mode: UsageBoundaryMode;
  limitMinutes: number | null;
  usedMinutes: number | null;
};

/**
 * Precedence, in order:
 *
 *   1. usage unknown            → pending
 *   2. configured block         → blocked
 *   3. no effective limit       → noLimit
 *   4. used < limit             → limitActive
 *   5. used === limit           → atLimit
 *   6. used > limit             → overLimit
 *
 * Pending outranks everything, including a block: with no report yet there is
 * nothing truthful to say about how the boundary held.
 *
 * A limit of exactly zero minutes is a block wearing a limit's clothes — the
 * enforcement path refuses the first minute — so it is presented as one. That
 * is a presentation-level normalisation only; no rule is rewritten.
 */
export function focusBoundaryAppearance({
  mode,
  limitMinutes,
  usedMinutes,
}: FocusBoundaryInput): FocusBoundaryAppearance {
  if (usedMinutes == null) return 'pending';
  if (mode === 'blocked') return 'blocked';
  if (mode === 'limit' && limitMinutes === 0) return 'blocked';
  if (mode === 'noLimit' || limitMinutes == null) return 'noLimit';
  if (usedMinutes < limitMinutes) return 'limitActive';
  if (usedMinutes === limitMinutes) return 'atLimit';
  return 'overLimit';
}

/** Minutes past the boundary, or 0 when it still holds. */
export function focusOverByMinutes(
  limitMinutes: number | null,
  usedMinutes: number | null
): number {
  if (limitMinutes == null || usedMinutes == null) return 0;
  return Math.max(0, usedMinutes - limitMinutes);
}

/** Minutes still available, or 0 once the boundary is reached. */
export function focusRemainingMinutes(
  limitMinutes: number | null,
  usedMinutes: number | null
): number {
  if (limitMinutes == null || usedMinutes == null) return 0;
  return Math.max(0, limitMinutes - usedMinutes);
}

/**
 * The one secondary signal a row may carry beside its own state.
 *
 * A group's colour is its own rule's business — a child going over must never
 * repaint the parent — so what a child does is reported here as a quiet count
 * instead. `over` outranks `at limit`, and neither is claimed while any child
 * is still waiting for its report.
 */
export function focusSecondarySignal({
  appearance,
  usedMinutes,
  childAppearances = [],
}: {
  appearance: FocusBoundaryAppearance;
  usedMinutes: number | null;
  childAppearances?: FocusBoundaryAppearance[];
}): FocusSecondarySignal {
  if (appearance === 'blocked' && usedMinutes != null && usedMinutes > 0) {
    return { kind: 'recordedWhileBlocked', minutes: usedMinutes };
  }
  if (appearance === 'pending') return null;
  if (childAppearances.some(child => child === 'pending')) return null;

  const over = childAppearances.filter(child => child === 'overLimit').length;
  if (over > 0) return { kind: 'childOver', count: over };
  const atLimit = childAppearances.filter(child => child === 'atLimit').length;
  if (atLimit > 0) return { kind: 'childAtLimit', count: atLimit };
  return null;
}

const plainMinutes = (value: number) => `${value}m`;

/** The status chip's text. Never the only signal — a marker rides with it. */
export function focusStatusLabel(
  appearance: FocusBoundaryAppearance,
  {
    limitMinutes = null,
    usedMinutes = null,
  }: { limitMinutes?: number | null; usedMinutes?: number | null } = {},
  formatMinutes: (value: number) => string = plainMinutes
): string {
  switch (appearance) {
    case 'pending':
      return 'PENDING';
    case 'noLimit':
      return 'NO LIMIT';
    case 'limitActive':
      return usedMinutes === 0 ? 'LIMIT SET' : 'ON TRACK';
    case 'blocked':
      return 'BLOCKED';
    case 'atLimit':
      return 'AT LIMIT';
    case 'overLimit':
      return `OVER BY ${formatMinutes(focusOverByMinutes(limitMinutes, usedMinutes))}`;
  }
}

export function focusSecondarySignalLabel(
  signal: FocusSecondarySignal,
  formatMinutes: (value: number) => string = plainMinutes
): string | null {
  if (!signal) return null;
  if (signal.kind === 'recordedWhileBlocked') {
    return `${formatMinutes(signal.minutes)} RECORDED TODAY`;
  }
  const noun = signal.count === 1 ? 'APP' : 'APPS';
  return signal.kind === 'childOver'
    ? `${signal.count} ${noun} OVER`
    : `${signal.count} ${noun} AT LIMIT`;
}

/**
 * What an application row says when it carries no limit of its own. It must
 * never read as though the app escaped the group's boundary — inside a limited
 * group it is spending the group's minutes.
 */
export function focusInheritedBoundaryLabel(
  groupAppearance: FocusBoundaryAppearance,
  groupMode: UsageBoundaryMode
): string {
  if (groupMode === 'blocked' || groupAppearance === 'blocked') return 'GROUP BLOCKED';
  if (groupMode === 'limit') return 'USES GROUP BOUNDARY';
  return 'NO INDIVIDUAL LIMIT';
}

/** Only a live, finite limit draws a progress rail. */
export function focusShowsProgressRail(
  appearance: FocusBoundaryAppearance,
  limitMinutes: number | null
): boolean {
  if (limitMinutes == null || limitMinutes <= 0) return false;
  return appearance === 'limitActive'
    || appearance === 'atLimit'
    || appearance === 'overLimit';
}

/** 0…1, capped: going over fills the rail rather than overflowing it. */
export function focusRailFraction(
  limitMinutes: number | null,
  usedMinutes: number | null
): number {
  if (limitMinutes == null || limitMinutes <= 0 || usedMinutes == null) return 0;
  return Math.min(1, Math.max(0, usedMinutes / limitMinutes));
}
