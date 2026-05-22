import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { Calendar, Flame, Skip, Target, TrendingUp, X } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { getTaskAnalytics, type ConsistencyBucket, type TaskAnalyticsData } from './taskAnalytics';
import { getLocalDateKey } from './taskScheduler';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


const SPRING = { damping: 15, stiffness: 160, mass: 1 };

type Props = {
  visible: boolean;
  taskId?: string;
  taskTitle: string;
  taskSubtitle?: string;
  onClose: () => void;
};

export default function TaskAnalyticsSheet({ visible, taskId, taskTitle, taskSubtitle, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [analytics, setAnalytics] = useState<TaskAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!visible || !taskId) {
      setAnalytics(null);
      setLoading(true);
      return () => { cancelled = true; };
    }
    setLoading(true);
    (async () => {
      try {
        const data = await getTaskAnalytics(taskId);
        if (!cancelled) {
          setAnalytics(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, taskId]);

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={onClose}
      sheetStyle={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}
    >
      <View style={s.handleWrap}>
        <View style={s.handle} />
      </View>

      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{taskTitle}</Text>
          {!!taskSubtitle && (
            <Text style={s.subtitle} numberOfLines={1}>{taskSubtitle}</Text>
          )}
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={s.closeBtn}>
          <X s={18} c={C.textMuted} w={2.4} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={C.gold} />
        </View>
      ) : !analytics ? (
        <View style={s.loadingWrap}>
          <Flame s={36} color="#E5E5E2" />
          <Text style={s.emptyTitle}>No analytics yet</Text>
          <Text style={s.emptyBody}>Start completing this task to see your progress.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
        >
          <StreakHero current={analytics.currentStreak} best={analytics.bestStreak} />

          {!!analytics.firstTrackedDate && (
            <Text style={s.trackingSince}>
              Tracking since {formatTrackingDate(analytics.firstTrackedDate)}
            </Text>
          )}

          <ConsistencyCard analytics={analytics} />

          <MiniCalendar analytics={analytics} />
        </ScrollView>
      )}
    </SmoothBottomSheet>
  );
}

/* ── Streak hero ─────────────────────────────────────────── */
function StreakHero({ current, best }: { current: number; best: number }) {
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = 0;
    enter.value = withSpring(1, SPRING);
  }, [current, best, enter]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 12 }, { scale: 0.96 + 0.04 * enter.value }],
  }));

  return (
    <Reanimated.View style={[s.hero, heroStyle]}>
      <LinearGradient
        colors={['#FFFBEB', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.heroGradient}
      />
      <View style={s.heroSide}>
        <View style={s.heroNumberRow}>
          <Flame s={26} filled color={C.gold} />
          <Text style={s.heroNumber}>{current}</Text>
        </View>
        <Text style={s.heroLabel}>Current Streak</Text>
      </View>
      <View style={s.heroDivider} />
      <View style={s.heroSide}>
        <View style={s.heroNumberRow}>
          <TrendingUp s={20} c={C.textMuted} w={2.2} />
          <Text style={[s.heroNumber, s.heroNumberMuted]}>{best}</Text>
        </View>
        <Text style={s.heroLabel}>Best Streak</Text>
      </View>
    </Reanimated.View>
  );
}

/* ── Consistency card ────────────────────────────────────── */
function ConsistencyCard({ analytics }: { analytics: TaskAnalyticsData }) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Target s={13} c={C.gold} w={2.2} />
        <Text style={s.cardEyebrow}>Consistency</Text>
      </View>
      <View style={{ gap: 14 }}>
        <ConsistencyBar label="This Week" data={analytics.thisWeek} delay={0} />
        <ConsistencyBar label="This Month" data={analytics.thisMonth} delay={90} />
        <ConsistencyBar label="Since Start" data={analytics.sinceStart} delay={180} />
      </View>
      {analytics.totalSkips > 0 && (
        <View style={s.cardFoot}>
          <Skip s={11} c={C.textMuted} w={2} />
          <Text style={s.footLabel}>{analytics.totalSkips} skipped</Text>
        </View>
      )}
    </View>
  );
}

