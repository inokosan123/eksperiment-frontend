import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import Reanimated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { ChevronLeft, ChevronRight, Skip, X } from '@/components/icons/Icons';
import {
  DAY_TOKEN,
  FLAME_PNG,
  DoneToken,
  FutureStud,
  LEGEND_TOKEN,
  MissedToken,
  OffStud,
  SkippedToken,
  TodayToken,
} from './TaskDayTokens';
import { C, F } from '@/constants/tokens';
import { getTaskAnalytics, type ConsistencyBucket, type TaskAnalyticsData } from './taskAnalytics';
import { getLocalDateKey } from './taskScheduler';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';

/* ─────────────────────────────────────────────────────────────
 * TASK ANALYTICS — what a long press on a task opens.
 *
 * Rebuilt to stand beside `TrophyCalendarSheet` and
 * `JournalStreakSheet`, which are the app's two finished streak
 * rooms. The order Pavle set stays: the two numbers, then
 * consistency, then the calendar.
 *
 * ⚠ NO CARDS. The old sheet stacked three white plates inside a
 * white sheet — plates within a plate, which the app has a standing
 * rule against, and which cost every section 40pt of its own width
 * in padding and borders. Both streak sheets lay everything OPEN ON
 * THE PAGE and divide sections with a fading rule. So does this now.
 *
 * THE CALENDAR IS THE STREAK SHEETS' OWN, as asked:
 *   · 34pt circle month nav either side of a 19pt serif month;
 *   · MON…SUN at 9.5pt, today's column struck in gold;
 *   · the mark ON TOP and the day number BENEATH it, rather than a
 *     number hidden inside a tile;
 *   · and THE BAND — consecutive completed days fuse into one gold
 *     run, drawn per cell as two half segments so neighbours meet
 *     seamlessly at the border. That band is the whole reason those
 *     sheets read as a streak rather than as a grid, and it is what
 *     this calendar was missing.
 *
 * Front-end only: every number, date and set still comes from
 * `getTaskAnalytics` exactly as before.
 * ───────────────────────────────────────────────────────────── */

const enter = (delay: number) => FadeInDown.duration(360).delay(delay);

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const INK = '#4A3820';

/* ─────────────────────────────────────────────────────────────
 * THE GRID'S MEASUREMENTS, all derived from the token.
 *
 * Nothing below is typed twice. The band in particular has to sit on the
 * TOKEN's vertical centre — hand-typed, it drifts off the coins the first
 * time the token size moves, which is exactly what happened once already.
 * ───────────────────────────────────────────────────────────── */
/** The streak figure's height: the number's line box, and the mark's box. */
const STAT_H = 50;

const CELL_PAD = 4;
/** The token's box: a little taller than the coin, so rows never touch. */
const MARK_BOX = DAY_TOKEN + 5;
/** The band is narrower than the coin, so the coin plainly rides on it. */
const BAND_H = Math.round(DAY_TOKEN * 0.72);
const BAND_TOP = CELL_PAD + MARK_BOX / 2 - BAND_H / 2;

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
      sheetStyle={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 14 }]}
    >
      <View style={s.handleWrap}>
        <View style={s.handle} />
      </View>

      <View style={s.header}>
        <View style={s.headerCopy}>
          {!!taskSubtitle && (
            <Text style={s.kicker} numberOfLines={1}>{taskSubtitle}</Text>
          )}
          <Text style={s.title} numberOfLines={2}>{taskTitle}</Text>
        </View>
        <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={s.closeBtn}>
          <X s={17} c={C.textMuted} w={2.4} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.stateWrap}>
          <ActivityIndicator color={C.gold} />
        </View>
      ) : !analytics ? (
        <View style={s.stateWrap}>
          <Image source={FLAME_PNG} style={s.emptyFlame} />
          <Text style={s.emptyTitle}>No analytics yet</Text>
          <Text style={s.emptyBody}>Start completing this task to see your progress.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
          <StreakPair
            current={analytics.currentStreak}
            best={analytics.bestStreak}
            since={analytics.firstTrackedDate}
          />

          <SectionRule tight />

          <ConsistencySection analytics={analytics} />

          <SectionRule />

          <MonthCalendar analytics={analytics} />
        </ScrollView>
      )}
    </SmoothBottomSheet>
  );
}

/* ── A number that arrives ────────────────────────────────────
 * Rolled up on the UI thread through an uneditable TextInput — the
 * Reanimated ReText move, so counting costs no re-renders. Lifted from
 * `TrophyCalendarSheet`, which is where this sheet's whole register comes
 * from. */
