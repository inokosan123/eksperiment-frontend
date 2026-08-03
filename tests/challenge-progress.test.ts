import test from 'node:test';
import assert from 'node:assert/strict';
import {
  challengeUsesFiniteScriptureReader,
  resolveDayCountChallengeTotal,
  resolveDayCountProgress,
} from '../components/challenges/challenge-progress';

test('a legacy 365-day lectionary with progressTotal zero can still finish', () => {
  assert.equal(resolveDayCountChallengeTotal({
    progressTotal: 0,
    durationDays: 365,
    totalUnits: 0,
  }), 365);
});

test('explicit challenge total wins over duration fallback', () => {
  assert.equal(resolveDayCountChallengeTotal({
    progressTotal: 30,
    durationDays: 45,
  }), 30);
});

test('lectionary daily check-ins do not open an empty finite chapter reader', () => {
  assert.equal(challengeUsesFiniteScriptureReader({
    category: 'scripture',
    templateId: 'lectionary_daily',
  }), false);
  assert.equal(challengeUsesFiniteScriptureReader({
    category: 'scripture',
    templateId: 'gospel_mark',
  }), true);
});

test('legacy checked task snapshots rebuild a previously stuck day-count challenge', () => {
  assert.deepEqual(resolveDayCountProgress(
    { progressTotal: 3, completedAt: undefined },
    ['completed', 'completed', 'completed'],
    '2026-07-29',
  ), {
    completedCount: 3,
    total: 3,
    completedAt: '2026-07-29',
  });
});

test('the final step can be unchecked and checked again as a new completion edge', () => {
  const firstTwenty = Array.from({ length: 20 }, () => 'completed' as const);
  const firstFinish = resolveDayCountProgress(
    { progressTotal: 21, completedAt: undefined },
    [...firstTwenty, 'completed'],
    '2026-07-29',
  );
  assert.equal(firstFinish.completedAt, '2026-07-29');

  const unchecked = resolveDayCountProgress(
    { progressTotal: 21, completedAt: firstFinish.completedAt },
    [...firstTwenty, 'pending'],
    '2026-07-29',
  );
  assert.equal(unchecked.completedAt, undefined);

  const rechecked = resolveDayCountProgress(
    { progressTotal: 21, completedAt: unchecked.completedAt },
    [...firstTwenty, 'completed'],
    '2026-07-29',
  );
  assert.equal(rechecked.completedAt, '2026-07-29');
});
