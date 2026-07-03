import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { ChevronLeft, ChevronRight, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import StreakFlame from './StreakFlame';
import { getWatchHistory } from './watchHistory';
import type { WatchPlan } from './focusWatchStore';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function monthKey(date: Date) {
  return date.getFullYear() * 12 + date.getMonth();
}

// The watch's story: current & longest streak plus a month calendar of
// completed, missed and off days — long-press a watch to open it.
export default function WatchStatsSheet({
  plan,
  onClose,
}: {
  plan: WatchPlan | null;
  onClose: () => void;
}) {
  const history = useMemo(() => (plan ? getWatchHistory(plan) : null), [plan]);
  const [monthOffset, setMonthOffset] = useState(0);

  const visible = !!plan;
  const today = history?.today ?? new Date();
  const firstKey = history ? monthKey(history.firstDay) : monthKey(today);
  const todayKey = monthKey(today);
  const shownKey = Math.min(todayKey, Math.max(firstKey, todayKey + monthOffset));
  const shownYear = Math.floor(shownKey / 12);
  const shownMonth = shownKey % 12;
  const canGoBack = shownKey > firstKey;
  const canGoForward = shownKey < todayKey;

  const grid = useMemo(() => {
    if (!history) return [];
    const firstOfMonth = new Date(shownYear, shownMonth, 1);
    const leading = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(shownYear, shownMonth + 1, 0).getDate();
    const cells: { day: number; status: ReturnType<typeof history.statusFor> }[] = [];
    for (let i = 0; i < leading; i++) cells.push({ day: 0, status: 'off' });
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, status: history.statusFor(new Date(shownYear, shownMonth, day)) });
    }
    return cells;
  }, [history, shownYear, shownMonth]);

  const close = () => {
    setMonthOffset(0);
    onClose();
  };

  return (
    <SmoothBottomSheet visible={visible} onClose={close} sheetStyle={s.sheet}>
      <View style={s.handle} />
      <View style={s.headerRow}>
        <Text style={s.title} numberOfLines={1}>
          {plan?.name ?? ''}
        </Text>
        <TouchableOpacity
          onPress={close}
          activeOpacity={0.8}
          style={s.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X s={17} c={C.textMuted} w={2.2} />
        </TouchableOpacity>
      </View>

      <View style={s.statRow}>
        <View style={s.statCell}>
          <Text style={s.statLabel}>CURRENT</Text>
          <View style={s.statValueRow}>
            <StreakFlame count={history?.current ?? 0} big />
            <Text style={s.statUnit}>days</Text>
          </View>
        </View>
        <View style={s.statDivider} />
        <View style={s.statCell}>
          <Text style={s.statLabel}>LONGEST</Text>
          <View style={s.statValueRow}>
            <StreakFlame count={history?.longest ?? 0} big />
            <Text style={s.statUnit}>days</Text>
          </View>
        </View>
      </View>

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

      <View style={s.grid}>
        {grid.map((cell, index) =>
          cell.day === 0 ? (
            <View key={index} style={s.cell} />
          ) : (
            <View key={index} style={s.cell}>
              <View
                style={[
                  s.dayDot,
                  cell.status === 'completed' && s.dayCompleted,
                  cell.status === 'missed' && s.dayMissed,
                ]}
              >
                <Text
                  style={[
                    s.dayText,
                    cell.status === 'completed' && s.dayTextCompleted,
                    cell.status === 'missed' && s.dayTextMissed,
                    cell.status === 'future' && s.dayTextFuture,
                  ]}
                >
                  {cell.day}
                </Text>
              </View>
            </View>
          )
        )}
      </View>

      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, s.dayCompleted]} />
          <Text style={s.legendText}>kept</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, s.dayMissed]} />
          <Text style={s.legendText}>broken</Text>
        </View>
        <View style={s.legendItem}>
          <View style={s.legendDot} />
          <Text style={s.legendText}>off day</Text>
        </View>
      </View>
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
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 24,
    letterSpacing: -0.2,
    color: C.text,
    paddingRight: 10,
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
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 13,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: C.border,
  },
  statLabel: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: C.textMuted,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statUnit: {
    fontFamily: F.serif,
    fontSize: 14,
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
    paddingVertical: 3.5,
  },
  dayDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCompleted: {
    backgroundColor: C.gold,
  },
  dayMissed: {
    borderWidth: 1.5,
    borderColor: '#E7A6B2',
    backgroundColor: '#FDF2F4',
  },
  dayText: {
    fontFamily: F.sansMedium,
    fontSize: 12.5,
    color: C.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  dayTextCompleted: {
    fontFamily: F.sansBold,
    color: '#fff',
  },
  dayTextMissed: {
    color: '#B54155',
  },
  dayTextFuture: {
    color: '#D6D3D1',
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
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EFEEE9',
  },
  legendText: {
    fontFamily: F.sans,
    fontSize: 11.5,
    color: C.textSecondary,
  },
});
