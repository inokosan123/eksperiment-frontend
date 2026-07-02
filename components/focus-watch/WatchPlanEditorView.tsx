import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { Book, Cross, Feather, Flame, Minus, OpenBook, Plus } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import {
  APP_CATEGORIES,
  deleteWatchPlan,
  formatTimeOfDay,
  getFocusWatchState,
  RETURN_PRACTICES,
  saveWatchPlan,
  type PracticeKind,
  type WatchStrength,
} from './focusWatchStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);
const SPRING = { damping: 18, stiffness: 230 };

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKENDS = [5, 6];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

const PRACTICE_ICONS: Record<PracticeKind, React.ReactNode> = {
  prayer: <Cross s={14} c={C.goldDark} w={2} />,
  'jesus-prayer': <Flame s={15} filled color={C.goldDark} />,
  psalm: <OpenBook s={15} c={C.goldDark} w={2} />,
  chapter: <Book s={15} c={C.goldDark} w={2} />,
  intention: <Feather s={15} c={C.goldDark} w={2} />,
};

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex(option => option.id === value));
  const x = useSharedValue(0);
  const cellWidth = width > 0 ? (width - 6) / options.length : 0;

  useEffect(() => {
    if (cellWidth > 0) x.value = withSpring(index * cellWidth, SPRING);
  }, [index, cellWidth, x]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  return (
    <View style={s.segmented} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {cellWidth > 0 && <Animated.View style={[s.segmentedThumb, { width: cellWidth }, thumbStyle]} />}
      {options.map(option => {
        const active = option.id === value;
        return (
          <TouchableOpacity
            key={option.id}
            style={s.segmentedCell}
            activeOpacity={0.8}
            haptic="selection"
            onPress={() => onChange(option.id)}
          >
            <Text style={[s.segmentedText, active && s.segmentedTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function TimeStepper({
  label,
  minutes,
  onChange,
}: {
  label: string;
  minutes: number;
  onChange: (next: number) => void;
}) {
  const step = (delta: number) => onChange((((minutes + delta) % 1440) + 1440) % 1440);

  return (
    <View style={s.timeCell}>
      <Text style={s.timeCellLabel}>{label}</Text>
      <View style={s.timeCellRow}>
        <TouchableOpacity
          style={s.timeStepBtn}
          activeOpacity={0.7}
          haptic="selection"
          onPress={() => step(-30)}
        >
          <Minus s={13} c={C.textSecondary} w={2.4} />
        </TouchableOpacity>
        <Text style={s.timeCellTime}>{formatTimeOfDay(minutes)}</Text>
        <TouchableOpacity
          style={s.timeStepBtn}
          activeOpacity={0.7}
          haptic="selection"
          onPress={() => step(30)}
        >
          <Plus s={13} c={C.textSecondary} w={2.4} />
        </TouchableOpacity>
      </View>
    </View>
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

  const [name, setName] = useState(existing?.name ?? '');
  const [categoryIds, setCategoryIds] = useState<string[]>(existing?.categoryIds ?? []);
  const [whenKind, setWhenKind] = useState<'schedule' | 'always'>(existing?.when.kind ?? 'schedule');
  const [startMinutes, setStartMinutes] = useState(
    existing?.when.kind === 'schedule' ? existing.when.startMinutes : 1260
  );
  const [endMinutes, setEndMinutes] = useState(
    existing?.when.kind === 'schedule' ? existing.when.endMinutes : 1380
  );
  const [days, setDays] = useState<number[]>(
    existing?.when.kind === 'schedule' ? existing.when.days : EVERY_DAY
  );
  const [strength, setStrength] = useState<WatchStrength>(existing?.strength ?? 'loose');
  const [practice, setPractice] = useState<PracticeKind>(existing?.practice ?? 'prayer');

  const canSave = categoryIds.length > 0 && (whenKind === 'always' || days.length > 0);

  const toggleCategory = (id: string) =>
    setCategoryIds(current =>
      current.includes(id) ? current.filter(entry => entry !== id) : [...current, id]
    );

  const toggleDay = (day: number) =>
    setDays(current =>
      current.includes(day) ? current.filter(entry => entry !== day) : [...current, day]
    );

  const save = () => {
    saveWatchPlan({
      id: existing?.id,
      name: name.trim() || 'Watch',
      enabled: existing?.enabled ?? true,
      categoryIds,
      when:
        whenKind === 'always'
          ? { kind: 'always' }
          : {
              kind: 'schedule',
              startMinutes,
              endMinutes,
              days: [...days].sort((a, b) => a - b),
            },
      strength,
      practice,
    });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Remove this watch?', 'Its schedule and settings will be gone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deleteWatchPlan(existing.id);
          router.back();
        },
      },
    ]);
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
            <View style={s.chipWrap}>
              {APP_CATEGORIES.map(category => {
                const selected = categoryIds.includes(category.id);
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[s.categoryChip, selected && s.categoryChipOn]}
                    activeOpacity={0.8}
                    haptic="selection"
                    onPress={() => toggleCategory(category.id)}
                  >
                    <Text style={[s.categoryChipText, selected && s.categoryChipTextOn]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={s.helperText}>
              {"Exact apps arrive with Apple's Screen Time permission — categories stand in for now."}
            </Text>
          </Animated.View>

          <Animated.View entering={enter(120)}>
            <Text style={s.sectionLabel}>WHEN</Text>
            <Segmented
              options={[
                { id: 'schedule', label: 'Schedule' },
                { id: 'always', label: 'Always on' },
              ]}
              value={whenKind}
              onChange={id => setWhenKind(id as 'schedule' | 'always')}
            />

            {whenKind === 'schedule' && (
              <View>
                <View style={s.timeRow}>
                  <TimeStepper label="STARTS" minutes={startMinutes} onChange={setStartMinutes} />
                  <TimeStepper label="ENDS" minutes={endMinutes} onChange={setEndMinutes} />
                </View>

                <View style={s.dayRow}>
                  {DAY_LETTERS.map((letter, day) => {
                    const selected = days.includes(day);
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[s.dayChip, selected && s.dayChipOn]}
                        activeOpacity={0.8}
                        haptic="selection"
                        onPress={() => toggleDay(day)}
                      >
                        <Text style={[s.dayChipText, selected && s.dayChipTextOn]}>{letter}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={s.dayPresetRow}>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => setDays(WEEKDAYS)}>
                    <Text style={s.dayPresetText}>Weekdays</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => setDays(WEEKENDS)}>
                    <Text style={s.dayPresetText}>Weekends</Text>
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => setDays(EVERY_DAY)}>
                    <Text style={s.dayPresetText}>Every day</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {whenKind === 'always' && (
              <Text style={s.helperText}>
                This watch never sleeps. What it holds back stays held back, day and night.
              </Text>
            )}
          </Animated.View>

          <Animated.View entering={enter(180)}>
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

          <Animated.View entering={enter(240)}>
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
        <TouchableOpacity
          style={[s.saveBtn, !canSave && { opacity: 0.4 }]}
          activeOpacity={0.85}
          haptic="medium"
          disabled={!canSave}
          onPress={save}
        >
          <Text style={s.saveBtnText}>{existing ? 'Save changes' : 'Set the watch'}</Text>
        </TouchableOpacity>
        {existing && (
          <TouchableOpacity activeOpacity={0.7} onPress={remove} style={s.removeBtn}>
            <Text style={s.removeText}>Remove this watch</Text>
          </TouchableOpacity>
        )}
      </View>
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

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  categoryChipOn: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  categoryChipText: {
    fontFamily: F.sansMedium,
    fontSize: 13,
    color: C.textSecondary,
  },
  categoryChipTextOn: {
    color: C.goldDark,
  },

  segmented: {
    flexDirection: 'row',
    height: 42,
    borderRadius: 999,
    backgroundColor: '#F3F2ED',
    padding: 3,
  },
  segmentedThumb: {
    position: 'absolute',
    top: 3,
    left: 3,
    bottom: 3,
    borderRadius: 999,
    backgroundColor: C.surface,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  segmentedCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedText: {
    fontFamily: F.sansMedium,
    fontSize: 13,
    color: C.textMuted,
  },
  segmentedTextActive: {
    fontFamily: F.sansSemiBold,
    color: C.text,
  },

  timeRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  timeCell: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  timeCellLabel: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: C.textMuted,
  },
  timeCellRow: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeCellTime: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    color: C.text,
    fontVariant: ['tabular-nums'],
    minWidth: 66,
    textAlign: 'center',
  },
  timeStepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipOn: {
    borderColor: C.gold,
    backgroundColor: C.gold,
  },
  dayChipText: {
    fontFamily: F.sansMedium,
    fontSize: 12,
    color: C.textSecondary,
  },
  dayChipTextOn: {
    fontFamily: F.sansBold,
    color: '#fff',
  },
  dayPresetRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
  },
  dayPresetText: {
    fontFamily: F.sansMedium,
    fontSize: 12,
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
  saveBtn: {
    height: 52,
    borderRadius: 999,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnText: {
    fontFamily: F.sansSemiBold,
    fontSize: 15,
    letterSpacing: 0.2,
    color: '#fff',
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
