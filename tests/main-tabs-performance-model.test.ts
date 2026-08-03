import assert from 'node:assert/strict';
import test from 'node:test';
import { canReuseHomeTaskRow } from '../components/home/home-task-row-identity';
import { viewportMaskChanged } from '../components/shared/use-viewport-motion-budget';
import { ambientMotionEnabled } from '../components/shared/ambient-motion-state';
import { getHomeFooterMotionState } from '../components/home/home-footer-motion';

test('ambient motion pauses for blur and Reduce Motion', () => {
  assert.equal(ambientMotionEnabled(true, false), true);
  assert.equal(ambientMotionEnabled(false, false), false);
  assert.equal(ambientMotionEnabled(true, true), false);
});

test('viewport mask publishes only a real activation change', () => {
  assert.equal(viewportMaskChanged(0b0011, 0b0011), false);
  assert.equal(viewportMaskChanged(0b0011, 0b0110), true);
});

test('Home keeps untouched task row identity', () => {
  const card = {};
  const displayTask = {};
  const shared = {
    card,
    displayTask,
    dateInactive: false,
    futureInactive: false,
    canToggle: true,
    canSkip: true,
    canShowAnalytics: true,
    blessingsToday: 0,
  };
  assert.equal(canReuseHomeTaskRow(shared, { ...shared }), true);
  assert.equal(canReuseHomeTaskRow(shared, { ...shared, displayTask: {} }), false);
});

test('Home progress and Organize have independent viewport budgets', () => {
  const organizeFrames = new Map([
    [0, { y: 0, height: 180 }],
    [1, { y: 190, height: 180 }],
  ]);
  const common = {
    viewportHeight: 700,
    footerFrame: { y: 1_000, height: 1_200 },
    weeklyFrame: { y: 0, height: 430 },
    organizeTop: 450,
    organizeFrames,
    preload: 0,
  };

  assert.deepEqual(getHomeFooterMotionState({
    ...common,
    scrollY: 900,
  }), {
    weeklyActive: true,
    organizeMask: 0b0001,
  });

  assert.deepEqual(getHomeFooterMotionState({
    ...common,
    scrollY: 1_500,
  }), {
    weeklyActive: false,
    organizeMask: 0b0011,
  });
});

test('Home footer publishes no motion before its child frames are measured', () => {
  assert.deepEqual(getHomeFooterMotionState({
    scrollY: 0,
    viewportHeight: 700,
    footerFrame: { y: Number.POSITIVE_INFINITY, height: 0 },
    weeklyFrame: { y: Number.POSITIVE_INFINITY, height: 0 },
    organizeTop: Number.POSITIVE_INFINITY,
    organizeFrames: new Map(),
  }), {
    weeklyActive: false,
    organizeMask: 0,
  });
});
