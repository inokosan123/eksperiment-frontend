import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
  FadeOutUp,
  LinearTransition,
  ZoomIn,
} from 'react-native-reanimated';
import {
  Activity,
  BarChart3,
  Calendar,
  CheckSmall,
  ChevronRight,
  Clock,
  Feather,
  Heart,
  Notebook,
  Sparkles,
  Star,
  Target,
} from '@/components/icons/Icons';
import { useMonthlyGoals, sortMonthlyGoals } from '@/components/inner-tools/MonthlyGoalsContext';
import { HapticPressable as Pressable, HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { NotoLottie } from '@/components/shared/NotoLottie';
import { normalizeHabitIcon } from '@/components/shared/notoEmoji/legacyMap';
import { F } from '@/constants/tokens';
import AnimatedSlider from './AnimatedSlider';
import { useBigEvents } from './BigEventsContext';
import { formatDateShort, getBigEventCountdown, getBigEventsForDate } from './bigEventsLogic';

export type GuidedVisualKind =
  | 'mood'
  | 'energy'
  | 'satisfaction'
  | 'prompt'
  | 'gratitude'
  | 'monthlyGoals'
  | 'upcomingEvents'
  | 'qualities'
  | 'scale'
  | 'freeWriting';

type IconComponent = React.ComponentType<{ s?: number; c?: string; w?: number }>;

type GuidedVisual = {
  accent: string;
  deep: string;
  soft: string;
  wash: readonly [string, string, string];
  Icon: IconComponent;
};

export const GUIDED_INK = '#241F18';
export const GUIDED_GOLD = '#B88A3D';
export const GUIDED_BG = '#F7F3EC';

export const GUIDED_VISUALS: Record<GuidedVisualKind, GuidedVisual> = {
  mood: {
    accent: '#C77772', deep: '#86504E', soft: '#F8EAE6',
    wash: ['#FFFDFC', '#FBF1EE', '#F7E9E4'], Icon: Heart,
  },
  energy: {
    accent: '#D19A45', deep: '#8A642B', soft: '#FAEFD9',
    wash: ['#FFFEFB', '#FBF4E6', '#F8EBD2'], Icon: Activity,
  },
  satisfaction: {
    accent: '#708F7B', deep: '#496353', soft: '#E7F0E9',
    wash: ['#FDFEFD', '#F2F7F3', '#EAF2EC'], Icon: BarChart3,
  },
  prompt: {
    accent: '#8174A8', deep: '#554C73', soft: '#ECE8F5',
    wash: ['#FEFDFE', '#F5F2FA', '#EDE9F5'], Icon: Notebook,
  },
  gratitude: {
    accent: '#B96A78', deep: '#7B4651', soft: '#F8E8EC',
    wash: ['#FFFEFE', '#FBF1F3', '#F7E7EA'], Icon: Heart,
  },
  monthlyGoals: {
    accent: '#4F8A78', deep: '#315F52', soft: '#E3F0EB',
    wash: ['#FEFFFE', '#F0F7F4', '#E5F1ED'], Icon: Target,
  },
  upcomingEvents: {
    accent: '#6275A5', deep: '#3D4C76', soft: '#E8ECF6',
    wash: ['#FEFEFF', '#F1F3F9', '#E8ECF6'], Icon: Calendar,
  },
  qualities: {
    accent: '#B28A42', deep: '#715727', soft: '#F7EEDB',
    wash: ['#FFFEFB', '#FAF5E9', '#F4ECD8'], Icon: Star,
  },
  scale: {
    accent: '#568D8B', deep: '#376260', soft: '#E4F0EF',
    wash: ['#FEFFFF', '#F0F7F6', '#E5F1F0'], Icon: BarChart3,
  },
  freeWriting: {
    accent: '#7E6B9A', deep: '#55476B', soft: '#ECE7F1',
    wash: ['#FEFDFE', '#F5F1F7', '#ECE7F1'], Icon: Feather,
  },
};

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 12);
}

export function GuidedBackdrop({ kind }: { kind?: GuidedVisualKind }) {
  const visual = kind ? GUIDED_VISUALS[kind] : undefined;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={['#FBF9F5', GUIDED_BG, '#F1EBE2']} style={StyleSheet.absoluteFill} />
      {visual && (
        <Animated.View key={kind} entering={FadeIn.duration(360)} exiting={FadeOut.duration(180)} style={StyleSheet.absoluteFill}>
          <LinearGradient colors={[visual.wash[0], visual.wash[1], '#F4EEE5']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={[v.slideBackdropOrb, { backgroundColor: visual.soft }]} />
        </Animated.View>
      )}
      <View style={[v.ambientOrb, v.ambientGold]} />
      <View style={[v.ambientOrb, v.ambientRose]} />
      <View style={[v.ambientOrb, v.ambientLavender]} />
      <View style={v.paperGrain} />
    </View>
  );
}

