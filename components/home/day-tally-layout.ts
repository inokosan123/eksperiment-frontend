/**
 * Layout for the day tally beside the tasks title.
 *
 * The rail is a well holding one seat per task. Consecutive tasks of the same
 * outcome fuse into one run, and the runs tile the well edge to edge — there
 * is no gap between them, because what separates them is an engraved crease
 * cut across the whole rail, not a space. A pending run draws nothing: its
 * seats stay empty well, which is what lets the tally read as filling up.
 *
 * Kept apart from the view because it is arithmetic, and because the tiling
 * is the one thing that must never drift: a run that rounds short leaves a
 * seam of well showing through a band that should be solid.
 */

export type DayOutcome = 'done' | 'skipped' | 'pending';

export type TallyRun = {
  outcome: DayOutcome;
  /** How many task seats this run fused. Its creases are drawn per seat. */
  count: number;
  /** Index of the first task in the run — also the crease it starts on. */
  start: number;
  x: number;
  w: number;
};

/** Consecutive same-outcome tasks fuse into one run; runs tile the rail. */
export function buildTallyRuns(outcomes: DayOutcome[], width: number): TallyRun[] {
  if (outcomes.length === 0 || width <= 0) return [];

  const grouped: { outcome: DayOutcome; count: number; start: number }[] = [];
  outcomes.forEach((outcome, i) => {
    const last = grouped[grouped.length - 1];
    if (last && last.outcome === outcome) last.count += 1;
    else grouped.push({ outcome, count: 1, start: i });
  });

  const unit = width / outcomes.length;

  // Each run is measured from its own seat rather than accumulated, so
  // rounding can never drift a run off the seat it belongs to, and the last
  // one is pinned to the far edge instead of landing a fraction short.
  return grouped.map(group => {
    const x = group.start * unit;
    const end = group.start + group.count === outcomes.length
      ? width
      : (group.start + group.count) * unit;
    return { ...group, x, w: end - x };
  });
}

/** The seat width, for placing creases and deciding whether they'd crowd. */
export function tallyUnit(taskCount: number, width: number): number {
  return taskCount > 0 ? width / taskCount : 0;
}
