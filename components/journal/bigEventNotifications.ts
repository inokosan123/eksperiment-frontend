import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { BigEvent } from './bigEventsDb';
import { getBigEventCountdown, resolveBigEventForDate, toLocalDateKey } from './bigEventsLogic';

const CHANNEL_ID = 'anasta-big-event-reminders';
const ACCENT = '#C5A059';
const REMINDER_HOUR = 9;
const MAX_REMINDERS = 48;

export type BigEventNotificationData = {
  app: 'anasta';
  notificationType: 'big-event';
  eventId: string;
  occurrenceDate: string;
  kind: 'advance' | 'today';
  title: string;
  body: string;
  route: '/big-events';
  fireAt: number;
  repeatsYearly: boolean;
};

function isGranted(status: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>) {
  return status.granted || status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

function atReminderTime(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, REMINDER_HOUR, 0, 0, 0).getTime();
}

function parseData(value: unknown): BigEventNotificationData | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.app !== 'anasta' || raw.notificationType !== 'big-event') return null;
  if (
    typeof raw.eventId !== 'string' || typeof raw.occurrenceDate !== 'string' ||
    (raw.kind !== 'advance' && raw.kind !== 'today') ||
    typeof raw.title !== 'string' || typeof raw.body !== 'string' ||
    typeof raw.fireAt !== 'number'
  ) return null;
  return {
    app: 'anasta', notificationType: 'big-event', eventId: raw.eventId,
    occurrenceDate: raw.occurrenceDate, kind: raw.kind,
    title: raw.title, body: raw.body, route: '/big-events', fireAt: raw.fireAt,
    repeatsYearly: raw.repeatsYearly === true,
  };
}

async function cancelWhere(predicate: (data: BigEventNotificationData) => boolean) {
  if (Platform.OS === 'web') return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled.map(async request => {
    const data = parseData(request.content.data);
    if (!data || !predicate(data)) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    } catch {
      // It may have been delivered between listing and cancellation.
    }
  }));
}

async function ensurePermission(requestPermission: boolean) {
  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current)) return true;
  if (!requestPermission || !current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return isGranted(requested);
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Big Event reminders',
    description: 'Reminders for birthdays, anniversaries, and important dates',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: ACCENT,
    enableVibrate: true,
    showBadge: true,
  });
}

function collectCandidates(events: BigEvent[], referenceDate: Date) {
  const now = referenceDate.getTime();
  const dateKey = toLocalDateKey(referenceDate);
  const result: BigEventNotificationData[] = [];
  for (const source of events) {
    if (source.deletedAt || !source.remindersEnabled) continue;
    const event = resolveBigEventForDate(source, dateKey);
    if (event.endDate < dateKey) continue;
    const [, anchorMonth, anchorDay] = source.endDate.split('-').map(Number);
    const repeatsOnEventDay = source.recurrence === 'yearly' && !(anchorMonth === 2 && anchorDay === 29);

    const advanceAt = atReminderTime(event.startDate);
    if (event.leadDays > 0 && advanceAt > now) {
      const days = getBigEventCountdown(event, event.startDate);
      result.push({
        app: 'anasta', notificationType: 'big-event', eventId: source.id,
        occurrenceDate: event.endDate, kind: 'advance', title: source.title,
        body: `${source.title} is coming up in ${days} ${days === 1 ? 'day' : 'days'}.`,
        route: '/big-events', fireAt: advanceAt, repeatsYearly: false,
      });
    }

    const eventAt = atReminderTime(event.endDate);
    if (eventAt > now || repeatsOnEventDay) {
      result.push({
        app: 'anasta', notificationType: 'big-event', eventId: source.id,
        occurrenceDate: event.endDate, kind: 'today', title: source.title,
        body: `${source.title} is today.`, route: '/big-events', fireAt: eventAt,
        repeatsYearly: repeatsOnEventDay,
      });
    }
  }
  return result.sort((a, b) => a.fireAt - b.fireAt).slice(0, MAX_REMINDERS);
}

export async function reconcileBigEventNotifications(
  events: BigEvent[],
  options: { requestPermission?: boolean; referenceDate?: Date } = {},
) {
  if (Platform.OS === 'web') return false;
  await cancelWhere(() => true);
  const candidates = collectCandidates(events, options.referenceDate ?? new Date());
  if (!candidates.length) return true;
  if (!await ensurePermission(options.requestPermission === true)) return false;
  await ensureChannel();
  for (const data of candidates) {
    const triggerDate = new Date(data.fireAt);
    await Notifications.scheduleNotificationAsync({
      identifier: `anasta-big-event-${data.eventId}-${data.occurrenceDate}-${data.kind}`,
      content: {
        title: data.title, body: data.body, data, sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH, color: ACCENT,
      },
      trigger: data.repeatsYearly
        ? {
          type: Notifications.SchedulableTriggerInputTypes.YEARLY,
          month: triggerDate.getMonth(),
          day: triggerDate.getDate(),
          hour: REMINDER_HOUR,
          minute: 0,
          channelId: CHANNEL_ID,
        }
        : {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          channelId: CHANNEL_ID,
        },
    });
  }
  return true;
}

export async function cancelBigEventNotifications(eventId: string) {
  await cancelWhere(data => data.eventId === eventId);
}

export function getBigEventNotificationData(response: Notifications.NotificationResponse) {
  return parseData(response.notification.request.content.data);
}
