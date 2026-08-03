import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import JesusPrayerTaskView from '@/components/prayer/JesusPrayerTaskView';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import {
  RoutedTaskCompletionErrorModal,
  useRoutedTaskCompletion,
} from '@/components/tasks/use-routed-task-completion';

function numberParam(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default function JesusPrayerScreen() {
  const router = useRouter();
  const {
    title,
    mode,
    duration,
    count,
    isTask,
    taskInstanceId,
    taskDate,
  } = useLocalSearchParams<{
    title?: string;
    mode?: string;
    duration?: string;
    count?: string;
    isTask?: string;
    taskInstanceId?: string;
    taskDate?: string;
  }>();
  const completion = useRoutedTaskCompletion({
    taskInstanceId,
    taskDate: taskDate ?? getLocalDateKey(),
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <JesusPrayerTaskView
        title={title}
        mode={mode}
        durationMinutes={numberParam(duration, 15)}
        targetCount={numberParam(count, 100)}
        isTask={isTask === 'true'}
        showFinishLoader={completion.showSlowIndicator}
        onBack={() => router.back()}
        onComplete={async () => {
          if (!taskInstanceId) return true;
          const result = await completion.completeBeforeReturn({});
          return result.ok;
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
