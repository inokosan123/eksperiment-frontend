import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line as SvgLine, Path } from 'react-native-svg';
import {
  continuousPhase,
  halfSinePulse,
  useContinuousAnimationClock,
} from '@/components/shared/use-continuous-animation-clock';
import {
  estimateRibbonHeight,
  placeRibbonStars,
  ribbonCardRhythm,
  ribbonEmblem,
  type PlacedStar,
} from '@/components/shared/ribbonCardGeometry';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Book,
  CheckSmall,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { deep, lit, toHsl } from '@/components/shared/tone';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import ConfirmModal from '@/components/shared/ConfirmModal';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { normalizeScriptureLanguage, type BibleBook } from '@/constants/scripture';
import { useAppSettings } from '@/components/settings/SettingsContext';
import { ReadableText } from '@/components/shared/typographyScale';
import { BibleVerse, useScripture } from '@/components/scripture/ScriptureContext';
import ScriptureReaderView from '@/components/scripture/ScriptureReaderView';
import { UNIVERSAL_SCRIPTURE_CHECKPOINT_KINDS } from '@/components/scripture/scripture-task-model';
import {
  createScriptureCheckpoint,
  deleteScriptureCheckpoint,
  getBooksForCheckpointKind,
  getScriptureCheckpointReaderSession,
  getScriptureCheckpointTitle,
  listScriptureCheckpoints,
  moveScriptureCheckpointHistory,
  restoreScriptureCheckpointLatest,
  type ScriptureCheckpoint,
  type ScriptureCheckpointHistoryDirection,
  type ScriptureCheckpointKind,
  type ScriptureCheckpointProgressResult,
  type ScriptureCheckpointReaderSession,
} from '@/components/scripture/scriptureCheckpointDb';

/* -------------------------------------------------------------
 * WHAT THE HEAD OF THIS SCREEN SAYS.
 *
 * ⚠ IT IS WRITTEN FOR SOMEONE READING ENGLISH AS THEIR SECOND OR THIRD
 * LANGUAGE, which is most of the people who will open it. That rules out
 * more than it sounds like it does.
 *
 * IT SAID: "Continue where you stopped. Choose a checkpoint, read the
 * assigned passage, then finish it to move the marker forward."
 *
 * Three things wrong with that, and all three are the same thing --
 * words that describe instead of tell:
 *
 *   · "checkpoint" is the app's word for the thing, not the reader's.
 *     The reader is looking at a list of BOOKS they are part-way
 *     through. Call it what it is.
 *   · "the assigned passage" assigns nothing you can see. How much? By
 *     whom? The screen already answers this on each card -- "3 chapters
 *     planned" -- so the head does not need to gesture at it.
 *   · "move the marker forward" is a metaphor asked to carry the
 *     mechanic. Say the mechanic: the next time, it opens further on.
 *
 * THEN IT SAID: "Your place is kept." / "Open a book, read, then press
 * Finish. It reopens where you stopped."
 *
 * Better, and still not right. Two faults, and the second one is worse:
 *
 *   · IT NEVER SAID WHAT THE SCREEN IS. "Your place is kept" is a
 *     promise with no subject — kept where, in what? A head that opens
 *     a screen has one job before any other: say what the screen is
 *     for. Someone landing here is looking at three groups of cards and
 *     has to infer the whole idea from a bookmark metaphor.
 *   · "OPEN A BOOK" NAMED A BUTTON THAT DOES NOT EXIST. There is no
 *     Open here; there is START READING. Copy that instructs with a
 *     verb the screen does not have is worse than vague, it is wrong,
 *     and it went stale the moment the card was rebuilt.
 *
 * WHAT IT SAYS NOW leads with the purpose and then the mechanic, and
 * every noun in it is either a group heading on this screen or a button
 * the reader will actually press:
 *
 *   "Read Scripture in order"
 *   "A path goes through the New Testament, the Old Testament, or the
 *    Psalter. It opens where you stopped."
 *
 * "Path" is the screen's own word for these cards — the group headings
 * say CHECKPOINT PATH — so the eyebrow says READING PATHS rather than
 * CHECKPOINT READING, which was the app talking to itself.
 *
 * ⚠ BOTH TESTAMENTS ARE NAMED IN FULL. "the New Testament, the Old, or
 * the Psalter" is shorter and reads fine in English; it is exactly the
 * kind of elision that costs a second-language reader a beat, and this
 * head is written for them. The group headings above the cards say both
 * names in full, so the sentence matches what is on the screen anyway.
 *
 * ⚠ WHAT WAS CUT, AND WHY. A draft ended "…Press Start Reading and it
 * opens where you stopped." Naming the button is tempting and it is the
 * wrong call twice over: START READING is set in caps on every card
 * below, so the head would be explaining a thing already in front of
 * you — and the extra clause pushed the body to four lines on every
 * plate width instead of three on most of them.
 * ------------------------------------------------------------- */
const HERO_EYEBROW = 'READING PATHS';
const HERO_TITLE = 'Read Scripture in order';
const HERO_BODY = 'A path goes through the New Testament, the Old Testament, or the Psalter. It opens where you stopped.';

const BG = '#FCFCFC';
const GOLD = '#C5A059';
const INK = '#1C1917';

type Props = {
  title?: string;
  plannedCount?: number;
  taskInstanceId?: string;
  showFinishLoader?: boolean;
  onBack: () => void;
  onComplete: (
    checkpointId: string,
    kind: ScriptureCheckpointKind,
    readUnits: number,
  ) => Promise<ScriptureCheckpointProgressResult | null | false> | ScriptureCheckpointProgressResult | null | false;
};

