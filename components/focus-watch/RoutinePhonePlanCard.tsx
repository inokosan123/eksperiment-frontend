import { useRouter } from 'expo-router';
import { C } from '@/constants/tokens';
import { gaugeStanding, gaugeStateColor, GAUGE_ESSENTIALS_COLOR } from './DayGauge';
import { ScreenTimeProtectionCard, WebProtectionCard } from './ProtectionPillarCards';
import {
  DAY_NAMES,
  dateKey,
  describeZones,
  formatMinutesShort,
  getEffectivePlan,
  getLiveUsageSnapshot,
  getPlanById,
  getWebProtectionSummary,
  useDayPlan,
  weekdayMondayFirst,
} from './dayPlanStore';

// My Routine is a read-only window into the same protection pillars shown on
// Focus. It supplies the selected weekday's data, while both screens render
// the exact shared cards from ProtectionPillarCards.
export default function RoutinePhonePlanCard({ dayIndex }: { dayIndex: number }) {
  const state = useDayPlan();
  const router = useRouter();
  const safeDayIndex = Math.max(0, Math.min(6, dayIndex));
  const now = new Date();

  const isToday = weekdayMondayFirst(now) === safeDayIndex;
  const todayKey = dateKey(now);
  const plan = isToday
    ? getEffectivePlan(state, now)
    : getPlanById(state, state.schedule[safeDayIndex]);
  const usedMinutes = isToday ? getLiveUsageSnapshot(todayKey)?.totalMinutes ?? null : null;
  const targetMinutes = plan?.budgetMinutes ?? null;
  const toleranceEndMinutes = plan ? plan.essentialOnlyMinutes ?? plan.tolerableMinutes : null;
  const standing = targetMinutes != null
    ? gaugeStanding(targetMinutes, toleranceEndMinutes, usedMinutes)
    : 'unknown';
  const essentialsNow = !!plan && !plan.essentialsOnly && isToday
    && (state.nativeProtection.hardWallDate === todayKey || standing === 'essentials');

  let value: string | undefined;
  let valueCaption: string | undefined;
  let valueColor: string = C.text;
  if (plan?.essentialsOnly) {
    value = 'Essentials';
    valueCaption = 'ALL DAY';
    valueColor = GAUGE_ESSENTIALS_COLOR;
  } else if (plan && targetMinutes == null) {
    value = 'On';
    valueCaption = 'GROUP LIMITS';
  } else if (plan && essentialsNow) {
    value = 'Essentials';
    valueCaption = 'ONLY FOR NOW';
    valueColor = GAUGE_ESSENTIALS_COLOR;
  } else if (plan && targetMinutes != null && usedMinutes != null) {
    value = formatMinutesShort(Math.max(0, targetMinutes - usedMinutes));
    valueCaption = 'LEFT TODAY';
    valueColor = gaugeStateColor(standing, C.text);
  } else if (plan && targetMinutes != null) {
    value = formatMinutesShort(targetMinutes);
    valueCaption = 'DAILY TARGET';
  }

  const numbersColor = plan?.essentialsOnly || targetMinutes == null || usedMinutes == null
    ? C.text
    : gaugeStateColor(standing, C.text);
  const screenStatus = !plan
    ? 'Nothing is held back this day'
    : plan.essentialsOnly
      ? 'Only Essentials are open this day'
      : essentialsNow
        ? 'Limit spent · Essentials remain open'
        : describeZones(plan);

  const webProtection = getWebProtectionSummary(state);

  return (
    <>
      <ScreenTimeProtectionCard
        plan={plan}
        kicker={isToday ? 'TODAY’S PLAN' : `${DAY_NAMES[safeDayIndex].toUpperCase()}’S PLAN`}
        statusText={screenStatus}
        usedMinutes={usedMinutes}
        targetMinutes={targetMinutes}
        numbersColor={numbersColor}
        value={value}
        valueCaption={valueCaption}
        valueColor={valueColor}
        live={isToday}
        onPress={() => router.push('/day-plans' as never)}
        accessibilityLabel={`${DAY_NAMES[safeDayIndex]} Screen Time plan. Open plans.`}
      />
      <WebProtectionCard
        state={webProtection.state}
        packsOn={webProtection.packsOn}
        customSites={webProtection.customSites}
        lockCaption={state.purity.locks.locked
          ? 'HARD LOCKED'
          : state.purity.locks.enabled
            ? 'HARD LOCK'
            : 'SYSTEM-WIDE'}
        onPress={() => router.push('/clean-sight' as never)}
      />
    </>
  );
}
