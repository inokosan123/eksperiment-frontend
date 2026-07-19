import type { BigEvent } from './bigEventsDb';
import { normalizeBigEventLeadDays } from './bigEventsConfig';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateParts(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month, day };
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0, 12, 0, 0).getDate();
}

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey() {
  return toLocalDateKey(new Date());
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalDateKey(date);
}

export function getBigEventStartDate(event: BigEvent): string {
  if (event.startDate) return event.startDate;
  if (event.createdAt) return toLocalDateKey(new Date(event.createdAt));
  return event.endDate;
}

export function getBigEventEndDate(event: BigEvent): string {
  return event.endDate;
}

export function normalizeBigEvent(event: BigEvent): BigEvent {
  const endDate = getBigEventEndDate(event);
  const startDate = event.startDate || getBigEventStartDate(event);
  const orderedStart = startDate <= endDate ? startDate : endDate;
  const orderedEnd = endDate >= startDate ? endDate : startDate;

  return {
    ...event,
    startDate: orderedStart,
    endDate: orderedEnd,
    recurrence: event.recurrence === 'yearly' ? 'yearly' : 'none',
    leadDays: normalizeBigEventLeadDays(event.leadDays, event.recurrence),
    remindersEnabled: event.remindersEnabled === true,
    createdAt: event.createdAt || Date.now(),
  };
}

export function getYearlyOccurrenceDate(event: BigEvent, year: number): string {
  const anchor = dateParts(event.endDate);
  const month = Math.min(12, Math.max(1, anchor.month || 1));
  const day = Math.min(Math.max(1, anchor.day || 1), daysInMonth(year, month));
  return dateKeyFromParts(year, month, day);
}

export function resolveBigEventForDate(event: BigEvent, referenceDate: string): BigEvent {
  const normalized = normalizeBigEvent(event);
  if (normalized.recurrence !== 'yearly') return normalized;

  const { year } = dateParts(referenceDate);
  let occurrenceDate = getYearlyOccurrenceDate(normalized, year);
  if (occurrenceDate < referenceDate) {
    occurrenceDate = getYearlyOccurrenceDate(normalized, year + 1);
  }

  return {
    ...normalized,
    startDate: addDaysToDateKey(occurrenceDate, -normalized.leadDays),
    endDate: occurrenceDate,
  };
}

export function isBigEventDeletedOnDate(event: BigEvent, date: string): boolean {
  return !!event.deletedAt && date >= event.deletedAt;
}

export function isBigEventVisibleOnDate(event: BigEvent, date: string): boolean {
  const resolved = resolveBigEventForDate(event, date);
  return (
    date >= resolved.startDate &&
    date <= resolved.endDate &&
    !isBigEventDeletedOnDate(resolved, date)
  );
}

export function getBigEventsForDate(events: BigEvent[], date: string, limit?: number): BigEvent[] {
  const visible = events
    .map(event => resolveBigEventForDate(event, date))
    .filter(event => (
      date >= event.startDate &&
      date <= event.endDate &&
      !isBigEventDeletedOnDate(event, date)
    ))
    .sort((a, b) => {
      const byEnd = a.endDate.localeCompare(b.endDate);
      if (byEnd !== 0) return byEnd;
      return a.createdAt - b.createdAt;
    });

  return typeof limit === 'number' ? visible.slice(0, limit) : visible;
}

/** Days between fromDate and the next occurrence. */
export function getBigEventCountdown(event: BigEvent, fromDate: string): number {
  const endDate = resolveBigEventForDate(event, fromDate).endDate;
  const target = new Date(`${endDate}T12:00:00`);
  const current = new Date(`${fromDate}T12:00:00`);
  return Math.ceil((target.getTime() - current.getTime()) / DAY_MS);
}

export function sortBigEvents(events: BigEvent[], referenceDate: string = todayKey()): BigEvent[] {
  return events
    .map(event => resolveBigEventForDate(event, referenceDate))
    .sort((a, b) => {
      const byEnd = a.endDate.localeCompare(b.endDate);
      if (byEnd !== 0) return byEnd;
      const byStart = a.startDate.localeCompare(b.startDate);
      if (byStart !== 0) return byStart;
      return a.createdAt - b.createdAt;
    });
}

export type BigEventSections = {
  upcoming: BigEvent[];
  recurring: BigEvent[];
  past: BigEvent[];
};

/**
 * Groups events for the Big Events screen without persisting a time-sensitive UI state.
 * Yearly events are upcoming only inside their configured lead window; otherwise they
 * remain editable in the recurring section until that window begins.
 */
export function getBigEventSectionsForDate(events: BigEvent[], date: string): BigEventSections {
  const sections: BigEventSections = { upcoming: [], recurring: [], past: [] };

  for (const source of events) {
    if (isBigEventDeletedOnDate(source, date)) continue;
    const event = resolveBigEventForDate(source, date);

    if (event.recurrence === 'yearly') {
      if (date >= event.startDate && date <= event.endDate) {
        sections.upcoming.push(event);
      } else {
        sections.recurring.push(event);
      }
      continue;
    }

    if (event.endDate >= date) sections.upcoming.push(event);
    else sections.past.push(event);
  }

  const byNextDate = (a: BigEvent, b: BigEvent) => {
    const byEnd = a.endDate.localeCompare(b.endDate);
    if (byEnd !== 0) return byEnd;
    const byStart = a.startDate.localeCompare(b.startDate);
    if (byStart !== 0) return byStart;
    return a.createdAt - b.createdAt;
  };

  sections.upcoming.sort(byNextDate);
  sections.recurring.sort(byNextDate);
  sections.past.sort(byNextDate);
  return sections;
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateMedium(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
