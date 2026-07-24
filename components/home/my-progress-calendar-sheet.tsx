import { useMemo, useState, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { ChevronLeft, ChevronRight, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import type {
  HomeProgressCalendarModel,
  HomeProgressDayState,
  HomeProgressMode,
} from '@/components/home/progress-calendar-model';
import { C, F } from '@/constants/tokens';

// This sheet is the Focus trophy hall in the Home progress key: the same
// laurel-crowned hero, the same counter grammar, the same golden chain
// fusing a run — held to identical sizes and spacing. Only two things
// change, because Home's currency is the flame and its emblem is growth:
// the two laurel sprigs part into one dark-gold and one dark-green, and
// the counters carry a flame where Focus carries a trophy. Every day mark
// is the caller's own flame token (won / rising / missed-red / skipped),
// so the calendar already speaks Home's language.

const FLAME_PNG = require('@/assets/images/streak-flame-512.png');

// The parted wreath — a beautiful dark gold on one side, a beautiful dark
// green on the other.
const LAUREL_GOLD = '#A67F2C';
const LAUREL_GREEN = '#3F6B48';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

type RenderDayArgs = {
  pct: number | null;
  mode: HomeProgressMode;
  isToday: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  model: HomeProgressCalendarModel;
  renderDay: (args: RenderDayArgs) => ReactNode;
};

type CalendarCell = {
  day: number;
  key: string;
  blank: boolean;
  future: boolean;
  isToday: boolean;
  pct: number | null;
  mode: HomeProgressMode;
  // Streak wiring, read straight from the model's own day state so the
  // golden chain matches the backend's run exactly.
  state: HomeProgressDayState;
  linkLeft: boolean;
  linkRight: boolean;
  softLeft: boolean;
  softRight: boolean;
  bridge: boolean;
};

const enter = (delay: number) => FadeInDown.duration(260).delay(delay);

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthIndex(date: Date) {
  return date.getFullYear() * 12 + date.getMonth();
}

// Leaf pairs set along the stem; the inner leaf of each pair reads a
// touch lighter, like a struck medal's wreath — mirrored by a pure flip.
const LEAVES: { x: number; y: number; angle: number; inner?: boolean }[] = [
  { x: 21, y: 54, angle: -30 },
  { x: 25, y: 47, angle: -5, inner: true },
  { x: 14, y: 43, angle: -48 },
  { x: 20, y: 35, angle: -18, inner: true },
  { x: 11, y: 31, angle: -66 },
  { x: 17, y: 23, angle: -38, inner: true },
  { x: 11, y: 18, angle: -82 },
];

function ProgressLeafSprig({ flip = false, color }: { flip?: boolean; color: string }) {
  return (
    <Svg
      width={37}
      height={72}
      viewBox="0 0 32 62"
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Path
        d="M 27 59 C 14 50, 10 39, 12 28 C 13.5 19, 17 11, 19 5"
        fill="none"
        stroke={color}
        strokeOpacity={0.8}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {LEAVES.map((leaf, index) => (
        <Ellipse
          key={`${leaf.x}-${leaf.y}`}
          cx={leaf.x}
          cy={leaf.y}
          rx={4.9}
          ry={2.05}
          fill={color}
          fillOpacity={leaf.inner ? 0.4 : 0.62}
          transform={`rotate(${leaf.angle} ${leaf.x} ${leaf.y})`}
        />
      ))}
    </Svg>
  );
}

// The currency emblem — Home earns flames, not trophies.
function FlameMark({ size = 20 }: { size?: number }) {
  return <Image source={FLAME_PNG} style={{ width: size, height: size }} resizeMode="contain" />;
}

const LEGEND: { label: string; pct: number | null; mode: HomeProgressMode }[] = [
  { label: 'Complete', pct: 100, mode: 'normal' },
  { label: 'Partial', pct: 56, mode: 'normal' },
  { label: 'Missed', pct: 0, mode: 'normal' },
  { label: 'Skipped', pct: null, mode: 'all-skipped' },
  { label: 'No tasks', pct: null, mode: 'no-tasks' },
];

export default function MyProgressCalendarSheet({ visible, onClose, model, renderDay }: Props) {
  const [monthOffset, setMonthOffset] = useState(0);
  const today = new Date();
  const todayKey = localDateKey(today);
  const currentMonth = monthIndex(today);

  const firstMonth = useMemo(() => {
    const dates = Object.keys(model.days).sort();
    if (dates.length === 0) return currentMonth;
    const [year, month] = dates[0].split('-').map(Number);
    return year * 12 + month - 1;
  }, [currentMonth, model.days]);

  const shownKey = Math.min(currentMonth, Math.max(firstMonth, currentMonth + monthOffset));
  const shownYear = Math.floor(shownKey / 12);
  const shownMonth = shownKey % 12;
  const canGoBack = shownKey > firstMonth;
  const canGoForward = shownKey < currentMonth;
  const onCurrentMonth = shownKey === currentMonth;
  const todayColumn = (today.getDay() + 6) % 7;

  const cells = useMemo<CalendarCell[]>(() => {
    const first = new Date(shownYear, shownMonth, 1, 12);
    const leading = (first.getDay() + 6) % 7;
    const totalDays = new Date(shownYear, shownMonth + 1, 0, 12).getDate();
    const result: CalendarCell[] = [];

    for (let index = 0; index < leading; index += 1) {
      result.push({
        day: 0,
        key: `blank-${index}`,
        blank: true,
        future: false,
        isToday: false,
        pct: null,
        mode: 'no-tasks',
        state: 'rest',
        linkLeft: false,
        linkRight: false,
        softLeft: false,
        softRight: false,
        bridge: false,
      });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const key = localDateKey(new Date(shownYear, shownMonth, day, 12));
      const record = model.days[key];
      result.push({
        day,
        key,
        blank: false,
        future: key > todayKey,
        isToday: key === todayKey,
        pct: record?.progressPct ?? null,
        mode: record?.mode ?? 'no-tasks',
        state: record?.state ?? 'rest',
        linkLeft: false,
        linkRight: false,
        softLeft: false,
        softRight: false,
        bridge: false,
      });
    }

    // The golden chain, exactly as Focus draws it: perfect days are links;
    // a rest day flanked by perfect days on both sides is bridged (paler);
    // and the run reaches into today when yesterday was perfect.
    const isRest = (c?: CalendarCell) => !!c && !c.blank && c.state === 'rest';
    const isPerfect = (c?: CalendarCell) => !!c && !c.blank && c.state === 'perfect';
    for (let i = 0; i < result.length; i += 1) {
      if (!isRest(result[i])) continue;
      let prev = i - 1;
      while (prev >= 0 && isRest(result[prev])) prev -= 1;
      let next = i + 1;
      while (next < result.length && isRest(result[next])) next += 1;
      if (isPerfect(result[prev]) && isPerfect(result[next])) result[i].bridge = true;
    }
    const inRun = (c?: CalendarCell) => !!c && !c.blank && (c.state === 'perfect' || c.bridge);
    for (let i = 0; i < result.length; i += 1) {
      if (!inRun(result[i])) continue;
      result[i].linkLeft = i % 7 !== 0 && inRun(result[i - 1]);
      result[i].linkRight = i % 7 !== 6 && inRun(result[i + 1]);
      if (result[i].linkLeft) result[i].softLeft = result[i].bridge || result[i - 1].bridge;
      if (result[i].linkRight) result[i].softRight = result[i].bridge || result[i + 1].bridge;
    }
    const todayIndex = result.findIndex(entry => entry.isToday);
    if (todayIndex > 0 && todayIndex % 7 !== 0 && isPerfect(result[todayIndex - 1])) {
      result[todayIndex].linkLeft = true;
      result[todayIndex].softLeft = true;
      result[todayIndex - 1].linkRight = true;
      result[todayIndex - 1].softRight = true;
    }
    return result;
  }, [model.days, shownMonth, shownYear, todayKey]);

  const close = () => {
    setMonthOffset(0);
    onClose();
  };

  return (
    <SmoothBottomSheet visible={visible} onClose={close} sheetStyle={s.sheet}>
      <View style={s.handle} />
      <View style={s.header}>
        <View style={s.headerCopy}>
          <Text style={s.kicker}>MY PROGRESS</Text>
          <Text style={s.title}>Your Daily Rhythm</Text>
        </View>
        <TouchableOpacity
          style={s.closeButton}
          onPress={close}
          activeOpacity={0.76}
          hitSlop={10}
          accessibilityLabel="Close progress calendar"
        >
          <X s={17} c="#66805A" w={2.2} />
        </TouchableOpacity>
      </View>

      <Reanimated.View entering={enter(25)} style={s.hero}>
        <LinearGradient
          colors={['#F7F1DB', '#FBF8ED', '#F2F5EA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.rhythmRow}>
          <ProgressLeafSprig color={LAUREL_GOLD} />
          <View style={s.rhythmCenter}>
            <Text style={s.rhythmValue}>{model.current}</Text>
            <Text style={s.rhythmUnit}>day rhythm</Text>
          </View>
          <ProgressLeafSprig flip color={LAUREL_GREEN} />
        </View>
        <View style={s.statRow}>
          <View style={s.statCell}>
            <View style={[s.statValueRow, s.statValueRowCenter]}>
              <Text style={s.statValue}>{model.best}</Text>
              <FlameMark size={19} />
            </View>
            <Text style={s.statLabel}>BEST RUN</Text>
          </View>
          <View style={s.statSplit}>
            <View style={s.statSplitLine} />
            <View style={s.statSplitDiamond} />
            <View style={s.statSplitLine} />
          </View>
          <View style={s.statCell}>
            <View style={[s.statValueRow, s.statValueRowCenter]}>
              <Text style={s.statValue}>{model.perfectDays}</Text>
              <FlameMark size={19} />
            </View>
            <Text style={s.statLabel}>PERFECT DAYS</Text>
          </View>
        </View>
      </Reanimated.View>

      <Reanimated.View entering={enter(55)} style={s.monthRow}>
        <TouchableOpacity
          style={[s.monthButton, !canGoBack && s.monthButtonDisabled]}
          disabled={!canGoBack}
          onPress={() => setMonthOffset(value => value - 1)}
          activeOpacity={0.72}
          accessibilityLabel="Previous month"
        >
          <ChevronLeft s={18} c="#66805A" />
        </TouchableOpacity>
        <Text style={s.monthTitle}>{MONTH_NAMES[shownMonth]} {shownYear}</Text>
        <TouchableOpacity
          style={[s.monthButton, !canGoForward && s.monthButtonDisabled]}
          disabled={!canGoForward}
          onPress={() => setMonthOffset(value => value + 1)}
          activeOpacity={0.72}
          accessibilityLabel="Next month"
        >
          <ChevronRight s={18} c="#66805A" />
        </TouchableOpacity>
      </Reanimated.View>

      <View style={s.weekHeader}>
        {DAY_LETTERS.map((letter, index) => (
          <Text
            key={`${letter}-${index}`}
            style={[s.weekLetter, onCurrentMonth && index === todayColumn && s.weekLetterToday]}
          >
            {letter}
          </Text>
        ))}
      </View>

      <View style={s.grid} key={shownKey}>
        {cells.map((cell, index) => {
          if (cell.blank) return <View key={cell.key} style={s.cell} />;
          const row = Math.floor(index / 7);
          const col = index % 7;
          const delay = 75 + (row + col) * 18;
          return (
            <View key={cell.key} style={s.cell}>
              {cell.linkLeft && (
                <Reanimated.View
                  entering={FadeIn.duration(200).delay(delay)}
                  style={[s.band, s.bandLeft, cell.softLeft && s.bandSoft]}
                />
              )}
              {cell.linkRight && (
                <Reanimated.View
                  entering={FadeIn.duration(200).delay(delay)}
                  style={[s.band, s.bandRight, cell.softRight && s.bandSoft]}
                />
              )}
              <Reanimated.View entering={FadeInDown.duration(210).delay(delay)} style={s.cellInner}>
                <View style={s.mark}>
                  {cell.future
                    ? <View style={s.futureDot} />
                    : renderDay({ pct: cell.pct, mode: cell.mode, isToday: cell.isToday })}
                </View>
                <Text style={[s.dayNumber, cell.isToday && s.dayNumberToday]}>{cell.day}</Text>
              </Reanimated.View>
            </View>
          );
        })}
      </View>

      <Reanimated.View entering={enter(105)} style={s.legend}>
        {LEGEND.map(item => (
          <View key={item.label} style={s.legendItem}>
            {renderDay({ pct: item.pct, mode: item.mode, isToday: false })}
            <Text style={s.legendText} numberOfLines={1}>{item.label}</Text>
          </View>
        ))}
      </Reanimated.View>

      <Reanimated.View entering={enter(135)} style={s.footer}>
        <View style={s.footerLeaf} />
        <Text style={s.footerText}>Every flame preserves the full story of that day.</Text>
        <View style={[s.footerLeaf, s.footerLeafGold]} />
      </Reanimated.View>
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: '#FBF9F3',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: '#D9DDCF',
  },
  header: {
    minHeight: 61,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: { flex: 1 },
  kicker: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 2.1,
    color: '#6E885E',
  },
  title: {
    marginTop: 3,
    fontFamily: F.serifMedium,
    fontSize: 25,
    lineHeight: 29,
    color: C.text,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#DDE3D6',
    backgroundColor: '#F1F4EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The crest, open on the page — sized to the Focus hall: a 66pt number
  // hugged by the wreath, the unit tucked beneath, the counters close.
  hero: {
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E5DFC8',
    overflow: 'hidden',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  rhythmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rhythmCenter: { minWidth: 118, alignItems: 'center' },
  rhythmValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 66,
    lineHeight: 78,
    letterSpacing: -2,
    color: '#3F4E35',
    textAlign: 'center',
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  rhythmUnit: {
    marginTop: -14,
    fontFamily: F.serifItalic,
    fontSize: 16,
    lineHeight: 21,
    color: '#7B6A3E',
  },
  statRow: {
    marginTop: 10,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  statValueRowCenter: { alignItems: 'center', gap: 5 },
  statValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 31,
    lineHeight: 36,
    color: '#4E5F43',
    includeFontPadding: false,
    fontVariant: ['lining-nums', 'tabular-nums'],
  },
  statLabel: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 1.8,
    color: 'rgba(94,116,80,0.72)',
  },
  statSplit: { alignItems: 'center', gap: 4 },
  statSplitLine: { width: 1, height: 15, borderRadius: 1, backgroundColor: 'rgba(166,127,44,0.34)' },
  statSplitDiamond: {
    width: 5,
    height: 5,
    borderRadius: 0.5,
    backgroundColor: 'rgba(166,127,44,0.5)',
    transform: [{ rotate: '45deg' }],
  },
  monthRow: {
    height: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDE3D6',
    backgroundColor: '#F7F8F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonDisabled: { opacity: 0.28 },
  monthTitle: { fontFamily: F.serifMedium, fontSize: 18, color: '#35402F' },
  weekHeader: { height: 18, flexDirection: 'row', alignItems: 'center' },
  weekLetter: {
    flex: 1,
    textAlign: 'center',
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 0.7,
    color: C.textMuted,
  },
  weekLetterToday: { color: '#66805A' },
  grid: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    position: 'relative',
    alignItems: 'center',
    paddingVertical: 3,
  },
  cellInner: { alignItems: 'center' },
  mark: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  // The golden chain fusing a run — two half segments meeting at the cell
  // border, seated on the coins' vertical centre. Same grammar as Focus.
  band: {
    position: 'absolute',
    top: 3 + 4,
    height: 30,
    backgroundColor: 'rgba(247,226,171,0.55)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(197,160,89,0.28)',
  },
  bandLeft: { left: 0, right: '50%' },
  bandRight: { left: '50%', right: 0 },
  bandSoft: {
    backgroundColor: 'rgba(247,226,171,0.28)',
    borderColor: 'rgba(197,160,89,0.16)',
  },
  futureDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#E2E5DC' },
  dayNumber: {
    marginTop: 1,
    fontFamily: F.sansMedium,
    fontSize: 9.5,
    lineHeight: 12,
    color: C.textMuted,
    fontVariant: ['tabular-nums'],
  },
  dayNumberToday: { fontFamily: F.sansBold, color: '#66805A' },
  legend: {
    minHeight: 57,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#EEEADF',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  legendItem: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 },
  legendText: {
    fontFamily: F.sansMedium,
    fontSize: 9,
    lineHeight: 11,
    color: C.textSecondary,
    textAlign: 'center',
  },
  footer: {
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerLeaf: {
    width: 9,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#789064',
    transform: [{ rotate: '-25deg' }],
  },
  footerLeafGold: { backgroundColor: '#C5A059', transform: [{ rotate: '25deg' }] },
  footerText: { fontFamily: F.serifItalic, fontSize: 11.5, color: '#7A7366' },
});
