import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
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
import { LinearGradient } from 'expo-linear-gradient';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SmoothBottomSheet from '@/components/shared/SmoothBottomSheet';
import ConfirmModal from '@/components/shared/ConfirmModal';
import NotificationSettings, { type NotificationMode } from '@/components/shared/NotificationSettings';
import TaskFrequencyEditor from '@/components/shared/TaskFrequencyEditor';
import TaskTimeEditor from '@/components/shared/TaskTimeEditor';
import { useTasks } from '@/components/tasks/TaskProvider';
import type { TaskDraft } from '@/components/tasks/taskTypes';
import {
  BarChart3,
  Book,
  CalendarCheck,
  CheckSmall,
  ChevronDown,
  ChevronRight,
  Pencil,
  Play,
  Plus,
  Star,
  Trash2,
  X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { ReadingBook, ReadingFrequency, useReadingList } from './ReadingListContext';

type TabFilter = 'all' | 'to_read' | 'reading' | 'finished';

type CategoryDef = {
  label: string;
  color: string;
};

const CATEGORIES: CategoryDef[] = [
  { label: 'Spirituality', color: '#B8860B' },
  { label: 'Theology', color: '#92400E' },
  { label: 'Patristics', color: '#7C3AED' },
  { label: 'Prayer', color: '#C5A059' },
  { label: 'Philosophy', color: '#6D28D9' },
  { label: 'Psychology', color: '#DB2777' },
  { label: 'Biography', color: '#2563EB' },
  { label: 'Memoir', color: '#0F766E' },
  { label: 'History', color: '#B45309' },
  { label: 'Classic', color: '#1C1917' },
  { label: 'Literature', color: '#4338CA' },
  { label: 'Fiction', color: '#7C3AED' },
  { label: 'Poetry', color: '#9D174D' },
  { label: 'Self-Help', color: '#16A34A' },
  { label: 'Productivity', color: '#0891B2' },
  { label: 'Business', color: '#374151' },
  { label: 'Leadership', color: '#1D4ED8' },
  { label: 'Science', color: '#065F46' },
  { label: 'Health', color: '#DC2626' },
  { label: 'Nature', color: '#15803D' },
  { label: 'Art', color: '#7E22CE' },
  { label: 'Travel', color: '#0369A1' },
];

const DAY_OPTIONS = [
  { key: 1, label: 'M' },
  { key: 2, label: 'T' },
  { key: 3, label: 'W' },
  { key: 4, label: 'T' },
  { key: 5, label: 'F' },
  { key: 6, label: 'S' },
  { key: 0, label: 'S' },
];

const ALL_TASK_DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAY_TASK_INDEXES = [0, 1, 2, 3, 4];
const WEEKEND_TASK_INDEXES = [5, 6];

function getCategoryDef(label?: string) {
  return CATEGORIES.find(item => item.label === label) ?? (label ? { label, color: '#6B7280' } : null);
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const safe = normalized.length === 3 ? normalized.split('').map(char => `${char}${char}`).join('') : normalized;
  const parsed = Number.parseInt(safe, 16);
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

function getFrequencySummary(book: ReadingBook) {
  switch (book.taskFrequency) {
    case 'weekdays':
      return 'Weekdays';
    case 'weekends':
      return 'Weekends';
    case 'specific_days':
      return (book.taskSelectedDays ?? [])
        .map(day => DAY_OPTIONS.find(item => item.key === day)?.label)
        .filter(Boolean)
        .join(' ');
    case 'monthly':
      return book.taskMonthlyDays?.length ? `Monthly ${book.taskMonthlyDays.join(', ')}` : 'Monthly';
    default:
      return 'Daily';
  }
}

function jsDayToTaskIndex(day: number) {
  return day === 0 ? 6 : day - 1;
}

function taskIndexToJsDay(index: number) {
  return index === 6 ? 0 : index + 1;
}

function todayTaskIndex() {
  return jsDayToTaskIndex(new Date().getDay());
}

function getBookTaskTime(book: ReadingBook) {
  if (book.taskSameTimeEveryDay === false && book.taskDayTimes) {
    return book.taskDayTimes[todayTaskIndex()] ?? book.taskTime ?? '--:--';
  }
  return book.taskTime ?? '--:--';
}

function getActiveTaskDayIndexes(frequency: ReadingFrequency, selectedDays: number[]) {
  if (frequency === 'weekdays') return WEEKDAY_TASK_INDEXES;
  if (frequency === 'weekends') return WEEKEND_TASK_INDEXES;
  if (frequency === 'specific_days') return selectedDays.length ? selectedDays : [];
  return ALL_TASK_DAY_INDEXES;
}

function readingTaskId(bookId: string) {
  return `reading_book_${bookId}`;
}

function readingBookToTaskDraft(book: ReadingBook): TaskDraft {
  const frequency = book.taskFrequency ?? 'daily';
  return {
    id: readingTaskId(book.id),
    title: book.title,
    subtitle: [book.author, getFrequencySummary(book)].filter(Boolean).join(' - '),
    level: 2,
    source: 'reading_book',
    type: 'reading',
    icon: 'Book',
    targetView: '/reading-list',
    schedule: {
      frequency,
      selectedDays: frequency === 'specific_days'
        ? (book.taskSelectedDays ?? []).map(jsDayToTaskIndex).sort((a, b) => a - b)
        : [],
      monthlyDays: frequency === 'monthly' ? book.taskMonthlyDays ?? [1] : [1],
      time: book.taskTime ?? '21:00',
      sameTimeEveryDay: book.taskSameTimeEveryDay !== false,
      dayTimes: book.taskSameTimeEveryDay === false ? book.taskDayTimes ?? {} : {},
    },
    notificationMode: book.taskNotificationMode ?? 'none',
    reminderMinutes: book.taskNotificationMode === 'double' ? book.taskReminderMinutes : undefined,
    readingBookConfig: { bookId: book.id },
  };
}

export default function ReadingListView() {
  const router = useRouter();
  const { books, addBook, updateBook, deleteBook, recordSession } = useReadingList();
  const { createOrUpdateTask, remove: removeTask } = useTasks();
  const [categoryDefs, setCategoryDefs] = useState<CategoryDef[]>(CATEGORIES);
  const [tab, setTab] = useState<TabFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReadingBook | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<ReadingBook | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [customTag, setCustomTag] = useState('');

  const filtered = useMemo(() => {
    const base = tab === 'all' ? books : books.filter(book => book.status === tab);
    const categoryReady = categoryFilter ? base.filter(book => book.category === categoryFilter) : base;
    return [...categoryReady].sort((a, b) => {
      const order: Record<ReadingBook['status'], number> = { reading: 0, to_read: 1, finished: 2 };
      return order[a.status] - order[b.status] || b.createdAt - a.createdAt;
    });
  }, [books, tab, categoryFilter]);

  const counts = useMemo(() => ({
    all: books.length,
    to_read: books.filter(book => book.status === 'to_read').length,
    reading: books.filter(book => book.status === 'reading').length,
    finished: books.filter(book => book.status === 'finished').length,
  }), [books]);

  const usedCategories = useMemo(() => Array.from(new Set(books.map(book => book.category).filter(Boolean))) as string[], [books]);

  const getActiveDef = (label?: string): CategoryDef | null => {
    if (!label) return null;
    return categoryDefs.find(c => c.label === label) ?? { label, color: '#6B7280' };
  };

  const addNewBook = () => {
    if (!title.trim()) return;
    addBook({
      id: `book_${Date.now()}`,
      title: title.trim(),
      author: author.trim() || undefined,
      category: (category ?? customTag.trim()) || undefined,
      status: 'to_read',
      createdAt: Date.now(),
      sessions: 0,
      totalMinutes: 0,
      showOnHome: false,
      taskFrequency: 'daily',
      taskMonthlyDays: [1],
      taskSameTimeEveryDay: true,
      taskDayTimes: {},
      taskNotificationMode: 'none',
      taskReminderMinutes: 15,
    });
    setTitle('');
    setAuthor('');
    setCategory(null);
    setCustomTag('');
    setShowForm(false);
  };

  const changeStatus = async (book: ReadingBook, status: ReadingBook['status']) => {
    if (status !== 'reading' && book.showOnHome) {
      await removeTask(readingTaskId(book.id));
    }
    updateBook(book.id, {
      status,
      startedAt: status === 'reading' ? (book.startedAt ?? Date.now()) : book.startedAt,
      finishedAt: status === 'finished' ? (book.finishedAt ?? Date.now()) : undefined,
      showOnHome: status === 'reading' ? book.showOnHome : false,
    });
  };

  return (
    <View style={s.screen}>
      <ScreenTitleBar title="READING LIST" showBack />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Action Hub */}
        <View style={s.actionHub}>
          <LinearGradient
            colors={['#FFFDF8', '#FFF3D4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <TouchableOpacity onPress={() => router.push('/reading-session')} activeOpacity={0.84} style={s.hubPrimary}>
            <View style={s.hubPlayCircle}>
              <Play s={16} c="#FFFFFF" />
            </View>
            <Text style={s.hubPrimaryTitle}>Start Reading</Text>
            <ChevronRight s={16} c="rgba(197,160,89,0.45)" />
          </TouchableOpacity>

          <View style={s.hubDivider} />

          <View style={s.hubSecondaryRow}>
            <TouchableOpacity onPress={() => router.push('/reading-analytics')} activeOpacity={0.82} style={s.hubSecondaryBtn}>
              <BarChart3 s={14} c="#B8B0A8" />
              <Text style={s.hubSecondaryLabel}>Analytics</Text>
            </TouchableOpacity>
            <View style={s.hubVertDivider} />
            <TouchableOpacity onPress={() => setShowForm(v => !v)} activeOpacity={0.82} style={s.hubSecondaryBtn}>
              {showForm ? <X s={14} c="#B8B0A8" /> : <Plus s={14} c={C.gold} />}
              <Text style={[s.hubSecondaryLabel, !showForm && s.hubSecondaryLabelGold]}>
                {showForm ? 'Cancel' : 'Add Book'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.edgeScroll} contentContainerStyle={s.tabRow}>
          {[
            { key: 'all' as const, label: 'All', count: counts.all },
            { key: 'to_read' as const, label: 'To Read', count: counts.to_read },
            { key: 'reading' as const, label: 'Reading', count: counts.reading },
            { key: 'finished' as const, label: 'Done', count: counts.finished },
          ].map(item => {
            const active = tab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setTab(item.key)}
                activeOpacity={0.82}
                style={[s.tabChip, active && s.tabChipActive]}
              >
                <Text style={[s.tabChipLabel, active && s.tabChipLabelActive]}>{item.label}</Text>
                <View style={[s.tabChipBadge, active && s.tabChipBadgeActive]}>
                  <Text style={[s.tabChipCount, active && s.tabChipCountActive]}>{item.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.edgeScroll} contentContainerStyle={s.categoryRow}>
          <TouchableOpacity
            onPress={() => setCategoryFilter(null)}
            activeOpacity={0.82}
            style={[s.filterChip, !categoryFilter && s.filterChipActive]}
          >
            <Text style={[s.filterChipText, !categoryFilter && s.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {categoryDefs.map(def => (
            <CategoryChip
              key={def.label}
              label={def.label}
              color={def.color}
              active={categoryFilter === def.label}
              onPress={() => setCategoryFilter(current => current === def.label ? null : def.label)}
            />
          ))}
          {usedCategories.filter(t => !categoryDefs.find(d => d.label === t)).map(item => (
            <CategoryChip
              key={item}
              label={item}
              color="#6B7280"
              active={categoryFilter === item}
              onPress={() => setCategoryFilter(current => current === item ? null : item)}
            />
          ))}
          <TouchableOpacity onPress={() => setTagEditorOpen(true)} activeOpacity={0.82} style={s.editTagChip}>
            <Pencil s={12} c="#9CA3AF" />
          </TouchableOpacity>
        </ScrollView>

        {showForm && (
          <View style={s.formShell}>
            <View style={s.formCard}>
              <Text style={s.formLabel}>ADD A BOOK</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Book title..."
                placeholderTextColor="#D1D5DB"
                style={s.formInput}
              />
              <TextInput
                value={author}
                onChangeText={setAuthor}
                placeholder="Author (optional)..."
                placeholderTextColor="#D1D5DB"
                style={[s.formInput, s.formInputSmall]}
              />
              <Text style={s.formLabel}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.formCategoryRow}>
                {CATEGORIES.map(item => (
                  <CategoryChip
                    key={item.label}
                    label={item.label}
                    color={item.color}
                    active={category === item.label}
                    onPress={() => { setCategory(item.label); setCustomTag(''); }}
                  />
                ))}
              </ScrollView>
              <View style={s.customRow}>
                <TextInput
                  value={customTag}
                  onChangeText={value => { setCustomTag(value); if (value.trim()) setCategory(null); }}
                  placeholder="Custom tag..."
                  placeholderTextColor="#D1D5DB"
                  style={[s.formInput, s.customInput]}
                />
              </View>
              <TouchableOpacity onPress={addNewBook} activeOpacity={0.84} disabled={!title.trim()} style={[s.formSave, !title.trim() && s.formSaveDisabled]}>
                <Text style={s.formSaveText}>ADD BOOK</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={s.bookList}>
          {filtered.map(book => {
            const expanded = expandedId === book.id;
            const categoryDef = getActiveDef(book.category);
            const accent = categoryDef?.color ?? C.gold;
            return (
              <View
                key={book.id}
                style={[
                  s.bookCard,
                  {
                    borderColor: hexToRgba(accent, 0.18),
                    backgroundColor: '#FFFFFF',
                    shadowColor: accent,
                  },
                ]}
              >
                <View style={[s.bookWash, { backgroundColor: hexToRgba(accent, 0.08) }]} />
                <View style={s.bookWatermark}>
                  <Book
                    s={58}
                    c={hexToRgba(accent, 0.12)}
                    w={1.5}
                  />
                </View>
                <TouchableOpacity onPress={() => setExpandedId(current => current === book.id ? null : book.id)} activeOpacity={0.86} style={s.bookHead}>
                  <View style={[s.bookAccent, { backgroundColor: accent }]} />
                  <View style={s.bookHeadCopy}>
                    <View style={s.bookTitleRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.bookTitle}>{book.title}</Text>
                        {!!book.author && <Text style={s.bookAuthor}>{book.author}</Text>}
                      </View>
                      <View style={[s.statusPill, { backgroundColor: hexToRgba(statusColor(book.status), 0.09), borderColor: hexToRgba(statusColor(book.status), 0.15) }]}>
                        <Text style={[s.statusText, { color: statusColor(book.status) }]}>{statusLabel(book.status)}</Text>
                      </View>
                    </View>

                    <View style={s.bookMetaRow}>
                      {categoryDef ? (
                        <CategoryChip label={categoryDef.label} color={categoryDef.color} active small />
                      ) : (
                        <View style={s.noTagPill}><Text style={s.noTagText}>No Tag</Text></View>
                      )}
                      {book.status === 'finished' && !!book.rating && (
                        <View style={s.starRow}>
                          {Array.from({ length: 5 }, (_, index) => {
                            const active = index < (book.rating ?? 0);
                            return (
                              <Star
                                key={index}
                                s={12}
                                c={active ? C.gold : '#D1D5DB'}
                                fill={active ? C.gold : 'none'}
                                w={active ? 0 : 1.5}
                              />
                            );
                          })}
                        </View>
                      )}
                    </View>

                    <View style={s.bookInfoRow}>
                      <Text style={s.metaInline}>{book.sessions} sessions</Text>
                      <Text style={s.metaSlash}>/</Text>
                      <Text style={s.metaInline}>{formatMinutes(book.totalMinutes)}</Text>
                      {book.taskTime && (
                        <>
                          <Text style={s.metaSlash}>/</Text>
                          <Text style={s.metaInline}>{book.taskTime}</Text>
                        </>
                      )}
                    </View>
                  </View>
                  <View style={[s.chevronWrap, expanded && s.chevronWrapExpanded]}>
                    <ChevronDown s={16} c="#D1D5DB" />
                  </View>
                </TouchableOpacity>

                {expanded && (
                  <View style={s.bookBody}>
                    <View style={s.segmentedRow}>
                      {(['to_read', 'reading', 'finished'] as ReadingBook['status'][]).map(item => {
                        const active = book.status === item;
                        return (
                          <TouchableOpacity
                            key={item}
                            onPress={() => changeStatus(book, item)}
                            activeOpacity={0.82}
                            style={[s.segmentedChip, active && { backgroundColor: hexToRgba(statusColor(item), 0.12), borderColor: hexToRgba(statusColor(item), 0.2) }]}
                          >
                            <Text style={[s.segmentedText, active && { color: statusColor(item) }]}>{statusLabel(item)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Set as Daily Task — samo u READING modu */}
                    {book.status === 'reading' && (
                      <LinearGradient
                        colors={['#FFFBF2', '#FFF8E7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={s.taskToggle}
                      >
                        <TouchableOpacity
                          onPress={() => setScheduleTarget(book)}
                          activeOpacity={0.82}
                          style={s.taskToggleMain}
                        >
                          <View style={s.taskToggleIcon}>
                            <CalendarCheck s={16} c={C.gold} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.taskToggleTitle}>Set as Daily Task</Text>
                            <Text style={s.taskToggleSub}>
                              {book.showOnHome
                                ? `${getBookTaskTime(book)} - ${getFrequencySummary(book)}`
                                : 'Add to your daily routine'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={async () => {
                            if (book.showOnHome) {
                              await removeTask(readingTaskId(book.id));
                              updateBook(book.id, { showOnHome: false });
                              return;
                            }
                            setScheduleTarget(book);
                          }}
                          activeOpacity={0.8}
                          style={[s.taskSwitch, book.showOnHome && { backgroundColor: C.gold }]}
                        >
                          <View style={[s.taskSwitchKnob, book.showOnHome && s.taskSwitchKnobOn]} />
                        </TouchableOpacity>
                      </LinearGradient>
                    )}

                    {/* Start Reading — samo u READING modu */}
                    {book.status === 'reading' && (
                      <TouchableOpacity
                        onPress={() => router.push({ pathname: '/reading-session', params: { bookId: book.id, title: book.title, author: book.author ?? '' } })}
                        activeOpacity={0.84}
                        style={[s.actionRow, { borderColor: hexToRgba(accent, 0.20), backgroundColor: hexToRgba(accent, 0.05) }]}
                      >
                        <View style={[s.actionRowIcon, { backgroundColor: hexToRgba(accent, 0.14) }]}>
                          <Play s={15} c={accent} />
                        </View>
                        <View style={s.actionRowCopy}>
                          <Text style={s.actionRowKicker}>READING SESSION</Text>
                          <Text style={[s.actionRowTitle, { color: accent }]}>Start Reading</Text>
                        </View>
                        <View style={[s.actionRowArrow, { backgroundColor: hexToRgba(accent, 0.12) }]}>
                          <Play s={11} c={accent} />
                        </View>
                      </TouchableOpacity>
                    )}

                    {/* Write Notes — uvek */}
                    <TouchableOpacity
                      onPress={() => router.push('/notes')}
                      activeOpacity={0.84}
                      style={[s.actionRow, { borderColor: 'rgba(120,113,108,0.14)', backgroundColor: 'rgba(120,113,108,0.04)' }]}
                    >
                      <View style={[s.actionRowIcon, { backgroundColor: 'rgba(120,113,108,0.10)' }]}>
                        <Pencil s={15} c="#78716C" />
                      </View>
                      <View style={s.actionRowCopy}>
                        <Text style={s.actionRowKicker}>PERSONAL NOTES</Text>
                        <Text style={[s.actionRowTitle, { color: '#78716C' }]}>Write Notes</Text>
                      </View>
                      <View style={[s.actionRowArrow, { backgroundColor: 'rgba(120,113,108,0.08)' }]}>
                        <Pencil s={11} c="#78716C" />
                      </View>
                    </TouchableOpacity>

                    {book.status === 'finished' && (
                      <View style={s.ratingCard}>
                        <View style={s.ratingCardHead}>
                          <Text style={s.ratingCardLabel}>YOUR RATING</Text>
                          {!!book.rating && (
                            <Text style={s.ratingScoreText}>{book.rating} / 5</Text>
                          )}
                        </View>
                        <View style={s.ratingStarsRow}>
                          {Array.from({ length: 5 }, (_, index) => {
                            const active = index < (book.rating ?? 0);
                            return (
                              <TouchableOpacity
                                key={index}
                                onPress={() => updateBook(book.id, { rating: index + 1 })}
                                activeOpacity={0.72}
                                style={s.ratingStarTouch}
                                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                              >
                                <Star
                                  s={30}
                                  c={active ? C.gold : '#D1D5DB'}
                                  fill={active ? C.gold : 'none'}
                                  w={active ? 0 : 1.4}
                                />
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    <TouchableOpacity onPress={() => setDeleteTarget(book)} activeOpacity={0.84} style={s.deleteRow}>
                      <Trash2 s={14} c="#DC2626" />
                      <Text style={s.deleteText}>Delete Book</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>


      <ScheduleModal
        book={scheduleTarget}
        onClose={() => setScheduleTarget(null)}
        onSave={async (bookId, updates) => {
          const book = books.find(item => item.id === bookId);
          if (!book) return;
          const nextBook = { ...book, ...updates };
          await createOrUpdateTask(readingBookToTaskDraft(nextBook));
          updateBook(bookId, updates);
          setScheduleTarget(null);
        }}
      />

      <ConfirmModal
        visible={!!deleteTarget}
        icon={<Trash2 s={22} c="#EF4444" />}
        iconBg="#FEF2F2"
        title="Delete this book?"
        body={deleteTarget?.title}
        cancelLabel="KEEP"
        confirmLabel="DELETE"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await removeTask(readingTaskId(deleteTarget.id));
            deleteBook(deleteTarget.id);
          }
          setDeleteTarget(null);
          setExpandedId(null);
        }}
      />

      <TagEditorModal
        visible={tagEditorOpen}
        categoryDefs={categoryDefs}
        books={books}
        updateBook={updateBook}
        onClose={() => setTagEditorOpen(false)}
        onSave={setCategoryDefs}
      />
    </View>
  );
}

function CategoryChip({
  label,
  color,
  active,
  onPress,
  small = false,
}: {
  label: string;
  color: string;
  active?: boolean;
  onPress?: () => void;
  small?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.84}
      style={[
        small ? s.categoryChipSmall : s.categoryChip,
        {
          backgroundColor: active ? color : hexToRgba(color, 0.09),
          borderColor: active ? color : hexToRgba(color, 0.22),
        },
      ]}
    >
      <View style={[s.categoryDot, { backgroundColor: active ? '#FFFFFF' : color }]} />
      <Text style={[small ? s.categoryTextSmall : s.categoryText, { color: active ? '#FFFFFF' : color }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}


function ScheduleModal({
  book,
  onClose,
  onSave,
}: {
  book: ReadingBook | null;
  onClose: () => void;
  onSave: (bookId: string, updates: Partial<ReadingBook>) => void | Promise<void>;
}) {
  const [time, setTime] = useState('21:00');
  const [frequency, setFrequency] = useState<ReadingFrequency>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [monthlyDays, setMonthlyDays] = useState<number[]>([1]);
  const [sameTimeEveryDay, setSameTimeEveryDay] = useState(true);
  const [dayTimes, setDayTimes] = useState<Record<number, string>>({});
  const [notificationMode, setNotificationMode] = useState<NotificationMode>('none');
  const [reminderMinutes, setReminderMinutes] = useState(15);

  React.useEffect(() => {
    if (!book) return;
    setTime(book.taskTime ?? '21:00');
    setFrequency(book.taskFrequency ?? 'daily');
    setSelectedDays((book.taskSelectedDays ?? []).map(jsDayToTaskIndex).sort((a, b) => a - b));
    setMonthlyDays(book.taskMonthlyDays?.length ? book.taskMonthlyDays : [1]);
    setSameTimeEveryDay(book.taskSameTimeEveryDay !== false);
    setDayTimes(book.taskDayTimes ?? {});
    setNotificationMode(book.taskNotificationMode ?? 'none');
    setReminderMinutes(book.taskReminderMinutes ?? 15);
  }, [book]);

  if (!book) return null;

  const categoryDef = getCategoryDef(book.category);
  const accent = categoryDef?.color ?? C.gold;
  const softAccent = hexToRgba(accent, 0.08);
  const activeDayIndexes = getActiveTaskDayIndexes(frequency, selectedDays);
  const canSave = (frequency !== 'specific_days' || selectedDays.length > 0)
    && (frequency !== 'monthly' || monthlyDays.length > 0);
  const actionLabel = book.showOnHome ? 'SAVE CHANGES' : 'START TASK';

  const saveSchedule = async () => {
    if (!canSave) return;

    await onSave(book.id, {
      taskTime: time,
      taskFrequency: frequency,
      taskSelectedDays: frequency === 'specific_days' ? selectedDays.map(taskIndexToJsDay) : undefined,
      taskMonthlyDays: frequency === 'monthly' ? monthlyDays : undefined,
      showOnHome: true,
      taskSameTimeEveryDay: frequency === 'monthly' ? true : sameTimeEveryDay,
      taskDayTimes: sameTimeEveryDay || frequency === 'monthly' ? {} : dayTimes,
      taskNotificationMode: notificationMode,
      taskReminderMinutes: notificationMode === 'double' ? reminderMinutes : 15,
    });
  };

  return (
    <SmoothBottomSheet visible={!!book} onClose={onClose} sheetStyle={s.sheet}>
      <View style={s.sheetHandle} />
      <View style={s.sheetHead}>
        <TouchableOpacity onPress={onClose} style={s.sheetHeadBtn} activeOpacity={0.7}>
          <X s={19} c="#9CA3AF" />
        </TouchableOpacity>
        <View style={s.sheetTitleWrap}>
          <Text style={s.sheetKicker}>Daily Task</Text>
          <Text style={s.sheetTitle} numberOfLines={1}>{book.title}</Text>
        </View>
        <TouchableOpacity
          onPress={saveSchedule}
          disabled={!canSave}
          style={[s.sheetHeadBtn, s.sheetSave, { backgroundColor: accent, opacity: canSave ? 1 : 0.38 }]}
          activeOpacity={0.84}
        >
          <CheckSmall s={17} c="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.sheetContent} showsVerticalScrollIndicator={false}>
        <View style={[s.schedulePreview, { borderColor: hexToRgba(accent, 0.18), backgroundColor: softAccent }]}>
          <View style={[s.schedulePreviewIcon, { backgroundColor: hexToRgba(accent, 0.12) }]}>
            <Book s={22} c={accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.schedulePreviewKicker, { color: accent }]}>Reading Practice</Text>
            <Text style={s.schedulePreviewTitle} numberOfLines={2}>{book.title}</Text>
            {!!book.author && <Text style={s.schedulePreviewSub} numberOfLines={1}>{book.author}</Text>}
          </View>
        </View>

        <View style={s.sheetBlock}>
          <TaskFrequencyEditor
            frequency={frequency}
            selectedDays={selectedDays}
            monthlyDays={monthlyDays}
            accent={accent}
            label="Schedule"
            onFrequencyChange={nextFrequency => {
              setFrequency(nextFrequency);
              if (nextFrequency === 'weekdays') setSelectedDays([0, 1, 2, 3, 4]);
              if (nextFrequency === 'weekends') setSelectedDays([5, 6]);
              if (nextFrequency === 'monthly') setSameTimeEveryDay(true);
            }}
            onSelectedDaysChange={setSelectedDays}
            onMonthlyDaysChange={setMonthlyDays}
          />
        </View>

        <View style={s.sheetBlock}>
          <TaskTimeEditor
            time={time}
            sameTimeEveryDay={sameTimeEveryDay}
            dayTimes={dayTimes}
            onTimeChange={setTime}
            onSameTimeEveryDayChange={setSameTimeEveryDay}
            onDayTimesChange={setDayTimes}
            activeDayIndexes={activeDayIndexes}
            allowPerDayTimes={frequency !== 'monthly' && (frequency !== 'specific_days' || selectedDays.length > 0)}
            accent={accent}
            softBg={hexToRgba(accent, 0.06)}
            borderColor={hexToRgba(accent, 0.18)}
            mutedColor="#A8AFBC"
          />
        </View>

        <View style={s.sheetBlock}>
          <NotificationSettings
            mode={notificationMode}
            reminderMinutes={reminderMinutes}
            onModeChange={setNotificationMode}
            onReminderChange={setReminderMinutes}
            accent={accent}
          />
        </View>

        <TouchableOpacity
          onPress={saveSchedule}
          disabled={!canSave}
          activeOpacity={0.88}
          style={[s.sheetPrimary, { backgroundColor: accent, shadowColor: accent, opacity: canSave ? 1 : 0.38 }]}
        >
          <CalendarCheck s={16} c="#FFFFFF" />
          <Text style={s.sheetPrimaryText}>{actionLabel}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SmoothBottomSheet>
  );
}

function TagEditorModal({
  visible,
  categoryDefs,
  books,
  updateBook,
  onClose,
  onSave,
}: {
  visible: boolean;
  categoryDefs: CategoryDef[];
  books: ReadingBook[];
  updateBook: (id: string, updates: Partial<ReadingBook>) => void;
  onClose: () => void;
  onSave: (defs: CategoryDef[]) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', e => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (visible) {
      const initial: Record<string, string> = {};
      categoryDefs.forEach(def => { initial[def.color] = def.label; });
      setDrafts(initial);
    }
  }, [visible]);

  const save = () => {
    const updated = categoryDefs.map(def => {
      const newLabel = (drafts[def.color] ?? def.label).trim() || def.label;
      if (newLabel !== def.label) {
        books.forEach(book => {
          if (book.category === def.label) {
            updateBook(book.id, { category: newLabel });
          }
        });
      }
      return { ...def, label: newLabel };
    });
    onSave(updated);
    onClose();
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[s.tagEditorOverlay, kbHeight > 0 && { paddingBottom: kbHeight }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.tagEditorCard}>
          <View style={s.tagEditorHeader}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.84} style={s.tagEditorClose}>
              <X s={18} c="#9CA3AF" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.tagEditorKicker}>READING LIST</Text>
              <Text style={s.tagEditorTitle}>Tag Names</Text>
            </View>
            <TouchableOpacity onPress={save} activeOpacity={0.84} style={s.tagEditorSaveBtn}>
              <CheckSmall s={17} c="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {categoryDefs.map(def => (
              <View key={def.color} style={[s.tagEditorRow, { borderColor: hexToRgba(def.color, 0.2), backgroundColor: hexToRgba(def.color, 0.05) }]}>
                <View style={[s.tagEditorDot, { backgroundColor: def.color }]} />
                <TextInput
                  value={drafts[def.color] ?? def.label}
                  onChangeText={val => setDrafts(prev => ({ ...prev, [def.color]: val }))}
                  placeholder={def.label}
                  placeholderTextColor="#D1D5DB"
                  style={s.tagEditorInput}
                  autoCapitalize="words"
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function statusColor(status: ReadingBook['status']) {
  if (status === 'reading') return C.gold;
  if (status === 'finished') return '#16A34A';
  return '#2563EB';
}

function statusLabel(status: ReadingBook['status']) {
  if (status === 'to_read') return 'To Read';
  if (status === 'finished') return 'Finished';
  return 'Reading';
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAFAFA' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 130 },
  actionHub: {
    marginHorizontal: -20,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(197,160,89,0.18)',
    marginBottom: 4,
  },
  hubPlayCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', shadowColor: C.gold, shadowOpacity: 0.38, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4 },
  hubPrimary: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 17 },
  hubPrimaryTitle: { fontFamily: F.serifMedium, fontSize: 20, color: '#1C1917', flex: 1 },
  hubDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(197,160,89,0.35)', marginHorizontal: 20 },
  hubSecondaryRow: { flexDirection: 'row' },
  hubVertDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(197,160,89,0.3)', marginVertical: 12 },
  hubSecondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 14 },
  hubSecondaryLabel: { fontFamily: F.sansMedium, fontSize: 13, color: '#A8A29E' },
  hubSecondaryLabelGold: { color: C.gold },
  edgeScroll: { marginHorizontal: -20 },
  tabRow: { gap: 8, paddingTop: 14, paddingBottom: 8, paddingHorizontal: 20 },
  tabChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#EAE5DC', backgroundColor: '#F9F7F4' },
  tabChipActive: { backgroundColor: 'rgba(197,160,89,0.09)', borderColor: 'rgba(197,160,89,0.42)' },
  tabChipLabel: { fontFamily: F.sansMedium, fontSize: 12, letterSpacing: 0.2, color: '#A8A29E' },
  tabChipLabelActive: { fontFamily: F.sansBold, color: C.gold },
  tabChipBadge: { minWidth: 20, height: 18, borderRadius: 9, backgroundColor: '#EDEAE4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tabChipBadgeActive: { backgroundColor: 'rgba(197,160,89,0.16)' },
  tabChipCount: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 0.2, color: '#B8B0A6' },
  tabChipCountActive: { color: C.goldDark },
  categoryRow: { gap: 8, paddingBottom: 8, paddingHorizontal: 20 },
  filterChip: { paddingHorizontal: 12, minHeight: 32, borderRadius: 16, borderWidth: 1, borderColor: '#E7E5E4', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: '#1C1917', borderColor: '#1C1917' },
  filterChipText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.35, color: '#A8A29E', textTransform: 'uppercase' },
  filterChipTextActive: { color: '#FFFFFF' },
  categoryChip: { minHeight: 34, borderRadius: 17, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  categoryChipSmall: { minHeight: 28, borderRadius: 14, borderWidth: 1, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  categoryDot: { width: 7, height: 7, borderRadius: 4 },
  categoryText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  categoryTextSmall: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.1, textTransform: 'uppercase' },
  formShell: { paddingTop: 10, paddingBottom: 8 },
  formCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E8DCC4',
    backgroundColor: '#FFFFFF',
    padding: 18,
    shadowColor: '#C5A059',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 3,
  },
  formLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: '#A8A29E', textTransform: 'uppercase', marginBottom: 10, marginTop: 6 },
  formInput: { minHeight: 48, borderRadius: 18, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#F2F1EC', paddingHorizontal: 16, fontFamily: F.serif, fontSize: 20, color: '#1F2937', marginBottom: 10 },
  formInputSmall: { fontSize: 17 },
  formCategoryRow: { gap: 8, paddingBottom: 4 },
  customRow: { marginTop: 8 },
  customInput: { fontSize: 15, marginBottom: 0 },
  formSave: { marginTop: 14, minHeight: 50, borderRadius: 23, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  formSaveDisabled: { opacity: 0.35 },
  formSaveText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2, color: '#FFFFFF' },
  bookList: { gap: 14, paddingTop: 8 },
  bookCard: {
    position: 'relative',
    borderRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 28,
    elevation: 3,
  },
  bookWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 84 },
  bookWatermark: { position: 'absolute', right: 16, top: 16, opacity: 0.9 },
  bookHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 18, paddingVertical: 18 },
  bookAccent: { width: 5, alignSelf: 'stretch', borderRadius: 999 },
  bookHeadCopy: { flex: 1 },
  bookTitleRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bookTitle: { fontFamily: F.serifMedium, fontSize: 22, lineHeight: 26, color: '#111827' },
  bookAuthor: { marginTop: 2, fontFamily: F.sans, fontSize: 11, color: '#9CA3AF' },
  statusPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
  statusText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.7, textTransform: 'uppercase' },
  bookMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  noTagPill: { minHeight: 28, borderRadius: 14, borderWidth: 1, borderColor: '#E7E5E4', backgroundColor: '#FAFAFA', paddingHorizontal: 10, justifyContent: 'center' },
  noTagText: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.2, color: '#A8A29E', textTransform: 'uppercase' },
  starRow: { flexDirection: 'row', gap: 4 },
  bookInfoRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  metaInline: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.2, color: '#9CA3AF', textTransform: 'uppercase' },
  metaSlash: { fontFamily: F.sansBold, fontSize: 9, color: '#D1D5DB' },
  chevronWrap: { marginTop: 2 },
  chevronWrapExpanded: { transform: [{ rotate: '180deg' }] },
  bookBody: { paddingHorizontal: 18, paddingBottom: 18, borderTopWidth: 1, borderTopColor: '#F5F5F4' },
  segmentedRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 14 },
  segmentedChip: { flex: 1, minHeight: 38, borderRadius: 18, borderWidth: 1, borderColor: '#F0EDE6', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  segmentedText: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.3, color: '#A8A29E', textTransform: 'uppercase' },
  taskToggle: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(232,220,196,0.7)', paddingHorizontal: 16, paddingVertical: 13, marginBottom: 10 },
  taskToggleMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  taskToggleIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(197,160,89,0.10)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  taskToggleTitle: { fontFamily: F.sansSemiBold, fontSize: 14, color: '#374151', lineHeight: 18 },
  taskToggleSub: { fontFamily: F.sans, fontSize: 12, color: '#9CA3AF', marginTop: 2, lineHeight: 16 },
  taskSwitch: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#E5E7EB', padding: 3, flexShrink: 0 },
  taskSwitchKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  taskSwitchKnobOn: { transform: [{ translateX: 20 }] },
  actionStack: { gap: 8, marginBottom: 4 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  actionRowIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actionRowCopy: { flex: 1 },
  actionRowKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, color: '#A8A29E', textTransform: 'uppercase' },
  actionRowTitle: { marginTop: 2, fontFamily: F.serifMedium, fontSize: 17, lineHeight: 21 },
  actionRowArrow: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ratingCard: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: 'rgba(197,160,89,0.05)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ratingCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  ratingCardLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, color: '#A8A29E', textTransform: 'uppercase' },
  ratingScoreText: { fontFamily: F.serifMedium, fontSize: 15, color: C.gold },
  ratingStarsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  ratingStarTouch: { padding: 4 },
  deleteRow: { marginTop: 16, minHeight: 44, borderRadius: 18, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  deleteText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: '#DC2626', textTransform: 'uppercase' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.32)' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.34)' },
  sheet: { borderTopLeftRadius: 34, borderTopRightRadius: 34, backgroundColor: '#FAFAFA', paddingBottom: 22, maxHeight: '88%', overflow: 'hidden' },
  sheetHandle: { width: 42, height: 4, borderRadius: 999, backgroundColor: '#D6D3D1', alignSelf: 'center', marginTop: 12, marginBottom: 6 },
  sheetHead: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#F0EDE6' },
  sheetHeadBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sheetSave: { backgroundColor: C.gold, shadowColor: C.gold, shadowOpacity: 0.24, shadowOffset: { width: 0, height: 7 }, shadowRadius: 12, elevation: 3 },
  sheetTitleWrap: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 8 },
  sheetKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.textMuted, textTransform: 'uppercase' },
  sheetTitle: { fontFamily: F.serifMedium, fontSize: 19, color: C.text, marginTop: 2, maxWidth: 220 },
  sheetContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 20, gap: 14 },
  sheetBlock: { borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F2F1EC', padding: 16, gap: 13 },
  sheetBlockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetBlockLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.gold, textTransform: 'uppercase' },
  schedulePreview: { minHeight: 90, borderRadius: 24, borderWidth: 1, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  schedulePreviewIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  schedulePreviewKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, textTransform: 'uppercase' },
  schedulePreviewTitle: { marginTop: 4, fontFamily: F.serifMedium, fontSize: 19, lineHeight: 23, color: '#111827' },
  schedulePreviewSub: { marginTop: 2, fontFamily: F.sans, fontSize: 11, color: '#9CA3AF' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleCopy: { flex: 1, fontFamily: F.serif, fontSize: 16, lineHeight: 20, color: '#6B7280' },
  toggle: { width: 50, height: 30, borderRadius: 16, backgroundColor: '#E5E7EB', padding: 3 },
  toggleActive: { backgroundColor: C.gold },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
  toggleKnobActive: { transform: [{ translateX: 20 }] },
  sheetPrimary: { minHeight: 56, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  sheetPrimaryText: { fontFamily: F.sansBold, fontSize: 12, letterSpacing: 2, color: '#FFFFFF' },
  timeInput: { minHeight: 52, borderRadius: 20, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#F2F1EC', paddingHorizontal: 16, fontFamily: F.serif, fontSize: 22, color: '#1F2937' },
  frequencyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  frequencyChip: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  frequencyChipActive: { backgroundColor: '#F8F5ED', borderColor: '#E8DCC4' },
  frequencyText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.3, color: '#9CA3AF', textTransform: 'uppercase' },
  frequencyTextActive: { color: C.gold },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  editTagChip: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#EAE5DC', backgroundColor: '#F9F7F4', alignItems: 'center', justifyContent: 'center' },
  tagEditorOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.42)' },
  tagEditorCard: { width: '100%', maxWidth: 360, height: '88%', maxHeight: 690, borderRadius: 30, backgroundColor: '#FAFAF8', padding: 0, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.22, shadowOffset: { width: 0, height: 14 }, shadowRadius: 34, elevation: 16 },
  tagEditorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0EDE6', marginBottom: 0 },
  tagEditorKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.textMuted, textTransform: 'uppercase' },
  tagEditorTitle: { fontFamily: F.serifMedium, fontSize: 20, color: C.text, marginTop: 2 },
  tagEditorClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F0EC', alignItems: 'center', justifyContent: 'center' },
  tagEditorSaveBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', shadowColor: C.gold, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 3 },
  tagEditorRow: { minHeight: 52, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, marginHorizontal: 18, marginBottom: 8 },
  tagEditorDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  tagEditorInput: { flex: 1, fontFamily: F.serifMedium, fontSize: 17, color: '#1C1917', paddingVertical: 0 },
  dayChipActive: { backgroundColor: '#F8F5ED', borderColor: '#E8DCC4' },
  dayChipText: { fontFamily: F.sansBold, fontSize: 11, color: '#A8A29E' },
  dayChipTextActive: { color: C.gold },
});
