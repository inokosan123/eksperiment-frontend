import { useMemo } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ScriptureCheckpointReaderView from '@/components/scripture/ScriptureCheckpointReaderView';
import {
  saveScriptureCheckpointProgress,
  type ScriptureCheckpointKind,
} from '@/components/scripture/scriptureCheckpointDb';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import {
  RoutedTaskCompletionErrorModal,
  useRoutedTaskCompletion,
} from '@/components/tasks/use-routed-task-completion';

type RouteParam = string | string[] | undefined;

function firstParam(value: RouteParam) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePlannedCount(value: RouteParam) {
  const parsed = Number.parseInt(firstParam(value) ?? '1', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.round(parsed);
}

export default function ScriptureCheckpointScreen() {
  const router = useRouter();
  const {
    title,
    plannedCount,
    taskInstanceId,
    taskDate,
  } = useLocalSearchParams<{
    title?: RouteParam;
    plannedCount?: RouteParam;
    taskInstanceId?: RouteParam;
    taskDate?: RouteParam;
  }>();
  const instanceId = firstParam(taskInstanceId) ?? '';
  const date = firstParam(taskDate) ?? getLocalDateKey();
  const routeCount = useMemo(() => parsePlannedCount(plannedCount), [plannedCount]);
  const completion = useRoutedTaskCompletion({
    taskInstanceId: instanceId || undefined,
    taskDate: date,
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScriptureCheckpointReaderView
        title={firstParam(title)}
        plannedCount={routeCount}
        taskInstanceId={instanceId}
        showFinishLoader={completion.showSlowIndicator}
        onBack={() => router.back()}
        onComplete={async (checkpointId: string, kind: ScriptureCheckpointKind, readUnits: number) => {
          const result = await completion.completeBeforeReturn({
            persistCritical: () => saveScriptureCheckpointProgress({
              checkpointId,
              kind,
              readUnits,
              taskInstanceId: instanceId || undefined,
              date,
            }),
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
