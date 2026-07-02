import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SectionCard from '@/components/shared/SectionCard';
import { ChevronRight, Shield, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import NowPanel from './NowPanel';
import { FOCUS_HERO_CARDS } from './focusContent';
import { formatWhen, useFocusWatch, type WatchPlan } from './focusWatchStore';

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

function UpcomingList({ plans }: { plans: WatchPlan[] }) {
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
            >
              <View style={{ flex: 1 }}>
                <Text style={s.upcomingName}>{plan.name}</Text>
                <Text style={s.upcomingMeta}>{formatWhen(plan.when)}</Text>
              </View>
              <ChevronRight s={17} c={C.textMuted} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function GuardRows() {
  const router = useRouter();
  const { strictSettings, neverAllowed } = useFocusWatch();

  const neverValue =
    neverAllowed.length === 0
      ? 'Not set'
      : neverAllowed.length === 1
        ? '1 entry'
        : `${neverAllowed.length} entries`;

  const rows = [
    {
      id: 'never-allowed',
      title: 'Never Allowed',
      value: neverValue,
      route: '/never-allowed',
      iconBg: '#FBE6E9',
      icon: <X s={14} c="#B54155" w={2.5} />,
    },
    {
      id: 'strict-watch',
      title: 'Strict Watch',
      value: strictSettings.enabled ? 'On' : 'Off',
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
  const { plans } = useFocusWatch();
  const upcoming = plans.filter(plan => plan.enabled && plan.when.kind === 'schedule');

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
            <NowPanel />
          </Animated.View>

          {upcoming.length > 0 && <UpcomingList plans={upcoming} />}

          <View style={s.heroBlock}>
            {FOCUS_HERO_CARDS.map((card, i) => (
              <Animated.View key={card.id} entering={enter(190 + i * 70)}>
                <SectionCard
                  label={card.label}
                  title={card.title}
                  description={card.description}
                  bg={card.bg}
                  border={card.border}
                  labelColor={card.labelColor}
                  titleColor={card.titleColor}
                  bodyColor={card.bodyColor}
                  arrowBg={card.arrowBg}
                  decor={card.decor}
                  onPress={() => router.push(card.route as any)}
                />
              </Animated.View>
            ))}
          </View>

          <GuardRows />
        </View>
      </ScrollView>
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
  upcomingMeta: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 11.5,
    color: C.textSecondary,
  },

  heroBlock: {
    marginTop: 18,
    marginBottom: 12,
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
