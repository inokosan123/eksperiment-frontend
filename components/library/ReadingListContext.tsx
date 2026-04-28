import React, { createContext, useContext, useMemo, useState } from 'react';

export type ReadingStatus = 'to_read' | 'reading' | 'finished';
export type ReadingFrequency = 'daily' | 'weekdays' | 'weekends' | 'specific_days' | 'monthly';
export type ReadingNotificationMode = 'none' | 'single' | 'double';

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

type ReadingListContextValue = {
  books: ReadingBook[];
  addBook: (book: ReadingBook) => void;
  updateBook: (id: string, updates: Partial<ReadingBook>) => void;
  deleteBook: (id: string) => void;
  recordSession: (bookId: string | null, minutes: number) => void;
};

const ReadingListContext = createContext<ReadingListContextValue | null>(null);

const INITIAL_BOOKS: ReadingBook[] = [
  {
    id: 'book_1',
    title: 'The Power of Silence',
    author: 'Robert Cardinal Sarah',
    category: 'Spirituality',
    status: 'reading',
    createdAt: Date.now() - 86400000 * 15,
    startedAt: Date.now() - 86400000 * 12,
    showOnHome: true,
    taskTime: '21:00',
    taskFrequency: 'daily',
    taskMonthlyDays: [1],
    taskSameTimeEveryDay: true,
    taskDayTimes: {},
    taskNotificationMode: 'single',
    taskReminderMinutes: 15,
    sessions: 9,
    totalMinutes: 242,
    lastSessionAt: Date.now() - 86400000,
    review: 'Slow, reverent, and very clarifying.',
    keyLessons: 'Protect silence. Stop filling every empty moment.',
  },
  {
    id: 'book_2',
    title: 'Atomic Habits',
    author: 'James Clear',
    category: 'Productivity',
    status: 'to_read',
    createdAt: Date.now() - 86400000 * 9,
    sessions: 0,
    totalMinutes: 0,
    showOnHome: false,
    taskFrequency: 'weekdays',
    taskSelectedDays: [1, 2, 3, 4, 5],
    taskMonthlyDays: [1],
    taskTime: '18:30',
    taskSameTimeEveryDay: true,
    taskDayTimes: {},
    taskNotificationMode: 'none',
    taskReminderMinutes: 15,
  },
  {
    id: 'book_3',
    title: 'Confessions',
    author: 'St. Augustine',
    category: 'Philosophy',
    status: 'finished',
    createdAt: Date.now() - 86400000 * 38,
    startedAt: Date.now() - 86400000 * 30,
    finishedAt: Date.now() - 86400000 * 6,
    sessions: 14,
    totalMinutes: 401,
    lastSessionAt: Date.now() - 86400000 * 6,
    rating: 5,
    review: 'Rich, honest, and impossible to rush.',
    keyLessons: 'Desire has to be educated. Grace reorders love.',
  },
];

export function ReadingListProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<ReadingBook[]>(INITIAL_BOOKS);

  const value = useMemo<ReadingListContextValue>(() => ({
    books,
    addBook: book => setBooks(current => [book, ...current]),
    updateBook: (id, updates) => setBooks(current =>
      current.map(book => book.id === id ? { ...book, ...updates } : book)),
    deleteBook: id => setBooks(current => current.filter(book => book.id !== id)),
    recordSession: (bookId, minutes) => {
      if (!bookId) return;
      setBooks(current => current.map(book => book.id === bookId ? {
        ...book,
        sessions: book.sessions + 1,
        totalMinutes: book.totalMinutes + minutes,
        lastSessionAt: Date.now(),
        status: book.status === 'to_read' ? 'reading' : book.status,
        startedAt: book.startedAt ?? Date.now(),
      } : book));
    },
  }), [books]);

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
