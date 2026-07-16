import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Reanimated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ChevronLeft, ChevronRight } from '@/components/icons/Icons';
import HairlineWeave from '@/components/focus-watch/HairlineWeave';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { useJournal } from '@/components/journal/JournalContext';
import {
  hasDailyJournalContent,
  hasFreeWritingContent,
  isMorningPagesComplete,
} from '@/components/journal/journalLogic';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


const BG = '#FAF7F0';
const GOLD = '#C5A059';
const PURPLE = '#7C6EAF';
const TEAL = '#4A9E8F';
const INK = '#1C1917';

const PIXEL_SIZE = 11.5;
const PIXEL_GAP = 2.5;
const RING_R = 42;
const RING_CIRC = 2 * Math.PI * RING_R;

const MOOD_COLORS = ['', '#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];
const ENERGY_COLORS = ['', '#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];

function scaleColor(value: number) {
  if (value <= 2) return '#EF4444';
  if (value <= 4) return '#F97316';
  if (value <= 6) return '#EAB308';
  if (value <= 8) return '#84CC16';
  return '#22C55E';
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type TabType = 'mood' | 'energy' | 'satisfaction' | 'daily_journal' | 'morning_pages' | 'free_writing' | 'custom';

type TabDef = {
  id: string;
  label: string;
  type: TabType;
  scaleId?: string;
};

// Each picker family wears its own gradient when chosen — gold for the
// scales, the technique colors for the techniques, matching the hub.
const TAB_GRADIENTS: Record<'gold' | 'purple' | 'teal', readonly [string, string, string]> = {
  gold: ['#E2BD75', '#C5A059', '#A87E33'],
  purple: ['#9C8CC9', '#7C6EAF', '#5D5090'],
  teal: ['#6FBCAC', '#4A9E8F', '#357B6E'],
};

function tabFamily(type: TabType): 'gold' | 'purple' | 'teal' {
  if (type === 'morning_pages') return 'purple';
  if (type === 'free_writing') return 'teal';
  return 'gold';
}

// Resting chips wear their family's card tints; every chip carries its own
// micro-spectrum — five tones for the scales, one gem for the techniques —
// so the picker reads at a glance.
const TAB_TINTS: Record<'gold' | 'purple' | 'teal', { bg: string; border: string; ink: string }> = {
  gold: { bg: '#FBF3DE', border: '#F0E3B8', ink: '#A9863F' },
  purple: { bg: '#EEEAF5', border: '#DDD5ED', ink: '#6D5AAE' },
  teal: { bg: '#E1F1EC', border: '#C8E6DD', ink: '#3D8273' },
};

function tabDots(type: TabType): string[] {
  if (type === 'morning_pages') return [PURPLE];
  if (type === 'free_writing') return [TEAL];
  if (type === 'daily_journal') return [GOLD];
  return MOOD_COLORS.slice(1);
}

// A title that glides: if the text is wider than its box, it drifts gently
// back and forth inside it. The box is measured once from layout and the
// text from its own line metrics — both guarded against sub-pixel churn so
// nothing ever flickers.
function MarqueeText({ text, textStyle }: { text: string; textStyle: object }) {
  const reduceMotion = useReducedMotion();
  const [boxW, setBoxW] = useState(0);
  const [textW, setTextW] = useState(0);
  const overflow = boxW > 0 && textW > boxW + 1;
  const shift = useSharedValue(0);

  useEffect(() => {
    if (!overflow || reduceMotion) {
      cancelAnimation(shift);
      shift.value = 0;
      return;
    }
    const distance = textW - boxW;
    const travel = Math.max(1400, distance * 32);
    shift.value = 0;
    shift.value = withRepeat(
      withSequence(
        withDelay(1200, withTiming(-distance, { duration: travel, easing: Easing.inOut(Easing.quad) })),
        withDelay(1200, withTiming(0, { duration: travel, easing: Easing.inOut(Easing.quad) }))
      ),
      -1
    );
    return () => cancelAnimation(shift);
  }, [overflow, textW, boxW, reduceMotion, shift]);

  const glide = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));

  return (
    <View
      style={s.marqueeBox}
      onLayout={event => {
        const w = Math.round(event.nativeEvent.layout.width);
        if (w > 0 && Math.abs(w - boxW) > 1) setBoxW(w);
      }}
    >
      <Reanimated.Text
        numberOfLines={1}
        style={[textStyle, s.marqueeText, glide]}
        onTextLayout={event => {
          const w = event.nativeEvent.lines?.[0]?.width ?? 0;
          if (w > 0 && Math.abs(w - textW) > 1) setTextW(Math.ceil(w));
        }}
      >
        {text}
      </Reanimated.Text>
    </View>
  );
}

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

const enter = (delay: number) => FadeInDown.duration(420).delay(delay);

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Today's pixel breathes a soft gold ring — the same "now" pulse the rest of
// the app carries, anchored to the fixed pixel so layout can never drift.
function TodayPixelPulse() {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      t.value = 0.25;
      return;
    }
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: 2300, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(t);
  }, [reduceMotion, t]);

  const ringProps = useAnimatedProps(() => ({
    opacity: (1 - t.value) * 0.55,
    r: 6.5 + t.value * 6.5,
  }));

  return (
    <View pointerEvents="none" style={s.todayPulse}>
      <Svg width={30} height={30}>
        <AnimatedCircle cx={15} cy={15} fill="none" stroke={GOLD} strokeWidth={1.3} animatedProps={ringProps} />
      </Svg>
    </View>
  );
}

