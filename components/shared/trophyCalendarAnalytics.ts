export type TrophyCalendarDayStatus = 'pending' | 'kept' | 'broken' | 'off';
export type TrophyCalendarDay = {
  date: string;
  status: TrophyCalendarDayStatus;
};

export type TrophyCalendarModel = {
  current: number;
  best: number;
  trophies: number;
  days: Record<string, TrophyCalendarDay>;
};

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function trophyDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(key: string) {
  const match = DATE_KEY.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return trophyDateKey(date) === key ? date : null;
}

export function isTrophyDateKey(key: string) {
  return dateFromKey(key) !== null;
}

function addDay(key: string) {
  const date = dateFromKey(key);
  if (!date) return key;
  date.setDate(date.getDate() + 1);
  return trophyDateKey(date);
}

function validPastOrTodayDates(values: Iterable<string>, todayKey: string) {
  return Array.from(new Set(values))
    .filter(key => dateFromKey(key) !== null && key <= todayKey)
    .sort((left, right) => left.localeCompare(right));
}

function summarizeDays(days: Record<string, TrophyCalendarDay>, todayKey: string) {
  const records = Object.values(days)
    .filter(day => day.date <= todayKey)
    .sort((left, right) => left.date.localeCompare(right.date));

  let running = 0;
  let best = 0;
  let trophies = 0;

  for (const day of records) {
    if (day.status === 'kept') {
      running += 1;
      trophies += 1;
      best = Math.max(best, running);
    } else if (day.status === 'broken') {
      running = 0;
    }
    // Rest and today's pending state preserve a run without extending it.
  }

  let current = 0;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const day = records[index];
    if (day.status === 'off' || day.status === 'pending') continue;
    if (day.status === 'broken') break;
    current += 1;
  }

  return { current, best, trophies };
}

function emptyModel(): TrophyCalendarModel {
  return { current: 0, best: 0, trophies: 0, days: {} };
}

export function buildJournalTrophyCalendarModel(
  completedDates: string[],
  activityDates: string[],
  today: Date = new Date(),
): TrophyCalendarModel {
  const todayKey = trophyDateKey(today);
  const completed = new Set(validPastOrTodayDates(completedDates, todayKey));
  const trackedDates = validPastOrTodayDates([...activityDates, ...completed], todayKey);
  if (trackedDates.length === 0) return emptyModel();

  const days: Record<string, TrophyCalendarDay> = {};
  for (let cursor = trackedDates[0]; cursor <= todayKey; cursor = addDay(cursor)) {
    const status: TrophyCalendarDayStatus = completed.has(cursor)
      ? 'kept'
      : cursor === todayKey
        ? 'pending'
        : 'broken';
    days[cursor] = { date: cursor, status };
  }

  return { ...summarizeDays(days, todayKey), days };
}
