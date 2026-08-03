import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { AppSettings } from '@/components/settings/SettingsContext';
import { NOTIFICATION_HOME_ROUTE } from '@/components/notifications/notification-navigation';
import {
  listTaskInstancesBetween,
  listTasks,
  openTaskDb,
  syncTaskInstancesWindow,
} from '@/components/tasks/taskDb';
import {
  addDays,
  getLocalDateKey,
  parseTaskTimeToDate,
} from '@/components/tasks/taskScheduler';
import type { TaskDefinition, TaskInstance } from '@/components/tasks/taskTypes';

export const NOTIFICATION_CATEGORY_TASK = 'anasta-task-reminder';
export const NOTIFICATION_ACTION_COMPLETE = 'anasta-task-complete';
export const NOTIFICATION_ACTION_SNOOZE = 'anasta-task-snooze';

const CHANNEL_ID = 'anasta-task-reminders';
const ANDROID_ACCENT = '#C9A24E';
const NOTIFICATION_HORIZON_DAYS = 30;
const MAX_SCHEDULED_TASK_NOTIFICATIONS = 60;
const DEFAULT_SNOOZE_MINUTES = 10;
const QUIET_START_HOUR = 22;
const QUIET_END_HOUR = 7;

type ManagedNotificationKind = 'reminder' | 'due' | 'snooze';

export type ManagedNotificationData = {
  app: 'anasta';
  notificationType: 'task';
  taskId: string;
  instanceId: string;
  instanceDate: string;
  kind: ManagedNotificationKind;
  title: string;
  body: string;
  route: typeof NOTIFICATION_HOME_ROUTE;
  source?: TaskInstance['source'];
  taskType?: TaskInstance['type'];
  fireAt: number;
  reminderMinutes?: number;
  snoozeMinutes?: number;
};

type ScheduledRecord = {
  id: number;
  native_id: string | null;
};

type ScheduleCandidate = {
  task: TaskDefinition;
  instance: TaskInstance;
  kind: Exclude<ManagedNotificationKind, 'snooze'>;
  fireAt: number;
  reminderMinutes?: number;
};

let runtimeConfigured = false;

function canUseNativeNotifications() {
  return Platform.OS !== 'web';
}

function isGranted(status: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>) {
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

function isQuietTime(date: Date) {
  const hour = date.getHours();
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

function isSuppressedByQuietHours(settings: AppSettings, fireAt: number) {
  return (settings.quietHours || settings.dndEnabled) && isQuietTime(new Date(fireAt));
}

function settingsAllowTask(settings: AppSettings, task: Pick<TaskDefinition, 'source' | 'type'>) {
  if (task.source === 'challenge') return settings.notifChallenges;
  if (task.source === 'habit') return settings.notifHabits;
  if (task.source === 'gratitude' || task.type === 'gratitude') return settings.notifGratitude;
  if (task.source === 'reading_book') return settings.notifReading;
  if (task.type === 'journal') return settings.notifJournal;
  if (task.source === 'spiritual') return settings.notifSpiritual;
  return settings.notifRoutine;
}

function buildBody(candidate: ScheduleCandidate) {
  if (candidate.kind === 'reminder') {
    const minutes = candidate.reminderMinutes ?? DEFAULT_SNOOZE_MINUTES;
    return `${minutes} minutes before ${candidate.instance.time}.`;
  }

  return `Scheduled for ${candidate.instance.time}.`;
}

function buildData(
  instance: TaskInstance,
  kind: ManagedNotificationKind,
  title: string,
  body: string,
  fireAt: number,
  extra?: Pick<ManagedNotificationData, 'reminderMinutes' | 'snoozeMinutes'>,
): ManagedNotificationData {
  return {
    app: 'anasta',
    notificationType: 'task',
    taskId: instance.taskId,
    instanceId: instance.id,
    instanceDate: instance.date,
    kind,
    title,
    body,
    route: NOTIFICATION_HOME_ROUTE,
    source: instance.source,
    taskType: instance.type,
    fireAt,
    ...extra,
  };
}

function managedDataFromUnknown(value: unknown): ManagedNotificationData | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.app !== 'anasta' || raw.notificationType !== 'task') return null;
  if (
    typeof raw.taskId !== 'string' ||
    typeof raw.instanceId !== 'string' ||
    typeof raw.instanceDate !== 'string' ||
    typeof raw.kind !== 'string' ||
    typeof raw.title !== 'string' ||
    typeof raw.body !== 'string' ||
    typeof raw.fireAt !== 'number'
  ) {
    return null;
  }

  return {
    app: 'anasta',
    notificationType: 'task',
    taskId: raw.taskId,
    instanceId: raw.instanceId,
    instanceDate: raw.instanceDate,
    kind: raw.kind === 'snooze' || raw.kind === 'reminder' ? raw.kind : 'due',
    title: raw.title,
    body: raw.body,
    // Legacy scheduled payloads can still carry a task-specific route. They
    // remain parseable, but their in-app destination is normalized to Home.
    route: NOTIFICATION_HOME_ROUTE,
    source: typeof raw.source === 'string' ? raw.source as TaskInstance['source'] : undefined,
    taskType: typeof raw.taskType === 'string' ? raw.taskType as TaskInstance['type'] : undefined,
    fireAt: raw.fireAt,
    reminderMinutes: typeof raw.reminderMinutes === 'number' ? raw.reminderMinutes : undefined,
    snoozeMinutes: typeof raw.snoozeMinutes === 'number' ? raw.snoozeMinutes : undefined,
  };
}

