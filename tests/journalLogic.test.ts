import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { JournalEntry } from '@/components/journal/journalDb';
import {
  computeJournalStreak,
  didJournalDayBecomeComplete,
  hasDailyJournalContent,
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

  test('Daily inline free writing counts when that Daily section is active', () => {
    const next = journalEntry('2026-07-17', {
      dailySections: [{ id: 'freeWriting', type: 'freeWriting', active: true }],
      freeWritingHtml: '<p>A Daily Journal reflection.</p>',
    });

    assert.equal(hasDailyJournalContent(next), true);
  });

  test('standalone Free Writing does not masquerade as Daily Journal content', () => {
    const next = journalEntry('2026-07-17', {
      freeWritingHtml: '<p>A standalone Free Writing entry.</p>',
    });

    assert.equal(hasDailyJournalContent(next), false);
    assert.equal(isJournalDayComplete(next), true);
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

  test('today stays open without breaking a streak completed through yesterday', () => {
    const streak = computeJournalStreak([
      journalEntry('2026-07-14', { mood: 1 }),
      journalEntry('2026-07-15', { freeWritingHtml: '<p>Written.</p>' }),
      journalEntry('2026-07-16', { mood: 2 }),
    ], new Date(2026, 6, 17, 12));

    assert.equal(streak.currentStreak, 3);
    assert.equal(streak.bestStreak, 3);
    assert.equal(streak.lastDate, '2026-07-16');
  });

  test('a missed historical day breaks current streak but preserves the best run', () => {
    const streak = computeJournalStreak([
      journalEntry('2026-07-12', { mood: 1 }),
      journalEntry('2026-07-13', { mood: 1 }),
      journalEntry('2026-07-16', { mood: 1 }),
    ], new Date(2026, 6, 17, 12));

    assert.equal(streak.currentStreak, 1);
    assert.equal(streak.bestStreak, 2);
  });

  test('duplicate, malformed, impossible, and future dates cannot inflate the streak', () => {
    const streak = computeJournalStreak([
      journalEntry('2026-07-14', { mood: 1 }),
      journalEntry('2026-07-15', { mood: 1 }),
      journalEntry('2026-07-15', { freeWritingHtml: '<p>Duplicate row.</p>' }),
      journalEntry('not-a-date', { mood: 1 }),
      journalEntry('2026-02-30', { mood: 1 }),
      journalEntry('2026-07-18', { mood: 1 }),
    ], new Date(2026, 6, 17, 12));

    assert.deepEqual(streak.completedDates, ['2026-07-14', '2026-07-15']);
    assert.equal(streak.bestStreak, 2);
    assert.equal(streak.currentStreak, 0);
    assert.equal(streak.lastDate, '2026-07-15');
  });

  test('completing today extends the live streak exactly once', () => {
    const streak = computeJournalStreak([
      journalEntry('2026-07-15', { mood: 1 }),
      journalEntry('2026-07-16', { mood: 1 }),
      journalEntry('2026-07-17', { freeWritingHtml: '<p>Today.</p>' }),
      journalEntry('2026-07-17', { mood: 3 }),
    ], new Date(2026, 6, 17, 12));

    assert.equal(streak.currentStreak, 3);
    assert.equal(streak.bestStreak, 3);
    assert.deepEqual(streak.completedDates, [
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
    ]);
  });
});
