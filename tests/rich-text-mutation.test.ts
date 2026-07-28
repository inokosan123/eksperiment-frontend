import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  consumeExpectedRichTextPlainTextEcho,
  enqueueExpectedRichTextPlainTextEcho,
  isExpectedRichTextPlainTextEcho,
  MAX_PENDING_RICH_TEXT_ECHOES,
  runRichTextMutation,
} from '@/components/shared/rich-text/rich-text-mutation';

test('a formatting-only mutation marks the editor dirty after the command runs', () => {
  const calls: string[] = [];

  runRichTextMutation(
    () => calls.push('mutate'),
    () => calls.push('dirty'),
  );

  assert.deepEqual(calls, ['mutate', 'dirty']);
});

test('a failed native formatting command does not report a changed draft', () => {
  let dirtyCalls = 0;

  assert.throws(() => {
    runRichTextMutation(
      () => {
        throw new Error('native command failed');
      },
      () => {
        dirtyCalls += 1;
      },
    );
  }, /native command failed/);

  assert.equal(dirtyCalls, 0);
});

test('an empty programmatic hydration echo is consumed instead of marked dirty', () => {
  assert.equal(isExpectedRichTextPlainTextEcho('', ''), true);
  assert.equal(isExpectedRichTextPlainTextEcho(null, ''), false);
});

test('a real text change is not mistaken for the pending hydration echo', () => {
  assert.equal(isExpectedRichTextPlainTextEcho('Grace', 'Grace today'), false);
  assert.equal(isExpectedRichTextPlainTextEcho('Grace', 'Grace'), true);
});

test('rapid programmatic hydration echoes are consumed in bridge order', () => {
  let pending = [''];
  pending = enqueueExpectedRichTextPlainTextEcho(pending, 'Grace');
  pending = enqueueExpectedRichTextPlainTextEcho(pending, 'Grace and peace');

  const initialEcho = consumeExpectedRichTextPlainTextEcho(pending, '');
  assert.equal(initialEcho.matched, true);
  assert.deepEqual(initialEcho.remaining, ['Grace', 'Grace and peace']);

  const secondEcho = consumeExpectedRichTextPlainTextEcho(
    initialEcho.remaining,
    'Grace and peace',
  );
  assert.equal(secondEcho.matched, true);
  assert.deepEqual(secondEcho.remaining, []);
});

test('a real edit invalidates stale programmatic echoes', () => {
  const result = consumeExpectedRichTextPlainTextEcho(
    ['Grace', 'Grace and peace'],
    'Grace today',
  );

  assert.equal(result.matched, false);
  assert.deepEqual(result.remaining, []);
});

test('the pending hydration echo queue stays bounded', () => {
  let pending: string[] = [];
  for (let index = 0; index < MAX_PENDING_RICH_TEXT_ECHOES + 3; index += 1) {
    pending = enqueueExpectedRichTextPlainTextEcho(pending, `value-${index}`);
  }

  assert.equal(pending.length, MAX_PENDING_RICH_TEXT_ECHOES);
  assert.equal(pending[0], 'value-3');
});
