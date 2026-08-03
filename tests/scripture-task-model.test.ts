import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_SCRIPTURE_SESSION_AMOUNT,
  DEFAULT_SCRIPTURE_TASK_TITLE,
  MAX_SCRIPTURE_SESSION_AMOUNT,
  normalizeScriptureSessionAmount,
  scriptureSessionAmountLabel,
  scriptureSessionUnitLabel,
  UNIVERSAL_SCRIPTURE_CHECKPOINT_KINDS,
  UNIVERSAL_SCRIPTURE_READING_TYPE,
} from '../components/scripture/scripture-task-model';

test('ordinary Scripture tasks use one universal default configuration', () => {
  assert.equal(DEFAULT_SCRIPTURE_TASK_TITLE, 'Scripture Reading');
  assert.equal(DEFAULT_SCRIPTURE_SESSION_AMOUNT, 1);
  assert.equal(MAX_SCRIPTURE_SESSION_AMOUNT, 10);
  assert.equal(UNIVERSAL_SCRIPTURE_READING_TYPE, 'custom');
  assert.deepEqual(UNIVERSAL_SCRIPTURE_CHECKPOINT_KINDS, [
    'new_testament',
    'old_testament',
    'psalter',
  ]);
});

test('session amount is normalized into the supported 1-10 range', () => {
  assert.equal(normalizeScriptureSessionAmount(undefined), 1);
  assert.equal(normalizeScriptureSessionAmount(''), 1);
  assert.equal(normalizeScriptureSessionAmount(0), 1);
  assert.equal(normalizeScriptureSessionAmount(-2), 1);
  assert.equal(normalizeScriptureSessionAmount('4'), 4);
  assert.equal(normalizeScriptureSessionAmount(4.6), 5);
  assert.equal(normalizeScriptureSessionAmount(50), 10);
});

test('session labels cover chapters and psalms without a reading type choice', () => {
  assert.equal(scriptureSessionAmountLabel(1), '1 chapter or psalm per session');
  assert.equal(scriptureSessionAmountLabel(3), '3 chapters or psalms per session');
  assert.equal(scriptureSessionUnitLabel(1), 'Chapter or psalm per session');
  assert.equal(scriptureSessionUnitLabel(3), 'Chapters or psalms per session');
});
