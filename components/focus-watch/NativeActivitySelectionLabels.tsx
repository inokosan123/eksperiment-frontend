import type { ComponentType } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { ViewProps } from 'react-native';
import { requireNativeViewManager } from 'expo-modules-core';
import type { ActivitySelectionSummary } from '@/modules/anasta-focus';
import { isNativeFocusAvailable } from './focusNativeBridge';

type NativeSelectionLabelsProps = ViewProps & {
  selectionId: string;
  refreshKey: number;
  maxItems: number;
};

let NativeSelectionLabels: ComponentType<NativeSelectionLabelsProps> | null = null;

// Expo Go, web, Android, and older Anasta development builds do not contain
// this native view. Keep the lookup behind both guards so those testing paths
// retain the existing count-only UI instead of throwing during module import.
if (Platform.OS === 'ios' && isNativeFocusAvailable()) {
  try {
    NativeSelectionLabels = requireNativeViewManager<NativeSelectionLabelsProps>('AnastaFocusLabels');
  } catch {
    NativeSelectionLabels = null;
  }
}

export default function NativeActivitySelectionLabels({
  selectionId,
  summary,
  refreshKey,
  maxItems = 4,
}: {
  selectionId: string;
  summary: ActivitySelectionSummary | null;
  refreshKey: number;
  maxItems?: number;
}) {
  const totalCount = summary
    ? summary.applicationCount + summary.categoryCount + summary.webDomainCount
    : 0;

  if (!NativeSelectionLabels || totalCount === 0) return null;

  const safeMaxItems = Math.max(1, Math.min(maxItems, 8));
  const visibleCount = Math.min(totalCount, safeMaxItems);
  const height = 47 + visibleCount * 42 + (totalCount > visibleCount ? 30 : 0);

  return (
    <View style={[s.container, { height }]} pointerEvents="none">
      <NativeSelectionLabels
        selectionId={selectionId}
        refreshKey={refreshKey}
        maxItems={safeMaxItems}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 7,
  },
});
