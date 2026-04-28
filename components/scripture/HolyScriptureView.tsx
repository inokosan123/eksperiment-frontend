import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, LayoutAnimation, Platform, UIManager,
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, useWindowDimensions, View,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft, Book, ChevronDown, ChevronRight, Notebook,
  OpenBook, Search, Star, X,
} from '@/components/icons/Icons';
import { BIBLE_BOOKS, BibleBook, PSALMS_ID } from '@/constants/scripture';
import { C, F } from '@/constants/tokens';
import { getTitleBarTopPadding, TITLE_BAR_BOTTOM_PADDING } from '@/components/shared/titleBar';
import { ScriptureSearchResult, useScripture } from './ScriptureContext';
import SetAsDailyTaskCard from '@/components/shared/SetAsDailyTaskCard';
import SetAsTaskSheet from '@/components/shared/SetAsTaskSheet';
import { useTasks } from '@/components/tasks/TaskProvider';

const BG = '#FCFCFC';
const GOLD = '#C5A059';
const GREEN = '#5E7B55';
const ROSE = '#BE123C';

type ScriptureTab = 'bible' | 'psalter';

const NEW_TESTAMENT = BIBLE_BOOKS.filter(book => book.testament === 'nt');
const OLD_TESTAMENT = BIBLE_BOOKS.filter(book => book.testament !== 'nt' && book.id !== PSALMS_ID);
const PSALTER = BIBLE_BOOKS.filter(book => book.id === PSALMS_ID);
const PSALMS_BOOK = PSALTER[0];

