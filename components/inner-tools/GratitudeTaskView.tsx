import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CheckSmall, Plus, X } from '@/components/icons/Icons';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { C, F } from '@/constants/tokens';
import { useTasks } from '@/components/tasks/TaskProvider';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import { queueTaskCompletionReturnAnimation } from '@/components/tasks/taskReturnAnimation';
import { GratitudeEntry, useInnerTools } from './InnerToolsContext';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


type DraftBlessing = {
  title: string;
  content: string;
};

function newId(index: number) {
  return `gratitude_task_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function GratitudeTaskView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    taskInstanceId?: string | string[];
    taskDate?: string | string[];
  }>();
  const taskInstanceId = firstParam(params.taskInstanceId);
  const taskDate = firstParam(params.taskDate) ?? getLocalDateKey();
  const { completeInstance } = useTasks();
  const { gratitudeEntries, upsertGratitudeEntry } = useInnerTools();

  const existingDaily = useMemo(
    () => gratitudeEntries
      .filter(entry => entry.kind === 'daily' && entry.date === taskDate)
      .sort((a, b) => a.createdAt - b.createdAt),
    [gratitudeEntries, taskDate],
  );

  const [items, setItems] = useState<DraftBlessing[]>(
    Array.from({ length: Math.max(1, 3 - existingDaily.length) }, () => ({ title: '', content: '' })),
  );
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const titleRefs = useRef<(TextInput | null)[]>([]);

  const filledItems = items.filter(item => item.title.trim().length > 0);
  const totalCount = existingDaily.length + filledItems.length;
  const canFinish = totalCount >= 3;
  const hasAnyInput = items.some(item => item.title.trim() || item.content.trim());
  const needed = Math.max(0, 3 - totalCount);

  const handleBack = () => {
    if (hasAnyInput) {
      setShowExitConfirm(true);
      return;
    }
    router.back();
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  });

  const updateItem = (index: number, field: keyof DraftBlessing, value: string) => {
    setItems(prev => prev.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    )));
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      updateItem(index, 'title', '');
      updateItem(index, 'content', '');
      return;
    }
    setItems(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const addItem = () => {
    setItems(prev => [...prev, { title: '', content: '' }]);
    requestAnimationFrame(() => {
      titleRefs.current[items.length]?.focus();
    });
  };

  const finishTask = async () => {
    if (!canFinish) return;
    const now = Date.now();

    filledItems.forEach((item, index) => {
      const entry: GratitudeEntry = {
        id: newId(index),
        kind: 'daily',
        title: item.title.trim(),
        content: item.content.trim(),
        date: taskDate,
        createdAt: now + index,
      };
      upsertGratitudeEntry(entry);
    });

    if (taskInstanceId) {
      await completeInstance(taskInstanceId, taskDate);
      queueTaskCompletionReturnAnimation(taskInstanceId);
    } else if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    router.back();
  };

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={handleBack} activeOpacity={0.72} style={s.backBtn}>
          <ArrowLeft s={25} c="#9CA3AF" w={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>GRATITUDE</Text>
        <TouchableOpacity
          onPress={finishTask}
          disabled={!canFinish}
          activeOpacity={0.82}
          style={[s.finishBtn, canFinish && s.finishBtnReady]}
        >
          <Text style={[s.finishText, canFinish && s.finishTextReady]}>FINISH</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 42 }]}
        >
          <View style={s.progressBlock}>
            <Text style={s.progressLabel}>{totalCount} / 3 MINIMUM</Text>
            <View style={s.progressBars}>
              {[0, 1, 2].map(index => (
                <View
                  key={index}
                  style={[s.progressBar, index < Math.min(totalCount, 3) && s.progressBarActive]}
                />
              ))}
            </View>
            {canFinish ? (
              <Text style={s.progressHint}>Ready to finish</Text>
            ) : (
              <Text style={s.progressHint}>
                {needed} more blessing{needed === 1 ? '' : 's'} needed
              </Text>
            )}
          </View>

          {existingDaily.length > 0 && (
            <View style={s.existingBlock}>
              <Text style={s.sectionEyebrow}>ALREADY ADDED TODAY</Text>
              {existingDaily.map(entry => (
                <View key={entry.id} style={s.existingCard}>
                  <View style={s.existingCheck}>
                    <CheckSmall s={12} c="#FFFFFF" w={3} />
                  </View>
                  <Text style={s.existingTitle} numberOfLines={1}>{entry.title}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={s.itemsStack}>
            {existingDaily.length > 0 && <Text style={s.sectionEyebrow}>ADD MORE</Text>}
            {items.map((item, index) => (
              <View key={index} style={s.itemCard}>
                <View style={s.itemTitleRow}>
                  <Text style={s.heart}>♥</Text>
                  <TextInput
                    ref={ref => { titleRefs.current[index] = ref; }}
                    value={item.title}
                    onChangeText={value => updateItem(index, 'title', value)}
                    placeholder="I'm grateful for..."
                    placeholderTextColor="#D9D4CE"
                    autoFocus={index === 0 && existingDaily.length === 0}
                    returnKeyType="next"
                    onSubmitEditing={() => {
                      titleRefs.current[index + 1]?.focus();
                    }}
                    style={s.titleInput}
                  />
                  <TouchableOpacity
                    onPress={() => removeItem(index)}
                    activeOpacity={0.72}
                    hitSlop={8}
                    style={s.clearBtn}
                  >
                    <X s={15} c="#DDD6CE" w={2.3} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={item.content}
                  onChangeText={value => updateItem(index, 'content', value)}
                  placeholder="Description (optional)"
                  placeholderTextColor="#E3DED8"
                  multiline
                  scrollEnabled={false}
                  style={s.contentInput}
                />
              </View>
            ))}

            <TouchableOpacity onPress={addItem} activeOpacity={0.82} style={s.addBtn}>
              <Plus s={16} c="#9CA3AF" w={2.1} />
              <Text style={s.addText}>ADD ANOTHER</Text>
            </TouchableOpacity>
          </View>

          <View style={s.quoteBlock}>
            <Text style={s.quoteText}>
              {'"In everything give thanks; for this is the will of God."'}
            </Text>
            <Text style={s.quoteRef}>1 THESSALONIANS 5:18</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={showExitConfirm}
        icon={<X s={24} c="#BE123C" />}
        iconBg="#FEF2F2"
        title="Leave without finishing?"
        body="Your new entries won't be saved."
        cancelLabel="STAY"
        confirmLabel="LEAVE"
        confirmColor="#BE123C"
        onCancel={() => setShowExitConfirm(false)}
        onConfirm={() => {
          setShowExitConfirm(false);
          router.back();
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FDFBF5',
  },
  header: {
    minHeight: 108,
    paddingHorizontal: 22,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(197,160,89,0.13)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(253,251,245,0.96)',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    position: 'absolute',
    left: 86,
    right: 86,
    bottom: 26,
    textAlign: 'center',
    fontFamily: F.serifMedium,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: 1.4,
    color: C.text,
  },
  finishBtn: {
    minWidth: 88,
    height: 42,
    paddingHorizontal: 17,
    borderRadius: 21,
    backgroundColor: '#F4F2F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishBtnReady: {
    backgroundColor: C.gold,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  finishText: {
    fontFamily: F.sansBold,
    fontSize: 12,
    letterSpacing: 1.8,
    color: '#D1D5DB',
  },
  finishTextReady: {
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 23,
    paddingTop: 26,
  },
  progressBlock: {
    alignItems: 'center',
    paddingBottom: 22,
  },
  progressLabel: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 2.5,
    color: 'rgba(197,160,89,0.72)',
  },
  progressBars: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 7,
  },
  progressBar: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(197,160,89,0.16)',
  },
  progressBarActive: {
    backgroundColor: C.gold,
  },
  progressHint: {
    marginTop: 11,
    fontFamily: F.serifItalic,
    fontSize: 16,
    lineHeight: 20,
    color: '#9CA3AF',
  },
  existingBlock: {
    gap: 10,
    marginBottom: 13,
  },
  sectionEyebrow: {
    paddingHorizontal: 3,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.3,
    color: '#A8A29E',
  },
  existingCard: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0EDE6',
    backgroundColor: 'rgba(255,255,255,0.76)',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    opacity: 0.7,
  },
  existingCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  existingTitle: {
    flex: 1,
    fontFamily: F.serif,
    fontSize: 17,
    color: '#6B625A',
  },
  itemsStack: {
    gap: 14,
  },
  itemCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EEEAE3',
    backgroundColor: '#FFFFFF',
    paddingTop: 15,
    paddingBottom: 13,
    paddingHorizontal: 17,
    shadowColor: '#8C7A4F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 3,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heart: {
    width: 18,
    fontSize: 16,
    lineHeight: 18,
    color: 'rgba(197,160,89,0.62)',
    textAlign: 'center',
    transform: [{ translateY: -1 }],
  },
  titleInput: {
    flex: 1,
    minHeight: 32,
    paddingVertical: 0,
    fontFamily: F.serif,
    fontSize: 18,
    color: '#3D3229',
  },
  clearBtn: {
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentInput: {
    minHeight: 33,
    marginLeft: 30,
    marginTop: 5,
    paddingTop: 0,
    paddingBottom: 0,
    fontFamily: F.serif,
    fontSize: 17,
    lineHeight: 22,
    color: '#80766D',
  },
  addBtn: {
    height: 47,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#DDD6CE',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  addText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: '#9CA3AF',
  },
  quoteBlock: {
    alignItems: 'center',
    paddingTop: 35,
    paddingHorizontal: 16,
  },
  quoteText: {
    maxWidth: 295,
    textAlign: 'center',
    fontFamily: F.serifItalic,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(197,160,89,0.68)',
  },
  quoteRef: {
    marginTop: 9,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: 'rgba(197,160,89,0.46)',
  },
});
