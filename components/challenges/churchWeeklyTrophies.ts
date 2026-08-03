import type { ChallengeChurchConfig } from '@/components/challenges/challengeData';

export type ChurchWeekStatus = 'active' | 'earned' | 'missed' | 'practice';

export type ChurchWeekEvaluation = {
  weekStart: string;
  weekEnd: string;
  requiredDates: string[];
  completedDates: string[];
  requiredCount: number;
  completedCount: number;
  status: ChurchWeekStatus;
};

function sortedUniqueNumbers(values: number[] | undefined) {
  return [...new Set((values ?? []).filter(value => Number.isInteger(value)))].sort((a, b) => a - b);
}

function sortedDayTimes(values: Record<number, string> | undefined) {
  return Object.entries(values ?? {})
    .map(([day, time]) => [Number(day), time] as const)
    .filter(([day, time]) => Number.isInteger(day) && typeof time === 'string' && time.length > 0)
    .sort(([left], [right]) => left - right);
}

/**
 * Church scoring and the task shown on Home must use the same schedule.
 *
 * Older partial writes could leave challenge_church_config waiting for Sunday
 * while the task table showed (and let the user complete) Wednesday. Comparing
 * normalized schedules lets the database repair that split without treating
 * harmless array ordering differences as a schedule edit.
 */
export function churchSchedulesMatch(
  challengeConfig: ChallengeChurchConfig | undefined,
  taskConfig: ChallengeChurchConfig,
) {
  if (!challengeConfig) return false;
  if (challengeConfig.frequency !== taskConfig.frequency) return false;
  if ((challengeConfig.time ?? '') !== (taskConfig.time ?? '')) return false;
  if ((challengeConfig.sameTimeEveryDay !== false) !== (taskConfig.sameTimeEveryDay !== false)) return false;

  if (taskConfig.frequency === 'specific_days') {
    if (JSON.stringify(sortedUniqueNumbers(challengeConfig.selectedDays))
      !== JSON.stringify(sortedUniqueNumbers(taskConfig.selectedDays))) return false;
  }
  if (taskConfig.frequency === 'monthly') {
    if (JSON.stringify(sortedUniqueNumbers(challengeConfig.monthlyDays))
      !== JSON.stringify(sortedUniqueNumbers(taskConfig.monthlyDays))) return false;
  }
  if (taskConfig.sameTimeEveryDay === false) {
    if (JSON.stringify(sortedDayTimes(challengeConfig.dayTimes))
      !== JSON.stringify(sortedDayTimes(taskConfig.dayTimes))) return false;
  }

  return true;
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function churchDateFromKey(dateKey: string) {
  const match = DATE_KEY.exec(dateKey);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return churchDateKey(date) === dateKey ? date : null;
}

export function churchDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addChurchDays(dateKey: string, amount: number) {
  const date = churchDateFromKey(dateKey);
  if (!date) return dateKey;
  date.setDate(date.getDate() + amount);
  return churchDateKey(date);
}

export function churchWeekStart(dateKey: string) {
  const date = churchDateFromKey(dateKey);
  if (!date) return dateKey;
  const mondayFirstIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
  date.setDate(date.getDate() - mondayFirstIndex);
  return churchDateKey(date);
}

function matchesChurchSchedule(config: ChallengeChurchConfig, dateKey: string) {
  const date = churchDateFromKey(dateKey);
  if (!date) return false;
  const jsDay = date.getDay();
  const mondayFirstIndex = jsDay === 0 ? 6 : jsDay - 1;

  switch (config.frequency) {
    case 'weekdays':
      return mondayFirstIndex <= 4;
    case 'weekends':
      return mondayFirstIndex >= 5;
    case 'specific_days':
      return (config.selectedDays?.length ? config.selectedDays : [6]).includes(mondayFirstIndex);
    case 'monthly':
      // Kept for existing records. New Church setup no longer offers a
      // day-of-month cadence, but old plans remain readable and recoverable.
      return (config.monthlyDays?.length ? config.monthlyDays : [1]).includes(date.getDate());
    case 'daily':
    default:
      return true;
  }
}

export function churchRequiredDatesForWeek(
  config: ChallengeChurchConfig,
  weekStart: string,
) {
  return Array.from({ length: 7 }, (_, index) => addChurchDays(weekStart, index))
    .filter(dateKey => matchesChurchSchedule(config, dateKey));
}

export function churchStartWeekQualifies(
  requiredDates: string[],
  startedAt?: string,
  startedAtMs?: number,
  scheduledTime?: string,
) {
  if (!startedAt || requiredDates.length === 0) return requiredDates.length > 0;
  if (!requiredDates.every(dateKey => dateKey >= startedAt)) return false;
  if (!requiredDates.includes(startedAt) || !startedAtMs || !scheduledTime) return true;
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const startDate = churchDateFromKey(startedAt);
  if (!startDate || !Number.isFinite(hours) || !Number.isFinite(minutes)) return true;
  startDate.setHours(hours, minutes, 0, 0);
  return startedAtMs <= startDate.getTime();
}

export function evaluateChurchWeek({
  weekStart,
  requiredDates,
  completedDates,
  skippedDates,
  todayKey,
  practice = false,
}: {
  weekStart: string;
  requiredDates: string[];
  completedDates: Iterable<string>;
  skippedDates: Iterable<string>;
  todayKey: string;
  practice?: boolean;
}): ChurchWeekEvaluation {
  const weekEnd = addChurchDays(weekStart, 6);
  const required = [...new Set(requiredDates)].sort();
  const completedSet = new Set(completedDates);
  const skippedSet = new Set(skippedDates);
  const completed = required.filter(dateKey => completedSet.has(dateKey));
  const hasSkippedRequirement = required.some(dateKey => skippedSet.has(dateKey));
  const earned = required.length > 0 && completed.length === required.length;

  let status: ChurchWeekStatus;
  // Completing every commitment always wins the trophy. A start/pause week
  // can be labelled practice while it is incomplete, but that label must not
  // suppress a real 100% completion that the user was able to check in-app.
  if (earned) status = 'earned';
  else if (practice || required.length === 0) status = 'practice';
  else if (hasSkippedRequirement || todayKey > weekEnd) status = 'missed';
  else status = 'active';

  return {
    weekStart,
    weekEnd,
    requiredDates: required,
    completedDates: completed,
    requiredCount: required.length,
    completedCount: completed.length,
    status,
  };
}

export function summarizeChurchWeekStreaks(weeks: ChurchWeekEvaluation[]) {
  const scored = [...weeks]
    .filter(week => week.status !== 'practice')
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart));

  let running = 0;
  let best = 0;
  for (const week of scored) {
    if (week.status === 'earned') {
      running += 1;
      best = Math.max(best, running);
    } else if (week.status === 'missed') {
      running = 0;
    }
    // An open week does not extend or break the run.
  }

  let current = 0;
  for (let index = scored.length - 1; index >= 0; index -= 1) {
    const week = scored[index];
    if (week.status === 'active') continue;
    if (week.status === 'missed') break;
    current += 1;
  }

  return { current, best };
}
