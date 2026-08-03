import type { DayPlanState } from './dayPlanStore';

export type FocusMainSnapshot = Pick<DayPlanState,
  | 'permission'
  | 'nativeProtection'
  | 'plans'
  | 'schedule'
  | 'designatedCoreAppIds'
  | 'alwaysBlockedApps'
  | 'days'
  | 'quiet'
  | 'purity'
  | 'streak'
  | 'pendingMilestone'
>;

export function selectFocusMainSnapshot(state: DayPlanState): FocusMainSnapshot {
  return {
    permission: state.permission,
    nativeProtection: state.nativeProtection,
    plans: state.plans,
    schedule: state.schedule,
    designatedCoreAppIds: state.designatedCoreAppIds,
    alwaysBlockedApps: state.alwaysBlockedApps,
    days: state.days,
    quiet: state.quiet,
    purity: state.purity,
    streak: state.streak,
    pendingMilestone: state.pendingMilestone,
  };
}

/**
 * Focus renders only today's live total. Selecting the archive entry itself
 * keeps historical usage writes from reconciling the animated main screen.
 */
export function selectFocusUsageForDate(
  state: Pick<DayPlanState, 'usageByDate'>,
  date: string,
) {
  return state.usageByDate[date] ?? null;
}

export function focusMainSnapshotEqual(
  previous: FocusMainSnapshot,
  next: FocusMainSnapshot,
): boolean {
  return previous.permission === next.permission
    && previous.nativeProtection === next.nativeProtection
    && previous.plans === next.plans
    && previous.schedule === next.schedule
    && previous.designatedCoreAppIds === next.designatedCoreAppIds
    && previous.alwaysBlockedApps === next.alwaysBlockedApps
    && previous.days === next.days
    && previous.quiet === next.quiet
    && previous.purity === next.purity
    && previous.streak === next.streak
    && previous.pendingMilestone === next.pendingMilestone;
}