const AnimatedTextInput = Reanimated.createAnimatedComponent(TextInput);

function CountUp({
  value,
  delay = 0,
  textStyle,
}: {
  value: number;
  delay?: number;
  textStyle: StyleProp<TextStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const n = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    n.value = 0;
    n.value = withDelay(delay, withTiming(value, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    }));
    return () => cancelAnimation(n);
  }, [delay, n, reduceMotion, value]);

  const animatedProps = useAnimatedProps(() => ({
    text: String(Math.round(n.value)),
  } as never));

  // A zero has nothing to count from, and reduced motion wants none of it —
  // both take the plain Text, which also keeps the TextInput off the tree.
  if (reduceMotion || value === 0) {
    return <Text style={textStyle} allowFontScaling={false}>{value}</Text>;
  }
  return (
    <View pointerEvents="none">
      <AnimatedTextInput
        editable={false}
        caretHidden
        allowFontScaling={false}
        maxFontSizeMultiplier={1}
        underlineColorAndroid="transparent"
        defaultValue="0"
        animatedProps={animatedProps}
        style={[textStyle, s.countUpReset]}
      />
    </View>
  );
}

/* ── The two numbers ─────────────────────────────
 * A PAIR, and the SAME flame twice — because that is the distinction the
 * whole sheet is built on. The calendar tells a lit day from a spent one by
 * burning the flame or letting it go to ash; the two numbers say the same
 * thing at the top of the page:
 *
 *   CURRENT   the fire still going — full colour, standing in its own pool
 *             of light, the same pool the DONE token carries.
 *   BEST      the fire that was — the identical asset struck in ash under an
 *             ink number. A record, not a loss.
 *
 * One PNG, two states, no second idea.
 */
function StreakPair({ current, best, since }: { current: number; best: number; since?: string }) {
  const beaten = best > 0 && current >= best;

  return (
    <Reanimated.View entering={enter(40)} style={s.pairWrap}>
      <View style={s.pair}>
        <StreakStat value={current} delay={260} label="CURRENT STREAK" lit />
        <View style={s.pairSplit}>
          <View style={s.pairSplitLine} />
          <View style={s.pairSplitDiamond} />
          <View style={s.pairSplitLine} />
        </View>
        {/* When the live run has caught the record the sheet says so once,
            quietly — the two numbers are equal and the reader deserves to be
            told why rather than left to compare them. */}
        <StreakStat
          value={best}
          delay={380}
          label={beaten ? 'BEST YET' : 'BEST STREAK'}
          lit={beaten}
          matched={beaten}
        />
      </View>

      {!!since && (
        <Text style={s.since}>
          Task started <Text style={s.sinceDate}>{formatTrackingDate(since)}</Text>
        </Text>
      )}
    </Reanimated.View>
  );
}

/**
 * One figure: THE NUMBER LEFT, THE FLAME RIGHT, and the unit struck across it.
 *
 * ⚠ The right-hand group is exactly as tall as the number's line box
 * (`STAT_H`), which is what makes the two halves read as one figure instead
 * of a number with a picture next to it. Inside that height the flame sits at
 * the top and the unit plaque hangs off the bottom, riding UP over the
 * flame's foot — the overlap is the whole point, so the plaque is positioned
 * absolutely rather than laid out in flow.
 *
 * The unit is set in the app's bold sans at an angle, not the serif italic it
 * wore before: a small italic over a flame is unreadable, and a struck,
 * tilted plaque is legible at any size and looks like it was stamped there.
 */
