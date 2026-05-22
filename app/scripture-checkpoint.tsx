import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ScriptureCheckpointReaderView from '@/components/scripture/ScriptureCheckpointReaderView';
import {
  saveScriptureCheckpointProgress,
  type ScriptureCheckpointKind,
} from '@/components/scripture/scriptureCheckpointDb';
import { getScriptureTaskConfig } from '@/components/tasks/taskDb';
import { useTasks } from '@/components/tasks/TaskProvider';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import { queueTaskCompletionReturnAnimation } from '@/components/tasks/taskReturnAnimation';

type RouteParam = string | string[] | undefined;

function firstParam(value: RouteParam) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePlannedCount(value: RouteParam) {
  const parsed = Number.parseInt(firstParam(value) ?? '1', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.round(parsed);
}

function positivePlannedCount(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round(parsed);
}

function taskIdFromInstanceId(instanceId: string) {
  const match = instanceId.match(/^(.*)_(\d{4}-\d{2}-\d{2})$/);
  return match?.[1];
}

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
    title?: RouteParam;
    readingType?: RouteParam;
    plannedCount?: RouteParam;
    taskInstanceId?: RouteParam;
    taskDate?: RouteParam;
  }>();
  const instanceId = firstParam(taskInstanceId) ?? '';
  const date = firstParam(taskDate) ?? getLocalDateKey();
  const routeCount = useMemo(() => parsePlannedCount(plannedCount), [plannedCount]);
  const routeReadingType = firstParam(readingType) ?? 'custom';
  const [resolvedCount, setResolvedCount] = useState(routeCount);
  const [resolvedReadingType, setResolvedReadingType] = useState(routeReadingType);
  const [configReady, setConfigReady] = useState(!instanceId);

  useEffect(() => {
    const taskId = taskIdFromInstanceId(instanceId);
    let active = true;

    setResolvedCount(routeCount);
    setResolvedReadingType(routeReadingType);

    if (!taskId) {
      setConfigReady(true);
      return () => {
        active = false;
      };
    }

    setConfigReady(false);
    getScriptureTaskConfig(taskId)
      .then(config => {
        if (!active) return;
        setResolvedCount(positivePlannedCount(config?.chaptersPerDay) ?? routeCount);
        setResolvedReadingType(config?.readingType ?? routeReadingType);
      })
      .catch(error => {
        console.warn('Failed to load scripture task config for checkpoint route', error);
      })
      .finally(() => {
        if (active) setConfigReady(true);
      });

    return () => {
      active = false;
    };
  }, [instanceId, routeCount, routeReadingType]);

  if (!configReady) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FCFCFC' }}>
          <ActivityIndicator color="#C5A059" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScriptureCheckpointReaderView
        title={firstParam(title)}
        readingType={resolvedReadingType}
        plannedCount={resolvedCount}
        taskInstanceId={instanceId}
        onBack={() => router.back()}
        onComplete={async (checkpointId: string, kind: ScriptureCheckpointKind, readUnits: number) => {
          const result = await saveScriptureCheckpointProgress({
            checkpointId,
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
