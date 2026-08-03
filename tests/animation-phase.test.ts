import assert from 'node:assert/strict';
import test from 'node:test';
import {
  continuousPhase,
  easeInOutQuad,
  halfSinePulse,
  pingPongPhase,
  trianglePhase,
  windowedHalfSinePulse,
} from '../components/shared/animation-phase';

test('continuous phase resumes from wall time instead of restarting', () => {
  const duration = 10_000;
  const beforePause = continuousPhase(3_250, duration);
  const afterPause = continuousPhase(7_750, duration);

  assert.equal(beforePause, 0.325);
  assert.equal(afterPause, 0.775);
  assert.notEqual(afterPause, 0, 'resume reset the animation to its first frame');
});

test('continuous phase closes every cycle without a visible seam', () => {
  const duration = 4_600;
  const sample = continuousPhase(1_731, duration, 0.17);
  const nextCycle = continuousPhase(1_731 + duration, duration, 0.17);
  assert.ok(Math.abs(sample - nextCycle) < 1e-12);
});

test('ping-pong phase preserves the old breath endpoints', () => {
  const leg = 2_000;
  assert.equal(pingPongPhase(0, leg), 0);
  assert.equal(pingPongPhase(leg, leg), 1);
  assert.equal(pingPongPhase(leg * 2, leg), 0);
});

test('triangle phase preserves a custom easing leg without changing its duration', () => {
  assert.equal(trianglePhase(0, 2600), 0);
  assert.equal(trianglePhase(1300, 2600), 0.5);
  assert.equal(trianglePhase(2600, 2600), 1);
  assert.equal(trianglePhase(3900, 2600), 0.5);
  assert.equal(trianglePhase(5200, 2600), 0);
});

test('phase offsets keep neighbouring cards and motes out of step', () => {
  const first = continuousPhase(5_000, 10_000, 0);
  const second = continuousPhase(5_000, 10_000, 0.31);
  assert.notEqual(first, second);
});

test('quadratic easing keeps exact start, midpoint and end', () => {
  assert.equal(easeInOutQuad(0), 0);
  assert.equal(easeInOutQuad(0.5), 0.5);
  assert.equal(easeInOutQuad(1), 1);
});

test('cheap half-sine pulse keeps the original sparkle curve visually exact', () => {
  assert.equal(halfSinePulse(0), 0);
  assert.equal(halfSinePulse(0.5), 1);
  assert.equal(halfSinePulse(1), 0);

  for (let step = 0; step <= 100; step += 1) {
    const progress = step / 100;
    const exact = Math.sin(progress * Math.PI);
    assert.ok(Math.abs(halfSinePulse(progress) - exact) < 0.002);
  }
});

test('a paused sparkle keeps the same opacity as its running clock phase', () => {
  const elapsed = 2_375;
  const duration = 10_000;
  const offset = 0.17;
  const window = 0.42;
  const phase = continuousPhase(elapsed, duration, offset);
  const runningOpacity = phase < window ? halfSinePulse(phase / window) : 0;

  assert.equal(
    windowedHalfSinePulse(elapsed, duration, offset, window),
    runningOpacity,
  );
  assert.equal(windowedHalfSinePulse(8_000, duration, 0, window), 0);
});
