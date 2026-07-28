import assert from 'node:assert/strict';
import {
  buildJournalTrophyCalendarModel,
  isTrophyDateKey,
} from '../components/shared/trophyCalendarAnalytics';

const TODAY = new Date(2026, 6, 23, 12);

{
  const model = buildJournalTrophyCalendarModel([], [], TODAY);
  assert.deepEqual(model, { current: 0, best: 0, trophies: 0, days: {} });
}

{
  const model = buildJournalTrophyCalendarModel(
    ['2026-07-20', '2026-07-21', '2026-07-23'],
    ['2026-07-20', '2026-07-21', '2026-07-23'],
    TODAY,
  );
  assert.equal(model.current, 1);
  assert.equal(model.best, 2);
  assert.equal(model.trophies, 3);
  assert.equal(model.days['2026-07-22'].status, 'broken');
}

{
  const model = buildJournalTrophyCalendarModel(
    ['2026-07-21', '2026-07-22'],
    ['2026-07-21', '2026-07-22', '2026-07-23'],
    TODAY,
  );
  assert.equal(model.current, 2);
  assert.equal(model.best, 2);
  assert.equal(model.days['2026-07-23'].status, 'pending');
}

{
  assert.equal(isTrophyDateKey('2026-07-23'), true);
  assert.equal(isTrophyDateKey('2026-02-30'), false);
  assert.equal(isTrophyDateKey('legacy-invalid-row'), false);

  const model = buildJournalTrophyCalendarModel(
    ['legacy-invalid-row', '2026-07-22', '2026-07-25'],
    ['2026-02-30', '2026-07-22'],
    TODAY,
  );
  assert.deepEqual(Object.keys(model.days), ['2026-07-22', '2026-07-23']);
  assert.equal(model.days['2026-07-22'].status, 'kept');
  assert.equal(model.days['2026-07-23'].status, 'pending');
}

console.log('trophy calendar analytics tests passed');
