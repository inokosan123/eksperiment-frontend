import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Minus, Plus } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import LimitSlider from './LimitSlider';
import { CATEGORY_TINTS } from './focusContent';
import { formatMinutesShort } from './dayPlanStore';

const TARGET_STOPS: (number | null)[] = [
  ...Array.from({ length: 45 }, (_, index) => 60 + index * 15),
  null,
];
const YEAR_DAYS = 365;
const SLEEP_DAYS = Math.round((8 / 24) * YEAR_DAYS);

export type TargetValues = {
  target: number | null;
  tolerable: number | null;
  essentialOnly: number | null;
};

function ThresholdStepper({
  label,
  value,
  tone,
  onChange,
}: {
  label: string;
  value: number;
  tone: 'soft' | 'hard';
  onChange: (value: number) => void;
}) {
  const color = tone === 'hard' ? '#A24351' : '#A36F2B';
  return (
    <View style={s.thresholdControl}>
      <Text style={s.thresholdLabel}>{label}</Text>
      <View style={s.thresholdStepper}>
        <TouchableOpacity style={s.stepButton} onPress={() => onChange(value - 15)} haptic="selection">
          <Minus s={13} c={C.textSecondary} w={2.3} />
        </TouchableOpacity>
        <Text style={[s.thresholdValue, { color }]}>{formatMinutesShort(value)}</Text>
        <TouchableOpacity style={s.stepButton} onPress={() => onChange(value + 15)} haptic="selection">
          <Plus s={13} c={C.textSecondary} w={2.3} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function YearPerspective({ target }: { target: number | null }) {
  const phoneDays = target == null ? 0 : Math.round((target / 1440) * YEAR_DAYS);
  const awayDays = Math.max(0, YEAR_DAYS - SLEEP_DAYS - phoneDays);
  const dots = useMemo(() => Array.from({ length: YEAR_DAYS }, (_, index) => {
    if (index < SLEEP_DAYS) return 'sleep';
    if (index < SLEEP_DAYS + phoneDays) return 'phone';
    return 'away';
  }), [phoneDays]);

  return (
    <View style={s.yearWrap}>
      <View style={s.yearCopyRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.yearLabel}>ONE YEAR IN VIEW</Text>
          <Text style={s.yearTitle}>
            {target == null ? 'Choose a target to see its weight.' : `${phoneDays} full days a year on your phone`}
          </Text>
        </View>
        <Text style={s.yearNumber}>{target == null ? '∞' : phoneDays}</Text>
      </View>
      <View style={s.dotField}>
        {dots.map((kind, index) => (
          <View key={index} style={s.dotCell}>
            <View style={[s.yearDot, kind === 'sleep' ? s.dotSleep : kind === 'phone' ? s.dotPhone : s.dotAway]} />
          </View>
        ))}
      </View>
      <View style={s.legendRow}>
        <View style={s.legendItem}><View style={[s.legendDot, s.dotSleep]} /><Text style={s.legendText}>Sleep {SLEEP_DAYS}</Text></View>
        <View style={s.legendItem}><View style={[s.legendDot, s.dotPhone]} /><Text style={s.legendText}>Phone {phoneDays}</Text></View>
        <View style={s.legendItem}><View style={[s.legendDot, s.dotAway]} /><Text style={s.legendText}>Away {awayDays}</Text></View>
      </View>
    </View>
  );
}

export function PlanningRail({
  values,
  plannedByGroup,
}: {
  values: TargetValues;
  plannedByGroup: Record<string, number>;
}) {
  const groups = Object.entries(plannedByGroup).filter(([, minutes]) => minutes > 0);
  const planned = groups.reduce((sum, [, minutes]) => sum + minutes, 0);
  const scale = values.essentialOnly ?? values.target ?? Math.max(60, planned);
  const capacity = values.target == null ? null : Math.round(values.target * 0.8);
  const warning = values.target != null && planned > values.target * 0.9;
  let consumed = 0;

  return (
    <View style={s.planningWrap}>
      <View style={s.planningHeader}>
        <View>
          <Text style={s.planningLabel}>PLANNING CAPACITY</Text>
          <Text style={s.planningValue}>{capacity == null ? 'No target' : formatMinutesShort(capacity)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.planningLabel}>FINITE GROUP PLAN</Text>
          <Text style={s.planningValue}>{formatMinutesShort(planned)}</Text>
        </View>
      </View>

      <View style={s.railLabels}>
        {values.target != null && <Text style={[s.railMarkerLabel, { left: `${(values.target * 0.8 / scale) * 100}%` }]}>80%</Text>}
        {values.target != null && <Text style={[s.railMarkerLabel, s.goalMarkerLabel, { left: `${(values.target / scale) * 100}%` }]}>GOAL</Text>}
      </View>
      <View style={s.rail}>
        {groups.map(([groupId, minutes]) => {
          const left = (consumed / scale) * 100;
          consumed += minutes;
          const width = (minutes / scale) * 100;
          const tint = CATEGORY_TINTS[groupId] ?? { bg: C.goldLight, color: C.goldDark };
          return (
            <View
              key={groupId}
              style={[
                s.railSegment,
                { left: `${Math.min(100, left)}%`, width: `${Math.min(100 - Math.min(100, left), width)}%`, backgroundColor: tint.color },
              ]}
            />
          );
        })}
        {values.target != null && <View style={[s.railMarker, s.capacityMarker, { left: `${(values.target * 0.8 / scale) * 100}%` }]} />}
        {values.target != null && <View style={[s.railMarker, s.goalMarker, { left: `${(values.target / scale) * 100}%` }]} />}
        {values.tolerable != null && <View style={[s.railMarker, s.tolerableMarker, { left: `${Math.min(100, (values.tolerable / scale) * 100)}%` }]} />}
        {values.essentialOnly != null && <View style={[s.railMarker, s.hardMarker, { left: '100%' }]} />}
      </View>
      <View style={s.railBottomLabels}>
        <Text style={s.railBottomText}>0</Text>
        <Text style={s.railBottomText}>{values.essentialOnly == null ? 'No hard wall' : `Essentials + system ${formatMinutesShort(values.essentialOnly)}`}</Text>
      </View>

      {warning && (
        <View style={[s.warning, planned >= (values.target ?? Infinity) && s.warningStrong]}>
          <AlertTriangle s={14} c={planned >= (values.target ?? Infinity) ? '#A24351' : '#A36F2B'} w={2.2} />
          <Text style={[s.warningText, planned >= (values.target ?? Infinity) && s.warningTextStrong]}>
            {planned >= (values.target ?? Infinity)
              ? 'The finite group plan reaches or passes the Daily Target. Saving is allowed, but no reserve remains.'
              : 'This plan leaves very little room for messages, maps, and ordinary unplanned use.'}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function DailyTargetEditor({
  values,
  plannedByGroup,
  onChange,
}: {
  values: TargetValues;
  plannedByGroup: Record<string, number>;
  onChange: (values: TargetValues) => void;
}) {
  const setTarget = (target: number | null) => {
    if (target == null) {
      onChange({ target: null, tolerable: null, essentialOnly: null });
      return;
    }
    const tolerable = Math.max(target, values.tolerable ?? target + 60);
    const essentialOnly = Math.max(tolerable, values.essentialOnly ?? target + 120);
    onChange({ target, tolerable, essentialOnly });
  };

  return (
    <View style={s.surface}>
      <View style={s.targetHeader}>
        <View>
          <Text style={s.kicker}>DAILY TARGET</Text>
          <Text style={s.targetTitle}>How much phone belongs in this day?</Text>
        </View>
        <Text style={s.targetNumber}>{values.target == null ? 'No limit' : formatMinutesShort(values.target)}</Text>
      </View>
      <LimitSlider
        value={values.target}
        onChange={setTarget}
        stops={TARGET_STOPS}
        edgeLabels={{ left: '1h', right: 'No limit' }}
      />

      {values.target != null && values.tolerable != null && values.essentialOnly != null && (
        <View style={s.thresholdRow}>
          <ThresholdStepper
            label="TOLERABLE"
            value={values.tolerable}
            tone="soft"
            onChange={next => {
              const tolerable = Math.max(values.target!, Math.min(next, values.essentialOnly!));
              onChange({ ...values, tolerable });
            }}
          />
          <ThresholdStepper
            label="ESSENTIALS ONLY"
            value={values.essentialOnly}
            tone="hard"
            onChange={next => onChange({ ...values, essentialOnly: Math.max(values.tolerable!, next) })}
          />
        </View>
      )}

      <YearPerspective target={values.target} />
      <PlanningRail values={values} plannedByGroup={plannedByGroup} />
    </View>
  );
}

const s = StyleSheet.create({
  surface: { borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E6DCC6', backgroundColor: '#FFFDF8', padding: 15, gap: 14 },
  targetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  kicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, color: C.gold },
  targetTitle: { marginTop: 3, maxWidth: 210, fontFamily: F.serifMedium, fontSize: 18, lineHeight: 22, color: C.text },
  targetNumber: { flex: 1, textAlign: 'right', fontFamily: F.serifMedium, fontSize: 25, color: C.goldDark, fontVariant: ['tabular-nums'] },
  thresholdRow: { flexDirection: 'row', gap: 9 },
  thresholdControl: { flex: 1, gap: 5 },
  thresholdLabel: { textAlign: 'center', fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.4, color: C.textMuted },
  thresholdStepper: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 13, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, overflow: 'hidden' },
  stepButton: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' },
  thresholdValue: { fontFamily: F.sansSemiBold, fontSize: 12, fontVariant: ['tabular-nums'] },
  yearWrap: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EEE7D8', paddingVertical: 13 },
  yearCopyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  yearLabel: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.6, color: C.textMuted },
  yearTitle: { marginTop: 2, fontFamily: F.serifMedium, fontSize: 15.5, color: C.text },
  yearNumber: { fontFamily: F.serifMedium, fontSize: 28, color: C.goldDark, fontVariant: ['tabular-nums'] },
  dotField: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap' },
  dotCell: { width: `${100 / 52}%`, height: 5.2, alignItems: 'center', justifyContent: 'center' },
  yearDot: { width: 3.4, height: 3.4, borderRadius: 2 },
  dotSleep: { backgroundColor: '#A9B4C2' },
  dotPhone: { backgroundColor: '#C9A14B' },
  dotAway: { backgroundColor: '#DDE7DF' },
  legendRow: { marginTop: 8, flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontFamily: F.sansMedium, fontSize: 9, color: C.textMuted },
  planningWrap: { gap: 8 },
  planningHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planningLabel: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.4, color: C.textMuted },
  planningValue: { marginTop: 2, fontFamily: F.serifMedium, fontSize: 17, color: C.text, fontVariant: ['tabular-nums'] },
  railLabels: { height: 14, position: 'relative' },
  railMarkerLabel: { position: 'absolute', transform: [{ translateX: -10 }], fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 0.8, color: C.goldDark },
  goalMarkerLabel: { color: C.text },
  rail: { position: 'relative', height: 12, borderRadius: 6, backgroundColor: '#ECE9E1', overflow: 'visible' },
  railSegment: { position: 'absolute', top: 0, bottom: 0 },
  railMarker: { position: 'absolute', top: -4, width: 1.5, height: 20 },
  capacityMarker: { backgroundColor: C.goldDark },
  goalMarker: { width: 2, backgroundColor: '#2D2923' },
  tolerableMarker: { backgroundColor: '#A36F2B' },
  hardMarker: { width: 3, transform: [{ translateX: -2 }], backgroundColor: '#7C2735' },
  railBottomLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  railBottomText: { fontFamily: F.sansMedium, fontSize: 8.5, color: C.textMuted },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderRadius: 12, backgroundColor: '#FFF4DC', paddingHorizontal: 11, paddingVertical: 9 },
  warningStrong: { backgroundColor: '#F9E8EB' },
  warningText: { flex: 1, fontFamily: F.sansMedium, fontSize: 10, lineHeight: 14, color: '#8D5C1E' },
  warningTextStrong: { color: '#8F3443' },
});
