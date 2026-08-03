const CHALLENGE_TASK_PREFIX = 'challenge_task_';

export function challengeIdFromTaskId(taskId: string) {
  if (!taskId.startsWith(CHALLENGE_TASK_PREFIX)) return null;
  const challengeId = taskId.slice(CHALLENGE_TASK_PREFIX.length);
  return challengeId || null;
}
