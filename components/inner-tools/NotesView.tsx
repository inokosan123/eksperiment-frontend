import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, StyleProp, TextStyle,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft, BookMarked, CheckSmall, ChevronRight, Notebook, Plus, Trash2, X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import { FormatState, RichTextEditor, RichToolbar, RichTextEditorRef } from '@/components/shared/RichTextEditor';
import type { TextSelection } from '@/components/shared/TextFormatToolbar';
import { InnerNote, NoteColor, NoteKind, NoteSourceRef, useInnerTools } from './InnerToolsContext';

const BG = '#FDFBF5';
const GOLD = '#C5A059';

const NOTE_COLORS: Record<NoteColor, { cardBg: string; editorBg: string; border: string; accent: string }> = {
  white:    { cardBg: '#FAFAFA', editorBg: '#FFFFFF', border: '#E5E7EB', accent: '#D1D5DB' },
  gold:     { cardBg: '#F8F0DD', editorBg: '#FBF6EA', border: '#E2D1A8', accent: '#C5A059' },
  rose:     { cardBg: '#FFE0E6', editorBg: '#FFF0F3', border: '#F0B8C4', accent: '#E8889A' },
  peach:    { cardBg: '#FFE6D6', editorBg: '#FFF0E8', border: '#F0C4AA', accent: '#E8A87C' },
  yellow:   { cardBg: '#FFF5CC', editorBg: '#FFF9E0', border: '#E8D48C', accent: '#D4B44A' },
  mint:     { cardBg: '#D8F5E4', editorBg: '#EAF9F0', border: '#A8DCBA', accent: '#6BB88A' },
  sky:      { cardBg: '#DCE8FC', editorBg: '#EBF1FF', border: '#AAC4E8', accent: '#6B9FD4' },
  lavender: { cardBg: '#E6DAFC', editorBg: '#F0EAFF', border: '#C4AAEC', accent: '#9B7ED4' },
};

const COLOR_KEYS = Object.keys(NOTE_COLORS) as NoteColor[];
const QUOTE_TOKEN = '[[ANASTA_QUOTE]]';
const QUOTE_MARKER = `\n\n${QUOTE_TOKEN}\n\n`;

type NoteEditorTextBlock = {
  type: 'text';
  text: string;
};

type NoteEditorQuoteBlock = {
  type: 'quote';
  sourceRef: NoteSourceRef;
};

type NoteEditorBlock = NoteEditorTextBlock | NoteEditorQuoteBlock;

type QuoteDragState = {
  index: number;
  block: NoteEditorQuoteBlock;
  initialTop: number;
  top: number;
  height: number;
  maxTop: number;
  slots: { insertIndex: number; indicatorY: number }[];
  insertIndex: number;
  indicatorY: number;
};

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function shortDate(value: number) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseSourceRefParam(value: string | string[] | undefined): NoteSourceRef | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as NoteSourceRef;
    if (!parsed.label || !parsed.text) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function normalizeNewlines(value: string) {
  return value.replace(/\r\n?/g, '\n');
}

function splitParagraphs(value: string) {
  const parts = normalizeNewlines(value).split('\n');
  return parts.length > 0 ? parts : [''];
}

