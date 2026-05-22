import React, {
  useEffect, useMemo, useState,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Reanimated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Plus, X, CheckSmall, Trash2, Pencil } from '@/components/icons/Icons';
import SharedConfirmModal from '@/components/shared/ConfirmModal';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { playAchievementCompleteFeedback, preloadAchievementFeedbackSound } from '@/components/shared/taskFeedback';
import { C, F } from '@/constants/tokens';
import CelebrationOverlay from './CelebrationOverlay';
import { BucketListItem, useBucketList } from './BucketListContext';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


type ToggleMode = 'check' | 'uncheck';
type ConfirmTone = 'warm' | 'danger';

const ROW_LAYOUT = LinearTransition.duration(210);
const ROW_ENTER = FadeIn.duration(150);
const ROW_EXIT = FadeOut.duration(120);

function feedback(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(style);
  }
}

function formatCompletedDate(ts?: number) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ConfirmationModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone: ConfirmTone;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const warm = tone === 'warm';
  return (
    <SharedConfirmModal
      visible={visible}
      icon={warm ? <CheckSmall s={22} c={C.gold} w={2.8} /> : <Trash2 s={22} c="#EF4444" />}
      iconBg={warm ? '#F7EFE0' : '#FEF2F2'}
      title={title}
      body={message}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      confirmColor={warm ? C.gold : '#EF4444'}
      onCancel={() => { feedback(); onClose(); }}
      onConfirm={() => { feedback(); onConfirm(); onClose(); }}
    />
  );
}

function AddDreamCard({ value, onChange, onAdd }: { value: string; onChange: (v: string) => void; onAdd: () => void }) {
  const enabled = value.trim().length > 0;

  return (
    <View style={add.card}>
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onAdd}
        placeholder="Add a dream or goal..."
        placeholderTextColor="#c9c4ba"
        returnKeyType="done"
        style={add.input}
      />
      <TouchableOpacity
        onPress={onAdd}
        disabled={!enabled}
        activeOpacity={0.82}
        style={[add.btn, !enabled && add.btnDisabled]}
      >
        <Plus s={22} c="#fff" w={2.6} />
      </TouchableOpacity>
    </View>
  );
}

function SectionHeading({ achieved, label, count }: { achieved?: boolean; label: string; count: number }) {
  return (
    <View style={sh.row}>
      {achieved && <Ionicons name="trophy" size={20} color={C.gold} />}
      <Text style={[sh.text, achieved && sh.textAchieved]}>{label}</Text>
      <Text style={[sh.count, achieved && sh.countAchieved]}>({count})</Text>
    </View>
  );
}

function EditableRow({
  item,
  value,
  onChange,
  onSave,
  onCancel,
  completed,
}: {
  item: BucketListItem;
  value: string;
  onChange: (v: string) => void;
  onSave: (item: BucketListItem) => void;
  onCancel: () => void;
  completed?: boolean;
}) {
  const enabled = value.trim().length > 0;

  return (
    <>
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={() => onSave(item)}
        placeholderTextColor="#d1d5db"
        autoFocus
        returnKeyType="done"
        style={[row.editInput, completed && row.editInputCompleted]}
      />
      <TouchableOpacity
        onPress={() => onSave(item)}
        disabled={!enabled}
        activeOpacity={0.8}
        style={[row.smallGoldBtn, !enabled && row.disabledBtn]}
      >
        <CheckSmall s={18} c="#fff" w={3} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel} activeOpacity={0.75} style={row.iconBtn}>
        <X s={18} c="#c8c8c8" w={2.6} />
      </TouchableOpacity>
    </>
  );
}