export default function ScriptureCheckpointReaderView({
  title,
  plannedCount = 1,
  taskInstanceId,
  showFinishLoader = false,
  onBack,
  onComplete,
}: Props) {
  const insets = useSafeAreaInsets();
  const { ready, getChapter } = useScripture();
  const { settings } = useAppSettings();
  const scriptureLanguage = normalizeScriptureLanguage(settings.bibleLang);
  const availableKinds = useMemo<ScriptureCheckpointKind[]>(
    () => [...UNIVERSAL_SCRIPTURE_CHECKPOINT_KINDS],
    [],
  );
  const plannedUnitCount = useMemo(() => {
    if (!Number.isFinite(plannedCount) || plannedCount <= 0) return 1;
    return Math.round(plannedCount);
  }, [plannedCount]);
  const showKindHeaders = availableKinds.length > 1;
  const [checkpoints, setCheckpoints] = useState<ScriptureCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ScriptureCheckpointReaderSession | null>(null);
  const [cursor, setCursor] = useState(0);
  const [readLimit, setReadLimit] = useState(plannedUnitCount);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [chapterLoading, setChapterLoading] = useState(false);
  const chapterNavLockedRef = useRef(false);
  const [chapterNavLocked, setChapterNavLocked] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false);
  const [creatingKind, setCreatingKind] = useState<ScriptureCheckpointKind | null>(null);
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [checkpointActionError, setCheckpointActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScriptureCheckpoint | null>(null);

  const lockChapterNavigation = useCallback(() => {
    chapterNavLockedRef.current = true;
    setChapterNavLocked(true);
  }, []);

  const releaseChapterNavigation = useCallback(() => {
    chapterNavLockedRef.current = false;
    setChapterNavLocked(false);
  }, []);

  const sortCheckpoints = useCallback((items: ScriptureCheckpoint[]) => {
    const kindOrder = new Map(availableKinds.map((kind, index) => [kind, index]));
    return [...items].sort((left, right) => {
      const byKind = (kindOrder.get(left.kind) ?? 0) - (kindOrder.get(right.kind) ?? 0);
      if (byKind !== 0) return byKind;
      const byUpdated = right.updatedAt - left.updatedAt;
      if (byUpdated !== 0) return byUpdated;
      return right.createdAt - left.createdAt;
    });
  }, [availableKinds]);

  const upsertCheckpoint = useCallback((checkpoint: ScriptureCheckpoint) => {
    setCheckpoints(prev => sortCheckpoints([
      ...prev.filter(item => item.id !== checkpoint.id),
      checkpoint,
    ]));
  }, [sortCheckpoints]);

  const loadCheckpoints = useCallback(async (showFullLoading = false) => {
    if (showFullLoading) setLoading(true);
    try {
      if (showFullLoading) {
        await restoreScriptureCheckpointLatest(availableKinds);
      }
      const next = await listScriptureCheckpoints(availableKinds);
      setCheckpoints(sortCheckpoints(next));
    } catch (error) {
      console.warn('Failed to load scripture checkpoints', error);
      if (showFullLoading) setCheckpoints([]);
    } finally {
      if (showFullLoading) setLoading(false);
    }
  }, [availableKinds, sortCheckpoints]);

  useEffect(() => {
    void loadCheckpoints(true);
  }, [loadCheckpoints]);

  useEffect(() => {
    if (createSheetVisible || !creatingKind) return undefined;
    const timeout = setTimeout(() => setCreatingKind(null), 220);
    return () => clearTimeout(timeout);
  }, [createSheetVisible, creatingKind]);

  useEffect(() => {
    if (session) return;
    setReadLimit(plannedUnitCount);
  }, [plannedUnitCount, session]);

  const visibleUnits = useMemo(() => {
    if (!session) return [];
    return session.units.slice(session.startUnitIndex, session.startUnitIndex + readLimit);
  }, [readLimit, session]);
  const currentUnit = visibleUnits[cursor];
  const canGoPrev = cursor > 0;
  const canReadMore = !!session && session.startUnitIndex + readLimit < session.units.length;
  const atVisibleEnd = visibleUnits.length > 0 && cursor >= visibleUnits.length - 1;
  const currentReadUnits = visibleUnits.length > 0 ? cursor + 1 : 0;
  const nextButtonLabel = currentUnit?.noun === 'psalm' ? 'NEXT PSALM' : 'NEXT CHAPTER';
  const chapterControlsDisabled = chapterLoading || chapterNavLocked;

  useEffect(() => {
    if (!ready || !currentUnit) return;
    let active = true;
    setChapterLoading(true);
    setChapterError(null);
    getChapter(currentUnit.bookId, currentUnit.chapter, scriptureLanguage)
      .then(nextVerses => {
        if (!active) return;
        setVerses(nextVerses);
        if (nextVerses.length === 0) setChapterError('This passage could not be loaded.');
      })
      .catch(error => {
        console.warn('Failed to load scripture checkpoint chapter', error);
        if (!active) return;
        setVerses([]);
        setChapterError('This passage could not be loaded.');
      })
      .finally(() => {
        if (!active) return;
        setChapterLoading(false);
        releaseChapterNavigation();
      });

    return () => {
      active = false;
    };
  }, [currentUnit, getChapter, ready, releaseChapterNavigation, scriptureLanguage]);

  const startReading = useCallback(async (checkpointId: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setChapterLoading(true);
    const next = await getScriptureCheckpointReaderSession(checkpointId, plannedUnitCount);
    if (!next) {
      setChapterLoading(false);
      releaseChapterNavigation();
      return;
    }
    setSession(next);
    setReadLimit(next.plannedUnits.length || plannedUnitCount);
    setCursor(0);
    setCreatingKind(null);
  }, [plannedUnitCount, releaseChapterNavigation]);

  const goPrev = useCallback(() => {
    if (!canGoPrev || chapterLoading || chapterNavLockedRef.current) return;
    lockChapterNavigation();
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setCursor(value => Math.max(0, value - 1));
  }, [canGoPrev, chapterLoading, lockChapterNavigation]);

  const goNext = useCallback(() => {
    if (!currentUnit || cursor >= visibleUnits.length - 1 || chapterLoading || chapterNavLockedRef.current) return;
    lockChapterNavigation();
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setCursor(value => Math.min(visibleUnits.length - 1, value + 1));
  }, [chapterLoading, currentUnit, cursor, lockChapterNavigation, visibleUnits.length]);

  const readOneMore = useCallback(() => {
    if (!canReadMore || chapterLoading || chapterNavLockedRef.current) return;
    lockChapterNavigation();
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setReadLimit(value => value + 1);
    setCursor(value => value + 1);
  }, [canReadMore, chapterLoading, lockChapterNavigation]);

  const confirmFinish = useCallback(async () => {
    if (!session || !currentUnit || finishing || chapterLoading || chapterNavLockedRef.current) return;
    setConfirmVisible(false);
    setFinishing(true);
    try {
      const completionResult = await onComplete(
        session.checkpoint.id,
        session.checkpoint.kind,
        currentReadUnits,
      );
      if (completionResult === false) return;
      if (!taskInstanceId && Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      onBack();
    } finally {
      setFinishing(false);
    }
  }, [chapterLoading, currentReadUnits, currentUnit, finishing, onBack, onComplete, session, taskInstanceId]);

  const requestExitReading = useCallback(() => {
    setConfirmVisible(false);
    setExitConfirmVisible(true);
  }, []);

  const confirmExitReading = useCallback(() => {
    setExitConfirmVisible(false);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    releaseChapterNavigation();
    setChapterLoading(false);
    setSession(null);
  }, [releaseChapterNavigation]);

  const openCreateCheckpoint = useCallback((kind: ScriptureCheckpointKind) => {
    setCreatingKind(kind);
    setCreateSheetVisible(true);
  }, []);

  const createCheckpoint = useCallback(async (kind: ScriptureCheckpointKind, bookId: number, chapter: number, name: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setCheckpointActionError(null);
    try {
      const created = await createScriptureCheckpoint({ kind, bookId, chapter, name });
      if (created) upsertCheckpoint(created);
      else await loadCheckpoints(false);
      setCreateSheetVisible(false);
    } catch (error) {
      console.warn('Failed to create scripture checkpoint', error);
      setCheckpointActionError('Checkpoint could not be created. Please try again.');
    }
  }, [loadCheckpoints, upsertCheckpoint]);

  const moveCheckpoint = useCallback(async (
    checkpointId: string,
    direction: ScriptureCheckpointHistoryDirection,
  ) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setCreateSheetVisible(false);
    setCheckpointActionError(null);
    try {
      const updated = await moveScriptureCheckpointHistory(checkpointId, direction);
      if (updated) upsertCheckpoint(updated);
      else await loadCheckpoints(false);
    } catch (error) {
      console.warn('Failed to move scripture checkpoint history', error);
      setCheckpointActionError('Checkpoint could not be moved. Please try again.');
    }
  }, [loadCheckpoints, upsertCheckpoint]);

  const requestDeleteCheckpoint = useCallback((checkpoint: ScriptureCheckpoint) => {
    setDeleteTarget(checkpoint);
  }, []);

  const confirmDeleteCheckpoint = useCallback(async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setCheckpointActionError(null);
    setCheckpoints(prev => prev.filter(checkpoint => checkpoint.id !== target.id));
    try {
      await deleteScriptureCheckpoint(target.id);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      console.warn('Failed to delete scripture checkpoint', error);
      setCheckpointActionError('Checkpoint could not be deleted. Please try again.');
      await loadCheckpoints(false);
    }
  }, [deleteTarget, loadCheckpoints]);

  if (!ready || loading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator color={GOLD} />
        <Text style={s.loadingText}>Loading checkpoints...</Text>
      </View>
    );
  }

  if (session) {
    if (!currentUnit) {
      return (
        <View style={s.screen}>
          <ScreenTitleBar
            title={session.checkpoint.name.toUpperCase()}
            showBack
            bg={BG}
            onBackOverride={() => setSession(null)}
          />
          <View style={s.emptyState}>
            <CheckSmall s={26} c={GOLD} w={2.5} />
            <Text style={s.emptyTitle}>Checkpoint complete</Text>
            <Text style={s.emptyText}>Choose a new starting point to begin this path again.</Text>
            <TouchableOpacity onPress={() => setSession(null)} activeOpacity={0.84} style={s.primaryWide}>
              <Text style={s.primaryText}>BACK TO CHECKPOINTS</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const checkpointDock = (
      <View style={[s.actionDockWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={s.actionDock}>
          {!atVisibleEnd ? (
            <>
              <TouchableOpacity
                onPress={() => setConfirmVisible(true)}
                disabled={finishing || chapterControlsDisabled}
                activeOpacity={0.82}
                style={[s.secondaryBtn, (finishing || chapterControlsDisabled) && s.disabledBtn]}
              >
                <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={s.secondaryText}>FINISH EARLY</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={goNext}
                disabled={chapterControlsDisabled}
                activeOpacity={0.84}
                style={[s.primaryBtn, chapterControlsDisabled && s.disabledBtn]}
              >
                <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={s.primaryText}>{nextButtonLabel}</Text>
                <ChevronRight s={16} c="#FFFFFF" w={2.4} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => setConfirmVisible(true)}
                disabled={finishing || chapterControlsDisabled}
                activeOpacity={0.84}
                style={[s.primaryBtn, !canReadMore && s.primaryBtnWide, (finishing || chapterControlsDisabled) && s.disabledBtn]}
              >
                <CheckSmall s={15} c="#FFFFFF" w={2.6} />
                <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={s.primaryText}>FINISH</Text>
              </TouchableOpacity>
              {canReadMore ? (
                <TouchableOpacity
                  onPress={readOneMore}
                  disabled={chapterControlsDisabled}
                  activeOpacity={0.82}
                  style={[s.secondaryBtn, chapterControlsDisabled && s.disabledBtn]}
                >
                  <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72} style={s.secondaryText}>
                    READ ONE MORE
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </View>
    );

    return (
      <>
        <ScriptureReaderView
          bookId={currentUnit.bookId}
          chapter={currentUnit.chapter}
          lang={scriptureLanguage}
          onBack={requestExitReading}
          canGoPrevChapter={!chapterControlsDisabled && canGoPrev}
          canGoNextChapter={!chapterControlsDisabled && !atVisibleEnd}
          onPrevChapter={goPrev}
          onNextChapter={goNext}
          bottomDock={checkpointDock}
          bottomDockHeight={172}
        />

        <ConfirmModal
          visible={confirmVisible}
          icon={<CheckSmall s={24} c="#FFFFFF" w={2.8} />}
          iconBg={GOLD}
          title="Finish reading?"
          body="Are you sure you want to finish this reading session?"
          cancelLabel="KEEP READING"
          confirmLabel="FINISH"
          confirmColor={GOLD}
          confirmLoading={showFinishLoader}
          onCancel={() => setConfirmVisible(false)}
          onConfirm={confirmFinish}
        />
        <ConfirmModal
          visible={exitConfirmVisible}
          icon={<ArrowLeft s={24} c="#FFFFFF" w={2.4} />}
          iconBg={C.red}
          title="Leave reading?"
          body="Are you sure you want to exit? Progress from this reading session will not be saved."
          cancelLabel="KEEP READING"
          confirmLabel="EXIT"
          confirmColor={C.red}
          onCancel={() => setExitConfirmVisible(false)}
          onConfirm={confirmExitReading}
        />
      </>
    );

  }

  return (
    <View style={s.screen}>
      <ScreenTitleBar
        title="CHECKPOINTS"
        showBack
        bg={BG}
        onBackOverride={onBack}
      />
      <ScrollView
        contentContainerStyle={[s.selectorContent, { paddingBottom: insets.bottom + 34 }]}
        showsVerticalScrollIndicator={false}
      >
        <CheckpointHeroCard />

        {checkpointActionError ? (
          <View style={s.actionErrorBox}>
            <Text style={s.actionErrorText}>{checkpointActionError}</Text>
          </View>
        ) : null}

        {availableKinds.length === 0 ? (
          <View style={s.emptyStateInline}>
            <Book s={24} c={GOLD} />
            <Text style={s.emptyTitle}>No checkpoint path</Text>
            <Text style={s.emptyText}>This reading type does not use checkpoints yet.</Text>
          </View>
        ) : availableKinds.map(kind => {
          const kindCheckpoints = checkpoints.filter(checkpoint => checkpoint.kind === kind);
          // The screen's paint comes from the tone table, not the record — so the
          // heading, the button and every card under them cannot disagree.
          const accent = PATH_TONES[kind]?.accent ?? GOLD;
          return (
            <Animated.View
              key={kind}
              style={s.kindBlock}
              layout={LinearTransition.duration(180)}
            >
              {showKindHeaders ? (
                <View style={s.kindHeader}>
                  <View style={s.kindTitleRow}>
                    <View style={[s.kindAccent, { backgroundColor: accent }]} />
                    <View style={s.kindTitleCopy}>
                      <Text style={s.kindKicker}>CHECKPOINT PATH</Text>
                      <Text style={s.kindTitle} numberOfLines={1}>{getScriptureCheckpointTitle(kind)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => openCreateCheckpoint(kind)}
                    haptic="selection"
                    activeOpacity={0.84}
                    style={[s.addCheckpointBtn, { borderColor: `${accent}45` }]}
                  >
                    <Plus s={14} c={accent} w={2.4} />
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.76}
                      style={[s.addCheckpointText, { color: accent }]}
                    >
                      NEW CHECKPOINT
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.singleKindToolbar}>
                  <TouchableOpacity
                    onPress={() => openCreateCheckpoint(kind)}
                    haptic="selection"
                    activeOpacity={0.84}
                    style={[s.addCheckpointBtn, s.addCheckpointBtnSingle, { borderColor: `${accent}45` }]}
                  >
                    <Plus s={14} c={accent} w={2.4} />
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.76}
                      style={[s.addCheckpointText, { color: accent }]}
                    >
                      NEW CHECKPOINT
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {kindCheckpoints.map(checkpoint => (
                <CheckpointCard
                  key={checkpoint.id}
                  checkpoint={checkpoint}
                  plannedCount={plannedUnitCount}
                  onStart={() => startReading(checkpoint.id)}
                  onMove={(direction) => { void moveCheckpoint(checkpoint.id, direction); }}
                  onDelete={() => requestDeleteCheckpoint(checkpoint)}
                />
              ))}
            </Animated.View>
          );
        })}
      </ScrollView>
      {creatingKind ? (
        <CheckpointCreateSheet
          visible={createSheetVisible}
          kind={creatingKind}
          accent={checkpoints.find(checkpoint => checkpoint.kind === creatingKind)?.accent ?? GOLD}
          bottomInset={insets.bottom}
          onClose={() => setCreateSheetVisible(false)}
          onCreate={createCheckpoint}
        />
      ) : null}
      <ConfirmModal
        visible={!!deleteTarget}
        icon={<Trash2 s={23} c={C.red} w={2.1} />}
        iconBg="#FEF2F2"
        title="Delete checkpoint?"
        body="This will remove this checkpoint and its reading history."
        subject={deleteTarget?.name}
        cancelLabel="CANCEL"
        confirmLabel="DELETE"
        confirmColor={C.red}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { void confirmDeleteCheckpoint(); }}
      />
    </View>
  );
}

/* -------------------------------------------------------------
 * THE HEAD OF THE SCREEN.
 *
 * WHAT IT WAS: a white rounded box holding an icon in a tinted tile, a
 * tracked kicker, a title and a paragraph. That arrangement is what a
 * screen reaches for when it has nothing particular to say, and it is
 * the reason this page did not look like the rest of the app.
 *
 * WHAT IT IS: the app's own card, built to `RibbonSectionCard`'s
 * construction value for value -- the same one `MyRuleLeadCard` is built
 * to, and for the same reason. Colour LIFTED in HSL rather than washed
 * toward white, a three-stop plate running near-white at the shoulder to
 * colour at the foot, a lit hairline along the top edge, a pane of light
 * on the shoulder, one large emblem bleeding off the right edge, and the
 * two constellations kindling on their own two tempos.
 *
 * WHERE IT DEPARTS, and it is the one place it must: THE SCRIPTURE DOORS
 * TAKE THE CONSTRUCTION AND NOT THE SATURATION. The coin screens' cards
 * run to full colour at the foot because they are counters and they
 * should be bright. This is the way in to Scripture. Same plate, same
 * light, same marks -- pitched a third quieter, so it belongs to the
 * cards without competing with the page it opens.
 *
 * ⚠ ONLY OPACITY MOVES. The plate, the gradient, the sheen and the
 * emblem are drawn once and never animated. The whole constellation is
 * ONE <Svg> rather than six, on ONE clock that follows wall time and
 * costs no per-frame JS at all. That is the app's standing rule for
 * these cards and it is why they are free to sit on every screen.
 * ------------------------------------------------------------- */

/** How long each constellation stays lit, as a share of its cycle. */
const HERO_WINDOW = { shoulder: 0.34, foot: 0.42 } as const;
/** 16 against 10: the two clusters only realign every eighty seconds. */
const HERO_PERIOD = { shoulder: 16000, foot: 10000 } as const;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The plate's own lift: hue kept, saturation held, lightness raised. */
function goldAt(lightness: number, saturation: number): string {
  return `hsl(40 ${saturation}% ${lightness}%)`;
}

const HERO_PLATE = [goldAt(99, 60), goldAt(95, 56), goldAt(86, 50)] as const;
const HERO_EDGE = goldAt(78, 46);
const HERO_TITLE_INK = goldAt(24, 34);
const HERO_BODY_INK = goldAt(33, 20);
const HERO_EYEBROW_INK = goldAt(42, 44);
/**
 * ⚠ THE EMBLEM IS A WATERMARK AND MUST BE DIMMED LIKE ONE. The type
 * block runs to 82% of the plate and the emblem starts at 62% of it, so
 * the two OVERLAP BY DESIGN in every one of these cards — which only
 * works while the mark is faint enough to read as ground. Drawn at full
 * strength it stops being behind the words and starts fighting them.
 */
const HERO_EMBLEM = goldAt(70, 40);
const HERO_EMBLEM_OPACITY = 0.55;
/**
 * ⚠ TWO STAR TONES, AND THE PLATE DECIDES WHICH. The shoulder is
 * near-white, so a spark there has to be INK or it is invisible; the
 * foot has gone to colour, so a spark there has to be LIGHT. One tone
 * for both is how a constellation ends up half missing.
 */
const HERO_STAR_INK = goldAt(51, 45);
/** The light that crosses the ribbon, and the sparks on the coloured foot. */
const HERO_GLOW = goldAt(99, 80);

function HeroStar({
  star, clock, tone, duration, offset, running,
}: {
  star: PlacedStar;
  clock: SharedValue<number>;
  /** ⚠ The star's OWN tone: the shoulder is near-white and wants ink,
   *  the foot has gone to colour and wants light. */
  tone: string;
  duration: number;
  offset: number;
  running: boolean;
}) {
  const window = HERO_WINDOW[star.clock];
  const animatedProps = useAnimatedProps(() => {
    if (!running) return { opacity: star.peak * 0.5 };
    const phase = continuousPhase(clock.value, duration, star.phase + offset);
    const on = phase < window ? halfSinePulse(phase / window) : 0;
    return { opacity: on * star.peak };
  });

  return (
    <AnimatedPath d={star.d} fill={tone} opacity={star.peak * 0.5} animatedProps={animatedProps} />
  );
}

/* -------------------------------------------------------------
 * THE EMBLEM: an open book with its place kept.
 *
 * ⚠ IT IS THE THING THE SCREEN IS ABOUT, which is what an emblem is for.
 * The old head wore a target -- a mark that says "goal" and belongs to
 * habits and streaks, not to a book you are part-way through. A ribbon
 * hanging out of an open book is the oldest way anyone has kept a place,
 * and it is exactly what a checkpoint is.
 *
 * THREE THINGS WERE WRONG WITH THE FIRST DRAWING, and the worst of them
 * was visible from across the room:
 *
 *   · A WHITE BLOCK OVER THE BOOK. The "light crossing the ribbon" was
 *     the ENTIRE ribbon shape re-filled in `HERO_GLOW` -- which is very
 *     nearly white -- at an opacity that climbed to 0.6. On a plate this
 *     pale that does not read as light on a ribbon. It reads as a pale
 *     rectangle pasted over the middle of the mark, and since the
 *     swallowtail notch falls below the plate's edge, the part you
 *     actually see is a plain square. Light is now a NARROW STRIP down
 *     one side of the ribbon -- a highlight on a fold, which is a thing
 *     ribbons have -- and it never exceeds a third of the ribbon's width.
 *
 *   · THE VIEWBOX DID NOT MATCH THE BOX. `width={size} height={size}`
 *     around a 100x108 viewBox: react-native-svg's default
 *     `preserveAspectRatio` fits the taller ratio and centres what is
 *     left, so the mark sat ~4pt in from the right edge instead of
 *     bleeding off it, and never filled its own box. The grid is square
 *     now, so the bleed `ribbonEmblem()` computes is the bleed you get.
 *
 *   · NOTHING INSIDE IT. Two outlined curves at one uniform 3.6 weight,
 *     blown up to 46% of the plate. That is the "stretched icon" the
 *     emblem family exists to stop -- see `emblemStroke`. It now has
 *     what an open book has: RULED LINES of text on both leaves, the
 *     PAGE BLOCK under each board so the leaves have thickness, and the
 *     GUTTER the ribbon lies in. Mixed weights, and the ribbon is the
 *     one solid mass among them.
 *
 * The ribbon runs from the head of the gutter, where a sewn-in marker is
 * actually anchored, and hangs below the boards -- tail and all. Everything
 * is drawn once and never animated except that one strip of light.
 * ------------------------------------------------------------- */

/** The leaves, meeting at a gutter set left of centre so more stays on-plate. */
const BOOK_PAGE_LEFT = 'M 2 20 C 15 12, 33 12, 45 20 L 45 62 C 33 54, 15 54, 2 62 Z';
const BOOK_PAGE_RIGHT = 'M 88 20 C 75 12, 57 12, 45 20 L 45 62 C 57 54, 75 54, 88 62 Z';
/** The block of leaves under each board — what stops a page reading as a pane. */
const BOOK_BLOCK_LEFT = 'M 2 62 L 2 68 C 15 60, 33 60, 45 68';
const BOOK_BLOCK_RIGHT = 'M 88 62 L 88 68 C 75 60, 57 60, 45 68';
const BOOK_GUTTER = 'M 45 20 L 45 68';

/**
 * Lines of type, drawn parallel to the leaf's own top edge so they lie ON the
 * curve rather than across it. Four to a side is the density that reads at 46%
 * of a plate without the watermark starting to look like a paragraph.
 */
const BOOK_RULE_DEPTHS = [8, 17, 26, 35] as const;
function bookRule(depth: number, mirrored: boolean): string {
  const pts: [number, number][] = [
    [8, 17.11 + depth], [18, 13.4 + depth], [30, 13.4 + depth], [41, 17.2 + depth],
  ];
  const p = mirrored ? pts.map(([x, y]) => [90 - x, y] as [number, number]) : pts;
  const n = (v: number) => v.toFixed(2);
  return `M ${p[0][0]} ${n(p[0][1])} C ${p[1][0]} ${n(p[1][1])}, ${p[2][0]} ${n(p[2][1])}, ${p[3][0]} ${n(p[3][1])}`;
}

/**
 * The marker: sewn in at the head, down the gutter, and swinging free below
 * the boards.
 *
 * ⚠ ITS TAIL MUST STAY ON THE PLATE. This ribbon used to run to the foot of
 * the grid and bleed off the card with the rest of the emblem — which meant
 * the swallowtail, the one thing that makes a ribbon a ribbon, was never
 * seen. What was left on screen was a filled bar with no end, and since it is
 * the only solid mass on an otherwise outlined mark, it read as a slab laid
 * over the foot of the book. A marker has to show where it stops. The tail
 * sits at 78 of the 80 grid units that survive the bottom bleed; the emblem
 * still bleeds off the RIGHT edge, which is what keeps it a watermark rather
 * than a picture placed on the card.
 *
 * ⚠ IT IS STRAIGHT INSIDE THE BOOK AND BENT OUTSIDE IT, and that is the whole
 * reason it can start at the head without reading as a bar ruled down the
 * middle of the page. A real marker is held flat by the boards and free once
 * it clears them, so it goes over the foot at 60 and drifts eight units left
 * on the way to its tail. Straight all the way down was stiff; bending it
 * while it was still between the leaves looked like a fault in the drawing.
 * It leans LEFT because right is where the plate is already cut away.
 *
 * ⚠ THE NOTCH IS HALF THE RIBBON'S WIDTH AND NO MORE. It was cut ten units
 * deep into a ribbon eight units wide — deeper than the ribbon was broad —
 * which does not read as a swallowtail at all. It leaves two long thin
 * spikes, and on a ribbon that is already leaning they hang at a slant that
 * looks like a mistake rather than a fold. Four into eight is the proportion
 * a bound marker is actually cut to.
 */
const BOOK_RIBBON =
  'M 41 20 L 49 20 L 49 60 C 49 69, 41 67.6, 41 78 L 37 74 L 33 78 C 33 67.6, 41 69, 41 60 Z';
/**
 * The light, on the ribbon's own fold — never more than a third of its width.
 * Its foot is cut along the notch's own left face rather than squared off, so
 * the highlight ends flush with the tail instead of overhanging it.
 */
const BOOK_RIBBON_FOLD =
  'M 42.6 20 L 45 20 L 45 60 C 45 69, 37 67.6, 37 74 L 34.6 76.4 C 34.6 67.6, 42.6 69, 42.6 60 Z';

const BOOK_STROKE = { board: 3.2, gutter: 2.4, block: 2.2, rule: 1.8 } as const;
const BOOK_LIGHT = { block: 0.45, rule: 0.5 } as const;

function HeroEmblem({ size, clock, running }: {
  size: number;
  clock: SharedValue<number>;
  running: boolean;
}) {
  const fold = useAnimatedProps(() => {
    if (!running) return { opacity: 0.22 };
    const phase = continuousPhase(clock.value, HERO_PERIOD.foot, 0.12);
    return { opacity: 0.12 + halfSinePulse(phase) * 0.38 };
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Behind the boards: the leaves they close over. */}
      <Path
        d={BOOK_BLOCK_LEFT} fill="none" stroke={HERO_EMBLEM}
        strokeWidth={BOOK_STROKE.block} opacity={BOOK_LIGHT.block}
        strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d={BOOK_BLOCK_RIGHT} fill="none" stroke={HERO_EMBLEM}
        strokeWidth={BOOK_STROKE.block} opacity={BOOK_LIGHT.block}
        strokeLinecap="round" strokeLinejoin="round"
      />

      <Path d={BOOK_PAGE_LEFT} fill="none" stroke={HERO_EMBLEM} strokeWidth={BOOK_STROKE.board} strokeLinejoin="round" />
      <Path d={BOOK_PAGE_RIGHT} fill="none" stroke={HERO_EMBLEM} strokeWidth={BOOK_STROKE.board} strokeLinejoin="round" />

      {BOOK_RULE_DEPTHS.map(depth => (
        <React.Fragment key={depth}>
          <Path
            d={bookRule(depth, false)} fill="none" stroke={HERO_EMBLEM}
            strokeWidth={BOOK_STROKE.rule} opacity={BOOK_LIGHT.rule} strokeLinecap="round"
          />
          <Path
            d={bookRule(depth, true)} fill="none" stroke={HERO_EMBLEM}
            strokeWidth={BOOK_STROKE.rule} opacity={BOOK_LIGHT.rule} strokeLinecap="round"
          />
        </React.Fragment>
      ))}

      <Path d={BOOK_GUTTER} stroke={HERO_EMBLEM} strokeWidth={BOOK_STROKE.gutter} strokeLinecap="round" />

      <Path d={BOOK_RIBBON} fill={HERO_EMBLEM} />
      {/* The one moving thing on the card besides the constellation, and the
          one that means something: the place is kept, and it is lit. */}
      <AnimatedPath d={BOOK_RIBBON_FOLD} fill={HERO_GLOW} opacity={0.22} animatedProps={fold} />
    </Svg>
  );
}

function CheckpointHeroCard() {
  const reduceMotion = useReducedMotion();
  const running = !reduceMotion;
  const clock = useContinuousAnimationClock(running);
  const rhythm = useMemo(() => ribbonCardRhythm(0), []);
  const [plate, setPlate] = useState({ w: 0, h: 0 });

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPlate(current => (
      Math.abs(current.w - width) < 1 && Math.abs(current.h - height) < 1
        ? current
        : { w: width, h: height }
    ));
  }, []);

  /**
   * ⚠ THE FIRST FRAME IS ESTIMATED, NOT EMPTY. `onLayout` reports one
   * frame after the plate exists, and a card whose emblem and stars pop
   * in a frame late is the one thing the eye does catch. The estimate is
   * replaced by the measurement the moment it arrives.
   */
  const geometry = plate.w > 0
    ? plate
    : { w: 330, h: estimateRibbonHeight(330, HERO_BODY) };
  const stars = useMemo(
    () => placeRibbonStars(geometry.w, geometry.h),
    [geometry.w, geometry.h],
  );
  const emblem = useMemo(
    () => ribbonEmblem(geometry.w, geometry.h),
    [geometry.w, geometry.h],
  );

  return (
    <View style={s.hero} onLayout={handleLayout}>
      <LinearGradient
        colors={HERO_PLATE}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* The pane of light on the shoulder, reaching nothing well before
          any edge — a fade that stops mid-plate rules a line across it as
          cleanly as if one had been drawn. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.62)', 'rgba(255,255,255,0)']}
        locations={[0, 0.55]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View pointerEvents="none" style={[s.heroEdge, { borderColor: HERO_EDGE }]} />
      <View pointerEvents="none" style={s.heroLit} />

      <View
        pointerEvents="none"
        style={[s.heroEmblem, { right: emblem.right, bottom: emblem.bottom, opacity: HERO_EMBLEM_OPACITY }]}
      >
        <HeroEmblem size={emblem.size} clock={clock} running={running} />
      </View>

      {geometry.w > 0 && (
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={geometry.w}
          height={geometry.h}
        >
          {stars.map((star, i) => (
            <HeroStar
              key={i}
              star={star}
              clock={clock}
              tone={star.tone === 'light' ? '#FFFFFF' : HERO_STAR_INK}
              duration={HERO_PERIOD[star.clock] * rhythm.stretch}
              offset={rhythm.offset}
              running={running}
            />
          ))}
        </Svg>
      )}

      <View style={s.heroCopy}>
        <Text style={s.heroEyebrow}>{HERO_EYEBROW}</Text>
        <Text style={s.heroTitle}>{HERO_TITLE}</Text>
        <Text style={s.heroBody}>{HERO_BODY}</Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------
 * THE PATH CARD.
 *
 * WHAT IT WAS: a white rounded box with a tinted icon tile, a title, an
 * accent line saying "Stopped at John 3", and a grey meta line under
 * that. Three stacked lines and a badge — the arrangement any screen
 * reaches for, and the reason this card did not look like the rest of
 * Scripture even though it sat under a head that did.
 *
 * WHAT IT IS: SCRIPTURE'S OWN CONTENTS PAGE. `HolyScriptureView`'s book
 * card and `BibleNotesView` are built to one tone system anchored on the
 * New Testament's green, and it is that construction taken value for
 * value: a parchment ground warmed toward the tone, a quiet wash of the
 * tone over it, the testament's rays raked across the corner, and the
 * volume's own SPINE standing at the left edge.
 *
 * ⚠ WHAT IS ITS OWN, and the reason this is not just a reskin. On the
 * Scripture shelf the leader rules from a book's name across to its
 * CHAPTER COUNT — a contents page's folio. Here it rules from the path's
 * name across to THE PLACE YOU STOPPED. Same idiom, and the reference
 * lands exactly where a page number lands, so a reader who has seen the
 * shelf already knows how to read this: the name, the rule, and where it
 * is. That one substitution is the whole card, and it let three stacked
 * lines become one.
 *
 * ⚠ THE ACCENT STAYS THE CHECKPOINT'S OWN. The kind header and the NEW
 * CHECKPOINT button above these cards take their colour from the record,
 * so the card takes it from there too and only the GROUND is keyed to
 * the kind. A card that picked its accent out of the tone table would
 * disagree with the button sitting directly above it.
 *
 * The icon tile is gone on purpose: Scripture's open volume "stands
 * clean, type and rule alone", and the spine at the left edge already
 * carries the tone the tile was carrying.
 * ------------------------------------------------------------- */

/* -------------------------------------------------------------
 * THE THREE TONES.
 *
 * ⚠ THE OLD TESTAMENT AND THE PSALTER WERE THE SAME COLOUR. Measured:
 * the record paints them #A97732 and #C58A2D — hue 34.8° against 36.7°.
 * TWO DEGREES APART, at comparable saturation and lightness. Side by
 * side on this screen they were one amber card printed twice, and no
 * amount of drawing could separate them while the paint agreed.
 *
 * Scripture and Bible Notes had already solved it, and NOT by moving
 * the hue — brown and gold are neighbours and always will be. They
 * separate BY VALUE:
 *
 *   Old Testament  #8A6A45   H 32   S 33   L 41   — deep and muted
 *   Psalter        #C5A059   H 39   S 48   L 56   — bright and clear
 *
 * Fifteen points of lightness and fifteen of saturation. That does not
 * read as two shades of one colour, it reads as two materials: dark
 * tooled leather against gold leaf. Bible Notes calls its brown "the
 * elder half of the canon, and the deepest note on either screen", and
 * that is exactly the job it is doing here.
 *
 * ⚠ AND BOTH WERE TOO LOUD FOR THIS REGISTER. 54% and 63% saturation,
 * where Scripture's own sage is 18% and its gold 48%. `ScriptureDoor`
 * states the rule and the reason: run Scripture's tones through the
 * section cards' floor "and the page turns into a highlighter — the
 * liturgical register becomes the coin register, which is the one thing
 * it must never do." These two cards were the coin register.
 *
 * ⚠ THE PAINT IS THE VIEW'S, NOT THE RECORD'S. The kind heading and the
 * NEW CHECKPOINT button take their accent from the same table the card
 * does, so the whole screen agrees — and `scriptureCheckpointDb` is left
 * exactly as it is. Where a checkpoint is filed is the record's business;
 * how it is painted is this screen's.
 *
 * EVERY OTHER VALUE IS DERIVED from the accent by holding hue and
 * saturation and moving only lightness — `tone.ts`'s one correct way to
 * lighten. Hand-picking eleven values per tone is how the two ambers
 * drifted into each other in the first place; derived, they cannot.
 * ------------------------------------------------------------- */

/** Pale ground needs a floor or the sage vanishes at 96% lightness. */
const PATH_GROUND_FLOOR = 42;
/** Ink holds the tone's OWN saturation. Flooring it is what makes a
 *  liturgical page shout — see the note above. */
const PATH_INK_FLOOR = 0;

function pathRgba(hex: string, alpha: number): string {
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? v.split('').map(c => c + c).join('') : v, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

type PathMotifKind = 'rays' | 'counter' | 'kathisma';

type PathTone = {
  accent: string;
  /** What the accent can carry as type — see `buildPathTone`. */
  onAccent: string;
  ground: readonly [string, string];
  wash: string;
  border: string;
  spine: string;
  /** The dotted rule, and the flourish raked across the corner. */
  leader: string;
  motif: PathMotifKind;
  motifOpacity: number;
  /** The reference the arrows move — the card's folio. */
  folio: string;
  /** The instrument's plate: where the place is read and moved. */
  well: string;
  wellBorder: string;
  kicker: string;
  railInk: string;
  railInkOff: string;
};

function buildPathTone(accent: string, motif: PathMotifKind, motifOpacity: number): PathTone {
  return {
    accent,
    /**
     * ⚠ GOLD CARRIES INK, NOT WHITE — and this is a rule, not an exception
     * made for the Psalter. Its gold sits at 56% lightness where the sage and
     * the brown sit at 41, so white type on the Psalter's button measured
     * about 2.3:1 against roughly 4.5:1 on the other two. Illegible, and it
     * looked bleached rather than gilded.
     *
     * Deepening the gold to fix it was the wrong repair: it lands straight
     * back on the Old Testament's brown, which is the collision this whole
     * table exists to undo. So a light accent keeps its brightness and takes
     * DARK type instead — which is also how gold has always been used, since
     * nobody has ever written on gold leaf in white.
     *
     * 17% is measured, not chosen by eye: on this gold it clears 5.0:1, where
     * 23% only reached 3.8 and would have shipped a button you squint at.
     */
    onAccent: toHsl(accent).l > 52 ? deep(accent, 17, PATH_INK_FLOOR) : '#FFFFFF',
    ground: [lit(accent, 99.2, PATH_GROUND_FLOOR), lit(accent, 96.2, PATH_GROUND_FLOOR)],
    wash: pathRgba(accent, 0.05),
    border: lit(accent, 89, 30),
    spine: pathRgba(accent, 0.42),
    leader: accent,
    motif,
    motifOpacity,
    folio: deep(accent, 31, PATH_INK_FLOOR),
    well: lit(accent, 97.4, PATH_GROUND_FLOOR),
    wellBorder: pathRgba(accent, 0.22),
    kicker: deep(accent, 56, PATH_INK_FLOOR),
    railInk: deep(accent, 40, PATH_INK_FLOOR),
    railInkOff: pathRgba(accent, 0.34),
  };
}

const PATH_TONES: Record<ScriptureCheckpointKind, PathTone> = {
  // Scripture's sage, and its own rays.
  new_testament: buildPathTone('#5E7B55', 'rays', 0.075),
  // The elder half of the canon: deep, muted, and raked the other way so the
  // two testaments cannot be told apart only by colour.
  old_testament: buildPathTone('#8A6A45', 'counter', 0.085),
  /**
   * ⚠ THE PSALTER GETS ITS OWN MARK, not a borrowed one. It was wearing the
   * New Testament's rays, which is the one thing it is not. What the Psalter
   * has that nothing else in this app has is the KATHISMA — twenty divisions,
   * and `HolyScriptureView` already draws their head as a rule struck through
   * with a diamond. That ornament, repeated down the corner, is the Psalter's
   * own and belongs to no other tone.
   */
  psalter: buildPathTone('#C5A059', 'kathisma', 0.09),
};

/**
 * The flourish along the outer edge, drawn large and anchored at the corner
 * the way a manuscript carries one. Rays lean one way for the New Testament
 * and the other for the Old; the Psalter is ruled into its kathismata.
 */
const PathMotif = memo(function PathMotif({ tone }: { tone: PathTone }) {
  const stroke = tone.leader;
  const opacity = tone.motifOpacity;

  return (
    <View pointerEvents="none" style={s.pathMotifAnchor}>
      <Svg width={200} height={104}>
        {tone.motif === 'kathisma' ? (
          <>
            {Array.from({ length: 4 }, (_, i) => {
              const y = 13 + i * 26;
              return (
                <React.Fragment key={i}>
                  <SvgLine
                    x1={46} y1={y} x2={196} y2={y}
                    stroke={stroke} strokeOpacity={opacity} strokeWidth={1.2}
                  />
                  {/* The struck diamond of the kathisma head. */}
                  <Path
                    d={`M 36 ${y} L 41 ${y - 5} L 46 ${y} L 41 ${y + 5} Z`}
                    fill={stroke}
                    fillOpacity={opacity * 1.35}
                  />
                </React.Fragment>
              );
            })}
          </>
        ) : (
          <Path
            d={tone.motif === 'rays'
              ? 'M 200 -6 L 138 106 M 174 -6 L 112 106 M 148 -6 L 86 106 M 122 -6 L 60 106 M 96 -6 L 34 106 M 70 -6 L 8 106'
              : 'M 138 -6 L 200 106 M 112 -6 L 174 106 M 86 -6 L 148 106 M 60 -6 L 122 106 M 34 -6 L 96 106'}
            fill="none"
            stroke={stroke}
            strokeOpacity={opacity}
            strokeWidth={1}
          />
        )}
      </Svg>
    </View>
  );
});

function CheckpointCard({
  checkpoint,
  plannedCount,
  onStart,
  onMove,
  onDelete,
}: {
  checkpoint: ScriptureCheckpoint;
  plannedCount: number;
  onStart: () => void;
  onMove: (direction: ScriptureCheckpointHistoryDirection) => void;
  onDelete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const tone = PATH_TONES[checkpoint.kind] ?? PATH_TONES.new_testament;
  const nextCopy = checkpoint.nextUnit?.ref ?? 'Complete';
  const stoppedCopy = checkpoint.completed ? 'Complete' : nextCopy;
  const canGoBack = checkpoint.availableBackSteps > 0;
  const canGoForward = checkpoint.availableForwardSteps > 0;
  const units = Math.max(1, plannedCount);
  const unitWord = checkpoint.kind === 'psalter' ? 'psalm' : 'chapter';
  /**
   * The leader is DRAWN, not stretched: dots keep their size and spacing at
   * any width, so it is measured rather than scaled through a viewBox. Same
   * reason the Scripture shelf measures its own.
   */
  const [leaderWidth, setLeaderWidth] = useState(0);

  /**
   * ⚠ THE READING MOVES IN THE DIRECTION YOU PRESSED. The reference only
   * changes once the move has been written and the record comes back, which
   * is far enough after the tap that the two can stop feeling connected. So
   * the new reference ENTERS from the side of the arrow that fetched it —
   * back slides in from the left, forward from the right.
   *
   * This is what makes the instrument legible without a word of explanation:
   * you see the value travel, so you know what the arrows are for. It is two
   * shared values driven on the UI thread, one-shot, and it never runs on
   * first paint — a card arriving on screen has not moved anywhere.
   */
  const travel = useSharedValue(0);
  const settle = useSharedValue(1);
  const pressedDirection = useRef<ScriptureCheckpointHistoryDirection | null>(null);
  const hasSettled = useRef(false);

  useEffect(() => {
    if (!hasSettled.current) {
      hasSettled.current = true;
      return;
    }
    const direction = pressedDirection.current;
    pressedDirection.current = null;
    if (reduceMotion || !direction) return;
    travel.value = direction === 'back' ? -16 : 16;
    settle.value = 0.2;
    travel.value = withSpring(0, { damping: 19, stiffness: 230, mass: 0.7 });
    settle.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [stoppedCopy, reduceMotion, travel, settle]);

  const referenceStyle = useAnimatedStyle(() => ({
    opacity: settle.value,
    transform: [{ translateX: travel.value }],
  }));

  const move = useCallback((direction: ScriptureCheckpointHistoryDirection) => {
    pressedDirection.current = direction;
    onMove(direction);
  }, [onMove]);

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(120)}
      layout={LinearTransition.duration(180)}
      style={s.checkpointCard}
    >
      <LinearGradient
        colors={tone.ground}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tone.wash }]} />
      <PathMotif tone={tone} />
      {/* The volume's spine, standing at the edge — it carries the tone the
          icon tile used to carry, and takes no width from the line. */}
      <View pointerEvents="none" style={[s.pathSpine, { backgroundColor: tone.spine }]} />

      <TouchableOpacity
        onPress={onDelete}
        haptic="medium"
        activeOpacity={0.78}
        style={[s.deleteCheckpointBtn, { borderColor: tone.wellBorder }]}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Trash2 s={13.5} c="#B0705E" w={2} />
      </TouchableOpacity>

      {/* The contents line. The leader now rules from the name to the card's
          own margin and carries nothing at its end — the reference moved out
          of this line entirely, because a long path name and a long reference
          ("I Thessalonians 5") were fighting over one row and both losing. */}
      <View style={s.pathLine}>
        <Text style={s.pathName} numberOfLines={1}>{checkpoint.name}</Text>
        <View style={s.pathLeader} onLayout={event => setLeaderWidth(event.nativeEvent.layout.width)}>
          {leaderWidth > 0 && (
            <Svg width={leaderWidth} height={4}>
              <SvgLine
                x1={0}
                y1={2}
                x2={leaderWidth}
                y2={2}
                stroke={tone.leader}
                strokeOpacity={0.34}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeDasharray="0.5 5"
              />
            </Svg>
          )}
        </View>
      </View>

      <Text style={[s.pathMeta, { color: tone.railInk }]} numberOfLines={1}>
        {`${units} ${unitWord}${units === 1 ? '' : 's'} planned`}
      </Text>

      {/* THE INSTRUMENT: the reading's place, with the two arrows that move it
          directly beneath, on one plate divided by the app's own fold. The
          arrows used to sit in a rail of their own with the reference three
          lines away, which said nothing about what they did. Under the value
          they change, they need no label to be understood — and the reference
          now has a whole row, so it can be as long as a book name gets. */}
      <View style={[s.stepper, { backgroundColor: tone.well, borderColor: tone.wellBorder }]}>
        <View pointerEvents="none" style={s.stepperLit} />
        <View style={s.stepperReadout}>
          <Text style={[s.stepperKicker, { color: tone.kicker }]} numberOfLines={1}>
            {checkpoint.completed ? 'READING PATH' : 'NEXT UP'}
          </Text>
          <Animated.Text
            style={[s.stepperRef, { color: tone.folio }, referenceStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {stoppedCopy}
          </Animated.Text>
        </View>

        <View pointerEvents="none" style={[s.stepperFold, { backgroundColor: tone.leader }]} />
        <View pointerEvents="none" style={s.stepperFoldLit} />

        <View style={s.stepperControls}>
          <TouchableOpacity
            onPress={() => move('back')}
            haptic="selection"
            disabled={!canGoBack}
            activeOpacity={0.7}
            style={s.stepperBtn}
            accessibilityRole="button"
            accessibilityLabel="Move the reading back one step"
            accessibilityState={{ disabled: !canGoBack }}
          >
            <ChevronLeft s={17} c={canGoBack ? tone.railInk : tone.railInkOff} w={2.4} />
            <Text
              numberOfLines={1}
              style={[s.stepperBtnText, { color: canGoBack ? tone.railInk : tone.railInkOff }]}
            >
              BACK
            </Text>
          </TouchableOpacity>
          <View style={[s.stepperDivider, { backgroundColor: tone.wellBorder }]} />
          <TouchableOpacity
            onPress={() => move('forward')}
            haptic="selection"
            disabled={!canGoForward}
            activeOpacity={0.7}
            style={s.stepperBtn}
            accessibilityRole="button"
            accessibilityLabel="Move the reading forward one step"
            accessibilityState={{ disabled: !canGoForward }}
          >
            <Text
              numberOfLines={1}
              style={[s.stepperBtnText, { color: canGoForward ? tone.railInk : tone.railInkOff }]}
            >
              FORWARD
            </Text>
            <ChevronRight s={17} c={canGoForward ? tone.railInk : tone.railInkOff} w={2.4} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        onPress={onStart}
        disabled={checkpoint.completed}
        activeOpacity={0.86}
        style={[s.startBtn, { backgroundColor: tone.accent }, checkpoint.completed && s.startBtnDisabled]}
        accessibilityRole="button"
        accessibilityLabel={checkpoint.completed ? 'Reading path complete' : `Start reading at ${stoppedCopy}`}
      >
        {/* The lit hairline every raised surface in this app wears. */}
        <View pointerEvents="none" style={s.startBtnLit} />
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[s.startText, { color: tone.onAccent }]}>
          {checkpoint.completed ? 'PATH COMPLETE' : 'START READING'}
        </Text>
        {!checkpoint.completed && <ChevronRight s={16} c={tone.onAccent} w={2.3} />}
      </TouchableOpacity>

      {/* Drawn over the ground rather than set as a border, so the gradient
          can run to the edge without a hairline of background on the curve. */}
      <View pointerEvents="none" style={[s.pathEdge, { borderColor: tone.border }]} />
    </Animated.View>
  );
}

function CheckpointCreateSheet({
  visible,
  kind,
  accent,
  bottomInset,
  onClose,
  onCreate,
}: {
  visible: boolean;
  kind: ScriptureCheckpointKind;
  accent: string;
  bottomInset: number;
  onClose: () => void;
  onCreate: (kind: ScriptureCheckpointKind, bookId: number, chapter: number, name: string) => void | Promise<void>;
}) {
  const [keyboardLift, setKeyboardLift] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardLift(0);
      return undefined;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, event => {
      const height = event.endCoordinates.height;
      setKeyboardLift(Math.min(170, Math.max(116, height * 0.42)));
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardLift(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  return (
    <SmoothBottomSheet
      visible={visible}
      onClose={onClose}
      closeOnBackdropPress={false}
      overlayStyle={keyboardLift > 0 ? { paddingBottom: keyboardLift } : undefined}
      sheetStyle={[s.createCheckpointSheet, { paddingBottom: Math.max(bottomInset, 12) + 18 }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScrollBeginDrag={() => Keyboard.dismiss()}
        nestedScrollEnabled
        contentContainerStyle={s.createSheetScroll}
      >
        <CheckpointStartPicker
          kind={kind}
          accent={accent}
          mode="create"
          onClose={onClose}
          onCreate={onCreate}
        />
      </ScrollView>
    </SmoothBottomSheet>
  );
}

function CheckpointStartPicker({
  checkpointId,
  kind,
  accent,
  mode,
  initialName,
  currentBookId,
  currentChapter,
  onClose,
  onSave,
  onCreate,
}: {
  checkpointId?: string;
  kind: ScriptureCheckpointKind;
  accent: string;
  mode: 'edit' | 'create';
  initialName?: string;
  currentBookId?: number;
  currentChapter?: number;
  onClose?: () => void;
  onSave?: (checkpointId: string, kind: ScriptureCheckpointKind, bookId: number, chapter: number, name: string) => void | Promise<void>;
  onCreate?: (kind: ScriptureCheckpointKind, bookId: number, chapter: number, name: string) => void | Promise<void>;
}) {
  const books = useMemo(() => getBooksForCheckpointKind(kind), [kind]);
  const initialBook = currentBookId ?? books[0]?.id ?? 40;
  const [bookId, setBookId] = useState(initialBook);
  const book = books.find(item => item.id === bookId) ?? books[0];
  const [chapter, setChapter] = useState(currentChapter ?? 1);
  const [name, setName] = useState(initialName ?? '');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    const nextBook = currentBookId ?? books[0]?.id ?? 40;
    setBookId(nextBook);
    setChapter(currentChapter ?? 1);
    setName(initialName ?? '');
    setSubmitAttempted(false);
  }, [books, currentBookId, currentChapter, initialName]);

  useEffect(() => {
    if (!book) return;
    setChapter(value => Math.min(book.chapters, Math.max(1, value)));
  }, [book]);

  if (!book) return null;

  const chapters = Array.from({ length: book.chapters }, (_, index) => index + 1);
  const saveLabel = mode === 'create' ? 'CREATE CHECKPOINT' : 'SAVE START POINT';
  const namePlaceholder = kind === 'new_testament'
    ? 'Example: Morning Matthew'
    : kind === 'old_testament'
      ? 'Example: Evening Prophets'
      : 'Example: Night Psalms';
  const cleanName = name.trim();
  const nameMissing = cleanName.length === 0;
  const placeMissing = !book || !chapter;
  const showValidation = submitAttempted && (nameMissing || placeMissing);

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (nameMissing || placeMissing) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    Keyboard.dismiss();
    if (mode === 'edit' && checkpointId && onSave) {
      void onSave(checkpointId, kind, book.id, chapter, cleanName);
    } else if (mode === 'create' && onCreate) {
      void onCreate(kind, book.id, chapter, cleanName);
    }
  };

  return (
    <View style={s.pickerBox}>
      {onClose ? (
        <View style={s.createSheetHeader}>
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              onClose();
            }}
            activeOpacity={0.78}
            style={s.sheetIconBtn}
          >
            <X s={18} c="#A8A29E" w={2.4} />
          </TouchableOpacity>
          <View style={s.createSheetTitleWrap}>
            <Text style={s.createSheetKicker}>NEW CHECKPOINT</Text>
            <Text style={s.createSheetTitle}>{getScriptureCheckpointTitle(kind)}</Text>
          </View>
          <TouchableOpacity onPress={handleSubmit} activeOpacity={0.78} style={[s.sheetIconBtn, s.sheetConfirmBtn, { backgroundColor: accent }]}>
            <CheckSmall s={18} c="#FFFFFF" w={2.7} />
          </TouchableOpacity>
        </View>
      ) : null}
      <Text style={s.pickerLabel}>CHECKPOINT NAME</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={namePlaceholder}
        placeholderTextColor="#CFC6B8"
        style={[s.nameInput, showValidation && nameMissing && s.inputError]}
      />
      {showValidation ? (
        <Text style={s.validationText}>
          {nameMissing ? 'Enter a checkpoint name.' : 'Choose where this checkpoint should start.'}
        </Text>
      ) : (
        <Text style={s.helperText}>Name it and choose the place where this reading path begins.</Text>
      )}
      <Text style={s.pickerLabel}>START FROM</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.bookChipRow}>
        {books.map(item => {
          const active = item.id === bookId;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                Keyboard.dismiss();
                setBookId(item.id);
                setChapter(1);
              }}
              activeOpacity={0.84}
              style={[s.bookChip, active && { borderColor: accent, backgroundColor: `${accent}12` }]}
            >
              <Text style={[s.bookChipText, active && { color: accent }]}>{item.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={s.chapterGrid}>
        {chapters.map(item => {
          const active = item === chapter;
          return (
            <TouchableOpacity
              key={item}
              onPress={() => {
                Keyboard.dismiss();
                setChapter(item);
              }}
              activeOpacity={0.84}
              style={[s.chapterChip, active && { borderColor: accent, backgroundColor: accent }]}
            >
              <Text style={[s.chapterChipText, active && s.chapterChipTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity
        onPress={handleSubmit}
        activeOpacity={0.84}
        style={[s.saveStartBtn, { backgroundColor: accent }]}
      >
        <Text style={s.saveStartText}>{saveLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function ChapterBar({
  chapter,
  label,
  canGoPrev,
  onPrev,
}: {
  chapter: number;
  label: 'CHAPTER' | 'PSALM';
  canGoPrev: boolean;
  onPrev: () => void;
}) {
  return (
    <View style={s.chapterBar}>
      <TouchableOpacity onPress={onPrev} disabled={!canGoPrev} style={s.chapterBtn} activeOpacity={0.65}>
        <ChevronLeft s={20} c={canGoPrev ? '#9CA3AF' : '#E5E7EB'} />
      </TouchableOpacity>
      <View style={s.chapterPill}>
        <View style={s.chapterPillDot} />
        <Text style={s.chapterTitle}>{label} {chapter}</Text>
        <View style={s.chapterPillDot} />
      </View>
      <View style={s.chapterBtn}>
        <ChevronRight s={20} c="#E5E7EB" />
      </View>
    </View>
  );
}

function VerseRow({ verse }: { verse: BibleVerse }) {
  return (
    <View style={s.verseRow}>
      <View style={s.verseMarker}>
        <Text style={s.verseNum}>{verse.verse}</Text>
      </View>
      <ReadableText style={s.verseText}>{verse.text}</ReadableText>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG, gap: 12 },
  loadingText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: '#A8A29E', textTransform: 'uppercase' },
  selectorContent: { paddingHorizontal: 18, paddingTop: 4, gap: 14 },
  /**
   * THE PLATE. Its radius, padding and rhythm are `RibbonSectionCard`'s
   * — this is the same card, and a card that is ALMOST the app's card is
   * worse than one that is plainly different.
   */
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    borderCurve: 'continuous',
    minHeight: 152,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    shadowColor: '#8C7A4F',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 2,
  },
  // Drawn rather than set as a border, so the plate's gradient can run
  // right to it without a hairline of background showing on the curve.
  heroEdge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  heroLit: {
    position: 'absolute',
    top: 1,
    left: 26,
    right: 26,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  heroEmblem: { position: 'absolute' },
  /**
   * ⚠ THE TYPE HOLDS ITS OWN WIDTH. The emblem bleeds in from the right,
   * and a sentence allowed to run the full plate would set its last line
   * across the book. 82% is the ribbon card's own share.
   */
  heroCopy: { maxWidth: '82%' },
  heroEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: HERO_EYEBROW_INK,
    textTransform: 'uppercase',
  },
  // 28, which is the ribbon cards' own title size. It was 20 in a box.
  heroTitle: {
    marginTop: 8,
    fontFamily: F.serifMedium,
    fontSize: 26,
    lineHeight: 32,
    color: HERO_TITLE_INK,
  },
  heroBody: {
    marginTop: 8,
    fontFamily: F.serif,
    fontSize: 15,
    lineHeight: 23,
    color: HERO_BODY_INK,
  },
  actionErrorBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F3D8C8',
    backgroundColor: '#FFF7F2',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  actionErrorText: { fontFamily: F.sansBold, fontSize: 10, lineHeight: 16, letterSpacing: 1, color: '#A15C37', textTransform: 'uppercase', textAlign: 'center' },
  kindBlock: { gap: 10 },
  kindHeader: {
    minHeight: 48,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  kindTitleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  kindAccent: { width: 4, height: 28, borderRadius: 3 },
  kindTitleCopy: { flex: 1, minWidth: 0 },
  kindKicker: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.6, color: '#B9AEA0', textTransform: 'uppercase' },
  kindTitle: { marginTop: 2, fontFamily: F.serifMedium, fontSize: 17, color: INK },
  singleKindToolbar: { alignItems: 'flex-end', paddingHorizontal: 2 },
  addCheckpointBtn: {
    minHeight: 34,
    maxWidth: 142,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  addCheckpointBtnSingle: { maxWidth: 164, backgroundColor: '#FFFCF7' },
  addCheckpointText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.3, textTransform: 'uppercase' },
  newCheckpointCard: {
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    padding: 16,
    shadowColor: '#8C7A4F',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  createCheckpointSheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -10 },
    shadowRadius: 26,
    elevation: 14,
  },
  createSheetScroll: {
    paddingTop: 4,
  },
  checkpointCard: {
    position: 'relative',
    borderRadius: 22,
    borderCurve: 'continuous',
    // The ground, the wash and the rays are all drawn inside, so the card
    // has to clip them to its own curve.
    overflow: 'hidden',
    paddingHorizontal: 15,
    paddingVertical: 13,
    shadowColor: '#8C7A4F',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  pathEdge: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  pathMotifAnchor: { position: 'absolute', top: 0, right: 0, bottom: 0, overflow: 'hidden' },
  pathSpine: { position: 'absolute', left: 0, top: 11, bottom: 11, width: 2.5, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  deleteCheckpointBtn: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  /**
   * ⚠ THE LINE RESERVES THE DELETE SEAT'S WIDTH. The reference is the folio
   * of a contents page and it belongs hard against the right margin — but a
   * margin is exactly what a page has, and here it is the 32pt the seat
   * occupies. Without it the two collide on any path whose name is short.
   */
  // The line reserves the delete seat's width; the leader rules into it and
  // stops, carrying nothing, so nothing can collide here at any name length.
  pathLine: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingRight: 32 },
  pathName: { flexShrink: 1, fontFamily: F.serifMedium, fontSize: 18.5, lineHeight: 23, color: '#2B2723' },
  pathLeader: { flex: 1, minWidth: 10, height: 4 },
  pathMeta: {
    marginTop: 2,
    fontFamily: F.sansBold,
    fontSize: 8.6,
    letterSpacing: 1.05,
    textTransform: 'uppercase',
  },

  /* The instrument — readout over its own controls, one plate. */
  stepper: {
    marginTop: 12,
    borderRadius: 17,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
  },
  stepperLit: { position: 'absolute', left: 1, right: 1, top: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.8)' },
  stepperReadout: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 11 },
  stepperKicker: { fontFamily: F.sansBold, fontSize: 8.6, letterSpacing: 1.5, textTransform: 'uppercase' },
  /**
   * ⚠ THE REFERENCE OWNS THIS ROW. It is the longest string the card can be
   * asked to show — "I Thessalonians 5" and worse — and it now has the full
   * width to do it in, shrinking only as a last resort rather than truncating
   * a book's name.
   */
  stepperRef: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 20, lineHeight: 25 },
  // The app's fold: a rule of the tone with white caught under it.
  stepperFold: { height: StyleSheet.hairlineWidth, opacity: 0.22 },
  stepperFoldLit: { height: 1, backgroundColor: 'rgba(255,255,255,0.75)' },
  stepperControls: { flexDirection: 'row', alignItems: 'stretch', minHeight: 44 },
  stepperDivider: { width: StyleSheet.hairlineWidth, marginVertical: 9 },
  stepperBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 6,
  },
  // 10.5 where it was 8.4: these are the card's only two navigation words and
  // they were being read at footnote size.
  stepperBtnText: { fontFamily: F.sansBold, fontSize: 10.5, letterSpacing: 1.1, textTransform: 'uppercase' },

  startBtn: {
    marginTop: 11,
    minHeight: 46,
    borderRadius: 15,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
  },
  startBtnLit: { position: 'absolute', left: 12, right: 12, top: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.34)' },
  startBtnDisabled: { opacity: 0.52 },
  startText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.6, color: '#FFFFFF', textTransform: 'uppercase' },
  pickerBox: { borderRadius: 24, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#F0E3CE', padding: 14, gap: 10 },
  createSheetHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  sheetIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetConfirmBtn: {
    borderColor: 'transparent',
    shadowColor: '#C5A059',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  createSheetTitleWrap: { flex: 1, minWidth: 0, alignItems: 'center' },
  createSheetKicker: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.8, color: GOLD, textTransform: 'uppercase' },
  createSheetTitle: { marginTop: 2, fontFamily: F.serifMedium, fontSize: 21, color: INK, textAlign: 'center' },
  pickerLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.5, color: '#A08A63', textTransform: 'uppercase' },
  nameInput: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9E1D4',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    fontFamily: F.serifMedium,
    fontSize: 21,
    lineHeight: 27,
    color: INK,
  },
  inputError: { borderColor: '#D97757', backgroundColor: '#FFF8F3' },
  helperText: { marginTop: -4, fontFamily: F.serif, fontSize: 13, lineHeight: 18, color: '#9A9287' },
  validationText: { marginTop: -4, fontFamily: F.sansBold, fontSize: 9.5, lineHeight: 15, letterSpacing: 0.8, color: '#B45335', textTransform: 'uppercase' },
  bookChipRow: { gap: 8, paddingRight: 8 },
  bookChip: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: '#E9E1D4', backgroundColor: '#FFFFFF', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  bookChipText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.1, color: '#918A81', textTransform: 'uppercase' },
  chapterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chapterChip: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: '#E9E1D4', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  chapterChipText: { fontFamily: F.sansBold, fontSize: 11, color: '#8D8A84' },
  chapterChipTextActive: { color: '#FFFFFF' },
  saveStartBtn: { minHeight: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  saveStartText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.5, color: '#FFFFFF', textTransform: 'uppercase' },
  planWrap: { paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  planPill: { flex: 1, minHeight: 54, borderRadius: 20, borderWidth: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 15, justifyContent: 'center' },
  planEyebrow: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.7, textTransform: 'uppercase' },
  planText: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 17, color: INK },
  progressText: { maxWidth: 88, textAlign: 'right', fontFamily: F.sansBold, fontSize: 10, lineHeight: 15, letterSpacing: 1.1, color: '#A8A29E', textTransform: 'uppercase' },
  chapterBar: { paddingHorizontal: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chapterBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  chapterPill: { flex: 1, minHeight: 42, borderRadius: 21, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0EDE6', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  chapterPillDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: GOLD },
  chapterTitle: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: GOLD, textTransform: 'uppercase' },
  content: { paddingHorizontal: 22, paddingTop: 4 },
  bookTitle: { textAlign: 'center', fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: '#A8A29E', marginBottom: 18 },
  chapterLoading: { minHeight: 240, alignItems: 'center', justifyContent: 'center' },
  emptyChapter: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 10 },
  verseList: { gap: 17 },
  verseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  verseMarker: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F8F1E4', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  verseNum: { fontFamily: F.sansBold, fontSize: 10, color: GOLD },
  verseText: { flex: 1, fontFamily: F.serif, fontSize: 19, lineHeight: 26, color: '#2B2723' },
  actionDockWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 16, backgroundColor: 'transparent' },
  actionDock: {
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    padding: 7,
    flexDirection: 'row',
    gap: 8,
    shadowColor: '#8B7354',
    shadowOpacity: 0.11,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 5,
  },
  primaryBtn: { flex: 1.2, minHeight: 39, borderRadius: 14, backgroundColor: GOLD, borderWidth: 1, borderColor: '#D8B769', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 5 },
  primaryBtnWide: { flex: 1 },
  primaryWide: { marginTop: 18, minHeight: 48, borderRadius: 18, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryText: { fontFamily: F.sansBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.05, color: '#FFFFFF', textTransform: 'uppercase', textAlign: 'center' },
  secondaryBtn: { flex: 1, minHeight: 39, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(197,160,89,0.22)', backgroundColor: '#FFFCF6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 5 },
  secondaryText: { fontFamily: F.sansBold, fontSize: 10, lineHeight: 13, letterSpacing: 0.95, color: '#7D6A4D', textTransform: 'uppercase', textAlign: 'center' },
  disabledBtn: { opacity: 0.58 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 10 },
  emptyStateInline: { borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0EDE6', padding: 22, alignItems: 'center', gap: 10 },
  emptyTitle: { fontFamily: F.serifMedium, fontSize: 21, color: INK, textAlign: 'center' },
  emptyText: { fontFamily: F.serif, fontSize: 14, lineHeight: 21, color: '#8D8A84', textAlign: 'center' },
});