export default function HolyScriptureView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { ready, searchVerses } = useScripture();
  const { createOrUpdateTask } = useTasks();

  const [tab, setTab] = useState<ScriptureTab>('bible');
  const pillAnim = useRef(new Animated.Value(0)).current;
  const [activeSection, setActiveSection] = useState<'new' | 'old'>('new');
  const sectionPillAnim = useRef(new Animated.Value(0)).current;
  const [expandedBookId, setExpandedBookId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ScriptureSearchResult[]>([]);
  const [showTaskSheet, setShowTaskSheet] = useState(false);
  const [taskSummary, setTaskSummary] = useState('Add to your daily routine');

  const query = searchQuery.trim().toLowerCase();
  const psalmCardWidth = useMemo(() => {
    const contentWidth = Math.min(width, 430) - 44;
    return Math.max(128, Math.floor((contentWidth - 10) / 2));
  }, [width]);
  const psalmNumbers = useMemo(() => {
    const all = Array.from({ length: PSALMS_BOOK?.chapters ?? 151 }, (_, index) => index + 1);
    if (!query) return all;

    const numberPart = query.replace(/^psalms?\s*/, '').trim();
    return all.filter(number =>
      `psalm ${number}`.includes(query)
      || `psalms ${number}`.includes(query)
      || (!!numberPart && String(number).includes(numberPart)));
  }, [query]);

  useEffect(() => {
    if (!ready || query.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchVerses(query, 'en').then(results => {
        setSearchResults(tab === 'psalter'
          ? results.filter(result => result.bookId === PSALMS_ID)
          : results);
      });
    }, 240);

    return () => clearTimeout(timer);
  }, [query, ready, searchVerses, tab]);

  const bookMatches = useMemo(() => {
    if (!query) return [];
    const source = tab === 'psalter' ? PSALTER : BIBLE_BOOKS;
    return source.filter(book => book.name.toLowerCase().includes(query)).slice(0, 12);
  }, [query, tab]);

  const switchTab = (next: ScriptureTab) => {
    setTab(next);
    setExpandedBookId(null);
    Animated.timing(pillAnim, {
      toValue: next === 'bible' ? 0 : 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const openReader = (book: BibleBook, chapter = 1, verse?: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/scripture-reader',
      params: {
        bookId: String(book.id),
        chapter: String(chapter),
        ...(verse ? { verse: String(verse) } : {}),
      },
    });
  };

  const smooth = () => LayoutAnimation.configureNext(
    LayoutAnimation.create(240, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
  );

  const switchSection = (next: 'new' | 'old') => {
    smooth();
    setActiveSection(next);
    setExpandedBookId(null);
    Animated.timing(sectionPillAnim, {
      toValue: next === 'new' ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const toggleBook = (book: BibleBook) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    smooth();
    setExpandedBookId(expandedBookId === book.id ? null : book.id);
  };

  const openResult = (result: ScriptureSearchResult) => {
    const book = BIBLE_BOOKS.find(item => item.id === result.bookId);
    if (!book) return;
    setSearchQuery('');
    setSearchResults([]);
    openReader(book, result.chapter, result.verse);
  };

  if (!ready) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator color={GOLD} />
        <Text style={s.loadingText}>Loading Scripture...</Text>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <Header top={insets.top} onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 110 }]}
      >
        {/* Quick access — 2-col grid */}
        <View style={s.quickGrid}>
          <TouchableOpacity onPress={() => router.push('/favorites')} activeOpacity={0.86} style={[s.quickCard, s.quickCardGold]}>
            <View style={s.quickCardRow}>
              <View style={[s.quickIcon, { backgroundColor: 'rgba(197,160,89,0.12)' }]}>
                <Star s={15} c={GOLD} />
              </View>
              <Text style={[s.quickLabel, { color: GOLD }]}>Favorites</Text>
            </View>
            <Text style={s.quickDesc}>{'  '}Highlights & saved passages</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/bible-notes')} activeOpacity={0.86} style={[s.quickCard, s.quickCardGreen]}>
            <View style={s.quickCardRow}>
              <View style={[s.quickIcon, { backgroundColor: 'rgba(94,123,85,0.12)' }]}>
                <Notebook s={14} c={GREEN} />
              </View>
              <Text style={[s.quickLabel, { color: GREEN }]}>Bible Notes</Text>
            </View>
            <Text style={s.quickDesc}>{'  '}Chapter notes & reflections</Text>
          </TouchableOpacity>
        </View>

        {/* Set as Daily Task — compact row */}
        <SetAsDailyTaskCard variant="scripture" onPress={() => setShowTaskSheet(true)} subtitle={taskSummary} />

        {/* Bible / Psalter toggle + search */}
        <View style={s.selectorPanel}>
          <View style={s.segmented}>
            <Animated.View
              pointerEvents="none"
              style={[s.segPill, { left: pillAnim.interpolate({ inputRange: [0, 1], outputRange: ['2%', '51%'] }) }]}
            />
            <TabButton
              active={tab === 'bible'}
              icon={<Book s={14} c={tab === 'bible' ? GREEN : '#A8A29E'} />}
              label="BIBLE"
              onPress={() => switchTab('bible')}
            />
            <TabButton
              active={tab === 'psalter'}
              icon={<OpenBook s={14} c={tab === 'psalter' ? GREEN : '#A8A29E'} />}
              label="PSALTER"
              onPress={() => switchTab('psalter')}
            />
          </View>

          <View style={s.searchBox}>
            <Search s={15} c="#BFC3CA" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={tab === 'psalter' ? 'Search psalms...' : 'Search books or passages...'}
              placeholderTextColor="#AEB4BE"
              style={s.searchInput}
            />
            {!!searchQuery && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <X s={15} c="#AEB4BE" />
              </Pressable>
            )}
          </View>
        </View>

        {tab === 'psalter' && PSALMS_BOOK ? (
          <PsalterBrowse
            psalms={psalmNumbers}
            results={query ? searchResults : []}
            searching={!!query}
            cardWidth={psalmCardWidth}
            onPsalm={psalm => openReader(PSALMS_BOOK, psalm)}
            onResult={openResult}
          />
        ) : query ? (
          <SearchPanel bookMatches={bookMatches} results={searchResults} onBook={openReader} onResult={openResult} />
        ) : (
          <View style={s.sections}>
            {/* NT / OT animated tab selector */}
            <View style={s.sectionTabWrap}>
              <Animated.View style={[
                s.sectionTabPill,
                {
                  left: sectionPillAnim.interpolate({ inputRange: [0, 1], outputRange: ['2%', '51%'] }),
                  backgroundColor: activeSection === 'new'
                    ? 'rgba(94,123,85,0.14)' : 'rgba(180,155,103,0.14)',
                  borderColor: activeSection === 'new'
                    ? 'rgba(94,123,85,0.35)' : 'rgba(180,155,103,0.35)',
                },
              ]} />
              <TouchableOpacity onPress={() => switchSection('new')} activeOpacity={0.82} style={s.sectionTabBtn}>
                <Text style={[s.sectionTabText, activeSection === 'new' && { color: GREEN, fontFamily: F.serifMedium }]}>
                  New Testament
                </Text>
                <View style={[s.sectionTabBadge, activeSection === 'new' && { backgroundColor: 'rgba(94,123,85,0.12)' }]}>
                  <Text style={[s.sectionTabCount, activeSection === 'new' && { color: GREEN }]}>{NEW_TESTAMENT.length}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchSection('old')} activeOpacity={0.82} style={s.sectionTabBtn}>
                <Text style={[s.sectionTabText, activeSection === 'old' && { color: '#8B6B2F', fontFamily: F.serifMedium }]}>
                  Old Testament
                </Text>
                <View style={[s.sectionTabBadge, activeSection === 'old' && { backgroundColor: 'rgba(180,155,103,0.12)' }]}>
                  <Text style={[s.sectionTabCount, activeSection === 'old' && { color: '#8B6B2F' }]}>{OLD_TESTAMENT.length}</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Book list for selected section */}
            <BookList
              books={activeSection === 'new' ? NEW_TESTAMENT : OLD_TESTAMENT}
              tone={activeSection === 'new' ? 'green' : 'stone'}
              expandedBookId={expandedBookId}
              onBook={toggleBook}
              onChapter={openReader}
            />
          </View>
        )}
      </ScrollView>

      <SetAsTaskSheet
        visible={showTaskSheet}
        context="scripture"
        onClose={() => setShowTaskSheet(false)}
        onSummaryChange={setTaskSummary}
        onTaskDraft={createOrUpdateTask}
      />
    </View>
  );
}

