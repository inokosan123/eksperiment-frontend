import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import {
  Activity,
  AlertTriangle,
  CheckSmall,
  ChevronDown,
  ChevronRight,
  Lock,
} from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { CATEGORY_TINTS, ESSENTIAL_APP_OPTIONS, PREVIEW_APPS } from './focusContent';
import { FocusMeter } from './FocusMeter';
import {
  formatMinutesShort,
  groupName,
  type AppRule,
  type DayPlan,
  type DayPlanState,
  type GroupRule,
  type RuleMode,
} from './dayPlanStore';
import {
  sortUsageRows,
  usageActivityState,
  usageBoundaryState,
  type UsageActivityState,
  type UsageBoundaryState,
} from './todayUsageModel';

const APP_NAMES: Record<string, string> = Object.fromEntries([
  ...PREVIEW_APPS.map(app => [app.id, app.name]),
  ...ESSENTIAL_APP_OPTIONS.map(app => [app.id, app.name]),
]);

const OVER = '#A54555';
const OVER_BG = '#FFF2F3';
const WITHIN = '#317766';
const WITHIN_BG = '#EDF7F3';
const INK_SOFT = '#5E574C';

type AppAnalyticsRow = {
  appId: string;
  name: string;
  rule: AppRule | null;
  usedMinutes: number | null;
};

type GroupAnalyticsRow = {
  groupId: string;
  name: string;
  rule: GroupRule;
  usedMinutes: number | null;
  activityState: UsageActivityState;
  apps: AppAnalyticsRow[];
};

function modeFor(rule: { mode?: RuleMode; dailyMinutes?: number | null; minutes?: number | null }) {
  if (rule.mode) return rule.mode;
  const minutes = 'dailyMinutes' in rule ? rule.dailyMinutes : rule.minutes;
  return minutes == null ? 'noLimit' : 'limit';
}

function compactStatusLabel(state: UsageBoundaryState) {
  if (state === 'over') return 'OVER';
  if (state === 'within') return 'OK';
  if (state === 'blocked') return 'BLOCKED';
  if (state === 'planned') return 'LIMIT SET';
  return 'OPEN';
}

function boundaryDetail(
  state: UsageBoundaryState,
  limit: number | null,
  used: number | null,
  fallback: string
) {
  if (state === 'over' && limit != null && used != null) {
    return `${formatMinutesShort(Math.max(0, used - limit))} over · ${formatMinutesShort(limit)} limit`;
  }
  if (state === 'within' && limit != null && used != null) {
    return `${formatMinutesShort(Math.max(0, limit - used))} left · ${formatMinutesShort(limit)} limit`;
  }
  if (state === 'planned' && limit != null) return `${formatMinutesShort(limit)} daily limit`;
  if (state === 'blocked') return 'Closed for this period';
  return fallback;
}

function StatusMark({ state }: { state: UsageBoundaryState }) {
  const over = state === 'over';
  const within = state === 'within';
  const blocked = state === 'blocked';
  return (
    <View style={[
      s.statusMark,
      over && s.statusMarkOver,
      within && s.statusMarkWithin,
      blocked && s.statusMarkBlocked,
    ]}>
      {within && <CheckSmall s={9} c={WITHIN} w={3} />}
      {over && <AlertTriangle s={9} c={OVER} w={2.3} />}
      {blocked && <Lock s={8.5} c={INK_SOFT} w={2.2} />}
      <Text style={[
        s.statusMarkText,
        over && s.statusMarkTextOver,
        within && s.statusMarkTextWithin,
      ]}>
        {compactStatusLabel(state)}
      </Text>
    </View>
  );
}

