import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import * as SQLite from 'expo-sqlite';
import { openUserContentDb, parseStoredJson } from '@/data/userContentDb';

export type BucketListItem = {
  id: string;
  text: string;
  isCompleted: boolean;
  completedAt?: number;
  order: number;
  createdAt: number;
};

type BucketListContextValue = {
  bucketList: BucketListItem[];
  addBucketItem: (item: BucketListItem) => void;
  updateBucketItem: (item: BucketListItem) => void;
  completeBucketItem: (id: string) => void;
  uncompleteBucketItem: (id: string) => void;
  deleteBucketItem: (id: string) => void;
};

const BucketListContext = createContext<BucketListContextValue | null>(null);

function sortBucketList(items: BucketListItem[]) {
  return [...items].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id.localeCompare(b.id);
  });
}

function rowToBucketListItem(row: Record<string, unknown>): BucketListItem {
  const payload = parseStoredJson<Partial<BucketListItem>>(row.payload, {});
  const completedAt = row.completed_at == null ? payload.completedAt : Number(row.completed_at);

  return {
    id: String(row.id),
    text: typeof payload.text === 'string' ? payload.text : '',
    isCompleted: Number(row.is_completed ?? 0) === 1,
    completedAt: completedAt == null ? undefined : Number(completedAt),
    order: Number(row.sort_order ?? payload.order ?? 0),
    createdAt: Number(row.created_at ?? payload.createdAt ?? Date.now()),
  };
}

async function initBucketListDb(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS bucket_list_items (
      id TEXT PRIMARY KEY,
      is_completed INTEGER DEFAULT 0,
      completed_at INTEGER,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bucket_list_items_completed
      ON bucket_list_items(is_completed, sort_order, created_at DESC);
  `);
}

async function persistBucketListItem(db: SQLite.SQLiteDatabase, item: BucketListItem) {
  await db.runAsync(
    `INSERT INTO bucket_list_items
      (id, is_completed, completed_at, sort_order, created_at, updated_at, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      is_completed = excluded.is_completed,
      completed_at = excluded.completed_at,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at,
      payload = excluded.payload`,
    item.id,
    item.isCompleted ? 1 : 0,
    item.completedAt ?? null,
    item.order,
    item.createdAt,
    Date.now(),
    JSON.stringify(item),
  );
}

export function BucketListProvider({ children }: { children: React.ReactNode }) {
  const [userDb, setUserDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [bucketList, setBucketList] = useState<BucketListItem[]>([]);
  const bucketListRef = useRef<BucketListItem[]>([]);

  useEffect(() => {
    bucketListRef.current = bucketList;
  }, [bucketList]);

  const getReadyDb = useCallback(async () => {
    const db = userDb ?? await openUserContentDb();
    await initBucketListDb(db);

    if (!userDb) {
      setUserDb(current => current ?? db);
    }

    return db;
  }, [userDb]);

  const refreshBucketList = useCallback(async (dbOverride?: SQLite.SQLiteDatabase) => {
    const db = dbOverride ?? userDb;
    if (!db) return;

    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM bucket_list_items
       ORDER BY sort_order ASC, created_at ASC, id ASC`,
    );
    setBucketList(sortBucketList(rows.map(rowToBucketListItem)));
  }, [userDb]);

  useEffect(() => {
    let active = true;

    (async () => {
      const db = await openUserContentDb();
      await initBucketListDb(db);
      if (!active) return;
      const rows = await db.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM bucket_list_items
         ORDER BY sort_order ASC, created_at ASC, id ASC`,
      );
      if (!active) return;
      setBucketList(sortBucketList(rows.map(rowToBucketListItem)));
      setUserDb(db);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userDb) return;
    void refreshBucketList(userDb);
  }, [refreshBucketList, userDb]);

  const addBucketItem = useCallback((item: BucketListItem) => {
    setBucketList(prev => sortBucketList([...prev, item]));
    void (async () => {
      const db = await getReadyDb();
      await persistBucketListItem(db, item);
      await refreshBucketList(db);
    })();
  }, [getReadyDb, refreshBucketList]);

  const updateBucketItem = useCallback((item: BucketListItem) => {
    setBucketList(prev => sortBucketList(prev.map(existing => existing.id === item.id ? item : existing)));
    void (async () => {
      const db = await getReadyDb();
      await persistBucketListItem(db, item);
      await refreshBucketList(db);
    })();
  }, [getReadyDb, refreshBucketList]);

  const completeBucketItem = useCallback((id: string) => {
    const completedAt = Date.now();
    setBucketList(prev => sortBucketList(prev.map(item => (
      item.id === id ? { ...item, isCompleted: true, completedAt } : item
    ))));

    void (async () => {
      const db = await getReadyDb();
      const current = bucketListRef.current.find(item => item.id === id);
      if (!current) {
        await refreshBucketList(db);
        return;
      }
      await persistBucketListItem(db, { ...current, isCompleted: true, completedAt });
      await refreshBucketList(db);
    })();
  }, [getReadyDb, refreshBucketList]);

  const uncompleteBucketItem = useCallback((id: string) => {
    setBucketList(prev => sortBucketList(prev.map(item => (
      item.id === id ? { ...item, isCompleted: false, completedAt: undefined } : item
    ))));

    void (async () => {
      const db = await getReadyDb();
      const current = bucketListRef.current.find(item => item.id === id);
      if (!current) {
        await refreshBucketList(db);
        return;
      }
      await persistBucketListItem(db, { ...current, isCompleted: false, completedAt: undefined });
      await refreshBucketList(db);
    })();
  }, [getReadyDb, refreshBucketList]);

  const deleteBucketItem = useCallback((id: string) => {
    setBucketList(prev => prev.filter(item => item.id !== id));
    void (async () => {
      const db = await getReadyDb();
      await db.runAsync('DELETE FROM bucket_list_items WHERE id = ?', id);
      await refreshBucketList(db);
    })();
  }, [getReadyDb, refreshBucketList]);

  const value = useMemo(() => ({
    bucketList,
    addBucketItem,
    updateBucketItem,
    completeBucketItem,
    uncompleteBucketItem,
    deleteBucketItem,
  }), [
    addBucketItem,
    bucketList,
    completeBucketItem,
    deleteBucketItem,
    uncompleteBucketItem,
    updateBucketItem,
  ]);

  return (
    <BucketListContext.Provider value={value}>
      {children}
    </BucketListContext.Provider>
  );
}

export function useBucketList() {
  const value = useContext(BucketListContext);
  if (!value) {
    throw new Error('useBucketList must be used inside BucketListProvider');
  }
  return value;
}
