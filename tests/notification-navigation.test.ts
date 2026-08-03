import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIFICATION_HOME_ROUTE,
  notificationTapTarget,
} from '../components/notifications/notification-navigation';

test('task notification taps always land on Home', () => {
  assert.equal(notificationTapTarget('task'), '/');
});

test('Big Event notification taps always land on Home', () => {
  assert.equal(notificationTapTarget('big-event'), '/');
});

test('unknown notifications do not hijack navigation', () => {
  assert.equal(notificationTapTarget(null), null);
  assert.equal(NOTIFICATION_HOME_ROUTE, '/');
});
