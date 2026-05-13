import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import {
  ChevronUp,
  ChevronDown,
  Eye,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
  CheckSmall,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { SECTION_META, type JournalSection } from './journalSections';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';


type Props = {
  visible: boolean;
  onClose: () => void;
  sections: JournalSection[];
  onSectionsChange: (next: JournalSection[]) => void;
  onAddCustomScale: (label: string) => void;
  onDeleteCustomScale: (id: string) => void;
};

// ─── Custom toggle ──────────────────────────────────────────────────────────
const TOGGLE_W = 44;
const TOGGLE_H = 26;
const THUMB_SIZE = 22;
const THUMB_PAD = 2;
const SLIDE_DISTANCE = TOGGLE_W - THUMB_SIZE - THUMB_PAD * 2;

function JournalToggle({ value, onPress }: { value: boolean; onPress: () => void }) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [value, progress]);

  const trackOnStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * SLIDE_DISTANCE }],
  }));

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
      <View style={tg.track}>
        <Animated.View style={[StyleSheet.absoluteFill, tg.trackOn, trackOnStyle]} />
        <Animated.View style={[tg.thumb, thumbStyle]} />
      </View>
    </TouchableOpacity>
  );
}

const tg = StyleSheet.create({
  track: {
    width: TOGGLE_W,
    height: TOGGLE_H,
    borderRadius: TOGGLE_H / 2,
    backgroundColor: '#E5E1D7',
    padding: THUMB_PAD,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  trackOn: {
    backgroundColor: C.gold,
    borderRadius: TOGGLE_H / 2,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
    elevation: 3,
  },
});

export default function CustomizeJournalSheet({
  visible,
  onClose,
  sections,
  onSectionsChange,
  onAddCustomScale,
  onDeleteCustomScale,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [adding, setAdding] = useState(false);
  const [scaleLabel, setScaleLabel] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmingScale = confirmDeleteId ? sections.find(s => s.id === confirmDeleteId) : null;
  const scrollMaxHeight = Math.max(420, winH - insets.top - 180);

  const move = (id: string, dir: -1 | 1) => {
    const idx = sections.findIndex(s => s.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const next = [...sections];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSectionsChange(next);
  };

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    onSectionsChange(sections.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  const askDeleteScale = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConfirmDeleteId(id);
  };

  const confirmDeleteScale = () => {
    if (!confirmDeleteId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDeleteCustomScale(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  const submitScale = () => {
    const label = scaleLabel.trim();
    if (!label) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAddCustomScale(label);
    setScaleLabel('');
    setAdding(false);
  };

  const activeSections = sections.filter(s => s.active);
  const inactiveSections = sections.filter(s => !s.active);

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={onClose}
      keyboardAware
      sheetStyle={s.sheet}
      overlayChildren={
        <ConfirmModal
          embedded
          visible={!!confirmDeleteId}
          icon={<Trash2 s={22} c="#EF4444" w={2} />}
          iconBg="#FEE2E2"
          title="Delete custom scale?"
          body="This scale will be removed from your journal."
          subject={confirmingScale?.customLabel}
          confirmLabel="DELETE"
          confirmColor="#EF4444"
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={confirmDeleteScale}
        />
      }
    >
      <View style={[s.handle]} />

      <View style={s.head}>
        <View style={s.headLeft}>
          <SlidersHorizontal s={20} c={C.gold} />
          <Text style={s.title}>Customize Journal</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X s={20} c={C.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ maxHeight: scrollMaxHeight }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {activeSections.map((section, idx) => (
          <SectionRow
            key={section.id}
            section={section}
            canMoveUp={idx > 0}
            canMoveDown={idx < activeSections.length - 1}
            onMoveUp={() => move(section.id, -1)}
            onMoveDown={() => move(section.id, 1)}
            onToggle={() => toggle(section.id)}
            onDelete={section.type === 'customScale' ? () => askDeleteScale(section.id) : undefined}
          />
        ))}

        {inactiveSections.length > 0 && (
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>INACTIVE</Text>
            <View style={s.dividerLine} />
          </View>
        )}

        {inactiveSections.map(section => (
          <SectionRow
            key={section.id}
            section={section}
            canMoveUp={false}
            canMoveDown={false}
            onMoveUp={() => {}}
            onMoveDown={() => {}}
            onToggle={() => toggle(section.id)}
            onDelete={section.type === 'customScale' ? () => askDeleteScale(section.id) : undefined}
            inactive
          />
        ))}

        <View style={s.scalesHead}>
          <View style={s.scalesLine} />
          <Text style={s.scalesText}>CUSTOM SCALES</Text>
          <View style={s.scalesLine} />
        </View>

        <Text style={s.scalesHelp}>Create 1–10 sliders that appear in your journal.</Text>

        {adding ? (
          <View style={s.addRow}>
            <TextInput
              value={scaleLabel}
              onChangeText={setScaleLabel}
              placeholder="Scale label (e.g. Stress, Focus...)"
              placeholderTextColor={C.textMuted}
              style={s.addInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitScale}
            />
            <TouchableOpacity style={s.addCancel} onPress={() => { setAdding(false); setScaleLabel(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X s={18} c={C.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.addConfirm, !scaleLabel.trim() && s.addConfirmDisabled]} onPress={submitScale} disabled={!scaleLabel.trim()}>
              <CheckSmall s={16} c="#fff" w={3} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAdding(true); }}
            activeOpacity={0.75}
          >
            <Plus s={18} c={C.gold} w={2.4} />
            <Text style={s.addBtnText}>ADD SCALE</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SmoothBottomSheet>
  );
}

function SectionRow({
  section, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onToggle, onDelete, inactive,
}: {
  section: JournalSection;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggle: () => void;
  onDelete?: () => void;
  inactive?: boolean;
}) {
  const meta = SECTION_META[section.type];
  const Icon = meta.Icon;
  const label = section.type === 'customScale' ? (section.customLabel || 'Custom Scale') : meta.label;

  return (
    <View style={[s.row, inactive && s.rowInactive]}>
      <View style={s.arrows}>
        <Pressable
          disabled={!canMoveUp}
          onPress={onMoveUp}
          style={({ pressed }) => [s.arrowBtn, !canMoveUp && s.arrowDisabled, pressed && canMoveUp && s.arrowPressed]}
          hitSlop={{ top: 4, bottom: 0, left: 4, right: 4 }}
        >
          <ChevronUp s={14} c={canMoveUp ? C.textSecondary : '#D6D3CC'} w={2.2} />
        </Pressable>
        <Pressable
          disabled={!canMoveDown}
          onPress={onMoveDown}
          style={({ pressed }) => [s.arrowBtn, !canMoveDown && s.arrowDisabled, pressed && canMoveDown && s.arrowPressed]}
          hitSlop={{ top: 0, bottom: 4, left: 4, right: 4 }}
        >
          <ChevronDown s={14} c={canMoveDown ? C.textSecondary : '#D6D3CC'} w={2.2} />
        </Pressable>
      </View>

      <View style={[s.iconWrap, { backgroundColor: meta.bg }]}>
        <Icon s={18} c={meta.color} w={2} />
      </View>

      <Text style={[s.rowLabel, inactive && s.rowLabelInactive]} numberOfLines={1}>{label}</Text>

      <Eye s={14} c={inactive ? '#D6D3CC' : C.textMuted} w={1.8} />

      {onDelete && (
        <TouchableOpacity onPress={onDelete} style={s.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
          <Trash2 s={15} c={C.textMuted} w={1.8} />
        </TouchableOpacity>
      )}

      <JournalToggle value={section.active} onPress={onToggle} />
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: '#FAF7F0',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D6D3CC',
    marginBottom: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9E0',
    marginBottom: 12,
  },
  headLeft: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  title: { fontFamily: F.serifMedium, fontSize: 21, color: C.text },
  closeBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDE9E0',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    columnGap: 10,
  },
  rowInactive: { opacity: 0.55 },
  arrows: { width: 18, justifyContent: 'space-between', alignSelf: 'stretch', paddingVertical: 2 },
  arrowBtn: { padding: 1, alignItems: 'center', justifyContent: 'center' },
  arrowDisabled: { opacity: 0.35 },
  arrowPressed: { opacity: 0.6 },
  iconWrap: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontFamily: F.serifMedium, fontSize: 16, color: C.text },
  rowLabelInactive: { color: C.textMuted },
  deleteBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },

  divider: { flexDirection: 'row', alignItems: 'center', columnGap: 8, marginVertical: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EDE9E0' },
  dividerText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: C.textMuted },

  scalesHead: { flexDirection: 'row', alignItems: 'center', columnGap: 8, marginTop: 18, marginBottom: 6 },
  scalesLine: { flex: 1, height: 1, backgroundColor: '#EDE9E0' },
  scalesText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: C.textMuted },
  scalesHelp: { fontFamily: F.sans, fontSize: 12, color: C.textMuted, textAlign: 'center', marginBottom: 12, paddingHorizontal: 14 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', columnGap: 8,
    borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(197,160,89,0.45)', borderStyle: 'dashed',
    paddingVertical: 13,
  },
  addBtnText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 1.6, color: C.gold },

  addRow: { flexDirection: 'row', alignItems: 'center', columnGap: 8, paddingVertical: 4 },
  addInput: {
    flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#EDE9E0', backgroundColor: '#FFFFFF',
    paddingHorizontal: 12, fontFamily: F.serifMedium, fontSize: 15, color: C.text,
  },
  addCancel: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  addConfirm: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  addConfirmDisabled: { backgroundColor: '#D6D3CC' },
});
