import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
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

const BG = '#FCFCFC';
const GOLD = '#C5A059';
const GREEN = '#5E7B55';
const ROSE = '#BE123C';

type ScriptureTab = 'bible' | 'psalter';
type SectionKey = 'new' | 'old' | null;

const NEW_TESTAMENT = BIBLE_BOOKS.filter(book => book.testament === 'nt');
const OLD_TESTAMENT = BIBLE_BOOKS.filter(book => book.testament !== 'nt' && book.id !== PSALMS_ID);
const PSALTER = BIBLE_BOOKS.filter(book => book.id === PSALMS_ID);
const PSALMS_BOOK = PSALTER[0];

export default function HolyScriptureView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { ready, searchVerses } = useScripture();

  const [tab, setTab] = useState<ScriptureTab>('bible');
  const [openSection, setOpenSection] = useState<SectionKey>(null);
  const [expandedBookId, setExpandedBookId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ScriptureSearchResult[]>([]);

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

  const toggleBook = (book: BibleBook) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        <View style={s.quickList}>
          <ActionCard
            tone="gold"
            icon={<Star s={16} c={GOLD} />}
            label="MY FAVORITES"
            text="Saved highlights, comments, and passages."
            onPress={() => router.push('/favorites')}
          />
          <ActionCard
            tone="green"
            icon={<Notebook s={15} c={GREEN} />}
            label="BIBLE NOTES"
            text="Your chapter notes - study reflections."
            onPress={() => router.push('/bible-notes')}
          />
          <ActionCard
            tone="gold"
            icon={null}
            label="SET AS DAILY TASK"
            text="Add to your daily routine"
            onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}
            forceDailyTask
          />
        </View>

        <View style={s.selectorPanel}>
          <View style={s.segmented}>
            <TabButton
              active={tab === 'bible'}
              icon={<Book s={14} c={tab === 'bible' ? GREEN : '#A8A29E'} />}
              label="BIBLE"
              onPress={() => {
                setTab('bible');
                setOpenSection(null);
                setExpandedBookId(null);
              }}
            />
            <TabButton
              active={tab === 'psalter'}
              icon={<OpenBook s={14} c={tab === 'psalter' ? GREEN : '#A8A29E'} />}
              label="PSALTER"
              onPress={() => {
                setTab('psalter');
                setOpenSection(null);
                setExpandedBookId(null);
              }}
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
            <BookSection
              title="New Testament"
              count={NEW_TESTAMENT.length}
              books={NEW_TESTAMENT}
              open={openSection === 'new'}
              accent={GREEN}
              tone="green"
              expandedBookId={expandedBookId}
              onToggle={() => {
                setOpenSection(openSection === 'new' ? null : 'new');
                setExpandedBookId(null);
              }}
              onBook={toggleBook}
              onChapter={openReader}
            />
            <BookSection
              title="Old Testament"
              count={OLD_TESTAMENT.length}
              books={OLD_TESTAMENT}
              open={openSection === 'old'}
              accent={GOLD}
              tone="stone"
              expandedBookId={expandedBookId}
              onToggle={() => {
                setOpenSection(openSection === 'old' ? null : 'old');
                setExpandedBookId(null);
              }}
              onBook={toggleBook}
              onChapter={openReader}
            />
          </View>
        )}
      </ScrollView>
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

