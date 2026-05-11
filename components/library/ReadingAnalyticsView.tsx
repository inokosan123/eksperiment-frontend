import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import FocusLottie from '@/components/focus/FocusLottie';
import { Book, ChevronLeft, ChevronRight, Clock } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { useReadingList } from './ReadingListContext';

const FLAME_IMG = require('@/assets/images/streak-flame-512.png');
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

type StatsTab = 'sessions' | 'time';

const CATEGORY_COLORS: Record<string, string> = {
  Fiction: '#7C3AED',
  Biography: '#2563EB',
  'Self-Help': '#C5A059',
  Business: '#1c1917',
  Productivity: '#16A34A',
  Spirituality: '#B8860B',
  Theology: '#92400E',
  Patristics: '#7C3AED',
  Prayer: '#C5A059',
  History: '#B45309',
  Classic: '#1C1917',
  Literature: '#4338CA',
  Poetry: '#9D174D',
  Psychology: '#DB2777',
  Philosophy: '#6D28D9',
  Science: '#065F46',
  Health: '#DC2626',
  Nature: '#15803D',
  Art: '#7E22CE',
  Travel: '#0369A1',
  Memoir: '#0F766E',
  Leadership: '#1D4ED8',
};

function hexToRgba(hex: string, alpha: number) {
  const n = hex.replace('#', '');
  const s = n.length === 3 ? n.split('').map(c => `${c}${c}`).join('') : n;
  const p = parseInt(s, 16);
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${alpha})`;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mondayFirstDayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

export default function ReadingAnalyticsView() {
  const { books, sessions } = useReadingList();
  const [tab, setTab] = useState<StatsTab>('sessions');
  const tabProgress = useSharedValue(0);
  const [toggleWidth, setToggleWidth] = useState(0);
  const togglePillWidth = toggleWidth > 0 ? (toggleWidth - 8) / 2 : 0;
  const today = useMemo(() => new Date(), []);
  const todayStr = toLocalDateKey(today);
  const todayDayIndex = mondayFirstDayIndex(today);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  useEffect(() => {
    tabProgress.value = withSpring(tab === 'sessions' ? 0 : 1, {
      damping: 19,
      stiffness: 220,
      mass: 0.75,
    });
  }, [tab, tabProgress]);

  const togglePillStyle = useAnimatedStyle(() => ({
    width: togglePillWidth,
    transform: [{ translateX: tabProgress.value * togglePillWidth }],
  }), [togglePillWidth]);

  const totals = useMemo(() => books.reduce((acc, book) => ({
    sessions: acc.sessions + book.sessions,
    minutes: acc.minutes + book.totalMinutes,
  }), { sessions: 0, minutes: 0 }), [books]);

  const sorted = useMemo(() => [...books]
    .filter(book => book.sessions > 0 || book.totalMinutes > 0)
    .sort((a, b) => tab === 'sessions' ? b.sessions - a.sessions : b.totalMinutes - a.totalMinutes),
  [books, tab]);

  // Weekly bars — real session data, Monday to Sunday.
  const weekData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => ({ sessions: 0, minutes: 0 }));
    const weekStart = new Date(today);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(today.getDate() - todayDayIndex);
    const weekStartKey = toLocalDateKey(weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndKey = toLocalDateKey(weekEnd);

    sessions.forEach(session => {
      if (session.sessionDate < weekStartKey || session.sessionDate > weekEndKey) return;
      const d = new Date(`${session.sessionDate}T12:00:00`);
      const idx = mondayFirstDayIndex(d);
      days[idx].sessions += 1;
      days[idx].minutes += session.minutes;
    });
    return days;
  }, [sessions, today, todayDayIndex]);

  const maxSessionBar = Math.max(...weekData.map(d => d.sessions), 1);
  const maxMinuteBar = Math.max(...weekData.map(d => d.minutes), 1);

  // Calendar days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: { day: number; dateStr: string; count: number; minutes: number }[] = [];
    for (let i = 0; i < offset; i++) cells.push({ day: 0, dateStr: '', count: 0, minutes: 0 });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySessions = sessions.filter(session => session.sessionDate === dateStr);
      const count = daySessions.length;
      const minutes = daySessions.reduce((sum, session) => sum + session.minutes, 0);
      cells.push({ day: d, dateStr, count, minutes });
    }
    return cells;
  }, [calMonth, calYear, sessions]);

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="READING STATS" showBack titleSize={18} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Summary grid — Focus Zone style */}
        <View style={s.gridCard}>
          <View style={s.gridRow}>
            <View style={s.gridCell}>
              <Text style={s.cellLabel}>SESSIONS</Text>
              <Text style={s.cellValue}>{totals.sessions}</Text>
            </View>
            <View style={[s.gridCell, s.accentCell, s.colBorder]}>
              <Text style={[s.cellLabel, s.accentLabel]}>READING TIME</Text>
              <Text style={[s.cellValue, s.accentValue]}>{formatMinutes(totals.minutes)}</Text>
            </View>
          </View>
        </View>

        {/* Toggle — animated pill */}
        <View style={s.toggle} onLayout={event => setToggleWidth(event.nativeEvent.layout.width)}>
          <Reanimated.View style={[s.togglePill, togglePillStyle]} />
          <TouchableOpacity onPress={() => setTab('sessions')} activeOpacity={0.85} style={s.toggleBtn}>
            <FocusLottie name="fire" loop style={[s.toggleFlame, tab !== 'sessions' && { opacity: 0.3 }]} />
            <Text style={[s.toggleText, tab === 'sessions' && s.toggleTextActive]}>Sessions</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('time')} activeOpacity={0.85} style={s.toggleBtn}>
            <Clock s={13} c={tab === 'time' ? C.gold : '#C4BDB5'} />
            <Text style={[s.toggleText, tab === 'time' && s.toggleTextActive]}>Time</Text>
          </TouchableOpacity>
        </View>

        {/* Weekly bars */}
        <View style={s.card}>
          <Text style={s.cardHeading}>THIS WEEK</Text>
          <View style={s.weekBars}>
            {weekData.map((day, index) => {
              const isToday = index === todayDayIndex;
              const value = tab === 'sessions' ? day.sessions : day.minutes;
              const max = tab === 'sessions' ? maxSessionBar : maxMinuteBar;
              const barH = value > 0 ? Math.max(Math.round((value / max) * 72), 10) : 4;
              return (
                <View key={index} style={s.weekCol}>
                  <View style={s.barValueSlot}>
                    {value > 0 && (
                      tab === 'sessions' ? (
                        <View style={s.barValueStack}>
                          <Image source={FLAME_IMG} style={s.barFlame} />
                          <Text style={[s.barValue, isToday && s.todayGold]}>{value}</Text>
                        </View>
                      ) : (
                        <Text style={[s.barValue, isToday && s.todayGold]}>{formatMinutes(value)}</Text>
                      )
                    )}
                  </View>
                  <View style={[
                    s.bar, { height: barH },
                    isToday ? s.barToday : value > 0 ? s.barActive : s.barEmpty,
                    tab === 'time' && (isToday ? s.timeBarToday : value > 0 ? s.timeBarActive : null),
                  ]} />
                  <Text style={[s.dayLabel, isToday && s.todayGold]}>{DAY_LABELS[index]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Calendar */}
        <View style={s.card}>
          <View style={s.monthNav}>
            <TouchableOpacity onPress={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }} style={s.monthBtn} activeOpacity={0.72}>
              <ChevronLeft s={18} c="#A8A29E" />
            </TouchableOpacity>
            <Text style={s.monthTitle}>{MONTH_NAMES[calMonth]} {calYear}</Text>
            <TouchableOpacity onPress={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }} style={s.monthBtn} activeOpacity={0.72}>
              <ChevronRight s={18} c="#A8A29E" />
            </TouchableOpacity>
          </View>
          <View style={s.calendarHeader}>
            {DAY_LABELS.map((d, i) => <Text key={`${d}-${i}`} style={s.calendarHeadText}>{d}</Text>)}
          </View>
          <View style={s.calendarGrid}>
            {calendarDays.map((cell, index) => {
              if (cell.day === 0) return <View key={index} style={s.calendarCellOuter} />;
              const isToday = cell.dateStr === todayStr;
              const hasActivity = tab === 'sessions' ? cell.count > 0 : cell.minutes > 0;
              return (
                <View key={index} style={s.calendarCellOuter}>
                  <View style={[s.calendarCell, isToday && s.todayCell, hasActivity && s.activityCell]}>
                    <Text style={[s.calendarDay, isToday && s.todayDay]}>{cell.day}</Text>
                    {tab === 'sessions' && cell.count > 0 && (
                      <View style={s.calendarActivity}>
                        <Text style={s.calendarCount}>{cell.count > 9 ? '9+' : cell.count}</Text>
                        <Image source={FLAME_IMG} style={s.calendarFlame} />
                      </View>
                    )}
                    {tab === 'time' && cell.minutes > 0 && (
                      <Text style={s.calendarMinutes}>{cell.minutes < 60 ? `${cell.minutes}m` : `${Math.floor(cell.minutes / 60)}h`}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Book list */}
        {sorted.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}><Book s={24} c="#D1D5DB" /></View>
            <Text style={s.emptyTitle}>No reading sessions yet.</Text>
            <Text style={s.emptyBody}>Start a reading session from Reading List first.</Text>
          </View>
        ) : (
          <View style={s.list}>
            {sorted.map((book, index) => {
              const accent = CATEGORY_COLORS[book.category ?? ''] ?? C.gold;
              const statValue = tab === 'sessions' ? String(book.sessions) : formatMinutes(book.totalMinutes);
              const statLabel = tab === 'sessions' ? 'SESSIONS' : '';
              return (
                <View
                  key={book.id}
                  style={[s.bookCard, { borderColor: hexToRgba(accent, 0.18), shadowColor: accent }]}
                >
                  <View style={[s.bookWash, { backgroundColor: hexToRgba(accent, 0.07) }]} />
                  <View style={[s.bookAccent, { backgroundColor: accent }]} />

                  <View style={s.bookBody}>
                    {/* Icon */}
                    <View style={[s.bookIconWrap, { backgroundColor: hexToRgba(accent, 0.1) }]}>
                      <Book s={18} c={accent} />
                    </View>

                    {/* Copy */}
                    <View style={s.bookCopy}>
                      <Text style={s.bookTitle} numberOfLines={1}>{book.title}</Text>
                      {!!book.author && (
                        <Text style={s.bookAuthor} numberOfLines={1}>{book.author}</Text>
                      )}
                    </View>

                    {/* Stat */}
                    <View style={[s.statBadge, { backgroundColor: hexToRgba(accent, 0.09) }]}>
                      {tab === 'sessions'
                        ? <Image source={FLAME_IMG} style={s.fireLottie} />
                        : <Clock s={16} c={accent} />
                      }
                      <Text style={[s.statValue, { color: accent }]}>{statValue}</Text>
                      <Text style={s.statLabel}>{statLabel}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAF8' },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 130, gap: 14 },

  /* Grid card — Focus Zone style */
  gridCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F5F5F4',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 2,
  },
  gridRow: { flexDirection: 'row' },
  gridCell: { flex: 1, paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center' },
  colBorder: { borderLeftWidth: 1, borderLeftColor: '#F5F5F4' },
  accentCell: { backgroundColor: '#FFFBEB' },
  cellLabel: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2,
    color: '#A8A29E',
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  accentLabel: { color: 'rgba(197,160,89,0.7)' },
  cellValue: { fontFamily: F.serifMedium, fontSize: 26, color: '#292524', lineHeight: 28, textAlign: 'center' },
  accentValue: { color: C.gold },
  cellSub: { marginTop: 4, fontFamily: F.serif, fontSize: 12, color: '#C4BDB5', textAlign: 'center' },
  accentSub: { color: 'rgba(197,160,89,0.55)' },

  /* Toggle — Focus Zone style */
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F2EF',
    borderRadius: 18,
    padding: 4,
    position: 'relative',
  },
  togglePill: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  toggleBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    zIndex: 1,
  },
  toggleFlame: { width: 22, height: 22 },
  toggleText: {
    fontFamily: F.sansBold,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#A8A29E',
  },
  toggleTextActive: { color: '#1C1917' },

  /* Book cards — Reading List style */
  list: { gap: 12 },
  bookCard: {
    position: 'relative',
    borderRadius: 26,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 3,
  },
  bookWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 60 },
  bookAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  bookBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 11,
  },
  bookIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookCopy: { flex: 1, minWidth: 0 },
  bookTitle: { fontFamily: F.serifMedium, fontSize: 17, lineHeight: 21, color: '#111827' },
  bookAuthor: { marginTop: 2, fontFamily: F.sans, fontSize: 11, color: '#9CA3AF' },
  statBadge: {
    minWidth: 62,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  fireLottie: { width: 20, height: 20, resizeMode: 'contain' },
  statValue: { fontFamily: F.serifMedium, fontSize: 15, lineHeight: 17 },
  statLabel: {
    marginTop: 3,
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },

  /* Empty state */
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontFamily: F.serifMedium, fontSize: 20, color: '#9CA3AF' },
  emptyBody: { marginTop: 6, fontFamily: F.sans, fontSize: 12, color: '#D1D5DB', textAlign: 'center' },

  // Weekly bars + calendar — identical to Focus Zone stats
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#F5F5F4', borderRadius: 24, padding: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardHeading: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2, color: '#A8A29E', textTransform: 'uppercase', marginBottom: 16 },
  weekBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  weekCol: { flex: 1, alignItems: 'center', gap: 6 },
  barValueSlot: { height: 40, alignItems: 'center', justifyContent: 'flex-end' },
  barValueStack: { alignItems: 'center', gap: 2 },
  barFlame: { width: 15, height: 15, resizeMode: 'contain' },
  barValue: { fontFamily: F.serifBold, fontSize: 13, color: '#57534E' },
  todayGold: { color: C.gold },
  bar: { width: '100%', borderRadius: 8 },
  barToday: { backgroundColor: C.gold },
  barActive: { backgroundColor: 'rgba(197,160,89,0.30)' },
  barEmpty: { backgroundColor: '#F5F5F4' },
  timeBarToday: { backgroundColor: '#1C1917' },
  timeBarActive: { backgroundColor: 'rgba(28,25,23,0.20)' },
  dayLabel: { fontFamily: F.serifBold, fontSize: 13, color: '#D6D3D1', textTransform: 'uppercase', marginTop: 2 },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontFamily: F.serifMedium, fontSize: 20, color: '#44403C' },
  calendarHeader: { flexDirection: 'row', marginBottom: 6 },
  calendarHeadText: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: F.sansBold, fontSize: 12, color: '#D6D3D1' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCellOuter: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  calendarCell: { flex: 1, borderRadius: 10, backgroundColor: 'rgba(245,245,244,0.5)', alignItems: 'center', justifyContent: 'center' },
  todayCell: { borderWidth: 2, borderColor: '#1C1917' },
  activityCell: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: 'rgba(197,160,89,0.22)' },
  calendarDay: { fontFamily: F.serifMedium, fontSize: 13, color: '#A8A29E', lineHeight: 15 },
  todayDay: { fontFamily: F.serifBold, color: '#1C1917' },
  calendarActivity: { flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 1 },
  calendarFlame: { width: 13, height: 13, resizeMode: 'contain' },
  calendarCount: { fontFamily: F.serifBold, fontSize: 12, color: C.gold, lineHeight: 13 },
  calendarMinutes: { fontFamily: F.serifBold, fontSize: 12, color: C.gold, marginTop: 1, lineHeight: 13 },
});