function buildRows({
  appMinutes,
  appUsageAvailable,
  groupMinutes,
  groupUsageAvailable,
  plan,
  rules,
  state,
}: {
  appMinutes: Record<string, number>;
  appUsageAvailable: boolean;
  groupMinutes: Record<string, number>;
  groupUsageAvailable: boolean;
  plan: DayPlan;
  rules: GroupRule[];
  state: DayPlanState;
}): GroupAnalyticsRow[] {
  const rulesByGroup = new Map(rules.map(rule => [rule.groupId, rule]));
  const groupIds = Array.from(new Set([
    ...Object.keys(plan.groupCatalog),
    ...rules.map(rule => rule.groupId),
    ...Object.keys(groupMinutes),
  ]));

  return sortUsageRows(groupIds.map(groupId => {
    const rule = rulesByGroup.get(groupId) ?? {
      groupId,
      dailyMinutes: null,
      strength: plan.strength,
      practice: 'prayer' as const,
      mode: 'noLimit' as const,
      checkInMinutes: null,
      appRules: [],
    };
    const ruleByApp = new Map((rule.appRules ?? []).map(appRule => [appRule.appId, appRule]));
    const appIds = Array.from(new Set([
      ...(plan.groupCatalog[groupId] ?? []),
      ...(rule.appRules ?? []).map(appRule => appRule.appId),
    ]));
    const apps = sortUsageRows(appIds.map(appId => ({
      appId,
      name: ruleByApp.get(appId)?.label?.trim() || APP_NAMES[appId] || appId,
      rule: ruleByApp.get(appId) ?? null,
      usedMinutes: appUsageAvailable ? appMinutes[appId] ?? 0 : null,
    })));
    const usedMinutes = groupUsageAvailable ? groupMinutes[groupId] ?? 0 : null;
    return {
      groupId,
      name: groupName(state, groupId),
      rule,
      usedMinutes,
      activityState: usageActivityState(usedMinutes),
      apps,
    };
  }));
}

function UsageShareRail({ rows }: { rows: GroupAnalyticsRow[] }) {
  const total = rows.reduce((sum, row) => sum + (row.usedMinutes ?? 0), 0);
  return (
    <View style={s.shareRail}>
      {total > 0 ? rows.map(row => {
        const tint = CATEGORY_TINTS[row.groupId] ?? { bg: C.goldLight, color: C.goldDark };
        return (
          <View
            key={row.groupId}
            style={[s.shareSegment, { backgroundColor: tint.color, flexGrow: row.usedMinutes ?? 0 }]}
          />
        );
      }) : <View style={s.shareRailEmpty} />}
    </View>
  );
}

