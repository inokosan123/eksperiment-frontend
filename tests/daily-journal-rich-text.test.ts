import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  captureDailyJournalSaveSnapshot,
  dailyFreeWritingEditorId,
  dailyPromptEditorId,
  mergeDailyRichTextDraft,
  settleDailyJournalDraft,
} from '@/components/journal/daily-journal-rich-text';

describe('Daily Journal native rich-text draft mapping', () => {
  test('uses stable date and prompt IDs instead of array positions', () => {
    const date = '2026-07-27';
    const prompts = [
      { id: 'second', q: 'Second?', a: '<p>Old second</p>' },
      { id: 'first', q: 'First?', a: '<p>Old first</p>' },
    ];
    const merged = mergeDailyRichTextDraft({
      date,
      prompts,
      freeWriting: '<p>Old free</p>',
      htmlByEditorId: {
        [dailyPromptEditorId(date, 'first')]: '<p>New first</p>',
        [dailyPromptEditorId(date, 'second')]: '<p>New second</p>',
        [dailyFreeWritingEditorId(date)]: '<p>New free</p>',
      },
    });

    assert.deepEqual(merged.prompts.map(prompt => [prompt.id, prompt.a]), [
      ['second', '<p>New second</p>'],
      ['first', '<p>New first</p>'],
    ]);
    assert.equal(merged.freeWriting, '<p>New free</p>');
  });

  test('preserves untouched state and ignores removed editor IDs', () => {
    const date = '2026-07-27';
    const prompt = { id: 'kept', q: 'Kept?', a: '<p>Keep me</p>' };
    const merged = mergeDailyRichTextDraft({
      date,
      prompts: [prompt],
      freeWriting: '<p>Keep free</p>',
      htmlByEditorId: {
        [dailyPromptEditorId(date, 'deleted')]: '<p>Must not return</p>',
      },
    });

    assert.equal(merged.prompts[0], prompt);
    assert.equal(merged.freeWriting, '<p>Keep free</p>');
    assert.equal(merged.prompts.some(item => item.id === 'deleted'), false);
  });

  test('does not leak HTML between dates', () => {
    const merged = mergeDailyRichTextDraft({
      date: '2026-07-28',
      prompts: [{ id: 'same-id', q: 'Question?', a: '<p>Tuesday</p>' }],
      freeWriting: '',
      htmlByEditorId: {
        [dailyPromptEditorId('2026-07-27', 'same-id')]: '<p>Monday</p>',
      },
    });

    assert.equal(merged.prompts[0].a, '<p>Tuesday</p>');
  });

  test('an input arriving during native flush remains a newer revision', async () => {
    let revision = 4;
    let releaseFlush: (() => void) | undefined;
    const flushGate = new Promise<void>(resolve => {
      releaseFlush = resolve;
    });

    const snapshotPromise = captureDailyJournalSaveSnapshot(
      () => revision,
      async () => {
        await flushGate;
        return { freeWritingHtml: '<p>Snapshot at revision four</p>' };
      },
    );

    revision = 5;
    releaseFlush?.();
    const snapshot = await snapshotPromise;

    assert.equal(snapshot.revision, 4);
    assert.equal(revision, 5);
    assert.equal(snapshot.patch.freeWritingHtml, '<p>Snapshot at revision four</p>');
  });

  test('a terminal boundary retries when the first save leaves a newer revision dirty', async () => {
    let dirty = true;
    let saves = 0;

    const attempts = await settleDailyJournalDraft({
      isDirty: () => dirty,
      saveOnce: async () => {
        saves += 1;
        if (saves === 2) dirty = false;
      },
      label: 'Daily Journal test boundary',
    });

    assert.equal(attempts, 2);
    assert.equal(saves, 2);
    assert.equal(dirty, false);
  });

  test('a terminal boundary fails closed instead of navigating with a dirty draft', async () => {
    await assert.rejects(
      settleDailyJournalDraft({
        isDirty: () => true,
        saveOnce: async () => {},
        maxAttempts: 2,
        label: 'Daily Journal test boundary',
      }),
      /still dirty after 2 save attempts/,
    );
  });
});
