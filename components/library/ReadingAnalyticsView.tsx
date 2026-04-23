import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { Book, Clock, Flame } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { useReadingList } from './ReadingListContext';

type StatsTab = 'sessions' | 'time';

const CATEGORY_COLORS: Record<string, string> = {
  Fiction: '#7C3AED',
  Biography: '#2563EB',
  'Self-Help': '#C5A059',
  Business: '#1c1917',
  Productivity: '#16A34A',
  Spirituality: '#C5A059',
  History: '#92400E',
  Science: '#0891B2',
  Psychology: '#DB2777',
  Philosophy: '#6B7280',
};

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

export default function ReadingAnalyticsView() {
  const { books } = useReadingList();
  const [tab, setTab] = useState<StatsTab>('sessions');

  const totals = useMemo(() => books.reduce((acc, book) => ({
    sessions: acc.sessions + book.sessions,
    minutes: acc.minutes + book.totalMinutes,
  }), { sessions: 0, minutes: 0 }), [books]);

  const sorted = useMemo(() => [...books]
    .filter(book => book.sessions > 0 || book.totalMinutes > 0)
    .sort((a, b) => tab === 'sessions' ? b.sessions - a.sessions : b.totalMinutes - a.totalMinutes), [books, tab]);

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="READING STATS" showBack />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <View style={[s.summaryIconWrap, { backgroundColor: '#FFF6E8' }]}>
              <Flame s={18} color="#F59E0B" filled />
            </View>
            <Text style={s.summaryValue}>{totals.sessions}</Text>
            <Text style={s.summaryLabel}>{totals.sessions === 1 ? 'SESSION' : 'SESSIONS'}</Text>
          </View>

          <View style={s.summaryCard}>
            <View style={[s.summaryIconWrap, { backgroundColor: '#F7F4EB' }]}>
              <Clock s={14} c={C.gold} />
            </View>
            <Text style={s.summaryValue}>{formatMinutes(totals.minutes)}</Text>
            <Text style={s.summaryLabel}>TOTAL READ</Text>
          </View>
        </View>

        <View style={s.tabBar}>
          {[
            { key: 'sessions' as const, label: 'Sessions', icon: <Flame s={14} color="#F59E0B" filled /> },
            { key: 'time' as const, label: 'Time', icon: <Clock s={12} c={C.gold} /> },
          ].map(item => {
            const active = tab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setTab(item.key)}
                activeOpacity={0.85}
                style={[s.tab, active && s.tabActive]}
              >
                {item.icon}
                <Text style={[s.tabText, active && s.tabTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {sorted.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}><Book s={24} c="#D1D5DB" /></View>
            <Text style={s.emptyTitle}>No reading sessions yet.</Text>
            <Text style={s.emptyBody}>Start a reading session from Reading List first.</Text>
          </View>
        ) : (
          <View style={s.list}>
            {sorted.map(book => {
              const accent = CATEGORY_COLORS[book.category ?? ''] ?? C.gold;
              return (
                <View key={book.id} style={s.rowCard}>
                  <View style={[s.rowAccent, { backgroundColor: accent }]} />
                  <View style={s.rowInner}>
                    <View style={[s.bookIcon, { backgroundColor: `${accent}14` }]}>
                      <Book s={18} c={accent} />
                    </View>
                    <View style={s.rowCopy}>
                      <Text style={s.rowTitle} numberOfLines={1}>{book.title}</Text>
                      {!!book.author && <Text style={s.rowSubtitle} numberOfLines={1}>{book.author}</Text>}
                    </View>
                    <View style={[s.statBadge, { backgroundColor: `${accent}10` }]}>
                      <Text style={[s.statValue, { color: accent }]}>
                        {tab === 'sessions' ? book.sessions : formatMinutes(book.totalMinutes)}
                      </Text>
                      <Text style={s.statLabel}>{tab === 'sessions' ? 'SESSIONS' : 'READ'}</Text>
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
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 130, gap: 16 },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 2,
  },
  summaryIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  summaryValue: { fontFamily: F.serifMedium, fontSize: 28, color: C.text, lineHeight: 30 },
  summaryLabel: { marginTop: 4, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.6, color: '#A8A29E' },
  tabBar: { flexDirection: 'row', borderRadius: 20, backgroundColor: '#F3F4F6', padding: 4, gap: 4 },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  tabActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 1 },
  tabText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.5, color: '#9CA3AF', textTransform: 'uppercase' },
  tabTextActive: { color: '#111827' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0EDE6', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontFamily: F.serifMediumItalic, fontSize: 20, color: '#9CA3AF' },
  emptyBody: { marginTop: 6, fontFamily: F.sans, fontSize: 12, color: '#D1D5DB' },
  list: { gap: 12 },
  rowCard: { flexDirection: 'row', borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0EDE6', overflow: 'hidden' },
  rowAccent: { width: 4 },
  rowInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 16 },
  bookIcon: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: F.serifMedium, fontSize: 18, lineHeight: 22, color: '#111827' },
  rowSubtitle: { marginTop: 2, fontFamily: F.sans, fontSize: 11, color: '#9CA3AF' },
  statBadge: { width: 78, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 8 },
  statValue: { fontFamily: F.serifMedium, fontSize: 18, lineHeight: 20 },
  statLabel: { marginTop: 3, fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.4, color: '#A8A29E' },
});
