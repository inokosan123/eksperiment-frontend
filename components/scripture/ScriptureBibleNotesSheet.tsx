import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Notebook, Trash2, X } from '@/components/icons/Icons';
import ConfirmModal from '@/components/shared/ConfirmModal';
import {
  FormatState,
  RichTextEditor,
  RichTextEditorRef,
  RichToolbar,
} from '@/components/shared/RichTextEditor';
import {
  HapticPressable as Pressable,
  HapticTouchableOpacity as TouchableOpacity,
} from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { ScriptureBibleNote, useScripture } from './ScriptureContext';

const GOLD = '#C5A059';
const SHEET_BG = '#FDFBF5';
const HEADER_HEIGHT = 64;
const AUTOSAVE_DELAY_MS = 900;
const SHEET_SPRING = { damping: 24, stiffness: 260, mass: 0.82 };
const ENTRY_SPRING = { damping: 20, stiffness: 250, mass: 0.78 };
const EXPANDED_ENTRY_DELAY_MS = 70;
const EXPANDED_ENTRY_DURATION_MS = 440;
const COLLAPSED_ENTRY_DELAY_MS = 560;
const ENTRY_EASING = Easing.bezier(0.22, 1, 0.36, 1);

type SaveState = 'saved' | 'unsaved' | 'saving' | 'error';

type DraftSnapshot = {
  referenceKey: string;
  bookId: number;
  chapter: number;
  observations: string;
  lessons: string;
  application: string;
  dirty: boolean;
};

type Props = {
  bookId: number;
  bookName: string;
  chapter: number;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onClose: () => void;
};

function noteForReference(
  notes: ScriptureBibleNote[],
  bookId: number,
  chapter: number,
) {
  return notes.find(note => note.bookId === bookId && note.chapter === chapter);
}

