import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { ChevronLeft, ChevronRight, Pencil, Feather, FileEdit } from '@/components/icons/Icons';
import SetAsDailyTaskCard from '@/components/shared/SetAsDailyTaskCard';
import SetAsTaskSheet from '@/components/shared/SetAsTaskSheet';
import { useTasks } from '@/components/tasks/TaskProvider';
import { C, F } from '@/constants/tokens';

// April 2026
const HEADERS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const ROWS = [
  [null, null, 1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10, 11, 12],
  [13, 14, 15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24, 25, 26],
  [27, 28, 29, 30, null, null, null],
];
const TODAY = 20;

type DotKind = 'daily' | 'morning' | 'free';
const DOT_COLORS: Record<DotKind, string> = {
  daily:   '#C5A059',
  morning: '#6D5AAE',
  free:    '#3E9B89',
};

const JOURNAL_DOTS: Record<number, DotKind[]> = {
  1:  ['daily', 'morning', 'free'],
  2:  ['daily', 'free'],
  4:  ['daily', 'free'],
  5:  ['daily'],
  6:  ['daily', 'morning', 'free'],
  14: ['daily', 'free'],
  15: ['daily', 'free'],
  20: ['daily', 'free'],
};

function MonthCalendar() {
  return (
    <View style={cal.wrap}>
      <View style={cal.header}>
        <ChevronLeft s={20} c={C.gold} />
        <Text style={cal.month}>April 2026</Text>
        <ChevronRight s={20} c={C.gold} />
      </View>

      <View style={cal.dayHeaders}>
        {HEADERS.map(h => (
          <Text key={h} style={cal.dayHeader}>{h}</Text>
        ))}
      </View>

      {ROWS.map((row, ri) => (
        <View key={ri} style={cal.row}>
          {row.map((d, ci) => {
            if (d === null) return <View key={ci} style={cal.cell} />;
            const isToday = d === TODAY;
            const isFuture = d > TODAY;
            const dots = JOURNAL_DOTS[d] || [];
            return (
              <View key={ci} style={cal.cell}>
                <View style={[cal.dayCircle, isToday && cal.todayCircle]}>
                  <Text style={[cal.dayNum, {
                    color: isToday ? C.gold : isFuture ? C.textMuted : C.text,
                    fontWeight: isToday ? '600' : '400',
                  }]}>{d}</Text>
                </View>
                <View style={cal.dots}>
                  {dots.map((kind, j) => (
                    <View key={j} style={[cal.dot, { backgroundColor: DOT_COLORS[kind] }]} />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      ))}

      <View style={cal.legend}>
        {(['daily', 'morning', 'free'] as DotKind[]).map(kind => (
          <View key={kind} style={cal.legendItem}>
            <View style={[cal.legendDot, { backgroundColor: DOT_COLORS[kind] }]} />
            <Text style={cal.legendTxt}>
              {kind === 'daily' ? 'Daily Journal' : kind === 'morning' ? 'Morning Pages' : 'Free Writing'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const cal = StyleSheet.create({
  wrap: { marginHorizontal: 18, marginTop: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0efeb', borderRadius: 20, padding: 18, paddingBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2, elevation: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  month: { fontFamily: F.serifMedium, fontSize: 22, color: C.text },
  dayHeaders: { flexDirection: 'row' },
  dayHeader: { flex: 1, textAlign: 'center', fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.2, color: C.textMuted, paddingBottom: 10 },
  row: { flexDirection: 'row', marginBottom: 6 },
  cell: { flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  dayCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  todayCircle: { borderColor: C.gold },
  dayNum: { fontFamily: F.serifMedium, fontSize: 15 },
  dots: { flexDirection: 'row', gap: 3, marginTop: 3, height: 5 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  legend: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f0efeb', flexDirection: 'row', justifyContent: 'space-around' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontFamily: F.sans, fontSize: 11, color: C.textSecondary },
});

type ModeCardTone = { bg: string; fg: string };

function ModeCard({ Icon, title, status, tone }: { Icon: React.ComponentType<any>; title: string; status: string; tone: ModeCardTone }) {
  return (
    <TouchableOpacity activeOpacity={0.85} style={mc.card}>
      <View style={[mc.iconWrap, { backgroundColor: tone.bg }]}>
        <Icon s={20} c={tone.fg} />
      </View>
      <Text style={mc.title}>{title}</Text>
      <Text style={mc.status}>{status}</Text>
    </TouchableOpacity>
  );
}

const mc = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0efeb', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 8, alignItems: 'center' },
  iconWrap: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.serifMedium, fontSize: 17, color: C.text, marginTop: 12, lineHeight: 20 },
  status: { fontFamily: F.sans, fontSize: 11, color: C.textMuted, marginTop: 6 },
});

export default function JournalView() {
  const insets = useSafeAreaInsets();
  const { createOrUpdateTask } = useTasks();
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const [taskSummary, setTaskSummary] = useState('Add to your daily routine');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenTitleBar title="JOURNAL" showBack />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <MonthCalendar />

        {/* Set as Daily Task */}
        <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
          <SetAsDailyTaskCard onPress={() => setShowTaskSheet(true)} variant="soft" subtitle={taskSummary} />
        </View>

        {/* Mode cards */}
        <View style={jv.modeRow}>
          <ModeCard Icon={Pencil}   title="Daily Journal"  status="Done"     tone={{ bg: '#F5ECD7', fg: C.gold }} />
          <ModeCard Icon={Feather}  title="Morning Pages"  status="Start"    tone={{ bg: '#ECE8F5', fg: '#6D5AAE' }} />
          <ModeCard Icon={FileEdit} title="Free Writing"   status="Continue" tone={{ bg: '#DFF1EC', fg: '#3E9B89' }} />
        </View>
      </ScrollView>

      <SetAsTaskSheet
        visible={showTaskSheet}
        context="journal"
        onClose={() => setShowTaskSheet(false)}
        onSummaryChange={setTaskSummary}
        onTaskDraft={createOrUpdateTask}
      />
    </View>
  );
}

const jv = StyleSheet.create({
  modeRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 14 },
});
