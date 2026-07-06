import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { CheckSmall, Plus, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import ZoneTimeline from './ZoneTimeline';
import {
  assignPlanToWeekday,
  DAY_LETTERS,
  DAY_NAMES,
  dateKey,
  describeRules,
  describeZones,
  getPlanById,
  swapTodayPlan,
  useDayPlan,
  weekdayMondayFirst,
  type DayPlan,
} from './dayPlanStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

// ---------------------------------------------------------------------------
// Plan picker — assigns a plan to a weekday (template) or swaps today.
// ---------------------------------------------------------------------------

function PlanPickerSheet({
  day,
  onClose,
}: {
  day: number | null;
  onClose: () => void;
}) {
  const state = useDayPlan();
  const isToday = day !== null && weekdayMondayFirst(new Date()) === day;
  const todayRecord = state.days[dateKey(new Date())];
  const currentPlanId =
    day === null ? null : isToday && todayRecord ? todayRecord.planId : state.schedule[day];

  const choose = (planId: string | null) => {
    if (day === null) return;
    if (isToday) {
      // Today changes immediately; the weekly template keeps its own value.
      swapTodayPlan(planId);
    } else {
      assignPlanToWeekday(day, planId);
    }
    onClose();
  };

  return (
    <SmoothBottomSheet visible={day !== null} onClose={onClose} sheetStyle={s.sheet}>
      <View style={s.sheetHandle} />
      <View style={s.sheetHeaderRow}>
        <Text style={s.sheetTitle}>{day !== null ? DAY_NAMES[day] : ''}</Text>
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.8}
          style={s.sheetClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X s={17} c={C.textMuted} w={2.2} />
        </TouchableOpacity>
      </View>
      {isToday && (
        <Text style={s.sheetNote}>Switching today never costs the trophy.</Text>
      )}

      <View style={s.pickerCard}>
        {state.plans.map((plan, index) => {
          const selected = currentPlanId === plan.id;
          return (
            <View key={plan.id}>
              {index > 0 && <View style={s.separator} />}
              <TouchableOpacity
                style={s.pickerRow}
                activeOpacity={0.75}
                haptic="selection"
                onPress={() => choose(plan.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.pickerName}>{plan.name}</Text>
                  <Text style={s.pickerMeta} numberOfLines={1}>
                    {describeZones(plan)}
                  </Text>
                </View>
                <View style={[s.radio, selected && s.radioOn]}>
                  {selected && <CheckSmall s={12} c="#fff" w={3} />}
                </View>
              </TouchableOpacity>
            </View>
          );
        })}

        {state.plans.length > 0 && <View style={s.separator} />}
        <TouchableOpacity
          style={s.pickerRow}
          activeOpacity={0.75}
          haptic="selection"
          onPress={() => choose(null)}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.pickerName}>No plan</Text>
            <Text style={s.pickerMeta}>A day of rest — nothing held back.</Text>
          </View>
          <View style={[s.radio, currentPlanId === null && s.radioOn]}>
            {currentPlanId === null && <CheckSmall s={12} c="#fff" w={3} />}
          </View>
        </TouchableOpacity>
      </View>
    </SmoothBottomSheet>
  );
}

// ---------------------------------------------------------------------------

function PlanCard({ plan, assignedDays, onPress }: {
  plan: DayPlan;
  assignedDays: boolean[];
  onPress: () => void;
}) {
  const state = useDayPlan();
  return (
    <TouchableOpacity style={s.planCard} activeOpacity={0.82} onPress={onPress}>
      <View style={s.planTopRow}>
        <Text style={s.planName} numberOfLines={1}>
          {plan.name}
        </Text>
        <View style={s.planDaysRow}>
          {assignedDays.map((on, index) => (
            <View key={index} style={[s.planDayDot, on ? s.planDayDotOn : s.planDayDotOff]} />
          ))}
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        <ZoneTimeline zones={plan.zones} height={9} />
      </View>

      <Text style={s.planMeta} numberOfLines={1}>
        {describeZones(plan)}
      </Text>
      <Text style={s.planMetaSecond} numberOfLines={1}>
        {describeRules(state, plan)}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------

export default function DayPlanHubView() {
  const router = useRouter();
  const state = useDayPlan();
  const [pickerDay, setPickerDay] = useState<number | null>(null);

  const today = weekdayMondayFirst(new Date());
  const todayRecord = state.days[dateKey(new Date())];

  // What each weekday resolves to right now (today honours a swap).
  const effectiveByDay = useMemo(
    () =>
      state.schedule.map((planId, day) =>
        day === today && todayRecord ? todayRecord.planId : planId
      ),
    [state.schedule, today, todayRecord]
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="DAY PLAN" showBack />
        <Animated.View entering={enter(0)}>
          <Text style={s.intro}>Plan your phone the way you plan your day.</Text>
        </Animated.View>

        <View style={{ paddingHorizontal: 16 }}>
          <Animated.View entering={enter(60)}>
            <Text style={s.sectionLabel}>THIS WEEK</Text>
            <View style={s.weekCard}>
              <View style={s.weekRow}>
                {DAY_LETTERS.map((letter, day) => {
                  const planId = effectiveByDay[day];
                  const isToday = day === today;
                  return (
                    <TouchableOpacity
                      key={day}
                      style={s.weekCell}
                      activeOpacity={0.75}
                      haptic="selection"
                      onPress={() => setPickerDay(day)}
                    >
                      <View
                        style={[
                          s.weekCircle,
                          planId ? s.weekCircleOn : s.weekCircleOff,
                          isToday && s.weekCircleToday,
                        ]}
                      >
                        <Text
                          style={[
                            s.weekLetter,
                            planId ? s.weekLetterOn : s.weekLetterOff,
                          ]}
                        >
                          {letter}
                        </Text>
                      </View>
                      <Text style={s.weekPlanName} numberOfLines={1}>
                        {getPlanById(state, planId)?.name ?? '—'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={s.weekHint}>
                Tap a day to choose its plan. Today changes at once — the week keeps its shape.
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={enter(140)}>
            <Text style={s.sectionLabel}>PLANS</Text>
          </Animated.View>

          {state.plans.map((plan, index) => (
            <Animated.View key={plan.id} entering={enter(180 + index * 60)}>
              <PlanCard
                plan={plan}
                assignedDays={state.schedule.map(planId => planId === plan.id)}
                onPress={() => router.push(`/day-plan?planId=${plan.id}` as any)}
              />
            </Animated.View>
          ))}

          <Animated.View entering={enter(180 + state.plans.length * 60)}>
            <TouchableOpacity
              style={s.newPlanCard}
              activeOpacity={0.75}
              onPress={() => router.push('/day-plan' as any)}
            >
              <View style={s.newPlanIcon}>
                <Plus s={15} c={C.goldDark} w={2.4} />
              </View>
              <Text style={s.newPlanText}>New plan</Text>
            </TouchableOpacity>

            <Text style={s.footnote}>
              App blocking becomes real once Apple grants the Screen Time permission.
              The plans you shape here are how your days will be kept.
            </Text>
          </Animated.View>
        </View>
      </ScrollView>

      <PlanPickerSheet day={pickerDay} onClose={() => setPickerDay(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  intro: {
    paddingHorizontal: 32,
    paddingTop: 2,
    paddingBottom: 8,
    fontFamily: F.serifMediumItalic,
    fontSize: 16,
    lineHeight: 21,
    color: C.textSecondary,
    textAlign: 'center',
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 10,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
  },

  weekCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 11,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  weekCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCircleOn: {
    backgroundColor: C.goldLight,
  },
  weekCircleOff: {
    backgroundColor: '#F4F3EE',
  },
  weekCircleToday: {
    borderWidth: 1.6,
    borderColor: C.gold,
  },
  weekLetter: {
    fontFamily: F.sansBold,
    fontSize: 12,
  },
  weekLetterOn: {
    color: C.goldDark,
  },
  weekLetterOff: {
    color: C.textMuted,
  },
  weekPlanName: {
    maxWidth: 44,
    fontFamily: F.sansMedium,
    fontSize: 8.5,
    color: C.textSecondary,
    textAlign: 'center',
  },
  weekHint: {
    marginTop: 11,
    paddingHorizontal: 6,
    fontFamily: F.sans,
    fontSize: 10.5,
    lineHeight: 15,
    color: C.textMuted,
    textAlign: 'center',
  },

  planCard: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planName: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 19,
    letterSpacing: -0.2,
    color: C.text,
  },
  planDaysRow: {
    flexDirection: 'row',
    gap: 3.5,
  },
  planDayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  planDayDotOn: {
    backgroundColor: C.gold,
  },
  planDayDotOff: {
    backgroundColor: '#E9E7E1',
  },
  planMeta: {
    marginTop: 9,
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    color: C.textSecondary,
  },
  planMetaSecond: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 11,
    color: C.textMuted,
    fontVariant: ['tabular-nums'],
  },

  newPlanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 22,
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderColor: '#E3E0D8',
    paddingVertical: 16,
    marginBottom: 4,
  },
  newPlanIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newPlanText: {
    fontFamily: F.serifMedium,
    fontSize: 16.5,
    color: C.textSecondary,
  },
  footnote: {
    marginTop: 16,
    paddingHorizontal: 22,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 16,
    color: C.textMuted,
    textAlign: 'center',
  },

  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#E7E5E0',
    marginTop: 10,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  sheetTitle: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    letterSpacing: -0.2,
    color: C.text,
  },
  sheetClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F2ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetNote: {
    marginTop: 3,
    fontFamily: F.serifItalic,
    fontSize: 14,
    color: C.textSecondary,
  },
  pickerCard: {
    marginTop: 14,
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
    marginLeft: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  pickerName: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    color: C.text,
  },
  pickerMeta: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 11.5,
    color: C.textSecondary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#D6D3D1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: C.gold,
    backgroundColor: C.gold,
  },
});
