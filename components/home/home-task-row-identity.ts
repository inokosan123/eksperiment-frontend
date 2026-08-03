export type HomeTaskRowIdentity = {
  card: unknown;
  displayTask: unknown;
  dateInactive: boolean;
  futureInactive: boolean;
  canToggle: boolean;
  canSkip: boolean;
  canShowAnalytics: boolean;
  book?: unknown;
  blessingsToday: number;
  activeBridgeLabel?: string;
};

export function canReuseHomeTaskRow(
  previous: HomeTaskRowIdentity,
  next: HomeTaskRowIdentity,
): boolean {
  return previous.card === next.card
    && previous.displayTask === next.displayTask
    && previous.dateInactive === next.dateInactive
    && previous.futureInactive === next.futureInactive
    && previous.canToggle === next.canToggle
    && previous.canSkip === next.canSkip
    && previous.canShowAnalytics === next.canShowAnalytics
    && previous.book === next.book
    && previous.blessingsToday === next.blessingsToday
    && previous.activeBridgeLabel === next.activeBridgeLabel;
}
