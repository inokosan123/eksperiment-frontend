import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_ORTHODOX_CATEGORY,
  getPrayerPreviewBlocks,
  PRAYER_PREVIEW_MAX_BLOCKS,
} from '../components/prayer/prayerPreviewModel';
import type { PrayerBlock } from '../data/prayers/prayerCatalog';

function blocks(types: PrayerBlock['type'][]): PrayerBlock[] {
  return types.map((type, index) => ({ type, content: `${type}-${index}` }));
}

test('Orthodox Prayer Book opens on the Jesus Prayer by default', () => {
  assert.equal(DEFAULT_ORTHODOX_CATEGORY, 'jesus');
});

test('short prayers stay intact', () => {
  const prayer = blocks(['instruction', 'text', 'text']);
  assert.strictEqual(getPrayerPreviewBlocks(prayer), prayer);
});

test('long previews never mount more than eight native text blocks', () => {
  const prayer = blocks(Array.from({ length: 148 }, () => 'text'));
  assert.equal(getPrayerPreviewBlocks(prayer).length, 6);
  assert.ok(getPrayerPreviewBlocks(prayer).length <= PRAYER_PREVIEW_MAX_BLOCKS);
});

test('an opening excerpt does not stop on a rubric when its prayer follows', () => {
  const prayer = blocks([
    'instruction',
    'text',
    'instruction',
    'text',
    'text',
    'instruction',
    'text',
    'text',
    'title',
  ]);
  const preview = getPrayerPreviewBlocks(prayer);

  assert.equal(preview.length, 7);
  assert.equal(preview.at(-1)?.type, 'text');
});
