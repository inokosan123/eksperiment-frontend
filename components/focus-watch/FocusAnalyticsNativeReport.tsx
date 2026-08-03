import type { ComponentType } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { requireNativeViewManager } from 'expo-modules-core';
import { isNativeFocusAvailable } from './focusNativeBridge';

type NativeAnalyticsReportProps = {
  analyticsRequestJson: string;
  style?: object;
};

let NativeAnalyticsReport: ComponentType<NativeAnalyticsReportProps> | null = null;

if (Platform.OS === 'ios' && isNativeFocusAvailable()) {
  try {
    NativeAnalyticsReport = requireNativeViewManager<NativeAnalyticsReportProps>('AnastaFocus');
  } catch {
    NativeAnalyticsReport = null;
  }
}

export function hasNativeFocusAnalyticsReport() {
  return NativeAnalyticsReport !== null;
}

export default function FocusAnalyticsNativeReport({
  requestJson,
}: {
  requestJson: string;
}) {
  if (!NativeAnalyticsReport) return null;
  return (
    <View style={styles.wrap} collapsable={false}>
      <NativeAnalyticsReport
        analyticsRequestJson={requestJson}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
    backgroundColor: 'transparent',
  },
});
