import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft, CheckSmall, Plus, Star, X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import { TextFormatToolbar, TextSelection } from '@/components/shared/TextFormatToolbar';
import { LinedTextInput } from '@/components/shared/LinedTextInput';
import { IdealSelfItem, IdealSelfProfile, useInnerTools } from './InnerToolsContext';

type Step = 'description' | 'gap' | 'change' | 'items' | 'done';

const STEPS: Step[] = ['description', 'gap', 'change', 'items'];
const GOLD = '#C5A059';
const BG = '#FAFAFA';

function newId() {
  return `is_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function IdealSelfView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { idealSelf, saveIdealSelf } = useInnerTools();

  const [step, setStep] = useState<Step>(idealSelf ? 'items' : 'description');
  const [description, setDescription] = useState(idealSelf?.description || '');
  const [gapDescription, setGapDescription] = useState(idealSelf?.gapDescription || '');
  const [changeDescription, setChangeDescription] = useState(idealSelf?.changeDescription || '');
  const [items, setItems] = useState<IdealSelfItem[]>(idealSelf?.items || []);
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    if (!idealSelf) return;

    setDescription(idealSelf.description);
    setGapDescription(idealSelf.gapDescription);
    setChangeDescription(idealSelf.changeDescription);
    setItems(idealSelf.items);
    setStep(prev => prev === 'done' ? prev : 'items');
  }, [idealSelf]);

  const stepIndex = Math.max(0, STEPS.indexOf(step));
  const isDone = step === 'done';
  const isFirst = stepIndex === 0 && !isDone;

  const canProceed = useMemo(() => {
    switch (step) {
      case 'description': return description.trim().length > 0;
      case 'gap': return gapDescription.trim().length > 0;
      case 'change': return changeDescription.trim().length > 0;
      case 'items': return items.length > 0;
      default: return true;
    }
  }, [changeDescription, description, gapDescription, items.length, step]);

  const stepMeta = useMemo(() => {
    switch (step) {
      case 'description':
        return { title: 'Who I Want to Be', sub: 'Describe the person you aspire to become' };
      case 'gap':
        return { title: 'What Separates Me', sub: 'What currently separates you from that person?' };
      case 'change':
        return { title: 'What I Need to Change', sub: 'Name the practical things that must shift' };
      case 'items':
        return { title: 'Daily Commitments', sub: 'Small actions you can honestly check every day' };
      case 'done':
        return { title: 'All Set', sub: 'Your ideal self profile is saved' };
    }
  }, [step]);

  const goBack = () => {
    if (isDone) {
      router.back();
      return;
    }
    if (isFirst) {
      router.back();
      return;
    }
    setStep(STEPS[stepIndex - 1]);
  };

  const goNext = () => {
    if (!canProceed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === 'items') {
      const now = Date.now();
      const profile: IdealSelfProfile = {
        description: description.trim(),
        gapDescription: gapDescription.trim(),
        changeDescription: changeDescription.trim(),
        items,
        createdAt: idealSelf?.createdAt || now,
        updatedAt: now,
      };
      saveIdealSelf(profile);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('done');
      return;
    }
    setStep(STEPS[stepIndex + 1]);
  };

  const addItem = () => {
    const text = newItemText.trim();
    if (!text) return;
    setItems(prev => [...prev, { id: newId(), text, order: prev.length }]);
    setNewItemText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id).map((item, index) => ({ ...item, order: index })));
  };

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: getTitleBarTopPadding(insets.top) }]}>
        <TouchableOpacity onPress={goBack} style={s.headerBtn} activeOpacity={0.7}>
          <ArrowLeft s={24} c={C.textMuted} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>IDEAL SELF</Text>
        <View style={s.headerBtn} />
      </View>

      {!isDone && (
        <View style={s.progressWrap}>
          <View style={s.progressRow}>
            {STEPS.map((item, index) => (
              <View key={item} style={[s.progressTrack, index <= stepIndex && s.progressActive]} />
            ))}
          </View>
          <Text style={s.stepText}>STEP {stepIndex + 1} OF 4</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: isDone ? insets.bottom + 40 : insets.bottom + 130 }]} showsVerticalScrollIndicator={false}>
        <View style={s.titleBlock}>
          <Text style={s.title}>{stepMeta.title}</Text>
          <Text style={s.subtitle}>{stepMeta.sub}</Text>
        </View>

        {step === 'description' && (
          <PromptCard
            value={description}
            onChange={setDescription}
            placeholder="I want to be someone who..."
          />
        )}

        {step === 'gap' && (
          <PromptCard
            value={gapDescription}
            onChange={setGapDescription}
            placeholder="The things holding me back are..."
          />
        )}

        {step === 'change' && (
          <PromptCard
            value={changeDescription}
            onChange={setChangeDescription}
            placeholder="To become that person, I need to..."
          />
        )}

        {step === 'items' && (
          <View>
            <View style={s.itemList}>
              {items.map((item, index) => (
                <View key={item.id} style={s.itemCard}>
                  <View style={s.itemNum}><Text style={s.itemNumText}>{index + 1}</Text></View>
                  <Text style={s.itemText}>{item.text}</Text>
                  <TouchableOpacity onPress={() => removeItem(item.id)} style={s.itemDelete} activeOpacity={0.7}>
                    <X s={17} c="#D6D3D1" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={s.addItemCard}>
              <TextInput
                value={newItemText}
                onChangeText={setNewItemText}
                placeholder="Be more grateful, exercise daily..."
                placeholderTextColor="#D6D3D1"
                style={s.addItemInput}
                onSubmitEditing={addItem}
              />
              <TouchableOpacity onPress={addItem} disabled={!newItemText.trim()} style={[s.addItemBtn, !newItemText.trim() && s.addDisabled]} activeOpacity={0.85}>
                <Plus s={19} c="#fff" />
              </TouchableOpacity>
            </View>

            {items.length === 0 && (
              <Text style={s.emptyText}>Add at least one daily commitment</Text>
            )}
          </View>
        )}

        {step === 'done' && (
          <View style={s.doneBlock}>
            <View style={s.doneIcon}>
              <CheckSmall s={38} c={GOLD} w={2.8} />
            </View>
            <Text style={s.doneTitle}>Profile Saved</Text>
            <Text style={s.doneText}>{"You'll see these commitments in your journal flow. You can edit this anytime."}</Text>

            <View style={s.summaryCard}>
              <SummarySection label="IDEAL SELF" value={description} />
              <SummarySection label="THE GAP" value={gapDescription} />
              <SummarySection label="CHANGE" value={changeDescription} />
              <Text style={s.summaryLabel}>DAILY COMMITMENTS</Text>
              {items.map((item, index) => (
                <View key={item.id} style={s.summaryItem}>
                  <Star s={13} c={GOLD} />
                  <Text style={s.summaryItemText}>{index + 1}. {item.text}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity onPress={() => router.back()} style={s.doneBtn} activeOpacity={0.88}>
              <Text style={s.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {!isDone && (
        <View style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
          {!isFirst && (
            <TouchableOpacity onPress={goBack} style={s.backBtn} activeOpacity={0.85}>
              <Text style={s.backText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={goNext} disabled={!canProceed} style={[s.nextBtn, !canProceed && s.nextDisabled]} activeOpacity={0.88}>
            <Text style={s.nextText}>{step === 'items' ? 'Save' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function PromptCard({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const [selection, setSelection] = useState<TextSelection>({ start: 0, end: 0 });

  return (
    <View style={s.promptCard}>
      <TextFormatToolbar
        value={value}
        selection={selection}
        onChangeText={onChange}
        onSelectionChange={setSelection}
        style={s.promptToolbar}
      />
      <LinedTextInput
        value={value}
        onChangeText={onChange}
        selection={selection}
        onSelectionChange={setSelection}
        placeholder={placeholder}
        placeholderTextColor="#D6D3D1"
        minLines={7}
        lineHeight={28}
        inputStyle={s.promptInput}
      />
    </View>
  );
}

function SummarySection({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summarySection}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryText}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: TITLE_BAR_BOTTOM_PADDING, backgroundColor: 'rgba(250,250,250,0.96)', borderBottomWidth: 1, borderBottomColor: '#F5F5F4' },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: F.serifMedium, fontSize: 23, letterSpacing: 3.2, color: C.text },
  progressWrap: { paddingHorizontal: 24, paddingTop: 16, backgroundColor: BG },
  progressRow: { flexDirection: 'row', gap: 6 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
  progressActive: { backgroundColor: GOLD },
  stepText: { marginTop: 8, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: C.textMuted, textTransform: 'uppercase' },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  titleBlock: { marginBottom: 22 },
  title: { fontFamily: F.serifMedium, fontSize: 28, lineHeight: 33, color: C.text },
  subtitle: { marginTop: 7, fontFamily: F.serif, fontSize: 16, lineHeight: 23, color: C.textMuted },
  promptCard: { borderRadius: 22, borderWidth: 1, borderColor: '#F5F5F4', backgroundColor: '#fff', minHeight: 230, paddingTop: 14, paddingHorizontal: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  promptToolbar: { marginBottom: 10 },
  promptInput: { paddingHorizontal: 0, paddingVertical: 0, fontFamily: F.serif, fontSize: 18, lineHeight: 28, color: C.text },
  itemList: { gap: 11 },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: '#F5F5F4', backgroundColor: '#fff', padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 7, elevation: 2 },
  itemNum: { width: 28, height: 28, borderRadius: 10, backgroundColor: 'rgba(197,160,89,0.12)', alignItems: 'center', justifyContent: 'center' },
  itemNumText: { fontFamily: F.sansBold, fontSize: 12, color: GOLD },
  itemText: { flex: 1, fontFamily: F.serifMedium, fontSize: 17, lineHeight: 22, color: C.text },
  itemDelete: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addItemCard: { marginTop: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 20, borderWidth: 1, borderColor: '#F5F5F4', backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 12 },
  addItemInput: { flex: 1, fontFamily: F.serif, fontSize: 16, color: C.text, paddingVertical: 0 },
  addItemBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  addDisabled: { opacity: 0.32 },
  emptyText: { paddingVertical: 20, textAlign: 'center', fontFamily: F.serifMediumItalic, fontSize: 15, color: C.textMuted },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 12, paddingTop: 12, paddingHorizontal: 22, backgroundColor: 'rgba(250,250,250,0.96)', borderTopWidth: 1, borderTopColor: '#F5F5F4' },
  backBtn: { flex: 1, borderRadius: 18, paddingVertical: 15, alignItems: 'center', backgroundColor: '#F5F5F4' },
  backText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 1.8, color: C.textSecondary, textTransform: 'uppercase' },
  nextBtn: { flex: 1, borderRadius: 18, paddingVertical: 15, alignItems: 'center', backgroundColor: GOLD },
  nextDisabled: { opacity: 0.32 },
  nextText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 1.8, color: '#fff', textTransform: 'uppercase' },
  doneBlock: { alignItems: 'center', paddingTop: 24 },
  doneIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(197,160,89,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  doneTitle: { fontFamily: F.serifMedium, fontSize: 25, color: C.text },
  doneText: { marginTop: 8, fontFamily: F.serif, fontSize: 16, lineHeight: 23, color: C.textMuted, textAlign: 'center', paddingHorizontal: 18 },
  doneBtn: { marginTop: 22, borderRadius: 18, paddingVertical: 15, paddingHorizontal: 46, backgroundColor: GOLD },
  doneBtnText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 2, color: '#fff', textTransform: 'uppercase' },
  summaryCard: { width: '100%', marginTop: 24, borderRadius: 24, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F5F5F4', padding: 18, gap: 13 },
  summarySection: { borderBottomWidth: 1, borderBottomColor: '#F5F5F4', paddingBottom: 12 },
  summaryLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: GOLD, textTransform: 'uppercase', marginBottom: 5 },
  summaryText: { fontFamily: F.serif, fontSize: 15, lineHeight: 22, color: C.textSecondary },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  summaryItemText: { flex: 1, fontFamily: F.serifMedium, fontSize: 15, color: C.text },
});
