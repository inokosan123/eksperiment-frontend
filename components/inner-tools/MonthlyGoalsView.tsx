import React, { useMemo, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from '@/components/icons/Icons';
import { useMonthlyGoals } from '@/components/inner-tools/MonthlyGoalsContext';
import { AnimatedGoalCheck, AnimatedStrikeText, fireGoalToggleHaptic } from '@/components/inner-tools/MonthlyGoalRow';
import { F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


const BG = '#FAF7F0';
const GOLD = '#C5A059';
const GREEN = '#16A34A';

function monthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function currentMonthKey() {
  const d = new Date();
  return monthKey(d.getFullYear(), d.getMonth());
}

function formatMonthFull(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1, 12).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

const MONTH_LABELS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export default function MonthlyGoalsView() {
  const { goalsByMonth, addGoal, toggleGoal, deleteGoal } = useMonthlyGoals();
  const todayMonth = currentMonthKey();
  const todayYear = new Date().getFullYear();
  const todayMonthIdx = new Date().getMonth();

  const [selectedMonth, setSelectedMonth] = useState(todayMonth);
  const [draftText, setDraftText] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Year being viewed in the month grid (independent of selectedMonth so the
  // user can browse a year without committing to selecting it).
  const [viewYear, setViewYear] = useState(todayYear);

  // Years that contain at least one goal — used to expand the navigable range
  // beyond [todayYear, todayYear+1].
  const yearsWithGoals = useMemo(() => {
    const set = new Set<number>();
    Object.keys(goalsByMonth).forEach(key => {
      const y = Number(key.slice(0, 4));
      if (Number.isFinite(y)) set.add(y);
    });
    return set;
  }, [goalsByMonth]);

  const minYear = useMemo(() => {
    let min = todayYear;
    yearsWithGoals.forEach(y => { if (y < min) min = y; });
    return min;
  }, [yearsWithGoals, todayYear]);

  const maxYear = todayYear + 10; // long-horizon goal planning

  const canPrevYear = viewYear > minYear;
  const canNextYear = viewYear < maxYear;

  const goPrevYear = () => {
    if (!canPrevYear) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setViewYear(y => y - 1);
  };
  const goNextYear = () => {
    if (!canNextYear) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setViewYear(y => y + 1);
  };

  const monthGoals = useMemo(() => {
    return [...(goalsByMonth[selectedMonth] ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt,
    );
  }, [goalsByMonth, selectedMonth]);

  const completedCount = monthGoals.filter(g => g.isCompleted).length;
  const allDone = monthGoals.length > 0 && completedCount === monthGoals.length;
  const progress = monthGoals.length > 0 ? completedCount / monthGoals.length : 0;
  const progressColor = allDone ? GREEN : GOLD;

  const handleAdd = async () => {
    const text = draftText.trim();
    if (!text) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDraftText('');
    Keyboard.dismiss();
    await addGoal(selectedMonth, text);
  };

  const handleToggle = async (id: string, willComplete: boolean) => {
    fireGoalToggleHaptic(willComplete);
    await toggleGoal(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const id = deleteTargetId;
    setDeleteTargetId(null);
    await deleteGoal(id);
  };

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="MONTHLY GOALS" showBack bg={BG} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Year switcher */}
        <View style={s.yearRow}>
          <TouchableOpacity
            onPress={goPrevYear}
            disabled={!canPrevYear}
            activeOpacity={0.7}
            style={[s.yearBtn, !canPrevYear && s.yearBtnDisabled]}
          >
            <ChevronLeft s={18} c={canPrevYear ? GOLD : '#D6D3D1'} />
          </TouchableOpacity>
          <Text style={s.yearText}>{viewYear}</Text>
          <TouchableOpacity
            onPress={goNextYear}
            disabled={!canNextYear}
            activeOpacity={0.7}
            style={[s.yearBtn, !canNextYear && s.yearBtnDisabled]}
          >
            <ChevronRight s={18} c={canNextYear ? GOLD : '#D6D3D1'} />
          </TouchableOpacity>
        </View>

        {/* Month grid (Jan → Dec) for the viewed year */}
        <View style={s.monthsGrid}>
          {MONTH_LABELS_SHORT.map((label, idx) => {
            const key = monthKey(viewYear, idx);
            const isSelected = key === selectedMonth;
            const hasGoals = (goalsByMonth[key]?.length ?? 0) > 0;
            const allDoneInMonth = hasGoals && goalsByMonth[key]!.every(g => g.isCompleted);
            const isCurrent = key === todayMonth;
            const isPast = viewYear < todayYear || (viewYear === todayYear && idx < todayMonthIdx);
            const isFuture = viewYear > todayYear || (viewYear === todayYear && idx > todayMonthIdx);

            // Visual state hierarchy:
            //   1. Selected → gold gradient
            //   2. Current month (not selected) → gold ring
            //   3. Past + has goals → solid white + colored dot (gold or green)
            //   4. Past + no goals → muted, faded
            //   5. Future + has goals → solid white + dashed gold border
            //   6. Future + no goals → soft white, low contrast
            if (isSelected) {
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setSelectedMonth(key); }}
                  activeOpacity={0.84}
                  style={s.monthCellWrap}
                >
                  <LinearGradient
                    colors={['#E2BD75', '#C5A059', '#A87E33']}
                    locations={[0, 0.55, 1]}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.85, y: 1 }}
                    style={[s.monthCell, s.monthCellSelected]}
                  >
                    <View pointerEvents="none" style={s.monthSheen} />
                    <Text style={[s.monthLabel, s.monthLabelActive]}>{label}</Text>
                    {hasGoals && (
                      <View style={[s.monthDot, { backgroundColor: '#FFFFFF', opacity: 0.85 }]} />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              );
            }

            const cellStyle: any[] = [s.monthCell];
            const labelStyle: any[] = [s.monthLabel];

            if (isCurrent) {
              cellStyle.push(s.monthCellCurrent);
              labelStyle.push(s.monthLabelCurrent);
            } else if (isPast && hasGoals) {
              cellStyle.push(s.monthCellPastFilled);
              labelStyle.push(s.monthLabelPastFilled);
            } else if (isPast) {
              cellStyle.push(s.monthCellPastEmpty);
              labelStyle.push(s.monthLabelPastEmpty);
            } else if (isFuture && hasGoals) {
              cellStyle.push(s.monthCellFutureFilled);
              labelStyle.push(s.monthLabelFutureFilled);
            } else {
              cellStyle.push(s.monthCellFutureEmpty);
              labelStyle.push(s.monthLabelFutureEmpty);
            }

            const dotColor = allDoneInMonth ? '#16A34A' : hasGoals ? GOLD : null;

            return (
              <TouchableOpacity
                key={key}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setSelectedMonth(key); }}
                activeOpacity={0.84}
                style={s.monthCellWrap}
              >
                <View style={cellStyle}>
                  <Text style={labelStyle}>{label}</Text>
                  {isCurrent && <View style={s.monthCurrentUnderline} />}
                  {dotColor && (
                    <View style={[s.monthDot, { backgroundColor: dotColor }]} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Progress card (only when goals exist) */}
        {monthGoals.length > 0 && (
          <LinearGradient
            colors={['#FFFFFF', '#FDF6E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.card}
          >
            <View style={s.progressHead}>
              <Text style={s.progressKicker}>PROGRESS</Text>
              <Text style={[s.progressCount, { color: progressColor }]}>
                {completedCount}<Text style={s.progressCountMuted}>/{monthGoals.length}</Text>
              </Text>
            </View>
            <View style={s.progressTrack}>
              {progress > 0 && (
                allDone ? (
                  <View
                    style={[
                      s.progressFillSolid,
                      { width: `${progress * 100}%`, backgroundColor: GREEN },
                    ]}
                  />
                ) : (
                  <LinearGradient
                    colors={['#E2BD75', '#C5A059', '#A87E33']}
                    locations={[0, 0.55, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[s.progressFillSolid, { width: `${progress * 100}%` }]}
                  />
                )
              )}
            </View>
            {allDone && (
              <Text style={[s.progressDone, { color: GREEN }]}>
                All goals complete for {formatMonthFull(selectedMonth)} 🎉
              </Text>
            )}
          </LinearGradient>
        )}

        {/* Goals list */}
        <View style={{ rowGap: 5 }}>
          {monthGoals.map(goal => (
            <View
              key={goal.id}
              style={[s.goalCard, goal.isCompleted && s.goalCardDone]}
            >
              <AnimatedGoalCheck
                done={goal.isCompleted}
                onPress={() => handleToggle(goal.id, !goal.isCompleted)}
                size={22}
              />
              <AnimatedStrikeText
                text={goal.text}
                done={goal.isCompleted}
                numberOfLines={3}
                textStyle={s.goalText}
              />
              <TouchableOpacity
                onPress={() => { Haptics.selectionAsync().catch(() => {}); setDeleteTargetId(goal.id); }}
                activeOpacity={0.7}
                hitSlop={8}
                style={s.deleteBtn}
              >
                <Trash2 s={15} c="#D6D3D1" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Empty state */}
        {monthGoals.length === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>No goals yet</Text>
            <Text style={s.emptyKicker}>
              SET YOUR INTENTIONS FOR {formatMonthFull(selectedMonth).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Add input */}
        <View style={s.addCard}>
          <TextInput
            value={draftText}
            onChangeText={setDraftText}
            onSubmitEditing={handleAdd}
            placeholder="Add a goal for this month..."
            placeholderTextColor="#C9C5BD"
            returnKeyType="done"
            style={s.addInput}
          />
          <TouchableOpacity
            onPress={handleAdd}
            disabled={!draftText.trim()}
            activeOpacity={0.86}
            style={[s.addBtn, !draftText.trim() && s.addBtnDisabled]}
          >
            <Plus s={15} c="#FFFFFF" w={2.6} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={!!deleteTargetId}
        icon={<Trash2 s={20} c="#EF4444" />}
        iconBg="#FEF2F2"
        title="Delete goal?"
        body="This goal will be permanently removed."
        cancelLabel="KEEP"
        confirmLabel="DELETE"
        confirmColor="#EF4444"
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 60,
    rowGap: 12,
  },

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
    color: '#1A1714',
    minWidth: 90,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 8,
  },
  monthCellWrap: {
    width: '23%', // 4 per row → fits nicely with column gap
  },
  monthCell: {
    minHeight: 54,
    paddingHorizontal: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE9DD',
    overflow: 'hidden',
    position: 'relative',
  },
  monthSheen: {
    position: 'absolute',
    top: 1, left: 1, right: 1,
    height: '46%',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  monthLabel: {
    fontFamily: F.sansBold,
    fontSize: 11.5,
    letterSpacing: 1.5,
    color: '#78716C',
    textTransform: 'uppercase',
  },

  // Selected (gold gradient)
  monthCellSelected: {
    borderWidth: 0,
    shadowColor: '#A87E33',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 3,
  },
  monthLabelActive: { color: '#FFFFFF', letterSpacing: 1.7 },

  // Current month, not selected — clean cell with subtle gold underline
  monthCellCurrent: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EFE9DD',
  },
  monthLabelCurrent: { color: '#1A1714' },
  monthCurrentUnderline: {
    position: 'absolute',
    bottom: 8,
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: GOLD,
  },

  // Past + has goals — solid white, full-strength label, dot indicator
  monthCellPastFilled: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EDE5D6',
  },
  monthLabelPastFilled: { color: '#44403C' },

  // Past + no goals — faded, lower visual weight (nothing was set)
  monthCellPastEmpty: {
    backgroundColor: '#F8F5EE',
    borderColor: '#ECE6DA',
    opacity: 0.48,
  },
  monthLabelPastEmpty: { color: '#A8A29E' },

  // Future + has goals — solid white with subtle dashed gold border (planning intent)
  monthCellFutureFilled: {
    backgroundColor: '#FFFCF3',
    borderColor: 'rgba(197,160,89,0.30)',
    borderStyle: 'dashed',
  },
  monthLabelFutureFilled: { color: '#A8853C' },

  // Future + no goals — soft white, neutral
  monthCellFutureEmpty: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F4F0E8',
  },
  monthLabelFutureEmpty: { color: '#A8A29E' },

  monthDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowColor: '#1C1917',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },

  card: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE9DD',
    padding: 16,
    shadowColor: GOLD,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
  },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressKicker: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: GOLD,
    textTransform: 'uppercase',
  },
  progressCount: { fontFamily: F.serifSemiBold, fontSize: 22, letterSpacing: 0.3 },
  progressCountMuted: { color: '#C9C5BD', fontSize: 17 },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F4EEDD',
    overflow: 'hidden',
  },
  progressFillSolid: { height: '100%', borderRadius: 4 },
  progressDone: {
    marginTop: 10,
    fontFamily: F.serifMediumItalic,
    fontSize: 13,
    textAlign: 'center',
  },

  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDE9E0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#1C1917',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 1,
  },
  goalCardDone: { opacity: 0.7 },
  goalText: {
    fontFamily: F.serifMedium,
    fontSize: 15,
    lineHeight: 21,
    color: '#1A1714',
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  emptyState: {
    paddingVertical: 36,
    alignItems: 'center',
    rowGap: 6,
  },
  emptyTitle: {
    fontFamily: F.serifMediumItalic,
    fontSize: 20,
    color: '#C9C5BD',
  },
  emptyKicker: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: '#C9C5BD',
    textAlign: 'center',
  },

  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    paddingLeft: 16,
    paddingRight: 7,
    paddingVertical: 7,
    shadowColor: '#1C1917',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 1,
  },
  addInput: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 15,
    color: '#1A1714',
    paddingVertical: 6,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 4,
  },
  addBtnDisabled: {
    backgroundColor: '#D6D3D1',
    shadowOpacity: 0,
  },
});