function isManagedScheduledRequest(request: Notifications.NotificationRequest, includeSnooze: boolean) {
  const data = managedDataFromUnknown(request.content.data);
  if (!data) return false;
  return includeSnooze || data.kind !== 'snooze';
}

async function cancelNativeNotification(nativeId?: string | null) {
  if (!nativeId || !canUseNativeNotifications()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(nativeId);
  } catch {
    // Native notifications can disappear when the OS delivers or clears them.
  }
}

async function cancelUntrackedManagedNotifications(includeSnooze: boolean) {
  if (!canUseNativeNotifications()) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(request => isManagedScheduledRequest(request, includeSnooze))
        .map(request => cancelNativeNotification(request.identifier)),
    );
  } catch {
    // Notification APIs can be unavailable in Expo web or limited simulators.
  }
}

async function markRecordsCancelled(rows: ScheduledRecord[]) {
  if (!rows.length) return;
  const db = await openTaskDb();
  const now = Date.now();
  for (const row of rows) {
    await db.runAsync(
      'UPDATE task_notifications SET status = ?, updated_at = ? WHERE id = ?',
      'cancelled',
      now,
      row.id,
    );
  }
}

async function cancelTrackedRows(rows: ScheduledRecord[]) {
  await Promise.all(rows.map(row => cancelNativeNotification(row.native_id)));
  await markRecordsCancelled(rows);
}

async function cancelTrackedNotifications(whereSql: string, args: (string | number | null)[]) {
  const db = await openTaskDb();
  const rows = await db.getAllAsync<ScheduledRecord>(
    `SELECT id, native_id FROM task_notifications WHERE ${whereSql}`,
    ...args,
  );
  await cancelTrackedRows(rows);
}

async function cancelRegularScheduledNotifications() {
  await cancelTrackedNotifications(
    "status = ? AND kind <> ?",
    ['scheduled', 'snooze'],
  );
  await cancelUntrackedManagedNotifications(false);
}

async function ensurePermissionAsync() {
  if (!canUseNativeNotifications()) return false;
  await configureNotificationRuntime();

  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current)) return true;

  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return isGranted(requested);
}

async function insertNotificationRecord(nativeId: string | null, data: ManagedNotificationData) {
  const db = await openTaskDb();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO task_notifications (
      task_id, instance_id, instance_date, kind, fire_at, title, body,
      native_id, route, source, type, payload_json, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.taskId,
    data.instanceId,
    data.instanceDate,
    data.kind,
    data.fireAt,
    data.title,
    data.body,
    nativeId,
    data.route ?? null,
    data.source ?? null,
    data.taskType ?? null,
    JSON.stringify(data),
    'scheduled',
    now,
    now,
  );
}

async function scheduleManagedNotification(data: ManagedNotificationData) {
  if (!canUseNativeNotifications()) {
    await insertNotificationRecord(null, data);
    return null;
  }

  const nativeId = await Notifications.scheduleNotificationAsync({
    identifier: `anasta-${data.instanceId}-${data.kind}-${data.fireAt}`,
    content: {
      title: data.title,
      body: data.body,
      data,
      categoryIdentifier: NOTIFICATION_CATEGORY_TASK,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      color: ANDROID_ACCENT,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(data.fireAt),
      channelId: CHANNEL_ID,
    },
  });

  await insertNotificationRecord(nativeId, data);
  return nativeId;
}

