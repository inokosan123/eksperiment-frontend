import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Globe, Hourglass, Plus, Trash2, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusSheetHeader from './FocusSheetHeader';
import { normalizeDomain } from './dayPlanStore';

// Every pack keeps its curated list intact and may also hold personal domains.
// Only personal additions can be removed from this sheet.

export default function PackDomainsSheet({
  visible,
  title,
  domains,
  note,
  addedDomains,
  pendingRemovals,
  removalDelayLabel,
  onAdd,
  onRemove,
  onCancelPending,
  onClose,
}: {
  visible: boolean;
  title: string;
  domains: string[];
  note?: string;          // curated-list note for built-in packs
  addedDomains?: string[];
  pendingRemovals?: Record<string, { id: string; text: string }>;
  removalDelayLabel?: string;
  onAdd?: (domain: string) => boolean;
  onRemove?: (domain: string) => void;
  onCancelPending?: (id: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const canSubmit = normalizeDomain(draft).includes('.');
  const addedDomainSet = new Set(addedDomains ?? []);
  const submit = () => {
    if (!onAdd || !canSubmit) return;
    if (!onAdd(draft)) {
      setInputError('This domain is already included in this pack.');
      return;
    }
    setDraft('');
    setInputError(null);
  };
  const close = () => {
    setDraft('');
    setInputError(null);
    setConfirmRemove(null);
    onClose();
  };

  return (
    <SmoothBottomSheet visible={visible} onClose={close} sheetStyle={s.sheet} keyboardAware>
      <FocusSheetHeader
        kicker="BLOCKED DOMAINS"
        title={title}
        subtitle="Review the pack and add any website you want it to cover."
        onClose={close}
        large
      />

      {!!onAdd && (
        <View style={s.addSection}>
          <Text style={s.addLabel}>ADD A WEBSITE</Text>
          <View style={[s.addRow, inputError && s.addRowError]}>
            <View style={s.addIcon}><Globe s={15} c="#2D7967" w={2} /></View>
            <TextInput
              value={draft}
              onChangeText={value => { setDraft(value); setInputError(null); }}
              onSubmitEditing={submit}
              placeholder="Add a domain — example.com"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              style={s.addInput}
            />
            <TouchableOpacity
              style={[s.addButton, !canSubmit && s.addButtonDisabled]}
              onPress={submit}
              disabled={!canSubmit}
              accessibilityLabel={`Add website to ${title}`}
            >
              <Plus s={15} c="#FFFFFF" w={2.5} />
            </TouchableOpacity>
          </View>
          <Text style={[s.addHint, inputError && s.addError]}>
            {inputError ?? `This website will be added only to ${title}.`}
          </Text>
        </View>
      )}

      <View style={s.listHeading}>
        <Text style={s.listHeadingText}>WEBSITES IN THIS PACK</Text>
        <View style={s.listHeadingCount}><Text style={s.listHeadingCountText}>{domains.length}</Text></View>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scrollContent}
      >
        <View style={s.list}>
          {domains.map((domain, index) => {
            const pending = pendingRemovals?.[domain];
            const addedByYou = addedDomainSet.has(domain);
            return <View key={domain}>
              {index > 0 && <View style={s.separator} />}
              <Animated.View layout={LinearTransition.duration(200)} style={[s.row, pending && s.rowPending]}>
                {pending && (
                  <Animated.View
                    pointerEvents="none"
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    style={s.pendingWash}
                  />
                )}
                <View style={[s.rowIcon, pending && s.rowIconPending]}>
                  {pending
                    ? <Hourglass s={14} c="#66635D" w={2.1} />
                    : <Globe s={14} c="#2D7967" w={2} />}
                </View>
                <View style={s.rowCopy}>
                  <Text selectable style={[s.rowDomain, pending && s.rowDomainPending]} numberOfLines={1}>{domain}</Text>
                  {!!pending && <Text style={s.pendingText} numberOfLines={1}>{pending.text}</Text>}
                  {!pending && addedByYou && <Text style={s.addedText}>ADDED BY YOU</Text>}
                </View>
                {pending ? (
                  <TouchableOpacity
                    style={s.cancelButton}
                    onPress={() => onCancelPending?.(pending.id)}
                    haptic="selection"
                    accessibilityLabel={`Cancel removal of ${domain}`}
                  >
                    <Text style={s.cancelText}>CANCEL</Text>
                  </TouchableOpacity>
                ) : onRemove && addedByYou && (
                  <TouchableOpacity
                    style={s.removeButton}
                    onPress={() => setConfirmRemove(domain)}
                    hitSlop={8}
                    accessibilityLabel={`Remove ${domain}`}
                  >
                    <X s={15} c={C.textMuted} w={2.2} />
                  </TouchableOpacity>
                )}
              </Animated.View>
            </View>
          })}
        </View>
        {!!note && (
          <View style={s.noteCard}>
            <View style={s.noteIcon}>
              <Globe s={16} c={C.goldDark} w={2} />
            </View>
            <View style={s.noteCopy}>
              <Text style={s.noteLabel}>ABOUT THIS PACK</Text>
              <Text selectable style={s.note}>{note}</Text>
            </View>
          </View>
        )}
      </ScrollView>
      <ConfirmModal
        embedded
        visible={confirmRemove !== null}
        icon={<Trash2 s={21} c="#765F37" w={2.1} />}
        iconBg="#F1ECE2"
        title="Remove this website from the pack?"
        body={removalDelayLabel
          ? `Hard Lock keeps this website blocked for ${removalDelayLabel}. Its row changes to Pending now, and removal happens only when the delay ends.`
          : 'This website will leave the pack immediately.'}
        subject={confirmRemove ?? undefined}
        cancelLabel="KEEP BLOCKED"
        confirmLabel={removalDelayLabel ? 'START REMOVAL' : 'REMOVE'}
        confirmColor="#7A7368"
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) onRemove?.(confirmRemove);
          setConfirmRemove(null);
        }}
      />
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    height: '84%',
    maxHeight: '92%',
    backgroundColor: C.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingBottom: 22,
  },
  addSection: { marginTop: 20 },
  addLabel: { paddingHorizontal: 3, fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.25, color: C.textSecondary },
  addRow: {
    marginTop: 7,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingLeft: 8,
    paddingRight: 7,
    boxShadow: '0 5px 14px rgba(40,45,42,0.05)',
  },
  addRowError: { borderColor: '#D9A3AD', backgroundColor: '#FFF9FA' },
  addIcon: { width: 36, height: 36, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#E7F3EE', alignItems: 'center', justifyContent: 'center' },
  addInput: { flex: 1, fontFamily: F.sansMedium, fontSize: 15, color: C.text },
  addButton: { width: 38, height: 38, borderRadius: 13, borderCurve: 'continuous', backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  addButtonDisabled: { opacity: 0.35 },
  addHint: { marginTop: 7, paddingHorizontal: 4, fontFamily: F.sans, fontSize: 12.5, lineHeight: 18, color: C.textSecondary },
  addError: { color: '#A24351' },
  listHeading: { marginTop: 21, paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listHeadingText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.2, color: C.textSecondary },
  listHeadingCount: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: '#EEEAE1', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  listHeadingCountText: { fontFamily: F.sansBold, fontSize: 12, color: C.textSecondary, fontVariant: ['tabular-nums'] },
  scroll: { flex: 1, marginTop: 9 },
  scrollContent: { paddingBottom: 24 },
  list: { overflow: 'hidden', borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, paddingHorizontal: 10, boxShadow: '0 6px 16px rgba(40,45,42,0.045)' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginLeft: 42 },
  row: { position: 'relative', overflow: 'hidden', minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 2, paddingVertical: 7 },
  rowPending: { minHeight: 66 },
  pendingWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(235,235,232,0.74)' },
  rowIcon: { width: 30, height: 30, borderRadius: 10, borderCurve: 'continuous', backgroundColor: '#E7F3EE', alignItems: 'center', justifyContent: 'center' },
  rowIconPending: { backgroundColor: '#DEDDD8' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowDomain: { fontFamily: F.sansSemiBold, fontSize: 15, lineHeight: 20, color: C.text },
  rowDomainPending: { color: '#55524D' },
  pendingText: { marginTop: 2, fontFamily: F.sansMedium, fontSize: 12.5, lineHeight: 17, color: '#77736B' },
  addedText: { marginTop: 3, fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 0.65, color: '#2D7967' },
  removeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { minHeight: 30, justifyContent: 'center', borderRadius: 10, borderCurve: 'continuous', borderWidth: 1, borderColor: '#C9C6BF', backgroundColor: 'rgba(255,255,255,0.72)', paddingHorizontal: 8 },
  cancelText: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 0.6, color: '#625F59' },
  noteCard: { marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E1D9CA', backgroundColor: '#F8F5EE', paddingHorizontal: 12, paddingVertical: 12 },
  noteIcon: { width: 36, height: 36, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#EEE5D3', alignItems: 'center', justifyContent: 'center' },
  noteCopy: { flex: 1, minWidth: 0 },
  noteLabel: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 1, color: C.goldDark },
  note: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 14, lineHeight: 20, color: C.textSecondary },
});
