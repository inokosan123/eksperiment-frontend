type QueuedCompletionAnimation = {
  instanceId: string;
  delayMs: number;
};

const queuedCompletionAnimations = new Map<string, QueuedCompletionAnimation>();

export function queueTaskCompletionReturnAnimation(instanceId: string | undefined, delayMs = 300) {
  if (!instanceId) return;
  queuedCompletionAnimations.set(instanceId, { instanceId, delayMs });
}

export function consumeTaskCompletionReturnAnimations() {
  const queued = [...queuedCompletionAnimations.values()];
  queuedCompletionAnimations.clear();
  return queued;
}