function collectCandidates(
  tasks: TaskDefinition[],
  instances: TaskInstance[],
  settings: AppSettings,
  now: number,
) {
  const taskById = new Map(tasks.map(task => [task.id, task]));
  const candidates: ScheduleCandidate[] = [];

  for (const instance of instances) {
    if (instance.status !== 'pending') continue;

    const task = taskById.get(instance.taskId);
    if (!task || task.status !== 'active') continue;
    if (task.notificationMode === 'none') continue;
    if (!settingsAllowTask(settings, task)) continue;

    const dueAt = parseTaskTimeToDate(instance.date, instance.time)?.getTime();
    if (!dueAt || dueAt <= now) continue;

    if (task.notificationMode === 'double') {
      const reminderMinutes = task.reminderMinutes ?? 15;
      const reminderAt = dueAt - reminderMinutes * 60_000;
      if (reminderAt > now && !isSuppressedByQuietHours(settings, reminderAt)) {
        candidates.push({ task, instance, kind: 'reminder', fireAt: reminderAt, reminderMinutes });
      }
    }

    if (!isSuppressedByQuietHours(settings, dueAt)) {
      candidates.push({ task, instance, kind: 'due', fireAt: dueAt });
    }
  }

  return candidates
    .sort((a, b) => a.fireAt - b.fireAt)
    .slice(0, MAX_SCHEDULED_TASK_NOTIFICATIONS);
}

export async function configureNotificationRuntime() {
  if (!canUseNativeNotifications() || runtimeConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Task reminders',
      description: 'Anasta task reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 220, 120, 220],
      lightColor: ANDROID_ACCENT,
      enableVibrate: true,
      showBadge: true,
    });
  }

  await Notifications.setNotificationCategoryAsync(
    NOTIFICATION_CATEGORY_TASK,
    [
      {
        identifier: NOTIFICATION_ACTION_COMPLETE,
        buttonTitle: 'Complete',
        options: { opensAppToForeground: true },
      },
      {
        identifier: NOTIFICATION_ACTION_SNOOZE,
        buttonTitle: `Snooze ${DEFAULT_SNOOZE_MINUTES}m`,
        options: { opensAppToForeground: true },
      },
    ],
    { showTitle: true, showSubtitle: true },
  );

  runtimeConfigured = true;
}

export async function reconcileTaskNotifications(settings: AppSettings, referenceDate: Date = new Date()) {
  const now = referenceDate.getTime();
  await syncTaskInstancesWindow(referenceDate);

  const fromDate = getLocalDateKey(referenceDate);
  const toDate = getLocalDateKey(addDays(referenceDate, NOTIFICATION_HORIZON_DAYS));
  const [tasks, instances] = await Promise.all([
    listTasks(),
    listTaskInstancesBetween(fromDate, toDate),
  ]);
  const candidates = collectCandidates(tasks, instances, settings, now);

  await cancelRegularScheduledNotifications();
  if (!candidates.length) return;

  const permitted = await ensurePermissionAsync();
  if (!permitted) return;

  for (const candidate of candidates) {
    const title = `Anasta: ${candidate.instance.title}`;
    const body = buildBody(candidate);
    const data = buildData(
      candidate.instance,
      candidate.kind,
      title,
      body,
      candidate.fireAt,
      { reminderMinutes: candidate.reminderMinutes },
    );
    await scheduleManagedNotification(data);
  }
}

export async function cancelNotificationsForInstance(instanceId: string) {
  await cancelTrackedNotifications(
    'status = ? AND instance_id = ?',
    ['scheduled', instanceId],
  );
}

export async function cancelNotificationsForTask(taskId: string) {
  await cancelTrackedNotifications(
    'status = ? AND task_id = ?',
    ['scheduled', taskId],
  );
}

export async function snoozeTaskNotification(
  data: ManagedNotificationData,
  settings: AppSettings,
  minutes = DEFAULT_SNOOZE_MINUTES,
) {
  const permitted = await ensurePermissionAsync();
  if (!permitted) return;

  const fireAt = Date.now() + minutes * 60_000;
  if (isSuppressedByQuietHours(settings, fireAt)) return;

  const snoozeData: ManagedNotificationData = {
    ...data,
    kind: 'snooze',
    body: `Snoozed for ${minutes} minutes.`,
    fireAt,
    snoozeMinutes: minutes,
  };

  await scheduleManagedNotification(snoozeData);
}

export function getManagedNotificationData(
  response: Notifications.NotificationResponse,
) {
  return managedDataFromUnknown(response.notification.request.content.data);
}