export function GuidedWelcome({ dateKey, stepCount }: { dateKey: string; stepCount: number }) {
  const date = dateFromKey(dateKey);
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const minutes = Math.max(4, Math.ceil(stepCount * 0.65));
  return (
    <Animated.View entering={FadeInDown.duration(420)} style={v.welcome}>
      <View style={v.crestWrap}>
        <View style={v.crestOuter} />
        <View style={v.crestMiddle} />
        <LinearGradient colors={['#2E2921', '#17140F']} style={v.crestCore}>
          <Sparkles s={31} c="#F3D89A" w={1.65} />
        </LinearGradient>
        <View style={v.crestStar}><Star s={12} c="#C59A4E" w={1.8} fill="#F7E4B7" /></View>
      </View>

      <View style={v.datePill}>
        <View style={v.dateDot} />
        <Text style={v.datePillText}>{dateLabel.toUpperCase()}</Text>
      </View>
      <Text style={v.welcomeEyebrow}>YOUR EVENING RITUAL</Text>
      <Text style={v.welcomeTitle}>Turn today into wisdom.</Text>
      <Text style={v.welcomeBody}>A calm, guided space to notice what mattered, name what you felt, and carry the right things forward.</Text>

      <View style={v.ritualCard}>
        <View style={v.ritualItem}>
          <View style={[v.ritualIcon, { backgroundColor: '#F6EBD4' }]}><Clock s={16} c="#A47A31" w={2} /></View>
          <View style={v.ritualCopy}><Text style={v.ritualLabel}>A SHORT PAUSE</Text><Text style={v.ritualValue}>About {minutes} minutes</Text></View>
        </View>
        <View style={v.ritualDivider} />
        <View style={v.ritualItem}>
          <View style={[v.ritualIcon, { backgroundColor: '#ECE8F4' }]}><Notebook s={16} c="#736493" w={2} /></View>
          <View style={v.ritualCopy}><Text style={v.ritualLabel}>GENTLE GUIDANCE</Text><Text style={v.ritualValue}>One thought at a time</Text></View>
        </View>
      </View>

      <View style={v.privateNote}>
        <View style={v.privateLine} />
        <Text style={v.privateText}>Everything saves into your Daily Journal as you go.</Text>
        <View style={v.privateLine} />
      </View>
    </Animated.View>
  );
}

export function GuidedCompletion() {
  return (
    <Animated.View entering={FadeInDown.duration(420)} style={v.completion}>
      <View style={v.completionSeal}>
        <View style={v.completionHalo} />
        <LinearGradient colors={['#64816C', '#3F5F49']} style={v.completionCore}>
          <CheckSmall s={32} c="#FFFDF7" w={2.8} />
        </LinearGradient>
      </View>
      <Text style={v.welcomeEyebrow}>REFLECTION COMPLETE</Text>
      <Text style={v.welcomeTitle}>The day can rest now.</Text>
      <Text style={v.welcomeBody}>Your thoughts, check-ins, and gratitude are safely gathered in today’s journal.</Text>
      <View style={v.savedCard}>
        <Sparkles s={17} c="#A77D35" w={1.9} />
        <View style={v.savedCopy}><Text style={v.savedTitle}>Saved to Daily Journal</Text><Text style={v.savedBody}>You can revisit or edit every answer later.</Text></View>
        <CheckSmall s={17} c="#66806E" w={2.5} />
      </View>
    </Animated.View>
  );
}

