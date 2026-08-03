import { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Lock,
} from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { ESSENTIAL_APP_OPTIONS, PREVIEW_APPS } from './focusContent';
import AlwaysBlockedSheet from './AlwaysBlockedSheet';
import {
  ALWAYS_BLOCKED_GROUP_ID,
  formatMinutesShort,
  groupName,
  type AppRule,
  type DayPlan,
  type DayPlanState,
  type GroupRule,
  type RuleMode,
} from './dayPlanStore';
import {
  focusBoundaryAppearance,
  focusInheritedBoundaryLabel,
  focusRailFraction,
  focusRemainingMinutes,
  focusSecondarySignal,
  focusSecondarySignalLabel,
  focusShowsProgressRail,
  focusStatusLabel,
  sortUsageRows,
  usageActivityState,
  type FocusBoundaryAppearance,
  type UsageActivityState,
  type UsageBoundaryMode,
} from './todayUsageModel';
import GroupSeal from './GroupSeal';
import {
  boundaryTone,
  BoundaryChip,
  BoundaryRail,
  BoundarySignalChip,
  CardWeave,
  type BoundaryMarker,
} from './focusBoundaryShell';

const APP_NAMES: Record<string, string> = Object.fromEntries([
  ...PREVIEW_APPS.map(app => [app.id, app.name]),
  ...ESSENTIAL_APP_OPTIONS.map(app => [app.id, app.name]),
]);

const INK_SOFT = '#5E574C';

const GROUP_EMOJI: Record<string, string> = {
  social: 'mobile-phone',
  entertainment: 'movie-camera',
  games: 'joker',
  news: 'newspaper',
  shopping: 'money-bag',
  dating: 'red-heart',
};

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

// ---------------------------------------------------------------------------
// View models
//
// Everything the cards need is resolved once, here, so a usage refresh cannot
// re-derive state inside render and so the group's colour, its chip, its rail
// and its accessibility label can never disagree with one another.
// ---------------------------------------------------------------------------

const OTHER_ACTIVITY_ID = '__other';

type AppViewModel = {
  id: string;
  name: string;
  appearance: FocusBoundaryAppearance;
  statusLabel: string;
  boundaryLabel: string;
  usedLabel: string;
  usedMinutes: number | null;
  limitMinutes: number | null;
  showRail: boolean;
  railFraction: number;
  marker: BoundaryMarker;
  accessibilityLabel: string;
};

type GroupViewModel = {
  id: string;
  name: string;
  emoji?: string;
  appearance: FocusBoundaryAppearance;
  statusLabel: string;
  detail: string;
  usedLabel: string;
  usedMinutes: number | null;
  limitMinutes: number | null;
  strengthLabel: string | null;
  showRail: boolean;
  railFraction: number;
  marker: BoundaryMarker;
  sealMarker: 'none' | 'lock' | 'warning';
  signalLabel: string | null;
  apps: AppViewModel[];
  activityState: UsageActivityState;
  isAlwaysBlocked: boolean;
};

const shortMinutes = (value: number) => formatMinutesShort(value);

function markerFor(appearance: FocusBoundaryAppearance): BoundaryMarker {
  if (appearance === 'blocked') return 'lock';
  if (appearance === 'overLimit') return 'warning';
  if (appearance === 'limitActive') return 'check';
  return 'none';
}

function sealMarkerFor(appearance: FocusBoundaryAppearance): 'none' | 'lock' | 'warning' {
  if (appearance === 'blocked') return 'lock';
  if (appearance === 'overLimit') return 'warning';
  return 'none';
}

function groupDetailFor(
  appearance: FocusBoundaryAppearance,
  limit: number | null,
  used: number | null,
  appCount: number
): string {
  switch (appearance) {
    case 'pending':
      return 'Waiting for private iPhone activity';
    case 'blocked':
      return 'Closed for this plan';
    case 'noLimit':
      return `Open use · ${appCount} ${appCount === 1 ? 'app' : 'apps'}`;
    case 'limitActive':
      return used === 0
        ? `${formatMinutesShort(limit ?? 0)} daily limit`
        : `${formatMinutesShort(focusRemainingMinutes(limit, used))} left · ${formatMinutesShort(limit ?? 0)} limit`;
    case 'atLimit':
      return `Limit reached · ${formatMinutesShort(limit ?? 0)} limit`;
    case 'overLimit':
      return `${formatMinutesShort(limit ?? 0)} limit · recorded today`;
  }
}

