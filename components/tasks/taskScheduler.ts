import type { TaskDefinition, TaskInstance, TaskSchedule } from '@/components/tasks/taskTypes';

const DAY_MS = 24 * 60 * 60 * 1000;

export function getLocalDateKey(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateFromLocalKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function taskDayIndexFromJsDay(jsDay: number) {
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function jsDayFromTaskDayIndex(index: number) {
  return index === 6 ? 0 : index + 1;
}

export function getTaskDayIndexForDate(dateKey: string) {
  return taskDayIndexFromJsDay(getDateFromLocalKey(dateKey).getDay());
}

export function getTodayTaskDayIndex(referenceDate: Date = new Date()) {
  return taskDayIndexFromJsDay(referenceDate.getDay());
}

export function parseTaskTimeToDate(dateKey: string, time?: string) {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function getEffectiveTaskTime(schedule: TaskSchedule, dateKey: string) {
  if (schedule.sameTimeEveryDay !== false) return schedule.time;
  const dayIndex = getTaskDayIndexForDate(dateKey);
  return schedule.dayTimes[dayIndex] || schedule.time;
}

export function scheduleMatchesDate(schedule: TaskSchedule, dateKey: string) {
  const date = getDateFromLocalKey(dateKey);
  const jsDay = date.getDay();
  const taskDayIndex = taskDayIndexFromJsDay(jsDay);
  const dayOfMonth = date.getDate();

  switch (schedule.frequency) {
    case 'weekdays':
      return jsDay >= 1 && jsDay <= 5;
    case 'weekends':
      return jsDay === 0 || jsDay === 6;
    case 'specific_days':
      return schedule.selectedDays.includes(taskDayIndex);
    case 'monthly':
      return schedule.monthlyDays.includes(dayOfMonth);
    case 'daily':
    default:
      return true;
  }
}

export function shouldTaskExistOnDate(
  task: TaskDefinition,
  dateKey: string,
) {
  if (task.status !== 'active') return false;
  if (task.removedAt && dateKey >= task.removedAt) return false;
  if (task.pausedAt && dateKey >= task.pausedAt) return false;
  if (!scheduleMatchesDate(task.schedule, dateKey)) return false;

  const activatedDate = getLocalDateKey(new Date(task.activatedAt));
  if (dateKey < activatedDate) return false;
  if (dateKey > activatedDate) return true;

  const effectiveTime = getEffectiveTaskTime(task.schedule, dateKey);
  const scheduledAt = parseTaskTimeToDate(dateKey, effectiveTime);
  if (!scheduledAt) return true;

  const activationAt = new Date(task.activatedAt);
  return activationAt.getTime() <= scheduledAt.getTime();
}

export function shouldNewTaskApplyToday(task: TaskDefinition, referenceDate: Date = new Date()) {
  const today = getLocalDateKey(referenceDate);
  if (!scheduleMatchesDate(task.schedule, today)) return false;
  const scheduledAt = parseTaskTimeToDate(today, getEffectiveTaskTime(task.schedule, today));
  if (!scheduledAt) return true;
  return referenceDate.getTime() <= scheduledAt.getTime();
}

export function isTaskInstanceLocked(status: TaskInstance['status']) {
  return status === 'completed' || status === 'skipped' || status === 'missed';
}

export function shouldMarkMissed(dateKey: string, _time: string, referenceDate: Date = new Date()) {
  const today = getLocalDateKey(referenceDate);
  if (dateKey < today) return true;
  return false;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setHours(12, 0, 0, 0);
  next.setTime(next.getTime() + days * DAY_MS);
  return next;
}

export function buildInstanceId(taskId: string, dateKey: string) {
  return `${taskId}_${dateKey}`;
}

export function buildTaskInstance(
  task: TaskDefinition,
  dateKey: string,
  existing?: Partial<TaskInstance>,
  referenceDate: Date = new Date(),
): TaskInstance {
  const time = getEffectiveTaskTime(task.schedule, dateKey);
  const status = existing?.status ?? (shouldMarkMissed(dateKey, time, referenceDate) ? 'missed' : 'pending');

  return {
    id: buildInstanceId(task.id, dateKey),
    taskId: task.id,
    date: dateKey,
    time,
    status,
    locked: isTaskInstanceLocked(status),
    title: task.title,
    subtitle: task.subtitle,
    level: task.level,
    source: task.source,
    type: task.type,
    icon: task.icon,
    habitColor: task.habitColor,
    targetView: task.targetView,
    targetTab: task.targetTab,
    createdAt: existing?.createdAt ?? Date.now(),
    resolvedAt: existing?.resolvedAt,
  };
}
