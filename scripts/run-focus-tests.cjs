const Module = require('node:module');

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
  async getAllAsync(sql) {
    calls.push({ kind: 'select', sql });
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
