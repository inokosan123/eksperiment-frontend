export type HomeProgressMode = 'no-tasks' | 'all-skipped' | 'normal';
export type HomeProgressDayState = 'perfect' | 'incomplete' | 'rest' | 'pending';

export type HomeProgressDay = {
  date: string;
  state: HomeProgressDayState;
  mode: HomeProgressMode;
  progressPct: number | null;
};

export type HomeProgressCalendarModel = {
  current: number;
  best: number;
  perfectDays: number;
  days: Record<string, HomeProgressDay>;
};

export type HomeProgressDayCounts = {
  date: string;
  completed: number;
  skipped: number;
  missed: number;
  pending: number;
};

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(key: string) {
  const match = DATE_KEY.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return localDateKey(date) === key ? date : null;
}

function addDay(key: string) {
  const date = dateFromKey(key);
  if (!date) return key;
  date.setDate(date.getDate() + 1);
  return localDateKey(date);
}

function cleanCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function emptyModel(): HomeProgressCalendarModel {
  return { current: 0, best: 0, perfectDays: 0, days: {} };
}

function summarize(days: Record<string, HomeProgressDay>) {
  const records = Object.values(days).sort((left, right) => left.date.localeCompare(right.date));
  let running = 0;
  let best = 0;
  let perfectDays = 0;

  for (const day of records) {
    if (day.state === 'perfect') {
      running += 1;
      perfectDays += 1;
      best = Math.max(best, running);
    } else if (day.state === 'incomplete') {
      running = 0;
    }
    // A rest day and today's still-open state preserve, but do not extend,
    // the run. This is deliberately Home-specific streak behaviour.
  }

  let current = 0;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const day = records[index];
    if (day.state === 'rest' || day.state === 'pending') continue;
    if (day.state === 'incomplete') break;
    current += 1;
  }

  return { current, best, perfectDays };
}

export function buildHomeProgressCalendarModel(
  dailyCounts: HomeProgressDayCounts[],
  today: Date = new Date(),
): HomeProgressCalendarModel {
  const todayKey = localDateKey(today);
  const applicable = dailyCounts
    .filter(day => dateFromKey(day.date) !== null && day.date <= todayKey)
    .sort((left, right) => left.date.localeCompare(right.date));
  if (applicable.length === 0) return emptyModel();

  const byDate = new Map<string, Omit<HomeProgressDayCounts, 'date'>>();
  for (const day of applicable) {
    const previous = byDate.get(day.date) ?? { completed: 0, skipped: 0, missed: 0, pending: 0 };
    byDate.set(day.date, {
      completed: previous.completed + cleanCount(day.completed),
      skipped: previous.skipped + cleanCount(day.skipped),
      missed: previous.missed + cleanCount(day.missed),
      pending: previous.pending + cleanCount(day.pending),
    });
  }

  const firstDate = Array.from(byDate.keys()).sort()[0];
  const days: Record<string, HomeProgressDay> = {};

  for (let cursor = firstDate; cursor <= todayKey; cursor = addDay(cursor)) {
    const counts = byDate.get(cursor);
    let mode: HomeProgressMode = 'no-tasks';
    let progressPct: number | null = null;
    let state: HomeProgressDayState = 'rest';

    if (counts) {
      const effective = counts.completed + counts.missed + counts.pending;
      if (effective === 0) {
        mode = counts.skipped > 0 ? 'all-skipped' : 'no-tasks';
      } else {
        mode = 'normal';
        progressPct = Math.round((counts.completed / effective) * 100);
        if (progressPct >= 100) state = 'perfect';
        else state = cursor === todayKey ? 'pending' : 'incomplete';
      }
    }

    days[cursor] = { date: cursor, state, mode, progressPct };
  }

  return { ...summarize(days), days };
}
