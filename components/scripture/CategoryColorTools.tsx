import React, { useEffect, useMemo, useState } from 'react';
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
};

type CategoryEditorPanelProps = Omit<CategoryEditorModalProps, 'visible'> & {
  style?: StyleProp<ViewStyle>;
};

export function CategoryEditorPanel({
  categories,
  onClose,
  onSaveCategory,
  style,
}: CategoryEditorPanelProps) {
  const initialDraft = useMemo(
    () => Object.fromEntries(categories.map(category => [category.color, category.label])) as Record<HighlightColor, string>,
    [categories],
  );
  const [draft, setDraft] = useState<Record<HighlightColor, string>>(initialDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all(categories.map(category =>
        onSaveCategory(category.color, draft[category.color] ?? category.label)));
      onClose();
    } finally {
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

          <TouchableOpacity disabled={saving} onPress={save} activeOpacity={0.86} style={s.saveButton}>
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
}: CategoryEditorModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.editorOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <CategoryEditorPanel
          categories={categories}
          onClose={onClose}
          onSaveCategory={onSaveCategory}
        />
      </View>
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
    padding: 18,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  editorCard: {
    width: '100%',
    maxWidth: 360,
    height: '88%',
    maxHeight: 690,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    padding: 20,
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