function StreakStat({
  value,
  delay,
  label,
  lit,
  matched = false,
}: {
  value: number;
  delay: number;
  label: string;
  lit: boolean;
  matched?: boolean;
}) {
  return (
    <View style={s.statCell}>
      <View style={s.statRow}>
        <CountUp
          value={value}
          delay={delay}
          textStyle={[s.statValue, lit ? s.statValueGold : s.statValueInk]}
        />

        <View style={s.statMark}>
          {lit && !matched && <View pointerEvents="none" style={s.statGlow} />}
          <Image
            key={lit ? 'stat-flame-lit' : 'stat-flame-ash'}
            source={FLAME_PNG}
            style={[
              s.statFlame,
              !lit && s.statFlameAsh,
              matched && s.statFlameMatched,
            ]}
          />
          <View style={[s.statUnit, lit ? s.statUnitLit : s.statUnitAsh]}>
            <Text
              style={[s.statUnitText, lit ? s.statUnitTextLit : s.statUnitTextAsh]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {value === 1 ? 'Day' : 'Days'}
            </Text>
          </View>
        </View>
      </View>

      <Text style={[s.pairLabel, lit && s.pairLabelGold]}>{label}</Text>
    </View>
  );
}

/**
 * `tight` closes the seam above the rule.
 *
 * The first rule follows the "Tracking since" line, and that line belongs to
 * the pair above it — a full seam on both sides left it stranded between two
 * blocks, reading as neither.
 */
function SectionRule({ tight = false }: { tight?: boolean }) {
  return (
    <View style={[s.rule, tight && s.ruleTight]}>
      <View style={s.ruleLine} />
      <View style={s.ruleDiamond} />
      <View style={s.ruleLine} />
    </View>
  );
}

/* ── Consistency ─────────────────────────────────
 * THREE DIALS, not three bars.
 *
 * The bars had two faults and only one was the palette. A rail is a
 * comparison instrument — it wants a shared axis and a common scale — and
 * these three periods do not compare: a week of 7 and a year of 300 are
 * different questions, and stacking them made the year look like a failed
 * week. Each period deserves its own instrument.
 *
 * A dial gives one: the ring IS the period, whatever its length, and the arc
 * is how much of it was kept. Three of them read side by side in a glance,
 * where three stacked rails read one at a time.
 *
 * It also rhymes. This sheet is full of struck gold discs — every kept day in
 * the calendar below is one — so a row of gold rings above them belongs to
 * the same object rather than arriving from a chart library.
 *
 * ⚠ THE ARC IS THE READING, so the colour does not have to be. All three
 * rings are one gold and the SWEEP carries the number; only crossing 80
 * changes anything, and what it changes is that the ring lights — the same
 * glow the DONE token wears. That is why the old lightness ladder is gone: it
 * was asking colour to say what the geometry already said, and going pale to
 * do it.
 */
export type TaskConsistencySummary = Pick<
  TaskAnalyticsData,
  'thisWeek' | 'thisMonth' | 'sinceStart' | 'totalSkips'
>;

export function TaskConsistencyDials({
  analytics,
  accent = C.gold,
  title = 'CONSISTENCY',
  sinceStartLabel = 'Since start',
}: {
  analytics: TaskConsistencySummary;
  accent?: string;
  title?: string;
  sinceStartLabel?: string;
}) {
  return (
    <Reanimated.View entering={enter(120)}>
      <View style={s.sectionHead}>
        <Text style={s.sectionLabel}>{title}</Text>
        {analytics.totalSkips > 0 && (
          <View style={s.skipChip}>
            <Skip s={10} c="#9A9488" w={2.2} />
            <Text style={s.skipText}>{analytics.totalSkips} skipped</Text>
          </View>
        )}
      </View>
      <View style={s.dials}>
        <ConsistencyDial label="This week" data={analytics.thisWeek} delay={340} accent={accent} />
        <ConsistencyDial label="This month" data={analytics.thisMonth} delay={440} accent={accent} />
        <ConsistencyDial label={sinceStartLabel} data={analytics.sinceStart} delay={540} accent={accent} />
      </View>
    </Reanimated.View>
  );
}

function ConsistencySection({ analytics }: { analytics: TaskAnalyticsData }) {
  return <TaskConsistencyDials analytics={analytics} />;
}

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

const DIAL = 76;
const DIAL_STROKE = 7;
const DIAL_R = (DIAL - DIAL_STROKE) / 2;
const DIAL_C = 2 * Math.PI * DIAL_R;
/**
 * The shortest arc that still draws as a shape.
 *
 * ⚠ Derived from the STROKE, not guessed. A round-capped arc shorter than its
 * own stroke width renders as a clipped nub — at a hand-picked 2.2% the floor
 * came out 4.8pt against a 7pt cap, so a 1% week drew as a speck the eye reads
 * as dirt rather than as a reading.
 */
const DIAL_MIN = (DIAL_STROKE * 1.05) / DIAL_C;

function ConsistencyDial({
  label,
  data,
  delay,
  accent,
}: {
  label: string;
  data: ConsistencyBucket;
  delay: number;
  accent: string;
}) {
  const reduceMotion = useReducedMotion();
  const asked = data.scheduled > 0;
  const target = asked ? Math.min(1, data.pct / 100) : 0;
  const sweep = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    if (reduceMotion) {
      sweep.value = target;
      return;
    }
    sweep.value = 0;
    sweep.value = withDelay(
      delay,
      withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
    return () => cancelAnimation(sweep);
  }, [delay, reduceMotion, sweep, target]);

  // A sweep with anything in it never draws shorter than its own round cap,
  // or a 1% week renders as a dot the eye reads as a speck of dirt.
  const arcProps = useAnimatedProps(() => {
    const drawn = sweep.value <= 0 ? 0 : Math.max(DIAL_C * DIAL_MIN, DIAL_C * sweep.value);
    return { strokeDashoffset: DIAL_C - drawn };
  });

  const strong = asked && data.pct >= 80;

  return (
    <View style={s.dialCell}>
      <View style={[s.dialStage, strong && s.dialLit, strong && { shadowColor: accent }]}>
        <Svg width={DIAL} height={DIAL}>
          <Circle
            cx={DIAL / 2}
            cy={DIAL / 2}
            r={DIAL_R}
            fill="none"
            stroke={asked ? '#EBE5D6' : '#F1EFEA'}
            strokeWidth={DIAL_STROKE}
          />
          {asked && (
            <AnimatedCircle
              cx={DIAL / 2}
              cy={DIAL / 2}
              r={DIAL_R}
              fill="none"
              stroke={accent}
              strokeWidth={DIAL_STROKE}
              strokeLinecap="round"
              strokeDasharray={DIAL_C}
              animatedProps={arcProps}
              // Twelve o'clock, clockwise. Without this the arc starts at
              // three and every dial reads as if it were already a quarter in.
              transform={`rotate(-90 ${DIAL / 2} ${DIAL / 2})`}
            />
          )}
        </Svg>
        <View style={s.dialFace} pointerEvents="none">
          {/* A period that scheduled nothing has no percentage to give. It read
              0% before, which blames the reader for a week that never asked
              anything of them. */}
          <Text style={[s.dialPct, strong && s.dialPctStrong, strong && { color: accent }, !asked && s.dialPctIdle]}>
            {asked ? data.pct : '—'}
            {asked && <Text style={s.dialPctSign}>%</Text>}
          </Text>
        </View>
      </View>
      <Text style={s.dialLabel}>{label}</Text>
      <Text style={s.dialCount}>{asked ? `${data.completed} of ${data.scheduled}` : 'none set'}</Text>
    </View>
  );
}

