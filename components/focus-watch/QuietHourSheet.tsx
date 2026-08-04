import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { Lock, X } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import DurationWheel from './DurationWheel';
import GoldButton from './GoldButton';
import { FocusCeremonialHead, FocusHeadMeta, FocusSheetHandle } from './FocusSheetHeader';
import NativeActivitySelectionButton from './NativeActivitySelectionButton';
import { AppChoiceCard, CHOICE_ROSE, type AppChoiceState } from './focus-app-choice';
import { useFocusRibbonPalette } from './focusBoundaryShell';
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
  useDayPlanSelector,
  type DayPlanState,
  type QuietHourSession,
  type WatchSelection,
} from './dayPlanStore';

/* ─────────────────────────────────────────────────────────────────────
 * QUIET HOUR — the fast way to shut the phone for a while.
 *
 * ⚠ IT IS THE FOCUS DOOR A READER MEETS FIRST — a gold button sits on the
 * Focus screen and opens it — AND IT WAS THE PLAINEST ROOM BEHIND ANY OF
 * THEM. The group sheet chooses apps on a lit ribbon card with a cut-in
 * icon seat; Essential Apps chooses them on sectioned lists with search;
 * this chose them on a flat fifty-point row with a 31pt square and a
 * tick, under a header three redesigns old, with no way to find an app
 * but to scroll past every other one.
 *
 * Nothing here is invented. Every piece is the Focus family's own:
 *
 *   THE HEAD is `FocusCeremonialHead` — the centred serif name, the ruled
 *   diamond, the close cut as a stud into the sheet's own curve — with
 *   the state line travelling inside the scroll as `FocusHeadMeta`,
 *   because a reading of the content belongs to the content.
 *
 *   THE PARTS are numbered the way the group sheet numbers its questions,
 *   so the sheet reads as a form with parts rather than as features
 *   dropped in a column.
 *
 *   THE APP CARDS are `AppChoiceCard`, which is the group sheet's own
 *   card lifted into a shared file so the choosing is ONE object rather
 *   than three drawings of it.
 *
 *   AND THE PLATE the wheel sits on is struck from the same ribbon
 *   palette as those cards, so the sheet is one material throughout.
 *
 * ⚠ GOLD IS THE ROOM AND ROSE IS THE RULE. Quiet Hour is a Focus tool and
 * the button that opens it is gold, so gold carries the room. Rose is
 * kept for the two things that are genuinely shut — the strictness of the
 * hour itself, and an app held closed by Always Blocked. Spending rose on
 * the whole sheet would have made a warning of a thing somebody chose.
 *
 * ⚠ AND THE APPLE PICKER PATH IS UNTOUCHED. Where Screen Time is
 * available iOS owns the choosing and the list below is never built; the
 * list is the fallback, not the feature.
 * ───────────────────────────────────────────────────────────────────── */

const MINUTES_STEP = 5;
const MIN_DURATION = 15;
const MAX_DURATION = 12 * 60;
const MIN_EXTENSION = 5;

/** How many apps it takes before a list wants a way to search it. */
const SEARCH_THRESHOLD = 8;

/**
 * The wheel's own ground — see the note where it is used.
 *
 * ⚠ A SIX-DIGIT HEX, NOT A TOKEN AND NOT AN `hsl()`. `DurationWheel`
 * fades its ends by appending "00" to whatever it is handed, which only
 * yields a colour if what it was handed was a 6-digit hex.
 */
const WHEEL_SURFACE = '#FFFDF6';

const selectQuietHourSheetState = (snapshot: DayPlanState) => snapshot;
const quietHourSheetStateEqual = (previous: DayPlanState, next: DayPlanState) => (
  previous.alwaysBlockedApps === next.alwaysBlockedApps
  && previous.designatedCoreAppIds === next.designatedCoreAppIds
);

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

/**
 * A part of the form, numbered.
 *
 * The group sheet's grammar: a seat holding the step, the part's name in
 * the serif at a size anybody reads, and a rule running the full width
 * UNDER it so each part visibly opens.
 */
function PartHead({
  step,
  label,
  note,
  accent,
  first = false,
}: {
  step: number;
  label: string;
  note?: string;
  accent: string;
  first?: boolean;
}) {
  return (
    <View style={[s.partHead, first && s.partHeadFirst]}>
      <View style={s.partHeadRow}>
        <View style={[s.stepSeat, { borderColor: withAlpha(accent, 0.34), backgroundColor: withAlpha(accent, 0.09) }]}>
          <Text style={[s.stepText, { color: accent }]} allowFontScaling={false}>{step}</Text>
        </View>
        <Text style={s.partHeadText} numberOfLines={2}>{label}</Text>
      </View>
      <View style={s.partHeadRule} />
      {!!note && <Text style={s.partNote}>{note}</Text>}
    </View>
  );
}

