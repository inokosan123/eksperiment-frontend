import type { ComponentType } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { requireNativeViewManager } from 'expo-modules-core';
import { BarChart3 } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { isNativeFocusAvailable } from './focusNativeBridge';

type NativeReportProps = {
  date: string;
  days: number;
  startMinutes: number;
  endMinutes: number;
  style?: object;
};

let NativeReport: ComponentType<NativeReportProps> | null = null;
if (Platform.OS === 'ios' && isNativeFocusAvailable()) {
  try {
    NativeReport = requireNativeViewManager<NativeReportProps>('AnastaFocus');
  } catch {
    NativeReport = null;
  }
}

export function hasNativeActivityReport() {
  return NativeReport !== null;
}

export default function FocusNativeActivityReport({
  date,
  days = 1,
  startMinutes,
  endMinutes,
}: {
  date: string;
  days?: number;
  startMinutes?: number;
  endMinutes?: number;
}) {
  if (NativeReport) {
    return (
      <NativeReport
        date={date}
        days={days}
        startMinutes={startMinutes ?? -1}
        endMinutes={endMinutes ?? -1}
        style={[s.nativeReport, days > 1 && s.nativeReportRange]}
      />
    );
  }

  return (
    <View style={s.fallback}>
      <View style={s.icon}>
        <BarChart3 s={20} c={C.goldDark} w={1.9} />
      </View>
      <View style={s.copy}>
        <Text style={s.title}>Private activity detail</Text>
        <Text style={s.body}>
          {days > 1 ? 'The private phone-time trend' : 'Hourly, app, category, and website detail'} appears here in the Anasta iPhone development build. It stays inside Apple&apos;s activity report.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  nativeReport: { width: '100%', height: 640 },
  nativeReportRange: { height: 540 },
  fallback: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E5D9BD',
    backgroundColor: '#FFF9EB',
    padding: 14,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderCurve: 'continuous',
    backgroundColor: '#F6E8C6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: { fontFamily: F.serifMedium, fontSize: 16, color: C.text },
  body: { marginTop: 3, fontFamily: F.sans, fontSize: 9.5, lineHeight: 14, color: C.textSecondary },
});
