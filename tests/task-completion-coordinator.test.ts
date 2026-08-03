import assert from 'node:assert/strict';
import test from 'node:test';
import { createCompletionAttemptGuard } from '../components/tasks/task-completion-attempt';
import {
  beginTaskCompletionReturn,
  clearTaskCompletionReturnAnimation,
  consumeSettledTaskCompletionReturnAnimations,
  consumeTaskCompletionReturnAnimations,
  markTaskCompletionReturnSettled,
  peekTaskCompletionReturnAnimations,
  queueTaskCompletionReturnAnimation,
  requeueTaskCompletionReturnAnimations,
} from '../components/tasks/taskReturnAnimation';

test.beforeEach(() => {
  consumeTaskCompletionReturnAnimations();
});

test('duplicate finish taps acquire one synchronous commit slot', () => {
  const guard = createCompletionAttemptGuard();
  assert.equal(guard.tryStart(), true);
  assert.equal(guard.tryStart(), false);
  guard.release();
  assert.equal(guard.tryStart(), true);
});

test('failed commit clears its event and can be retried', () => {
  const guard = createCompletionAttemptGuard();
  assert.equal(guard.tryStart(), true);
  beginTaskCompletionReturn('journal_2026-07-31', '2026-07-31');
  clearTaskCompletionReturnAnimation('journal_2026-07-31');
  guard.release();
  assert.deepEqual(peekTaskCompletionReturnAnimations(), []);
  assert.equal(guard.tryStart(), true);
});

test('routed event cannot be consumed before native return settles', () => {
  beginTaskCompletionReturn('prayer_2026-07-31', '2026-07-31');
  queueTaskCompletionReturnAnimation('prayer_2026-07-31', undefined, {
    source: 'routed',
    updated: true,
  });
  assert.deepEqual(consumeSettledTaskCompletionReturnAnimations(), []);
  assert.equal(peekTaskCompletionReturnAnimations()[0].state, 'ready');

  markTaskCompletionReturnSettled('prayer_2026-07-31');
  const settled = consumeSettledTaskCompletionReturnAnimations();
  assert.equal(settled.length, 1);
  assert.equal(settled[0].state, 'returnSettled');
  assert.ok(settled[0].settledAt);
});

test('metadata merges into one event per instance', () => {
  beginTaskCompletionReturn('challenge_2026-07-31');
  queueTaskCompletionReturnAnimation('challenge_2026-07-31', undefined, {
    source: 'routed',
    celebration: { type: 'challengeComplete', eventId: 'event-1' },
  });
  queueTaskCompletionReturnAnimation('challenge_2026-07-31', 900, {
    updated: true,
  });
  assert.equal(peekTaskCompletionReturnAnimations().length, 1);
  assert.equal(peekTaskCompletionReturnAnimations()[0].celebration?.eventId, 'event-1');
});

test('background requeue never downgrades a settled return', () => {
  beginTaskCompletionReturn('reading_2026-07-31');
  queueTaskCompletionReturnAnimation('reading_2026-07-31', undefined, { source: 'routed' });
  const readySnapshot = consumeTaskCompletionReturnAnimations();
  requeueTaskCompletionReturnAnimations(readySnapshot);
  markTaskCompletionReturnSettled('reading_2026-07-31');
  requeueTaskCompletionReturnAnimations(readySnapshot);
  assert.equal(peekTaskCompletionReturnAnimations()[0].state, 'returnSettled');
});

test('multiple completions remain independent and consume once', () => {
  for (const id of ['task-a', 'task-b']) {
    beginTaskCompletionReturn(id);
    queueTaskCompletionReturnAnimation(id, undefined, { source: 'routed' });
    markTaskCompletionReturnSettled(id);
  }
  assert.deepEqual(
    consumeSettledTaskCompletionReturnAnimations().map(item => item.instanceId).sort(),
    ['task-a', 'task-b'],
  );
  assert.deepEqual(consumeSettledTaskCompletionReturnAnimations(), []);
});

test('external completion is already settled and never blocks the Home outbox', () => {
  queueTaskCompletionReturnAnimation('notification-task', undefined, {
    source: 'external',
    celebration: { type: 'challengeComplete', eventId: 'external-event' },
  });
  const settled = consumeSettledTaskCompletionReturnAnimations();
  assert.equal(settled.length, 1);
  assert.equal(settled[0].source, 'external');
  assert.equal(settled[0].celebration?.eventId, 'external-event');
});
