import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import {
  BarChart3,
  Book,
  CalendarCheck,
  CheckSmall,
  ChevronDown,
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
  { label: 'Fiction', color: '#7C3AED' },
  { label: 'Biography', color: '#2563EB' },
  { label: 'Self-Help', color: '#C5A059' },
  { label: 'Business', color: '#1C1917' },
  { label: 'Productivity', color: '#16A34A' },
  { label: 'Spirituality', color: '#B8860B' },
  { label: 'History', color: '#92400E' },
  { label: 'Science', color: '#0891B2' },
  { label: 'Psychology', color: '#DB2777' },
  { label: 'Philosophy', color: '#6D28D9' },
];

const FREQUENCY_OPTIONS: { value: ReadingFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'specific_days', label: 'Specific Days' },
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
    default:
      return 'Daily';
  }
}

export default function ReadingListView() {
  const router = useRouter();
  const { books, addBook, updateBook, deleteBook, recordSession } = useReadingList();
  const [tab, setTab] = useState<TabFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReadingBook | null>(null);
  const [sessionTarget, setSessionTarget] = useState<ReadingBook | null | 'free'>(null);
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
      taskSameTimeEveryDay: true,
    });
    setTitle('');
    setAuthor('');
    setCategory(null);
    setCustomTag('');
    setShowForm(false);
  };

  const changeStatus = (book: ReadingBook, status: ReadingBook['status']) => {
    updateBook(book.id, {
      status,
      startedAt: status === 'reading' ? (book.startedAt ?? Date.now()) : book.startedAt,
      finishedAt: status === 'finished' ? (book.finishedAt ?? Date.now()) : undefined,
      showOnHome: status === 'reading' ? book.showOnHome : false,
    });
  };

  const saveField = (bookId: string, field: 'review' | 'keyLessons', value: string) => {
    updateBook(bookId, { [field]: value } as Partial<ReadingBook>);
  };

  return (
    <View style={s.screen}>
      <ScreenTitleBar
        title="READING LIST"
        showBack
        rightElement={(
          <View style={s.headerActions}>
            <TouchableOpacity onPress={() => router.push('/reading-analytics')} activeOpacity={0.76} style={s.headBtn}>
              <BarChart3 s={18} c="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowForm(value => !value)} activeOpacity={0.76} style={s.headBtn}>
              {showForm ? <X s={18} c="#9CA3AF" /> : <Plus s={18} c={C.gold} />}
            </TouchableOpacity>
          </View>
        )}
      />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => setSessionTarget('free')} activeOpacity={0.84} style={s.startCard}>
          <View style={s.startAccent} />
          <View style={[s.startIcon, { backgroundColor: 'rgba(197,160,89,0.12)' }]}>
            <Play s={15} c={C.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.startTitle}>Start Reading</Text>
            <Text style={s.startKicker}>FREE SESSION</Text>
          </View>
          <View style={[s.startMini, { backgroundColor: 'rgba(197,160,89,0.12)' }]}>
            <Play s={10} c={C.gold} />
          </View>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
          {[
            { key: 'all' as const, label: `All (${counts.all})` },
            { key: 'to_read' as const, label: `To Read (${counts.to_read})` },
            { key: 'reading' as const, label: `Reading (${counts.reading})` },
            { key: 'finished' as const, label: `Done (${counts.finished})` },
          ].map(item => {
            const active = tab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setTab(item.key)}
                activeOpacity={0.82}
                style={[s.tabChip, active && s.tabChipActive]}
              >
                <Text style={[s.tabChipText, active && s.tabChipTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {usedCategories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
            <TouchableOpacity
              onPress={() => setCategoryFilter(null)}
              activeOpacity={0.82}
              style={[s.filterChip, !categoryFilter && s.filterChipActive]}
            >
              <Text style={[s.filterChipText, !categoryFilter && s.filterChipTextActive]}>All Tags</Text>
            </TouchableOpacity>
            {usedCategories.map(item => (
              <CategoryChip
                key={item}
                label={item}
                color={(getCategoryDef(item)?.color ?? '#6B7280')}
                active={categoryFilter === item}
                onPress={() => setCategoryFilter(current => current === item ? null : item)}
              />
            ))}
          </ScrollView>
        )}

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
            const categoryDef = getCategoryDef(book.category);
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
                          {Array.from({ length: 5 }, (_, index) => (
                            <TouchableOpacity key={index} onPress={() => updateBook(book.id, { rating: index + 1 })} activeOpacity={0.85}>
                              <Star s={12} c={index < (book.rating ?? 0) ? C.gold : '#E5E7EB'} />
                            </TouchableOpacity>
                          ))}
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

                    <View style={s.scheduleCard}>
                      <View style={s.scheduleCopy}>
                        <Text style={s.scheduleKicker}>HOME TASK</Text>
                        <Text style={s.scheduleTitle}>
                          {book.showOnHome ? `${book.taskTime ?? '--:--'} / ${getFrequencySummary(book)}` : 'Not on Home yet'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setScheduleTarget(book)}
                        activeOpacity={0.82}
                        style={[s.scheduleBtn, { backgroundColor: book.showOnHome ? `${accent}12` : '#F5F5F4' }]}
                      >
                        <CalendarCheck s={16} c={book.showOnHome ? accent : '#A8A29E'} />
                      </TouchableOpacity>
                    </View>

                    <View style={s.actionGrid}>
                      <MiniActionCard
                        icon={<Play s={14} c={accent} />}
                        kicker="SESSION"
                        title="Start reading"
                        onPress={() => setSessionTarget(book)}
                        accent={accent}
                      />
                      <MiniActionCard
                        icon={<Pencil s={14} c={accent} />}
                        kicker="REVIEW"
                        title="Write notes"
                        onPress={() => {}}
                        accent={accent}
                      />
                    </View>

                    <Text style={s.fieldLabel}>REVIEW</Text>
                    <TextInput
                      value={book.review ?? ''}
                      onChangeText={value => saveField(book.id, 'review', value)}
                      placeholder="What stayed with you from this book?"
                      placeholderTextColor="#D1D5DB"
                      multiline
                      style={s.areaInput}
                    />

                    <Text style={s.fieldLabel}>KEY LESSONS</Text>
                    <TextInput
                      value={book.keyLessons ?? ''}
                      onChangeText={value => saveField(book.id, 'keyLessons', value)}
                      placeholder="Write the lessons you want to remember."
                      placeholderTextColor="#D1D5DB"
                      multiline
                      style={s.areaInput}
                    />

                    {book.status === 'finished' && (
                      <>
                        <Text style={s.fieldLabel}>RATING</Text>
                        <View style={s.finishRatingRow}>
                          {Array.from({ length: 5 }, (_, index) => (
                            <TouchableOpacity key={index} onPress={() => updateBook(book.id, { rating: index + 1 })} activeOpacity={0.82} style={s.finishStarBtn}>
                              <Star s={18} c={index < (book.rating ?? 0) ? C.gold : '#E5E7EB'} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}

                    <TouchableOpacity onPress={() => setDeleteTarget(book)} activeOpacity={0.84} style={s.deleteRow}>
                      <Trash2 s={14} c="#DC2626" />
                      <Text style={s.deleteText}>Delete book</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <SessionModal
        visible={!!sessionTarget}
        title={sessionTarget === 'free' ? 'Reading Session' : sessionTarget?.title ?? 'Reading Session'}
        subtitle={sessionTarget && sessionTarget !== 'free' ? sessionTarget.author : 'Free reading session'}
        onClose={() => setSessionTarget(null)}
        onStart={minutes => {
          recordSession(sessionTarget && sessionTarget !== 'free' ? sessionTarget.id : null, minutes);
          setSessionTarget(null);
        }}
      />

      <ScheduleModal
        book={scheduleTarget}
        onClose={() => setScheduleTarget(null)}
        onSave={(bookId, updates) => {
          updateBook(bookId, updates);
          setScheduleTarget(null);
        }}
      />

      <ConfirmDeleteModal
        visible={!!deleteTarget}
        title={deleteTarget?.title ?? ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteBook(deleteTarget.id);
          setDeleteTarget(null);
          setExpandedId(null);
        }}
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

function MiniActionCard({
  icon,
  kicker,
  title,
  onPress,
  accent,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  onPress: () => void;
  accent: string;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.84} style={s.miniCard}>
      <View style={[s.miniIcon, { backgroundColor: hexToRgba(accent, 0.1) }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[s.miniKicker, { color: accent }]}>{kicker}</Text>
        <Text style={s.miniTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );
}

function SessionModal({
  visible,
  title,
  subtitle,
  onClose,
  onStart,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onStart: (minutes: number) => void;
}) {
  const [minutes, setMinutes] = useState(25);

  React.useEffect(() => {
    if (visible) setMinutes(25);
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.centerModal}>
          <Text style={s.centerTitle}>{title}</Text>
          {!!subtitle && <Text style={s.centerSubtitle}>{subtitle}</Text>}
          <View style={s.counterRow}>
            <TouchableOpacity onPress={() => setMinutes(value => Math.max(5, value - 5))} activeOpacity={0.84} style={s.counterBtn}>
              <Text style={s.counterBtnText}>-</Text>
            </TouchableOpacity>
            <View style={s.counterValue}>
              <Text style={s.counterMinutes}>{minutes}</Text>
              <Text style={s.counterLabel}>MINUTES</Text>
            </View>
            <TouchableOpacity onPress={() => setMinutes(value => Math.min(120, value + 5))} activeOpacity={0.84} style={s.counterBtn}>
              <Text style={s.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => onStart(minutes)} activeOpacity={0.86} style={s.startSessionBtn}>
            <Text style={s.startSessionText}>START SESSION</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ScheduleModal({
  book,
  onClose,
  onSave,
}: {
  book: ReadingBook | null;
  onClose: () => void;
  onSave: (bookId: string, updates: Partial<ReadingBook>) => void;
}) {
  const [time, setTime] = useState('21:00');
  const [frequency, setFrequency] = useState<ReadingFrequency>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [showOnHome, setShowOnHome] = useState(false);

  React.useEffect(() => {
    if (!book) return;
    setTime(book.taskTime ?? '21:00');
    setFrequency(book.taskFrequency ?? 'daily');
    setSelectedDays(book.taskSelectedDays ?? []);
    setShowOnHome(!!book.showOnHome);
  }, [book]);

  if (!book) return null;

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHead}>
            <TouchableOpacity onPress={onClose} style={s.sheetHeadBtn} activeOpacity={0.7}>
              <X s={18} c="#9CA3AF" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.sheetKicker}>Home Task</Text>
              <Text style={s.sheetTitle}>Reading Schedule</Text>
            </View>
            <TouchableOpacity
              onPress={() => onSave(book.id, {
                taskTime: time,
                taskFrequency: frequency,
                taskSelectedDays: frequency === 'specific_days' ? selectedDays : undefined,
                showOnHome,
                taskSameTimeEveryDay: true,
              })}
              style={[s.sheetHeadBtn, s.sheetSave]}
              activeOpacity={0.84}
            >
              <CheckSmall s={16} c="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={s.sheetContent} showsVerticalScrollIndicator={false}>
            <View style={s.sheetBlock}>
              <Text style={s.sheetBlockLabel}>SHOW ON HOME</Text>
              <View style={s.toggleRow}>
                <Text style={s.toggleCopy}>Add this reading task to your daily Home flow.</Text>
                <TouchableOpacity onPress={() => setShowOnHome(value => !value)} activeOpacity={0.84} style={[s.toggle, showOnHome && s.toggleActive]}>
                  <View style={[s.toggleKnob, showOnHome && s.toggleKnobActive]} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.sheetBlock}>
              <Text style={s.sheetBlockLabel}>TIME</Text>
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="21:00"
                placeholderTextColor="#D1D5DB"
                style={s.timeInput}
              />
            </View>

            <View style={s.sheetBlock}>
              <Text style={s.sheetBlockLabel}>FREQUENCY</Text>
              <View style={s.frequencyWrap}>
                {FREQUENCY_OPTIONS.map(item => {
                  const active = frequency === item.value;
                  return (
                    <TouchableOpacity key={item.value} onPress={() => setFrequency(item.value)} activeOpacity={0.84} style={[s.frequencyChip, active && s.frequencyChipActive]}>
                      <Text style={[s.frequencyText, active && s.frequencyTextActive]}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {frequency === 'specific_days' && (
              <View style={s.sheetBlock}>
                <Text style={s.sheetBlockLabel}>DAYS</Text>
                <View style={s.daysRow}>
                  {DAY_OPTIONS.map(item => {
                    const active = selectedDays.includes(item.key);
                    return (
                      <TouchableOpacity
                        key={`${item.key}-${item.label}`}
                        onPress={() => setSelectedDays(current => current.includes(item.key)
                          ? current.filter(day => day !== item.key)
                          : [...current, item.key].sort())}
                        activeOpacity={0.84}
                        style={[s.dayChip, active && s.dayChipActive]}
                      >
                        <Text style={[s.dayChipText, active && s.dayChipTextActive]}>{item.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ConfirmDeleteModal({
  visible,
  title,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={s.confirmCard}>
          <View style={s.confirmIcon}><Trash2 s={18} c="#DC2626" /></View>
          <Text style={s.confirmTitle}>Delete this book?</Text>
          <Text style={s.confirmBody}>{title}</Text>
          <View style={s.confirmRow}>
            <TouchableOpacity onPress={onCancel} activeOpacity={0.84} style={s.confirmCancel}>
              <Text style={s.confirmCancelText}>KEEP</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} activeOpacity={0.84} style={s.confirmDelete}>
              <Text style={s.confirmDeleteText}>DELETE</Text>
            </TouchableOpacity>
          </View>
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
  startCard: {
    minHeight: 70,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 2,
  },
  startAccent: { width: 5, alignSelf: 'stretch', borderRadius: 999, backgroundColor: C.gold },
  startIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  startTitle: { fontFamily: F.serifMedium, fontSize: 19, color: '#111827' },
  startKicker: { marginTop: 3, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: '#A8A29E' },
  startMini: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tabRow: { gap: 8, paddingTop: 16, paddingBottom: 8 },
  tabChip: { paddingHorizontal: 14, minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: '#F0EDE6', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  tabChipActive: { backgroundColor: C.gold, borderColor: C.gold },
  tabChipText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4, color: '#78716C', textTransform: 'uppercase' },
  tabChipTextActive: { color: '#FFFFFF' },
  categoryRow: { gap: 8, paddingBottom: 8 },
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
  scheduleCard: { borderRadius: 20, borderWidth: 1, borderColor: '#F2F1EC', backgroundColor: '#FAFAFA', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  scheduleCopy: { flex: 1 },
  scheduleKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, color: '#A8A29E', textTransform: 'uppercase' },
  scheduleTitle: { marginTop: 3, fontFamily: F.serif, fontSize: 17, color: '#3F3F46' },
  scheduleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionGrid: { flexDirection: 'row', gap: 10, marginTop: 12 },
  miniCard: { flex: 1, borderRadius: 20, borderWidth: 1, borderColor: '#F2F1EC', backgroundColor: '#FFFFFF', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  miniKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, textTransform: 'uppercase' },
  miniTitle: { marginTop: 3, fontFamily: F.serif, fontSize: 16, color: '#2F2B27' },
  fieldLabel: { marginTop: 16, marginBottom: 8, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 1.8, color: '#A8A29E', textTransform: 'uppercase' },
  areaInput: { minHeight: 96, borderRadius: 22, borderWidth: 1, borderColor: '#F2F1EC', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, textAlignVertical: 'top', fontFamily: F.serif, fontSize: 18, lineHeight: 24, color: '#1F2937' },
  finishRatingRow: { flexDirection: 'row', gap: 8 },
  finishStarBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' },
  deleteRow: { marginTop: 16, minHeight: 44, borderRadius: 18, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  deleteText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: '#DC2626', textTransform: 'uppercase' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.32)' },
  centerModal: { width: '100%', maxWidth: 340, borderRadius: 30, backgroundColor: '#FFFFFF', padding: 22, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowOffset: { width: 0, height: 14 }, shadowRadius: 34, elevation: 14 },
  centerTitle: { fontFamily: F.serifMedium, fontSize: 28, color: '#111827', textAlign: 'center' },
  centerSubtitle: { marginTop: 6, fontFamily: F.serifItalic, fontSize: 15, color: '#9CA3AF', textAlign: 'center' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 20, marginBottom: 18 },
  counterBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F8F5ED', alignItems: 'center', justifyContent: 'center' },
  counterBtnText: { fontFamily: F.serifMedium, fontSize: 26, color: C.gold, marginTop: -3 },
  counterValue: { minWidth: 112, alignItems: 'center' },
  counterMinutes: { fontFamily: F.serifMedium, fontSize: 50, lineHeight: 52, color: C.gold },
  counterLabel: { marginTop: 4, fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: '#A8A29E' },
  startSessionBtn: { width: '100%', minHeight: 50, borderRadius: 24, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  startSessionText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2, color: '#FFFFFF' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.34)' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: '#FAFAFA', paddingBottom: 28, maxHeight: '88%' },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F4' },
  sheetHeadBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sheetSave: { backgroundColor: C.gold },
  sheetKicker: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.textMuted, textTransform: 'uppercase' },
  sheetTitle: { fontFamily: F.serifMedium, fontSize: 19, color: C.text, marginTop: 2 },
  sheetContent: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 12, gap: 16 },
  sheetBlock: { borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F2F1EC', padding: 18 },
  sheetBlockLabel: { fontFamily: F.sansBold, fontSize: 9, letterSpacing: 2, color: C.gold, textTransform: 'uppercase', marginBottom: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleCopy: { flex: 1, fontFamily: F.serif, fontSize: 16, lineHeight: 20, color: '#6B7280' },
  toggle: { width: 50, height: 30, borderRadius: 16, backgroundColor: '#E5E7EB', padding: 3 },
  toggleActive: { backgroundColor: C.gold },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF' },
  toggleKnobActive: { transform: [{ translateX: 20 }] },
  timeInput: { minHeight: 52, borderRadius: 20, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#F2F1EC', paddingHorizontal: 16, fontFamily: F.serif, fontSize: 22, color: '#1F2937' },
  frequencyWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  frequencyChip: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  frequencyChipActive: { backgroundColor: '#F8F5ED', borderColor: '#E8DCC4' },
  frequencyText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.3, color: '#9CA3AF', textTransform: 'uppercase' },
  frequencyTextActive: { color: C.gold },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  dayChipActive: { backgroundColor: '#F8F5ED', borderColor: '#E8DCC4' },
  dayChipText: { fontFamily: F.sansBold, fontSize: 11, color: '#A8A29E' },
  dayChipTextActive: { color: C.gold },
  confirmCard: { width: '100%', maxWidth: 320, borderRadius: 28, backgroundColor: '#FFFFFF', padding: 22, alignItems: 'center' },
  confirmIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  confirmTitle: { fontFamily: F.serifMedium, fontSize: 24, color: '#111827' },
  confirmBody: { marginTop: 6, fontFamily: F.serifItalic, fontSize: 15, color: '#9CA3AF', textAlign: 'center' },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  confirmCancel: { flex: 1, minHeight: 46, borderRadius: 22, backgroundColor: '#F5F5F4', alignItems: 'center', justifyContent: 'center' },
  confirmDelete: { flex: 1, minHeight: 46, borderRadius: 22, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
  confirmCancelText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: '#6B7280' },
  confirmDeleteText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: '#FFFFFF' },
});
