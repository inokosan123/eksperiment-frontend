import { buildInstanceId } from '@/components/tasks/taskScheduler';
import { openTaskDb, setTaskInstanceStatus } from '@/components/tasks/taskDb';

const GRATITUDE_TASK_ID = 'gratitude_daily_task';

export async function syncGratitudeTaskCompletionsFromEntries(fromDate: string, toDate: string) {
  const db = await openTaskDb();
  let rows: { entry_date: string }[];
  try {
    rows = await db.getAllAsync<{ entry_date: string }>(
      `SELECT entry_date
       FROM gratitude_entries
       WHERE kind = 'daily'
         AND entry_date >= ?
         AND entry_date <= ?
       GROUP BY entry_date
       HAVING COUNT(*) >= 3`,
      fromDate,
      toDate,
    );
  } catch {
    return 0;
  }

  let changed = 0;
  for (const row of rows) {
    const updated = await setTaskInstanceStatus(
      buildInstanceId(GRATITUDE_TASK_ID, row.entry_date),
      'completed',
    );
    if (updated) changed += 1;
  }
  return changed;
}
