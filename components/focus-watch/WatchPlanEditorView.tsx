import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { Book, Cross, Feather, Flame, OpenBook, Trash2 } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import AppPicker from './AppPicker';
import TimeWheelSheet from './TimeWheelSheet';
import { SMOOTH_LAYOUT, SOFT_IN } from './focusMotion';
import {
  deleteWatchPlan,
  formatTimeOfDay,
  getFocusWatchState,
  RETURN_PRACTICES,
  saveWatchPlan,
  selectionCount,
  type PracticeKind,
  type WatchSelection,
  type WatchStrength,
  type WatchWhen,
} from './focusWatchStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);
const SECTION_TRANSITION = SMOOTH_LAYOUT;

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKENDS = [5, 6];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

type FrequencyKind = 'daily' | 'weekdays' | 'weekends' | 'specific' | 'always';

const FREQUENCY_OPTIONS: { value: FrequencyKind; label: string; desc: string }[] = [
  { value: 'daily', label: 'Daily', desc: 'Every day' },
  { value: 'weekdays', label: 'Weekdays', desc: 'Mon - Fri' },
  { value: 'weekends', label: 'Weekends', desc: 'Sat - Sun' },
  { value: 'specific', label: 'Specific Days', desc: 'Choose days' },
  { value: 'always', label: 'Always on', desc: 'Day and night' },
];

const PRACTICE_ICONS: Record<PracticeKind, React.ReactNode> = {
  prayer: <Cross s={14} c={C.goldDark} w={2} />,
  'jesus-prayer': <Flame s={15} filled color={C.goldDark} />,
  psalm: <OpenBook s={15} c={C.goldDark} w={2} />,
  chapter: <Book s={15} c={C.goldDark} w={2} />,
  intention: <Feather s={15} c={C.goldDark} w={2} />,
};

function whenToFrequency(when: WatchWhen): { freq: FrequencyKind; days: number[] } {
  if (when.kind === 'always') return { freq: 'always', days: EVERY_DAY };
  const key = [...when.days].sort((a, b) => a - b).join(',');
  if (key === '0,1,2,3,4,5,6') return { freq: 'daily', days: when.days };
  if (key === '0,1,2,3,4') return { freq: 'weekdays', days: when.days };
  if (key === '5,6') return { freq: 'weekends', days: when.days };
  return { freq: 'specific', days: when.days };
}

