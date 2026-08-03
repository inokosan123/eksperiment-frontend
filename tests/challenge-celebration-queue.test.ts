import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearTaskCompletionReturnAnimation,
  consumeTaskCompletionReturnAnimations,
  queueTaskCompletionReturnAnimation,
  requeueTaskCompletionReturnAnimations,
} from '../components/tasks/taskReturnAnimation';
import {
  CHALLENGE_REVEAL_BREATH_MS,
  DIRECT_COMPLETION_SETTLE_MS,
  DIRECT_CHECK_TO_CHALLENGE_POPUP_MS,
  HOME_POST_TRANSITION_SETTLE_MS,
  TASK_CHECK_PRIMARY_MOTION_MS,
  TASK_CHECK_TO_CHALLENGE_POPUP_MS,
  remainingDirectPopupDelayMs,
  remainingReturnCheckDelayMs,
} from '../components/tasks/taskCompletionTimeline';
import { challengeIdFromTaskId } from '../components/challenges/challenge-task-identity';

test('legacy challenge task ids recover their missing challenge relationship', () => {
  assert.equal(
    challengeIdFromTaskId('challenge_task_challenge_church_weekly_1722250000000_ab12'),
    'challenge_church_weekly_1722250000000_ab12',
  );
  assert.equal(challengeIdFromTaskId('ordinary_task_1'), null);
});

test('a routed challenge flow cannot overwrite its trophy celebration metadata', () => {
  consumeTaskCompletionReturnAnimations();
  const instanceId = 'challenge_task_prayer_2026-07-29';

  // TaskProvider discovers the challenge win first.
  queueTaskCompletionReturnAnimation(instanceId, 680, {
    celebration: {
      type: 'challengeComplete',
      title: 'Morning Prayer Challenge',
      variant: 'challenge',
    },
  });
  // The prayer/journal screen then queues its ordinary return animation.
  queueTaskCompletionReturnAnimation(instanceId, 420);

  const queued = consumeTaskCompletionReturnAnimations();
  assert.equal(queued.length, 1);
  assert.deepEqual(queued[0].celebration, {
    type: 'challengeComplete',
    title: 'Morning Prayer Challenge',
    variant: 'challenge',
  });
});

test('Church celebration keeps weekly trophy details until Home consumes it', () => {
  consumeTaskCompletionReturnAnimations();
  const instanceId = 'challenge_task_church_2026-07-29';
  queueTaskCompletionReturnAnimation(instanceId, 680, {
    celebration: {
      type: 'challengeComplete',
      title: 'Go to Church Every Week',
      variant: 'churchWeek',
      trophyCount: 3,
      currentStreak: 2,
      challengeId: 'church',
      weekStart: '2026-07-27',
    },
  });

  assert.deepEqual(consumeTaskCompletionReturnAnimations()[0].celebration, {
    type: 'challengeComplete',
    title: 'Go to Church Every Week',
    variant: 'churchWeek',
    trophyCount: 3,
    currentStreak: 2,
    challengeId: 'church',
    weekStart: '2026-07-27',
  });
});

test('an event displayed directly on Home is cleared and does not replay', () => {
  consumeTaskCompletionReturnAnimations();
  const instanceId = 'challenge_task_journal_2026-07-29';
  queueTaskCompletionReturnAnimation(instanceId, 680, {
    celebration: { type: 'challengeComplete', title: 'Daily Journal' },
  });
  clearTaskCompletionReturnAnimation(instanceId);
  assert.deepEqual(consumeTaskCompletionReturnAnimations(), []);
});

test('routed completion delay includes the native transition only once', () => {
  const queuedAt = 1_000;
  assert.equal(
    remainingReturnCheckDelayMs([{ queuedAt, delayMs: 680 }], 1_450),
    HOME_POST_TRANSITION_SETTLE_MS,
  );
  assert.equal(
    remainingReturnCheckDelayMs([{ queuedAt, delayMs: 440 }], 1_600),
    HOME_POST_TRANSITION_SETTLE_MS,
  );
  assert.equal(
    remainingReturnCheckDelayMs([{ queuedAt, delayMs: 900, settledAt: 2_000 }], 2_040),
    HOME_POST_TRANSITION_SETTLE_MS - 40,
  );
  assert.equal(
    remainingReturnCheckDelayMs(
      [{ queuedAt, delayMs: 900, settledAt: 2_000 }],
      2_000 + HOME_POST_TRANSITION_SETTLE_MS,
    ),
    0,
  );
});

test('direct Home completion never replays its task feedback before the popup', () => {
  consumeTaskCompletionReturnAnimations();
  const feedbackPlayedAt = 5_000;
  queueTaskCompletionReturnAnimation('direct-final-task', 0, {
    source: 'home',
    feedbackPlayedAt,
  });
  queueTaskCompletionReturnAnimation('direct-final-task', undefined, {
    celebration: {
      type: 'challengeComplete',
      title: 'Twenty-one day challenge',
    },
  });

  const queued = consumeTaskCompletionReturnAnimations();
  assert.equal(queued[0].feedbackPlayedAt, feedbackPlayedAt);
  assert.equal(queued[0].source, 'home');
  assert.equal(
    remainingDirectPopupDelayMs(feedbackPlayedAt, 5_300),
    DIRECT_CHECK_TO_CHALLENGE_POPUP_MS - 300,
  );
  assert.equal(
    TASK_CHECK_TO_CHALLENGE_POPUP_MS,
    TASK_CHECK_PRIMARY_MOTION_MS + CHALLENGE_REVEAL_BREATH_MS,
  );
  assert.ok(CHALLENGE_REVEAL_BREATH_MS >= 120);
});

test('blur requeue preserves direct-feedback and trophy metadata', () => {
  consumeTaskCompletionReturnAnimations();
  queueTaskCompletionReturnAnimation('church-final-task', 0, {
    source: 'home',
    feedbackPlayedAt: 10_000,
    celebration: {
      type: 'challengeComplete',
      title: 'Go to Church Every Week',
      variant: 'churchWeek',
      eventId: 'church-week-1',
    },
  });
  const consumed = consumeTaskCompletionReturnAnimations();
  requeueTaskCompletionReturnAnimations(consumed);
  const restored = consumeTaskCompletionReturnAnimations()[0];

  assert.equal(restored.feedbackPlayedAt, 10_000);
  assert.equal(restored.celebration?.eventId, 'church-week-1');
  assert.equal(
    remainingDirectPopupDelayMs(10_000, 50_000),
    DIRECT_COMPLETION_SETTLE_MS,
  );
});
