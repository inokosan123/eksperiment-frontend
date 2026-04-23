import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, FileEdit, CheckSmall } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import { TextFormatToolbar, TextSelection } from '@/components/shared/TextFormatToolbar';
import { LinedTextInput } from '@/components/shared/LinedTextInput';

const BG = '#FAF7F0';
const TEAL = '#4A9E8F';

export default function FreeWritingView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [text, setText] = useState('');
  const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });
  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={[hd.wrap, { paddingTop: getTitleBarTopPadding(insets.top) }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          style={hd.btn} activeOpacity={0.7}
        >
          <ArrowLeft s={24} c={C.textMuted} />
        </TouchableOpacity>
        <Text style={hd.title}>Free Writing</Text>
        <View style={hd.btn} />
      </View>

      <Text style={dt.date}>
        Wed, April 22
      </Text>

      <TextFormatToolbar
        value={text}
        selection={selection}
        onChangeText={setText}
        onSelectionChange={setSelection}
        style={fmt.toolbar}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View style={wr.wrap}>
          {text.length === 0 && (
            <View style={wr.placeholder}>
              <FileEdit s={32} c={TEAL} w={1.5} />
              <Text style={wr.placeholderTitle}>Write freely without rules or structure</Text>
              <Text style={wr.prompt}>Express whatever comes to mind - thoughts, ideas, reflections.</Text>
            </View>
          )}
          <LinedTextInput
            placeholder=""
            value={text}
            onChangeText={setText}
            selection={selection}
            onSelectionChange={setSelection}
            minLines={11}
            lineHeight={34}
            inputStyle={wr.input}
            autoCorrect={false}
          />
        </View>
      </ScrollView>

      <View style={[bb.wrap, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={bb.count}>{wordCount} words</Text>
        <TouchableOpacity
          style={[bb.doneBtn, text.length > 0 && bb.doneBtnActive]}
          activeOpacity={0.85}
          onPress={() => {
            if (text.length > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <CheckSmall s={18} c="#fff" w={2.8} />
          <Text style={bb.doneTxt}>{text.length > 0 ? 'Done' : 'Close'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const hd = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: TITLE_BAR_BOTTOM_PADDING, backgroundColor: BG },
  btn:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.serifMedium, fontSize: 20, color: C.text },
});

const dt = StyleSheet.create({
  date: { textAlign: 'center', fontFamily: F.serifMediumItalic, fontSize: 15, color: C.textMuted, marginBottom: 8 },
});

const fmt = StyleSheet.create({
  toolbar: { marginHorizontal: 16, marginBottom: 10 },
});

const wr = StyleSheet.create({
  wrap:             { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#EDE9E0', minHeight: 400, padding: 18 },
  placeholder:      { alignItems: 'center', gap: 12, paddingTop: 40, paddingHorizontal: 20 },
  placeholderTitle: { fontFamily: F.serifMedium, fontSize: 18, color: C.textSecondary, textAlign: 'center', lineHeight: 26 },
  prompt:           { fontFamily: F.serifMediumItalic, fontSize: 16, color: C.textMuted, textAlign: 'center', lineHeight: 24 },
  input:            { fontFamily: F.serif, fontSize: 18, color: C.text, lineHeight: 34 },
});

const bb = StyleSheet.create({
  wrap:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, backgroundColor: BG, borderTopWidth: 1, borderTopColor: 'rgba(74,158,143,0.1)' },
  count:         { fontFamily: F.sans, fontSize: 15, color: C.textMuted },
  doneBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.textMuted, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 14 },
  doneBtnActive: { backgroundColor: TEAL, shadowColor: TEAL, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5 },
  doneTxt:       { fontFamily: F.sansBold, fontSize: 15, color: '#fff' },
});
