import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Smartphone } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import {
  isNativeFocusAvailable,
  openNativeActivityPicker,
} from './focusNativeBridge';
import {
  cacheNativeActivitySelectionSummary,
  useNativeActivitySelectionSummary,
} from './nativeSelectionSummaryStore';
import NativeActivitySelectionLabels from './NativeActivitySelectionLabels';
import { usePermissionGate } from './usePermissionGate';
import type { ActivitySelectionSummary } from '@/modules/anasta-focus';

function summaryText(summary: ActivitySelectionSummary | null) {
  if (!summary) return 'Choose privately with Apple';
  const parts = [
    summary.applicationCount > 0
      ? `${summary.applicationCount} ${summary.applicationCount === 1 ? 'app' : 'apps'}`
      : null,
    summary.categoryCount > 0
      ? `${summary.categoryCount} ${summary.categoryCount === 1 ? 'category' : 'categories'}`
      : null,
    summary.webDomainCount > 0 ? `${summary.webDomainCount} websites` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' - ') : 'Nothing selected yet';
}

export default function NativeActivitySelectionButton({
  selectionId,
  title,
  label = 'Choose iPhone apps',
  onSelected,
  prominent = false,
}: {
  selectionId: string;
  title: string;
  label?: string;
  onSelected?: (summary: ActivitySelectionSummary) => void;
  prominent?: boolean;
}) {
  const nativeAvailable = isNativeFocusAvailable();
  const summary = useNativeActivitySelectionSummary(selectionId);
  const [busy, setBusy] = useState(false);
  const [selectionRefreshKey, setSelectionRefreshKey] = useState(0);
  const { request, gate } = usePermissionGate({ embedded: true });

  const open = () => {
    if (!nativeAvailable || busy) return;
    request(async () => {
      setBusy(true);
      try {
        const next = await openNativeActivityPicker(selectionId, title);
        if (next) {
          cacheNativeActivitySelectionSummary(next);
          setSelectionRefreshKey(value => value + 1);
          onSelected?.(next);
        }
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <>
      <TouchableOpacity
        style={[s.button, prominent && s.buttonProminent, !nativeAvailable && s.buttonPreview]}
        onPress={open}
        disabled={!nativeAvailable || busy}
        activeOpacity={0.76}
      >
        <View style={[s.icon, prominent && s.iconProminent]}>
          <Smartphone s={prominent ? 20 : 17} c={nativeAvailable ? C.goldDark : C.textMuted} w={1.9} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.label, prominent && s.labelProminent]}>{busy ? 'Opening Apple picker...' : label}</Text>
          <Text style={[s.meta, prominent && s.metaProminent]} numberOfLines={1}>
            {nativeAvailable ? summaryText(summary) : 'Available in the Anasta development build'}
          </Text>
        </View>
        {nativeAvailable && <ChevronRight s={prominent ? 18 : 16} c={prominent ? C.goldDark : C.textMuted} w={2} />}
      </TouchableOpacity>
      <NativeActivitySelectionLabels
        selectionId={selectionId}
        summary={summary}
        refreshKey={selectionRefreshKey}
        maxItems={prominent ? 5 : 4}
      />
      {!!summary?.notice && <Text style={[s.notice, prominent && s.noticeProminent]}>{summary.notice}</Text>}
      {gate}
    </>
  );
}

const s = StyleSheet.create({
  button: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 15,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E5D7B7',
    backgroundColor: '#FFF9EB',
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  buttonProminent: {
    minHeight: 72,
    gap: 12,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 11,
    boxShadow: '0 7px 18px rgba(84, 65, 26, 0.08)',
  },
  buttonPreview: { borderColor: C.border, backgroundColor: '#F2F1ED' },
  icon: { width: 34, height: 34, borderRadius: 11, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.76)', alignItems: 'center', justifyContent: 'center' },
  iconProminent: { width: 42, height: 42, borderRadius: 14 },
  label: { fontFamily: F.serifMedium, fontSize: 15.5, color: C.text },
  labelProminent: { fontFamily: F.serifSemiBold, fontSize: 17.5, lineHeight: 21 },
  meta: { marginTop: 2, fontFamily: F.sans, fontSize: 10, color: C.textMuted },
  metaProminent: { marginTop: 3, fontSize: 12, lineHeight: 16, color: C.textSecondary },
  notice: { marginTop: 6, paddingHorizontal: 4, fontFamily: F.sansMedium, fontSize: 10, lineHeight: 14.5, color: '#91404C' },
  noticeProminent: { marginTop: 8, fontSize: 12, lineHeight: 17 },
});
