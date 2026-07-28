import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RichTextFlushTimeoutError,
  withRichTextFlushTimeout,
} from '../components/shared/rich-text/rich-text-flush';

test('returns a native flush result before the deadline', async () => {
  const html = await withRichTextFlushTimeout(
    'daily:2026-07-27:prompt-1',
    Promise.resolve('<p>Saved</p>'),
    25,
  );

  assert.equal(html, '<p>Saved</p>');
});

test('preserves the original native failure', async () => {
  const failure = new Error('Native bridge failed');

  await assert.rejects(
    withRichTextFlushTimeout('daily:2026-07-27:prompt-1', Promise.reject(failure), 25),
    error => error === failure,
  );
});

test('rejects a lost native promise with the editor id', async () => {
  const never = new Promise<string>(() => {});

  await assert.rejects(
    withRichTextFlushTimeout('daily:2026-07-27:free-writing', never, 5),
    error => (
      error instanceof RichTextFlushTimeoutError
      && error.editorId === 'daily:2026-07-27:free-writing'
    ),
  );
});
