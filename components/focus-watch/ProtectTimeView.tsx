import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { Plus } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusSwitch from './FocusSwitch';
import {
  describeSelection,
  formatWhen,
  practiceName,
  togglePlanEnabled,
  useFocusWatch,
  type WatchPlan,
} from './focusWatchStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

function PlanCard({ plan }: { plan: WatchPlan }) {
  const router = useRouter();
  const selectionLabel = describeSelection(plan);

  return (
    <TouchableOpacity
      style={s.planCard}
      activeOpacity={0.82}
      onPress={() => router.push(`/watch-plan?planId=${plan.id}` as any)}
    >
      <View style={plan.enabled ? undefined : s.planDimmed}>
        <View style={s.planTopRow}>
          <Text style={s.planName} numberOfLines={1}>
            {plan.name}
          </Text>
        </View>
        <Text style={s.planMeta}>{formatWhen(plan.when)}</Text>

        <View style={s.planChipRow}>
          <View style={[s.strengthChip, plan.strength === 'strict' ? s.strengthStrict : s.strengthLoose]}>
            <Text
              style={[
                s.strengthChipText,
                { color: plan.strength === 'strict' ? C.goldDark : C.textSecondary },
              ]}
            >
              {plan.strength === 'strict' ? 'STRICT' : 'LOOSE'}
            </Text>
          </View>
          <View style={s.metaChip}>
            <Text style={s.metaChipText}>{selectionLabel}</Text>
          </View>
          <View style={s.metaChip}>
            <Text style={s.metaChipText}>{practiceName(plan.practice)}</Text>
          </View>
        </View>
      </View>

      <View style={s.planSwitch}>
        <FocusSwitch value={plan.enabled} onToggle={() => togglePlanEnabled(plan.id)} />
      </View>
    </TouchableOpacity>
  );
}

export default function ProtectTimeView() {
  const router = useRouter();
  const { plans } = useFocusWatch();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="PROTECT TIME" showBack />
        <Animated.View entering={enter(0)}>
          <Text style={s.intro}>Choose what pulls you away — and when it stays shut.</Text>
        </Animated.View>

        <View style={{ paddingHorizontal: 16 }}>
          <Animated.View entering={enter(70)}>
            <Text style={s.sectionLabel}>WATCH PLANS</Text>
          </Animated.View>

          {plans.map((plan, i) => (
            <Animated.View key={plan.id} entering={enter(110 + i * 60)}>
              <PlanCard plan={plan} />
            </Animated.View>
          ))}

          <Animated.View entering={enter(110 + plans.length * 60)}>
            <TouchableOpacity
              style={s.newPlanCard}
              activeOpacity={0.75}
              onPress={() => router.push('/watch-plan' as any)}
            >
              <View style={s.newPlanIcon}>
                <Plus s={15} c={C.goldDark} w={2.4} />
              </View>
              <Text style={s.newPlanText}>New watch plan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.previewLink}
              activeOpacity={0.7}
              onPress={() => router.push('/focus-intervention?practice=prayer' as any)}
            >
              <Text style={s.previewLinkText}>Preview the shield moment →</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={enter(220 + plans.length * 60)}>
            <Text style={s.footnote}>
              App blocking becomes real once Apple grants the Screen Time permission.
              Until then, the plans you shape here are how your watches will work.
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
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
  planDimmed: {
    opacity: 0.45,
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 54,
  },
  planName: {
    flexShrink: 1,
    fontFamily: F.serifMedium,
    fontSize: 18,
    letterSpacing: -0.2,
    color: C.text,
  },
  planMeta: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 11.5,
    color: C.textSecondary,
  },
  planChipRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  strengthChip: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 999,
  },
  strengthStrict: {
    backgroundColor: C.goldLight,
  },
  strengthLoose: {
    backgroundColor: '#F4F3EF',
  },
  strengthChipText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
  metaChip: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  metaChipText: {
    fontFamily: F.sansMedium,
    fontSize: 10.5,
    color: C.textSecondary,
  },
  planSwitch: {
    position: 'absolute',
    top: 14,
    right: 16,
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
  previewLink: {
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  previewLinkText: {
    fontFamily: F.sansMedium,
    fontSize: 12.5,
    color: C.gold,
  },

  footnote: {
    marginTop: 18,
    paddingHorizontal: 22,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 16,
    color: C.textMuted,
    textAlign: 'center',
  },
});
