import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Book,
  CheckSmall,
  ChevronLeft,
  ChevronRight,
} from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { F } from '@/constants/tokens';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { useAppSettings } from '@/components/settings/SettingsContext';
import { normalizeScriptureLanguage } from '@/constants/scripture';
import {
  getScriptureChallengeReaderSession,
  type ScriptureChallengeReaderSession,
  type ScriptureChallengeSessionResult,
} from '@/components/challenges/challengeDb';
import { getScriptureChallengeUnitLabel } from '@/components/scripture/scriptureChallengePlan';
import { BibleVerse, useScripture } from '@/components/scripture/ScriptureContext';
import ScriptureReaderView from '@/components/scripture/ScriptureReaderView';
import { ReadableText } from '@/components/shared/typographyScale';

const BG = '#FCFCFC';
const GOLD = '#C5A059';
const INK = '#1C1917';

type Props = {
  taskInstanceId: string;
  title?: string;
  showFinishLoader?: boolean;
  onBack: () => void;
  onComplete: (readUnits: number) => Promise<ScriptureChallengeSessionResult | null | false>;
};

export default function ScriptureChallengeReaderView({
  taskInstanceId,
  title,
  showFinishLoader = false,
  onBack,
  onComplete,
}: Props) {
  const insets = useSafeAreaInsets();
  const { ready, getChapter } = useScripture();
  const { settings } = useAppSettings();
  const scriptureLanguage = normalizeScriptureLanguage(settings.bibleLang);
  const [session, setSession] = useState<ScriptureChallengeReaderSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [readLimit, setReadLimit] = useState(0);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [chapterLoading, setChapterLoading] = useState(true);
  const chapterNavLockedRef = useRef(false);
  const [chapterNavLocked, setChapterNavLocked] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const lockChapterNavigation = useCallback(() => {
    chapterNavLockedRef.current = true;
    setChapterNavLocked(true);
  }, []);

  const releaseChapterNavigation = useCallback(() => {
    chapterNavLockedRef.current = false;
    setChapterNavLocked(false);
  }, []);

  useEffect(() => {
    let active = true;
    setSessionLoading(true);
    setSessionError(null);
    getScriptureChallengeReaderSession(taskInstanceId)
      .then(next => {
        if (!active) return;
        setSession(next);
        setReadLimit(Math.max(0, next?.plannedUnits.length ?? 0));
        setCursor(0);
        if (!next) setSessionError('This challenge reading could not be loaded.');
      })
      .catch(error => {
        console.warn('Failed to load scripture challenge session', error);
        if (!active) return;
        setSession(null);
        setSessionError('This challenge reading could not be loaded.');
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });

    return () => {
      active = false;
    };
  }, [taskInstanceId]);

  const visibleUnits = useMemo(() => {
    if (!session) return [];
    return session.allUnits.slice(session.startUnitIndex, session.startUnitIndex + readLimit);
  }, [readLimit, session]);

  const currentUnit = visibleUnits[cursor];
  const plannedFirst = session?.plannedUnits[0];
  const plannedLast = session?.plannedUnits[Math.max(0, session.plannedUnits.length - 1)];
  const canGoPrev = cursor > 0;
  const canReadMore = !!session && session.startUnitIndex + readLimit < session.allUnits.length;
  const atVisibleEnd = visibleUnits.length > 0 && cursor >= visibleUnits.length - 1;
  const currentReadUnits = visibleUnits.length > 0 ? cursor + 1 : 0;
  const currentProgress = session ? Math.min(session.progressTotal, session.progressBefore + currentReadUnits) : 0;
  const currentUnitLabel = currentUnit?.noun === 'psalm' ? 'PSALM' : 'CHAPTER';
  const nextButtonLabel = currentUnit?.noun === 'psalm' ? 'NEXT PSALM' : 'NEXT CHAPTER';
  const readMoreLabel = session
    ? `READ ONE MORE ${getScriptureChallengeUnitLabel(session.challenge, 1).toUpperCase()}`
    : 'READ ONE MORE';
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
        if (nextVerses.length === 0) {
          setChapterError('This passage could not be loaded.');
        }
      })
      .catch(error => {
        console.warn('Failed to load scripture challenge chapter', error);
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

  const finish = useCallback(async () => {
    if (!currentUnit || finishing || chapterLoading || chapterNavLockedRef.current) return;
    setFinishing(true);
    try {
      const result = await onComplete(currentReadUnits);
      if (result === false) return;
      onBack();
    } finally {
      setFinishing(false);
    }
  }, [chapterLoading, currentReadUnits, currentUnit, finishing, onBack, onComplete]);

  if (!ready || sessionLoading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator color={GOLD} />
        <Text style={s.loadingText}>Loading Scripture...</Text>
      </View>
    );
  }

  if (sessionError || !session || !currentUnit) {
    return (
      <View style={s.screen}>
        <ScreenTitleBar title={(title ?? 'Scripture Challenge').toUpperCase()} showBack bg={BG} onBackOverride={onBack} />
        <View style={s.emptyState}>
          <Book s={26} c={GOLD} />
          <Text style={s.emptyTitle}>Reading plan unavailable</Text>
          <Text style={s.emptyText}>{sessionError ?? 'There is no reading assigned for this challenge.'}</Text>
        </View>
      </View>
    );
  }

  const challengeDock = (
    <View style={[s.actionDockWrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={s.actionDock}>
        {!atVisibleEnd ? (
          <>
            <TouchableOpacity
              onPress={finish}
              disabled={finishing || chapterControlsDisabled}
              activeOpacity={0.82}
              style={[s.secondaryBtn, (finishing || chapterControlsDisabled) && s.disabledBtn]}
            >
              {showFinishLoader ? (
                <ActivityIndicator size="small" color={GOLD} />
              ) : (
                <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={s.secondaryText}>FINISH EARLY</Text>
              )}
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
                onPress={finish}
                disabled={finishing || chapterControlsDisabled}
                activeOpacity={0.84}
                style={[s.primaryBtn, !canReadMore && s.primaryBtnWide, (finishing || chapterControlsDisabled) && s.disabledBtn]}
              >
                {showFinishLoader ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <CheckSmall s={15} c="#FFFFFF" w={2.6} />
                    <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} style={s.primaryText}>FINISH</Text>
                  </>
                )}
              </TouchableOpacity>
            {canReadMore ? (
              <TouchableOpacity
                onPress={readOneMore}
                disabled={chapterControlsDisabled}
                activeOpacity={0.82}
                style={[s.secondaryBtn, chapterControlsDisabled && s.disabledBtn]}
              >
                <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72} style={s.secondaryText}>{readMoreLabel}</Text>
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
        onBack={onBack}
        canGoPrevChapter={!chapterControlsDisabled && canGoPrev}
        canGoNextChapter={!chapterControlsDisabled && !atVisibleEnd}
        onPrevChapter={goPrev}
        onNextChapter={goNext}
        bottomDock={challengeDock}
        bottomDockHeight={172}
      />
    </>
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

function ChallengeVerseRow({ verse }: { verse: BibleVerse }) {
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
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: F.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  planWrap: {
    paddingHorizontal: 16,
    paddingTop: 13,
    gap: 8,
  },
  planPill: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  planEyebrow: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.8,
    color: '#C5A059',
    marginBottom: 4,
  },
  planText: {
    fontFamily: F.serifMedium,
    fontSize: 18,
    color: INK,
    letterSpacing: 0,
  },
  progressText: {
    alignSelf: 'center',
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: '#A8A29E',
    textTransform: 'uppercase',
  },
  chapterBar: {
    marginTop: 13,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chapterBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterPill: {
    minWidth: 155,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  chapterPillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(197,160,89,0.45)',
  },
  chapterTitle: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.7,
    color: '#8B7354',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 22,
  },
  bookTitle: {
    alignSelf: 'center',
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: '#C5A059',
    marginBottom: 18,
  },
  chapterLoading: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  emptyChapter: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: F.serifMedium,
    fontSize: 20,
    color: INK,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: F.serif,
    fontSize: 15,
    lineHeight: 22,
    color: '#78716C',
    textAlign: 'center',
  },
  verseList: {
    gap: 16,
  },
  verseRow: {
    flexDirection: 'row',
    gap: 11,
    paddingVertical: 6,
    paddingHorizontal: 3,
  },
  verseMarker: {
    width: 26,
    alignItems: 'center',
    paddingTop: 4,
  },
  verseNum: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: '#C5A059',
  },
  verseText: {
    flex: 1,
    fontFamily: F.serif,
    fontSize: 21,
    lineHeight: 28,
    color: '#1F1F1F',
    letterSpacing: 0,
  },
  actionDockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
    backgroundColor: 'transparent',
  },
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
  primaryBtn: {
    flex: 1.2,
    minHeight: 39,
    borderRadius: 14,
    backgroundColor: GOLD,
    borderWidth: 1,
    borderColor: '#D8B769',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  primaryBtnWide: {
    flex: 1,
  },
  primaryText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.05,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 39,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.22)',
    backgroundColor: '#FFFCF6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  secondaryText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.95,
    color: '#7D6A4D',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  disabledBtn: {
    opacity: 0.58,
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,16,12,0.46)',
  },
  celebrationCard: {
    width: '100%',
    maxWidth: 348,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 34,
    elevation: 16,
  },
  celebrationGradient: {
    width: '100%',
    height: 184,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 16,
  },
  trophyStage: {
    width: 196,
    height: 178,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyGlow: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: '#F4C95D',
  },
  celebrationKicker: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: GOLD,
    marginBottom: 8,
  },
  celebrationTitle: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    lineHeight: 29,
    color: INK,
    textAlign: 'center',
    marginBottom: 10,
  },
  celebrationBody: {
    fontFamily: F.serif,
    fontSize: 15,
    lineHeight: 23,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 22,
  },
  continueBtn: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: GOLD,
    alignItems: 'center',
    paddingVertical: 14,
  },
  continueText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: '#FFFFFF',
  },
});
