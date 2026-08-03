import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  BarChart3,
  CheckSmall,
  Clock,
  Shield,
  Target,
} from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import type { FocusAnalyticsPeriod } from './focusAnalyticsDates';
import type { FocusLocalPeriodSummary } from './focusAnalyticsModel';

type Props =
  | {
      kind: 'preview';
      period: FocusAnalyticsPeriod;
      localSummary: FocusLocalPeriodSummary | null;
    }
  | {
      kind: 'preparing' | 'slow';
      period: FocusAnalyticsPeriod;
      onRetry?: () => void;
    }
  | {
      kind: 'permission';
      period: FocusAnalyticsPeriod;
      denied: boolean;
      onRecover: () => void;
    }
  | {
      kind: 'unavailable';
      period: FocusAnalyticsPeriod;
      reason: string;
      onRetry: () => void;
    };

const PREVIEW_BARS: Record<FocusAnalyticsPeriod, number[]> = {
  day: [18, 10, 8, 5, 7, 14, 27, 42, 33, 48, 31, 24],
  week: [42, 67, 48, 81, 57, 36, 25],
  month: [31, 50, 43, 68, 36, 72, 55, 45, 79, 52, 33, 61, 40, 69],
  year: [38, 46, 54, 43, 61, 58, 49, 65, 52, 47, 41, 35],
};