// The tracked-days ring draws itself in whenever the metric or year changes.
function ProgressRing({ percent, redrawKey }: { percent: number; redrawKey: string }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = percent;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(percent, { duration: 950, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [percent, redrawKey, reduceMotion]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRC * (1 - progress.value / 100),
  }));

  // A small gem rides the tip of the progress — the instrument's jewel.
  const tipProps = useAnimatedProps(() => {
    const angle = ((-90 + (progress.value / 100) * 360) * Math.PI) / 180;
    return {
      cx: 50 + RING_R * Math.cos(angle),
      cy: 50 + RING_R * Math.sin(angle),
      opacity: progress.value > 0.5 ? 1 : 0,
    };
  });

  return (
    <Svg width={96} height={96} viewBox="0 0 100 100">
      <Defs>
        <SvgLinearGradient id="ringGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E2BD75" />
          <Stop offset="1" stopColor="#A87E33" />
        </SvgLinearGradient>
      </Defs>
      <Circle
        cx="50"
        cy="50"
        r={RING_R}
        stroke="rgba(152,105,27,0.16)"
        strokeWidth={8}
        fill="none"
      />
      <AnimatedCircle
        cx="50"
        cy="50"
        r={RING_R}
        stroke="url(#ringGold)"
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${RING_CIRC}`}
        animatedProps={ringProps}
        transform="rotate(-90 50 50)"
      />
      <AnimatedCircle
        animatedProps={tipProps}
        r={5.5}
        fill="#A87E33"
        stroke="#FFFDF6"
        strokeWidth={2.2}
      />
    </Svg>
  );
}

export default function YearInPixelsView() {
  const { entries, sections } = useJournal();
  const currentYear = new Date().getFullYear();

  // Years that actually have entries — we never let the user navigate
  // into empty years. If today's year has no entries yet, still include it
  // so the user has a starting point.
  const yearsWithEntries = useMemo(() => {
    const set = new Set<number>();
    entries.forEach(e => {
      const y = Number(e.date.slice(0, 4));
      if (Number.isFinite(y)) set.add(y);
    });
    set.add(currentYear);
    return [...set].sort((a, b) => a - b);
  }, [entries, currentYear]);

  const [year, setYear] = useState(currentYear);
  const [activeTabId, setActiveTabId] = useState('mood');

  const yearIndex = yearsWithEntries.indexOf(year);
  const canPrevYear = yearIndex > 0;
  const canNextYear = yearIndex >= 0 && yearIndex < yearsWithEntries.length - 1;

  const goPrevYear = () => {
    if (!canPrevYear) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setYear(yearsWithEntries[yearIndex - 1]);
  };
  const goNextYear = () => {
    if (!canNextYear) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setYear(yearsWithEntries[yearIndex + 1]);
  };

  // Index entries by date for O(1) lookup, and pull just the rows for the
  // currently displayed year so per-tab counts/grids stay cheap.
  const entryByDate = useMemo(() => {
    const map = new Map<string, typeof entries[number]>();
    entries.forEach(e => map.set(e.date, e));
    return map;
  }, [entries]);

  const yearEntries = useMemo(
    () => entries.filter(e => e.date.startsWith(`${year}-`)),
    [entries, year],
  );

  // Custom scales — only those that have at least one recorded value this
  // year, so empty scales don't clutter the tab bar.
  const customScalesWithData = useMemo(() => {
    const activeCustom = sections.filter(s => s.type === 'customScale' && s.active);
    return activeCustom.filter(scale =>
      yearEntries.some(e => e.scaleValues?.[scale.id] !== undefined),
    );
  }, [sections, yearEntries]);

  const tabs: TabDef[] = useMemo(() => [
    { id: 'mood', label: 'Mood', type: 'mood' },
    { id: 'energy', label: 'Energy', type: 'energy' },
    { id: 'satisfaction', label: 'Satisfaction', type: 'satisfaction' },
    { id: 'daily_journal', label: 'Daily Journal', type: 'daily_journal' },
    { id: 'morning_pages', label: 'Morning Pages', type: 'morning_pages' },
    { id: 'free_writing', label: 'Free Writing', type: 'free_writing' },
    ...customScalesWithData.map(s => ({
      id: `custom_${s.id}`,
      label: s.customLabel || 'Custom',
      type: 'custom' as const,
      scaleId: s.id,
    })),
  ], [customScalesWithData]);

  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];

  const TECHNIQUE_COLOR = GOLD;
  const MP_COLOR = PURPLE;
  const FW_COLOR = TEAL;

  const pixelColorFor = (dateStr: string): string => {
    const entry = entryByDate.get(dateStr);
    if (!entry) return '';
    switch (activeTab.type) {
      case 'mood':
        return entry.mood ? (MOOD_COLORS[entry.mood] || '') : '';
      case 'energy':
        return entry.energy ? (ENERGY_COLORS[entry.energy] || '') : '';
      case 'satisfaction':
        return entry.satisfaction !== undefined ? scaleColor(entry.satisfaction) : '';
      case 'daily_journal':
        return hasDailyJournalContent(entry) ? TECHNIQUE_COLOR : '';
      case 'morning_pages':
        return isMorningPagesComplete(entry) ? MP_COLOR : '';
      case 'free_writing':
        return hasFreeWritingContent(entry) ? FW_COLOR : '';
      case 'custom': {
        if (!activeTab.scaleId) return '';
        const value = entry.scaleValues?.[activeTab.scaleId];
        return value !== undefined ? scaleColor(value) : '';
      }
      default:
        return '';
    }
  };

  const today = todayKey();
  const months = useMemo(() => MONTH_NAMES.map((name, monthIndex) => {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return {
        day,
        dateStr,
        color: pixelColorFor(dateStr),
        isToday: dateStr === today,
        isFuture: dateStr > today,
      };
    });
    return { name, days };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [year, activeTabId, entries, sections]);

  // "Days available" = days in the year up to (and including) today, capped
  // at 365/366 for past years. This is the denominator for the % display.
  const daysAvailable = useMemo(() => {
    if (year < currentYear) {
      // Full past year: account for leap years.
      const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      return isLeap ? 366 : 365;
    }
    if (year > currentYear) return 0; // shouldn't happen — UI prevents it
    // Current year — number of days completed so far, including today.
    const now = new Date();
    const start = new Date(year, 0, 1);
    return Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1;
  }, [year, currentYear]);

  // Count of pixels visible for the CURRENT tab. The percent reflects how
  // much of the *available* timeline is tracked for this metric — so a user
  // viewing Mood sees "X% of days have a mood logged this year so far".
  const coloredCount = useMemo(() => {
    let n = 0;
    for (const entry of yearEntries) {
      switch (activeTab.type) {
        case 'mood': if (entry.mood) n++; break;
        case 'energy': if (entry.energy) n++; break;
        case 'satisfaction': if (entry.satisfaction !== undefined) n++; break;
        case 'daily_journal': if (hasDailyJournalContent(entry)) n++; break;
        case 'morning_pages': if (isMorningPagesComplete(entry)) n++; break;
        case 'free_writing': if (hasFreeWritingContent(entry)) n++; break;
        case 'custom':
          if (activeTab.scaleId && entry.scaleValues?.[activeTab.scaleId] !== undefined) n++;
          break;
      }
    }
    return n;
  }, [yearEntries, activeTab]);

  const fillPercent = daysAvailable > 0
    ? Math.min(100, Math.round((coloredCount / daysAvailable) * 100))
    : 0;

  const isSmallScale = activeTab.type === 'mood' || activeTab.type === 'energy';
  const isPresenceTab =
    activeTab.type === 'daily_journal' ||
    activeTab.type === 'morning_pages' ||
    activeTab.type === 'free_writing';

  // The year's spectrum: how the tracked days distribute across the five
  // tones — proportions only, drawn as one woven band.
  const distribution = useMemo(() => {
    if (isPresenceTab) return null;
    const buckets = [0, 0, 0, 0, 0];
    for (const entry of yearEntries) {
      let idx = -1;
      switch (activeTab.type) {
        case 'mood': if (entry.mood) idx = entry.mood - 1; break;
        case 'energy': if (entry.energy) idx = entry.energy - 1; break;
        case 'satisfaction':
          if (entry.satisfaction !== undefined) {
            idx = Math.min(4, Math.floor(Math.max(0, entry.satisfaction - 1) / 2));
          }
          break;
        case 'custom': {
          const value = activeTab.scaleId ? entry.scaleValues?.[activeTab.scaleId] : undefined;
          if (value !== undefined) idx = Math.min(4, Math.floor(Math.max(0, value - 1) / 2));
          break;
        }
      }
      if (idx >= 0 && idx <= 4) buckets[idx] += 1;
    }
    return buckets;
  }, [yearEntries, activeTab, isPresenceTab]);

  const family = tabFamily(activeTab.type);
  const redrawKey = `${activeTabId}-${year}`;
  const reduceMotion = useReducedMotion();

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="YEAR IN PIXELS" showBack bg={BG} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* The year plate: one rich gold card carrying the year, its
            navigation, the tracked-days instrument, and the spectrum — the
            plan-card grammar (gradient, weave, bloom) brought to the journal. */}
        <Reanimated.View entering={enter(0)} style={s.plate}>
          <LinearGradient
            colors={['#F2DEAA', '#FFF6DF', '#FFFDF8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <HairlineWeave color="#98691B" />
          <View pointerEvents="none" style={s.plateBloom} />

          <View style={s.plateNav}>
            <TouchableOpacity
              onPress={goPrevYear}
              disabled={!canPrevYear}
              activeOpacity={0.7}
              style={[s.plateBtn, !canPrevYear && s.plateBtnDisabled]}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <ChevronLeft s={19} c={canPrevYear ? '#98691B' : '#D5C7A4'} w={2.3} />
            </TouchableOpacity>
            <View style={s.plateYearCenter}>
              <View style={s.plateRule} />
              <Text style={s.plateYear}>{year}</Text>
              <View style={s.plateRule} />
            </View>
            <TouchableOpacity
              onPress={goNextYear}
              disabled={!canNextYear}
              activeOpacity={0.7}
              style={[s.plateBtn, !canNextYear && s.plateBtnDisabled]}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            >
              <ChevronRight s={19} c={canNextYear ? '#98691B' : '#D5C7A4'} w={2.3} />
            </TouchableOpacity>
          </View>

          <View style={s.plateStatsRow}>
            {/* Left half: the count seated on layered light ellipses — the
                trophy medallion's soft bloom, stacked rather than side-on. */}
            <View style={s.plateHalf}>
              <View style={s.medallion}>
                <Svg pointerEvents="none" width={150} height={92} style={s.medallionBlobs}>
                  <Ellipse cx={75} cy={46} rx={69} ry={38} fill="#FFFAEC" opacity={0.9} transform="rotate(-6 75 46)" />
                  <Ellipse cx={79} cy={44} rx={56} ry={31} fill="#FFF3D6" opacity={0.85} transform="rotate(4 79 44)" />
                  <Ellipse cx={72} cy={47} rx={44} ry={25} fill="#F9E8C2" opacity={0.8} transform="rotate(-3 72 47)" />
                </Svg>
                <View style={s.plateNumRow}>
                  <Text style={s.plateBigNum}>{coloredCount}</Text>
                  <Text style={s.plateNumOf}> / {daysAvailable}</Text>
                </View>
                <Text style={s.plateMeta}>days tracked</Text>
              </View>
            </View>
            {/* The divide: a hairline with a diamond at its waist. */}
            <View style={s.plateDividerCol}>
              <View style={s.plateDividerRule} />
              <View style={s.plateDividerDiamond} />
              <View style={s.plateDividerRule} />
            </View>
            {/* Right half: the ring, centered in its own field. */}
            <View style={s.plateHalf}>
              <View style={s.heroRing}>
                <ProgressRing percent={fillPercent} redrawKey={redrawKey} />
                <View style={s.heroRingCenter} pointerEvents="none">
                  <Text style={s.heroRingPct}>
                    {fillPercent}
                    <Text style={s.heroRingPctSmall}>%</Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {distribution != null && coloredCount > 0 && (
            <View style={s.spectrumWrap}>
              <View style={s.spectrumBar}>
                {distribution.map((count, index) => (
                  count > 0
                    ? <View key={index} style={[s.spectrumSegment, { flex: count, backgroundColor: MOOD_COLORS[index + 1] }]} />
                    : null
                ))}
              </View>
              <View style={s.spectrumCounts}>
                {distribution.map((count, index) => (
                  <View key={index} style={[s.countChip, count === 0 && s.countChipZero]}>
                    <View style={[s.countGem, { backgroundColor: MOOD_COLORS[index + 1] }]} />
                    <Text style={s.countNum}>{count}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Reanimated.View>

        {/* Scale picker — the gem rail: every chip carries its spectrum */}
        <Reanimated.View entering={enter(60)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.tabsRow}
          >
            {tabs.map(tab => {
              const active = tab.id === activeTabId;
              const tint = TAB_TINTS[tabFamily(tab.type)];
              const dots = tabDots(tab.type);
              if (active) {
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setActiveTabId(tab.id)}
                    activeOpacity={0.84}
                    style={s.tabPress}
                    haptic="selection"
                  >
                    <LinearGradient
                      colors={TAB_GRADIENTS[tabFamily(tab.type)]}
                      locations={[0, 0.55, 1]}
                      start={{ x: 0.15, y: 0 }}
                      end={{ x: 0.85, y: 1 }}
                      style={[s.tabPill, s.tabPillActive]}
                    >
                      <View pointerEvents="none" style={s.tabSheen} />
                      <View style={s.tabInner}>
                        <View style={s.tabDots}>
                          {dots.map((dot, i) => (
                            <View key={i} style={[s.tabDot, s.tabDotActive, { backgroundColor: dot }]} />
                          ))}
                        </View>
                        <Text style={[s.tabLabel, s.tabLabelActive]} numberOfLines={1}>{tab.label}</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTabId(tab.id)}
                  activeOpacity={0.84}
                  style={s.tabPress}
                  haptic="selection"
                >
                  <View style={[s.tabPill, { backgroundColor: tint.bg, borderColor: tint.border }]}>
                    <View style={s.tabInner}>
                      <View style={s.tabDots}>
                        {dots.map((dot, i) => (
                          <View key={i} style={[s.tabDot, { backgroundColor: dot }]} />
                        ))}
                      </View>
                      <Text style={[s.tabLabel, { color: tint.ink }]} numberOfLines={1}>{tab.label}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Reanimated.View>

        {/* The painting: the year in its gold fillet frame, legend as the
            gallery placard beneath it. */}
        <Reanimated.View entering={enter(150)} style={s.card}>
          <View style={s.plaqueRow}>
            <MarqueeText text={activeTab.label} textStyle={s.plaqueTitle} />
            <Text style={s.plaqueCount}>
              {coloredCount} {coloredCount === 1 ? 'day' : 'days'} painted
            </Text>
          </View>
          <View style={s.frame}>
            <View pointerEvents="none" style={[s.frameNail, { top: 5, left: 5 }]} />
            <View pointerEvents="none" style={[s.frameNail, { top: 5, right: 5 }]} />
            <View pointerEvents="none" style={[s.frameNail, { bottom: 5, left: 5 }]} />
            <View pointerEvents="none" style={[s.frameNail, { bottom: 5, right: 5 }]} />
            {months.map((month, monthIndex) => (
              <Reanimated.View
                key={`${redrawKey}-${month.name}`}
                entering={reduceMotion ? undefined : FadeInDown.delay(monthIndex * 26).duration(300)}
                style={[s.monthRow, (monthIndex === 2 || monthIndex === 5 || monthIndex === 8) && s.monthRowSeasonEnd]}
              >
                <Text style={s.monthLabel}>{month.name}</Text>
                <View style={s.monthDays}>
                  {month.days.map(day => (
                    day.isToday ? (
                      <View key={day.dateStr} style={s.todayWrap}>
                        <TodayPixelPulse />
                        <View
                          style={[
                            s.pixelFill,
                            day.color ? { backgroundColor: day.color } : s.pixelToday,
                            s.pixelTodayRing,
                          ]}
                        />
                      </View>
                    ) : (
                      // Painted days are full gems; unpainted days recede to
                      // pinpricks — the year's shape stays visible, the story
                      // is what you painted.
                      <View key={day.dateStr} style={s.pixelCell}>
                        {day.color ? (
                          <View style={[s.pixelFill, { backgroundColor: day.color }]} />
                        ) : (
                          <View style={[s.pixelDot, day.isFuture && s.pixelDotFuture]} />
                        )}
                      </View>
                    )
                  ))}
                </View>
              </Reanimated.View>
            ))}
          </View>

          <View style={s.placardDivider} />

          {isPresenceTab ? (
            <View style={s.legendRow}>
              <View style={s.legendItem}>
                <View style={[s.legendSwatchLg, s.legendSwatchShadow, { backgroundColor: activeTab.type === 'daily_journal' ? TECHNIQUE_COLOR : activeTab.type === 'morning_pages' ? MP_COLOR : FW_COLOR }]}>
                  <View style={s.gemSheen} />
                </View>
                <Text style={s.legendText}>Has entry</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendSwatchLg, { backgroundColor: '#F0EDE6', borderWidth: 1, borderColor: '#E7E5E4' }]} />
                <Text style={s.legendTextMuted}>No entry</Text>
              </View>
            </View>
          ) : isSmallScale ? (
            <View style={s.legendRowSpread}>
              {(activeTab.type === 'mood'
                ? ['😔', '😕', '😐', '🙂', '😊']
                : ['🪫', '😴', '⚡', '🔥', '💪']
              ).map((emoji, i) => (
                <View key={i} style={s.legendItemCol}>
                  <View style={[s.legendSwatchLg, s.legendSwatchShadow, { backgroundColor: (activeTab.type === 'mood' ? MOOD_COLORS : ENERGY_COLORS)[i + 1] }]}>
                    <View style={s.gemSheen} />
                  </View>
                  <Text style={s.legendEmoji}>{emoji}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={s.legendRowSpread}>
              {[
                { label: '1-2', color: '#EF4444' },
                { label: '3-4', color: '#F97316' },
                { label: '5-6', color: '#EAB308' },
                { label: '7-8', color: '#84CC16' },
                { label: '9-10', color: '#22C55E' },
              ].map(item => (
                <View key={item.label} style={s.legendItemCol}>
                  <View style={[s.legendSwatchLg, s.legendSwatchShadow, { backgroundColor: item.color }]}>
                    <View style={s.gemSheen} />
                  </View>
                  <Text style={s.legendNumLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          )}
        </Reanimated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 80, paddingTop: 2, rowGap: 12 },

  // The year plate — plan-card grammar on the journal page.
  plate: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 26,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#DFC177',
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 13,
    shadowColor: '#8C7A4F',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 3,
  },
  plateBloom: {
    position: 'absolute',
    right: -38,
    top: -46,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(197,160,89,0.16)',
  },
  plateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  plateBtn: {
    width: 37,
    height: 37,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(152,105,27,0.32)',
    shadowColor: '#8C7A4F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 1,
  },
  plateBtnDisabled: { opacity: 0.4, shadowOpacity: 0, elevation: 0 },
  plateYearCenter: { flexDirection: 'row', alignItems: 'center', columnGap: 11 },
  plateRule: { width: 24, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(122,83,16,0.55)' },
  plateYear: {
    fontFamily: F.serifSemiBold,
    fontSize: 31,
    lineHeight: 36,
    color: '#59400F',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  plateStatsRow: { marginTop: 6, flexDirection: 'row', alignItems: 'stretch' },
  plateHalf: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  medallion: { width: 150, height: 92, alignItems: 'center', justifyContent: 'center' },
  medallionBlobs: { position: 'absolute', left: 0, top: 0 },
  plateDividerCol: { width: 18, alignItems: 'center', justifyContent: 'center', rowGap: 6, marginVertical: 8 },
  plateDividerRule: { flex: 1, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(122,83,16,0.35)' },
  plateDividerDiamond: { width: 4.5, height: 4.5, borderRadius: 1, backgroundColor: '#98691B', opacity: 0.7, transform: [{ rotate: '45deg' }] },
  plateNumRow: { flexDirection: 'row', alignItems: 'baseline' },
  plateBigNum: {
    fontFamily: F.serifSemiBold,
    fontSize: 32,
    lineHeight: 36,
    color: '#59400F',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  plateNumOf: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    color: '#9C8455',
    fontVariant: ['tabular-nums'],
  },
  plateMeta: {
    marginTop: 1,
    fontFamily: F.serifMedium,
    fontSize: 14.5,
    lineHeight: 18,
    color: '#796333',
  },

  tabsRow: {
    columnGap: 8,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  tabPress: { borderRadius: 18 },
  tabPill: {
    minHeight: 37,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE9E0',
    overflow: 'hidden',
    position: 'relative',
  },
  tabInner: { flexDirection: 'row', alignItems: 'center', columnGap: 7 },
  marqueeBox: { flex: 1, minWidth: 0, flexDirection: 'row', overflow: 'hidden' },
  marqueeText: { flexShrink: 0 },
  tabDots: { flexDirection: 'row', alignItems: 'center', columnGap: 2.5 },
  tabDot: { width: 4.5, height: 4.5, borderRadius: 2.5 },
  tabDotActive: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  tabPillActive: {
    borderWidth: 0,
    shadowColor: '#5A4A28',
    shadowOpacity: 0.26,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 3,
  },
  tabSheen: {
    position: 'absolute',
    top: 1, left: 1, right: 1,
    height: '46%',
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tabLabel: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: '#9C948C',
    textTransform: 'uppercase',
    maxWidth: 118,
  },
  tabLabelActive: { color: '#FFFFFF', letterSpacing: 1.8 },

  card: {
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE9DD',
    padding: 16,
    shadowColor: '#1C1917',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
  },

  heroRing: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroRingCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingPct: {
    fontFamily: F.serifSemiBold,
    fontSize: 24,
    lineHeight: 28,
    color: '#7A5310',
    fontVariant: ['tabular-nums'],
  },
  heroRingPctSmall: {
    fontFamily: F.serifSemiBold,
    fontSize: 14,
    color: '#7A5310',
  },
  spectrumWrap: { marginTop: 13 },
  spectrumBar: {
    height: 11,
    flexDirection: 'row',
    columnGap: 2,
  },
  spectrumSegment: { borderRadius: 3.5 },
  spectrumCounts: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    columnGap: 13,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4.5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(152,105,27,0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  countChipZero: { opacity: 0.35 },
  countGem: { width: 7.5, height: 7.5, borderRadius: 2.5 },
  countNum: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    color: '#6D4F13',
    fontVariant: ['tabular-nums'],
  },

  plaqueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  plaqueTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.1,
    color: INK,
  },
  plaqueCount: {
    flexShrink: 0,
    marginLeft: 12,
    fontFamily: F.serifItalic,
    fontSize: 13.5,
    color: '#A6997D',
  },
  // The gold fillet: a fine inner frame the year hangs inside, with nail
  // heads in the corners. It reaches almost to the card's edge so the
  // pixels get the full breadth.
  frame: {
    position: 'relative',
    marginHorizontal: -8,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,160,89,0.5)',
    backgroundColor: '#FFFEFB',
    paddingHorizontal: 9,
    paddingVertical: 11,
    rowGap: 8,
  },
  frameNail: {
    position: 'absolute',
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: 'rgba(154,107,30,0.5)',
  },

  monthRow: { flexDirection: 'row', alignItems: 'flex-start', columnGap: 7 },
  monthRowSeasonEnd: { marginBottom: 4 },
  // Month names: three letters each, set flush left in upright garamond —
  // one tidy column down the frame's edge.
  monthLabel: {
    width: 30,
    paddingTop: 1.5,
    fontFamily: F.serifMedium,
    fontSize: 12.5,
    letterSpacing: 0.5,
    color: '#7E7768',
    textAlign: 'left',
  },
  monthDays: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: PIXEL_GAP,
    rowGap: PIXEL_GAP,
  },
  pixelCell: {
    width: PIXEL_SIZE,
    height: PIXEL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pixelFill: {
    width: PIXEL_SIZE,
    height: PIXEL_SIZE,
    borderRadius: 3.5,
  },
  pixelDot: {
    width: PIXEL_SIZE,
    height: PIXEL_SIZE,
    borderRadius: 3.5,
    backgroundColor: '#F1EDE4',
  },
  pixelDotFuture: {
    backgroundColor: 'rgba(197,160,89,0.07)',
  },
  pixelToday: { backgroundColor: 'rgba(197,160,89,0.2)' },
  pixelTodayRing: { borderWidth: 1.2, borderColor: GOLD },
  todayWrap: {
    width: PIXEL_SIZE,
    height: PIXEL_SIZE,
    position: 'relative',
  },
  todayPulse: { position: 'absolute', left: -9.25, top: -9.25, width: 30, height: 30 },

  placardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EDE7DA',
    marginTop: 14,
    marginBottom: 13,
  },
  legendRow: { flexDirection: 'row', justifyContent: 'center', columnGap: 30 },
  legendRowSpread: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', columnGap: 11 },
  legendItemCol: { alignItems: 'center', rowGap: 6 },
  legendSwatchLg: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderCurve: 'continuous',
    overflow: 'hidden',
    position: 'relative',
  },
  gemSheen: {
    position: 'absolute',
    top: 1.5,
    left: 3,
    right: 3,
    height: '42%',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  legendSwatchShadow: {
    shadowColor: '#1C1917',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  legendText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 0.6, color: '#57534E' },
  legendTextMuted: { fontFamily: F.sans, fontSize: 11, color: '#A8A29E' },
  legendEmoji: { fontSize: 17 },
  legendNumLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 0.6, color: '#78716C' },
});