/**
 * Local, on the same precedent `FocusSheetHeader` sets a few files over:
 * six lines of colour arithmetic is not worth a dependency, and it keeps
 * this sheet free of an import from the group seal it has nothing else to
 * do with. It returns the input untouched for anything that is not a
 * 6-digit hex, so a token or an `hsl()` degrades rather than breaks.
 */
function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex;
  const value = Number.parseInt(normalized, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

type ChoiceApp = { id: string; name: string; state: AppChoiceState; note?: string };

export default function QuietHourSheet({
  visible,
  onClose,
  editingSession,
}: {
  visible: boolean;
  onClose: () => void;
  editingSession?: QuietHourSession | null;
}) {
  const state = useDayPlanSelector(selectQuietHourSheetState, quietHourSheetStateEqual);
  const nativeAvailable = isNativeFocusAvailable();
  const { alwaysBlockedApps } = state;
  const [minutes, setMinutes] = useState(60);
  const [selection, setSelection] = useState<WatchSelection>(() => quietHourDefaultSelection());
  const [nativePreparing, setNativePreparing] = useState(false);
  const [pickerRevision, setPickerRevision] = useState(0);
  const [query, setQuery] = useState('');
  const { request, gate } = usePermissionGate({ embedded: true });

  const accent = C.gold;
  const platePalette = useFocusRibbonPalette(accent);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
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
  const coreApps = useMemo<ChoiceApp[]>(
    () => Array.from(coreIds)
      .map(id => ({
        id,
        name: ESSENTIAL_APP_OPTIONS.find(app => app.id === id)?.name ?? id,
        state: 'locked' as const,
        note: 'Always open, for safety',
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [coreIds]
  );

  /**
   * ⚠ THREE LISTS, NOT ONE LIST WITH THREE LOOKS. Chosen apps gather at
   * the top so the answer is readable without hunting; everything else
   * sits under it; the shut ones come last because nothing can be done
   * about them here.
   */
  const chosenApps = useMemo<ChoiceApp[]>(
    () => ESSENTIAL_APP_OPTIONS
      .filter(app => !coreIds.has(app.id) && !alwaysBlockedIds.has(app.id) && selectedIds.has(app.id))
      .map(app => ({ id: app.id, name: app.name, state: 'chosen' as const }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [alwaysBlockedIds, coreIds, selectedIds]
  );

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const otherApps = useMemo<ChoiceApp[]>(
    () => ESSENTIAL_APP_OPTIONS
      .filter(app => !coreIds.has(app.id) && !alwaysBlockedIds.has(app.id) && !selectedIds.has(app.id))
      .filter(app => !normalizedQuery || app.name.toLocaleLowerCase().includes(normalizedQuery))
      .map(app => ({ id: app.id, name: app.name, state: 'open' as const }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [alwaysBlockedIds, coreIds, normalizedQuery, selectedIds]
  );

  const blockedApps = useMemo<ChoiceApp[]>(
    () => ESSENTIAL_APP_OPTIONS
      .filter(app => alwaysBlockedIds.has(app.id))
      .map(app => ({ id: app.id, name: app.name, state: 'blocked' as const, note: 'Always Blocked' }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [alwaysBlockedIds]
  );

  const searchable = otherApps.length + chosenApps.length >= SEARCH_THRESHOLD;
  const openCount = chosenApps.length + coreApps.length;

  const toggleApp = useCallback((appId: string) => {
    setSelection(current => ({
      categoryIds: [],
      groupIds: [],
      appIds: current.appIds.includes(appId)
        ? current.appIds.filter(id => id !== appId)
        : [...current.appIds, appId],
    }));
  }, []);

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

  const headMeta = editingSession
    ? `Holding until ${formatEndsAt(editingSession.endsAt)}`
    : `Strict · ${durationLabel(minutes)}`;

  return (
    <SmoothBottomSheet visible={visible} onClose={onClose} sheetStyle={s.sheet} keyboardAware>
      <FocusSheetHandle />
      <FocusCeremonialHead
        title={editingSession ? 'Extend Quiet Hour' : 'Quiet Hour'}
        accent={accent}
        onClose={onClose}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <FocusHeadMeta meta={headMeta} accent={accent} />

        <PartHead
          step={1}
          label={editingSession ? 'How much longer' : 'How long'}
          accent={accent}
          first
        />

        {/* ⚠ THE PLATE IS STRUCK FROM THE CARDS' OWN PALETTE, so the wheel
            is not sitting in a different material from everything under
            it. The value is the one number this part owns, and it is the
            only place the room's colour is spent at size. */}
        <View style={[s.plate, { borderColor: platePalette.border }]}>
          <LinearGradient
            colors={platePalette.gradient}
            locations={[0, 0.45, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
            locations={[0, 0.55]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View pointerEvents="none" style={s.plateLit} />

          <View style={s.plateHead}>
            <Text style={[s.plateLabel, { color: platePalette.value }]}>
              {editingSession ? 'ADD TIME' : 'DURATION'}
            </Text>
            <Text style={[s.plateValue, { color: platePalette.name }]} allowFontScaling={false}>
              {durationLabel(minutes)}
            </Text>
          </View>

          {durationOptions.length > 0 ? (
            /* ⚠ THE WHEEL SITS IN A WELL, AND THE WELL IS A FLAT HEX.
               `DurationWheel` fades its ends by appending "00" to the
               surface colour it is handed — `${surface}00` — which is an
               8-digit hex only if what it was given was a 6-digit one.
               Handing it the plate's `hsl()` inset would have built
               `hsl(43 60% 99%)00` and painted garbage at both ends.
               A well is the better answer anyway: the plate is a gradient,
               so no single fade colour could have matched it everywhere. */
            <View style={s.plateWell}>
              <DurationWheel
                options={durationOptions}
                value={minutes}
                onChange={setMinutes}
                surface={WHEEL_SURFACE}
              />
            </View>
          ) : (
            <Text style={s.plateEmpty}>
              This Quiet Hour has reached the twelve-hour maximum.
            </Text>
          )}
        </View>

        {/* The rule the hour is held by, stated once, in the colour of a
            thing that is shut. */}
        <View style={s.strictNote}>
          <View style={s.strictSeal}>
            <Lock s={12} c={CHOICE_ROSE} w={2.3} />
          </View>
          <Text style={s.strictNoteText}>
            {editingSession
              ? 'The app list is sealed for this Quiet Hour. Time can be added, never taken back.'
              : 'Quiet Hour is always strict. It cannot be ended early, and it lifts on its own.'}
          </Text>
        </View>

        {!editingSession && (
          <>
            <PartHead
              step={2}
              label="What stays open"
              note="This choice belongs to this Quiet Hour alone. Everything you do not keep open closes until it lifts."
              accent={accent}
            />

            {nativeAvailable ? (
              <NativeActivitySelectionButton
                key={`quiet-current-${pickerRevision}`}
                selectionId="quiet.current"
                title="Choose Quiet Hour Essentials"
                label="Choose this Quiet Hour's apps"
                prominent
              />
            ) : (
              <>
                <View style={s.tally}>
                  <Text style={[s.tallyCount, { color: platePalette.name }]} allowFontScaling={false}>
                    {openCount}
                  </Text>
                  <Text style={s.tallyWord}>
                    {openCount === 1 ? 'app stays open' : 'apps stay open'}
                  </Text>
                </View>

                {searchable && (
                  <View style={s.searchSurface}>
                    <TextInput
                      value={query}
                      onChangeText={setQuery}
                      placeholder="Search apps"
                      placeholderTextColor={C.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      style={s.searchInput}
                      accessibilityLabel="Search apps"
                    />
                    {query.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setQuery('')}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Clear search"
                      >
                        <X s={16} c={C.textMuted} w={2.2} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {chosenApps.length > 0 && (
                  <View style={s.group}>
                    <Text style={s.groupLabel}>YOUR CHOICE</Text>
                    {chosenApps.map(app => (
                      <AppChoiceCard
                        key={app.id}
                        id={app.id}
                        name={app.name}
                        state={app.state}
                        accent={accent}
                        onToggle={toggleApp}
                        entering={FadeInDown.duration(200)}
                      />
                    ))}
                  </View>
                )}

                {coreApps.length > 0 && (
                  <View style={s.group}>
                    <Text style={s.groupLabel}>ALWAYS OPEN</Text>
                    {coreApps.map(app => (
                      <AppChoiceCard
                        key={app.id}
                        id={app.id}
                        name={app.name}
                        state={app.state}
                        note={app.note}
                        accent={accent}
                      />
                    ))}
                  </View>
                )}

                <View style={s.group}>
                  <Text style={s.groupLabel}>EVERYTHING ELSE</Text>
                  {otherApps.length === 0 ? (
                    <Text style={s.emptyNote}>
                      {normalizedQuery
                        ? `Nothing matches “${query.trim()}”.`
                        : 'Every app is already accounted for.'}
                    </Text>
                  ) : (
                    otherApps.map(app => (
                      <AppChoiceCard
                        key={app.id}
                        id={app.id}
                        name={app.name}
                        state={app.state}
                        accent={accent}
                        onToggle={toggleApp}
                      />
                    ))
                  )}
                </View>

                {blockedApps.length > 0 && (
                  <View style={s.group}>
                    <Text style={s.groupLabel}>HELD SHUT ELSEWHERE</Text>
                    {blockedApps.map(app => (
                      <AppChoiceCard
                        key={app.id}
                        id={app.id}
                        name={app.name}
                        state={app.state}
                        note={app.note}
                        accent={accent}
                      />
                    ))}
                  </View>
                )}
              </>
            )}

            <Text style={s.systemAccessNote}>
              Quiet Hour controls shieldable apps. iOS keeps certain system tools
              available by design.
            </Text>
          </>
        )}

        <Animated.View entering={FadeIn.duration(220)} layout={LinearTransition.duration(200)}>
          <GoldButton
            label={nativePreparing
              ? 'Preparing Essentials...'
              : editingSession
                ? minutes > 0 ? 'Extend Quiet Hour' : '12-hour maximum reached'
                : 'Begin Quiet Hour'}
            onPress={begin}
            disabled={nativePreparing || (!!editingSession && minutes <= 0)}
            style={s.begin}
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
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 18,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  scrollContent: { paddingTop: 9, paddingBottom: 30 },

  // ── A part of the form ─────────────────────────────────────────────
  partHead: { marginTop: 22, marginBottom: 10, marginLeft: 2 },
  partHeadFirst: { marginTop: 14 },
  partHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepSeat: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontFamily: F.sansBold, fontSize: 11, lineHeight: 14 },
  partHeadText: {
    flex: 1,
    minWidth: 0,
    fontFamily: F.serifSemiBold,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.2,
    color: C.text,
  },
  partHeadRule: { marginTop: 9, height: 1, backgroundColor: C.border },
  partNote: {
    marginTop: 9,
    fontFamily: F.serif,
    fontSize: 15.5,
    lineHeight: 21,
    color: C.textSecondary,
  },

  // ── The duration plate ─────────────────────────────────────────────
  plate: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 14,
    gap: 12,
    shadowColor: '#5A4A22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 1,
  },
  plateLit: {
    position: 'absolute',
    left: 1,
    right: 1,
    top: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  plateHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  plateLabel: { fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2 },
  plateValue: {
    fontFamily: F.serifSemiBold,
    fontSize: 24,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  /** Cut into the plate, the way the app cards' icon seats are. */
  plateWell: {
    overflow: 'hidden',
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(154,127,58,0.20)',
    backgroundColor: WHEEL_SURFACE,
  },
  plateEmpty: {
    fontFamily: F.serifItalic,
    fontSize: 15,
    lineHeight: 21,
    color: C.textSecondary,
  },

  // ── The rule the hour is held by ───────────────────────────────────
  strictNote: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#F0D6DB',
    backgroundColor: '#FDF4F5',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  strictSeal: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8E7EA',
  },
  strictNoteText: {
    flex: 1,
    fontFamily: F.sansMedium,
    fontSize: 12,
    lineHeight: 17,
    color: '#8F3443',
  },

  // ── Choosing ───────────────────────────────────────────────────────
  tally: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginBottom: 4, marginLeft: 2 },
  tallyCount: {
    fontFamily: F.serifSemiBold,
    fontSize: 26,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  tallyWord: { fontFamily: F.serif, fontSize: 15.5, lineHeight: 21, color: C.textSecondary },
  searchSurface: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  searchInput: { flex: 1, fontFamily: F.sansMedium, fontSize: 16, color: C.text },
  group: { marginTop: 16 },
  groupLabel: {
    marginLeft: 2,
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.7,
    color: C.textMuted,
  },
  emptyNote: {
    marginTop: 10,
    marginLeft: 2,
    fontFamily: F.serifItalic,
    fontSize: 15,
    lineHeight: 21,
    color: C.textMuted,
  },
  systemAccessNote: {
    marginTop: 16,
    marginLeft: 2,
    fontFamily: F.sans,
    fontSize: 10.5,
    lineHeight: 15,
    color: C.textMuted,
  },
  begin: { marginTop: 22 },
});