function buildAppViewModel(
  app: AppAnalyticsRow,
  groupAppearance: FocusBoundaryAppearance,
  groupMode: UsageBoundaryMode
): AppViewModel {
  const ownMode = app.rule ? modeFor(app.rule) : null;
  const ownLimit = app.rule?.minutes ?? null;
  // An app inside a blocked group is closed by the group; its own dormant rule
  // must not be shown as if it were doing the work.
  const inheritsGroupBlock = groupMode === 'blocked' || groupAppearance === 'blocked';
  const effectiveMode: UsageBoundaryMode = inheritsGroupBlock
    ? 'blocked'
    : ownMode ?? 'noLimit';
  const effectiveLimit = inheritsGroupBlock ? null : ownLimit;

  const appearance = focusBoundaryAppearance({
    mode: effectiveMode,
    limitMinutes: effectiveLimit,
    usedMinutes: app.usedMinutes,
  });

  const boundaryLabel = ownMode && !inheritsGroupBlock
    ? ownMode === 'blocked'
      ? 'BLOCKED'
      : ownLimit == null
        ? focusInheritedBoundaryLabel(groupAppearance, groupMode)
        : `${formatMinutesShort(ownLimit)} APP LIMIT`
    : focusInheritedBoundaryLabel(groupAppearance, groupMode);

  const usedLabel = app.usedMinutes == null ? '—' : formatMinutesShort(app.usedMinutes);
  const statusLabel = focusStatusLabel(
    appearance,
    { limitMinutes: effectiveLimit, usedMinutes: app.usedMinutes },
    shortMinutes
  );

  return {
    id: app.appId,
    name: app.name,
    appearance,
    statusLabel,
    boundaryLabel,
    usedLabel,
    usedMinutes: app.usedMinutes,
    limitMinutes: effectiveLimit,
    showRail: focusShowsProgressRail(appearance, effectiveLimit),
    railFraction: focusRailFraction(effectiveLimit, app.usedMinutes),
    marker: markerFor(appearance),
    accessibilityLabel: `${app.name}, ${statusLabel}, ${usedLabel}${
      effectiveLimit != null ? ` of ${formatMinutesShort(effectiveLimit)}` : ''
    }, ${boundaryLabel.toLowerCase()}`,
  };
}

