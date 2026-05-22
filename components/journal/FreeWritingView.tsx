import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { CheckSmall } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { FormatState, RichTextEditor, RichTextEditorRef, RichToolbar } from '@/components/shared/RichTextEditor';
import { useJournal } from '@/components/journal/JournalContext';
import { stripRichTextToPlainText } from '@/components/journal/journalLogic';
import { useTasks } from '@/components/tasks/TaskProvider';
import { queueTaskCompletionReturnAnimation } from '@/components/tasks/taskReturnAnimation';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


const BG = '#FAF7F0';
const TEAL = '#4A9E8F';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function FreeWritingView() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    date?: string;
    readOnly?: string;
    title?: string;
    isTask?: string;
    taskInstanceId?: string;
    taskDate?: string;
  }>();
  const selectedDateKey = typeof params.date === 'string' && params.date ? params.date : todayKey();
  const isReadOnly = params.readOnly === '1' || params.readOnly === 'true';
  const isTaskLaunch = params.isTask === 'true' || !!params.taskInstanceId;
  const taskTitle = typeof params.title === 'string' && params.title.trim() ? params.title.trim() : 'Free Writing';
  const { ready: journalReady, getEntry, upsertEntry } = useJournal();
  const { completeInstance } = useTasks();
  const [html, setHtml] = useState('');
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, underline: false });
  const [kbHeight, setKbHeight] = useState(0);
  const [editorContentKey, setEditorContentKey] = useState(`free:${selectedDateKey}:pending`);
  const editorRef = useRef<RichTextEditorRef>(null);
  const hydratedDateRef = useRef('');
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    hydratedDateRef.current = '';
    dirtyRef.current = false;
    setEditorContentKey(`free:${selectedDateKey}:pending`);
  }, [selectedDateKey]);

  useEffect(() => {
    if (!journalReady || hydratedDateRef.current === selectedDateKey) return;
    const entry = getEntry(selectedDateKey);
    setHtml(entry.freeWritingHtml ?? '');
    setEditorContentKey(`free:${selectedDateKey}:${entry.updatedAt || 0}`);
    hydratedDateRef.current = selectedDateKey;
    dirtyRef.current = false;
  }, [journalReady, selectedDateKey, getEntry]);

  useEffect(() => {
    if (isReadOnly) return;
    if (!dirtyRef.current || hydratedDateRef.current !== selectedDateKey) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void upsertEntry(selectedDateKey, { freeWritingHtml: html }).then(() => {
        dirtyRef.current = false;
      }).catch(error => {
        console.warn('Free writing autosave failed', error);
      });
    }, 350);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [html, isReadOnly, selectedDateKey, upsertEntry]);

  const saveNow = async () => {
    if (isReadOnly) return;
    if (!dirtyRef.current || hydratedDateRef.current !== selectedDateKey) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await upsertEntry(selectedDateKey, { freeWritingHtml: html });
    dirtyRef.current = false;
  };

  const finish = async () => {
    const hasContent = stripRichTextToPlainText(html).length > 0;
    const shouldCompleteTask = isTaskLaunch && !!params.taskInstanceId && hasContent;
    if (!shouldCompleteTask) {
      if (hasContent) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await saveNow();
    if (shouldCompleteTask && params.taskInstanceId) {
      const completionDate = params.taskDate ?? selectedDateKey;
      await completeInstance(params.taskInstanceId, completionDate);
      queueTaskCompletionReturnAnimation(params.taskInstanceId, 420);
    }
    router.back();
  };

  return (
    <View style={[s.screen, { paddingBottom: kbHeight }]}>
      <ScreenTitleBar
        title={taskTitle.toUpperCase()}
        showBack
        bg={BG}
        onBackOverride={() => router.back()}
        rightElement={isReadOnly ? undefined : (
          <TouchableOpacity
            style={[s.doneBtn, stripRichTextToPlainText(html).length > 0 && s.doneBtnActive]}
            activeOpacity={0.85}
            onPress={() => { void finish(); }}
          >
            <CheckSmall s={18} c="#fff" w={2.8} />
          </TouchableOpacity>
        )}
      />

      {!isReadOnly && <RichToolbar editorRef={editorRef} activeFormats={fmt} style={s.toolbar} />}

      <RichTextEditor
        key={selectedDateKey}
        ref={editorRef}
        initialHTML={html}
        contentKey={editorContentKey}
        onChange={(value) => {
          if (isReadOnly) return;
          dirtyRef.current = true;
          setHtml(value);
        }}
        onFormatChange={setFmt}
        placeholder="Write freely without rules or structure..."
        backgroundColor={BG}
        color={C.text}
        editable={!isReadOnly}
        style={s.editor}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: BG },
  doneBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: C.textMuted, alignItems: 'center', justifyContent: 'center' },
  doneBtnActive:{ backgroundColor: TEAL, shadowColor: TEAL, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5 },
  toolbar:      { marginHorizontal: 16, marginBottom: 8 },
  editor:       { flex: 1, marginHorizontal: 16 },
});
