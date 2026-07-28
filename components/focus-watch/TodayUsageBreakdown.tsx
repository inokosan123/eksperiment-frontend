import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import {
  Activity,
  AlertTriangle,
  CheckSmall,
  ChevronDown,
  ChevronRight,
  Lock,
} from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { C, F } from '@/constants/tokens';
import { CATEGORY_TINTS, ESSENTIAL_APP_OPTIONS, PREVIEW_APPS } from './focusContent';
import AlwaysBlockedSheet from './AlwaysBlockedSheet';
import { FocusMeter } from './FocusMeter';
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
const BLOCKED_COLOR = '#A24351';
const BLOCKED_TINT = '#FBE9EC';

const GROUP_EMOJI: Record<string, string> = {
  social: 'mobile-phone',
  entertainment: 'movie-camera',
  games: 'joker',
  news: 'newspaper',
  shopping: 'money-bag',
  dating: 'red-heart',
};

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(169,134,63,${alpha})`;
  const value = Number.parseInt(normalized, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function GroupWeave({ color }: { color: string }) {
  const patternId = `today-group-weave-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id={patternId} width={30} height={30} patternUnits="userSpaceOnUse">
            <Path d="M 0 30 L 30 0" stroke={color} strokeOpacity={0.05} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </Svg>
    </View>
  );
}

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
  const alwaysBlockedIds = new Set(state.alwaysBlockedApps.map(entry => entry.appId));
  const groupIds = Array.from(new Set([
    ...Object.keys(plan.groupCatalog),
    ...rules.map(rule => rule.groupId),
    ...Object.keys(groupMinutes),
  ]));

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
  onToggle,
  row,
}: {
  expanded: boolean;
  onToggle: () => void;
  row: GroupAnalyticsRow;
}) {
  const tint = CATEGORY_TINTS[row.groupId] ?? { bg: C.goldLight, color: C.goldDark };
  const mode = modeFor(row.rule);
  const emoji = GROUP_EMOJI[row.groupId];
  const limit = row.rule.dailyMinutes;
  const state = usageBoundaryState(mode, limit, row.usedMinutes);
  const caption = boundaryDetail(
    state,
    limit,
    row.usedMinutes,
    `${row.apps.length} ${row.apps.length === 1 ? 'app' : 'apps'} in this group`
  );
  const over = state === 'over';
  const lit = mode !== 'noLimit';
  const accent = mode === 'blocked' ? BLOCKED_COLOR : tint.color;

  return (
    <Animated.View
      layout={LinearTransition.duration(190)}
      style={[
        s.groupCard,
        lit && { borderColor: withAlpha(accent, 0.34) },
      ]}
    >
      {lit && (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={mode === 'blocked'
              ? [BLOCKED_TINT, '#FFFAFB', '#FFFDFD']
              : [withAlpha(accent, 0.13), '#FFFDFA', '#FFFEFC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <GroupWeave color={accent} />
        </>
      )}
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
          <View style={[s.groupAvatar, { backgroundColor: tint.bg, borderColor: withAlpha(tint.color, 0.24) }]}>
            {mode === 'blocked'
              ? <Lock s={19} c={BLOCKED_COLOR} w={2.2} />
              : emoji
                ? <NotoEmoji name={emoji} size={26} />
                : <Text style={[s.groupAvatarText, { color: tint.color }]}>{row.name.slice(0, 1).toUpperCase()}</Text>}
          </View>
          <View style={s.groupTitleWrap}>
            <View style={s.groupTitleRow}>
              <Text style={s.groupName} numberOfLines={1}>{row.name}</Text>
              {mode !== 'noLimit' && (
                <View style={[
                  s.strengthChip,
                  row.rule.strength === 'strict' ? s.strengthChipStrict : s.strengthChipLoose,
                ]}>
                  <Text style={[
                    s.strengthChipText,
                    row.rule.strength === 'strict' ? s.strengthChipTextStrict : s.strengthChipTextLoose,
                  ]}>
                    {row.rule.strength === 'strict' ? 'STRICT' : 'LOOSE'}
                  </Text>
                </View>
              )}
            </View>
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
            fill={over ? OVER : accent}
            track="rgba(40,33,24,0.08)"
            height={6}
            live={row.activityState === 'active' && !over}
            style={s.groupMeter}
          />
        )}

        <View style={s.groupFooter}>
          <View style={[s.groupMiniDot, { backgroundColor: over ? OVER : accent }]} />
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
  const emoji = GROUP_EMOJI[row.groupId];
  const limit = row.rule.dailyMinutes;
  const pending = row.activityState === 'pending';
  const protectedGroup = mode === 'blocked';
  const lit = mode !== 'noLimit';
  const boundary = mode === 'blocked'
      ? 'Blocked'
    : mode === 'limit' && limit != null
      ? `${formatMinutesShort(limit)} limit`
      : 'No limit';
  const stateLabel = pending ? 'PENDING' : protectedGroup ? 'PROTECTED' : 'INACTIVE';
  const accent = protectedGroup ? BLOCKED_COLOR : tint.color;
  return (
    <Animated.View
      layout={LinearTransition.duration(190)}
      style={[
        s.inactiveCard,
        lit && { borderColor: withAlpha(accent, 0.34) },
      ]}
    >
      {lit && (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={protectedGroup
              ? [BLOCKED_TINT, '#FFFAFB', '#FFFDFD']
              : [withAlpha(accent, 0.13), '#FFFDFA', '#FFFEFC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <GroupWeave color={accent} />
        </>
      )}
      <TouchableOpacity
        style={s.inactiveRow}
        activeOpacity={0.78}
        onPress={onToggle}
        haptic="selection"
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${row.name}, ${pending ? 'usage pending' : protectedGroup ? 'protected with no use today' : 'not used today'}, ${boundary}`}
      >
        <View style={[s.inactiveAvatar, { backgroundColor: tint.bg, borderColor: withAlpha(tint.color, 0.2) }]}>
          {mode === 'blocked'
            ? <Lock s={18} c={BLOCKED_COLOR} w={2.1} />
            : emoji
              ? <NotoEmoji name={emoji} size={25} />
              : <Text style={[s.inactiveAvatarText, { color: tint.color }]}>{row.name.slice(0, 1).toUpperCase()}</Text>}
        </View>
        <View style={s.inactiveCopy}>
          <View style={s.inactiveTitleRow}>
            <Text style={s.inactiveName} numberOfLines={1}>{row.name}</Text>
            {lit && (
              <View style={[
                s.strengthChip,
                row.rule.strength === 'strict' ? s.strengthChipStrict : s.strengthChipLoose,
              ]}>
                <Text style={[
                  s.strengthChipText,
                  row.rule.strength === 'strict' ? s.strengthChipTextStrict : s.strengthChipTextLoose,
                ]}>
                  {row.rule.strength === 'strict' ? 'STRICT' : 'LOOSE'}
                </Text>
              </View>
            )}
          </View>
          <View style={s.inactiveMetaRow}>
            <Text style={s.inactiveBoundary} numberOfLines={1}>{boundary}</Text>
            <View style={s.inactiveMetaDot} />
            <Text style={s.inactiveAppCount} numberOfLines={1}>
              {row.apps.length} {row.apps.length === 1 ? 'app' : 'apps'}
            </Text>
          </View>
        </View>
        <View style={s.inactiveValueWrap}>
          <Text style={s.inactiveValue}>{row.usedMinutes == null ? '—' : formatMinutesShort(row.usedMinutes)}</Text>
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

function TodayAlwaysBlockedCard({
  onPress,
  row,
}: {
  onPress: () => void;
  row: GroupAnalyticsRow;
}) {
  const appLabel = `${row.apps.length} ${row.apps.length === 1 ? 'app' : 'apps'}`;
  const usageLabel = row.usedMinutes == null ? 'usage pending' : `${formatMinutesShort(row.usedMinutes)} today`;

  return (
    <TouchableOpacity
      style={s.alwaysBlockedCard}
      onPress={onPress}
      activeOpacity={0.8}
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={`Always Blocked, ${appLabel}, ${usageLabel}. Open Always Blocked settings.`}
    >
      <LinearGradient
        colors={['#FBEDF0', '#FEF8F9', '#FFFDFD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <GroupWeave color={BLOCKED_COLOR} />
      <View style={s.alwaysBlockedSeal}>
        <NotoEmoji name="shield" size={26} />
      </View>
      <View style={s.alwaysBlockedCopy}>
        <View style={s.alwaysBlockedTitleRow}>
          <Text style={s.alwaysBlockedTitle} numberOfLines={1}>Always Blocked</Text>
          <View style={s.alwaysBlockedSystemBadge}>
            <Text style={s.alwaysBlockedSystemText}>SYSTEM</Text>
          </View>
        </View>
        <Text style={s.alwaysBlockedMeta} numberOfLines={1}>{appLabel} · {usageLabel} · managed globally</Text>
      </View>
      <View style={s.alwaysBlockedArrow}>
        <ChevronRight s={17} c="#A65A69" w={2.2} />
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
  const rows = useMemo(() => buildRows({
    appMinutes,
    appUsageAvailable,
    groupMinutes,
    groupUsageAvailable,
    plan,
    rules,
    state,
  }), [appMinutes, appUsageAvailable, groupMinutes, groupUsageAvailable, plan, rules, state]);
  const alwaysBlockedRow = rows.find(row => row.groupId === ALWAYS_BLOCKED_GROUP_ID) ?? null;
  const regularRows = rows.filter(row => row.groupId !== ALWAYS_BLOCKED_GROUP_ID);
  const activeRows = regularRows.filter(row => row.activityState === 'active');
  const quietRows = regularRows.filter(row => row.activityState === 'quiet');
  const pendingRows = regularRows.filter(row => row.activityState === 'pending');
  const overviewRows = alwaysBlockedRow?.activityState === 'active'
    ? [...activeRows, alwaysBlockedRow]
    : activeRows;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [alwaysBlockedOpen, setAlwaysBlockedOpen] = useState(false);

  const totalTracked = overviewRows.reduce((sum, row) => sum + (row.usedMinutes ?? 0), 0);
  const overCount = activeRows.filter(row => {
    const mode = modeFor(row.rule);
    return usageBoundaryState(mode, row.rule.dailyMinutes, row.usedMinutes) === 'over';
  }).length;
  const onTrackCount = activeRows.filter(row => {
    const mode = modeFor(row.rule);
    return usageBoundaryState(mode, row.rule.dailyMinutes, row.usedMinutes) === 'within';
  }).length;

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
            <Text style={s.overviewKicker}>{scopeLabel.toUpperCase()} · USAGE MAP</Text>
            <Text style={s.overviewTitle}>Where your time went</Text>
          </View>
          <View style={s.overviewCount}>
            <Text style={s.overviewCountValue}>{groupUsageAvailable ? overviewRows.length : '—'}</Text>
            <Text style={s.overviewCountLabel}>ACTIVE</Text>
          </View>
        </View>
        <UsageShareRail rows={overviewRows} />
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
            {activeRows.map(row => (
              <GroupCard
                key={row.groupId}
                row={row}
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
  groupCard: { position: 'relative', overflow: 'hidden', borderRadius: 21, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, boxShadow: '0 6px 16px rgba(35, 40, 37, 0.055)' },
  groupPressable: { paddingHorizontal: 12, paddingTop: 11, paddingBottom: 10 },
  groupHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 11 },
  groupAvatar: { flexShrink: 0, width: 48, height: 48, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  groupAvatarText: { fontFamily: F.serifSemiBold, fontSize: 20 },
  groupTitleWrap: { flex: 1, minWidth: 0 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  groupName: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 22, color: C.text },
  strengthChip: { flexShrink: 0, borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2.5 },
  strengthChipStrict: { backgroundColor: '#F8E7EA', borderColor: '#E7C4CB' },
  strengthChipLoose: { backgroundColor: '#FFF6DF', borderColor: '#EAD7A8' },
  strengthChipText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 0.8 },
  strengthChipTextStrict: { color: BLOCKED_COLOR },
  strengthChipTextLoose: { color: '#95681F' },
  groupCaption: { marginTop: 3.5, fontFamily: F.sans, fontSize: 12, lineHeight: 16, color: C.textSecondary },
  groupCaptionOver: { color: OVER },
  groupValueWrap: { alignItems: 'flex-end', gap: 4 },
  groupValue: { fontFamily: F.serifSemiBold, fontSize: 17.5, lineHeight: 21, color: C.text, fontVariant: ['tabular-nums'] },
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
  inactiveCard: { position: 'relative', overflow: 'hidden', borderRadius: 21, borderCurve: 'continuous', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, boxShadow: '0 4px 13px rgba(35, 40, 37, 0.045)' },
  inactiveRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 11 },
  inactiveAvatar: { flexShrink: 0, width: 48, height: 48, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  inactiveAvatarText: { fontFamily: F.serifSemiBold, fontSize: 16.5 },
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
  inactiveStatePillProtected: { backgroundColor: WITHIN_BG },
  inactiveState: { fontFamily: F.sansBold, fontSize: 5.8, letterSpacing: 0.62, color: C.textMuted },
  inactiveStateProtected: { color: WITHIN },
  inactiveChevron: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.64)', borderWidth: 1, borderColor: 'rgba(79,70,56,0.045)', alignItems: 'center', justifyContent: 'center' },
  inactiveChevronOpen: { backgroundColor: 'rgba(84,77,66,0.085)' },
  alwaysBlockedCard: { position: 'relative', overflow: 'hidden', minHeight: 78, borderRadius: 21, borderCurve: 'continuous', borderWidth: 1, borderColor: '#F0D3D9', paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 11, boxShadow: '0 6px 16px rgba(104, 40, 55, 0.065)' },
  alwaysBlockedSeal: { flexShrink: 0, width: 48, height: 48, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: '#F0D3D9', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  alwaysBlockedCopy: { flex: 1, minWidth: 0 },
  alwaysBlockedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  alwaysBlockedTitle: { flexShrink: 1, fontFamily: F.serifSemiBold, fontSize: 18, lineHeight: 22, color: '#6A2637' },
  alwaysBlockedSystemBadge: { flexShrink: 0, borderRadius: 999, borderWidth: 1, borderColor: '#E7C4CB', backgroundColor: '#FFF7F8', paddingHorizontal: 7, paddingVertical: 3 },
  alwaysBlockedSystemText: { fontFamily: F.sansBold, fontSize: 7.5, letterSpacing: 1.05, color: BLOCKED_COLOR },
  alwaysBlockedMeta: { marginTop: 4, fontFamily: F.sans, fontSize: 12, lineHeight: 16, color: '#8E5863', fontVariant: ['tabular-nums'] },
  alwaysBlockedArrow: { flexShrink: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.74)', borderWidth: 1, borderColor: '#F0D3D9', alignItems: 'center', justifyContent: 'center' },
});
