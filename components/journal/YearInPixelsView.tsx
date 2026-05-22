import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from '@/components/icons/Icons';
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

const PIXEL_SIZE = 12;
const PIXEL_GAP = 3;
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

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

  const filledDays = yearEntries.length;

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

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="YEAR IN PIXELS" showBack bg={BG} />
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Year selector */}
        <View style={s.yearRow}>
          <TouchableOpacity
            onPress={goPrevYear}
            disabled={!canPrevYear}
            activeOpacity={0.7}
            style={[s.yearBtn, !canPrevYear && s.yearBtnDisabled]}
          >
            <ChevronLeft s={18} c={canPrevYear ? GOLD : '#D6D3D1'} />
          </TouchableOpacity>
          <Text style={s.yearText}>{year}</Text>
          <TouchableOpacity
            onPress={goNextYear}
            disabled={!canNextYear}
            activeOpacity={0.7}
            style={[s.yearBtn, !canNextYear && s.yearBtnDisabled]}
          >
            <ChevronRight s={18} c={canNextYear ? GOLD : '#D6D3D1'} />
          </TouchableOpacity>
        </View>

        {/* Tab chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabsRow}
        >
          {tabs.map(tab => {
            const active = tab.id === activeTabId;
            if (active) {
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTabId(tab.id)}
                  activeOpacity={0.84}
                  style={s.tabPress}
                >
                  <LinearGradient
                    colors={['#E2BD75', '#C5A059', '#A87E33']}
                    locations={[0, 0.55, 1]}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.85, y: 1 }}
                    style={[s.tabPill, s.tabPillActive]}
                  >
                    <View pointerEvents="none" style={s.tabSheen} />
                    <Text style={[s.tabLabel, s.tabLabelActive]} numberOfLines={1}>{tab.label}</Text>
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
              >
                <View style={s.tabPill}>
                  <Text style={s.tabLabel} numberOfLines={1}>{tab.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Hero stats card with circular progress ring */}
        <View style={s.heroCard}>
          <View style={s.heroLeft}>
            <Text style={s.heroEyebrow}>DAYS TRACKED</Text>
            <Text style={s.heroBigNum}>{coloredCount}</Text>
            <Text style={s.heroMeta}>
              of {daysAvailable} {daysAvailable === 1 ? 'day' : 'days'} this year
            </Text>
            <Text style={s.heroSubMeta}>
              {filledDays} {filledDays === 1 ? 'journal entry' : 'journal entries'}
            </Text>
          </View>
          <View style={s.heroRing}>
            <Svg width={76} height={76} viewBox="0 0 100 100">
              <Circle
                cx="50"
                cy="50"
                r={RING_R}
                stroke="rgba(197,160,89,0.14)"
                strokeWidth={7}
                fill="none"
              />
              <Circle
                cx="50"
                cy="50"
                r={RING_R}
                stroke={GOLD}
                strokeWidth={7}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${RING_CIRC}`}
                strokeDashoffset={RING_CIRC * (1 - fillPercent / 100)}
                transform="rotate(-90 50 50)"
              />
            </Svg>
            <View style={s.heroRingCenter} pointerEvents="none">
              <Text style={s.heroRingPct}>
                {fillPercent}
                <Text style={s.heroRingPctSmall}>%</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Pixel grid */}
        <View style={s.card}>
          <Text style={s.gridKicker}>{activeTab.label.toUpperCase()} · {year}</Text>
          <View style={{ rowGap: 8 }}>
            {months.map(month => (
              <View key={month.name} style={s.monthRow}>
                <Text style={s.monthLabel}>{month.name.toUpperCase()}</Text>
                <View style={s.monthDays}>
                  {month.days.map(day => (
                    <View
                      key={day.dateStr}
                      style={[
                        s.pixel,
                        day.color
                          ? { backgroundColor: day.color }
                          : day.isFuture
                            ? s.pixelFuture
                            : day.isToday
                              ? s.pixelToday
                              : s.pixelEmpty,
                      ]}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Legend */}
        <View style={s.card}>
          <Text style={s.legendKicker}>LEGEND</Text>
          {isPresenceTab ? (
            <View style={s.legendRow}>
              <View style={s.legendItem}>
                <View style={[s.legendSwatchLg, s.legendSwatchShadow, { backgroundColor: activeTab.type === 'daily_journal' ? TECHNIQUE_COLOR : activeTab.type === 'morning_pages' ? MP_COLOR : FW_COLOR }]} />
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
                  <View style={[s.legendSwatchLg, s.legendSwatchShadow, { backgroundColor: (activeTab.type === 'mood' ? MOOD_COLORS : ENERGY_COLORS)[i + 1] }]} />
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
                  <View style={[s.legendSwatchLg, s.legendSwatchShadow, { backgroundColor: item.color }]} />
                  <Text style={s.legendNumLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 80, paddingTop: 2, rowGap: 12 },

  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 14,
    paddingVertical: 2,
  },
  yearBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.08)',
    borderWidth: 1, borderColor: 'rgba(197,160,89,0.22)',
  },
  yearBtnDisabled: { opacity: 0.38, backgroundColor: '#FFFFFF', borderColor: '#F0EDE6' },
  yearText: {
    fontFamily: F.serifSemiBold,
    fontSize: 22,
    lineHeight: 26,
    color: INK,
    minWidth: 90,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  tabsRow: {
    columnGap: 8,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  tabPress: { borderRadius: 18 },
  tabPill: {
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEE9E0',
    overflow: 'hidden',
    position: 'relative',
  },
  tabPillActive: {
    borderWidth: 0,
    shadowColor: '#A87E33',
    shadowOpacity: 0.28,
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
  },
  tabLabelActive: { color: '#FFFFFF', letterSpacing: 1.8 },

  card: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    padding: 16,
    shadowColor: '#1C1917',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 1,
  },

  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE9DD',
    padding: 20,
    columnGap: 18,
    shadowColor: '#1C1917',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 1,
  },
  heroLeft: { flex: 1, minWidth: 0 },
  heroEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: GOLD,
    textTransform: 'uppercase',
  },
  heroBigNum: {
    marginTop: 8,
    fontFamily: F.serifSemiBold,
    fontSize: 30,
    lineHeight: 34,
    color: INK,
    letterSpacing: 0.3,
  },
  heroMeta: {
    marginTop: 4,
    fontFamily: F.serif,
    fontSize: 12.5,
    lineHeight: 17,
    color: '#9C948C',
  },
  heroSubMeta: {
    marginTop: 1,
    fontFamily: F.serifItalic,
    fontSize: 11.5,
    lineHeight: 15,
    color: '#B5A990',
  },
  heroRing: {
    width: 76,
    height: 76,
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
    fontSize: 19,
    lineHeight: 22,
    color: GOLD,
  },
  heroRingPctSmall: {
    fontFamily: F.serifSemiBold,
    fontSize: 11.5,
    color: GOLD,
  },

  gridKicker: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: GOLD,
    textTransform: 'uppercase',
    marginBottom: 14,
    paddingHorizontal: 2,
  },

  monthRow: { flexDirection: 'row', alignItems: 'flex-start', columnGap: 12 },
  monthLabel: {
    width: 34,
    paddingTop: 3,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: '#A8A29E',
  },
  monthDays: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: PIXEL_GAP,
    rowGap: PIXEL_GAP,
  },
  pixel: {
    width: PIXEL_SIZE,
    height: PIXEL_SIZE,
    borderRadius: 3,
  },
  pixelEmpty: { backgroundColor: '#F0EDE6' },
  pixelFuture: { backgroundColor: 'rgba(197,160,89,0.05)' },
  pixelToday: {
    backgroundColor: 'rgba(197,160,89,0.18)',
    borderWidth: 1.5,
    borderColor: GOLD,
  },

  legendKicker: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: GOLD,
    textTransform: 'uppercase',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  legendRow: { flexDirection: 'row', justifyContent: 'center', columnGap: 30 },
  legendRowSpread: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', columnGap: 11 },
  legendItemCol: { alignItems: 'center', rowGap: 7 },
  legendSwatchLg: { width: 24, height: 24, borderRadius: 7 },
  legendSwatchShadow: {
    shadowColor: '#1C1917',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  legendText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 0.6, color: '#57534E' },
  legendTextMuted: { fontFamily: F.sans, fontSize: 11, color: '#A8A29E' },
  legendEmoji: { fontSize: 17 },
  legendNumLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 0.6, color: '#78716C' },
});
