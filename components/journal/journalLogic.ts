import type { JournalEntry } from '@/components/journal/journalDb';

const MORNING_PAGES_MINIMUM_WORDS = 750;

function normalizeText(value: string) {
  return value.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

export function stripRichTextToPlainText(html = '') {
  if (!html) return '';

  const withSpacing = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ');

  return normalizeText(decodeHtmlEntities(withSpacing));
}

export function countWords(text: string) {
  const normalized = normalizeText(stripRichTextToPlainText(text));
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

  return (
    entry.mood !== undefined ||
    entry.energy !== undefined ||
    entry.satisfaction !== undefined ||
    entry.prompts.some(prompt => normalizeText(prompt.answer).length > 0) ||
    Object.values(entry.whoChecks).some(Boolean) ||
    Object.keys(entry.scaleValues).length > 0
  );
}

export function isJournalDayComplete(entry?: JournalEntry) {
  return hasDailyJournalContent(entry) || isMorningPagesComplete(entry) || hasFreeWritingContent(entry);
}

export function getJournalKindsForEntry(entry?: JournalEntry) {
  const kinds: ('daily' | 'morning' | 'free')[] = [];
  if (hasDailyJournalContent(entry)) kinds.push('daily');
  if (hasMorningPagesDraft(entry)) kinds.push('morning');
  if (hasFreeWritingContent(entry)) kinds.push('free');
  return kinds;
}

function isPreviousDay(date: string, candidate: string) {
  const previous = new Date(`${date}T12:00:00`);
  previous.setDate(previous.getDate() - 1);
  return localDateKey(previous) === candidate;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computeJournalStreak(entries: JournalEntry[]) {
  const completedDates = entries
    .filter(entry => isJournalDayComplete(entry))
    .map(entry => entry.date)
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

  const today = localDateKey(new Date());
  const yesterday = new Date(`${today}T12:00:00`);
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