function buildGroupViewModel(row: GroupAnalyticsRow): GroupViewModel {
  const mode = modeFor(row.rule) as UsageBoundaryMode;
  const limit = row.rule.dailyMinutes ?? null;
  const appearance = focusBoundaryAppearance({
    mode,
    limitMinutes: limit,
    usedMinutes: row.usedMinutes,
  });
  const apps = row.apps.map(app => buildAppViewModel(app, appearance, mode));
  const signal = focusSecondarySignal({
    appearance,
    usedMinutes: row.usedMinutes,
    childAppearances: apps.map(app => app.appearance),
  });
  const statusLabel = focusStatusLabel(
    appearance,
    { limitMinutes: limit, usedMinutes: row.usedMinutes },
    shortMinutes
  );
  const usedLabel = row.usedMinutes == null ? '—' : formatMinutesShort(row.usedMinutes);
  const isAlwaysBlocked = row.groupId === ALWAYS_BLOCKED_GROUP_ID;

  return {
    id: row.groupId,
    name: row.name,
    emoji: GROUP_EMOJI[row.groupId],
    appearance,
    statusLabel,
    detail: groupDetailFor(appearance, limit, row.usedMinutes, row.apps.length),
    usedLabel,
    usedMinutes: row.usedMinutes,
    limitMinutes: limit,
    strengthLabel: mode === 'noLimit'
      ? null
      : row.rule.strength === 'strict' ? 'STRICT' : 'LOOSE',
    showRail: focusShowsProgressRail(appearance, limit),
    railFraction: focusRailFraction(limit, row.usedMinutes),
    marker: markerFor(appearance),
    sealMarker: sealMarkerFor(appearance),
    signalLabel: focusSecondarySignalLabel(signal, shortMinutes),
    apps,
    activityState: row.activityState,
    isAlwaysBlocked,
  };
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
  const alwaysBlockedIds = new Set(state.alwaysBlockedApps.map(entry => entry.appId));
  const groupIds = Array.from(new Set([
    ...Object.keys(plan.groupCatalog),
    ...rules.map(rule => rule.groupId),
    ...Object.keys(groupMinutes),
  // Apple's own bucket is not a plan group and must never be treated as one.
  ])).filter(groupId => groupId !== OTHER_ACTIVITY_ID);

  const regularRows = sortUsageRows(groupIds.map(groupId => {
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
    ])).filter(appId => !alwaysBlockedIds.has(appId));
    const apps = sortUsageRows(appIds.map(appId => ({
      appId,
      name: ruleByApp.get(appId)?.label?.trim() || APP_NAMES[appId] || appId,
      rule: ruleByApp.get(appId) ?? null,
      usedMinutes: appUsageAvailable ? appMinutes[appId] ?? 0 : null,
    })));
    const blockedMinutes = appUsageAvailable
      ? Array.from(alwaysBlockedIds).reduce(
          (sum, appId) => sum + ((plan.groupCatalog[groupId] ?? []).includes(appId) ? appMinutes[appId] ?? 0 : 0),
          0
        )
      : 0;
    const usedMinutes = groupUsageAvailable
      ? Math.max(0, (groupMinutes[groupId] ?? 0) - blockedMinutes)
      : null;
    return {
      groupId,
      name: groupName(state, groupId),
      rule,
      usedMinutes,
      activityState: usageActivityState(usedMinutes),
      apps,
    };
  }));

  if (state.alwaysBlockedApps.length === 0) return regularRows;

  const alwaysBlockedRule: GroupRule = {
    groupId: ALWAYS_BLOCKED_GROUP_ID,
    dailyMinutes: null,
    strength: 'strict',
    practice: 'prayer',
    mode: 'blocked',
    checkInMinutes: null,
    appRules: [],
  };
  const alwaysBlockedApps = sortUsageRows(state.alwaysBlockedApps.map(entry => ({
    appId: entry.appId,
    name: APP_NAMES[entry.appId] || entry.appId,
    rule: null,
    usedMinutes: appUsageAvailable ? appMinutes[entry.appId] ?? 0 : null,
  })));
  const alwaysBlockedMinutes = appUsageAvailable
    ? alwaysBlockedApps.reduce((sum, app) => sum + (app.usedMinutes ?? 0), 0)
    : null;

  return [...regularRows, {
    groupId: ALWAYS_BLOCKED_GROUP_ID,
    name: 'Always Blocked',
    rule: alwaysBlockedRule,
    usedMinutes: alwaysBlockedMinutes,
    activityState: usageActivityState(alwaysBlockedMinutes),
    apps: alwaysBlockedApps,
  }];
}

function UsageShareRail({ rows }: { rows: GroupViewModel[] }) {
  const total = rows.reduce((sum, row) => sum + (row.usedMinutes ?? 0), 0);
  return (
    <View style={s.shareRail}>
      {total > 0 ? rows.map(row => (
        <View
          key={row.id}
          style={[
            s.shareSegment,
            { backgroundColor: boundaryTone(row.appearance).accent, flexGrow: row.usedMinutes ?? 0 },
          ]}
        />
      )) : <View style={s.shareRailEmpty} />}
    </View>
  );
}