function DreamRow({
  item,
  editing,
  editingText,
  setEditingText,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onAskToggle,
  onAskDelete,
}: {
  item: BucketListItem;
  editing: boolean;
  editingText: string;
  setEditingText: (v: string) => void;
  onStartEdit: (item: BucketListItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (item: BucketListItem) => void;
  onAskToggle: (item: BucketListItem, mode: ToggleMode) => void;
  onAskDelete: (id: string) => void;
}) {
  return (
    <Reanimated.View
      layout={ROW_LAYOUT}
      entering={ROW_ENTER}
      exiting={ROW_EXIT}
      style={row.card}
    >
      {editing ? (
        <EditableRow
          item={item}
          value={editingText}
          onChange={setEditingText}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
        />
      ) : (
        <>
          <TouchableOpacity
            onPress={() => onAskToggle(item, 'check')}
            activeOpacity={0.75}
            style={row.emptyCheck}
          >
            <View style={row.emptyCheckCore} />
          </TouchableOpacity>
          <Text style={row.text} numberOfLines={3}>{item.text}</Text>
          <TouchableOpacity onPress={() => onStartEdit(item)} activeOpacity={0.75} style={row.iconBtn}>
            <Pencil s={18} c="#c8c8c8" w={2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onAskDelete(item.id)} activeOpacity={0.75} style={row.iconBtn}>
            <Trash2 s={18} c="#c8c8c8" w={2} />
          </TouchableOpacity>
        </>
      )}
    </Reanimated.View>
  );
}

function AchievedRow({
  item,
  editing,
  editingText,
  setEditingText,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onAskToggle,
}: {
  item: BucketListItem;
  editing: boolean;
  editingText: string;
  setEditingText: (v: string) => void;
  onStartEdit: (item: BucketListItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (item: BucketListItem) => void;
  onAskToggle: (item: BucketListItem, mode: ToggleMode) => void;
}) {
  return (
    <Reanimated.View
      layout={ROW_LAYOUT}
      entering={ROW_ENTER}
      exiting={ROW_EXIT}
      style={[row.card, row.completedCard]}
    >
      {editing ? (
        <EditableRow
          item={item}
          value={editingText}
          onChange={setEditingText}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
          completed
        />
      ) : (
        <>
          <TouchableOpacity
            onPress={() => onAskToggle(item, 'uncheck')}
            activeOpacity={0.78}
            style={row.completedCheck}
          >
            <CheckSmall s={15} c="#fff" w={3} />
          </TouchableOpacity>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={row.completedText} numberOfLines={2}>{item.text}</Text>
            {!!item.completedAt && <Text style={row.date}>{formatCompletedDate(item.completedAt)}</Text>}
          </View>
          <TouchableOpacity onPress={() => onStartEdit(item)} activeOpacity={0.75} style={row.iconBtn}>
            <Pencil s={18} c="#c8c8c8" w={2} />
          </TouchableOpacity>
        </>
      )}
    </Reanimated.View>
  );
}

export default function BucketListView() {
  const insets = useSafeAreaInsets();
  const {
    bucketList,
    addBucketItem,
    updateBucketItem,
    completeBucketItem,
    uncompleteBucketItem,
    deleteBucketItem,
  } = useBucketList();

  const [newText, setNewText] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<{ item: BucketListItem; mode: ToggleMode } | null>(null);

  const pending = useMemo(
    () => bucketList.filter(item => !item.isCompleted).sort((a, b) => a.order - b.order),
    [bucketList]
  );
  const completed = useMemo(
    () => bucketList.filter(item => item.isCompleted).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)),
    [bucketList]
  );

  useEffect(() => {
    preloadAchievementFeedbackSound();
  }, []);

  const handleAdd = () => {
    const text = newText.trim();
    if (!text) return;
    feedback();
    addBucketItem({
      id: `bl_${Date.now()}`,
      text,
      isCompleted: false,
      order: pending.length,
      createdAt: Date.now(),
    });
    setNewText('');
  };

  const handleComplete = (id: string) => {
    completeBucketItem(id);
    void playAchievementCompleteFeedback();
    setShowConfetti(false);
    requestAnimationFrame(() => setShowConfetti(true));
  };

  const handleConfirmToggle = () => {
    if (!confirmToggle) return;
    const nextToggle = confirmToggle;
    setConfirmToggle(null);

    if (confirmToggle.mode === 'check') {
      handleComplete(nextToggle.item.id);
      return;
    }

    uncompleteBucketItem(nextToggle.item.id);
  };

  const startEdit = (item: BucketListItem) => {
    feedback();
    setEditingItemId(item.id);
    setEditingText(item.text);
    setDeleteConfirmId(null);
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditingText('');
  };

  const saveEdit = (item: BucketListItem) => {
    const nextText = editingText.trim();
    if (!nextText) return;
    feedback();
    updateBucketItem({ ...item, text: nextText });
    cancelEdit();
  };

  const handleDelete = () => {
    if (!deleteConfirmId) return;
    deleteBucketItem(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const confirmMessage = confirmToggle
    ? `Move "${confirmToggle.item.text}" back to Dreams?`
    : '';

  return (
    <View style={screen.root}>
      <ConfirmationModal
        visible={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={handleConfirmToggle}
        title="Move back to dreams?"
        message={confirmMessage}
        confirmLabel="Move Back"
        tone="warm"
      />

      <ConfirmationModal
        visible={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Item?"
        message="This dream will be permanently removed from your bucket list."
        confirmLabel="Delete"
        tone="danger"
      />

      <ScreenTitleBar title="BUCKET LIST" showBack bg="#FAFAFA" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[screen.content, { paddingBottom: insets.bottom + 128 }]}
          keyboardShouldPersistTaps="handled"
        >
          <AddDreamCard value={newText} onChange={setNewText} onAdd={handleAdd} />

          {pending.length > 0 && (
            <Reanimated.View layout={ROW_LAYOUT} style={section.block}>
              <SectionHeading label="Dreams" count={pending.length} />
              {pending.map(item => (
                <DreamRow
                  key={item.id}
                  item={item}
                  editing={editingItemId === item.id}
                  editingText={editingText}
                  setEditingText={setEditingText}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={saveEdit}
                  onAskToggle={(nextItem, mode) => {
                    if (mode === 'check') {
                      handleComplete(nextItem.id);
                      return;
                    }
                    feedback();
                    setConfirmToggle({ item: nextItem, mode });
                  }}
                  onAskDelete={id => setDeleteConfirmId(id)}
                />
              ))}
            </Reanimated.View>
          )}

          {completed.length > 0 && (
            <Reanimated.View layout={ROW_LAYOUT} style={[section.block, section.achievedBlock]}>
              <SectionHeading achieved label="Achieved" count={completed.length} />
              {completed.map(item => (
                <AchievedRow
                  key={item.id}
                  item={item}
                  editing={editingItemId === item.id}
                  editingText={editingText}
                  setEditingText={setEditingText}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={saveEdit}
                  onAskToggle={(nextItem, mode) => {
                    feedback();
                    setConfirmToggle({ item: nextItem, mode });
                  }}
                />
              ))}
            </Reanimated.View>
          )}

          {bucketList.length === 0 && (
            <View style={empty.wrap}>
              <Text style={empty.title}>Dream big</Text>
              <Text style={empty.sub}>What do you want to achieve in life?</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {showConfetti && <CelebrationOverlay onClose={() => setShowConfetti(false)} />}
    </View>
  );
}

const screen = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 15,
  },
});

const add = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0ECE4',
    shadowColor: '#8B7354',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    paddingLeft: 14,
  },
  input: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 4,
    fontFamily: F.serif,
    fontSize: 17,
    lineHeight: 23,
    color: '#1F2937',
  },
  btn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.3,
  },
});

