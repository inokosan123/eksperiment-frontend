import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Book,
  CheckSmall,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Target,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding } from '@/components/shared/titleBar';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import ConfirmModal from '@/components/shared/ConfirmModal';
import type { BibleBook } from '@/constants/scripture';
import type { ScriptureTaskConfig } from '@/components/tasks/taskTypes';
import { BibleVerse, useScripture } from '@/components/scripture/ScriptureContext';
import {
  getBooksForCheckpointKind,
  getScriptureCheckpointKindsForReadingType,
  getScriptureCheckpointReaderSession,
  getScriptureCheckpointTitle,
  getScriptureCheckpointUnits,
  listScriptureCheckpoints,
  setScriptureCheckpointStart,
  type ScriptureCheckpoint,
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
    kind: ScriptureCheckpointKind,
    readUnits: number,
  ) => Promise<ScriptureCheckpointProgressResult | null> | ScriptureCheckpointProgressResult | null;
};

export default function ScriptureCheckpointReaderView({
  readingType = 'custom',
  title,
  plannedCount = 1,
  taskInstanceId,
  onBack,
  onComplete,
}: Props) {
  const insets = useSafeAreaInsets();
  const { ready, getChapter } = useScripture();
  const availableKinds = useMemo(
    () => getScriptureCheckpointKindsForReadingType(readingType),
    [readingType],
  );
  const [checkpoints, setCheckpoints] = useState<ScriptureCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ScriptureCheckpointReaderSession | null>(null);
  const [cursor, setCursor] = useState(0);
  const [readLimit, setReadLimit] = useState(Math.max(1, plannedCount));
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [editingKind, setEditingKind] = useState<ScriptureCheckpointKind | null>(null);

  const loadCheckpoints = useCallback(async () => {
    setLoading(true);
    try {
      const next = await listScriptureCheckpoints(availableKinds);
      setCheckpoints(next);
    } catch (error) {
      console.warn('Failed to load scripture checkpoints', error);
      setCheckpoints([]);
    } finally {
      setLoading(false);
    }
  }, [availableKinds]);

  useEffect(() => {
    void loadCheckpoints();
  }, [loadCheckpoints]);

  const visibleUnits = useMemo(() => {
    if (!session) return [];
    return session.units.slice(session.startUnitIndex, session.startUnitIndex + readLimit);
  }, [readLimit, session]);
  const currentUnit = visibleUnits[cursor];
  const firstUnit = visibleUnits[0];
  const lastUnit = visibleUnits[Math.max(0, visibleUnits.length - 1)];
  const canGoPrev = cursor > 0;
  const canReadMore = !!session && session.startUnitIndex + readLimit < session.units.length;
  const atVisibleEnd = visibleUnits.length > 0 && cursor >= visibleUnits.length - 1;
  const currentReadUnits = visibleUnits.length > 0 ? cursor + 1 : 0;
  const currentProgress = session ? Math.min(session.units.length, session.startUnitIndex + currentReadUnits) : 0;
  const unitLabel = currentUnit?.noun === 'psalm' ? 'PSALM' : 'CHAPTER';
  const nextButtonLabel = currentUnit?.noun === 'psalm' ? 'NEXT PSALM' : 'NEXT CHAPTER';
  const pluralUnit = currentUnit?.noun === 'psalm' ? 'psalms' : 'chapters';
  const finishSubject = firstUnit && lastUnit
    ? `${firstUnit.ref}${firstUnit.ref !== lastUnit.ref ? ` - ${lastUnit.ref}` : ''}`
    : undefined;

  useEffect(() => {
    if (!ready || !currentUnit) return;
    let active = true;
    setChapterLoading(true);
    setChapterError(null);
    getChapter(currentUnit.bookId, currentUnit.chapter, 'en')
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
        if (active) setChapterLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentUnit, getChapter, ready]);

  const startReading = useCallback(async (kind: ScriptureCheckpointKind) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const next = await getScriptureCheckpointReaderSession(kind, plannedCount);
    if (!next) return;
    setSession(next);
    setReadLimit(next.plannedUnits.length || Math.max(1, plannedCount));
    setCursor(0);
    setEditingKind(null);
  }, [plannedCount]);

  const goPrev = useCallback(() => {
    if (!canGoPrev) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setCursor(value => Math.max(0, value - 1));
  }, [canGoPrev]);

  const goNext = useCallback(() => {
    if (!currentUnit || cursor >= visibleUnits.length - 1) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setCursor(value => Math.min(visibleUnits.length - 1, value + 1));
  }, [currentUnit, cursor, visibleUnits.length]);

  const readOneMore = useCallback(() => {
    if (!canReadMore) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setReadLimit(value => value + 1);
    setCursor(value => value + 1);
  }, [canReadMore]);

  const confirmFinish = useCallback(async () => {
    if (!session || !currentUnit || finishing) return;
    setConfirmVisible(false);
    setFinishing(true);
    try {
      await onComplete(session.checkpoint.kind, currentReadUnits);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      onBack();
    } finally {
      setFinishing(false);
    }
  }, [currentReadUnits, currentUnit, finishing, onBack, onComplete, session]);

  const saveStart = useCallback(async (kind: ScriptureCheckpointKind, bookId: number, chapter: number) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    await setScriptureCheckpointStart(kind, bookId, chapter);
    await loadCheckpoints();
    setEditingKind(null);
  }, [loadCheckpoints]);

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
          <Header top={insets.top} title={session.checkpoint.title} onBack={() => setSession(null)} />
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

    return (
      <View style={s.screen}>
        <Header top={insets.top} title={title ?? session.checkpoint.title} onBack={() => setSession(null)} />

        <View style={s.planWrap}>
          <View style={[s.planPill, { borderColor: `${session.checkpoint.accent}33` }]}>
            <Text style={[s.planEyebrow, { color: session.checkpoint.accent }]}>CHECKPOINT</Text>
            <Text style={s.planText} numberOfLines={1} adjustsFontSizeToFit>
              {finishSubject}
            </Text>
          </View>
          <Text style={s.progressText}>
            {currentProgress}/{session.units.length} {pluralUnit}
          </Text>
        </View>

        <ChapterBar
          chapter={currentUnit.chapter}
          label={unitLabel}
          canGoPrev={canGoPrev}
          onPrev={goPrev}
        />

        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 155 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.bookTitle}>{currentUnit.bookName.toUpperCase()}</Text>
          {chapterLoading ? (
            <View style={s.chapterLoading}>
              <ActivityIndicator color={GOLD} />
            </View>
          ) : chapterError ? (
            <View style={s.emptyChapter}>
              <Book s={24} c={GOLD} />
              <Text style={s.emptyTitle}>Scripture is reloading</Text>
              <Text style={s.emptyText}>{chapterError}</Text>
            </View>
          ) : (
            <View style={s.verseList}>
              {verses.map(verse => (
                <VerseRow key={verse.verse} verse={verse} />
              ))}
            </View>
          )}
        </ScrollView>

        <View style={[s.actionDockWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.actionDock}>
            {!atVisibleEnd ? (
              <>
                <TouchableOpacity
                  onPress={() => setConfirmVisible(true)}
                  disabled={finishing}
                  activeOpacity={0.82}
                  style={[s.secondaryBtn, finishing && s.disabledBtn]}
                >
                  <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={s.secondaryText}>FINISH EARLY</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={goNext} activeOpacity={0.84} style={s.primaryBtn}>
                  <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={s.primaryText}>{nextButtonLabel}</Text>
                  <ChevronRight s={16} c="#FFFFFF" w={2.4} />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => setConfirmVisible(true)}
                  disabled={finishing}
                  activeOpacity={0.84}
                  style={[s.primaryBtn, !canReadMore && s.primaryBtnWide, finishing && s.disabledBtn]}
                >
                  <CheckSmall s={15} c="#FFFFFF" w={2.6} />
                  <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={s.primaryText}>CONFIRM</Text>
                </TouchableOpacity>
                {canReadMore ? (
                  <TouchableOpacity onPress={readOneMore} activeOpacity={0.82} style={s.secondaryBtn}>
                    <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72} style={s.secondaryText}>
                      READ ONE MORE
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        </View>

        <ConfirmModal
          visible={confirmVisible}
          icon={<CheckSmall s={24} c="#FFFFFF" w={2.8} />}
          iconBg={GOLD}
          title="Confirm reading?"
          body={`This will move your ${session.checkpoint.title} checkpoint forward by ${currentReadUnits} ${currentReadUnits === 1 ? currentUnit.noun : pluralUnit}.`}
          subject={finishSubject}
          cancelLabel="KEEP READING"
          confirmLabel="CONFIRM"
          confirmColor={GOLD}
          onCancel={() => setConfirmVisible(false)}
          onConfirm={confirmFinish}
        />
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <Header top={insets.top} title={title ?? 'Scripture Checkpoints'} onBack={onBack} />
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
              Choose a checkpoint, read the assigned passage, then confirm it to move the marker forward.
            </Text>
          </View>
        </View>

        {availableKinds.length === 0 ? (
          <View style={s.emptyStateInline}>
            <Book s={24} c={GOLD} />
            <Text style={s.emptyTitle}>No checkpoint path</Text>
            <Text style={s.emptyText}>This reading type does not use checkpoints yet.</Text>
          </View>
        ) : checkpoints.map(checkpoint => (
          <CheckpointCard
            key={checkpoint.kind}
            checkpoint={checkpoint}
            plannedCount={plannedCount}
            editing={editingKind === checkpoint.kind}
            onStart={() => startReading(checkpoint.kind)}
            onToggleEdit={() => setEditingKind(value => value === checkpoint.kind ? null : checkpoint.kind)}
            onSaveStart={saveStart}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Header({
  top,
  title,
  onBack,
}: {
  top: number;
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={[s.header, { paddingTop: getTitleBarTopPadding(top) }]}>
      <View style={s.headerTitleAbs} pointerEvents="none">
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} style={s.headerTitle}>
          {title.toUpperCase()}
        </Text>
      </View>
      <TouchableOpacity onPress={onBack} style={s.headerBtn} activeOpacity={0.7}>
        <ArrowLeft s={24} c="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );
}

function CheckpointCard({
  checkpoint,
  plannedCount,
  editing,
  onStart,
  onToggleEdit,
  onSaveStart,
}: {
  checkpoint: ScriptureCheckpoint;
  plannedCount: number;
  editing: boolean;
  onStart: () => void;
  onToggleEdit: () => void;
  onSaveStart: (kind: ScriptureCheckpointKind, bookId: number, chapter: number) => void | Promise<void>;
}) {
  const nextCopy = checkpoint.nextUnit?.ref ?? 'Complete';
  const units = getScriptureCheckpointUnits(checkpoint.kind);
  const progressPct = units.length ? checkpoint.unitIndex / units.length : 0;
  return (
    <View style={[s.checkpointCard, { borderColor: `${checkpoint.accent}2E` }]}>
      <View style={s.checkpointHead}>
        <View style={[s.checkpointIcon, { backgroundColor: `${checkpoint.accent}14` }]}>
          <Book s={20} c={checkpoint.accent} w={2.1} />
        </View>
        <View style={s.checkpointTitleWrap}>
          <Text style={s.checkpointKicker}>{getScriptureCheckpointTitle(checkpoint.kind)}</Text>
          <Text style={s.checkpointTitle} numberOfLines={1}>{nextCopy}</Text>
          <Text style={s.checkpointMeta}>
            {checkpoint.completed
              ? 'Path complete'
              : `${Math.max(1, plannedCount)} ${checkpoint.kind === 'psalter' ? 'psalm' : 'chapter'}${Math.max(1, plannedCount) === 1 ? '' : 's'} planned`}
          </Text>
        </View>
      </View>
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${Math.min(100, Math.round(progressPct * 100))}%`, backgroundColor: checkpoint.accent }]} />
      </View>
      <View style={s.checkpointActions}>
        <TouchableOpacity onPress={onToggleEdit} activeOpacity={0.82} style={s.secondarySmallBtn}>
          <RotateCcw s={14} c="#8D7C62" w={2.2} />
          <Text style={s.secondarySmallText}>CHANGE START</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onStart}
          disabled={checkpoint.completed}
          activeOpacity={0.84}
          style={[s.startBtn, { backgroundColor: checkpoint.accent }, checkpoint.completed && s.startBtnDisabled]}
        >
          <Text style={s.startText}>{checkpoint.completed ? 'COMPLETE' : 'START'}</Text>
          <ChevronRight s={16} c="#FFFFFF" w={2.3} />
        </TouchableOpacity>
      </View>
      {editing ? (
        <CheckpointStartPicker
          kind={checkpoint.kind}
          accent={checkpoint.accent}
          currentBookId={checkpoint.nextUnit?.bookId}
          currentChapter={checkpoint.nextUnit?.chapter}
          onSave={onSaveStart}
        />
      ) : null}
    </View>
  );
}

function CheckpointStartPicker({
  kind,
  accent,
  currentBookId,
  currentChapter,
  onSave,
}: {
  kind: ScriptureCheckpointKind;
  accent: string;
  currentBookId?: number;
  currentChapter?: number;
  onSave: (kind: ScriptureCheckpointKind, bookId: number, chapter: number) => void | Promise<void>;
}) {
  const books = useMemo(() => getBooksForCheckpointKind(kind), [kind]);
  const initialBook = currentBookId ?? books[0]?.id ?? 40;
  const [bookId, setBookId] = useState(initialBook);
  const book = books.find(item => item.id === bookId) ?? books[0];
  const [chapter, setChapter] = useState(currentChapter ?? 1);

  useEffect(() => {
    const nextBook = currentBookId ?? books[0]?.id ?? 40;
    setBookId(nextBook);
    setChapter(currentChapter ?? 1);
  }, [books, currentBookId, currentChapter]);

  useEffect(() => {
    if (!book) return;
    setChapter(value => Math.min(book.chapters, Math.max(1, value)));
  }, [book]);

  if (!book) return null;

  const chapters = Array.from({ length: book.chapters }, (_, index) => index + 1);

  return (
    <View style={s.pickerBox}>
      <Text style={s.pickerLabel}>START FROM</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.bookChipRow}>
        {books.map(item => {
          const active = item.id === bookId;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
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
              onPress={() => setChapter(item)}
              activeOpacity={0.84}
              style={[s.chapterChip, active && { borderColor: accent, backgroundColor: accent }]}
            >
              <Text style={[s.chapterChipText, active && s.chapterChipTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity onPress={() => onSave(kind, book.id, chapter)} activeOpacity={0.84} style={[s.saveStartBtn, { backgroundColor: accent }]}>
        <Text style={s.saveStartText}>SAVE START POINT</Text>
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
  header: { minHeight: 86, justifyContent: 'flex-end', paddingHorizontal: 18, paddingBottom: 14, backgroundColor: BG },
  headerTitleAbs: { position: 'absolute', left: 70, right: 70, bottom: 16, alignItems: 'center' },
  headerTitle: { fontFamily: F.serifMedium, fontSize: 18, letterSpacing: 2.5, color: INK, textAlign: 'center' },
  headerBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
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
  checkpointCard: {
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    padding: 16,
    gap: 13,
  },
  checkpointHead: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  checkpointIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  checkpointTitleWrap: { flex: 1, minWidth: 0 },
  checkpointKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.6, color: '#A8A29E', textTransform: 'uppercase' },
  checkpointTitle: { marginTop: 3, fontFamily: F.serifMedium, fontSize: 19, color: INK },
  checkpointMeta: { marginTop: 3, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.1, color: '#A8A29E', textTransform: 'uppercase' },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: '#F0EDE6', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  checkpointActions: { flexDirection: 'row', gap: 10 },
  secondarySmallBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#EEE8DE',
    backgroundColor: '#FFFCF7',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondarySmallText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.3, color: '#8D7C62', textTransform: 'uppercase' },
  startBtn: { flex: 1, minHeight: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  startBtnDisabled: { opacity: 0.52 },
  startText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.5, color: '#FFFFFF', textTransform: 'uppercase' },
  pickerBox: { borderRadius: 20, backgroundColor: '#FFFCF7', borderWidth: 1, borderColor: '#F0E3CE', padding: 12, gap: 10 },
  pickerLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.5, color: '#A08A63', textTransform: 'uppercase' },
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
  verseText: { flex: 1, fontFamily: F.serif, fontSize: 19, lineHeight: 31, color: '#2B2723' },
  actionDockWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 16, backgroundColor: 'rgba(252,252,252,0.94)' },
  actionDock: { minHeight: 66, borderRadius: 26, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0EDE6', padding: 8, flexDirection: 'row', gap: 8, shadowColor: '#C5A059', shadowOpacity: 0.13, shadowOffset: { width: 0, height: 12 }, shadowRadius: 26, elevation: 5 },
  primaryBtn: { flex: 1.2, minHeight: 50, borderRadius: 19, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, paddingHorizontal: 10 },
  primaryBtnWide: { flex: 1 },
  primaryWide: { marginTop: 18, minHeight: 48, borderRadius: 18, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, color: '#FFFFFF', textTransform: 'uppercase', textAlign: 'center' },
  secondaryBtn: { flex: 1, minHeight: 50, borderRadius: 19, backgroundColor: '#F8F5EF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  secondaryText: { fontFamily: F.sansBold, fontSize: 9.2, letterSpacing: 1.25, color: '#8D7C62', textTransform: 'uppercase', textAlign: 'center' },
  disabledBtn: { opacity: 0.58 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 10 },
  emptyStateInline: { borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0EDE6', padding: 22, alignItems: 'center', gap: 10 },
  emptyTitle: { fontFamily: F.serifMedium, fontSize: 21, color: INK, textAlign: 'center' },
  emptyText: { fontFamily: F.serif, fontSize: 14, lineHeight: 21, color: '#8D8A84', textAlign: 'center' },
});
