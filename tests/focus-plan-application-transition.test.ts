import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deferPlanApplicationUntilNextFrame,
  type DeferredPlanApplication,
} from '../components/focus-watch/plan-application-transition';

test('plan assignment waits for the frame after the picker sheet exits', () => {
  const calls: string[] = [];
  let scheduledCommit: (() => void) | undefined;
  const application: DeferredPlanApplication = {
    mode: 'today',
    day: 4,
    planId: 'focused-friday',
  };

  deferPlanApplicationUntilNextFrame(
    application,
    {
      assignToday: planId => calls.push(`today:${planId}`),
      assignTodayAndTemplate: (day, planId) => calls.push(`combined:${day}:${planId}`),
      assignTemplate: (day, planId) => calls.push(`template:${day}:${planId}`),
    },
    commit => { scheduledCommit = commit; },
  );

  assert.deepEqual(calls, []);
  assert.ok(scheduledCommit);
  scheduledCommit();
  assert.deepEqual(calls, ['today:focused-friday']);
});

test('deferred assignment preserves combined and template-only intent', () => {
  const calls: string[] = [];
  const actions = {
    assignToday: (planId: string | null) => calls.push(`today:${planId}`),
    assignTodayAndTemplate: (day: number, planId: string | null) => calls.push(`combined:${day}:${planId}`),
    assignTemplate: (day: number, planId: string | null) => calls.push(`template:${day}:${planId}`),
  };
  const immediately = (commit: () => void) => commit();

  deferPlanApplicationUntilNextFrame(
    { mode: 'today-and-template', day: 2, planId: 'midweek' },
    actions,
    immediately,
  );
  deferPlanApplicationUntilNextFrame(
    { mode: 'template', day: 6, planId: null },
    actions,
    immediately,
  );

  assert.deepEqual(calls, ['combined:2:midweek', 'template:6:null']);
});