function AppRow({
  app,
  groupRule,
  tint,
}: {
  app: AppAnalyticsRow;
  groupRule: GroupRule;
  tint: { bg: string; color: string };
}) {
  const appMode = app.rule ? modeFor(app.rule) : null;
  const appLimit = app.rule?.minutes ?? null;
  const appState = appMode ? usageBoundaryState(appMode, appLimit, app.usedMinutes) : null;
  const inheritedMode = modeFor(groupRule);
  const inheritedLabel = inheritedMode === 'blocked'
    ? 'Group is blocked'
    : inheritedMode === 'limit'
      ? 'Uses group boundary'
      : 'No individual limit';
  const rightDetail = appState === 'over' && appLimit != null && app.usedMinutes != null
    ? `${formatMinutesShort(Math.max(0, app.usedMinutes - appLimit))} over`
    : appState === 'within' && appLimit != null && app.usedMinutes != null
      ? `${formatMinutesShort(Math.max(0, appLimit - app.usedMinutes))} left`
      : appState
        ? compactStatusLabel(appState)
        : inheritedLabel;

  return (
    <View style={s.appRow}>
      <View style={[s.appAvatar, { backgroundColor: tint.bg }]}>
        <Text style={[s.appAvatarText, { color: tint.color }]}>{app.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={s.appMain}>
        <View style={s.appTopRow}>
          <Text style={s.appName} numberOfLines={1}>{app.name}</Text>
          <Text style={[s.appValue, appState === 'over' && s.appValueOver]} numberOfLines={1}>
            {app.usedMinutes == null ? '—' : formatMinutesShort(app.usedMinutes)}
          </Text>
        </View>
        <View style={s.appMetaRow}>
          <Text style={s.appBoundary} numberOfLines={1}>
            {app.rule
              ? appMode === 'blocked'
                ? 'Blocked'
                : appLimit == null
                  ? 'No limit'
                  : `${formatMinutesShort(appLimit)} app limit`
              : inheritedLabel}
          </Text>
          {appState && appState !== 'open' && (
            <Text
              style={[
                s.appState,
                appState === 'over' && s.appStateOver,
                appState === 'blocked' && s.appStateBlocked,
              ]}
              numberOfLines={1}
            >
              {rightDetail.toUpperCase()}
            </Text>
          )}
        </View>
        {appMode === 'limit' && appLimit != null && (
          <FocusMeter
            fraction={app.usedMinutes == null ? 0 : app.usedMinutes / appLimit}
            fill={appState === 'over' ? OVER : tint.color}
            track="#ECE8DF"
            height={3}
            style={s.appMeter}
          />
        )}
      </View>
    </View>
  );
}

function AppsPanel({ row }: { row: GroupAnalyticsRow }) {
  const tint = CATEGORY_TINTS[row.groupId] ?? { bg: C.goldLight, color: C.goldDark };
  return (
    <Animated.View entering={FadeIn.duration(170)} style={s.appsPanel}>
      <View style={s.appsHeader}>
        <View style={[s.appsHeaderIcon, { backgroundColor: tint.bg }]}>
          <Activity s={14} c={tint.color} w={2} />
        </View>
        <View style={s.appsHeaderCopy}>
          <Text style={s.appsHeaderTitle}>Apps in this group</Text>
          <Text style={s.appsHeaderText}>RANKED BY USE</Text>
        </View>
        <View style={s.appsHeaderCountBubble}>
          <Text style={s.appsHeaderCount}>{row.apps.length}</Text>
        </View>
      </View>
      {row.apps.length === 0 ? (
        <Text style={s.appsEmpty}>No private app selections are stored for this group.</Text>
      ) : row.apps.map((app, appIndex) => (
        <View key={app.appId}>
          {appIndex > 0 && <View style={s.appSeparator} />}
          <AppRow app={app} groupRule={row.rule} tint={tint} />
        </View>
      ))}
    </Animated.View>
  );
}

function GroupCard({
  expanded,
  index,
  onToggle,
  row,
}: {
  expanded: boolean;
  index: number;
  onToggle: () => void;
  row: GroupAnalyticsRow;
}) {
  const tint = CATEGORY_TINTS[row.groupId] ?? { bg: C.goldLight, color: C.goldDark };
  const mode = modeFor(row.rule);
  const limit = row.rule.dailyMinutes;
  const state = usageBoundaryState(mode, limit, row.usedMinutes);
  const caption = boundaryDetail(
    state,
    limit,
    row.usedMinutes,
    `${row.apps.length} ${row.apps.length === 1 ? 'app' : 'apps'} in this group`
  );
  const over = state === 'over';

  return (
    <Animated.View
      layout={LinearTransition.duration(190)}
      style={[s.groupCard, over && s.groupCardOver]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={over ? ['#FFFDFD', OVER_BG] : ['#FFFFFF', tint.bg]}
        locations={[0.2, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, s.groupGradient]}
      />
      <View style={[s.groupAccent, { backgroundColor: over ? OVER : tint.color }]} />
      <TouchableOpacity
        style={s.groupPressable}
        activeOpacity={0.76}
        onPress={onToggle}
        haptic="selection"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${row.name}, ${row.usedMinutes == null ? 'usage pending' : formatMinutesShort(row.usedMinutes)}, ${compactStatusLabel(state)}`}
      >
        <View style={s.groupHeader}>
          <View style={[s.rankBadge, { borderColor: `${tint.color}33` }]}>
            <Text style={[s.rankText, { color: tint.color }]}>{String(index + 1).padStart(2, '0')}</Text>
          </View>
          <View style={[s.groupAvatar, { backgroundColor: tint.bg, borderColor: `${tint.color}20` }]}>
            {mode === 'blocked'
              ? <Lock s={16} c={tint.color} w={2.1} />
              : <Text style={[s.groupAvatarText, { color: tint.color }]}>{row.name.slice(0, 1).toUpperCase()}</Text>}
          </View>
          <View style={s.groupTitleWrap}>
            <Text style={s.groupName} numberOfLines={1}>{row.name}</Text>
            <Text style={[s.groupCaption, over && s.groupCaptionOver]} numberOfLines={1}>{caption}</Text>
          </View>
          <View style={s.groupValueWrap}>
            <Text style={[s.groupValue, over && s.groupValueOver]} numberOfLines={1}>
              {row.usedMinutes == null ? '—' : formatMinutesShort(row.usedMinutes)}
            </Text>
            <StatusMark state={state} />
          </View>
        </View>

        {mode === 'limit' && limit != null && (
          <FocusMeter
            fraction={row.usedMinutes == null ? 0 : row.usedMinutes / limit}
            fill={over ? OVER : tint.color}
            track="rgba(40,33,24,0.08)"
            height={6}
            live={row.activityState === 'active' && !over}
            style={s.groupMeter}
          />
        )}

        <View style={s.groupFooter}>
          <View style={[s.groupMiniDot, { backgroundColor: over ? OVER : tint.color }]} />
          <Text style={s.groupFooterText} numberOfLines={1}>
            {expanded ? 'Hide app detail' : `View ${row.apps.length} ${row.apps.length === 1 ? 'app' : 'apps'}`}
          </Text>
          <View style={[s.chevronButton, expanded && s.chevronButtonOpen]}>
            {expanded
              ? <ChevronDown s={13} c={INK_SOFT} w={2.2} />
              : <ChevronRight s={13} c={INK_SOFT} w={2.2} />}
          </View>
        </View>
      </TouchableOpacity>

      {expanded && <AppsPanel row={row} />}
    </Animated.View>
  );
}

function InactiveGroupCard({
  expanded,
  onToggle,
  row,
}: {
  expanded: boolean;
  onToggle: () => void;
  row: GroupAnalyticsRow;
}) {
  const tint = CATEGORY_TINTS[row.groupId] ?? { bg: C.goldLight, color: C.goldDark };
  const mode = modeFor(row.rule);
  const limit = row.rule.dailyMinutes;
  const pending = row.activityState === 'pending';
  const protectedGroup = !pending && mode === 'blocked';
  const boundary = mode === 'blocked'
    ? 'Blocked'
    : mode === 'limit' && limit != null
      ? `${formatMinutesShort(limit)} limit`
      : 'No limit';
  const stateLabel = pending ? 'PENDING' : protectedGroup ? 'PROTECTED' : 'INACTIVE';
  return (
    <Animated.View
      layout={LinearTransition.duration(190)}
      style={[s.inactiveCard, pending && s.inactiveCardPending]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={pending ? ['#FCFBF8', '#F1EEE7'] : ['#FCFBF8', tint.bg]}
        locations={[0.46, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, s.inactiveGradient]}
      />
      <View style={[s.inactiveAccent, { backgroundColor: tint.color }]} />
      <TouchableOpacity
        style={s.inactiveRow}
        activeOpacity={0.78}
        onPress={onToggle}
        haptic="selection"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${row.name}, ${pending ? 'usage pending' : protectedGroup ? 'protected with no use today' : 'not used today'}, ${boundary}`}
      >
        <View style={[s.inactiveAvatar, { backgroundColor: `${tint.color}12` }]}>
          {mode === 'blocked'
            ? <Lock s={12} c={tint.color} w={2.1} />
            : <Text style={[s.inactiveAvatarText, { color: tint.color }]}>{row.name.slice(0, 1).toUpperCase()}</Text>}
        </View>
        <View style={s.inactiveCopy}>
          <Text style={s.inactiveName} numberOfLines={1}>{row.name}</Text>
          <View style={s.inactiveMetaRow}>
            <Text style={s.inactiveBoundary} numberOfLines={1}>{boundary}</Text>
            <View style={s.inactiveMetaDot} />
            <Text style={s.inactiveAppCount} numberOfLines={1}>
              {row.apps.length} {row.apps.length === 1 ? 'app' : 'apps'}
            </Text>
          </View>
        </View>
        <View style={s.inactiveValueWrap}>
          <Text style={s.inactiveValue}>{pending ? '—' : '0m'}</Text>
          <View style={[s.inactiveStatePill, protectedGroup && s.inactiveStatePillProtected]}>
            <Text style={[s.inactiveState, protectedGroup && s.inactiveStateProtected]}>{stateLabel}</Text>
          </View>
        </View>
        <View style={[s.inactiveChevron, expanded && s.inactiveChevronOpen]}>
          {expanded
            ? <ChevronDown s={13} c={INK_SOFT} w={2.2} />
            : <ChevronRight s={13} c={INK_SOFT} w={2.2} />}
        </View>
      </TouchableOpacity>
      {expanded && <AppsPanel row={row} />}
    </Animated.View>
  );
}

function UsageSectionHeading({
  count,
  hint,
  title,
}: {
  count: number;
  hint: string;
  title: string;
}) {
  return (
    <View style={s.sectionHeading}>
      <View style={s.sectionHeadingCopy}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.sectionHint}>{hint}</Text>
      </View>
      <View style={s.sectionCountBubble}>
        <Text style={s.sectionCount}>{count}</Text>
      </View>
    </View>
  );
}

