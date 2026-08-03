import assert from 'node:assert/strict';
import test from 'node:test';

import { continuousAnimationElapsedNow } from '../components/shared/continuous-animation-time';

test('shared animation snapshots preserve elapsed time without restarting', () => {
  const firstNow = Date.now();
  const firstElapsed = continuousAnimationElapsedNow(firstNow);
  const secondElapsed = continuousAnimationElapsedNow(firstNow + 417);

  assert.equal(secondElapsed - firstElapsed, 417);
});