export default function FocusAnalyticsFallback(props: Props) {
  if (props.kind === 'preparing' || props.kind === 'slow') {
    return (
      <View style={styles.stateWrap}>
        <SkeletonReport period={props.period} />
        {props.kind === 'slow' && (
          <View style={styles.slowCard}>
            <Text style={styles.slowTitle}>Taking longer than usual</Text>
            <Text style={styles.slowBody}>
              iPhone is still preparing this private report. Broad date ranges can take a little longer; you can keep waiting or retry this request.
            </Text>
            {!!props.onRetry && (
              <TouchableOpacity style={styles.retryButton} onPress={props.onRetry} haptic="light">
                <Text style={styles.retryText}>Retry report</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }

  if (props.kind === 'permission') {
    return (
      <CenteredState
        icon={<Shield s={24} c={C.goldDark} w={1.9} />}
        eyebrow="PRIVATE IPHONE ACTIVITY"
        title={props.denied ? 'Screen Time access is off' : 'See your Focus patterns'}
        body={props.denied
          ? 'Your existing plans stay on this iPhone, but activity analytics need Screen Time access.'
          : 'Allow Screen Time access so iPhone can prepare private activity reports. App and website activity stays inside Apple’s report.'}
        action={props.denied ? 'Open Settings' : 'Allow Screen Time access'}
        onAction={props.onRecover}
      />
    );
  }

  if (props.kind === 'unavailable') {
    return (
      <CenteredState
        icon={<BarChart3 s={24} c={C.goldDark} w={1.9} />}
        eyebrow="REPORT UNAVAILABLE"
        title="This period could not be prepared"
        body={props.reason}
        action="Try again"
        onAction={props.onRetry}
      />
    );
  }

  if (props.kind === 'preview') {
    return (
      <PreviewReport
        period={props.period}
        localSummary={props.localSummary}
      />
    );
  }

  return null;
}

function PreviewReport({
  period,
  localSummary,
}: {
  period: FocusAnalyticsPeriod;
  localSummary: FocusLocalPeriodSummary | null;
}) {
  const bars = PREVIEW_BARS[period];
  const isYear = period === 'year';
  const targetKept = localSummary?.keptTargetDays ?? 0;
  const targetResolved = localSummary?.resolvedTargetDays ?? 0;
  const returnedMoments = localSummary?.returnedMoments ?? 0;
  const extraAccess = (localSummary?.doorOpened ?? 0)
    + (localSummary?.checkinsContinued ?? 0);
  const protectionEvents = (localSummary?.limitExceeded ?? 0)
    + (localSummary?.zoneBreaches ?? 0);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.previewPage}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.previewFlag}>
        <View style={styles.previewDot} />
        <Text style={styles.previewFlagText}>PREVIEW DATA</Text>
      </View>

      <View style={styles.previewNotice}>
        <Text style={styles.previewNoticeText}>
          This build shows the complete report preview. A fresh iPhone development build replaces sample Screen Time values with Apple&apos;s private activity data.
        </Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroHeading}>
          <View style={styles.flexOne}>
            <Text style={styles.eyebrow}>{isYear ? 'TIME MADE VISIBLE' : 'MANAGED ACTIVITY'}</Text>
            <Text style={styles.heroValue}>{isYear ? '42 full days' : period === 'day' ? '1h 24m' : '1h 52m'}</Text>
            <Text style={styles.heroBody}>
              {isYear ? 'A private year-in-perspective preview.' : 'per complete observed day in this period'}
            </Text>
          </View>
          <View style={styles.heroSeal}><Target s={21} c={C.goldDark} w={1.9} /></View>
        </View>
        {!isYear && (
          <>
            <View style={styles.heroDivider} />
            <View style={styles.heroMetrics}>
              <PreviewMetric label="PERIOD TOTAL" value={period === 'day' ? '1h 24m' : '13h 04m'} compact />
              <PreviewMetric label="IPHONE DAILY AVG" value="4h 21m" compact />
            </View>
            <View style={styles.comparisonPill}>
              <Text style={styles.comparisonPillText}>18% less managed time than the previous period</Text>
            </View>
          </>
        )}
      </View>

      {isYear && (
        <View style={styles.beadCard}>
          <Text style={styles.sectionTitle}>365 days in view</Text>
          <Text style={styles.sectionBody}>Every mark holds one day of the year.</Text>
          <View style={styles.beadField}>
            {Array.from({ length: 106 }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.bead,
                  index < 14 && styles.beadRed,
                  index >= 14 && index < 28 && styles.beadGold,
                ]}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View style={styles.flexOne}>
            <Text style={styles.sectionTitle}>{chartTitle(period)}</Text>
            <Text style={styles.sectionBody}>Managed rhythm with total iPhone context</Text>
          </View>
          <BarChart3 s={19} c={C.goldDark} w={1.8} />
        </View>
        <View style={styles.chart}>
          {bars.map((height, index) => (
            <View key={index} style={styles.barLane}>
              <View style={[styles.barOther, { height: `${Math.min(94, height + 16)}%` }]}>
                <View style={[styles.barManaged, { height: `${Math.max(25, 68 - index % 3 * 8)}%` }]} />
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.previewExplanation}>
          Sample Screen Time values are used only in this preview. Your Focus outcomes below come from this app when available.
        </Text>
      </View>

      {isYear ? (
        <View style={styles.sectionBlock}>
          <PreviewSectionHeader title="Year in perspective" />
          <View style={styles.metricGrid}>
            <PreviewMetric label="DAILY AVERAGE" value="2h 46m" />
            <PreviewMetric label="LIGHTEST MONTH" value="March" />
            <PreviewMetric label="HEAVIEST MONTH" value="January" />
            <PreviewMetric label="TIME RECLAIMED" value="11 days" />
          </View>
        </View>
      ) : (
        <View style={styles.sectionBlock}>
          <PreviewSectionHeader title="Behavior signals" />
          <View style={styles.signalRow}>
            <PreviewSignal icon={<Clock s={16} c={C.goldDark} w={1.9} />} value="46" label="PICKUPS / DAY" />
            <PreviewSignal icon={<CheckSmall s={16} c="#3D7760" w={2.3} />} value="9:18" label="FIRST PICKUP" />
            <PreviewSignal icon={<Shield s={16} c="#A14A56" w={1.9} />} value="43%" label="MANAGED SHARE" />
          </View>
        </View>
      )}

      {!isYear && (
        <View style={styles.sectionBlock}>
          <PreviewSectionHeader title="Managed groups" />
          <View style={styles.listCard}>
            <PreviewGroupRow name="Social" value="46m" share="41% of managed time" tone="crimson" />
            <PreviewGroupRow name="Entertainment" value="31m" share="28% of managed time" tone="gold" />
            <PreviewGroupRow name="Other" value="17m" share="15% of managed time" tone="ink" last />
          </View>
        </View>
      )}

      <View style={styles.insight}>
        <View style={styles.insightIcon}><BarChart3 s={18} c={C.goldDark} w={1.9} /></View>
        <View style={styles.flexOne}>
          <Text style={styles.eyebrow}>ONE THING WORTH NOTICING</Text>
          <Text style={styles.insightTitle}>{isYear ? 'Your lightest months are becoming a pattern' : 'A lighter evening rhythm is taking shape'}</Text>
          <Text style={styles.sectionBody}>This insight appears only when the selected period has enough complete activity to support it.</Text>
        </View>
      </View>

      {!isYear && (
        <View style={styles.sectionBlock}>
          <PreviewSectionHeader title="Focus outcomes" />
          <View style={styles.listCard}>
            <PreviewDataRow label="Daily target kept" value={targetResolved > 0 ? `${targetKept} of ${targetResolved}` : 'No resolved days'} />
            <PreviewDataRow label="Returned moments" value={String(returnedMoments)} />
            <PreviewDataRow label="Extra access used" value={String(extraAccess)} />
            <PreviewDataRow label="Limit events" value={String(protectionEvents)} />
            <PreviewDataRow label="Quiet Hours started" value={String(localSummary?.quietHoursStarted ?? 0)} last />
          </View>
        </View>
      )}

      <Text style={styles.privacy}>
        Private Screen Time details stay inside Apple&apos;s activity report.
      </Text>
    </ScrollView>
  );
}

function PreviewSectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

function PreviewMetric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <View style={compact ? styles.heroMetric : styles.metricCard}>
      <Text style={styles.signalLabel}>{label}</Text>
      <Text style={compact ? styles.heroMetricValue : styles.metricValue}>{value}</Text>
    </View>
  );
}

function PreviewGroupRow({
  name,
  value,
  share,
  tone,
  last = false,
}: {
  name: string;
  value: string;
  share: string;
  tone: 'crimson' | 'gold' | 'ink';
  last?: boolean;
}) {
  const markStyle = tone === 'crimson'
    ? styles.groupMarkCrimson
    : tone === 'gold'
      ? styles.groupMarkGold
      : styles.groupMarkInk;
  return (
    <View style={[styles.groupRow, !last && styles.dataRowBorder]}>
      <View style={[styles.groupMark, markStyle]} />
      <View style={styles.flexOne}>
        <Text style={styles.groupName}>{name}</Text>
        <Text style={styles.groupShare}>{share}</Text>
      </View>
      <Text style={styles.groupValue}>{value}</Text>
    </View>
  );
}

function PreviewDataRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.dataRow, !last && styles.dataRowBorder]}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

function PreviewSignal({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.signal}>
      <View style={styles.signalIcon}>{icon}</View>
      <Text style={styles.signalValue}>{value}</Text>
      <Text style={styles.signalLabel}>{label}</Text>
    </View>
  );
}

