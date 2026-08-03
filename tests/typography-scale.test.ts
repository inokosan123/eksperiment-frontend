import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_READABLE_FONT_MULTIPLIER,
  MIN_READABLE_LINE_HEIGHT_RATIO,
  clampReadableFontScale,
  scaleReadableLineHeight,
  scaleReadableMetric,
} from '../components/shared/typographyScalePolicy';

test('system text settings never shrink authored typography', () => {
  assert.equal(clampReadableFontScale(0.8), 1);
  assert.equal(clampReadableFontScale(1), 1);
  assert.equal(clampReadableFontScale(Number.NaN), 1);
});

test('system text settings never grow authored typography', () => {
  assert.equal(MAX_READABLE_FONT_MULTIPLIER, 1);
  assert.equal(clampReadableFontScale(1.01), 1);
  assert.equal(clampReadableFontScale(1.1), 1);
  assert.equal(clampReadableFontScale(1.2), MAX_READABLE_FONT_MULTIPLIER);
  assert.equal(clampReadableFontScale(1.5), MAX_READABLE_FONT_MULTIPLIER);
  assert.equal(clampReadableFontScale(3), MAX_READABLE_FONT_MULTIPLIER);
});

test('font geometry stays at the authored metrics', () => {
  assert.equal(scaleReadableMetric(17, 1.2), 17);
  assert.equal(scaleReadableMetric(20, 2), 20);
  assert.equal(scaleReadableMetric(28, 0.8), 28);
});

test('authored line boxes stay fixed while missing line heights get a safe fallback', () => {
  assert.equal(scaleReadableLineHeight(17, 20, 1), 20);
  assert.equal(scaleReadableLineHeight(17, 20, 2), 20);
  assert.equal(scaleReadableLineHeight(17, 28, 1.2), 28);
  assert.equal(scaleReadableLineHeight(17, undefined, 2), 17 * MIN_READABLE_LINE_HEIGHT_RATIO);
});
