export type QueuedCompletionAnimation = {
  instanceId: string;
  delayMs: number;
  celebration?: {
    type: 'challengeComplete';
    title?: string;
  };
};

const queuedCompletionAnimations = new Map<string, QueuedCompletionAnimation>();
const MIN_HOME_RETURN_ANIMATION_DELAY_MS = 680;

export function queueTaskCompletionReturnAnimation(
  instanceId: string | undefined,
  delayMs = MIN_HOME_RETURN_ANIMATION_DELAY_MS,
  options?: Pick<QueuedCompletionAnimation, 'celebration'>,
) {
  if (!instanceId) return;
  queuedCompletionAnimations.set(instanceId, {
    instanceId,
    delayMs: Math.max(delayMs, MIN_HOME_RETURN_ANIMATION_DELAY_MS),
    celebration: options?.celebration,
  });
}

export function consumeTaskCompletionReturnAnimations() {
  const queued = [...queuedCompletionAnimations.values()];
  queuedCompletionAnimations.clear();
  return queued;
}
