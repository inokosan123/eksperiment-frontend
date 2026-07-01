import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Book,
  CheckSmall,
  ChevronLeft,
  ChevronRight,
  Plus,
  Target,
  Trash2,
  X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import ConfirmModal from '@/components/shared/ConfirmModal';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import { normalizeScriptureLanguage, type BibleBook } from '@/constants/scripture';
import { useAppSettings } from '@/components/settings/SettingsContext';
import type { ScriptureTaskConfig } from '@/components/tasks/taskTypes';
import { BibleVerse, useScripture } from '@/components/scripture/ScriptureContext';
import ScriptureReaderView from '@/components/scripture/ScriptureReaderView';
import {
  createScriptureCheckpoint,
  deleteScriptureCheckpoint,
  getBooksForCheckpointKind,
  getScriptureCheckpointKindsForReadingType,
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

const BG = '#FCFCFC';
const GOLD = '#C5A059';
const INK = '#1C1917';

type Props = {
  readingType?: ScriptureTaskConfig['readingType'] | string;
  title?: string;
  plannedCount?: number;
  taskInstanceId?: string;
  onBack: () => void;
  onComplete: (
    checkpointId: string,
    kind: ScriptureCheckpointKind,
    readUnits: number,
  ) => Promise<ScriptureCheckpointProgressResult | null> | ScriptureCheckpointProgressResult | null;
};

export default function ScriptureCheckpointReaderView({
  readingType,
  title,
  plannedCount = 1,
  taskInstanceId,
  onBack,
  onComplete,
}: Props) {
  const insets = useSafeAreaInsets();
  const { ready, getChapter } = useScripture();
  const { settings } = useAppSettings();
  const scriptureLanguage = normalizeScriptureLanguage(settings.bibleLang);
  const availableKinds = useMemo(
    () => getScriptureCheckpointKindsForReadingType(readingType ?? title ?? 'custom'),
    [readingType, title],
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
      await onComplete(session.checkpoint.id, session.checkpoint.kind, currentReadUnits);
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
        <View style={s.heroCard}>
          <View style={s.heroIcon}>
            <Target s={22} c={GOLD} w={2.2} />
          </View>
          <View style={s.heroTextWrap}>
            <Text style={s.heroKicker}>CHECKPOINT READING</Text>
            <Text style={s.heroTitle}>Continue where you stopped</Text>
            <Text style={s.heroBody}>
              Choose a checkpoint, read the assigned passage, then finish it to move the marker forward.
            </Text>
          </View>
        </View>

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
          const accent = kindCheckpoints[0]?.accent ?? GOLD;
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
  const nextCopy = checkpoint.nextUnit?.ref ?? 'Complete';
  const stoppedCopy = checkpoint.completed ? 'Complete' : nextCopy;
  const canGoBack = checkpoint.availableBackSteps > 0;
  const canGoForward = checkpoint.availableForwardSteps > 0;
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(120)}
      layout={LinearTransition.duration(180)}
      style={[s.checkpointCard, { borderColor: `${checkpoint.accent}2E` }]}
    >
      <TouchableOpacity
        onPress={onDelete}
        haptic="medium"
        activeOpacity={0.78}
        style={s.deleteCheckpointBtn}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Trash2 s={15} c="#DC2626" w={2.05} />
      </TouchableOpacity>
      <View style={s.checkpointHead}>
        <View style={[s.checkpointIcon, { backgroundColor: `${checkpoint.accent}14` }]}>
          <Book s={20} c={checkpoint.accent} w={2.1} />
        </View>
        <View style={s.checkpointTitleWrap}>
          <Text style={s.checkpointTitle} numberOfLines={1}>{checkpoint.name}</Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={[s.checkpointStopped, { color: checkpoint.accent }]}>
            {checkpoint.completed ? 'Reading path complete' : `Stopped at ${stoppedCopy}`}
          </Text>
          <Text numberOfLines={1} ellipsizeMode="tail" style={s.checkpointMeta}>
            {checkpoint.completed
              ? 'Path complete'
              : `${Math.max(1, plannedCount)} ${checkpoint.kind === 'psalter' ? 'psalm' : 'chapter'}${Math.max(1, plannedCount) === 1 ? '' : 's'} planned`}
          </Text>
        </View>
      </View>
      <View style={s.checkpointActions}>
        <View style={s.historyControls}>
          <TouchableOpacity
            onPress={() => onMove('back')}
            disabled={!canGoBack}
            activeOpacity={0.82}
            style={[s.historyBtn, !canGoBack && s.historyBtnDisabled]}
          >
            <ChevronLeft s={17} c={canGoBack ? '#8D7C62' : '#D8D1C7'} w={2.4} />
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[s.historyBtnText, !canGoBack && s.historyBtnTextDisabled]}>
              BACK
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onMove('forward')}
            disabled={!canGoForward}
            activeOpacity={0.82}
            style={[s.historyBtn, !canGoForward && s.historyBtnDisabled]}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[s.historyBtnText, !canGoForward && s.historyBtnTextDisabled]}>
              FORWARD
            </Text>
            <ChevronRight s={17} c={canGoForward ? '#8D7C62' : '#D8D1C7'} w={2.4} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={onStart}
          disabled={checkpoint.completed}
          activeOpacity={0.84}
          style={[s.startBtn, { backgroundColor: checkpoint.accent }, checkpoint.completed && s.startBtnDisabled]}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={s.startText}>{checkpoint.completed ? 'COMPLETE' : 'START'}</Text>
          <ChevronRight s={16} c="#FFFFFF" w={2.3} />
        </TouchableOpacity>
      </View>
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
      <Text style={s.verseText}>{verse.text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG, gap: 12 },
  loadingText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, color: '#A8A29E', textTransform: 'uppercase' },
  selectorContent: { paddingHorizontal: 18, paddingTop: 4, gap: 14 },
  heroCard: {
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0EDE6',
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    shadowColor: '#C5A059',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 2,
  },
  heroIcon: { width: 46, height: 46, borderRadius: 17, backgroundColor: '#FFF7E8', alignItems: 'center', justifyContent: 'center' },
  heroTextWrap: { flex: 1, minWidth: 0 },
  heroKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, color: GOLD, textTransform: 'uppercase' },
  heroTitle: { marginTop: 4, fontFamily: F.serifMedium, fontSize: 20, color: INK },
  heroBody: { marginTop: 5, fontFamily: F.serif, fontSize: 13, lineHeight: 20, color: '#8D8A84' },
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
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
    shadowColor: '#8C7A4F',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 2,
  },
  deleteCheckpointBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F8D7D7',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  checkpointHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  checkpointIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  checkpointTitleWrap: { flex: 1, minWidth: 0, paddingRight: 32 },
  checkpointKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.6, color: '#A8A29E', textTransform: 'uppercase' },
  checkpointTitle: { marginTop: 1, fontFamily: F.serifMedium, fontSize: 19, color: INK },
  checkpointStopped: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 15, lineHeight: 18 },
  checkpointMeta: { marginTop: 1, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 0.85, color: '#A8A29E', textTransform: 'uppercase' },
  checkpointActions: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  historyControls: {
    flex: 1.55,
    minHeight: 40,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#EEE8DE',
    backgroundColor: '#FFFCF7',
    padding: 3,
    flexDirection: 'row',
    gap: 4,
  },
  historyBtn: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    backgroundColor: '#FFFFFF',
  },
  historyBtnDisabled: { backgroundColor: 'transparent' },
  historyBtnText: { fontFamily: F.sansBold, fontSize: 8.4, letterSpacing: 0.9, color: '#8D7C62', textTransform: 'uppercase' },
  historyBtnTextDisabled: { color: '#D8D1C7' },
  startBtn: { flex: 0.82, minHeight: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4, paddingHorizontal: 8 },
  startBtnDisabled: { opacity: 0.52 },
  startText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.5, color: '#FFFFFF', textTransform: 'uppercase' },
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
