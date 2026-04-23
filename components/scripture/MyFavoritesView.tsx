import React, { useMemo, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, Search, SlidersHorizontal, Star, Trash2, X,
} from '@/components/icons/Icons';
import {
  getAnnotationCategoryLabel, getAnnotationColorHex, hexToRgba,
  HighlightColor, ColorCategory,
} from '@/constants/annotationColors';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import { BIBLE_BOOKS, PSALMS_ID } from '@/constants/scripture';
import { CategoryChipPicker, CategoryEditorModal } from './CategoryColorTools';
import {
  annotationLocation, ScriptureAnnotation, useScripture,
} from './ScriptureContext';

const BG = '#FFFFFF';
const GOLD = '#C5A059';

type TypeFilter = 'all' | ScriptureAnnotation['kind'];
type SourceFilter = 'all' | 'nt' | 'ot' | 'psalms';

const BOOK_BY_ID = new Map(BIBLE_BOOKS.map(book => [book.id, book]));
const SOURCE_OPTIONS: { key: SourceFilter; label: string; accent: string }[] = [
  { key: 'all', label: 'All', accent: '#111827' },
  { key: 'nt', label: 'New T.', accent: '#5E7B55' },
  { key: 'ot', label: 'Old T.', accent: '#9A7426' },
  { key: 'psalms', label: 'Psalms', accent: '#C26A1B' },
];

function matchesSource(annotation: ScriptureAnnotation, source: SourceFilter) {
  if (source === 'all') return true;
  if (source === 'psalms') return annotation.bookId === PSALMS_ID;

  const book = BOOK_BY_ID.get(annotation.bookId);
  if (!book) return false;
  if (source === 'nt') return book.testament === 'nt';
  return annotation.bookId !== PSALMS_ID && book.testament !== 'nt';
}