/* ── Calendar ─────────────────────────────────────────────────
 * The streak sheets' calendar, cell for cell. See the note at the head of
 * this file for what was taken and why. */
type CellState = 'blank' | 'done' | 'skipped' | 'missed' | 'today' | 'future' | 'off';

type Cell = {
  day: number;
  dateStr: string;
  cell: CellState;
  /** Half segments of the band, so neighbours meet at the cell border. */
  linkLeft: boolean;
  linkRight: boolean;
  /** The paler gold, where the run only reaches into today. */
  softLeft: boolean;
  softRight: boolean;
  /** The grey tone, where the run is carried across a skipped day. */
  greyLeft: boolean;
  greyRight: boolean;
  /** This day is a skip the run passes over. */
  bridge: boolean;
};

function MonthCalendar({ analytics }: { analytics: TaskAnalyticsData }) {
  const todayKey = getLocalDateKey();
  const currentMonthKey = monthKeyFromDateKey(todayKey);
  const rawFirstMonthKey = monthKeyFromDateKey(analytics.calendarStartDate ?? analytics.firstTrackedDate ?? todayKey);
  const firstMonthKey = rawFirstMonthKey > currentMonthKey ? currentMonthKey : rawFirstMonthKey;
  const [visibleMonthKey, setVisibleMonthKey] = useState(currentMonthKey);
  const monthKey = clampMonthKey(visibleMonthKey, firstMonthKey, currentMonthKey);
  const { year, month } = parseMonthKey(monthKey);
  const canGoPrevious = monthKey > firstMonthKey;
  const canGoNext = monthKey < currentMonthKey;

  useEffect(() => {
    setVisibleMonthKey(currentMonthKey);
  }, [analytics.calendarStartDate, analytics.firstTrackedDate, currentMonthKey]);

  useEffect(() => {
    if (visibleMonthKey !== monthKey) setVisibleMonthKey(monthKey);
  }, [monthKey, visibleMonthKey]);

  const shiftMonth = (direction: -1 | 1) => {
    setVisibleMonthKey(prev => clampMonthKey(shiftMonthKey(prev, direction), firstMonthKey, currentMonthKey));
  };

  const onCurrentMonth = monthKey === currentMonthKey;
  const todayColumn = useMemo(() => {
    const dow = new Date(`${todayKey}T12:00:00`).getDay();
    return dow === 0 ? 6 : dow - 1;
  }, [todayKey]);

  const cells = useMemo<Cell[]>(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const leading = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const blank = (): Cell => ({
      day: 0, dateStr: '', cell: 'blank',
      linkLeft: false, linkRight: false, softLeft: false, softRight: false,
      greyLeft: false, greyRight: false, bridge: false,
    });

    const result: Cell[] = [];
    for (let i = 0; i < leading; i++) result.push(blank());

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      let cell: CellState;
      if (analytics.completedDates.has(dateStr)) cell = 'done';
      else if (dateStr === todayKey) cell = 'today';
      else if (analytics.skippedDates.has(dateStr)) cell = 'skipped';
      else if (analytics.missedDates.has(dateStr)) cell = 'missed';
      else if (dateStr > todayKey) cell = 'future';
      else cell = 'off';
      result.push({
        day: d, dateStr, cell,
        linkLeft: false, linkRight: false, softLeft: false, softRight: false,
      greyLeft: false, greyRight: false, bridge: false,
      });
    }

    // ── A SKIP DOES NOT BREAK THE RUN ──────────────────────────────────
    // flame · skip · flame · flame is one streak, so the band has to carry
    // over the skipped day. Any stretch of skips with a completed day on BOTH
    // sides becomes a bridge; a trailing skip with nothing beyond it does not,
    // because there is no run on the far side to reach.
    for (let i = 0; i < result.length; i++) {
      if (result[i].cell !== 'skipped') continue;
      let prev = i - 1;
      while (prev >= 0 && result[prev].cell === 'skipped') prev--;
      let next = i + 1;
      while (next < result.length && result[next].cell === 'skipped') next++;
      if (result[prev]?.cell === 'done' && result[next]?.cell === 'done') {
        result[i].bridge = true;
      }
    }

    // Fuse run members into bands. Drawing stays inside the week row: a run
    // that crosses a Sunday is still a run, but a band wrapping to the far
    // side of the grid would read as a line to nowhere.
    const inRun = (entry?: Cell) => !!entry && (entry.cell === 'done' || entry.bridge);
    for (let i = 0; i < result.length; i++) {
      if (!inRun(result[i])) continue;
      result[i].linkLeft = i % 7 !== 0 && inRun(result[i - 1]);
      result[i].linkRight = i % 7 !== 6 && inRun(result[i + 1]);
    }

    // ⚠ The seam decides the tone, not the cell. A half segment is GREY when
    // either side of it is a bridge — otherwise the gold would stop dead at
    // the skip's edge and the carry would look like two runs rather than one.
    for (let i = 0; i < result.length; i++) {
      if (result[i].linkLeft) {
        result[i].greyLeft = result[i].bridge || result[i - 1]?.bridge === true;
      }
      if (result[i].linkRight) {
        result[i].greyRight = result[i].bridge || result[i + 1]?.bridge === true;
      }
    }

    // A live run reaches into today when yesterday was kept — in the paler
    // gold, because today is not earned yet.
    const todayIndex = result.findIndex(entry => entry.cell === 'today');
    if (todayIndex > 0 && todayIndex % 7 !== 0 && inRun(result[todayIndex - 1])) {
      result[todayIndex].linkLeft = true;
      result[todayIndex].softLeft = true;
      result[todayIndex - 1].linkRight = true;
      result[todayIndex - 1].softRight = true;
    }
    return result;
  }, [analytics.completedDates, analytics.missedDates, analytics.skippedDates, month, todayKey, year]);

  return (
    <Reanimated.View entering={enter(200)}>
      <View style={s.monthRow}>
        <TouchableOpacity
          activeOpacity={0.72}
          disabled={!canGoPrevious}
          onPress={() => shiftMonth(-1)}
          style={[s.monthBtn, !canGoPrevious && s.monthBtnOff]}
          haptic={canGoPrevious ? 'selection' : 'none'}
        >
          <ChevronLeft s={18} c={canGoPrevious ? C.textSecondary : '#D6D3D1'} />
        </TouchableOpacity>
        <Text style={s.monthTitle}>{formatMonthLabel(monthKey)}</Text>
        <TouchableOpacity
          activeOpacity={0.72}
          disabled={!canGoNext}
          onPress={() => shiftMonth(1)}
          style={[s.monthBtn, !canGoNext && s.monthBtnOff]}
          haptic={canGoNext ? 'selection' : 'none'}
        >
          <ChevronRight s={18} c={canGoNext ? C.textSecondary : '#D6D3D1'} />
        </TouchableOpacity>
      </View>

      <View style={s.weekHeader}>
        {DAY_LABELS.map((label, index) => (
          <Text
            key={label}
            style={[s.weekLetter, onCurrentMonth && index === todayColumn && s.weekLetterToday]}
          >
            {label}
          </Text>
        ))}
      </View>

      <View key={monthKey} style={s.grid}>
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, rowIndex) => (
          <View key={`week-${rowIndex}`} style={s.weekRow}>
            {Array.from({ length: 7 }, (_, columnIndex) => {
              const entry = cells[rowIndex * 7 + columnIndex];
              if (!entry || entry.cell === 'blank') {
                return <View key={`day-${columnIndex}`} style={s.cell} />;
              }
              return (
                <View key={`day-${columnIndex}`} style={s.cell}>
                  {entry.linkLeft && (
                    <View
                      style={[
                        s.band,
                        s.bandLeft,
                        entry.softLeft && s.bandSoft,
                        entry.greyLeft && s.bandGrey,
                      ]}
                    />
                  )}
                  {entry.linkRight && (
                    <View
                      style={[
                        s.band,
                        s.bandRight,
                        entry.softRight && s.bandSoft,
                        entry.greyRight && s.bandGrey,
                      ]}
                    />
                  )}
                  <View style={s.cellInner}>
                    <View style={s.markWrap}>
                      <DayMark cell={entry.cell} />
                    </View>
                    <Text
                      style={[
                        s.cellDay,
                        entry.cell === 'done' && s.cellDayDone,
                        entry.cell === 'today' && s.cellDayToday,
                      ]}
                      allowFontScaling={false}
                    >
                      {entry.day}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Each swatch is the REAL token at legend size, not an approximation
          of it — a legend drawn separately from the thing it explains drifts
          from it the first time either is touched. */}
      <View style={s.legendRow}>
        <View style={s.legendItem}>
          <DoneToken size={LEGEND_TOKEN} />
          <Text style={s.legendText}>done</Text>
        </View>
        <View style={s.legendDiamond} />
        <View style={s.legendItem}>
          <SkippedToken size={LEGEND_TOKEN} />
          <Text style={s.legendText}>skipped</Text>
        </View>
        <View style={s.legendDiamond} />
        <View style={s.legendItem}>
          <MissedToken size={LEGEND_TOKEN} />
          <Text style={s.legendText}>missed</Text>
        </View>
      </View>
    </Reanimated.View>
  );
}

/**
 * One day, struck.
 *
 * Every face comes from `TaskDayTokens`, which is built on the same flame
 * PNG Home's progress calendar uses — see that file for what is shared and
 * what is deliberately simpler here.
 */
function DayMark({ cell }: { cell: CellState }) {
  if (cell === 'done') return <DoneToken />;
  if (cell === 'today') return <TodayToken />;
  if (cell === 'skipped') return <SkippedToken />;
  if (cell === 'missed') return <MissedToken />;
  if (cell === 'future') return <FutureStud />;
  return <OffStud />;
}

/* ── helpers ─────────────────────────────────────────────── */
function monthKeyFromDateKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month: (month || 1) - 1 };
}

