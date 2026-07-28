import {
  createLatestByKeyQueue,
  type LatestByKeyQueue,
} from '@/components/journal/journal-save-queue';
import {
  recordJournalSaveCompleted,
  recordJournalSaveQueued,
  richTextDiagnosticNow,
} from '@/components/shared/rich-text/rich-text-diagnostics';

export type JournalWriteRequest<Entry> = {
  entry: Entry;
  revision: number;
  queueCompletionCelebration: boolean;
};

export type JournalWriteCoordinator<Entry, Saved> = LatestByKeyQueue<
  string,
  JournalWriteRequest<Entry>,
  Saved
>;

export function createJournalWriteCoordinator<Entry, Saved>({
  persist,
  isLatestRevision,
  onLatestPersisted,
}: {
  persist: (entry: Entry) => Promise<Saved>;
  isLatestRevision: (date: string, revision: number) => boolean;
  onLatestPersisted: (
    date: string,
    request: JournalWriteRequest<Entry>,
    saved: Saved,
  ) => void;
}): JournalWriteCoordinator<Entry, Saved> {
  const queue = createLatestByKeyQueue<
    string,
    JournalWriteRequest<Entry>,
    Saved
  >({
    mergePending: (previous, next) => ({
      ...next,
      queueCompletionCelebration:
        previous.queueCompletionCelebration || next.queueCompletionCelebration,
    }),
    worker: async (date, request) => {
      const startedAt = richTextDiagnosticNow();
      let saved: Saved;
      try {
        saved = await persist(request.entry);
        recordJournalSaveCompleted(
          date,
          request.revision,
          richTextDiagnosticNow() - startedAt,
          true,
        );
      } catch (error) {
        recordJournalSaveCompleted(
          date,
          request.revision,
          richTextDiagnosticNow() - startedAt,
          false,
        );
        throw error;
      }

      if (isLatestRevision(date, request.revision)) {
        onLatestPersisted(date, request, saved);
      }
      return saved;
    },
  });

  return {
    ...queue,
    enqueue: (date, request) => {
      const persistence = queue.enqueue(date, request);
      recordJournalSaveQueued(date, request.revision, queue.depth(date));
      return persistence;
    },
  };
}
