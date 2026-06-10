import { getStoredJson, openUserContentDb, saveStoredJson } from '@/data/userContentDb';

const ONBOARDING_PROGRESS_STORAGE_KEY = 'onboarding.progress.v4';
export const ONBOARDING_PROGRESS_VERSION = 2;

export type StoredOnboardingProgress<AnswersShape> = {
  version: typeof ONBOARDING_PROGRESS_VERSION;
  index: number;
  answers: AnswersShape;
  completedSections: string[];
  updatedAt: number;
};

let saveQueue = Promise.resolve();

export async function loadOnboardingProgress<AnswersShape>() {
  const db = await openUserContentDb();
  return getStoredJson<StoredOnboardingProgress<AnswersShape> | null>(
    db,
    ONBOARDING_PROGRESS_STORAGE_KEY,
    null,
  );
}

export function saveOnboardingProgress<AnswersShape>(
  progress: StoredOnboardingProgress<AnswersShape> | null,
) {
  saveQueue = saveQueue
    .catch(() => undefined)
    .then(async () => {
      const db = await openUserContentDb();
      await saveStoredJson(db, ONBOARDING_PROGRESS_STORAGE_KEY, progress);
    });

  return saveQueue;
}

export function clearOnboardingProgress() {
  return saveOnboardingProgress(null);
}
