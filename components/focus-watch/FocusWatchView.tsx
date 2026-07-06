import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { Calendar, Clock, Globe, Shield } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import NowPanel from './NowPanel';
import FocusHeroCardView, { type HeroMetaItem } from './FocusHeroCard';
import TrophyCalendarSheet from './TrophyCalendarSheet';
import MilestoneCongratsOverlay from './MilestoneCongratsOverlay';
import { CLEAN_SIGHT_CARD, DAY_PLAN_CARD } from './focusContent';
import {
  acknowledgeMilestone,
  formatTimeOfDay,
  getEffectivePlan,
  nextZoneStart,
  purityActiveCount,
  useDayPlan,
} from './dayPlanStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

export default function FocusWatchView() {
  const router = useRouter();
  const state = useDayPlan();
  const [clock] = useState(() => new Date());
  const [trophiesOpen, setTrophiesOpen] = useState(false);

  const todayPlan = getEffectivePlan(state, clock);
  const nextZone = nextZoneStart(todayPlan, clock);

  const dayPlanMeta: HeroMetaItem[] = useMemo(() => {
    const items: HeroMetaItem[] = [
      {
        icon: <Calendar s={12} c={DAY_PLAN_CARD.labelColor} w={2.2} />,
        text: `Today: ${todayPlan ? todayPlan.name : 'Rest day'}`,
      },
    ];
    if (nextZone) {
      items.push({
        icon: <Clock s={12} c={DAY_PLAN_CARD.labelColor} w={2.2} />,
        text: `Next: ${nextZone.name} ${formatTimeOfDay(nextZone.startMinutes)}`,
      });
    } else {
      items.push({
        icon: <Clock s={12} c={DAY_PLAN_CARD.labelColor} w={2.2} />,
        text: `${state.plans.length} ${state.plans.length === 1 ? 'plan' : 'plans'} · week set`,
      });
    }
    return items;
  }, [todayPlan, nextZone, state.plans.length]);

  const cleanSightMeta: HeroMetaItem[] = useMemo(() => {
    const packsOn = state.purity.packs.filter(pack => pack.mode !== 'off').length;
    const sites = state.purity.customDomains.length;
    return [
      {
        icon: <Shield s={12} c={CLEAN_SIGHT_CARD.labelColor} w={2.2} />,
        text: packsOn === 0 ? 'No packs on yet' : `${packsOn} ${packsOn === 1 ? 'pack' : 'packs'} on`,
      },
      {
        icon: <Globe s={12} c={CLEAN_SIGHT_CARD.labelColor} w={2.2} />,
        text: `${sites} ${sites === 1 ? 'site' : 'sites'}${state.purity.locks.enabled ? ' · locks on' : ''}`,
      },
    ];
  }, [state.purity]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="FOCUS" />
        <View style={s.quoteWrap}>
          <Text style={s.quote}>
            {'"Be sober, be vigilant; because your adversary the devil, as a roaring lion, walketh about, seeking whom he may devour."'}
          </Text>
          <Text style={s.ref}>1 PETER 5:8</Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <Animated.View entering={enter(40)}>
            <NowPanel onOpenTrophies={() => setTrophiesOpen(true)} />
          </Animated.View>

          <View style={s.heroBlock}>
            <Animated.View entering={enter(190)}>
              <FocusHeroCardView
                card={DAY_PLAN_CARD}
                meta={dayPlanMeta}
                onPress={() => router.push(DAY_PLAN_CARD.route as any)}
              />
            </Animated.View>
            <Animated.View entering={enter(260)}>
              <FocusHeroCardView
                card={CLEAN_SIGHT_CARD}
                meta={cleanSightMeta}
                onPress={() => router.push(CLEAN_SIGHT_CARD.route as any)}
              />
            </Animated.View>
          </View>

          {purityActiveCount(state.purity) === 0 && state.plans.length === 0 && (
            <Animated.View entering={enter(320)}>
              <Text style={s.footnote}>
                Blocking becomes real once the Screen Time permission arrives.
                Shape your plans now — they will stand ready.
              </Text>
            </Animated.View>
          )}
        </View>
      </ScrollView>

      <TrophyCalendarSheet visible={trophiesOpen} onClose={() => setTrophiesOpen(false)} />
      <MilestoneCongratsOverlay
        milestone={state.pendingMilestone}
        onClose={acknowledgeMilestone}
      />
    </View>
  );
}

const s = StyleSheet.create({
  quoteWrap: {
    paddingHorizontal: 26,
    paddingTop: 8,
    paddingBottom: 6,
    alignItems: 'center',
  },
  quote: {
    fontFamily: F.serifMediumItalic,
    fontSize: 16.5,
    color: C.textSecondary,
    lineHeight: 21.5,
    textAlign: 'center',
  },
  ref: {
    marginTop: 10,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.gold,
  },

  heroBlock: {
    marginTop: 16,
    marginBottom: 12,
    gap: 6,
  },

  footnote: {
    marginTop: 6,
    paddingHorizontal: 22,
    fontFamily: F.sans,
    fontSize: 11,
    lineHeight: 16,
    color: C.textMuted,
    textAlign: 'center',
  },
});
