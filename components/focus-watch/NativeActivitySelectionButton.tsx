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
}: {
  selectionId: string;
  title: string;
  label?: string;
  onSelected?: (summary: ActivitySelectionSummary) => void;
}) {
  const nativeAvailable = isNativeFocusAvailable();
  const summary = useNativeActivitySelectionSummary(selectionId);
  const [busy, setBusy] = useState(false);
  const { request, gate } = usePermissionGate({ embedded: true });

  const open = () => {
    if (!nativeAvailable || busy) return;
    request(async () => {
      setBusy(true);
      try {
        const next = await openNativeActivityPicker(selectionId, title);
        if (next) {
          cacheNativeActivitySelectionSummary(next);
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
        style={[s.button, !nativeAvailable && s.buttonPreview]}
        onPress={open}
        disabled={!nativeAvailable || busy}
        activeOpacity={0.76}
      >
        <View style={s.icon}>
          <Smartphone s={17} c={nativeAvailable ? C.goldDark : C.textMuted} w={1.9} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>{busy ? 'Opening Apple picker...' : label}</Text>
          <Text style={s.meta} numberOfLines={1}>
            {nativeAvailable ? summaryText(summary) : 'Available in the Anasta development build'}
          </Text>
        </View>
        {nativeAvailable && <ChevronRight s={16} c={C.textMuted} w={2} />}
      </TouchableOpacity>
      {!!summary?.notice && <Text style={s.notice}>{summary.notice}</Text>}
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
  buttonPreview: { borderColor: C.border, backgroundColor: '#F2F1ED' },
  icon: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.76)', alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: F.sansSemiBold, fontSize: 11.5, color: C.text },
  meta: { marginTop: 2, fontFamily: F.sans, fontSize: 9, color: C.textMuted },
  notice: { marginTop: 6, paddingHorizontal: 4, fontFamily: F.sansMedium, fontSize: 9.5, lineHeight: 14, color: '#91404C' },
});
