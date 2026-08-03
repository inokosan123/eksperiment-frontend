import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getLocalDateKey } from '@/components/tasks/taskScheduler';
import {
  DEFAULT_READING_BOOKS,
  DEFAULT_READING_CATEGORIES,
  deleteReadingBook,
  loadReadingListSnapshot,
  recordReadingSession,
  saveReadingBook,
  saveReadingCategories,
} from './readingListDb';

export type ReadingStatus = 'to_read' | 'reading' | 'finished';
export type ReadingFrequency = 'daily' | 'weekdays' | 'weekends' | 'specific_days' | 'monthly';
export type ReadingNotificationMode = 'none' | 'single' | 'double';

export type ReadingCategoryDef = {
  label: string;
  color: string;
};

export type ReadingBook = {
  id: string;
  title: string;
  author?: string;
  category?: string;
  status: ReadingStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  rating?: number;
  review?: string;
  keyLessons?: string;
  showOnHome?: boolean;
  taskTime?: string;
  taskFrequency?: ReadingFrequency;
  taskSelectedDays?: number[];
  taskMonthlyDays?: number[];
  taskSameTimeEveryDay?: boolean;
  taskDayTimes?: Record<number, string>;
  taskNotificationMode?: ReadingNotificationMode;
  taskReminderMinutes?: number;
  sessions: number;
  totalMinutes: number;
  lastSessionAt?: number;
};

export type ReadingSession = {
  id: string;
  bookId: string;
  minutes: number;
  sessionDate: string;
  createdAt: number;
};

type ReadingListContextValue = {
  ready: boolean;
  books: ReadingBook[];
  sessions: ReadingSession[];
  categoryDefs: ReadingCategoryDef[];
  refresh: () => Promise<void>;
  addBook: (book: ReadingBook) => Promise<void>;
  updateBook: (id: string, updates: Partial<ReadingBook>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  commitReadingSession: (bookId: string | null, minutes: number, sessionDate?: string) => Promise<void>;
  recordSession: (bookId: string | null, minutes: number, sessionDate?: string) => Promise<void>;
  saveCategoryDefs: (defs: ReadingCategoryDef[]) => Promise<void>;
};

const ReadingListContext = createContext<ReadingListContextValue | null>(null);

export function ReadingListProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [books, setBooks] = useState<ReadingBook[]>(DEFAULT_READING_BOOKS);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [categoryDefs, setCategoryDefs] = useState<ReadingCategoryDef[]>(DEFAULT_READING_CATEGORIES);
  const booksRef = useRef(books);

  useEffect(() => {
    booksRef.current = books;
  }, [books]);

  const applySnapshot = useCallback((snapshot: {
    books: ReadingBook[];
    sessions: ReadingSession[];
    categoryDefs: ReadingCategoryDef[];
  }) => {
    setBooks(snapshot.books);
    setSessions(snapshot.sessions);
    setCategoryDefs(snapshot.categoryDefs);
  }, []);

  const refresh = useCallback(async () => {
    const snapshot = await loadReadingListSnapshot();
    applySnapshot(snapshot);
    setReady(true);
  }, [applySnapshot]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const snapshot = await loadReadingListSnapshot();
        if (active) {
          applySnapshot(snapshot);
          setReady(true);
        }
      } catch (error) {
        console.warn('Reading list backend failed to load:', error);
        if (active) setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [applySnapshot]);

  const addBook = useCallback(async (book: ReadingBook) => {
    setBooks(current => [book, ...current]);
    await saveReadingBook(book);
    await refresh();
  }, [refresh]);

  const updateBook = useCallback(async (id: string, updates: Partial<ReadingBook>) => {
    const currentBook = booksRef.current.find(book => book.id === id);
    if (!currentBook) return;
    const nextUpdates = {
      ...updates,
      ...(updates.status && updates.status !== 'reading' ? { showOnHome: false } : {}),
    };
    const nextBook = { ...currentBook, ...nextUpdates };

    setBooks(current => current.map(book => (book.id === id ? nextBook : book)));
    await saveReadingBook(nextBook);
    await refresh();
  }, [refresh]);

  const deleteBook = useCallback(async (id: string) => {
    setBooks(current => current.filter(book => book.id !== id));
    await deleteReadingBook(id);
    await refresh();
  }, [refresh]);

  const applyReadingSession = useCallback((
    bookId: string,
    minutes: number,
    sessionDate: string,
    now: number,
  ) => {
    const cleanMinutes = Math.max(1, Math.round(minutes));
    setBooks(current => current.map(book => {
      if (book.id !== bookId) return book;
      return {
        ...book,
        sessions: book.sessions + 1,
        totalMinutes: book.totalMinutes + cleanMinutes,
        lastSessionAt: now,
        status: book.status === 'to_read' ? 'reading' : book.status,
        startedAt: book.startedAt ?? now,
      };
    }));
    setSessions(current => [{
      id: `pending_reading_session_${now}`,
      bookId,
      minutes: cleanMinutes,
      sessionDate,
      createdAt: now,
    }, ...current]);
  }, []);

  const commitReadingSession = useCallback(async (
    bookId: string | null,
    minutes: number,
    sessionDate?: string,
  ) => {
    if (!bookId) return;

    const now = Date.now();
    const effectiveDate = sessionDate ?? getLocalDateKey(new Date(now));
    await recordReadingSession(bookId, minutes, effectiveDate, { completeTask: false });
    applyReadingSession(bookId, minutes, effectiveDate, now);
  }, [applyReadingSession]);

  const recordSession = useCallback(async (bookId: string | null, minutes: number, sessionDate?: string) => {
    if (!bookId) return;
    const now = Date.now();
    const effectiveDate = sessionDate ?? getLocalDateKey(new Date(now));
    await recordReadingSession(bookId, minutes, effectiveDate);
    applyReadingSession(bookId, minutes, effectiveDate, now);
    await refresh();
  }, [applyReadingSession, refresh]);

  const saveCategoryDefs = useCallback(async (defs: ReadingCategoryDef[]) => {
    setCategoryDefs(defs);
    await saveReadingCategories(defs);
    await refresh();
  }, [refresh]);

  const value = useMemo<ReadingListContextValue>(() => ({
    ready,
    books,
    sessions,
    categoryDefs,
    refresh,
    addBook,
    updateBook,
    deleteBook,
    commitReadingSession,
    recordSession,
    saveCategoryDefs,
  }), [
    ready,
    books,
    sessions,
    categoryDefs,
    refresh,
    addBook,
    updateBook,
    deleteBook,
    commitReadingSession,
    recordSession,
    saveCategoryDefs,
  ]);

  return (
    <ReadingListContext.Provider value={value}>
      {children}
    </ReadingListContext.Provider>
  );
}

export function useReadingList() {
  const context = useContext(ReadingListContext);
  if (!context) {
    throw new Error('useReadingList must be used inside ReadingListProvider');
  }
  return context;
}
