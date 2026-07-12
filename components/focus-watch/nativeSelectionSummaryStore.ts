import { useEffect, useSyncExternalStore } from 'react';
import type { ActivitySelectionSummary } from '@/modules/anasta-focus';
import {
  getNativeActivitySelectionSummary,
  isNativeFocusAvailable,
} from './focusNativeBridge';

const summaries = new Map<string, ActivitySelectionSummary>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

export function cacheNativeActivitySelectionSummary(summary: ActivitySelectionSummary) {
  summaries.set(summary.selectionId, summary);
  emit();
}

export async function refreshNativeActivitySelectionSummary(selectionId: string) {
  const summary = await getNativeActivitySelectionSummary(selectionId);
  if (summary) cacheNativeActivitySelectionSummary(summary);
  return summary;
}

export function useNativeActivitySelectionSummary(selectionId: string) {
  const available = isNativeFocusAvailable();
  const summary = useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => summaries.get(selectionId) ?? null,
    () => null
  );

  useEffect(() => {
    if (!available) return;
    void refreshNativeActivitySelectionSummary(selectionId);
  }, [available, selectionId]);

  return available ? summary : null;
}
