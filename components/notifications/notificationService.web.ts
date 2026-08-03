import type { AppSettings } from '@/components/settings/SettingsContext';
import { NOTIFICATION_HOME_ROUTE } from '@/components/notifications/notification-navigation';

export const NOTIFICATION_CATEGORY_TASK = 'anasta-task-reminder';
export const NOTIFICATION_ACTION_COMPLETE = 'anasta-task-complete';
export const NOTIFICATION_ACTION_SNOOZE = 'anasta-task-snooze';

export type ManagedNotificationData = {
  app: 'anasta';
  notificationType: 'task';
  taskId: string;
  instanceId: string;
  instanceDate: string;
  kind: 'reminder' | 'due' | 'snooze';
  title: string;
  body: string;
  route: typeof NOTIFICATION_HOME_ROUTE;
  source?: string;
  taskType?: string;
  fireAt: number;
  reminderMinutes?: number;
  snoozeMinutes?: number;
};

export async function configureNotificationRuntime() {
  return undefined;
}

export async function reconcileTaskNotifications(_settings: AppSettings) {
  return undefined;
}

export async function cancelNotificationsForInstance(_instanceId: string) {
  return undefined;
}

export async function cancelNotificationsForTask(_taskId: string) {
  return undefined;
}

export async function snoozeTaskNotification(
  _data: ManagedNotificationData,
  _settings: AppSettings,
  _minutes?: number,
) {
  return undefined;
}

export function getManagedNotificationData(_response: unknown) {
  return null;
}