function FrequencyRow({
  option,
  active,
  onPress,
}: {
  option: (typeof FREQUENCY_OPTIONS)[number];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} haptic="selection">
      <Animated.View
        style={[s.frequencyChip, active && s.frequencyChipActive]}
        layout={SECTION_TRANSITION}
      >
        <View style={{ flex: 1 }}>
          <Text style={[s.frequencyLabel, active && s.frequencyLabelActive]}>{option.label}</Text>
          <Text style={[s.frequencyDesc, active && s.frequencyDescActive]}>{option.desc}</Text>
        </View>
        <View style={[s.frequencyRing, active && s.frequencyRingActive]}>
          {active && <View style={s.frequencyDot} />}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function WatchPlanEditorView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { planId } = useLocalSearchParams<{ planId?: string }>();

  const existing = useMemo(
    () => (planId ? getFocusWatchState().plans.find(plan => plan.id === planId) : undefined),
    [planId]
  );
  const initialFrequency = existing
    ? whenToFrequency(existing.when)
    : { freq: 'daily' as FrequencyKind, days: EVERY_DAY };

  const [name, setName] = useState(existing?.name ?? '');
  const [selection, setSelection] = useState<WatchSelection>({
    categoryIds: existing?.categoryIds ?? [],
    appIds: existing?.appIds ?? [],
    groupIds: existing?.groupIds ?? [],
  });
  const [freq, setFreq] = useState<FrequencyKind>(initialFrequency.freq);
  const [days, setDays] = useState<number[]>(
    initialFrequency.freq === 'specific' ? initialFrequency.days : [0, 1, 2, 3, 4]
  );
  const [startMinutes, setStartMinutes] = useState(
    existing?.when.kind === 'schedule' ? existing.when.startMinutes : 1260
  );
  const [endMinutes, setEndMinutes] = useState(
    existing?.when.kind === 'schedule' ? existing.when.endMinutes : 1380
  );
  const [strength, setStrength] = useState<WatchStrength>(existing?.strength ?? 'loose');
  const [practice, setPractice] = useState<PracticeKind>(existing?.practice ?? 'prayer');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [timeSheet, setTimeSheet] = useState<'start' | 'end' | null>(null);

  const canSave =
    selectionCount(selection) > 0 && (freq !== 'specific' || days.length > 0);

  const toggleDay = (day: number) =>
    setDays(current => {
      if (current.includes(day)) {
        if (current.length === 1) return current;
        return current.filter(entry => entry !== day);
      }
      return [...current, day].sort((a, b) => a - b);
    });

  const resolveDays = (): number[] => {
    switch (freq) {
      case 'daily':
        return EVERY_DAY;
      case 'weekdays':
        return WEEKDAYS;
      case 'weekends':
        return WEEKENDS;
      default:
        return days;
    }
  };

  const save = () => {
    saveWatchPlan({
      id: existing?.id,
      name: name.trim() || 'Watch',
      enabled: existing?.enabled ?? true,
      categoryIds: selection.categoryIds,
      appIds: selection.appIds,
      groupIds: selection.groupIds,
      when:
        freq === 'always'
          ? { kind: 'always' }
          : { kind: 'schedule', startMinutes, endMinutes, days: resolveDays() },
      strength,
      practice,
      streak: existing?.streak ?? 0,
    });
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 190 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenTitleBar title={existing ? 'EDIT WATCH' : 'NEW WATCH'} showBack />

        <View style={{ paddingHorizontal: 16 }}>
          <Animated.View entering={enter(0)}>
            <Text style={s.sectionLabel}>NAME</Text>
            <View style={s.groupCard}>
              <TextInput
                style={s.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Name this watch"
                placeholderTextColor={C.textMuted}
                maxLength={28}
                returnKeyType="done"
              />
            </View>
          </Animated.View>

          <Animated.View entering={enter(60)}>
            <Text style={s.sectionLabel}>WHAT TO HOLD BACK</Text>
            <AppPicker selection={selection} onChange={setSelection} />
            <Text style={s.helperText}>
              {"Exact apps arrive with Apple's Screen Time permission — this catalog stands in for now."}
            </Text>
          </Animated.View>

          <Animated.View entering={enter(120)} layout={SECTION_TRANSITION}>
            <Text style={s.sectionLabel}>WHEN</Text>
            <View style={s.frequencyWrap}>
              {FREQUENCY_OPTIONS.map(option => (
                <FrequencyRow
                  key={option.value}
                  option={option}
                  active={freq === option.value}
                  onPress={() => setFreq(option.value)}
                />
              ))}
            </View>

            {freq === 'specific' && (
              <Animated.View entering={SOFT_IN} style={s.dayRow}>
                {DAY_LETTERS.map((letter, day) => {
                  const active = days.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[s.dayChip, active && s.dayChipActive]}
                      activeOpacity={0.84}
                      haptic="selection"
                      onPress={() => toggleDay(day)}
                    >
                      <Text style={[s.dayChipText, active && s.dayChipTextActive]}>{letter}</Text>
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>
            )}

            {freq !== 'always' && (
              <Animated.View entering={SOFT_IN} style={s.timeRow}>
                <TouchableOpacity
                  style={[s.timeCell, timeSheet === 'start' && s.timeCellActive]}
                  activeOpacity={0.8}
                  onPress={() => setTimeSheet('start')}
                >
                  <Text style={s.timeCellLabel}>STARTS</Text>
                  <Text style={s.timeCellValue}>{formatTimeOfDay(startMinutes)}</Text>
                  <Text style={s.timeCellHint}>CHANGE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.timeCell, timeSheet === 'end' && s.timeCellActive]}
                  activeOpacity={0.8}
                  onPress={() => setTimeSheet('end')}
                >
                  <Text style={s.timeCellLabel}>ENDS</Text>
                  <Text style={s.timeCellValue}>{formatTimeOfDay(endMinutes)}</Text>
                  <Text style={s.timeCellHint}>CHANGE</Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {freq === 'always' && (
              <Text style={s.helperText}>
                This watch never sleeps. What it holds back stays held back, day and night.
              </Text>
            )}
          </Animated.View>

          <Animated.View entering={enter(180)} layout={SECTION_TRANSITION}>
            <Text style={s.sectionLabel}>STRENGTH</Text>
            <View style={s.strengthRow}>
              <TouchableOpacity
                style={[s.strengthCard, strength === 'loose' && s.strengthCardOn]}
                activeOpacity={0.85}
                haptic="selection"
                onPress={() => setStrength('loose')}
              >
                <Text style={s.strengthTitle}>Loose</Text>
                <Text style={s.strengthDesc}>
                  A pause and a warning — you may still choose to enter.
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.strengthCard, strength === 'strict' && s.strengthCardOn]}
                activeOpacity={0.85}
                haptic="selection"
                onPress={() => setStrength('strict')}
              >
                <Text style={s.strengthTitle}>Strict</Text>
                <Text style={s.strengthDesc}>
                  The return practice must be completed before entry.
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Animated.View entering={enter(240)} layout={SECTION_TRANSITION}>
            <Text style={s.sectionLabel}>RETURN PRACTICE</Text>
            <View style={s.groupCard}>
              {RETURN_PRACTICES.map((entry, i) => {
                const selected = practice === entry.id;
                return (
                  <View key={entry.id}>
                    {i > 0 && <View style={s.separator} />}
                    <TouchableOpacity
                      style={s.practiceRow}
                      activeOpacity={0.75}
                      haptic="selection"
                      onPress={() => setPractice(entry.id)}
                    >
                      <View style={s.practiceIcon}>{PRACTICE_ICONS[entry.id]}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.practiceName}>{entry.name}</Text>
                        <Text style={s.practiceDetail}>{entry.detail}</Text>
                      </View>
                      <View style={[s.radio, selected && s.radioOn]}>
                        {selected && <View style={s.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 10) + 10 }]}>
        <GoldButton
          label={existing ? 'Save changes' : 'Set the watch'}
          disabled={!canSave}
          onPress={save}
        />
        {existing && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setConfirmDelete(true)}
            style={s.removeBtn}
          >
            <Text style={s.removeText}>Remove this watch</Text>
          </TouchableOpacity>
        )}
      </View>

      <ConfirmModal
        visible={confirmDelete}
        icon={<Trash2 s={22} c={C.red} w={2} />}
        title="Remove this watch?"
        body="Its schedule and settings will be gone."
        subject={existing?.name}
        confirmLabel="REMOVE"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          if (existing) {
            deleteWatchPlan(existing.id);
            router.back();
          }
        }}
      />

      <TimeWheelSheet
        visible={timeSheet !== null}
        title={timeSheet === 'start' ? 'Starts at' : 'Ends at'}
        minutes={timeSheet === 'start' ? startMinutes : endMinutes}
        onClose={() => setTimeSheet(null)}
        onSave={minutes => {
          if (timeSheet === 'start') setStartMinutes(minutes);
          else setEndMinutes(minutes);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  sectionLabel: {
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 10,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
  },
  groupCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginLeft: 58,
  },
  helperText: {
    marginTop: 9,
    marginHorizontal: 10,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 16,
    color: C.textMuted,
  },

  nameInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: F.serifMedium,
    fontSize: 18,
    color: C.text,
  },

  frequencyWrap: {
    gap: 7,
  },
  frequencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  frequencyChipActive: {
    borderColor: '#D6B067',
    backgroundColor: '#FFF9EE',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 2,
  },
  frequencyLabel: {
    fontFamily: F.sansSemiBold,
    fontSize: 14,
    color: C.text,
  },
  frequencyLabelActive: {
    color: '#6D4F13',
  },
  frequencyDesc: {
    marginTop: 1,
    fontFamily: F.sans,
    fontSize: 11.5,
    color: C.textMuted,
  },
  frequencyDescActive: {
    color: '#B08A47',
  },
  frequencyRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#E5E1D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyRingActive: {
    borderColor: '#D6B067',
    backgroundColor: '#FFF9EE',
  },
  frequencyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.gold,
  },

  dayRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    borderColor: '#D6B067',
    backgroundColor: '#FFF9EE',
  },
  dayChipText: {
    fontFamily: F.sansMedium,
    fontSize: 11,
    color: C.textSecondary,
  },
  dayChipTextActive: {
    fontFamily: F.sansBold,
    color: C.goldDark,
  },

  timeRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  timeCell: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  timeCellActive: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  timeCellLabel: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: C.textMuted,
  },
  timeCellValue: {
    marginTop: 7,
    fontFamily: F.serifSemiBold,
    fontSize: 30,
    letterSpacing: 0.5,
    color: C.text,
    fontVariant: ['tabular-nums'],
  },
  timeCellHint: {
    marginTop: 6,
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.8,
    color: C.gold,
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

  practiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  practiceIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.goldBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceName: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    color: C.text,
  },
  practiceDetail: {
    marginTop: 1,
    fontFamily: F.sans,
    fontSize: 11.5,
    color: C.textSecondary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: C.gold,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.gold,
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(252,252,252,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  removeBtn: {
    marginTop: 11,
    alignItems: 'center',
  },
  removeText: {
    fontFamily: F.sansSemiBold,
    fontSize: 13,
    color: C.red,
  },
});