export default function TodayUsageBreakdown({
  appMinutes,
  appUsageAvailable,
  groupMinutes,
  groupUsageAvailable,
  plan,
  rules,
  scopeLabel,
  state,
}: {
  appMinutes: Record<string, number>;
  appUsageAvailable: boolean;
  groupMinutes: Record<string, number>;
  groupUsageAvailable: boolean;
  plan: DayPlan;
  rules: GroupRule[];
  scopeLabel: string;
  state: DayPlanState;
}) {
  const rows = useMemo(() => buildRows({
    appMinutes,
    appUsageAvailable,
    groupMinutes,
    groupUsageAvailable,
    plan,
    rules,
    state,
  }), [appMinutes, appUsageAvailable, groupMinutes, groupUsageAvailable, plan, rules, state]);
  const activeRows = rows.filter(row => row.activityState === 'active');
  const quietRows = rows.filter(row => row.activityState === 'quiet');
  const pendingRows = rows.filter(row => row.activityState === 'pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalTracked = activeRows.reduce((sum, row) => sum + (row.usedMinutes ?? 0), 0);
  const overCount = activeRows.filter(row => {
    const mode = modeFor(row.rule);
    return usageBoundaryState(mode, row.rule.dailyMinutes, row.usedMinutes) === 'over';
  }).length;
  const onTrackCount = activeRows.filter(row => {
    const mode = modeFor(row.rule);
    return usageBoundaryState(mode, row.rule.dailyMinutes, row.usedMinutes) === 'within';
  }).length;

  return (
    <View style={s.wrap}>
      <View style={s.overview}>
        <LinearGradient
          colors={['#FFFDF8', '#F9F2E3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.overviewHalo} />
        <View style={s.overviewTop}>
          <View style={s.overviewIcon}>
            <Activity s={17} c={C.goldDark} w={2} />
          </View>
          <View style={s.overviewCopy}>
            <Text style={s.overviewKicker}>{scopeLabel.toUpperCase()} · USAGE MAP</Text>
            <Text style={s.overviewTitle}>Where your time went</Text>
          </View>
          <View style={s.overviewCount}>
            <Text style={s.overviewCountValue}>{groupUsageAvailable ? activeRows.length : '—'}</Text>
            <Text style={s.overviewCountLabel}>ACTIVE</Text>
          </View>
        </View>
        <UsageShareRail rows={activeRows} />
        <View style={s.overviewFooter}>
          <Text style={s.overviewTracked}>
            {groupUsageAvailable ? `${formatMinutesShort(totalTracked)} tracked` : `${rows.length} plan groups`}
          </Text>
          {groupUsageAvailable ? (
            <View style={s.overviewSignals}>
              {onTrackCount > 0 && (
                <View style={s.signalItem}>
                  <View style={[s.signalDot, { backgroundColor: WITHIN }]} />
                  <Text style={s.signalText}>{onTrackCount} on track</Text>
                </View>
              )}
              {overCount > 0 && (
                <View style={s.signalItem}>
                  <View style={[s.signalDot, { backgroundColor: OVER }]} />
                  <Text style={[s.signalText, { color: OVER }]}>{overCount} over</Text>
                </View>
              )}
              {onTrackCount === 0 && overCount === 0 && (
                <Text style={s.signalText}>Tap a group for apps</Text>
              )}
            </View>
          ) : <Text style={s.signalText}>Waiting for private activity</Text>}
        </View>
      </View>

      {activeRows.length > 0 && (
        <View style={s.section}>
          <UsageSectionHeading
            title="Active today"
            hint="Ranked by screen time"
            count={activeRows.length}
          />
          <View style={s.activeList}>
            {activeRows.map((row, index) => (
              <GroupCard
                key={row.groupId}
                row={row}
                index={index}
                expanded={expandedId === row.groupId}
                onToggle={() => setExpandedId(expandedId === row.groupId ? null : row.groupId)}
              />
            ))}
          </View>
        </View>
      )}

      {quietRows.length > 0 && (
        <View style={s.section}>
          <UsageSectionHeading
            title={activeRows.length > 0 ? 'Inactive today' : 'Plan groups'}
            hint={activeRows.length > 0 ? 'No screen time recorded' : 'No group activity yet'}
            count={quietRows.length}
          />
          <View style={s.inactiveList}>
            {quietRows.map(row => (
              <InactiveGroupCard
                key={row.groupId}
                row={row}
                expanded={expandedId === row.groupId}
                onToggle={() => setExpandedId(expandedId === row.groupId ? null : row.groupId)}
              />
            ))}
          </View>
        </View>
      )}

      {pendingRows.length > 0 && (
        <View style={s.section}>
          <UsageSectionHeading
            title="Plan groups"
            hint="Waiting for private iPhone activity"
            count={pendingRows.length}
          />
          <View style={s.inactiveList}>
            {pendingRows.map(row => (
              <InactiveGroupCard
                key={row.groupId}
                row={row}
                expanded={expandedId === row.groupId}
                onToggle={() => setExpandedId(expandedId === row.groupId ? null : row.groupId)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 21 },
  overview: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E7DCC5',
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 14,
    boxShadow: '0 10px 28px rgba(78, 61, 31, 0.075)',
  },
  overviewHalo: {
    position: 'absolute',
    right: -35,
    top: -48,
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 24,
    borderColor: 'rgba(197,160,89,0.075)',
  },
  overviewTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  overviewIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E5D3AD',
    backgroundColor: '#FFF8E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewCopy: { flex: 1, minWidth: 0 },
  overviewKicker: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1.55, color: C.goldDark },
  overviewTitle: { marginTop: 3, fontFamily: F.serifSemiBold, fontSize: 20, lineHeight: 23, letterSpacing: -0.2, color: C.text },
  overviewCount: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DFD1B3',
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewCountValue: { fontFamily: F.serifSemiBold, fontSize: 17, lineHeight: 17, color: C.goldDark, fontVariant: ['tabular-nums'] },
  overviewCountLabel: { marginTop: 2, fontFamily: F.sansBold, fontSize: 5.8, letterSpacing: 0.9, color: C.goldDark },
  shareRail: { height: 9, marginTop: 14, flexDirection: 'row', gap: 3, overflow: 'hidden', borderRadius: 5, backgroundColor: 'rgba(74,61,42,0.07)', padding: 1.5 },
  shareSegment: { flexBasis: 0, minWidth: 5, borderRadius: 4, opacity: 0.86 },
  shareRailEmpty: { flex: 1, borderRadius: 4, backgroundColor: 'rgba(74,61,42,0.06)' },
  overviewFooter: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  overviewTracked: { fontFamily: F.sansSemiBold, fontSize: 9.5, color: C.textSecondary, fontVariant: ['tabular-nums'] },
  overviewSignals: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  signalItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  signalDot: { width: 5, height: 5, borderRadius: 3 },
  signalText: { fontFamily: F.sansMedium, fontSize: 8.5, color: C.textMuted },
  section: { gap: 10 },
  sectionHeading: { minHeight: 44, paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionHeadingCopy: { flex: 1, minWidth: 0 },
  sectionTitle: { fontFamily: F.serifSemiBold, fontSize: 20, lineHeight: 23, letterSpacing: -0.15, color: C.text },
  sectionHint: { marginTop: 2, fontFamily: F.sansMedium, fontSize: 9.5, lineHeight: 13, color: C.textMuted },
  sectionCountBubble: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#E3DAC7', backgroundColor: '#F4EFE5', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 9px rgba(73, 59, 34, 0.06)' },
  sectionCount: { fontFamily: F.serifSemiBold, fontSize: 13, lineHeight: 15, color: INK_SOFT, fontVariant: ['tabular-nums'], textAlign: 'center' },
  activeList: { gap: 8 },
  groupCard: { position: 'relative', overflow: 'hidden', borderRadius: 22, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E4DED2', backgroundColor: '#FFFFFF', boxShadow: '0 7px 20px rgba(48, 41, 30, 0.06)' },
  groupCardOver: { borderColor: '#E8C5CB', boxShadow: '0 7px 21px rgba(130, 47, 62, 0.075)' },
  groupGradient: { opacity: 0.46 },
  groupAccent: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 3 },
  groupPressable: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  rankBadge: { width: 21, height: 42, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 0.7, opacity: 0.76, fontVariant: ['tabular-nums'] },
  groupAvatar: { width: 44, height: 44, borderRadius: 14, borderCurve: 'continuous', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  groupAvatarText: { fontFamily: F.serifSemiBold, fontSize: 20 },
  groupTitleWrap: { flex: 1, minWidth: 0 },
  groupName: { fontFamily: F.serifSemiBold, fontSize: 19.5, lineHeight: 23, letterSpacing: -0.2, color: C.text },
  groupCaption: { marginTop: 2, fontFamily: F.sansMedium, fontSize: 9.2, lineHeight: 13, color: C.textMuted },
  groupCaptionOver: { color: OVER },
  groupValueWrap: { alignItems: 'flex-end', gap: 4 },
  groupValue: { fontFamily: F.serifSemiBold, fontSize: 19.5, lineHeight: 22, color: C.text, fontVariant: ['tabular-nums'] },
  groupValueOver: { color: OVER },
  statusMark: { minHeight: 19, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 10, backgroundColor: 'rgba(84,77,66,0.08)', paddingHorizontal: 6.5, paddingVertical: 3.5 },
  statusMarkOver: { backgroundColor: OVER_BG },
  statusMarkWithin: { backgroundColor: WITHIN_BG },
  statusMarkBlocked: { backgroundColor: '#F0EEEA' },
  statusMarkText: { fontFamily: F.sansBold, fontSize: 6.8, letterSpacing: 0.7, color: INK_SOFT },
  statusMarkTextOver: { color: OVER },
  statusMarkTextWithin: { color: WITHIN },
  groupMeter: { marginTop: 10 },
  groupFooter: { marginTop: 8, minHeight: 25, flexDirection: 'row', alignItems: 'center' },
  groupMiniDot: { width: 5, height: 5, borderRadius: 3, opacity: 0.65 },
  groupFooterText: { flex: 1, marginLeft: 6, fontFamily: F.sansSemiBold, fontSize: 9.2, color: C.textSecondary },
  chevronButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center' },
  chevronButtonOpen: { backgroundColor: 'rgba(84,77,66,0.09)' },
  appsPanel: { marginHorizontal: 8, marginBottom: 8, borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(79,70,56,0.08)', backgroundColor: 'rgba(252,251,248,0.96)', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 5 },
  appsHeader: { paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  appsHeaderIcon: { width: 34, height: 34, borderRadius: 11, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  appsHeaderCopy: { flex: 1, minWidth: 0 },
  appsHeaderTitle: { fontFamily: F.serifMedium, fontSize: 15.5, lineHeight: 18, color: C.text },
  appsHeaderText: { marginTop: 1, fontFamily: F.sansBold, fontSize: 7.3, letterSpacing: 1.2, color: C.textMuted },
  appsHeaderCountBubble: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEE9DF', alignItems: 'center', justifyContent: 'center' },
  appsHeaderCount: { fontFamily: F.sansBold, fontSize: 9, lineHeight: 11, color: C.textSecondary, fontVariant: ['tabular-nums'], textAlign: 'center' },
  appRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10 },
  appAvatar: { width: 38, height: 38, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  appAvatarText: { fontFamily: F.serifSemiBold, fontSize: 16 },
  appMain: { flex: 1, minWidth: 0 },
  appTopRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  appName: { flex: 1, minWidth: 0, fontFamily: F.sansSemiBold, fontSize: 12.3, color: C.text },
  appValue: { fontFamily: F.sansSemiBold, fontSize: 11.5, color: C.textSecondary, fontVariant: ['tabular-nums'] },
  appValueOver: { color: OVER },
  appMetaRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 7 },
  appBoundary: { flex: 1, minWidth: 0, fontFamily: F.sansMedium, fontSize: 9, color: C.textMuted },
  appState: { fontFamily: F.sansBold, fontSize: 6.7, letterSpacing: 0.5, color: WITHIN },
  appStateOver: { color: OVER },
  appStateBlocked: { color: INK_SOFT },
  appMeter: { marginTop: 7 },
  appSeparator: { height: StyleSheet.hairlineWidth, marginLeft: 49, backgroundColor: '#E7E3DA' },
  appsEmpty: { paddingHorizontal: 1, paddingTop: 3, paddingBottom: 11, fontFamily: F.sansMedium, fontSize: 10, lineHeight: 15, color: C.textMuted },
  inactiveList: { gap: 6 },
  inactiveCard: { position: 'relative', overflow: 'hidden', borderRadius: 19, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E8E3DA', backgroundColor: '#FAF8F4', boxShadow: '0 3px 10px rgba(48, 41, 30, 0.035)' },
  inactiveCardPending: { borderStyle: 'dashed', borderColor: '#DED9CF' },
  inactiveGradient: { opacity: 0.24 },
  inactiveAccent: { position: 'absolute', top: 14, bottom: 14, left: 0, width: 2, borderRadius: 1, opacity: 0.42 },
  inactiveRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 13, paddingRight: 11, paddingVertical: 10 },
  inactiveAvatar: { width: 38, height: 38, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(77,68,54,0.035)', alignItems: 'center', justifyContent: 'center' },
  inactiveAvatarText: { fontFamily: F.serifSemiBold, fontSize: 16.5 },
  inactiveCopy: { flex: 1, minWidth: 0 },
  inactiveName: { fontFamily: F.serifMedium, fontSize: 16.5, lineHeight: 20, letterSpacing: -0.08, color: C.text },
  inactiveMetaRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 5 },
  inactiveBoundary: { fontFamily: F.sansMedium, fontSize: 8.8, color: C.textMuted },
  inactiveMetaDot: { width: 2.5, height: 2.5, borderRadius: 2, backgroundColor: '#BDB6A9' },
  inactiveAppCount: { flexShrink: 1, fontFamily: F.sansMedium, fontSize: 8.8, color: C.textMuted },
  inactiveValueWrap: { alignItems: 'flex-end', gap: 3 },
  inactiveValue: { fontFamily: F.sansSemiBold, fontSize: 11.5, color: C.textSecondary, fontVariant: ['tabular-nums'] },
  inactiveStatePill: { minHeight: 15, borderRadius: 8, backgroundColor: 'rgba(84,77,66,0.065)', paddingHorizontal: 5.5, alignItems: 'center', justifyContent: 'center' },
  inactiveStatePillProtected: { backgroundColor: WITHIN_BG },
  inactiveState: { fontFamily: F.sansBold, fontSize: 5.8, letterSpacing: 0.62, color: C.textMuted },
  inactiveStateProtected: { color: WITHIN },
  inactiveChevron: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.64)', borderWidth: 1, borderColor: 'rgba(79,70,56,0.045)', alignItems: 'center', justifyContent: 'center' },
  inactiveChevronOpen: { backgroundColor: 'rgba(84,77,66,0.085)' },
});
