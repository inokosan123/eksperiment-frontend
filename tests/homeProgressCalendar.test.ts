import assert from 'node:assert/strict';
import { buildHomeProgressCalendarModel } from '../components/home/progress-calendar-model';

const TODAY = new Date(2026, 6, 23, 12);

{
  const model = buildHomeProgressCalendarModel([], TODAY);
  assert.deepEqual(model, { current: 0, best: 0, perfectDays: 0, days: {} });
}

{
  const model = buildHomeProgressCalendarModel([
    { date: '2026-07-17', completed: 1, skipped: 0, missed: 0, pending: 0 },
    { date: '2026-07-18', completed: 0, skipped: 2, missed: 0, pending: 0 },
    { date: '2026-07-19', completed: 1, skipped: 1, missed: 0, pending: 0 },
    { date: '2026-07-20', completed: 1, skipped: 0, missed: 0, pending: 1 },
    { date: '2026-07-22', completed: 1, skipped: 0, missed: 0, pending: 0 },
    { date: '2026-07-23', completed: 0, skipped: 0, missed: 1, pending: 0 },
  ], TODAY);

  assert.deepEqual(model.days['2026-07-17'], {
    date: '2026-07-17', state: 'perfect', mode: 'normal', progressPct: 100,
  });
  assert.deepEqual(model.days['2026-07-18'], {
    date: '2026-07-18', state: 'rest', mode: 'all-skipped', progressPct: null,
  });
  assert.deepEqual(model.days['2026-07-20'], {
    date: '2026-07-20', state: 'incomplete', mode: 'normal', progressPct: 50,
  });
  assert.deepEqual(model.days['2026-07-21'], {
    date: '2026-07-21', state: 'rest', mode: 'no-tasks', progressPct: null,
  });
  assert.deepEqual(model.days['2026-07-23'], {
    date: '2026-07-23', state: 'pending', mode: 'normal', progressPct: 0,
  });
  assert.equal(model.current, 1);
  assert.equal(model.best, 2);
  assert.equal(model.perfectDays, 3);
}

{
  const model = buildHomeProgressCalendarModel([
    { date: 'not-a-date', completed: 1, skipped: 0, missed: 0, pending: 0 },
    { date: '2026-07-24', completed: 1, skipped: 0, missed: 0, pending: 0 },
    { date: '2026-07-22', completed: 1, skipped: 0, missed: 0, pending: 0 },
    { date: '2026-07-23', completed: 0, skipped: 0, missed: 0, pending: 1 },
  ], TODAY);

  assert.equal(model.current, 1);
  assert.equal(model.best, 1);
  assert.equal(model.perfectDays, 1);
  assert.equal(model.days['2026-07-24'], undefined);
}

console.log('home progress calendar tests passed');
