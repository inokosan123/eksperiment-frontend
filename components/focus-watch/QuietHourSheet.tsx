import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { Lock } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import DurationWheel from './DurationWheel';
import FocusCheck from './FocusCheck';
import GoldButton from './GoldButton';
import FocusSheetHeader from './FocusSheetHeader';
import NativeActivitySelectionButton from './NativeActivitySelectionButton';
import { ESSENTIAL_APP_OPTIONS } from './focusContent';
import { copyNativeActivitySelection, isNativeFocusAvailable } from './focusNativeBridge';
import { cacheNativeActivitySelectionSummary } from './nativeSelectionSummaryStore';
import { usePermissionGate } from './usePermissionGate';
import {
  allCoreEssentialIds,
  extendQuietHour,
  formatEndsAt,
  quietHourDefaultSelection,
  startQuietHour,
  useDayPlan,
  type QuietHourSession,
  type WatchSelection,
} from './dayPlanStore';

const MINUTES_STEP = 5;
const MIN_DURATION = 15;
const MAX_DURATION = 12 * 60;
const MIN_EXTENSION = 5;

function cloneSelection(selection: WatchSelection): WatchSelection {
  return {
    categoryIds: [],
    appIds: [...selection.appIds],
    groupIds: [],
  };
}

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `${hours}h ${rest}m`;
}

