import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createJournalWriteCoordinator } from '@/components/journal/journal-write-coordinator';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

type Entry = { text: string };

describe('journal write coordinator', () => {
  test('a slow stale result cannot replace the newest persisted revision', async () => {
    const firstWrite = deferred<Entry>();
    const persisted: Entry[] = [];
    const latestRevisions = new Map([['2026-07-27', 1]]);
    const committed: { revision: number; saved: Entry; celebrate: boolean }[] = [];

    const coordinator = createJournalWriteCoordinator<Entry, Entry>({
      persist: async entry => {
        persisted.push(entry);
        if (entry.text === 'first') return firstWrite.promise;
        return { text: `saved:${entry.text}` };
      },
      isLatestRevision: (date, revision) => latestRevisions.get(date) === revision,
      onLatestPersisted: (_date, request, saved) => {
        committed.push({
          revision: request.revision,
          saved,
          celebrate: request.queueCompletionCelebration,
        });
      },
    });

    const first = coordinator.enqueue('2026-07-27', {
      entry: { text: 'first' },
      revision: 1,
      queueCompletionCelebration: false,
    });

    latestRevisions.set('2026-07-27', 2);
    const second = coordinator.enqueue('2026-07-27', {
      entry: { text: 'second' },
      revision: 2,
      queueCompletionCelebration: true,
    });

    latestRevisions.set('2026-07-27', 3);
    const third = coordinator.enqueue('2026-07-27', {
      entry: { text: 'third' },
      revision: 3,
      queueCompletionCelebration: false,
    });

    firstWrite.resolve({ text: 'saved:first' });

    assert.deepEqual(await first, { text: 'saved:first' });
    assert.deepEqual(await second, { text: 'saved:third' });
    assert.deepEqual(await third, { text: 'saved:third' });
    await coordinator.whenIdle('2026-07-27');

    assert.deepEqual(persisted, [{ text: 'first' }, { text: 'third' }]);
    assert.deepEqual(committed, [{
      revision: 3,
      saved: { text: 'saved:third' },
      celebrate: true,
    }]);
  });

  test('a failed write rejects its caller but does not block the newest draft', async () => {
    const firstWrite = deferred<Entry>();
    const latestRevisions = new Map([['2026-07-27', 1]]);
    const committed: number[] = [];

    const coordinator = createJournalWriteCoordinator<Entry, Entry>({
      persist: entry => entry.text === 'first'
        ? firstWrite.promise
        : Promise.resolve({ text: `saved:${entry.text}` }),
      isLatestRevision: (date, revision) => latestRevisions.get(date) === revision,
      onLatestPersisted: (_date, request) => committed.push(request.revision),
    });

    const first = coordinator.enqueue('2026-07-27', {
      entry: { text: 'first' },
      revision: 1,
      queueCompletionCelebration: false,
    });
    latestRevisions.set('2026-07-27', 2);
    const second = coordinator.enqueue('2026-07-27', {
      entry: { text: 'second' },
      revision: 2,
      queueCompletionCelebration: false,
    });

    firstWrite.reject(new Error('Injected database failure'));

    await assert.rejects(first, /Injected database failure/);
    assert.deepEqual(await second, { text: 'saved:second' });
    assert.deepEqual(committed, [2]);
  });
});
