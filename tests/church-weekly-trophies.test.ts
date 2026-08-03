import test from 'node:test';
import assert from 'node:assert/strict';
import {
  churchRequiredDatesForWeek,
  churchSchedulesMatch,
  churchStartWeekQualifies,
  evaluateChurchWeek,
  summarizeChurchWeekStreaks,
} from '../components/challenges/churchWeeklyTrophies';

const WEEK_START = '2026-07-27';

test('a visible Church task schedule repairs a stale trophy schedule', () => {
  const staleChallengeConfig = {
    frequency: 'specific_days' as const,
    selectedDays: [6],
    time: '09:00',
    sameTimeEveryDay: true,
  };
  const visibleTaskConfig = {
    frequency: 'specific_days' as const,
    selectedDays: [2],
    time: '09:00',
    sameTimeEveryDay: true,
  };

  assert.equal(churchSchedulesMatch(staleChallengeConfig, visibleTaskConfig), false);
  const required = churchRequiredDatesForWeek(visibleTaskConfig, WEEK_START);
  assert.deepEqual(required, ['2026-07-29']);
  assert.equal(evaluateChurchWeek({
    weekStart: WEEK_START,
    requiredDates: required,
    completedDates: ['2026-07-29'],
    skippedDates: [],
    todayKey: '2026-07-29',
  }).status, 'earned');
});

test('equivalent Church day sets do not trigger a false schedule repair', () => {
  assert.equal(churchSchedulesMatch({
    frequency: 'specific_days',
    selectedDays: [4, 2, 2],
    time: '09:00',
    sameTimeEveryDay: false,
    dayTimes: { 4: '18:00', 2: '09:00' },
  }, {
    frequency: 'specific_days',
    selectedDays: [2, 4],
    time: '09:00',
    sameTimeEveryDay: false,
    dayTimes: { 2: '09:00', 4: '18:00' },
  }), true);
});

test('one Sunday completion earns exactly one weekly Church trophy', () => {
  const required = churchRequiredDatesForWeek({
    frequency: 'specific_days',
    selectedDays: [6],
  }, WEEK_START);

  assert.deepEqual(required, ['2026-08-02']);
  const result = evaluateChurchWeek({
    weekStart: WEEK_START,
    requiredDates: required,
    completedDates: ['2026-08-02'],
    skippedDates: [],
    todayKey: '2026-08-02',
  });
  assert.equal(result.status, 'earned');
  assert.equal(result.completedCount, 1);
});

test('a Wednesday and Friday plan needs both visits', () => {
  const required = churchRequiredDatesForWeek({
    frequency: 'specific_days',
    selectedDays: [2, 4],
  }, WEEK_START);

  assert.deepEqual(required, ['2026-07-29', '2026-07-31']);
  assert.equal(evaluateChurchWeek({
    weekStart: WEEK_START,
    requiredDates: required,
    completedDates: ['2026-07-29'],
    skippedDates: [],
    todayKey: '2026-07-31',
  }).status, 'active');
  assert.equal(evaluateChurchWeek({
    weekStart: WEEK_START,
    requiredDates: required,
    completedDates: required,
    skippedDates: [],
    todayKey: '2026-07-31',
  }).status, 'earned');
});

test('skipping one required visit blocks the weekly trophy', () => {
  const required = ['2026-07-29', '2026-07-31'];
  const result = evaluateChurchWeek({
    weekStart: WEEK_START,
    requiredDates: required,
    completedDates: ['2026-07-29'],
    skippedDates: ['2026-07-31'],
    todayKey: '2026-07-31',
  });
  assert.equal(result.status, 'missed');
  assert.equal(result.completedCount, 1);
});

test('a partial start week is practice when a chosen day already passed', () => {
  const required = ['2026-07-29', '2026-07-31'];
  assert.equal(churchStartWeekQualifies(required, '2026-07-30'), false);
  assert.equal(evaluateChurchWeek({
    weekStart: WEEK_START,
    requiredDates: required,
    completedDates: ['2026-07-31'],
    skippedDates: [],
    todayKey: '2026-07-31',
    practice: true,
  }).status, 'practice');
});

test('starting after today\'s chosen service time makes the first week practice', () => {
  const startedAtMs = new Date(2026, 6, 29, 19, 0, 0, 0).getTime();
  assert.equal(churchStartWeekQualifies(
    ['2026-07-29'],
    '2026-07-29',
    startedAtMs,
    '09:00',
  ), false);
});

test('completing every visible commitment earns even when the week began as practice', () => {
  const result = evaluateChurchWeek({
    weekStart: WEEK_START,
    requiredDates: ['2026-07-29'],
    completedDates: ['2026-07-29'],
    skippedDates: [],
    todayKey: '2026-07-29',
    practice: true,
  });
  assert.equal(result.status, 'earned');
});

test('Church check → uncheck → recheck restores one weekly trophy', () => {
  const requiredDates = ['2026-07-29'];
  const firstCheck = evaluateChurchWeek({
    weekStart: WEEK_START,
    requiredDates,
    completedDates: requiredDates,
    skippedDates: [],
    todayKey: '2026-07-29',
  });
  const unchecked = evaluateChurchWeek({
    weekStart: WEEK_START,
    requiredDates,
    completedDates: [],
    skippedDates: [],
    todayKey: '2026-07-29',
  });
  const rechecked = evaluateChurchWeek({
    weekStart: WEEK_START,
    requiredDates,
    completedDates: requiredDates,
    skippedDates: [],
    todayKey: '2026-07-29',
  });

  assert.equal(firstCheck.status, 'earned');
  assert.equal(unchecked.status, 'active');
  assert.equal(rechecked.status, 'earned');
  assert.equal(new Set([rechecked.weekStart]).size, 1);
});

test('practice weeks do not break a run, missed weeks do', () => {
  const makeWeek = (weekStart: string, status: 'earned' | 'missed' | 'practice') => evaluateChurchWeek({
    weekStart,
    requiredDates: [`${weekStart.slice(0, 8)}${weekStart.slice(8)}`],
    completedDates: status === 'earned' ? [weekStart] : [],
    skippedDates: status === 'missed' ? [weekStart] : [],
    todayKey: '2026-08-30',
    practice: status === 'practice',
  });
  const summary = summarizeChurchWeekStreaks([
    makeWeek('2026-07-27', 'earned'),
    makeWeek('2026-08-03', 'practice'),
    makeWeek('2026-08-10', 'earned'),
    makeWeek('2026-08-17', 'missed'),
    makeWeek('2026-08-24', 'earned'),
  ]);
  assert.deepEqual(summary, { current: 1, best: 2 });
});
