import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import { APP_CATEGORIES, startQuickWatch, type WatchStrength } from './focusWatchStore';

const DURATION_OPTIONS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '1.5 hours' },
  { minutes: 120, label: '2 hours' },
  { minutes: 180, label: '3 hours' },
];

// The "Begin a watch" setup: one sheet, three quick decisions —
// how long, what is held back, and how firm the door is.
export default function QuickWatchSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState(60);
  const [categoryIds, setCategoryIds] = useState<string[]>([
    'social',
    'entertainment',
    'games',
  ]);
  const [strength, setStrength] = useState<WatchStrength>('loose');

  const canBegin = categoryIds.length > 0;

  const toggleCategory = (id: string) =>
    setCategoryIds(current =>
      current.includes(id) ? current.filter(entry => entry !== id) : [...current, id]
    );

  const begin = () => {
    startQuickWatch({ minutes, categoryIds, strength });
    onClose();
  };

  return (
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheet}>
      <View style={s.handle} />
      <View style={s.headerRow}>
        <Text style={s.title}>Begin a watch</Text>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.8}
          style={s.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X s={17} c={C.textMuted} w={2.2} />
        </TouchableOpacity>
      </View>
      <Text style={s.subtitle}>Set the watch for this moment.</Text>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        <Text style={s.sectionLabel}>FOR HOW LONG</Text>
        <View style={s.chipWrap}>
          {DURATION_OPTIONS.map(option => {
            const selected = minutes === option.minutes;
            return (
              <TouchableOpacity
                key={option.minutes}
                style={[s.chip, selected && s.chipOn]}
                activeOpacity={0.8}
                haptic="selection"
                onPress={() => setMinutes(option.minutes)}
              >
                <Text style={[s.chipText, selected && s.chipTextOn]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.sectionLabel}>WHAT IS HELD BACK</Text>
        <View style={s.chipWrap}>
          {APP_CATEGORIES.map(category => {
            const selected = categoryIds.includes(category.id);
            return (
              <TouchableOpacity
                key={category.id}
                style={[s.chip, selected && s.chipOn]}
                activeOpacity={0.8}
                haptic="selection"
                onPress={() => toggleCategory(category.id)}
              >
                <Text style={[s.chipText, selected && s.chipTextOn]}>{category.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.sectionLabel}>STRENGTH</Text>
        <View style={s.strengthRow}>
          <TouchableOpacity
            style={[s.strengthCard, strength === 'loose' && s.strengthCardOn]}
            activeOpacity={0.85}
            haptic="selection"
            onPress={() => setStrength('loose')}
          >
            <Text style={s.strengthTitle}>Loose</Text>
            <Text style={s.strengthDesc}>You may end the watch early.</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.strengthCard, strength === 'strict' && s.strengthCardOn]}
            activeOpacity={0.85}
            haptic="selection"
            onPress={() => setStrength('strict')}
          >
            <Text style={s.strengthTitle}>Strict</Text>
            <Text style={s.strengthDesc}>Held until the time runs out.</Text>
          </TouchableOpacity>
        </View>

        <GoldButton
          label="Begin the watch"
          disabled={!canBegin}
          onPress={begin}
          style={{ marginTop: 20 }}
        />
      </ScrollView>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '86%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#E7E5E0',
    marginTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 2,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    letterSpacing: -0.2,
    color: C.text,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F2ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 2,
    fontFamily: F.serifItalic,
    fontSize: 15,
    color: C.textSecondary,
  },

  sectionLabel: {
    marginTop: 18,
    marginBottom: 9,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chipOn: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  chipText: {
    fontFamily: F.sansMedium,
    fontSize: 13,
    color: C.textSecondary,
  },
  chipTextOn: {
    fontFamily: F.sansSemiBold,
    color: C.goldDark,
  },

  strengthRow: {
    flexDirection: 'row',
    gap: 8,
  },
  strengthCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  strengthCardOn: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  strengthTitle: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    color: C.text,
  },
  strengthDesc: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 15,
    color: C.textSecondary,
  },
});
