import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  CHALLENGE_COMPLETION_EVENT_INSERT_SQL,
  CHALLENGE_COMPLETION_EVENT_RETRACT_SQL,
  CHALLENGE_DAILY_STATUS_REPAIR_SQL,
  CHALLENGE_RECORD_UPSERT_SQL,
  CHALLENGE_TASK_LINK_REPAIR_SQL,
  challengeCompletionEventId,
} from '../components/challenges/challenge-persistence-sql';

test('saving a challenge preserves child progress rows', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE challenges (
      id TEXT PRIMARY KEY, template_id TEXT, title TEXT, description TEXT,
      category TEXT, group_key TEXT, icon TEXT, status TEXT,
      progress_current INTEGER, progress_total INTEGER, progress_unit TEXT,
      headline TEXT, subline TEXT, show_bar INTEGER, streak INTEGER,
      best_streak INTEGER, time TEXT, schedule_label TEXT, pace_label TEXT,
      ended_label TEXT, total_units INTEGER, duration_days INTEGER,
      started_at TEXT, paused_at TEXT, completed_at TEXT, cancelled_at TEXT,
      last_completed_date TEXT, created_at INTEGER, updated_at INTEGER
    );
    CREATE TABLE challenge_daily_status (
      challenge_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      PRIMARY KEY (challenge_id, date),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    );
  `);

  const values: (string | number | null)[] = [
    'church-1', 'church-weekly', 'Go to Church', 'Weekly rhythm',
    'church', 'church', 'cross', 'active', 0, 0, 'trophies',
    '0/1 this week', 'Complete every visit', 0, 0, 0, '09:00',
    'Wed', null, null, null, null, '2026-07-29', null, null, null,
    null, 100, 100,
  ];
  const save = db.prepare(CHALLENGE_RECORD_UPSERT_SQL);
  save.run(...values);
  db.prepare(
    `INSERT INTO challenge_daily_status (challenge_id, date, status)
     VALUES (?, ?, ?)`,
  ).run('church-1', '2026-07-29', 'completed');

  values[2] = 'Go to Church Every Week';
  values[8] = 1;
  values[28] = 200;
  save.run(...values);

  const progress = db.prepare(
    `SELECT status FROM challenge_daily_status
     WHERE challenge_id = ? AND date = ?`,
  ).get('church-1', '2026-07-29') as { status: string } | undefined;
  assert.equal(progress?.status, 'completed');
  assert.equal(
    (db.prepare('SELECT title FROM challenges WHERE id = ?').get('church-1') as { title: string }).title,
    'Go to Church Every Week',
  );
  db.close();
});

test('completion outbox replays only after explicit uncheck and never duplicates the trophy', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE challenges (id TEXT PRIMARY KEY);
    CREATE TABLE challenge_completion_events (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      week_start TEXT,
      trophy_count INTEGER,
      current_streak INTEGER,
      created_at INTEGER NOT NULL,
      acknowledged_at INTEGER,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    );
    CREATE TABLE challenge_church_weeks (
      challenge_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      status TEXT NOT NULL,
      PRIMARY KEY (challenge_id, week_start),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    );
  `);
  db.prepare('INSERT INTO challenges (id) VALUES (?)').run('church-1');
  db.prepare(
    'INSERT INTO challenge_church_weeks (challenge_id, week_start, status) VALUES (?, ?, ?)',
  ).run('church-1', '2026-07-27', 'earned');

  const eventId = challengeCompletionEventId('church_week', 'church-1', '2026-07-27');
  const insert = db.prepare(CHALLENGE_COMPLETION_EVENT_INSERT_SQL);
  insert.run(eventId, 'church-1', 'church_week', 'Go to Church', '2026-07-27', 1, 1, 100);

  const pending = db.prepare(
    'SELECT id FROM challenge_completion_events WHERE acknowledged_at IS NULL',
  ).get() as { id: string } | undefined;
  assert.equal(pending?.id, eventId);

  // Retrying the same Church completion must reuse the pending reward rather
  // than manufacture another event or silently lose the first one.
  const duplicateWhilePending = insert.run(
    eventId,
    'church-1',
    'church_week',
    'Go to Church',
    '2026-07-27',
    1,
    1,
    150,
  );
  assert.equal(duplicateWhilePending.changes, 0);
  assert.equal((db.prepare(
    'SELECT COUNT(*) AS count FROM challenge_completion_events WHERE acknowledged_at IS NULL',
  ).get() as { count: number }).count, 1);

  db.prepare('UPDATE challenge_completion_events SET acknowledged_at = ? WHERE id = ?').run(200, eventId);
  const duplicate = insert.run(
    eventId,
    'church-1',
    'church_week',
    'Go to Church',
    '2026-07-27',
    1,
    1,
    300,
  );
  assert.equal(duplicate.changes, 0);
  const pendingCount = db.prepare(
    'SELECT COUNT(*) AS count FROM challenge_completion_events WHERE acknowledged_at IS NULL',
  ).get() as { count: number };
  assert.equal(pendingCount.count, 0);

  // Explicit uncheck revokes this delivery occurrence. Re-checking emits a
  // fresh pending popup, but the weekly achievement remains one primary row.
  db.prepare(CHALLENGE_COMPLETION_EVENT_RETRACT_SQL).run(eventId);
  const replayAfterUncheck = insert.run(
    eventId,
    'church-1',
    'church_week',
    'Go to Church',
    '2026-07-27',
    1,
    1,
    400,
  );
  assert.equal(replayAfterUncheck.changes, 1);
  assert.equal((db.prepare(
    'SELECT COUNT(*) AS count FROM challenge_completion_events WHERE acknowledged_at IS NULL',
  ).get() as { count: number }).count, 1);
  assert.equal((db.prepare(
    'SELECT COUNT(*) AS count FROM challenge_church_weeks WHERE status = ?',
  ).get('earned') as { count: number }).count, 1);
  db.close();
});