function ConsistencyBar({ label, data, delay }: { label: string; data: ConsistencyBucket; delay: number }) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = 0;
    fill.value = withDelay(
      delay,
      withTiming(data.pct / 100, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
  }, [data.pct, delay, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(data.pct > 0 ? 4 : 0, fill.value * 100)}%`,
  }));

  const tone = data.pct >= 80 ? C.gold : data.pct >= 50 ? '#D6BC7A' : data.pct > 0 ? '#E6D6A8' : '#E5E5E2';

  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.barTrack}>
        <Reanimated.View style={[s.barFill, fillStyle, { backgroundColor: tone }]} />
      </View>
      <Text style={s.rowCount}>{data.completed}/{data.scheduled}</Text>
      <Text style={s.rowPct}>{data.pct}%</Text>
    </View>
  );
}

/* ── Mini calendar ───────────────────────────────────────── */
function MiniCalendar({ analytics }: { analytics: TaskAnalyticsData }) {
  const todayKey = getLocalDateKey();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const monthLabel = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const [calendarWidth, setCalendarWidth] = useState(0);
  const cellWidth = calendarWidth > 0 ? (calendarWidth - 1) / 7 : undefined;

  const cells = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const padCount = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const arr: ({ kind: 'pad'; key: string } | { kind: 'day'; day: number; dateStr: string })[] = [];
    for (let i = 0; i < padCount; i++) arr.push({ kind: 'pad', key: `pad-${i}` });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      arr.push({ kind: 'day', day: d, dateStr });
    }
    return arr;
  }, [year, month]);

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Calendar s={13} c={C.gold} w={2.2} />
        <Text style={s.cardEyebrow}>{monthLabel}</Text>
      </View>

      <View
        style={s.calendarMeasure}
        onLayout={event => setCalendarWidth(Math.floor(event.nativeEvent.layout.width))}
      >
        <View style={s.dowRow}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <Text key={`${d}-${i}`} style={[s.dowText, cellWidth ? { width: cellWidth } : null]}>{d}</Text>
          ))}
        </View>

        <View style={s.calGrid}>
          {cells.map((cell, idx) => {
            if (cell.kind === 'pad') return <View key={cell.key} style={[s.calCell, cellWidth ? { width: cellWidth } : null]} />;
            const isToday = cell.dateStr === todayKey;
            const isCompleted = analytics.completedDates.has(cell.dateStr);
            const isSkipped = analytics.skippedDates.has(cell.dateStr);
            const isMissed = analytics.missedDates.has(cell.dateStr);
            const isFuture = cell.dateStr > todayKey;
            return (
              <CalendarCell
                key={cell.dateStr}
                day={cell.day}
                index={idx}
                cellWidth={cellWidth}
                isToday={isToday}
                isCompleted={isCompleted}
                isSkipped={isSkipped}
                isMissed={isMissed}
                isFuture={isFuture}
              />
            );
          })}
        </View>
      </View>

      <View style={s.legendRow}>
        <LegendDot color="#FFF7E6" border="rgba(197,160,89,0.58)" label="Done" />
        <LegendDot color="#F2F1EE" border="#D6D3D1" label="Skipped" />
        <LegendDot color="#FEE2E2" border="transparent" label="Missed" />
        <LegendDot color="#FAFAF9" border={C.border} label="N/A" />
      </View>
    </View>
  );
}

function CalendarCell({
  day, index, cellWidth, isToday, isCompleted, isSkipped, isMissed, isFuture,
}: {
  day: number;
  index: number;
  cellWidth?: number;
  isToday: boolean;
  isCompleted: boolean;
  isSkipped: boolean;
  isMissed: boolean;
  isFuture: boolean;
}) {
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = 0;
    enter.value = withDelay(
      Math.min(index * 8, 240),
      withSpring(1, SPRING),
    );
  }, [enter, index]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.85 + 0.15 * enter.value }],
  }));

  const bg =
    isCompleted ? '#FFF7E6' :
    isSkipped ? '#F2F1EE' :
    isMissed ? '#FEE2E2' :
    'transparent';

  const borderColor =
    isCompleted ? 'rgba(197,160,89,0.58)' :
    isSkipped ? '#D6D3D1' :
    isMissed ? 'transparent' :
    isToday ? C.gold : 'transparent';

  const borderWidth =
    isCompleted ? 1.4 :
    isSkipped ? 1.2 :
    isToday && !isMissed ? 1.5 :
    0;

  const textColor =
    isCompleted ? C.gold :
    isSkipped ? '#78716C' :
    isMissed ? '#F87171' :
    isToday ? C.gold :
    isFuture ? C.border : '#E5E5E2';

  return (
    <Reanimated.View style={[s.calCell, cellWidth ? { width: cellWidth } : null, animStyle]}>
      <View style={[
        s.calCellInner,
        { backgroundColor: bg, borderColor, borderWidth },
        isCompleted && s.calCellInnerDone,
        isSkipped && s.calCellInnerSkipped,
      ]}>
        {isCompleted ? (
          <Flame s={16} filled color={C.gold} />
        ) : isSkipped ? (
          <Flame s={15} filled color="#A8A29E" />
        ) : (
          <Text style={[s.calCellText, { color: textColor, fontWeight: isToday ? '600' : '400' }]}>{day}</Text>
        )}
      </View>
    </Reanimated.View>
  );
}

function LegendDot({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendSwatch, { backgroundColor: color, borderColor: border, borderWidth: border === 'transparent' ? 0 : 1 }]} />
      <Text style={s.legendText}>{label}</Text>
    </View>
  );
}

/* ── helpers ─────────────────────────────────────────────── */
function formatTrackingDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E5E2' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 12,
  },
  title: { fontFamily: F.serifSemiBold, fontSize: 20, color: C.text, letterSpacing: -0.2 },
  subtitle: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: C.textMuted,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F4F4F2',
  },
  loadingWrap: { paddingVertical: 64, alignItems: 'center', gap: 10 },
  emptyTitle: { fontFamily: F.serif, fontSize: 14, color: C.textMuted, marginTop: 6 },
  emptyBody: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: '#C8C5BD',
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 18 },

  /* hero */
  hero: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.gold + '22',
    paddingVertical: 22,
    paddingHorizontal: 20,
    overflow: 'hidden',
    shadowColor: C.gold,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  heroSide: { flex: 1, alignItems: 'center' },
  heroDivider: { width: 1, backgroundColor: C.gold + '1F', marginHorizontal: 8 },
  heroNumberRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroNumber: {
    fontFamily: F.serifMedium, fontSize: 38, color: C.gold, letterSpacing: -0.6, lineHeight: 44,
  },
  heroNumberMuted: { color: C.textSecondary },
  heroLabel: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: C.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  trackingSince: {
    textAlign: 'center',
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: '#C8C5BD',
    textTransform: 'uppercase',
    marginTop: -4,
  },

  /* card */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOpacity: 0.025,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 0,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 16 },
  cardEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.7,
    color: C.textMuted,
    textTransform: 'uppercase',
  },
  cardFoot: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F5F5F2',
  },
  footLabel: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: C.textMuted,
    textTransform: 'uppercase',
  },

  /* consistency row */
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { fontFamily: F.serif, fontSize: 14, color: C.textSecondary, width: 92 },
  barTrack: {
    flex: 1,
    height: 7,
    backgroundColor: '#F5F5F2',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
  rowCount: { fontFamily: F.serifSemiBold, fontSize: 13, color: C.textSecondary, width: 44, textAlign: 'right' },
  rowPct: { fontFamily: F.sansBold, fontSize: 11, color: '#C8C5BD', width: 36, textAlign: 'right' },

  /* calendar */
  calendarMeasure: { width: '100%' },
  dowRow: { flexDirection: 'row', marginBottom: 8 },
  dowText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontFamily: F.sansBold,
    fontSize: 10.5,
    color: '#C8C5BD',
    letterSpacing: 0.8,
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  calCellInner: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCellInnerDone: {
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 5,
    elevation: 1,
  },
  calCellInnerSkipped: {
    shadowColor: '#78716C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.055,
    shadowRadius: 3,
    elevation: 1,
  },
  calCellText: { fontFamily: F.serifMedium, fontSize: 14 },

  /* legend */
  legendRow: {
    flexDirection: 'row', justifyContent: 'center',
    gap: 14, marginTop: 14, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F5F5F2',
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 11, height: 11, borderRadius: 3.5 },
  legendText: { fontFamily: F.sans, fontSize: 10.5, color: C.textMuted },
});
