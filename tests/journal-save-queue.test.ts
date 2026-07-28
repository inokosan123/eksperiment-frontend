import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createLatestByKeyQueue } from '@/components/journal/journal-save-queue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('latest-by-key journal save queue', () => {
  test('serializes writes for one date and coalesces values that have not started', async () => {
    const firstWrite = deferred<string>();
    const calls: string[] = [];
    let concurrent = 0;
    let maxConcurrent = 0;

    const queue = createLatestByKeyQueue<string, string, string>({
      worker: async (_date, value) => {
        calls.push(value);
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        try {
          if (value === 'first') return await firstWrite.promise;
          return `saved:${value}`;
        } finally {
          concurrent -= 1;
        }
      },
    });

    const first = queue.enqueue('2026-07-27', 'first');
    assert.equal(queue.depth('2026-07-27'), 1);
    const second = queue.enqueue('2026-07-27', 'second');
    const third = queue.enqueue('2026-07-27', 'third');
    assert.equal(queue.depth('2026-07-27'), 2);

    await Promise.resolve();
    assert.deepEqual(calls, ['first']);
    assert.equal(queue.isBusy('2026-07-27'), true);

    firstWrite.resolve('saved:first');

    assert.equal(await first, 'saved:first');
    assert.equal(await second, 'saved:third');
    assert.equal(await third, 'saved:third');
    await queue.whenIdle('2026-07-27');

    assert.deepEqual(calls, ['first', 'third']);
    assert.equal(maxConcurrent, 1);
    assert.equal(queue.isBusy('2026-07-27'), false);
    assert.equal(queue.depth('2026-07-27'), 0);
  });

  test('merges pending metadata while keeping the newest snapshot', async () => {
    const firstWrite = deferred<number>();
    const calls: { revision: number; celebrate: boolean }[] = [];
    const queue = createLatestByKeyQueue<
      string,
      { revision: number; celebrate: boolean },
      number
    >({
      mergePending: (previous, next) => ({
        ...next,
        celebrate: previous.celebrate || next.celebrate,
      }),
      worker: async (_date, value) => {
        calls.push(value);
        if (value.revision === 1) return firstWrite.promise;
        return value.revision;
      },
    });

    const first = queue.enqueue('2026-07-27', { revision: 1, celebrate: false });
    const second = queue.enqueue('2026-07-27', { revision: 2, celebrate: true });
    const third = queue.enqueue('2026-07-27', { revision: 3, celebrate: false });

    firstWrite.resolve(1);
    await Promise.all([first, second, third]);

    assert.deepEqual(calls, [
      { revision: 1, celebrate: false },
      { revision: 3, celebrate: true },
    ]);
  });

  test('a failed write does not prevent the newest queued write from running', async () => {
    const firstWrite = deferred<string>();
    const calls: string[] = [];
    const queue = createLatestByKeyQueue<string, string, string>({
      worker: async (_date, value) => {
        calls.push(value);
        if (value === 'first') return firstWrite.promise;
        return `saved:${value}`;
      },
    });

    const first = queue.enqueue('2026-07-27', 'first');
    const second = queue.enqueue('2026-07-27', 'second');
    firstWrite.reject(new Error('disk unavailable'));

    await assert.rejects(first, /disk unavailable/);
    assert.equal(await second, 'saved:second');
    assert.deepEqual(calls, ['first', 'second']);
  });

  test('different dates can persist independently', async () => {
    const mondayWrite = deferred<string>();
    const calls: string[] = [];
    const queue = createLatestByKeyQueue<string, string, string>({
      worker: async (date, value) => {
        calls.push(`${date}:${value}`);
        if (date === '2026-07-27') return mondayWrite.promise;
        return `saved:${value}`;
      },
    });

    const monday = queue.enqueue('2026-07-27', 'monday');
    const tuesday = queue.enqueue('2026-07-28', 'tuesday');

    assert.equal(await tuesday, 'saved:tuesday');
    assert.equal(queue.isBusy('2026-07-27'), true);
    mondayWrite.resolve('saved:monday');
    assert.equal(await monday, 'saved:monday');
    assert.deepEqual(calls, [
      '2026-07-27:monday',
      '2026-07-28:tuesday',
    ]);
  });
});
