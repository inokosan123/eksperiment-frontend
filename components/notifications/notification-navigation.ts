export const NOTIFICATION_HOME_ROUTE = '/' as const;

export type HomeRoutedNotificationKind = 'task' | 'big-event';

/**
 * Task and Big Event notifications are reminders, not shortcuts into an
 * unfinished workflow. Their single landing place is Home, where the user can
 * see the task/event in the context of the whole day.
 */
export function notificationTapTarget(
  kind: HomeRoutedNotificationKind | null,
) {
  return kind ? NOTIFICATION_HOME_ROUTE : null;
}
