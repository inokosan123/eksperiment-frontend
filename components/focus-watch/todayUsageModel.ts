export type UsageBoundaryMode = 'blocked' | 'limit' | 'noLimit';
export type UsageBoundaryState = 'blocked' | 'open' | 'over' | 'planned' | 'within';
export type UsageActivityState = 'active' | 'pending' | 'quiet';

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
  return used > limit ? 'over' : 'within';
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
