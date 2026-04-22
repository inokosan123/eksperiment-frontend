import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, FileEdit, CheckSmall } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

const BG   = '#FAF7F0';
const TEAL = '#4A9E8F';

export default function FreeWritingView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [text, setText] = useState('');
  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={[hd.wrap, { paddingTop: Math.max(insets.top, 24) + 10 }]}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          style={hd.btn} activeOpacity={0.7}
        >
          <ArrowLeft s={22} c={C.textMuted} />
        </TouchableOpacity>
        <Text style={hd.title}>Free Writing</Text>
        <View style={hd.btn} />
      </View>

      {/* Date */}
      <Text style={{ textAlign: 'center', fontFamily: F.serifMediumItalic, fontSize: 13, color: C.textMuted, marginBottom: 8 }}>
        Wed, April 22
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        <View style={wr.wrap}>
          {text.length === 0 && (
            <View style={wr.placeholder}>
              <FileEdit s={28} c={TEAL} w={1.5} />
              <Text style={wr.placeholderTitle}>Write freely without rules or structure</Text>
              <Text style={wr.prompt}>Express whatever comes to mind — thoughts, ideas, reflections.</Text>
            </View>
          )}
          <TextInput
            style={wr.input}
            multiline
            placeholder=""
            value={text}
            onChangeText={setText}
            autoCorrect={false}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>

      {/* Bottom bar */}
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
          <CheckSmall s={16} c="#fff" w={2.8} />
          <Text style={bb.doneTxt}>{text.length > 0 ? 'Done' : 'Close'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const hd = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 4, backgroundColor: BG },
  btn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: F.serifMedium, fontSize: 18, color: C.text },
});

const wr = StyleSheet.create({
  wrap:             { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#EDE9E0', minHeight: 400, padding: 18 },
  placeholder:      { alignItems: 'center', gap: 12, paddingTop: 40, paddingHorizontal: 20 },
  placeholderTitle: { fontFamily: F.serifMedium, fontSize: 16, color: C.textSecondary, textAlign: 'center', lineHeight: 24 },
  prompt:           { fontFamily: F.serifMediumItalic, fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 21 },
  input:            { fontFamily: F.serif, fontSize: 16, color: C.text, lineHeight: 32, minHeight: 320 },
});

const bb = StyleSheet.create({
  wrap:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, backgroundColor: BG, borderTopWidth: 1, borderTopColor: 'rgba(74,158,143,0.1)' },
  count:          { fontFamily: F.sans, fontSize: 13, color: C.textMuted },
  doneBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.textMuted, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 14 },
  doneBtnActive:  { backgroundColor: TEAL, shadowColor: TEAL, shadowOffset:{width:0,height:3}, shadowOpacity:0.35, shadowRadius:8, elevation:5 },
  doneTxt:        { fontFamily: F.sansBold, fontSize: 14, color: '#fff' },
});
