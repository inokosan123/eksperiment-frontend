import { getStoredJson, openUserContentDb, saveStoredJson } from '@/data/userContentDb';
import type { GuidedSessionState } from './types';

const GUIDED_SETUP_STORAGE_KEY = 'onboarding.guidedSetup.v1';

let saveQueue = Promise.resolve();

export async function loadGuidedSetupSession() {
  const db = await openUserContentDb();
  return getStoredJson<GuidedSessionState | null>(db, GUIDED_SETUP_STORAGE_KEY, null);
}

export function saveGuidedSetupSession(session: GuidedSessionState | null) {
  saveQueue = saveQueue
    .catch(() => undefined)
    .then(async () => {
      const db = await openUserContentDb();
      await saveStoredJson(db, GUIDED_SETUP_STORAGE_KEY, session);
    });

  return saveQueue;
}