function ActionCard({
  tone, icon, label, text, onPress, forceDailyTask = false,
}: {
  tone: 'gold' | 'green';
  icon: React.ReactNode;
  label: string;
  text: string;
  onPress: () => void;
  forceDailyTask?: boolean;
}) {
  if (forceDailyTask) {
    return <SetAsDailyTaskCard variant="scripture" onPress={onPress} />;
  }
  const accent = tone === 'green' ? GREEN : GOLD;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      style={[
        s.actionCard,
        {
          borderColor: tone === 'green' ? 'rgba(94,123,85,0.28)' : 'rgba(197,160,89,0.30)',
          backgroundColor: tone === 'green' ? '#F4FAF1' : '#FFFDF8',
        },
      ]}
    >
      <View style={[s.actionIcon, { borderColor: `${accent}30` }]}>{icon}</View>
      <View style={s.actionCopy}>
        <Text style={[s.actionLabel, { color: accent }]}>{label}</Text>
        <Text style={s.actionText} numberOfLines={2}>{text}</Text>
      </View>
      <ChevronRight s={18} c={accent} />
    </TouchableOpacity>
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
  const sectionColors = (isGreen ? ['#FFFEFC', '#F3F8EE'] : ['#FFFEFC', '#FAF7F1']) as [string, string];
  const panelColors = (isGreen ? ['#FCFDF9', '#F4F8EF'] : ['#FFFDF9', '#F8F4EC']) as [string, string];

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
            <Text style={[s.sectionTitle, { color: isGreen ? '#445C3C' : '#4F4536' }]}>{title}</Text>
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
  psalms, results, searching, cardWidth, onPsalm, onResult,
}: {
  psalms: number[];
  results: ScriptureSearchResult[];
  searching: boolean;
  cardWidth: number;
  onPsalm: (psalm: number) => void;
  onResult: (result: ScriptureSearchResult) => void;
}) {
  return (
    <View style={s.psalterWrap}>
      <View style={s.psalterIntro}>
        <View style={s.psalterIntroCopy}>
          <Text style={s.psalterKicker}>THE PSALMS OF DAVID</Text>
          <Text style={s.psalterDesc}>A prayerful collection for daily reading, chanting, and reflection.</Text>
        </View>
        <View style={s.psalterBadge}>
          <Text style={s.psalterBadgeText}>{psalms.length}</Text>
        </View>
      </View>

      {psalms.length > 0 && (
        <View style={s.psalmGrid}>
          {psalms.map(psalm => (
            <PsalmCard
              key={psalm}
              psalm={psalm}
              width={cardWidth}
              onPress={() => onPsalm(psalm)}
            />
          ))}
        </View>
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

function PsalmCard({
  psalm, width, onPress,
}: {
  psalm: number;
  width: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.86}>
      <LinearGradient
        colors={['#FFFEFB', '#FFF8EF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[s.psalmCard, { width }]}
      >
        <View style={s.psalmCardTop}>
          <View style={s.psalmNumber}>
            <Text style={s.psalmNumberText}>{psalm}</Text>
          </View>
          <View style={s.psalmArrow}>
            <ChevronRight s={15} c="#C7A162" />
          </View>
        </View>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={s.psalmTitle}>
          Psalm {psalm}
        </Text>
        <Text style={s.psalmMeta}>PSALTER</Text>
      </LinearGradient>
    </TouchableOpacity>
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
  content: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 14 },
  quickList: { gap: 10 },
  actionCard: {
    minHeight: 74,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: { flex: 1, minWidth: 0 },
  actionLabel: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2 },
  actionText: { marginTop: 2, fontFamily: F.serif, fontSize: 17, lineHeight: 21, color: '#8A8F9A' },
  selectorPanel: {
    marginTop: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.18)',
    backgroundColor: '#FFFDF8',
    padding: 14,
    gap: 14,
  },
  segmented: {
    minHeight: 46,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.07)',
    backgroundColor: '#FFFFFF',
    padding: 4,
    flexDirection: 'row',
    gap: 4,
  },
  tabBtn: { flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  tabText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.2, color: '#A8A29E' },
  tabTextActive: { color: GREEN },
  searchBox: {
    minHeight: 52,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.07)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontFamily: F.serif, fontSize: 18, color: '#3D3229', paddingVertical: 0 },
  sections: { gap: 24, marginTop: 20 },
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
    minHeight: 74,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: { flex: 1, fontFamily: F.serifMedium, fontSize: 27, letterSpacing: 0.3 },
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
  psalterWrap: { marginTop: 18, gap: 14 },
  psalterIntro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 6,
    paddingTop: 2,
  },
  psalterIntroCopy: { flex: 1, minWidth: 0 },
  psalterKicker: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 2.5, color: '#8C95A3' },
  psalterDesc: { marginTop: 8, fontFamily: F.serif, fontSize: 19, lineHeight: 27, color: '#5D6673' },
  psalterBadge: {
    minWidth: 48,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ECE4D6',
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 1,
  },
  psalterBadgeText: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 1.4, color: '#B49B67' },
  psalmGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 10,
  },
  psalmCard: {
    minHeight: 108,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8DECD',
    padding: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 1,
  },
  psalmCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  psalmNumber: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0D7AF',
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 1,
  },
  psalmNumberText: { fontFamily: F.serifMedium, fontSize: 19, color: '#A56412' },
  psalmArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#EED9B8',
    backgroundColor: 'rgba(255,255,255,0.90)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  psalmTitle: { fontFamily: F.serif, fontSize: 21, lineHeight: 25, color: '#1F2933' },
  psalmMeta: { marginTop: 4, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.1, color: '#BE8A45' },
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
