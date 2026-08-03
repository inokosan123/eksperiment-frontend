import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ScriptureChallengeReaderView from '@/components/scripture/ScriptureChallengeReaderView';
import { saveScriptureChallengeSessionProgress } from '@/components/challenges/challengeDb';
import { useChallenges } from '@/components/challenges/ChallengesContext';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import {
  RoutedTaskCompletionErrorModal,
  useRoutedTaskCompletion,
} from '@/components/tasks/use-routed-task-completion';

export default function ScriptureChallengeScreen() {
  const router = useRouter();
  const { refreshChallenges } = useChallenges();
  const { title, taskInstanceId, taskDate } = useLocalSearchParams<{
    title?: string;
    taskInstanceId?: string;
    taskDate?: string;
  }>();
  const instanceId = taskInstanceId ?? '';
  const date = taskDate ?? getLocalDateKey();
  const completion = useRoutedTaskCompletion({
    taskInstanceId: instanceId || undefined,
    taskDate: date,
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScriptureChallengeReaderView
        title={title}
        taskInstanceId={instanceId}
        showFinishLoader={completion.showSlowIndicator}
        onBack={() => router.back()}
        onComplete={async readUnits => {
          if (!instanceId) return false;
          const result = await completion.completeBeforeReturn({
            persistCritical: () => saveScriptureChallengeSessionProgress(instanceId, readUnits),
            reconcileAfterReturn: refreshChallenges,
          });
          return result.ok ? result.value : false;
        }}
      />
      <RoutedTaskCompletionErrorModal
        visible={completion.saveErrorVisible}
        onKeepEditing={completion.keepEditing}
        onRetry={completion.retry}
      />
    </>
  );
}
