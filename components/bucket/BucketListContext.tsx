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
let bucketListHasLegacyPayloadColumn = false;
let bucketListInitPromise: Promise<void> | null = null;

function sortBucketList(items: BucketListItem[]) {
  return [...items].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id.localeCompare(b.id);
  });
}

function rowToBucketListItem(row: Record<string, unknown>): BucketListItem {
  const legacyPayload = parseStoredJson<Partial<BucketListItem>>(row.payload, {});
  const completedAt = row.completed_at == null ? legacyPayload.completedAt : Number(row.completed_at);
  const text = typeof row.text === 'string' && row.text.trim().length > 0
    ? row.text
    : typeof legacyPayload.text === 'string' ? legacyPayload.text : '';

  return {
    id: String(row.id),
    text,
    isCompleted: Number(row.is_completed ?? 0) === 1,
    completedAt: completedAt == null ? undefined : Number(completedAt),
    order: Number(row.sort_order ?? legacyPayload.order ?? 0),
    createdAt: Number(row.created_at ?? legacyPayload.createdAt ?? Date.now()),
  };
}

async function tableColumns(db: SQLite.SQLiteDatabase, table: string) {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
  return new Set(rows.map(row => row.name));
}

async function createBucketListSchema(db: SQLite.SQLiteDatabase) {
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS bucket_list_items (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );`,
  );

  await db.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_bucket_list_items_completed
      ON bucket_list_items(is_completed, sort_order, created_at DESC);`,
  );
}

async function backfillBucketListText(db: SQLite.SQLiteDatabase) {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM bucket_list_items',
  );

  for (const row of rows) {
    if (typeof row.text === 'string' && row.text.trim().length > 0) continue;
    const item = rowToBucketListItem(row);
    if (!item.text.trim()) continue;
    await db.runAsync(
      'UPDATE bucket_list_items SET text = ? WHERE id = ?',
      item.text,
      item.id,
    );
  }
}

async function ensureBucketListDb(db: SQLite.SQLiteDatabase) {
  const columns = await tableColumns(db, 'bucket_list_items');

  if (columns.size === 0) {
    await createBucketListSchema(db);
    bucketListHasLegacyPayloadColumn = false;
    return;
  }

  if (!columns.has('text')) {
    await db.execAsync('ALTER TABLE bucket_list_items ADD COLUMN text TEXT NOT NULL DEFAULT \'\';');
  }

  if (columns.has('payload')) {
    await backfillBucketListText(db);
  }

  await createBucketListSchema(db);
  const currentColumns = await tableColumns(db, 'bucket_list_items');
  bucketListHasLegacyPayloadColumn = currentColumns.has('payload');
}

async function initBucketListDb(db: SQLite.SQLiteDatabase) {
  if (!bucketListInitPromise) {
    bucketListInitPromise = ensureBucketListDb(db).finally(() => {
      bucketListInitPromise = null;
    });
  }

  await bucketListInitPromise;
}

async function persistBucketListItem(db: SQLite.SQLiteDatabase, item: BucketListItem) {
  if (bucketListHasLegacyPayloadColumn) {
    await db.runAsync(
      `INSERT INTO bucket_list_items
        (id, text, is_completed, completed_at, sort_order, created_at, updated_at, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        text = excluded.text,
        is_completed = excluded.is_completed,
        completed_at = excluded.completed_at,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at,
        payload = excluded.payload`,
      item.id,
      item.text,
      item.isCompleted ? 1 : 0,
      item.completedAt ?? null,
      item.order,
      item.createdAt,
      Date.now(),
      '{}',
    );
    return;
  }

  await db.runAsync(
    `INSERT INTO bucket_list_items
      (id, text, is_completed, completed_at, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      text = excluded.text,
      is_completed = excluded.is_completed,
      completed_at = excluded.completed_at,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at`,
    item.id,
    item.text,
    item.isCompleted ? 1 : 0,
    item.completedAt ?? null,
    item.order,
    item.createdAt,
    Date.now(),
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
      try {
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
      } catch (error) {
        console.warn('Failed to load bucket list', error);
      }
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
      try {
        const db = await getReadyDb();
        await persistBucketListItem(db, item);
      } catch (error) {
        console.warn('Failed to save bucket list item', error);
        const db = await getReadyDb();
        await refreshBucketList(db);
      }
    })();
  }, [getReadyDb, refreshBucketList]);

  const updateBucketItem = useCallback((item: BucketListItem) => {
    setBucketList(prev => sortBucketList(prev.map(existing => existing.id === item.id ? item : existing)));
    void (async () => {
      try {
        const db = await getReadyDb();
        await persistBucketListItem(db, item);
      } catch (error) {
        console.warn('Failed to update bucket list item', error);
        const db = await getReadyDb();
        await refreshBucketList(db);
      }
    })();
  }, [getReadyDb, refreshBucketList]);

  const completeBucketItem = useCallback((id: string) => {
    const completedAt = Date.now();
    setBucketList(prev => sortBucketList(prev.map(item => (
      item.id === id ? { ...item, isCompleted: true, completedAt } : item
    ))));

    void (async () => {
      try {
        const db = await getReadyDb();
        const current = bucketListRef.current.find(item => item.id === id);
        if (!current) {
          await refreshBucketList(db);
          return;
        }
        await persistBucketListItem(db, { ...current, isCompleted: true, completedAt });
      } catch (error) {
        console.warn('Failed to complete bucket list item', error);
        const db = await getReadyDb();
        await refreshBucketList(db);
      }
    })();
  }, [getReadyDb, refreshBucketList]);

  const uncompleteBucketItem = useCallback((id: string) => {
    setBucketList(prev => sortBucketList(prev.map(item => (
      item.id === id ? { ...item, isCompleted: false, completedAt: undefined } : item
    ))));

    void (async () => {
      try {
        const db = await getReadyDb();
        const current = bucketListRef.current.find(item => item.id === id);
        if (!current) {
          await refreshBucketList(db);
          return;
        }
        await persistBucketListItem(db, { ...current, isCompleted: false, completedAt: undefined });
      } catch (error) {
        console.warn('Failed to uncomplete bucket list item', error);
        const db = await getReadyDb();
        await refreshBucketList(db);
      }
    })();
  }, [getReadyDb, refreshBucketList]);

  const deleteBucketItem = useCallback((id: string) => {
    setBucketList(prev => prev.filter(item => item.id !== id));
    void (async () => {
      try {
        const db = await getReadyDb();
        await db.runAsync('DELETE FROM bucket_list_items WHERE id = ?', id);
      } catch (error) {
        console.warn('Failed to delete bucket list item', error);
        const db = await getReadyDb();
        await refreshBucketList(db);
      }
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
