import { HOME_RETURN_CHECK_DELAY_MS } from './taskCompletionTimeline';

export type QueuedCompletionAnimation = {
  instanceId: string;
  taskDate?: string;
  delayMs: number;
  queuedAt: number;
  state?: 'committing' | 'ready' | 'returnSettled';
  settledAt?: number;
  updated?: boolean;
  source?: 'home' | 'routed' | 'external';
  feedbackPlayedAt?: number;
  celebration?: {
    type: 'challengeComplete';
    title?: string;
    variant?: 'challenge' | 'churchWeek';
    trophyCount?: number;
    currentStreak?: number;
    eventId?: string;
    challengeId?: string;
    weekStart?: string;
  };
};

const queuedCompletionAnimations = new Map<string, QueuedCompletionAnimation>();
const completionListeners = new Set<() => void>();

const completionStateRank = {
  committing: 0,
  ready: 1,
  returnSettled: 2,
} as const;

function latestCompletionState(
  left: QueuedCompletionAnimation['state'],
  right: QueuedCompletionAnimation['state'],
) {
  if (!left) return right;
  if (!right) return left;
  return completionStateRank[left] >= completionStateRank[right] ? left : right;
}

function emitCompletionChange() {
  for (const listener of completionListeners) listener();
}

export function subscribeTaskCompletionReturns(listener: () => void) {
  completionListeners.add(listener);
  return () => {
    completionListeners.delete(listener);
  };
}

export function beginTaskCompletionReturn(
  instanceId: string | undefined,
  taskDate?: string,
) {
  if (!instanceId) return;
  const existing = queuedCompletionAnimations.get(instanceId);
  queuedCompletionAnimations.set(instanceId, {
    instanceId,
    taskDate: taskDate ?? existing?.taskDate,
    delayMs: existing?.delayMs ?? HOME_RETURN_CHECK_DELAY_MS,
    queuedAt: existing?.queuedAt ?? Date.now(),
    state: 'committing',
    source: 'routed',
    feedbackPlayedAt: existing?.feedbackPlayedAt,
    celebration: existing?.celebration,
  });
  emitCompletionChange();
}

export function queueTaskCompletionReturnAnimation(
  instanceId: string | undefined,
  delayMs = HOME_RETURN_CHECK_DELAY_MS,
  options?: Pick<
    QueuedCompletionAnimation,
    'celebration' | 'source' | 'feedbackPlayedAt' | 'taskDate' | 'updated'
  >,
) {
  if (!instanceId) return;
  const existing = queuedCompletionAnimations.get(instanceId);
  const feedbackPlayedAt = options?.feedbackPlayedAt ?? existing?.feedbackPlayedAt;
  queuedCompletionAnimations.set(instanceId, {
    instanceId,
    taskDate: options?.taskDate ?? existing?.taskDate,
    queuedAt: existing?.queuedAt ?? Date.now(),
    // Direct Home checks have already landed visually and therefore do not
    // need the ordinary return delay. Routed/external completions retain a
    // short floor so Home never checks underneath a closing native screen.
    delayMs: Math.max(
      delayMs,
      existing?.delayMs ?? 0,
      feedbackPlayedAt ? 0 : HOME_RETURN_CHECK_DELAY_MS,
    ),
    source: options?.source ?? existing?.source,
    state: options?.source === 'home'
      || options?.source === 'external'
      || existing?.state === 'returnSettled'
      ? 'returnSettled'
      : 'ready',
    settledAt: options?.source === 'home' || options?.source === 'external'
      ? Date.now()
      : existing?.settledAt,
    updated: options?.updated ?? existing?.updated,
    feedbackPlayedAt,
    // Task-specific screens enqueue their ordinary return animation after the
    // TaskProvider has discovered a challenge win. Preserve that earlier,
    // more important metadata instead of silently replacing it with undefined.
    celebration: options?.celebration ?? existing?.celebration,
  });
  emitCompletionChange();
}

export function markTaskCompletionReturnSettled(instanceId: string | undefined) {
  if (!instanceId) return;
  const existing = queuedCompletionAnimations.get(instanceId);
  if (!existing || existing.state === 'committing') return;
  queuedCompletionAnimations.set(instanceId, {
    ...existing,
    state: 'returnSettled',
    settledAt: existing.settledAt ?? Date.now(),
  });
  emitCompletionChange();
}

export function peekTaskCompletionReturnAnimations() {
  return [...queuedCompletionAnimations.values()];
}

export function consumeSettledTaskCompletionReturnAnimations() {
  const settled: QueuedCompletionAnimation[] = [];
  for (const [instanceId, item] of queuedCompletionAnimations) {
    if (item.state !== 'returnSettled') continue;
    settled.push(item);
    queuedCompletionAnimations.delete(instanceId);
  }
  return settled;
}

export function requeueTaskCompletionReturnAnimations(items: QueuedCompletionAnimation[]) {
  for (const item of items) {
    const existing = queuedCompletionAnimations.get(item.instanceId);
    queuedCompletionAnimations.set(item.instanceId, existing ? {
      ...item,
      delayMs: Math.max(item.delayMs, existing.delayMs),
      queuedAt: Math.min(item.queuedAt, existing.queuedAt),
      source: existing.source ?? item.source,
      feedbackPlayedAt: existing.feedbackPlayedAt ?? item.feedbackPlayedAt,
      celebration: existing.celebration ?? item.celebration,
      state: latestCompletionState(existing.state, item.state),
      settledAt: existing.settledAt ?? item.settledAt,
      taskDate: existing.taskDate ?? item.taskDate,
      updated: existing.updated ?? item.updated,
    } : item);
  }
  emitCompletionChange();
}

export function clearTaskCompletionReturnAnimation(instanceId: string | undefined) {
  if (!instanceId) return;
  queuedCompletionAnimations.delete(instanceId);
  emitCompletionChange();
}

export function consumeTaskCompletionReturnAnimations() {
  const queued = [...queuedCompletionAnimations.values()];
  queuedCompletionAnimations.clear();
  return queued;
}