const section = StyleSheet.create({
  block: {
    gap: 7,
  },
  achievedBlock: {
    marginTop: 1,
  },
});

const sh = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 4,
    marginBottom: 1,
  },
  text: {
    fontFamily: F.serifMedium,
    fontSize: 19,
    lineHeight: 24,
    color: '#111827',
  },
  textAchieved: {
    color: C.gold,
  },
  count: {
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 1.7,
    color: '#9CA3AF',
    textTransform: 'uppercase',
  },
  countAchieved: {
    color: 'rgba(197,160,89,0.62)',
  },
});

const row = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#F0ECE4',
    shadowColor: '#8B7354',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.055,
    shadowRadius: 12,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  completedCard: {
    backgroundColor: '#FFFDF8',
    borderColor: 'rgba(197,160,89,0.22)',
  },
  emptyCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#DDD6C9',
    backgroundColor: '#FFFEFB',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emptyCheckCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(197,160,89,0.12)',
  },
  completedCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontFamily: F.serif,
    fontSize: 17,
    lineHeight: 23,
    color: '#1F2937',
  },
  completedText: {
    fontFamily: F.serif,
    fontSize: 17,
    lineHeight: 23,
    color: '#8F8A81',
    textDecorationLine: 'line-through',
  },
  date: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 9,
    letterSpacing: 0.8,
    color: 'rgba(197,160,89,0.58)',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    fontFamily: F.serif,
    fontSize: 17,
    color: '#1F2937',
  },
  editInputCompleted: {
    backgroundColor: '#fff',
  },
  smallGoldBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.3,
  },
});

const empty = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 80,
    opacity: 0.42,
  },
  title: {
    fontFamily: F.serifMediumItalic,
    fontSize: 19,
    color: '#6B7280',
  },
  sub: {
    marginTop: 8,
    fontFamily: F.sansBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