function shiftMonthKey(monthKey: string, offset: number) {
  const { year, month } = parseMonthKey(monthKey);
  const next = new Date(year, month + offset, 1, 12, 0, 0, 0);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function clampMonthKey(monthKey: string, minMonthKey: string, maxMonthKey: string) {
  if (monthKey < minMonthKey) return minMonthKey;
  if (monthKey > maxMonthKey) return maxMonthKey;
  return monthKey;
}

function formatMonthLabel(monthKey: string) {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(year, month, 1, 12, 0, 0, 0).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

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
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 2 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E5E2' },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  // The kicker leads and the name follows, the way every finished sheet in the
  // app sets a heading — the old order had a serif title with a tracked
  // all-caps line under it, which reads as a subtitle rather than a category.
  kicker: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: C.textMuted,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  title: { fontFamily: F.serifSemiBold, fontSize: 23, lineHeight: 28, color: C.text, letterSpacing: -0.3 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F4F4F2',
    marginTop: 2,
  },

  stateWrap: { paddingVertical: 60, alignItems: 'center', gap: 10 },
  emptyFlame: { width: 40, height: 40, resizeMode: 'contain', tintColor: '#E2DED4', opacity: 0.9 },
  emptyTitle: { fontFamily: F.serif, fontSize: 15, color: C.textMuted, marginTop: 6 },
  emptyBody: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: '#C8C5BD',
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  scrollContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 26 },

  /* The two numbers */
  countUpReset: { padding: 0, margin: 0 },
  pairWrap: { alignItems: 'center' },
  pair: { flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'stretch' },

  statCell: { flex: 1, alignItems: 'center' },
  statRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 1 },
  statValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 44,
    lineHeight: STAT_H,
    letterSpacing: -1.4,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  statValueGold: { color: C.gold },
  statValueInk: { color: INK },

  // ⚠ Sized to the PLAQUE, and no wider — the plaque is absolutely positioned
  // in here, so the box is what bounds its width, and the word "Days" broke
  // onto a second line the one time the box was narrower than it.
  //
  // But the flame is CENTRED in this box, so every spare point of width also
  // pushes the fire away from the number. The two are therefore tuned
  // together: the plaque was brought down to 12pt over 5pt of padding, which
  // needs 36.4, so the box comes down to 38 — and the flame now sits 1pt
  // inside each edge, which with a 1pt row gap sets the fire 2pt off the
  // digits. Shrinking the plaque is what buys that; widening the box would
  // undo it.
  statMark: { width: 38, height: STAT_H, alignItems: 'center' },
  statFlame: { width: 36, height: 36, resizeMode: 'contain' },
  statFlameAsh: { tintColor: '#D6CDBB', opacity: 0.9 },
  // A record the live run has caught is not ash — it is lit, at half voice.
  statFlameMatched: { opacity: 0.7 },
  // The pool of light under the living fire — the same one the DONE token
  // carries, which is what ties the number at the top to the days below it.
  statGlow: {
    position: 'absolute',
    top: 3,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,244,209,0.85)',
  },
  // Hung off the bottom of the mark's box and tilted, so it rides up over the
  // flame's foot. `bottom: 0` against a fixed box height is what guarantees
  // the overlap at any font scale.
  statUnit: {
    position: 'absolute',
    bottom: 0,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6.5,
    borderWidth: 1,
    transform: [{ rotate: '-7deg' }],
  },
  statUnitLit: {
    backgroundColor: '#FFF8E6',
    borderColor: 'rgba(197,160,89,0.5)',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 3,
    elevation: 2,
  },
  statUnitAsh: {
    backgroundColor: '#F6F4EF',
    borderColor: '#E2DED4',
  },
  // The app's own serif, set as a word rather than a tracked all-caps label:
  // this plaque is a caption on a picture, and the sheet reads in Garamond
  // everywhere else it says something to a person.
  statUnitText: {
    fontFamily: F.serifSemiBold,
    fontSize: 12,
    lineHeight: 14.5,
    letterSpacing: 0.2,
  },
  statUnitTextLit: { color: C.goldDark },
  statUnitTextAsh: { color: '#8F897E' },

  pairLabel: {
    marginTop: 7,
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.7,
    color: C.textMuted,
  },
  pairLabelGold: { color: C.goldDark },
  pairSplit: { alignItems: 'center', gap: 4, paddingHorizontal: 4, marginTop: 16 },
  pairSplitLine: { width: 1, height: 17, borderRadius: 1, backgroundColor: 'rgba(197,160,89,0.32)' },
  pairSplitDiamond: {
    width: 5, height: 5, borderRadius: 0.5,
    backgroundColor: 'rgba(197,160,89,0.5)',
    transform: [{ rotate: '45deg' }],
  },
  // It is the pair's footnote, so it stays tight to the RULE below it — but
  // it needed real air above, or it crowded the two figures it is annotating.
  //
  // "Task started" rather than "Tracking since": the sheet is about one task,
  // and a reader wants the day it began, not a word about the bookkeeping.
  since: {
    marginTop: 20,
    fontFamily: F.serifItalic,
    fontSize: 15,
    color: C.textSecondary,
  },
  // The date is the fact in the line, so it stands out of the italic — same
  // size, upright, and a shade darker.
  sinceDate: {
    fontFamily: F.serifMedium,
    color: C.text,
  },

  /* Section rule */
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 22,
  },
  ruleTight: { marginTop: 10 },
  ruleLine: { flex: 1, height: 1, backgroundColor: 'rgba(197,160,89,0.16)' },
  ruleDiamond: {
    width: 4, height: 4, borderRadius: 0.5,
    backgroundColor: 'rgba(197,160,89,0.38)',
    transform: [{ rotate: '45deg' }],
  },

  /* Consistency */
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionLabel: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    color: C.textMuted,
    textTransform: 'uppercase',
  },
  // The skip count rides UP beside the heading. It sat under the last bar,
  // where a lone grey line reads as a fourth, broken bar.
  skipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 11,
    backgroundColor: '#F5F4F1',
    borderWidth: 1,
    borderColor: '#E7E3DA',
  },
  dials: { marginTop: 18, flexDirection: 'row', alignItems: 'flex-start' },
  dialCell: { flex: 1, alignItems: 'center' },
  dialStage: { width: DIAL, height: DIAL, alignItems: 'center', justifyContent: 'center' },
  // Crossing 80 lights the ring, the same way a kept day lights its coin.
  dialLit: {
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 2,
  },
  dialFace: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  dialPct: {
    fontFamily: F.serifSemiBold,
    fontSize: 23,
    lineHeight: 27,
    letterSpacing: -0.6,
    color: INK,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  dialPctStrong: { color: C.goldDark },
  dialPctIdle: { color: '#C8C5BD' },
  // The sign rides small beside the figure — a 23pt % competes with the
  // number it belongs to.
  dialPctSign: { fontFamily: F.serifSemiBold, fontSize: 13, color: C.textMuted },
  dialLabel: {
    marginTop: 10,
    fontFamily: F.serifMedium,
    fontSize: 15,
    color: C.text,
    textAlign: 'center',
  },
  // Bigger and darker than a caption: "6 of 30" is what the ring above it
  // actually means, and at 11pt in #B6B1A6 it was reading as fine print.
  //
  // Set in the app's serif rather than Inter, so the three lines of this cell
  // — figure, period, count — are all one voice. `lining-nums` matters here:
  // Garamond's default old-style figures drop the 3, 4 and 9 below the
  // baseline, which in "6 of 30" reads as a typesetting fault rather than as
  // a style.
  dialCount: {
    marginTop: 3,
    fontFamily: F.serif,
    fontSize: 13.5,
    color: C.textSecondary,
    textAlign: 'center',
    fontVariant: ['lining-nums'],
  },
  skipText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.3,
    color: '#8F897E',
    textTransform: 'uppercase',
  },

  /* Month navigation */
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthBtnOff: { opacity: 0.38 },
  monthTitle: { fontFamily: F.serifMedium, fontSize: 21, color: C.text },

  /* Week header */
  weekHeader: { marginTop: 16, width: '100%', flexDirection: 'row' },
  weekLetter: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    fontFamily: F.sansBold,
    fontSize: 10.5,
    lineHeight: 15,
    letterSpacing: 0.7,
    color: C.textMuted,
  },
  weekLetterToday: { color: C.goldDark },

  /* Grid */
  grid: { marginTop: 8 },
  weekRow: { flexDirection: 'row', width: '100%' },
  cell: { flex: 1, minWidth: 0, position: 'relative', alignItems: 'center', paddingVertical: CELL_PAD },
  cellInner: { alignItems: 'center' },
  markWrap: { height: MARK_BOX, width: MARK_BOX, alignItems: 'center', justifyContent: 'center' },

  // The band fusing consecutive completed days. Two half segments per cell so
  // neighbours meet seamlessly at the border; its top is the cell's own
  // padding plus the inset that centres it on a 30pt coin.
  // Both numbers come from the token — see the derivation block above.
  band: {
    position: 'absolute',
    top: BAND_TOP,
    height: BAND_H,
    backgroundColor: 'rgba(247,226,171,0.5)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
  },
  bandLeft: { left: 0, right: '50%' },
  bandRight: { left: '50%', right: 0 },
  bandSoft: {
    backgroundColor: 'rgba(247,226,171,0.26)',
    borderColor: 'rgba(197,160,89,0.14)',
  },
  // The carry across a skipped day. Grey, because the skip did not earn the
  // fire — it only failed to put it out. Listed last in every style array so
  // it wins over the pale gold if a seam is somehow both.
  bandGrey: {
    backgroundColor: 'rgba(214,209,197,0.45)',
    borderColor: 'rgba(150,144,127,0.20)',
  },

  /* Day marks */
  cellDay: {
    marginTop: 2,
    fontFamily: F.sansMedium,
    fontSize: 10.5,
    lineHeight: 13,
    color: C.textMuted,
    fontVariant: ['tabular-nums'],
  },
  cellDayDone: { color: C.goldDark },
  cellDayToday: { fontFamily: F.sansBold, color: C.goldDark },

  /* Legend */
  legendRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: F.sans, fontSize: 12, color: C.textSecondary },
  legendDiamond: {
    width: 3.5, height: 3.5, borderRadius: 0.5,
    backgroundColor: 'rgba(197,160,89,0.4)',
    transform: [{ rotate: '45deg' }],
  },
});