function MarkdownText({
  text,
  style,
  lineHeight,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  lineHeight?: number;
}) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|<u>.*?<\/u>)/s);
  return (
    <Text style={[style, lineHeight ? { lineHeight } : null]}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <Text key={i} style={{ fontFamily: F.serifBold }}>{part.slice(2, -2)}</Text>;
        if (part.startsWith('*') && part.endsWith('*'))
          return <Text key={i} style={{ fontFamily: F.serifItalic }}>{part.slice(1, -1)}</Text>;
        if (part.startsWith('<u>') && part.endsWith('</u>'))
          return <Text key={i} style={{ textDecorationLine: 'underline' }}>{part.slice(3, -4)}</Text>;
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

function normalizeEditorBlocks(blocks: NoteEditorBlock[]) {
  if (blocks.length === 0) return [{ type: 'text', text: '' }] satisfies NoteEditorBlock[];

  const normalized: NoteEditorBlock[] = [];
  blocks.forEach(block => {
    if (block.type === 'quote') {
      if (normalized.length === 0 || normalized[normalized.length - 1]?.type === 'quote') {
        normalized.push({ type: 'text', text: '' });
      }
      normalized.push(block);
      return;
    }

    normalized.push({ type: 'text', text: normalizeNewlines(block.text) });
  });

  if (normalized[normalized.length - 1]?.type === 'quote') {
    normalized.push({ type: 'text', text: '' });
  }

  return normalized;
}

function buildEditorBlocks(content: string, sourceRefs: NoteSourceRef[]) {
  const rawSegments = normalizeNewlines(content).split(QUOTE_TOKEN);
  while (rawSegments.length < sourceRefs.length + 1) rawSegments.push('');

  const blocks: NoteEditorBlock[] = [];
  const segmentCount = Math.max(rawSegments.length, sourceRefs.length + 1);
  for (let index = 0; index < segmentCount; index += 1) {
    splitParagraphs(rawSegments[index] ?? '').forEach(text => {
      blocks.push({ type: 'text', text });
    });

    if (sourceRefs[index]) {
      blocks.push({ type: 'quote', sourceRef: sourceRefs[index] });
    }
  }

  return normalizeEditorBlocks(blocks);
}

function serializeEditorBlocks(blocks: NoteEditorBlock[]) {
  const normalized = normalizeEditorBlocks(blocks);
  const segments: string[] = [];
  const refs: NoteSourceRef[] = [];
  let currentParagraphs: string[] = [];

  normalized.forEach(block => {
    if (block.type === 'text') {
      currentParagraphs.push(normalizeNewlines(block.text));
      return;
    }

    segments.push(currentParagraphs.join('\n'));
    refs.push(block.sourceRef);
    currentParagraphs = [];
  });

  segments.push(currentParagraphs.join('\n'));

  return {
    content: refs.length > 0 ? segments.join(QUOTE_MARKER) : segments[0] ?? '',
    sourceRefs: refs,
  };
}

function joinQuoteContent(before: string, after: string) {
  return `${before}${QUOTE_MARKER}${after}`;
}

function notePreviewContent(content: string) {
  return content.split(QUOTE_TOKEN).join('\n\n').trim();
}

export default function NotesView() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sourceRef?: string; type?: NoteKind; openNoteId?: string }>();
  const insets = useSafeAreaInsets();
  const { notes, upsertNote, deleteNote } = useInnerTools();
  const handledDraftRef = useRef<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<InnerNote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InnerNote | null>(null);
  const [editorType, setEditorType] = useState<NoteKind>('yellow');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState<NoteColor>('white');
  const [sourceRef, setSourceRef] = useState<NoteSourceRef | undefined>(undefined);
  const [sourceRefs, setSourceRefs] = useState<NoteSourceRef[]>([]);

  const quickHelp = useMemo(() => notes.filter(note => note.type === 'yellow').sort((a, b) => b.createdAt - a.createdAt), [notes]);
  const normalNotes = useMemo(() => notes.filter(note => note.type === 'note').sort((a, b) => b.createdAt - a.createdAt), [notes]);
  const bothEmpty = quickHelp.length === 0 && normalNotes.length === 0;

  const openNew = (type: NoteKind) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditing(null);
    setEditorType(type);
    setTitle('');
    setContent('');
    setColor(type === 'note' ? 'white' : 'gold');
    setSourceRef(undefined);
    setSourceRefs([]);
    setEditorOpen(true);
  };

  const openExisting = (note: InnerNote) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditing(note);
    setEditorType(note.type);
    setTitle(note.title);
    setContent(note.content);
    setColor(note.color ?? (note.type === 'note' ? 'white' : 'gold'));
    setSourceRef(note.sourceRef);
    setSourceRefs(note.sourceRefs && note.sourceRefs.length > 0 ? note.sourceRefs : note.sourceRef ? [note.sourceRef] : []);
    setEditorOpen(true);
  };

  useEffect(() => {
    const raw = Array.isArray(params.sourceRef) ? params.sourceRef[0] : params.sourceRef;
    if (!raw || handledDraftRef.current === raw) return;
    const nextSourceRef = parseSourceRefParam(raw);
    if (!nextSourceRef) return;

    handledDraftRef.current = raw;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditing(null);
    setEditorType(params.type === 'note' ? 'note' : 'yellow');
    setTitle('');
    setContent(joinQuoteContent('', ''));
    setColor(params.type === 'note' ? 'white' : 'gold');
    setSourceRef(nextSourceRef);
    setSourceRefs([nextSourceRef]);
    setEditorOpen(true);
  }, [params.sourceRef, params.type]);

  useEffect(() => {
    const openNoteId = Array.isArray(params.openNoteId) ? params.openNoteId[0] : params.openNoteId;
    if (!openNoteId || handledDraftRef.current === openNoteId) return;
    const note = notes.find(item => item.id === openNoteId);
    if (!note) return;

    handledDraftRef.current = openNoteId;
    openExisting(note);
  }, [notes, params.openNoteId]);

  const requestDelete = (note: InnerNote) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditorOpen(false);
    setDeleteTarget(note);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteNote(deleteTarget.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDeleteTarget(null);
    if (editing?.id === deleteTarget.id) {
      setEditing(null);
    }
  };

  const save = async () => {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle && !cleanContent) {
      setEditorOpen(false);
      return;
    }

    await upsertNote({
      id: editing?.id ?? newId(editorType),
      type: editorType,
      title: cleanTitle || (editorType === 'note' ? 'Untitled note' : 'Quick help'),
      content: cleanContent,
      createdAt: editing?.createdAt ?? Date.now(),
      color: editorType === 'note' ? color : 'gold',
      sourceRef: sourceRefs[0] ?? sourceRef,
      sourceRefs,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditorOpen(false);
  };

  return (
    <View style={s.screen}>
      <Header title="NOTES" top={insets.top} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        <BibleNotesShortcut onPress={() => router.push('/bible-notes')} />

        <Text style={s.addLabel}>ADD NOTES</Text>
        <View style={s.addRow}>
          <AddPill label="Quick Help" tone="gold" onPress={() => openNew('yellow')} />
          <AddPill label="Note" tone="stone" onPress={() => openNew('note')} />
        </View>

        {bothEmpty ? (
          <EmptyState />
        ) : (
          <>
            <View style={s.section}>
              <Text style={s.quickSectionLabel}>QUICK HELP</Text>
              {quickHelp.length === 0 ? (
                <Text style={s.emptySectionText}>No quick help cards yet</Text>
              ) : (
                <View style={s.quickList}>
                  {quickHelp.map(note => (
                    <QuickHelpCard
                      key={note.id}
                      note={note}
                      onPress={() => openExisting(note)}
                      onDelete={() => requestDelete(note)}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={s.section}>
              <Text style={s.notesSectionLabel}>NOTES</Text>
              {normalNotes.length === 0 ? (
                <Text style={s.emptySectionText}>No notes yet</Text>
              ) : (
                <View style={s.notesGrid}>
                  {normalNotes.map(note => (
                    <NoteTile
                      key={note.id}
                      note={note}
                      onPress={() => openExisting(note)}
                      onDelete={() => requestDelete(note)}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <EditorModal
        visible={editorOpen}
        type={editorType}
        title={title}
        content={content}
        color={color}
        sourceRefs={sourceRefs}
        editing={!!editing}
        onTitle={setTitle}
        onContent={setContent}
        onColor={setColor}
        onSourceRefs={nextRefs => {
          setSourceRefs(nextRefs);
          setSourceRef(nextRefs[0]);
        }}
        onClose={() => setEditorOpen(false)}
        onSave={save}
        onDelete={editing ? () => requestDelete(editing) : undefined}
      />

      <DeleteConfirmModal
        visible={!!deleteTarget}
        type={deleteTarget?.type ?? 'note'}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

function Header({ title, top, onBack }: { title: string; top: number; onBack: () => void }) {
  return (
    <View style={[s.header, { paddingTop: getTitleBarTopPadding(top) }]}>
      <TouchableOpacity onPress={onBack} style={s.headerBtn} activeOpacity={0.7}>
        <ArrowLeft s={24} c="#9CA3AF" />
      </TouchableOpacity>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={s.headerBtn} />
    </View>
  );
}

function BibleNotesShortcut({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={s.bibleShortcut}>
      <View style={s.bibleLeft}>
        <View style={s.bibleIcon}>
          <BookMarked s={14} c={GOLD} />
        </View>
        <View>
          <Text style={s.bibleKicker}>BIBLE NOTES</Text>
          <Text style={s.bibleText}>Chapter study notes & reflections</Text>
        </View>
      </View>
      <ChevronRight s={16} c="#D1B37E" />
    </TouchableOpacity>
  );
}

function AddPill({ label, tone, onPress }: { label: string; tone: 'gold' | 'stone'; onPress: () => void }) {
  const isGold = tone === 'gold';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      style={[s.addPill, isGold ? s.addPillGold : s.addPillStone]}
    >
      <Plus s={13} c={isGold ? GOLD : '#6B7280'} />
      <Text style={[s.addPillText, isGold ? s.addPillTextGold : s.addPillTextStone]}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Notebook s={30} c="rgba(197,160,89,0.42)" />
      </View>
      <Text style={s.emptyTitle}>No notes yet</Text>
      <Text style={s.emptySubtitle}>WRITE A REMINDER OR CAPTURE A THOUGHT</Text>
    </View>
  );
}

function QuickHelpCard({ note, onPress, onDelete }: { note: InnerNote; onPress: () => void; onDelete: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.86} style={s.quickCard}>
      <View style={s.quickAccent} />
      <View style={s.quickInner}>
        <View style={s.quickTop}>
          <Text style={s.quickTitle} numberOfLines={2}>{note.title}</Text>
          <View style={s.quickMeta}>
            <Text style={s.quickDate}>{shortDate(note.createdAt)}</Text>
            <Pressable
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              style={s.trashPress}
            >
              <Trash2 s={14} c="#D8A6A6" />
            </Pressable>
            <ChevronRight s={16} c="rgba(197,160,89,0.22)" />
          </View>
        </View>
        {!!notePreviewContent(note.content) && (
          <Text style={s.quickText} numberOfLines={2}>
            {notePreviewContent(note.content)}
          </Text>
        )}
        {note.sourceRef && (
          <Text style={s.quickSource} numberOfLines={2}>
            {note.sourceRef.label} - {note.sourceRef.text}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function NoteTile({ note, onPress, onDelete }: { note: InnerNote; onPress: () => void; onDelete: () => void }) {
  const palette = NOTE_COLORS[note.color ?? 'white'];
  return (
    <View
      style={[s.noteTile, { backgroundColor: palette.cardBg, borderColor: palette.border }]}
    >
      <View style={[s.tileAccent, { backgroundColor: `${palette.accent}55` }]} />
      <TouchableOpacity
        onPress={onDelete}
        style={s.tileTrash}
        activeOpacity={0.72}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
      >
        <Trash2 s={13} c="#D8A6A6" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onPress} activeOpacity={0.86} style={s.tileBody}>
        <Text style={s.tileTitle} numberOfLines={2}>{note.title}</Text>
        {!!notePreviewContent(note.content) && <Text style={s.tileText} numberOfLines={2}>{notePreviewContent(note.content)}</Text>}
        {note.sourceRef && <Text style={s.tileSource} numberOfLines={2}>{note.sourceRef.label}</Text>}
        <Text style={s.tileDate}>{shortDate(note.createdAt)}</Text>
      </TouchableOpacity>
    </View>
  );
}

function DeleteConfirmModal({
  visible, type, onCancel, onConfirm,
}: {
  visible: boolean;
  type: NoteKind;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={s.confirmOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={s.confirmCard}>
          <View style={s.confirmIcon}>
            <Trash2 s={22} c="#F87171" />
          </View>
          <Text style={s.confirmTitle}>Delete this {type === 'note' ? 'note' : 'quick help'}?</Text>
          <Text style={s.confirmText}>This cannot be undone.</Text>
          <View style={s.confirmActions}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.86} style={s.cancelBtn}>
              <Text style={s.cancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} activeOpacity={0.86} style={s.deleteBtn}>
              <Text style={s.deleteText}>DELETE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EditorModal({
  visible, type, title, content, color, sourceRefs, editing, onTitle, onContent, onColor, onSourceRefs, onClose, onSave, onDelete,
}: {
  visible: boolean;
  type: NoteKind;
  title: string;
  content: string;
  color: NoteColor;
  sourceRefs: NoteSourceRef[];
  editing: boolean;
  onTitle: (value: string) => void;
  onContent: (value: string) => void;
  onColor: (value: NoteColor) => void;
  onSourceRefs: (value: NoteSourceRef[]) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isNote = type === 'note';
  const palette = isNote ? NOTE_COLORS[color] : NOTE_COLORS.gold;
  const richEditorRef = useRef<RichTextEditorRef>(null);
  const [formatState, setFormatState] = useState<FormatState>({ bold: false, italic: false, underline: false });
  const [dragState, setDragState] = useState<QuoteDragState | null>(null);
  const [blockLayouts, setBlockLayouts] = useState<Record<number, { top: number; height: number }>>({});
  const [paperHeight, setPaperHeight] = useState(0);
  const editorBlocks = useMemo(() => buildEditorBlocks(content, sourceRefs), [content, sourceRefs]);
  const hasQuote = sourceRefs.length > 0;

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => richEditorRef.current?.focus(), 300);
    return () => clearTimeout(timeout);
  }, [visible]);

  const commitBlocks = (nextBlocks: NoteEditorBlock[]) => {
    const serialized = serializeEditorBlocks(nextBlocks);
    onSourceRefs(serialized.sourceRefs);
    onContent(serialized.content);
  };

  const storeBlockLayout = (index: number, top: number, height: number) => {
    if (dragState) return;
    setBlockLayouts(prev => {
      const current = prev[index];
      if (current && current.top === top && current.height === height) return prev;
      return { ...prev, [index]: { top, height } };
    });
  };

  const buildInsertSlots = (dragIndex: number, draggedHeight: number) => {
    const remaining = editorBlocks
      .map((block, index) => ({ block, index, layout: blockLayouts[index] }))
      .filter(item => item.index !== dragIndex && item.layout);

    const slots: { insertIndex: number; indicatorY: number }[] = [];
    for (let insertIndex = 0; insertIndex <= remaining.length; insertIndex += 1) {
      const previous = remaining[insertIndex - 1];
      const next = remaining[insertIndex];

      if (previous?.block.type === 'quote' || next?.block.type === 'quote') continue;

      let indicatorY = 8;
      if (!previous && next) {
        indicatorY = Math.max(8, next.layout!.top - 10);
      } else if (previous && !next) {
        indicatorY = previous.layout!.top + previous.layout!.height + 10;
      } else if (previous && next) {
        const previousBottom = previous.layout!.top + previous.layout!.height;
        indicatorY = previousBottom + ((next.layout!.top - previousBottom) / 2);
      }

      slots.push({
        insertIndex,
        indicatorY: Math.max(8, indicatorY),
      });
    }

    if (slots.length === 0) {
      slots.push({ insertIndex: 0, indicatorY: Math.max(8, draggedHeight * 0.35) });
    }

    return slots;
  };

  const startQuoteDrag = (index: number) => {
    const block = editorBlocks[index];
    const layout = blockLayouts[index];
    if (!block || block.type !== 'quote' || !layout) return;

    const slots = buildInsertSlots(index, layout.height);
    const contentBottom = Math.max(
      paperHeight,
      ...Object.values(blockLayouts).map(item => item.top + item.height),
      layout.top + layout.height,
    );
    const maxTop = Math.max(0, contentBottom - layout.height);
    const centerY = layout.top + (layout.height / 2);
    const currentSlot = slots.reduce((closest, slot) => (
      Math.abs(slot.indicatorY - centerY) < Math.abs(closest.indicatorY - centerY) ? slot : closest
    ), slots[0]);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDragState({
      index,
      block,
      initialTop: layout.top,
      top: layout.top,
      height: layout.height,
      maxTop,
      slots,
      insertIndex: currentSlot.insertIndex,
      indicatorY: currentSlot.indicatorY,
    });
  };

  const updateQuoteDrag = (dy: number) => {
    setDragState(prev => {
      if (!prev) return prev;

      const nextTop = Math.max(0, Math.min(prev.maxTop, prev.initialTop + dy));
      const centerY = nextTop + (prev.height / 2);
      const nearestSlot = prev.slots.reduce((closest, slot) => (
        Math.abs(slot.indicatorY - centerY) < Math.abs(closest.indicatorY - centerY) ? slot : closest
      ), prev.slots[0]);

      return {
        ...prev,
        top: nextTop,
        insertIndex: nearestSlot.insertIndex,
        indicatorY: nearestSlot.indicatorY,
      };
    });
  };

  const finishQuoteDrag = () => {
    const currentDrag = dragState;
    if (!currentDrag) return;

    const remainingBlocks = editorBlocks.filter((_, index) => index !== currentDrag.index);
    remainingBlocks.splice(currentDrag.insertIndex, 0, currentDrag.block);
    setDragState(null);
    commitBlocks(remainingBlocks);
  };

  const cancelQuoteDrag = () => {
    setDragState(null);
  };

  const removeQuoteAt = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextBlocks = editorBlocks.filter((_, blockIndex) => blockIndex !== index);
    commitBlocks(nextBlocks);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.editorScreen, { backgroundColor: palette.editorBg }]}>
        <View style={[s.editorHeader, { paddingTop: getTitleBarTopPadding(insets.top), borderBottomColor: `${palette.accent}22` }]}>
          <TouchableOpacity onPress={onClose} style={s.headerBtn} activeOpacity={0.7}>
            <ArrowLeft s={24} c="#A8A29E" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.editorKicker}>{editing ? 'Editing' : 'New'} {isNote ? 'Note' : 'Quick Help'}</Text>
            <Text style={s.editorDate}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</Text>
          </View>
          <View style={s.editorActions}>
            {onDelete && (
              <TouchableOpacity onPress={onDelete} style={s.editorIconBtn} activeOpacity={0.7}>
                <Trash2 s={20} c="#EF4444" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onSave} style={s.editorIconBtn} activeOpacity={0.7}>
              <CheckSmall s={21} c={palette.accent} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[s.editorContent, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!dragState}
        >
          <TextInput
            value={title}
            onChangeText={onTitle}
            placeholder="Title"
            placeholderTextColor="#D6D3D1"
            style={s.titleInput}
          />

          {isNote && (
            <View style={s.swatches}>
              {COLOR_KEYS.map(key => {
                const c = NOTE_COLORS[key];
                const active = key === color;
                return (
                  <Pressable
                    key={key}
                    onPress={() => onColor(key)}
                    style={[s.swatch, { backgroundColor: c.cardBg, borderColor: active ? c.accent : c.border }]}
                  >
                    {active && <CheckSmall s={12} c={c.accent} />}
                  </Pressable>
                );
              })}
            </View>
          )}

          <RichToolbar
            editorRef={richEditorRef}
            activeFormats={formatState}
            style={[s.richToolbar, { borderColor: `${palette.accent}28` }]}
          />

          <RichTextEditor
            ref={richEditorRef}
            initialHTML={content}
            onChange={onContent}
            onFormatChange={setFormatState}
            placeholder={isNote ? 'Write your note...' : 'Write what will help you return...'}
            backgroundColor={palette.editorBg}
            color="#3D3229"
            style={s.richEditor}
          />

          {/* Quote cards still rendered for scripture references */}
          {editorBlocks.filter(b => b.type === 'quote').map((block, index) => (
            block.type === 'quote' && (
              <ScriptureQuoteCard
                key={index}
                sourceRef={block.sourceRef}
                onRemove={() => removeQuoteAt(editorBlocks.indexOf(block))}
              />
            )
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ScriptureQuoteCard({
  sourceRef,
  onRemove,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  isDimmed = false,
  isDragging = false,
  visualState = 'default',
}: {
  sourceRef: NoteSourceRef;
  onRemove?: () => void;
  onDragStart?: () => void;
  onDragMove?: (dy: number) => void;
  onDragEnd?: () => void;
  onDragCancel?: () => void;
  isDimmed?: boolean;
  isDragging?: boolean;
  visualState?: 'default' | 'ghost';
}) {
  const [expanded, setExpanded] = useState(false);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => !!onDragMove && Math.abs(gesture.dy) > 2,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      onDragStart?.();
    },
    onPanResponderMove: (_, gesture) => {
      onDragMove?.(gesture.dy);
    },
    onPanResponderRelease: () => {
      onDragEnd?.();
    },
    onPanResponderTerminate: () => {
      onDragCancel?.();
    },
  }), [onDragCancel, onDragEnd, onDragMove, onDragStart]);
  const verseTexts = sourceRef.verseTexts && sourceRef.verseTexts.length > 0
    ? sourceRef.verseTexts
    : [{ verse: sourceRef.startVerse ?? 1, text: sourceRef.text }];
  const visibleVerses = expanded ? verseTexts : verseTexts.slice(0, 2);
  const hasMore = verseTexts.length > 2;

  return (
    <View
      style={[
        s.quoteCard,
        isDimmed && s.quoteCardDimmed,
        visualState === 'ghost' && s.quoteCardGhost,
      ]}
    >
      <View
        {...panResponder.panHandlers}
        style={[s.quoteHandle, (isDragging || visualState === 'ghost') && s.quoteHandleActive]}
      >
        <Text style={s.quoteHandleText}>::::</Text>
      </View>
      {onRemove && (
        <TouchableOpacity activeOpacity={0.78} onPress={onRemove} style={s.quoteRemove}>
          <X s={13} c="#C5A059" />
        </TouchableOpacity>
      )}
      {visibleVerses.map(item => (
        <View key={`${item.verse}-${item.text.slice(0, 8)}`} style={s.quoteVerseRow}>
          <Text style={s.quoteVerseNumber}>{item.verse}</Text>
          <Text style={s.quoteText}>{item.text}</Text>
        </View>
      ))}
      {hasMore && (
        <TouchableOpacity onPress={() => setExpanded(value => !value)} activeOpacity={0.78}>
          <Text style={s.quoteExpand}>{expanded ? 'SHOW LESS' : `SHOW ALL ${verseTexts.length} VERSES`}</Text>
        </TouchableOpacity>
      )}
      <Text style={s.quoteSource}>- {sourceRef.label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: TITLE_BAR_BOTTOM_PADDING,
    backgroundColor: 'rgba(253,251,245,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(197,160,89,0.10)',
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: F.serifMedium, fontSize: 22, letterSpacing: 2.6, color: C.text },
  content: { paddingHorizontal: 20, paddingTop: 14 },

  bibleShortcut: {
    minHeight: 62,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8D8BA',
    backgroundColor: '#FFF9ED',
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#C5A059',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  bibleLeft: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  bibleIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#E7D2A8',
    backgroundColor: '#FFF8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bibleKicker: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.1, color: '#B08A47' },
  bibleText: { marginTop: 2, fontFamily: F.serif, fontSize: 14, lineHeight: 18, color: '#9CA3AF' },

  addLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2.2, color: '#D1D5DB', marginBottom: 10, paddingLeft: 4 },
  addRow: { flexDirection: 'row', gap: 12, marginBottom: 26 },
  addPill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addPillGold: { backgroundColor: '#FAF6EE', borderColor: '#E8DCC4' },
  addPillStone: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' },
  addPillText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.7, textTransform: 'uppercase' },
  addPillTextGold: { color: GOLD },
  addPillTextStone: { color: '#6B7280' },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(197,160,89,0.10)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontFamily: F.serifMediumItalic, fontSize: 19, color: '#A8A29E', marginBottom: 5 },
  emptySubtitle: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.7, color: '#D1D5DB' },

  section: { marginBottom: 28 },
  quickSectionLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.2, color: 'rgba(197,160,89,0.62)', marginBottom: 13, paddingLeft: 4 },
  notesSectionLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.2, color: '#9CA3AF', marginBottom: 13, paddingLeft: 4 },
  emptySectionText: { fontFamily: F.serifMediumItalic, fontSize: 15, color: '#D1D5DB', textAlign: 'center', paddingVertical: 18 },

  quickList: { gap: 14 },
  quickCard: {
    minHeight: 126,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8DCC4',
    backgroundColor: '#FAF6EE',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  quickAccent: { position: 'absolute', left: 0, top: 16, bottom: 16, width: 3, borderRadius: 2, backgroundColor: 'rgba(197,160,89,0.28)' },
  quickInner: { flex: 1, padding: 20, paddingLeft: 30 },
  quickTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  quickTitle: { flex: 1, fontFamily: F.serifMedium, fontSize: 22, lineHeight: 27, color: '#3D3229' },
  quickMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 4 },
  quickDate: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.5, color: 'rgba(155,142,130,0.65)', textTransform: 'uppercase' },
  trashPress: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  quickText: { marginTop: 9, fontFamily: F.serifItalic, fontSize: 15, lineHeight: 22, color: '#9B8E82' },
  quickSource: { marginTop: 9, fontFamily: F.serifItalic, fontSize: 14, lineHeight: 20, color: 'rgba(197,160,89,0.80)' },

  notesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  noteTile: {
    width: '48%',
    minHeight: 118,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tileBody: { flex: 1, padding: 16, paddingTop: 18 },
  tileAccent: { position: 'absolute', top: 0, left: 16, right: 16, height: 2, borderRadius: 2 },
  tileTrash: { position: 'absolute', top: 7, right: 7, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', zIndex: 5, elevation: 5 },
  tileTitle: { fontFamily: F.serifMedium, fontSize: 19, lineHeight: 23, color: '#3D3229', paddingRight: 22 },
  tileText: { marginTop: 8, fontFamily: F.serifItalic, fontSize: 12, lineHeight: 17, color: '#9CA3AF' },
  tileSource: { marginTop: 8, fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.2, color: GOLD, textTransform: 'uppercase' },
  tileDate: { marginTop: 'auto', paddingTop: 14, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.7, color: '#D1D5DB', textTransform: 'uppercase' },

  confirmOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: 'rgba(0,0,0,0.30)' },
  confirmCard: { width: '100%', maxWidth: 290, borderRadius: 24, backgroundColor: '#FFFFFF', padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 8 },
  confirmIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  confirmTitle: { fontFamily: F.serifMedium, fontSize: 18, color: '#3D3229', marginBottom: 4 },
  confirmText: { fontFamily: F.sans, fontSize: 11, color: '#9CA3AF', marginBottom: 20 },
  confirmActions: { flexDirection: 'row', gap: 9, width: '100%' },
  cancelBtn: { flex: 1, minHeight: 44, borderRadius: 15, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { flex: 1, minHeight: 44, borderRadius: 15, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.4, color: '#6B7280' },
  deleteText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.4, color: '#FFFFFF' },

  editorScreen: { flex: 1 },
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: TITLE_BAR_BOTTOM_PADDING, borderBottomWidth: 1 },
  editorKicker: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: C.textMuted, textTransform: 'uppercase' },
  editorDate: { marginTop: 3, fontFamily: F.serifMediumItalic, fontSize: 13, color: C.textMuted },
  editorActions: { minWidth: 44, flexDirection: 'row', justifyContent: 'flex-end', gap: 2 },
  editorIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  editorContent: { paddingHorizontal: 24, paddingTop: 22 },
  titleInput: { fontFamily: F.serifMedium, fontSize: 30, lineHeight: 36, color: '#3D3229', paddingVertical: 0, marginBottom: 18 },
  swatches: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 18 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  richToolbar: {
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.86)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  richToolbarSelected: {
    backgroundColor: 'rgba(197,160,89,0.18)',
    borderRadius: 6,
  },
  richEditor: {
    minHeight: 320,
    backgroundColor: 'transparent',
  },
  quoteCard: {
    position: 'relative',
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
    backgroundColor: '#FFFFFF',
    paddingTop: 46,
    paddingBottom: 18,
    paddingHorizontal: 42,
    marginVertical: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  quoteCardDimmed: {
    opacity: 0.12,
    transform: [{ scale: 0.985 }],
  },
  quoteCardGhost: {
    opacity: 0.9,
    transform: [{ scale: 0.975 }],
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 9,
  },
  quoteDragOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 30,
  },
  quoteDropIndicator: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.62)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    zIndex: 20,
  },
  quoteHandle: {
    position: 'absolute',
    top: 10,
    left: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8DCC4',
    backgroundColor: '#FFF8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteHandleActive: { backgroundColor: '#F8E8C5' },
  quoteHandleText: { fontFamily: F.sansBold, fontSize: 14, lineHeight: 15, color: GOLD },
  quoteRemove: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8DCC4',
    backgroundColor: '#FFF8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteVerseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 14 },
  quoteVerseNumber: { width: 18, paddingTop: 2, textAlign: 'right', fontFamily: F.sansBold, fontSize: 11, color: GOLD },
  quoteText: { flex: 1, fontFamily: F.serifItalic, fontSize: 18, lineHeight: 29, color: '#5C4B2A' },
  quoteExpand: { marginTop: 2, marginBottom: 8, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, color: GOLD },
  quoteSource: { marginTop: 4, fontFamily: F.serifMedium, fontSize: 13, color: GOLD },
});
