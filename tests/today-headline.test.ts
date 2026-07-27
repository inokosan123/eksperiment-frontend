import test from 'node:test';
import assert from 'node:assert/strict';
import { todayHeadline, type TodayHeadlineInput } from '../components/home/today-headline';

const base: TodayHeadlineInput = { mode: 'normal', pct: 0, done: 0, total: 7, streak: 4 };
const say = (over: Partial<TodayHeadlineInput>) => todayHeadline({ ...base, ...over });

test('a day with nothing scheduled says so, and says nothing was missed', () => {
  assert.equal(say({ mode: 'no-tasks' }), 'No tasks are scheduled today — nothing to miss.');
});

test('a skipped day keeps the streak when there is one behind it', () => {
  assert.equal(
    say({ mode: 'all-skipped', streak: 4 }),
    'Today’s tasks were skipped — your streak still holds.',
  );
});

test('a skipped day claims no streak when there is none', () => {
  assert.equal(
    say({ mode: 'all-skipped', streak: 0 }),
    'Today’s tasks were skipped — nothing was lost.',
  );
});

test('nothing done yet counts what is waiting', () => {
  assert.equal(say({ pct: 0, done: 0, total: 7 }), '7 tasks waiting — start with one.');
  assert.equal(say({ pct: 0, done: 0, total: 1 }), 'One task waiting — start there.');
});

test('under way and on pace both lead with the count', () => {
  assert.equal(say({ pct: 28, done: 2, total: 7 }), '2 of 7 done — keep going.');
  assert.equal(say({ pct: 57, done: 4, total: 7 }), '4 of 7 done — you’re on pace.');
});

test('near the end it names what is left, and gets the plural right', () => {
  assert.equal(say({ pct: 71, done: 5, total: 7 }), 'Almost there — 2 tasks left.');
  assert.equal(say({ pct: 86, done: 6, total: 7 }), 'Almost there — 1 task left.');
});

test('a full day is the only line that carries the flame', () => {
  assert.equal(say({ pct: 100, done: 7, total: 7 }), 'All 7 done — today’s flame is lit.');
  assert.equal(
    say({ pct: 100, done: 1, total: 1 }),
    'Your one task is done — today’s flame is lit.',
  );
});

test('the tier boundaries land where they are documented', () => {
  assert.match(say({ pct: 39, done: 3, total: 8 }), /keep going/);
  assert.match(say({ pct: 40, done: 3, total: 8 }), /on pace/);
  assert.match(say({ pct: 69, done: 6, total: 9 }), /on pace/);
  assert.match(say({ pct: 70, done: 7, total: 10 }), /Almost there/);
  assert.match(say({ pct: 99, done: 9, total: 10 }), /Almost there/);
});

test('no line ever repeats the percentage the medallion already shows', () => {
  const lines = [
    say({ mode: 'no-tasks' }),
    say({ mode: 'all-skipped' }),
    say({ pct: 0, done: 0, total: 7 }),
    say({ pct: 28, done: 2, total: 7 }),
    say({ pct: 57, done: 4, total: 7 }),
    say({ pct: 86, done: 6, total: 7 }),
    say({ pct: 100, done: 7, total: 7 }),
  ];
  for (const line of lines) assert.doesNotMatch(line, /%/);
});

test('counts that have not loaded yet claim nothing', () => {
  assert.equal(say({ pct: 0, done: 0, total: 0 }), 'Today is under way.');
});
