import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { CheckSmall, ChevronRight, Clock, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import GoldButton from './GoldButton';
import {
  copyNativeActivitySelection,
  isNativeFocusAvailable,
  nativeActivitySelectionsEqual,
} from './focusNativeBridge';
import {
  APP_CATEGORIES,
  formatMinutesShort,
  formatTimeOfDay,
  groupName,
  useDayPlan,
  type GroupRule,
  type PlanZone,
} from './dayPlanStore';

function sameApps(a: string[] = [], b: string[] = []) {
  return [...a].sort().join('|') === [...b].sort().join('|');
}

function compatibilityReason(
  currentGroupIds: string[],
  currentCatalog: Record<string, string[]>,
  sourceGroupIds: string[],
  sourceCatalog: Record<string, string[]>,
  labelFor: (groupId: string) => string
) {
  const onlySource = sourceGroupIds.find(id => !currentGroupIds.includes(id));
  if (onlySource) return `${labelFor(onlySource)} exists in the source plan but not this plan.`;
  const onlyCurrent = currentGroupIds.find(id => !sourceGroupIds.includes(id));
  if (onlyCurrent) return `${labelFor(onlyCurrent)} exists in this plan but not the source plan.`;
  const different = currentGroupIds.find(id => !sameApps(currentCatalog[id], sourceCatalog[id]));
  if (different) return `${labelFor(different)} contains different apps in the two plans.`;
  return null;
}

function cloneRules(rules: GroupRule[]) {
  return rules.map(rule => ({
    ...rule,
    appRules: (rule.appRules ?? []).map(appRule => ({ ...appRule })),
  }));
}

export default function SessionCopySheet({
  visible,
  currentPlanId,
  currentGroupIds,
  currentCatalog,
  onClose,
  onCopy,
}: {
  visible: boolean;
  currentPlanId: string;
  currentGroupIds: string[];
  currentCatalog: Record<string, string[]>;
  onClose: () => void;
  onCopy: (rules: GroupRule[]) => void;
}) {
  const state = useDayPlan();
  const nativeAvailable = isNativeFocusAvailable();
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    session: PlanZone;
    sourcePlanId: string;
    reason: string | null;
    checking: boolean;
  } | null>(null);
  const [copying, setCopying] = useState(false);
  const plans = useMemo(() => state.plans.filter(plan => plan.kind === 'session'), [state.plans]);

  const close = () => {
    setOpenPlanId(null);
    setSelected(null);
    setCopying(false);
    onClose();
  };

  const selectSession = async (
    sourcePlanId: string,
    session: PlanZone,
    structuralReason: string | null,
    groupIds: string[]
  ) => {
    if (structuralReason || !nativeAvailable) {
      setSelected({ session, sourcePlanId, reason: structuralReason, checking: false });
      return;
    }
    setSelected({ session, sourcePlanId, reason: null, checking: true });
    for (const groupId of groupIds) {
      const equal = await nativeActivitySelectionsEqual(
        `plan.${sourcePlanId}.group.${groupId}`,
        `plan.${currentPlanId}.group.${groupId}`
      );
      if (equal !== true) {
        setSelected({
          session,
          sourcePlanId,
          reason: equal === null
            ? 'The private iPhone app selections could not be compared. Try again in the Anasta development build.'
            : `${groupName(state, groupId)} contains different iPhone apps in the two plans.`,
          checking: false,
        });
        return;
      }
    }
    setSelected({ session, sourcePlanId, reason: null, checking: false });
  };

  const copySelectedRules = async () => {
    if (!selected || selected.reason || selected.checking || copying) return;
    setCopying(true);
    if (nativeAvailable) {
      for (const rule of selected.session.rules ?? []) {
        for (const appRule of rule.appRules ?? []) {
          const copied = await copyNativeActivitySelection(
            `plan.${selected.sourcePlanId}.group.${rule.groupId}.app.${appRule.appId}`,
            `plan.${currentPlanId}.group.${rule.groupId}.app.${appRule.appId}`
          );
          if (!copied || copied.applicationCount !== 1) {
            setSelected(current => current ? {
              ...current,
              checking: false,
              reason: `${appRule.label?.trim() || 'An individual app rule'} is not fully selected in the source plan.`,
            } : current);
            setCopying(false);
            return;
          }
        }
      }
    }
    onCopy(cloneRules(selected.session.rules ?? []));
    close();
  };

  return (
    <SmoothBottomSheet visible={visible} onClose={close} sheetStyle={s.sheet}>
      <View style={s.handle} />
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>REUSE PROTECTION RULES</Text>
          <Text style={s.title}>Copy existing Session</Text>
        </View>
        <TouchableOpacity style={s.closeBtn} onPress={close} hitSlop={10}><X s={17} c={C.textMuted} w={2.2} /></TouchableOpacity>
      </View>
      <Text style={s.subtitle}>Only rules are copied. This Session keeps its time and place in the day.</Text>

      <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
        {plans.length === 0 ? (
          <View style={s.empty}><Clock s={22} c={C.goldDark} w={1.9} /><Text style={s.emptyTitle}>No saved Session Plans yet.</Text></View>
        ) : plans.map(plan => {
          const open = openPlanId === plan.id;
          const sourceGroupIds = [...APP_CATEGORIES.map(group => group.id), ...plan.customGroupIds];
          const reason = compatibilityReason(
            currentGroupIds,
            currentCatalog,
            sourceGroupIds,
            plan.groupCatalog,
            groupId => groupName(state, groupId)
          );
          return (
            <View key={plan.id} style={s.planBlock}>
              <TouchableOpacity style={s.planRow} onPress={() => setOpenPlanId(open ? null : plan.id)}>
                <View style={s.planIcon}><Clock s={14} c={C.goldDark} w={2} /></View>
                <View style={{ flex: 1 }}><Text style={s.planName}>{plan.name}</Text><Text style={s.planMeta}>{plan.zones.length} Sessions · {reason ? 'catalog differs' : nativeAvailable ? 'verify private app groups' : 'compatible catalog'}</Text></View>
                <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}><ChevronRight s={16} c={C.textMuted} w={2} /></View>
              </TouchableOpacity>
              {open && (
                <View style={s.sessionsList}>
                  {plan.zones.map((session, index) => {
                    const finite = (session.rules ?? []).filter(rule => rule.dailyMinutes != null).length;
                    const blocked = (session.rules ?? []).filter(rule => rule.mode === 'blocked').length;
                    return (
                      <TouchableOpacity
                        key={session.id}
                        style={[s.sessionRow, reason && s.sessionRowIncompatible]}
                        onPress={() => { void selectSession(plan.id, session, reason, sourceGroupIds); }}
                      >
                        <View style={[s.sessionNumber, !reason && s.sessionNumberReady]}><Text style={s.sessionNumberText}>{index + 1}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.sessionName}>{session.name}</Text>
                          <Text style={s.sessionMeta}>{formatTimeOfDay(session.startMinutes)} - {formatTimeOfDay(session.endMinutes)} · {finite} limits · {blocked} blocked</Text>
                        </View>
                        {!reason && <CheckSmall s={13} c="#4E8C69" w={2.6} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {selected && (
        <View style={[s.preview, selected.reason && s.previewIncompatible]}>
          <Text style={s.previewKicker}>{selected.checking ? 'CHECKING IPHONE GROUPS' : selected.reason ? 'CANNOT COPY YET' : 'READY TO COPY'}</Text>
          <Text style={s.previewTitle}>{selected.session.name}</Text>
          {selected.checking ? (
            <Text style={s.previewReason}>Comparing the private app tokens in each group...</Text>
          ) : selected.reason ? (
            <Text style={s.previewReason}>{selected.reason}</Text>
          ) : (
            <View style={s.ruleSummary}>
              {(selected.session.rules ?? []).filter(rule => rule.mode !== 'noLimit').slice(0, 4).map(rule => (
                <View key={rule.groupId} style={s.ruleChip}>
                  <Text style={s.ruleChipText}>{groupName(state, rule.groupId)} {rule.mode === 'blocked' ? 'Blocked' : rule.dailyMinutes == null ? 'No limit' : formatMinutesShort(rule.dailyMinutes)}</Text>
                </View>
              ))}
            </View>
          )}
          <GoldButton
            label={copying ? 'Copying app rules...' : 'Copy rules'}
            disabled={selected.checking || !!selected.reason || copying}
            onPress={copySelectedRules}
          />
        </View>
      )}
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 24, maxHeight: '92%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E0DA', marginTop: 10 },
  headerRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.gold },
  title: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 25, color: C.text },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0EFEA', alignItems: 'center', justifyContent: 'center' },
  subtitle: { marginTop: 5, fontFamily: F.serifItalic, fontSize: 14, lineHeight: 19, color: C.textSecondary },
  list: { marginTop: 14, maxHeight: 420, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  empty: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontFamily: F.serifMedium, fontSize: 17, color: C.text },
  planBlock: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  planRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10 },
  planIcon: { width: 33, height: 33, borderRadius: 11, borderCurve: 'continuous', backgroundColor: C.goldLight, alignItems: 'center', justifyContent: 'center' },
  planName: { fontFamily: F.serifMedium, fontSize: 16, color: C.text },
  planMeta: { marginTop: 2, fontFamily: F.sans, fontSize: 9.5, color: C.textMuted },
  sessionsList: { marginLeft: 41, borderLeftWidth: 1, borderLeftColor: '#E5D9BD', paddingLeft: 10, paddingBottom: 8 },
  sessionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9 },
  sessionRowIncompatible: { opacity: 0.62 },
  sessionNumber: { width: 26, height: 26, borderRadius: 9, backgroundColor: '#F0EFEB', alignItems: 'center', justifyContent: 'center' },
  sessionNumberReady: { backgroundColor: '#E7F2EB' },
  sessionNumberText: { fontFamily: F.sansBold, fontSize: 9.5, color: C.textSecondary },
  sessionName: { fontFamily: F.serifMedium, fontSize: 15, color: C.text },
  sessionMeta: { marginTop: 2, fontFamily: F.sans, fontSize: 9, color: C.textMuted, fontVariant: ['tabular-nums'] },
  preview: { marginTop: 12, borderRadius: 17, borderCurve: 'continuous', borderWidth: 1, borderColor: '#CFE4D8', backgroundColor: '#F2F9F5', padding: 13, gap: 9 },
  previewIncompatible: { borderColor: '#E6D4AD', backgroundColor: '#FFF8E8' },
  previewKicker: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.6, color: C.goldDark },
  previewTitle: { fontFamily: F.serifMedium, fontSize: 19, color: C.text },
  previewReason: { fontFamily: F.sansMedium, fontSize: 10, lineHeight: 14, color: '#8D5C1E' },
  ruleSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  ruleChip: { borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.75)', paddingHorizontal: 9, paddingVertical: 5.5 },
  ruleChipText: { fontFamily: F.sansMedium, fontSize: 9.5, color: C.textSecondary },
});
