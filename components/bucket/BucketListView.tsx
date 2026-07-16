import React, {
  useEffect, useMemo, useState,
} from 'react';
import {
  Image,
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
import { LinearGradient } from 'expo-linear-gradient';
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

// The same trophy the rest of the app awards — kept days, streaks — now
// crowning achieved dreams.
const TROPHY_EMBLEM = require('@/assets/animations/challenge-trophy-preview.png');

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
      icon={warm ? <CheckSmall s={22} c={C.gold} w={2.8} /> : <Trash2 s={22} c={C.red} />}
      iconBg={warm ? '#F7EFE0' : '#FEF2F2'}
      title={title}
      body={message}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      confirmColor={warm ? C.gold : C.red}
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
        <Plus s={18} c="#fff" w={2.6} />
      </TouchableOpacity>
    </View>
  );
}

function SectionHeading({ achieved, label, count }: { achieved?: boolean; label: string; count: number }) {
  return (
    <View style={sh.row}>
      {achieved && <Image source={TROPHY_EMBLEM} style={sh.trophy} resizeMode="contain" />}
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
}: {
  item: BucketListItem;
  value: string;
  onChange: (v: string) => void;
  onSave: (item: BucketListItem) => void;
  onCancel: () => void;
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
        style={row.editInput}
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
          <View style={row.actions}>
            <TouchableOpacity onPress={() => onStartEdit(item)} activeOpacity={0.75} style={row.iconBtn}>
              <Pencil s={18} c="#BDB3A3" w={2} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onAskDelete(item.id)} activeOpacity={0.75} style={row.iconBtn}>
              <Trash2 s={18} c="#C77883" w={2} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </Reanimated.View>
  );
}

// An achieved dream is a sealed golden memory: the trophy medallion where the
// checkbox was, sepia ink with no strikethrough, and the date it was won.
// There is no editing here — move it back to Dreams to change its words.
function AchievedRow({
  item,
  onAskToggle,
  onAskDelete,
}: {
  item: BucketListItem;
  onAskToggle: (item: BucketListItem, mode: ToggleMode) => void;
  onAskDelete: (id: string) => void;
}) {
  return (
    <Reanimated.View
      layout={ROW_LAYOUT}
      entering={ROW_ENTER}
      exiting={ROW_EXIT}
      style={[row.card, row.completedCard]}
    >
      <LinearGradient
        colors={['#FFF6E3', '#FFFCF4', '#FFFFFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View pointerEvents="none" style={row.completedBloom} />
      <View pointerEvents="none" style={row.completedGlint} />
      <TouchableOpacity
        onPress={() => onAskToggle(item, 'uncheck')}
        activeOpacity={0.78}
        style={row.trophyMedallion}
        accessibilityRole="button"
        accessibilityLabel={`${item.text} is achieved. Move it back to dreams.`}
      >
        <Image source={TROPHY_EMBLEM} style={row.trophyImg} resizeMode="contain" />
      </TouchableOpacity>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={row.completedText} numberOfLines={2}>{item.text}</Text>
        {!!item.completedAt && (
          <Text style={row.date}>ACHIEVED · {formatCompletedDate(item.completedAt).toUpperCase()}</Text>
        )}
      </View>
      <TouchableOpacity onPress={() => onAskDelete(item.id)} activeOpacity={0.75} style={row.iconBtn}>
        <Trash2 s={17} c="#C77883" w={2} />
      </TouchableOpacity>
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
                  onAskToggle={(nextItem, mode) => {
                    feedback();
                    setConfirmToggle({ item: nextItem, mode });
                  }}
                  onAskDelete={id => setDeleteConfirmId(id)}
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
    paddingVertical: 8,
    paddingHorizontal: 10,
    paddingLeft: 14,
  },
  input: {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: 4,
    fontFamily: F.serif,
    fontSize: 18,
    lineHeight: 24,
    color: '#1F2937',
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
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
  trophy: {
    width: 22,
    height: 22,
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
    fontFamily: F.serifMedium,
    fontSize: 17,
    lineHeight: 22,
    color: '#9CA3AF',
  },
  countAchieved: {
    color: 'rgba(197,160,89,0.62)',
  },
});

const row = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#EFEAE0',
    shadowColor: '#8B7354',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.055,
    shadowRadius: 12,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  // The golden memory: gradient wash, gold hairline, a soft bloom in the
  // corner and one struck glint — the card itself feels awarded.
  completedCard: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#FFFCF4',
    borderColor: 'rgba(197,160,89,0.36)',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 11,
    elevation: 2,
    paddingVertical: 11,
  },
  completedBloom: {
    position: 'absolute',
    right: -26,
    top: -32,
    width: 98,
    height: 98,
    borderRadius: 49,
    backgroundColor: 'rgba(197,160,89,0.10)',
  },
  completedGlint: {
    position: 'absolute',
    right: 44,
    top: 8,
    width: 5,
    height: 5,
    borderRadius: 1.5,
    backgroundColor: 'rgba(197,160,89,0.55)',
    transform: [{ rotate: '45deg' }],
  },
  emptyCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#D9CBA8',
    backgroundColor: '#FFFEFB',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emptyCheckCore: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: 'rgba(197,160,89,0.16)',
  },
  trophyMedallion: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF3D8',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 2,
  },
  trophyImg: {
    width: 22,
    height: 22,
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
    color: '#75634A',
  },
  date: {
    marginTop: 3,
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.3,
    color: 'rgba(151,117,49,0.72)',
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
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
