const Module = require('node:module');

// Calendar analytics fixtures intentionally exercise Europe/Belgrade's
// 23-hour and 25-hour days. Pin the process zone so CI and developer machines
// do not silently reinterpret those local boundaries.
process.env.TZ = 'Europe/Belgrade';

const calls = [];
const fixtures = {
  plans: [
    {
      id: 'legacy-plan',
      name: 'Legacy plan',
      zones_json: JSON.stringify([
        {
          id: 'legacy-watch',
          name: 'Old watch',
          startMinutes: 540,
          endMinutes: 1020,
          closedGroupIds: ['social'],
        },
      ]),
      rules_json: JSON.stringify([]),
      meta_json: null,
      created_at: 100,
      updated_at: 100,
    },
    {
      id: 'daily-with-dormant-session-draft',
      name: 'Daily with dormant draft',
      zones_json: JSON.stringify([
        {
          id: 'morning-draft',
          name: 'Morning',
          startMinutes: 0,
          endMinutes: 720,
          closedGroupIds: [],
          rules: [],
        },
        {
          id: 'evening-draft',
          name: 'Evening',
          startMinutes: 720,
          endMinutes: 0,
          closedGroupIds: [],
          rules: [],
        },
      ]),
      rules_json: JSON.stringify([]),
      meta_json: JSON.stringify({
        schemaVersion: 4,
        kind: 'daily',
        budgetMinutes: 240,
        tolerableMinutes: 300,
        essentialOnlyMinutes: 360,
      }),
      created_at: 200,
      updated_at: 200,
    },
  ],
  schedule: [{ day: 0, plan_id: 'legacy-plan' }],
  days: [
    {
      date: '2026-07-10',
      plan_id: 'legacy-plan',
      status: 'kept',
      violations: 0,
      target_lost: 0,
    },
  ],
  meta: [
    { key: 'permission', value: JSON.stringify('approved') },
  ],
};

const db = {
  async execAsync(sql) {
    calls.push({ kind: 'exec', sql });
  },
  async getAllAsync(sql, ...params) {
    calls.push({ kind: 'select', sql, params });
    if (sql.includes('PRAGMA table_info(focus_watch_events)')) {
      return [
        { name: 'id' },
        { name: 'ts' },
        { name: 'kind' },
        { name: 'local_day' },
        { name: 'timezone_id' },
        { name: 'utc_offset_minutes' },
      ];
    }
    if (sql.includes('focus_watch_plans')) return fixtures.plans;
    if (sql.includes('focus_watch_schedule')) return fixtures.schedule;
    if (sql.includes('focus_watch_days')) return fixtures.days;
    if (sql.includes('focus_watch_meta')) return fixtures.meta;
    return [];
  },
  async runAsync(sql, ...params) {
    calls.push({ kind: 'write', sql, params });
    return { changes: 1, lastInsertRowId: 0 };
  },
};

global.__focusTestDb = { calls, fixtures };

const originalLoad = Module._load;
Module._load = function focusTestLoad(request, parent, isMain) {
  if (request === 'expo-sqlite') {
    return { openDatabaseAsync: async () => db };
  }
  return originalLoad.call(this, request, parent, isMain);
};

require('tsx/cjs');
require('../tests/focus-v4.test.ts');
require('../tests/focus-analytics.test.ts');