function Header({ top, onBack }: { top: number; onBack: () => void }) {
  return (
    <View style={[s.header, { paddingTop: getTitleBarTopPadding(top) }]}>
      <TouchableOpacity onPress={onBack} style={s.headerBtn} activeOpacity={0.7}>
        <ArrowLeft s={24} c="#9CA3AF" />
      </TouchableOpacity>
      <Text style={s.headerTitle}>HOLY SCRIPTURE</Text>
      <View style={s.headerBtn} />
    </View>
  );
}

function TabButton({
  active, icon, label, onPress,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.84} style={[s.tabBtn, active && s.tabBtnActive]}>
      {icon}
      <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function BookList({
  books, tone, expandedBookId, onBook, onChapter,
}: {
  books: BibleBook[];
  tone: 'green' | 'stone';
  expandedBookId: number | null;
  onBook: (book: BibleBook) => void;
  onChapter: (book: BibleBook, chapter?: number) => void;
}) {
  const isGreen = tone === 'green';
  const panelColors = (isGreen ? ['#FCFDF9', '#F4F8EF'] : ['#FFFDF9', '#F8F4EC']) as [string, string];
  return (
    <LinearGradient
      colors={panelColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[s.bookListPanel, { borderColor: isGreen ? '#DCE5D7' : '#ECE4D7' }]}
    >
      {books.map(book => (
        <React.Fragment key={book.id}>
          <PremiumBookCard
            book={book}
            title={isGreen ? 'New Testament' : 'Old Testament'}
            tone={tone}
            expanded={expandedBookId === book.id}
            onPress={() => onBook(book)}
          />
          {expandedBookId === book.id && (
            <ChapterPanel
              book={book}
              tone={tone}
              onChapter={chapter => onChapter(book, chapter)}
            />
          )}
        </React.Fragment>
      ))}
    </LinearGradient>
  );
}

function BookSection({
  title, count, books, open, accent, tone, expandedBookId, onToggle, onBook, onChapter,
}: {
  title: string;
  count: number;
  books: BibleBook[];
  open: boolean;
  accent: string;
  tone: 'green' | 'stone';
  expandedBookId: number | null;
  onToggle: () => void;
  onBook: (book: BibleBook) => void;
  onChapter: (book: BibleBook, chapter?: number) => void;
}) {
  const isGreen = tone === 'green';
  const sectionColors = (isGreen ? ['#F6FAF3', '#EBF4E5'] : ['#FAF7F2', '#F2EBE0']) as [string, string];
  const panelColors = (isGreen ? ['#F4F9F0', '#EDF5E7'] : ['#F8F4ED', '#F2EBE0']) as [string, string];

  return (
    <View style={s.sectionWrap}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.86}>
        <LinearGradient
          colors={sectionColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            s.bookSection,
            {
              borderColor: isGreen ? '#D8E3D4' : '#E8E0D4',
              shadowOpacity: open ? 0.06 : 0.04,
            },
          ]}
        >
          <View style={s.sectionHead}>
            <Text style={[s.sectionTitle, { color: isGreen ? '#2E4726' : '#3A3020' }]}>{title}</Text>
            <View style={s.sectionRight}>
              <View style={[s.countPill, { borderColor: isGreen ? '#D7E2D3' : '#ECE4D6' }]}>
                <Text style={[s.countText, { color: isGreen ? '#72876A' : '#B49B67' }]}>{count}</Text>
              </View>
              <View style={[s.chevronCircle, { borderColor: isGreen ? '#D7E2D2' : '#E8DED0' }]}>
                <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
                  <ChevronDown s={16} c={accent} />
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {open && (
        <LinearGradient
          colors={panelColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            s.bookListPanel,
            { borderColor: isGreen ? '#DCE5D7' : '#ECE4D7' },
          ]}
        >
          {books.map(book => (
            <React.Fragment key={book.id}>
              <PremiumBookCard
                book={book}
                title={title}
                tone={tone}
                expanded={expandedBookId === book.id}
                onPress={() => onBook(book)}
              />
              {expandedBookId === book.id && (
                <ChapterPanel
                  book={book}
                  tone={tone}
                  onChapter={chapter => onChapter(book, chapter)}
                />
              )}
            </React.Fragment>
          ))}
        </LinearGradient>
      )}
    </View>
  );
}

