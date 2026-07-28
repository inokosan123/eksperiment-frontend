import type { JournalEntry } from '@/components/journal/journalDb';
import { richTextToPlainText } from '@/components/shared/rich-text/rich-text-html';

const MORNING_PAGES_MINIMUM_WORDS = 50;
const JOURNAL_DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function stripRichTextToPlainText(html = '') {
  return richTextToPlainText(html);
}

export function countWords(text: string) {
  const normalized = stripRichTextToPlainText(text);
  if (!normalized) return 0;
  return normalized.split(' ').filter(Boolean).length;
}

export function hasMorningPagesDraft(entry?: JournalEntry) {
  return stripRichTextToPlainText(entry?.morningPagesHtml ?? '').length > 0;
}

export function isMorningPagesComplete(entry?: JournalEntry) {
  const explicitCount = entry?.morningPagesWordCount ?? 0;
  const derivedCount = countWords(entry?.morningPagesHtml ?? '');
  return Math.max(explicitCount, derivedCount) >= MORNING_PAGES_MINIMUM_WORDS;
}

export function hasFreeWritingContent(entry?: JournalEntry) {
  return stripRichTextToPlainText(entry?.freeWritingHtml ?? '').length > 0;
}

export function hasDailyJournalContent(entry?: JournalEntry) {
  if (!entry) return false;

  // `freeWritingHtml` is shared with the standalone Free Writing technique.
  // Count it as Daily Journal content only when the saved Daily layout proves
  // that the Free Writing section was active on this entry.
  const hasDailyFreeWriting = entry.dailySections?.some(section => (
    section.active
    && section.type === 'freeWriting'
    && stripRichTextToPlainText(entry.freeWritingHtml ?? '').length > 0
  )) ?? false;

  return (
    entry.mood !== undefined ||
    entry.energy !== undefined ||
    entry.satisfaction !== undefined ||
    entry.prompts.some(prompt => stripRichTextToPlainText(prompt.answer).length > 0) ||
    Object.values(entry.whoChecks).some(Boolean) ||
    Object.keys(entry.scaleValues).length > 0 ||
    hasDailyFreeWriting
  );
}

export function isJournalDayComplete(entry?: JournalEntry) {
  return hasDailyJournalContent(entry) || isMorningPagesComplete(entry) || hasFreeWritingContent(entry);
}

export function didJournalDayBecomeComplete(
  previousEntry: JournalEntry | undefined,
  nextEntry: JournalEntry,
) {
  return !isJournalDayComplete(previousEntry) && isJournalDayComplete(nextEntry);
}

export function getJournalKindsForEntry(entry?: JournalEntry) {
  const kinds: ('daily' | 'morning' | 'morningDraft' | 'free')[] = [];
  if (hasDailyJournalContent(entry)) kinds.push('daily');
  if (isMorningPagesComplete(entry)) {
    kinds.push('morning');
  } else if (hasMorningPagesDraft(entry)) {
    kinds.push('morningDraft');
  }
  if (hasFreeWritingContent(entry)) kinds.push('free');
  return kinds;
}

function dateFromKey(key: string) {
  const match = JOURNAL_DATE_KEY.exec(key);
  if (!match) return null;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
  );
  return localDateKey(date) === key ? date : null;
}

function isPreviousDay(date: string, candidate: string) {
  const previous = dateFromKey(date);
  if (!previous) return false;
  previous.setDate(previous.getDate() - 1);
  return localDateKey(previous) === candidate;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computeJournalStreak(entries: JournalEntry[], referenceDate: Date = new Date()) {
  const safeReferenceDate = Number.isNaN(referenceDate.getTime()) ? new Date() : referenceDate;
  const today = localDateKey(safeReferenceDate);
  const completedDates = Array.from(new Set(
    entries
      .filter(entry => isJournalDayComplete(entry))
      .map(entry => entry.date)
      .filter(date => date <= today && dateFromKey(date) !== null),
  ))
    .sort((left, right) => left.localeCompare(right));

  if (completedDates.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      completedDates: [] as string[],
      lastDate: '',
    };
  }

  let bestStreak = 1;
  let runningBest = 1;

  for (let index = 1; index < completedDates.length; index += 1) {
    if (isPreviousDay(completedDates[index], completedDates[index - 1])) {
      runningBest += 1;
      bestStreak = Math.max(bestStreak, runningBest);
    } else {
      runningBest = 1;
    }
  }

  const yesterday = dateFromKey(today) ?? new Date(safeReferenceDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateKey(yesterday);
  const completedSet = new Set(completedDates);
  const anchor = completedSet.has(today) ? today : completedSet.has(yesterdayKey) ? yesterdayKey : '';

  let currentStreak = 0;
  if (anchor) {
    currentStreak = 1;
    let cursor = anchor;
    while (true) {
      const previous = new Date(`${cursor}T12:00:00`);
      previous.setDate(previous.getDate() - 1);
      const previousKey = localDateKey(previous);
      if (!completedSet.has(previousKey)) break;
      currentStreak += 1;
      cursor = previousKey;
    }
  }

  return {
    currentStreak,
    bestStreak,
    completedDates,
    lastDate: completedDates[completedDates.length - 1],
  };
}

export const JOURNAL_MORNING_PAGES_MINIMUM_WORDS = MORNING_PAGES_MINIMUM_WORDS;
