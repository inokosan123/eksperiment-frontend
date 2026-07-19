import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { JournalEntry } from '@/components/journal/journalDb';
import {
  computeJournalStreak,
  didJournalDayBecomeComplete,
  isJournalDayComplete,
  isMorningPagesComplete,
  JOURNAL_MORNING_PAGES_MINIMUM_WORDS,
} from '@/components/journal/journalLogic';

function journalEntry(
  date: string,
  patch: Partial<JournalEntry> = {},
): JournalEntry {
  return {
    date,
    prompts: [],
    whoChecks: {},
    scaleValues: {},
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

function words(count: number) {
  return Array.from({ length: count }, (_, index) => 'word' + index).join(' ');
}

describe('journal day completion', () => {
  test('Daily Journal content completes the day', () => {
    const next = journalEntry('2026-07-17', { mood: 0 });
    assert.equal(isJournalDayComplete(next), true);
    assert.equal(didJournalDayBecomeComplete(undefined, next), true);
  });

  test('Free Writing content completes the day', () => {
    const next = journalEntry('2026-07-17', {
      freeWritingHtml: '<p>A few honest words.</p>',
    });
    assert.equal(isJournalDayComplete(next), true);
    assert.equal(didJournalDayBecomeComplete(undefined, next), true);
  });

  test('Morning Pages stays a draft below the calendar threshold', () => {
    const belowMinimum = journalEntry('2026-07-17', {
      morningPagesHtml: words(JOURNAL_MORNING_PAGES_MINIMUM_WORDS - 1),
    });
    const complete = journalEntry('2026-07-17', {
      morningPagesHtml: words(JOURNAL_MORNING_PAGES_MINIMUM_WORDS),
    });

    assert.equal(isMorningPagesComplete(belowMinimum), false);
    assert.equal(isJournalDayComplete(belowMinimum), false);
    assert.equal(isMorningPagesComplete(complete), true);
    assert.equal(didJournalDayBecomeComplete(belowMinimum, complete), true);
  });

  test('a second completed technique does not award the same day again', () => {
    const dailyComplete = journalEntry('2026-07-17', { mood: 2 });
    const dailyAndMorningComplete = journalEntry('2026-07-17', {
      mood: 2,
      morningPagesHtml: words(JOURNAL_MORNING_PAGES_MINIMUM_WORDS),
    });

    assert.equal(
      didJournalDayBecomeComplete(dailyComplete, dailyAndMorningComplete),
      false,
    );
  });

  test('all three techniques contribute dates to the same streak', () => {
    const streak = computeJournalStreak([
      journalEntry('2026-07-14', { mood: 1 }),
      journalEntry('2026-07-15', {
        morningPagesHtml: words(JOURNAL_MORNING_PAGES_MINIMUM_WORDS),
      }),
      journalEntry('2026-07-16', {
        freeWritingHtml: '<p>Open page.</p>',
      }),
    ]);

    assert.deepEqual(streak.completedDates, [
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
    ]);
    assert.equal(streak.bestStreak, 3);
  });
});
