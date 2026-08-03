import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTaskLaunchDescriptor } from '../components/tasks/task-launch-descriptor';
import type { TaskInstance, TaskLaunchConfigBundle } from '../components/tasks/taskTypes';

function instance(change: Partial<TaskInstance> = {}): TaskInstance {
  return {
    id: 'task_1_2026-07-31',
    taskId: 'task_1',
    date: '2026-07-31',
    time: '08:00',
    status: 'pending',
    locked: false,
    title: 'Morning prayer',
    level: 1,
    source: 'spiritual',
    type: 'prayer',
    createdAt: 1,
    ...change,
  };
}

test('preloaded prayer config resolves every routed prayer mode', () => {
  const jesus: TaskLaunchConfigBundle = {
    prayer: {
      taskId: 'task_1',
      prayerTaskKind: 'jesus_prayer',
      jesusPrayerMode: 'count',
      jesusPrayerCount: 300,
    },
  };
  assert.deepEqual(resolveTaskLaunchDescriptor(instance(), jesus), {
    kind: 'jesusPrayer', mode: 'count', duration: 15, count: 300,
  });

  assert.deepEqual(resolveTaskLaunchDescriptor(instance(), {
    prayer: { taskId: 'task_1', prayerType: 'evening', prayerRule: 'short' },
  }), { kind: 'guidedPrayer', category: 'evening', optionId: 'medium' });
});

test('legacy routed tasks keep a safe completion flow without config', () => {
  assert.deepEqual(resolveTaskLaunchDescriptor(instance({
    title: 'Evening prayer',
    targetView: '/prayer',
  }), undefined), {
    kind: 'guidedPrayer', category: 'evening', optionId: 'standard',
  });

  assert.deepEqual(resolveTaskLaunchDescriptor(instance({
    type: 'journal',
    targetView: '/journal-free',
  }), undefined), { kind: 'journal', route: '/journal-free' });
});

test('launch descriptor carries critical scripture and reading params', () => {
  assert.deepEqual(resolveTaskLaunchDescriptor(instance({
    type: 'reading',
    title: 'Read 4 chapters',
  }), undefined), { kind: 'scriptureCheckpoint', plannedCount: 4 });

  assert.deepEqual(resolveTaskLaunchDescriptor(instance({
    taskId: 'reading_book_book-7',
    source: 'reading_book',
    type: 'reading',
  }), undefined), { kind: 'readingSession', bookId: 'book-7' });
});

test('church calendar remains direct while Scripture challenges route to their reader', () => {
  const challenge = instance({ source: 'challenge', type: 'reading' });
  assert.deepEqual(resolveTaskLaunchDescriptor(challenge, {
    scripture: { taskId: 'task_1', readingType: 'church_calendar' },
  }), { kind: 'directCompletion' });
  assert.deepEqual(resolveTaskLaunchDescriptor(challenge, {
    scripture: { taskId: 'task_1', readingType: 'new_testament' },
  }), { kind: 'scriptureChallenge' });
});
