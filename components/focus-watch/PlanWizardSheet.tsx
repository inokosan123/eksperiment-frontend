import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { Minus, Plus, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import { formatMinutesShort, groupName, useDayPlan } from './dayPlanStore';

const TOTAL_OPTIONS = [
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '1.5 hours' },
  { minutes: 120, label: '2 hours' },
  { minutes: 180, label: '3 hours' },
  { minutes: 240, label: '4 hours' },
];

// How a leisure day splits by default. Shopping and dating are left free —
// the wizard only proposes limits where time actually leaks.
const SPLIT_WEIGHTS: { groupId: string; weight: number }[] = [
  { groupId: 'social', weight: 0.4 },
  { groupId: 'entertainment', weight: 0.3 },
  { groupId: 'games', weight: 0.2 },
  { groupId: 'news', weight: 0.1 },
];

const STEP = 15;

function proposeSplit(total: number): Record<string, number> {
  const split: Record<string, number> = {};
  for (const { groupId, weight } of SPLIT_WEIGHTS) {
    split[groupId] = Math.max(STEP, Math.round((total * weight) / STEP) * STEP);
  }
  return split;
}

// The planning helper: one honest question ("how much leisure per day?"),
// a suggested split, steppers to make it yours. All math happens here, at
// planning time — afterwards only the per-group limits exist.
export default function PlanWizardSheet({
  visible,
  onClose,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (minutesByGroup: Record<string, number>) => void;
}) {
  const state = useDayPlan();
  const [total, setTotal] = useState(120);
  const [split, setSplit] = useState<Record<string, number>>(() => proposeSplit(120));

  const sum = useMemo(
    () => Object.values(split).reduce((acc, minutes) => acc + minutes, 0),
    [split]
  );

  const chooseTotal = (minutes: number) => {
    setTotal(minutes);
    setSplit(proposeSplit(minutes));
  };

  const nudge = (groupId: string, delta: number) =>
    setSplit(current => ({
      ...current,
      [groupId]: Math.max(STEP, Math.min(300, (current[groupId] ?? STEP) + delta)),
    }));

  return (
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheet}>
      <View style={s.handle} />
      <View style={s.headerRow}>
        <Text style={s.title}>Help me plan</Text>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.8}
          style={s.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X s={17} c={C.textMuted} w={2.2} />
        </TouchableOpacity>
      </View>
      <Text style={s.subtitle}>How much leisure time will you give the phone each day?</Text>

      <View style={s.chipWrap}>
        {TOTAL_OPTIONS.map(option => {
          const selected = total === option.minutes;
          return (
            <TouchableOpacity
              key={option.minutes}
              style={[s.chip, selected && s.chipOn]}
              activeOpacity={0.8}
              haptic="selection"
              onPress={() => chooseTotal(option.minutes)}
            >
              <Text style={[s.chipText, selected && s.chipTextOn]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={s.sectionLabel}>A SUGGESTED SPLIT</Text>
      <View style={s.card}>
        {SPLIT_WEIGHTS.map(({ groupId }, index) => (
          <View key={groupId}>
            {index > 0 && <View style={s.separator} />}
            <View style={s.row}>
              <Text style={s.rowName}>{groupName(state, groupId)}</Text>
              <View style={s.stepper}>
                <TouchableOpacity
                  style={s.stepBtn}
                  activeOpacity={0.75}
                  haptic="selection"
                  onPress={() => nudge(groupId, -STEP)}
                >
                  <Minus s={13} c={C.textSecondary} w={2.4} />
                </TouchableOpacity>
                <Text style={s.stepValue}>{formatMinutesShort(split[groupId] ?? STEP)}</Text>
                <TouchableOpacity
                  style={s.stepBtn}
                  activeOpacity={0.75}
                  haptic="selection"
                  onPress={() => nudge(groupId, STEP)}
                >
                  <Plus s={13} c={C.textSecondary} w={2.4} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={s.totalRow}>
        <Text style={s.totalLabel}>Your day gives the phone</Text>
        <Text style={s.totalValue}>{formatMinutesShort(sum)}</Text>
      </View>
      <Text style={s.note}>A plan, not a machine — every number can change later.</Text>

      <GoldButton
        label="Use this plan"
        onPress={() => {
          onApply(split);
          onClose();
        }}
        style={{ marginTop: 14 }}
      />
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
    lineHeight: 20,
    color: C.textSecondary,
  },
  chipWrap: {
    marginTop: 14,
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
  sectionLabel: {
    marginTop: 18,
    marginBottom: 8,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginLeft: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowName: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    color: C.text,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    minWidth: 58,
    textAlign: 'center',
    fontFamily: F.sansSemiBold,
    fontSize: 13.5,
    color: C.goldDark,
    fontVariant: ['tabular-nums'],
  },
  totalRow: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  totalLabel: {
    fontFamily: F.serif,
    fontSize: 14.5,
    color: C.textSecondary,
  },
  totalValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 22,
    color: C.goldDark,
    fontVariant: ['tabular-nums'],
  },
  note: {
    marginTop: 4,
    paddingHorizontal: 4,
    fontFamily: F.sans,
    fontSize: 11,
    color: C.textMuted,
  },
});