// One application inside an expanded group, struck from the same ribbon the
// group sheet's app cards use.
const AppRow = memo(function AppRow({ app }: { app: AppViewModel }) {
  const tone = boundaryTone(app.appearance);
  const lit = app.appearance !== 'pending' && app.appearance !== 'noLimit';

  return (
    <View
      style={[s.appRow, lit && { backgroundColor: tone.ground, borderColor: tone.edge }]}
      accessible
      accessibilityLabel={app.accessibilityLabel}
    >
      <View style={[s.appAvatar, { backgroundColor: tone.badge, borderColor: tone.edge }]}>
        <Text style={[s.appAvatarText, { color: tone.accent }]}>
          {app.name.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={s.appMain}>
        <View style={s.appTopRow}>
          <Text style={[s.appName, { color: tone.ink }]} numberOfLines={1}>{app.name}</Text>
          <Text style={[s.appValue, { color: tone.ink }]} numberOfLines={1}>{app.usedLabel}</Text>
        </View>
        <View style={s.appMetaRow}>
          <Text style={[s.appBoundary, { color: tone.body }]} numberOfLines={1}>
            {app.boundaryLabel}
          </Text>
          <BoundaryChip
            appearance={app.appearance}
            label={app.statusLabel}
            marker={app.marker}
          />
        </View>
        {app.showRail && (
          <BoundaryRail fraction={app.railFraction} tone={tone} height={3} style={s.appMeter} />
        )}
      </View>
    </View>
  );
});

const AppsPanel = memo(function AppsPanel({ group }: { group: GroupViewModel }) {
  const reduceMotion = useReducedMotion();
  const tone = boundaryTone(group.appearance);
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(200)}
      style={s.appsPanel}
    >
      <View style={s.appsHeader}>
        <View style={[s.appsHeaderIcon, { backgroundColor: tone.badge }]}>
          <Activity s={14} c={tone.accent} w={2} />
        </View>
        <View style={s.appsHeaderCopy}>
          <Text style={s.appsHeaderTitle}>Apps in this group</Text>
          <Text style={s.appsHeaderText}>RANKED BY USE</Text>
        </View>
        <View style={s.appsHeaderCountBubble}>
          <Text style={s.appsHeaderCount}>{group.apps.length}</Text>
        </View>
      </View>
      {group.apps.length === 0 ? (
        <Text style={s.appsEmpty}>No private app selections are stored for this group.</Text>
      ) : (
        <View style={s.appsStack}>
          {group.apps.map(app => <AppRow key={app.id} app={app} />)}
        </View>
      )}
    </Animated.View>
  );
});

