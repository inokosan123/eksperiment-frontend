export type LatestByKeyQueueOptions<Key, Value, Result> = {
  worker: (key: Key, value: Value) => Promise<Result>;
  mergePending?: (previous: Value, next: Value) => Value;
};

type Waiter<Result> = {
  resolve: (value: Result) => void;
  reject: (error: unknown) => void;
};

type Batch<Value, Result> = {
  value: Value;
  waiters: Waiter<Result>[];
};

type QueueState<Value, Result> = {
  pending: Batch<Value, Result> | null;
  idleWaiters: (() => void)[];
};

export type LatestByKeyQueue<Key, Value, Result> = {
  enqueue: (key: Key, value: Value) => Promise<Result>;
  isBusy: (key: Key) => boolean;
  depth: (key: Key) => number;
  whenIdle: (key: Key) => Promise<void>;
};

/**
 * Serializes async work per key while coalescing work that has not started yet.
 *
 * The in-flight value is never cancelled. If more values arrive while it is
 * running, only the latest merged value is sent to the worker next. Every
 * caller waiting on that pending batch resolves with the result that actually
 * persisted. Different keys remain independent and may run concurrently.
 */
export function createLatestByKeyQueue<Key, Value, Result>({
  worker,
  mergePending = (_previous, next) => next,
}: LatestByKeyQueueOptions<Key, Value, Result>): LatestByKeyQueue<Key, Value, Result> {
  const states = new Map<Key, QueueState<Value, Result>>();

  const drain = async (
    key: Key,
    state: QueueState<Value, Result>,
    initialBatch: Batch<Value, Result>,
  ) => {
    let batch: Batch<Value, Result> | null = initialBatch;

    while (batch) {
      try {
        const result = await worker(key, batch.value);
        batch.waiters.forEach(waiter => waiter.resolve(result));
      } catch (error) {
        batch.waiters.forEach(waiter => waiter.reject(error));
      }

      batch = state.pending;
      state.pending = null;
    }

    states.delete(key);
    state.idleWaiters.forEach(resolve => resolve());
  };

  const enqueue = (key: Key, value: Value) => new Promise<Result>((resolve, reject) => {
    const waiter = { resolve, reject };
    const state = states.get(key);

    if (!state) {
      const nextState: QueueState<Value, Result> = {
        pending: null,
        idleWaiters: [],
      };
      states.set(key, nextState);
      void drain(key, nextState, { value, waiters: [waiter] });
      return;
    }

    if (state.pending) {
      state.pending.value = mergePending(state.pending.value, value);
      state.pending.waiters.push(waiter);
      return;
    }

    state.pending = { value, waiters: [waiter] };
  });

  return {
    enqueue,
    isBusy: key => states.has(key),
    depth: key => {
      const state = states.get(key);
      if (!state) return 0;
      return 1 + (state.pending ? 1 : 0);
    },
    whenIdle: key => {
      const state = states.get(key);
      if (!state) return Promise.resolve();
      return new Promise(resolve => state.idleWaiters.push(resolve));
    },
  };
}
