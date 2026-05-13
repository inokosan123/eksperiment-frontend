import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import JesusPrayerTaskView from '@/components/prayer/JesusPrayerTaskView';
import { useTasks } from '@/components/tasks/TaskProvider';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import { queueTaskCompletionReturnAnimation } from '@/components/tasks/taskReturnAnimation';

function numberParam(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default function JesusPrayerScreen() {
  const router = useRouter();
  const { completeInstance } = useTasks();
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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <JesusPrayerTaskView
        title={title}
        mode={mode}
        durationMinutes={numberParam(duration, 15)}
        targetCount={numberParam(count, 100)}
        isTask={isTask === 'true'}
        onBack={() => router.back()}
        onComplete={async () => {
          if (taskInstanceId) {
            await completeInstance(taskInstanceId, taskDate ?? getLocalDateKey());
            queueTaskCompletionReturnAnimation(taskInstanceId, 300);
          }
        }}
      />
    </>
  );
}
