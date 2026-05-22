import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getStoredJson,
  openUserContentDb,
  saveStoredJson,
} from '@/data/userContentDb';

export type AppSettings = {
  appLang: string;
  bibleLang: string;
  prayerLang: string;
  calendarType: string;
  notifSpiritual: boolean;
  notifRoutine: boolean;
  notifReading: boolean;
  notifGratitude: boolean;
  notifHabits: boolean;
  notifJournal: boolean;
  notifChallenges: boolean;
  quietHours: boolean;
  dndEnabled: boolean;
};

export type AccountProfile = {
  displayName: string;
  email: string;
  plan: string;
  memberSince: string;
  syncStatus: string;
};

type SettingsContextValue = {
  settings: AppSettings;
  account: AccountProfile;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateAccount: (patch: Partial<AccountProfile>) => void;
};

const DEFAULT_SETTINGS: AppSettings = {
  appLang: 'en',
  bibleLang: 'sr',
  prayerLang: 'sr',
  calendarType: 'gregorian',
  notifSpiritual: true,
  notifRoutine: true,
  notifReading: true,
  notifGratitude: true,
  notifHabits: true,
  notifJournal: true,
  notifChallenges: true,
  quietHours: true,
  dndEnabled: false,
};

const DEFAULT_ACCOUNT: AccountProfile = {
  displayName: 'Not signed in',
  email: 'Local account',
  plan: 'Free Trial',
  memberSince: 'Today',
  syncStatus: 'Local only',
};

const STORE_KEYS = {
  appSettings: 'app_settings',
  accountProfile: 'account_profile',
} as const;

const SettingsContext = createContext<SettingsContextValue | null>(null);

function enqueueStoredJson<T>(
  queueRef: React.MutableRefObject<Promise<void>>,
  key: string,
  value: T,
) {
  queueRef.current = queueRef.current
    .catch(() => undefined)
    .then(async () => {
      const db = await openUserContentDb();
      await saveStoredJson(db, key, value);
    })
    .catch(() => undefined);
}

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS;
  const raw = value as Record<string, unknown>;
  const legacySpiritual = typeof raw.notifMorning === 'boolean' || typeof raw.notifEvening === 'boolean'
    ? Boolean(raw.notifMorning || raw.notifEvening)
    : DEFAULT_SETTINGS.notifSpiritual;
  const legacyRoutine = typeof raw.notifTasks === 'boolean'
    ? raw.notifTasks
    : DEFAULT_SETTINGS.notifRoutine;
  const legacyReading = typeof raw.notifBible === 'boolean'
    ? raw.notifBible
    : DEFAULT_SETTINGS.notifReading;
  return {
    ...DEFAULT_SETTINGS,
    appLang: typeof raw.appLang === 'string' ? raw.appLang : DEFAULT_SETTINGS.appLang,
    bibleLang: typeof raw.bibleLang === 'string' ? raw.bibleLang : DEFAULT_SETTINGS.bibleLang,
    prayerLang: typeof raw.prayerLang === 'string' ? raw.prayerLang : DEFAULT_SETTINGS.prayerLang,
    calendarType: typeof raw.calendarType === 'string' ? raw.calendarType : DEFAULT_SETTINGS.calendarType,
    notifSpiritual: typeof raw.notifSpiritual === 'boolean' ? raw.notifSpiritual : legacySpiritual,
    notifRoutine: typeof raw.notifRoutine === 'boolean' ? raw.notifRoutine : legacyRoutine,
    notifReading: typeof raw.notifReading === 'boolean' ? raw.notifReading : legacyReading,
    notifGratitude: typeof raw.notifGratitude === 'boolean' ? raw.notifGratitude : DEFAULT_SETTINGS.notifGratitude,
    notifHabits: typeof raw.notifHabits === 'boolean' ? raw.notifHabits : DEFAULT_SETTINGS.notifHabits,
    notifJournal: typeof raw.notifJournal === 'boolean' ? raw.notifJournal : DEFAULT_SETTINGS.notifJournal,
    notifChallenges: typeof raw.notifChallenges === 'boolean' ? raw.notifChallenges : DEFAULT_SETTINGS.notifChallenges,
    quietHours: typeof raw.quietHours === 'boolean' ? raw.quietHours : DEFAULT_SETTINGS.quietHours,
    dndEnabled: typeof raw.dndEnabled === 'boolean' ? raw.dndEnabled : DEFAULT_SETTINGS.dndEnabled,
  };
}

function normalizeAccount(value: unknown): AccountProfile {
  if (!value || typeof value !== 'object') return DEFAULT_ACCOUNT;
  const raw = value as Record<string, unknown>;
  return {
    ...DEFAULT_ACCOUNT,
    displayName: typeof raw.displayName === 'string' ? raw.displayName : DEFAULT_ACCOUNT.displayName,
    email: typeof raw.email === 'string' ? raw.email : DEFAULT_ACCOUNT.email,
    plan: typeof raw.plan === 'string' ? raw.plan : DEFAULT_ACCOUNT.plan,
    memberSince: typeof raw.memberSince === 'string' ? raw.memberSince : DEFAULT_ACCOUNT.memberSince,
    syncStatus: typeof raw.syncStatus === 'string' ? raw.syncStatus : DEFAULT_ACCOUNT.syncStatus,
  };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [account, setAccount] = useState<AccountProfile>(DEFAULT_ACCOUNT);
  const settingsSaveQueue = useRef(Promise.resolve());
  const accountSaveQueue = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    void (async () => {
      const db = await openUserContentDb();
      const [storedSettings, storedAccount] = await Promise.all([
        getStoredJson<unknown>(db, STORE_KEYS.appSettings, DEFAULT_SETTINGS),
        getStoredJson<unknown>(db, STORE_KEYS.accountProfile, DEFAULT_ACCOUNT),
      ]);
      if (!active) return;
      setSettings(normalizeSettings(storedSettings));
      setAccount(normalizeAccount(storedAccount));
    })();
    return () => {
      active = false;
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      enqueueStoredJson(settingsSaveQueue, STORE_KEYS.appSettings, next);
      return next;
    });
  }, []);

  const updateAccount = useCallback((patch: Partial<AccountProfile>) => {
    setAccount(prev => {
      const next = { ...prev, ...patch };
      enqueueStoredJson(accountSaveQueue, STORE_KEYS.accountProfile, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, account, updateSettings, updateAccount }),
    [account, settings, updateAccount, updateSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useAppSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useAppSettings must be used within SettingsProvider');
  return value;
}
