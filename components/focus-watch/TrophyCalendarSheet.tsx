import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { ChevronLeft, ChevronRight, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { dateKey, useDayPlan, type DayRecord } from './dayPlanStore';

const TROPHY_PNG = require('@/assets/animations/challenge-trophy-preview.png');
const enter = (delay: number) => FadeInDown.duration(360).delay(delay);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Verified habit-formation copy only — no invented numbers (blueprint §2).
const MERCY_LINE =
  'One missed day does not undo what you are building — returning is what builds it.';
const STEADY_LINE = 'Never miss twice: one miss is an accident, not a new habit.';

function monthKey(date: Date) {
  return date.getFullYear() * 12 + date.getMonth();
}

type CellState = 'kept' | 'broken' | 'off' | 'today' | 'future' | 'blank';

// The story of your days: gold trophies for kept days, a quiet black cross
// for broken ones, empty circles for days of rest.
export default function TrophyCalendarSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const state = useDayPlan();
  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date();
  const todayKey = monthKey(today);
  const firstRecordKey = useMemo(() => {
    const dates = Object.keys(state.days).sort();
    if (dates.length === 0) return todayKey;
    const [year, month] = dates[0].split('-').map(Number);
    return year * 12 + (month - 1);
  }, [state.days, todayKey]);

  const shownKey = Math.min(todayKey, Math.max(firstRecordKey, todayKey + monthOffset));
  const shownYear = Math.floor(shownKey / 12);
  const shownMonth = shownKey % 12;
  const canGoBack = shownKey > firstRecordKey;
  const canGoForward = shownKey < todayKey;

  const cells = useMemo(() => {
    const firstOfMonth = new Date(shownYear, shownMonth, 1);
    const leading = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(shownYear, shownMonth + 1, 0).getDate();
    const todayStr = dateKey(today);

    const result: { day: number; cell: CellState }[] = [];
    for (let i = 0; i < leading; i++) result.push({ day: 0, cell: 'blank' });
    for (let day = 1; day <= daysInMonth; day++) {
      const key = dateKey(new Date(shownYear, shownMonth, day));
      const record: DayRecord | undefined = state.days[key];
      let cell: CellState;
      if (key === todayStr) cell = 'today';
      else if (key > todayStr) cell = 'future';
      else if (!record || record.status === 'off' || record.status === 'pending') cell = 'off';
      else cell = record.status === 'kept' ? 'kept' : 'broken';
      result.push({ day, cell });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.days, shownYear, shownMonth, visible]);

  const recentBroken = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffKey = dateKey(cutoff);
    return Object.values(state.days).some(
      record => record.status === 'broken' && record.date >= cutoffKey
    );
  }, [state.days]);

  const close = () => {
    setMonthOffset(0);
    onClose();
  };

  return (
    <SmoothBottomSheet visible={visible} onClose={close} sheetStyle={s.sheet}>
      <View style={s.handle} />
      <View style={s.headerRow}>
        <Text style={s.title}>Your days</Text>
        <TouchableOpacity
          onPress={close}
          activeOpacity={0.8}
          style={s.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X s={17} c={C.textMuted} w={2.2} />
        </TouchableOpacity>
      </View>

      <Animated.View entering={enter(40)} style={s.statRow}>
        <View style={s.statCell}>
          <Text style={s.statLabel}>STREAK</Text>
          <Text style={s.statValue}>{state.streak.current}</Text>
          <Text style={s.statUnit}>days</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statCell}>
          <Text style={s.statLabel}>BEST</Text>
          <Text style={s.statValue}>{state.streak.best}</Text>
          <Text style={s.statUnit}>days</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statCell}>
          <Text style={s.statLabel}>TROPHIES</Text>
          <View style={s.statTrophyRow}>
            <Image source={TROPHY_PNG} style={s.statTrophyImg} resizeMode="contain" />
            <Text style={s.statValue}>{state.streak.trophies}</Text>
          </View>
          <Text style={s.statUnit}>kept days</Text>
        </View>
      </Animated.View>

      <View style={s.monthRow}>
        <TouchableOpacity
          onPress={() => canGoBack && setMonthOffset(value => value - 1)}
          activeOpacity={0.7}
          disabled={!canGoBack}
          style={[s.monthBtn, !canGoBack && { opacity: 0.3 }]}
        >
          <ChevronLeft s={18} c={C.textSecondary} />
        </TouchableOpacity>
        <Text style={s.monthTitle}>
          {MONTH_NAMES[shownMonth]} {shownYear}
        </Text>
        <TouchableOpacity
          onPress={() => canGoForward && setMonthOffset(value => value + 1)}
          activeOpacity={0.7}
          disabled={!canGoForward}
          style={[s.monthBtn, !canGoForward && { opacity: 0.3 }]}
        >
          <ChevronRight s={18} c={C.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={s.weekHeader}>
        {DAY_LETTERS.map((letter, index) => (
          <Text key={index} style={s.weekHeaderText}>
            {letter}
          </Text>
        ))}
      </View>

      <Animated.View entering={enter(110)} style={s.grid}>
        {cells.map((entry, index) => (
          <View key={index} style={s.cell}>
            {entry.cell !== 'blank' && (
              <>
                <View style={s.markWrap}>
                  {entry.cell === 'kept' && (
                    <View style={s.keptBadge}>
                      <Image source={TROPHY_PNG} style={s.keptImg} resizeMode="contain" />
                    </View>
                  )}
                  {entry.cell === 'broken' && <X s={14} c={C.text} w={2.8} />}
                  {entry.cell === 'off' && <View style={s.offRing} />}
                  {entry.cell === 'today' && <View style={s.todayRing} />}
                  {entry.cell === 'future' && <View style={s.futureDot} />}
                </View>
                <Text style={[s.cellDay, entry.cell === 'today' && s.cellDayToday]}>
                  {entry.day}
                </Text>
              </>
            )}
          </View>
        ))}
      </Animated.View>

      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <Image source={TROPHY_PNG} style={{ width: 14, height: 14 }} resizeMode="contain" />
          <Text style={s.legendText}>kept</Text>
        </View>
        <View style={s.legendItem}>
          <X s={11} c={C.text} w={2.6} />
          <Text style={s.legendText}>broken</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.offRing, { width: 12, height: 12, borderRadius: 6 }]} />
          <Text style={s.legendText}>rest day</Text>
        </View>
      </View>

      <Text style={s.encouragement}>{recentBroken ? MERCY_LINE : STEADY_LINE}</Text>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#E7E5E0',
    marginTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    letterSpacing: -0.2,
    color: C.text,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F2ED',
    alignItems: 'center',
    justifyContent: 'center',
  },

  statRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 13,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: C.border,
  },
  statLabel: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: C.textMuted,
  },
  statValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 24,
    lineHeight: 28,
    color: C.text,
    fontVariant: ['tabular-nums'],
  },
  statTrophyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statUnit: {
    fontFamily: F.sans,
    fontSize: 10.5,
    color: C.textSecondary,
  },

  monthRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontFamily: F.serifMedium,
    fontSize: 19,
    color: C.text,
  },

  weekHeader: {
    marginTop: 12,
    flexDirection: 'row',
  },
  weekHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1,
    color: C.textMuted,
  },
  grid: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
  },
  markWrap: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keptBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF3D8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 2,
  },
  keptImg: {
    width: 18,
    height: 18,
  },
  statTrophyImg: {
    width: 18,
    height: 18,
  },
  offRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#E2E0DA',
  },
  todayRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  futureDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EAE8E2',
  },
  cellDay: {
    marginTop: 1,
    fontFamily: F.sansMedium,
    fontSize: 8.5,
    color: C.textMuted,
    fontVariant: ['tabular-nums'],
  },
  cellDayToday: {
    fontFamily: F.sansBold,
    color: C.goldDark,
  },

  legendRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontFamily: F.sans,
    fontSize: 11.5,
    color: C.textSecondary,
  },
  encouragement: {
    marginTop: 14,
    paddingHorizontal: 14,
    fontFamily: F.serifItalic,
    fontSize: 13.5,
    lineHeight: 18.5,
    color: C.textSecondary,
    textAlign: 'center',
  },
});
