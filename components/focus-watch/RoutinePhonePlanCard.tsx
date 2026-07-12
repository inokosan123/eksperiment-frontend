import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Smartphone } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import ZoneTimeline from './ZoneTimeline';
import {
  DAY_NAMES,
  dateKey,
  describeZones,
  getPlanById,
  useDayPlan,
  weekdayMondayFirst,
} from './dayPlanStore';

// The light bridge into My Routine: read-only information about the Screen
// Time template assigned to this weekday. One tap leads to Focus.
// No routine state is touched from here.
export default function RoutinePhonePlanCard({ dayIndex }: { dayIndex: number }) {
  const state = useDayPlan();
  const router = useRouter();

  const isToday = weekdayMondayFirst(new Date()) === dayIndex;
  const todayRecord = state.days[dateKey(new Date())];
  const planId =
    isToday && todayRecord ? todayRecord.planId : state.schedule[dayIndex] ?? null;
  const plan = getPlanById(state, planId);

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.82}
      onPress={() => router.push('/day-plans' as any)}
    >
      <View style={s.icon}>
        <Smartphone s={16} c={C.goldDark} w={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.kicker}>SCREEN TIME</Text>
        <Text style={s.title} numberOfLines={1}>
          {`${DAY_NAMES[dayIndex]} — ${plan ? plan.name : 'Rest day'}`}
        </Text>
        {plan ? (
          <>
            {plan.kind === 'session' && (
              <View style={{ marginTop: 7 }}>
                <ZoneTimeline zones={plan.zones} height={6} />
              </View>
            )}
            <Text style={s.meta} numberOfLines={1}>
              {describeZones(plan)}
            </Text>
          </>
        ) : (
          <Text style={s.meta}>Nothing is held back this day.</Text>
        )}
      </View>
      <ChevronRight s={16} c={C.textMuted} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 15,
    paddingVertical: 13,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: C.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: C.gold,
  },
  title: {
    marginTop: 2,
    fontFamily: F.serifMedium,
    fontSize: 16.5,
    color: C.text,
  },
  meta: {
    marginTop: 4,
    fontFamily: F.sans,
    fontSize: 10.5,
    color: C.textMuted,
  },
});
