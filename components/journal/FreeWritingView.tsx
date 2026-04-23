import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckSmall } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import { FormatState, RichTextEditor, RichTextEditorRef, RichToolbar } from '@/components/shared/RichTextEditor';

const BG = '#FAF7F0';
const TEAL = '#4A9E8F';

export default function FreeWritingView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [html, setHtml] = useState('');
  const [fmt, setFmt] = useState<FormatState>({ bold: false, italic: false, underline: false });
  const [kbHeight, setKbHeight] = useState(0);
  const editorRef = useRef<RichTextEditorRef>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  return (
    <View style={[s.screen, { paddingBottom: kbHeight }]}>
      <View style={[s.header, { paddingTop: getTitleBarTopPadding(insets.top) }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          style={s.headerBtn} activeOpacity={0.7}
        >
          <ArrowLeft s={24} c={C.textMuted} />
        </TouchableOpacity>
        <Text style={s.title}>Free Writing</Text>
        <TouchableOpacity
          style={[s.doneBtn, html.length > 0 && s.doneBtnActive]}
          activeOpacity={0.85}
          onPress={() => {
            if (html.length > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <CheckSmall s={18} c="#fff" w={2.8} />
        </TouchableOpacity>
      </View>

      <RichToolbar editorRef={editorRef} activeFormats={fmt} style={s.toolbar} />

      <RichTextEditor
        ref={editorRef}
        initialHTML={html}
        onChange={setHtml}
        onFormatChange={setFmt}
        placeholder="Write freely without rules or structure..."
        backgroundColor={BG}
        color={C.text}
        style={s.editor}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: BG },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: TITLE_BAR_BOTTOM_PADDING, backgroundColor: BG },
  headerBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:        { fontFamily: F.serifMedium, fontSize: 20, color: C.text },
  doneBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: C.textMuted, alignItems: 'center', justifyContent: 'center' },
  doneBtnActive:{ backgroundColor: TEAL, shadowColor: TEAL, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5 },
  toolbar:      { marginHorizontal: 16, marginBottom: 8 },
  editor:       { flex: 1, marginHorizontal: 16 },
});
