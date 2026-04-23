import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Plus, X, CheckSmall, Trash2, PartyPopper, Pencil } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import CelebrationOverlay from './CelebrationOverlay';
import { BucketListItem, useBucketList } from './BucketListContext';

type ToggleMode = 'check' | 'uncheck';
type ConfirmTone = 'warm' | 'danger';

function feedback(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(style);
  }
}

function successFeedback() {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
  const iconBg = warm ? '#F7EFE0' : '#FEF2F2';
  const toneColor = warm ? C.gold : '#EF4444';
  const confirmBg = warm ? C.gold : '#EF4444';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={cm.wrap}>
        <Pressable style={cm.scrim} onPress={onClose} />
        <View style={cm.card}>
          <View style={[cm.iconCircle, { backgroundColor: iconBg }]}>
            {warm ? <CheckSmall s={22} c={toneColor} w={2.8} /> : <Trash2 s={22} c={toneColor} />}
          </View>
          <Text style={cm.title}>{title}</Text>
          <Text style={cm.message}>{message}</Text>

          <View style={cm.actions}>
            <TouchableOpacity
              style={cm.cancelBtn}
              activeOpacity={0.75}
              onPress={() => {
                feedback();
                onClose();
              }}
            >
              <Text style={cm.cancelTxt}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cm.confirmBtn, { backgroundColor: confirmBg, shadowColor: confirmBg }]}
              activeOpacity={0.82}
              onPress={() => {
                feedback();
                onConfirm();
                onClose();
              }}
            >
              <Text style={cm.confirmTxt}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
      {achieved && <PartyPopper s={21} c={C.gold} />}
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
    <View style={row.card}>
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
          />
          <Text style={row.text}>{item.text}</Text>
          <TouchableOpacity onPress={() => onStartEdit(item)} activeOpacity={0.75} style={row.iconBtn}>
            <Pencil s={18} c="#c8c8c8" w={2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onAskDelete(item.id)} activeOpacity={0.75} style={row.iconBtn}>
            <Trash2 s={18} c="#c8c8c8" w={2} />
          </TouchableOpacity>
        </>
      )}
    </View>
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
    <View style={[row.card, row.completedCard]}>
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
    </View>
  );
}

export default function BucketListView() {
  const router = useRouter();
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
    setShowConfetti(true);
    successFeedback();
    setTimeout(() => setShowConfetti(false), 3000);
  };

  const handleConfirmToggle = () => {
    if (!confirmToggle) return;
    if (confirmToggle.mode === 'check') {
      handleComplete(confirmToggle.item.id);
    } else {
      uncompleteBucketItem(confirmToggle.item.id);
    }
    setConfirmToggle(null);
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
    ? confirmToggle.mode === 'check'
      ? `Do you want to mark "${confirmToggle.item.text}" as achieved?`
      : `Do you want to mark "${confirmToggle.item.text}" as not achieved yet?`
    : '';

  return (
    <View style={screen.root}>
      {showConfetti && <CelebrationOverlay />}

      <ConfirmationModal
        visible={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={handleConfirmToggle}
        title={confirmToggle?.mode === 'check' ? 'Check Bucket List Item?' : 'Uncheck Bucket List Item?'}
        message={confirmMessage}
        confirmLabel={confirmToggle?.mode === 'check' ? 'Check' : 'Uncheck'}
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

      <View style={[header.wrap, { paddingTop: getTitleBarTopPadding(insets.top) }]}>
        <TouchableOpacity
          onPress={() => {
            feedback();
            router.back();
          }}
          style={header.back}
          activeOpacity={0.7}
        >
          <ArrowLeft s={24} c="#9CA3AF" />
        </TouchableOpacity>
        <Text style={header.title}>Bucket List</Text>
        <View style={header.spacer} />
      </View>

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
            <View style={section.block}>
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
                    feedback();
                    setConfirmToggle({ item: nextItem, mode });
                  }}
                  onAskDelete={id => setDeleteConfirmId(id)}
                />
              ))}
            </View>
          )}

          {completed.length > 0 && (
            <View style={[section.block, section.achievedBlock]}>
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
                  onAskToggle={(nextItem, mode) => setConfirmToggle({ item: nextItem, mode })}
                />
              ))}
            </View>
          )}

          {bucketList.length === 0 && (
            <View style={empty.wrap}>
              <Text style={empty.title}>Dream big</Text>
              <Text style={empty.sub}>What do you want to achieve in life?</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const screen = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 18,
  },
});

const header = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: TITLE_BAR_BOTTOM_PADDING,
    backgroundColor: 'rgba(250,250,250,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  back: {
    width: 44,
    height: 44,
    marginLeft: -10,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: F.serifMedium,
    fontSize: 21,
    letterSpacing: 1.1,
    color: '#111827',
    textTransform: 'uppercase',
  },
  spacer: {
    width: 44,
  },
});

const add = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 4,
    fontFamily: F.serif,
    fontSize: 18,
    lineHeight: 24,
    color: '#1F2937',
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 14,
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
    gap: 8,
  },
  achievedBlock: {
    marginTop: 2,
  },
});

const sh = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  text: {
    fontFamily: F.serifMedium,
    fontSize: 21,
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 17,
    paddingHorizontal: 16,
  },
  completedCard: {
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  emptyCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    flexShrink: 0,
  },
  completedCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontFamily: F.serif,
    fontSize: 18,
    lineHeight: 25,
    color: '#1F2937',
  },
  completedText: {
    fontFamily: F.serif,
    fontSize: 18,
    lineHeight: 25,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  date: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 9,
    color: '#D1D5DB',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    fontFamily: F.serif,
    fontSize: 18,
    color: '#1F2937',
  },
  editInputCompleted: {
    backgroundColor: '#fff',
  },
  smallGoldBtn: {
    width: 40,
    height: 40,
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

const cm = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 32,
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 18,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 21,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: F.serif,
    fontSize: 14,
    lineHeight: 21,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 13,
    backgroundColor: '#F9FAFB',
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelTxt: {
    fontFamily: F.sansBold,
    fontSize: 12,
    letterSpacing: 1.7,
    color: '#4B5563',
    textTransform: 'uppercase',
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmTxt: {
    fontFamily: F.sansBold,
    fontSize: 12,
    letterSpacing: 1.7,
    color: '#fff',
    textTransform: 'uppercase',
  },
});