export default function QuietHourSheet({
  visible,
  onClose,
  editingSession,
}: {
  visible: boolean;
  onClose: () => void;
  editingSession?: QuietHourSession | null;
}) {
  const state = useDayPlan();
  const nativeAvailable = isNativeFocusAvailable();
  const { alwaysBlockedApps } = state;
  const [minutes, setMinutes] = useState(60);
  const [selection, setSelection] = useState<WatchSelection>(() => quietHourDefaultSelection());
  const [nativePreparing, setNativePreparing] = useState(false);
  const [pickerRevision, setPickerRevision] = useState(0);
  const { request, gate } = usePermissionGate({ embedded: true });

  useEffect(() => {
    if (!visible) return;
    if (editingSession) {
      setNativePreparing(false);
      const available = Math.max(0, Math.floor((editingSession.startedAt + MAX_DURATION * 60_000 - editingSession.endsAt) / 60_000));
      setMinutes(Math.min(15, available));
      setSelection(cloneSelection(editingSession.selection));
      return;
    }
    setMinutes(60);
    setSelection(cloneSelection(quietHourDefaultSelection()));
    if (nativeAvailable) {
      let current = true;
      setNativePreparing(true);
      void copyNativeActivitySelection('global.essentials', 'quiet.current')
        .then(summary => {
          if (!current) return;
          if (summary) cacheNativeActivitySelectionSummary(summary);
          setPickerRevision(value => value + 1);
        })
        .finally(() => {
          if (current) setNativePreparing(false);
        });
      return () => { current = false; };
    }
  }, [editingSession, nativeAvailable, visible]);

  const selectedIds = useMemo(() => new Set(selection.appIds), [selection.appIds]);
  const alwaysBlockedIds = useMemo(
    () => new Set(alwaysBlockedApps.map(entry => entry.appId)),
    [alwaysBlockedApps]
  );
  const coreIds = useMemo(() => new Set(allCoreEssentialIds(state)), [state]);
  const selectableApps = useMemo(
    () => ESSENTIAL_APP_OPTIONS.filter(app => !coreIds.has(app.id)),
    [coreIds]
  );
  const coreApps = useMemo(
    () => Array.from(coreIds).map(id => ESSENTIAL_APP_OPTIONS.find(app => app.id === id) ?? ({ id, name: id, group: 'Other apps' as const, core: true })),
    [coreIds]
  );

  const toggleApp = (appId: string) => {
    if (alwaysBlockedIds.has(appId)) return;
    setSelection(current => ({
      categoryIds: [],
      groupIds: [],
      appIds: current.appIds.includes(appId)
        ? current.appIds.filter(id => id !== appId)
        : [...current.appIds, appId],
    }));
  };

  // The whole duration range lives on one wheel: 15-minute steps for a new
  // Quiet Hour, 5-minute steps (up to the 12-hour ceiling) when extending.
  const durationOptions = useMemo(() => {
    if (!editingSession) {
      return Array.from(
        { length: (MAX_DURATION - MIN_DURATION) / 15 + 1 },
        (_, index) => MIN_DURATION + index * 15
      );
    }
    const max = Math.max(0, Math.floor((editingSession.startedAt + MAX_DURATION * 60_000 - editingSession.endsAt) / 60_000));
    if (max <= 0) return [];
    const options: number[] = [];
    for (let value = Math.min(MIN_EXTENSION, max); value <= max; value += MINUTES_STEP) options.push(value);
    if (options[options.length - 1] !== max) options.push(max);
    return options;
  }, [editingSession]);

  useEffect(() => {
    if (!visible || durationOptions.length === 0) return;
    if (!durationOptions.includes(minutes)) {
      const nearest = durationOptions.reduce(
        (best, option) => (Math.abs(option - minutes) < Math.abs(best - minutes) ? option : best),
        durationOptions[0]
      );
      setMinutes(nearest);
    }
  }, [visible, durationOptions, minutes]);

  const begin = () => {
    if (editingSession) {
      request(() => {
        if (minutes > 0) extendQuietHour(minutes);
        onClose();
      });
      return;
    }
    request(() => {
      startQuietHour({ minutes, selection });
      onClose();
    });
  };

  return (
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheet}>
      <FocusSheetHeader
        kicker="STRICT PROTECTION"
        title={editingSession ? 'Extend Quiet Hour' : 'Quiet Hour'}
        subtitle={editingSession
          ? 'The strict app snapshot is locked. You may only add more protected time.'
          : 'Choose the phone you need, then leave the rest outside.'}
        onClose={onClose}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.durationSurface}>
          <View style={s.durationHeader}>
            <Text style={s.sectionLabel}>{editingSession ? 'ADD TIME' : 'DURATION'}</Text>
            <Text style={s.durationValue}>{durationLabel(minutes)}</Text>
          </View>
          {durationOptions.length > 0 && (
            <DurationWheel
              options={durationOptions}
              value={minutes}
              onChange={setMinutes}
              surface="#FFF9EB"
            />
          )}
          <View style={s.strictNote}>
            <Lock s={13} c="#A24351" w={2.2} />
            <Text style={s.strictNoteText}>{editingSession
              ? `Currently ends at ${formatEndsAt(editingSession.endsAt)}. It cannot be shortened.`
              : 'Quiet Hour is always strict and ends automatically.'}</Text>
          </View>
        </View>

        {!editingSession && <><View style={s.sectionHeaderRow}>
          <View>
            <Text style={s.sectionLabel}>QUIET HOUR ESSENTIALS</Text>
            <Text style={s.sectionDescription}>This selection applies only to this Quiet Hour.</Text>
          </View>
          <Text style={s.selectedCount}>{nativeAvailable ? 'APPLE PICKER' : `${selection.appIds.length + coreApps.length} allowed`}</Text>
        </View>

        <NativeActivitySelectionButton
          key={`quiet-current-${pickerRevision}`}
          selectionId="quiet.current"
          title="Choose Quiet Hour Essentials"
          label="Choose this Quiet Hour's apps"
        />

        <View style={s.coreWrap}>
          {coreApps.map(app => (
            <View key={app.id} style={s.coreChip}>
              <Lock s={11} c={C.goldDark} w={2.2} />
              <Text style={s.coreChipText}>{app.name}</Text>
            </View>
          ))}
        </View>
        <Text style={s.systemAccessNote}>
          Quiet Hour controls shieldable apps. iOS may keep certain system tools available by design.
        </Text>

        {!nativeAvailable && <View style={s.appList}>
          {selectableApps.map((app, index) => {
            const selected = selectedIds.has(app.id);
            const blocked = alwaysBlockedIds.has(app.id);
            const showGroup = index === 0 || selectableApps[index - 1].group !== app.group;
            return (
              <Animated.View key={app.id} layout={LinearTransition.duration(180)}>
                {showGroup && <Text style={s.groupLabel}>{app.group.toUpperCase()}</Text>}
                <TouchableOpacity
                  style={[s.appRow, blocked && s.appRowDisabled]}
                  activeOpacity={0.72}
                  haptic="selection"
                  disabled={blocked}
                  onPress={() => toggleApp(app.id)}
                >
                  <View style={[s.appMonogram, selected && s.appMonogramOn]}>
                    <Text style={[s.appMonogramText, selected && s.appMonogramTextOn]}>
                      {app.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={s.appName} numberOfLines={1}>{app.name}</Text>
                  {blocked ? (
                    <View style={s.blockedTag}>
                      <Lock s={10} c="#A24351" w={2.2} />
                      <Text style={s.blockedTagText}>Always Blocked</Text>
                    </View>
                  ) : (
                    <FocusCheck checked={selected} />
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>}</>}

        <Animated.View entering={FadeIn.duration(220)}>
          <GoldButton
            label={nativePreparing ? 'Preparing Essentials...' : editingSession ? minutes > 0 ? 'Extend Quiet Hour' : '12-hour maximum reached' : 'Begin Quiet Hour'}
            onPress={begin}
            disabled={nativePreparing || (!!editingSession && minutes <= 0)}
            style={{ marginTop: 20 }}
          />
        </Animated.View>
      </ScrollView>

      {gate}
    </SmoothBottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E0DA',
    marginTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  eyebrow: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2.2,
    color: '#A24351',
  },
  title: {
    marginTop: 3,
    fontFamily: F.serifMedium,
    fontSize: 27,
    color: C.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0EFEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 5,
    fontFamily: F.serifItalic,
    fontSize: 15,
    lineHeight: 20,
    color: C.textSecondary,
  },
  scrollContent: {
    paddingTop: 18,
    paddingBottom: 22,
    gap: 18,
  },
  durationSurface: {
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E8DFC9',
    backgroundColor: '#FFF9EB',
    padding: 15,
    gap: 13,
  },
  durationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 2,
    color: C.textMuted,
  },
  durationValue: {
    fontFamily: F.serifMedium,
    fontSize: 22,
    color: C.goldDark,
    fontVariant: ['tabular-nums'],
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepper: {
    flex: 1,
    gap: 6,
  },
  stepperLabel: {
    textAlign: 'center',
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.4,
    color: C.textMuted,
  },
  stepperControls: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  stepperButton: {
    width: 40,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 36,
    textAlign: 'center',
    fontFamily: F.serifMedium,
    fontSize: 18,
    color: C.text,
    fontVariant: ['tabular-nums'],
  },
  strictNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  strictNoteText: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 11,
    lineHeight: 15,
    color: '#91404C',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionDescription: {
    marginTop: 4,
    fontFamily: F.sans,
    fontSize: 11.5,
    color: C.textSecondary,
  },
  selectedCount: {
    fontFamily: F.sansSemiBold,
    fontSize: 11,
    color: C.goldDark,
  },
  coreWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  coreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E8DFC9',
    backgroundColor: '#FFF9EB',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  coreChipText: {
    fontFamily: F.sansSemiBold,
    fontSize: 10.5,
    color: C.goldDark,
  },
  systemAccessNote: {
    fontFamily: F.sans,
    fontSize: 9.5,
    lineHeight: 14,
    color: C.textMuted,
  },
  appList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  groupLabel: {
    paddingTop: 15,
    paddingBottom: 5,
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.7,
    color: C.textMuted,
  },
  appRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  appRowDisabled: { opacity: 0.55 },
  appMonogram: {
    width: 31,
    height: 31,
    borderRadius: 9,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFEEE9',
  },
  appMonogramOn: {
    backgroundColor: C.goldLight,
  },
  appMonogramText: {
    fontFamily: F.sansBold,
    fontSize: 12,
    color: C.textMuted,
  },
  appMonogramTextOn: {
    color: C.goldDark,
  },
  appName: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 15.5,
    color: C.text,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CFCBC2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    borderColor: C.gold,
    backgroundColor: C.gold,
  },
  blockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: '#F8E7EA',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  blockedTagText: {
    fontFamily: F.sansSemiBold,
    fontSize: 8.5,
    color: '#A24351',
  },
});
