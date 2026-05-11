import type { BigEvent } from './bigEventsDb';

const DAY_MS = 24 * 60 * 60 * 1000;

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey() {
  return toLocalDateKey(new Date());
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
    createdAt: event.createdAt || Date.now(),
  };
}

export function isBigEventDeletedOnDate(event: BigEvent, date: string): boolean {
  return !!event.deletedAt && date >= event.deletedAt;
}

export function isBigEventVisibleOnDate(event: BigEvent, date: string): boolean {
  const normalized = normalizeBigEvent(event);
  return (
    date >= normalized.startDate &&
    date <= normalized.endDate &&
    !isBigEventDeletedOnDate(normalized, date)
  );
}

export function getBigEventsForDate(events: BigEvent[], date: string, limit?: number): BigEvent[] {
  const visible = events
    .map(normalizeBigEvent)
    .filter(event => isBigEventVisibleOnDate(event, date))
    .sort((a, b) => {
      const byEnd = a.endDate.localeCompare(b.endDate);
      if (byEnd !== 0) return byEnd;
      return a.createdAt - b.createdAt;
    });

  return typeof limit === 'number' ? visible.slice(0, limit) : visible;
}

/**
 * Days between fromDate and event.endDate (inclusive of end day).
 * - >0 means event is in the future (X days)
 * - 0 means event is today
 * - <0 means event has passed
 */
export function getBigEventCountdown(event: BigEvent, fromDate: string): number {
  const endDate = getBigEventEndDate(event);
  const target = new Date(`${endDate}T12:00:00`);
  const current = new Date(`${fromDate}T12:00:00`);
  return Math.ceil((target.getTime() - current.getTime()) / DAY_MS);
}

export function sortBigEvents(events: BigEvent[]): BigEvent[] {
  return events
    .map(normalizeBigEvent)
    .sort((a, b) => {
      const byEnd = a.endDate.localeCompare(b.endDate);
      if (byEnd !== 0) return byEnd;
      const byStart = a.startDate.localeCompare(b.startDate);
      if (byStart !== 0) return byStart;
      return a.createdAt - b.createdAt;
    });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateMedium(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