export default function ScriptureBibleNotesSheet({
  bookId,
  bookName,
  chapter,
  expanded,
  onExpandedChange,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { bibleNotes, saveBibleNote, deleteBibleNote } = useScripture();
  const referenceKey = bookId + ':' + chapter;
  const initialNote = noteForReference(bibleNotes, bookId, chapter);

  const expandedTop = insets.top + 99;
  const sheetHeight = Math.max(360, height - expandedTop);
  const collapsedVisibleHeight = HEADER_HEIGHT + insets.bottom;
  const collapsedOffset = Math.max(0, sheetHeight - collapsedVisibleHeight);
  const hiddenOffset = sheetHeight + 14;

  const [observations, setObservations] = useState(initialNote?.observations ?? '');
  const [lessons, setLessons] = useState(initialNote?.lessons ?? '');
  const [application, setApplication] = useState(initialNote?.application ?? '');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [bodyMounted, setBodyMounted] = useState(expanded);

  const notesRef = useRef(bibleNotes);
  notesRef.current = bibleNotes;
  const hasPresentedRef = useRef(false);
  const initiallyExpandedRef = useRef(expanded);
  const mountedRef = useRef(true);
  const loadedReferenceRef = useRef(referenceKey);
  const saveVersionRef = useRef(0);
  const draftRef = useRef<DraftSnapshot>({
    referenceKey,
    bookId,
    chapter,
    observations: initialNote?.observations ?? '',
    lessons: initialNote?.lessons ?? '',
    application: initialNote?.application ?? '',
    dirty: false,
  });

  const translateY = useSharedValue(
    initiallyExpandedRef.current ? collapsedOffset : hiddenOffset,
  );
  const dragStartY = useSharedValue(0);
  const maxOffset = useSharedValue(collapsedOffset);

  useEffect(() => {
    if (expanded) setBodyMounted(true);
    maxOffset.value = collapsedOffset;

    if (!hasPresentedRef.current) {
      hasPresentedRef.current = true;
      translateY.value = initiallyExpandedRef.current
        ? withDelay(
          EXPANDED_ENTRY_DELAY_MS,
          withTiming(0, {
            duration: EXPANDED_ENTRY_DURATION_MS,
            easing: ENTRY_EASING,
          }),
        )
        : withDelay(
          COLLAPSED_ENTRY_DELAY_MS,
          withSpring(collapsedOffset, ENTRY_SPRING),
        );
      return;
    }

    translateY.value = withSpring(expanded ? 0 : collapsedOffset, SHEET_SPRING);
  }, [collapsedOffset, expanded, maxOffset, translateY]);

  const persistSnapshot = useCallback(async (snapshot: DraftSnapshot) => {
    await saveBibleNote(
      snapshot.bookId,
      snapshot.chapter,
      snapshot.observations.trim(),
      snapshot.lessons.trim(),
      snapshot.application.trim(),
    );
  }, [saveBibleNote]);

  const persistCurrentDraft = useCallback(() => {
    const snapshot = { ...draftRef.current };
    if (!snapshot.dirty) return Promise.resolve();

    const version = ++saveVersionRef.current;
    draftRef.current = { ...draftRef.current, dirty: false };
    if (mountedRef.current) setSaveState('saving');

    return persistSnapshot(snapshot)
      .then(() => {
        if (!mountedRef.current) return;
        const current = draftRef.current;
        if (
          version === saveVersionRef.current
          && current.referenceKey === snapshot.referenceKey
          && !current.dirty
        ) {
          setSaveState('saved');
        }
      })
      .catch(error => {
        const current = draftRef.current;
        if (current.referenceKey === snapshot.referenceKey) {
          draftRef.current = { ...current, dirty: true };
        }
        if (mountedRef.current) setSaveState('error');
        console.warn('Failed to autosave Bible note', error);
      });
  }, [persistSnapshot]);

  useEffect(() => {
    if (loadedReferenceRef.current === referenceKey) return;

    const previous = { ...draftRef.current };
    if (previous.dirty) {
      void persistSnapshot(previous).catch(error => {
        console.warn('Failed to save Bible note while changing chapter', error);
      });
    }

    const nextNote = noteForReference(notesRef.current, bookId, chapter);
    const nextDraft: DraftSnapshot = {
      referenceKey,
      bookId,
      chapter,
      observations: nextNote?.observations ?? '',
      lessons: nextNote?.lessons ?? '',
      application: nextNote?.application ?? '',
      dirty: false,
    };
    loadedReferenceRef.current = referenceKey;
    draftRef.current = nextDraft;
    setObservations(nextDraft.observations);
    setLessons(nextDraft.lessons);
    setApplication(nextDraft.application);
    setSaveState('saved');
    setDeleteVisible(false);
  }, [bookId, chapter, persistSnapshot, referenceKey]);

  useEffect(() => {
    if (!draftRef.current.dirty) return undefined;
    const timer = setTimeout(() => {
      void persistCurrentDraft();
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [application, lessons, observations, persistCurrentDraft]);

  useEffect(() => {
    if (expanded) return;
    Keyboard.dismiss();
    void persistCurrentDraft();
  }, [expanded, persistCurrentDraft]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const finalDraft = { ...draftRef.current };
      if (finalDraft.dirty) {
        void persistSnapshot(finalDraft).catch(error => {
          console.warn('Failed to save Bible note while closing reader', error);
        });
      }
    };
  }, [persistSnapshot]);

  const updateDraft = useCallback((
    field: 'observations' | 'lessons' | 'application',
    value: string,
  ) => {
    draftRef.current = { ...draftRef.current, [field]: value, dirty: true };
    if (field === 'observations') setObservations(value);
    if (field === 'lessons') setLessons(value);
    if (field === 'application') setApplication(value);
    setSaveState('unsaved');
  }, []);

  const handleExpandedChange = useCallback((nextExpanded: boolean) => {
    if (nextExpanded) setBodyMounted(true);
    onExpandedChange(nextExpanded);
    Haptics.selectionAsync().catch(() => {});
  }, [onExpandedChange]);

  const ensureBodyMounted = useCallback(() => {
    setBodyMounted(true);
  }, []);

  const headerGesture = useMemo(() => Gesture.Pan()
    .activeOffsetY([-5, 5])
    .onBegin(() => {
      runOnJS(ensureBodyMounted)();
      dragStartY.value = translateY.value;
    })
    .onUpdate(event => {
      translateY.value = Math.max(
        0,
        Math.min(maxOffset.value, dragStartY.value + event.translationY),
      );
    })
    .onEnd(event => {
      const shouldExpand = event.velocityY < -420
        || (event.velocityY < 420 && translateY.value < maxOffset.value * 0.5);
      translateY.value = withSpring(shouldExpand ? 0 : maxOffset.value, SHEET_SPRING);
      runOnJS(handleExpandedChange)(shouldExpand);
    }), [dragStartY, ensureBodyMounted, handleExpandedChange, maxOffset, translateY]);

  const sheetMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleClose = () => {
    Keyboard.dismiss();
    void persistCurrentDraft();
    onClose();
  };

  const handleDelete = () => {
    const target = { ...draftRef.current };
    const emptyDraft: DraftSnapshot = {
      ...target,
      observations: '',
      lessons: '',
      application: '',
      dirty: false,
    };
    draftRef.current = emptyDraft;
    setObservations('');
    setLessons('');
    setApplication('');
    setSaveState('saved');
    setDeleteVisible(false);
    void deleteBibleNote(target.bookId, target.chapter).catch(error => {
      console.warn('Failed to delete Bible note', error);
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const hasContent = !!(
    observations.trim()
    || lessons.trim()
    || application.trim()
  );
  const statusLabel = saveState === 'saving'
    ? 'SAVING'
    : saveState === 'unsaved'
      ? 'AUTOSAVING'
      : saveState === 'error'
        ? 'SAVE FAILED'
        : 'SAVED';
  const sheetSubtitle = expanded
    ? bookName.toUpperCase() + ' ' + chapter + '  |  ' + statusLabel
    : bookName.toUpperCase() + ' ' + chapter + '  |  PULL UP TO WRITE';

  return (
    <View pointerEvents='box-none' style={StyleSheet.absoluteFill}>
      <Reanimated.View
        accessibilityViewIsModal={expanded}
        style={[
          sheetStyles.sheet,
          { top: expandedTop },
          sheetMotionStyle,
        ]}
      >
        <View pointerEvents='none' style={sheetStyles.topOutline} />

        <GestureDetector gesture={headerGesture}>
          <Reanimated.View style={sheetStyles.header}>
            <View style={sheetStyles.grabber} />
            <Pressable
              haptic='none'
              onPress={() => handleExpandedChange(!expanded)}
              accessibilityRole='button'
              accessibilityLabel={expanded ? 'Collapse Bible Notes' : 'Expand Bible Notes'}
              style={sheetStyles.headerTitleButton}
            >
              <View style={sheetStyles.headerIcon}>
                <Notebook s={18} c={GOLD} />
              </View>
              <View style={sheetStyles.headerCopy}>
                <Text style={sheetStyles.headerTitle}>BIBLE NOTES</Text>
                <Text
                  numberOfLines={1}
                  style={[
                    sheetStyles.headerSubtitle,
                    saveState === 'error' && sheetStyles.headerSubtitleError,
                  ]}
                >
                  {sheetSubtitle}
                </Text>
              </View>
            </Pressable>
            <TouchableOpacity
              onPress={handleClose}
              accessibilityRole='button'
              accessibilityLabel='Close Bible Notes'
              activeOpacity={0.72}
              style={sheetStyles.closeButton}
            >
              <X s={19} c='#8B8176' />
            </TouchableOpacity>
          </Reanimated.View>
        </GestureDetector>

        {bodyMounted && <ScrollView
          pointerEvents={expanded ? 'auto' : 'none'}
          scrollEnabled={expanded}
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode='interactive'
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            sheetStyles.content,
            { paddingBottom: insets.bottom + 38 },
          ]}
        >
          <View style={sheetStyles.referenceCard}>
            <View style={sheetStyles.referenceRule} />
            <View style={sheetStyles.referenceCopy}>
              <Text style={sheetStyles.referenceKicker}>CHAPTER STUDY NOTE</Text>
              <Text style={sheetStyles.referenceTitle}>{bookName} {chapter}</Text>
            </View>
            <Text style={sheetStyles.autosaveText}>AUTO-SAVE</Text>
          </View>

          <BibleNoteSheetField
            label='OBSERVATIONS'
            editorKey={referenceKey + '-observations'}
            value={observations}
            onChange={value => updateDraft('observations', value)}
            placeholder='What do you notice in this chapter?'
          />
          <BibleNoteSheetField
            label='LESSONS'
            editorKey={referenceKey + '-lessons'}
            value={lessons}
            onChange={value => updateDraft('lessons', value)}
            placeholder='What is God teaching here?'
          />
          <BibleNoteSheetField
            label='APPLICATION'
            editorKey={referenceKey + '-application'}
            value={application}
            onChange={value => updateDraft('application', value)}
            placeholder='How will you live this today?'
          />

          {hasContent && (
            <TouchableOpacity
              onPress={() => setDeleteVisible(true)}
              activeOpacity={0.78}
              style={sheetStyles.deleteButton}
            >
              <Trash2 s={17} c={C.red} />
              <Text style={sheetStyles.deleteText}>DELETE NOTE</Text>
            </TouchableOpacity>
          )}
        </ScrollView>}

        {bodyMounted && <ConfirmModal
          visible={deleteVisible}
          embedded
          icon={<Trash2 s={22} c={C.red} />}
          iconBg='#FEF2F2'
          title='Delete this Bible note?'
          body='This will permanently delete your note for this chapter.'
          confirmLabel='DELETE'
          onCancel={() => setDeleteVisible(false)}
          onConfirm={handleDelete}
        />}
      </Reanimated.View>
    </View>
  );
}

function BibleNoteSheetField({
  label,
  editorKey,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  editorKey: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const editorRef = useRef<RichTextEditorRef>(null);
  const [formats, setFormats] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
  });

  return (
    <View style={sheetStyles.fieldCard}>
      <Text style={sheetStyles.fieldLabel}>{label}</Text>
      <RichToolbar
        editorRef={editorRef}
        activeFormats={formats}
        style={sheetStyles.fieldToolbar}
      />
      <RichTextEditor
        key={editorKey}
        contentKey={editorKey}
        ref={editorRef}
        initialHTML={value}
        onChange={onChange}
        onFormatChange={setFormats}
        placeholder={placeholder}
        backgroundColor='#FFFEFB'
        color='#3D3229'
        style={sheetStyles.fieldEditor}
      />
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    overflow: 'hidden',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 0,
    backgroundColor: SHEET_BG,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 22,
  },
  topOutline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -3,
    zIndex: 6,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: 'rgba(132,93,29,0.68)',
  },
  header: {
    height: HEADER_HEIGHT,
    paddingTop: 8,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(197,160,89,0.19)',
    backgroundColor: '#FFFDF7',
  },
  grabber: {
    position: 'absolute',
    top: 6,
    left: '50%',
    width: 40,
    height: 4,
    marginLeft: -20,
    borderRadius: 2,
    backgroundColor: 'rgba(139,129,118,0.40)',
  },
  headerTitleButton: {
    flex: 1,
    minWidth: 0,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 3,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.27)',
    backgroundColor: 'rgba(197,160,89,0.11)',
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerTitle: {
    fontFamily: F.serifMedium,
    fontSize: 17.5,
    lineHeight: 20,
    letterSpacing: 2.4,
    color: '#342C26',
  },
  headerSubtitle: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    lineHeight: 12,
    letterSpacing: 1.25,
    color: '#A19486',
  },
  headerSubtitleError: {
    color: C.red,
  },
  closeButton: {
    width: 40,
    height: 44,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139,129,118,0.20)',
    backgroundColor: 'rgba(255,255,255,0.90)',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 13,
  },
  referenceCard: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFFDF8',
  },
  referenceRule: {
    width: 5,
    height: 32,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  referenceCopy: {
    flex: 1,
    minWidth: 0,
  },
  referenceKicker: {
    fontFamily: F.sansBold,
    fontSize: 8.5,
    lineHeight: 12,
    letterSpacing: 1.8,
    color: GOLD,
  },
  referenceTitle: {
    marginTop: 2,
    fontFamily: F.serifMedium,
    fontSize: 18,
    lineHeight: 22,
    color: '#3D3229',
  },
  autosaveText: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.25,
    color: '#B7AD9F',
  },
  fieldCard: {
    minHeight: 310,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(232,220,196,0.84)',
    backgroundColor: '#FFFDF8',
    padding: 15,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 1,
  },
  fieldLabel: {
    marginBottom: 9,
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 2.05,
    color: GOLD,
  },
  fieldToolbar: {
    marginBottom: 8,
  },
  fieldEditor: {
    height: 220,
  },
  deleteButton: {
    alignSelf: 'center',
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(190,18,60,0.14)',
    backgroundColor: '#FEF2F2',
  },
  deleteText: {
    fontFamily: F.sansBold,
    fontSize: 9.5,
    letterSpacing: 1.7,
    color: C.red,
  },
});