function PremiumBookCard({
  book, title, tone, expanded, onPress,
}: {
  book: BibleBook;
  title: string;
  tone: 'green' | 'stone';
  expanded: boolean;
  onPress: () => void;
}) {
  const isGreen = tone === 'green';
  const subtitle = book.testament === 'dc' ? 'DEUTEROCANON' : title.toUpperCase();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      style={[
        s.premiumBook,
        {
          borderColor: isGreen ? '#D9E4D5' : '#E8E0D4',
          borderBottomColor: expanded ? 'transparent' : (isGreen ? '#D9E4D5' : '#E8E0D4'),
          borderBottomLeftRadius: expanded ? 0 : 18,
          borderBottomRightRadius: expanded ? 0 : 18,
        },
        expanded && s.premiumBookExpanded,
      ]}
    >
      <View style={s.bookCopy}>
        <Text style={s.bookName}>{book.name}</Text>
        <View style={s.bookMetaRow}>
          <Text style={[s.bookMeta, { color: isGreen ? '#7E9270' : '#A48F6C' }]}>{subtitle}</Text>
          <Text style={s.bookMetaDot}>-</Text>
          <Text style={s.bookMetaMuted}>{book.chapters} CH.</Text>
        </View>
      </View>
      <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
        <ChevronRight s={16} c={isGreen ? '#C2D4BC' : '#D0C4B4'} />
      </View>
    </TouchableOpacity>
  );
}

