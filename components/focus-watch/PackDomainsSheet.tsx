import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { Globe, Plus, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusSheetHeader from './FocusSheetHeader';
import { normalizeDomain } from './dayPlanStore';

// The full domain list behind a protection pack. Custom packs are editable
// here — add a domain at the top, remove one from its row. Built-in packs
// show their curated list read-only.

export default function PackDomainsSheet({
  visible,
  title,
  domains,
  note,
  editable,
  onAdd,
  onRemove,
  onClose,
}: {
  visible: boolean;
  title: string;
  domains: string[];
  note?: string;          // curated-list note for built-in packs
  editable: boolean;
  onAdd?: (domain: string) => void;
  onRemove?: (domain: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const canSubmit = normalizeDomain(draft).includes('.');
  const submit = () => {
    if (!onAdd || !canSubmit) return;
    onAdd(draft);
    setDraft('');
  };
  const close = () => {
    setDraft('');
    onClose();
  };

  return (
    <SmoothBottomSheet visible={visible} onClose={close} sheetStyle={s.sheet} keyboardAware>
      <FocusSheetHeader
        kicker="BLOCKED DOMAINS"
        title={title}
        subtitle={`${domains.length} ${domains.length === 1 ? 'domain is' : 'domains are'} blocked by this pack.`}
        onClose={close}
        large
      />

      {editable && (
        <View style={s.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            placeholder="Add a domain — example.com"
            placeholderTextColor={C.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={s.addInput}
          />
          <TouchableOpacity
            style={[s.addButton, !canSubmit && s.addButtonDisabled]}
            onPress={submit}
            disabled={!canSubmit}
          >
            <Plus s={15} c="#FFFFFF" w={2.5} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scrollContent}
      >
        <View style={s.list}>
          {domains.map((domain, index) => (
            <View key={domain}>
              {index > 0 && <View style={s.separator} />}
              <View style={s.row}>
                <View style={s.rowIcon}>
                  <Globe s={14} c="#2D7967" w={2} />
                </View>
                <Text style={s.rowDomain} numberOfLines={1}>{domain}</Text>
                {editable && onRemove && domains.length > 1 && (
                  <TouchableOpacity
                    style={s.removeButton}
                    onPress={() => onRemove(domain)}
                    hitSlop={8}
                    accessibilityLabel={`Remove ${domain}`}
                  >
                    <X s={15} c={C.textMuted} w={2.2} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
        {!!note && <Text style={s.note}>{note}</Text>}
      </ScrollView>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    height: '78%',
    maxHeight: '92%',
    backgroundColor: C.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingBottom: 22,
  },
  addRow: {
    marginTop: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingLeft: 14,
    paddingRight: 7,
  },
  addInput: { flex: 1, fontFamily: F.sansMedium, fontSize: 14, color: C.text },
  addButton: { width: 38, height: 38, borderRadius: 13, borderCurve: 'continuous', backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  addButtonDisabled: { opacity: 0.35 },
  scroll: { flex: 1, marginTop: 14 },
  scrollContent: { paddingBottom: 24 },
  list: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 42 },
  row: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 3 },
  rowIcon: { width: 30, height: 30, borderRadius: 10, borderCurve: 'continuous', backgroundColor: '#E7F3EE', alignItems: 'center', justifyContent: 'center' },
  rowDomain: { flex: 1, minWidth: 0, fontFamily: F.sansSemiBold, fontSize: 14, color: C.text },
  removeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: 12, paddingHorizontal: 4, fontFamily: F.serifItalic, fontSize: 13.5, lineHeight: 18, color: C.textMuted },
});
