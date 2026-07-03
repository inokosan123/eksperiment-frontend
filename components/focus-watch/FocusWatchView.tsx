import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { ChevronRight, Clock, Globe, ListChecks, Shield, Smartphone, X } from '@/components/icons/Icons';
import StreakFlame from './StreakFlame';
import WatchStatsSheet from './WatchStatsSheet';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusSwitch from './FocusSwitch';
import NowPanel from './NowPanel';
import FocusHeroCardView, { type HeroMetaItem } from './FocusHeroCard';
import { CLEAN_SIGHT_CARD, PROTECT_TIME_CARD } from './focusContent';
import {
  formatTimeRange,
  nextScheduleLabel,
  selectionCount,
  toggleAllowlistMode,
  useFocusWatch,
  type WatchPlan,
} from './focusWatchStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

function DayDots({ days }: { days: number[] }) {
  return (
    <View style={s.dayDotsRow}>
      {Array.from({ length: 7 }, (_, day) => (
        <View
          key={day}
          style={[s.dayDot, days.includes(day) ? s.dayDotOn : s.dayDotOff]}
        />
      ))}
    </View>
  );
}

function UpcomingList({
  plans,
  onStats,
}: {
  plans: WatchPlan[];
  onStats: (plan: WatchPlan) => void;
}) {
  const router = useRouter();

  return (
    <Animated.View entering={enter(120)}>
      <Text style={s.sectionLabel}>UPCOMING</Text>
      <View style={s.groupCard}>
        {plans.map((plan, i) => (
          <View key={plan.id}>
            {i > 0 && <View style={s.separator} />}
            <TouchableOpacity
              style={s.upcomingRow}
              activeOpacity={0.7}
              onPress={() => router.push(`/watch-plan?planId=${plan.id}` as any)}
              onLongPress={() => onStats(plan)}
              delayLongPress={320}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.upcomingName}>{plan.name}</Text>
                <View style={s.upcomingMetaRow}>
                  {plan.when.kind === 'schedule' && <DayDots days={plan.when.days} />}
                  <Text style={s.upcomingMeta}>{formatTimeRange(plan.when)}</Text>
                </View>
              </View>
              {plan.streak > 0 && (
                <View style={s.upcomingStreak}>
                  <StreakFlame count={plan.streak} />
                </View>
              )}
              <ChevronRight s={17} c={C.textMuted} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function SimplePhoneCard() {
  const router = useRouter();
  const { allowlistMode, allowlistConfig } = useFocusWatch();
  const keptCount = selectionCount(allowlistConfig.keep);
  const sub = allowlistMode
    ? `On · essentials${keptCount > 0 ? ` + ${keptCount} kept open` : ' only'}`
    : 'One phone, only what matters.';

  return (
    <Animated.View entering={enter(300)}>
      <LinearGradient
        colors={['#FFFBF2', '#FFF8E7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.simpleCard}
      >
        <TouchableOpacity
          style={s.simpleMain}
          activeOpacity={0.82}
          onPress={() => router.push('/simple-phone' as any)}
        >
          <View style={s.simpleIcon}>
            <Smartphone s={16} c={C.gold} w={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.simpleTitle}>Simple Phone</Text>
            <Text style={s.simpleSub}>{sub}</Text>
          </View>
        </TouchableOpacity>
        <FocusSwitch value={allowlistMode} onToggle={toggleAllowlistMode} />
      </LinearGradient>
    </Animated.View>
  );
}

function GuardRows() {
  const router = useRouter();
  const { strictSettings, neverAllowed, neverPacks } = useFocusWatch();

  const neverCount = neverAllowed.length + neverPacks.filter(pack => pack.enabled).length;
  const neverValue =
    neverCount === 0 ? 'Not set' : neverCount === 1 ? '1 door closed' : `${neverCount} doors closed`;

  const rows = [
    {
      id: 'never-allowed',
      title: 'Never Allowed',
      value: neverValue,
      dotColor: neverCount > 0 ? '#B54155' : null,
      route: '/never-allowed',
      iconBg: '#FBE6E9',
      icon: <X s={14} c="#B54155" w={2.5} />,
    },
    {
      id: 'strict-watch',
      title: 'Strict Watch',
      value: strictSettings.enabled ? 'On' : 'Off',
      dotColor: strictSettings.enabled ? C.gold : null,
      route: '/strict-watch',
      iconBg: C.goldLight,
      icon: <Shield s={15} c={C.goldDark} w={2.2} />,
    },
  ];

  return (
    <Animated.View entering={enter(320)}>
      <View style={s.groupCard}>
        {rows.map((row, i) => (
          <View key={row.id}>
            {i > 0 && <View style={s.separator} />}
            <TouchableOpacity
              style={s.guardRow}
              activeOpacity={0.7}
              onPress={() => router.push(row.route as any)}
            >
              <View style={[s.guardIcon, { backgroundColor: row.iconBg }]}>{row.icon}</View>
              <Text style={s.guardTitle}>{row.title}</Text>
              {row.dotColor && <View style={[s.statusDot, { backgroundColor: row.dotColor }]} />}
              <Text style={s.guardValue}>{row.value}</Text>
              <ChevronRight s={17} c={C.textMuted} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

export default function FocusWatchView() {
  const router = useRouter();
  const { plans, webPacks, customDomains } = useFocusWatch();
  const [statsPlan, setStatsPlan] = useState<WatchPlan | null>(null);
  const upcoming = plans.filter(plan => plan.enabled && plan.when.kind === 'schedule');

  const enabledPlans = plans.filter(plan => plan.enabled).length;
  const nextLabel = nextScheduleLabel(plans);
  const protectMeta: HeroMetaItem[] = [
    {
      icon: <ListChecks s={12} c={PROTECT_TIME_CARD.labelColor} w={2.2} />,
      text: `${enabledPlans} of ${plans.length} plans on`,
    },
    ...(nextLabel
      ? [
          {
            icon: <Clock s={12} c={PROTECT_TIME_CARD.labelColor} w={2.2} />,
            text: `Next: ${nextLabel}`,
          },
        ]
      : []),
  ];

  const enabledPacks = webPacks.filter(pack => pack.enabled).length;
  const cleanMeta: HeroMetaItem[] = [
    {
      icon: <Shield s={12} c={CLEAN_SIGHT_CARD.labelColor} w={2.2} />,
      text:
        enabledPacks === 0 ? 'No packs on yet' : `${enabledPacks} ${enabledPacks === 1 ? 'pack' : 'packs'} on`,
    },
    {
      icon: <Globe s={12} c={CLEAN_SIGHT_CARD.labelColor} w={2.2} />,
      text: `${customDomains.length} custom ${customDomains.length === 1 ? 'site' : 'sites'}`,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="FOCUS" />
        <View style={s.quoteWrap}>
          <Text style={s.quote}>{'"Be sober, be vigilant."'}</Text>
          <Text style={s.ref}>1 PETER 5:8</Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <Animated.View entering={enter(40)}>
            <NowPanel />
          </Animated.View>

          {upcoming.length > 0 && <UpcomingList plans={upcoming} onStats={setStatsPlan} />}

          <View style={s.heroBlock}>
            <Animated.View entering={enter(190)}>
              <FocusHeroCardView
                card={PROTECT_TIME_CARD}
                meta={protectMeta}
                onPress={() => router.push(PROTECT_TIME_CARD.route as any)}
              />
            </Animated.View>
            <Animated.View entering={enter(260)}>
              <FocusHeroCardView
                card={CLEAN_SIGHT_CARD}
                meta={cleanMeta}
                onPress={() => router.push(CLEAN_SIGHT_CARD.route as any)}
              />
            </Animated.View>
          </View>

          <SimplePhoneCard />

          <GuardRows />
        </View>
      </ScrollView>

      <WatchStatsSheet plan={statsPlan} onClose={() => setStatsPlan(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  quoteWrap: { paddingHorizontal: 26, paddingTop: 8, paddingBottom: 6, alignItems: 'center' },
  quote: { fontFamily: F.serifMediumItalic, fontSize: 17, color: C.textSecondary, lineHeight: 21.5, textAlign: 'center' },
  ref: { marginTop: 10, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.gold },

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
    marginLeft: 16,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  upcomingName: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    color: C.text,
  },
  upcomingMetaRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  upcomingMeta: {
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    color: C.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  dayDotsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  dayDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
  },
  dayDotOn: {
    backgroundColor: C.gold,
  },
  dayDotOff: {
    backgroundColor: '#E9E7E1',
  },
  upcomingStreak: {
    marginRight: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 2,
  },

  heroBlock: {
    marginTop: 18,
    marginBottom: 12,
  },

  // Simple Phone toggle card — same grammar as the ReadingList task toggle.
  simpleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(232,220,196,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 12,
  },
  simpleMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  simpleIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(197,160,89,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleTitle: {
    fontFamily: F.sansSemiBold,
    fontSize: 14,
    color: '#374151',
    lineHeight: 18,
  },
  simpleSub: {
    fontFamily: F.sans,
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    lineHeight: 16,
  },

  guardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  guardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardTitle: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 17.5,
    color: C.text,
  },
  guardValue: {
    fontFamily: F.sansMedium,
    fontSize: 12,
    color: C.textMuted,
  },
});
