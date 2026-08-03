/**
 * Updating a challenge must not use SQLite REPLACE semantics. REPLACE deletes
 * the parent row before inserting its successor, which activates ON DELETE
 * CASCADE and erases daily progress, Church trophy weeks, and reader sessions.
 */
export const CHALLENGE_RECORD_UPSERT_SQL = `INSERT INTO challenges (
  id, template_id, title, description, category, group_key, icon, status,
  progress_current, progress_total, progress_unit, headline, subline,
  show_bar, streak, best_streak, time, schedule_label, pace_label,
  ended_label, total_units, duration_days, started_at, paused_at,
  completed_at, cancelled_at, last_completed_date, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  template_id = excluded.template_id,
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  group_key = excluded.group_key,
  icon = excluded.icon,
  status = excluded.status,
  progress_current = excluded.progress_current,
  progress_total = excluded.progress_total,
  progress_unit = excluded.progress_unit,
  headline = excluded.headline,
  subline = excluded.subline,
  show_bar = excluded.show_bar,
  streak = excluded.streak,
  best_streak = excluded.best_streak,
  time = excluded.time,
  schedule_label = excluded.schedule_label,
  pace_label = excluded.pace_label,
  ended_label = excluded.ended_label,
  total_units = excluded.total_units,
  duration_days = excluded.duration_days,
  started_at = excluded.started_at,
  paused_at = excluded.paused_at,
  completed_at = excluded.completed_at,
  cancelled_at = excluded.cancelled_at,
  last_completed_date = excluded.last_completed_date,
  updated_at = excluded.updated_at`;

export type ChallengeCompletionEventKind = 'challenge' | 'church_week';

export function challengeCompletionEventId(
  kind: ChallengeCompletionEventKind,
  challengeId: string,
  weekStart?: string,
) {
  return kind === 'church_week'
    ? `church_week:${challengeId}:${weekStart ?? 'unknown'}`
    : `challenge:${challengeId}`;
}

/** INSERT OR IGNORE makes a reward idempotent for its achievement key. */
export const CHALLENGE_COMPLETION_EVENT_INSERT_SQL = `INSERT OR IGNORE INTO challenge_completion_events (
  id, challenge_id, kind, title, week_start, trophy_count,
  current_streak, created_at, acknowledged_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`;

/**
 * Unchecking revokes only the delivery occurrence. The challenge/week row is
 * the achievement ledger, so re-checking can show Congratulations again while
 * History still contains exactly one trophy for that achievement key.
 */
export const CHALLENGE_COMPLETION_EVENT_RETRACT_SQL = `DELETE FROM challenge_completion_events
WHERE id = ?`;

/** Repairs a missing or stale task → challenge relationship from stable ids. */
export const CHALLENGE_TASK_LINK_REPAIR_SQL = `INSERT INTO task_challenge_config (
  task_id, challenge_id, template_id, progress_current, progress_total, progress_unit
)
SELECT task.id, challenge.id, challenge.template_id, challenge.progress_current,
       COALESCE(NULLIF(challenge.progress_total, 0), challenge.duration_days, challenge.total_units, 0),
       challenge.progress_unit
FROM challenges challenge
JOIN tasks task ON task.id = ('challenge_task_' || challenge.id)
WHERE task.source = 'challenge'
ON CONFLICT(task_id) DO UPDATE SET
  challenge_id = excluded.challenge_id,
  template_id = excluded.template_id,
  progress_current = excluded.progress_current,
  progress_total = excluded.progress_total,
  progress_unit = excluded.progress_unit
WHERE task_challenge_config.challenge_id <> excluded.challenge_id
   OR COALESCE(task_challenge_config.template_id, '') <> COALESCE(excluded.template_id, '')`;

/** Task snapshots are authoritative when an older partial write left progress split. */
export const CHALLENGE_DAILY_STATUS_REPAIR_SQL = `INSERT INTO challenge_daily_status (
  challenge_id, date, status, updated_at
)
SELECT link.challenge_id, instance.date, instance.status,
       COALESCE(instance.resolved_at, ?)
FROM task_challenge_config link
JOIN task_instances instance ON instance.task_id = link.task_id
JOIN challenges challenge ON challenge.id = link.challenge_id
WHERE instance.status IN ('completed', 'skipped')
ON CONFLICT(challenge_id, date) DO UPDATE SET
  status = excluded.status,
  updated_at = excluded.updated_at
WHERE challenge_daily_status.status <> excluded.status`;
