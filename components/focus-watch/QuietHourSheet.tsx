import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { ChevronRight, Lock, X } from '@/components/icons/Icons';
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
  // ⚠ The standing Essentials are read live now — the plate names them and
  // they go into the hour whether or not this sheet was open when they
  // changed — so a snapshot that ignored them would show a stale set.
  && previous.optionalEssentialAppIds === next.optionalEssentialAppIds
);

/** The shipped name for an app id, or the id itself if it has none. */
function appName(appId: string) {
  return ESSENTIAL_APP_OPTIONS.find(app => app.id === appId)?.name ?? appId;
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

/**
 * The faces of the standing set, overlapped.
 *
 * ⚠ FOUR AT MOST, AND THE REST COUNTED. A row that grows with the list
 * would push the copy beside it off the card the moment somebody kept
 * eight apps; four seats and a tally is the same information at a fixed
 * width. The seat is the app cards' own, at three quarters.
 */
const SEAT_STACK_MAX = 4;

function SeatStack({ apps }: { apps: ChoiceApp[] }) {
  const shown = apps.slice(0, SEAT_STACK_MAX);
  const rest = apps.length - shown.length;
  return (
    <View style={s.stack} pointerEvents="none">
      {shown.map((app, index) => (
        <View
          key={app.id}
          style={[s.stackSeat, index > 0 && s.stackSeatOver, { zIndex: SEAT_STACK_MAX - index }]}
        >
          <Text style={s.stackSeatText} allowFontScaling={false}>
            {app.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      ))}
      {rest > 0 && (
        <View style={[s.stackSeat, s.stackSeatOver, s.stackRest]}>
          <Text style={s.stackRestText} allowFontScaling={false}>+{rest}</Text>
        </View>
      )}
    </View>
  );
}

/** The one disclosure mark on the sheet: a chevron that turns a quarter. */
function Disclosure({ open }: { open: boolean }) {
  return (
    <View style={[s.disclosure, open && s.disclosureOpen]}>
      <ChevronRight s={15} c={C.textMuted} w={2.2} />
    </View>
  );
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
  const state = useDayPlanSelector(selectQuietHourSheetState, quietHourSheetStateEqual);
  const nativeAvailable = isNativeFocusAvailable();
  const { alwaysBlockedApps } = state;
  const [minutes, setMinutes] = useState(60);
  /**
   * ⚠ WHAT THIS SHEET OWNS IS THE EXTRAS, NOT THE WHOLE SELECTION.
   *
   * The standing Essentials are a rule made elsewhere and they are read
   * live from the store; this hour's own additions are the only thing
   * chosen here. Holding one list instead of two is what lets the sheet
   * say plainly that Essentials are always open — there is no state in
   * which one of them could have been switched off in passing.
   */
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [nativePreparing, setNativePreparing] = useState(false);
  const [pickerRevision, setPickerRevision] = useState(0);
  const [query, setQuery] = useState('');
  const [essentialsOpen, setEssentialsOpen] = useState(false);
  const { request, gate } = usePermissionGate({ embedded: true });

  const accent = C.gold;
  const platePalette = useFocusRibbonPalette(accent);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setEssentialsOpen(false);
    if (editingSession) {
      setNativePreparing(false);
      const available = Math.max(0, Math.floor((editingSession.startedAt + MAX_DURATION * 60_000 - editingSession.endsAt) / 60_000));
      setMinutes(Math.min(15, available));
      return;
    }
    setMinutes(60);
    setExtraIds([]);
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

  const alwaysBlockedIds = useMemo(
    () => new Set(alwaysBlockedApps.map(entry => entry.appId)),
    [alwaysBlockedApps]
  );
  const coreIds = useMemo(() => new Set(allCoreEssentialIds(state)), [state]);

  /**
   * THE STANDING SET — everything that is open before this sheet asks a
   * single question.
   *
   * ⚠ THE CORE AND THE ESSENTIALS ARE TWO DIFFERENT PROMISES and the card
   * says so: the core is kept open FOR SAFETY and nobody chooses it, while
   * the Essentials are the reader's own standing list, set once in Focus
   * and honoured by every Quiet Hour. Both are always open; only one of
   * them is anybody's decision.
   *
   * ⚠ THE BLOCKED ARE FILTERED AGAIN HERE even though `saveOptionalEssentialApps`
   * already refuses to store one: an app can be added to Always Blocked
   * AFTER it was made an Essential, and the standing list is not rewritten
   * when that happens. A card promising an app stays open while another
   * rule holds it shut is the one thing this plate must never do.
   */
  const essentialIds = useMemo(
    () => state.optionalEssentialAppIds
      .filter(id => !coreIds.has(id) && !alwaysBlockedIds.has(id)),
    [alwaysBlockedIds, coreIds, state.optionalEssentialAppIds]
  );

  const coreApps = useMemo<ChoiceApp[]>(
    () => Array.from(coreIds)
      .map(id => ({
        id,
        name: appName(id),
        state: 'locked' as const,
        note: 'Kept open for safety',
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [coreIds]
  );

  const essentialApps = useMemo<ChoiceApp[]>(
    () => essentialIds
      .map(id => ({
        id,
        name: appName(id),
        state: 'locked' as const,
        note: 'One of your Essentials',
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [essentialIds]
  );

  const alwaysOpenApps = useMemo(
    () => [...coreApps, ...essentialApps],
    [coreApps, essentialApps]
  );

  const extraSet = useMemo(() => new Set(extraIds), [extraIds]);

  /**
   * ⚠ TWO LISTS, NOT ONE WITH TWO LOOKS. What has been added for this hour
   * gathers at the top so the answer is readable without hunting; the rest
   * sits under it; the shut ones come last, because nothing can be done
   * about them here.
   */
  const addedApps = useMemo<ChoiceApp[]>(
    () => ESSENTIAL_APP_OPTIONS
      .filter(app => !coreIds.has(app.id) && !essentialIds.includes(app.id)
        && !alwaysBlockedIds.has(app.id) && extraSet.has(app.id))
      .map(app => ({ id: app.id, name: app.name, state: 'chosen' as const }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [alwaysBlockedIds, coreIds, essentialIds, extraSet]
  );

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const otherApps = useMemo<ChoiceApp[]>(
    () => ESSENTIAL_APP_OPTIONS
      .filter(app => !coreIds.has(app.id) && !essentialIds.includes(app.id)
        && !alwaysBlockedIds.has(app.id) && !extraSet.has(app.id))
      .filter(app => !normalizedQuery || app.name.toLocaleLowerCase().includes(normalizedQuery))
      .map(app => ({ id: app.id, name: app.name, state: 'open' as const }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [alwaysBlockedIds, coreIds, essentialIds, extraSet, normalizedQuery]
  );

  const blockedApps = useMemo<ChoiceApp[]>(
    () => ESSENTIAL_APP_OPTIONS
      .filter(app => alwaysBlockedIds.has(app.id))
      .map(app => ({ id: app.id, name: app.name, state: 'blocked' as const, note: 'Always Blocked' }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [alwaysBlockedIds]
  );

  const searchable = otherApps.length + addedApps.length >= SEARCH_THRESHOLD;

  const toggleApp = useCallback((appId: string) => {
    setExtraIds(current => (current.includes(appId)
      ? current.filter(id => id !== appId)
      : [...current, appId]));
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
      // The standing Essentials plus whatever this hour added — assembled
      // here rather than held in state, so the two can never disagree.
      const selection: WatchSelection = {
        categoryIds: [],
        groupIds: [],
        appIds: Array.from(new Set([...essentialIds, ...extraIds])),
      };
      startQuietHour({ minutes, selection });
      onClose();
    });
  };

  /**
   * What the standing set actually is, in words — because a row of
   * initials is a picture of the answer, not the answer.
   */
  const essentialsLine = useMemo(() => {
    const names = alwaysOpenApps.map(app => app.name);
    if (names.length === 0) return 'Nothing is held open yet.';
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
  }, [alwaysOpenApps]);

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
              accent={accent}
            />

            {/* ── THE STANDING SET ──────────────────────────────────
                ⚠ IT IS STATED BEFORE ANYTHING IS ASKED, because it is
                already true. Quiet Hour begins from the Essentials the
                reader has already set in Focus, and the old sheet buried
                that: the core apps were four small chips and the
                Essentials were pre-ticked rows in the same list as
                everything else, indistinguishable from a choice made
                here and quietly un-tickable by accident.

                So it is one plate that says what it is, carries the
                faces, and opens to name them. Not a control — nothing
                inside it can be switched off from this sheet, which is
                the whole point of calling it always open. */}
            <TouchableOpacity
              style={s.standing}
              onPress={() => setEssentialsOpen(open => !open)}
              activeOpacity={0.82}
              haptic="selection"
              accessibilityRole="button"
              accessibilityState={{ expanded: essentialsOpen }}
              accessibilityLabel={`Always open: ${alwaysOpenApps.length} apps`}
              accessibilityHint={essentialsOpen
                ? 'Double tap to hide the list.'
                : 'Double tap to see which apps stay open.'}
            >
              <View style={s.standingRow}>
                <SeatStack apps={alwaysOpenApps} />
                <View style={s.standingCopy}>
                  <Text style={s.standingTitle}>Always open</Text>
                  <Text style={s.standingNote} numberOfLines={2}>
                    {essentialsLine}
                  </Text>
                </View>
                <Disclosure open={essentialsOpen} />
              </View>

              {essentialsOpen && (
                <Animated.View entering={FadeIn.duration(160)} style={s.standingList}>
                  {alwaysOpenApps.map(app => (
                    <AppChoiceCard
                      key={app.id}
                      id={app.id}
                      name={app.name}
                      state={app.state}
                      note={app.note}
                      accent={accent}
                    />
                  ))}
                  <Text style={s.standingFoot}>
                    Your Essentials are set once in Focus, under Essential Apps.
                    Every Quiet Hour honours them.
                  </Text>
                </Animated.View>
              )}
            </TouchableOpacity>

            {nativeAvailable ? (
              <>
                <Text style={s.addLead}>Add anything else, for this hour only.</Text>
                <NativeActivitySelectionButton
                  key={`quiet-current-${pickerRevision}`}
                  selectionId="quiet.current"
                  title="Choose Quiet Hour Essentials"
                  label="Choose this Quiet Hour's apps"
                  prominent
                />
              </>
            ) : (
              <>
                <Text style={s.addLead}>Add anything else, for this hour only.</Text>

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

                {addedApps.length > 0 && (
                  <View style={s.group}>
                    <Text style={s.groupLabel}>ADDED FOR THIS HOUR</Text>
                    {addedApps.map(app => (
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

                <View style={s.group}>
                  {addedApps.length > 0 && <Text style={s.groupLabel}>EVERYTHING ELSE</Text>}
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

  // ── The standing set ───────────────────────────────────────────────
  standing: {
    marginTop: 2,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#EAE6DC',
    backgroundColor: '#FCFBF7',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  standingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  standingCopy: { flex: 1, minWidth: 0 },
  standingTitle: {
    fontFamily: F.serifSemiBold,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.15,
    color: C.text,
  },
  standingNote: {
    marginTop: 2,
    fontFamily: F.sansMedium,
    fontSize: 11.5,
    lineHeight: 15.5,
    color: C.textSecondary,
  },
  standingList: { marginTop: 4 },
  standingFoot: {
    marginTop: 12,
    fontFamily: F.serifItalic,
    fontSize: 14,
    lineHeight: 19,
    color: C.textMuted,
  },

  /** The overlapped faces — see SeatStack. */
  stack: { flexDirection: 'row', alignItems: 'center' },
  stackSeat: {
    width: 29,
    height: 29,
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#E6E2D9',
    backgroundColor: '#F3F1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ⚠ A ring of the card's own ground, so overlapping seats stay separate
  // objects rather than merging into one grey shape.
  stackSeatOver: { marginLeft: -9, borderColor: '#FCFBF7', borderWidth: 1.5 },
  stackSeatText: { fontFamily: F.serifSemiBold, fontSize: 13, lineHeight: 17, color: '#9A9186' },
  stackRest: { backgroundColor: '#EFECE4' },
  stackRestText: { fontFamily: F.sansBold, fontSize: 10, lineHeight: 14, color: '#8A8178' },

  disclosure: { width: 22, alignItems: 'center', justifyContent: 'center' },
  disclosureOpen: { transform: [{ rotate: '90deg' }] },

  addLead: {
    marginTop: 20,
    marginLeft: 2,
    fontFamily: F.serif,
    fontSize: 16,
    lineHeight: 22,
    color: C.textSecondary,
  },

  // ── Choosing ───────────────────────────────────────────────────────
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