function ChapterPanel({
  book, tone, onChapter,
}: {
  book: BibleBook;
  tone: 'green' | 'stone';
  onChapter: (chapter: number) => void;
}) {
  const isGreen = tone === 'green';
  const rows = Array.from({ length: Math.ceil(book.chapters / 5) }, (_, rowIndex) => rowIndex);

  return (
    <LinearGradient
      colors={isGreen ? ['#F9FCF6', '#F0F7EA'] : ['#FDFBFA', '#F6F2EC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[
        s.chapterPanel,
        { borderColor: isGreen ? '#DCE5D7' : '#E8E1D5' },
      ]}
    >
      <View style={s.chapterPanelHead}>
        <Text style={s.chapterPanelLabel}>SELECT CHAPTER</Text>
        <View style={[s.chapterCountChip, { borderColor: isGreen ? '#D7E1D2' : '#E8E0D3' }]}>
          <Text style={[s.chapterCountText, { color: isGreen ? '#728569' : '#A89069' }]}>{book.chapters}</Text>
        </View>
      </View>

      <View style={s.chapterGrid}>
        {rows.map(rowIndex => (
          <View key={rowIndex} style={s.chapterGridRow}>
            {Array.from({ length: 5 }, (_, offset) => {
              const chapter = rowIndex * 5 + offset + 1;
              if (chapter > book.chapters) {
                return <View key={`empty-${rowIndex}-${offset}`} style={s.chapterSpacer} />;
              }

              return (
                <TouchableOpacity
                  key={chapter}
                  onPress={() => onChapter(chapter)}
                  activeOpacity={0.78}
                  style={[
                    s.chapterCell,
                    {
                      borderColor: isGreen ? '#D8E6D2' : '#E4DDD4',
                      backgroundColor: '#FFFFFF',
                    },
                  ]}
                >
                  <Text style={[s.chapterCellText, { color: isGreen ? '#4C6444' : '#6F5E41' }]}>{chapter}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

function PsalterBrowse({
  psalms, results, searching, onPsalm, onResult,
}: {
  psalms: number[];
  results: ScriptureSearchResult[];
  searching: boolean;
  cardWidth?: number;
  onPsalm: (psalm: number) => void;
  onResult: (result: ScriptureSearchResult) => void;
}) {
  const rows = Array.from({ length: Math.ceil(psalms.length / 5) }, (_, i) => i);

  return (
    <View style={s.psalterWrap}>
      {psalms.length > 0 && !searching && (
        <LinearGradient
          colors={['#FFFDF9', '#FFF6E8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.psalmPanel}
        >
          <View style={s.chapterGrid}>
            {rows.map(rowIndex => (
              <View key={rowIndex} style={s.chapterGridRow}>
                {Array.from({ length: 5 }, (_, offset) => {
                  const psalm = psalms[rowIndex * 5 + offset];
                  if (!psalm) return <View key={`e-${rowIndex}-${offset}`} style={s.chapterSpacer} />;
                  return (
                    <TouchableOpacity
                      key={psalm}
                      onPress={() => onPsalm(psalm)}
                      activeOpacity={0.78}
                      style={[s.chapterCell, { borderColor: '#E8DECD', backgroundColor: '#FFFFFF' }]}
                    >
                      <Text style={[s.chapterCellText, { color: '#6F5E41' }]}>{psalm}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </LinearGradient>
      )}

      {searching && results.length > 0 && (
        <View style={s.searchBlock}>
          <Text style={s.searchKicker}>PASSAGES</Text>
          {results.slice(0, 16).map(result => (
            <TouchableOpacity
              key={`${result.bookId}:${result.chapter}:${result.verse}`}
              onPress={() => onResult(result)}
              activeOpacity={0.86}
              style={s.resultCard}
            >
              <Text style={s.resultRef}>{result.bookName} {result.chapter}:{result.verse}</Text>
              <Text style={s.resultText} numberOfLines={3}>{result.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {searching && psalms.length === 0 && results.length === 0 && (
        <View style={s.emptySearch}>
          <Search s={24} c="rgba(197,160,89,0.34)" />
          <Text style={s.emptySearchText}>No psalms found.</Text>
        </View>
      )}
    </View>
  );
}

function SearchPanel({
  bookMatches, results, onBook, onResult,
}: {
  bookMatches: BibleBook[];
  results: ScriptureSearchResult[];
  onBook: (book: BibleBook, chapter?: number) => void;
  onResult: (result: ScriptureSearchResult) => void;
}) {
  return (
    <View style={s.searchPanel}>
      {bookMatches.length > 0 && (
        <View style={s.searchBlock}>
          <Text style={s.searchKicker}>BOOKS</Text>
          {bookMatches.map(book => (
            <TouchableOpacity key={book.id} onPress={() => onBook(book, 1)} activeOpacity={0.84} style={s.matchBook}>
              <Text style={s.matchBookTitle}>{book.name}</Text>
              <Text style={s.matchBookSub}>{book.chapters} chapters</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {results.length > 0 && (
        <View style={s.searchBlock}>
          <Text style={s.searchKicker}>PASSAGES</Text>
          {results.slice(0, 24).map(result => (
            <TouchableOpacity
              key={`${result.bookId}:${result.chapter}:${result.verse}`}
              onPress={() => onResult(result)}
              activeOpacity={0.86}
              style={s.resultCard}
            >
              <Text style={s.resultRef}>{result.bookName} {result.chapter}:{result.verse}</Text>
              <Text style={s.resultText} numberOfLines={3}>{result.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {bookMatches.length === 0 && results.length === 0 && (
        <View style={s.emptySearch}>
          <Search s={24} c="rgba(197,160,89,0.34)" />
          <Text style={s.emptySearchText}>Keep typing to search Scripture.</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
  loadingText: { marginTop: 12, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2, color: C.textMuted, textTransform: 'uppercase' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: TITLE_BAR_BOTTOM_PADDING,
    backgroundColor: 'rgba(252,252,252,0.98)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.05)',
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: F.serifMedium, fontSize: 23, letterSpacing: 2.8, color: '#111827' },
  content: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 14, gap: 8 },

  quickGrid: { flexDirection: 'row', gap: 10 },
  quickCard: {
    flex: 1, borderRadius: 18, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 12, gap: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 2,
  },
  quickCardGold: { backgroundColor: '#FFFDF8', borderColor: 'rgba(197,160,89,0.28)' },
  quickCardGreen: { backgroundColor: '#F4FAF1', borderColor: 'rgba(94,123,85,0.22)' },
  quickCardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontFamily: F.sansSemiBold, fontSize: 13, letterSpacing: 0.2, flex: 1 },
  quickDesc: { fontFamily: F.serif, fontSize: 12, lineHeight: 17, color: '#A8A29E' },
  selectorPanel: { gap: 10 },
  segmented: {
    minHeight: 46,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.07)',
    backgroundColor: '#F3F2EF',
    padding: 4,
    flexDirection: 'row',
    gap: 4,
    position: 'relative',
  },
  segPill: {
    position: 'absolute',
    top: 4, bottom: 4, width: '47%',
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOpacity: 0.07, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
  },
  tabBtn: { flex: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, zIndex: 1 },
  tabBtnActive: {},
  tabText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2, color: '#A8A29E' },
  tabTextActive: { color: GREEN },
  searchBox: {
    height: 52,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.07)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, height: 52, fontFamily: F.serif, fontSize: 18, color: '#3D3229', paddingVertical: 0 },
  sections: { gap: 2 },

  sectionTabWrap: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: '#F5F3EF',
    borderRadius: 20,
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgba(28,25,23,0.06)',
  },
  sectionTabPill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    width: '47%',
    borderRadius: 15,
    borderWidth: 1,
    zIndex: 0,
  },
  sectionTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 15,
    zIndex: 1,
  },
  sectionTabText: {
    fontFamily: F.serif,
    fontSize: 16,
    color: '#A8A29E',
    letterSpacing: 0.2,
  },
  sectionTabBadge: {
    minWidth: 26,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(28,25,23,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sectionTabCount: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#B8B0A6',
  },
  sectionWrap: {
    gap: 0,
  },
  bookSection: {
    borderRadius: 23,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 2,
  },
  sectionHead: {
    minHeight: 56,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: { flex: 1, fontFamily: F.serifMedium, fontSize: 21, letterSpacing: 0.2 },
  sectionRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countPill: {
    minWidth: 46,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.6 },
  chevronCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookListPanel: {
    marginTop: 10,
    borderRadius: 21,
    borderWidth: 1,
    padding: 12,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 1,
  },
  premiumBook: {
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.035,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  premiumBookExpanded: {
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
  },
  bookCopy: { flex: 1, minWidth: 0 },
  bookName: { fontFamily: F.serif, fontSize: 21, lineHeight: 25, color: '#2F2B27' },
  bookMetaRow: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 7 },
  bookMeta: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.5 },
  bookMetaDot: { fontFamily: F.sansBold, fontSize: 11, color: '#D5D0C9' },
  bookMetaMuted: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.2, color: '#D0D5DD' },
  chapterPanel: {
    marginTop: -8,
    marginBottom: 8,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderTopWidth: 0,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 1,
  },
  chapterPanelHead: {
    marginBottom: 12,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chapterPanelLabel: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.1, color: '#D1D5DB' },
  chapterCountChip: {
    minWidth: 34,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.90)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterCountText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.4 },
  chapterGrid: {
    gap: 9,
  },
  chapterGridRow: {
    flexDirection: 'row',
    gap: 7,
  },
  chapterCell: {
    flex: 1,
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterSpacer: { flex: 1, minHeight: 44 },
  chapterCellText: { fontFamily: F.serif, fontSize: 18, lineHeight: 21 },
  psalterWrap: { gap: 14 },
  psalmPanel: {
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#E8E0D4',
    overflow: 'hidden',
    padding: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2,
  },
  searchPanel: { marginTop: 18, gap: 18 },
  searchBlock: { gap: 9 },
  searchKicker: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2, color: GOLD },
  matchBook: {
    minHeight: 54,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  matchBookTitle: { fontFamily: F.serifMedium, fontSize: 21, color: '#3D3229' },
  matchBookSub: { marginTop: 1, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 1.6, color: '#BEB7AA', textTransform: 'uppercase' },
  resultCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFFFFF',
    padding: 14,
  },
  resultRef: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.6, color: ROSE, textTransform: 'uppercase' },
  resultText: { marginTop: 6, fontFamily: F.serif, fontSize: 18, lineHeight: 26, color: '#3D3229' },
  emptySearch: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptySearchText: { fontFamily: F.serif, fontSize: 18, color: '#A8A29E' },
});