// One card for every state. There used to be two — a lit one for groups with
// time on them and a quiet one for the rest — which meant the same group
// changed shape during the day rather than changing state.
const PlanGroupCard = memo(function PlanGroupCard({
  expanded,
  group,
  onToggle,
}: {
  expanded: boolean;
  group: GroupViewModel;
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const tone = boundaryTone(group.appearance);
  const textured = group.appearance !== 'pending' && group.appearance !== 'noLimit';

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(200)}
      style={[s.groupCard, { backgroundColor: tone.ground, borderColor: tone.edge }]}
    >
      {textured && <CardWeave color={tone.accent} />}
      <TouchableOpacity
        style={s.groupPressable}
        activeOpacity={0.76}
        onPress={onToggle}
        haptic="selection"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${group.name}, ${group.statusLabel}, ${group.usedLabel}${
          group.limitMinutes != null ? ` of ${formatMinutesShort(group.limitMinutes)}` : ''
        }${group.signalLabel ? `, ${group.signalLabel}` : ''}, ${
          expanded ? 'expanded' : 'collapsed'
        }, ${group.apps.length} ${group.apps.length === 1 ? 'app' : 'apps'}`}
      >
        <View style={s.groupHeader}>
          <GroupSeal
            groupId={group.id}
            name={group.name}
            icon={group.emoji}
            size={40}
            tone={{ color: tone.accent, bg: tone.badge }}
            marker={group.sealMarker}
          />
          <View style={s.groupTitleWrap}>
            <View style={s.groupTitleRow}>
              <Text style={[s.groupName, { color: tone.ink }]} numberOfLines={1}>{group.name}</Text>
              {group.strengthLabel && (
                <View style={s.strengthChip}>
                  <Text style={s.strengthChipText}>{group.strengthLabel}</Text>
                </View>
              )}
            </View>
            <Text style={[s.groupCaption, { color: tone.body }]} numberOfLines={1}>
              {group.detail}
            </Text>
          </View>
          <View style={s.groupValueWrap}>
            <Text style={[s.groupValue, { color: tone.ink }]} numberOfLines={1}>
              {group.usedLabel}
            </Text>
            <BoundaryChip
              appearance={group.appearance}
              label={group.statusLabel}
              marker={group.marker}
            />
          </View>
        </View>

        {group.showRail && (
          <BoundaryRail fraction={group.railFraction} tone={tone} height={6} style={s.groupMeter} />
        )}

        <View style={s.groupFooter}>
          {group.signalLabel
            ? <BoundarySignalChip label={group.signalLabel} tone={tone} />
            : <View style={[s.groupMiniDot, { backgroundColor: tone.accent }]} />}
          <Text style={s.groupFooterText} numberOfLines={1}>
            {expanded ? 'Hide app detail' : `View ${group.apps.length} ${group.apps.length === 1 ? 'app' : 'apps'}`}
          </Text>
          <View style={[s.chevronButton, expanded && s.chevronButtonOpen]}>
            {expanded
              ? <ChevronDown s={13} c={INK_SOFT} w={2.2} />
              : <ChevronRight s={13} c={INK_SOFT} w={2.2} />}
          </View>
        </View>
      </TouchableOpacity>

      {expanded && <AppsPanel group={group} />}
    </Animated.View>
  );
});

// Apple's own bucket. Not a plan group: no rule, no state, no child counting.
function OtherActivityRow({ minutes }: { minutes: number | null }) {
  const tone = boundaryTone('noLimit');
  return (
    <View
      style={[s.otherRow, { borderColor: tone.edge }]}
      accessible
      accessibilityLabel={`Other activity, ${
        minutes == null ? 'usage pending' : formatMinutesShort(minutes)
      }, outside your plan groups`}
    >
      <View style={[s.otherSeat, { backgroundColor: tone.badge }]}>
        <Activity s={15} c={tone.accent} w={2} />
      </View>
      <View style={s.otherCopy}>
        <Text style={s.otherName} numberOfLines={1}>Other activity</Text>
        <Text style={s.otherMeta} numberOfLines={1}>Outside your plan groups</Text>
      </View>
      <Text style={s.otherValue} numberOfLines={1}>
        {minutes == null ? '—' : formatMinutesShort(minutes)}
      </Text>
    </View>
  );
}

// An Essentials-only plan has no group boundaries to report on, so the group
// list is replaced by the one fact that is true: everything else is closed.
function EssentialsOnlyCard() {
  const tone = boundaryTone('blocked');
  return (
    <View
      style={[s.essentialsCard, { backgroundColor: tone.ground, borderColor: tone.edge }]}
      accessible
      accessibilityLabel="Essentials only. Only essential apps are available during this plan."
    >
      <CardWeave color={tone.accent} />
      <View style={[s.essentialsSeal, { backgroundColor: tone.accent }]}>
        <Lock s={19} c="#FFFFFF" w={2.4} />
      </View>
      <View style={s.essentialsCopy}>
        <Text style={[s.essentialsTitle, { color: tone.ink }]}>ESSENTIALS ONLY</Text>
        <Text style={[s.essentialsBody, { color: tone.body }]}>
          Only essential apps are available during this plan.
        </Text>
      </View>
    </View>
  );
}

function TodayAlwaysBlockedCard({
  onPress,
  row,
}: {
  onPress: () => void;
  row: GroupViewModel;
}) {
  const tone = boundaryTone(row.appearance);
  const appLabel = `${row.apps.length} ${row.apps.length === 1 ? 'app' : 'apps'}`;
  // Protected, never "over": the report counts the whole day, including any
  // minutes spent before this plan took hold.
  const statusLabel = row.appearance === 'pending'
    ? 'PENDING'
    : row.signalLabel ?? 'PROTECTED';

  return (
    <TouchableOpacity
      style={[s.alwaysBlockedCard, { backgroundColor: tone.ground, borderColor: tone.edge }]}
      onPress={onPress}
      activeOpacity={0.8}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={`Always Blocked, ${appLabel}, ${statusLabel}. Open Always Blocked settings.`}
    >
      {row.appearance !== 'pending' && <CardWeave color={tone.accent} />}
      <View style={[s.alwaysBlockedSeal, { borderColor: tone.edge, backgroundColor: tone.badge }]}>
        <Lock s={19} c={tone.accent} w={2.3} />
      </View>
      <View style={s.alwaysBlockedCopy}>
        <View style={s.alwaysBlockedTitleRow}>
          <Text style={s.alwaysBlockedTitle} numberOfLines={1}>Always Blocked</Text>
          <View style={[s.alwaysBlockedSystemBadge, { backgroundColor: tone.badge, borderColor: tone.edge }]}>
            <Text style={[s.alwaysBlockedSystemText, { color: tone.accent }]} numberOfLines={1}>
              {statusLabel}
            </Text>
          </View>
        </View>
        <Text style={s.alwaysBlockedMeta} numberOfLines={1}>{appLabel} · managed globally</Text>
      </View>
      <View style={[s.alwaysBlockedArrow, { borderColor: tone.edge }]}>
        <ChevronRight s={17} c={tone.accent} w={2.2} />
      </View>
    </TouchableOpacity>
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
  // ONE pass. The refresh runs every half minute, so state is resolved here and
  // the cards only read what it produced — nothing is re-derived per render and
  // no decorative tree is rebuilt because a minute count moved.
  const groups = useMemo(() => buildRows({
    appMinutes,
    appUsageAvailable,
    groupMinutes,
    groupUsageAvailable,
    plan,
    rules,
    state,
  }).map(buildGroupViewModel),
  [appMinutes, appUsageAvailable, groupMinutes, groupUsageAvailable, plan, rules, state]);

  const essentialsOnly = !!plan.essentialsOnly;
  const alwaysBlockedRow = groups.find(group => group.isAlwaysBlocked) ?? null;
  const regularRows = groups.filter(group => !group.isAlwaysBlocked);
  const activeRows = regularRows.filter(group => group.activityState === 'active');
  const quietRows = regularRows.filter(group => group.activityState === 'quiet');
  const pendingRows = regularRows.filter(group => group.activityState === 'pending');
  const overviewRows = alwaysBlockedRow?.activityState === 'active'
    ? [...activeRows, alwaysBlockedRow]
    : activeRows;
  // Apple's own bucket rides at the very end and joins no count.
  const otherMinutes = groupUsageAvailable
    ? groupMinutes[OTHER_ACTIVITY_ID] ?? null
    : null;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [alwaysBlockedOpen, setAlwaysBlockedOpen] = useState(false);
  // Only one group stands open at a time.
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedId(current => (current === groupId ? null : groupId));
  }, []);

  const totalTracked = overviewRows.reduce((sum, row) => sum + (row.usedMinutes ?? 0), 0);
  const onTrackCount = overviewRows.filter(row => row.appearance === 'limitActive').length;
  const atLimitCount = overviewRows.filter(row => row.appearance === 'atLimit').length;
  const overCount = overviewRows.filter(row => row.appearance === 'overLimit').length;
  const openCount = overviewRows.filter(row => row.appearance === 'noLimit').length;

  return (
    <>
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
            <Text style={s.overviewKicker}>{scopeLabel.toUpperCase()} · GROUP STATUS</Text>
            <Text style={s.overviewTitle}>How your groups stand</Text>
          </View>
          <View style={s.overviewCount}>
            <Text style={s.overviewCountValue}>{groupUsageAvailable ? overviewRows.length : '—'}</Text>
            <Text style={s.overviewCountLabel}>ACTIVE</Text>
          </View>
        </View>
        <UsageShareRail rows={overviewRows} />
        <View style={s.overviewFooter}>
          <Text style={s.overviewTracked}>
            {groupUsageAvailable ? `${formatMinutesShort(totalTracked)} tracked` : `${groups.length} plan groups`}
          </Text>
          {groupUsageAvailable ? (
            <View style={s.overviewSignals}>
              {onTrackCount > 0 && (
                <View style={s.signalItem}>
                  <View style={[s.signalDot, { backgroundColor: boundaryTone('limitActive').accent }]} />
                  <Text style={s.signalText}>{onTrackCount} on track</Text>
                </View>
              )}
              {atLimitCount > 0 && (
                <View style={s.signalItem}>
                  <View style={[s.signalDot, { backgroundColor: boundaryTone('atLimit').accent }]} />
                  <Text style={[s.signalText, { color: boundaryTone('atLimit').accent }]}>{atLimitCount} at limit</Text>
                </View>
              )}
              {overCount > 0 && (
                <View style={s.signalItem}>
                  <View style={[s.signalDot, { backgroundColor: boundaryTone('overLimit').accent }]} />
                  <Text style={[s.signalText, { color: boundaryTone('overLimit').accent }]}>{overCount} over</Text>
                </View>
              )}
              {openCount > 0 && onTrackCount === 0 && atLimitCount === 0 && overCount === 0 && (
                <Text style={s.signalText}>{openCount} open</Text>
              )}
              {openCount === 0 && onTrackCount === 0 && atLimitCount === 0 && overCount === 0 && (
                <Text style={s.signalText}>Tap a group for apps</Text>
              )}
            </View>
          ) : <Text style={s.signalText}>Waiting for private activity</Text>}
        </View>
      </View>

      {essentialsOnly ? (
        <View style={s.section}>
          <UsageSectionHeading
            title="Plan groups"
            hint="Replaced while Essentials-only holds"
            count={0}
          />
          <EssentialsOnlyCard />
        </View>
      ) : (
        <>
          {activeRows.length > 0 && (
            <View style={s.section}>
              <UsageSectionHeading
                title="Active today"
                hint="Ranked by screen time"
                count={activeRows.length}
              />
              <View style={s.activeList}>
                {activeRows.map(group => (
                  <PlanGroupCard
                    key={group.id}
                    group={group}
                    expanded={expandedId === group.id}
                    onToggle={() => toggleGroup(group.id)}
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
              <View style={s.activeList}>
                {quietRows.map(group => (
                  <PlanGroupCard
                    key={group.id}
                    group={group}
                    expanded={expandedId === group.id}
                    onToggle={() => toggleGroup(group.id)}
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
              <View style={s.activeList}>
                {pendingRows.map(group => (
                  <PlanGroupCard
                    key={group.id}
                    group={group}
                    expanded={expandedId === group.id}
                    onToggle={() => toggleGroup(group.id)}
                  />
                ))}
              </View>
            </View>
          )}
        </>
      )}

      {alwaysBlockedRow && (
        <View style={s.section}>
          <UsageSectionHeading
            title="System group"
            hint="Outside every plan limit"
            count={1}
          />
          <View style={s.inactiveList}>
            <TodayAlwaysBlockedCard
              row={alwaysBlockedRow}
              onPress={() => setAlwaysBlockedOpen(true)}
            />
          </View>
        </View>
      )}
      {otherMinutes != null && otherMinutes > 0 && (
        <View style={s.section}>
          <UsageSectionHeading
            title="Other activity"
            hint="Outside your plan groups"
            count={1}
          />
          <OtherActivityRow minutes={otherMinutes} />
        </View>
      )}
    </View>
    <AlwaysBlockedSheet
      visible={alwaysBlockedOpen}
      onClose={() => setAlwaysBlockedOpen(false)}
    />
    </>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 21 },
  appsStack: { gap: 7 },
  otherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 56,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 13,
  },
  otherSeat: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherCopy: { flex: 1, minWidth: 0 },
  otherName: { fontFamily: F.serifSemiBold, fontSize: 16, color: '#3D372F' },
  otherMeta: { marginTop: 1.5, fontFamily: F.sans, fontSize: 12, color: '#8A8378' },
  otherValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 16,
    color: '#3D372F',
    fontVariant: ['tabular-nums'],
  },
  essentialsCard: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 21,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  essentialsSeal: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  essentialsCopy: { flex: 1, minWidth: 0 },
  essentialsTitle: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.7 },
  essentialsBody: {
    marginTop: 4,
    fontFamily: F.serif,
    fontSize: 14,
    lineHeight: 18.5,
  },

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
  groupCard: { position: 'relative', overflow: 'hidden', borderRadius: 21, borderCurve: 'continuous', backgroundColor: C.surface, boxShadow: '0 6px 16px rgba(35, 40, 37, 0.055)' },
  groupPressable: { paddingHorizontal: 12, paddingTop: 11, paddingBottom: 10 },
  groupHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11 },
  groupAvatar: { flexShrink: 0, width: 48, height: 48, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#DDD8CF', backgroundColor: '#F3F1EC', alignItems: 'center', justifyContent: 'center' },
  groupAvatarText: { fontFamily: F.serifSemiBold, fontSize: 20, color: INK_SOFT },
  groupTitleWrap: { flex: 1, minWidth: 0 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  groupName: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 22, color: C.text },
  strengthChip: { flexShrink: 0, borderRadius: 999, borderWidth: 1, borderColor: '#D9D5CD', backgroundColor: 'rgba(255,255,255,0.5)', paddingHorizontal: 7, paddingVertical: 2.5 },
  strengthChipText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 0.8, color: INK_SOFT },
  groupCaption: { marginTop: 3.5, fontFamily: F.sans, fontSize: 12, lineHeight: 16, color: C.textSecondary },
  groupValueWrap: { alignItems: 'flex-end', gap: 4 },
  groupValue: { fontFamily: F.serifSemiBold, fontSize: 17.5, lineHeight: 21, color: C.text, fontVariant: ['tabular-nums'] },
  statusMark: { minHeight: 19, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 10, backgroundColor: 'rgba(84,77,66,0.08)', paddingHorizontal: 6.5, paddingVertical: 3.5 },
  statusMarkText: { fontFamily: F.sansBold, fontSize: 6.8, letterSpacing: 0.7, color: INK_SOFT },
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
  appAvatar: { width: 38, height: 38, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: '#E0DCD4', backgroundColor: '#F3F1EC', alignItems: 'center', justifyContent: 'center' },
  appAvatarText: { fontFamily: F.serifSemiBold, fontSize: 16, color: INK_SOFT },
  appMain: { flex: 1, minWidth: 0 },
  appTopRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  appName: { flex: 1, minWidth: 0, fontFamily: F.sansSemiBold, fontSize: 12.3, color: C.text },
  appValue: { fontFamily: F.sansSemiBold, fontSize: 11.5, color: C.textSecondary, fontVariant: ['tabular-nums'] },
  appValueOver: { color: boundaryTone('overLimit').accent },
  appMetaRow: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 7 },
  appBoundary: { flex: 1, minWidth: 0, fontFamily: F.sansMedium, fontSize: 9, color: C.textMuted },
  appState: { fontFamily: F.sansBold, fontSize: 6.7, letterSpacing: 0.5, color: INK_SOFT },
  appMeter: { marginTop: 7 },
  appSeparator: { height: StyleSheet.hairlineWidth, marginLeft: 49, backgroundColor: '#E7E3DA' },
  appsEmpty: { paddingHorizontal: 1, paddingTop: 3, paddingBottom: 11, fontFamily: F.sansMedium, fontSize: 10, lineHeight: 15, color: C.textMuted },
  inactiveList: { gap: 6 },
  inactiveCard: { position: 'relative', overflow: 'hidden', borderRadius: 21, borderCurve: 'continuous', backgroundColor: C.surface, boxShadow: '0 4px 13px rgba(35, 40, 37, 0.045)' },
  inactiveRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 11 },
  inactiveAvatar: { flexShrink: 0, width: 48, height: 48, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#DDD8CF', backgroundColor: '#F3F1EC', alignItems: 'center', justifyContent: 'center' },
  inactiveAvatarText: { fontFamily: F.serifSemiBold, fontSize: 16.5, color: INK_SOFT },
  inactiveCopy: { flex: 1, minWidth: 0 },
  inactiveTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  inactiveName: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 22, color: C.text },
  inactiveMetaRow: { marginTop: 3.5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  inactiveBoundary: { fontFamily: F.sans, fontSize: 11.5, color: C.textSecondary },
  inactiveMetaDot: { width: 2.5, height: 2.5, borderRadius: 2, backgroundColor: '#BDB6A9' },
  inactiveAppCount: { flexShrink: 1, fontFamily: F.sans, fontSize: 11.5, color: C.textSecondary },
  inactiveValueWrap: { alignItems: 'flex-end', gap: 3 },
  inactiveValue: { fontFamily: F.sansSemiBold, fontSize: 11.5, color: C.textSecondary, fontVariant: ['tabular-nums'] },
  inactiveStatePill: { minHeight: 15, borderRadius: 8, backgroundColor: 'rgba(84,77,66,0.065)', paddingHorizontal: 5.5, alignItems: 'center', justifyContent: 'center' },
  inactiveState: { fontFamily: F.sansBold, fontSize: 5.8, letterSpacing: 0.62, color: C.textMuted },
  inactiveChevron: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.64)', borderWidth: 1, borderColor: 'rgba(79,70,56,0.045)', alignItems: 'center', justifyContent: 'center' },
  inactiveChevronOpen: { backgroundColor: 'rgba(84,77,66,0.085)' },
  alwaysBlockedCard: { position: 'relative', overflow: 'hidden', minHeight: 78, borderRadius: 21, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 11, boxShadow: '0 6px 16px rgba(35, 40, 37, 0.055)' },
  alwaysBlockedSeal: { flexShrink: 0, width: 48, height: 48, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  alwaysBlockedCopy: { flex: 1, minWidth: 0 },
  alwaysBlockedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  alwaysBlockedTitle: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 22, color: C.text },
  alwaysBlockedSystemBadge: { flexShrink: 0, borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  alwaysBlockedSystemText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1.05, color: INK_SOFT },
  alwaysBlockedMeta: { marginTop: 4, fontFamily: F.sans, fontSize: 12, lineHeight: 16, color: C.textSecondary, fontVariant: ['tabular-nums'] },
  alwaysBlockedArrow: { flexShrink: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.74)', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
