import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { ChevronDown, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import AppPicker from './AppPicker';
import { usePermissionGate } from './usePermissionGate';
import { SMOOTH_LAYOUT, SOFT_IN, SOFT_OUT } from './focusMotion';
import {
  QUIET_DEFAULT_SELECTION,
  selectionCount,
  startQuietHour,
  type QuietHourSession,
  type Strength,
  type WatchSelection,
} from './dayPlanStore';

const DURATION_OPTIONS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '1.5 hours' },
  { minutes: 120, label: '2 hours' },
  { minutes: 180, label: '3 hours' },
];

function cloneSelection(selection: WatchSelection): WatchSelection {
  return {
    categoryIds: [...selection.categoryIds],
    appIds: [...selection.appIds],
    groupIds: [...selection.groupIds],
  };
}

function closestDuration(minutes: number) {
  return DURATION_OPTIONS.reduce((best, option) =>
    Math.abs(option.minutes - minutes) < Math.abs(best.minutes - minutes) ? option : best
  ).minutes;
}

// The panic button's sheet: one decision that matters (how long), everything
// else already answered — all leisure closed, held strictly. The rare
// adjustments hide behind a fold.
export default function QuietHourSheet({
  visible,
  onClose,
  editingSession,
}: {
  visible: boolean;
  onClose: () => void;
  editingSession?: QuietHourSession | null;
}) {
  const [minutes, setMinutes] = useState(60);
  const [strength, setStrength] = useState<Strength>('strict');
  const [selection, setSelection] = useState<WatchSelection>(cloneSelection(QUIET_DEFAULT_SELECTION));
  const [adjustOpen, setAdjustOpen] = useState(false);
  const { request, gate } = usePermissionGate({ embedded: true });
  const isEditing = !!editingSession;

  const canBegin = selectionCount(selection) > 0;

  useEffect(() => {
    if (!visible) return;
    setAdjustOpen(false);
    if (!editingSession) {
      setMinutes(60);
      setStrength('strict');
      setSelection(cloneSelection(QUIET_DEFAULT_SELECTION));
      return;
    }
    setMinutes(closestDuration(Math.round(editingSession.totalMs / 60_000)));
    setStrength(editingSession.strength);
    setSelection(cloneSelection(editingSession.selection));
  }, [editingSession, visible]);

  const begin = () =>
    request(() => {
      startQuietHour({ minutes, strength, selection });
      onClose();
    });

  return (
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheet}>
      <View style={s.handle} />
      <View style={s.headerRow}>
        <Text style={s.title}>{isEditing ? 'Adjust Quiet Hour' : 'Quiet Hour'}</Text>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.8}
          style={s.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X s={17} c={C.textMuted} w={2.2} />
        </TouchableOpacity>
      </View>
      <Text style={s.subtitle}>
        {isEditing
          ? 'Reshape the quiet that is standing now.'
          : 'Close everything loud — right now, for a while.'}
      </Text>

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

        <Text style={s.sectionLabel}>HOW FIRM</Text>
        <View style={s.strengthRow}>
          <TouchableOpacity
            style={[s.strengthCard, strength === 'strict' && s.strengthCardOn]}
            activeOpacity={0.85}
            haptic="selection"
            onPress={() => setStrength('strict')}
          >
            <Text style={s.strengthTitle}>Strict</Text>
            <Text style={s.strengthDesc}>Held until the time runs out.</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.strengthCard, strength === 'loose' && s.strengthCardOn]}
            activeOpacity={0.85}
            haptic="selection"
            onPress={() => setStrength('loose')}
          >
            <Text style={s.strengthTitle}>Loose</Text>
            <Text style={s.strengthDesc}>You may end it early.</Text>
          </TouchableOpacity>
        </View>

        <Animated.View layout={SMOOTH_LAYOUT}>
          <TouchableOpacity
            style={s.adjustRow}
            activeOpacity={0.7}
            onPress={() => setAdjustOpen(open => !open)}
          >
            <Text style={s.adjustText}>
              {adjustOpen ? 'What is held back' : 'Everything loud is held back'}
            </Text>
            <View style={[s.adjustChevron, adjustOpen && s.adjustChevronOpen]}>
              <ChevronDown s={15} c={C.textMuted} />
            </View>
          </TouchableOpacity>

          {adjustOpen && (
            <Animated.View entering={SOFT_IN} exiting={SOFT_OUT}>
              <AppPicker selection={selection} onChange={setSelection} manageGroups={false} />
            </Animated.View>
          )}
        </Animated.View>

        <GoldButton
          label={isEditing ? 'Keep the quiet' : 'Begin the Quiet Hour'}
          disabled={!canBegin}
          onPress={begin}
          style={{ marginTop: 20 }}
        />
      </ScrollView>

      {gate}
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

  adjustRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 8,
  },
  adjustText: {
    fontFamily: F.sansMedium,
    fontSize: 12.5,
    color: C.textSecondary,
  },
  adjustChevron: {
    transform: [{ rotate: '0deg' }],
  },
  adjustChevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
});
