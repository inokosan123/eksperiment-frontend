import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ScriptureCheckpointReaderView from '@/components/scripture/ScriptureCheckpointReaderView';
import {
  saveScriptureCheckpointProgress,
  type ScriptureCheckpointKind,
} from '@/components/scripture/scriptureCheckpointDb';
import { useTasks } from '@/components/tasks/TaskProvider';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import { queueTaskCompletionReturnAnimation } from '@/components/tasks/taskReturnAnimation';

export default function ScriptureCheckpointScreen() {
  const router = useRouter();
  const { completeInstance } = useTasks();
  const {
    title,
    readingType,
    plannedCount,
    taskInstanceId,
    taskDate,
  } = useLocalSearchParams<{
    title?: string;
    readingType?: string;
    plannedCount?: string;
    taskInstanceId?: string;
    taskDate?: string;
  }>();
  const instanceId = taskInstanceId ?? '';
  const date = taskDate ?? getLocalDateKey();
  const count = Number.parseInt(plannedCount ?? '1', 10) || 1;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScriptureCheckpointReaderView
        title={title}
        readingType={readingType ?? 'custom'}
        plannedCount={count}
        taskInstanceId={instanceId}
        onBack={() => router.back()}
        onComplete={async (kind: ScriptureCheckpointKind, readUnits: number) => {
          const result = await saveScriptureCheckpointProgress({
            kind,
            readUnits,
            taskInstanceId: instanceId || undefined,
            date,
          });
          if (instanceId) {
            await completeInstance(instanceId, date);
            queueTaskCompletionReturnAnimation(instanceId, 440);
          }
          return result;
        }}
      />
    </>
  );
}
