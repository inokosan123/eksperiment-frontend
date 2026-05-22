import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ScriptureChallengeReaderView from '@/components/scripture/ScriptureChallengeReaderView';
import { saveScriptureChallengeSessionProgress } from '@/components/challenges/challengeDb';
import { useChallenges } from '@/components/challenges/ChallengesContext';
import { useTasks } from '@/components/tasks/TaskProvider';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import { queueTaskCompletionReturnAnimation } from '@/components/tasks/taskReturnAnimation';

export default function ScriptureChallengeScreen() {
  const router = useRouter();
  const { completeInstance } = useTasks();
  const { refreshChallenges } = useChallenges();
  const { title, taskInstanceId, taskDate } = useLocalSearchParams<{
    title?: string;
    taskInstanceId?: string;
    taskDate?: string;
  }>();
  const instanceId = taskInstanceId ?? '';
  const date = taskDate ?? getLocalDateKey();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScriptureChallengeReaderView
        title={title}
        taskInstanceId={instanceId}
        onBack={() => router.back()}
        onComplete={async readUnits => {
          if (!instanceId) return null;
          const result = await saveScriptureChallengeSessionProgress(instanceId, readUnits);
          await completeInstance(instanceId, date);
          await refreshChallenges();
          queueTaskCompletionReturnAnimation(
            instanceId,
            result?.completed ? 680 : 420,
            result?.completed
              ? {
                celebration: {
                  type: 'challengeComplete',
                  title: title ?? 'Challenge Complete',
                },
              }
              : undefined,
          );
          return result;
        }}
      />
    </>
  );
}
