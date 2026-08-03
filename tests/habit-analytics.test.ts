import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateHabitAnalytics, rankTrackedHabitSteps } from '../components/habits/habitAnalytics';
import { buildTaskAnalyticsFromInstances, type TaskAnalyticsData } from '../components/tasks/taskAnalyticsModel';
import type { TaskInstance, TaskInstanceStatus } from '../components/tasks/taskTypes';

function instance(date: string, status: TaskInstanceStatus, time = '08:00'): TaskInstance {
  return {
    id: `habit-step::${date}`,
    taskId: 'habit-step',
    date,
    time,
    status,
    locked: status !== 'pending',
    title: 'Walk',
    level: 1,
    source: 'habit',
    type: 'custom',
    createdAt: new Date(`${date}T00:00:00`).getTime(),
  };
}

function analytics(overrides: Partial<TaskAnalyticsData>): TaskAnalyticsData {
  return {
    currentStreak: 0,
    bestStreak: 0,
    thisWeek: { completed: 0, scheduled: 0, pct: 0 },
    thisMonth: { completed: 0, scheduled: 0, pct: 0 },
    sinceStart: { completed: 0, scheduled: 0, pct: 0 },
    totalSkips: 0,
    completedDates: new Set(),
    skippedDates: new Set(),
    missedDates: new Set(),
    scheduledDates: new Set(),
    ...overrides,
  };
}

test('task consistency treats skipped occurrences as neutral and preserves the streak', () => {
  const result = buildTaskAnalyticsFromInstances([
    instance('2026-07-26', 'missed'),
    instance('2026-07-27', 'completed'),
    instance('2026-07-28', 'skipped'),
    instance('2026-07-29', 'completed'),
    instance('2026-07-30', 'pending', '18:00'),
  ], new Date('2026-07-30T12:00:00'));

  assert.ok(result);
  assert.deepEqual(result.thisWeek, { completed: 2, scheduled: 2, pct: 100 });
  assert.deepEqual(result.thisMonth, { completed: 2, scheduled: 3, pct: 67 });
  assert.equal(result.totalSkips, 1);
  assert.equal(result.currentStreak, 2);
  assert.equal(result.bestStreak, 2);
});

test('a stale pending occurrence from a past day is counted as missed', () => {
  const result = buildTaskAnalyticsFromInstances([
    instance('2026-07-27', 'completed'),
    instance('2026-07-28', 'skipped'),
    instance('2026-07-29', 'pending'),
    instance('2026-07-30', 'pending', '18:00'),
  ], new Date('2026-07-30T12:00:00'));

  assert.ok(result);
  assert.deepEqual(result.thisWeek, { completed: 1, scheduled: 2, pct: 50 });
  assert.equal(result.currentStreak, 0);
  assert.ok(result.missedDates.has('2026-07-29'));
});

test('goal analytics are weighted by occurrences instead of averaging step percentages', () => {
  const first = analytics({
    thisWeek: { completed: 1, scheduled: 1, pct: 100 },
    thisMonth: { completed: 1, scheduled: 1, pct: 100 },
    sinceStart: { completed: 1, scheduled: 1, pct: 100 },
    totalSkips: 1,
  });
  const second = analytics({
    thisWeek: { completed: 1, scheduled: 9, pct: 11 },
    thisMonth: { completed: 2, scheduled: 10, pct: 20 },
    sinceStart: { completed: 3, scheduled: 15, pct: 20 },
    totalSkips: 2,
  });
  const entries = [
    { stepId: 'first', analytics: first },
    { stepId: 'second', analytics: second },
  ];

  const result = aggregateHabitAnalytics(entries);
  assert.deepEqual(result.thisWeek, { completed: 2, scheduled: 10, pct: 20 });
  assert.deepEqual(result.thisMonth, { completed: 3, scheduled: 11, pct: 27 });
  assert.deepEqual(result.sinceStart, { completed: 4, scheduled: 16, pct: 25 });
  assert.equal(result.totalSkips, 3);
  assert.equal(result.trackedSteps, 2);
  assert.deepEqual(rankTrackedHabitSteps(entries).map(entry => entry.stepId), ['first', 'second']);
});