function SkeletonReport({ period }: { period: FocusAnalyticsPeriod }) {
  return (
    <View style={styles.skeletonPage} pointerEvents="none">
      <View style={styles.skeletonHero}>
        <View style={[styles.skeletonLine, { width: '38%', height: 8 }]} />
        <View style={[styles.skeletonLine, { width: '58%', height: 35, marginTop: 13 }]} />
        <View style={[styles.skeletonLine, { width: '76%', height: 10, marginTop: 11 }]} />
        <View style={styles.skeletonMetricRow}>
          <View style={styles.skeletonMetric} />
          <View style={styles.skeletonMetric} />
        </View>
      </View>
      <View style={styles.skeletonChart}>
        <View style={[styles.skeletonLine, { width: '48%', height: 15 }]} />
        <View style={styles.skeletonBars}>
          {PREVIEW_BARS[period].slice(0, 10).map((height, index) => (
            <View key={index} style={[styles.skeletonBar, { height: Math.max(22, height) }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

function CenteredState({
  icon,
  eyebrow,
  title,
  body,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.centerPage}>
      <View style={styles.centerCard}>
        <View style={styles.centerIcon}>{icon}</View>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.centerTitle}>{title}</Text>
        <Text style={styles.centerBody}>{body}</Text>
        <TouchableOpacity style={styles.centerAction} onPress={onAction} haptic="medium">
          <Text style={styles.centerActionText}>{action}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function chartTitle(period: FocusAnalyticsPeriod) {
  if (period === 'day') return 'Hourly rhythm';
  if (period === 'week') return 'Your seven-day rhythm';
  if (period === 'month') return 'The month, day by day';
  return 'Twelve months in view';
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  previewPage: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 36,
    gap: 14,
  },
  flexOne: { flex: 1 },
  previewFlag: {
    alignSelf: 'flex-start',
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#F5ECD7',
    paddingHorizontal: 9,
  },
  previewDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.gold },
  previewFlagText: { fontFamily: F.sansBold, fontSize: 7, letterSpacing: 1, color: C.goldDark },
  previewNotice: {
    borderLeftWidth: 2,
    borderLeftColor: C.gold,
    paddingLeft: 10,
    paddingRight: 4,
  },
  previewNoticeText: {
    fontFamily: F.sansMedium,
    fontSize: 9.5,
    lineHeight: 14,
    color: C.textSecondary,
  },
  hero: {
    padding: 19,
    borderRadius: 25,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E8D9BA',
    backgroundColor: '#FFF9EB',
    shadowColor: '#46371D',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  heroHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.45, color: C.goldDark },
  heroValue: { marginTop: 7, fontFamily: F.serifSemiBold, fontSize: 38, color: C.text },
  heroBody: { marginTop: 4, maxWidth: 235, fontFamily: F.sansMedium, fontSize: 10.5, lineHeight: 15, color: C.textSecondary },
  heroSeal: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F5E8C8', alignItems: 'center', justifyContent: 'center' },
  heroDivider: { height: StyleSheet.hairlineWidth, marginTop: 17, backgroundColor: '#E4DAC8' },
  heroMetrics: { marginTop: 14, flexDirection: 'row', gap: 9 },
  heroMetric: { flex: 1, minHeight: 47, borderRadius: 13, backgroundColor: '#F8F0DD', paddingHorizontal: 11, paddingVertical: 9 },
  heroMetricValue: { marginTop: 3, fontFamily: F.serifSemiBold, fontSize: 15, color: C.text },
  comparisonPill: { alignSelf: 'flex-start', marginTop: 11, borderRadius: 999, backgroundColor: '#E8F1E9', paddingHorizontal: 10, paddingVertical: 7 },
  comparisonPillText: { fontFamily: F.sansBold, fontSize: 8, color: '#38664F' },
  chartCard: {
    padding: 17,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E9E4D8',
    backgroundColor: C.surface,
  },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: F.serifSemiBold, fontSize: 19, color: C.text },
  sectionBody: { marginTop: 2, fontFamily: F.sansMedium, fontSize: 9.5, lineHeight: 14, color: C.textSecondary },
  sectionBlock: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#DED8CB' },
  chart: { height: 150, marginTop: 17, flexDirection: 'row', alignItems: 'flex-end', gap: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DED8CB' },
  barLane: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barOther: { width: '100%', minHeight: 6, borderRadius: 3, backgroundColor: '#D6C9B3', overflow: 'hidden', justifyContent: 'flex-end' },
  barManaged: { width: '100%', backgroundColor: '#A9515D' },
  previewExplanation: { marginTop: 11, fontFamily: F.sans, fontSize: 8.5, lineHeight: 13, color: C.textMuted },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCard: { width: '48.7%', minHeight: 84, borderRadius: 17, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E9E4D8', backgroundColor: C.surface, padding: 13 },
  metricValue: { marginTop: 8, fontFamily: F.serifSemiBold, fontSize: 20, color: C.text },
  signalRow: { flexDirection: 'row', gap: 8 },
  signal: { flex: 1, minHeight: 109, borderRadius: 17, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E9E4D8', backgroundColor: C.surface, padding: 12 },
  signalIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: '#F7F0DF', alignItems: 'center', justifyContent: 'center' },
  signalValue: { marginTop: 8, fontFamily: F.serifSemiBold, fontSize: 18, color: C.text },
  signalLabel: { marginTop: 4, fontFamily: F.sansBold, fontSize: 6.5, letterSpacing: 0.65, color: C.textMuted },
  insight: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 20, borderCurve: 'continuous', backgroundColor: '#FBF5E7' },
  insightIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F2E3BF', alignItems: 'center', justifyContent: 'center' },
  insightTitle: { marginTop: 4, fontFamily: F.serifSemiBold, fontSize: 17, color: C.text },
  listCard: { borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E9E4D8', backgroundColor: C.surface, paddingHorizontal: 14 },
  groupRow: { minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 11 },
  groupMark: { width: 9, height: 35, borderRadius: 5 },
  groupMarkCrimson: { backgroundColor: '#A9515D' },
  groupMarkGold: { backgroundColor: C.gold },
  groupMarkInk: { backgroundColor: '#777066' },
  groupName: { fontFamily: F.sansBold, fontSize: 10.5, color: C.text },
  groupShare: { marginTop: 3, fontFamily: F.sansMedium, fontSize: 8.5, color: C.textMuted },
  groupValue: { fontFamily: F.serifSemiBold, fontSize: 17, color: C.text },
  dataRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dataRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4DED2' },
  dataLabel: { flex: 1, fontFamily: F.sansMedium, fontSize: 10, color: C.textSecondary },
  dataValue: { fontFamily: F.sansBold, fontSize: 10, color: C.text },
  privacy: { marginTop: 4, fontFamily: F.sansMedium, fontSize: 8.5, color: C.textMuted, textAlign: 'center' },
  beadCard: { padding: 17, borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E8D9BA', backgroundColor: '#FFF9EB' },
  beadField: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  bead: { width: 5, height: 5, borderRadius: 1.5, backgroundColor: '#DDD7CA' },
  beadRed: { backgroundColor: '#A9515D' },
  beadGold: { backgroundColor: C.gold },
  stateWrap: { flex: 1 },
  skeletonPage: { flex: 1, paddingHorizontal: 16, paddingTop: 10, gap: 14 },
  skeletonHero: { minHeight: 166, borderRadius: 25, borderCurve: 'continuous', backgroundColor: '#F5F0E6', padding: 19 },
  skeletonLine: { borderRadius: 6, backgroundColor: '#E5DED0' },
  skeletonMetricRow: { marginTop: 18, flexDirection: 'row', gap: 9 },
  skeletonMetric: { flex: 1, height: 46, borderRadius: 13, backgroundColor: '#E9E2D4' },
  skeletonChart: { minHeight: 218, padding: 17, borderRadius: 20, borderCurve: 'continuous', backgroundColor: '#F5F1E8' },
  skeletonBars: { flex: 1, marginTop: 19, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  skeletonBar: { flex: 1, borderRadius: 3, backgroundColor: '#E2DACB' },
  slowCard: { position: 'absolute', left: 29, right: 29, top: 124, padding: 17, borderRadius: 19, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E4D2A9', backgroundColor: '#FFFBF1', shadowColor: '#2F261A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.13, shadowRadius: 14, elevation: 5 },
  slowTitle: { fontFamily: F.serifSemiBold, fontSize: 18, color: C.text },
  slowBody: { marginTop: 5, fontFamily: F.sans, fontSize: 10, lineHeight: 15, color: C.textSecondary },
  retryButton: { alignSelf: 'flex-start', marginTop: 12, minHeight: 44, justifyContent: 'center', borderRadius: 12, backgroundColor: '#2B2620', paddingHorizontal: 14 },
  retryText: { fontFamily: F.sansBold, fontSize: 9, color: '#FFF9EC' },
  centerPage: { flex: 1, justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 22 },
  centerCard: { minHeight: 290, alignItems: 'center', borderRadius: 25, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E8D9BA', backgroundColor: '#FFF9EB', paddingHorizontal: 24, paddingVertical: 25 },
  centerIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3E6C7', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  centerTitle: { marginTop: 7, fontFamily: F.serifSemiBold, fontSize: 24, lineHeight: 28, color: C.text, textAlign: 'center' },
  centerBody: { marginTop: 8, maxWidth: 290, fontFamily: F.sans, fontSize: 11, lineHeight: 17, color: C.textSecondary, textAlign: 'center' },
  centerAction: { marginTop: 19, minHeight: 46, borderRadius: 14, borderCurve: 'continuous', backgroundColor: '#2B2620', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  centerActionText: { fontFamily: F.sansBold, fontSize: 10, color: '#FFF9EC' },
});
