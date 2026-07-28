import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldClearBlurredRichTextEditor } from '@/components/shared/rich-text/rich-text-toolbar-state';

test('a blurred rich editor clears while a normal input keeps the keyboard open', () => {
  assert.equal(shouldClearBlurredRichTextEditor({
    keyboardVisible: true,
    keyboardClosing: false,
  }), true);
});

test('a blurred rich toolbar stays mounted through keyboard dismissal motion', () => {
  assert.equal(shouldClearBlurredRichTextEditor({
    keyboardVisible: true,
    keyboardClosing: true,
  }), false);
});

test('a blurred rich toolbar clears after keyboardDidHide', () => {
  assert.equal(shouldClearBlurredRichTextEditor({
    keyboardVisible: false,
    keyboardClosing: true,
  }), true);
});