export function GuidedQuestionShell({
  kind,
  eyebrow,
  title,
  hint,
  stepIndex,
  stepCount,
  direction,
  children,
}: {
  kind: GuidedVisualKind;
  eyebrow: string;
  title: string;
  hint: string;
  stepIndex: number;
  stepCount: number;
  direction: 1 | -1;
  children: React.ReactNode;
}) {
  const visual = GUIDED_VISUALS[kind];
  const Icon = visual.Icon;
  const entering = kind === 'mood' || kind === 'energy'
    ? FadeInUp.duration(290)
    : kind === 'satisfaction' || kind === 'scale'
      ? ZoomIn.duration(260)
      : kind === 'monthlyGoals' || kind === 'upcomingEvents'
        ? FadeInDown.duration(300)
        : direction > 0
          ? FadeInRight.duration(300)
          : FadeInLeft.duration(300);
  const exiting = kind === 'mood' || kind === 'energy' || kind === 'satisfaction' || kind === 'scale'
    ? FadeOutUp.duration(180)
    : direction > 0
      ? FadeOutLeft.duration(190)
      : FadeOutRight.duration(190);
  return (
    <Animated.View entering={entering} exiting={exiting} style={v.slide}>
      <LinearGradient pointerEvents="none" colors={[visual.wash[0], `${visual.soft}8A`, `${visual.soft}00`]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={v.slideWash} />
      <View pointerEvents="none" style={[v.stageOrb, { backgroundColor: visual.soft }]} />
      <View style={v.stageMeta}>
        <View style={[v.stageIcon, { backgroundColor: `${visual.soft}CC`, borderColor: `${visual.accent}2B` }]}>
          <Icon s={20} c={visual.accent} w={2} />
        </View>
        <View style={v.stageMetaCopy}>
          <Text style={[v.stageEyebrow, { color: visual.deep }]}>{eyebrow}</Text>
          <Text style={v.stageCount}>REFLECTION {String(stepIndex + 1).padStart(2, '0')} / {String(stepCount).padStart(2, '0')}</Text>
        </View>
      </View>
      <Text style={v.stageTitle}>{title}</Text>
      <Text style={v.stageHint}>{hint}</Text>
      <View style={[v.stageRule, { backgroundColor: visual.accent }]} />
      <View style={v.stageAnswer}>{children}</View>
    </Animated.View>
  );
}

export function GuidedChoiceRow({
  kind,
  items,
  selected,
  onSelect,
}: {
  kind: 'mood' | 'energy';
  items: { name: string; label: string }[];
  selected?: number;
  onSelect: (value: number) => void;
}) {
  const visual = GUIDED_VISUALS[kind];
  return (
    <View style={v.choiceRow}>
      {items.map((item, index) => {
        const active = selected === index;
        return (
          <Pressable
            key={item.label}
            haptic="selection"
            onPress={() => onSelect(index)}
            style={[v.choice, active && v.choiceActive, active && { borderColor: `${visual.accent}70` }]}
          >
            {active && <Animated.View entering={FadeIn.duration(180)} style={[v.choiceHalo, { backgroundColor: `${visual.accent}16` }]} />}
            <Animated.View layout={LinearTransition.springify().damping(17)} style={[v.choiceEmoji, active && { backgroundColor: `${visual.soft}E8`, borderColor: `${visual.accent}42` }]}>
              <NotoLottie kind={kind as any} name={item.name as any} size={48} selected={active} />
            </Animated.View>
            <Text style={[v.choiceLabel, active && { color: visual.deep }]}>{item.label}</Text>
            <View style={[v.choiceIndicator, active && { width: 18, backgroundColor: visual.accent }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function GuidedScaleAnswer({
  value,
  label,
  kind = 'satisfaction',
  onChange,
}: {
  value: number;
  label: string;
  kind?: 'satisfaction' | 'scale';
  onChange: (value: number) => void;
}) {
  const visual = GUIDED_VISUALS[kind];
  return (
    <View style={v.scaleInstrument}>
      <View style={v.scaleNumberWrap}>
        <View style={[v.scaleHaloOuter, { borderColor: `${visual.accent}24` }]} />
        <View style={[v.scaleHaloInner, { backgroundColor: `${visual.soft}B5`, borderColor: `${visual.accent}30` }]} />
        <View style={v.scaleValueLine}>
          <Animated.Text key={value} entering={ZoomIn.duration(180)} style={[v.scaleNumber, { color: visual.deep }]}>{value}</Animated.Text>
          <Text style={[v.scaleOutOf, { color: `${visual.deep}99` }]}>/10</Text>
        </View>
      </View>
      <Text style={v.scalePrompt}>YOUR MEASURE</Text>
      <Text style={[v.scaleLabel, { color: visual.deep }]}>{label}</Text>
      <View style={v.scaleRailWrap}>
        <AnimatedSlider value={value} onChange={onChange} color={visual.accent} />
        <View style={v.scaleEdges}><Text style={v.scaleEdge}>LOW</Text><Text style={v.scaleEdge}>HIGH</Text></View>
      </View>
      <View style={v.scaleTicks}>{Array.from({ length: 10 }, (_, index) => <View key={index} style={[v.scaleTick, index < value && { backgroundColor: `${visual.accent}75` }]} />)}</View>
    </View>
  );
}

export function GuidedTextAnswer({
  value,
  onChange,
  placeholder,
  kind = 'prompt',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  kind?: 'prompt' | 'freeWriting';
}) {
  const visual = GUIDED_VISUALS[kind];
  return (
    <View style={v.writingCard}>
      <View pointerEvents="none" style={v.writingRules}>
        {Array.from({ length: 7 }, (_, index) => <View key={index} style={v.writingRule} />)}
      </View>
      <View style={v.writingHead}>
        <View style={[v.writingIcon, { backgroundColor: visual.soft }]}><Feather s={15} c={visual.accent} w={2} /></View>
        <Text style={v.writingLabel}>A PRIVATE NOTE</Text>
        <View style={v.writingLine} />
      </View>
      <View style={[v.writingMargin, { backgroundColor: `${visual.accent}42` }]} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#A69D92"
        multiline
        textAlignVertical="top"
        style={v.writingInput}
      />
      <Text style={v.writingFooter}>{value.trim().length ? `${value.trim().split(/\s+/).length} WORDS` : 'TAKE YOUR TIME'}</Text>
    </View>
  );
}

export function GuidedQualitiesAnswer({
  qualities,
  checks,
  onToggle,
}: {
  qualities: string[];
  checks: Record<string, boolean>;
  onToggle: (quality: string) => void;
}) {
  const selectedCount = qualities.filter(quality => checks[quality]).length;
  return (
    <View>
      <View style={v.qualitySummary}>
        <Text style={v.qualitySummaryLabel}>VALUES PRACTICED</Text>
        <Text style={v.qualitySummaryValue}>{selectedCount}<Text style={v.qualitySummaryOutOf}> / {qualities.length}</Text></Text>
      </View>
      <View style={v.qualityGrid}>
        {qualities.map((quality, index) => {
          const active = !!checks[quality];
          return (
            <TouchableOpacity
              key={quality}
              haptic="selection"
              activeOpacity={0.84}
              onPress={() => onToggle(quality)}
              style={[v.quality, active && v.qualityActive]}
            >
              <View style={[v.qualityIndex, active && v.qualityIndexActive]}>
                {active ? <CheckSmall s={13} c="#FFFDF7" w={3} /> : <Text style={v.qualityIndexText}>{String(index + 1).padStart(2, '0')}</Text>}
              </View>
              <Text style={[v.qualityText, active && v.qualityTextActive]} numberOfLines={2}>{quality}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function GuidedGratitudeAnswer({
  values,
  onChange,
}: {
  values: string[];
  onChange: (index: number, value: string) => void;
}) {
  return (
    <View style={v.gratitudeStack}>
      {Array.from({ length: 3 }, (_, index) => (
        <Animated.View key={index} layout={LinearTransition.duration(180)} style={v.gratitudeCard}>
          <View style={v.gratitudeNumber}><Text style={v.gratitudeNumberText}>{index + 1}</Text></View>
          <TextInput
            value={values[index] ?? ''}
            onChangeText={value => onChange(index, value)}
            placeholder={index === 0 ? 'A person, moment, or small grace…' : 'Something else you want to hold onto…'}
            placeholderTextColor="#AA9A9D"
            multiline
            style={v.gratitudeInput}
          />
          <Heart s={17} c={values[index]?.trim() ? '#B96A78' : '#D8C9CC'} w={1.8} />
        </Animated.View>
      ))}
      <View style={v.gratitudeHint}><Sparkles s={14} c="#A8737D" w={1.8} /><Text style={v.gratitudeHintText}>Three honest details are more powerful than a perfect list.</Text></View>
    </View>
  );
}

export function GuidedMonthlyGoalsReminder({ dateKey }: { dateKey: string }) {
  const router = useRouter();
  const { goalsByMonth } = useMonthlyGoals();
  const monthKey = dateKey.slice(0, 7);
  const monthGoals = sortMonthlyGoals(goalsByMonth[monthKey] ?? []);
  const completed = monthGoals.filter(goal => goal.isCompleted).length;
  const pct = monthGoals.length ? Math.round((completed / monthGoals.length) * 100) : 0;
  const monthName = dateFromKey(`${monthKey}-01`).toLocaleDateString('en-US', { month: 'long' });

  return (
    <View style={v.reminderWrap}>
      <View style={v.goalSummary}>
        <View style={v.goalSummaryCopy}><Text style={v.goalSummaryEyebrow}>{monthName.toUpperCase()} FOCUS</Text><Text style={v.goalSummaryTitle}>{monthGoals.length ? `${monthGoals.length - completed} intentions still open` : 'Choose what matters this month'}</Text></View>
        <View style={v.goalPercent}><Text style={v.goalPercentValue}>{pct}%</Text><Text style={v.goalPercentLabel}>DONE</Text></View>
        <View style={v.goalProgress}><View style={[v.goalProgressFill, { width: `${pct}%` }]} /></View>
      </View>

      {monthGoals.length ? (
        <View style={v.goalList}>
          {monthGoals.slice(0, 4).map((goal, index) => (
            <View key={goal.id} style={[v.goalRow, goal.isCompleted && v.goalRowDone]}>
              <View style={[v.goalRoman, goal.isCompleted && v.goalRomanDone]}>
                {goal.isCompleted ? <CheckSmall s={13} c="#FFF" w={3} /> : <Text style={v.goalRomanText}>{index + 1}</Text>}
              </View>
              <Text style={[v.goalText, goal.isCompleted && v.goalTextDone]} numberOfLines={2}>{goal.text}</Text>
            </View>
          ))}
          {monthGoals.length > 4 && <Text style={v.moreText}>+ {monthGoals.length - 4} MORE INTENTIONS</Text>}
        </View>
      ) : (
        <View style={v.emptyReminder}><Target s={25} c="#5A8D7F" w={1.8} /><Text style={v.emptyReminderTitle}>No monthly goals yet</Text><Text style={v.emptyReminderBody}>Set a clear direction and let this reflection keep it close.</Text></View>
      )}

      <TouchableOpacity onPress={() => router.push('/monthly-goals')} activeOpacity={0.84} style={v.manageLink}>
        <Text style={[v.manageText, { color: '#3F7667' }]}>VIEW MONTHLY GOALS</Text><ChevronRight s={16} c="#3F7667" w={2.2} />
      </TouchableOpacity>
    </View>
  );
}

export function GuidedUpcomingEventsReminder({ dateKey }: { dateKey: string }) {
  const router = useRouter();
  const { bigEvents } = useBigEvents();
  const events = getBigEventsForDate(bigEvents, dateKey, 3);
  const openEvents = () => router.push('/big-events' as any);

  if (!events.length) {
    return (
      <View style={v.reminderWrap}>
        <View style={v.emptyEventHero}>
          <View style={v.emptyEventIcon}><Calendar s={25} c="#6174A2" w={1.8} /></View>
          <Text style={v.emptyReminderTitle}>The horizon is clear</Text>
          <Text style={v.emptyReminderBody}>Add an important date and it will meet you here during reflection.</Text>
        </View>
        <TouchableOpacity onPress={openEvents} activeOpacity={0.84} style={v.manageLink}>
          <Text style={[v.manageText, { color: '#556A9C' }]}>ADD A BIG EVENT</Text><ChevronRight s={16} c="#556A9C" w={2.2} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={v.reminderWrap}>
      {events.map((event, index) => {
        const days = getBigEventCountdown(event, dateKey);
        const isToday = days === 0;
        if (index === 0) {
          return (
            <TouchableOpacity key={event.id} onPress={openEvents} activeOpacity={0.88}>
              <View style={v.eventHero}>
                <View pointerEvents="none" style={[v.eventHeroWash, { backgroundColor: `${event.color}18` }]} />
                <View style={v.eventHeroTop}>
                  <View style={[v.eventIcon, { backgroundColor: `${event.color}24` }]}><NotoEmoji name={normalizeHabitIcon(event.icon)} size={27} /></View>
                  <View style={[v.eventStatus, { backgroundColor: isToday ? event.color : `${event.color}18` }]}><Text style={[v.eventStatusText, !isToday && { color: event.color }]}>{isToday ? 'TODAY' : 'UPCOMING'}</Text></View>
                </View>
                <Text style={v.eventHeroTitle}>{event.title}</Text>
                <View style={v.eventHeroBottom}>
                  <View><Text style={v.eventDateLabel}>EVENT DATE</Text><Text style={v.eventDate}>{formatDateShort(event.endDate)}</Text></View>
                  <View style={v.eventCountdown}><Text style={[v.eventCount, { color: event.color }]}>{isToday ? 'NOW' : days}</Text>{!isToday && <Text style={v.eventCountLabel}>{days === 1 ? 'DAY' : 'DAYS'}</Text>}</View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity key={event.id} onPress={openEvents} activeOpacity={0.84} style={v.eventRow}>
            <View style={[v.eventRowIcon, { backgroundColor: `${event.color}1D` }]}><NotoEmoji name={normalizeHabitIcon(event.icon)} size={20} /></View>
            <View style={v.eventRowCopy}><Text style={v.eventRowTitle} numberOfLines={1}>{event.title}</Text><Text style={v.eventRowDate}>{formatDateShort(event.endDate)}</Text></View>
            <Text style={[v.eventRowDays, { color: event.color }]}>{days === 0 ? 'TODAY' : `${days}D`}</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity onPress={openEvents} activeOpacity={0.84} style={v.manageLink}>
        <Text style={[v.manageText, { color: '#556A9C' }]}>OPEN BIG EVENTS</Text><ChevronRight s={16} c="#556A9C" w={2.2} />
      </TouchableOpacity>
    </View>
  );
}

const v = StyleSheet.create({
  ambientOrb: { position: 'absolute', borderRadius: 999, opacity: 0.6 },
  slideBackdropOrb: { position: 'absolute', width: 430, height: 430, borderRadius: 215, top: 110, right: -260, opacity: 0.42 },
  ambientGold: { width: 280, height: 280, top: -150, right: -130, backgroundColor: 'rgba(225,197,139,0.18)' },
  ambientRose: { width: 220, height: 220, bottom: 50, left: -150, backgroundColor: 'rgba(209,156,151,0.11)' },
  ambientLavender: { width: 180, height: 180, top: '41%', right: -130, backgroundColor: 'rgba(139,124,174,0.08)' },
  paperGrain: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: 'rgba(97,76,47,0.018)' },

  welcome: { alignItems: 'center', width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 6 },
  crestWrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  crestOuter: { position: 'absolute', width: 104, height: 104, borderRadius: 52, borderWidth: 1, borderColor: 'rgba(184,138,61,0.2)' },
  crestMiddle: { position: 'absolute', width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(184,138,61,0.24)' },
  crestCore: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 28px rgba(34,28,19,0.24)' },
  crestStar: { position: 'absolute', right: 5, top: 13, width: 25, height: 25, borderRadius: 13, backgroundColor: '#FFF9EC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EAD4A5' },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: 'rgba(163,132,76,0.16)' },
  dateDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: GUIDED_GOLD },
  datePillText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.35, color: '#7A6C57' },
  welcomeEyebrow: { marginTop: 18, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.35, color: '#A17B39' },
  welcomeTitle: { marginTop: 9, maxWidth: 345, textAlign: 'center', fontFamily: F.serifSemiBold, fontSize: 36, lineHeight: 40, letterSpacing: -0.5, color: GUIDED_INK },
  welcomeBody: { marginTop: 14, maxWidth: 340, textAlign: 'center', fontFamily: F.serifMedium, fontSize: 16.5, lineHeight: 24, color: '#746A5D' },
  ritualCard: { width: '100%', marginTop: 25, padding: 8, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(131,105,69,0.11)', boxShadow: '0 12px 30px rgba(80,62,40,0.08)' },
  ritualItem: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 9 },
  ritualIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  ritualCopy: { flex: 1 }, ritualLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.45, color: '#A09484' }, ritualValue: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 15.5, color: '#443B31' },
  ritualDivider: { height: 1, marginLeft: 57, marginRight: 10, backgroundColor: 'rgba(117,95,65,0.09)' },
  privateNote: { marginTop: 22, width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10 },
  privateLine: { flex: 1, height: 1, backgroundColor: 'rgba(130,106,73,0.12)' }, privateText: { maxWidth: 235, textAlign: 'center', fontFamily: F.serifMediumItalic, fontSize: 12.5, lineHeight: 17, color: '#948878' },

  completion: { alignItems: 'center', width: '100%', maxWidth: 420, alignSelf: 'center', paddingHorizontal: 8 },
  completionSeal: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  completionHalo: { position: 'absolute', width: 112, height: 112, borderRadius: 56, backgroundColor: 'rgba(91,126,101,0.1)', borderWidth: 1, borderColor: 'rgba(91,126,101,0.2)' },
  completionCore: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', boxShadow: '0 14px 30px rgba(56,84,63,0.24)' },
  savedCard: { width: '100%', marginTop: 26, minHeight: 72, borderRadius: 20, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: 'rgba(115,94,63,0.12)' },
  savedCopy: { flex: 1 }, savedTitle: { fontFamily: F.serifMedium, fontSize: 16, color: '#40372D' }, savedBody: { marginTop: 3, fontFamily: F.sansMedium, fontSize: 10.5, lineHeight: 15, color: '#928779' },

  slide: { flexGrow: 1, width: '100%', maxWidth: 500, minHeight: 510, alignSelf: 'center', paddingTop: 12, paddingBottom: 18 },
  slideWash: { position: 'absolute', left: -32, right: -32, top: -38, height: 265, opacity: 0.78 },
  stageOrb: { position: 'absolute', width: 168, height: 168, borderRadius: 84, right: -108, top: -70, opacity: 0.48 },
  stageMeta: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  stageIcon: { width: 43, height: 43, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stageMetaCopy: { flex: 1 }, stageEyebrow: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 1.9 }, stageCount: { marginTop: 3, fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.15, color: '#A3998B' },
  stageTitle: { marginTop: 24, maxWidth: 430, fontFamily: F.serifSemiBold, fontSize: 34, lineHeight: 38, letterSpacing: -0.55, color: GUIDED_INK },
  stageHint: { marginTop: 11, maxWidth: 390, fontFamily: F.serifMedium, fontSize: 15.5, lineHeight: 22, color: '#766D61' },
  stageRule: { marginTop: 17, width: 42, height: 2, borderRadius: 2, opacity: 0.62 },
  stageAnswer: { marginTop: 21, flex: 1, justifyContent: 'center', paddingBottom: 4 },

  choiceRow: { minHeight: 154, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2 },
  choice: { flex: 1, minWidth: 0, minHeight: 142, paddingTop: 14, paddingBottom: 8, paddingHorizontal: 1, borderRadius: 22, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  choiceActive: { backgroundColor: 'rgba(255,255,255,0.38)' },
  choiceHalo: { position: 'absolute', width: 92, height: 92, borderRadius: 46, top: 5 },
  choiceEmoji: { width: 66, height: 66, borderRadius: 33, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  choiceLabel: { marginTop: 10, fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 0.7, color: '#8F867A', textAlign: 'center' },
  choiceIndicator: { marginTop: 11, width: 4, height: 3, borderRadius: 2, backgroundColor: 'rgba(120,105,84,0.13)' },

  scaleInstrument: { alignItems: 'center', paddingHorizontal: 2 },
  scaleNumberWrap: { width: 186, height: 126, alignItems: 'center', justifyContent: 'center' },
  scaleHaloOuter: { position: 'absolute', width: 126, height: 126, borderRadius: 63, borderWidth: 1 },
  scaleHaloInner: { position: 'absolute', width: 101, height: 101, borderRadius: 51, borderWidth: 1 },
  scaleValueLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  scaleNumber: { fontFamily: F.serifSemiBold, fontSize: 66, lineHeight: 72, fontVariant: ['tabular-nums'] },
  scaleOutOf: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 0.3 },
  scalePrompt: { marginTop: 8, fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.75, color: '#A3998B', textAlign: 'center' },
  scaleLabel: { marginTop: 6, fontFamily: F.serifSemiBold, fontSize: 21, lineHeight: 25, textAlign: 'center' },
  scaleRailWrap: { width: '100%', marginTop: 24 }, scaleEdges: { marginTop: -1, flexDirection: 'row', justifyContent: 'space-between' }, scaleEdge: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.2, color: '#AAA093' },
  scaleTicks: { marginTop: 12, flexDirection: 'row', gap: 4 }, scaleTick: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(117,101,81,0.11)' },

  writingCard: { minHeight: 254, paddingTop: 1, paddingBottom: 8, overflow: 'hidden', borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(113,91,62,0.13)' },
  writingRules: { position: 'absolute', left: 0, right: 0, top: 61, gap: 31 },
  writingRule: { height: 1, backgroundColor: 'rgba(113,91,62,0.09)' },
  writingHead: { flexDirection: 'row', alignItems: 'center', gap: 8 }, writingIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, writingLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.55, color: '#93887B' }, writingLine: { flex: 1, height: 1, backgroundColor: 'rgba(119,99,73,0.1)' },
  writingMargin: { position: 'absolute', left: 9, top: 57, bottom: 20, width: 1 },
  writingInput: { minHeight: 192, paddingTop: 17, paddingLeft: 22, paddingRight: 4, paddingBottom: 20, fontFamily: F.serifMedium, fontSize: 18, lineHeight: 32, color: '#383128' },
  writingFooter: { position: 'absolute', right: 15, bottom: 11, fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1.15, color: '#B0A79B' },

  qualitySummary: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 2, marginBottom: 11 }, qualitySummaryLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.5, color: '#9B8E7A' }, qualitySummaryValue: { fontFamily: F.serifSemiBold, fontSize: 25, color: '#896929' }, qualitySummaryOutOf: { fontSize: 13, color: '#AB9A7C' },
  qualityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quality: { width: '48.7%', minHeight: 58, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.62)', borderWidth: 1, borderColor: 'rgba(137,111,64,0.12)' },
  qualityActive: { backgroundColor: '#F4E8CA', borderColor: '#D8B870' }, qualityIndex: { width: 26, height: 26, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0ECE4' }, qualityIndexActive: { backgroundColor: '#B18A42' }, qualityIndexText: { fontFamily: F.sansBold, fontSize: 8, color: '#A0988D' }, qualityText: { flex: 1, fontFamily: F.serifMedium, fontSize: 14, lineHeight: 17, color: '#62584A' }, qualityTextActive: { color: '#715727' },

  gratitudeStack: { gap: 2 }, gratitudeCard: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(151,88,100,0.16)' }, gratitudeNumber: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#F7E6EA', alignItems: 'center', justifyContent: 'center' }, gratitudeNumberText: { fontFamily: F.serifSemiBold, fontSize: 16, color: '#A85E6D' }, gratitudeInput: { flex: 1, minHeight: 48, paddingVertical: 8, fontFamily: F.serifMedium, fontSize: 16, lineHeight: 22, color: '#4C3B3F' }, gratitudeHint: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, gratitudeHintText: { flexShrink: 1, fontFamily: F.serifMediumItalic, fontSize: 12, lineHeight: 16, color: '#9A777E' },

  reminderWrap: { gap: 10 },
  goalSummary: { minHeight: 124, paddingTop: 9, paddingBottom: 24, overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: 'rgba(63,118,103,0.16)' }, goalSummaryCopy: { paddingRight: 92 }, goalSummaryEyebrow: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.7, color: '#668F83' }, goalSummaryTitle: { marginTop: 7, fontFamily: F.serifSemiBold, fontSize: 22, lineHeight: 26, color: '#2F5248' }, goalPercent: { position: 'absolute', right: 2, top: 4, alignItems: 'flex-end' }, goalPercentValue: { fontFamily: F.serifSemiBold, fontSize: 34, lineHeight: 38, color: '#3F7667', fontVariant: ['tabular-nums'] }, goalPercentLabel: { marginTop: -2, fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1.25, color: '#75958C' }, goalProgress: { position: 'absolute', left: 0, right: 0, bottom: 10, height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(63,118,103,0.11)' }, goalProgressFill: { height: '100%', borderRadius: 3, backgroundColor: '#5F9182' },
  goalList: { paddingTop: 2 }, goalRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: 'rgba(80,107,93,0.1)' }, goalRowDone: { opacity: 0.55 }, goalRoman: { width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5F0EC' }, goalRomanDone: { backgroundColor: '#648D7F' }, goalRomanText: { fontFamily: F.sansBold, fontSize: 9, color: '#467565' }, goalText: { flex: 1, fontFamily: F.serifMedium, fontSize: 15, lineHeight: 19, color: '#3E4C45' }, goalTextDone: { textDecorationLine: 'line-through', color: '#7C8A83' }, moreText: { paddingVertical: 10, textAlign: 'center', fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.3, color: '#7E968C' },
  emptyReminder: { minHeight: 160, padding: 22, alignItems: 'center', justifyContent: 'center' }, emptyReminderTitle: { marginTop: 10, textAlign: 'center', fontFamily: F.serifSemiBold, fontSize: 21, color: '#3D3A36' }, emptyReminderBody: { marginTop: 6, maxWidth: 275, textAlign: 'center', fontFamily: F.serifMedium, fontSize: 13.5, lineHeight: 19, color: '#827B73' },
  manageLink: { minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderTopWidth: 1, borderTopColor: 'rgba(105,91,72,0.08)' }, manageText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.35 },

  emptyEventHero: { minHeight: 194, padding: 22, alignItems: 'center', justifyContent: 'center' }, emptyEventIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7EBF5' },
  eventHero: { minHeight: 214, paddingVertical: 13, overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: 'rgba(86,103,147,0.14)' }, eventHeroWash: { position: 'absolute', width: 190, height: 190, borderRadius: 95, right: -48, top: -64 }, eventHeroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eventIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }, eventStatus: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 }, eventStatusText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.3, color: '#FFF' }, eventHeroTitle: { marginTop: 18, maxWidth: 290, fontFamily: F.serifSemiBold, fontSize: 26, lineHeight: 30, color: '#30313A' }, eventHeroBottom: { marginTop: 'auto', paddingTop: 17, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, eventDateLabel: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1.35, color: '#9A9BA5' }, eventDate: { marginTop: 4, fontFamily: F.serifMedium, fontSize: 15, color: '#555866' }, eventCountdown: { flexDirection: 'row', alignItems: 'baseline', gap: 4 }, eventCount: { fontFamily: F.serifSemiBold, fontSize: 39, lineHeight: 41, fontVariant: ['tabular-nums'] }, eventCountLabel: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.1, color: '#9496A1' },
  eventRow: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: 'rgba(92,108,151,0.1)' }, eventRowIcon: { width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, eventRowCopy: { flex: 1 }, eventRowTitle: { fontFamily: F.serifMedium, fontSize: 15, color: '#3D3E47' }, eventRowDate: { marginTop: 2, fontFamily: F.sansMedium, fontSize: 9.5, color: '#999AA3' }, eventRowDays: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.1 },
});