test('legacy repair reconnects a Church task and makes its checked snapshot authoritative', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE challenges (
      id TEXT PRIMARY KEY,
      template_id TEXT,
      progress_current INTEGER,
      progress_total INTEGER,
      duration_days INTEGER,
      total_units INTEGER,
      progress_unit TEXT
    );
    CREATE TABLE tasks (id TEXT PRIMARY KEY, source TEXT);
    CREATE TABLE task_challenge_config (
      task_id TEXT PRIMARY KEY,
      challenge_id TEXT,
      template_id TEXT,
      progress_current INTEGER,
      progress_total INTEGER,
      progress_unit TEXT
    );
    CREATE TABLE task_instances (
      task_id TEXT,
      date TEXT,
      status TEXT,
      resolved_at INTEGER
    );
    CREATE TABLE challenge_daily_status (
      challenge_id TEXT,
      date TEXT,
      status TEXT,
      updated_at INTEGER,
      PRIMARY KEY (challenge_id, date)
    );
  `);
  db.prepare(
    `INSERT INTO challenges VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run('church-1', 'church_weekly', 0, 0, null, null, 'trophies');
  db.prepare('INSERT INTO tasks VALUES (?, ?)').run('challenge_task_church-1', 'challenge');
  db.prepare(
    `INSERT INTO task_challenge_config VALUES (?, ?, ?, ?, ?, ?)`,
  ).run('challenge_task_church-1', 'deleted-challenge', 'old', 0, 0, 'weeks');
  db.prepare(
    `INSERT INTO task_instances VALUES (?, ?, ?, ?)`,
  ).run('challenge_task_church-1', '2026-07-29', 'completed', 200);
  db.prepare(
    `INSERT INTO challenge_daily_status VALUES (?, ?, ?, ?)`,
  ).run('church-1', '2026-07-29', 'skipped', 100);

  db.exec(CHALLENGE_TASK_LINK_REPAIR_SQL);
  db.prepare(CHALLENGE_DAILY_STATUS_REPAIR_SQL).run(300);

  const repairedLink = db.prepare(
    `SELECT challenge_id, template_id FROM task_challenge_config WHERE task_id = ?`,
  ).get('challenge_task_church-1') as { challenge_id: string; template_id: string };
  assert.equal(repairedLink.challenge_id, 'church-1');
  assert.equal(repairedLink.template_id, 'church_weekly');
  const repairedStatus = db.prepare(
    `SELECT status, updated_at FROM challenge_daily_status WHERE challenge_id = ? AND date = ?`,
  ).get('church-1', '2026-07-29') as { status: string; updated_at: number };
  assert.equal(repairedStatus.status, 'completed');
  assert.equal(repairedStatus.updated_at, 200);
  db.close();
});

test('ordinary challenge check → uncheck → recheck celebrates again without a second history row', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE challenges (id TEXT PRIMARY KEY, status TEXT NOT NULL);
    CREATE TABLE challenge_completion_events (
      id TEXT PRIMARY KEY,
      challenge_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      week_start TEXT,
      trophy_count INTEGER,
      current_streak INTEGER,
      created_at INTEGER NOT NULL,
      acknowledged_at INTEGER,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    );
  `);
  db.prepare('INSERT INTO challenges VALUES (?, ?)').run('ordinary-1', 'completed');
  const eventId = challengeCompletionEventId('challenge', 'ordinary-1');
  const insert = db.prepare(CHALLENGE_COMPLETION_EVENT_INSERT_SQL);
  insert.run(eventId, 'ordinary-1', 'challenge', 'Twenty-one day challenge', null, null, null, 100);
  db.prepare(
    'UPDATE challenge_completion_events SET acknowledged_at = ? WHERE id = ?',
  ).run(150, eventId);

  db.prepare('UPDATE challenges SET status = ? WHERE id = ?').run('active', 'ordinary-1');
  db.prepare(CHALLENGE_COMPLETION_EVENT_RETRACT_SQL).run(eventId);
  db.prepare('UPDATE challenges SET status = ? WHERE id = ?').run('completed', 'ordinary-1');
  const replay = insert.run(
    eventId,
    'ordinary-1',
    'challenge',
    'Twenty-one day challenge',
    null,
    null,
    null,
    200,
  );

  assert.equal(replay.changes, 1);
  assert.equal((db.prepare('SELECT COUNT(*) AS count FROM challenges').get() as { count: number }).count, 1);
  assert.equal((db.prepare(
    'SELECT COUNT(*) AS count FROM challenge_completion_events WHERE acknowledged_at IS NULL',
  ).get() as { count: number }).count, 1);
  db.close();
});