export default function MyFavoritesView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    annotations, categories, deleteAnnotation, updateCategory,
  } = useScripture();

  const [search, setSearch] = useState('');
  const [color, setColor] = useState<HighlightColor | 'all'>('all');
  const [kind, setKind] = useState<TypeFilter>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<ScriptureAnnotation | null>(null);
  const [colorEditorOpen, setColorEditorOpen] = useState(false);

  const filtered = useMemo(() => annotations
    .filter(annotation => annotation.kind === 'highlight' || annotation.kind === 'comment')
    .filter(annotation => color === 'all' || annotation.color === color)
    .filter(annotation => kind === 'all' || annotation.kind === kind)
    .filter(annotation => matchesSource(annotation, source))
    .filter(annotation => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return annotation.text.toLowerCase().includes(q)
        || annotation.comment?.toLowerCase().includes(q)
        || annotationLocation(annotation).toLowerCase().includes(q);
    })
    .sort((a, b) => b.updatedAt - a.updatedAt), [annotations, color, kind, search, source]);

  const displayItems = useMemo(() => {
    const seen = new Set<string>();
    return filtered.filter(annotation => {
      const key = annotation.kind === 'comment'
        ? [
          annotation.kind,
          annotation.bookId,
          annotation.chapter,
          annotation.color,
          annotation.text,
          annotation.comment ?? '',
        ].join(':')
        : annotation.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [filtered]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'comment') {
      const groupedComments = annotations.filter(annotation =>
        annotation.kind === 'comment'
        && annotation.bookId === deleteTarget.bookId
        && annotation.chapter === deleteTarget.chapter
        && annotation.color === deleteTarget.color
        && annotation.text === deleteTarget.text
        && annotation.comment === deleteTarget.comment);
      await Promise.all(groupedComments.map(annotation => deleteAnnotation(annotation.id)));
    } else {
      await deleteAnnotation(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  return (
    <View style={s.screen}>
      <Header top={insets.top} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 110 }]} showsVerticalScrollIndicator={false}>
        <View style={s.filterCard}>
          <View style={s.searchBox}>
            <Search s={15} c="#D1D5DB" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search your saved passages..."
              placeholderTextColor="#D1D5DB"
              style={s.searchInput}
            />
            {!!search && (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <X s={15} c="#D1D5DB" />
              </Pressable>
            )}
          </View>
        </View>

        <View style={s.colorWrap}>
          <FilterTitle label="CATEGORY" />
          <CategoryChipPicker
            categories={categories}
            selectedColor={color}
            includeAll
            onSelectAll={() => setColor('all')}
            onSelectColor={setColor}
            onEdit={() => setColorEditorOpen(true)}
            layout="wrap"
            contentStyle={s.colorRow}
          />
        </View>

        <View style={s.typeWrap}>
          <FilterTitle label="TYPE" />
          <View style={s.typeGrid}>
            {([
              ['all', 'All', ''],
              ['highlight', 'Highlights', '"'],
              ['comment', 'Comments', '*'],
            ] as [TypeFilter, string, string][]).map(([key, label, marker]) => {
              const active = kind === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setKind(key)}
                  activeOpacity={0.84}
                  style={[s.typeChip, active && s.typeChipActive]}
                >
                  {!!marker && <Text style={[s.typeMarker, active && s.typeMarkerActive]}>{marker}</Text>}
                  <Text style={[s.typeText, active && s.typeTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={s.sourceWrap}>
          <FilterTitle label="SOURCE" />
          <View style={s.sourceGrid}>
            {SOURCE_OPTIONS.map(option => {
              const active = source === option.key;
              const isAll = option.key === 'all';
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setSource(option.key)}
                  activeOpacity={0.84}
                  style={[
                    s.sourceChip,
                    active && {
                      backgroundColor: isAll ? option.accent : hexToRgba(option.accent, 0.10),
                      borderColor: isAll ? option.accent : hexToRgba(option.accent, 0.28),
                    },
                  ]}
                >
                  {!isAll && (
                    <View
                      style={[
                        s.sourceDot,
                        { backgroundColor: active ? option.accent : '#D8D1C5' },
                      ]}
                    />
                  )}
                  <Text
                    style={[
                      s.sourceText,
                      active && { color: isAll ? '#FFFFFF' : option.accent },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={s.listHead}>
          <Text style={s.sectionKicker}>SAVED PASSAGES</Text>
          <Text style={s.countText}>{displayItems.length}</Text>
        </View>

        {displayItems.length === 0 ? (
          <View style={s.empty}>
            <Star s={32} c="rgba(197,160,89,0.35)" />
            <Text style={s.emptyTitle}>Nothing saved yet</Text>
            <Text style={s.emptyText}>Open Holy Scripture and save highlights or comments.</Text>
          </View>
        ) : (
          <View style={s.list}>
            {displayItems.map(annotation => (
              <AnnotationCard
                key={annotation.id}
                annotation={annotation}
                categories={categories}
                onOpen={() => router.push({
                  pathname: '/scripture-reader',
                  params: {
                    bookId: String(annotation.bookId),
                    chapter: String(annotation.chapter),
                    verse: String(annotation.verse),
                  },
                })}
                onDelete={() => setDeleteTarget(annotation)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <DeleteModal visible={!!deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      <CategoryEditorModal
        visible={colorEditorOpen}
        categories={categories}
        onClose={() => setColorEditorOpen(false)}
        onSaveCategory={updateCategory}
      />
    </View>
  );
}

function FilterTitle({ label }: { label: string }) {
  return (
    <View style={s.filterTitle}>
      <SlidersHorizontal s={14} c={GOLD} w={2.1} />
      <Text style={s.sectionKicker}>{label}</Text>
    </View>
  );
}

function Header({ top, onBack }: { top: number; onBack: () => void }) {
  return (
    <View style={[s.header, { paddingTop: getTitleBarTopPadding(top) }]}>
      <TouchableOpacity onPress={onBack} style={s.headerBtn} activeOpacity={0.7}>
        <ArrowLeft s={24} c="#9CA3AF" />
      </TouchableOpacity>
      <Text style={s.headerTitle}>MY FAVORITES</Text>
      <View style={s.headerBtn} />
    </View>
  );
}

function AnnotationCard({
  annotation, categories, onOpen, onDelete,
}: {
  annotation: ScriptureAnnotation;
  categories: ColorCategory[];
  onOpen: () => void;
  onDelete: () => void;
}) {
  const accent = getAnnotationColorHex(annotation.color);
  const categoryLabel = getAnnotationCategoryLabel(categories, annotation.color);
  const kindLabel = annotation.kind === 'comment'
    ? 'Comment'
    : annotation.kind === 'favorite'
      ? 'Favorite'
      : annotation.kind === 'underline'
        ? 'Underline'
        : 'Highlight';
  const quoteLines = annotation.text
    .split(/\n{2,}/)
    .map(line => line.trim())
    .filter(Boolean);

  return (
    <TouchableOpacity
      onPress={onOpen}
      activeOpacity={0.86}
      style={[s.card, { borderColor: hexToRgba(accent, 0.18) }]}
    >
      <View style={s.cardTop}>
        <View style={s.cardTags}>
          <View style={[s.cardDot, { backgroundColor: accent }]} />
          <View style={[s.cardChip, { backgroundColor: hexToRgba(accent, 0.10), borderColor: hexToRgba(accent, 0.18) }]}>
            <Text style={[s.cardChipText, { color: accent }]}>{categoryLabel}</Text>
          </View>
          <View style={[s.cardChip, s.cardKindChip]}>
            <Text style={[s.cardChipText, { color: '#9A7426' }]}>{kindLabel}</Text>
          </View>
        </View>
        <Pressable onPress={onDelete} hitSlop={8} style={s.trashBtn}>
          <Trash2 s={15} c="#D8A6A6" />
        </Pressable>
      </View>
      <Text style={s.cardRef}>{annotationLocation(annotation)}</Text>
      <View style={s.quoteBlock}>
        {quoteLines.map((line, index) => (
          <View key={`${annotation.id}-${index}`}>
            <Text style={s.quoteText}>{`"${line}"`}</Text>
            {index < quoteLines.length - 1 && <View style={s.quoteDivider} />}
          </View>
        ))}
      </View>
      {!!annotation.comment && (
        <View style={s.commentBox}>
          <Text style={s.commentText}>{annotation.comment}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function DeleteModal({
  visible, onCancel, onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={s.deleteOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={s.deleteCard}>
          <Trash2 s={24} c="#F87171" />
          <Text style={s.deleteTitle}>Delete saved passage?</Text>
          <Text style={s.deleteBody}>This removes it from My Favorites.</Text>
          <View style={s.deleteActions}>
            <TouchableOpacity onPress={onCancel} style={s.cancelBtn} activeOpacity={0.85}>
              <Text style={s.cancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} style={s.deleteBtn} activeOpacity={0.85}>
              <Text style={s.deleteText}>DELETE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: '#F1E8DA',
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: F.serifMedium, fontSize: 22, letterSpacing: 2.3, color: C.text },
  content: { paddingHorizontal: 14, paddingTop: 16 },
  filterCard: { borderRadius: 22, borderWidth: 1, borderColor: '#ECE4D7', backgroundColor: '#FFFDF9', padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.04, shadowRadius: 24, elevation: 2 },
  searchBox: { minHeight: 44, borderRadius: 17, borderWidth: 1, borderColor: '#EEE5D8', backgroundColor: '#fff', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontFamily: F.serif, fontSize: 15, color: '#44403C', paddingVertical: 0 },
  colorWrap: { marginTop: 18 },
  filterTitle: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, paddingLeft: 3 },
  sectionKicker: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: '#A8A29E' },
  colorRow: { gap: 8, paddingBottom: 3 },
  typeWrap: { marginTop: 18 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E7DED1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  typeChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  typeMarker: { fontFamily: F.serifMedium, fontSize: 14, color: '#C5A059', marginTop: -1 },
  typeMarkerActive: { color: '#FFFFFF' },
  typeText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.7, color: '#7C7470', textTransform: 'uppercase' },
  typeTextActive: { color: '#FFFFFF' },
  sourceWrap: { marginTop: 18 },
  sourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sourceChip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E7DED1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  sourceDot: { width: 7, height: 7, borderRadius: 4 },
  sourceText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.7, color: '#7C7470', textTransform: 'uppercase' },
  categoryChip: { height: 34, borderRadius: 17, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  categoryChipAllActive: { backgroundColor: '#1C1917', borderColor: '#1C1917' },
  categoryText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  categoryTextAllActive: { color: '#fff' },
  categoryDot: { width: 7, height: 7, borderRadius: 4 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10, paddingLeft: 3 },
  countText: { fontFamily: F.sansBold, fontSize: 10, color: GOLD, paddingRight: 5 },
  list: { gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 58, paddingHorizontal: 26 },
  emptyTitle: { marginTop: 12, fontFamily: F.serifMediumItalic, fontSize: 19, color: '#A8A29E' },
  emptyText: { marginTop: 5, fontFamily: F.serif, fontSize: 15, lineHeight: 21, color: '#B8B2AA', textAlign: 'center' },
  card: { borderRadius: 18, borderWidth: 1, backgroundColor: '#FFFFFF', padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 10 },
  cardTags: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  cardDot: { width: 11, height: 11, borderRadius: 6 },
  cardChip: { minHeight: 25, borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  cardKindChip: { backgroundColor: '#FFF7EA', borderColor: '#EEDCB6' },
  cardChipText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase' },
  cardRef: { marginBottom: 12, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.7, color: '#C0B8AE', textTransform: 'uppercase' },
  trashBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  quoteBlock: { paddingHorizontal: 18 },
  quoteText: { fontFamily: F.serifItalic, fontSize: 17, lineHeight: 28, color: '#4B5563' },
  quoteDivider: { height: 1, backgroundColor: '#E7EAF0', marginVertical: 13 },
  commentBox: { marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: '#F2E4C8', backgroundColor: '#FFF8EF', padding: 12 },
  commentText: { fontFamily: F.serif, fontSize: 16, lineHeight: 23, color: '#6F5320' },
  deleteOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: 'rgba(0,0,0,0.28)' },
  deleteCard: { width: '100%', maxWidth: 292, borderRadius: 24, backgroundColor: '#fff', padding: 20, alignItems: 'center' },
  deleteTitle: { marginTop: 10, fontFamily: F.serifMedium, fontSize: 18, color: '#3D3229' },
  deleteBody: { marginTop: 4, fontFamily: F.sans, fontSize: 11, color: '#9CA3AF', marginBottom: 18 },
  deleteActions: { flexDirection: 'row', gap: 9, width: '100%' },
  cancelBtn: { flex: 1, minHeight: 44, borderRadius: 15, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { flex: 1, minHeight: 44, borderRadius: 15, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.4, color: '#6B7280' },
  deleteText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.4, color: '#fff' },
});
