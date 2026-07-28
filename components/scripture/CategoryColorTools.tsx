import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Pencil, X } from '@/components/icons/Icons';
import {
  ColorCategory, getAnnotationColorHex, hexToRgba, HighlightColor,
} from '@/constants/annotationColors';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity, HapticPressable as Pressable } from '@/components/shared/HapticTouch';


type CategoryChipPickerProps = {
  categories: ColorCategory[];
  selectedColor?: HighlightColor | 'all';
  onSelectColor?: (color: HighlightColor) => void;
  includeAll?: boolean;
  onSelectAll?: () => void;
  onEdit?: () => void;
  layout?: 'scroll' | 'wrap';
  editLabel?: boolean;
  contentStyle?: object;
};

export function CategoryChipPicker({
  categories,
  selectedColor,
  onSelectColor,
  includeAll = false,
  onSelectAll,
  onEdit,
  layout = 'scroll',
  editLabel = false,
  contentStyle,
}: CategoryChipPickerProps) {
  const chips = (
    <>
      {includeAll && (
        <TouchableOpacity
          onPress={onSelectAll}
          activeOpacity={0.84}
          style={[s.categoryChip, selectedColor === 'all' && s.allChipActive]}
        >
          <Text style={[s.categoryText, selectedColor === 'all' && s.allTextActive]}>All</Text>
        </TouchableOpacity>
      )}

      {categories.map(category => {
        const accent = getAnnotationColorHex(category.color);
        const active = selectedColor === category.color;
        return (
          <TouchableOpacity
            key={category.color}
            onPress={() => onSelectColor?.(category.color)}
            activeOpacity={0.84}
            style={[
              s.categoryChip,
              {
                borderColor: hexToRgba(accent, active ? 0.34 : 0.18),
                backgroundColor: hexToRgba(accent, active ? 0.14 : 0.07),
              },
              active && s.categoryChipActive,
            ]}
          >
            <View style={[s.categoryDot, { backgroundColor: accent }]} />
            <Text style={[s.categoryText, { color: accent }]} numberOfLines={1}>
              {category.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      {onEdit && (
        <TouchableOpacity onPress={onEdit} activeOpacity={0.84} style={[s.editChip, !editLabel && s.editIconChip]}>
          <Pencil s={12} c="#9CA3AF" />
          {editLabel && <Text style={s.editText}>Edit</Text>}
        </TouchableOpacity>
      )}
    </>
  );

  if (layout === 'wrap') {
    return <View style={[s.chipWrap, contentStyle]}>{chips}</View>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[s.chipRow, contentStyle]}
    >
      {chips}
    </ScrollView>
  );
}

type CategoryEditorModalProps = {
  visible: boolean;
  categories: ColorCategory[];
  onClose: () => void;
  onSaveCategory: (color: HighlightColor, label: string) => Promise<void> | void;
  guidedRename?: {
    color: HighlightColor;
    label: string;
    onDone?: () => void;
  };
  saveTargetProps?: {
    ref: React.Ref<any>;
    onLayout: (event: any) => void;
  };
  onSaved?: () => void;
  overlay?: React.ReactNode;
  onEntered?: () => void;
  onExited?: () => void;
  exitWatchdogMs?: number;
};

type CategoryEditorPanelProps = Omit<CategoryEditorModalProps, 'visible'> & {
  style?: StyleProp<ViewStyle>;
};

export function CategoryEditorPanel({
  categories,
  onClose,
  onSaveCategory,
  style,
  guidedRename,
  saveTargetProps,
  onSaved,
}: CategoryEditorPanelProps) {
  const initialDraft = useMemo(
    () => Object.fromEntries(categories.map(category => [category.color, category.label])) as Record<HighlightColor, string>,
    [categories],
  );
  const [draft, setDraft] = useState<Record<HighlightColor, string>>(initialDraft);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const guidedTypingKeyRef = React.useRef('');

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  useEffect(() => {
    if (!guidedRename) return undefined;
    const typingKey = `${guidedRename.color}:${guidedRename.label}`;
    if (guidedTypingKeyRef.current === typingKey) return undefined;
    guidedTypingKeyRef.current = typingKey;
    let cancelled = false;
    let position = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    setDraft(current => ({ ...current, [guidedRename.color]: '' }));
    const typeNext = () => {
      if (cancelled) return;
      position += 1;
      setDraft(current => ({
        ...current,
        [guidedRename.color]: guidedRename.label.slice(0, position),
      }));
      if (position >= guidedRename.label.length) {
        timer = setTimeout(() => {
          if (!cancelled) guidedRename.onDone?.();
        }, 180);
        return;
      }
      timer = setTimeout(typeNext, 72);
    };
    timer = setTimeout(typeNext, 360);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [guidedRename]);

  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await Promise.all(categories.map(category =>
        onSaveCategory(category.color, draft[category.color] ?? category.label)));
      onSaved?.();
      onClose();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <View style={[s.editorCard, style]}>
          <View style={s.editorHeader}>
            <View>
              <Text style={s.editorTitle}>Study Colors</Text>
              <Text style={s.editorSub}>Rename categories for Bible study.</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.84} style={s.editorClose}>
              <X s={18} c="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.editorList} showsVerticalScrollIndicator={false}>
            {categories.map(category => {
              const accent = getAnnotationColorHex(category.color);
              return (
                <View key={category.color} style={s.editorRow}>
                  <View style={[s.editorDot, { backgroundColor: accent }]} />
                  <Text style={s.editorKey}>{category.color}</Text>
                  <TextInput
                    value={draft[category.color] ?? ''}
                    onChangeText={value => setDraft(current => ({ ...current, [category.color]: value }))}
                    placeholder={category.label}
                    placeholderTextColor="#D1D5DB"
                    style={s.editorInput}
                    autoCapitalize="words"
                  />
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            {...saveTargetProps}
            disabled={saving}
            onPress={save}
            activeOpacity={0.86}
            style={s.saveButton}
          >
            <Text style={s.saveText}>{saving ? 'SAVING...' : 'SAVE LABELS'}</Text>
          </TouchableOpacity>
    </View>
  );
}

export function CategoryEditorModal({
  visible,
  categories,
  onClose,
  onSaveCategory,
  guidedRename,
  saveTargetProps,
  onSaved,
  overlay,
  onEntered,
  onExited,
  exitWatchdogMs,
}: CategoryEditorModalProps) {
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);
  const onEnteredRef = useRef(onEntered);
  const onExitedRef = useRef(onExited);
  const exitCompletedRef = useRef(false);
  onEnteredRef.current = onEntered;
  onExitedRef.current = onExited;

  const completeEnter = useCallback(() => {
    onEnteredRef.current?.();
  }, []);
  const completeExit = useCallback(() => {
    if (exitCompletedRef.current) return;
    exitCompletedRef.current = true;
    setMounted(false);
    onExitedRef.current?.();
  }, []);

  useEffect(() => {
    if (visible) {
      exitCompletedRef.current = false;
      setMounted(true);
      progress.value = 0;
      const frame = requestAnimationFrame(() => {
        progress.value = withTiming(1, {
          duration: 280,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        }, finished => {
          if (finished) runOnJS(completeEnter)();
        });
      });
      return () => cancelAnimationFrame(frame);
    }
    if (!mounted) return undefined;

    exitCompletedRef.current = false;
    progress.value = withTiming(0, {
      duration: 190,
      easing: Easing.in(Easing.cubic),
    }, finished => {
      if (finished) runOnJS(completeExit)();
    });
    if (!exitWatchdogMs) return undefined;
    const exitTimer = setTimeout(completeExit, exitWatchdogMs);
    return () => clearTimeout(exitTimer);
  }, [completeEnter, completeExit, exitWatchdogMs, mounted, progress, visible]);

  const overlayMotionStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  const cardMotionStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - progress.value) * 16 },
      { scale: 0.992 + progress.value * 0.008 },
    ],
  }));

  if (!mounted) return null;

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose}>
      <Reanimated.View style={[s.editorOverlay, overlayMotionStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* The sizing lives on this wrapper — a direct child of the
            full-size overlay — so the card's width/height resolve against a
            definite parent. Without it, the transform-only wrapper has no
            width and the card collapses to its content (the narrow popout). */}
        <Reanimated.View style={[s.cardWrap, cardMotionStyle]}>
          <CategoryEditorPanel
            categories={categories}
            onClose={onClose}
            onSaveCategory={onSaveCategory}
            guidedRename={guidedRename}
            saveTargetProps={saveTargetProps}
            onSaved={onSaved}
          />
        </Reanimated.View>
        {overlay}
      </Reanimated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  chipRow: { gap: 8, paddingRight: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  categoryChipActive: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 1,
  },
  allChipActive: { backgroundColor: '#1C1917', borderColor: '#1C1917' },
  categoryText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.45, textTransform: 'uppercase' },
  allTextActive: { color: '#fff' },
  categoryDot: { width: 7, height: 7, borderRadius: 4 },
  editChip: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editIconChip: { width: 34, paddingHorizontal: 0 },
  editText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, color: '#9CA3AF', textTransform: 'uppercase' },
  editorOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Reach near the screen edges like the app's other popouts: a slim
    // horizontal gutter, a little more room top and bottom.
    paddingHorizontal: 14,
    paddingVertical: 22,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  // The animated wrapper carries the size against the definite overlay, so
  // the card's width/height have a real parent to resolve against. The high
  // ceiling is a phone-only safety cap no handset reaches, so the card runs
  // side to side on every phone — like the app's other popouts.
  cardWrap: {
    width: '100%',
    maxWidth: 520,
    height: '88%',
    maxHeight: 700,
  },
  editorCard: {
    // width:'100%' resolves against any definite parent (the wrapper here,
    // the reader's overlay when used standalone); flex fills the wrapper's
    // height in the modal and is capped by the caller's style in the reader.
    width: '100%',
    flex: 1,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 34,
    elevation: 16,
  },
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 12 },
  editorTitle: { fontFamily: F.serifMedium, fontSize: 24, color: '#111827' },
  editorSub: { marginTop: 2, fontFamily: F.serif, fontSize: 14, color: '#8B8F98' },
  editorClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F8F8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorList: { flex: 1 },
  editorRow: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0EEE9',
    backgroundColor: '#FFFEFB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    marginBottom: 9,
  },
  editorDot: { width: 11, height: 11, borderRadius: 6 },
  editorKey: {
    width: 56,
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.25,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  editorInput: {
    flex: 1,
    minHeight: 26,
    fontFamily: F.serif,
    fontSize: 17,
    lineHeight: 23,
    color: '#252525',
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 24,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  saveText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2, color: '#FFFFFF' },
});
